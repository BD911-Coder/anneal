// data/parts/*.csv dosyalarini veritabanina aktarir.
//
// Calistirma: npm run parca:aktar
//
// Iki asamali, SCHEMA.md bolum 0 kural 3 geregi:
//   1. HAM: her CSV satiri once raw_imports'a oldugu gibi yazilir.
//   2. NORMALIZE: sonra parts + kategori spec tablosuna gecer.
//
// Neden iki asama: normalizasyon mantiginda hata bulunursa ham satir
// duruyor olur ve yeniden islenebilir. CSV dosyasi silinse bile veri kaybi
// olmaz.
//
// Bu script dev-seed uretmez; gercek veri yazar (source='manufacturer').
// Bu yuzden DEV_SEED_ALLOWED gibi bir bayrak beklemez — bu verinin canliya
// gitmesi zaten istenen sey.

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

const CSV_DIR = "data/parts";

// Kategori basina zorunlu spec alanlari. Bunlardan biri bossa satir
// aktarilmaz — uydurma deger yazmak yerine parcayi degistirmek gerekir.
const REQUIRED_SPEC: Record<string, string[]> = {
  cpu: ["socket", "cores", "threads", "base_clock_mhz", "boost_clock_mhz", "tdp_watt", "memory_type", "has_igpu"],
  // length_mm, recommended_psu_watt, pcie_version burada YOK: K52 ve K56
  // ile opsiyonel oldular.
  gpu: ["chipset", "vram_gb", "vram_type", "tdp_watt"],
  motherboard: ["socket", "chipset", "form_factor", "memory_type", "memory_slots",
                "max_memory_gb", "max_memory_speed_mhz", "m2_slots"],
  ram: ["memory_type", "capacity_gb", "module_count", "speed_mhz", "cas_latency"],
  // efficiency_rating burada YOK: K61 ile opsiyonel oldu.
  // length_mm burada YOK: K62 ile opsiyonel oldu.
  psu: ["wattage", "modularity"],
  // read_speed_mbs semada opsiyonel.
  storage: ["storage_type", "capacity_gb", "interface"],
  case: ["supported_form_factors", "max_gpu_length_mm", "max_cpu_cooler_height_mm",
         "max_psu_length_mm"],
};

/** Prisma enum uyeleri tire/egik cizgi alamiyor (K7). CSV gercek degeri tasir. */
function formFactor(v: string) {
  return (v === "E-ATX" ? "E_ATX" : v) as "ATX" | "mATX" | "ITX" | "E_ATX";
}

/** case_specs.supported_form_factors bir dizi; CSV'de "ATX|mATX|ITX" biciminde. */
function formFactorList(v: string) {
  return v.split("|").map((x) => formFactor(x.trim()));
}

// parts tablosunda zorunlu olanlar (release_year opsiyonel).
const REQUIRED_PART = ["id", "brand", "model", "collected_at", "source_url"];

// ---------------------------------------------------------------------------
// CSV okuma
// ---------------------------------------------------------------------------
//
// Kucuk bir ayristirici; yeni bagimlilik eklemedik. Tirnakli alanlari ve
// tirnak icindeki virgulu dogru okur, bize yeten bu.
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else field += ch;
      continue;
    }
    if (ch === '"') inQuotes = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (ch !== "\r") field += ch;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }

  const nonEmpty = rows.filter((r) => r.some((c) => c.trim() !== ""));
  if (nonEmpty.length === 0) return [];

  const header = nonEmpty[0].map((h) => h.trim());
  return nonEmpty.slice(1).map((cells) => {
    const record: Record<string, string> = {};
    header.forEach((name, index) => { record[name] = (cells[index] ?? "").trim(); });
    return record;
  });
}

// ---------------------------------------------------------------------------
// Deger cevirileri
// ---------------------------------------------------------------------------

function intOrNull(value: string, field: string): number | null {
  if (value === "") return null;
  if (!/^-?\d+$/.test(value)) throw new Error(`${field}: tam sayi bekleniyordu, "${value}" geldi`);
  return Number(value);
}

function floatOrNull(value: string, field: string): number | null {
  if (value === "") return null;
  if (!/^-?\d+(\.\d+)?$/.test(value)) throw new Error(`${field}: sayi bekleniyordu, "${value}" geldi`);
  return Number(value);
}

/**
 * Kaynak guvenilirlik sirasi (S20 karari).
 *
 * Yeni satir, mevcut satirdan DUSUK sirali bir kaynaktan geliyorsa yazilmaz.
 * Proje sahibi ucunu sayd: manufacturer > manual > dev-seed. Kalan uc deger
 * aradaki bosluklara yerlestirildi; bu script zaten yalnizca 'manufacturer'
 * yazdigi icin pratikte belirleyici olan sadece siranin en ustu.
 */
const SOURCE_RANK: Record<string, number> = {
  manufacturer: 5,
  manual: 4,
  affiliate: 3,
  import: 2,
  user: 1,
  dev_seed: 0,
};

/** Iki nesne arasinda gercekten degisen alanlar — rapora yazilir. */
function changedFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): string[] {
  const degisen: string[] = [];
  for (const [key, value] of Object.entries(after)) {
    const eski = before[key];
    const eskiDeger = eski instanceof Date ? eski.getTime() : eski;
    const yeniDeger = value instanceof Date ? value.getTime() : value;
    if (eskiDeger !== yeniDeger) degisen.push(key);
  }
  return degisen;
}

function boolOrNull(value: string, field: string): boolean | null {
  if (value === "") return null;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`${field}: true/false bekleniyordu, "${value}" geldi`);
}

/** collected_at CSV'de tarih (YYYY-AA-GG); gun ortasi UTC olarak yazilir. */
function collectedAt(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`collected_at: YYYY-AA-GG bekleniyordu, "${value}" geldi`);
  }
  return new Date(`${value}T12:00:00Z`);
}

// ---------------------------------------------------------------------------
// Aktarma
// ---------------------------------------------------------------------------

type Sonuc = { islenen: number; guncellenen: number; atlanan: number; hatali: number };

async function importFile(fileName: string, sonuc: Sonuc): Promise<void> {
  // Dosya adi deseni: <kategori>[-<kaynak>].csv  ->  gpu-nvidia.csv = gpu
  // Ayni kategoriyi birden fazla kaynaktan ayri dosyalarda tutabilmek icin.
  const category = fileName.replace(/\.csv$/, "").split("-")[0];
  if (!REQUIRED_SPEC[category]) {
    console.log(`  ${fileName}: bilinmeyen kategori, atlandi`);
    return;
  }

  const rows = parseCsv(readFileSync(`${CSV_DIR}/${fileName}`, "utf8"));
  console.log(`\n${fileName} (${category}) — ${rows.length} satir`);

  for (const row of rows) {
    // --- 1. ASAMA: ham satir, hicbir cevrim yapilmadan ---------------------
    const raw = await prisma.rawImport.create({
      data: {
        source: `manual-csv:${CSV_DIR}/${fileName}`,
        payload: row,
        imported_at: new Date(),
        status: "pending",
      },
      select: { id: true },
    });

    const fail = async (mesaj: string) => {
      await prisma.rawImport.update({ where: { id: raw.id }, data: { status: "failed", error: mesaj } });
    };

    try {
      // --- 2. ASAMA: normalize ---------------------------------------------
      const eksikPart = REQUIRED_PART.filter((f) => !row[f]);
      const eksikSpec = REQUIRED_SPEC[category].filter((f) => !row[f]);
      const eksik = [...eksikPart, ...eksikSpec];
      if (eksik.length > 0) {
        const mesaj = `zorunlu alan bos: ${eksik.join(", ")}`;
        console.log(`  [HATA ] ${row.id || "(id yok)"} — ${mesaj}`);
        await fail(mesaj);
        sonuc.hatali++;
        continue;
      }

      const confidence = row.confidence || "high";
      if (!["high", "medium", "low"].includes(confidence)) {
        throw new Error(`confidence: high/medium/low bekleniyordu, "${confidence}" geldi`);
      }

      const provenance = {
        source: "manufacturer" as const,
        source_url: row.source_url,
        confidence: confidence as "high" | "medium" | "low",
        collected_at: collectedAt(row.collected_at),
      };

      // S20 karari: ayni slug ikinci kez geldiginde GUNCELLE, hata verme.
      // Tek kosul: yeni satir daha dusuk guvenilirlikte bir kaynaktan
      // geliyorsa dokunma. Gercek veriyi sahte veriyle ezmek istenmeyen sey;
      // sahte veriyi gercekle degistirmek ise tam olarak istenen sey.
      const mevcut = await prisma.part.findUnique({ where: { id: row.id } });
      if (mevcut && SOURCE_RANK[provenance.source] < (SOURCE_RANK[mevcut.source] ?? 0)) {
        const mesaj = `daha dusuk guvenilirlik: yeni='${provenance.source}' mevcut='${mevcut.source}' — atlandi (S20)`;
        console.log(`  [ATLA  ] ${row.id} — ${mesaj}`);
        await fail(mesaj);
        sonuc.atlanan++;
        continue;
      }

      const partData = {
        category: category as "cpu" | "gpu" | "motherboard" | "ram" | "psu" | "storage" | "case",
        brand: row.brand,
        model: row.model,
        release_year: intOrNull(row.release_year, "release_year"),
        is_active: true,
        ...provenance,
      };

      const degisen = new Set<string>();
      if (mevcut) for (const f of changedFields(mevcut, partData)) degisen.add(f);

      if (category === "cpu") {
        const oncekiSpec = mevcut
          ? await prisma.cpuSpecs.findUnique({ where: { part_id: row.id } })
          : null;
        const specData = {
          socket: row.socket,
          cores: intOrNull(row.cores, "cores")!,
          threads: intOrNull(row.threads, "threads")!,
          base_clock_mhz: intOrNull(row.base_clock_mhz, "base_clock_mhz")!,
          boost_clock_mhz: intOrNull(row.boost_clock_mhz, "boost_clock_mhz")!,
          tdp_watt: intOrNull(row.tdp_watt, "tdp_watt")!,
          // Tip acikca yaziliyor: ayri bir nesnede ternary'nin sonucu
          // string'e genisliyor ve Prisma enum'unu karsilamiyor.
          memory_type: (row.memory_type === "DDR4/DDR5"
            ? "DDR4_DDR5"
            : row.memory_type) as "DDR4" | "DDR5" | "DDR4_DDR5",
          has_igpu: boolOrNull(row.has_igpu, "has_igpu")!,
          ...provenance,
        };
        // parts ve spec satiri TEK islemde yazilir: spec yazimi patlarsa
        // spec'siz bir parts satiri kalmasin. Bu bir kez gerceklesti ve
        // 22 yetim satir birakti.
        await prisma.$transaction(async (tx) => {
          await tx.part.upsert({
            where: { id: row.id },
            create: { id: row.id, ...partData },
            update: partData,
          });
          await tx.cpuSpecs.upsert({
            where: { part_id: row.id },
            create: { part_id: row.id, ...specData },
            update: specData,
          });
        });
        if (oncekiSpec) for (const f of changedFields(oncekiSpec, specData)) degisen.add(f);
      } else if (category === "gpu") {
        const oncekiSpec = mevcut
          ? await prisma.gpuSpecs.findUnique({ where: { part_id: row.id } })
          : null;
        const specData = {
          chipset: row.chipset,
          vram_gb: intOrNull(row.vram_gb, "vram_gb")!,
          vram_type: row.vram_type,
          tdp_watt: intOrNull(row.tdp_watt, "tdp_watt")!,
          // K52: bos olabilir, zorunlu degil.
          length_mm: intOrNull(row.length_mm, "length_mm"),
          recommended_psu_watt: intOrNull(row.recommended_psu_watt, "recommended_psu_watt"),
          pcie_version: row.pcie_version || null,
          // K51: olcekleme alanlari, hepsi opsiyonel.
          shader_units: intOrNull(row.shader_units ?? "", "shader_units"),
          // K57: sayinin ne saydigi. shader_units doluysa bu da dolu olmali.
          shader_unit_type: (row.shader_unit_type || null) as
            | "cuda_core" | "stream_processor" | "xe_vector_engine" | null,
          boost_clock_mhz: intOrNull(row.boost_clock_mhz ?? "", "boost_clock_mhz"),
          memory_bandwidth_gbs: floatOrNull(row.memory_bandwidth_gbs ?? "", "memory_bandwidth_gbs"),
          ...provenance,
        };
        await prisma.$transaction(async (tx) => {
          await tx.part.upsert({
            where: { id: row.id },
            create: { id: row.id, ...partData },
            update: partData,
          });
          await tx.gpuSpecs.upsert({
            where: { part_id: row.id },
            create: { part_id: row.id, ...specData },
            update: specData,
          });
        });
        if (oncekiSpec) for (const f of changedFields(oncekiSpec, specData)) degisen.add(f);
      } else if (category === "motherboard") {
        const oncekiSpec = mevcut
          ? await prisma.motherboardSpecs.findUnique({ where: { part_id: row.id } })
          : null;
        const specData = {
          socket: row.socket,
          chipset: row.chipset,
          form_factor: formFactor(row.form_factor),
          memory_type: row.memory_type as "DDR4" | "DDR5",
          memory_slots: intOrNull(row.memory_slots, "memory_slots")!,
          max_memory_gb: intOrNull(row.max_memory_gb, "max_memory_gb")!,
          max_memory_speed_mhz: intOrNull(row.max_memory_speed_mhz, "max_memory_speed_mhz")!,
          m2_slots: intOrNull(row.m2_slots, "m2_slots")!,
          ...provenance,
        };
        await prisma.$transaction(async (tx) => {
          await tx.part.upsert({ where: { id: row.id }, create: { id: row.id, ...partData }, update: partData });
          await tx.motherboardSpecs.upsert({
            where: { part_id: row.id },
            create: { part_id: row.id, ...specData },
            update: specData,
          });
        });
        if (oncekiSpec) for (const f of changedFields(oncekiSpec, specData)) degisen.add(f);
      } else if (category === "ram") {
        const oncekiSpec = mevcut
          ? await prisma.ramSpecs.findUnique({ where: { part_id: row.id } })
          : null;
        const specData = {
          memory_type: row.memory_type as "DDR4" | "DDR5",
          capacity_gb: intOrNull(row.capacity_gb, "capacity_gb")!,
          module_count: intOrNull(row.module_count, "module_count")!,
          speed_mhz: intOrNull(row.speed_mhz, "speed_mhz")!,
          cas_latency: intOrNull(row.cas_latency, "cas_latency")!,
          ...provenance,
        };
        await prisma.$transaction(async (tx) => {
          await tx.part.upsert({ where: { id: row.id }, create: { id: row.id, ...partData }, update: partData });
          await tx.ramSpecs.upsert({
            where: { part_id: row.id },
            create: { part_id: row.id, ...specData },
            update: specData,
          });
        });
        if (oncekiSpec) for (const f of changedFields(oncekiSpec, specData)) degisen.add(f);
      } else if (category === "psu") {
        const oncekiSpec = mevcut
          ? await prisma.psuSpecs.findUnique({ where: { part_id: row.id } })
          : null;
        const specData = {
          wattage: intOrNull(row.wattage, "wattage")!,
          // K61: opsiyonel, sayfada yazdigi gibi girilir.
          efficiency_rating: row.efficiency_rating || null,
          modularity: row.modularity as "full" | "semi" | "none",
          length_mm: intOrNull(row.length_mm, "length_mm"),
          ...provenance,
        };
        await prisma.$transaction(async (tx) => {
          await tx.part.upsert({ where: { id: row.id }, create: { id: row.id, ...partData }, update: partData });
          await tx.psuSpecs.upsert({
            where: { part_id: row.id },
            create: { part_id: row.id, ...specData },
            update: specData,
          });
        });
        if (oncekiSpec) for (const f of changedFields(oncekiSpec, specData)) degisen.add(f);
      } else if (category === "storage") {
        const oncekiSpec = mevcut
          ? await prisma.storageSpecs.findUnique({ where: { part_id: row.id } })
          : null;
        const specData = {
          storage_type: (row.storage_type === "sata-ssd" ? "sata_ssd" : row.storage_type) as
            | "nvme" | "sata_ssd" | "hdd",
          capacity_gb: intOrNull(row.capacity_gb, "capacity_gb")!,
          interface: row.interface,
          read_speed_mbs: intOrNull(row.read_speed_mbs ?? "", "read_speed_mbs"),
          ...provenance,
        };
        await prisma.$transaction(async (tx) => {
          await tx.part.upsert({ where: { id: row.id }, create: { id: row.id, ...partData }, update: partData });
          await tx.storageSpecs.upsert({
            where: { part_id: row.id },
            create: { part_id: row.id, ...specData },
            update: specData,
          });
        });
        if (oncekiSpec) for (const f of changedFields(oncekiSpec, specData)) degisen.add(f);
      } else {
        const oncekiSpec = mevcut
          ? await prisma.caseSpecs.findUnique({ where: { part_id: row.id } })
          : null;
        const specData = {
          supported_form_factors: formFactorList(row.supported_form_factors),
          max_gpu_length_mm: intOrNull(row.max_gpu_length_mm, "max_gpu_length_mm")!,
          max_cpu_cooler_height_mm: intOrNull(row.max_cpu_cooler_height_mm, "max_cpu_cooler_height_mm")!,
          max_psu_length_mm: intOrNull(row.max_psu_length_mm, "max_psu_length_mm")!,
          ...provenance,
        };
        await prisma.$transaction(async (tx) => {
          await tx.part.upsert({ where: { id: row.id }, create: { id: row.id, ...partData }, update: partData });
          await tx.caseSpecs.upsert({
            where: { part_id: row.id },
            create: { part_id: row.id, ...specData },
            update: specData,
          });
        });
        if (oncekiSpec) for (const f of changedFields(oncekiSpec, specData)) degisen.add(f);
      }

      await prisma.rawImport.update({ where: { id: raw.id }, data: { status: "processed" } });

      if (mevcut) {
        // collected_at her aktarmada degisir; tek basina "degisti" demek
        // yaniltici olurdu, o yuzden asil alanlarla birlikte gosteriliyor.
        const detay = degisen.size > 0 ? `degisen: ${[...degisen].join(", ")}` : "degisiklik yok";
        console.log(`  [GUNCEL] ${row.id} — ${detay}`);
        sonuc.guncellenen++;
      } else {
        console.log(`  [YENI  ] ${row.id}`);
        sonuc.islenen++;
      }
    } catch (error) {
      const mesaj = error instanceof Error ? error.message : String(error);
      console.log(`  [HATA ] ${row.id || "(id yok)"} — ${mesaj}`);
      await fail(mesaj);
      sonuc.hatali++;
    }
  }
}

console.log(`Hedef: ${new URL(connectionString).hostname}`);
console.log("Kaynak damgasi: source='manufacturer'; confidence CSV'den, yoksa 'high'");

const files = readdirSync(CSV_DIR).filter((f) => f.endsWith(".csv")).sort();
const sonuc: Sonuc = { islenen: 0, guncellenen: 0, atlanan: 0, hatali: 0 };
for (const file of files) await importFile(file, sonuc);

console.log(
  `\nOZET: ${sonuc.islenen} yeni, ${sonuc.guncellenen} guncellendi, ` +
    `${sonuc.atlanan} atlandi (dusuk guvenilirlik), ${sonuc.hatali} hata.`,
);
const hamSayi = await prisma.rawImport.count();
const parcaSayi = await prisma.part.count({ where: { source: "manufacturer" } });
console.log(`raw_imports: ${hamSayi} satir. manufacturer kaynakli parca: ${parcaSayi}.`);

await prisma.$disconnect();
