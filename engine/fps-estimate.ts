// Oyun bazlı FPS tahmini — Faz A.1. Plan: docs/faz-a1-plani.md
//
// Saf fonksiyon: girdi alır, çıktı verir. Veritabanı, ağ, dosya sistemi ve
// React erişimi yoktur ve olmamalıdır.
//
// Neden /engine içinde: bu dosya sessizce yanlış sonuç verebilen bir yer.
// Yanlış bir oran, kullanıcıya "bu oyun 120 FPS gider" dedirtir ve sayının
// yanlış olduğu ancak kullanıcı oyunu alıp oynayınca anlaşılır. CLAUDE.md
// testi tam olarak bu tür yerler için istiyor.
//
// Üretilen sayı HİÇBİR TABLOYA YAZILMAZ, okuma anında hesaplanır. Gerekçe
// K71'in aynısı: hesaplanmış bir sayı ölçüm tablosuna yazılırsa ölçümden
// ayırt edilemez hale gelir ve "bu sayı nereden geldi" sorusu cevapsız kalır.

import type { Resolution } from "./types";

/** Bir oyunun tek bir ayarındaki ölçümlerden biri. */
export type FpsMeasurement = {
  /** Ölçümün ait olduğu parça — bugün her zaman bir GPU çipi. */
  part_id: string;
  avg_fps: number;
  /**
   * O parçanın `perf_index` değeri. Bilinmiyor olabilir: ölçümü var ama
   * indeksi hesaplanmamış bir parça orana katılamaz, ama kendi ölçülmüş
   * sayısını yine de verebilir.
   */
  index?: number;
};

/**
 * Bir oyun + tek bir ayar bileşimi. Farklı ayarlar (çözünürlük, preset,
 * upscaling) ayrı gruplardır ve karıştırılamaz — 1080p medium ölçümüyle
 * 1440p ultra ölçümü aynı orana giremez.
 */
export type FpsGameGroup = {
  game_id: string;
  game_name: string;
  /**
   * Ölçümün çözünürlüğü. Etiketin içinde de geçiyor ama ayrı alan olarak
   * duruyor: arayüz kullanıcının seçtiği çözünürlüğe göre SÜZÜYOR ve süzme
   * metin eşleştirmesiyle yapılamaz.
   */
  resolution: Resolution;
  /** Kullanıcıya gösterilecek ayar etiketi, örn. "1440p ultra, DLSS/FSR Quality". */
  setting_label: string;
  measurements: FpsMeasurement[];
};

/**
 * Sayı ölçüldü mü türetildi mi?
 *
 * Bu alan arayüz süsü değil, dosyanın varlık sebebi. Ölçülmüş bir sayı ile
 * orandan türetilmiş bir sayı aynı listede duruyorsa ayırt edilebilmek
 * zorunda — K116'nın çip fiyatında ve K74'ün kart indeksinde kurduğu desenin
 * aynısı.
 */
export type FpsOrigin = "measured" | "derived";

export type GameFpsEstimate = {
  game_id: string;
  game_name: string;
  setting_label: string;
  fps: number;
  origin: FpsOrigin;
};

/**
 * Oran hesabı için gereken en az ölçüm sayısı.
 *
 * 3 seçildi: iki nokta her zaman bir doğru verir ve dağılımı ölçülemez, yani
 * oranın ne kadar güvenilir olduğu söylenemez. Üçüncü nokta, oranın gerçekten
 * sabit mi yoksa iki uç arasında rastgele mi olduğunu gösteren ilk kanıttır.
 *
 * Bugünkü veride her grupta 8 ölçüm var; bu eşik gelecekteki seyrek gruplar
 * için duruyor.
 */
export const MIN_RATIO_MEASUREMENTS = 3;

/**
 * Bir oyunun içinde FPS ile indeks arasındaki oran.
 *
 * `null`: oran hesaplanamıyor (yeterli ölçüm yok). Uydurma bir oran yerine
 * `null` — o oyun için satır hiç üretilmez.
 *
 * Oranların oyundan oyuna çok farklı olması (ölçüldü: 0.41'den 1.51'e) bu
 * özelliğin sebebidir. Tek bir sistem indeksi oyunlar arasındaki bu farkı
 * gizliyor; F1 25 ile Assassin's Creed aynı karta üç kat farklı FPS veriyor.
 */
export function ratioFor(measurements: readonly FpsMeasurement[]): number | null {
  // Indeksi olmayan ya da sıfır/negatif olan ölçüm orana giremez: bölme
  // tanımsız olur, sıfır indeks de "ölçülmedi" demenin bir yolu değil.
  const usable = measurements.filter((m) => m.index !== undefined && m.index > 0);
  if (usable.length < MIN_RATIO_MEASUREMENTS) return null;

  const total = usable.reduce((sum, m) => sum + m.avg_fps / m.index!, 0);
  return total / usable.length;
}

/**
 * Seçilen ekran kartı için oyun başına FPS.
 *
 * `part_id` — indeksin ait olduğu parçanın id'si. Kart (AIB) seçiliyse bu
 * çipin id'sidir, çünkü indeks de ölçüm de çip seviyesinde (K86). Arayüz
 * ayrıca "bu sayı çipin ölçümüdür" der; burada tekrarlanmaz.
 *
 * `index` yoksa liste **boş** döner: indekssiz bir kart için türetilecek bir
 * şey yok ve uydurulacak bir şey hiç yok.
 *
 * Sıralama burada YAPILMAZ. Sıra bir arayüz kararıdır (S40) ve motorun işi
 * değil; çağıran taraf sıralar.
 */
export function estimateGameFps(
  part_id: string | undefined,
  index: number | undefined,
  groups: readonly FpsGameGroup[],
): GameFpsEstimate[] {
  if (index === undefined || index <= 0) return [];

  const out: GameFpsEstimate[] = [];

  for (const group of groups) {
    const ortak = { game_id: group.game_id, game_name: group.game_name, setting_label: group.setting_label };

    // Ölçüm varsa türetme yapılmaz. Ölçüm bir gerçektir; oranla "düzeltmek"
    // elimizdeki tek sağlam veriyi modelin gürültüsüyle bozmak olurdu.
    const measured = part_id === undefined ? undefined : group.measurements.find((m) => m.part_id === part_id);
    if (measured) {
      // Ölçüm olduğu gibi geçer, yuvarlanmaz: kaynağında yazan sayı budur.
      out.push({ ...ortak, fps: measured.avg_fps, origin: "measured" });
      continue;
    }

    const ratio = ratioFor(group.measurements);
    if (ratio === null) continue;

    // Türetilen sayı TAM SAYIYA yuvarlanır, ölçüm ise ondalığını korur.
    // Ölçülen hata payı ±%10 iken ondalık basamak yanlış bir kesinlik
    // vaadidir; 87 dürüst, 87,4 değil. Aradaki biçim farkı aynı zamanda
    // ölçüm/türetme ayrımının sessiz ikinci işareti.
    out.push({ ...ortak, fps: Math.round(index * ratio), origin: "derived" });
  }

  return out;
}

/** Ölçülmüş ve türetilmiş hücre sayısı — arayüzün kapsamı anlatması için. */
export function countByOrigin(estimates: readonly GameFpsEstimate[]): {
  measured: number;
  derived: number;
} {
  return {
    measured: estimates.filter((e) => e.origin === "measured").length,
    derived: estimates.filter((e) => e.origin === "derived").length,
  };
}
