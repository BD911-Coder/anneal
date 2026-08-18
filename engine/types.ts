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
