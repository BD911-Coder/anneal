// Bekleyen migration'lari uygular — ama yalnizca canli dagitimda.
//
// Calistirma: npm run dagitim:migration
//
// Neden ayri bir betik: `prisma migrate deploy` dogrudan build komutunda
// olsaydi, HANGI dagitimin calistirdigina bakmadan calisirdi. Bir onizleme
// dagitimi canli veritabanina baglanabilseydi ona da migration uygulardi ve
// bu geri alinamayan bir islemdir.
//
// Bu koruma, ortam degiskenlerinin Vercel'de sadece Production kapsaminda
// tanimli olmasinin (K46) ikinci katmanidir. Panel ayari degistirilebilir;
// bu dosya depoda durur ve degistirilirse commit'te gorunur.

import { spawnSync } from "node:child_process";

// VERCEL_ENV degerleri: production | preview | development.
// Yerelde tanimsizdir — o zaman kisitlama yok, gelistirici kendi
// veritabanina uygulayabilsin.
const vercelEnv = process.env.VERCEL_ENV;

if (vercelEnv && vercelEnv !== "production") {
  console.log(`Migration uygulanmadi: VERCEL_ENV='${vercelEnv}' (production degil).`);
  console.log("Sema degisikligi yalnizca canli dagitimda uygulanir.");
  process.exit(0); // hata degil, bilincli atlama — derleme devam edebilir
}

console.log(
  vercelEnv
    ? "Canli dagitim: bekleyen migration'lar uygulaniyor."
    : "Yerel calistirma: bekleyen migration'lar uygulaniyor.",
);

const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  shell: true,
});

process.exit(result.status ?? 1);
