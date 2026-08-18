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
export const MODEL_VERSION = "v0.1";

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
export const BANDS: { max: number; label: string }[] = [
  { max: 25, label: "1080p düşük ayar" },
  { max: 45, label: "1080p orta/yüksek ayar" },
  { max: 65, label: "1440p yüksek ayar" },
  { max: 80, label: "1440p ultra / 4K yüksek" },
  { max: 100, label: "4K ultra" },
];

/** İki indeks arasındaki bu farktan sonrası darboğaz sayılır. */
export const BOTTLENECK_THRESHOLD = 15;

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
function clampIndex(value: number): number {
  return Math.min(100, Math.max(0, value));
}

/**
 * Bir ondalık basamağa yuvarlar.
 *
 * Yuvarlama bandı seçmeden ÖNCE yapılır: ekranda 25,0 yazarken bandın "0-25"
 * demesi (24,96'nın yuvarlanmış hali) kullanıcı için açıklanamaz bir çelişki
 * olurdu. Gösterilen sayı ile bandı seçen sayı aynı olmalı.
 */
function round1(value: number): number {
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
 * Darboğaz göstergesi.
 *
 * fark = gpu - cpu. Pozitif fark, ekran kartının işlemciden güçlü olması
 * demektir; sınırlayan taraf işlemcidir.
 *
 * SCHEMA.md eşiği "|fark| < 15 dengeli, fark > 15 CPU sınırlıyor" diye yazıyor
 * ve tam 15'i hiçbir dala sokmuyordu; eşik dahil edildi (K33).
 */
export function bottleneckFor(gpuIndex: number, cpuIndex: number): Bottleneck {
  const difference = gpuIndex - cpuIndex;
  if (difference >= BOTTLENECK_THRESHOLD) return "cpu_limited";
  if (difference <= -BOTTLENECK_THRESHOLD) return "gpu_limited";
  return "balanced";
}

/**
 * Sistem indeksi, bant etiketi ve darboğaz göstergesi.
 *
 * İki indeksten biri yoksa hesap yapılmaz: eksik parçaya 0 demek, sistemi
 * olduğundan zayıf gösteren uydurma bir sayı üretirdi.
 */
export function computePerformance(input: PerformanceInput): PerformanceOutcome {
  const missing: ("gpu" | "cpu")[] = [];
  if (input.gpu_index === undefined || input.gpu_index === null) missing.push("gpu");
  if (input.cpu_index === undefined || input.cpu_index === null) missing.push("cpu");
  if (missing.length > 0) return { ok: false, missing };

  const gpuIndex = clampIndex(input.gpu_index!);
  const cpuIndex = clampIndex(input.cpu_index!);
  const weights = RESOLUTION_WEIGHTS[input.resolution];

  const systemIndex = round1(gpuIndex * weights.gpu + cpuIndex * weights.cpu);
  const bottleneck = bottleneckFor(gpuIndex, cpuIndex);

  return {
    ok: true,
    system_index: systemIndex,
    band: bandFor(systemIndex),
    bottleneck,
    bottleneck_message: BOTTLENECK_MESSAGE[bottleneck],
    gpu_index: gpuIndex,
    cpu_index: cpuIndex,
    weights,
    model_version: MODEL_VERSION,
  };
}
