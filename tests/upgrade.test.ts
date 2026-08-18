import { describe, expect, it } from "vitest";

import { UPGRADE_CATEGORIES, suggestUpgrades } from "../engine/upgrade";
import type { UpgradeInput, UpgradePart } from "../engine/types";

// Fiyatlar kuruş. 100000 = 1.000,00 TL.
const GPU_5060: UpgradePart = { id: "gpu-5060", price_minor: 1399900, perf_index: 33 };
const GPU_5070: UpgradePart = { id: "gpu-5070", price_minor: 2450000, perf_index: 54 };
const GPU_9070: UpgradePart = { id: "gpu-9070", price_minor: 3275000, perf_index: 62 };
const GPU_5090: UpgradePart = { id: "gpu-5090", price_minor: 9499900, perf_index: 100 };

const CPU_7600: UpgradePart = { id: "cpu-7600", price_minor: 749900, perf_index: 55 };
const CPU_14600: UpgradePart = { id: "cpu-14600", price_minor: 1125000, perf_index: 68 };
const CPU_7800X3D: UpgradePart = { id: "cpu-7800x3d", price_minor: 1499900, perf_index: 78 };
const CPU_15900: UpgradePart = { id: "cpu-15900", price_minor: 2499900, perf_index: 92 };

const ALL_GPUS = [GPU_5060, GPU_5070, GPU_9070, GPU_5090];
const ALL_CPUS = [CPU_7600, CPU_14600, CPU_7800X3D, CPU_15900];

/** Testlerin okunur kalması için: sadece ilgilenilen alanlar değişir. */
function input(overrides: Partial<UpgradeInput> = {}): UpgradeInput {
  return {
    resolution: "1440p",
    current: { gpu: GPU_5070, cpu: CPU_7600 },
    budget_delta_minor: 1000000, // +10.000,00 TL
    candidates: { gpu: ALL_GPUS, cpu: ALL_CPUS },
    ...overrides,
  };
}

describe("aday seçimi", () => {
  it("sadece ekran kartı ve işlemci taranır", () => {
    // Diğer kategoriler indeksi hiç değiştirmiyor; taransalar 0 artışla elenirdi.
    expect(UPGRADE_CATEGORIES).toEqual(["gpu", "cpu"]);
  });

  it("kategori başına en fazla bir öneri döner", () => {
    const sonuc = suggestUpgrades(input());
    expect(sonuc.length).toBeLessThanOrEqual(2);
    expect(new Set(sonuc.map((s) => s.category)).size).toBe(sonuc.length);
  });

  it("öneriler indeks artışına göre büyükten küçüğe sıralı", () => {
    const sonuc = suggestUpgrades(input());
    for (let i = 1; i < sonuc.length; i++) {
      expect(sonuc[i - 1].index_delta).toBeGreaterThanOrEqual(sonuc[i].index_delta);
    }
  });

  it("mevcut parçanın kendisi aday olamaz", () => {
    const sonuc = suggestUpgrades(input());
    for (const oneri of sonuc) {
      expect(oneri.suggested_part_id).not.toBe(oneri.current_part_id);
    }
  });

  it("indeksi olmayan parça aday olamaz — hız tahmin edilmez", () => {
    const indekssiz: UpgradePart = { id: "gpu-bilinmeyen", price_minor: 1500000 };
    const sonuc = suggestUpgrades(
      input({ candidates: { gpu: [GPU_5070, indekssiz], cpu: [] } }),
    );
    expect(sonuc.map((s) => s.suggested_part_id)).not.toContain("gpu-bilinmeyen");
  });
});

describe("bütçe sınırı", () => {
  it("bütçeyi aşan parça önerilmez", () => {
    // 5070 -> 5090 farkı 70.499,00 TL. Bütçe 10.000,00 TL.
    const sonuc = suggestUpgrades(input({ budget_delta_minor: 1000000 }));
    expect(sonuc.map((s) => s.suggested_part_id)).not.toContain("gpu-5090");
  });

  it("bütçe tam yettiğinde parça önerilebilir", () => {
    const fark = GPU_9070.price_minor - GPU_5070.price_minor; // 8.250,00 TL
    const sonuc = suggestUpgrades(
      input({ budget_delta_minor: fark, candidates: { gpu: ALL_GPUS, cpu: [] } }),
    );
    expect(sonuc[0]?.suggested_part_id).toBe("gpu-9070");
    expect(sonuc[0]?.price_delta_minor).toBe(fark);
  });

  it("bütçe bir kuruş eksikse o parça elenir", () => {
    const fark = GPU_9070.price_minor - GPU_5070.price_minor;
    const sonuc = suggestUpgrades(
      input({ budget_delta_minor: fark - 1, candidates: { gpu: ALL_GPUS, cpu: [] } }),
    );
    expect(sonuc.map((s) => s.suggested_part_id)).not.toContain("gpu-9070");
  });

  it("bütçe sıfırsa sadece aynı fiyata veya daha ucuza yükseltme kalır", () => {
    const ucuzVeGuclu: UpgradePart = {
      id: "gpu-kelepir",
      price_minor: GPU_5070.price_minor - 100,
      perf_index: 70,
    };
    const sonuc = suggestUpgrades(
      input({ budget_delta_minor: 0, candidates: { gpu: [...ALL_GPUS, ucuzVeGuclu], cpu: [] } }),
    );
    expect(sonuc[0]?.suggested_part_id).toBe("gpu-kelepir");
    expect(sonuc[0]?.price_delta_minor).toBe(-100);
  });

  it("bütçe hiçbir şeye yetmiyorsa boş döner, öneri uydurulmaz", () => {
    expect(suggestUpgrades(input({ budget_delta_minor: 1000 }))).toEqual([]);
  });
});

describe("en iyi öneriyi seçme", () => {
  it("indeksi en çok artıran seçilir, en pahalı olan değil", () => {
    // Bütçe her ikisine de yetiyor: 9070 (62) daha çok artırır.
    const sonuc = suggestUpgrades(
      input({ budget_delta_minor: 2000000, candidates: { gpu: ALL_GPUS, cpu: [] } }),
    );
    expect(sonuc[0].suggested_part_id).toBe("gpu-9070");
  });

  it("eşit indeks artışında ucuz olan kazanır", () => {
    const pahali: UpgradePart = { id: "gpu-pahali", price_minor: 3000000, perf_index: 62 };
    const ucuz: UpgradePart = { id: "gpu-ucuz", price_minor: 2800000, perf_index: 62 };
    const sonuc = suggestUpgrades(
      input({ budget_delta_minor: 2000000, candidates: { gpu: [pahali, ucuz], cpu: [] } }),
    );
    expect(sonuc[0].suggested_part_id).toBe("gpu-ucuz");
  });

  it("aday sırası sonucu değiştirmez", () => {
    const ileri = suggestUpgrades(input({ budget_delta_minor: 2000000 }));
    const geri = suggestUpgrades(
      input({
        budget_delta_minor: 2000000,
        candidates: { gpu: [...ALL_GPUS].reverse(), cpu: [...ALL_CPUS].reverse() },
      }),
    );
    expect(geri).toEqual(ileri);
  });

  it("çıktı hangi parça, kaç TL fark ve indeks kaça çıkıyor sorularını cevaplar", () => {
    const sonuc = suggestUpgrades(
      input({ budget_delta_minor: 2000000, candidates: { gpu: ALL_GPUS, cpu: [] } }),
    );
    // 1440p, mevcut: gpu 54 / cpu 55 -> 54*0.75 + 55*0.25 = 40.5 + 13.75 = 54.25 -> 54.3
    // 9070 ile:      gpu 62 / cpu 55 -> 62*0.75 + 55*0.25 = 46.5 + 13.75 = 60.25 -> 60.3
    expect(sonuc[0]).toEqual({
      category: "gpu",
      current_part_id: "gpu-5070",
      suggested_part_id: "gpu-9070",
      price_delta_minor: 825000,
      index_before: 54.3,
      index_after: 60.3,
      index_delta: 6,
    });
  });
});

describe("çözünürlük öneriyi değiştirir", () => {
  // Aynı sistem, aynı bütçe: 1080p'de işlemcinin payı %45, 4K'da %12.
  // 8.500,00 TL: hem ekran kartı (5070 -> 9070, +8.250) hem işlemci
  // (7600 -> 7800X3D, +7.500) yükseltmesine yetiyor. Seçimi bütçe değil
  // çözünürlük belirlesin diye ikisi de erişilebilir tutuldu.
  const budget = 850000;

  it("1080p'de işlemci yükseltmesi öne geçebiliyor", () => {
    const sonuc = suggestUpgrades(input({ resolution: "1080p", budget_delta_minor: budget }));
    expect(sonuc[0].category).toBe("cpu");
  });

  it("4K'da ekran kartı yükseltmesi öne geçiyor", () => {
    const sonuc = suggestUpgrades(input({ resolution: "2160p", budget_delta_minor: budget }));
    expect(sonuc[0].category).toBe("gpu");
  });

  it("aynı yükseltme 4K'da 1080p'dekinden daha çok kazandırıyor (ekran kartı)", () => {
    const at1080 = suggestUpgrades(
      input({ resolution: "1080p", budget_delta_minor: budget, candidates: { gpu: ALL_GPUS, cpu: [] } }),
    );
    const at2160 = suggestUpgrades(
      input({ resolution: "2160p", budget_delta_minor: budget, candidates: { gpu: ALL_GPUS, cpu: [] } }),
    );
    expect(at2160[0].suggested_part_id).toBe(at1080[0].suggested_part_id);
    expect(at2160[0].index_delta).toBeGreaterThan(at1080[0].index_delta);
  });
});

describe("eksik girdi", () => {
  it("ekran kartı yoksa öneri yapılmaz — indeks hesaplanamıyor", () => {
    expect(suggestUpgrades(input({ current: { cpu: CPU_7600 } }))).toEqual([]);
  });

  it("işlemci yoksa öneri yapılmaz", () => {
    expect(suggestUpgrades(input({ current: { gpu: GPU_5070 } }))).toEqual([]);
  });

  it("aday listesi boşsa boş döner", () => {
    expect(suggestUpgrades(input({ candidates: { gpu: [], cpu: [] } }))).toEqual([]);
  });

  it("mevcut sistem zaten en iyisiyse boş döner", () => {
    const sonuc = suggestUpgrades(
      input({
        current: { gpu: GPU_5090, cpu: CPU_15900 },
        budget_delta_minor: 100000000,
      }),
    );
    expect(sonuc).toEqual([]);
  });
});

describe("motor saflığı", () => {
  it("aynı girdi her zaman aynı çıktıyı verir", () => {
    expect(suggestUpgrades(input())).toEqual(suggestUpgrades(input()));
  });

  it("girdi nesnesi değiştirilmez", () => {
    const girdi = input();
    const kopya = JSON.parse(JSON.stringify(girdi));
    suggestUpgrades(girdi);
    expect(JSON.parse(JSON.stringify(girdi))).toEqual(kopya);
  });
});
