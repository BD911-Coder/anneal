// perf_index sapmasini bagimsiz bir kaynakla olcer (K80).
//
// Calistirma: npm run indeks:sapma
//
// K80: "Her yayinda sistematik sapma olculur ve kaydedilir. Olcum bagimsiz bir
// kaynakla — mutlak FPS veren, kendisi kaynak olmayan — karsilastirilir. Sapma
// kaydedilmeden indeks yayinlanmaz."
//
// Ayna: Tom's Hardware GPU/CPU Hierarchy. Veri KAYNAGI olarak kullanilamiyor
// (paket ortalamasi, game_id karsiligi yok) — bu yuzden kaynagimizdan bagimsiz.
// data/benchmarks/crosscheck-toms.csv icinde, benchmark_points'a girmiyor.
//
// Cikti lib/perf-margin.ts'e elle islenir; script dosyayi kendi yazmaz ki
// sayinin yaninda duran yontem ve tarih insan tarafindan gozden gecirilsin.

import { existsSync, readFileSync } from "node:fs";
import { loadEnvFile } from "node:process";

import { PrismaPg } from "@prisma/adapter-pg";

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
const REF = { gpu: "nvidia-rtx-4070", cpu: "amd-ryzen-5-9600x" };
/** Bu esigin ustunde yayin durur; sayinin kendisi de kayda gecer. */
const ESIK = 25;

const satirlar = readFileSync("data/benchmarks/crosscheck-toms.csv", "utf8")
  .split("\n").slice(1).filter((l) => l.trim() !== "")
  .map((l) => l.split(","))
  .map(([part_id, value, kind]) => ({ part_id, value: Number(value), kind: kind as "gpu" | "cpu" }));

const indeksler = await prisma.perfIndex.findMany({
  where: { model_version: MODEL_VERSION, workload: "gaming" },
  select: { part_id: true, index_value: true },
});
const bizim = new Map(indeksler.map((r) => [r.part_id, r.index_value]));

const hepsi: number[] = [];
let engel = false;

for (const kind of ["gpu", "cpu"] as const) {
  const kume = satirlar.filter((s) => s.kind === kind && bizim.has(s.part_id));
  const ref = kume.find((s) => s.part_id === REF[kind]);
  if (!ref) {
    console.log(`${kind}: referans parca aynada yok, karsilastirilamadi.`);
    continue;
  }

  console.log(`\n${kind.toUpperCase()} — ${kume.length} parca, ikisi de ${REF[kind]} = 100'e normalize`);
  console.log(`${"parca".padEnd(26)} ${"bizim".padStart(7)} ${"ayna".padStart(7)} ${"sapma".padStart(8)}`);

  const sapmalar: number[] = [];
  for (const s of kume.sort((a, b) => b.value - a.value)) {
    const ayna = (s.value / ref.value) * 100;
    const biz = bizim.get(s.part_id)!;
    const fark = ((biz - ayna) / ayna) * 100;
    sapmalar.push(Math.abs(fark));
    hepsi.push(Math.abs(fark));
    console.log(`${s.part_id.padEnd(26)} ${biz.toFixed(1).padStart(7)} ${ayna.toFixed(1).padStart(7)} ${(fark >= 0 ? "+" : "") + fark.toFixed(1)}%`.padEnd(4));
  }
  const ort = sapmalar.reduce((t, v) => t + v, 0) / sapmalar.length;
  const enb = Math.max(...sapmalar);
  console.log(`  ortalama ${ort.toFixed(1)}%   en buyuk ${enb.toFixed(1)}%`);
  if (enb > ESIK) engel = true;
}

const ort = hepsi.reduce((t, v) => t + v, 0) / hepsi.length;
const enb = Math.max(...hepsi);
console.log(`\nTOPLAM  ortalama mutlak sapma: ${ort.toFixed(1)}%   en buyuk: ${enb.toFixed(1)}%`);
console.log(`Esik %${ESIK}: ${enb <= ESIK ? "GECTI" : "ASILDI"}`);
console.log(`\nlib/perf-margin.ts'e islenecek: meanPercent ${ort.toFixed(1)}, maxPercent ${enb.toFixed(1)}`);

await prisma.$disconnect();
if (engel) process.exit(1);
