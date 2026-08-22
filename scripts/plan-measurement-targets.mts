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

// ===========================================================================
// 6. DÖRT ÖLÇÜMÜN MODELİ — EKSTRAPOLASYON
// ===========================================================================
//
// Soru: rdna_2, ampere ve alchemist'in her biri dörder ölçüm alsa, o ailelerin
// bandı ne olur ve AİLELER ARASI bant ne olur?
//
// **Bu bölümün tamamı EKSTRAPOLASYON.** Ölçülmemiş bir ailenin ölçülünce ne
// vereceği bilinemez; bilinen tek şey, eşiği geçmiş ailelerin ne verdiği.
// Aşağıdaki sayılar o gözlemin ödünç verilmesidir, tahmin bandı değildir.
//
// Neden yine de yapılıyor: donanım almadan önce "ne kazanacağım" sorusunun
// bir cevabı olmalı ve "bilinmez" o soruyu cevaplamıyor. Cevap veriliyor ama
// neye dayandığı ve nerede kırılacağı yazılıyor.

console.log();
cizgi();
console.log("6. DORT OLCUM NE VERIR? — EKSTRAPOLASYON, olcum degil");
cizgi();

/** Bir kümeden k boyutlu bütün alt kümeler. Küçük n için tam sayım yeterli. */
function altKumeler<T>(liste: readonly T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (liste.length < k) return [];
  const [ilk, ...kalan] = liste;
  return [...altKumeler(kalan, k - 1).map((alt) => [ilk, ...alt]), ...altKumeler(kalan, k)];
}

/** Bir nokta kümesinin birini-dışarıda-bırak bandı. */
function kumeBandi(noktalar: readonly MeasuredPoint[]): number | null {
  if (noktalar.length < MIN_FAMILY_FOR_OWN_BAND) return null;
  const errs: number[] = [];
  for (const held of noktalar) {
    const m = fit(noktalar.filter((p) => p.id !== held.id));
    if (!m) continue;
    errs.push((Math.abs(predict(m, held.x) - held.y) / held.y) * 100);
  }
  return errs.length === 0 ? null : bandFromErrors(errs);
}

// --- 6a. Eşiği geçmiş ailelerde n=4 ne verdi? ------------------------------
//
// İşlemci aileleri de sayılıyor: ekseni farklı ama YÖNTEM aynı ve n=4
// gözlemimiz üç aileye çıkıyor. Ayrı sütunda gösteriliyor, karıştırılmıyor.

const cpuSpecs = await prisma.cpuSpecs.findMany({
  select: { part_id: true, architecture_family: true, boost_clock_mhz: true, l3_cache_mb: true },
});
const cpuNoktalar: MeasuredPoint[] = cpuSpecs
  .filter((c) => olculen.has(c.part_id) && c.l3_cache_mb !== null)
  .map((c) => ({
    id: c.part_id,
    family: c.architecture_family ?? "?",
    y: olculen.get(c.part_id)!,
    x: c.boost_clock_mhz * Math.sqrt(c.l3_cache_mb!),
  }));

console.log("  6a. Esigi gecmis ailelerde DORT olcum ne verdi?");
console.log("      (n>4 olan ailede butun 4'lu alt kumeler ayri ayri olculdu)\n");
console.log("      aile              tur   n   4'lu bant: ort / en dar / en genis");

const dortluBantlar: number[] = [];
for (const [tur, kume] of [["GPU", noktalar], ["CPU", cpuNoktalar]] as const) {
  const aileAdlari = [...new Set(kume.map((p) => p.family))];
  for (const aile of aileAdlari) {
    const ic = kume.filter((p) => p.family === aile);
    if (ic.length < MIN_FAMILY_FOR_OWN_BAND) continue;
    const bantlar = altKumeler(ic, MIN_FAMILY_FOR_OWN_BAND)
      .map(kumeBandi)
      .filter((b): b is number => b !== null);
    if (bantlar.length === 0) continue;
    dortluBantlar.push(...bantlar);
    const ortalama = bantlar.reduce((s, v) => s + v, 0) / bantlar.length;
    console.log(
      `      ${aile.padEnd(16)}  ${tur}  ${String(ic.length).padStart(2)}` +
        `   ±%${ortalama.toFixed(1)} / ±%${Math.min(...bantlar).toFixed(1)} / ±%${Math.max(...bantlar).toFixed(1)}` +
        `   (${bantlar.length} alt kume)`,
    );
  }
}

const dortluOrt = dortluBantlar.reduce((s, v) => s + v, 0) / dortluBantlar.length;
const dortluAlt = Math.min(...dortluBantlar);
const dortluUst = Math.max(...dortluBantlar);
console.log(
  `\n      TOPLAM ${dortluBantlar.length} adet 4'lu kume: ortalama ±%${dortluOrt.toFixed(1)},` +
    ` aralik ±%${dortluAlt.toFixed(1)} … ±%${dortluUst.toFixed(1)}`,
);

// --- 6b. Bant ile ailenin YAYILIMI arasında ilişki var mı? -----------------
//
// Ölçülmemiş üç aile birbirine benzemiyor: alchemist'in eksen aralığı ×2.8,
// ampere'inki ×5.1. Yayılım bandı belirliyorsa tahmin aile başına ayrışmalı.

console.log("\n  6b. Ailenin eksen YAYILIMI bandi belirliyor mu?");
console.log("      aile              n   yayilim   kendi bandi");
const yayilimNoktalari: { yayilim: number; bant: number }[] = [];
for (const [tur, kume] of [["GPU", noktalar], ["CPU", cpuNoktalar]] as const) {
  for (const aile of [...new Set(kume.map((p) => p.family))]) {
    const ic = kume.filter((p) => p.family === aile);
    const bant = kumeBandi(ic);
    if (bant === null) continue;
    const yayilim = Math.max(...ic.map((p) => p.x)) / Math.min(...ic.map((p) => p.x));
    yayilimNoktalari.push({ yayilim, bant });
    console.log(
      `      ${aile.padEnd(16)} ${tur} ${String(ic.length).padStart(2)}` +
        `   x${yayilim.toFixed(1)}      ±%${bant.toFixed(1)}`,
    );
  }
}
console.log(
  yayilimNoktalari.length < 3
    ? "      Uc aileden az veri var: iliski OLCULEMIYOR, aile basina ayristirma yapilmiyor."
    : "      Uc gozlem: yon okunabiliyor ama katsayi cikarilamaz.",
);

// --- 6c. Üç aile için tahmin ----------------------------------------------

console.log("\n  6c. Uc hedef aile icin BEKLENEN bant (ekstrapolasyon)");
console.log("      aile         bugun      dort olcumden sonra (beklenen)");
for (const aile of olcumsuzAileler) {
  const capraz = fitCrossFamily(noktalar, aile);
  const bugun = capraz ? capraz.bandPct : NaN;
  console.log(
    `      ${aile.padEnd(12)} ±%${bugun.toFixed(1)}     ±%${dortluAlt.toFixed(1)} … ±%${dortluUst.toFixed(1)}` +
      `  (merkez ±%${dortluOrt.toFixed(1)})`,
  );
}
console.log(
  "\n      Aile basina AYRI bir sayi verilmiyor: elimizdeki uc ailenin\n" +
    "      dagilimi, dorduncu bir ailenin nereye duseceğini soylemeye yetmiyor.",
);

// --- 6d. Aileler arası bant ne olur? --------------------------------------
//
// Ölçülü aile sayısı 5'ten 8'e çıkıyor, eğitim kümesi 15'ten 27'ye. Aileler
// arası bandın bundan nasıl etkileneceği, GERİYE DOĞRU ölçülüyor: bugünkü
// kümede daha az aileyle ne oluyordu?

console.log("\n  6d. AILELER ARASI bant — olculu aile sayisiyla nasil degisti?");
console.log("      olculu aile   egitim noktasi   aileler arasi bant");

const olculuAileler = [...new Set(noktalar.map((p) => p.family))];
for (let k = 3; k <= olculuAileler.length; k++) {
  const bantlar: number[] = [];
  for (const secim of altKumeler(olculuAileler, k)) {
    const kume = noktalar.filter((p) => secim.includes(p.family));
    const errs: number[] = [];
    for (const held of kume) {
      const m = fit(kume.filter((p) => p.id !== held.id && p.family !== held.family));
      if (!m) continue;
      errs.push((Math.abs(predict(m, held.x) - held.y) / held.y) * 100);
    }
    if (errs.length > 0) bantlar.push(bandFromErrors(errs));
  }
  if (bantlar.length === 0) continue;
  const ort2 = bantlar.reduce((s, v) => s + v, 0) / bantlar.length;
  const noktaOrt =
    altKumeler(olculuAileler, k).reduce(
      (s, secim) => s + noktalar.filter((p) => secim.includes(p.family)).length,
      0,
    ) / altKumeler(olculuAileler, k).length;
  console.log(
    `      ${String(k).padStart(2)}            ${noktaOrt.toFixed(1).padStart(5)}` +
      `            ±%${ort2.toFixed(1)}  (${bantlar.length} kombinasyon)`,
  );
}
console.log(
  `\n      Bugun: ${olculuAileler.length} aile, ${noktalar.length} nokta, aileler arasi ±%${
    (fitCrossFamily(noktalar, olcumsuzAileler[0])?.bandPct ?? 0).toFixed(1)
  }`,
);

// Üç noktadan sekize uzatma.
//
// Model biçimi bir SEÇİM: `bant = a + b/k`. Sebebi, azalan getiri beklentisi —
// her yeni aile öncekinden az katkı yapıyor ve gözlem de öyle diyor (-16.0
// puan, sonra -6.1 puan). Doğrusal uzatmak bandı sekizde negatife düşürürdü,
// ki anlamsız.
//
// Uzatma gözlemin İKİ KATI kadar öteye gidiyor (k=5 → k=8). Sayı bu yüzden
// tek başına değil, kalıntılarıyla birlikte basılıyor: okuyan kişi modelin
// eldeki üç noktayı ne kadar tutturduğunu görsün.
const gozlem: { k: number; bant: number }[] = [];
for (let k = 3; k <= olculuAileler.length; k++) {
  const bantlar: number[] = [];
  for (const secim of altKumeler(olculuAileler, k)) {
    const kume = noktalar.filter((p) => secim.includes(p.family));
    const errs: number[] = [];
    for (const held of kume) {
      const m = fit(kume.filter((p) => p.id !== held.id && p.family !== held.family));
      if (m) errs.push((Math.abs(predict(m, held.x) - held.y) / held.y) * 100);
    }
    if (errs.length > 0) bantlar.push(bandFromErrors(errs));
  }
  if (bantlar.length > 0) {
    gozlem.push({ k, bant: bantlar.reduce((s, v) => s + v, 0) / bantlar.length });
  }
}

if (gozlem.length >= 3) {
  const xs = gozlem.map((g) => 1 / g.k);
  const ys = gozlem.map((g) => g.bant);
  const mx = xs.reduce((s, v) => s + v, 0) / xs.length;
  const my = ys.reduce((s, v) => s + v, 0) / ys.length;
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < xs.length; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
  }
  const b = sxy / sxx;
  const a = my - b * mx;
  const tahmin = (k: number) => a + b / k;
  console.log("\n      Uzatma modeli: bant = a + b/k   (k = olculu aile sayisi)");
  console.log(`      a = ${a.toFixed(1)}, b = ${b.toFixed(1)}`);
  console.log("      k    gozlenen   model   kalinti");
  for (const g of gozlem) {
    console.log(
      `      ${g.k}    ±%${g.bant.toFixed(1).padStart(5)}   ±%${tahmin(g.k).toFixed(1).padStart(5)}` +
        `   ${(g.bant - tahmin(g.k)).toFixed(1).padStart(5)} puan`,
    );
  }
  console.log(
    `      8    —          ±%${tahmin(8).toFixed(1)}   <- EKSTRAPOLASYON (gozlemin disi)`,
  );
  console.log(
    "\n      Bu sayiya guvenmenin siniri: k=8, en buyuk gozlemin (k=5) uc aile\n" +
      "      otesinde. Ayrica simulasyon 'daha cok aile' ile 'daha cok nokta'yi\n" +
      "      ayiramiyor — ikisi birlikte artiyor.",
  );
}

// --- 6e. Kaç çip etkilenir? ------------------------------------------------

const kalanCapraz = [...aileler.entries()]
  .filter(([aile]) => !olcumsuzAileler.includes(aile) && aileOlcum(aile) < MIN_FAMILY_FOR_OWN_BAND)
  .reduce((s, [, liste]) => s + liste.length, 0);

console.log("\n  6e. Kac cip yer degistirir?");
console.log(`      Kendi ailesinin bandina gecen : ${etkilenen} cip (rdna_2, ampere, alchemist)`);
console.log(`      Aileler arasi bantta KALAN    : ${kalanCapraz} cip (esigi gecemeyen aileler)`);
console.log(
  "      Yani 12 olcum, katalogun yarisini kendi ailesinin bandina tasiyor;\n" +
    "      geri kalani icin degisen sey aileler arasi modelin biraz daha genis\n" +
    "      bir egitim kumesiyle kurulmasi.",
);

await prisma.$disconnect();
