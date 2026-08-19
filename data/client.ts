import { PrismaPg } from "@prisma/adapter-pg";

// Göreli yol, `@/` takma adı değil: takma adı yalnızca Next'in derleyicisi
// çözüyor, çıplak Node çözemiyor. Bu satır takma adla yazıldığında /data
// katmanının tamamı script'lerden içe aktarılamaz hale geliyor ve dev-seed
// filtresi ancak kopyalanarak sınanabiliyordu. `.ts` uzantısı Node ESM için
// gerekli; tsconfig'te `allowImportingTsExtensions` zaten açık.
import { PrismaClient } from "../lib/generated/prisma/client.ts";

// Veritabanına erişen tek nokta. /engine burayı tanımaz, tanımamalıdır.
//
// Prisma 7 doğrudan bağlanmaz, bir sürücü adaptörü ister. Uygulama çalışma
// anında havuzlanmış bağlantıyı (DATABASE_URL) kullanır; migration'lar ise
// doğrudan bağlantıyı kullanır ve onlar prisma.config.ts'ten okur.

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL tanımlı değil. .env.local dosyasını .env.example'a bakarak doldurun.",
  );
}

const adapter = new PrismaPg(connectionString);

// Geliştirmede Next.js modülleri yeniden yüklediği için her seferinde yeni bir
// istemci açılır ve bağlantılar birikir. Global üzerinde tek örnek tutuyoruz.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
