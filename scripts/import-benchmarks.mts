// data/benchmarks/*.csv -> games + benchmark_points
//
// Calistirma: npm run olcum:aktar
//
// Iki asamali, SCHEMA.md bolum 0 kural 3 geregi: her satir once raw_imports'a
// ham haliyle yazilir, sonra normalize edilir.
//
// benchmark_points APPEND-ONLY (K1): UPDATE yazilmaz. Ayni satir ikinci kez
// gelirse eklenmez — tekillik (game, gpu/cpu, resolution, preset, source_url)
// uzerinden kontrol edilir. Yoksa her calistirma veriyi ikiye katlardi.

import { existsSync, readFileSync } from "node:fs";
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

const DIR = "data/benchmarks";
const COLLECTED_AT = new Date("2026-08-19T00:00:00Z");

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split("\n").map((l) => l.replace(/\r$/, "")).filter((l) => l.trim() !== "");
  const header = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    // Oyun adlarinda virgul var (ornek: "Anno 117: Pax Romana"), ama yalnizca
    // `name` sutununda. Basit bolme yerine tirnaksiz kacisli okuma: sutun
    // sayisi header'dan fazlaysa fazlalik `name`e geri yapistirilir.
    const cells = line.split(",");
    if (cells.length > header.length) {
      const fazla = cells.length - header.length;
      const i = header.indexOf("name");
      cells.splice(i, fazla + 1, cells.slice(i, i + fazla + 1).join(","));
    }
    const row: Record<string, string> = {};
    header.forEach((h, n) => (row[h] = (cells[n] ?? "").trim()));
    return row;
  });
}

async function ham(source: string, payload: unknown) {
  return prisma.rawImport.create({
    data: { source, payload: payload as object, imported_at: new Date(), status: "pending" },
  });
}

// ---------------------------------------------------------------------------
// games
// ---------------------------------------------------------------------------
const oyunlar = parseCsv(readFileSync(`${DIR}/games.csv`, "utf8"));
let yeniOyun = 0;

for (const row of oyunlar) {
  const raw = await ham("benchmarks/games.csv", row);
  try {
    const data = {
      name: row.name,
      release_year: Number(row.release_year),
      gpu_weight: Number(row.gpu_weight),
      cpu_weight: Number(row.cpu_weight),
      // Agirliklar ve ad/yil elle girildi: source 'manual', confidence 'low'.
      // Hicbir kural ve arayuz bu alanlari kullanmiyor; v0.2 hesabi da
      // kullanmiyor. Bkz. docs/KARARLAR.md K82.
      source: "manual" as const,
      source_url: row.source_url,
      confidence: "low" as const,
      collected_at: COLLECTED_AT,
    };
    const oncesi = await prisma.game.findUnique({ where: { id: row.id } });
    await prisma.game.upsert({ where: { id: row.id }, create: { id: row.id, ...data }, update: data });
    if (!oncesi) yeniOyun++;
    await prisma.rawImport.update({ where: { id: raw.id }, data: { status: "processed" } });
  } catch (err) {
    await prisma.rawImport.update({
      where: { id: raw.id },
      data: { status: "failed", error: (err as Error).message },
    });
    console.error(`  [HATA] oyun ${row.id}: ${(err as Error).message}`);
  }
}
console.log(`games: ${oyunlar.length} satir okundu, ${yeniOyun} yeni.`);

// ---------------------------------------------------------------------------
// benchmark_points
// ---------------------------------------------------------------------------
type Nokta = {
  file: string;
  game_id: string;
  gpu_part_id: string;
  cpu_part_id: string | null;
  resolution: "R1080p" | "R1440p" | "R2160p";
  preset: "low" | "medium" | "high" | "ultra";
  upscaling: string | null;
  avg_fps: number;
  source_url: string;
};

const RES = { "1080p": "R1080p", "1440p": "R1440p", "2160p": "R2160p" } as const;

// CPU olcumlerinde test kartini sayfa soyluyor: 720p/1080p + RTX 5090.
// benchmark_points.gpu_part_id zorunlu — hangi kartla olculdugu bilinmeden
// bir CPU olcumu okunamaz, dogru olan da bu.
const CPU_TEST_GPU = "nvidia-rtx-5090";

const noktalar: Nokta[] = [];

for (const [file, tip] of [["gpu-computerbase.csv", "gpu"], ["cpu-computerbase.csv", "cpu"]] as const) {
  const path = `${DIR}/${file}`;
  if (!existsSync(path)) continue;
  for (const row of parseCsv(readFileSync(path, "utf8"))) {
    noktalar.push({
      file,
      game_id: row.game_id,
      gpu_part_id: tip === "gpu" ? row.gpu_part_id : CPU_TEST_GPU,
      cpu_part_id: tip === "cpu" ? row.cpu_part_id : null,
      resolution: RES[row.resolution as keyof typeof RES],
      preset: row.preset as Nokta["preset"],
      upscaling: row.upscaling || null,
      avg_fps: Number(row.avg_fps),
      source_url: row.source_url,
    });
  }
}

let yeni = 0;
let atlanan = 0;

for (const n of noktalar) {
  const raw = await ham(`benchmarks/${n.file}`, n as unknown as object);
  try {
    // Append-only: ayni olcum ikinci kez yazilmaz.
    const varMi = await prisma.benchmarkPoint.findFirst({
      where: {
        game_id: n.game_id,
        gpu_part_id: n.gpu_part_id,
        cpu_part_id: n.cpu_part_id,
        resolution: n.resolution,
        preset: n.preset,
        source_url: n.source_url,
      },
    });
    if (varMi) {
      atlanan++;
      await prisma.rawImport.update({
        where: { id: raw.id },
        data: { status: "processed", error: "zaten var, append-only" },
      });
      continue;
    }
    await prisma.benchmarkPoint.create({
      data: {
        game_id: n.game_id,
        gpu_part_id: n.gpu_part_id,
        cpu_part_id: n.cpu_part_id,
        workload: "gaming",
        resolution: n.resolution,
        preset: n.preset,
        upscaling: n.upscaling,
        avg_fps: n.avg_fps,
        source_type: "review",
        source: "manual",
        source_url: n.source_url,
        confidence: "medium",
        collected_at: COLLECTED_AT,
      },
    });
    yeni++;
    await prisma.rawImport.update({ where: { id: raw.id }, data: { status: "processed" } });
  } catch (err) {
    await prisma.rawImport.update({
      where: { id: raw.id },
      data: { status: "failed", error: (err as Error).message },
    });
    console.error(`  [HATA] ${n.game_id} / ${n.cpu_part_id ?? n.gpu_part_id}: ${(err as Error).message}`);
  }
}

const toplam = await prisma.benchmarkPoint.count();
console.log(`benchmark_points: ${yeni} yeni, ${atlanan} atlandi (zaten var). Tabloda ${toplam} satir.`);

await prisma.$disconnect();
