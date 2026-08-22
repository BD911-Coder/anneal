// Spec alanlarının doluluk oranı — alan, dolu, toplam, yüzde.
//
// Çalıştırma: npm run spec:kapsam
//
// Neden ayrı bir script: hangi alanın ne kadar dolu olduğu bir kere bakılıp
// unutulacak bir şey değil. Tahmin modeli hangi ekseni kullanabileceğine buna
// bakarak karar veriyor ve "yarısı boş bir öngörücü, hiç olmayandan kötüdür"
// kuralı ancak ölçülebilirse uygulanabilir.
//
// Ölçümlü parçalar AYRICA sayılıyor: modelin eğitildiği küme orası ve bir
// alanın katalogda %60 dolu olması, ölçümlü 15 kartta da dolu olduğu anlamına
// gelmiyor.

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
const MODEL_VERSION = "v0.2";

const olculen = new Set(
  (
    await prisma.perfIndex.findMany({
      where: { workload: "gaming", model_version: MODEL_VERSION },
      select: { part_id: true },
    })
  ).map((r) => r.part_id),
);

const gpu = await prisma.gpuSpecs.findMany();
const cpu = await prisma.cpuSpecs.findMany();

type Row = Record<string, unknown>;

function tablo(baslik: string, rows: Row[], olculenRows: Row[], alanlar: string[]) {
  console.log(`\n${baslik}`);
  console.log(
    "  " +
      "alan".padEnd(24) +
      "katalog".padStart(12) +
      "  " +
      "ölçümlü".padStart(12),
  );
  console.log("  " + "-".repeat(52));
  for (const alan of alanlar) {
    const dolu = rows.filter((r) => r[alan] !== null && r[alan] !== undefined).length;
    const doluO = olculenRows.filter((r) => r[alan] !== null && r[alan] !== undefined).length;
    const pct = (a: number, b: number) => (b === 0 ? "—" : `${((a / b) * 100).toFixed(0)}%`);
    console.log(
      "  " +
        alan.padEnd(24) +
        `${dolu}/${rows.length} ${pct(dolu, rows.length)}`.padStart(12) +
        "  " +
        `${doluO}/${olculenRows.length} ${pct(doluO, olculenRows.length)}`.padStart(12),
    );
  }
}

const gpuOlculen = gpu.filter((g) => olculen.has(g.part_id));
const cpuOlculen = cpu.filter((c) => olculen.has(c.part_id));

console.log("Spec alanı doluluk raporu");
console.log(`Katalog: ${gpu.length} ekran kartı çipi, ${cpu.length} işlemci.`);
console.log(`Ölçümlü: ${gpuOlculen.length} ekran kartı, ${cpuOlculen.length} işlemci.`);

tablo("EKRAN KARTI", gpu, gpuOlculen, [
  "shader_units",
  "shader_unit_type",
  "boost_clock_mhz",
  "memory_bandwidth_gbs",
  "bus_width_bits",
  "architecture_family",
  "transistor_count_m",
  "process_node_nm",
  "length_mm",
]);

tablo("İŞLEMCİ", cpu, cpuOlculen, [
  "cores",
  "threads",
  "base_clock_mhz",
  "boost_clock_mhz",
  "tdp_watt",
  "l3_cache_mb",
  "architecture_family",
  "process_node_nm",
]);

// Aile dağılımı — tahmin gruplaması buradan çıkıyor.
const gAile = await prisma.gpuSpecs.groupBy({ by: ["architecture_family"], _count: true });
const cAile = await prisma.cpuSpecs.groupBy({ by: ["architecture_family"], _count: true });
console.log("\nMİMARİ AİLESİ DAĞILIMI (katalog / ölçümlü)");
for (const a of [...gAile, ...cAile].sort((x, y) =>
  String(x.architecture_family).localeCompare(String(y.architecture_family)),
)) {
  const fam = a.architecture_family;
  const olc =
    gpuOlculen.filter((g) => g.architecture_family === fam).length +
    cpuOlculen.filter((c) => c.architecture_family === fam).length;
  console.log(`  ${String(fam).padEnd(22)} ${String(a._count).padStart(3)} / ${olc}`);
}

await prisma.$disconnect();
