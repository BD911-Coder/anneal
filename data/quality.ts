// Veri kalitesi panosunun okuma yolu — `/veri` (K177).
//
// Beş script'e dağılmış olan "veri ne durumda" bilgisini tek yerde topluyor:
// alan başına kapsam ve kaynak, aile başına ölçülen/tahmin, bantlar, dış
// kaynaklı alanlar ve makullük ihlalleri.
//
// **Salt okunur.** Hiçbir fonksiyon yazmıyor.

import { estimate, fitCrossFamily, fitFamily } from "../engine/index-prediction.ts";
import type { MeasuredPoint } from "../engine/index-prediction.ts";
import { makulluk } from "../lib/plausibility.ts";
import type { Ihlal } from "../lib/plausibility.ts";
import { prisma } from "./client.ts";
import { visibleParts } from "./visibility.ts";

export type AlanKapsami = {
  tablo: string;
  alan: string;
  dolu: number;
  toplam: number;
  /** Kaynak damgası -> kaç alan. Damgasızlar "—" altında. */
  kaynaklar: Record<string, number>;
};

export type AileDurumu = {
  tur: "gpu" | "cpu";
  aile: string;
  parca: number;
  olculen: number;
  tahmin: number;
  /** Ailenin bugün taşıdığı bant ve nereden geldiği. */
  bandPct: number | null;
  bandKaynagi: "kendi ailesi" | "aileler arasi" | "hesaplanamiyor";
};

export type VeriKalitesi = {
  alanKapsami: AlanKapsami[];
  aileler: AileDurumu[];
  ihlaller: Ihlal[];
  makullukKontrol: number;
  disKaynakliAlan: { partId: string; alan: string; kaynak: string; makale: string | null; revizyon: number | null }[];
  /** Spec'inin TAMAMI dış kaynaktan gelen parça sayısı. */
  tamamenDisKaynakli: number;
  toplamParca: number;
  olculenToplam: number;
};

/** Panoda gösterilen spec tabloları ve alanları. */
const TABLOLAR: { tablo: string; alanlar: string[] }[] = [
  {
    tablo: "gpu_specs",
    alanlar: [
      "chipset", "vram_gb", "vram_type", "tdp_watt", "length_mm", "recommended_psu_watt",
      "pcie_version", "shader_units", "shader_unit_type", "boost_clock_mhz",
      "memory_bandwidth_gbs", "bus_width_bits", "architecture_family", "transistor_count_m",
    ],
  },
  {
    tablo: "cpu_specs",
    alanlar: [
      "socket", "cores", "threads", "base_clock_mhz", "boost_clock_mhz", "tdp_watt",
      "memory_type", "has_igpu", "l3_cache_mb", "architecture_family",
    ],
  },
];

const MODEL_VERSION = "v0.2";

export async function getVeriKalitesi(): Promise<VeriKalitesi> {
  const [gpuSpecs, cpuSpecs, kartlar, ramler, psuler, kasalar, anakartlar, depolamalar, damgalar, olcumler, tahminler, parcaSayi] =
    await Promise.all([
      prisma.gpuSpecs.findMany({ where: { part: visibleParts() }, include: { part: { select: { brand: true } } } }),
      prisma.cpuSpecs.findMany({ where: { part: visibleParts() } }),
      prisma.gpuVariantSpecs.findMany({
        where: { part: visibleParts() },
        include: { chip: { select: { gpu_specs: { select: { tdp_watt: true, boost_clock_mhz: true } } } } },
      }),
      prisma.ramSpecs.findMany({ where: { part: visibleParts() } }),
      prisma.psuSpecs.findMany({ where: { part: visibleParts() } }),
      prisma.caseSpecs.findMany({ where: { part: visibleParts() } }),
      prisma.motherboardSpecs.findMany({ where: { part: visibleParts() } }),
      prisma.storageSpecs.findMany({ where: { part: visibleParts() } }),
      prisma.specFieldSource.findMany({ where: { part: visibleParts() } }),
      prisma.perfIndex.findMany({
        where: { workload: "gaming", model_version: MODEL_VERSION },
        select: { part_id: true, index_value: true },
      }),
      prisma.perfIndexEstimated.findMany({
        where: { workload: "gaming", model_version: MODEL_VERSION },
        select: { part_id: true },
      }),
      prisma.part.count({ where: visibleParts() }),
    ]);

  // --- Alan kapsamı + kaynak dağılımı --------------------------------------
  const damgaHarita = new Map(damgalar.map((d) => [`${d.part_id}|${d.field_name}`, d]));
  const satirlar: Record<string, Record<string, unknown>[]> = {
    gpu_specs: gpuSpecs as unknown as Record<string, unknown>[],
    cpu_specs: cpuSpecs as unknown as Record<string, unknown>[],
  };

  const alanKapsami: AlanKapsami[] = [];
  for (const { tablo, alanlar } of TABLOLAR) {
    for (const alan of alanlar) {
      let dolu = 0;
      const kaynaklar: Record<string, number> = {};
      for (const satir of satirlar[tablo]) {
        const deger = satir[alan];
        if (deger === null || deger === undefined) continue;
        dolu += 1;
        const damga = damgaHarita.get(`${satir.part_id as string}|${alan}`);
        const ad = damga ? damga.source : "—";
        kaynaklar[ad] = (kaynaklar[ad] ?? 0) + 1;
      }
      alanKapsami.push({ tablo, alan, dolu, toplam: satirlar[tablo].length, kaynaklar });
    }
  }

  // --- Aile durumu ---------------------------------------------------------
  const olculenHarita = new Map(olcumler.map((r) => [r.part_id, r.index_value]));
  const tahminEdilen = new Set(tahminler.map((r) => r.part_id));

  const gpuNoktalar: MeasuredPoint[] = gpuSpecs
    .filter((gs) => olculenHarita.has(gs.part_id) && gs.bus_width_bits !== null && gs.boost_clock_mhz !== null)
    .map((gs) => ({
      id: gs.part_id,
      family: gs.architecture_family ?? "?",
      y: olculenHarita.get(gs.part_id)!,
      x: gs.bus_width_bits! * gs.boost_clock_mhz!,
    }));
  const cpuNoktalar: MeasuredPoint[] = cpuSpecs
    .filter((cs) => olculenHarita.has(cs.part_id) && cs.l3_cache_mb !== null)
    .map((cs) => ({
      id: cs.part_id,
      family: cs.architecture_family ?? "?",
      y: olculenHarita.get(cs.part_id)!,
      x: cs.boost_clock_mhz * Math.sqrt(cs.l3_cache_mb!),
    }));

  const aileler: AileDurumu[] = [];
  for (const [tur, specler, noktalar] of [
    ["gpu", gpuSpecs, gpuNoktalar],
    ["cpu", cpuSpecs, cpuNoktalar],
  ] as const) {
    const adlar = [...new Set(specler.map((s) => s.architecture_family ?? "?"))].sort();
    for (const aile of adlar) {
      const uyeler = specler.filter((s) => (s.architecture_family ?? "?") === aile);
      // Motorun bu aile için hangi bandı seçtiği: kullanıcı hangi sayıyı
      // görüyorsa panoda o yazmalı — kendi hesabımız değil.
      const ornek = uyeler[0];
      const x =
        tur === "gpu"
          ? (ornek as (typeof gpuSpecs)[number]).bus_width_bits !== null &&
            (ornek as (typeof gpuSpecs)[number]).boost_clock_mhz !== null
            ? (ornek as (typeof gpuSpecs)[number]).bus_width_bits! *
              (ornek as (typeof gpuSpecs)[number]).boost_clock_mhz!
            : null
          : (ornek as (typeof cpuSpecs)[number]).l3_cache_mb !== null
            ? (ornek as (typeof cpuSpecs)[number]).boost_clock_mhz *
              Math.sqrt((ornek as (typeof cpuSpecs)[number]).l3_cache_mb!)
            : null;
      const sonuc = estimate(noktalar, aile, x);
      const kendi = fitFamily(noktalar.filter((p) => p.family === aile));
      const capraz = fitCrossFamily(noktalar, aile);
      const secilenKendi =
        kendi !== null && capraz !== null ? kendi.bandPct <= capraz.bandPct : kendi !== null;
      aileler.push({
        tur,
        aile,
        parca: uyeler.length,
        olculen: uyeler.filter((s) => olculenHarita.has(s.part_id)).length,
        tahmin: uyeler.filter((s) => tahminEdilen.has(s.part_id)).length,
        bandPct: sonuc ? sonuc.bandPct : null,
        bandKaynagi: !sonuc ? "hesaplanamiyor" : secilenKendi ? "kendi ailesi" : "aileler arasi",
      });
    }
  }

  // --- Makullük ------------------------------------------------------------
  const { ihlaller, kontrol } = makulluk({
    cipler: gpuSpecs.map((gs) => ({
      part_id: gs.part_id,
      brand: gs.part.brand,
      vram_gb: gs.vram_gb,
      vram_type: gs.vram_type,
      tdp_watt: gs.tdp_watt,
      recommended_psu_watt: gs.recommended_psu_watt,
      shader_units: gs.shader_units,
      shader_unit_type: gs.shader_unit_type,
      boost_clock_mhz: gs.boost_clock_mhz,
      memory_bandwidth_gbs: gs.memory_bandwidth_gbs,
      bus_width_bits: gs.bus_width_bits,
      architecture_family: gs.architecture_family,
      transistor_count_m: gs.transistor_count_m,
    })),
    kartlar: kartlar.map((k) => ({
      part_id: k.part_id,
      tbp_watt: k.tbp_watt,
      boost_clock_mhz: k.boost_clock_mhz,
      boost_clock_oc_mhz: k.boost_clock_oc_mhz,
      length_mm: k.length_mm,
      thickness_slots: k.thickness_slots,
      cipTdp: k.chip.gpu_specs?.tdp_watt ?? null,
      cipBoost: k.chip.gpu_specs?.boost_clock_mhz ?? null,
    })),
    islemciler: cpuSpecs.map((c) => ({
      part_id: c.part_id,
      cores: c.cores,
      threads: c.threads,
      base_clock_mhz: c.base_clock_mhz,
      boost_clock_mhz: c.boost_clock_mhz,
      l3_cache_mb: c.l3_cache_mb,
    })),
    ramler: ramler.map((r) => ({
      part_id: r.part_id,
      memory_type: r.memory_type,
      capacity_gb: r.capacity_gb,
      module_count: r.module_count,
      speed_mhz: r.speed_mhz,
      cas_latency: r.cas_latency,
    })),
    psuler: psuler.map((p) => ({ part_id: p.part_id, wattage: p.wattage, length_mm: p.length_mm })),
    kasalar: kasalar.map((k) => ({
      part_id: k.part_id,
      max_gpu_length_mm: k.max_gpu_length_mm,
      max_cpu_cooler_height_mm: k.max_cpu_cooler_height_mm,
      max_psu_length_mm: k.max_psu_length_mm,
    })),
    anakartlar: anakartlar.map((a) => ({
      part_id: a.part_id,
      memory_type: a.memory_type,
      memory_slots: a.memory_slots,
      max_memory_gb: a.max_memory_gb,
      max_memory_speed_mhz: a.max_memory_speed_mhz,
      m2_slots: a.m2_slots,
    })),
    depolamalar: depolamalar.map((d) => ({
      part_id: d.part_id,
      capacity_gb: d.capacity_gb,
      interface: d.interface,
      read_speed_mbs: d.read_speed_mbs,
    })),
  });

  // --- Dış kaynaklı alanlar ------------------------------------------------
  const disKaynaklilar = damgalar.filter((d) => !["manufacturer", "manual", "dev_seed"].includes(d.source));
  const disKaynakliAlan = disKaynaklilar
    .map((d) => ({
      partId: d.part_id,
      alan: d.field_name,
      kaynak: d.source,
      makale: d.source_article,
      revizyon: d.source_revision_id,
    }))
    .sort((a, b) => a.partId.localeCompare(b.partId));

  // Spec'inin TAMAMI dış kaynaktan gelen parça: bugün olmaması beklenen bir
  // sayı ama sıfır olduğu GÖRÜNMELİ — sıfır olduğunu bilmek, bakmamaktan farklı.
  const parcaAlanSayisi = new Map<string, { toplam: number; dis: number }>();
  for (const d of damgalar) {
    const e = parcaAlanSayisi.get(d.part_id) ?? { toplam: 0, dis: 0 };
    e.toplam += 1;
    if (!["manufacturer", "manual", "dev_seed"].includes(d.source)) e.dis += 1;
    parcaAlanSayisi.set(d.part_id, e);
  }
  const tamamenDisKaynakli = [...parcaAlanSayisi.values()].filter((e) => e.toplam > 0 && e.toplam === e.dis).length;

  return {
    alanKapsami,
    aileler,
    ihlaller,
    makullukKontrol: kontrol,
    disKaynakliAlan,
    tamamenDisKaynakli,
    toplamParca: parcaSayi,
    olculenToplam: olcumler.length,
  };
}
