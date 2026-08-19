// Kart (AIB) varyantı desteğini OLÇER — K86, K87.
//
// Calistirma: npm run varyant:kontrol
//
// Uc soruyu ayri ayri olcuyor:
//   1. Mevcut cip satirlari bozuldu mu?
//   2. Kart secmeyen kullanicinin akisi degisti mi?
//   3. Kart secilince C4 ve C5 gercekten kartin degerini mi kullaniyor?
//
// Sinanan sey gercek kod: getBuilderCatalog, resolveGpuSelection ve
// checkCompatibility dogrudan cagriliyor. Sorgu ya da cozumleme burada yeniden
// yazilsaydi, olculen sey asil kod olmazdi (npm run seed:filtre-kontrol ile
// ayni gerekce).

import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";

for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) loadEnvFile(file);
}

const { getBuilderCatalog } = await import("../data/parts.ts");
const { prisma } = await import("../data/client.ts");
const { resolveGpuSelection, resolvePerfIndex } = await import("../engine/gpu-selection.ts");
const { checkCompatibility, requiredWattage } = await import("../engine/compatibility.ts");
const { getPerfIndexes } = await import("../data/perf.ts");
const { MODEL_VERSION } = await import("../engine/performance.ts");

const sorunlar: string[] = [];
let kontrol = 0;

function check(label: string, ok: boolean, detay = ""): void {
  kontrol++;
  console.log(`  [${ok ? "OK  " : "HATA"}] ${label}${!ok && detay ? ` -> ${detay}` : ""}`);
  if (!ok) sorunlar.push(`${label} ${detay}`.trim());
}

// ---------------------------------------------------------------------------
// 1. Cip satirlari
// ---------------------------------------------------------------------------
console.log("--- 1. Cip satirlari bozulmadi mi ---");

const cipSayisi = await prisma.gpuSpecs.count();
const kartSayisi = await prisma.gpuVariantSpecs.count();
const gpuParcaSayisi = await prisma.part.count({ where: { category: "gpu" } });

console.log(`  gpu_specs (cip)          : ${cipSayisi}`);
console.log(`  gpu_variant_specs (kart) : ${kartSayisi}`);
console.log(`  parts.category = 'gpu'   : ${gpuParcaSayisi}`);

check(
  "cip + kart = toplam gpu parcasi",
  cipSayisi + kartSayisi === gpuParcaSayisi,
  `${cipSayisi} + ${kartSayisi} != ${gpuParcaSayisi}`,
);

// Bir parca ya cip ya karttir; ikisi birden olamaz (SCHEMA.md bolum 2).
const ikisiBirden = await prisma.part.count({
  where: { gpu_specs: { isNot: null }, gpu_variant_specs: { isNot: null } },
});
check("hicbir parca hem cip hem kart degil", ikisiBirden === 0, `${ikisiBirden} parca`);

// Hiyerarsi iki seviye: kartin cipi, cip olmak zorunda.
const kartlar = await prisma.gpuVariantSpecs.findMany({
  select: { part_id: true, chip_part_id: true, chip: { select: { gpu_specs: { select: { part_id: true } } } } },
});
const cipsizKartlar = kartlar.filter((kart) => !kart.chip.gpu_specs).map((k) => k.part_id);
check("her kartin cipi bir cip satiri", cipsizKartlar.length === 0, cipsizKartlar.join(", "));

// Cip satirlarinin icerigi degismedi mi? Imza tum satirlarin metin halinden
// uretiliyor; tek bir hucre degisse imza degisir.
const [{ sig }] = await prisma.$queryRawUnsafe<{ sig: string }[]>(
  "select md5(string_agg(t::text, '|' order by t.part_id)) as sig from gpu_specs t",
);
console.log(`  gpu_specs imzasi         : ${sig}`);
console.log("  (varyant oncesi olculen imza: 9730f18749f0effdc171610b7b63613d)");
check("gpu_specs imzasi varyant oncesiyle ayni", sig === "9730f18749f0effdc171610b7b63613d", sig);

// ---------------------------------------------------------------------------
// 2. Kart secmeyen kullanicinin akisi
// ---------------------------------------------------------------------------
console.log("\n--- 2. Kart secmeyen akis degisti mi ---");

const catalog = await getBuilderCatalog();
console.log(`  katalog.gpu (cip listesi): ${catalog.gpu.length}`);
console.log(`  katalog.gpu_variant      : ${catalog.gpu_variant.length}`);

check(
  "cip listesi yalnizca cipleri iceriyor",
  catalog.gpu.length === cipSayisi,
  `${catalog.gpu.length} != ${cipSayisi}`,
);

const kartIdleri = new Set(catalog.gpu_variant.map((v) => v.id));
check(
  "kartlar cip listesine sizmiyor",
  catalog.gpu.every((item) => !kartIdleri.has(item.id)),
);

// Kart secilmemis hal, cipin kendisiyle birebir ayni olmali: cozumleme bu yolda
// hicbir seyi degistirmemeli. 60 cipin hepsi tek tek karsilastiriliyor.
const degisenler = catalog.gpu.filter((item) => {
  const cozulmus = resolveGpuSelection(item.spec);
  return (
    cozulmus.gpu.id !== item.spec.id ||
    cozulmus.gpu.tdp_watt !== item.spec.tdp_watt ||
    cozulmus.gpu.length_mm !== item.spec.length_mm
  );
});
check(
  `kart secilmeyince cipin degerleri aynen geciyor (${catalog.gpu.length} cip)`,
  degisenler.length === 0,
  degisenler.map((d) => d.id).join(", "),
);

const perfIndexes = await getPerfIndexes(MODEL_VERSION);
const indeksliCipler = catalog.gpu.filter(
  (item) => resolvePerfIndex(perfIndexes, item.id).origin === "chip",
).length;
console.log(`  indeksi olan cip         : ${indeksliCipler}`);
check("cip indeksleri okunmaya devam ediyor", indeksliCipler > 0, "hicbir cipte indeks yok");

// ---------------------------------------------------------------------------
// 3. Kart secilince hangi sayi kullaniliyor
// ---------------------------------------------------------------------------
console.log("\n--- 3. Kart secilince C4/C5 hangi degeri kullaniyor ---");

function sec<T extends { id: string }>(liste: T[], tercih: string): T | undefined {
  return liste.find((item) => item.id === tercih) ?? liste[0];
}

const cpu = sec(catalog.cpu, "amd-ryzen-7-9800x3d");
const psu = [...catalog.psu].sort((a, b) => b.spec.wattage - a.spec.wattage)[0];
const kasa = sec(catalog.case, "fractal-design-north");

if (!cpu || !psu || !kasa || catalog.gpu_variant.length === 0) {
  console.log("  Olcum yapilamadi: katalogda islemci/guc kaynagi/kasa ya da kart yok.");
  console.log("  (kart yoksa `npm run db:seed` dev-seed kartlari yazar)");
} else {
  console.log(`  Sabit parcalar: ${cpu.id} (${cpu.spec.tdp_watt}W), ${psu.id} (${psu.spec.wattage}W), ${kasa.id} (${kasa.spec.max_gpu_length_mm} mm)\n`);

  // Kartlari olan bir cip sec; hepsi ayni cipe bagliysa o cip.
  const cipId = catalog.gpu_variant[0].chip_part_id;
  const cip = catalog.gpu.find((item) => item.id === cipId);
  if (!cip) throw new Error(`Kartin cipi katalogda yok: ${cipId}`);

  const satirlar: { etiket: string; secim?: (typeof catalog.gpu_variant)[number] }[] = [
    { etiket: `CIP  ${cip.id}` },
    ...catalog.gpu_variant
      .filter((variant) => variant.chip_part_id === cipId)
      .map((variant) => ({ etiket: `KART ${variant.id}`, secim: variant })),
  ];

  console.log(
    "  " +
      "secim".padEnd(34) +
      "tdp".padEnd(6) +
      "kaynak".padEnd(17) +
      "uzunluk".padEnd(9) +
      "kaynak".padEnd(17) +
      "gerekli W  bulgular",
  );

  for (const satir of satirlar) {
    const cozulmus = resolveGpuSelection(cip.spec, satir.secim?.spec);
    const bulgular = checkCompatibility({
      cpu: cpu.spec,
      gpu: cozulmus.gpu,
      psu: psu.spec,
      case: kasa.spec,
    });
    const gerekli = requiredWattage(cpu.spec.tdp_watt, cozulmus.gpu.tdp_watt);
    const kodlar = bulgular.map((f) => f.code).join(",") || "-";
    console.log(
      "  " +
        satir.etiket.padEnd(34) +
        String(cozulmus.gpu.tdp_watt).padEnd(6) +
        cozulmus.tdp_origin.padEnd(17) +
        String(cozulmus.gpu.length_mm ?? "-").padEnd(9) +
        cozulmus.length_origin.padEnd(17) +
        String(gerekli).padEnd(11) +
        kodlar,
    );
  }

  console.log("");

  // Asil iddia: kartin kendi degeri varsa o kullanilir, yoksa K87 uygulanir.
  for (const variant of catalog.gpu_variant.filter((v) => v.chip_part_id === cipId)) {
    const cozulmus = resolveGpuSelection(cip.spec, variant.spec);

    if (variant.spec.tbp_watt !== undefined) {
      check(
        `${variant.id}: C4 kartin TBP'sini kullaniyor`,
        cozulmus.gpu.tdp_watt === variant.spec.tbp_watt && cozulmus.tdp_origin === "variant",
        `${cozulmus.gpu.tdp_watt} / ${cozulmus.tdp_origin}`,
      );
    } else {
      check(
        `${variant.id}: TBP'si yok, C4 cipin tdp_watt'ina geri dustu (K87)`,
        cozulmus.gpu.tdp_watt === cip.spec.tdp_watt && cozulmus.tdp_origin === "chip_reference",
        `${cozulmus.gpu.tdp_watt} / ${cozulmus.tdp_origin}`,
      );
    }

    if (variant.spec.length_mm !== undefined) {
      check(
        `${variant.id}: C5 kartin uzunlugunu kullaniyor`,
        cozulmus.gpu.length_mm === variant.spec.length_mm && cozulmus.length_origin === "variant",
        `${cozulmus.gpu.length_mm} / ${cozulmus.length_origin}`,
      );
    } else {
      check(
        `${variant.id}: uzunlugu yok, cipin olcusune DUSMEDI, C5 atlandi (K87)`,
        cozulmus.gpu.length_mm === undefined && cozulmus.length_origin === "unknown",
        `${cozulmus.gpu.length_mm} / ${cozulmus.length_origin}`,
      );
    }

    check(
      `${variant.id}: bulgularda kartin kimligi gorunuyor`,
      cozulmus.gpu.id === variant.id,
      cozulmus.gpu.id,
    );

    // Bugun hicbir kartin kendi indeksi yok ve olmamali (K71, K74).
    const indeks = resolvePerfIndex(perfIndexes, cipId, variant.id);
    check(
      `${variant.id}: indeks cipten geliyor, kart indeksi uydurulmuyor`,
      indeks.origin !== "variant" || perfIndexes[variant.id] !== undefined,
      String(indeks.origin),
    );
  }
}

// ---------------------------------------------------------------------------
// 4. Kart iceren sistem kaydedilebiliyor mu
// ---------------------------------------------------------------------------
//
// saveBuild indeksi kayit aninda donduruyor (K43) ve kart kaydedildiginde
// indeksi kartin cipinden okumak zorunda. Bu yol yalnizca burada olculebiliyor:
// tarayicidan gecen bir kayit, hangi indeksin donduguna bakmiyor.
console.log("\n--- 4. Kart iceren sistem kaydi (indeks cipten donuyor mu) ---");

const { IS_LIVE } = await import("../data/visibility.ts");
if (IS_LIVE) {
  console.log("  Atlandi: canli ortamda kayit denemesi yapilmaz.");
} else {
  const { saveBuild } = await import("../data/builds.ts");
  const { getCurrentPrices } = await import("../data/prices.ts");
  const fiyatlar = await getCurrentPrices();

  const kart = catalog.gpu_variant.find((variant) => fiyatlar[variant.id]);
  // Islemcide hem fiyat hem indeks aranıyor: indeksi olmayan islemci secilirse
  // sistem indeksi zaten null doner (K44) ve olcum kartla ilgili bir sey
  // soylemez. Boylesi yoksa asagida indeks iddiasi kurulmuyor.
  const islemci =
    catalog.cpu.find((item) => fiyatlar[item.id] && perfIndexes[item.id] !== undefined) ??
    catalog.cpu.find((item) => fiyatlar[item.id]);

  if (!kart || !islemci) {
    console.log("  Olcum yapilamadi: fiyati olan kart ya da islemci yok.");
  } else {
    const beklenen = resolvePerfIndex(perfIndexes, kart.chip_part_id, kart.id);
    const sonuc = await saveBuild([kart.id, islemci.id], "1440p");

    if (!sonuc.ok) {
      check(`kart iceren sistem kaydedildi (${kart.id})`, false, sonuc.reason);
    } else {
      const kayit = await prisma.build.findUnique({
        where: { id: sonuc.id },
        include: { build_items: { select: { part_id: true } } },
      });
      const parcalar = kayit?.build_items.map((item) => item.part_id) ?? [];

      console.log(`  kaydedilen parcalar : ${parcalar.join(", ")}`);
      console.log(`  donan indeks        : ${kayit?.perf_index_snapshot}`);
      console.log(`  cipin indeksi       : ${beklenen.value ?? "-"} (${beklenen.origin})`);

      check("kaydedilen satir kartin kendisi", parcalar.includes(kart.id));
      check("cip ayrica kaydedilmedi", !parcalar.includes(kart.chip_part_id));
      // Iddia ancak iki ucun da indeksi varsa kurulabilir.
      if (beklenen.value !== undefined && perfIndexes[islemci.id] !== undefined) {
        check(
          "indeks hesaplandi (kartin cipinden okundu)",
          kayit?.perf_index_snapshot !== null && kayit?.perf_index_snapshot !== undefined,
          String(kayit?.perf_index_snapshot),
        );
      } else {
        console.log("  (indeks iddiasi kurulmadi: islemcinin ya da cipin indeksi yok)");
      }

      // Olcum satirini birakmiyoruz: gelistirme veritabanini kirletmesin.
      await prisma.buildItem.deleteMany({ where: { build_id: sonuc.id } });
      await prisma.build.delete({ where: { id: sonuc.id } });
      console.log(`  (olcum kaydi silindi: ${sonuc.id})`);
    }
  }
}

// ---------------------------------------------------------------------------
console.log("");
if (sorunlar.length > 0) {
  console.log(`SONUC: ${sorunlar.length} SORUN (${kontrol} kontrol calisti)`);
  for (const sorun of sorunlar) console.log(`  - ${sorun}`);
  process.exit(1);
}
console.log(`SONUC: ${kontrol} kontrolun tamami gecti.`);
