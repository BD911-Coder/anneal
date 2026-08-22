// Fiziksel makullük denetimi — iki değerin birbirini kısıtladığı her yer.
//
// Çalıştırma: npm run makul:kontrol
//
// **Neden var:** RTX 5060 Ti'da saklanan 576 GB/s, 128 bit veri yoluyla
// 36 Gbps bellek ima ediyordu ve öyle bir bellek yok (K171). O hata tek bir
// alana bakarak görünmüyordu; **iki alanın birbiriyle çelişmesinden** çıktı.
//
// Aynı desen katalogda başka yerlerde de var: bir kartın belleği veri yoluna
// bölünebilmeli, önerilen güç kaynağı TDP'den küçük olamaz, aynı mimarideki
// iki çipin transistör/çekirdek oranı birbirinden kat kat ayrılamaz.
//
// Bu script o kısıtları tek yerde topluyor. Her ihlal, onu işaretleyen
// GEREKÇEYLE birlikte basılıyor: "şu sayı şu sayıyla şöyle çelişiyor".
//
// ---------------------------------------------------------------------------
// NE YAPMAZ
// ---------------------------------------------------------------------------
//
// Bu bir doğruluk kontrolü DEĞİL. Makul bir değer yanlış olabilir; imkânsız
// bir değer kesin yanlıştır. Script yalnızca ikincisini yakalar. RTX 5060'ın
// eski 480 GB/s değeri (30 Gbps) bu denetimden GEÇERDİ — onu dış kaynakla
// karşılaştırma yakaladı (K171).
//
// Eşikler ve aralıklar BİRER KARAR, ölçüm değil. Geniş tutuldular: amaç dar
// bir doğrulama değil, "böyle bir şey yok" diyebilmek.

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

const cizgi = (s = "=") => console.log(s.repeat(78));

type Ihlal = {
  kural: string;
  partId: string;
  gerekce: string;
};

const ihlaller: Ihlal[] = [];
/** Kaç kontrol gerçekten çalıştı — alanı eksik olan satır sayılmaz. */
let kontrol = 0;
/** Alan eksikliği yüzünden çalışamayan kontroller. */
const calisamayan = new Map<string, number>();

function calistir(kural: string, uygulanabilir: boolean, gecti: boolean, partId: string, gerekce: string) {
  if (!uygulanabilir) {
    calisamayan.set(kural, (calisamayan.get(kural) ?? 0) + 1);
    return;
  }
  kontrol += 1;
  if (!gecti) ihlaller.push({ kural, partId, gerekce });
}

// ===========================================================================
// EKRAN KARTI ÇİPİ
// ===========================================================================

/**
 * Bellek tipine göre makul hız aralığı — pin başına Gbps.
 * JEDEC sınıflarının uçlarından ve piyasadaki ürünlerden, geniş tutuldu.
 */
const HIZ_ARALIGI: Record<string, { alt: number; ust: number }> = {
  GDDR5: { alt: 4, ust: 9 },
  GDDR5X: { alt: 9, ust: 13 },
  GDDR6: { alt: 12, ust: 21 },
  GDDR6X: { alt: 18, ust: 25 },
  "GDDR6/GDDR6X": { alt: 12, ust: 25 },
  GDDR7: { alt: 26, ust: 33 },
  HBM2: { alt: 1.5, ust: 2.5 },
  HBM2E: { alt: 2.4, ust: 3.7 },
};

/** Tip ne olursa olsun bunun dışı fiziksel olarak yok. */
const MUTLAK_HIZ = { alt: 1, ust: 34 };

/** Üretilen GDDR yongası kapasiteleri, gigabit. Ara değer yok. */
const YONGA_GBIT = [8, 12, 16, 24, 32];

/** Marka ile shader birimi adı eşleşmek zorunda (K57/K58). */
const MARKA_BIRIM: Record<string, string> = {
  NVIDIA: "cuda_core",
  AMD: "stream_processor",
  Intel: "xe_vector_engine",
};

const cipler = await prisma.gpuSpecs.findMany({
  include: { part: { select: { brand: true, model: true } } },
  orderBy: { part_id: "asc" },
});

for (const c of cipler) {
  const id = c.part_id;

  // --- 1. Bant genişliği <-> veri yolu <-> bellek tipi ---------------------
  const bwVar = c.memory_bandwidth_gbs !== null && c.bus_width_bits !== null;
  if (bwVar) {
    const gbps = Math.round(((c.memory_bandwidth_gbs! * 8) / c.bus_width_bits!) * 100) / 100;
    calistir(
      "bant genisligi -> ortuk bellek hizi (mutlak)",
      true,
      gbps >= MUTLAK_HIZ.alt && gbps <= MUTLAK_HIZ.ust,
      id,
      `${c.memory_bandwidth_gbs} GB/s @ ${c.bus_width_bits} bit = ${gbps} Gbps; ` +
        `hicbir bellek tipi ${MUTLAK_HIZ.alt}-${MUTLAK_HIZ.ust} araligi disinda uretilmiyor`,
    );
    const aralik = HIZ_ARALIGI[c.vram_type];
    calistir(
      "bant genisligi -> ortuk bellek hizi (tipe gore)",
      aralik !== undefined,
      aralik === undefined || (gbps >= aralik.alt && gbps <= aralik.ust),
      id,
      aralik
        ? `${gbps} Gbps, ${c.vram_type} icin beklenen ${aralik.alt}-${aralik.ust}`
        : `${c.vram_type} icin aralik tanimli degil`,
    );
  } else {
    calisamayan.set("bant genisligi -> ortuk bellek hizi", (calisamayan.get("bant genisligi -> ortuk bellek hizi") ?? 0) + 1);
  }

  // --- 2. VRAM <-> veri yolu <-> yonga kapasitesi -------------------------
  //
  // Bellek yongalari 32 bit genisliginde. Veri yolu / 32 = yonga sayisi.
  // Toplam bellek o yongalara TAM bolunmek zorunda ve yonga basina dusen
  // kapasite uretilen bir kapasite olmali. Clamshell (arkali onlu) dizilim
  // yonga sayisini ikiye katliyor, o yuzden iki secenek de kabul ediliyor.
  if (c.bus_width_bits !== null) {
    const yonga = c.bus_width_bits / 32;
    const tekil = (c.vram_gb * 8) / yonga;
    const clamshell = (c.vram_gb * 8) / (yonga * 2);
    calistir(
      "VRAM -> veri yolu -> yonga kapasitesi",
      true,
      YONGA_GBIT.includes(tekil) || YONGA_GBIT.includes(clamshell),
      id,
      `${c.vram_gb} GB / ${c.bus_width_bits} bit -> yonga basina ${tekil} Gbit ` +
        `(clamshell ${clamshell} Gbit); uretilen kapasiteler: ${YONGA_GBIT.join(", ")} Gbit`,
    );
  }

  // --- 3. TDP <-> onerilen guc kaynagi ------------------------------------
  //
  // Onerilen guc kaynagi kartin kendi tuketiminden kucuk olamaz; ustten sinir
  // ise sacmalik siniri: sistemin geri kalani icin makul bir pay biraksa bile
  // kartin bes katini gecmez.
  if (c.recommended_psu_watt !== null) {
    calistir(
      "TDP -> onerilen guc kaynagi",
      true,
      c.recommended_psu_watt > c.tdp_watt && c.recommended_psu_watt <= c.tdp_watt * 5 + 200,
      id,
      `TDP ${c.tdp_watt} W, onerilen guc kaynagi ${c.recommended_psu_watt} W`,
    );
  }

  // --- 4. Marka <-> shader birimi tipi ------------------------------------
  if (c.shader_unit_type !== null) {
    const beklenen = MARKA_BIRIM[c.part.brand];
    calistir(
      "marka -> shader birimi tipi",
      beklenen !== undefined,
      beklenen === undefined || c.shader_unit_type === beklenen,
      id,
      `${c.part.brand} kartinda ${c.shader_unit_type}; beklenen ${beklenen}. ` +
        `shader_units yalnizca ayni tip icinde karsilastirilabilir (K57)`,
    );
  }

  // --- 5. Boost saati fiziksel aralik -------------------------------------
  if (c.boost_clock_mhz !== null) {
    calistir(
      "boost saati araligi",
      true,
      c.boost_clock_mhz >= 300 && c.boost_clock_mhz <= 4000,
      id,
      `boost ${c.boost_clock_mhz} MHz — ekran kartlarinda 300-4000 MHz disi gorulmedi`,
    );
  }
}

// --- 6. Aile içinde transistör / shader oranı -------------------------------
//
// Aynı mimarideki iki çip aynı tasarım bloklarından kuruluyor: shader birimi
// başına düşen transistör bütçesi birbirine yakın olmak zorunda. Kat kat
// ayrılan bir oran, iki alandan birinin yanlış olduğunu söyler.
//
// Pay geniş: ×3. Aynı ailede küçük çipler orantısız çok "çekirdek dışı"
// (bellek denetleyici, video motoru) taşıyor ve oran gerçekten kayıyor.
const aileOrani = new Map<string, { id: string; oran: number }[]>();
for (const c of cipler) {
  if (c.transistor_count_m === null || c.shader_units === null || c.shader_units === 0) continue;
  if (!c.architecture_family) continue;
  const oran = (c.transistor_count_m * 1_000_000) / c.shader_units;
  aileOrani.set(c.architecture_family, [
    ...(aileOrani.get(c.architecture_family) ?? []),
    { id: c.part_id, oran },
  ]);
}
for (const [aile, liste] of aileOrani) {
  if (liste.length < 3) {
    calisamayan.set("aile ici transistor/shader orani", (calisamayan.get("aile ici transistor/shader orani") ?? 0) + liste.length);
    continue;
  }
  const sirali = [...liste].sort((a, b) => a.oran - b.oran);
  const medyan = sirali[Math.floor(sirali.length / 2)].oran;
  for (const e of liste) {
    calistir(
      "aile ici transistor/shader orani",
      true,
      e.oran / medyan <= 3 && medyan / e.oran <= 3,
      e.id,
      `${aile} ailesinde shader basina ${Math.round(e.oran / 1000)} bin transistor; ` +
        `aile medyani ${Math.round(medyan / 1000)} bin (pay x3)`,
    );
  }
}

// ===========================================================================
// EKRAN KARTI VARYANTI (AIB kartı) — çipiyle kısıtlı
// ===========================================================================

const kartlar = await prisma.gpuVariantSpecs.findMany({
  include: { chip: { select: { id: true, gpu_specs: { select: { tdp_watt: true, boost_clock_mhz: true } } } } },
  orderBy: { part_id: "asc" },
});

for (const k of kartlar) {
  const cip = k.chip.gpu_specs;
  if (!cip) continue;

  // Kart, çipin referans gücünden aşağı inmez ve iki katını geçmez: fabrika
  // hızlandırması güç limitini yükseltir ama kartı başka bir çip yapmaz.
  if (k.tbp_watt !== null) {
    calistir(
      "kart TBP -> cip TDP",
      true,
      k.tbp_watt >= cip.tdp_watt * 0.8 && k.tbp_watt <= cip.tdp_watt * 2,
      k.part_id,
      `kart ${k.tbp_watt} W, cip referansi ${cip.tdp_watt} W`,
    );
  }
  // Fabrika hızı referansın altına inmez (aşağı bin bir hata ya da yanlış çip).
  if (k.boost_clock_mhz !== null && cip.boost_clock_mhz !== null) {
    calistir(
      "kart boost -> cip boost",
      true,
      k.boost_clock_mhz >= cip.boost_clock_mhz * 0.95 && k.boost_clock_mhz <= cip.boost_clock_mhz * 1.3,
      k.part_id,
      `kart ${k.boost_clock_mhz} MHz, cip referansi ${cip.boost_clock_mhz} MHz`,
    );
  }
  // OC hızı normal hızın altında olamaz.
  if (k.boost_clock_oc_mhz !== null && k.boost_clock_mhz !== null) {
    calistir(
      "kart OC hizi -> kart hizi",
      true,
      k.boost_clock_oc_mhz >= k.boost_clock_mhz,
      k.part_id,
      `OC ${k.boost_clock_oc_mhz} MHz, normal ${k.boost_clock_mhz} MHz`,
    );
  }
  // Fiziksel ölçüler: ATX kart yuvası 21 mm; kalınlık slot sayısı olarak
  // veriliyor ve 4 slotu geçen tüketici kartı yok.
  if (k.length_mm !== null) {
    calistir(
      "kart uzunlugu araligi",
      true,
      k.length_mm >= 120 && k.length_mm <= 400,
      k.part_id,
      `uzunluk ${k.length_mm} mm — tuketici kartlarinda 120-400 mm disi gorulmedi`,
    );
  }
  if (k.thickness_slots !== null) {
    calistir(
      "kart kalinligi araligi",
      true,
      k.thickness_slots >= 1 && k.thickness_slots <= 5,
      k.part_id,
      `kalinlik ${k.thickness_slots} slot`,
    );
  }
}

// ===========================================================================
// İŞLEMCİ
// ===========================================================================

const islemciler = await prisma.cpuSpecs.findMany({
  include: { part: { select: { brand: true } } },
  orderBy: { part_id: "asc" },
});

for (const c of islemciler) {
  // SMT en fazla iki iş parçacığı üretir; iş parçacığı çekirdekten az olamaz.
  calistir(
    "cekirdek -> is parcacigi",
    true,
    c.threads >= c.cores && c.threads <= c.cores * 2,
    c.part_id,
    `${c.cores} cekirdek, ${c.threads} is parcacigi; SMT en fazla ikiye katlar`,
  );
  // Boost taban hızın altına inmez.
  calistir(
    "taban -> boost saati",
    true,
    c.boost_clock_mhz >= c.base_clock_mhz,
    c.part_id,
    `taban ${c.base_clock_mhz} MHz, boost ${c.boost_clock_mhz} MHz`,
  );
  // Saat aralığı.
  calistir(
    "islemci saat araligi",
    true,
    c.base_clock_mhz >= 800 && c.boost_clock_mhz <= 7000,
    c.part_id,
    `taban ${c.base_clock_mhz} MHz, boost ${c.boost_clock_mhz} MHz`,
  );
  // L3 çekirdek başına: X3D parçaları üç katına çıkarıyor, pay ona göre.
  if (c.l3_cache_mb !== null) {
    const perCore = c.l3_cache_mb / c.cores;
    calistir(
      "cekirdek basina L3",
      true,
      perCore >= 0.5 && perCore <= 20,
      c.part_id,
      `${c.l3_cache_mb} MB / ${c.cores} cekirdek = ${perCore.toFixed(1)} MB; ` +
        `X3D parcalari ust ucta durur ama 20 MB'i gecmez`,
    );
  }
}

// ===========================================================================
// DİĞER KATEGORİLER
// ===========================================================================

const ramler = await prisma.ramSpecs.findMany({ orderBy: { part_id: "asc" } });
for (const r of ramler) {
  // Kit toplamı modül sayısına tam bölünmeli: 32 GB'lik 3 modüllük kit yok.
  calistir(
    "kit kapasitesi -> modul sayisi",
    true,
    r.module_count > 0 && Number.isInteger(r.capacity_gb / r.module_count),
    r.part_id,
    `${r.capacity_gb} GB / ${r.module_count} modul = ${(r.capacity_gb / r.module_count).toFixed(2)} GB`,
  );
  // Hız, bellek kuşağının aralığında olmalı. Üst uç JEDEC değil PİYASA:
  // XMP/EXPO kitleri JEDEC tavanının çok üstünde satılıyor ve katalogdaki
  // satırlar o kitler.
  const aralik = r.memory_type === "DDR5" ? { alt: 3600, ust: 10000 } : { alt: 1600, ust: 5000 };
  calistir(
    "bellek hizi -> bellek kusagi",
    true,
    r.speed_mhz >= aralik.alt && r.speed_mhz <= aralik.ust,
    r.part_id,
    `${r.memory_type} ${r.speed_mhz} MT/s; beklenen ${aralik.alt}-${aralik.ust}`,
  );
  calistir(
    "CAS gecikmesi araligi",
    true,
    r.cas_latency >= 10 && r.cas_latency <= 60,
    r.part_id,
    `CL${r.cas_latency}`,
  );
}

const psuler = await prisma.psuSpecs.findMany({ orderBy: { part_id: "asc" } });
for (const p of psuler) {
  calistir(
    "guc kaynagi wattaji araligi",
    true,
    p.wattage >= 200 && p.wattage <= 2000,
    p.part_id,
    `${p.wattage} W`,
  );
  // ATX12V standardi: 140 mm'den kisa ve 250 mm'den uzun ATX guc kaynagi yok.
  if (p.length_mm !== null) {
    calistir(
      "guc kaynagi uzunlugu araligi",
      true,
      p.length_mm >= 100 && p.length_mm <= 250,
      p.part_id,
      `${p.length_mm} mm — ATX12V icin 100-250 mm disi gorulmedi`,
    );
  }
}

const kasalar = await prisma.caseSpecs.findMany({ orderBy: { part_id: "asc" } });
for (const k of kasalar) {
  if (k.max_gpu_length_mm !== null) {
    calistir(
      "kasa ekran karti acikligi",
      true,
      k.max_gpu_length_mm >= 150 && k.max_gpu_length_mm <= 600,
      k.part_id,
      `${k.max_gpu_length_mm} mm`,
    );
  }
  if (k.max_cpu_cooler_height_mm !== null) {
    calistir(
      "kasa sogutucu acikligi",
      true,
      k.max_cpu_cooler_height_mm >= 30 && k.max_cpu_cooler_height_mm <= 220,
      k.part_id,
      `${k.max_cpu_cooler_height_mm} mm`,
    );
  }
  if (k.max_psu_length_mm !== null) {
    calistir(
      "kasa guc kaynagi acikligi",
      true,
      k.max_psu_length_mm >= 100 && k.max_psu_length_mm <= 400,
      k.part_id,
      `${k.max_psu_length_mm} mm`,
    );
  }
}

const anakartlar = await prisma.motherboardSpecs.findMany({ orderBy: { part_id: "asc" } });
for (const a of anakartlar) {
  // Azami bellek, yuva sayısına bölündüğünde makul bir modül boyutu vermeli.
  calistir(
    "azami bellek -> yuva sayisi",
    true,
    a.memory_slots > 0 && a.max_memory_gb / a.memory_slots >= 8 && a.max_memory_gb / a.memory_slots <= 256,
    a.part_id,
    `${a.max_memory_gb} GB / ${a.memory_slots} yuva = ${(a.max_memory_gb / a.memory_slots).toFixed(0)} GB modul`,
  );
  // DİKKAT: bu alan anakartın DESTEKLEDİĞİ AZAMİ hız ve üreticiler oraya
  // hep aşırı hızlandırma (OC) rakamını yazıyor — "DDR5-9200+(OC)". Bellek
  // kitinin kendi aralığından ayrı ve daha geniş.
  //
  // İlk eşik (DDR4 4600 / DDR5 9000) dört anakartı işaretledi ve bakıldığında
  // DÖRDÜ DE DOĞRUYDU: Z890 kartları gerçekten DDR5-9200 yazıyor. Eşik
  // gevşetildi — veri değil.
  const aralik = a.memory_type === "DDR5" ? { alt: 3600, ust: 13000 } : { alt: 1600, ust: 6000 };
  calistir(
    "anakart bellek hizi -> kusak (OC tavani)",
    true,
    a.max_memory_speed_mhz >= aralik.alt && a.max_memory_speed_mhz <= aralik.ust,
    a.part_id,
    `${a.memory_type} ${a.max_memory_speed_mhz} MT/s; beklenen ${aralik.alt}-${aralik.ust}`,
  );
  calistir(
    "M.2 yuva sayisi araligi",
    true,
    a.m2_slots >= 0 && a.m2_slots <= 8,
    a.part_id,
    `${a.m2_slots} M.2 yuvasi`,
  );
}

const depolamalar = await prisma.storageSpecs.findMany({ orderBy: { part_id: "asc" } });
for (const d of depolamalar) {
  calistir(
    "depolama kapasitesi araligi",
    true,
    d.capacity_gb >= 120 && d.capacity_gb <= 16000,
    d.part_id,
    `${d.capacity_gb} GB`,
  );
  // Arayüz, sürücü türünün fiziksel sınırını aşamaz: SATA 600 MB/s ile
  // sınırlı, NVMe Gen5 ~14000 MB/s.
  if (d.read_speed_mbs !== null) {
    const sata = /sata/i.test(d.interface);
    calistir(
      "okuma hizi -> arayuz",
      true,
      sata ? d.read_speed_mbs <= 600 : d.read_speed_mbs <= 16000,
      d.part_id,
      `${d.interface} arayuzunde ${d.read_speed_mbs} MB/s; ` +
        `SATA III'un teorik tavani 600 MB/s`,
    );
  }
}

// ===========================================================================
// RAPOR
// ===========================================================================

console.log("FIZIKSEL MAKULLUK DENETIMI");
console.log("Iki degerin birbirini kisitladigi her yer.\n");

console.log(`Calisan kontrol : ${kontrol}`);
console.log(`Ihlal           : ${ihlaller.length}\n`);

if (calisamayan.size > 0) {
  console.log("ALAN EKSIK OLDUGU ICIN CALISAMAYAN KONTROLLER");
  for (const [kural, adet] of [...calisamayan.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(adet).padStart(4)}  ${kural}`);
  }
  console.log();
}

// Semada karşılığı olmayan kısıtlar da yazılıyor: kapsamın nerede bittiğini
// gizlememek, kapsamı büyütmek kadar önemli.
console.log("SEMADA ALANI OLMADIGI ICIN KURULAMAYAN KISITLAR");
console.log("  dolgu hizi <-> saat <-> ROP sayisi : fillrate ve ROP sutunu YOK");
console.log("  cip alani <-> transistor yogunlugu : die_size sutunu YOK");
console.log("  guc konnektoru <-> TBP             : power_connectors serbest metin (S38)");
console.log();

cizgi();
if (ihlaller.length === 0) {
  console.log(`SONUC: ${kontrol} kontrolun tamami gecti.`);
  await prisma.$disconnect();
  process.exit(0);
}
console.log(`SONUC: ${ihlaller.length} IHLAL (${kontrol} kontrol calisti)`);
cizgi();
const gruplu = new Map<string, Ihlal[]>();
for (const i of ihlaller) gruplu.set(i.kural, [...(gruplu.get(i.kural) ?? []), i]);
for (const [kural, liste] of gruplu) {
  console.log(`\n  ${kural.toUpperCase()} — ${liste.length} ihlal`);
  for (const i of liste) console.log(`    ${i.partId.padEnd(30)} ${i.gerekce}`);
}
await prisma.$disconnect();
process.exit(1);
