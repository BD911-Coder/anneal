// SCHEMA.md ile prisma/schema.prisma arasindaki farklari bulur ve
// docs/KARARLAR.md'deki kararlarin uygulandigini dogrular.
//
// Calistirma: npm run sema:kontrol
//
// Bagimliligi yok, duz Node. Veritabani baglantisi gerektirmez.
// Hata bulursa 1 ile cikar, boylece dagitim oncesi kontrolde kullanilabilir.

import { readdirSync, readFileSync } from "node:fs";

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

// engine/types.ts icindeki Engine* tiplerinin alanlari
function parseEngineTypes(text) {
  const types = new Map();
  for (const [, name, body] of text.matchAll(/export type (Engine\w+) = \{([\s\S]*?)\n\};/g)) {
    const fields = [];
    for (const line of body.split("\n")) {
      const m = line.match(/^\s+(\w+)\s*\??:/);
      if (m) fields.push(m[1]);
    }
    types.set(name, fields);
  }
  return types;
}

// ---------------------------------------------------------------------------
// Kontroller
// ---------------------------------------------------------------------------
const mdTables = parseMarkdown(md);
const documentedIndexes = parseDocumentedIndexes(md);
const { tables: prTables, types: prTypes, indexes: prIndexes, raw: prRaw } = parsePrisma(pr);

const APPEND_ONLY = ["price_snapshots", "benchmark_points"];
const SPEC = ["gpu_specs", "gpu_variant_specs", "cpu_specs", "motherboard_specs",
              "ram_specs", "psu_specs", "storage_specs", "case_specs"];
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

// K14 — perf_index (tekillik kismi K35'te degistirildi)
check("K14 perf_index: updated_at yok", !prTables.get("perf_index").includes("updated_at"));
check("K35 perf_index: (part_id, workload, model_version) unique",
  /@@unique\(\[part_id,\s*workload,\s*model_version\]\)/.test(prRaw.get("perf_index")));

// K35 — is yuku alani iki tabloda da var ve varsayilani yok.
// Varsayilan olsaydi is yukunu soylemeyi unutan kayit sessizce 'gaming' olurdu;
// alanin var olma sebebi tam olarak bunu engellemek.
for (const t of ["benchmark_points", "perf_index"]) {
  check(`K35 ${t}: workload alani var`, prTables.get(t).includes("workload"));
  check(`K35 ${t}: workload zorunlu (Workload tipi)`,
    prTypes.get(t).workload === "Workload", String(prTypes.get(t).workload));
  check(`K35 ${t}: workload varsayilani yok`,
    !new RegExp(`workload\\s+Workload[^\\n]*@default`).test(prRaw.get(t)));
}
check("K35 Workload enum dort degerli",
  /enum Workload \{[^}]*gaming[^}]*ai_inference[^}]*video_encode[^}]*productivity[^}]*\}/s.test(pr));

// K15 — her indeks SCHEMA.md bolum 11'de tanimli olmali
console.log("\n--- Indeksler (K15: SCHEMA.md bolum 11'de tanimli olmali) ---");
for (const idx of [...prIndexes].sort())
  check(`K15 ${idx} belgelenmis`, documentedIndexes.has(idx));
for (const idx of [...documentedIndexes].sort())
  check(`K15 ${idx} semada var`, prIndexes.has(idx));

// K22 — engine/types.ts alan adlari SCHEMA.md ile ayrismis mi?
//
// Motor tipleri semanin ALT KUMESI: sadece uyumluluk kurallarinin kullandigi
// alanlar var. Bu yuzden kontrol tek yonlu — motordaki her alan semada olmali,
// tersi degil. "id" haric: o parts tablosundan gelir.
console.log("\n--- Motor tipleri (K22: engine/types.ts <-> SCHEMA.md) ---");
const ENGINE_TABLE = {
  EngineCpu: "cpu_specs",
  EngineGpu: "gpu_specs",
  EngineMotherboard: "motherboard_specs",
  EngineRam: "ram_specs",
  EnginePsu: "psu_specs",
  EngineCase: "case_specs",
  // Kart (AIB) tipi de semaya bagli: alanlari gpu_variant_specs'te olmali (K86).
  EngineGpuVariant: "gpu_variant_specs",
};
const engineTypes = parseEngineTypes(readFileSync("engine/types.ts", "utf8"));
for (const [typeName, table] of Object.entries(ENGINE_TABLE)) {
  const fields = engineTypes.get(typeName);
  if (!fields) {
    check(`K22 ${typeName} bulundu`, false, "engine/types.ts icinde yok");
    continue;
  }
  const bilinmeyen = fields.filter((f) => f !== "id" && !(mdTables.get(table) ?? []).includes(f));
  check(`K22 ${typeName} -> ${table}`, bilinmeyen.length === 0, `semada yok: ${bilinmeyen.join(", ")}`);
}

// /engine kurali — bu klasordeki hicbir dosya veritabani, ag, dosya sistemi
// veya React ice aktarmaz. CLAUDE.md bu kuralin sessizce esnetilmemesini istiyor.
console.log("\n--- /engine saflik kontrolu ---");
const YASAK = [
  ["prisma", /from\s+["'][^"']*prisma/],
  ["react/next", /from\s+["'](react|next)/],
  ["dosya sistemi / surec", /from\s+["']node:/],
  ["veritabani surucusu", /from\s+["']pg["']/],
  ["/data veya /lib", /from\s+["'][^"']*(\/data\/|\/lib\/|@\/data|@\/lib)/],
  ["fetch cagrisi", /\bfetch\s*\(/],
];
const engineFiles = readdirSync("engine").filter((f) => f.endsWith(".ts"));
for (const file of engineFiles) {
  const source = readFileSync(`engine/${file}`, "utf8")
    .split("\n")
    .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*"))
    .join("\n");
  const ihlaller = YASAK.filter(([, re]) => re.test(source)).map(([ad]) => ad);
  check(`engine/${file} saf`, ihlaller.length === 0, ihlaller.join(", "));
}

// K25 — veritabani istemcisine sadece /data erisebilir.
//
// dev-seed filtresi data/parts.ts icinde zorunlu. Baska bir katman prisma
// istemcisini dogrudan alirsa filtreyi atlayabilir; o zaman filtre "zorunlu"
// olmaktan cikip "hatirlanmasi gereken" bir sey olur.
console.log("\n--- Veri erisimi (K25: data/client sadece /data icinden) ---");
function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "generated") continue;
    const full = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx|mts)$/.test(entry.name)) out.push(full);
  }
  return out;
}
const disariKatmanlar = ["app", "engine", "lib", "tests"];
const ihlalEdenler = [];
for (const dir of disariKatmanlar) {
  for (const file of walk(dir)) {
    const source = readFileSync(file, "utf8");
    if (/from\s+["'][^"']*data\/client["']/.test(source)) ihlalEdenler.push(file);
  }
}
check("K25 data/client disaridan ice aktarilmiyor", ihlalEdenler.length === 0, ihlalEdenler.join(", "));

// K56 — zorunlu alan olcutu: bir alan ancak bir uyumluluk kurali ya da arayuz
// tarafindan kullaniliyorsa zorunlu olabilir.
//
// Bu bir UYARI'dir, hata degil: kullanilmayan zorunlu alan bir tasarim
// kokusudur, kirik kod degil. Cikis kodunu etkilemez.
//
// Kapsam: yedi kategori spec tablosu + games. games 2026-08-20 denetiminde
// eklendi; disarida kaldigi surece gpu_weight/cpu_weight gibi kullanilmayan
// zorunlu alanlar kontrolun kor noktasindaydi.
//
// benchmark_points ve perf_index KAPSAM DISI ve bu bilincli: o tablolarin
// alanlari /data icinde tuketiliyor, ama tarama kaynagi engine/ + app/ ile
// sinirli. /data eklenirse to-engine.ts butun spec alanlarini "kullanilmis"
// gosterir ve kontrol islevini kaybeder. Bkz. SORULAR.md S44.
//
// Kimlik ve koken alanlari (part_id, source, collected_at...) haric — onlar
// kural icin degil kayit icin var.
console.log("\n--- Zorunlu alan kullanimi (K56) ---");
const KOKEN = ["part_id", "id", "source", "source_url", "confidence",
               "collected_at", "created_at", "updated_at",
               // Insan tarafindan okunan kimlik. Arayuzde gorunur ama alan
               // adiyla degil (games.name -> game_name); alan adi arandiginda
               // bulunamiyor ve yanlis pozitif uretiyor. parts.brand/model de
               // ayni rolde ve zaten kapsam disi.
               "name"];
const kullanimKaynagi = [...walk("engine"), ...walk("app")]
  .map((f) => readFileSync(f, "utf8"))
  .join("\n");

const kullanilmayan = [];
for (const table of [...SPEC, "games"]) {
  const body = prRaw.get(table) ?? "";
  for (const line of body.split("\n")) {
    const m = line.match(/^\s{2,}(\w+)\s+(\w+)(\?|\[\])?/);
    if (!m || line.trim().startsWith("//") || line.trim().startsWith("@@")) continue;
    const [, fname, , suffix = ""] = m;
    // prTables yalnizca gercek sutunlari tutar; iliski alanlari (part) disarida.
    if (!(prTables.get(table) ?? []).includes(fname)) continue;
    if (suffix === "?" || KOKEN.includes(fname)) continue; // opsiyonel ya da koken
    if (!new RegExp(`\\b${fname}\\b`).test(kullanimKaynagi)) {
      kullanilmayan.push(`${table}.${fname}`);
    }
  }
}
if (kullanilmayan.length === 0) {
  console.log("  [OK  ] her zorunlu alan engine/ ya da app/ icinde kullaniliyor");
} else {
  console.log(`  [UYARI] ${kullanilmayan.length} zorunlu alan hicbir kural ya da arayuzde kullanilmiyor:`);
  for (const alan of kullanilmayan) console.log(`          ${alan}`);
  console.log("          K56: kullanilmayan alan zorunlu olmamali. Opsiyonel yapilmasi");
  console.log("          dusunulmeli — zorunluluk, kaynagin o alani yayinlamasina bagimlilik yaratir.");
}

// K57 — shader_units dolu olan her CSV satirinda shader_unit_type da dolu olmali.
// Sayinin ne saydigi bilinmeden o sayi kullanilamaz; bos tip, sessizce yanlis
// karsilastirmaya kapi acar.
console.log("\n--- shader_units / shader_unit_type (K57) ---");
const csvDir = "data/parts";
let k57Sorun = 0;
for (const file of readdirSync(csvDir).filter((f) => f.startsWith("gpu") && f.endsWith(".csv"))) {
  const satirlar = readFileSync(`${csvDir}/${file}`, "utf8").trim().split("\n");
  const basliklar = satirlar[0].split(",").map((h) => h.trim());
  const iUnits = basliklar.indexOf("shader_units");
  const iType = basliklar.indexOf("shader_unit_type");
  if (iUnits === -1) continue;
  if (iType === -1) {
    check(`K57 ${file}: shader_unit_type sutunu var`, false, "sutun yok");
    k57Sorun++;
    continue;
  }
  const eksik = satirlar.slice(1).filter((satir) => {
    const h = satir.split(",");
    return (h[iUnits] ?? "").trim() !== "" && (h[iType] ?? "").trim() === "";
  }).length;
  check(`K57 ${file}: her shader_units'in tipi var`, eksik === 0, `${eksik} satirda tip bos`);
  if (eksik > 0) k57Sorun++;
}
if (k57Sorun === 0) console.log("  (tum gpu CSV'lerinde tutarli)");

// ---------------------------------------------------------------------------
// KARARLAR.md numara butunlugu
//
// Neden burada: karar numarasi koda ve yorumlara atif olarak giriyor
// ("K90 geregi..."). Ayni numara iki karara verilirse atif hangisini
// gosterdigini soyleyemez hale gelir ve bu SESSIZ olur. Uc kez yasandi:
// K91 (2026-08-20), K89 ve K90 (ayni gun, denetimde bulundu).
// ---------------------------------------------------------------------------
console.log("\n--- KARARLAR.md numaralari ---");
{
  const kararMd = readFileSync("docs/KARARLAR.md", "utf8");
  // Yalnizca "### K<sayi> —" bicimi bir KARAR basligidir. "### K95 ile K91:"
  // gibi karsilastirma basliklari sayilmaz.
  const numaralar = [...kararMd.matchAll(/^### (K\d+[a-z]?) —/gm)].map((m) => m[1]);
  const gorulen = new Map();
  const cift = [];
  for (const n of numaralar) {
    if (gorulen.has(n)) cift.push(n);
    gorulen.set(n, true);
  }
  check(
    "Karar numaralari tekil",
    cift.length === 0,
    cift.length ? `cift numara: ${[...new Set(cift)].join(", ")}` : "",
  );
  console.log(`  (${numaralar.length} karar okundu)`);
}

console.log("");
if (problems.length > 0) {
  console.log(`SONUC: ${problems.length} SORUN (${checks} kontrol calisti)`);
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}
console.log(`SONUC: ${checks} kontrolun tamami gecti.`);
