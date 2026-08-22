// Fiziksel makullük denetimi — iki değerin birbirini kısıtladığı her yer.
//
// Çalıştırma: npm run makul:kontrol
//
// **Neden var:** RTX 5060 Ti'da saklanan 576 GB/s, 128 bit veri yoluyla
// 36 Gbps bellek ima ediyordu ve öyle bir bellek yok (K171). O hata tek bir
// alana bakarak görünmüyordu; **iki alanın birbiriyle çelişmesinden** çıktı.
//
// Aynı desen katalogda başka yerlerde de var: bir kartın belleği veri yoluna
// bölünebilmeli, önerilen güç kaynağı TDP'den küçük olamaz, aynı mimarideki
// iki çipin transistör/çekirdek oranı birbirinden kat kat ayrılamaz.
//
// Bu script o kısıtları tek yerde topluyor. Her ihlal, onu işaretleyen
// GEREKÇEYLE birlikte basılıyor: "şu sayı şu sayıyla şöyle çelişiyor".
//
// ---------------------------------------------------------------------------
// NE YAPMAZ
// ---------------------------------------------------------------------------
//
// Bu bir doğruluk kontrolü DEĞİL. Makul bir değer yanlış olabilir; imkânsız
// bir değer kesin yanlıştır. Script yalnızca ikincisini yakalar. RTX 5060'ın
// eski 480 GB/s değeri (30 Gbps) bu denetimden GEÇERDİ — onu dış kaynakla
// karşılaştırma yakaladı (K171).
//
// Eşikler ve aralıklar BİRER KARAR, ölçüm değil. Geniş tutuldular: amaç dar
// bir doğrulama değil, "böyle bir şey yok" diyebilmek.

import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";

import { PrismaPg } from "@prisma/adapter-pg";

import { KURULAMAYAN_KISITLAR, makulluk } from "../lib/plausibility.ts";
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

const cizgi = (s = "=") => console.log(s.repeat(78));

// Kurallar bu dosyada DEGIL: lib/plausibility.ts icinde, cunku ayni kurallar
// /veri panosunda da okunuyor (K177). Script'in isi veriyi getirmek ve
// sonucu basmak.
const [gpuSpecs, kartlar, cpuSpecs, ramler, psuler, kasalar, anakartlar, depolamalar] = await Promise.all([
  prisma.gpuSpecs.findMany({ include: { part: { select: { brand: true } } }, orderBy: { part_id: "asc" } }),
  prisma.gpuVariantSpecs.findMany({
    include: { chip: { select: { gpu_specs: { select: { tdp_watt: true, boost_clock_mhz: true } } } } },
    orderBy: { part_id: "asc" },
  }),
  prisma.cpuSpecs.findMany({ orderBy: { part_id: "asc" } }),
  prisma.ramSpecs.findMany({ orderBy: { part_id: "asc" } }),
  prisma.psuSpecs.findMany({ orderBy: { part_id: "asc" } }),
  prisma.caseSpecs.findMany({ orderBy: { part_id: "asc" } }),
  prisma.motherboardSpecs.findMany({ orderBy: { part_id: "asc" } }),
  prisma.storageSpecs.findMany({ orderBy: { part_id: "asc" } }),
]);

const { ihlaller, kontrol, calisamayan } = makulluk({
  cipler: gpuSpecs.map((g) => ({
    part_id: g.part_id,
    brand: g.part.brand,
    vram_gb: g.vram_gb,
    vram_type: g.vram_type,
    tdp_watt: g.tdp_watt,
    recommended_psu_watt: g.recommended_psu_watt,
    shader_units: g.shader_units,
    shader_unit_type: g.shader_unit_type,
    boost_clock_mhz: g.boost_clock_mhz,
    memory_bandwidth_gbs: g.memory_bandwidth_gbs,
    bus_width_bits: g.bus_width_bits,
    architecture_family: g.architecture_family,
    transistor_count_m: g.transistor_count_m,
  })),
  kartlar: kartlar.map((k) => ({
    part_id: k.part_id,
    tbp_watt: k.tbp_watt,
    boost_clock_mhz: k.boost_clock_mhz,
    boost_clock_oc_mhz: k.boost_clock_oc_mhz,
    length_mm: k.length_mm,
    thickness_slots: k.thickness_slots,
    cipTdp: k.chip.gpu_specs?.tdp_watt ?? null,
    cipBoost: k.chip.gpu_specs?.boost_clock_mhz ?? null,
  })),
  islemciler: cpuSpecs.map((c) => ({
    part_id: c.part_id,
    cores: c.cores,
    threads: c.threads,
    base_clock_mhz: c.base_clock_mhz,
    boost_clock_mhz: c.boost_clock_mhz,
    l3_cache_mb: c.l3_cache_mb,
  })),
  ramler: ramler.map((r) => ({
    part_id: r.part_id,
    memory_type: r.memory_type,
    capacity_gb: r.capacity_gb,
    module_count: r.module_count,
    speed_mhz: r.speed_mhz,
    cas_latency: r.cas_latency,
  })),
  psuler: psuler.map((p) => ({ part_id: p.part_id, wattage: p.wattage, length_mm: p.length_mm })),
  kasalar: kasalar.map((k) => ({
    part_id: k.part_id,
    max_gpu_length_mm: k.max_gpu_length_mm,
    max_cpu_cooler_height_mm: k.max_cpu_cooler_height_mm,
    max_psu_length_mm: k.max_psu_length_mm,
  })),
  anakartlar: anakartlar.map((a) => ({
    part_id: a.part_id,
    memory_type: a.memory_type,
    memory_slots: a.memory_slots,
    max_memory_gb: a.max_memory_gb,
    max_memory_speed_mhz: a.max_memory_speed_mhz,
    m2_slots: a.m2_slots,
  })),
  depolamalar: depolamalar.map((d) => ({
    part_id: d.part_id,
    capacity_gb: d.capacity_gb,
    interface: d.interface,
    read_speed_mbs: d.read_speed_mbs,
  })),
});

// ===========================================================================
// RAPOR
// ===========================================================================

console.log("FIZIKSEL MAKULLUK DENETIMI");
console.log("Iki degerin birbirini kisitladigi her yer.\n");

console.log(`Calisan kontrol : ${kontrol}`);
console.log(`Ihlal           : ${ihlaller.length}\n`);

if (Object.keys(calisamayan).length > 0) {
  console.log("ALAN EKSIK OLDUGU ICIN CALISAMAYAN KONTROLLER");
  for (const [kural, adet] of Object.entries(calisamayan).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(adet).padStart(4)}  ${kural}`);
  }
  console.log();
}

// Semada karşılığı olmayan kısıtlar da yazılıyor: kapsamın nerede bittiğini
// gizlememek, kapsamı büyütmek kadar önemli.
console.log("SEMADA ALANI OLMADIGI ICIN KURULAMAYAN KISITLAR");
for (const k of KURULAMAYAN_KISITLAR) console.log(`  ${k}`);
console.log();

cizgi();
if (ihlaller.length === 0) {
  console.log(`SONUC: ${kontrol} kontrolun tamami gecti.`);
  await prisma.$disconnect();
  process.exit(0);
}
console.log(`SONUC: ${ihlaller.length} IHLAL (${kontrol} kontrol calisti)`);
cizgi();
const gruplu = new Map<string, typeof ihlaller>();
for (const i of ihlaller) gruplu.set(i.kural, [...(gruplu.get(i.kural) ?? []), i]);
for (const [kural, liste] of gruplu) {
  console.log(`\n  ${kural.toUpperCase()} — ${liste.length} ihlal`);
  for (const i of liste) console.log(`    ${i.partId.padEnd(30)} ${i.gerekce}`);
}
await prisma.$disconnect();
process.exit(1);
