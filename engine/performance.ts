// Performans motoru v0.1 — SCHEMA.md bölüm 8.
//
// Saf fonksiyon: girdi alır, çıktı verir. Veritabanı, ağ, dosya sistemi ve
// React erişimi yoktur ve olmamalıdır.
//
// Oyun bazlı FPS değil, tek skor. Çıktı her zaman "tahmini"dir; gerçek FPS
// iddiası edilmez.

import type {
  Bottleneck,
  PerformanceInput,
  PerformanceOutcome,
  Resolution,
} from "./types";

/**
 * Bu hesabı üreten motor sürümü.
 *
 * perf_index satırları da bu sürümle yazılır. Sayı değişirse eski hesaplarla
 * yenisi karıştırılmasın diye bu sabit tek yerde durur.
 */
export const MODEL_VERSION = "v0.2";

/**
 * Çözünürlüğe göre ağırlıklar. Çözünürlük yükseldikçe yük ekran kartına kayar,
 * işlemcinin payı düşer.
 */
export const RESOLUTION_WEIGHTS: Record<Resolution, { gpu: number; cpu: number }> = {
  "1080p": { gpu: 0.55, cpu: 0.45 },
  "1440p": { gpu: 0.75, cpu: 0.25 },
  "2160p": { gpu: 0.88, cpu: 0.12 },
};

/**
 * Bant tablosu. `max` üst sınırdır ve **dahil değildir**: 25.0 ikinci banda
 * girer, birinciye değil. SCHEMA.md tablosu sınırı hangi banda saydığını
 * söylemiyordu; bir yana karar vermek şarttı (docs/KARARLAR.md K33).
 */
// K73: ölçek sabit referans parçaya bağlı (RTX 4070 / Ryzen 5 9600X = 100),
// kataloğun en hızlısına değil. Referans sistem her çözünürlükte tam 100 verir.
// Sınırlar GEÇİCİ: ölçülmüş sistemlere karşı doğrulanmadan kesinleşmiş sayılmaz.
export const BANDS: { max: number; label: string }[] = [
  { max: 40, label: "1080p düşük ayar" },
  { max: 65, label: "1080p orta/yüksek ayar" },
  { max: 90, label: "1440p yüksek ayar" },
  { max: 130, label: "1440p ultra / 4K yüksek" },
  { max: Infinity, label: "4K ultra" },
];

/**
 * İki kazanç arasındaki göreli fark bu oranın altındaysa sistem dengelidir.
 *
 * 0.20 = %20. Fark bunun altındaysa hangi parçayı yükseltirsen yükselt benzer
 * kazanç geliyor demektir; birini "sınırlıyor" diye göstermek yanıltıcı olur.
 */
export const BOTTLENECK_BALANCE_RATIO = 0.2;

const BOTTLENECK_MESSAGE: Record<Bottleneck, string> = {
  balanced: "Dengeli — işlemci ve ekran kartı birbirine yakın güçte.",
  cpu_limited:
    "İşlemci sınırlıyor — ekran kartı işlemciden belirgin şekilde güçlü, kart tam kullanılamayabilir.",
  gpu_limited:
    "Ekran kartı sınırlıyor — işlemci ekran kartından belirgin şekilde güçlü, bu çözünürlükte kart yetişemeyebilir.",
};

/**
 * İndeks 0-100 aralığının dışına çıkamaz.
 *
 * Bozuk bir perf_index satırı (105 gibi) hesabı sessizce şişirmesin; bant
 * tablosunun da 100 üstü karşılığı yok.
 */
/**
 * Negatif indeks anlamsız, tavan yok (K73).
 *
 * Eskiden 100'de kırpılıyordu; ölçek "kataloğun en hızlısı = 100" iken doğruydu.
 * Artık 100 sabit bir referans parça ve ondan hızlı parçalar 100'ü aşıyor —
 * kırpmak RTX 5090'ı RTX 4070 seviyesine indirirdi.
 */
function clampIndex(value: number): number {
  return Math.max(0, value);
}

/**
 * Bir ondalık basamağa yuvarlar.
 *
 * Yuvarlama bandı seçmeden ÖNCE yapılır: ekranda 25,0 yazarken bandın "0-25"
 * demesi (24,96'nın yuvarlanmış hali) kullanıcı için açıklanamaz bir çelişki
 * olurdu. Gösterilen sayı ile bandı seçen sayı aynı olmalı.
 */
export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** İndeksin düştüğü bant etiketi. */
export function bandFor(systemIndex: number): string {
  for (const band of BANDS) {
    if (systemIndex < band.max) return band.label;
  }
  return BANDS[BANDS.length - 1].label; // tam 100
}

/**
 * Darboğaz göstergesi — marjinal kazanç yöntemi (K83).
 *
 * Eski yöntem iki indeksin farkına bakıyordu (`|gpu - cpu| < 15`). Ölçek sabit
 * referansa bağlanınca (K73) bu geçersiz kaldı: iki indeks **farklı**
 * referanslara göre normalize (GPU'da RTX 4070 = 100, CPU'da Ryzen 5 9600X =
 * 100) ve dinamik aralıkları farklı. Farklarını almak, iki ayrı cetvelin
 * sayılarını çıkarmak gibiydi — RTX 5090 + Ryzen 7 9800X3D "işlemci
 * sınırlıyor" çıkıyordu.
 *
 * Yeni soru ölçekten bağımsız: **"hangisini değiştirirsem daha çok
 * kazanırım?"**
 *
 *   kazanç_gpu = (katalogun en iyi gpu indeksi - mevcut gpu) * w_gpu
 *   kazanç_cpu = (katalogun en iyi cpu indeksi - mevcut cpu) * w_cpu
 *
 * Ağırlıklarla çarpılıyor çünkü kazanç sistem indeksine yansıdığı kadar
 * gerçek: 4K'da işlemciyi yükseltmenin sistem indeksine katkısı zaten küçük.
 *
 * İkisi de sıfırsa (her iki parça da kataloğun en iyisi) sistem dengelidir —
 * yükseltilecek bir şey yok.
 */
export function bottleneckFor(
  gpuIndex: number,
  cpuIndex: number,
  bestGpuIndex: number,
  bestCpuIndex: number,
  weights: { gpu: number; cpu: number },
): { bottleneck: Bottleneck; gain: { gpu: number; cpu: number } } {
  // Mevcut parça katalogun en iyisinden güçlüyse kazanç negatif olmaz.
  const gpuGain = Math.max(0, bestGpuIndex - gpuIndex) * weights.gpu;
  const cpuGain = Math.max(0, bestCpuIndex - cpuIndex) * weights.cpu;
  const gain = { gpu: round1(gpuGain), cpu: round1(cpuGain) };

  const enBuyuk = Math.max(gpuGain, cpuGain);
  if (enBuyuk === 0) return { bottleneck: "balanced", gain };

  const goreliFark = Math.abs(gpuGain - cpuGain) / enBuyuk;
  if (goreliFark < BOTTLENECK_BALANCE_RATIO) return { bottleneck: "balanced", gain };

  // Ekran kartını değiştirmek daha çok kazandırıyorsa sınırlayan ekran kartıdır.
  return { bottleneck: gpuGain > cpuGain ? "gpu_limited" : "cpu_limited", gain };
}

export function computePerformance(input: PerformanceInput): PerformanceOutcome {
  const missing: ("gpu" | "cpu")[] = [];
  if (input.gpu_index === undefined || input.gpu_index === null) missing.push("gpu");
  if (input.cpu_index === undefined || input.cpu_index === null) missing.push("cpu");
  if (missing.length > 0) return { ok: false, missing };

  const gpuIndex = clampIndex(input.gpu_index!);
  const cpuIndex = clampIndex(input.cpu_index!);
  const weights = RESOLUTION_WEIGHTS[input.resolution];

  const systemIndex = round1(gpuIndex * weights.gpu + cpuIndex * weights.cpu);

  // Katalogun en iyileri bilinmiyorsa darboğaz sorusu cevaplanamaz. Uydurma
  // yerine null: arayüz satırı hiç göstermez.
  const bestKnown =
    input.best_gpu_index !== undefined && input.best_cpu_index !== undefined;
  const darbogaz = bestKnown
    ? bottleneckFor(gpuIndex, cpuIndex, input.best_gpu_index!, input.best_cpu_index!, weights)
    : null;

  return {
    ok: true,
    system_index: systemIndex,
    band: bandFor(systemIndex),
    bottleneck: darbogaz?.bottleneck ?? null,
    bottleneck_message: darbogaz ? BOTTLENECK_MESSAGE[darbogaz.bottleneck] : null,
    bottleneck_gain: darbogaz?.gain ?? null,
    gpu_index: gpuIndex,
    cpu_index: cpuIndex,
    weights,
    model_version: MODEL_VERSION,
  };
}

/**
 * Kaydedilen sistemin dondurulacak indeksi. Hesaplanamıyorsa `null`.
 *
 * Kuralın kendi adı olan bir fonksiyonu olmasının sebebi: "indeks yoksa ne
 * yazılır" sorusunun cevabı tek yerde dursun ve test edilebilsin. Ekran kartsız
 * (iGPU) sistemler geçerlidir ama indeksleri hesaplanamaz; bu durumda 0 değil
 * `null` yazılır — 0, "sistem çok yavaş" demek olurdu ve dondurulan bir sayı
 * sonradan düzeltilemez (docs/KARARLAR.md K44).
 *
 * Çözünürlük çağıran taraftan gelir: kullanıcı hangi çözünürlükte kaydettiyse
 * indeks o çözünürlükte donar (K43).
 */
export function freezeSystemIndex(input: PerformanceInput): number | null {
  const result = computePerformance(input);
  return result.ok ? result.system_index : null;
}
