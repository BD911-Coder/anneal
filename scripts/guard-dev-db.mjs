// Sahte veri yazan ya da veri silen script'ler icin ortak koruma.
//
// K94: bu script'ler YALNIZCA .env.local'in gosterdigi veritabaninda calisir.
//
// Neden gerekliydi: eski koruma DEV_SEED_ALLOWED bayragina bakiyordu ve o
// bayrak .env.local'den geliyor. Node'un loadEnvFile'i ORTAMDAN gelen degeri
// EZMEZ, dosyadan geleni ezer. Yani:
//
//     DATABASE_URL='<canli>' npm run db:seed
//
// komutunda DATABASE_URL kabuktan (canli), DEV_SEED_ALLOWED dosyadan ('true')
// geliyordu. Eski koruma "burasi bir gelistirme makinesi" diye gecirip canli
// veritabanina dev-seed yaziyordu. Bayrak makineyi tarif ediyordu, HEDEFI degil.
//
// Yeni koruma hedefe bakiyor: baglanilacak adres, .env.local'de yazan adresle
// birebir ayni degilse script calismaz.

import { existsSync, readFileSync } from "node:fs";

/**
 * .env.local icindeki DATABASE_URL'i okur. Dosya yoksa ya da anahtar yoksa
 * null doner — o zaman karsilastirilacak bir sey yok ve script reddedilir.
 */
function envLocalUrl() {
  if (!existsSync(".env.local")) return null;
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = /^\s*DATABASE_URL\s*=\s*(.*)\s*$/.exec(line);
    if (!m) continue;
    // Tirnak icinde yazilmis olabilir.
    return m[1].trim().replace(/^["']|["']$/g, "");
  }
  return null;
}

/** Parolayi ciktiya sizdirmadan adresi ozetler. */
function ozet(url) {
  if (!url) return "(yok)";
  try {
    const u = new URL(url);
    return `${u.hostname}${u.pathname}`;
  } catch {
    return "(adres cozumlenemedi)";
  }
}

/**
 * Hedef veritabani gelistirme veritabani degilse script'i durdurur.
 *
 * @param {string} scriptAdi Hata metninde gorunecek ad.
 * @param {string} neYapar   "sahte veri uretir" / "veri siler" gibi.
 */
export function sadeceGelistirmeVeritabani(scriptAdi, neYapar) {
  const reasons = [];

  if (process.env.NODE_ENV === "production") reasons.push("NODE_ENV=production");
  if (process.env.VERCEL_ENV === "production") reasons.push("VERCEL_ENV=production");
  if (process.env.DEV_SEED_ALLOWED !== "true") {
    reasons.push("DEV_SEED_ALLOWED bayragi 'true' degil");
  }

  // Asil koruma: hedef adres .env.local'dekiyle ayni mi?
  const hedef = process.env.DATABASE_URL;
  const yerel = envLocalUrl();

  if (!hedef) {
    reasons.push("DATABASE_URL tanimli degil — hangi veritabani oldugu bilinmiyor");
  } else if (!yerel) {
    reasons.push(".env.local'de DATABASE_URL yok — hedef dogrulanamiyor");
  } else if (hedef !== yerel) {
    reasons.push(
      `hedef .env.local'deki veritabani DEGIL ` +
        `(hedef: ${ozet(hedef)}, .env.local: ${ozet(yerel)})`,
    );
  }

  if (reasons.length > 0) {
    console.error(`${scriptAdi} calistirilmadi. Sebep:`);
    for (const r of reasons) console.error(`  - ${r}`);
    console.error(`\nBu script ${neYapar} ve yalnizca gelistirme veritabaninda calisir (K94).`);
    process.exit(1);
  }
}
