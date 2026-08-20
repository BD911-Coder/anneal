// dev-seed verisini veritabanindan siler.
//
// Calistirma: npm run seed:temizle
//
// Ne zaman kullanilir: bir kategorinin gercek uretici verisi tamamlandiginda,
// o kategorinin sahte satirlari artik yaniltici. Silinmezse arayuzde gercek
// parcalarin yaninda duruyor olurlar.
//
// Neden ayri bir script: silme geri alinamaz. Elle SQL yazmak yerine
// tek yerde durur, ne sildigi ekrana yazilir ve ayni guvenlik kontrolunu
// seed script'inden aynen devralir.
//
// SIRALAMA onemli: parts satirina bagli her tablo once temizlenir.
// build_items silinince yarim kalan sistemler (builds) de silinir; eksik
// parcali bir sistem kaydi hicbir ise yaramaz.

import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import pg from "pg";

import { sadeceGelistirmeVeritabani } from "./guard-dev-db.mjs";

for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) loadEnvFile(file);
}

sadeceGelistirmeVeritabani("Temizlik", "veri siler");

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL tanimli degil.");
  process.exit(1);
}

const client = new pg.Client({ connectionString });
await client.connect();

const { rows: before } = await client.query(
  "select category, count(*)::int as n from parts where source = 'dev-seed' group by 1 order by 1",
);
if (before.length === 0) {
  console.log("Silinecek dev-seed satiri yok.");
  await client.end();
  process.exit(0);
}

console.log("Silinecek dev-seed parcalari:");
for (const r of before) console.log(`  ${r.category}: ${r.n}`);

const DEV = "(select id from parts where source = 'dev-seed')";

// Once bagli satirlar, sonra parts. Sirayi bozmak foreign key hatasi verir.
const steps = [
  // Etkilenen sistemler once bir kenara yazilir: build_items silindikten sonra
  // "hangi sistem etkilenmisti" sorusunun cevabi kalmaz.
  ["(etkilenen sistemler isaretlendi)",
   `create temporary table doomed_builds on commit drop as
      select distinct build_id from build_items where part_id in ${DEV}`],
  ["build_items", "delete from build_items where build_id in (select build_id from doomed_builds)"],
  ["builds (yarim kalan sistemler)",
   "delete from builds where id in (select build_id from doomed_builds)"],
  ["price_snapshots", `delete from price_snapshots where part_id in ${DEV}`],
  ["perf_index", `delete from perf_index where part_id in ${DEV}`],
  ["click_events", `delete from click_events where part_id in ${DEV}`],
  ["benchmark_points",
   `delete from benchmark_points where gpu_part_id in ${DEV} or cpu_part_id in ${DEV}`],
  ["cpu_specs", `delete from cpu_specs where part_id in ${DEV}`],
  // Kart satiri cipten ONCE silinir: gpu_variant_specs.chip_part_id parts'a
  // bakiyor ve cip satiri once silinirse yabanci anahtar patlar (K86).
  ["gpu_variant_specs", `delete from gpu_variant_specs where part_id in ${DEV} or chip_part_id in ${DEV}`],
  ["gpu_specs", `delete from gpu_specs where part_id in ${DEV}`],
  ["motherboard_specs", `delete from motherboard_specs where part_id in ${DEV}`],
  ["ram_specs", `delete from ram_specs where part_id in ${DEV}`],
  ["psu_specs", `delete from psu_specs where part_id in ${DEV}`],
  ["storage_specs", `delete from storage_specs where part_id in ${DEV}`],
  ["case_specs", `delete from case_specs where part_id in ${DEV}`],
  ["parts", "delete from parts where source = 'dev-seed'"],
];

try {
  await client.query("begin");
  console.log("\nSilinen satirlar:");
  for (const [label, sql] of steps) {
    const res = await client.query(sql);
    if (res.rowCount > 0) console.log(`  ${label}: ${res.rowCount}`);
  }
  await client.query("commit");
} catch (err) {
  await client.query("rollback");
  console.error("\nHata, hicbir sey silinmedi:", err.message);
  await client.end();
  process.exit(1);
}

const { rows: after } = await client.query(
  "select count(*)::int as n from parts where source = 'dev-seed'",
);
console.log(`\nKalan dev-seed parcasi: ${after[0].n}`);

await client.end();
