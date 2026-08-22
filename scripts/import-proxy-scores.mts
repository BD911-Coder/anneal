// Elle toplanan vekil skorların içe aktarımı — `npm run vekil:aktar`
//
// Kaynak: `data/proxy/openbenchmarking.csv`, insan tarafından doldurulmuş.
//
// ---------------------------------------------------------------------------
// NEDEN ELLE
// ---------------------------------------------------------------------------
//
// OpenBenchmarking `robots.txt` dosyası `ClaudeBot`'u yasaklıyor (K173). Yasak
// otomatik ajana bakıyor; tarayıcısında sayfayı okuyan insana değil. Toplama
// insanda, çözümleme burada.
//
// ---------------------------------------------------------------------------
// NEREYE YAZIYOR
// ---------------------------------------------------------------------------
//
// **Yalnızca `raw_imports`.** Vekil skorlar için ayrı bir tablo AÇILMADI ve
// bu bilinçli: vekilin işe yarayıp yaramadığı henüz bilinmiyor
// (`npm run vekil:analiz` cevaplayacak). Kullanılmayacağı ortaya çıkabilecek
// bir veri için tablo açmak, K56'nın "hangi kural bunu kullanıyor" ölçütünü
// baştan çiğnemek olurdu.
//
// Ham katman kuralı yine de işliyor: her dış veri önce `raw_imports`
// (SCHEMA.md bölüm 0, kural 3). `raw_imports.source` serbest metindir (K6) ve
// her satır `openbenchmarking:<profil>` damgasını taşıyor — `manufacturer` ve
// `wikipedia` damgalarından ayrı.
//
// Vekil işe yararsa sıradaki adım tipli bir tablo ve `Source` enum'una yeni
// bir değer; o zaman gerekçesi de olur.

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

// --- Çalıştırma -------------------------------------------------------------

// Sinama icin baska bir dosya verilebilir: --dosya=<yol>. Varsayilan sablon.
const dosya = process.argv.find((a) => a.startsWith("--dosya="))?.split("=")[1] ?? PROXY_CSV;
const { satirlar, bos, hatalar } = vekilSatirlariOku(dosya);

console.log("VEKIL SKOR ICE AKTARIMI");
console.log(`Kaynak: ${PROXY_CSV}\n`);
console.log(`  Dolu satir     : ${satirlar.length}`);
console.log(`  Bos satir      : ${bos.length}${bos.length > 0 ? ` (${bos.join(", ")})` : ""}`);
console.log(`  Hatali satir   : ${hatalar.length}`);
for (const h of hatalar) console.log(`    ${h}`);

if (hatalar.length > 0) {
  console.log("\nHatali satir var: hicbir sey yazilmadi. Duzeltip tekrar calistir.");
  await prisma.$disconnect();
  process.exit(1);
}

if (satirlar.length === 0) {
  console.log("\nDoldurulmus satir yok. Yazacak bir sey yok — sablon hazir bekliyor.");
  console.log(`Nasil doldurulacagi: data/proxy/README.md`);
  await prisma.$disconnect();
  process.exit(0);
}

// Katalogda olmayan bir slug'a skor yazılmaz.
const bilinen = new Set((await prisma.gpuSpecs.findMany({ select: { part_id: true } })).map((r) => r.part_id));
const tanimsiz = satirlar.filter((s) => !bilinen.has(s.part_id));
if (tanimsiz.length > 0) {
  console.log(`\nKatalogda olmayan slug: ${tanimsiz.map((t) => t.part_id).join(", ")} — yazilmadi.`);
  await prisma.$disconnect();
  process.exit(1);
}

// Profil başına bir ham kayıt: "hangi profilden hangi gün ne aldık" sorusu
// satır satır değil, toplu olarak sorulur.
const profiller = [...new Set(satirlar.map((s) => s.test_profile))];
const imported_at = new Date();
for (const profil of profiller) {
  const kume = satirlar.filter((s) => s.test_profile === profil);
  await prisma.rawImport.create({
    data: {
      source: `openbenchmarking:${profil}`,
      payload: {
        collection: "manual",
        reason: "robots.txt ClaudeBot'u yasakliyor; toplama insan tarafindan yapildi (K173)",
        profile: profil,
        rows: kume,
      },
      imported_at,
      status: "processed",
    },
  });
  console.log(`  raw_imports <- openbenchmarking:${profil} (${kume.length} satir)`);
}

console.log("\nHam veri yazildi. Cozumleme: npm run vekil:analiz");
console.log("NOT: vekil skorlar icin tipli tablo YOK — vekilin ise yarayip");
console.log("yaramadigi olculmeden acilmayacak.");

await prisma.$disconnect();
