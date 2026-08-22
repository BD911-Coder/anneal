// Spec'ten indeks tahmini — saf hesap.
//
// Veritabanı, ağ, arayüz tanımaz. Girdi: ölçülmüş noktalar + tahmin edilecek
// parçanın ekseni. Çıktı: sayı, yöntem, bant ve bandın nereden geldiği.
//
// NEDEN MOTORDA: hangi modelin hangi bandı taşıdığı bir doğruluk kararı ve
// test edilmeli. Arayüzde ya da script'te dursaydı, "doğrulanmamış aileye dar
// bant takıldı" hatası ancak birisi gözüyle görünce anlaşılırdı.
//
// `perf_index` bu dosyaya HİÇ girmiyor: burada üretilen sayı ayrı bir tabloya
// (`perf_index_estimated`) yazılıyor ve K71 aynen geçerli kalıyor.

/** Bir ailenin kendi bandını taşıyabilmesi için gereken en az ölçüm sayısı. */
export const MIN_FAMILY_FOR_OWN_BAND = 4;

export type MeasuredPoint = {
  id: string;
  family: string;
  /** Ölçülmüş indeks. */
  y: number;
  /** Modelin ekseni — parçanın spec'inden hesaplanmış tek sayı. */
  x: number;
};

export type FittedModel = {
  /** `indeks = k · x^b` */
  k: number;
  b: number;
  /** Bu modelin birini-dışarıda-bırak hatası, p90 yüzde. */
  bandPct: number;
  /** Kaç ölçümle eğitildi. */
  n: number;
};

export type Estimate = {
  index: number;
  method: "spec-model" | "family-mean";
  bandPct: number;
  /** Bandın hangi ailenin doğrulamasından geldiği; `null` = aileler arası. */
  bandSourceFamily: string | null;
  nUsed: number;
};

/**
 * `log(y) = log(k) + b·log(x)` — iki parametreli en küçük kareler.
 *
 * Log uzayı: ölçülen hata yüzde cinsinden okunuyor, mutlak hatayı küçültmek
 * büyük parçalara ağırlık verirdi.
 *
 * En az üç nokta gerekiyor; ikisi her zaman bir doğru verir ve hata payı
 * sıfır çıkar — ölçüm değil ezber olur.
 */
export function fit(points: readonly MeasuredPoint[]): { k: number; b: number } | null {
  if (points.length < 3) return null;
  const n = points.length;
  const lx = points.map((p) => Math.log(p.x));
  const ly = points.map((p) => Math.log(p.y));
  const mx = lx.reduce((s, v) => s + v, 0) / n;
  const my = ly.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i += 1) {
    num += (lx[i] - mx) * (ly[i] - my);
    den += (lx[i] - mx) ** 2;
  }
  if (den === 0) return null;
  const b = num / den;
  return { k: Math.exp(my - b * mx), b };
}

export function predict(model: { k: number; b: number }, x: number): number {
  return model.k * Math.pow(x, model.b);
}

/** Birini-dışarıda-bırak hataları, yüzde. */
export function looErrors(points: readonly MeasuredPoint[]): number[] {
  const errs: number[] = [];
  for (const held of points) {
    const train = points.filter((p) => p.id !== held.id);
    const m = fit(train);
    if (!m) continue;
    errs.push((Math.abs(predict(m, held.x) - held.y) / held.y) * 100);
  }
  return errs;
}

/**
 * Bant = hataların %90'lık dilimi.
 *
 * Ortalama değil p90: "tahminlerin onda dokuzu bu bandın içinde" cümlesi
 * kullanıcıya ortalamadan daha dürüst bir söz veriyor. `lib/fps-margin.ts`
 * de aynı dilimi yayınlıyor.
 */
export function bandFromErrors(errs: readonly number[]): number {
  if (errs.length === 0) return Infinity;
  const sorted = [...errs].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(0.9 * sorted.length))];
}

/**
 * Bir aile için model kur ve bandını ölç.
 *
 * `null` döner: ailede kendi bandını taşıyacak kadar ölçüm yok. Çağıran taraf
 * aileler arası modele düşer — **komşu ailenin bandını ödünç almaz**.
 * Doğrulanmamış bir ailenin hatası küçük değil, bilinmiyor (K156).
 */
export function fitFamily(points: readonly MeasuredPoint[]): FittedModel | null {
  if (points.length < MIN_FAMILY_FOR_OWN_BAND) return null;
  const m = fit(points);
  if (!m) return null;
  return { ...m, bandPct: bandFromErrors(looErrors(points)), n: points.length };
}

/**
 * Aileler arası model: parçanın KENDİ ailesi dışındaki bütün ölçümler.
 *
 * Kendi ailesi dışlanıyor çünkü aksi hâlde ölçümlü bir ailenin parçası kendi
 * komşularından tahmin edilmiş olurdu ve bu, aileler arası bandı olduğundan
 * iyimser gösterirdi.
 */
export function fitCrossFamily(
  points: readonly MeasuredPoint[],
  excludeFamily: string,
): FittedModel | null {
  const train = points.filter((p) => p.family !== excludeFamily);
  const m = fit(train);
  if (!m) return null;
  // Bandı, aynı dışlama kuralıyla ölçülmüş LOO hatasından al.
  const errs: number[] = [];
  for (const held of points) {
    const t = points.filter((p) => p.id !== held.id && p.family !== held.family);
    const fm = fit(t);
    if (!fm) continue;
    errs.push((Math.abs(predict(fm, held.x) - held.y) / held.y) * 100);
  }
  return { ...m, bandPct: bandFromErrors(errs), n: train.length };
}

/**
 * Bir parçanın tahmini.
 *
 * SIRA:
 *   1. Ailesi doğrulanabiliyorsa ailesinin modeli
 *   2. Aileler arası model
 *   3. İkisi de kurulamıyorsa ailenin ölçülmüş ORTALAMASI (`family-mean`)
 *
 * **1 ile 2 arasında dar bant kazanır.** İkisi de birini-dışarıda-bırak ile
 * ölçüldü; ölçülmüş iki seçenekten dar olanı seçmek kiraz toplamak değil,
 * daha iyi doğrulanmış olanı almaktır. Bugün işlemcide aileler arası model
 * aile içinden dar çıkıyor (12 nokta ile eğitiliyor, 4 ile değil).
 */
export function estimate(
  allPoints: readonly MeasuredPoint[],
  family: string,
  x: number | null,
): Estimate | null {
  const inFamily = allPoints.filter((p) => p.family === family);

  if (x !== null && x > 0) {
    const own = fitFamily(inFamily);
    const cross = fitCrossFamily(allPoints, family);
    const secilen =
      own && cross ? (own.bandPct <= cross.bandPct ? own : cross) : (own ?? cross);

    if (secilen) {
      const kendisi = secilen === own;
      return {
        index: round1(predict(secilen, x)),
        method: "spec-model",
        bandPct: round1(secilen.bandPct),
        bandSourceFamily: kendisi ? family : null,
        nUsed: secilen.n,
      };
    }
  }

  // Model kurulamadı: ekseni eksik ya da hiç eğitim verisi yok.
  // Ailenin ortalaması bir MODEL DEĞİL, ortalamadır ve öyle etiketlenir.
  if (inFamily.length > 0) {
    const mean = inFamily.reduce((s, p) => s + p.y, 0) / inFamily.length;
    const errs = inFamily.map((p) => (Math.abs(mean - p.y) / p.y) * 100);
    return {
      index: round1(mean),
      method: "family-mean",
      bandPct: round1(bandFromErrors(errs)),
      bandSourceFamily: family,
      nUsed: inFamily.length,
    };
  }

  // Ailede hiç ölçüm yok ve eksen de yok: bütün ölçümlerin ortalaması.
  if (allPoints.length === 0) return null;
  const mean = allPoints.reduce((s, p) => s + p.y, 0) / allPoints.length;
  const errs = allPoints.map((p) => (Math.abs(mean - p.y) / p.y) * 100);
  return {
    index: round1(mean),
    method: "family-mean",
    bandPct: round1(bandFromErrors(errs)),
    bandSourceFamily: null,
    nUsed: allPoints.length,
  };
}

/**
 * Bant genişliğinden güven seviyesi.
 *
 * Eşikler bir KARAR, ölçüm değil — `lib/fps-bands.ts`teki eşikler gibi.
 * Gerekçe: %15 altı bir bant, kullanıcının kararını değiştirmeyecek kadar
 * dar; %30 üstü bant "kabaca bu civarda" demekten öteye geçmiyor.
 */
export function confidenceFor(bandPct: number): "high" | "medium" | "low" {
  if (bandPct <= 15) return "high";
  if (bandPct <= 30) return "medium";
  return "low";
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}
