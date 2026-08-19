// Motorun girdi tipleri.
//
// Bu dosya hiçbir şey içe aktarmaz — ne Prisma, ne veritabanı, ne React.
// Sebebi: motor mobil uygulamada yeniden kullanılabilsin, testler kısa olsun
// ve iki motor sürümü aynı girdiyle karşılaştırılabilsin.
//
// Alanlar SCHEMA.md'deki adlarla birebir aynı, ama sadece uyumluluk
// kurallarının kullandıkları var. Veritabanı satırını bu tiplere çeviren
// dönüştürücü /data altına, arayüz adımında yazılacak.

export type MemoryType = "DDR4" | "DDR5";
export type FormFactor = "ATX" | "mATX" | "ITX" | "E-ATX";

export type EngineCpu = {
  id: string;
  socket: string;
  tdp_watt: number;
  has_igpu: boolean;
};

// Motorun kullandığı ekran kartı. İki kaynaktan gelebilir: doğrudan çipin
// referans değerleri, ya da bir kart (AIB) seçildiyse kartın değerleri.
// Çözümlemeyi gpu-selection.ts yapar; motorun geri kalanı farkı görmez.
export type EngineGpu = {
  id: string;
  tdp_watt: number;
  /** Bilinmiyor olabilir (K52). Boşsa C5 kuralı atlanır. */
  length_mm?: number;
};

/**
 * Ekran kartı varyantı (AIB kartı) — SCHEMA.md bölüm 2, `gpu_variant_specs`.
 *
 * Yalnızca kural kullanan iki alanı var: C4'ün TBP'si ve C5'in uzunluğu.
 * İkisi de opsiyonel; eksik olduklarında ne olacağını K87 söylüyor.
 */
export type EngineGpuVariant = {
  id: string;
  tbp_watt?: number;
  length_mm?: number;
};

/**
 * Bir değer nereden geldi?
 *
 * Arayüz bunu kullanıcıya söylemek zorunda: referans değerle yapılmış bir güç
 * hesabı, kartın kendi değeriyle yapılmış gibi gösterilemez (K87).
 */
export type GpuValueOrigin = "variant" | "chip_reference" | "unknown";

export type ResolvedGpu = {
  gpu: EngineGpu;
  tdp_origin: GpuValueOrigin;
  length_origin: GpuValueOrigin;
};

/** `perf_index` iki seviyeli okunur: kartın kendi indeksi yoksa çipinki (K86). */
export type ResolvedPerfIndex = {
  value?: number;
  /** `null`: hiçbir seviyede indeks yok. */
  origin: "variant" | "chip" | null;
};

export type EngineMotherboard = {
  id: string;
  socket: string;
  form_factor: FormFactor;
  memory_type: MemoryType;
  memory_slots: number;
  max_memory_gb: number;
  max_memory_speed_mhz: number;
};

export type EngineRam = {
  id: string;
  memory_type: MemoryType;
  capacity_gb: number; // kit toplamı, tek modül değil
  module_count: number;
  speed_mhz: number;
};

export type EnginePsu = {
  id: string;
  wattage: number;
  /** Bilinmiyor olabilir (K62). Boşsa W5 kuralı atlanır. */
  length_mm?: number;
};

export type EngineCase = {
  id: string;
  supported_form_factors: FormFactor[];
  /** Bilinmiyor olabilir (K62). Boşsa C5 kuralı atlanır. */
  max_gpu_length_mm?: number;
  /** Bilinmiyor olabilir (K62). Boşsa W5 kuralı atlanır. */
  max_psu_length_mm?: number;
};

// Parçaların hepsi opsiyonel: kullanıcı sistemi parça parça topluyor ve
// yarım sistemin de kontrol edilebilmesi gerekiyor.
export type BuildInput = {
  cpu?: EngineCpu;
  gpu?: EngineGpu;
  motherboard?: EngineMotherboard;
  ram?: EngineRam;
  psu?: EnginePsu;
  case?: EngineCase;
};

export type FindingLevel = "error" | "warning";

export type ErrorCode = "C1" | "C2" | "C3" | "C4" | "C5" | "C6";
export type WarningCode = "W1" | "W2" | "W3" | "W4" | "W5";
export type FindingCode = ErrorCode | WarningCode;

export type Finding = {
  code: FindingCode;
  level: FindingLevel;
  message: string;
  involved_part_ids: string[];
};

// ---------------------------------------------------------------------------
// Performans motoru — SCHEMA.md bölüm 8
// ---------------------------------------------------------------------------

// Değerler SCHEMA.md'deki Resolution enum'ıyla birebir aynı. Arayüz "4K"
// yazabilir ama motorun tanıdığı değer '2160p'dir.
export type Resolution = "1080p" | "1440p" | "2160p";

// Motor parça nesnelerini değil, önceden hesaplanmış indeksleri alır:
// perf_index tablosu motorun çıktısıdır, girdisi değil. Böylece motor
// veritabanını tanımadan çalışır.
export type PerformanceInput = {
  resolution: Resolution;
  /** Referans parça = 100 (K73). Üst sınır yok. */
  gpu_index?: number;
  cpu_index?: number;
  /**
   * Kataloğun en yüksek indeksleri. Darboğaz göstergesi bunları kullanır:
   * "bu parçayı katalogdaki en iyisiyle değiştirsem ne kazanırım?" (K83).
   *
   * Opsiyonel çünkü indeks dondurma (freezeSystemIndex) darboğaza bakmıyor.
   * Verilmezse `bottleneck` null döner — bilinmeyen şey uydurulmaz.
   */
  best_gpu_index?: number;
  best_cpu_index?: number;
};

export type Bottleneck = "balanced" | "cpu_limited" | "gpu_limited";

export type PerformanceResult = {
  ok: true;
  system_index: number; // 0-100, bir ondalık basamağa yuvarlanmış
  band: string; // bant etiketi, SCHEMA.md bölüm 8'deki tablo
  /** Katalogun en iyileri verilmediyse null: hangi parcanin sinirladigi bilinmiyor. */
  bottleneck: Bottleneck | null;
  bottleneck_message: string | null;
  /** Darbogaz kararinin dayandigi iki kazanc — arayuz gerekcesini gosterebilsin. */
  bottleneck_gain: { gpu: number; cpu: number } | null;
  gpu_index: number; // kullanılan (kırpılmış) değerler — hesap izlenebilir olsun
  cpu_index: number;
  weights: { gpu: number; cpu: number };
  model_version: string;
};

// Eksik girdiyle sayı uydurulmaz: hangi parçanın indeksi yoksa o söylenir.
export type PerformanceUnavailable = {
  ok: false;
  missing: ("gpu" | "cpu")[];
};

export type PerformanceOutcome = PerformanceResult | PerformanceUnavailable;

// ---------------------------------------------------------------------------
// Yükseltme önerisi — SCHEMA.md bölüm 8
// ---------------------------------------------------------------------------

// Sadece gpu ve cpu: sistem indeksi formülü yalnızca bu ikisini kullanıyor,
// başka bir kategoriyi yükseltmek indeksi hiç değiştirmez (K40).
export type UpgradeCategory = "gpu" | "cpu";

// Motorun bir parça hakkında bilmesi gereken her şey. Katalog, marka/model gibi
// alanlar burada yok: motor onları kullanmıyor, arayüz id ile eşleştiriyor.
export type UpgradePart = {
  id: string;
  price_minor: number; // kuruş
  perf_index?: number; // 0-100. Yoksa parça aday olamaz.
};

export type UpgradeInput = {
  resolution: Resolution;
  // Mevcut sistemin yükseltmeye açık iki parçası.
  current: Partial<Record<UpgradeCategory, UpgradePart>>;
  // Bütçe farkı, kuruş. `+2000 TL` -> 200000.
  budget_delta_minor: number;
  candidates: Record<UpgradeCategory, UpgradePart[]>;
};

export type UpgradeSuggestion = {
  category: UpgradeCategory;
  current_part_id: string;
  suggested_part_id: string;
  price_delta_minor: number; // ek maliyet, kuruş
  index_before: number;
  index_after: number;
  index_delta: number;
};
