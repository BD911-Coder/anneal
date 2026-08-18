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

// Enum'lar da olusmus mu — sadece public sema; Supabase kendi semalarinda
// (auth, storage, realtime) baska enum'lar tutar, onlar bizi ilgilendirmez.
const { rows: enums } = await client.query(
  `select t.typname, count(e.enumlabel)::int as n
   from pg_type t
   join pg_enum e on e.enumtypid = t.oid
   join pg_namespace n on n.oid = t.typnamespace
   where n.nspname = 'public'
   group by t.typname order by t.typname`,
);
console.log("\n--- Enum tipleri (public sema) ---");
for (const e of enums) console.log(`  ${e.typname.padEnd(22)} ${e.n} deger`);

// K7: Prisma'da takma adla yazilan degerler veritabanina dogru inmis mi?
// Kodda dev_seed yaziyor ama veritabaninda dev-seed olmali.
console.log("\n--- K7 takma adlari (veritabanindaki gercek degerler) ---");
const K7 = [
  ["Source", "dev-seed"],
  ["CpuMemoryType", "DDR4/DDR5"],
  ["FormFactor", "E-ATX"],
  ["StorageType", "sata-ssd"],
  ["Resolution", "1080p"],
];
let k7Sorun = 0;
for (const [type, label] of K7) {
  const { rows: r } = await client.query(
    `select 1 from pg_type t
     join pg_enum e on e.enumtypid = t.oid
     join pg_namespace n on n.oid = t.typnamespace
     where n.nspname = 'public' and t.typname = $1 and e.enumlabel = $2`,
    [type, label],
  );
  const ok = r.length > 0;
  if (!ok) k7Sorun++;
  console.log(`  [${ok ? "OK  " : "HATA"}] ${type}.'${label}'`);
}

await client.end();
if (pooled && pooled !== client) await pooled.end();

console.log("");
if (eksik.length || fazla.length || k7Sorun > 0) {
  if (eksik.length) console.log(`SONUC: EKSIK TABLO: ${eksik.join(", ")}`);
  if (fazla.length) console.log(`SONUC: BEKLENMEYEN TABLO: ${fazla.join(", ")}`);
  if (k7Sorun) console.log(`SONUC: ${k7Sorun} K7 takma adi veritabaninda yanlis`);
  process.exit(1);
}
console.log(
  `SONUC: ${expected.length} tablonun ${expected.length}'i mevcut, ` +
  `${enums.length} enum tipi olusmus, K7 takma adlari dogru.`,
);
