import { describe, expect, it } from "vitest";

import {
  MIN_RATIO_MEASUREMENTS,
  countByOrigin,
  estimateGameFps,
  ratioFor,
} from "../engine/fps-estimate";
import type { FpsGameGroup } from "../engine/fps-estimate";

// Gerçek veriden alınmış bir grup: Cyberpunk 2077, 1440p ultra, DLSS/FSR
// Quality. Sekiz ölçüm, indeksler perf_index'ten.
const cyberpunk: FpsGameGroup = {
  game_id: "cyberpunk-2077",
  game_name: "Cyberpunk 2077",
  setting_label: "1440p ultra, DLSS/FSR Quality",
  measurements: [
    { part_id: "nvidia-rtx-5090", avg_fps: 202.6, index: 216 },
    { part_id: "nvidia-rtx-4090", avg_fps: 149.3, index: 180.5 },
    { part_id: "nvidia-rtx-5070-ti", avg_fps: 124.6, index: 143.1 },
    { part_id: "amd-rx-9070-xt", avg_fps: 120.4, index: 146.2 },
    { part_id: "amd-rx-9070", avg_fps: 109.4, index: 128.4 },
    { part_id: "nvidia-rtx-5070", avg_fps: 108.5, index: 121 },
    { part_id: "amd-rx-7600", avg_fps: 55.3, index: 61.3 },
    { part_id: "nvidia-rtx-4060", avg_fps: 47.2, index: 61 },
  ],
};

describe("ratioFor — oyun içi FPS/indeks oranı", () => {
  it("indeksi olan ölçümlerin ortalamasını verir", () => {
    const ratio = ratioFor(cyberpunk.measurements);

    // Ölçülen aralık 0.774–0.938; ortalama bu aralıkta olmalı.
    expect(ratio).not.toBeNull();
    expect(ratio!).toBeGreaterThan(0.774);
    expect(ratio!).toBeLessThan(0.938);
  });

  it("yeterli ölçüm yoksa null verir — uydurma oran üretmez", () => {
    const az = cyberpunk.measurements.slice(0, MIN_RATIO_MEASUREMENTS - 1);

    expect(ratioFor(az)).toBeNull();
  });

  it("indeksi olmayan ölçüm orana katılmaz", () => {
    const indekssiz = cyberpunk.measurements.map((m) => ({ ...m, index: undefined }));

    expect(ratioFor(indekssiz)).toBeNull();
  });

  it("sıfır ve negatif indeks orana katılmaz — bölme tanımsız olurdu", () => {
    const bozuk = [
      { part_id: "a", avg_fps: 100, index: 0 },
      { part_id: "b", avg_fps: 100, index: -5 },
      { part_id: "c", avg_fps: 100, index: 100 },
    ];

    // Üç ölçüm var ama yalnızca biri kullanılabilir; eşiğin altında kalır.
    expect(ratioFor(bozuk)).toBeNull();
  });
});

describe("estimateGameFps — ölçüm mü türetme mi", () => {
  it("ölçülmüş hücrede ölçümün kendisini verir, türetme yapmaz", () => {
    const [satir] = estimateGameFps("nvidia-rtx-5090", 216, [cyberpunk]);

    expect(satir.origin).toBe("measured");
    // Kaynağında yazan sayı: yuvarlanmadan, oranla düzeltilmeden.
    expect(satir.fps).toBe(202.6);
  });

  it("ölçümü olmayan kartta oranla türetir ve türetildi diye işaretler", () => {
    // RX 9070 GRE'nin bu oyunda ölçümü yok; indeksi 111.6.
    const [satir] = estimateGameFps("amd-rx-9070-gre", 111.6, [cyberpunk]);

    expect(satir.origin).toBe("derived");
    // Ölçülen kartlar arasına düşmeli: RTX 5070 (121 indeks, 108.5 FPS) ile
    // RX 7600 (61.3 indeks, 55.3 FPS) arasında.
    expect(satir.fps).toBeGreaterThan(55.3);
    expect(satir.fps).toBeLessThan(108.5);
  });

  it("türetilen sayı tam sayıdır — ±%10 hata payında ondalık yanlış kesinliktir", () => {
    const [satir] = estimateGameFps("amd-rx-9070-gre", 111.6, [cyberpunk]);

    expect(Number.isInteger(satir.fps)).toBe(true);
  });

  it("indeksi olmayan kart için satır üretmez", () => {
    // Kapsam dışı kart: arayüz "bu kart için ölçüm yok" diyecek.
    expect(estimateGameFps("nvidia-rtx-5080", undefined, [cyberpunk])).toEqual([]);
  });

  it("sıfır indeks için satır üretmez", () => {
    expect(estimateGameFps("bozuk-parca", 0, [cyberpunk])).toEqual([]);
  });

  it("oranı hesaplanamayan oyun listeden düşer, null FPS'li satır üretilmez", () => {
    const seyrek: FpsGameGroup = {
      ...cyberpunk,
      game_id: "seyrek-oyun",
      measurements: cyberpunk.measurements.slice(0, 2),
    };

    const satirlar = estimateGameFps("amd-rx-9070-gre", 111.6, [cyberpunk, seyrek]);

    expect(satirlar).toHaveLength(1);
    expect(satirlar[0].game_id).toBe("cyberpunk-2077");
  });

  it("seyrek grupta bile kendi ölçümü olan kart ölçümünü alır", () => {
    // Oran hesaplanamıyor ama ölçüm bir gerçek; kaybedilmemeli.
    const seyrek: FpsGameGroup = {
      ...cyberpunk,
      measurements: cyberpunk.measurements.slice(0, 2),
    };

    const [satir] = estimateGameFps("nvidia-rtx-5090", 216, [seyrek]);

    expect(satir.origin).toBe("measured");
    expect(satir.fps).toBe(202.6);
  });

  it("ayar etiketi grubundan geçer — hangi ayarda ölçüldüğü kaybolmaz", () => {
    const [satir] = estimateGameFps("amd-rx-9070-gre", 111.6, [cyberpunk]);

    expect(satir.setting_label).toBe("1440p ultra, DLSS/FSR Quality");
  });

  it("motor sıralama yapmaz — sıra arayüz kararıdır (S40)", () => {
    const ikinci: FpsGameGroup = { ...cyberpunk, game_id: "a-oyun", game_name: "A Oyun" };
    const satirlar = estimateGameFps("amd-rx-9070-gre", 111.6, [cyberpunk, ikinci]);

    // Girdi sırası korunuyor; alfabetik ya da FPS'e göre dizilmiyor.
    expect(satirlar.map((s) => s.game_id)).toEqual(["cyberpunk-2077", "a-oyun"]);
  });
});

describe("estimateGameFps — gerçek veriye karşı doğruluk", () => {
  // Birini-dışarıda-bırak: RTX 5070'in kendi ölçümü hesaba katılmadan
  // tahmin edilir ve gerçek ölçümüyle karşılaştırılır. lib/fps-margin.ts'teki
  // hata payı bu yöntemle ölçüldü; burada tek bir örnekle sınanıyor.
  it("kendi verisi olmadan tahmin, gerçek ölçüme yakın çıkar", () => {
    const digerleri: FpsGameGroup = {
      ...cyberpunk,
      measurements: cyberpunk.measurements.filter((m) => m.part_id !== "nvidia-rtx-5070"),
    };

    const [satir] = estimateGameFps("nvidia-rtx-5070", 121, [digerleri]);
    const gercek = 108.5;
    const hata = Math.abs(satir.fps - gercek) / gercek;

    expect(satir.origin).toBe("derived");
    expect(hata).toBeLessThan(0.15);
  });
});

describe("countByOrigin", () => {
  it("ölçülmüş ve türetilmiş sayısını ayrı sayar", () => {
    const ikinci: FpsGameGroup = { ...cyberpunk, game_id: "ikinci-oyun" };
    const satirlar = estimateGameFps("nvidia-rtx-5090", 216, [cyberpunk, ikinci]);

    expect(countByOrigin(satirlar)).toEqual({ measured: 2, derived: 0 });
  });

  it("boş listede sıfır verir", () => {
    expect(countByOrigin([])).toEqual({ measured: 0, derived: 0 });
  });
});
