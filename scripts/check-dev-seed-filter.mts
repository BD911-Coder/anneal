// dev-seed korumasinin 2. katmanini OLCER.
//
// Calistirma: npm run seed:filtre-kontrol
//
// Neden gerekli: filtrenin kodda yazili olmasi calistigini gostermez. Sahte
// parcalar silindikten sonra geriye gercek parcalara bagli sahte FIYAT satirlari
// kaldi (K64). Gercek bir parcanin yaninda uydurma fiyatin canliya cikmasi,
// sahte bir parcanin cikmasindan daha tehlikeli: kullanici parcanin gercek
// oldugunu gorur ve fiyata da inanir.
//
// Nasil olcer: /data katmanini iki ayri surecte, iki farkli NODE_ENV ile
// calistirir ve ne dondugune bakar. Iki surec sart — visibility.ts'teki IS_LIVE
// modul yuklenirken bir kez hesaplaniyor, tek surec icinde degistirilemez.
//
// Sinanan sey gercek fonksiyonlar: getCurrentPrices, getPerfIndexes,
// getBuilderCatalog. Sorgu burada yeniden yazilmiyor — yeniden yazilsaydi
// /data icindeki bir baglanti hatasi bu kontrolden kacardi.

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";

for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) loadEnvFile(file);
}

type ProbeResult = {
  nodeEnv: string;
  isLive: boolean;
  parts: number;
  prices: number;
  perfIndexes: number;
  /** getCurrentPrices'in dondurdugu, kaynagi dev-seed olan fiyatlar. Sizinti. */
  leakedPrices: string[];
  /** Veritabanindaki dev-seed fiyat satiri sayisi — sifirsa test bir sey kanitlamaz. */
  devSeedPriceRows: number;
};

// ---------------------------------------------------------------------------
// SONDA modu: tek bir NODE_ENV ile /data katmanini calistirir, sonucu yazar.
// ---------------------------------------------------------------------------
if (process.env.ANNEAL_FILTER_PROBE === "1") {
  const { getCurrentPrices } = await import("../data/prices.ts");
  const { getPerfIndexes } = await import("../data/perf.ts");
  const { getBuilderCatalog } = await import("../data/parts.ts");
  const { IS_LIVE } = await import("../data/visibility.ts");
  const { prisma } = await import("../data/client.ts");
  const { MODEL_VERSION } = await import("../engine/performance.ts");

  const prices = await getCurrentPrices();
  const perf = await getPerfIndexes(MODEL_VERSION);
  const catalog = await getBuilderCatalog();

  // Donen fiyatin kaynagini ogrenmenin tek yolu: satiri (part_id, collected_at)
  // ile geri bulmak. getCurrentPrices source dondurmuyor ve dondurmemeli —
  // arayuzun kaynak damgasiyla isi yok.
  const devSeedRows = await prisma.priceSnapshot.findMany({
    where: { source: "dev_seed" },
    select: { part_id: true, collected_at: true },
  });
  const devSeedKeys = new Set(
    devSeedRows.map((r) => `${r.part_id}|${r.collected_at.toISOString()}`),
  );

  const leakedPrices = Object.entries(prices)
    .filter(([partId, price]) => devSeedKeys.has(`${partId}|${price.collected_at}`))
    .map(([partId]) => partId);

  const result: ProbeResult = {
    nodeEnv: process.env.NODE_ENV ?? "(tanimsiz)",
    isLive: IS_LIVE,
    parts: Object.values(catalog).reduce((n, list) => n + list.length, 0),
    prices: Object.keys(prices).length,
    perfIndexes: Object.keys(perf).length,
    leakedPrices,
    devSeedPriceRows: devSeedRows.length,
  };

  await prisma.$disconnect();
  console.log(`ANNEAL_PROBE_JSON${JSON.stringify(result)}`);
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Yonetici modu: sondayi iki kez calistirir, karsilastirir.
// ---------------------------------------------------------------------------
function probe(nodeEnv: "development" | "production"): ProbeResult {
  const run = spawnSync(process.execPath, [import.meta.filename], {
    env: { ...process.env, ANNEAL_FILTER_PROBE: "1", NODE_ENV: nodeEnv },
    encoding: "utf8",
  });
  const line = (run.stdout ?? "").split("\n").find((l) => l.startsWith("ANNEAL_PROBE_JSON"));
  if (!line) {
    console.error(`Sonda calismadi (NODE_ENV=${nodeEnv}):`);
    console.error(run.stdout);
    console.error(run.stderr);
    process.exit(1);
  }
  return JSON.parse(line.slice("ANNEAL_PROBE_JSON".length)) as ProbeResult;
}

const dev = probe("development");
const live = probe("production");

function show(label: string, r: ProbeResult) {
  console.log(`${label} (NODE_ENV=${r.nodeEnv}, IS_LIVE=${r.isLive})`);
  console.log(`  katalog parcasi     : ${r.parts}`);
  console.log(`  gorunur fiyat       : ${r.prices}`);
  console.log(`  gorunur perf indeksi: ${r.perfIndexes}`);
  console.log(`  dev-seed fiyat sizan: ${r.leakedPrices.length}`);
  if (r.leakedPrices.length > 0) {
    console.log(`      ${r.leakedPrices.slice(0, 5).join(", ")}${r.leakedPrices.length > 5 ? " ..." : ""}`);
  }
  console.log();
}

console.log(`Veritabanindaki dev-seed fiyat satiri: ${dev.devSeedPriceRows}\n`);
show("GELISTIRME", dev);
show("CANLI     ", live);

const problems: string[] = [];

if (dev.devSeedPriceRows === 0) {
  problems.push(
    "Veritabaninda hic dev-seed fiyat satiri yok — bu kontrol hicbir sey kanitlamiyor.",
  );
}
if (live.leakedPrices.length > 0) {
  problems.push(
    `CANLI ortamda ${live.leakedPrices.length} dev-seed fiyat gorunuyor. 2. katman delik.`,
  );
}
if (dev.leakedPrices.length === 0 && dev.devSeedPriceRows > 0) {
  problems.push(
    "GELISTIRME ortaminda da dev-seed fiyat gorunmuyor. Filtre calisiyor gibi duruyor " +
      "ama aslinda veri hic gelmiyor olabilir; kontrol yanlis pozitif veriyor.",
  );
}

if (problems.length > 0) {
  console.error("SONUC: sorun var");
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

console.log("SONUC: dev-seed fiyatlar gelistirmede gorunuyor, canlida gorunmuyor.");
// perf_index filtreyle korunamaz: `source` sutunu yok ve olmayacak (K32).
// Cozum damgalamak degil, sahte satirin hic olmamasiydi (K71) — bu yuzden
// asagidaki sayi iki ortamda da ayni cikar ve dogru olan da bu.
if (dev.perfIndexes !== live.perfIndexes) {
  console.log(
    `\nNOT: perf indeksi iki ortamda farkli (${dev.perfIndexes} / ${live.perfIndexes}).` +
      " perf_index'te filtre yok; bu fark beklenmiyordu.",
  );
} else if (dev.perfIndexes > 0) {
  console.log(
    `\nNOT: ${dev.perfIndexes} perf indeksi iki ortamda da gorunuyor. perf_index` +
      " filtrelenmez (K32); satirlarin benchmark_points'tan hesaplandigindan emin ol (K71).",
  );
}
