// Spec'ten indeks TAHMİNİNİN hata payını ölçer. Hiçbir satır YAZMAZ.
//
// Çalıştırma: npm run indeks:tahmin-sapma
//
// Soru: `perf_index` yalnızca ölçümü olan parçalarda var (15 GPU + 12 CPU).
// Kalan parçaların indeksi speclerinden tahmin edilebilir mi, edilirse hata
// payı ne?
//
// Yöntem: birini-dışarıda-bırak (LOO). Her parça, kendi verisi hesaba
// KATILMADAN diğerlerinden tahmin edilir. Örneklem içi hata iyimserdir:
// model kendi verisini ezberlerse doğruluk değil ezber ölçülür (K79'un
// gerekçesi, `fps:sapma` ile aynı).
//
// İKİ AYRI PROBLEM, İKİ AYRI TABLO:
//
//   AİLE İÇİ   — parça, KENDİ mimarisindeki diğer parçalardan tahmin edilir.
//                shader_units yalnızca burada anlamlı (K57, K58).
//   AİLELER ARASI — parça, BAŞKA mimarilerdeki parçalardan tahmin edilir.
//                shader_units kullanılamaz: 160 Xe vektör motoru ile 2048
//                stream processor aynı eksende değil.
//
// BİRDEN FAZLA EKSEN deneniyor ve hepsi raporlanıyor. Tek bir eksen seçip
// sonucunu yazmak, seçimin kendisini gizlerdi; hangi ölçünün ne kadar
// açıkladığı görünür olmalı.
//
// Karşılaştırma tabanı da yazılıyor: "hep ortalamayı söyle" ne kadar hata
// yapıyor? Model bundan iyi değilse spec'ten tahmin bir şey katmıyor demektir.

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

const MODEL_VERSION = "v0.2";
/** Bir aile içinde LOO yapabilmek için gereken en az parça sayısı. */
const MIN_FAMILY = 4;

// ---------------------------------------------------------------------------
// En küçük kareler — elle, kütüphanesiz. İki model de log uzayında:
//
//   M1 (tek parametre)  indeks = k·x
//   M2 (iki parametre)  indeks = k·x^b
//
// Log uzayı seçildi çünkü ölçülen hata YÜZDE cinsinden okunuyor; mutlak
// hatayı küçültmek büyük parçalara ağırlık verirdi.
// ---------------------------------------------------------------------------
type Point = { id: string; family: string; y: number; x: number };

function fitM1(points: Point[]): (x: number) => number {
  const a = points.reduce((s, p) => s + (Math.log(p.y) - Math.log(p.x)), 0) / points.length;
  return (x: number) => Math.exp(a + Math.log(x));
}

function fitM2(points: Point[]): (x: number) => number {
  const n = points.length;
  const lx = points.map((p) => Math.log(p.x));
  const ly = points.map((p) => Math.log(p.y));
  const mx = lx.reduce((s, v) => s + v, 0) / n;
  const my = ly.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i += 1) {
    num += (lx[i] - mx) * (ly[i] - my);
    den += (lx[i] - mx) ** 2;
  }
  const b = den === 0 ? 1 : num / den;
  const a = my - b * mx;
  return (x: number) => Math.exp(a + b * Math.log(x));
}

/** Karşılaştırma tabanı: modelsiz tahmin — eğitim kümesinin ortalaması. */
function fitBaseline(points: Point[]): (x: number) => number {
  const mean = Math.exp(points.reduce((s, p) => s + Math.log(p.y), 0) / points.length);
  return () => mean;
}

type Errors = { n: number; mean: number; median: number; p90: number; max: number };

function summarize(errs: number[]): Errors | null {
  if (errs.length === 0) return null;
  const sorted = [...errs].sort((a, b) => a - b);
  const pick = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
  return {
    n: errs.length,
    mean: errs.reduce((s, v) => s + v, 0) / errs.length,
    median: pick(0.5),
    p90: pick(0.9),
    max: sorted[sorted.length - 1],
  };
}

function loo(
  points: Point[],
  fit: (p: Point[]) => (x: number) => number,
  trainFilter: (train: Point, held: Point) => boolean,
  minTrain: number,
): number[] {
  const errs: number[] = [];
  for (const held of points) {
    const train = points.filter((p) => p.id !== held.id && trainFilter(p, held));
    if (train.length < minTrain) continue;
    const yhat = fit(train)(held.x);
    errs.push((Math.abs(yhat - held.y) / held.y) * 100);
  }
  return errs;
}

function row(label: string, e: Errors | null): string {
  if (!e) return `${label.padEnd(30)}   —  (ölçülemedi)`;
  return [
    label.padEnd(30),
    String(e.n).padStart(3),
    `${e.mean.toFixed(1)}%`.padStart(7),
    `${e.median.toFixed(1)}%`.padStart(7),
    `${e.p90.toFixed(1)}%`.padStart(7),
    `${e.max.toFixed(1)}%`.padStart(7),
  ].join(" ");
}

const BASLIK = ["".padEnd(30), "  n", "   ort", "medyan", "   p90", "en kötü"].join(" ");

/** Bir eksen için aile içi ve aileler arası tabloları basar. */
function eksenRaporu(ad: string, points: Point[], aileIci: boolean) {
  console.log(`\n  eksen: ${ad}`);
  console.log("  " + BASLIK);
  if (aileIci) {
    const families = [...new Set(points.map((p) => p.family))].sort();
    for (const family of families) {
      const inFamily = points.filter((p) => p.family === family);
      if (inFamily.length < MIN_FAMILY) continue;
      const same = (t: Point, h: Point) => t.family === h.family;
      console.log("  " + row(`${family} · M1`, summarize(loo(inFamily, fitM1, same, 2))));
      console.log("  " + row(`${family} · M2`, summarize(loo(inFamily, fitM2, same, 3))));
      console.log("  " + row(`${family} · taban`, summarize(loo(inFamily, fitBaseline, same, 2))));
    }
  } else {
    const diff = (t: Point, h: Point) => t.family !== h.family;
    console.log("  " + row("M1", summarize(loo(points, fitM1, diff, 2))));
    console.log("  " + row("M2", summarize(loo(points, fitM2, diff, 3))));
    console.log("  " + row("taban (ortalama)", summarize(loo(points, fitBaseline, diff, 2))));
  }
}

// ---------------------------------------------------------------------------
// Veri
// ---------------------------------------------------------------------------
const perfRows = await prisma.perfIndex.findMany({
  where: { workload: "gaming", model_version: MODEL_VERSION },
  select: { part_id: true, index_value: true },
});
const index = new Map(perfRows.map((r) => [r.part_id, r.index_value]));

const gpuSpecs = await prisma.gpuSpecs.findMany({ where: { part_id: { in: [...index.keys()] } } });
const cpuSpecs = await prisma.cpuSpecs.findMany({ where: { part_id: { in: [...index.keys()] } } });

console.log("Spec'ten indeks tahmini — birini-dışarıda-bırak hata payı");
console.log(`Motor sürümü ${MODEL_VERSION}. Hiçbir satır yazılmadı.`);
console.log(`Ölçümlü: ${gpuSpecs.length} ekran kartı, ${cpuSpecs.length} işlemci.`);

// Aile artık şemadan geliyor (K154), parça adından türetilmiyor.
const eksikAile = gpuSpecs.filter((g) => !g.architecture_family).map((g) => g.part_id);
if (eksikAile.length > 0) console.log(`UYARI: mimari ailesi boş: ${eksikAile.join(", ")}`);

console.log("\n" + "=".repeat(74));
console.log("GPU — AİLE İÇİ");
console.log("=".repeat(74));
{
  const shaderClock = gpuSpecs
    .filter((g) => g.shader_units !== null && g.boost_clock_mhz !== null)
    .map((g) => ({
      id: g.part_id,
      family: g.architecture_family ?? "?",
      y: index.get(g.part_id)!,
      x: g.shader_units! * g.boost_clock_mhz!,
    }));
  eksenRaporu("shader_units × boost_clock", shaderClock, true);

  const busClock = gpuSpecs
    .filter((g) => g.bus_width_bits !== null && g.boost_clock_mhz !== null)
    .map((g) => ({
      id: g.part_id,
      family: g.architecture_family ?? "?",
      y: index.get(g.part_id)!,
      x: g.bus_width_bits! * g.boost_clock_mhz!,
    }));
  eksenRaporu("bus_width × boost_clock  (YENİ)", busClock, true);
}

console.log("\n" + "=".repeat(74));
console.log("GPU — AİLELER ARASI");
console.log("=".repeat(74));
console.log("shader_units KULLANILAMAZ: 160 Xe vektör motoru ile 2048 stream");
console.log("processor aynı eksende değil (K57, K58).");
{
  const base = (x: (g: (typeof gpuSpecs)[number]) => number | null) =>
    gpuSpecs
      .map((g) => ({ g, v: x(g) }))
      .filter((r) => r.v !== null && r.v > 0)
      .map((r) => ({
        id: r.g.part_id,
        family: r.g.architecture_family ?? "?",
        y: index.get(r.g.part_id)!,
        x: r.v!,
      }));

  eksenRaporu("TDP", base((g) => g.tdp_watt), false);
  eksenRaporu("bus_width  (YENİ)", base((g) => g.bus_width_bits), false);
  eksenRaporu(
    "TDP × bus_width  (YENİ)",
    base((g) => (g.bus_width_bits === null ? null : g.tdp_watt * g.bus_width_bits)),
    false,
  );
}

console.log("\n" + "=".repeat(74));
console.log("CPU — L3 ÖNBELLEK EKLENDİKTEN SONRA");
console.log("=".repeat(74));
{
  const mk = (ad: string, x: (c: (typeof cpuSpecs)[number]) => number | null) => {
    const pts = cpuSpecs
      .map((c) => ({ c, v: x(c) }))
      .filter((r) => r.v !== null && r.v > 0)
      .map((r) => ({
        id: r.c.part_id,
        // İşlemcide mimari ailesi şemada yok; sokete göre gruplanıyor.
        // Soket bir nesil sınırıdır ve AM5/LGA1700/LGA1851 tam olarak
        // farklı mimarilere denk geliyor.
        family: r.c.socket,
        y: index.get(r.c.part_id)!,
        x: r.v!,
      }));
    return { ad, pts };
  };

  const eksenler = [
    mk("boost × √cores  (eski)", (c) => c.boost_clock_mhz * Math.sqrt(c.cores)),
    mk("l3_cache_mb  (YENİ)", (c) => c.l3_cache_mb),
    mk("boost × √l3  (YENİ)", (c) =>
      c.l3_cache_mb === null ? null : c.boost_clock_mhz * Math.sqrt(c.l3_cache_mb)),
    mk("boost × √(cores × l3)  (YENİ)", (c) =>
      c.l3_cache_mb === null ? null : c.boost_clock_mhz * Math.sqrt(c.cores * c.l3_cache_mb)),
  ];

  console.log("\n--- AİLE İÇİ (sokete göre) ---");
  for (const e of eksenler) eksenRaporu(e.ad, e.pts, true);
  console.log("\n--- AİLELER ARASI ---");
  for (const e of eksenler) eksenRaporu(e.ad, e.pts, false);
}

// ---------------------------------------------------------------------------
// ÖNERİLEN BANTLAR — her bandın yanında n
//
// Kullanıcının kuralı: doğrulanamayan aile, iyimser bir bant taşıyamaz.
// Doğrulanamamış ailenin hatası KÜÇÜK değil, BİLİNMİYOR — o yüzden aileler
// arası bandı devralıyor.
// ---------------------------------------------------------------------------
console.log("\n" + "=".repeat(74));
console.log("ÖNERİLEN BANT TABLOSU (n ile birlikte)");
console.log("=".repeat(74));

const gpuAileSayisi = new Map<string, number>();
for (const g of gpuSpecs) {
  const f = g.architecture_family ?? "?";
  gpuAileSayisi.set(f, (gpuAileSayisi.get(f) ?? 0) + 1);
}
const cpuAileSayisi = new Map<string, number>();
for (const c of cpuSpecs) cpuAileSayisi.set(c.socket, (cpuAileSayisi.get(c.socket) ?? 0) + 1);

const tumGpuAile = await prisma.gpuSpecs.groupBy({
  by: ["architecture_family"],
  _count: true,
});
const tumCpuSoket = await prisma.cpuSpecs.groupBy({ by: ["socket"], _count: true });

console.log("\nGPU — mimari ailesine göre");
console.log("  aile                 katalog  ölçümlü  doğrulanabilir mi");
for (const a of tumGpuAile.sort((x, y) => (x.architecture_family ?? "").localeCompare(y.architecture_family ?? ""))) {
  const fam = a.architecture_family ?? "?";
  const olculen = gpuAileSayisi.get(fam) ?? 0;
  const dogrulanir = olculen >= MIN_FAMILY;
  console.log(
    `  ${fam.padEnd(20)} ${String(a._count).padStart(7)} ${String(olculen).padStart(8)}  ` +
      (dogrulanir ? "EVET — kendi bandı" : `HAYIR (n=${olculen}) — aileler arası bandı devralır`),
  );
}

console.log("\nCPU — sokete göre");
console.log("  soket                katalog  ölçümlü  doğrulanabilir mi");
for (const a of tumCpuSoket.sort((x, y) => x.socket.localeCompare(y.socket))) {
  const olculen = cpuAileSayisi.get(a.socket) ?? 0;
  const dogrulanir = olculen >= MIN_FAMILY;
  console.log(
    `  ${a.socket.padEnd(20)} ${String(a._count).padStart(7)} ${String(olculen).padStart(8)}  ` +
      (dogrulanir ? "EVET — kendi bandı" : `HAYIR (n=${olculen}) — aileler arası bandı devralır`),
  );
}

await prisma.$disconnect();
