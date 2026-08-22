// Fiziksel makullük kuralları — SAF hesap, tek tanım.
//
// Buraya taşınmasının sebebi: aynı kurallar iki yerde okunuyor —
// `npm run makul:kontrol` (script) ve `/veri` panosu (arayüz). İki kopya,
// iki farklı cevap demektir.
//
// Bu dosya veritabanı, ağ ve arayüz tanımaz: düz nesneler girer, ihlal listesi
// çıkar. `/engine` altında DEĞİL çünkü orası uyumluluk kuralları ve performans
// hesabı için ayrılmış; bu, veri denetimi.
//
// ---------------------------------------------------------------------------
// NE YAPMAZ
// ---------------------------------------------------------------------------
//
// Bu bir doğruluk kontrolü değil. Makul bir değer yanlış olabilir; imkânsız
// bir değer kesin yanlıştır. Yalnızca ikincisi yakalanır. RTX 5060'ın eski
// 480 GB/s değeri (30 Gbps) bu denetimden GEÇERDİ (K171).
//
// Eşikler ve aralıklar BİRER KARAR, ölçüm değil; geniş tutuldular.

export type Ihlal = {
  /** Hangi kısıt — rapor bu ada göre gruplanıyor. */
  kural: string;
  partId: string;
  /** "şu sayı şu sayıyla şöyle çelişiyor" — ihlali işaretleyen gerekçe. */
  gerekce: string;
};

export type MakullukSonuc = {
  ihlaller: Ihlal[];
  /** Gerçekten çalışan kontrol sayısı. Alanı eksik satır sayılmaz. */
  kontrol: number;
  /** Alan eksikliği yüzünden çalışamayanlar: kural -> adet. */
  calisamayan: Record<string, number>;
};

/** Şemada karşılığı olmadığı için kurulamayan kısıtlar — kapsam gizlenmiyor. */
export const KURULAMAYAN_KISITLAR = [
  "dolgu hizi <-> saat <-> ROP sayisi : fillrate ve ROP sutunu YOK",
  "cip alani <-> transistor yogunlugu : die_size sutunu YOK",
  "guc konnektoru <-> TBP             : power_connectors serbest metin (S38)",
];

/** Bellek tipine göre makul hız aralığı — pin başına Gbps. */
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

// Girdi tipleri: Prisma tipleri DEĞİL, ihtiyaç duyulan alanlar. Bu dosya
// veritabanı tanımadığı için tipleri de tanımıyor.
export type CipSatiri = {
  part_id: string;
  brand: string;
  vram_gb: number;
  vram_type: string;
  tdp_watt: number;
  recommended_psu_watt: number | null;
  shader_units: number | null;
  shader_unit_type: string | null;
  boost_clock_mhz: number | null;
  memory_bandwidth_gbs: number | null;
  bus_width_bits: number | null;
  architecture_family: string | null;
  transistor_count_m: number | null;
};

export type KartSatiri = {
  part_id: string;
  tbp_watt: number | null;
  boost_clock_mhz: number | null;
  boost_clock_oc_mhz: number | null;
  length_mm: number | null;
  thickness_slots: number | null;
  cipTdp: number | null;
  cipBoost: number | null;
};

export type IslemciSatiri = {
  part_id: string;
  cores: number;
  threads: number;
  base_clock_mhz: number;
  boost_clock_mhz: number;
  l3_cache_mb: number | null;
};

export type RamSatiri = {
  part_id: string;
  memory_type: string;
  capacity_gb: number;
  module_count: number;
  speed_mhz: number;
  cas_latency: number;
};

export type PsuSatiri = { part_id: string; wattage: number; length_mm: number | null };

export type KasaSatiri = {
  part_id: string;
  max_gpu_length_mm: number | null;
  max_cpu_cooler_height_mm: number | null;
  max_psu_length_mm: number | null;
};

export type AnakartSatiri = {
  part_id: string;
  memory_type: string;
  memory_slots: number;
  max_memory_gb: number;
  max_memory_speed_mhz: number;
  m2_slots: number;
};

export type DepolamaSatiri = {
  part_id: string;
  capacity_gb: number;
  interface: string;
  read_speed_mbs: number | null;
};

export type Girdi = {
  cipler: CipSatiri[];
  kartlar: KartSatiri[];
  islemciler: IslemciSatiri[];
  ramler: RamSatiri[];
  psuler: PsuSatiri[];
  kasalar: KasaSatiri[];
  anakartlar: AnakartSatiri[];
  depolamalar: DepolamaSatiri[];
};

export function makulluk(g: Girdi): MakullukSonuc {
  const ihlaller: Ihlal[] = [];
  const calisamayan: Record<string, number> = {};
  let kontrol = 0;

  const atla = (kural: string) => {
    calisamayan[kural] = (calisamayan[kural] ?? 0) + 1;
  };
  const calistir = (kural: string, gecti: boolean, partId: string, gerekce: string) => {
    kontrol += 1;
    if (!gecti) ihlaller.push({ kural, partId, gerekce });
  };

  // --- Ekran kartı çipi ----------------------------------------------------
  for (const c of g.cipler) {
    if (c.memory_bandwidth_gbs !== null && c.bus_width_bits !== null) {
      const gbps = Math.round(((c.memory_bandwidth_gbs * 8) / c.bus_width_bits) * 100) / 100;
      calistir(
        "bant genisligi -> ortuk bellek hizi (mutlak)",
        gbps >= MUTLAK_HIZ.alt && gbps <= MUTLAK_HIZ.ust,
        c.part_id,
        `${c.memory_bandwidth_gbs} GB/s @ ${c.bus_width_bits} bit = ${gbps} Gbps; ` +
          `hicbir bellek tipi ${MUTLAK_HIZ.alt}-${MUTLAK_HIZ.ust} araligi disinda uretilmiyor`,
      );
      const aralik = HIZ_ARALIGI[c.vram_type];
      if (aralik) {
        calistir(
          "bant genisligi -> ortuk bellek hizi (tipe gore)",
          gbps >= aralik.alt && gbps <= aralik.ust,
          c.part_id,
          `${gbps} Gbps, ${c.vram_type} icin beklenen ${aralik.alt}-${aralik.ust}`,
        );
      } else {
        atla("bant genisligi -> ortuk bellek hizi (tipe gore)");
      }
    } else {
      atla("bant genisligi -> ortuk bellek hizi");
    }

    // Bellek yongaları 32 bit; veri yolu / 32 = yonga sayısı. Toplam bellek o
    // yongalara tam bölünmeli ve yonga başına kapasite üretilen bir kapasite
    // olmalı. Clamshell dizilim yonga sayısını ikiye katlıyor.
    if (c.bus_width_bits !== null) {
      const yonga = c.bus_width_bits / 32;
      const tekil = (c.vram_gb * 8) / yonga;
      const clamshell = (c.vram_gb * 8) / (yonga * 2);
      calistir(
        "VRAM -> veri yolu -> yonga kapasitesi",
        YONGA_GBIT.includes(tekil) || YONGA_GBIT.includes(clamshell),
        c.part_id,
        `${c.vram_gb} GB / ${c.bus_width_bits} bit -> yonga basina ${tekil} Gbit ` +
          `(clamshell ${clamshell} Gbit); uretilen kapasiteler: ${YONGA_GBIT.join(", ")} Gbit`,
      );
    } else {
      atla("VRAM -> veri yolu -> yonga kapasitesi");
    }

    if (c.recommended_psu_watt !== null) {
      calistir(
        "TDP -> onerilen guc kaynagi",
        c.recommended_psu_watt > c.tdp_watt && c.recommended_psu_watt <= c.tdp_watt * 5 + 200,
        c.part_id,
        `TDP ${c.tdp_watt} W, onerilen guc kaynagi ${c.recommended_psu_watt} W`,
      );
    } else {
      atla("TDP -> onerilen guc kaynagi");
    }

    if (c.shader_unit_type !== null && MARKA_BIRIM[c.brand]) {
      calistir(
        "marka -> shader birimi tipi",
        c.shader_unit_type === MARKA_BIRIM[c.brand],
        c.part_id,
        `${c.brand} kartinda ${c.shader_unit_type}; beklenen ${MARKA_BIRIM[c.brand]}. ` +
          `shader_units yalnizca ayni tip icinde karsilastirilabilir (K57)`,
      );
    } else {
      atla("marka -> shader birimi tipi");
    }

    if (c.boost_clock_mhz !== null) {
      calistir(
        "boost saati araligi",
        c.boost_clock_mhz >= 300 && c.boost_clock_mhz <= 4000,
        c.part_id,
        `boost ${c.boost_clock_mhz} MHz — ekran kartlarinda 300-4000 MHz disi gorulmedi`,
      );
    } else {
      atla("boost saati araligi");
    }
  }

  // Aile içinde transistör / shader oranı. Aynı mimarideki iki çip aynı tasarım
  // bloklarından kuruluyor; kat kat ayrılan bir oran iki alandan birinin
  // yanlış olduğunu söyler. Pay geniş (×3): küçük çipler orantısız çok
  // çekirdek-dışı blok taşıyor.
  const aileOrani = new Map<string, { id: string; oran: number }[]>();
  for (const c of g.cipler) {
    if (c.transistor_count_m === null || !c.shader_units || !c.architecture_family) continue;
    const oran = (c.transistor_count_m * 1_000_000) / c.shader_units;
    aileOrani.set(c.architecture_family, [
      ...(aileOrani.get(c.architecture_family) ?? []),
      { id: c.part_id, oran },
    ]);
  }
  for (const [aile, liste] of aileOrani) {
    if (liste.length < 3) {
      for (let i = 0; i < liste.length; i++) atla("aile ici transistor/shader orani");
      continue;
    }
    const sirali = [...liste].sort((a, b) => a.oran - b.oran);
    const medyan = sirali[Math.floor(sirali.length / 2)].oran;
    for (const e of liste) {
      calistir(
        "aile ici transistor/shader orani",
        e.oran / medyan <= 3 && medyan / e.oran <= 3,
        e.id,
        `${aile} ailesinde shader basina ${Math.round(e.oran / 1000)} bin transistor; ` +
          `aile medyani ${Math.round(medyan / 1000)} bin (pay x3)`,
      );
    }
  }

  // --- Kart (AIB) — çipiyle kısıtlı ---------------------------------------
  for (const k of g.kartlar) {
    if (k.tbp_watt !== null && k.cipTdp !== null) {
      calistir(
        "kart TBP -> cip TDP",
        k.tbp_watt >= k.cipTdp * 0.8 && k.tbp_watt <= k.cipTdp * 2,
        k.part_id,
        `kart ${k.tbp_watt} W, cip referansi ${k.cipTdp} W`,
      );
    } else {
      atla("kart TBP -> cip TDP");
    }
    if (k.boost_clock_mhz !== null && k.cipBoost !== null) {
      calistir(
        "kart boost -> cip boost",
        k.boost_clock_mhz >= k.cipBoost * 0.95 && k.boost_clock_mhz <= k.cipBoost * 1.3,
        k.part_id,
        `kart ${k.boost_clock_mhz} MHz, cip referansi ${k.cipBoost} MHz`,
      );
    } else {
      atla("kart boost -> cip boost");
    }
    if (k.boost_clock_oc_mhz !== null && k.boost_clock_mhz !== null) {
      calistir(
        "kart OC hizi -> kart hizi",
        k.boost_clock_oc_mhz >= k.boost_clock_mhz,
        k.part_id,
        `OC ${k.boost_clock_oc_mhz} MHz, normal ${k.boost_clock_mhz} MHz`,
      );
    }
    if (k.length_mm !== null) {
      calistir(
        "kart uzunlugu araligi",
        k.length_mm >= 120 && k.length_mm <= 400,
        k.part_id,
        `uzunluk ${k.length_mm} mm — tuketici kartlarinda 120-400 mm disi gorulmedi`,
      );
    }
    if (k.thickness_slots !== null) {
      calistir(
        "kart kalinligi araligi",
        k.thickness_slots >= 1 && k.thickness_slots <= 5,
        k.part_id,
        `kalinlik ${k.thickness_slots} slot`,
      );
    }
  }

  // --- İşlemci -------------------------------------------------------------
  for (const c of g.islemciler) {
    calistir(
      "cekirdek -> is parcacigi",
      c.threads >= c.cores && c.threads <= c.cores * 2,
      c.part_id,
      `${c.cores} cekirdek, ${c.threads} is parcacigi; SMT en fazla ikiye katlar`,
    );
    calistir(
      "taban -> boost saati",
      c.boost_clock_mhz >= c.base_clock_mhz,
      c.part_id,
      `taban ${c.base_clock_mhz} MHz, boost ${c.boost_clock_mhz} MHz`,
    );
    calistir(
      "islemci saat araligi",
      c.base_clock_mhz >= 800 && c.boost_clock_mhz <= 7000,
      c.part_id,
      `taban ${c.base_clock_mhz} MHz, boost ${c.boost_clock_mhz} MHz`,
    );
    if (c.l3_cache_mb !== null) {
      const perCore = c.l3_cache_mb / c.cores;
      calistir(
        "cekirdek basina L3",
        perCore >= 0.5 && perCore <= 20,
        c.part_id,
        `${c.l3_cache_mb} MB / ${c.cores} cekirdek = ${perCore.toFixed(1)} MB; ` +
          `X3D parcalari ust ucta durur ama 20 MB'i gecmez`,
      );
    } else {
      atla("cekirdek basina L3");
    }
  }

  // --- Bellek, güç kaynağı, kasa, anakart, depolama -----------------------
  for (const r of g.ramler) {
    calistir(
      "kit kapasitesi -> modul sayisi",
      r.module_count > 0 && Number.isInteger(r.capacity_gb / r.module_count),
      r.part_id,
      `${r.capacity_gb} GB / ${r.module_count} modul = ${(r.capacity_gb / r.module_count).toFixed(2)} GB`,
    );
    // Üst uç JEDEC değil PİYASA: XMP/EXPO kitleri JEDEC tavanının üstünde satılıyor.
    const aralik = r.memory_type === "DDR5" ? { alt: 3600, ust: 10000 } : { alt: 1600, ust: 5000 };
    calistir(
      "bellek hizi -> bellek kusagi",
      r.speed_mhz >= aralik.alt && r.speed_mhz <= aralik.ust,
      r.part_id,
      `${r.memory_type} ${r.speed_mhz} MT/s; beklenen ${aralik.alt}-${aralik.ust}`,
    );
    calistir("CAS gecikmesi araligi", r.cas_latency >= 10 && r.cas_latency <= 60, r.part_id, `CL${r.cas_latency}`);
  }

  for (const p of g.psuler) {
    calistir("guc kaynagi wattaji araligi", p.wattage >= 200 && p.wattage <= 2000, p.part_id, `${p.wattage} W`);
    if (p.length_mm !== null) {
      calistir(
        "guc kaynagi uzunlugu araligi",
        p.length_mm >= 100 && p.length_mm <= 250,
        p.part_id,
        `${p.length_mm} mm — ATX12V icin 100-250 mm disi gorulmedi`,
      );
    } else {
      atla("guc kaynagi uzunlugu araligi");
    }
  }

  for (const k of g.kasalar) {
    if (k.max_gpu_length_mm !== null) {
      calistir(
        "kasa ekran karti acikligi",
        k.max_gpu_length_mm >= 150 && k.max_gpu_length_mm <= 600,
        k.part_id,
        `${k.max_gpu_length_mm} mm`,
      );
    } else atla("kasa ekran karti acikligi");
    if (k.max_cpu_cooler_height_mm !== null) {
      calistir(
        "kasa sogutucu acikligi",
        k.max_cpu_cooler_height_mm >= 30 && k.max_cpu_cooler_height_mm <= 220,
        k.part_id,
        `${k.max_cpu_cooler_height_mm} mm`,
      );
    } else atla("kasa sogutucu acikligi");
    if (k.max_psu_length_mm !== null) {
      calistir(
        "kasa guc kaynagi acikligi",
        k.max_psu_length_mm >= 100 && k.max_psu_length_mm <= 400,
        k.part_id,
        `${k.max_psu_length_mm} mm`,
      );
    } else atla("kasa guc kaynagi acikligi");
  }

  for (const a of g.anakartlar) {
    calistir(
      "azami bellek -> yuva sayisi",
      a.memory_slots > 0 && a.max_memory_gb / a.memory_slots >= 8 && a.max_memory_gb / a.memory_slots <= 256,
      a.part_id,
      `${a.max_memory_gb} GB / ${a.memory_slots} yuva = ${(a.max_memory_gb / a.memory_slots).toFixed(0)} GB modul`,
    );
    // DİKKAT: bu alan anakartın DESTEKLEDİĞİ AZAMİ hız ve üreticiler oraya
    // aşırı hızlandırma rakamını yazıyor ("DDR5-9200+(OC)"). İlk eşik dört
    // anakartı işaretledi ve dördü de DOĞRUYDU; eşik gevşetildi, veri değil.
    const aralik = a.memory_type === "DDR5" ? { alt: 3600, ust: 13000 } : { alt: 1600, ust: 6000 };
    calistir(
      "anakart bellek hizi -> kusak (OC tavani)",
      a.max_memory_speed_mhz >= aralik.alt && a.max_memory_speed_mhz <= aralik.ust,
      a.part_id,
      `${a.memory_type} ${a.max_memory_speed_mhz} MT/s; beklenen ${aralik.alt}-${aralik.ust}`,
    );
    calistir("M.2 yuva sayisi araligi", a.m2_slots >= 0 && a.m2_slots <= 8, a.part_id, `${a.m2_slots} M.2 yuvasi`);
  }

  for (const d of g.depolamalar) {
    calistir(
      "depolama kapasitesi araligi",
      d.capacity_gb >= 120 && d.capacity_gb <= 16000,
      d.part_id,
      `${d.capacity_gb} GB`,
    );
    if (d.read_speed_mbs !== null) {
      const sata = /sata/i.test(d.interface);
      calistir(
        "okuma hizi -> arayuz",
        sata ? d.read_speed_mbs <= 600 : d.read_speed_mbs <= 16000,
        d.part_id,
        `${d.interface} arayuzunde ${d.read_speed_mbs} MB/s; SATA III'un teorik tavani 600 MB/s`,
      );
    } else {
      atla("okuma hizi -> arayuz");
    }
  }

  return { ihlaller, kontrol, calisamayan };
}
