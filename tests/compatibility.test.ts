import { describe, expect, it } from "vitest";

import { checkCompatibility, requiredWattage } from "../engine/compatibility";
import type {
  BuildInput,
  EngineCase,
  EngineCpu,
  EngineGpu,
  EngineMotherboard,
  EnginePsu,
  EngineRam,
} from "../engine/types";

// Testlerin okunur kalması için temel parçalar: hepsi birbiriyle uyumlu.
// Her test sadece ilgilendiği alanı değiştirir, gerisi sabit kalır.

const cpu: EngineCpu = { id: "amd-ryzen-7-7800x3d", socket: "AM5", tdp_watt: 120, has_igpu: true };
const gpu: EngineGpu = { id: "nvidia-rtx-5070", tdp_watt: 250, length_mm: 300 };
const motherboard: EngineMotherboard = {
  id: "asus-b650-plus",
  socket: "AM5",
  form_factor: "ATX",
  memory_type: "DDR5",
  memory_slots: 4,
  max_memory_gb: 128,
  max_memory_speed_mhz: 6000,
};
const ram: EngineRam = {
  id: "corsair-vengeance-32gb",
  memory_type: "DDR5",
  capacity_gb: 32,
  module_count: 2,
  speed_mhz: 6000,
};
const psu: EnginePsu = { id: "corsair-rm850e", wattage: 850, length_mm: 140 };
const pcCase: EngineCase = {
  id: "fractal-north",
  supported_form_factors: ["ATX", "mATX", "ITX"],
  max_gpu_length_mm: 355,
  max_psu_length_mm: 175,
};

const uyumluSistem: BuildInput = { cpu, gpu, motherboard, ram, psu, case: pcCase };

/** Belirli bir kural çalıştı mı? */
function kodlar(input: BuildInput): string[] {
  return checkCompatibility(input).map((f) => f.code);
}

describe("uyumlu sistem", () => {
  it("hiç bulgu üretmez", () => {
    expect(checkCompatibility(uyumluSistem)).toEqual([]);
  });
});

describe("C1 — işlemci soketi / anakart soketi", () => {
  it("aynı soketlerde geçer", () => {
    expect(kodlar(uyumluSistem)).not.toContain("C1");
  });

  it("farklı soketlerde hata verir", () => {
    const bulgular = checkCompatibility({
      ...uyumluSistem,
      motherboard: { ...motherboard, socket: "LGA1851" },
    });
    const c1 = bulgular.find((f) => f.code === "C1");
    expect(c1).toBeDefined();
    expect(c1!.level).toBe("error");
    expect(c1!.involved_part_ids).toEqual([cpu.id, motherboard.id]);
    expect(c1!.message).toContain("AM5");
    expect(c1!.message).toContain("LGA1851");
  });
});

describe("C2 — bellek tipi / anakart bellek tipi", () => {
  it("ikisi de DDR5 ise geçer", () => {
    expect(kodlar(uyumluSistem)).not.toContain("C2");
  });

  it("DDR4 bellek DDR5 anakartta hata verir", () => {
    const bulgular = checkCompatibility({
      ...uyumluSistem,
      ram: { ...ram, memory_type: "DDR4" },
    });
    const c2 = bulgular.find((f) => f.code === "C2");
    expect(c2?.level).toBe("error");
    expect(c2?.involved_part_ids).toEqual([ram.id, motherboard.id]);
  });
});

describe("C3 — modül sayısı / yuva sayısı", () => {
  it("2 modül 4 yuvaya sığar", () => {
    expect(kodlar(uyumluSistem)).not.toContain("C3");
  });

  it("modül sayısı yuvaya eşitse geçer (sınır)", () => {
    const input = {
      ...uyumluSistem,
      ram: { ...ram, module_count: 4 },
    };
    expect(kodlar(input)).not.toContain("C3");
  });

  it("yuvadan fazla modül hata verir", () => {
    const bulgular = checkCompatibility({
      ...uyumluSistem,
      ram: { ...ram, module_count: 5 },
    });
    expect(bulgular.find((f) => f.code === "C3")?.level).toBe("error");
  });
});

describe("C4 — güç kaynağı yeterliliği", () => {
  // 120 + 250 + 100 = 470; 470 * 1.3 = 611 -> gerekli 611W
  const gerekli = requiredWattage(cpu.tdp_watt, gpu.tdp_watt);

  it("formül SCHEMA.md ile aynı sonucu verir", () => {
    expect(gerekli).toBe(611);
  });

  it("yukarı yuvarlar (ceil)", () => {
    // 65 + 170 + 100 = 335; 335 * 1.3 = 435.5 -> 436
    expect(requiredWattage(65, 170)).toBe(436);
  });

  it("GPU verilmezse tüketimini 0 sayar", () => {
    // 120 + 0 + 100 = 220; 220 * 1.3 = 286
    expect(requiredWattage(cpu.tdp_watt)).toBe(286);
  });

  it("yeterli güç kaynağında geçer", () => {
    expect(kodlar(uyumluSistem)).not.toContain("C4");
  });

  it("tam sınırda geçer (wattage === gerekli)", () => {
    const bulgular = checkCompatibility({
      ...uyumluSistem,
      psu: { ...psu, wattage: gerekli },
    });
    expect(bulgular.map((f) => f.code)).not.toContain("C4");
  });

  it("sınırın 1W altında hata verir", () => {
    const bulgular = checkCompatibility({
      ...uyumluSistem,
      psu: { ...psu, wattage: gerekli - 1 },
    });
    const c4 = bulgular.find((f) => f.code === "C4");
    expect(c4?.level).toBe("error");
    expect(c4?.message).toContain("611");
  });

  it("hata verdiğinde ilgili parçalar psu, cpu ve gpu olur", () => {
    const bulgular = checkCompatibility({
      ...uyumluSistem,
      psu: { ...psu, wattage: 100 },
    });
    expect(bulgular.find((f) => f.code === "C4")?.involved_part_ids).toEqual([
      psu.id,
      cpu.id,
      gpu.id,
    ]);
  });

  it("GPU yoksa sadece işlemciye göre hesaplar", () => {
    const gpusuz: BuildInput = { ...uyumluSistem, gpu: undefined };
    const bulgular = checkCompatibility({ ...gpusuz, psu: { ...psu, wattage: 286 } });
    expect(bulgular.map((f) => f.code)).not.toContain("C4");
  });
});

describe("W3 — güç payı darlığı (%15 eşiği)", () => {
  const gerekli = requiredWattage(cpu.tdp_watt, gpu.tdp_watt); // 611
  const esik = Math.ceil(gerekli * 1.15); // 703

  it("bol paylı güç kaynağında uyarı vermez", () => {
    expect(kodlar(uyumluSistem)).not.toContain("W3");
  });

  it("tam gerekli değerde uyarı verir", () => {
    const bulgular = checkCompatibility({
      ...uyumluSistem,
      psu: { ...psu, wattage: gerekli },
    });
    const w3 = bulgular.find((f) => f.code === "W3");
    expect(w3?.level).toBe("warning");
  });

  it("eşiğin hemen altında uyarı verir", () => {
    // 611 * 1.15 = 702.65 -> 702 hâlâ eşiğin altında
    const bulgular = checkCompatibility({
      ...uyumluSistem,
      psu: { ...psu, wattage: 702 },
    });
    expect(bulgular.map((f) => f.code)).toContain("W3");
  });

  it("eşiğin üstünde uyarı vermez", () => {
    const bulgular = checkCompatibility({
      ...uyumluSistem,
      psu: { ...psu, wattage: esik },
    });
    expect(bulgular.map((f) => f.code)).not.toContain("W3");
  });

  it("güç yetersizken W3 değil C4 verir — ikisi birden değil", () => {
    const bulgular = checkCompatibility({
      ...uyumluSistem,
      psu: { ...psu, wattage: gerekli - 1 },
    });
    const kodListesi = bulgular.map((f) => f.code);
    expect(kodListesi).toContain("C4");
    expect(kodListesi).not.toContain("W3");
  });
});

describe("C5 — ekran kartı uzunluğu / kasa", () => {
  it("sığan kartta geçer", () => {
    expect(kodlar(uyumluSistem)).not.toContain("C5");
  });

  // K52: length_mm opsiyonel. Bilinmeyen uzunluk kuralı atlatır — ama
  // sessizce hata da uydurmaz. Kullanıcıyı arayüz uyarır.
  it("uzunluk bilinmiyorsa kural atlanır, hata uydurmaz", () => {
    const uzunluksuz: BuildInput = {
      ...uyumluSistem,
      gpu: { id: gpu.id, tdp_watt: gpu.tdp_watt },
    };
    expect(() => checkCompatibility(uzunluksuz)).not.toThrow();
    expect(kodlar(uzunluksuz)).not.toContain("C5");
  });

  it("uzunluk bilinmiyorsa diğer kurallar çalışmaya devam eder", () => {
    const uzunluksuz: BuildInput = {
      ...uyumluSistem,
      gpu: { id: gpu.id, tdp_watt: 600 }, // C4'ü tetikleyecek kadar aç
      psu: { ...psu, wattage: 400 },
    };
    const kodListesi = kodlar(uzunluksuz);
    expect(kodListesi).not.toContain("C5");
    expect(kodListesi).toContain("C4");
  });

  it("tam sınırda geçer", () => {
    const input = { ...uyumluSistem, gpu: { ...gpu, length_mm: pcCase.max_gpu_length_mm } };
    expect(kodlar(input)).not.toContain("C5");
  });

  it("sığmayan kartta hata verir", () => {
    const bulgular = checkCompatibility({
      ...uyumluSistem,
      gpu: { ...gpu, length_mm: 400 },
    });
    const c5 = bulgular.find((f) => f.code === "C5");
    expect(c5?.level).toBe("error");
    expect(c5?.involved_part_ids).toEqual([gpu.id, pcCase.id]);
  });
});

describe("C6 — anakart form faktörü / kasa desteği", () => {
  it("desteklenen form faktöründe geçer", () => {
    expect(kodlar(uyumluSistem)).not.toContain("C6");
  });

  it("desteklenmeyen form faktöründe hata verir", () => {
    const bulgular = checkCompatibility({
      ...uyumluSistem,
      motherboard: { ...motherboard, form_factor: "E-ATX" },
    });
    const c6 = bulgular.find((f) => f.code === "C6");
    expect(c6?.level).toBe("error");
    expect(c6?.message).toContain("E-ATX");
  });
});

describe("W1 — bellek hızı", () => {
  it("anakartın desteklediği hızda uyarı vermez", () => {
    expect(kodlar(uyumluSistem)).not.toContain("W1");
  });

  it("daha hızlı bellekte uyarı verir ama engellemez", () => {
    const bulgular = checkCompatibility({
      ...uyumluSistem,
      ram: { ...ram, speed_mhz: 7200 },
    });
    const w1 = bulgular.find((f) => f.code === "W1");
    expect(w1?.level).toBe("warning");
    expect(bulgular.filter((f) => f.level === "error")).toEqual([]);
  });
});

describe("W2 — bellek kapasitesi", () => {
  it("sınır içinde uyarı vermez", () => {
    expect(kodlar(uyumluSistem)).not.toContain("W2");
  });

  it("anakart sınırının üstünde uyarı verir", () => {
    const bulgular = checkCompatibility({
      ...uyumluSistem,
      ram: { ...ram, capacity_gb: 256 },
    });
    expect(bulgular.find((f) => f.code === "W2")?.level).toBe("warning");
  });
});

describe("W4 — görüntü çıkışı yok", () => {
  it("ekran kartı varsa uyarı vermez", () => {
    expect(kodlar(uyumluSistem)).not.toContain("W4");
  });

  it("ekran kartı yok ama iGPU varsa uyarı vermez", () => {
    const gpusuz: BuildInput = { ...uyumluSistem, gpu: undefined };
    expect(kodlar(gpusuz)).not.toContain("W4");
  });

  it("ne ekran kartı ne iGPU varsa uyarı verir", () => {
    const gpusuz: BuildInput = { ...uyumluSistem, gpu: undefined };
    const bulgular = checkCompatibility({
      ...gpusuz,
      cpu: { ...cpu, has_igpu: false },
    });
    const w4 = bulgular.find((f) => f.code === "W4");
    expect(w4?.level).toBe("warning");
    expect(w4?.involved_part_ids).toEqual([cpu.id]);
  });
});

describe("W5 — güç kaynağı uzunluğu / kasa", () => {
  // K62: length_mm opsiyonel. Bilinmeyen uzunluk kuralı atlatır.
  it("uzunluk bilinmiyorsa kural atlanır, hata uydurmaz", () => {
    const uzunluksuz: BuildInput = {
      ...uyumluSistem,
      psu: { id: psu.id, wattage: psu.wattage },
      case: { ...pcCase, max_psu_length_mm: 100 },
    };
    expect(() => checkCompatibility(uzunluksuz)).not.toThrow();
    expect(kodlar(uzunluksuz)).not.toContain("W5");
  });

  it("sığan güç kaynağında uyarı vermez", () => {
    expect(kodlar(uyumluSistem)).not.toContain("W5");
  });

  it("uzun güç kaynağında uyarı verir ama engellemez", () => {
    const bulgular = checkCompatibility({
      ...uyumluSistem,
      psu: { ...psu, length_mm: 200 },
    });
    expect(bulgular.find((f) => f.code === "W5")?.level).toBe("warning");
    expect(bulgular.filter((f) => f.level === "error")).toEqual([]);
  });
});

describe("eksik parçalar", () => {
  it("boş sistem hiç bulgu üretmez", () => {
    expect(checkCompatibility({})).toEqual([]);
  });

  it("tek parçalı sistem hiç bulgu üretmez", () => {
    expect(checkCompatibility({ cpu })).toEqual([]);
  });

  it("kasa yoksa C5 ve C6 atlanır", () => {
    const kasasiz: BuildInput = { ...uyumluSistem, case: undefined };
    const kodListesi = kodlar({ ...kasasiz, gpu: { ...gpu, length_mm: 999 } });
    expect(kodListesi).not.toContain("C5");
    expect(kodListesi).not.toContain("C6");
  });

  it("anakart yoksa C1, C2, C3, W1, W2 atlanır", () => {
    const anakartsiz: BuildInput = { ...uyumluSistem, motherboard: undefined };
    const kodListesi = kodlar(anakartsiz);
    for (const kod of ["C1", "C2", "C3", "W1", "W2"]) {
      expect(kodListesi).not.toContain(kod);
    }
  });

  it("güç kaynağı yoksa C4 ve W3 atlanır", () => {
    const gucsuz: BuildInput = { ...uyumluSistem, psu: undefined };
    const kodListesi = kodlar(gucsuz);
    expect(kodListesi).not.toContain("C4");
    expect(kodListesi).not.toContain("W3");
  });

  it("işlemci yoksa W4 atlanır — GPU da yokken bile", () => {
    expect(kodlar({ motherboard, ram })).not.toContain("W4");
  });
});

describe("eksik alanlar (tip sisteminden geçmeyen veri)", () => {
  // Veritabanında bu alanlar NOT NULL; buraya null ancak dönüştürücü
  // hatasıyla veya elle kurulmuş veriyle gelebilir. Motor çökmemeli.

  it("null alan taşıyan parça çökmez, o kural atlanır", () => {
    const bozukCpu = { ...cpu, socket: null } as unknown as EngineCpu;
    expect(() => checkCompatibility({ ...uyumluSistem, cpu: bozukCpu })).not.toThrow();
    expect(kodlar({ ...uyumluSistem, cpu: bozukCpu })).not.toContain("C1");
  });

  it("supported_form_factors dizi değilse C6 atlanır, çökmez", () => {
    const bozukKasa = { ...pcCase, supported_form_factors: null } as unknown as EngineCase;
    expect(() => checkCompatibility({ ...uyumluSistem, case: bozukKasa })).not.toThrow();
    expect(kodlar({ ...uyumluSistem, case: bozukKasa })).not.toContain("C6");
  });

  it("bir alanı eksik parça diğer kuralları engellemez", () => {
    const bozukRam = { ...ram, memory_type: undefined } as unknown as EngineRam;
    const kodListesi = kodlar({
      ...uyumluSistem,
      ram: { ...bozukRam, module_count: 8 },
    });
    expect(kodListesi).not.toContain("C2"); // tipi bilinmiyor, atlandı
    expect(kodListesi).toContain("C3"); // modül sayısı biliniyor, çalıştı
  });
});

describe("bulgu sıralaması ve biçimi", () => {
  it("engelleyiciler uyarılardan önce gelir", () => {
    const bulgular = checkCompatibility({
      ...uyumluSistem,
      motherboard: { ...motherboard, socket: "LGA1851" }, // C1
      ram: { ...ram, speed_mhz: 7200 }, // W1
    });
    const ilkUyariIndeksi = bulgular.findIndex((f) => f.level === "warning");
    const sonHataIndeksi = bulgular.map((f) => f.level).lastIndexOf("error");
    expect(sonHataIndeksi).toBeLessThan(ilkUyariIndeksi);
  });

  it("her bulgu dört alanı da taşır", () => {
    const bulgular = checkCompatibility({
      ...uyumluSistem,
      motherboard: { ...motherboard, socket: "LGA1851" },
    });
    for (const bulgu of bulgular) {
      expect(bulgu.code).toMatch(/^[CW][1-6]$/);
      expect(["error", "warning"]).toContain(bulgu.level);
      expect(bulgu.message.length).toBeGreaterThan(0);
      expect(bulgu.involved_part_ids.length).toBeGreaterThan(0);
    }
  });
});
