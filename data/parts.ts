// Parça kataloğunu okur.
//
// dev-seed korumasının 2. katmanı burada: canlı ortamda `source = 'dev-seed'`
// satırları OTOMATİK filtrelenir. Bu, çağıran kodun tercihine bırakılmaz —
// bu dosyadaki her sorgu aynı `visibleParts()` filtresini kullanır.

import type {
  EngineCase,
  EngineCpu,
  EngineGpu,
  EngineMotherboard,
  EnginePsu,
  EngineRam,
} from "@/engine/types";

import { prisma } from "./client";
import {
  toEngineCase,
  toEngineCpu,
  toEngineGpu,
  toEngineMotherboard,
  toEnginePsu,
  toEngineRam,
} from "./to-engine";

const IS_LIVE = process.env.NODE_ENV === "production";

/**
 * Her parça sorgusunun kullandığı filtre.
 *
 * Canlıda sahte veri görünmez. Geliştirmede görünür, yoksa üzerinde
 * çalışacak veri kalmaz.
 */
function visibleParts() {
  return IS_LIVE
    ? { is_active: true, source: { not: "dev_seed" as const } }
    : { is_active: true };
}

export type CatalogItem<TSpec> = {
  id: string;
  label: string;
  spec: TSpec;
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
  gpu: CatalogItem<EngineGpu>[];
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
  const [cpus, gpus, motherboards, rams, psus, cases, storages] = await Promise.all([
    prisma.cpuSpecs.findMany(withPart),
    prisma.gpuSpecs.findMany(withPart),
    prisma.motherboardSpecs.findMany(withPart),
    prisma.ramSpecs.findMany(withPart),
    prisma.psuSpecs.findMany(withPart),
    prisma.caseSpecs.findMany(withPart),
    prisma.storageSpecs.findMany(withPart),
  ]);

  return {
    cpu: cpus.map((row) => ({ id: row.part_id, label: label(row.part), spec: toEngineCpu(row) })),
    gpu: gpus.map((row) => ({ id: row.part_id, label: label(row.part), spec: toEngineGpu(row) })),
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
