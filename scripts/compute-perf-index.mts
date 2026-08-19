// benchmark_points -> perf_index (K71).
//
// Calistirma: npm run indeks:hesapla
//
// Bu, perf_index satirlarini uretmenin TEK yoludur. Elle ya da seed ile satir
// yazilmaz (K71). Girdi yalnizca benchmark_points; parca spec alanlarina
// bakilmaz, olculmeyen parca indeks almaz (K74).
//
// YONTEM — iki carpanli logaritmik uyum:
//
//   fps(parca i, grup j)  ~  perf(i) x zorluk(j)
//
// grup j = (kaynak adresi, oyun, cozunurluk, ayar, upscaling). Ayni gruptaki
// butun sayilar karsilastirilabilir; farkli kaynaklarin FPS'leri degil.
// Log uzayinda toplamsal olur ve donusumlu geometrik ortalamayla cozulur —
// yeni bir kutuphane gerekmiyor.
//
// OLCEK (K73): sabit referans parca = 100. Kataloglun en hizlisi degil; yeni
// bir parca eklendiginde herkesin indeksi kaymasin diye.

import { existsSync } from "node:fs";
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

/** Hesabin surumu. Yontem degisirse artar; veri degisince artmaz. */
const MODEL_VERSION = "v0.2";

/** K73: sabit referans parcalar. Degistirmek butun indeksleri degistirir. */
const REF_GPU = "nvidia-rtx-4070";
const REF_CPU = "amd-ryzen-5-9600x";

/** K78: bir parca en az bu kadar farkli oyunda olculmemisse indekslenmez. */
const MIN_OYUN = 3;

type Olcum = { part: string; grup: string; fps: number; game: string };

function geo(vals: number[]): number {
  return Math.exp(vals.reduce((t, v) => t + Math.log(v), 0) / vals.length);
}

/**
 * Donusumlu geometrik ortalama. Her tur once grup zorlugunu, sonra parca
 * performansini gunceller; birkac on turda yakinsiyor.
 */
function coz(olcumler: Olcum[]): Map<string, number> {
  const parts = [...new Set(olcumler.map((o) => o.part))];
  const gruplar = [...new Set(olcumler.map((o) => o.grup))];
  const perf = new Map(parts.map((p) => [p, 1]));
  const zorluk = new Map(gruplar.map((g) => [g, 1]));

  for (let tur = 0; tur < 300; tur++) {
    for (const g of gruplar) {
      const v = olcumler.filter((o) => o.grup === g).map((o) => o.fps / perf.get(o.part)!);
      if (v.length) zorluk.set(g, geo(v));
    }
    for (const p of parts) {
      const v = olcumler.filter((o) => o.part === p).map((o) => o.fps / zorluk.get(o.grup)!);
      if (v.length) perf.set(p, geo(v));
    }
  }
  return perf;
}

/**
 * Tek bir bagli bilesen sart: iki ayri kume ortak grup uzerinden baglanmiyorsa
 * aralarindaki oran tanimsizdir ve tek olcege konamaz.
 */
function bagliMi(olcumler: Olcum[]): boolean {
  const komsu = new Map<string, Set<string>>();
  for (const o of olcumler) {
    if (!komsu.has(o.part)) komsu.set(o.part, new Set());
    if (!komsu.has("g:" + o.grup)) komsu.set("g:" + o.grup, new Set());
    komsu.get(o.part)!.add("g:" + o.grup);
    komsu.get("g:" + o.grup)!.add(o.part);
  }
  const gorulen = new Set<string>();
  const yigin = [olcumler[0].part];
  while (yigin.length) {
    const n = yigin.pop()!;
    if (gorulen.has(n)) continue;
    gorulen.add(n);
    for (const k of komsu.get(n) ?? []) if (!gorulen.has(k)) yigin.push(k);
  }
  return gorulen.size === komsu.size;
}

async function hesapla(tur: "gpu" | "cpu", ref: string) {
  const rows = await prisma.benchmarkPoint.findMany({
    where: { workload: "gaming", ...(tur === "cpu" ? { cpu_part_id: { not: null } } : { cpu_part_id: null }) },
    select: {
      gpu_part_id: true, cpu_part_id: true, game_id: true, avg_fps: true,
      resolution: true, preset: true, upscaling: true, source_url: true,
    },
  });

  const olcumler: Olcum[] = rows.map((r) => ({
    part: tur === "cpu" ? r.cpu_part_id! : r.gpu_part_id,
    grup: [r.source_url, r.game_id, r.resolution, r.preset, r.upscaling ?? "-"].join("|"),
    fps: r.avg_fps,
    game: r.game_id,
  }));

  if (olcumler.length === 0) {
    console.log(`${tur}: olcum yok, indeks uretilmedi.`);
    return 0;
  }

  // K78: 3 oyundan az olculen parca disarida kalir.
  const oyunSayisi = new Map<string, Set<string>>();
  for (const o of olcumler) {
    if (!oyunSayisi.has(o.part)) oyunSayisi.set(o.part, new Set());
    oyunSayisi.get(o.part)!.add(o.game);
  }
  const yeterli = new Set([...oyunSayisi].filter(([, g]) => g.size >= MIN_OYUN).map(([p]) => p));
  const elenen = [...oyunSayisi].filter(([, g]) => g.size < MIN_OYUN).map(([p]) => p);
  const kullanilan = olcumler.filter((o) => yeterli.has(o.part));

  if (!yeterli.has(ref)) {
    console.error(`${tur}: referans parca (${ref}) yeterli olcume sahip degil. Indeks yazilmadi.`);
    return 0;
  }
  if (!bagliMi(kullanilan)) {
    console.error(`${tur}: olcumler tek bagli bilesen olusturmuyor. Indeks yazilmadi.`);
    return 0;
  }

  const perf = coz(kullanilan);
  const olcek = 100 / perf.get(ref)!;

  console.log(`\n${tur.toUpperCase()} — ${yeterli.size} parca, ${kullanilan.length} olcum, referans ${ref} = 100`);
  if (elenen.length) console.log(`  ${MIN_OYUN} oyundan az olculdugu icin elendi: ${elenen.join(", ")}`);

  const sirali = [...yeterli].sort((a, b) => perf.get(b)! - perf.get(a)!);
  for (const p of sirali) {
    const deger = Math.round(perf.get(p)! * olcek * 10) / 10;
    console.log(`  ${p.padEnd(26)} ${deger.toFixed(1)}`);
    const key = { part_id: p, workload: "gaming" as const, model_version: MODEL_VERSION };
    await prisma.perfIndex.upsert({
      where: { part_id_workload_model_version: key },
      create: { ...key, index_value: deger, computed_at: new Date() },
      update: { index_value: deger, computed_at: new Date() },
    });
  }
  return yeterli.size;
}

const g = await hesapla("gpu", REF_GPU);
const c = await hesapla("cpu", REF_CPU);

console.log(`\nToplam ${g + c} parca indekslendi, model_version '${MODEL_VERSION}'.`);
console.log("Yayin oncesi sapma olcumu zorunlu (K80): npm run indeks:sapma");

await prisma.$disconnect();
