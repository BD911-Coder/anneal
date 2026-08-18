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

export type EngineGpu = {
  id: string;
  tdp_watt: number;
  length_mm: number;
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
  length_mm: number;
};

export type EngineCase = {
  id: string;
  supported_form_factors: FormFactor[];
  max_gpu_length_mm: number;
  max_psu_length_mm: number;
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
  gpu_index?: number; // 0-100
  cpu_index?: number; // 0-100
};

export type Bottleneck = "balanced" | "cpu_limited" | "gpu_limited";

export type PerformanceResult = {
  ok: true;
  system_index: number; // 0-100, bir ondalık basamağa yuvarlanmış
  band: string; // bant etiketi, SCHEMA.md bölüm 8'deki tablo
  bottleneck: Bottleneck;
  bottleneck_message: string;
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
