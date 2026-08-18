// Veritabani baglantisini ve tablolarin olustugunu dogrular.
//
// Calistirma: npm run db:kontrol
//
// Iki baglantiyi de ayri ayri dener (DATABASE_URL havuzlanmis, DIRECT_URL
// dogrudan), sonra public semadaki tablolari prisma/schema.prisma'daki
// @@map adlariyla karsilastirir.

import { existsSync, readFileSync } from "node:fs";
import { loadEnvFile } from "node:process";
import pg from "pg";

for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) loadEnvFile(file);
}

// Beklenen tablolar semadan okunur, elle yazilmaz
const schema = readFileSync("prisma/schema.prisma", "utf8");
const expected = [...schema.matchAll(/@@map\("([a-z_]+)"\)/g)].map((m) => m[1]).sort();

// Parolayi ciktiya sizdirmadan adresi ozetle
function safeSummary(url) {
  try {
    const u = new URL(url);
    return `${u.hostname}:${u.port || "5432"}${u.pathname}`;
  } catch {
    return "(adres cozumlenemedi)";
  }
}

async function tryConnect(label, url) {
  if (!url) {
    console.log(`  [HATA] ${label} tanimli degil`);
    return null;
  }
  const client = new pg.Client({ connectionString: url });
  try {
    await client.connect();
    const { rows } = await client.query("select version()");
    const version = rows[0].version.split(",")[0];
    console.log(`  [OK  ] ${label} -> ${safeSummary(url)}`);
    console.log(`         ${version}`);
    return client;
  } catch (err) {
    console.log(`  [HATA] ${label} -> ${safeSummary(url)}`);
    console.log(`         ${err.message}`);
    try { await client.end(); } catch {}
    return null;
  }
}

console.log("--- Baglanti ---");
const pooled = await tryConnect("DATABASE_URL (havuzlanmis)", process.env.DATABASE_URL);
const direct = await tryConnect("DIRECT_URL (dogrudan)", process.env.DIRECT_URL);

const client = direct ?? pooled;
if (!client) {
  console.log("\nSONUC: Hicbir baglanti kurulamadi.");
  process.exit(1);
}

console.log("\n--- Tablolar (public sema) ---");
const { rows } = await client.query(
  `select table_name from information_schema.tables
   where table_schema = 'public' and table_type = 'BASE TABLE'
   order by table_name`,
);
const actual = rows.map((r) => r.table_name);

const eksik = expected.filter((t) => !actual.includes(t));
const fazla = actual.filter((t) => !expected.includes(t) && !t.startsWith("_prisma"));

for (const t of expected) {
  console.log(`  [${actual.includes(t) ? "OK  " : "YOK "}] ${t}`);
}

// Satir sayilari — tablolarin gercekten sorgulanabildigini gosterir
console.log("\n--- Satir sayilari ---");
for (const t of expected.filter((t) => actual.includes(t))) {
  const { rows: c } = await client.query(`select count(*)::int as n from "${t}"`);
  console.log(`  ${t.padEnd(20)} ${c[0].n}`);
}

// Enum'lar da olusmus mu
const { rows: enums } = await client.query(
  `select t.typname, count(e.enumlabel)::int as n
   from pg_type t join pg_enum e on e.enumtypid = t.oid
   group by t.typname order by t.typname`,
);
console.log("\n--- Enum tipleri ---");
for (const e of enums) console.log(`  ${e.typname.padEnd(22)} ${e.n} deger`);

await client.end();
if (pooled && pooled !== client) await pooled.end();

console.log("");
if (eksik.length || fazla.length) {
  if (eksik.length) console.log(`SONUC: EKSIK TABLO: ${eksik.join(", ")}`);
  if (fazla.length) console.log(`SONUC: BEKLENMEYEN TABLO: ${fazla.join(", ")}`);
  process.exit(1);
}
console.log(`SONUC: ${expected.length} tablonun ${expected.length}'i mevcut, ${enums.length} enum tipi olusmus.`);
