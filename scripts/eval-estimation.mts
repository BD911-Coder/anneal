// Tahmin motoru regresyon koşumu — model değişikliği iyileştirdi mi, bozdu mu?
//
// Çalıştırma:
//   npm run tahmin:degerlendir              tabloyu bas, temel ile karşılaştır
//   npm run tahmin:degerlendir -- --kaydet  bugünkü tabloyu TEMEL olarak yaz
//   npm run tahmin:degerlendir -- --guncelle  değerlendirme kümesini tazele
//
// **Bu bir rapor değil, ALTYAPI.** Tahmin yolları çoğaldı (aile modeli,
// aileler arası model, aile ortalaması) ve bir değişikliğin hangisini
// iyileştirip hangisini bozduğunu söyleyecek hiçbir şey yoktu. Bu script o
// boşluğu dolduruyor: her koşumda aynı tabloyu üretiyor ve temelden sapma
// varsa **yüksek sesle** hata veriyor.
//
// ---------------------------------------------------------------------------
// DEĞERLENDİRME KÜMESİ NEDEN DONDURULDU
// ---------------------------------------------------------------------------
//
// Küme `data/eval/estimation-eval-set.json` içinde duruyor ve script
// veritabanından DEĞİL oradan okuyor. Sebebi: ölçüm eklendikçe tablo
// kendiliğinden değişirse, "model mi düzeldi yoksa veri mi değişti"
// sorusu cevapsız kalır. Karşılaştırma ancak sabit bir küme üzerinde
// anlamlı.
//
// Veritabanı yine de okunuyor ama yalnızca **kümenin kaç ölçüm geride
// kaldığını** söylemek için. Yeni ölçüm geldiğinde küme elle tazeleniyor
// (`--guncelle`) ve temel yeniden alınıyor (`--kaydet`) — ikisi bilinçli
// birer adım.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { loadEnvFile } from "node:process";

import { PrismaPg } from "@prisma/adapter-pg";

import {
  MIN_FAMILY_FOR_OWN_BAND,
  bandFromErrors,
  estimate,
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

const args = process.argv.slice(2);
const KAYDET = args.includes("--kaydet");
const GUNCELLE = args.includes("--guncelle");

const KUME_YOLU = "data/eval/estimation-eval-set.json";
const TEMEL_YOLU = "data/eval/estimation-baseline.json";

/** Bozulma toleransı, yüzde puan. Kayan nokta gürültüsü hata sayılmasın. */
const TOLERANS = 0.1;

const MODEL_VERSION = "v0.2";

type Kume = {
  olusturuldu: string;
  aciklama: string;
  gpu: MeasuredPoint[];
  cpu: MeasuredPoint[];
};

// ---------------------------------------------------------------------------
// Değerlendirme kümesi
// ---------------------------------------------------------------------------

async function kumeyiVeritabanindanOku(): Promise<Kume> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL tanimli degil.");
  const prisma = new PrismaClient({ adapter: new PrismaPg(connectionString) });
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
  await prisma.$disconnect();

  // Eksenler `compute-index-estimates.mts` ile AYNI olmak zorunda (K161).
  const gpu: MeasuredPoint[] = gpuSpecs
    .filter((g) => olculen.has(g.part_id) && g.bus_width_bits !== null && g.boost_clock_mhz !== null)
    .map((g) => ({
      id: g.part_id,
      family: g.architecture_family ?? "?",
      y: olculen.get(g.part_id)!,
      x: g.bus_width_bits! * g.boost_clock_mhz!,
    }));
  const cpu: MeasuredPoint[] = cpuSpecs
    .filter((c) => olculen.has(c.part_id) && c.l3_cache_mb !== null)
    .map((c) => ({
      id: c.part_id,
      family: c.architecture_family ?? "?",
      y: olculen.get(c.part_id)!,
      x: c.boost_clock_mhz * Math.sqrt(c.l3_cache_mb!),
    }));
  return {
    olusturuldu: new Date().toISOString().slice(0, 10),
    aciklama:
      "Tahmin motoru degerlendirme kumesi. Eksenler compute-index-estimates.mts ile ayni. " +
      "DONDURULMUS: yeni olcum geldiginde --guncelle ile tazelenir, sonra --kaydet ile temel yenilenir.",
    gpu: gpu.sort((a, b) => a.id.localeCompare(b.id)),
    cpu: cpu.sort((a, b) => a.id.localeCompare(b.id)),
  };
}

if (GUNCELLE || !existsSync(KUME_YOLU)) {
  const yeni = await kumeyiVeritabanindanOku();
  mkdirSync("data/eval", { recursive: true });
  writeFileSync(KUME_YOLU, JSON.stringify(yeni, null, 2) + "\n");
  console.log(`Degerlendirme kumesi yazildi: ${KUME_YOLU} (${yeni.gpu.length} GPU, ${yeni.cpu.length} CPU)`);
  if (GUNCELLE) {
    console.log("Kume degisti — temeli de yenilemen gerekiyor: --kaydet");
  }
}

const kume: Kume = JSON.parse(readFileSync(KUME_YOLU, "utf8"));

// ---------------------------------------------------------------------------
// Yollar — her biri ayrı ayrı ölçülüyor
// ---------------------------------------------------------------------------
//
// `motor` satırı en önemlisi: kullanıcının gerçekten gördüğü sayı o. Diğer üçü
// karşılaştırma noktası — motorun seçimi hangi yola göre daha iyi ya da daha
// kötü, tek tabloda görünsün.

type Yol = "motor" | "aile-modeli" | "aileler-arasi" | "aile-ortalamasi";

function tahminEt(yol: Yol, egitim: MeasuredPoint[], nokta: MeasuredPoint): number | null {
  switch (yol) {
    case "motor": {
      const s = estimate(egitim, nokta.family, nokta.x);
      return s ? s.index : null;
    }
    case "aile-modeli": {
      const m = fitFamily(egitim.filter((p) => p.family === nokta.family));
      return m ? predict(m, nokta.x) : null;
    }
    case "aileler-arasi": {
      const m = fitCrossFamily(egitim, nokta.family);
      return m ? predict(m, nokta.x) : null;
    }
    case "aile-ortalamasi": {
      const ic = egitim.filter((p) => p.family === nokta.family);
      if (ic.length === 0) return null;
      return ic.reduce((s, p) => s + p.y, 0) / ic.length;
    }
  }
}

type Satir = {
  tur: "GPU" | "CPU";
  yol: Yol;
  aile: string;
  n: number;
  ortalama: number;
  p90: number;
  enKotu: number;
};

function degerlendir(tur: "GPU" | "CPU", noktalar: MeasuredPoint[]): Satir[] {
  const out: Satir[] = [];
  const aileler = ["TUMU", ...new Set(noktalar.map((p) => p.family))];
  for (const yol of ["motor", "aile-modeli", "aileler-arasi", "aile-ortalamasi"] as Yol[]) {
    for (const aile of aileler) {
      const hedefler = aile === "TUMU" ? noktalar : noktalar.filter((p) => p.family === aile);
      const hatalar: number[] = [];
      for (const nokta of hedefler) {
        // Birini-dışarıda-bırak: değerlendirilen nokta eğitimde YOK.
        const egitim = noktalar.filter((p) => p.id !== nokta.id);
        const tahmin = tahminEt(yol, egitim, nokta);
        if (tahmin === null) continue;
        hatalar.push((Math.abs(tahmin - nokta.y) / nokta.y) * 100);
      }
      if (hatalar.length === 0) continue;
      out.push({
        tur,
        yol,
        aile,
        n: hatalar.length,
        ortalama: Math.round((hatalar.reduce((s, v) => s + v, 0) / hatalar.length) * 10) / 10,
        p90: Math.round(bandFromErrors(hatalar) * 10) / 10,
        enKotu: Math.round(Math.max(...hatalar) * 10) / 10,
      });
    }
  }
  return out;
}

const satirlar = [...degerlendir("GPU", kume.gpu), ...degerlendir("CPU", kume.cpu)];
const anahtar = (s: Satir) => `${s.tur}|${s.yol}|${s.aile}`;

// ---------------------------------------------------------------------------
// Temel ile karşılaştırma
// ---------------------------------------------------------------------------

type Temel = { olusturuldu: string; kumeOlusturuldu: string; satirlar: Satir[] };

const temelVar = existsSync(TEMEL_YOLU);
const temel: Temel | null = temelVar ? JSON.parse(readFileSync(TEMEL_YOLU, "utf8")) : null;
const temelHarita = new Map((temel?.satirlar ?? []).map((s) => [anahtar(s), s]));

console.log("\nTAHMIN MOTORU DEGERLENDIRMESI");
console.log(`Kume: ${kume.gpu.length} GPU + ${kume.cpu.length} CPU olcumu (${kume.olusturuldu})`);
console.log(`Esik: aile kendi bandini ${MIN_FAMILY_FOR_OWN_BAND} olcumden itibaren tasiyor (K156)`);
console.log(
  temel
    ? `Temel: ${TEMEL_YOLU} (${temel.olusturuldu})\n`
    : `Temel YOK — bu kosum temeli olusturacak (--kaydet ile)\n`,
);

console.log("  tur yol               aile                  n   ort     p90     en kotu   temele gore");
const bozulanlar: string[] = [];
const iyilesenler: string[] = [];

for (const s of satirlar) {
  const t = temelHarita.get(anahtar(s));
  let fark = "  (yeni satir)";
  if (t) {
    const d = s.p90 - t.p90;
    if (Math.abs(d) <= TOLERANS) {
      fark = "  =";
    } else if (d > 0) {
      fark = `  BOZULDU p90 +${d.toFixed(1)}`;
      bozulanlar.push(`${anahtar(s)}: p90 ${t.p90} -> ${s.p90}`);
    } else {
      fark = `  iyilesti p90 ${d.toFixed(1)}`;
      iyilesenler.push(`${anahtar(s)}: p90 ${t.p90} -> ${s.p90}`);
    }
  }
  console.log(
    `  ${s.tur} ${s.yol.padEnd(16)} ${s.aile.padEnd(20)} ${String(s.n).padStart(2)}` +
      ` ${s.ortalama.toFixed(1).padStart(6)}  ${s.p90.toFixed(1).padStart(6)}  ${s.enKotu.toFixed(1).padStart(7)}` +
      `${fark}`,
  );
}

// Temelde olup bugün olmayan satır da bir değişikliktir: bir yol sessizce
// kaybolduysa tablo onu göstermeli.
const bugunku = new Set(satirlar.map(anahtar));
const kaybolanlar = [...temelHarita.keys()].filter((k) => !bugunku.has(k));

// --- Veritabanı ne kadar ilerledi? -----------------------------------------
try {
  const guncel = await kumeyiVeritabanindanOku();
  const fark = guncel.gpu.length + guncel.cpu.length - (kume.gpu.length + kume.cpu.length);
  if (fark !== 0) {
    console.log(
      `\nNOT: veritabaninda kumeden ${fark > 0 ? fark + " FAZLA" : -fark + " EKSIK"} olcum var.` +
        ` Kume dondurulmus durumda; tazelemek icin: --guncelle`,
    );
  }
} catch {
  console.log("\nNOT: veritabani okunamadi, kume tazeligi kontrol edilemedi.");
}

// ---------------------------------------------------------------------------
// Sonuç
// ---------------------------------------------------------------------------

if (KAYDET) {
  const yeni: Temel = {
    olusturuldu: new Date().toISOString().slice(0, 10),
    kumeOlusturuldu: kume.olusturuldu,
    satirlar,
  };
  mkdirSync("data/eval", { recursive: true });
  writeFileSync(TEMEL_YOLU, JSON.stringify(yeni, null, 2) + "\n");
  console.log(`\nTEMEL YAZILDI: ${TEMEL_YOLU} (${satirlar.length} satir)`);
  process.exit(0);
}

if (!temel) {
  console.log("\nTemel dosyasi yok. Bugunku tabloyu temel almak icin: --kaydet");
  process.exit(1);
}

console.log();
if (bozulanlar.length === 0 && kaybolanlar.length === 0) {
  const ek = iyilesenler.length > 0 ? ` (${iyilesenler.length} satir IYILESTI — temeli yenilemek icin --kaydet)` : "";
  console.log(`SONUC: regresyon yok, ${satirlar.length} satir temelle ayni.${ek}`);
  for (const i of iyilesenler) console.log(`  + ${i}`);
  process.exit(0);
}

console.log(`SONUC: REGRESYON — ${bozulanlar.length} satir bozuldu, ${kaybolanlar.length} satir kayboldu`);
for (const b of bozulanlar) console.log(`  - ${b}`);
for (const k of kaybolanlar) console.log(`  - KAYIP: ${k}`);
console.log(
  "\nDegisiklik bilincliyse temeli yenile: npm run tahmin:degerlendir -- --kaydet\n" +
    "Yenilemeden once yukaridaki farkin NEDEN oldugunu bir karara yaz.",
);
process.exit(1);
