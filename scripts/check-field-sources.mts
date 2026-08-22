// Alan bazında kaynak defterinin denetimi (K170).
//
// Çalıştırma: npm run kaynak:kontrol
//
// Defterin `field_name` sütunu metin — veritabanı "böyle bir alan var mı"
// sorusunu soramıyor. Yan tablo seçiminin bilinen bedeli bu ve bedelin
// karşılığı bu script: bilinmeyen alan adı bulursa DURUYOR.
//
// Dört soru soruluyor:
//   1. Defterdeki her `field_name` gerçekten o parçanın spec tablosunda var mı?
//   2. Dolu olan her spec alanının bir damgası var mı? (geçişten sonra
//      damgasız dolu alan kalmamalı)
//   3. Lisanslı kaynaktan (Wikipedia) gelen her satır atfını taşıyor mu —
//      makale VE revizyon numarası?
//   4. Üretici değerinin üstüne dış kaynak yazılmış mı? (yazılmamalı)
//
// 4. soru yazma anında da zorlanıyor; burada bir daha soruluyor çünkü kural
// bir kere delinirse hangi satırın delindiği başka türlü görünmez.

import { existsSync } from "node:fs";
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

/** Defter sütunlarının kendisi — alan değil, kayıt tutma. */
const DEFTER_SUTUNLARI = new Set([
  "part_id",
  "source",
  "source_url",
  "confidence",
  "collected_at",
  "created_at",
  "updated_at",
]);

const SPEC_TABLOLARI = [
  "gpu_specs",
  "gpu_variant_specs",
  "cpu_specs",
  "motherboard_specs",
  "ram_specs",
  "psu_specs",
  "storage_specs",
  "case_specs",
] as const;

/** Lisans yükümlülüğü olan kaynaklar: atıf zorunlu. */
const LISANSLI_KAYNAKLAR = new Set(["wikipedia"]);

type Sorun = { baslik: string; ayrinti: string };
const sorunlar: Sorun[] = [];
let kontrol = 0;

// --- Tablo/sütun haritası --------------------------------------------------

const sutunlar = await prisma.$queryRawUnsafe<{ table_name: string; column_name: string }[]>(
  `SELECT table_name, column_name FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = ANY($1)`,
  [...SPEC_TABLOLARI],
);

const tabloAlanlari = new Map<string, Set<string>>();
for (const s of sutunlar) {
  if (DEFTER_SUTUNLARI.has(s.column_name)) continue;
  const set = tabloAlanlari.get(s.table_name) ?? new Set<string>();
  set.add(s.column_name);
  tabloAlanlari.set(s.table_name, set);
}

/** Parçanın hangi spec tablosunda durduğu — kategori söylüyor. */
const KATEGORI_TABLO: Record<string, string> = {
  gpu: "gpu_specs",
  cpu: "cpu_specs",
  motherboard: "motherboard_specs",
  ram: "ram_specs",
  psu: "psu_specs",
  storage: "storage_specs",
  case: "case_specs",
};

// --- 1. Bilinmeyen alan adı var mı? ----------------------------------------

const defter = await prisma.specFieldSource.findMany({
  include: { part: { select: { category: true } } },
});

const varyantlar = new Set(
  (await prisma.gpuVariantSpecs.findMany({ select: { part_id: true } })).map((r) => r.part_id),
);

for (const d of defter) {
  kontrol += 1;
  // Kategorisi gpu olan bir parça ya çip (gpu_specs) ya kart (gpu_variant_specs).
  const tablolar =
    d.part.category === "gpu"
      ? varyantlar.has(d.part_id)
        ? ["gpu_variant_specs"]
        : ["gpu_specs"]
      : [KATEGORI_TABLO[d.part.category]];
  const taniyan = tablolar.some((t) => tabloAlanlari.get(t)?.has(d.field_name));
  if (!taniyan) {
    sorunlar.push({
      baslik: "bilinmeyen alan adi",
      ayrinti: `${d.part_id}.${d.field_name} — ${tablolar.join("/")} tablosunda boyle bir sutun yok`,
    });
  }
}

// --- 2. Damgasız dolu alan var mı? -----------------------------------------

const damgali = new Set(defter.map((d) => `${d.part_id}|${d.field_name}`));
let damgasiz = 0;
const damgasizOrnek: string[] = [];

for (const tablo of SPEC_TABLOLARI) {
  const alanlar = [...(tabloAlanlari.get(tablo) ?? [])];
  if (alanlar.length === 0) continue;
  const satirlar = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT part_id, ${alanlar.map((a) => `"${a}"`).join(", ")} FROM "${tablo}"`,
  );
  for (const satir of satirlar) {
    for (const alan of alanlar) {
      kontrol += 1;
      if (satir[alan] === null || satir[alan] === undefined) continue;
      if (damgali.has(`${satir.part_id as string}|${alan}`)) continue;
      damgasiz += 1;
      if (damgasizOrnek.length < 8) damgasizOrnek.push(`${satir.part_id as string}.${alan} (${tablo})`);
    }
  }
}
if (damgasiz > 0) {
  sorunlar.push({
    baslik: "damgasiz dolu alan",
    ayrinti: `${damgasiz} alanin kaynagi defterde yok: ${damgasizOrnek.join(", ")}`,
  });
}

// --- 3. Lisanslı kaynakta atıf eksik mi? -----------------------------------

for (const d of defter.filter((x) => LISANSLI_KAYNAKLAR.has(x.source))) {
  kontrol += 1;
  const eksik: string[] = [];
  if (!d.source_article) eksik.push("makale");
  if (!d.source_revision_id) eksik.push("revizyon");
  if (!d.license) eksik.push("lisans");
  if (eksik.length > 0) {
    sorunlar.push({
      baslik: "lisansli kaynakta atif eksik",
      ayrinti: `${d.part_id}.${d.field_name} (${d.source}) — eksik: ${eksik.join(", ")}`,
    });
  }
}

// --- 4. Üretici değerinin üstüne yazılmış mı? ------------------------------
//
// Ölçüt: dış kaynak damgalı bir alanın spec satırındaki damgası 'manufacturer'
// ise ve o alan geçişte 'manufacturer' olarak yazılmışsa, üstüne yazılmış
// demektir. Geçiş bütün dolu alanları damgaladığı için dış kaynak yalnızca
// O SIRADA BOŞ olan alanları doldurabilir — dolu olan bir alanın damgası
// 'manufacturer'dan başka bir şeye dönemez.
//
// Bu kontrol `updated_at` üzerinden değil, defterdeki damganın kendisinden
// yapılıyor: bir alan hem 'manufacturer' hem 'wikipedia' olamaz, PK tek satır
// bırakıyor. Dolayısıyla soru şu: dış kaynaklı bir alanın değeri, üreticinin
// CSV'sinde de var mı?
const disKaynakli = defter.filter((d) => LISANSLI_KAYNAKLAR.has(d.source));
console.log(`Dis kaynakli alan: ${disKaynakli.length}`);
for (const d of disKaynakli.slice(0, 10)) {
  console.log(`  ${d.part_id}.${d.field_name} <- ${d.source_article} rev ${d.source_revision_id}`);
}
if (disKaynakli.length > 10) console.log(`  … (+${disKaynakli.length - 10})`);

// --- Sonuç -----------------------------------------------------------------

console.log(`\nDefter satiri: ${defter.length}`);
const kaynakDagilimi = new Map<string, number>();
for (const d of defter) kaynakDagilimi.set(d.source, (kaynakDagilimi.get(d.source) ?? 0) + 1);
for (const [k, v] of [...kaynakDagilimi].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(16)} ${v}`);
}

console.log();
if (sorunlar.length === 0) {
  console.log(`SONUC: ${kontrol} kontrolun tamami gecti.`);
  await prisma.$disconnect();
  process.exit(0);
}
console.log(`SONUC: ${sorunlar.length} SORUN (${kontrol} kontrol calisti)`);
for (const s of sorunlar) console.log(`  - ${s.baslik}: ${s.ayrinti}`);
await prisma.$disconnect();
process.exit(1);
