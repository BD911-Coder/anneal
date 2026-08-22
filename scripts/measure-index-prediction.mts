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
//                stream processor aynı eksende değil. Yalnızca marka/mimari
//                bağımsız alanlar kalıyor.
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
// Mimari ailesi — şemada YOK, parça slug'ından türetiliyor.
//
// Sütun açmak yerine burada türetmenin sebebi: bu bir ölçüm script'i, henüz
// hiçbir şey yayınlamıyor. Aile bilgisi kalıcı olarak gerekirse SCHEMA.md'ye
// alan eklenir — o bir "dur ve sor" kararı.
// ---------------------------------------------------------------------------
function gpuFamily(id: string): string {
  if (/^intel-arc-b/.test(id)) return "Intel Xe2 (Battlemage)";
  if (/^intel-arc-a/.test(id)) return "Intel Xe (Alchemist)";
  if (/^nvidia-rtx-50/.test(id)) return "NVIDIA Blackwell (RTX 50)";
  if (/^nvidia-rtx-40/.test(id)) return "NVIDIA Ada (RTX 40)";
  if (/^nvidia-rtx-30/.test(id)) return "NVIDIA Ampere (RTX 30)";
  if (/^amd-rx-9/.test(id)) return "AMD RDNA4 (RX 9000)";
  if (/^amd-rx-7/.test(id)) return "AMD RDNA3 (RX 7000)";
  if (/^amd-rx-6/.test(id)) return "AMD RDNA2 (RX 6000)";
  return "bilinmiyor";
}

function cpuFamily(id: string): string {
  if (/^amd-ryzen-\d-9/.test(id)) return "AMD Zen 5 (Ryzen 9000)";
  if (/^amd-ryzen-\d-7/.test(id)) return "AMD Zen 4 (Ryzen 7000)";
  if (/^amd-ryzen-\d-5/.test(id)) return "AMD Zen 3 (Ryzen 5000)";
  if (/^intel-core-ultra/.test(id)) return "Intel Arrow Lake (Core Ultra 200)";
  if (/^intel-core-i\d-14/.test(id)) return "Intel Raptor Lake R (14. nesil)";
  if (/^intel-core-i\d-13/.test(id)) return "Intel Raptor Lake (13. nesil)";
  if (/^intel-core-i\d-12/.test(id)) return "Intel Alder Lake (12. nesil)";
  return "bilinmiyor";
}

// ---------------------------------------------------------------------------
// En küçük kareler — elle, kütüphanesiz.
//
// İki model var ve ikisi de log uzayında çalışıyor:
//
//   M1 (tek parametre)  log(indeks) = a + log(x)        yani indeks = k·x
//   M2 (iki parametre)  log(indeks) = a + b·log(x)      yani indeks = k·x^b
//
// Log uzayı seçildi çünkü ölçülen hata YÜZDE cinsinden okunuyor; mutlak
// hatayı küçültmek büyük kartlara ağırlık verirdi.
//
// M1 tek parametre istiyor, yani iki noktalı bir aileye de uyar. M2 eğriyi de
// öğreniyor ama en az üç nokta gerekiyor. Küçük örneklemde iki parametre
// gürültüyü ezberler; ikisi de raporlanıyor ki fark görülsün.
// ---------------------------------------------------------------------------
type Point = { id: string; family: string; y: number; x: number };

function fitM1(points: Point[]): (x: number) => number {
  // log y = a + log x  ->  a = ortalama(log y - log x)
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
  // Bütün x'ler aynıysa eğim tanımsız; o zaman sabit modele düş.
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

/**
 * Birini-dışarıda-bırak.
 *
 * `trainFilter` hangi noktaların eğitime gireceğini söylüyor: aile içi ölçümde
 * aynı aile, aileler arası ölçümde BAŞKA aileler.
 */
function loo(
  points: Point[],
  fit: (p: Point[]) => (x: number) => number,
  trainFilter: (train: Point, held: Point) => boolean,
  minTrain: number,
): { errs: number[]; atlanan: number } {
  const errs: number[] = [];
  let atlanan = 0;
  for (const held of points) {
    const train = points.filter((p) => p.id !== held.id && trainFilter(p, held));
    if (train.length < minTrain) {
      atlanan += 1;
      continue;
    }
    const predict = fit(train);
    const yhat = predict(held.x);
    errs.push(Math.abs(yhat - held.y) / held.y * 100);
  }
  return { errs, atlanan };
}

function row(label: string, e: Errors | null, atlanan = 0): string {
  if (!e) return `${label.padEnd(34)} ${"—".padStart(6)}  (ölçülemedi)`;
  return [
    label.padEnd(34),
    String(e.n).padStart(3),
    `${e.mean.toFixed(1)}%`.padStart(7),
    `${e.median.toFixed(1)}%`.padStart(7),
    `${e.p90.toFixed(1)}%`.padStart(7),
    `${e.max.toFixed(1)}%`.padStart(7),
    atlanan > 0 ? `  ${atlanan} parça atlandı` : "",
  ].join(" ");
}

const BASLIK = [
  "".padEnd(34),
  "  n",
  "   ort",
  "medyan",
  "   p90",
  "en kötü",
].join(" ");

// ---------------------------------------------------------------------------
// Veri
// ---------------------------------------------------------------------------
const perfRows = await prisma.perfIndex.findMany({
  where: { workload: "gaming", model_version: MODEL_VERSION },
  select: { part_id: true, index_value: true },
});
const index = new Map(perfRows.map((r) => [r.part_id, r.index_value]));

const gpuSpecs = await prisma.gpuSpecs.findMany({
  where: { part_id: { in: [...index.keys()] } },
});
const cpuSpecs = await prisma.cpuSpecs.findMany({
  where: { part_id: { in: [...index.keys()] } },
});

console.log("Spec'ten indeks tahmini — birini-dışarıda-bırak hata payı");
console.log(`Motor sürümü ${MODEL_VERSION}. Hiçbir satır yazılmadı.\n`);

// ---------------------------------------------------------------------------
// ELDE OLMAYAN ALANLAR — istenen ile şemada bulunan arasındaki fark
// ---------------------------------------------------------------------------
const bwVar = gpuSpecs.filter((g) => g.memory_bandwidth_gbs !== null).length;
console.log("--- İstenen ama ŞEMADA OLMAYAN alanlar ---");
console.log("  GPU : bus_width, base_clock, fabrikasyon süreci, transistör sayısı,");
console.log("        mimari ailesi (bu script'te slug'dan türetildi)");
console.log("  CPU : L3 önbellek, mimari ailesi, fabrikasyon süreci, transistör sayısı");
console.log("");
console.log("--- Elde olan ama EKSİK DOLU alanlar ---");
console.log(`  memory_bandwidth_gbs : ölçümlü 15 GPU'nun ${bwVar}'inde var`);
console.log("        (NVIDIA RTX 40/50 satırlarının çoğunda boş — tahmin ekseni olamaz)");
console.log("");

// ---------------------------------------------------------------------------
// GPU
// ---------------------------------------------------------------------------
const gpuPoints: Point[] = gpuSpecs
  .filter((g) => g.shader_units !== null && g.boost_clock_mhz !== null)
  .map((g) => ({
    id: g.part_id,
    family: gpuFamily(g.part_id),
    y: index.get(g.part_id)!,
    // Aile içi eksen: hesap gücü vekili = gölgelendirici × saat.
    x: g.shader_units! * g.boost_clock_mhz!,
  }));

const gpuFamilies = [...new Set(gpuPoints.map((p) => p.family))].sort();

console.log("=".repeat(78));
console.log("GPU — AİLE İÇİ  (eksen: shader_units × boost_clock)");
console.log("=".repeat(78));
console.log(BASLIK);
for (const family of gpuFamilies) {
  const inFamily = gpuPoints.filter((p) => p.family === family);
  if (inFamily.length < MIN_FAMILY) {
    console.log(
      `${family.padEnd(34)} ${String(inFamily.length).padStart(3)}   ÖLÇÜLEMEDİ — LOO için en az ${MIN_FAMILY} parça gerekiyor`,
    );
    continue;
  }
  const m1 = loo(inFamily, fitM1, (t, h) => t.family === h.family, 2);
  const m2 = loo(inFamily, fitM2, (t, h) => t.family === h.family, 3);
  const base = loo(inFamily, fitBaseline, (t, h) => t.family === h.family, 2);
  console.log(row(`${family}  M1 k·x`, summarize(m1.errs)));
  console.log(row(`${family}  M2 k·x^b`, summarize(m2.errs)));
  console.log(row(`${family}  taban (ortalama)`, summarize(base.errs)));
}

console.log("");
console.log("=".repeat(78));
console.log("GPU — AİLELER ARASI  (eksen: TDP — markadan bağımsız tek alan)");
console.log("=".repeat(78));
console.log("shader_units KULLANILAMAZ: 160 Xe vektör motoru ile 2048 stream");
console.log("processor aynı eksende değil (K57, K58).");
console.log("");
const gpuCross: Point[] = gpuSpecs.map((g) => ({
  id: g.part_id,
  family: gpuFamily(g.part_id),
  y: index.get(g.part_id)!,
  x: g.tdp_watt,
}));
console.log(BASLIK);
{
  const m1 = loo(gpuCross, fitM1, (t, h) => t.family !== h.family, 2);
  const m2 = loo(gpuCross, fitM2, (t, h) => t.family !== h.family, 3);
  const base = loo(gpuCross, fitBaseline, (t, h) => t.family !== h.family, 2);
  console.log(row("TDP  M1 k·x", summarize(m1.errs), m1.atlanan));
  console.log(row("TDP  M2 k·x^b", summarize(m2.errs), m2.atlanan));
  console.log(row("taban (ortalama)", summarize(base.errs), base.atlanan));
}

// ---------------------------------------------------------------------------
// CPU
// ---------------------------------------------------------------------------
const cpuPoints: Point[] = cpuSpecs.map((c) => ({
  id: c.part_id,
  family: cpuFamily(c.part_id),
  y: index.get(c.part_id)!,
  // Oyun yükü tek çekirdek hızına yaslanıyor; çekirdek sayısı doyuma gidiyor.
  // Eksen: boost saat × çekirdeğin karekökü (doyum kabaca böyle modellenir).
  x: c.boost_clock_mhz * Math.sqrt(c.cores),
}));

const cpuFamilies = [...new Set(cpuPoints.map((p) => p.family))].sort();

console.log("");
console.log("=".repeat(78));
console.log("CPU — AİLE İÇİ  (eksen: boost_clock × √cores)");
console.log("=".repeat(78));
console.log(BASLIK);
for (const family of cpuFamilies) {
  const inFamily = cpuPoints.filter((p) => p.family === family);
  if (inFamily.length < MIN_FAMILY) {
    console.log(
      `${family.padEnd(34)} ${String(inFamily.length).padStart(3)}   ÖLÇÜLEMEDİ — LOO için en az ${MIN_FAMILY} parça gerekiyor`,
    );
    continue;
  }
  const m1 = loo(inFamily, fitM1, (t, h) => t.family === h.family, 2);
  const m2 = loo(inFamily, fitM2, (t, h) => t.family === h.family, 3);
  const base = loo(inFamily, fitBaseline, (t, h) => t.family === h.family, 2);
  console.log(row(`${family}  M1 k·x`, summarize(m1.errs)));
  console.log(row(`${family}  M2 k·x^b`, summarize(m2.errs)));
  console.log(row(`${family}  taban (ortalama)`, summarize(base.errs)));
}

console.log("");
console.log("=".repeat(78));
console.log("CPU — AİLELER ARASI  (eksen: boost_clock × √cores)");
console.log("=".repeat(78));
console.log(BASLIK);
{
  const m1 = loo(cpuPoints, fitM1, (t, h) => t.family !== h.family, 2);
  const m2 = loo(cpuPoints, fitM2, (t, h) => t.family !== h.family, 3);
  const base = loo(cpuPoints, fitBaseline, (t, h) => t.family !== h.family, 2);
  console.log(row("M1 k·x", summarize(m1.errs), m1.atlanan));
  console.log(row("M2 k·x^b", summarize(m2.errs), m2.atlanan));
  console.log(row("taban (ortalama)", summarize(base.errs), base.atlanan));
}

// ---------------------------------------------------------------------------
// X3D etkisi — L3 önbellek şemada yok, sonucu burada görünüyor
// ---------------------------------------------------------------------------
console.log("");
console.log("=".repeat(78));
console.log("CPU — X3D ETKİSİ  (L3 önbellek şemada YOK)");
console.log("=".repeat(78));
const x3d = cpuPoints.filter((p) => /x3d/.test(p.id));
const digerleri = cpuPoints.filter((p) => !/x3d/.test(p.id));
const ort = (ps: Point[]) => ps.reduce((s, p) => s + p.y, 0) / ps.length;
const ortX = (ps: Point[]) => ps.reduce((s, p) => s + p.x, 0) / ps.length;
console.log(`  X3D    : ${x3d.length} parça, ortalama indeks ${ort(x3d).toFixed(1)}, ortalama eksen ${ortX(x3d).toFixed(0)}`);
console.log(`  X3D dışı: ${digerleri.length} parça, ortalama indeks ${ort(digerleri).toFixed(1)}, ortalama eksen ${ortX(digerleri).toFixed(0)}`);
console.log("  Aynı ekseni paylaşan iki küme, farklı indeks seviyesinde:");
console.log("  fark önbellekten geliyor ve o alan şemada yok.");

await prisma.$disconnect();
