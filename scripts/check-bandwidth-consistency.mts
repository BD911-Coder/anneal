// Bant genişliği tutarlılık kontrolü — bütün ekran kartı kataloğu (K171).
//
// Çalıştırma: npm run bant:kontrol
//
// CLAUDE.md'deki çapraz kontrol tersine çevriliyor:
//
//     bant genişliği (GB/s) = veri yolu (bit) × bellek hızı (Gbps) ÷ 8
//     →  bellek hızı = bant genişliği × 8 ÷ veri yolu
//
// Veri yolu katalogda %100 dolu, bant genişliği de öyle. Yani her satır bir
// **örtük bellek hızı** veriyor ve o hız gerçek dünyada var olan bir sayı
// olmak zorunda: 36 Gbps GDDR7 diye bir şey yok.
//
// Bu kontrol bir hatayı yakaladıktan sonra yazıldı: RTX 5060 Ti'da saklanan
// 576 GB/s, 128 bit veri yoluyla **36 Gbps** ima ediyordu. Üç parçada
// görülen bir hata sınıfı, dördüncüde de olabilir — o yüzden tek seferlik
// bakmak yerine script oldu.

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

/**
 * Bellek tipine göre makul hız aralığı — pin başına Gbps.
 *
 * **Bunlar bir KARAR, ölçüm değil.** Aralıklar JEDEC sınıflarının yayınlanmış
 * uçlarından ve piyasadaki ürünlerden alındı, geniş tutuldu: amaç dar bir
 * doğrulama değil, "böyle bir bellek yok" diyebilmek. Sınır ihlali "kesin
 * yanlış" demiyor, "bakılacak" diyor — ve bakıldığında üçünde de yanlış çıktı.
 *
 * Tipi tanınmayan satır ATLANMIYOR, ayrıca raporlanıyor: sessizce geçmek,
 * kapsamı olduğundan geniş gösterirdi.
 */
const HIZ_ARALIGI: Record<string, { alt: number; ust: number }> = {
  GDDR5: { alt: 4, ust: 9 },
  GDDR5X: { alt: 9, ust: 13 },
  GDDR6: { alt: 12, ust: 21 },
  GDDR6X: { alt: 18, ust: 25 },
  "GDDR6/GDDR6X": { alt: 12, ust: 25 },
  GDDR7: { alt: 26, ust: 33 },
  HBM2: { alt: 1.5, ust: 2.5 },
  HBM2E: { alt: 2.4, ust: 3.7 },
};

/** Tip ne olursa olsun bunun dışı fiziksel olarak yok. */
const MUTLAK = { alt: 1, ust: 34 };

const cizgi = (s = "=") => console.log(s.repeat(76));

const cipler = await prisma.gpuSpecs.findMany({
  select: {
    part_id: true,
    vram_type: true,
    vram_gb: true,
    memory_bandwidth_gbs: true,
    bus_width_bits: true,
  },
  orderBy: { part_id: "asc" },
});

// Değerin kaynağı da raporlanıyor: bir tutarsızlık bulunduğunda ilk soru
// "bu sayı nereden geldi" oluyor (K170).
const damgalar = new Map(
  (
    await prisma.specFieldSource.findMany({
      where: { field_name: "memory_bandwidth_gbs" },
      select: { part_id: true, source: true },
    })
  ).map((d) => [d.part_id, d.source]),
);

console.log("BANT GENISLIGI TUTARLILIK KONTROLU");
console.log("ortuk bellek hizi = bant genisligi x 8 / veri yolu\n");

type Bulgu = { partId: string; sebep: string };
const bulgular: Bulgu[] = [];
const tipsiz: string[] = [];
const eksik: string[] = [];
let kontrol = 0;
const tipDagilimi = new Map<string, number[]>();

for (const c of cipler) {
  if (c.memory_bandwidth_gbs === null || c.bus_width_bits === null) {
    eksik.push(`${c.part_id} (${c.memory_bandwidth_gbs === null ? "bant genisligi" : "veri yolu"} yok)`);
    continue;
  }
  kontrol += 1;
  const gbps = Math.round(((c.memory_bandwidth_gbs * 8) / c.bus_width_bits) * 100) / 100;
  tipDagilimi.set(c.vram_type, [...(tipDagilimi.get(c.vram_type) ?? []), gbps]);

  const kaynak = damgalar.get(c.part_id) ?? "damgasiz";
  if (gbps < MUTLAK.alt || gbps > MUTLAK.ust) {
    bulgular.push({
      partId: c.part_id,
      sebep: `${gbps} Gbps — hicbir bellek tipinde yok (mutlak sinir ${MUTLAK.alt}-${MUTLAK.ust}); ` +
        `${c.memory_bandwidth_gbs} GB/s @ ${c.bus_width_bits} bit, kaynak: ${kaynak}`,
    });
    continue;
  }
  const aralik = HIZ_ARALIGI[c.vram_type];
  if (!aralik) {
    tipsiz.push(`${c.part_id} (${c.vram_type}) — ${gbps} Gbps, araligi tanimli degil`);
    continue;
  }
  if (gbps < aralik.alt || gbps > aralik.ust) {
    bulgular.push({
      partId: c.part_id,
      sebep: `${gbps} Gbps — ${c.vram_type} icin beklenen ${aralik.alt}-${aralik.ust}; ` +
        `${c.memory_bandwidth_gbs} GB/s @ ${c.bus_width_bits} bit, kaynak: ${kaynak}`,
    });
  }
}

console.log("BELLEK TIPINE GORE ORTUK HIZ DAGILIMI");
console.log("  tip            cip   ortuk hizlar");
for (const [tip, hizlar] of [...tipDagilimi.entries()].sort((a, b) => b[1].length - a[1].length)) {
  const tekil = [...new Set(hizlar)].sort((a, b) => a - b);
  console.log(`  ${tip.padEnd(14)} ${String(hizlar.length).padStart(3)}   ${tekil.join(" ")}`);
}

if (eksik.length > 0) {
  console.log(`\nKONTROL EDILEMEYEN (alan eksik): ${eksik.length}`);
  for (const e of eksik.slice(0, 10)) console.log(`  ${e}`);
}
if (tipsiz.length > 0) {
  console.log(`\nARALIGI TANIMSIZ BELLEK TIPI: ${tipsiz.length}`);
  for (const t of tipsiz) console.log(`  ${t}`);
}

console.log();
cizgi();
if (bulgular.length === 0) {
  console.log(`SONUC: ${kontrol} cipin tamami tutarli.`);
  await prisma.$disconnect();
  process.exit(0);
}
console.log(`SONUC: ${bulgular.length} TUTARSIZ (${kontrol} cip kontrol edildi)`);
cizgi();
for (const b of bulgular) console.log(`  ${b.partId.padEnd(28)} ${b.sebep}`);
await prisma.$disconnect();
process.exit(1);
