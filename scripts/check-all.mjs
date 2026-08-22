// Bütün kontroller tek komutta — `npm run kontrol:tumu`.
//
// Neden var: kontroller çoğaldı (bugün on bir tane) ve hangisinin
// çalıştırılacağı akılda tutuluyordu. Akılda tutulan şey unutulur; en son
// unutulan `tahmin:degerlendir` olurdu ve o unutulduğunda model sessizce
// bozulurdu.
//
// Sıra bilinçli: ucuz ve hızlı olan önce, `build` en sonda. Ama hiçbiri
// diğerini DURDURMUYOR — hepsi çalışıyor ve sonunda tek bir özet basılıyor.
// Sebebi: ilk hatada durmak, ikinci hatayı bir sonraki koşuma saklar.
//
// Veritabanı gerektirenler ayrıca işaretli: `DATABASE_URL` yoksa o adımlar
// atlanıyor ve ATLANDI olarak raporlanıyor — sessizce geçmiyor.

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";

for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) loadEnvFile(file);
}

const veritabaniVar = Boolean(process.env.DATABASE_URL);

/** [ad, komut, veritabanı gerekli mi] */
const ADIMLAR = [
  ["lint", "npm run --silent lint", false],
  ["tsc", "npx tsc --noEmit", false],
  ["test", "npm run --silent test", false],
  ["sema:kontrol", "npm run --silent sema:kontrol", false],
  ["dil:kontrol", "npm run --silent dil:kontrol", false],
  ["tahmin:degerlendir", "npm run --silent tahmin:degerlendir", false],
  ["kural:kontrol", "npm run --silent kural:kontrol", true],
  ["varyant:kontrol", "npm run --silent varyant:kontrol", true],
  ["kaynak:kontrol", "npm run --silent kaynak:kontrol", true],
  ["makul:kontrol", "npm run --silent makul:kontrol", true],
  ["build", "npm run --silent build", false],
];

const sonuclar = [];
for (const [ad, komut, dbGerekli] of ADIMLAR) {
  if (dbGerekli && !veritabaniVar) {
    sonuclar.push({ ad, durum: "ATLANDI", not: "DATABASE_URL yok" });
    continue;
  }
  const t0 = Date.now();
  const r = spawnSync(komut, { shell: true, encoding: "utf8" });
  const sure = ((Date.now() - t0) / 1000).toFixed(1);
  const cikti = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  if (r.status === 0) {
    sonuclar.push({ ad, durum: "GECTI", not: `${sure}s` });
  } else {
    sonuclar.push({
      ad,
      durum: "BASARISIZ",
      not: `${sure}s`,
      cikti: cikti.trim().split("\n").slice(-20).join("\n"),
    });
  }
}

console.log("\n" + "=".repeat(70));
console.log("KONTROL OZETI");
console.log("=".repeat(70));
for (const s of sonuclar) {
  console.log(`  ${s.durum.padEnd(10)} ${s.ad.padEnd(22)} ${s.not}`);
}

const basarisiz = sonuclar.filter((s) => s.durum === "BASARISIZ");
if (basarisiz.length > 0) {
  for (const s of basarisiz) {
    console.log(`\n--- ${s.ad} son satirlar ---`);
    console.log(s.cikti);
  }
  console.log(`\nSONUC: ${basarisiz.length} adim BASARISIZ.`);
  process.exit(1);
}
const atlanan = sonuclar.filter((s) => s.durum === "ATLANDI");
console.log(
  `\nSONUC: ${sonuclar.length - atlanan.length} adim gecti` +
    (atlanan.length > 0 ? `, ${atlanan.length} adim atlandi (veritabani yok).` : "."),
);
