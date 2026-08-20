// data/prices/*.csv -> price_snapshots
//
// Calistirma: npm run fiyat:aktar
//
// Iki asamali, SCHEMA.md bolum 0 kural 3 geregi: her satir once raw_imports'a
// ham haliyle yazilir, sonra normalize edilir.
//
// price_snapshots APPEND-ONLY (K1): UPDATE yazilmaz. Ayni parcanin ayni
// gunku fiyati ikinci kez gelirse ATLANIR — yoksa her calistirma tabloyu
// sisirirdi ve "guncel fiyat = en son collected_at" tanimi bozulurdu.
//
// Fiyat integer (kurus). CSV dolar tasir, cevrim burada yapilir; float
// veritabanina hic girmez.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { loadEnvFile } from "node:process";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../lib/generated/prisma/client.ts";

for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) loadEnvFile(file);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL tanimli degil.");
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg(connectionString) });

const DIR = "data/prices";
const CURRENCY = "USD";

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split("\n").map((l) => l.replace(/\r$/, "")).filter((l) => l.trim() !== "");
  const header = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(",");
    const row: Record<string, string> = {};
    header.forEach((h, n) => (row[h] = (cells[n] ?? "").trim()));
    return row;
  });
}

/** Dolar metni -> kurus. Float'a hic gecilmiyor: nokta ikiye bolunuyor. */
function toMinor(usd: string): number {
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(usd);
  if (!m) throw new Error(`fiyat okunamadi: "${usd}"`);
  const cents = (m[2] ?? "0").padEnd(2, "0");
  return Number(m[1]) * 100 + Number(cents);
}

/**
 * K96: pazaryeri fiyati, ayni cipin en ucuz MAGAZA fiyatinin 2 katini gecerse
 * alinmaz. Iki kati asan sayi fiyat degil spekulasyondur.
 *
 * Tavan CSV'nin kendisinden hesaplaniyor: ayni dosyada o cipin magaza satisli
 * (seller == retailer) kartlari varsa en ucuzu tavani belirler. Magaza satisli
 * hic kart yoksa tavan yok ve satir ELENIR — sinirsiz kabul etmektense
 * atlamak dogru.
 */
async function magazaTavani(
  chipId: string | null,
  hepsi: Record<string, string>[],
): Promise<number | null> {
  if (!chipId) return null;
  const kardesler = hepsi.filter((r) => r.seller === r.retailer);
  let enUcuz: number | null = null;
  for (const r of kardesler) {
    const v = await prisma.gpuVariantSpecs.findUnique({ where: { part_id: r.part_id } });
    if (v?.chip_part_id !== chipId) continue;
    const m = toMinor(r.price_usd);
    if (enUcuz === null || m < enUcuz) enUcuz = m;
  }
  return enUcuz;
}

let yeni = 0;
let atlanan = 0;
let hatali = 0;
let elenen = 0;

for (const file of readdirSync(DIR).filter((f) => f.endsWith(".csv")).sort()) {
  const rows = parseCsv(readFileSync(`${DIR}/${file}`, "utf8"));
  console.log(`\n${file} — ${rows.length} satir`);

  for (const row of rows) {
    const raw = await prisma.rawImport.create({
      data: { source: `prices/${file}`, payload: row, imported_at: new Date(), status: "pending" },
    });

    try {
      const part = await prisma.part.findUnique({ where: { id: row.part_id } });
      if (!part) throw new Error(`katalogda yok: ${row.part_id}`);

      // K116: cip satirinin fiyati bir kartindan okunur ve o kart kayitli olur.
      if (row.reference_part_id) {
        const ref = await prisma.gpuVariantSpecs.findUnique({
          where: { part_id: row.reference_part_id },
        });
        if (!ref) throw new Error(`referans kart yok: ${row.reference_part_id}`);
        if (ref.chip_part_id !== row.part_id) {
          throw new Error(
            `referans kart bu cipin degil: ${row.reference_part_id} -> ${ref.chip_part_id}`,
          );
        }
      }

      // K96: pazaryeri tavani. Yalnizca kart satirlarina uygulanir — cip
      // satirlarinin fiyati zaten magaza satisli bir karttan okunuyor.
      if (row.seller && row.seller !== row.retailer) {
        const variant = await prisma.gpuVariantSpecs.findUnique({
          where: { part_id: row.part_id },
        });
        const tavan = await magazaTavani(variant?.chip_part_id ?? null, rows);
        const fiyat = toMinor(row.price_usd);
        if (tavan === null || fiyat > tavan * 2) {
          elenen++;
          const sebep =
            tavan === null
              ? "pazaryeri satirI, ayni cipin magaza fiyati yok — tavan hesaplanamiyor"
              : `pazaryeri fiyati magaza tavanInIn 2 katInI asIyor (${fiyat} > ${tavan * 2})`;
          console.log(`  [ELE ] ${row.part_id} — ${sebep}`);
          await prisma.rawImport.update({
            where: { id: raw.id },
            data: { status: "failed", error: sebep },
          });
          continue;
        }
      }

      const collectedAt = new Date(`${row.collected_at}T00:00:00Z`);
      if (Number.isNaN(collectedAt.getTime())) throw new Error(`tarih okunamadi: ${row.collected_at}`);

      // Append-only: ayni parca + ayni gun ikinci kez yazilmaz.
      const varMi = await prisma.priceSnapshot.findFirst({
        where: { part_id: row.part_id, collected_at: collectedAt },
      });
      if (varMi) {
        atlanan++;
        console.log(`  [ATLA] ${row.part_id} — bu tarihte fiyat zaten var`);
        await prisma.rawImport.update({
          where: { id: raw.id },
          data: { status: "processed", error: "ayni gun fiyat var, append-only" },
        });
        continue;
      }

      await prisma.priceSnapshot.create({
        data: {
          part_id: row.part_id,
          retailer: row.retailer,
          price_minor: toMinor(row.price_usd),
          currency: CURRENCY,
          in_stock: row.in_stock === "" ? null : row.in_stock === "true",
          product_url: row.product_url,
          source: "manual",
          source_url: row.product_url,
          confidence: row.confidence as "high" | "medium" | "low",
          collected_at: collectedAt,
        },
      });
      yeni++;
      const satici = row.seller && row.seller !== row.retailer ? ` (satici: ${row.seller})` : "";
      console.log(`  [YENI] ${row.part_id} — $${row.price_usd}${satici}`);
      await prisma.rawImport.update({ where: { id: raw.id }, data: { status: "processed" } });
    } catch (err) {
      hatali++;
      console.error(`  [HATA] ${row.part_id}: ${(err as Error).message}`);
      await prisma.rawImport.update({
        where: { id: raw.id },
        data: { status: "failed", error: (err as Error).message },
      });
    }
  }
}

const fiyatli = (await prisma.priceSnapshot.groupBy({
  by: ["part_id"],
  where: { source: "manual" },
})).length;

console.log(`\nOZET: ${yeni} yeni, ${atlanan} atlandi, ${elenen} elendi (K96), ${hatali} hata.`);
console.log(`Gercek fiyati olan parca: ${fiyatli}`);

await prisma.$disconnect();
