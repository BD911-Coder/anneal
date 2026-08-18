import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";

import { defineConfig, env } from "prisma/config";

// Prisma 7'de veritabanı bağlantı adresi şema dosyasında değil burada tutulur.
//
// .env dosyasını Node'un yerleşik okuyucusuyla yüklüyoruz; ek paket (dotenv)
// gerekmesin diye. Canlı ortamda .env dosyası olmaz, değişkenler platformdan
// gelir — bu yüzden dosya varsa yükleniyor.
if (existsSync(".env")) {
  loadEnvFile(".env");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
});
