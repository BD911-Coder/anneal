// Üretilen Prisma istemcisi şemayla aynı mı? — `npm run prisma:kontrol`
//
// **Neden var:** `prisma migrate dev` istemciyi her zaman yenilemiyor.
// Yenilenmemiş istemci yeni sütunu tanımaz; `tsc` patlar, ya da daha kötüsü
// patlamaz ve içe aktarma yarım kayıt bırakır. Bu tuzak CLAUDE.md'de yazılı
// olmasına rağmen **üç kez** tetiklendi.
//
// Belgelenmiş ve yine de üç kez tetiklenen bir tuzak, belge sorunu değildir.
//
// ---------------------------------------------------------------------------
// NASIL ÖLÇÜLÜYOR — damga değil, ŞEMANIN KENDİSİ
// ---------------------------------------------------------------------------
//
// Üretilen istemci, üretildiği şemanın tam metnini içinde taşıyor
// (`internal/class.ts` içindeki `inlineSchema`). Karşılaştırma o metinle
// `prisma/schema.prisma` arasında yapılıyor.
//
// Ayrı bir "hash damgası" dosyası tutulmadı bilerek: damga elle
// güncellenebilir ya da unutulabilir, yani yanlış "taze" cevabı verebilir.
// İstemcinin içindeki metin ise istemciyle birlikte üretiliyor — yalan
// söyleyemez.
//
// ---------------------------------------------------------------------------
// İKİ KİP
// ---------------------------------------------------------------------------
//
//   node scripts/check-prisma-client.mjs            bakar, bayatsa DURUR
//   node scripts/check-prisma-client.mjs --duzelt   bayatsa KENDİ ÜRETİR
//
// `pretest`, `prebuild` ve `pretypecheck` bunu `--duzelt` ile çağırıyor: test,
// derleme ve tip kontrolü bayat istemciyle ÇALIŞAMAZ. `kontrol:tumu` ise
// düzeltmesiz çağırıyor — paketin "bayattı ve düzeltildi" durumunu görmesi
// gerekiyor.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const SEMA = "prisma/schema.prisma";
const ISTEMCI = "lib/generated/prisma/internal/class.ts";
const DUZELT = process.argv.includes("--duzelt");

/**
 * Boşluk farkları anlamsız — ve önemli bir ayrıntı var: istemcinin içindeki
 * metin `prisma format` geçmiş hâli, yani sütun hizalamaları farklı
 * (`cuda_core // NVIDIA` yerine `cuda_core          // NVIDIA`). Ölçüldü:
 * aynı şemada 780 satırın 43'ü yalnızca hizalamadan farklı çıkıyor.
 *
 * Bu yüzden satır İÇİNDEKİ boşluk dizileri de tek boşluğa indiriliyor. Alan
 * eklemek ya da çıkarmak yine yakalanıyor; yalnızca hizalama görmezden
 * geliniyor.
 */
const normalize = (s) =>
  s
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .trim();

function uretilenSemayiOku() {
  if (!existsSync(ISTEMCI)) return null;
  const metin = readFileSync(ISTEMCI, "utf8");
  const bas = metin.indexOf('"inlineSchema": "');
  if (bas === -1) return null;
  // Alıntılanmış JSON dizesini kendi kaçışlarıyla birlikte oku ve çöz.
  const alintiBas = bas + '"inlineSchema": '.length;
  let i = alintiBas + 1;
  while (i < metin.length) {
    if (metin[i] === "\\") { i += 2; continue; }
    if (metin[i] === '"') break;
    i += 1;
  }
  try {
    return JSON.parse(metin.slice(alintiBas, i + 1));
  } catch {
    return null;
  }
}

function uret() {
  console.log("Prisma istemcisi yeniden uretiliyor…");
  const r = spawnSync("npx prisma generate", { shell: true, encoding: "utf8" });
  if (r.status !== 0) {
    console.error(`${r.stdout ?? ""}${r.stderr ?? ""}`);
    return false;
  }
  return true;
}

function karsilastir() {
  if (!existsSync(SEMA)) {
    console.error(`HATA: ${SEMA} yok.`);
    process.exit(1);
  }
  const semaMetni = normalize(readFileSync(SEMA, "utf8"));
  const uretilen = uretilenSemayiOku();
  if (uretilen === null) {
    return { taze: false, sebep: "uretilmis istemci bulunamadi ya da okunamadi" };
  }
  if (normalize(uretilen) !== semaMetni) {
    return { taze: false, sebep: "uretilmis istemci semadan FARKLI bir surumden" };
  }
  return { taze: true, sebep: "" };
}

let sonuc = karsilastir();

if (!sonuc.taze && DUZELT) {
  if (!uret()) {
    console.error("SONUC: istemci uretilemedi.");
    process.exit(1);
  }
  sonuc = karsilastir();
  if (sonuc.taze) {
    console.log("Prisma istemcisi BAYATTI ve yeniden uretildi. Devam ediliyor.");
    process.exit(0);
  }
}

if (sonuc.taze) {
  console.log("Prisma istemcisi sema ile ayni surumden.");
  process.exit(0);
}

console.error(
  [
    "",
    "=".repeat(70),
    "PRISMA ISTEMCISI BAYAT",
    "=".repeat(70),
    `  Sebep: ${sonuc.sebep}`,
    "",
    "  Uretilen istemci, prisma/schema.prisma ile ayni surumden degil.",
    "  Bu halde tsc yeni sutunu tanimaz ve ice aktarma yarim kayit birakabilir.",
    "",
    "  Cozum:",
    "    npx prisma generate",
    "",
    "  Ya da otomatik: npm test / npm run build / npm run typecheck",
    "  (ucu de bu kontrolu --duzelt ile calistiriyor)",
    "=".repeat(70),
  ].join("\n"),
);
process.exit(1);
