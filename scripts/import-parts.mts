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
  gpu: ["chipset", "vram_gb", "vram_type", "tdp_watt", "length_mm", "recommended_psu_watt", "pcie_version"],
};

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

type Sonuc = { islenen: number; atlanan: number; hatali: number };

async function importFile(fileName: string, sonuc: Sonuc): Promise<void> {
  const category = fileName.replace(/\.csv$/, "");
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

      // Ayni slug ikinci kez geldiginde ne olacagi HENUZ KARARLASTIRILMADI
      // (SORULAR.md S20). Karar verilene kadar en guvenli davranis: dokunma.
      // Uzerine yazmak, dogru olabilecek bir satiri sessizce degistirebilirdi.
      const mevcut = await prisma.part.findUnique({
        where: { id: row.id },
        select: { id: true, source: true },
      });
      if (mevcut) {
        const mesaj = `slug zaten var (mevcut source='${mevcut.source}') — davranis karari bekleniyor, S20`;
        console.log(`  [ATLA ] ${row.id} — ${mesaj}`);
        await fail(mesaj);
        sonuc.atlanan++;
        continue;
      }

      const provenance = {
        source: "manufacturer" as const,
        source_url: row.source_url,
        confidence: "high" as const,
        collected_at: collectedAt(row.collected_at),
      };

      await prisma.part.create({
        data: {
          id: row.id,
          category: category as "cpu" | "gpu",
          brand: row.brand,
          model: row.model,
          release_year: intOrNull(row.release_year, "release_year"),
          is_active: true,
          ...provenance,
        },
      });

      if (category === "cpu") {
        await prisma.cpuSpecs.create({
          data: {
            part_id: row.id,
            socket: row.socket,
            cores: intOrNull(row.cores, "cores")!,
            threads: intOrNull(row.threads, "threads")!,
            base_clock_mhz: intOrNull(row.base_clock_mhz, "base_clock_mhz")!,
            boost_clock_mhz: intOrNull(row.boost_clock_mhz, "boost_clock_mhz")!,
            tdp_watt: intOrNull(row.tdp_watt, "tdp_watt")!,
            memory_type: row.memory_type === "DDR4/DDR5" ? "DDR4_DDR5" : (row.memory_type as "DDR4" | "DDR5"),
            has_igpu: boolOrNull(row.has_igpu, "has_igpu")!,
            ...provenance,
          },
        });
      } else {
        await prisma.gpuSpecs.create({
          data: {
            part_id: row.id,
            chipset: row.chipset,
            vram_gb: intOrNull(row.vram_gb, "vram_gb")!,
            vram_type: row.vram_type,
            tdp_watt: intOrNull(row.tdp_watt, "tdp_watt")!,
            length_mm: intOrNull(row.length_mm, "length_mm")!,
            recommended_psu_watt: intOrNull(row.recommended_psu_watt, "recommended_psu_watt")!,
            pcie_version: row.pcie_version,
            ...provenance,
          },
        });
      }

      await prisma.rawImport.update({ where: { id: raw.id }, data: { status: "processed" } });
      console.log(`  [TAMAM] ${row.id}`);
      sonuc.islenen++;
    } catch (error) {
      const mesaj = error instanceof Error ? error.message : String(error);
      console.log(`  [HATA ] ${row.id || "(id yok)"} — ${mesaj}`);
      await fail(mesaj);
      sonuc.hatali++;
    }
  }
}

console.log(`Hedef: ${new URL(connectionString).hostname}`);
console.log("Kaynak damgasi: source='manufacturer', confidence='high'");

const files = readdirSync(CSV_DIR).filter((f) => f.endsWith(".csv")).sort();
const sonuc: Sonuc = { islenen: 0, atlanan: 0, hatali: 0 };
for (const file of files) await importFile(file, sonuc);

console.log(
  `\nOZET: ${sonuc.islenen} aktarildi, ${sonuc.atlanan} atlandi (slug var), ${sonuc.hatali} hata.`,
);
const hamSayi = await prisma.rawImport.count();
const parcaSayi = await prisma.part.count({ where: { source: "manufacturer" } });
console.log(`raw_imports: ${hamSayi} satir. manufacturer kaynakli parca: ${parcaSayi}.`);

await prisma.$disconnect();
