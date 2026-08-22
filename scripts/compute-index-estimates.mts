// Spec'ten tahmin edilen indeksleri hesaplar ve `perf_index_estimated`'a yazar.
//
// Çalıştırma: npm run indeks:tahmin
//
// **`perf_index`'e HİÇBİR ŞEY YAZMAZ.** K71 aynen geçerli: o tablo yalnızca
// `benchmark_points`'tan hesaplanan satırları taşır. Tahminler ayrı tabloda
// durur ve çözümleme `/data` katmanında yapılır (K160).
//
// `benchmark_points`'a da yazmaz — yalnızca okur.
//
// Yalnızca ÖLÇÜMÜ OLMAYAN parçalara satır üretir: ölçülen her zaman kazandığı
// için ölçümlü bir parçaya tahmin yazmak ölü satır olurdu.
//
// Ekranlar (hangi tek sayıya oturtuluyor):
//   GPU  bus_width_bits × boost_clock_mhz
//   CPU  boost_clock_mhz × √l3_cache_mb
//
// İkisi de `npm run indeks:tahmin-sapma` ile ölçülüp seçildi; gerekçe
// docs/KARARLAR.md K161'de.

import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";

import { PrismaPg } from "@prisma/adapter-pg";

import { confidenceFor, estimate } from "../engine/index-prediction.ts";
import type { MeasuredPoint } from "../engine/index-prediction.ts";
import { PrismaClient } from "../lib/generated/prisma/client.ts";

for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) loadEnvFile(file);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL tanimli degil.");
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg(connectionString) });

const MODEL_VERSION = "v0.2";
const WORKLOAD = "gaming" as const;

const measured = await prisma.perfIndex.findMany({
  where: { workload: WORKLOAD, model_version: MODEL_VERSION },
  select: { part_id: true, index_value: true },
});
const measuredIndex = new Map(measured.map((r) => [r.part_id, r.index_value]));

const gpuSpecs = await prisma.gpuSpecs.findMany();
const cpuSpecs = await prisma.cpuSpecs.findMany();

/** GPU ekseni: veri yolu × boost saati. İkisi de %100 dolu. */
const gpuX = (g: (typeof gpuSpecs)[number]): number | null =>
  g.bus_width_bits !== null && g.boost_clock_mhz !== null
    ? g.bus_width_bits * g.boost_clock_mhz
    : null;

/** CPU ekseni: boost saati × √L3. L3 %100 dolu. */
const cpuX = (c: (typeof cpuSpecs)[number]): number | null =>
  c.l3_cache_mb !== null ? c.boost_clock_mhz * Math.sqrt(c.l3_cache_mb) : null;

function points<T extends { part_id: string; architecture_family: string | null }>(
  rows: T[],
  x: (r: T) => number | null,
): MeasuredPoint[] {
  return rows
    .filter((r) => measuredIndex.has(r.part_id))
    .map((r) => ({ r, v: x(r) }))
    .filter((e) => e.v !== null && e.v > 0)
    .map((e) => ({
      id: e.r.part_id,
      family: e.r.architecture_family ?? "?",
      y: measuredIndex.get(e.r.part_id)!,
      x: e.v!,
    }));
}

const gpuPoints = points(gpuSpecs, gpuX);
const cpuPoints = points(cpuSpecs, cpuX);

console.log(
  `Egitim kumesi: ${gpuPoints.length} ekran karti, ${cpuPoints.length} islemci olcumu.`,
);

const computedAt = new Date();
let yazilan = 0;
const ozet = new Map<string, number>();

async function isle<T extends { part_id: string; architecture_family: string | null }>(
  rows: T[],
  pts: MeasuredPoint[],
  x: (r: T) => number | null,
  etiket: string,
) {
  for (const row of rows) {
    if (measuredIndex.has(row.part_id)) continue; // olculen kazanir
    const family = row.architecture_family ?? "?";
    const e = estimate(pts, family, x(row));
    if (!e) {
      console.log(`  [ATLA] ${row.part_id} — tahmin uretilemedi`);
      continue;
    }
    await prisma.perfIndexEstimated.upsert({
      where: {
        part_id_workload_model_version: {
          part_id: row.part_id,
          workload: WORKLOAD,
          model_version: MODEL_VERSION,
        },
      },
      create: {
        part_id: row.part_id,
        workload: WORKLOAD,
        index_value: e.index,
        method: e.method === "spec-model" ? "spec_model" : "family_mean",
        confidence: confidenceFor(e.bandPct),
        error_band_pct: e.bandPct,
        error_band_source_family: (e.bandSourceFamily ?? null) as never,
        n_used: e.nUsed,
        model_version: MODEL_VERSION,
        computed_at: computedAt,
      },
      update: {
        index_value: e.index,
        method: e.method === "spec-model" ? "spec_model" : "family_mean",
        confidence: confidenceFor(e.bandPct),
        error_band_pct: e.bandPct,
        error_band_source_family: (e.bandSourceFamily ?? null) as never,
        n_used: e.nUsed,
        computed_at: computedAt,
      },
    });
    yazilan += 1;
    const anahtar = `${etiket} ${e.method} band ±${e.bandPct}% (kaynak ${e.bandSourceFamily ?? "aileler arasi"}, n=${e.nUsed})`;
    ozet.set(anahtar, (ozet.get(anahtar) ?? 0) + 1);
  }
}

await isle(gpuSpecs, gpuPoints, gpuX, "GPU");
await isle(cpuSpecs, cpuPoints, cpuX, "CPU");

console.log(`\n${yazilan} tahmin satiri yazildi (perf_index_estimated).`);
console.log("perf_index'e yazilmadi; benchmark_points'a dokunulmadi.\n");
for (const [k, v] of [...ozet.entries()].sort()) {
  console.log(`  ${String(v).padStart(3)} x  ${k}`);
}

// KAPSAM: her parca bir deger donduruyor mu?
const tahmin = await prisma.perfIndexEstimated.count({
  where: { workload: WORKLOAD, model_version: MODEL_VERSION },
});
const gpuKapsam = gpuSpecs.filter((g) => measuredIndex.has(g.part_id)).length;
const cpuKapsam = cpuSpecs.filter((c) => measuredIndex.has(c.part_id)).length;
console.log(
  `\nKAPSAM: ${gpuSpecs.length} ekran karti cipi = ${gpuKapsam} olculen + ${gpuSpecs.length - gpuKapsam} tahmin`,
);
console.log(
  `        ${cpuSpecs.length} islemci        = ${cpuKapsam} olculen + ${cpuSpecs.length - cpuKapsam} tahmin`,
);
console.log(`        perf_index_estimated toplam ${tahmin} satir`);

await prisma.$disconnect();
