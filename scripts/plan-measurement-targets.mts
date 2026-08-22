// Ölçüm hedefleri — hangi TEK çip ölçülürse bant en çok daralır?
//
// Çalıştırma: npm run olcum:hedefler
//
// **Hiçbir şey yazmaz.** Ölçer ve sıralar.
//
// ---------------------------------------------------------------------------
// SORU
// ---------------------------------------------------------------------------
//
// Katalogdaki 60 ekran kartı çipinin 29'u, ailesinde HİÇ ölçüm olmadığı için
// aileler arası modelden tahmin ediliyor ve ±%30.7 bandı taşıyor
// (ampere 12, rdna_2 12, alchemist 5). Bu bant bir hata değil, ölçülmüş bir
// gerçek: aile doğrulanmadığı sürece hata payı büyük.
//
// Bu script "hepsini ölçelim" demiyor. Aile başına TEK bir çip seçiyor ve
// seçimi popülerliğe değil **spec uzayındaki merkeziliğe** dayandırıyor.
//
// ---------------------------------------------------------------------------
// NEDEN MERKEZİLİK
// ---------------------------------------------------------------------------
//
// Model `indeks = k · x^b` biçiminde ve log uzayında oturtuluyor
// (`engine/index-prediction.ts`). GPU ekseni: `veri yolu × boost saati`.
//
// Bir aileden tek bir nokta ölçülürse o nokta ailenin çapasıdır: aile
// modelinin geçtiği yeri belirler. Ailenin ucundan seçilen bir çapa, ailenin
// öbür ucunu EKSTRAPOLASYONLA tahmin ettirir; ortadan seçilen çapa iki yöne
// de interpolasyon bırakır.
//
// Bu gerekçe iddia olarak bırakılmıyor: aşağıdaki 3. bölüm, elimizdeki 15
// ölçümle "merkezden uzaklık ile hata birlikte artıyor mu" sorusunu ÖLÇÜYOR.
//
// ---------------------------------------------------------------------------
// DÜRÜSTLÜK NOTU — tek ölçüm bandı KENDİ BAŞINA daraltmaz
// ---------------------------------------------------------------------------
//
// `MIN_FAMILY_FOR_OWN_BAND = 4`: bir ailenin kendi bandını taşıyabilmesi için
// en az dört ölçüm gerekiyor (K156). Yani tek ölçüm o ailenin bandını ±%30.7'den
// indirmez — dördüncü ölçüm indirir. Tek ölçümün değeri başka yerde: aileler
// arası eğitim kümesini büyütür ve ailenin dört ölçümlük yolunun İLK adımıdır.
//
// Script bu ayrımı sayıyla gösteriyor; "bir tane ölç, bant düşsün" diye
// yanlış bir söz vermiyor.

import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";

import { PrismaPg } from "@prisma/adapter-pg";

import {
  MIN_FAMILY_FOR_OWN_BAND,
  bandFromErrors,
  fit,
  fitCrossFamily,
  fitFamily,
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

const MODEL_VERSION = "v0.2";
const WORKLOAD = "gaming" as const;

const cizgi = (s = "=") => console.log(s.repeat(76));

// ---------------------------------------------------------------------------
// Veri — eksen tanımı compute-index-estimates.mts ile AYNI olmak zorunda
// ---------------------------------------------------------------------------

const measured = await prisma.perfIndex.findMany({
  where: { workload: WORKLOAD, model_version: MODEL_VERSION },
  select: { part_id: true, index_value: true },
});
const olculen = new Map(measured.map((r) => [r.part_id, r.index_value]));

const gpuSpecs = await prisma.gpuSpecs.findMany({
  select: {
    part_id: true,
    architecture_family: true,
    bus_width_bits: true,
    boost_clock_mhz: true,
    vram_gb: true,
    tdp_watt: true,
    part: { select: { model: true, release_year: true } },
  },
});

/** GPU ekseni: veri yolu × boost saati (K161). */
const eksen = (g: (typeof gpuSpecs)[number]): number | null =>
  g.bus_width_bits !== null && g.boost_clock_mhz !== null
    ? g.bus_width_bits * g.boost_clock_mhz
    : null;

type Cip = {
  id: string;
  model: string;
  aile: string;
  x: number;
  vram: number;
  tdp: number;
};

const cipler: Cip[] = gpuSpecs
  .map((g) => ({ g, x: eksen(g) }))
  .filter((e) => e.x !== null && e.x > 0)
  .map((e) => ({
    id: e.g.part_id,
    model: e.g.part.model,
    aile: e.g.architecture_family ?? "?",
    x: e.x!,
    vram: e.g.vram_gb,
    tdp: e.g.tdp_watt,
  }));

const noktalar: MeasuredPoint[] = cipler
  .filter((c) => olculen.has(c.id))
  .map((c) => ({ id: c.id, family: c.aile, y: olculen.get(c.id)!, x: c.x }));

const aileler = new Map<string, Cip[]>();
for (const c of cipler) {
  aileler.set(c.aile, [...(aileler.get(c.aile) ?? []), c]);
}
const aileOlcum = (aile: string) => noktalar.filter((p) => p.family === aile).length;

// ---------------------------------------------------------------------------
// 1. Bugünkü durum
// ---------------------------------------------------------------------------

console.log("OLCUM HEDEFLERI — hangi tek cip olculurse bant en cok daralir?");
console.log("Hicbir sey yazilmadi.\n");

cizgi();
console.log("1. BUGUNKU DURUM");
cizgi();
console.log(`  Egitim kumesi        : ${noktalar.length} olculmus ekran karti`);
console.log(`  Kendi bandi icin esik: ${MIN_FAMILY_FOR_OWN_BAND} olcum (K156)\n`);
console.log("  aile              cip   olculen   bandi nereden aliyor");

const olcumsuzAileler: string[] = [];
for (const [aile, liste] of [...aileler.entries()].sort((a, b) => b[1].length - a[1].length)) {
  const n = aileOlcum(aile);
  const kendi = fitFamily(noktalar.filter((p) => p.family === aile));
  const capraz = fitCrossFamily(noktalar, aile);
  let kaynak: string;
  if (kendi && capraz) {
    kaynak =
      kendi.bandPct <= capraz.bandPct
        ? `KENDI ailesi  ±%${kendi.bandPct.toFixed(1)}`
        : `aileler arasi ±%${capraz.bandPct.toFixed(1)} (kendi bandi ±%${kendi.bandPct.toFixed(1)}, daha genis)`;
  } else if (capraz) {
    kaynak = `aileler arasi ±%${capraz.bandPct.toFixed(1)}`;
  } else {
    kaynak = "model kurulamiyor";
  }
  if (n === 0) olcumsuzAileler.push(aile);
  console.log(`  ${aile.padEnd(16)} ${String(liste.length).padStart(3)}   ${String(n).padStart(5)}     ${kaynak}`);
}

const etkilenen = olcumsuzAileler.reduce((s, a) => s + (aileler.get(a)?.length ?? 0), 0);
console.log(
  `\n  Olcumsuz aile: ${olcumsuzAileler.join(", ")} — toplam ${etkilenen} cip aileler arasi bandi tasiyor.`,
);

// ---------------------------------------------------------------------------
// 2. Merkezilik sıralaması
// ---------------------------------------------------------------------------

/** Log uzayında medyan — model log uzayında oturtuluyor, merkez de orada. */
function medyanLog(xs: number[]): number {
  const l = xs.map(Math.log).sort((a, b) => a - b);
  const orta = Math.floor(l.length / 2);
  return l.length % 2 === 1 ? l[orta] : (l[orta - 1] + l[orta]) / 2;
}

console.log();
cizgi();
console.log("2. HEDEF SIRALAMASI — aile basina, spec uzayinda merkezden uzakliga gore");
cizgi();
console.log("  Eksen: veri yolu (bit) x boost saati (MHz). Merkez: ailenin log-medyani.\n");

type Hedef = { aile: string; cip: Cip; sapmaPct: number; kapsam: number };
const hedefler: Hedef[] = [];

for (const aile of olcumsuzAileler) {
  const liste = [...(aileler.get(aile) ?? [])];
  const merkez = medyanLog(liste.map((c) => c.x));
  const sirali = liste
    .map((c) => ({ c, d: Math.abs(Math.log(c.x) - merkez) }))
    .sort((a, b) => a.d - b.d);
  const enKucuk = Math.min(...liste.map((c) => c.x));
  const enBuyuk = Math.max(...liste.map((c) => c.x));

  console.log(`  ${aile.toUpperCase()} — ${liste.length} cip, eksen araligi ${Math.round(enKucuk)} … ${Math.round(enBuyuk)}`);
  console.log(`    (merkez ${Math.round(Math.exp(merkez))}; aralik orani x${(enBuyuk / enKucuk).toFixed(1)})`);
  for (const [i, e] of sirali.slice(0, 3).entries()) {
    const sapma = (Math.exp(e.d) - 1) * 100;
    console.log(
      `    ${i === 0 ? "->" : "  "} ${e.c.id.padEnd(24)} x=${String(Math.round(e.c.x)).padStart(6)}` +
        `  merkezden %${sapma.toFixed(1)}  ${e.c.vram} GB · ${e.c.tdp} W`,
    );
    if (i === 0) {
      // Çapa seçildiğinde ailenin geri kalanı ne kadar uzağa kalıyor?
      const enUzak = Math.max(...liste.map((c) => Math.abs(Math.log(c.x) - Math.log(e.c.x))));
      hedefler.push({
        aile,
        cip: e.c,
        sapmaPct: sapma,
        kapsam: (Math.exp(enUzak) - 1) * 100,
      });
    }
  }
  const h = hedefler[hedefler.length - 1];
  console.log(`    capa secilirse ailenin en uzak uyesi %${h.kapsam.toFixed(0)} uzakta kalir.\n`);
}

// ---------------------------------------------------------------------------
// 3. Merkezilik gerçekten hatayı azaltıyor mu? — 15 ölçümle sınama
// ---------------------------------------------------------------------------

console.log();
cizgi();
console.log("3. MERKEZILIK SINAMASI — uzaklik ile hata birlikte artiyor mu?");
cizgi();
console.log("  Birini-disarida-birak: her olcum sirayla disarida birakilip");
console.log("  kalanlarla tahmin ediliyor. Sorulan sey: disarida birakilan nokta");
console.log("  egitim kumesinin merkezinden UZAKSA hata buyuyor mu?\n");

const sinama: { id: string; uzaklikPct: number; hataPct: number }[] = [];
for (const held of noktalar) {
  const egitim = noktalar.filter((p) => p.id !== held.id);
  const m = fit(egitim);
  if (!m) continue;
  const merkez = egitim.reduce((s, p) => s + Math.log(p.x), 0) / egitim.length;
  sinama.push({
    id: held.id,
    uzaklikPct: (Math.exp(Math.abs(Math.log(held.x) - merkez)) - 1) * 100,
    hataPct: (Math.abs(predict(m, held.x) - held.y) / held.y) * 100,
  });
}
sinama.sort((a, b) => a.uzaklikPct - b.uzaklikPct);
const yari = Math.floor(sinama.length / 2);
const ort = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / xs.length;
const yakinHata = ort(sinama.slice(0, yari).map((s) => s.hataPct));
const uzakHata = ort(sinama.slice(sinama.length - yari).map((s) => s.hataPct));
console.log(`  merkeze YAKIN yari (${yari} nokta): ortalama hata %${yakinHata.toFixed(1)}`);
console.log(`  merkeze UZAK  yari (${yari} nokta): ortalama hata %${uzakHata.toFixed(1)}`);
console.log(
  `  fark: ${uzakHata > yakinHata ? "uzak yari DAHA KOTU" : "fark yok ya da ters"}` +
    ` (${(uzakHata - yakinHata).toFixed(1)} puan)`,
);
console.log(`\n  Ornek noktalar (uzaklik -> hata):`);
for (const s of [sinama[0], sinama[Math.floor(sinama.length / 2)], sinama[sinama.length - 1]]) {
  console.log(`    ${s.id.padEnd(24)} merkezden %${s.uzaklikPct.toFixed(0).padStart(4)}  ->  hata %${s.hataPct.toFixed(1)}`);
}
console.log(
  `\n  NOT: ${noktalar.length} nokta ile bu bir egilim olcumudur, kanit degil.` +
    ` Yonu merkezilik lehine ${uzakHata > yakinHata ? "cikti" : "CIKMADI"}.`,
);

// Aynı soru AİLE İÇİNDE — ASIL SORU BU.
//
// Yukarıdaki ölçüm bütün aileleri karıştırıyor: dışarıda bırakılan noktanın
// hatası çoğunlukla "hangi aileden geldiğinden" geliyor, merkezden ne kadar
// uzak olduğundan değil. Çapanın işi ise bir AİLENİN kendi modelini tutmak.
console.log("\n  Ayni soru AILE ICINDE (esigi gecen aileler) — ASIL OLCUM BU:");
const aileIciSinama: { uzaklikPct: number; hataPct: number }[] = [];
let aileIciOlcum = 0;
for (const [aile] of aileler) {
  const ic = noktalar.filter((p) => p.family === aile);
  if (ic.length < MIN_FAMILY_FOR_OWN_BAND) continue;
  aileIciOlcum++;
  const satirlar = ic
    .map((held) => {
      const egitim = ic.filter((p) => p.id !== held.id);
      const m = fit(egitim);
      if (!m) return null;
      const merkez = egitim.reduce((s, p) => s + Math.log(p.x), 0) / egitim.length;
      return {
        id: held.id,
        uzaklikPct: (Math.exp(Math.abs(Math.log(held.x) - merkez)) - 1) * 100,
        hataPct: (Math.abs(predict(m, held.x) - held.y) / held.y) * 100,
      };
    })
    .filter((v): v is NonNullable<typeof v> => v !== null)
    .sort((a, b) => a.uzaklikPct - b.uzaklikPct);
  console.log(`    ${aile} (${ic.length} nokta):`);
  for (const s of satirlar) {
    aileIciSinama.push(s);
    console.log(`      ${s.id.padEnd(24)} merkezden %${s.uzaklikPct.toFixed(0).padStart(4)}  ->  hata %${s.hataPct.toFixed(1)}`);
  }
}
if (aileIciOlcum === 0) {
  console.log("    Esigi gecen aile yok.");
} else {
  aileIciSinama.sort((a, b) => a.uzaklikPct - b.uzaklikPct);
  const y = Math.floor(aileIciSinama.length / 2);
  const icYakin = ort(aileIciSinama.slice(0, y).map((s) => s.hataPct));
  const icUzak = ort(aileIciSinama.slice(aileIciSinama.length - y).map((s) => s.hataPct));
  console.log(
    `\n    aile ici — merkeze YAKIN yari: %${icYakin.toFixed(1)} · UZAK yari: %${icUzak.toFixed(1)}` +
      ` (${(icUzak - icYakin).toFixed(1)} puan)`,
  );
  console.log(
    `    Yon ${icUzak > icYakin ? "MERKEZILIK LEHINE" : "merkezilik aleyhine"}: aile icinde merkezden uzaklasan` +
      `\n    nokta ${icUzak > icYakin ? "daha kotu tahmin ediliyor" : "daha iyi tahmin ediliyor"}.` +
      ` ${aileIciSinama.length} nokta ile bu da bir egilim, kanit degil.`,
  );
}

// ---------------------------------------------------------------------------
// 4. Dört ölçüm ne kazandırır? — ölçümlü ailelerde laboratuvar
// ---------------------------------------------------------------------------

console.log();
cizgi();
console.log(`4. ${MIN_FAMILY_FOR_OWN_BAND} OLCUM NE KAZANDIRIR? — olcumu olan ailelerde olculdu`);
cizgi();
console.log("  Tek olcum bandi DEGISTIRMEZ (esik dort). Asagidaki sayilar, bir aile");
console.log("  esige ulastiginda ne olacaginin elimizdeki tek gercek olcumu.\n");
console.log("  aile           olcum   aileler arasi bant   KENDI bandi   fark");

for (const [aile] of aileler) {
  const icNoktalar = noktalar.filter((p) => p.family === aile);
  if (icNoktalar.length < MIN_FAMILY_FOR_OWN_BAND) continue;
  const kendi = fitFamily(icNoktalar);
  const capraz = fitCrossFamily(noktalar, aile);
  if (!kendi || !capraz) continue;
  // Aileler arası modelin BU AİLE üstündeki gerçek hatası.
  const disHatalar = icNoktalar.map((p) => {
    const m = fit(noktalar.filter((q) => q.family !== aile));
    return m ? (Math.abs(predict(m, p.x) - p.y) / p.y) * 100 : NaN;
  }).filter((v) => Number.isFinite(v));
  const disBant = bandFromErrors(disHatalar);
  console.log(
    `  ${aile.padEnd(14)} ${String(icNoktalar.length).padStart(4)}` +
      `    ±%${disBant.toFixed(1).padStart(5)}${"".padEnd(10)}±%${kendi.bandPct.toFixed(1).padStart(5)}` +
      `      ${(disBant - kendi.bandPct).toFixed(1)} puan`,
  );
}

// ---------------------------------------------------------------------------
// 5. Kısa liste
// ---------------------------------------------------------------------------

console.log();
cizgi();
console.log("5. KISA LISTE — aile basina bir cip");
cizgi();
hedefler.sort((a, b) => (aileler.get(b.aile)?.length ?? 0) - (aileler.get(a.aile)?.length ?? 0));
for (const [i, h] of hedefler.entries()) {
  const aileBoyu = aileler.get(h.aile)?.length ?? 0;
  console.log(
    `  ${i + 1}. ${h.cip.id.padEnd(24)} (${h.aile}, ailede ${aileBoyu} cip)` +
      `  merkezden %${h.sapmaPct.toFixed(1)}`,
  );
  console.log(`     ${h.cip.model} · ${h.cip.vram} GB · ${h.cip.tdp} W · eksen ${Math.round(h.cip.x)}`);
  // Eşik dört olduğu için çapanın yanına üç nokta daha gerekiyor. Bunlar
  // merkeze göre değil ARALIĞA göre seçiliyor: çapa ortayı, bu üçü uçları ve
  // ara noktayı tutuyor; eğri iki uçtan da bağlanmış oluyor.
  const liste = [...(aileler.get(h.aile) ?? [])].sort((a, b) => a.x - b.x);
  const kalan = liste.filter((c) => c.id !== h.cip.id);
  const uclar = [
    kalan[0],
    kalan[kalan.length - 1],
    kalan[Math.floor(kalan.length / 2)],
  ].filter((c, i, arr): c is Cip => Boolean(c) && arr.findIndex((o) => o?.id === c.id) === i);
  console.log(`     esige (${MIN_FAMILY_FOR_OWN_BAND}) ulasmak icin yanina: ${uclar.map((c) => c.id).join(", ")}`);
}
console.log(
  `\n  Bu uc olcum ${etkilenen} cipi dogrudan bandindan kurtarmaz — esik dort.` +
    `\n  Kurtardigi sey su: her ailenin ilk capasi merkeze oturur, sonraki uc` +
    `\n  olcum uclara dagitilabilir ve aile esige EN AZ ekstrapolasyonla ulasir.`,
);

await prisma.$disconnect();
