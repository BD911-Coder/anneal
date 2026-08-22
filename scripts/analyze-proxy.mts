// Vekil skor çözümlemesi — `npm run vekil:analiz`
//
// Soru: kamuya açık bir sentetik skor, bizim ölçülmüş indeksimizin vekili
// olabilir mi? Olabiliyorsa ölçümü olmayan aileler (`ampere`, `rdna_2`,
// `alchemist`) o skorla çapalanabilir.
//
// **Hiçbir şey yazmaz.** CSV'den okur, ölçer, kapıyı uygular.
//
// ---------------------------------------------------------------------------
// KAPI
// ---------------------------------------------------------------------------
//
// **Aile içi kalıntı yayılımı ≥ %30,7 ise vekil bir şey KATMIYOR.** Sebep:
// %30,7 zaten aileler arası modelin bandı (K172). Vekil, ondan daha iyisini
// yapmıyorsa eklenmesi yalnızca karmaşıklık.
//
// ---------------------------------------------------------------------------
// MARKA KONFAUNDU — baştan kurulu, sonradan eklenmedi
// ---------------------------------------------------------------------------
//
// OpenBenchmarking sonuçları Linux. AMD **Mesa**, NVIDIA **tescilli** sürücü
// kullanıyor ve bu iki yığın aynı donanımdan farklı performans çıkarır.
//
// Bu yüzden R² tek başına yeterli değil: kalıntılar **mimariye göre değil
// markaya göre** kümeleniyorsa, uyum iyi görünse bile vekil **markalar arası**
// çapalama için kullanılamaz. Rapor bu kontrolü en üste koyuyor.

import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../lib/generated/prisma/client.ts";
import { PROXY_CSV, vekilSatirlariOku } from "./proxy-csv.mts";

for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) loadEnvFile(file);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL tanimli degil.");
  process.exit(1);
}
const prisma = new PrismaClient({ adapter: new PrismaPg(connectionString) });

/** Aileler arası bandın bugünkü değeri — kapının ölçütü (K172). */
const KAPI_ESIGI = 30.7;

const cizgi = (s = "=") => console.log(s.repeat(78));
const ort = (xs: readonly number[]) => xs.reduce((s, v) => s + v, 0) / xs.length;
const sapma = (xs: readonly number[]) => {
  if (xs.length < 2) return 0;
  const m = ort(xs);
  return Math.sqrt(xs.reduce((s, v) => s + (v - m) ** 2, 0) / (xs.length - 1));
};

// Sinama icin baska bir dosya verilebilir: --dosya=<yol>. Varsayilan sablon.
const dosya = process.argv.find((a) => a.startsWith("--dosya="))?.split("=")[1] ?? PROXY_CSV;
const { satirlar } = vekilSatirlariOku(dosya);

console.log("VEKIL SKOR COZUMLEMESI");
console.log("Hicbir sey yazilmadi.\n");

if (satirlar.length === 0) {
  console.log("Doldurulmus satir yok — cozumleme bekliyor.");
  console.log("Sablon : data/proxy/openbenchmarking.csv");
  console.log("Nasil  : data/proxy/README.md");
  console.log("\nSatirlar geldiginde bu komut su siralamayi calistiracak:");
  console.log("  1. MARKA KONFAUNDU  — kalintilar markaya gore mi kumeleniyor?");
  console.log("  2. REGRESYON        — log-log uyum, R2, kalinti yayilimi");
  console.log("  3. AILE ICI         — her ailede kalinti yayilimi");
  console.log(`  4. KAPI             — aile ici yayilim >= %${KAPI_ESIGI} ise vekil bir sey katmiyor`);
  await prisma.$disconnect();
  process.exit(0);
}

// --- Ölçülmüş indeksle eşleştir ---------------------------------------------

const olculen = new Map(
  (
    await prisma.perfIndex.findMany({
      where: { workload: "gaming", model_version: "v0.2" },
      select: { part_id: true, index_value: true },
    })
  ).map((r) => [r.part_id, r.index_value]),
);
const cipler = new Map(
  (
    await prisma.gpuSpecs.findMany({
      select: { part_id: true, architecture_family: true, part: { select: { brand: true } } },
    })
  ).map((g) => [g.part_id, { aile: g.architecture_family ?? "?", marka: g.part.brand }]),
);

type Nokta = { id: string; aile: string; marka: string; skor: number; indeks: number; profil: string };
const noktalar: Nokta[] = [];
const indekssiz: string[] = [];
for (const s of satirlar) {
  const meta = cipler.get(s.part_id);
  if (!meta) continue;
  const indeks = olculen.get(s.part_id);
  if (indeks === undefined) {
    indekssiz.push(s.part_id);
    continue;
  }
  noktalar.push({ id: s.part_id, aile: meta.aile, marka: meta.marka, skor: s.score, indeks, profil: s.test_profile });
}

console.log(`Doldurulmus satir      : ${satirlar.length}`);
console.log(`Olculmus indeksi olan  : ${noktalar.length} (regresyon bunlarla kuruluyor)`);
console.log(`Indeksi olmayan (hedef): ${indekssiz.length}${indekssiz.length ? ` — ${indekssiz.join(", ")}` : ""}`);

// Profil karışıksa ayrı ayrı çözümlenir: iki profilin skoru aynı ölçekte değil.
const profiller = [...new Set(noktalar.map((n) => n.profil))];
if (profiller.length > 1) {
  console.log(`\nDIKKAT: ${profiller.length} farkli profil var. Her biri AYRI cozumleniyor —`);
  console.log("farkli profillerin skorlari ayni olcekte degildir.");
}

for (const profil of profiller) {
  const kume = noktalar.filter((n) => n.profil === profil);
  console.log("\n" + "=".repeat(78));
  console.log(`PROFIL: ${profil} — ${kume.length} nokta`);
  cizgi();

  if (kume.length < 4) {
    console.log("  Dortten az nokta: regresyon kurulmuyor (uydurma bir uyum cikardi).");
    continue;
  }

  // --- Regresyon: log(indeks) = a + b*log(skor) ---------------------------
  const lx = kume.map((n) => Math.log(n.skor));
  const ly = kume.map((n) => Math.log(n.indeks));
  const mx = ort(lx);
  const my = ort(ly);
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < kume.length; i++) {
    sxy += (lx[i] - mx) * (ly[i] - my);
    sxx += (lx[i] - mx) ** 2;
  }
  const b = sxx === 0 ? 0 : sxy / sxx;
  const a = my - b * mx;
  const tahmin = (skor: number) => Math.exp(a + b * Math.log(skor));

  // R², log uzayında — model orada oturtuldu.
  const ssTot = ly.reduce((s, v) => s + (v - my) ** 2, 0);
  const ssRes = kume.reduce((s, n) => s + (Math.log(n.indeks) - (a + b * Math.log(n.skor))) ** 2, 0);
  const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot;

  // Kalıntı = yüzde cinsinden sapma; bandımızla aynı birim.
  const kalintilar = kume.map((n) => ({
    ...n,
    kalintiPct: ((tahmin(n.skor) - n.indeks) / n.indeks) * 100,
  }));

  // --- 1. MARKA KONFAUNDU — ilk sırada, bilerek --------------------------
  console.log("\n  1. MARKA KONFAUNDU (Linux: AMD=Mesa, NVIDIA=tescilli)");
  console.log("     marka     n   ortalama kalinti   yayilim (std)");
  const markalar = [...new Set(kume.map((n) => n.marka))];
  const markaOrt: { marka: string; ort: number; n: number }[] = [];
  for (const marka of markalar) {
    const k = kalintilar.filter((n) => n.marka === marka).map((n) => n.kalintiPct);
    markaOrt.push({ marka, ort: ort(k), n: k.length });
    console.log(`     ${marka.padEnd(9)} ${String(k.length).padStart(2)}   %${ort(k).toFixed(1).padStart(6)}            %${sapma(k).toFixed(1)}`);
  }
  const markaIciYayilim = ort(
    markalar.map((m) => sapma(kalintilar.filter((n) => n.marka === m).map((n) => n.kalintiPct))),
  );
  const markalarArasiFark =
    markaOrt.length > 1 ? Math.max(...markaOrt.map((m) => m.ort)) - Math.min(...markaOrt.map((m) => m.ort)) : 0;
  console.log(`\n     Markalar arasi ortalama farki : %${markalarArasiFark.toFixed(1)}`);
  console.log(`     Marka ICI ortalama yayilim     : %${markaIciYayilim.toFixed(1)}`);
  const markayaKumeleniyor = markalarArasiFark > markaIciYayilim;
  console.log(
    markayaKumeleniyor
      ? "     >>> KALINTILAR MARKAYA GORE KUMELENIYOR. Muhtemel sebep surucu\n" +
        "         yigini (Mesa / tescilli). Vekil, marka ICINDE ise yarasa bile\n" +
        "         MARKALAR ARASI capalama icin KULLANILAMAZ."
      : "     Markalar arasi fark, marka ici yayilimdan kucuk: surucu yigini\n" +
        "     kalintilari domine ETMIYOR.",
  );

  // --- 2. Uyum -----------------------------------------------------------
  console.log("\n  2. REGRESYON");
  console.log(`     indeks = ${Math.exp(a).toFixed(4)} x skor^${b.toFixed(3)}`);
  console.log(`     R2 (log uzayi)          : ${r2.toFixed(3)}`);
  console.log(`     Kalinti ortalama mutlak : %${ort(kalintilar.map((k) => Math.abs(k.kalintiPct))).toFixed(1)}`);
  console.log(`     Kalinti yayilimi (std)  : %${sapma(kalintilar.map((k) => k.kalintiPct)).toFixed(1)}`);
  console.log(`     En kotu kalinti         : %${Math.max(...kalintilar.map((k) => Math.abs(k.kalintiPct))).toFixed(1)}`);

  console.log("\n     parca                     indeks   vekil skor   tahmin   kalinti");
  for (const k of [...kalintilar].sort((x, y) => y.indeks - x.indeks)) {
    console.log(
      `     ${k.id.padEnd(24)} ${k.indeks.toFixed(1).padStart(6)}   ${String(k.skor).padStart(10)}` +
        `   ${tahmin(k.skor).toFixed(1).padStart(6)}   %${k.kalintiPct.toFixed(1)}`,
    );
  }

  // --- 3. Aile içi -------------------------------------------------------
  console.log("\n  3. AILE ICI KALINTI YAYILIMI");
  console.log("     aile             n   yayilim (std)   en kotu");
  const aileYayilimlari: number[] = [];
  for (const aile of [...new Set(kume.map((n) => n.aile))]) {
    const k = kalintilar.filter((n) => n.aile === aile).map((n) => n.kalintiPct);
    if (k.length < 2) {
      console.log(`     ${aile.padEnd(16)} ${String(k.length).padStart(2)}   (tek nokta — yayilim olculemez)`);
      continue;
    }
    aileYayilimlari.push(sapma(k));
    console.log(
      `     ${aile.padEnd(16)} ${String(k.length).padStart(2)}   %${sapma(k).toFixed(1).padStart(6)}` +
        `          %${Math.max(...k.map(Math.abs)).toFixed(1)}`,
    );
  }

  // --- 4. KAPI -----------------------------------------------------------
  console.log("\n  4. KAPI");
  if (aileYayilimlari.length === 0) {
    console.log("     Aile ici yayilim olculemedi (her ailede tek nokta). Kapi UYGULANAMADI.");
    continue;
  }
  const yayilim = ort(aileYayilimlari);
  console.log(`     Aile ici ortalama kalinti yayilimi : %${yayilim.toFixed(1)}`);
  console.log(`     Esik                                : %${KAPI_ESIGI}`);
  if (yayilim >= KAPI_ESIGI) {
    console.log("     >>> KAPI KAPALI: vekil, aileler arasi modelden iyi degil.");
    console.log("         Ekleme yapilmaz; sonuc bir karara yazilir.");
  } else if (markayaKumeleniyor) {
    console.log("     >>> KAPI KISMEN ACIK: yayilim esigin altinda AMA kalintilar");
    console.log("         markaya gore kumeleniyor. Vekil yalnizca MARKA ICINDE");
    console.log("         kullanilabilir; markalar arasi capalama icin kullanilamaz.");
  } else {
    console.log("     >>> KAPI ACIK: vekil ek ongoru getiriyor ve marka konfaundu");
    console.log("         domine etmiyor. Sonraki adim: spec modeline EK ongoru");
    console.log("         olarak ekle (yerine gecirme), LOO'yu yeniden kos.");
  }
}

console.log("\n" + "=".repeat(78));
console.log("Bu cozumleme hicbir satir yazmadi. perf_index'e dokunulmadi (K71).");
await prisma.$disconnect();
