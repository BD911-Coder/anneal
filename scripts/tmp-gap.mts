import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
for (const f of [".env.local", ".env"]) if (existsSync(f)) loadEnvFile(f);
const { prisma } = await import("../data/client.ts");
const rows = await prisma.gpuSpecs.findMany({
  select: { part_id: true, memory_bandwidth_gbs: true, bus_width_bits: true, tdp_watt: true, transistor_count_m: true, part: { select: { brand: true, model: true } } },
});
const brands = new Map<string, {n:number; mb:number; bw:number; tr:number}>();
for (const r of rows) {
  const b = r.part.brand;
  const e = brands.get(b) ?? { n:0, mb:0, bw:0, tr:0 };
  e.n++; if (r.memory_bandwidth_gbs != null) e.mb++; if (r.bus_width_bits != null) e.bw++; if (r.transistor_count_m != null) e.tr++;
  brands.set(b, e);
}
for (const [b, e] of brands) console.log(`${b.padEnd(8)} cip ${e.n}  bant ${e.mb}  yol ${e.bw}  transistor ${e.tr}`);
console.log("\nbant genisligi BOS olanlar:");
for (const r of rows.filter(r => r.memory_bandwidth_gbs == null)) console.log(`  ${r.part_id.padEnd(28)} ${r.part.model}`);
await prisma.$disconnect();
