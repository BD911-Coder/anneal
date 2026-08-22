import { describe, expect, it } from "vitest";

import {
  MIN_FAMILY_FOR_OWN_BAND,
  bandFromErrors,
  confidenceFor,
  estimate,
  fit,
  fitFamily,
  predict,
} from "../engine/index-prediction";
import type { MeasuredPoint } from "../engine/index-prediction";

/** Tam olarak y = 2·x^1 üzerinde duran noktalar: model bunu bulmalı. */
const dogrusal: MeasuredPoint[] = [
  { id: "a", family: "f1", x: 10, y: 20 },
  { id: "b", family: "f1", x: 20, y: 40 },
  { id: "c", family: "f1", x: 30, y: 60 },
  { id: "d", family: "f1", x: 40, y: 80 },
];

describe("fit / predict", () => {
  it("üç noktadan azıyla model kurmaz", () => {
    expect(fit(dogrusal.slice(0, 2))).toBeNull();
  });

  it("bilinen bir güç yasasını geri bulur", () => {
    const m = fit(dogrusal)!;
    expect(m.b).toBeCloseTo(1, 6);
    expect(predict(m, 50)).toBeCloseTo(100, 4);
  });

  it("bütün x'ler aynıysa model kurmaz", () => {
    const sabit = dogrusal.map((p) => ({ ...p, x: 10 }));
    expect(fit(sabit)).toBeNull();
  });
});

describe("bandFromErrors", () => {
  it("boş listede sonsuz döner — bant bilinmiyor demektir", () => {
    expect(bandFromErrors([])).toBe(Infinity);
  });

  it("%90 dilimini alır, ortalamayı değil", () => {
    // Ortalama 10.9 olurdu; p90 çok daha yüksek ve dürüst olan o.
    expect(bandFromErrors([1, 1, 1, 1, 1, 1, 1, 1, 1, 100])).toBe(100);
  });
});

describe("fitFamily", () => {
  it("ailede yeterli ölçüm yoksa null döner — bant uydurmaz", () => {
    const az = dogrusal.slice(0, MIN_FAMILY_FOR_OWN_BAND - 1);
    expect(fitFamily(az)).toBeNull();
  });

  it("yeterli ölçüm varsa bant ve n taşır", () => {
    const m = fitFamily(dogrusal)!;
    expect(m.n).toBe(4);
    expect(m.bandPct).toBeLessThan(1); // veri tam doğrusal, hata ~0
  });
});

describe("estimate", () => {
  const karisik: MeasuredPoint[] = [
    ...dogrusal,
    { id: "e", family: "f2", x: 10, y: 25 },
    { id: "f", family: "f2", x: 20, y: 50 },
    { id: "g", family: "f3", x: 15, y: 30 },
    { id: "h", family: "f3", x: 25, y: 50 },
    { id: "i", family: "f3", x: 35, y: 70 },
  ];

  it("doğrulanabilir ailede kendi bandını kullanır", () => {
    const e = estimate(karisik, "f1", 50)!;
    expect(e.method).toBe("spec-model");
    // f1 dört ölçümlü; kendi bandı sıfıra yakın, aileler arası bandından dar.
    expect(e.bandSourceFamily).toBe("f1");
    expect(e.index).toBeCloseTo(100, 0);
  });

  it("doğrulanamayan aile aileler arası bandı devralır, kendi adını taşımaz", () => {
    const e = estimate(karisik, "f2", 30)!;
    expect(e.method).toBe("spec-model");
    expect(e.bandSourceFamily).toBeNull();
  });

  it("eksen yoksa ailenin ortalamasına düşer ve MODEL DEMEZ", () => {
    const e = estimate(karisik, "f1", null)!;
    expect(e.method).toBe("family-mean");
    expect(e.bandSourceFamily).toBe("f1");
    expect(e.index).toBeCloseTo(50, 0);
  });

  it("ailede hiç ölçüm yoksa bütün ölçümlerin ortalamasına düşer", () => {
    const e = estimate(karisik, "bilinmeyen-aile", null)!;
    expect(e.method).toBe("family-mean");
    expect(e.bandSourceFamily).toBeNull();
  });

  it("hiç ölçüm yoksa null döner — uydurma sayı üretmez", () => {
    expect(estimate([], "f1", 10)).toBeNull();
  });

  it("her zaman bir bant taşır", () => {
    for (const fam of ["f1", "f2", "f3", "yok"]) {
      const e = estimate(karisik, fam, 20);
      expect(e).not.toBeNull();
      expect(Number.isFinite(e!.bandPct)).toBe(true);
      expect(e!.nUsed).toBeGreaterThan(0);
    }
  });
});

describe("confidenceFor", () => {
  it("dar bant yüksek, geniş bant düşük güven", () => {
    expect(confidenceFor(8)).toBe("high");
    expect(confidenceFor(22)).toBe("medium");
    expect(confidenceFor(40)).toBe("low");
  });
});
