import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";

import { defineConfig, env } from "prisma/config";

// Prisma 7'de veritabanı bağlantı adresi şema dosyasında değil burada tutulur.
//
// .env.local dosyasını Node'un yerleşik okuyucusuyla yüklüyoruz; ek paket
// (dotenv) gerekmesin diye. Canlı ortamda dosya olmaz, değişkenler platformdan
// gelir — bu yüzden dosya varsa yükleniyor.
for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) loadEnvFile(file);
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    // Migration'lar DIRECT_URL kullanır: şema değişikliği havuzlanmış
    // (pgbouncer) bağlantı üzerinden güvenilir çalışmaz.
    // Uygulamanın çalışma anındaki bağlantısı DATABASE_URL'dir, o data/client.ts'te.
    url: env("DIRECT_URL"),
  },
});
