// Veritabanı satırlarını motorun tiplerine çevirir.
//
// K22'nin ikinci yarısı: motor kendi sade tiplerini tanımlıyor, bu dosya da
// tek çeviri noktası. Bir alan adı şemada değişirse hata buradan çıkar,
// motorun içinden değil.
//
// Girdi tipleri Prisma'dan içe aktarılmıyor, yapısal olarak yazılıyor: çağıran
// taraf Prisma sonucunu geçtiğinde TypeScript zaten uyumu denetliyor.

import type {
  EngineCase,
  EngineCpu,
  EngineGpu,
  EngineMotherboard,
  EnginePsu,
  EngineRam,
  FormFactor,
} from "@/engine/types";

/**
 * Prisma enum üyesi -> motor değeri.
 *
 * Prisma'da `E-ATX` yazılamadığı için üye adı `E_ATX` (K7). Veritabanındaki
 * gerçek değer `E-ATX`, motorun beklediği de o. Çeviri burada yapılıyor.
 */
const FORM_FACTOR: Record<string, FormFactor> = {
  ATX: "ATX",
  mATX: "mATX",
  ITX: "ITX",
  E_ATX: "E-ATX",
};

function toFormFactor(value: string): FormFactor {
  const mapped = FORM_FACTOR[value];
  if (!mapped) {
    throw new Error(`Bilinmeyen form faktörü: ${value}`);
  }
  return mapped;
}

export function toEngineCpu(row: {
  part_id: string;
  socket: string;
  tdp_watt: number;
  has_igpu: boolean;
}): EngineCpu {
  return {
    id: row.part_id,
    socket: row.socket,
    tdp_watt: row.tdp_watt,
    has_igpu: row.has_igpu,
  };
}

export function toEngineGpu(row: {
  part_id: string;
  tdp_watt: number;
  length_mm: number;
}): EngineGpu {
  return {
    id: row.part_id,
    tdp_watt: row.tdp_watt,
    length_mm: row.length_mm,
  };
}

export function toEngineMotherboard(row: {
  part_id: string;
  socket: string;
  form_factor: string;
  memory_type: "DDR4" | "DDR5";
  memory_slots: number;
  max_memory_gb: number;
  max_memory_speed_mhz: number;
}): EngineMotherboard {
  return {
    id: row.part_id,
    socket: row.socket,
    form_factor: toFormFactor(row.form_factor),
    memory_type: row.memory_type,
    memory_slots: row.memory_slots,
    max_memory_gb: row.max_memory_gb,
    max_memory_speed_mhz: row.max_memory_speed_mhz,
  };
}

export function toEngineRam(row: {
  part_id: string;
  memory_type: "DDR4" | "DDR5";
  capacity_gb: number;
  module_count: number;
  speed_mhz: number;
}): EngineRam {
  return {
    id: row.part_id,
    memory_type: row.memory_type,
    capacity_gb: row.capacity_gb,
    module_count: row.module_count,
    speed_mhz: row.speed_mhz,
  };
}

export function toEnginePsu(row: {
  part_id: string;
  wattage: number;
  length_mm: number;
}): EnginePsu {
  return {
    id: row.part_id,
    wattage: row.wattage,
    length_mm: row.length_mm,
  };
}

export function toEngineCase(row: {
  part_id: string;
  supported_form_factors: string[];
  max_gpu_length_mm: number;
  max_psu_length_mm: number;
}): EngineCase {
  return {
    id: row.part_id,
    supported_form_factors: row.supported_form_factors.map(toFormFactor),
    max_gpu_length_mm: row.max_gpu_length_mm,
    max_psu_length_mm: row.max_psu_length_mm,
  };
}
