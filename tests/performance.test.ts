import { describe, expect, it } from "vitest";

import {
  BANDS,
  BOTTLENECK_THRESHOLD,
  MODEL_VERSION,
  RESOLUTION_WEIGHTS,
  bandFor,
  bottleneckFor,
  computePerformance,
  freezeSystemIndex,
} from "../engine/performance";
import type { PerformanceResult, Resolution } from "../engine/types";

// computePerformance eksik girdide { ok: false } döndürüyor. Testlerin çoğu
// hesabın kendisiyle ilgileniyor; bu yardımcı, hesap yapılmadığında testi
// sessizce geçirmek yerine orada patlatıyor.
function compute(input: {
  resolution: Resolution;
  gpu_index?: number;
  cpu_index?: number;
}): PerformanceResult {
  const outcome = computePerformance(input);
  if (!outcome.ok) {
    throw new Error(`Hesap beklenirken eksik girdi bildirildi: ${outcome.missing.join(", ")}`);
  }
  return outcome;
}

describe("sistem indeksi — çözünürlük ağırlıkları (SCHEMA.md bölüm 8)", () => {
  it("1080p: gpu 0.55 / cpu 0.45", () => {
    // 80*0.55 + 40*0.45 = 44 + 18 = 62
    expect(compute({ resolution: "1080p", gpu_index: 80, cpu_index: 40 }).system_index).toBe(62);
  });

  it("1440p: gpu 0.75 / cpu 0.25", () => {
    // 80*0.75 + 40*0.25 = 60 + 10 = 70
    expect(compute({ resolution: "1440p", gpu_index: 80, cpu_index: 40 }).system_index).toBe(70);
  });

  it("2160p: gpu 0.88 / cpu 0.12", () => {
    // 80*0.88 + 40*0.12 = 70.4 + 4.8 = 75.2
    expect(compute({ resolution: "2160p", gpu_index: 80, cpu_index: 40 }).system_index).toBe(75.2);
  });

  it("ağırlıklar her çözünürlükte 1 ediyor", () => {
    for (const weights of Object.values(RESOLUTION_WEIGHTS)) {
      expect(weights.gpu + weights.cpu).toBeCloseTo(1, 10);
    }
  });

  it("çözünürlük yükseldikçe ekran kartının payı artıyor", () => {
    // Aynı sistem, sadece çözünürlük değişiyor: güçlü kart + zayıf işlemci.
    const at1080 = compute({ resolution: "1080p", gpu_index: 90, cpu_index: 30 }).system_index;
    const at1440 = compute({ resolution: "1440p", gpu_index: 90, cpu_index: 30 }).system_index;
    const at2160 = compute({ resolution: "2160p", gpu_index: 90, cpu_index: 30 }).system_index;
    expect(at1080).toBeLessThan(at1440);
    expect(at1440).toBeLessThan(at2160);
  });

  it("iki indeks de aynıysa sistem indeksi de aynı sayıdır", () => {
    for (const resolution of ["1080p", "1440p", "2160p"] as Resolution[]) {
      expect(compute({ resolution, gpu_index: 55, cpu_index: 55 }).system_index).toBe(55);
    }
  });

  it("daha güçlü ekran kartı indeksi düşürmez", () => {
    const zayif = compute({ resolution: "1440p", gpu_index: 40, cpu_index: 60 }).system_index;
    const guclu = compute({ resolution: "1440p", gpu_index: 41, cpu_index: 60 }).system_index;
    expect(guclu).toBeGreaterThan(zayif);
  });

  it("sonuç bir ondalık basamağa yuvarlanır", () => {
    // 33*0.55 + 47*0.45 = 18.15 + 21.15 = 39.3 — float artığı sızmamalı
    const sonuc = compute({ resolution: "1080p", gpu_index: 33, cpu_index: 47 }).system_index;
    expect(sonuc).toBe(39.3);
  });

  it("hesabın hangi sürümden geldiği çıktıda yazıyor", () => {
    expect(compute({ resolution: "1080p", gpu_index: 50, cpu_index: 50 }).model_version).toBe(
      "v0.2",
    );
    expect(MODEL_VERSION).toBe("v0.2");
  });
});

describe("bantlar", () => {
  it("SCHEMA.md bölüm 8'deki beş bant, sırayla", () => {
    expect(BANDS.map((band) => band.label)).toEqual([
      "1080p düşük ayar",
      "1080p orta/yüksek ayar",
      "1440p yüksek ayar",
      "1440p ultra / 4K yüksek",
      "4K ultra",
    ]);
  });

  it("bant içindeki değerler doğru etiketi alıyor", () => {
    expect(bandFor(0)).toBe("1080p düşük ayar");
    expect(bandFor(20)).toBe("1080p düşük ayar");
    expect(bandFor(55)).toBe("1080p orta/yüksek ayar");
    expect(bandFor(80)).toBe("1440p yüksek ayar");
    expect(bandFor(110)).toBe("1440p ultra / 4K yüksek");
    expect(bandFor(150)).toBe("4K ultra");
  });

  it("üst sınır bir sonraki banda aittir (K33)", () => {
    expect(bandFor(39.9)).toBe("1080p düşük ayar");
    expect(bandFor(40)).toBe("1080p orta/yüksek ayar");
    expect(bandFor(64.9)).toBe("1080p orta/yüksek ayar");
    expect(bandFor(65)).toBe("1440p yüksek ayar");
    expect(bandFor(89.9)).toBe("1440p yüksek ayar");
    expect(bandFor(90)).toBe("1440p ultra / 4K yüksek");
    expect(bandFor(129.9)).toBe("1440p ultra / 4K yüksek");
    expect(bandFor(130)).toBe("4K ultra");
  });

  // K73: referans sistem (iki parça da 100) her çözünürlükte tam 100 verir.
  it("referans sistem 100'de ve ortadaki bantta durur", () => {
    const sonuc = compute({ resolution: "2160p", gpu_index: 100, cpu_index: 100 });
    expect(sonuc.system_index).toBe(100);
    expect(sonuc.band).toBe("1440p ultra / 4K yüksek");
  });

  it("100'ün üstü tablonun dışına düşmez", () => {
    expect(bandFor(216)).toBe("4K ultra");
    expect(bandFor(1000)).toBe("4K ultra");
  });

  it("bant, gösterilen sistem indeksiyle tutarlıdır", () => {
    const sonuc = compute({ resolution: "1080p", gpu_index: 45, cpu_index: 45 });
    expect(sonuc.system_index).toBe(45);
    expect(sonuc.band).toBe(bandFor(sonuc.system_index));
  });
});

describe("darboğaz göstergesi", () => {
  it("fark 15'ten küçükse dengeli", () => {
    expect(bottleneckFor(60, 50)).toBe("balanced");
    expect(bottleneckFor(50, 60)).toBe("balanced");
    expect(bottleneckFor(50, 50)).toBe("balanced");
    expect(bottleneckFor(64.9, 50)).toBe("balanced");
  });

  it("ekran kartı işlemciden 15+ güçlüyse işlemci sınırlıyor", () => {
    expect(bottleneckFor(65, 50)).toBe("cpu_limited");
    expect(bottleneckFor(100, 40)).toBe("cpu_limited");
  });

  it("işlemci ekran kartından 15+ güçlüyse ekran kartı sınırlıyor", () => {
    expect(bottleneckFor(50, 65)).toBe("gpu_limited");
    expect(bottleneckFor(30, 90)).toBe("gpu_limited");
  });

  it("tam eşik değeri darboğaz sayılır, boşlukta kalmaz (K33)", () => {
    expect(BOTTLENECK_THRESHOLD).toBe(15);
    expect(bottleneckFor(65, 50)).toBe("cpu_limited"); // fark tam +15
    expect(bottleneckFor(50, 65)).toBe("gpu_limited"); // fark tam -15
  });

  it("darboğaz çözünürlükten etkilenmez — v0.1 ham farka bakar", () => {
    for (const resolution of ["1080p", "1440p", "2160p"] as Resolution[]) {
      expect(compute({ resolution, gpu_index: 90, cpu_index: 40 }).bottleneck).toBe("cpu_limited");
    }
  });

  it("her darboğaz durumunun okunur bir açıklaması var", () => {
    const dengeli = compute({ resolution: "1080p", gpu_index: 50, cpu_index: 50 });
    const cpu = compute({ resolution: "1080p", gpu_index: 90, cpu_index: 40 });
    const gpu = compute({ resolution: "1080p", gpu_index: 40, cpu_index: 90 });
    expect(dengeli.bottleneck_message).toContain("Dengeli");
    expect(cpu.bottleneck_message).toContain("İşlemci sınırlıyor");
    expect(gpu.bottleneck_message).toContain("Ekran kartı sınırlıyor");
  });
});

describe("eksik ve bozuk girdi", () => {
  it("ekran kartı indeksi yoksa hesap yapılmaz", () => {
    const sonuc = computePerformance({ resolution: "1440p", cpu_index: 70 });
    expect(sonuc.ok).toBe(false);
    if (!sonuc.ok) expect(sonuc.missing).toEqual(["gpu"]);
  });

  it("işlemci indeksi yoksa hesap yapılmaz", () => {
    const sonuc = computePerformance({ resolution: "1440p", gpu_index: 70 });
    expect(sonuc.ok).toBe(false);
    if (!sonuc.ok) expect(sonuc.missing).toEqual(["cpu"]);
  });

  it("ikisi de yoksa ikisi de bildirilir", () => {
    const sonuc = computePerformance({ resolution: "1080p" });
    expect(sonuc.ok).toBe(false);
    if (!sonuc.ok) expect(sonuc.missing).toEqual(["gpu", "cpu"]);
  });

  it("eksik parçaya 0 denmez — uydurma düşük sayı üretilmez", () => {
    // 0 sayılsaydı 1440p'de 70*0.25 = 17.5 gibi bir sayı çıkardı.
    expect(computePerformance({ resolution: "1440p", cpu_index: 70 }).ok).toBe(false);
  });

  it("indeks 0 geçerli bir değerdir, eksik sayılmaz", () => {
    const sonuc = compute({ resolution: "1080p", gpu_index: 0, cpu_index: 0 });
    expect(sonuc.system_index).toBe(0);
    expect(sonuc.band).toBe("1080p düşük ayar");
  });

  // K73: tavan yok. Eskiden 100'de kırpılıyordu; ölçek "kataloğun en hızlısı
  // = 100" iken doğruydu, artık RTX 5090'ı RTX 4070 seviyesine indirirdi.
  it("100'ün üstü kırpılmaz, negatif sıfıra çekilir", () => {
    const yuksek = compute({ resolution: "1080p", gpu_index: 216, cpu_index: 144 });
    expect(yuksek.gpu_index).toBe(216);
    expect(yuksek.cpu_index).toBe(144);
    expect(yuksek.system_index).toBe(183.6); // 216*0.55 + 144*0.45

    const dusuk = compute({ resolution: "1080p", gpu_index: -20, cpu_index: 50 });
    expect(dusuk.gpu_index).toBe(0);
    expect(dusuk.system_index).toBe(22.5); // 0*0.55 + 50*0.45
  });
});

describe("motor saflığı", () => {
  it("aynı girdi her zaman aynı çıktıyı verir", () => {
    const girdi = { resolution: "1440p" as const, gpu_index: 62, cpu_index: 78 };
    expect(computePerformance(girdi)).toEqual(computePerformance(girdi));
  });

  it("girdi nesnesi değiştirilmez", () => {
    const girdi = { resolution: "1440p" as const, gpu_index: 62, cpu_index: 78 };
    computePerformance(girdi);
    expect(girdi).toEqual({ resolution: "1440p", gpu_index: 62, cpu_index: 78 });
  });
});

describe("dondurulan indeks (K43, K44)", () => {
  it("hesaplanabiliyorsa sistem indeksinin kendisi donar", () => {
    // 1440p: 54*0.75 + 78*0.25 = 40.5 + 19.5 = 60
    expect(freezeSystemIndex({ resolution: "1440p", gpu_index: 54, cpu_index: 78 })).toBe(60);
  });

  it("kullanıcının seçtiği çözünürlükte donar — sabit bir referansta değil", () => {
    const parts = { gpu_index: 100, cpu_index: 55 };
    const at1080 = freezeSystemIndex({ resolution: "1080p", ...parts });
    const at1440 = freezeSystemIndex({ resolution: "1440p", ...parts });
    const at2160 = freezeSystemIndex({ resolution: "2160p", ...parts });

    expect(at1080).toBe(79.8);
    expect(at1440).toBe(88.8);
    expect(at2160).toBe(94.6);
    // Üçü de farklı: çözünürlük saklanmasaydı bu sayı neyi ifade ettiği
    // bilinmeyen bir sayı olurdu.
    expect(new Set([at1080, at1440, at2160]).size).toBe(3);
  });

  it("ekran kartı yoksa null döner — iGPU sistemi kaydedilebilmeli", () => {
    expect(freezeSystemIndex({ resolution: "1440p", cpu_index: 78 })).toBeNull();
  });

  it("işlemci yoksa null döner", () => {
    expect(freezeSystemIndex({ resolution: "1440p", gpu_index: 54 })).toBeNull();
  });

  it("ikisi de yoksa null döner", () => {
    expect(freezeSystemIndex({ resolution: "1080p" })).toBeNull();
  });

  it("null dönüyor, 0 değil — 'hesaplanamadı' ile 'çok yavaş' aynı şey değil", () => {
    const sonuc = freezeSystemIndex({ resolution: "1440p", cpu_index: 78 });
    expect(sonuc).toBeNull();
    expect(sonuc).not.toBe(0);
  });

  it("gerçek 0 ile hesaplanamayan ayırt edilebiliyor", () => {
    // İki indeks de 0 ise sonuç 0'dır ve bu null değildir.
    expect(freezeSystemIndex({ resolution: "1440p", gpu_index: 0, cpu_index: 0 })).toBe(0);
  });

  it("computePerformance ile aynı sayıyı üretir — iki yol ayrışmaz", () => {
    const girdi = { resolution: "2160p" as const, gpu_index: 62, cpu_index: 92 };
    const hesap = computePerformance(girdi);
    expect(hesap.ok).toBe(true);
    if (hesap.ok) expect(freezeSystemIndex(girdi)).toBe(hesap.system_index);
  });
});
