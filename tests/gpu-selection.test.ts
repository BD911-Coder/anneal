import { describe, expect, it } from "vitest";

import { checkCompatibility } from "../engine/compatibility";
import { resolveGpuSelection, resolvePerfIndex } from "../engine/gpu-selection";
import type {
  EngineCase,
  EngineCpu,
  EngineGpu,
  EngineGpuVariant,
  EnginePsu,
} from "../engine/types";

// Çip: üreticinin referans kartı. 304 mm, 360 W.
const chip: EngineGpu = { id: "nvidia-rtx-5080", tdp_watt: 360, length_mm: 304 };

// Uzun ve daha çok güç çeken özel tasarım kart.
const strix: EngineGpuVariant = { id: "asus-rog-strix-rtx-5080-oc", tbp_watt: 400, length_mm: 358 };

const cpu: EngineCpu = { id: "amd-ryzen-7-9800x3d", socket: "AM5", tdp_watt: 120, has_igpu: false };
const psu: EnginePsu = { id: "corsair-rm850e", wattage: 850, length_mm: 140 };
const pcCase: EngineCase = {
  id: "fractal-north",
  supported_form_factors: ["ATX", "mATX", "ITX"],
  max_gpu_length_mm: 355,
  max_psu_length_mm: 175,
};

function codes(gpu: EngineGpu) {
  return checkCompatibility({ cpu, gpu, psu, case: pcCase }).map((finding) => finding.code);
}

describe("resolveGpuSelection — kart seçilmemişse çip", () => {
  it("çipin değerlerini olduğu gibi verir", () => {
    const resolved = resolveGpuSelection(chip);

    expect(resolved.gpu).toEqual(chip);
    expect(resolved.tdp_origin).toBe("chip_reference");
    expect(resolved.length_origin).toBe("chip_reference");
  });

  it("çipin uzunluğu yoksa uzunluk bilinmiyor sayılır (K52)", () => {
    const resolved = resolveGpuSelection({ id: "amd-rx-9070-xt", tdp_watt: 304 });

    expect(resolved.gpu.length_mm).toBeUndefined();
    expect(resolved.length_origin).toBe("unknown");
    // Güç tarafı yine çipten geliyor: tdp_watt zorunlu alan.
    expect(resolved.tdp_origin).toBe("chip_reference");
  });
});

describe("resolveGpuSelection — kart seçiliyse kartın değerleri", () => {
  it("kartın TBP'si ve uzunluğu kullanılır, kimlik kartındır", () => {
    const resolved = resolveGpuSelection(chip, strix);

    expect(resolved.gpu.id).toBe("asus-rog-strix-rtx-5080-oc");
    expect(resolved.gpu.tdp_watt).toBe(400);
    expect(resolved.gpu.length_mm).toBe(358);
    expect(resolved.tdp_origin).toBe("variant");
    expect(resolved.length_origin).toBe("variant");
  });

  // K87'nin iki yarısı. Bu iki test kuralın kendisidir.
  it("kartın TBP'si yoksa çipin tdp_watt'ına geri düşer (yaklaşık kural)", () => {
    const resolved = resolveGpuSelection(chip, { id: "zotac-rtx-5080-solid", length_mm: 330 });

    expect(resolved.gpu.tdp_watt).toBe(360);
    expect(resolved.tdp_origin).toBe("chip_reference");
  });

  it("kartın uzunluğu yoksa çipin uzunluğuna geri DÜŞMEZ (kesin kural)", () => {
    const resolved = resolveGpuSelection(chip, { id: "zotac-rtx-5080-solid", tbp_watt: 380 });

    expect(resolved.gpu.length_mm).toBeUndefined();
    expect(resolved.length_origin).toBe("unknown");
  });
});

describe("kural sonucu gerçekten değişiyor mu", () => {
  it("C5: çip sığarken uzun kart sığmıyor", () => {
    // Çip 304 mm, kasa 355 mm -> sorun yok.
    expect(codes(resolveGpuSelection(chip).gpu)).not.toContain("C5");
    // Aynı çipin 358 mm'lik kartı -> sığmıyor.
    expect(codes(resolveGpuSelection(chip, strix).gpu)).toContain("C5");
  });

  it("C5: uzunluğu bilinmeyen kart, çipin ölçüsüyle 'sığar' denmiyor", () => {
    const darKasa: EngineCase = { ...pcCase, max_gpu_length_mm: 310 };
    const olcusuzKart: EngineGpuVariant = { id: "zotac-rtx-5080-solid", tbp_watt: 380 };

    const bulgular = checkCompatibility({
      cpu,
      gpu: resolveGpuSelection(chip, olcusuzKart).gpu,
      psu,
      case: darKasa,
    });

    // Kural atlandı: ne "sığar" dendi ne de uydurma bir hata üretildi.
    expect(bulgular.map((f) => f.code)).not.toContain("C5");
  });

  it("C4: çip yeterken kartın TBP'si güç kaynağını yetersiz bırakıyor", () => {
    // ceil((120 + 360 + 100) * 1.3) = 754 -> 850 W yetiyor.
    expect(codes(resolveGpuSelection(chip).gpu)).not.toContain("C4");
    // ceil((120 + 400 + 100) * 1.3) = 806 -> yetiyor ama pay dar (W3).
    expect(codes(resolveGpuSelection(chip, strix).gpu)).toContain("W3");

    // Daha da yüksek TBP'li bir kartta C4 hataya döner.
    const acgozlu: EngineGpuVariant = { id: "dev-kart-600w", tbp_watt: 600, length_mm: 320 };
    expect(codes(resolveGpuSelection(chip, acgozlu).gpu)).toContain("C4");
  });

  it("C4: TBP'si olmayan kartta kural çalışmaya devam eder (atlanmaz)", () => {
    const zayifPsu: EnginePsu = { id: "dev-psu-500", wattage: 500 };
    const olcusuzKart: EngineGpuVariant = { id: "zotac-rtx-5080-solid", length_mm: 320 };

    const bulgular = checkCompatibility({
      cpu,
      gpu: resolveGpuSelection(chip, olcusuzKart).gpu,
      psu: zayifPsu,
      case: pcCase,
    });

    // Çipin 360 W'ıyla hesaplandı: 754 W gerekiyor, 500 W yetmiyor.
    expect(bulgular.map((f) => f.code)).toContain("C4");
  });

  it("bulgularda kullanıcının seçtiği kartın kimliği görünür", () => {
    const bulgular = checkCompatibility({
      cpu,
      gpu: resolveGpuSelection(chip, strix).gpu,
      psu,
      case: pcCase,
    });
    const c5 = bulgular.find((finding) => finding.code === "C5");

    expect(c5?.involved_part_ids).toContain("asus-rog-strix-rtx-5080-oc");
    expect(c5?.involved_part_ids).not.toContain("nvidia-rtx-5080");
  });
});

describe("resolvePerfIndex — iki seviye", () => {
  const indexes = { "nvidia-rtx-5080": 150, "asus-rog-strix-rtx-5080-oc": 153 };

  it("kartın kendi ölçülmüş indeksi varsa onu kullanır", () => {
    expect(resolvePerfIndex(indexes, "nvidia-rtx-5080", "asus-rog-strix-rtx-5080-oc")).toEqual({
      value: 153,
      origin: "variant",
    });
  });

  it("kartın indeksi yoksa çipinkine düşer ve bunu söyler", () => {
    expect(resolvePerfIndex(indexes, "nvidia-rtx-5080", "zotac-rtx-5080-solid")).toEqual({
      value: 150,
      origin: "chip",
    });
  });

  it("kart seçilmemişse çipin indeksi", () => {
    expect(resolvePerfIndex(indexes, "nvidia-rtx-5080")).toEqual({ value: 150, origin: "chip" });
  });

  it("hiçbir seviyede ölçüm yoksa sayı uydurulmaz", () => {
    expect(resolvePerfIndex(indexes, "intel-arc-b580")).toEqual({
      value: undefined,
      origin: null,
    });
    expect(resolvePerfIndex(indexes, undefined)).toEqual({ value: undefined, origin: null });
  });
});
