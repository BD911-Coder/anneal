// SCHEMA.md ile prisma/schema.prisma arasindaki farklari bulur ve
// docs/KARARLAR.md'deki kararlarin uygulandigini dogrular.
//
// Calistirma: npm run sema:kontrol
//
// Bagimliligi yok, duz Node. Veritabani baglantisi gerektirmez.
// Hata bulursa 1 ile cikar, boylece dagitim oncesi kontrolde kullanilabilir.

import { readFileSync } from "node:fs";

const md = readFileSync("SCHEMA.md", "utf8");
const pr = readFileSync("prisma/schema.prisma", "utf8");

// ---------------------------------------------------------------------------
// SCHEMA.md ayristirma: tablo adi -> alan adlari
// ---------------------------------------------------------------------------
function parseMarkdown(text) {
  const tables = new Map();
  let current = null;

  for (const line of text.split("\n")) {
    const name = line.match(/^(?:###\s+|\*\*)`([a-z_]+)`/);
    if (name) {
      current = name[1];
      if (!tables.has(current)) tables.set(current, []);
      continue;
    }
    // Ust seviye baslik veya ayrac tablo baglamini kapatir
    if (line.startsWith("## ") || line.trim() === "---") {
      current = null;
      continue;
    }
    if (!current || !line.startsWith("|")) continue;

    const firstCell = line.match(/^\|\s*(.+?)\s*\|/);
    if (!firstCell) continue;
    // Bir hucrede virgulle ayrilmis birden fazla alan olabilir
    for (const [, field] of firstCell[1].matchAll(/`([a-z_0-9]+)`/g)) {
      if (!tables.get(current).includes(field)) tables.get(current).push(field);
    }
  }
  return tables;
}

// SCHEMA.md bolum 11'deki belgelenmis indeksler -> "tablo(sutun,sutun)"
function parseDocumentedIndexes(text) {
  const set = new Set();
  const section = text.split(/^## 11\. İndeksler$/m)[1];
  if (!section) return set;
  const body = section.split(/^## /m)[0];

  for (const line of body.split("\n")) {
    if (!line.startsWith("|")) continue;
    const cells = line.split("|").map((c) => c.trim());
    if (cells.length < 3) continue;
    const table = cells[1].match(/`([a-z_]+)`/);
    if (!table) continue;
    const cols = [...cells[2].matchAll(/`([a-z_]+)`/g)].map((m) => m[1]);
    if (cols.length === 0) continue;
    set.add(`${table[1]}(${cols.join(",")})`);
  }
  return set;
}

// ---------------------------------------------------------------------------
// prisma/schema.prisma ayristirma
// ---------------------------------------------------------------------------
function parsePrisma(text) {
  const modelNames = new Set([...text.matchAll(/^model\s+(\w+)/gm)].map((m) => m[1]));
  const tables = new Map();   // tablo -> alan adlari
  const types = new Map();    // tablo -> { alan: tip }
  const indexes = new Set();  // "tablo(sutun,sutun)"
  const raw = new Map();      // tablo -> model govdesi

  for (const [, body] of text.matchAll(/^model\s+\w+\s*\{([\s\S]*?)^\}/gm)) {
    const mapped = body.match(/@@map\("([a-z_]+)"\)/);
    if (!mapped) continue;
    const table = mapped[1];

    const fields = [];
    const fieldTypes = {};
    for (const line of body.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.startsWith("//") || trimmed.startsWith("@@")) continue;
      const field = line.match(/^\s{2,}(\w+)\s+(\w+)(\?|\[\])?/);
      if (!field) continue;
      const [, fname, ftype, suffix = ""] = field;
      if (modelNames.has(ftype)) continue; // iliski alani, DB sutunu degil
      fields.push(fname);
      fieldTypes[fname] = ftype + suffix;
    }

    // @@index ve @@unique belgelenmek zorunda; @@id birincil anahtardir, haric
    for (const [, cols] of body.matchAll(/@@(?:index|unique)\(\[([^\]]+)\]\)/g)) {
      const list = cols.split(",").map((c) => c.trim()).join(",");
      indexes.add(`${table}(${list})`);
    }

    tables.set(table, fields);
    types.set(table, fieldTypes);
    raw.set(table, body);
  }
  return { tables, types, indexes, raw };
}

// ---------------------------------------------------------------------------
// Kontroller
// ---------------------------------------------------------------------------
const mdTables = parseMarkdown(md);
const documentedIndexes = parseDocumentedIndexes(md);
const { tables: prTables, types: prTypes, indexes: prIndexes, raw: prRaw } = parsePrisma(pr);

const APPEND_ONLY = ["price_snapshots", "benchmark_points"];
const SPEC = ["gpu_specs", "cpu_specs", "motherboard_specs", "ram_specs",
              "psu_specs", "storage_specs", "case_specs"];
const NO_OWN_ID = [...SPEC, "build_items"];
const QUARTET = ["source", "source_url", "confidence", "collected_at"];
const WITH_QUARTET = [...SPEC, "parts", "games", "price_snapshots", "benchmark_points"];
const EXEMPT = ["builds", "build_items", "click_events", "feedback", "perf_index"];

const problems = [];
let checks = 0;

function check(label, ok, detail = "") {
  checks++;
  console.log(`  [${ok ? "OK  " : "HATA"}] ${label}${!ok && detail ? ` -> ${detail}` : ""}`);
  if (!ok) problems.push(`${label} ${detail}`.trim());
}

console.log(`SCHEMA.md tablo sayisi : ${mdTables.size}`);
console.log(`Prisma tablo sayisi    : ${prTables.size}\n`);

for (const t of [...mdTables.keys()].filter((t) => !prTables.has(t)))
  problems.push(`Sadece SCHEMA.md'de: ${t}`);
for (const t of [...prTables.keys()].filter((t) => !mdTables.has(t)))
  problems.push(`Sadece Prisma'da: ${t}`);

console.log("--- Alan karsilastirmasi ---");
const ORTAK = ["id", "created_at", "updated_at", ...QUARTET];
for (const t of [...mdTables.keys()].sort()) {
  if (!prTables.has(t)) continue;
  const mdF = mdTables.get(t);
  const prF = prTables.get(t);
  const eksik = mdF.filter((f) => !prF.includes(f));
  const fazla = prF.filter((f) => !mdF.includes(f) && !ORTAK.includes(f));
  if (eksik.length) problems.push(`${t}: EKSIK ${eksik.join(", ")}`);
  if (fazla.length) problems.push(`${t}: FAZLA ${fazla.join(", ")}`);
  const mark = eksik.length || fazla.length ? "!!" : "  ";
  console.log(`${mark} ${t.padEnd(20)} md ${String(mdF.length).padStart(2)} / prisma ${String(prF.length).padStart(2)}`);
}

console.log("\n--- Kararlar (docs/KARARLAR.md) ---");

// K1 — append-only tablolarda updated_at yok
for (const t of APPEND_ONLY) {
  check(`K1 ${t}: updated_at yok`, !prTables.get(t).includes("updated_at"));
  check(`K1 ${t}: created_at var`, prTables.get(t).includes("created_at"));
}

// K2 — ayri id yok, spec'lerde part_id birincil anahtar, build_items bilesik
for (const t of NO_OWN_ID) check(`K2 ${t}: ayri id yok`, !prTables.get(t).includes("id"));
for (const t of SPEC)
  check(`K2 ${t}: part_id birincil anahtar`, /part_id\s+String\s+@id/.test(prRaw.get(t)));
check("K2 build_items: bilesik anahtar", /@@id\(\[build_id,\s*part_id\]\)/.test(prRaw.get("build_items")));

// K3 — olgusal iddia dortlusu
for (const t of WITH_QUARTET) {
  const yok = QUARTET.filter((q) => !prTables.get(t).includes(q));
  check(`K3 ${t}: dortlu tam`, yok.length === 0, yok.join(", "));
}
for (const t of EXEMPT) {
  const varOlan = QUARTET.filter((q) => prTables.get(t).includes(q));
  check(`K3 ${t}: muaf, dortlu yok`, varOlan.length === 0, varOlan.join(", "));
}
check("K3 raw_imports: sadece kendi source'u",
  prTables.get("raw_imports").filter((f) => f === "source").length === 1 &&
  !prTables.get("raw_imports").includes("confidence"));

// K4, K5, K6
check("K4 benchmark_points.source_url zorunlu",
  prTypes.get("benchmark_points").source_url === "String",
  String(prTypes.get("benchmark_points").source_url));
check("K5 case_specs.supported_form_factors enum dizisi",
  prTypes.get("case_specs").supported_form_factors === "FormFactor[]",
  String(prTypes.get("case_specs").supported_form_factors));
check("K6 raw_imports.source serbest metin",
  prTypes.get("raw_imports").source === "String",
  String(prTypes.get("raw_imports").source));

// K14 — perf_index
check("K14 perf_index: updated_at yok", !prTables.get("perf_index").includes("updated_at"));
check("K14 perf_index: (part_id, model_version) unique",
  /@@unique\(\[part_id,\s*model_version\]\)/.test(prRaw.get("perf_index")));

// K15 — her indeks SCHEMA.md bolum 11'de tanimli olmali
console.log("\n--- Indeksler (K15: SCHEMA.md bolum 11'de tanimli olmali) ---");
for (const idx of [...prIndexes].sort())
  check(`K15 ${idx} belgelenmis`, documentedIndexes.has(idx));
for (const idx of [...documentedIndexes].sort())
  check(`K15 ${idx} semada var`, prIndexes.has(idx));

// ---------------------------------------------------------------------------
console.log("");
if (problems.length > 0) {
  console.log(`SONUC: ${problems.length} SORUN (${checks} kontrol calisti)`);
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}
console.log(`SONUC: ${checks} kontrolun tamami gecti.`);
