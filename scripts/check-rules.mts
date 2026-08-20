// Her uyumluluk kuralinin gercek veriyle tetiklenebildigini dogrular.
//
// Calistirma: npm run kural:kontrol
//
// Neden gerekli: veri gercek oldu diye kurallarin calistigi kanitlanmis olmaz.
// Bir kural, veritabaninda onu tetikleyecek parca cifti kalmadiysa sessizce
// olu koda doner ve kimse fark etmez. Bu script her kod icin somut bir cift
// bulur ve ekrana yazar; bulamazsa hata verir.
//
// Az sayida kombinasyonla ayakta duran kural da UYARI alir (hata degil).
// Sebebi yasanmis: W4 kataloga tek bir islemci girene kadar hic tetiklenmiyordu.
// Tek kombinasyona bagli bir kural, o parca katalogdan cikinca ayni sessizlige
// geri doner. Uyari hata degil cunku veri kumesinin kucuk olmasi bir hata degil
// bir risk — insanin bunu gormesi yeter.
//
// Motor burada da veritabanini tanimiyor: satirlar /data/to-engine ile motorun
// tiplerine cevriliyor, sonra motor cagriliyor. Yani arayuzun kullandigi yolun
// aynisi denenmis oluyor.

import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../lib/generated/prisma/client.ts";
import { checkCompatibility } from "../engine/compatibility.ts";
import type { BuildInput, FindingCode } from "../engine/types.ts";
import {
  toEngineCase,
  toEngineCpu,
  toEngineGpu,
  toEngineGpuVariant,
  toEngineMotherboard,
  toEnginePsu,
  toEngineRam,
} from "../data/to-engine.ts";
import { resolveGpuSelection } from "../engine/gpu-selection.ts";
import { FPS_MARGIN } from "../lib/fps-margin.ts";
import { PERF_MARGIN } from "../lib/perf-margin.ts";

for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) loadEnvFile(file);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL tanimli degil.");
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg(connectionString) });

// Sahte veri sayilmaz: kural ancak gercek parcayla tetiklenebiliyorsa gecer.
const real = { source: { not: "dev_seed" as const } };

const [cpuRows, gpuRows, variantRows, mbRows, ramRows, psuRows, caseRows] = await Promise.all([
  prisma.cpuSpecs.findMany({ where: real }),
  prisma.gpuSpecs.findMany({ where: real }),
  // Kart (AIB) satirlari da kullanicinin secebildigi ekran kartlaridir (K86).
  // C4 ve C5 icin kartin degeri cipinkinden farkli olabilir; kural sayimi
  // yalnizca cipe bakarsa gercek katalogun yarisini gormemis olur.
  prisma.gpuVariantSpecs.findMany({
    where: { ...real, chip: real },
    include: { chip: { include: { gpu_specs: true } } },
  }),
  prisma.motherboardSpecs.findMany({ where: real }),
  prisma.ramSpecs.findMany({ where: real }),
  prisma.psuSpecs.findMany({ where: real }),
  prisma.caseSpecs.findMany({ where: real }),
]);

const cpus = cpuRows.map(toEngineCpu);
const chipGpus = gpuRows.map(toEngineGpu);
// Cozumleme arayuzun kullandigi fonksiyonun aynisi: kartin degeri varsa o,
// yoksa K87'nin kurali isler.
const variantGpus = variantRows
  .filter((row) => row.chip.gpu_specs !== null)
  .map((row) => resolveGpuSelection(toEngineGpu(row.chip.gpu_specs!), toEngineGpuVariant(row)).gpu);
const gpus = [...chipGpus, ...variantGpus];
const mbs = mbRows.map(toEngineMotherboard);
const rams = ramRows.map(toEngineRam);
const psus = psuRows.map(toEnginePsu);
const cases = caseRows.map(toEngineCase);

console.log(
  `Gercek parca: ${cpus.length} cpu, ${chipGpus.length} cip + ${variantGpus.length} kart gpu, ${mbs.length} anakart, ` +
    `${rams.length} bellek, ${psus.length} psu, ${cases.length} kasa\n`,
);

/** Bir kural icin denenecek sistemler. Her kural yalnizca ilgilendigi
 *  parcalari koyar: fazladan parca baska bir kurali da tetikler ve ciktiyi
 *  okunmaz hale getirir. */
type Probe = { code: FindingCode; what: string; builds: () => Generator<BuildInput> };

function* pairs<A, B>(as: A[], bs: B[]): Generator<[A, B]> {
  for (const a of as) for (const b of bs) yield [a, b];
}

const probes: Probe[] = [
  {
    code: "C1",
    what: "islemci soketi != anakart soketi",
    *builds() {
      for (const [cpu, motherboard] of pairs(cpus, mbs)) yield { cpu, motherboard };
    },
  },
  {
    code: "C2",
    what: "bellek tipi != anakart bellek tipi",
    *builds() {
      for (const [ram, motherboard] of pairs(rams, mbs)) yield { ram, motherboard };
    },
  },
  {
    code: "C3",
    what: "modul sayisi > anakart yuva sayisi",
    *builds() {
      for (const [ram, motherboard] of pairs(rams, mbs)) yield { ram, motherboard };
    },
  },
  {
    code: "C4",
    what: "guc kaynagi gereken watti karsilamiyor",
    *builds() {
      for (const [cpu, gpu] of pairs(cpus, gpus)) for (const psu of psus) yield { cpu, gpu, psu };
    },
  },
  {
    code: "C5",
    what: "ekran karti kasaya sigmiyor",
    *builds() {
      for (const [gpu, c] of pairs(gpus, cases)) yield { gpu, case: c };
    },
  },
  {
    code: "C6",
    what: "anakart form faktoru kasa tarafindan desteklenmiyor",
    *builds() {
      for (const [motherboard, c] of pairs(mbs, cases)) yield { motherboard, case: c };
    },
  },
  {
    code: "W1",
    what: "bellek hizi anakartin destekledigini asiyor",
    *builds() {
      for (const [ram, motherboard] of pairs(rams, mbs)) yield { ram, motherboard };
    },
  },
  {
    code: "W2",
    what: "bellek kapasitesi anakartin destekledigini asiyor",
    *builds() {
      for (const [ram, motherboard] of pairs(rams, mbs)) yield { ram, motherboard };
    },
  },
  {
    code: "W3",
    what: "guc kaynagi yetiyor ama pay dar",
    *builds() {
      for (const [cpu, gpu] of pairs(cpus, gpus)) for (const psu of psus) yield { cpu, gpu, psu };
    },
  },
  {
    code: "W4",
    what: "ekran karti yok ve islemcide tumlesik grafik yok",
    *builds() {
      for (const cpu of cpus) yield { cpu };
    },
  },
  {
    code: "W5",
    what: "guc kaynagi kasaya sigmayabilir",
    *builds() {
      for (const [psu, c] of pairs(psus, cases)) yield { psu, case: c };
    },
  },
];

function describe(build: BuildInput): string {
  const ids = [build.cpu, build.gpu, build.motherboard, build.ram, build.psu, build.case]
    .filter((p) => p !== undefined)
    .map((p) => p!.id);
  return ids.join(" + ");
}

/**
 * Bu sayidan az kombinasyonla tetiklenen kural uyari alir.
 *
 * 3 secildi: iki kombinasyon cogu zaman tek bir parcanin iki farkli esine denk
 * geliyor (C5 bugun tek kasaya bagli, yalnizca GPU tarafi degisiyor). Ucuncu
 * kombinasyon genelde ikinci bir parcanin da isin icinde oldugunu gosteriyor.
 */
const AZ_KOMBINASYON_ESIGI = 3;

let failed = 0;
let warned = 0;

for (const probe of probes) {
  let hits = 0;
  let firstBuild: BuildInput | null = null;
  let firstMessage = "";

  for (const build of probe.builds()) {
    const finding = checkCompatibility(build).find((f) => f.code === probe.code);
    if (!finding) continue;
    hits++;
    if (firstBuild === null) {
      firstBuild = build;
      firstMessage = finding.message;
    }
  }

  if (firstBuild === null) {
    failed++;
    console.log(`${probe.code}  TETIKLENMEDI  — ${probe.what}`);
    console.log(`      Bu kurali tetikleyen gercek parca cifti YOK.\n`);
    continue;
  }

  const az = hits < AZ_KOMBINASYON_ESIGI;
  if (az) warned++;

  console.log(`${probe.code}  ${az ? "UYARI" : "tamam"}  — ${probe.what}`);
  console.log(`      ornek : ${describe(firstBuild)}`);
  console.log(`      mesaj : ${firstMessage}`);
  console.log(`      tetikleyen kombinasyon sayisi: ${hits}`);
  if (az) {
    console.log(
      `      Bu kural ${hits} kombinasyona bagli. Ilgili parcalardan biri` +
        ` katalogdan cikarsa kural sessizce olu koda doner.`,
    );
  }
  console.log();
}

// --- Hata payi eskidi mi? (K110) -------------------------------------------
//
// Arayuz iki hata payi gosteriyor ve ikisi de bir olcume dayaniyor. Olcumden
// sonra benchmark_points'a satir eklenirse sayilar sessizce eskir ve arayuz
// artik dogru olmayan bir kesinlik vaat eder. Bu tam olarak kacinilan hata
// sinifi: bir tur icinde iki kez elle guncellendi, ucuncude unutulacakti.
//
// Kontrol burada duruyor cunku veritabanina zaten bagli olan ve her is
// biriminden sonra calistirilan script bu.
const guncelNokta = await prisma.benchmarkPoint.count({ where: real });
const eskiyen: string[] = [];
for (const [ad, m, komut] of [
  ["lib/perf-margin.ts", PERF_MARGIN, "npm run indeks:sapma"],
  ["lib/fps-margin.ts", FPS_MARGIN, "npm run fps:sapma"],
] as const) {
  if (m.measuredAtPoints !== guncelNokta) {
    eskiyen.push(
      `  ${ad}: hata payi ${m.measuredAtPoints} olcumle hesaplanmis (${m.measuredAt}),` +
        ` su an ${guncelNokta} olcum var. Yeniden olc: ${komut}`,
    );
  }
}

await prisma.$disconnect();

if (eskiyen.length > 0) {
  console.error(`\nHATA: yayinlanan hata payi eskimis.\n${eskiyen.join("\n")}`);
  process.exit(1);
}
console.log(`Hata payi guncel: ${guncelNokta} olcumle hesaplanmis.`);

if (failed > 0) {
  console.error(`${failed} kural gercek veriyle tetiklenemiyor.`);
  process.exit(1);
}
console.log(`${probes.length} kuralin hepsi gercek veriyle tetiklenebiliyor.`);

if (warned > 0) {
  // Cikis kodu 0 kalir: bu bir hata degil, izlenmesi gereken bir incelik.
  console.log(
    `\nUYARI: ${warned} kural ${AZ_KOMBINASYON_ESIGI} kombinasyondan az ile ayakta.` +
      " Yukaridaki UYARI satirlarina bak.",
  );
}
