import { describe, expect, it } from "vitest";

import { checkCompatibility } from "../engine/compatibility";
import { pickDefaultBuild } from "../engine/default-build";
import type { DefaultBuildCandidates } from "../engine/default-build";
import type { BuildInput } from "../engine/types";

// Küçük ama gerçekçi bir katalog: iki soket, iki bellek tipi, dar bir kasa.
// Her test yalnızca ilgilendiği parçayı değiştiriyor.

const candidates: DefaultBuildCandidates = {
  cpu: [
    { id: "cpu-yavas", spec: { id: "cpu-yavas", socket: "AM5", tdp_watt: 65, has_igpu: true } },
    { id: "cpu-orta", spec: { id: "cpu-orta", socket: "AM5", tdp_watt: 105, has_igpu: true } },
    { id: "cpu-hizli", spec: { id: "cpu-hizli", socket: "AM5", tdp_watt: 170, has_igpu: false } },
    // Ölçümü yok: hiçbir zaman seçilmemeli.
    { id: "cpu-olcumsuz", spec: { id: "cpu-olcumsuz", socket: "AM5", tdp_watt: 65, has_igpu: true } },
  ],
  gpu: [
    { id: "gpu-yavas", spec: { id: "gpu-yavas", tdp_watt: 150, length_mm: 240 } },
    { id: "gpu-orta", spec: { id: "gpu-orta", tdp_watt: 250, length_mm: 300 } },
    { id: "gpu-hizli", spec: { id: "gpu-hizli", tdp_watt: 450, length_mm: 340 } },
    { id: "gpu-olcumsuz", spec: { id: "gpu-olcumsuz", tdp_watt: 200, length_mm: 260 } },
  ],
  motherboard: [
    {
      id: "mb-am5",
      spec: {
        id: "mb-am5", socket: "AM5", form_factor: "ATX", memory_type: "DDR5",
        memory_slots: 4, max_memory_gb: 128, max_memory_speed_mhz: 6000,
      },
    },
    {
      id: "mb-lga1700",
      spec: {
        id: "mb-lga1700", socket: "LGA1700", form_factor: "ATX", memory_type: "DDR4",
        memory_slots: 4, max_memory_gb: 128, max_memory_speed_mhz: 3200,
      },
    },
  ],
  ram: [
    { id: "ram-ddr5", spec: { id: "ram-ddr5", memory_type: "DDR5", capacity_gb: 32, module_count: 2, speed_mhz: 6000 } },
    { id: "ram-ddr4", spec: { id: "ram-ddr4", memory_type: "DDR4", capacity_gb: 32, module_count: 2, speed_mhz: 3200 } },
  ],
  psu: [
    { id: "psu-550", spec: { id: "psu-550", wattage: 550, length_mm: 140 } },
    { id: "psu-850", spec: { id: "psu-850", wattage: 850, length_mm: 160 } },
    { id: "psu-1200", spec: { id: "psu-1200", wattage: 1200, length_mm: 180 } },
  ],
  case: [
    {
      id: "kasa-atx",
      spec: {
        id: "kasa-atx", supported_form_factors: ["ATX", "mATX", "ITX"],
        max_gpu_length_mm: 355, max_psu_length_mm: 200,
      },
    },
  ],
};

const perfIndexes: Record<string, number> = {
  "gpu-yavas": 60, "gpu-orta": 100, "gpu-hizli": 165,
  "cpu-yavas": 70, "cpu-orta": 100, "cpu-hizli": 140,
};

describe("pickDefaultBuild", () => {
  it("ölçümü olmayan parçayı seçmez", () => {
    const secim = pickDefaultBuild(candidates, perfIndexes);
    expect(secim).not.toBeNull();
    expect(perfIndexes[secim!.gpu]).toBeDefined();
    expect(perfIndexes[secim!.cpu]).toBeDefined();
  });

  it("amiral gemisini değil orta segmenti seçer", () => {
    const secim = pickDefaultBuild(candidates, perfIndexes)!;
    expect(secim.gpu).toBe("gpu-orta");
    expect(secim.cpu).toBe("cpu-orta");
  });

  it("seçtiği sistem uyumluluk hatası üretmez", () => {
    const secim = pickDefaultBuild(candidates, perfIndexes)!;
    const bul = <K extends keyof DefaultBuildCandidates>(k: K, id: string) =>
      candidates[k].find((item) => item.id === id)!.spec;

    const input = {
      cpu: bul("cpu", secim.cpu), gpu: bul("gpu", secim.gpu),
      motherboard: bul("motherboard", secim.motherboard), ram: bul("ram", secim.ram),
      psu: bul("psu", secim.psu), case: bul("case", secim.case),
    } as BuildInput;

    expect(checkCompatibility(input).filter((f) => f.level === "error")).toEqual([]);
  });

  it("anakartı işlemcinin soketine, belleği anakartın tipine göre seçer", () => {
    const secim = pickDefaultBuild(candidates, perfIndexes)!;
    expect(secim.motherboard).toBe("mb-am5");
    expect(secim.ram).toBe("ram-ddr5");
  });

  it("gücü yetmeyen güç kaynağını seçmez", () => {
    const secim = pickDefaultBuild(candidates, perfIndexes)!;
    // cpu-orta 105W + gpu-orta 250W + 100W taban, x1.3 -> 591W. 550 yetmez.
    expect(secim.psu).not.toBe("psu-550");
  });

  it("hiç ölçümlü ekran kartı yoksa null döner", () => {
    const secim = pickDefaultBuild(candidates, { "cpu-orta": 100 });
    expect(secim).toBeNull();
  });

  it("hiç ölçümlü işlemci yoksa null döner", () => {
    const secim = pickDefaultBuild(candidates, { "gpu-orta": 100 });
    expect(secim).toBeNull();
  });

  it("uyumlu kombinasyon kurulamıyorsa null döner", () => {
    // Tek anakart LGA1700; ölçümlü işlemcilerin hepsi AM5.
    const soketsiz: DefaultBuildCandidates = {
      ...candidates,
      motherboard: candidates.motherboard.filter((mb) => mb.id === "mb-lga1700"),
    };
    expect(pickDefaultBuild(soketsiz, perfIndexes)).toBeNull();
  });

  it("boş katalogda çökmez", () => {
    const bos: DefaultBuildCandidates = { cpu: [], gpu: [], motherboard: [], ram: [], psu: [], case: [] };
    expect(pickDefaultBuild(bos, perfIndexes)).toBeNull();
  });
});
