// Bant genişliği paradoksu — daha çok ölçüm bandı gerçekten genişletiyor mu?
//
// Çalıştırma: npm run bant:analiz
//
// **Hiçbir şey yazmaz.** Ölçer ve raporlar.
//
// ---------------------------------------------------------------------------
// SORU
// ---------------------------------------------------------------------------
//
// K172 iki sayı buldu ve ikisi çelişiyor gibi durdu:
//
//   blackwell, n=5 ölçümle          ±%19.8
//   blackwell, dörtlü alt kümelerin ortalaması  ±%16.9
//
// Beşinci ölçüm bandı GENİŞLETMİŞ görünüyor. Bu, bütün veri stratejimizin
// dayandığı varsayımla çelişir: daha çok ölçüm bandı daraltır.
//
// Dört açıklama ayrı ayrı sınanıyor:
//   (a) beşinci parça spec uzayında aykırı ve uyumu meşru olarak bozuyor
//   (b) küçük örneklem — n=4-5'te bandın KENDİSİ çok belirsiz
//   (c) iki sayı farklı yöntemlerle hesaplandı, hiç karşılaştırılabilir değildi
//   (d) n=5'te birini-dışarıda-bırak 4 eğitim noktası bırakıyor; model orada
//       kararlı mı?

import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";

import { PrismaPg } from "@prisma/adapter-pg";

import {
  MIN_FAMILY_FOR_OWN_BAND,
  bandFromErrors,
  fit,
  predict,
} from "../engine/index-prediction.ts";
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

const cizgi = (s = "=") => console.log(s.repeat(78));
const ort = (xs: readonly number[]) => xs.reduce((s, v) => s + v, 0) / xs.length;

// ---------------------------------------------------------------------------
// Veri — eksenler compute-index-estimates.mts ile AYNI (K161)
// ---------------------------------------------------------------------------

const MODEL_VERSION = "v0.2";
const olculen = new Map(
  (
    await prisma.perfIndex.findMany({
      where: { workload: "gaming", model_version: MODEL_VERSION },
      select: { part_id: true, index_value: true },
    })
  ).map((r) => [r.part_id, r.index_value]),
);

const gpuSpecs = await prisma.gpuSpecs.findMany();
const cpuSpecs = await prisma.cpuSpecs.findMany();

const gpuNoktalar: MeasuredPoint[] = gpuSpecs
  .filter((g) => olculen.has(g.part_id) && g.bus_width_bits !== null && g.boost_clock_mhz !== null)
  .map((g) => ({
    id: g.part_id,
    family: g.architecture_family ?? "?",
    y: olculen.get(g.part_id)!,
    x: g.bus_width_bits! * g.boost_clock_mhz!,
  }));
const cpuNoktalar: MeasuredPoint[] = cpuSpecs
  .filter((c) => olculen.has(c.part_id) && c.l3_cache_mb !== null)
  .map((c) => ({
    id: c.part_id,
    family: c.architecture_family ?? "?",
    y: olculen.get(c.part_id)!,
    x: c.boost_clock_mhz * Math.sqrt(c.l3_cache_mb!),
  }));

const tumAileler: { tur: "GPU" | "CPU"; aile: string; noktalar: MeasuredPoint[] }[] = [];
for (const [tur, kume] of [["GPU", gpuNoktalar], ["CPU", cpuNoktalar]] as const) {
  for (const aile of [...new Set(kume.map((p) => p.family))]) {
    tumAileler.push({ tur, aile, noktalar: kume.filter((p) => p.family === aile) });
  }
}

function altKumeler<T>(liste: readonly T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (liste.length < k) return [];
  const [ilk, ...kalan] = liste;
  return [...altKumeler(kalan, k - 1).map((a) => [ilk, ...a]), ...altKumeler(kalan, k)];
}

/** Bir kümenin birini-dışarıda-bırak hataları. */
function looHatalari(noktalar: readonly MeasuredPoint[]): number[] {
  const out: number[] = [];
  for (const held of noktalar) {
    const m = fit(noktalar.filter((p) => p.id !== held.id));
    if (!m) continue;
    out.push((Math.abs(predict(m, held.x) - held.y) / held.y) * 100);
  }
  return out;
}

console.log("BANT GENISLIGI PARADOKSU — analiz");
console.log("Hicbir sey yazilmadi.\n");

// ===========================================================================
// 0. İki sayı yeniden üretiliyor
// ===========================================================================

cizgi();
console.log("0. IKI SAYI YENIDEN URETILIYOR");
cizgi();

const blackwell = gpuNoktalar.filter((p) => p.family === "blackwell");
const bw5Hatalar = looHatalari(blackwell);
const bw5Bant = bandFromErrors(bw5Hatalar);

const dortluBantlar = altKumeler(blackwell, 4).map((alt) => bandFromErrors(looHatalari(alt)));
const dortluOrt = ort(dortluBantlar);

console.log(`  blackwell n=${blackwell.length}`);
console.log(`  n=5 LOO hatalari : ${bw5Hatalar.map((e) => e.toFixed(1)).join(", ")}`);
console.log(`  n=5 bant         : ±%${bw5Bant.toFixed(1)}`);
console.log(`  dortlu bantlar   : ${dortluBantlar.map((b) => b.toFixed(1)).join(", ")}`);
console.log(`  dortlu ortalama  : ±%${dortluOrt.toFixed(1)}`);
console.log(`  PARADOKS         : ${bw5Bant.toFixed(1)} > ${dortluOrt.toFixed(1)} — 5. olcum bandi genisletmis GORUNUYOR`);

// ===========================================================================
// (c) İki sayı aynı şeyi mi ölçüyor? — BANT TAHMİNCİSİNİN KENDİSİ
// ===========================================================================

cizgi();
console.log("(c) IKI SAYI AYNI SEYI MI OLCUYOR? — tahmincinin davranisi");
cizgi();
console.log("  bandFromErrors: sorted[min(n-1, floor(0.9n))]\n");
console.log("  n    floor(0.9n)   secilen indeks   bu MAKSIMUM mu?");
for (const n of [3, 4, 5, 6, 8, 10, 11, 15, 20]) {
  const idx = Math.min(n - 1, Math.floor(0.9 * n));
  console.log(
    `  ${String(n).padStart(2)}   ${String(Math.floor(0.9 * n)).padStart(3)}           ${String(idx).padStart(3)}` +
      `              ${idx === n - 1 ? "EVET" : "hayir"}`,
  );
}
console.log(
  "\n  BULGU: n <= 10 icin 'p90 bandi' aslinda MAKSIMUM hatadir.\n" +
    "  Maksimum, ornek buyudukce ASLA KUCULMEZ — daha cok nokta, daha cok\n" +
    "  cekilis, daha buyuk maksimum. Yani n=5 ile n=4 bantlarini karsilastirmak,\n" +
    "  'daha cok olcum bandi daraltir mi' sorusunu OLCMUYOR.",
);

// Aynı hata kümesi üzerinde iki tahminci karşılaştırılıyor: mevcut (maksimum)
// ve ortalama. Ortalama örneklem büyüklüğüne göre yapısal olarak artmıyor.
console.log("\n  Ayni hatalar, farkli tahminci:");
console.log("  aile        n   MEVCUT (maks)   ortalama   medyan");
for (const { tur, aile, noktalar } of tumAileler) {
  if (noktalar.length < 3) continue;
  const h = looHatalari(noktalar);
  if (h.length === 0) continue;
  const sirali = [...h].sort((a, b) => a - b);
  const medyan =
    sirali.length % 2 === 1
      ? sirali[(sirali.length - 1) / 2]
      : (sirali[sirali.length / 2 - 1] + sirali[sirali.length / 2]) / 2;
  console.log(
    `  ${(tur + " " + aile).padEnd(12)}${String(noktalar.length).padStart(2)}` +
      `   ±%${bandFromErrors(h).toFixed(1).padStart(5)}        %${ort(h).toFixed(1).padStart(5)}` +
      `     %${medyan.toFixed(1)}`,
  );
}

// ===========================================================================
// (b) Küçük örneklem — bandın kendisi ne kadar belirsiz?
// ===========================================================================

cizgi();
console.log("(b) BANDIN KENDI BELIRSIZLIGI — onyukleme (bootstrap)");
cizgi();
console.log("  Gozlenen LOO hatalari yerine koymali yeniden orneklenip bant");
console.log("  yeniden hesaplaniyor. Soru: bu bant tahmini ne kadar oynak?\n");

/** Deterministik sözde rastgele — rapor iki koşumda aynı çıksın. */
function rastgeleUretici(tohum: number) {
  let s = tohum >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function onyukleme(hatalar: number[], B = 4000, tohum = 42) {
  const rnd = rastgeleUretici(tohum);
  const bantlar: number[] = [];
  for (let b = 0; b < B; b++) {
    const ornek = hatalar.map(() => hatalar[Math.floor(rnd() * hatalar.length)]);
    bantlar.push(bandFromErrors(ornek));
  }
  bantlar.sort((a, b) => a - b);
  return {
    alt: bantlar[Math.floor(0.025 * B)],
    ust: bantlar[Math.floor(0.975 * B)],
    medyan: bantlar[Math.floor(0.5 * B)],
  };
}

const bw5CI = onyukleme(bw5Hatalar);
// Dörtlü alt kümelerin ortalaması için: her alt kümenin kendi hatalarını
// önyükleyip ortalamayı yeniden kurmak yerine, dörtlü bantların dağılımına
// bakılıyor — elimizde beş gözlem var.
console.log(`  blackwell n=5 bant   : ±%${bw5Bant.toFixed(1)}`);
console.log(`    %95 onyukleme araligi: ±%${bw5CI.alt.toFixed(1)} … ±%${bw5CI.ust.toFixed(1)} (medyan ±%${bw5CI.medyan.toFixed(1)})`);
console.log(`  blackwell dortlu bantlar: ${dortluBantlar.map((b) => b.toFixed(1)).join(", ")}`);
console.log(`    ortalama ±%${dortluOrt.toFixed(1)}, aralik ±%${Math.min(...dortluBantlar).toFixed(1)} … ±%${Math.max(...dortluBantlar).toFixed(1)}`);
const kesisiyor = dortluOrt >= bw5CI.alt && dortluOrt <= bw5CI.ust;
console.log(
  `\n  Dortlu ortalama (${dortluOrt.toFixed(1)}), n=5 bandinin guven araliginin ` +
    `${kesisiyor ? "ICINDE" : "DISINDA"}.`,
);

// ===========================================================================
// (a) Beşinci nokta aykırı mı? — kaldıraç ölçümü
// ===========================================================================

cizgi();
console.log("(a) HANGI NOKTA BANDI TASIYOR? — kaldirac ve hata dagilimi");
cizgi();
const merkez = ort(blackwell.map((p) => Math.log(p.x)));
console.log("  parca                     eksen      merkezden   LOO hatasi");
for (const p of [...blackwell].sort((a, b) => a.x - b.x)) {
  const uzak = (Math.exp(Math.abs(Math.log(p.x) - merkez)) - 1) * 100;
  const m = fit(blackwell.filter((q) => q.id !== p.id));
  const hata = m ? (Math.abs(predict(m, p.x) - p.y) / p.y) * 100 : NaN;
  console.log(
    `  ${p.id.padEnd(24)} ${String(Math.round(p.x)).padStart(7)}   %${uzak.toFixed(0).padStart(4)}` +
      `       %${hata.toFixed(1)}`,
  );
}
console.log(
  "\n  Her nokta cikarildiginda dortlu bandin ne oldugu (o noktanin katkisi):",
);
for (const p of blackwell) {
  const kalan = blackwell.filter((q) => q.id !== p.id);
  console.log(`  ${p.id.padEnd(24)} cikarilinca dortlu bant: ±%${bandFromErrors(looHatalari(kalan)).toFixed(1)}`);
}

// ===========================================================================
// (d) Model kaç eğitim noktasında kararlı? — ÖĞRENME EĞRİSİ
// ===========================================================================

cizgi();
console.log("(d) OGRENME EGRISI — k egitim noktasiyla, DISARIDAKI noktalarda hata");
cizgi();
console.log("  Bu olcum karsilastirilabilir cunku metrik ORTALAMA mutlak hata,");
console.log("  maksimum degil: ornek buyudukce yapisal olarak artmiyor.\n");
console.log("  Her aile icin: k boyutlu her alt kumeyle egit, KALAN noktalari tahmin et.\n");
console.log("  k    olcum   ort. mutlak hata   medyan   en kotu");

const egriler = new Map<number, number[]>();
for (const { noktalar } of tumAileler) {
  for (let k = 3; k < noktalar.length; k++) {
    for (const egitim of altKumeler(noktalar, k)) {
      const m = fit(egitim);
      if (!m) continue;
      const kalanlar = noktalar.filter((p) => !egitim.some((e) => e.id === p.id));
      for (const p of kalanlar) {
        const hata = (Math.abs(predict(m, p.x) - p.y) / p.y) * 100;
        egriler.set(k, [...(egriler.get(k) ?? []), hata]);
      }
    }
  }
}
for (const k of [...egriler.keys()].sort((a, b) => a - b)) {
  const h = [...egriler.get(k)!].sort((a, b) => a - b);
  const medyan = h[Math.floor(h.length / 2)];
  console.log(
    `  ${String(k).padStart(2)}   ${String(h.length).padStart(5)}   %${ort(h).toFixed(1).padStart(6)}` +
      `             %${medyan.toFixed(1).padStart(5)}   %${h[h.length - 1].toFixed(1)}`,
  );
}

// Aynı eğri aile bazında: hangi ailede k arttıkça ne oluyor?
console.log("\n  Aile bazinda (ort. mutlak hata, k egitim noktasiyla):");
console.log("  aile             k=3     k=4");
for (const { tur, aile, noktalar } of tumAileler) {
  if (noktalar.length < 4) continue;
  const hucre = (k: number) => {
    const hepsi: number[] = [];
    for (const egitim of altKumeler(noktalar, k)) {
      const m = fit(egitim);
      if (!m) continue;
      for (const p of noktalar.filter((q) => !egitim.some((e) => e.id === q.id))) {
        hepsi.push((Math.abs(predict(m, p.x) - p.y) / p.y) * 100);
      }
    }
    return hepsi.length > 0 ? `%${ort(hepsi).toFixed(1)}` : "—";
  };
  console.log(`  ${(tur + " " + aile).padEnd(16)} ${hucre(3).padStart(6)}  ${hucre(4).padStart(6)}`);
}

// ===========================================================================
// EŞİK — K156 ile LOO'nun uyuşmazlığı
// ===========================================================================

cizgi();
console.log("ESIK — K156 dort diyor, degerlendirme bese ihtiyac duyuyor");
cizgi();
console.log(`  fit() en az 3 nokta istiyor; MIN_FAMILY_FOR_OWN_BAND = ${MIN_FAMILY_FOR_OWN_BAND}.`);
console.log("  Urun akisinda: n=4 aile kendi modelini kuruyor (4 nokta ile egitim).");
console.log("  Degerlendirmede: bir nokta disarida kaliyor, egitim 3'e dusuyor —");
console.log("  yani n=4 aile LOO'da SINIRDA, n=5 aile rahat.");
console.log("\n  Ayni ailede k=3 ve k=4 egitimin hatasi yukaridaki tabloda.");

await prisma.$disconnect();
