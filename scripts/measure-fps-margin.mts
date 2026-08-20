// Oyun bazli FPS tahmininin hata payini olcer ve kaydeder (K79, K110).
//
// Calistirma: npm run fps:sapma
//
// Yontem: BIRINI DISARIDA BIRAK. Her olcum, kendi verisi orana katilmadan
// aynı oyunun diger olcumlerinden tahmin edilir ve gercek degeriyle
// karsilastirilir. Tahmin edilen noktanin kendisi orana katilsaydi olculen
// sey modelin dogrulugu degil, kendi verisini ezberlemesi olurdu.
//
// Cikti lib/fps-margin.ts'teki ISARETLI BLOGA script tarafindan YAZILIR;
// blok disindaki gerekce elle yaziliyor ve script ona dokunmuyor.
//
// Motor burada da veritabanini tanimiyor: gruplar /data uzerinden okunuyor,
// oran motorun kendi `ratioFor` fonksiyonuyla hesaplaniyor. Yani olculen sey
// arayuzun kullandigi yolun aynisi.

import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../lib/generated/prisma/client.ts";
import { ratioFor } from "../engine/fps-estimate.ts";
import { MODEL_VERSION } from "../engine/performance.ts";
import { bir, blokYaz, bugun } from "./margin-file.mts";

for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) loadEnvFile(file);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL tanimli degil.");
  process.exit(1);
}

// /data/client.ts baglantiyi ICE AKTARMA ANINDA kuruyor; ustteki loadEnvFile
// calismadan once ice aktarilirsa "DATABASE_URL tanimli degil" ile patliyor.
// Bu yuzden dinamik ice aktarma.
const { getFpsGameGroups } = await import("../data/benchmarks.ts");

const prisma = new PrismaClient({ adapter: new PrismaPg(connectionString) });

/** Bu esigin ustunde yayin durur — indeks sapmasindaki (K80) esikle ayni. */
const ESIK = 25;

const gruplar = await getFpsGameGroups(MODEL_VERSION);
const toplamOlcum = gruplar.reduce((t, g) => t + g.measurements.length, 0);
console.log(`grup: ${gruplar.length}   olcum: ${toplamOlcum}`);

const hatalar: number[] = [];
for (const grup of gruplar) {
  for (const m of grup.measurements) {
    if (m.index === undefined) continue;
    // Tahmin edilen noktanin KENDISI disarida.
    const digerleri = grup.measurements.filter((o) => o.part_id !== m.part_id);
    const oran = ratioFor(digerleri);
    if (oran === null) continue; // grup tek nokta eksiginde cok seyreklesti
    hatalar.push(Math.abs(m.index * oran - m.avg_fps) / m.avg_fps);
  }
}

if (hatalar.length === 0) {
  console.error("Olculebilir nokta yok — lib/fps-margin.ts yazilmadi.");
  await prisma.$disconnect();
  process.exit(1);
}

hatalar.sort((a, b) => a - b);
const dilim = (q: number) => hatalar[Math.floor(hatalar.length * q)] * 100;
const ort = (hatalar.reduce((t, v) => t + v, 0) / hatalar.length) * 100;
const enb = hatalar[hatalar.length - 1] * 100;
const icinde10 = Math.round((hatalar.filter((e) => e < 0.1).length / hatalar.length) * 100);

console.log(`\nBIRINI DISARIDA BIRAK — ${hatalar.length} nokta`);
console.log(`  ortalama mutlak hata  %${bir(ort)}`);
console.log(`  medyan                %${bir(dilim(0.5))}`);
console.log(`  %90 dilim             %${bir(dilim(0.9))}`);
console.log(`  en kotu               %${bir(enb)}`);
console.log(`  +-%10 icinde          %${icinde10}`);
console.log(`\nEsik %${ESIK} (ortalama): ${ort <= ESIK ? "GECTI" : "ASILDI"}`);

// Esik asildiysa dosya YAZILMAZ (indeks:sapma ile ayni kural): yayinlanmayacak
// bir sayiyi arayuzun okudugu yere islemek yaniltici olurdu.
if (ort > ESIK) {
  console.error("\nEsik asildi — lib/fps-margin.ts yazilmadi.");
  await prisma.$disconnect();
  process.exit(1);
}

const noktaSayisi = await prisma.benchmarkPoint.count({ where: { source: { not: "dev_seed" } } });

blokYaz("lib/fps-margin.ts", [
  "/** Ortalama mutlak hata. */",
  `meanPercent: ${bir(ort)},`,
  "/** Tahminlerin %90'ı bu hatanın altında. */",
  `p90Percent: ${bir(dilim(0.9))},`,
  "/** En kötü tek nokta. Gizlenmiyor: %90 dilimin dışı da gerçek. */",
  `maxPercent: ${bir(enb)},`,
  "/** Tahminlerin yüzde kaçı ±%10 içinde kaldı. */",
  `within10Percent: ${icinde10},`,
  "/** Ölçümde kullanılan nokta sayısı (türetilebilir hücreler). */",
  `points: ${hatalar.length},`,
  "/** Ölçüm anındaki `benchmark_points` satır sayısı — eskime kontrolü (K110). */",
  `measuredAtPoints: ${noktaSayisi},`,
  `measuredAt: "${bugun()}",`,
]);
console.log(`\nlib/fps-margin.ts yazildi: meanPercent ${bir(ort)}, p90 ${bir(dilim(0.9))}, ` +
  `maxPercent ${bir(enb)}, points ${hatalar.length}, measuredAtPoints ${noktaSayisi}.`);

await prisma.$disconnect();
