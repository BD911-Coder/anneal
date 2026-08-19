// Parça kataloğunu okur.
//
// dev-seed filtresi data/visibility.ts'te tanımlı ve bu dosyadaki her sorgu
// onu kullanır (2. katman). Fiyat ve performans indeksi burada değil,
// data/prices.ts ve data/perf.ts içinde okunur — bir dosya bir iş yapar.

import type {
  EngineCase,
  EngineCpu,
  EngineGpu,
  EngineGpuVariant,
  EngineMotherboard,
  EnginePsu,
  EngineRam,
} from "@/engine/types";

import { prisma } from "./client.ts";
import { visibleParts } from "./visibility.ts";
import {
  toEngineCase,
  toEngineCpu,
  toEngineGpu,
  toEngineGpuVariant,
  toEngineMotherboard,
  toEnginePsu,
  toEngineRam,
} from "./to-engine.ts";

export type CatalogItem<TSpec> = {
  id: string;
  label: string;
  spec: TSpec;
};

/**
 * Ekran kartı varyantı (AIB kartı) — çipin altındaki opsiyonel katman (K86).
 *
 * `chip_part_id` burada duruyor çünkü arayüz kartları çiplerine göre süzüyor:
 * kullanıcı önce çipi seçer, sonra istersen kartı.
 */
export type GpuVariantItem = {
  id: string;
  label: string;
  chip_part_id: string;
  spec: EngineGpuVariant;
};

/** Depolama hiçbir uyumluluk kuralında kullanılmıyor, motor tipi de yok (S12). */
export type StorageItem = {
  id: string;
  label: string;
  storage_type: string;
  capacity_gb: number;
};

export type BuilderCatalog = {
  cpu: CatalogItem<EngineCpu>[];
  /** Çip seviyesi — `gpu_specs` satırı olanlar. Kartlar ayrı listede. */
  gpu: CatalogItem<EngineGpu>[];
  gpu_variant: GpuVariantItem[];
  motherboard: CatalogItem<EngineMotherboard>[];
  ram: CatalogItem<EngineRam>[];
  psu: CatalogItem<EnginePsu>[];
  case: CatalogItem<EngineCase>[];
  storage: StorageItem[];
};

const withPart = {
  where: { part: visibleParts() },
  include: { part: true },
  orderBy: { part_id: "asc" as const },
};

function label(part: { brand: string; model: string }): string {
  return `${part.brand} ${part.model}`;
}

export async function getBuilderCatalog(): Promise<BuilderCatalog> {
  const [cpus, gpus, gpuVariants, motherboards, rams, psus, cases, storages] = await Promise.all([
    prisma.cpuSpecs.findMany(withPart),
    prisma.gpuSpecs.findMany(withPart),
    // Çipi görünmeyen kart listelenmez: bağlanacağı çip yoksa kart da yok
    // sayılır. dev-seed filtresi böylece iki uçta da geçerli olur.
    prisma.gpuVariantSpecs.findMany({
      where: { part: visibleParts(), chip: visibleParts() },
      include: { part: true },
      orderBy: { part_id: "asc" as const },
    }),
    prisma.motherboardSpecs.findMany(withPart),
    prisma.ramSpecs.findMany(withPart),
    prisma.psuSpecs.findMany(withPart),
    prisma.caseSpecs.findMany(withPart),
    prisma.storageSpecs.findMany(withPart),
  ]);

  return {
    cpu: cpus.map((row) => ({ id: row.part_id, label: label(row.part), spec: toEngineCpu(row) })),
    gpu: gpus.map((row) => ({ id: row.part_id, label: label(row.part), spec: toEngineGpu(row) })),
    gpu_variant: gpuVariants.map((row) => ({
      id: row.part_id,
      label: label(row.part),
      chip_part_id: row.chip_part_id,
      spec: toEngineGpuVariant(row),
    })),
    motherboard: motherboards.map((row) => ({
      id: row.part_id,
      label: label(row.part),
      spec: toEngineMotherboard(row),
    })),
    ram: rams.map((row) => ({ id: row.part_id, label: label(row.part), spec: toEngineRam(row) })),
    psu: psus.map((row) => ({ id: row.part_id, label: label(row.part), spec: toEnginePsu(row) })),
    case: cases.map((row) => ({ id: row.part_id, label: label(row.part), spec: toEngineCase(row) })),
    storage: storages.map((row) => ({
      id: row.part_id,
      label: label(row.part),
      storage_type: row.storage_type,
      capacity_gb: row.capacity_gb,
    })),
  };
}
