// dev-seed verisi üretir.
//
// Çalıştırma: npm run db:seed
//
// dev-seed korumasının 1. ve 4. katmanı burada:
//   1. Üretilen her satırın source alanı 'dev-seed'.
//   4. Canlı ortama bağlıysa çalışmayı reddeder.
//
// Veri, uyumlu VE uyumsuz kombinasyonlar çıkacak şekilde seçildi: her
// engelleyici ve uyarı kuralını tetikleyebilecek en az bir parça var.

import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../lib/generated/prisma/client.ts";
import { PRICES_MINOR, PRICE_DATES } from "./seed-prices.ts";

for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) loadEnvFile(file);
}

// ---------------------------------------------------------------------------
// 4. katman: canlıya bağlıysa çalışma
// ---------------------------------------------------------------------------
function refuseIfLive(): void {
  const reasons: string[] = [];

  if (process.env.NODE_ENV === "production") {
    reasons.push("NODE_ENV=production");
  }
  if (process.env.VERCEL_ENV === "production") {
    reasons.push("VERCEL_ENV=production");
  }
  // Canlı ortamda .env.local dosyası olmaz, değişkenler platformdan gelir.
  // Bu yüzden bayrağın varlığı "burası bir geliştirme makinesi" demektir.
  if (process.env.DEV_SEED_ALLOWED !== "true") {
    reasons.push("DEV_SEED_ALLOWED bayrağı 'true' değil");
  }

  if (reasons.length > 0) {
    console.error("Seed çalıştırılmadı. Sebep:");
    for (const reason of reasons) console.error(`  - ${reason}`);
    console.error("\nBu script sahte veri üretir ve canlı veritabanına yazılmamalıdır.");
    process.exit(1);
  }
}

refuseIfLive();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL tanımlı değil.");
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg(connectionString) });

// Her satırda tekrar eden olgusal iddia alanları (SCHEMA.md bölüm 1.3).
// confidence 'low': bu veri uydurma, gerçek bir kaynağı yok.
const provenance = {
  source: "dev_seed", // veritabanına 'dev-seed' olarak iner (K7)
  source_url: null,
  confidence: "low",
  collected_at: new Date(),
} as const;

type PartSeed = {
  id: string;
  category: "cpu" | "gpu" | "motherboard" | "ram" | "psu" | "storage" | "case";
  brand: string;
  model: string;
  release_year: number;
};

// ---------------------------------------------------------------------------
// İşlemciler
// ---------------------------------------------------------------------------
const cpus: (PartSeed & {
  spec: {
    socket: string;
    cores: number;
    threads: number;
    base_clock_mhz: number;
    boost_clock_mhz: number;
    tdp_watt: number;
    memory_type: "DDR4" | "DDR5" | "DDR4_DDR5";
    has_igpu: boolean;
  };
})[] = [
  {
    id: "amd-ryzen-5-7600", category: "cpu", brand: "AMD", model: "Ryzen 5 7600", release_year: 2023,
    spec: { socket: "AM5", cores: 6, threads: 12, base_clock_mhz: 3800, boost_clock_mhz: 5100, tdp_watt: 65, memory_type: "DDR5", has_igpu: true },
  },
  {
    // has_igpu false -> ekran kartı seçilmezse W4 tetiklenir
    id: "amd-ryzen-7-7800x3d", category: "cpu", brand: "AMD", model: "Ryzen 7 7800X3D", release_year: 2023,
    spec: { socket: "AM5", cores: 8, threads: 16, base_clock_mhz: 4200, boost_clock_mhz: 5000, tdp_watt: 120, memory_type: "DDR5", has_igpu: false },
  },
  {
    // farklı soket -> AM5 anakartla C1 tetiklenir
    id: "intel-core-i5-14600k", category: "cpu", brand: "Intel", model: "Core i5-14600K", release_year: 2023,
    spec: { socket: "LGA1700", cores: 14, threads: 20, base_clock_mhz: 3500, boost_clock_mhz: 5300, tdp_watt: 125, memory_type: "DDR4_DDR5", has_igpu: true },
  },
  {
    // yüksek tüketim -> zayıf güç kaynağıyla C4 tetiklenir
    id: "intel-core-i9-15900k", category: "cpu", brand: "Intel", model: "Core i9-15900K", release_year: 2025,
    spec: { socket: "LGA1851", cores: 24, threads: 32, base_clock_mhz: 3200, boost_clock_mhz: 6000, tdp_watt: 253, memory_type: "DDR5", has_igpu: true },
  },
];

// ---------------------------------------------------------------------------
// Ekran kartları
// ---------------------------------------------------------------------------
const gpus: (PartSeed & {
  spec: {
    chipset: string; vram_gb: number; vram_type: string; tdp_watt: number;
    length_mm: number; recommended_psu_watt: number; pcie_version: string;
  };
})[] = [
  {
    id: "nvidia-rtx-5060", category: "gpu", brand: "NVIDIA", model: "GeForce RTX 5060", release_year: 2025,
    spec: { chipset: "RTX 5060", vram_gb: 8, vram_type: "GDDR7", tdp_watt: 145, length_mm: 242, recommended_psu_watt: 450, pcie_version: "PCIe 5.0 x8" },
  },
  {
    id: "nvidia-rtx-5070", category: "gpu", brand: "NVIDIA", model: "GeForce RTX 5070", release_year: 2025,
    spec: { chipset: "RTX 5070", vram_gb: 12, vram_type: "GDDR7", tdp_watt: 250, length_mm: 304, recommended_psu_watt: 650, pcie_version: "PCIe 5.0 x16" },
  },
  {
    // uzun ve aç -> küçük kasada C5, zayıf güçte C4
    id: "nvidia-rtx-5090", category: "gpu", brand: "NVIDIA", model: "GeForce RTX 5090", release_year: 2025,
    spec: { chipset: "RTX 5090", vram_gb: 32, vram_type: "GDDR7", tdp_watt: 575, length_mm: 357, recommended_psu_watt: 1000, pcie_version: "PCIe 5.0 x16" },
  },
  {
    id: "amd-rx-9070-xt", category: "gpu", brand: "AMD", model: "Radeon RX 9070 XT", release_year: 2025,
    spec: { chipset: "RX 9070 XT", vram_gb: 16, vram_type: "GDDR6", tdp_watt: 304, length_mm: 320, recommended_psu_watt: 750, pcie_version: "PCIe 5.0 x16" },
  },
];

// ---------------------------------------------------------------------------
// Ekran kartı varyantları (AIB kartları) — K86
// ---------------------------------------------------------------------------
//
// Üçü de aynı çipe bağlı ve üçü ayrı bir durumu kapsıyor:
//   - Strix: uzunluk ve TBP dolu    -> C5 ve C4 kartın değerlerini kullanır
//   - Zotac: uzunluk BOŞ            -> C5 atlanır, çipin ölçüsüne düşülmez (K87)
//   - Founders: TBP BOŞ             -> C4 çipin tdp_watt'ına geri düşer (K87)
//
// Böylece K87'nin iki yarısı gerçek veriyle de görülebiliyor, sadece testte değil.
const gpuVariants: (PartSeed & {
  spec: {
    chip_part_id: string;
    length_mm?: number; height_mm?: number; thickness_slots?: number;
    tbp_watt?: number; recommended_psu_watt?: number; power_connectors?: string;
    boost_clock_mhz?: number; boost_clock_oc_mhz?: number;
    fan_count?: number; hdmi_count?: number; displayport_count?: number; usb_c_count?: number;
  };
})[] = [
  {
    id: "asus-rog-strix-rtx-5090-oc", category: "gpu", brand: "ASUS", model: "ROG Strix GeForce RTX 5090 OC", release_year: 2025,
    spec: {
      chip_part_id: "nvidia-rtx-5090",
      length_mm: 358, height_mm: 150, thickness_slots: 3.5,
      tbp_watt: 600, recommended_psu_watt: 1000, power_connectors: "1x 16-pin (12V-2x6)",
      boost_clock_mhz: 2482, boost_clock_oc_mhz: 2580,
      fan_count: 3, hdmi_count: 2, displayport_count: 3, usb_c_count: 0,
    },
  },
  {
    // Uzunluk bilerek boş: kart seçiliyken C5'in atlandığı görülebilsin.
    id: "zotac-rtx-5090-solid", category: "gpu", brand: "ZOTAC", model: "GAMING GeForce RTX 5090 SOLID", release_year: 2025,
    spec: {
      chip_part_id: "nvidia-rtx-5090",
      thickness_slots: 3.5,
      tbp_watt: 575, recommended_psu_watt: 1000, power_connectors: "1x 16-pin (12V-2x6)",
      boost_clock_mhz: 2407,
      fan_count: 3, hdmi_count: 1, displayport_count: 3,
    },
  },
  {
    // TBP bilerek boş: C4'ün çipin referans değerine düştüğü görülebilsin.
    id: "nvidia-rtx-5090-founders", category: "gpu", brand: "NVIDIA", model: "GeForce RTX 5090 Founders Edition", release_year: 2025,
    spec: {
      chip_part_id: "nvidia-rtx-5090",
      length_mm: 304, height_mm: 137, thickness_slots: 2,
      power_connectors: "1x 16-pin (12V-2x6)",
      boost_clock_mhz: 2407,
      fan_count: 2, hdmi_count: 1, displayport_count: 3,
    },
  },
];

// ---------------------------------------------------------------------------
// Anakartlar
// ---------------------------------------------------------------------------
const motherboards: (PartSeed & {
  spec: {
    socket: string; chipset: string;
    form_factor: "ATX" | "mATX" | "ITX" | "E_ATX";
    memory_type: "DDR4" | "DDR5";
    memory_slots: number; max_memory_gb: number; max_memory_speed_mhz: number; m2_slots: number;
  };
})[] = [
  {
    id: "asus-tuf-b650-plus", category: "motherboard", brand: "ASUS", model: "TUF Gaming B650-PLUS", release_year: 2022,
    spec: { socket: "AM5", chipset: "B650", form_factor: "ATX", memory_type: "DDR5", memory_slots: 4, max_memory_gb: 128, max_memory_speed_mhz: 6400, m2_slots: 3 },
  },
  {
    id: "msi-mag-b650m-mortar", category: "motherboard", brand: "MSI", model: "MAG B650M Mortar", release_year: 2023,
    spec: { socket: "AM5", chipset: "B650", form_factor: "mATX", memory_type: "DDR5", memory_slots: 4, max_memory_gb: 128, max_memory_speed_mhz: 6000, m2_slots: 2 },
  },
  {
    // 2 yuva -> 4 modüllü kitle C3; düşük hız sınırı -> hızlı bellekle W1
    id: "gigabyte-a620i-ax", category: "motherboard", brand: "Gigabyte", model: "A620I AX", release_year: 2023,
    spec: { socket: "AM5", chipset: "A620", form_factor: "ITX", memory_type: "DDR5", memory_slots: 2, max_memory_gb: 96, max_memory_speed_mhz: 5600, m2_slots: 1 },
  },
  {
    // DDR4 -> DDR5 bellekle C2; 64GB sınırı -> büyük kitle W2
    id: "asrock-b760m-ddr4", category: "motherboard", brand: "ASRock", model: "B760M-HDV/M.2 DDR4", release_year: 2023,
    spec: { socket: "LGA1700", chipset: "B760", form_factor: "mATX", memory_type: "DDR4", memory_slots: 2, max_memory_gb: 64, max_memory_speed_mhz: 3200, m2_slots: 2 },
  },
  {
    // E-ATX -> çoğu kasada C6
    id: "asus-rog-z890-extreme", category: "motherboard", brand: "ASUS", model: "ROG Maximus Z890 Extreme", release_year: 2025,
    spec: { socket: "LGA1851", chipset: "Z890", form_factor: "E_ATX", memory_type: "DDR5", memory_slots: 4, max_memory_gb: 256, max_memory_speed_mhz: 8000, m2_slots: 5 },
  },
];

// ---------------------------------------------------------------------------
// Bellekler
// ---------------------------------------------------------------------------
const rams: (PartSeed & {
  spec: {
    memory_type: "DDR4" | "DDR5";
    capacity_gb: number; module_count: number; speed_mhz: number; cas_latency: number;
  };
})[] = [
  {
    id: "corsair-vengeance-ddr5-32gb-6000", category: "ram", brand: "Corsair", model: "Vengeance 32GB (2x16) DDR5-6000", release_year: 2023,
    spec: { memory_type: "DDR5", capacity_gb: 32, module_count: 2, speed_mhz: 6000, cas_latency: 30 },
  },
  {
    // 7200 MHz -> çoğu anakartta W1
    id: "gskill-trident-ddr5-64gb-7200", category: "ram", brand: "G.Skill", model: "Trident Z5 64GB (2x32) DDR5-7200", release_year: 2024,
    spec: { memory_type: "DDR5", capacity_gb: 64, module_count: 2, speed_mhz: 7200, cas_latency: 34 },
  },
  {
    // DDR4 -> DDR5 anakartla C2
    id: "kingston-fury-ddr4-32gb-3600", category: "ram", brand: "Kingston", model: "FURY Beast 32GB (2x16) DDR4-3600", release_year: 2021,
    spec: { memory_type: "DDR4", capacity_gb: 32, module_count: 2, speed_mhz: 3600, cas_latency: 18 },
  },
  {
    // 4 modül -> 2 yuvalı anakartta C3; 128GB -> 96/64GB sınırlarında W2
    id: "corsair-dominator-ddr5-128gb-5600", category: "ram", brand: "Corsair", model: "Dominator 128GB (4x32) DDR5-5600", release_year: 2024,
    spec: { memory_type: "DDR5", capacity_gb: 128, module_count: 4, speed_mhz: 5600, cas_latency: 40 },
  },
];

// ---------------------------------------------------------------------------
// Güç kaynakları
// ---------------------------------------------------------------------------
const psus: (PartSeed & {
  spec: {
    wattage: number; efficiency_rating: string;
    modularity: "full" | "semi" | "none"; length_mm: number;
  };
})[] = [
  {
    // zayıf -> güçlü sistemlerde C4
    id: "msi-mag-a550bn", category: "psu", brand: "MSI", model: "MAG A550BN", release_year: 2021,
    spec: { wattage: 550, efficiency_rating: "80+ Bronze", modularity: "none", length_mm: 140 },
  },
  {
    // orta -> bazı sistemlerde W3 (dar pay)
    id: "seasonic-focus-gx-650", category: "psu", brand: "Seasonic", model: "FOCUS GX-650", release_year: 2022,
    spec: { wattage: 650, efficiency_rating: "80+ Gold", modularity: "full", length_mm: 140 },
  },
  {
    id: "corsair-rm850e", category: "psu", brand: "Corsair", model: "RM850e", release_year: 2023,
    spec: { wattage: 850, efficiency_rating: "80+ Gold", modularity: "full", length_mm: 140 },
  },
  {
    // 200 mm -> dar kasalarda W5
    id: "corsair-hx1200", category: "psu", brand: "Corsair", model: "HX1200", release_year: 2022,
    spec: { wattage: 1200, efficiency_rating: "80+ Platinum", modularity: "full", length_mm: 200 },
  },
];

// ---------------------------------------------------------------------------
// Kasalar
// ---------------------------------------------------------------------------
const cases: (PartSeed & {
  spec: {
    supported_form_factors: ("ATX" | "mATX" | "ITX" | "E_ATX")[];
    max_gpu_length_mm: number; max_cpu_cooler_height_mm: number; max_psu_length_mm: number;
  };
})[] = [
  {
    id: "fractal-design-north", category: "case", brand: "Fractal Design", model: "North", release_year: 2023,
    spec: { supported_form_factors: ["ATX", "mATX", "ITX"], max_gpu_length_mm: 355, max_cpu_cooler_height_mm: 170, max_psu_length_mm: 175 },
  },
  {
    id: "lian-li-lancool-216", category: "case", brand: "Lian Li", model: "Lancool 216", release_year: 2023,
    spec: { supported_form_factors: ["ATX", "mATX", "ITX", "E_ATX"], max_gpu_length_mm: 392, max_cpu_cooler_height_mm: 180, max_psu_length_mm: 210 },
  },
  {
    // sadece ITX + kısa kart + kısa güç kaynağı -> C5, C6 ve W5 için verimli
    id: "cooler-master-nr200p", category: "case", brand: "Cooler Master", model: "NR200P", release_year: 2020,
    spec: { supported_form_factors: ["ITX"], max_gpu_length_mm: 330, max_cpu_cooler_height_mm: 155, max_psu_length_mm: 130 },
  },
  {
    id: "phanteks-g360a", category: "case", brand: "Phanteks", model: "Eclipse G360A", release_year: 2021,
    spec: { supported_form_factors: ["ATX", "mATX", "ITX"], max_gpu_length_mm: 400, max_cpu_cooler_height_mm: 162, max_psu_length_mm: 200 },
  },
];

// ---------------------------------------------------------------------------
// Depolama — hiçbir uyumluluk kuralı kullanmıyor, arayüzde çoklu seçilebilir
// ---------------------------------------------------------------------------
const storages: (PartSeed & {
  spec: {
    storage_type: "nvme" | "sata_ssd" | "hdd";
    capacity_gb: number; interface: string; read_speed_mbs: number;
  };
})[] = [
  {
    id: "samsung-990-pro-1tb", category: "storage", brand: "Samsung", model: "990 PRO 1TB", release_year: 2022,
    spec: { storage_type: "nvme", capacity_gb: 1000, interface: "PCIe 4.0 x4", read_speed_mbs: 7450 },
  },
  {
    id: "samsung-990-pro-2tb", category: "storage", brand: "Samsung", model: "990 PRO 2TB", release_year: 2022,
    spec: { storage_type: "nvme", capacity_gb: 2000, interface: "PCIe 4.0 x4", read_speed_mbs: 7450 },
  },
  {
    id: "crucial-mx500-1tb", category: "storage", brand: "Crucial", model: "MX500 1TB", release_year: 2018,
    spec: { storage_type: "sata_ssd", capacity_gb: 1000, interface: "SATA III", read_speed_mbs: 560 },
  },
  {
    id: "seagate-barracuda-2tb", category: "storage", brand: "Seagate", model: "BarraCuda 2TB", release_year: 2016,
    spec: { storage_type: "hdd", capacity_gb: 2000, interface: "SATA III", read_speed_mbs: 220 },
  },
];

// ---------------------------------------------------------------------------
// Yazma
// ---------------------------------------------------------------------------

/** parts satırı — her kategori için aynı. */
function partRow(seed: PartSeed) {
  return {
    id: seed.id,
    category: seed.category,
    brand: seed.brand,
    model: seed.model,
    release_year: seed.release_year,
    is_active: true,
    ...provenance,
  };
}

let atlanan = 0;

async function upsertAll<T extends PartSeed & { spec: object }>(
  items: T[],
  specTable: { upsert: (args: unknown) => Promise<unknown> },
): Promise<void> {
  for (const item of items) {
    // K54'un ayni mantigi burada da gecerli: sahte veri gercek verinin
    // uzerine YAZMAZ. Bu script dev-seed uretiyor; ayni slug artik gercek
    // bir kaynaktan geliyorsa (source != dev_seed) dokunulmaz.
    const mevcut = await prisma.part.findUnique({
      where: { id: item.id },
      select: { source: true },
    });
    if (mevcut && mevcut.source !== "dev_seed") {
      console.log(`  [ATLA] ${item.id} — gercek veri var (source='${mevcut.source}')`);
      atlanan++;
      continue;
    }

    const row = partRow(item);
    await prisma.part.upsert({ where: { id: item.id }, create: row, update: row });

    const specRow = { part_id: item.id, ...item.spec, ...provenance };
    await specTable.upsert({
      where: { part_id: item.id },
      create: specRow,
      update: specRow,
    });
  }
}

console.log(`Hedef: ${new URL(connectionString).hostname}`);
console.log("Kaynak damgası: source='dev-seed', confidence='low'\n");

/* eslint-disable @typescript-eslint/no-explicit-any */
await upsertAll(cpus, prisma.cpuSpecs as any);
await upsertAll(gpus, prisma.gpuSpecs as any);

// Kart, çipi olmadan yazılamaz (yabancı anahtar). Çip katalogda yoksa kart
// atlanır ve sebebi ekrana yazılır — sessiz bir FK hatası vermek yerine.
const varyantCipleri = [...new Set(gpuVariants.map((v) => v.spec.chip_part_id))];
const mevcutCipler = new Set(
  (
    await prisma.part.findMany({ where: { id: { in: varyantCipleri } }, select: { id: true } })
  ).map((part) => part.id),
);
const yazilabilirVaryantlar = gpuVariants.filter((variant) => {
  if (mevcutCipler.has(variant.spec.chip_part_id)) return true;
  console.log(`  [ATLA] ${variant.id} — çipi (${variant.spec.chip_part_id}) katalogda yok`);
  atlanan++;
  return false;
});
await upsertAll(yazilabilirVaryantlar, prisma.gpuVariantSpecs as any);

await upsertAll(motherboards, prisma.motherboardSpecs as any);
await upsertAll(rams, prisma.ramSpecs as any);
await upsertAll(psus, prisma.psuSpecs as any);
await upsertAll(cases, prisma.caseSpecs as any);
await upsertAll(storages, prisma.storageSpecs as any);
/* eslint-enable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Fiyatlar — price_snapshots
// ---------------------------------------------------------------------------
//
// Tablo append-only: UPDATE yazılmaz, var olan satır silinmez. Bu yüzden seed
// yeniden çalıştığında satır tekrarlamasın diye önce hangi (parça, tarih)
// çiftlerinin zaten yazıldığına bakılır, sadece eksikler eklenir.

const mevcutFiyatlar = await prisma.priceSnapshot.findMany({
  where: { source: "dev_seed" },
  select: { part_id: true, collected_at: true },
});
const yazilmis = new Set(
  mevcutFiyatlar.map((row) => `${row.part_id}|${row.collected_at.toISOString()}`),
);

const yeniFiyatlar = [];
for (const [partId, guncelFiyat] of Object.entries(PRICES_MINOR)) {
  for (const { at, factor } of PRICE_DATES) {
    if (yazilmis.has(`${partId}|${at.toISOString()}`)) continue;
    yeniFiyatlar.push({
      part_id: partId,
      // Gerçek bir satıcıdan gelmediği için 'manual'; satıcı adı uydurulmuyor.
      retailer: "manual",
      price_minor: Math.round(guncelFiyat * factor), // integer kalmalı
      currency: "TRY",
      in_stock: true,
      product_url: null,
      ...provenance,
      collected_at: at, // provenance'ın "şimdi"si değil, snapshot'ın kendi tarihi
    });
  }
}
if (yeniFiyatlar.length > 0) {
  await prisma.priceSnapshot.createMany({ data: yeniFiyatlar });
}

// ---------------------------------------------------------------------------
// Performans indeksi — perf_index'E YAZILMAZ
// ---------------------------------------------------------------------------
//
// Bu script eskiden buraya elle konmuş 8 indeks yazıyordu. Artık yazmıyor ve
// yazmayacak (K71): perf_index hesaplanmış bir tablodur, satırları yalnızca
// benchmark_points verisinden türetilir. Hesaplanmış bir tabloda el yazması
// sayının olması, sayının nereden geldiğini sorulamaz hale getiriyor.
//
// Fiyattaki çözüm burada işlemiyordu: fiyat satırı 'dev-seed' damgası taşıyıp
// canlıda filtrelenebiliyor, perf_index'te `source` sütunu yok ve olmayacak
// (K32 — tablo dış dünya hakkında iddia taşımaz). Damgalanamayan sahte satır
// gerçek parçaya bağlandığında canlıya çıkıyordu.
//
// Sonuç: ölçüm verisi toplanana kadar hiçbir parçanın indeksi yok. Motor bunu
// zaten karşılıyor (computePerformance -> { ok: false, missing }), arayüz de
// "henüz yeterli veri yok" diyor. Bu bir hata değil, verinin bulunmadığı hal.

const perfOnce = await prisma.perfIndex.count();

const sayim = await prisma.part.groupBy({
  by: ["category"],
  _count: { _all: true },
  orderBy: { category: "asc" },
});
for (const satir of sayim) {
  console.log(`  ${satir.category.padEnd(12)} ${satir._count._all}`);
}

const devSeedSayisi = await prisma.part.count({ where: { source: "dev_seed" } });
const toplam = await prisma.part.count();
console.log(`\nToplam ${toplam} parça, ${devSeedSayisi} tanesi dev-seed.`);
if (atlanan > 0) {
  console.log(`${atlanan} parça atlandı: aynı slug gerçek veriyle dolu, üzerine yazılmadı.`);
}

const fiyatSayisi = await prisma.priceSnapshot.count();
const fiyatliParca = (await prisma.priceSnapshot.groupBy({ by: ["part_id"] })).length;
console.log(
  `Fiyat: ${fiyatSayisi} snapshot (${yeniFiyatlar.length} yeni), ${fiyatliParca} parçada fiyat var.`,
);

// K71 bekçisi: bu script perf_index'e yazmaz. Yazan bir satır eklenirse
// (ya da bir upsert yan etkiyle satır üretirse) burada durur.
const perfSonra = await prisma.perfIndex.count();
if (perfSonra !== perfOnce) {
  console.error(
    `\nHATA: seed perf_index'e dokundu (${perfOnce} -> ${perfSonra}).\n` +
      "perf_index satırları yalnızca benchmark_points'tan hesaplanarak üretilir (K71).\n" +
      "Seed bu tabloya yazamaz; ekleyen kod geri alınmalı.",
  );
  await prisma.$disconnect();
  process.exit(1);
}
console.log(`Performans indeksi: seed yazmadı, tabloda ${perfSonra} satır var (K71).`);

await prisma.$disconnect();
