// Uyumluluk kuralları — SCHEMA.md bölüm 7.
//
// Saf fonksiyon: girdi alır, çıktı verir. Veritabanı, ağ, dosya sistemi ve
// React erişimi yoktur ve olmamalıdır.

import type { BuildInput, Finding } from "./types";

/** Geçici tepe yükler ve verim payı. SCHEMA.md bölüm 7. */
export const POWER_HEADROOM_MULTIPLIER = 1.3;

/** Anakart, disk, fan gibi sayılmayan parçaların kabaca tüketimi. */
export const BASE_OVERHEAD_WATT = 100;

/**
 * W3 eşiği: PSU gerekli gücün bu katından azsa uyarı verilir.
 * PSU'lar tam kapasiteye yakın çalışırken verimsiz ve gürültülü olur.
 */
export const PSU_MARGIN_WARN_RATIO = 1.15;

/**
 * SCHEMA.md bölüm 7'deki tüketim formülü.
 * GPU yoksa 0 sayılır — iGPU'lu sistem geçerli bir sistemdir.
 */
export function requiredWattage(cpuTdpWatt: number, gpuTdpWatt = 0): number {
  const base = cpuTdpWatt + gpuTdpWatt + BASE_OVERHEAD_WATT;
  return Math.ceil(base * POWER_HEADROOM_MULTIPLIER);
}

/**
 * Bir kuralın çalışması için gereken değerlerin hepsi var mı?
 *
 * Tipler eksik alanı zaten engelliyor. Bu kontrol, tip sisteminden geçmeyen
 * (elle kurulmuş, dışarıdan gelen, yarım) veri karşısında motorun çökmemesi
 * için: değeri olmayan kural sessizce atlanır, hata uydurmaz.
 */
function ready(...values: unknown[]): boolean {
  return values.every((value) => value !== null && value !== undefined);
}

export function checkCompatibility(input: BuildInput): Finding[] {
  const { cpu, gpu, motherboard, ram, psu } = input;
  const pcCase = input.case;

  const errors: Finding[] = [];
  const warnings: Finding[] = [];

  // --- C1: işlemci soketi anakart soketiyle aynı olmalı --------------------
  if (ready(cpu?.socket, motherboard?.socket) && cpu!.socket !== motherboard!.socket) {
    errors.push({
      code: "C1",
      level: "error",
      message: `İşlemci soketi ${cpu!.socket}, anakart soketi ${motherboard!.socket}. Bu ikisi takılamaz.`,
      involved_part_ids: [cpu!.id, motherboard!.id],
    });
  }

  // --- C2: bellek tipi anakartla aynı olmalı -------------------------------
  if (ready(ram?.memory_type, motherboard?.memory_type) && ram!.memory_type !== motherboard!.memory_type) {
    errors.push({
      code: "C2",
      level: "error",
      message: `Bellek ${ram!.memory_type}, anakart ${motherboard!.memory_type} destekliyor. Bu ikisi takılamaz.`,
      involved_part_ids: [ram!.id, motherboard!.id],
    });
  }

  // --- C3: modül sayısı yuva sayısını aşmamalı -----------------------------
  if (ready(ram?.module_count, motherboard?.memory_slots) && ram!.module_count > motherboard!.memory_slots) {
    errors.push({
      code: "C3",
      level: "error",
      message: `Bellek kiti ${ram!.module_count} modülden oluşuyor ama anakartta ${motherboard!.memory_slots} yuva var.`,
      involved_part_ids: [ram!.id, motherboard!.id],
    });
  }

  // --- C4: güç kaynağı yetmeli --------------------------------------------
  // GPU yoksa tüketimine 0 denir; sistem iGPU ile çalışıyor olabilir.
  if (ready(cpu?.tdp_watt, psu?.wattage)) {
    const required = requiredWattage(cpu!.tdp_watt, gpu?.tdp_watt ?? 0);
    const involved = [psu!.id, cpu!.id, ...(gpu ? [gpu.id] : [])];

    if (psu!.wattage < required) {
      errors.push({
        code: "C4",
        level: "error",
        message: `Güç kaynağı ${psu!.wattage}W, bu sistem için en az ${required}W gerekiyor.`,
        involved_part_ids: involved,
      });
    } else if (psu!.wattage < required * PSU_MARGIN_WARN_RATIO) {
      // W3 burada üretiliyor: hesabı iki kez yapmamak için.
      warnings.push({
        code: "W3",
        level: "warning",
        message: `Güç kaynağı ${psu!.wattage}W, gereken ${required}W. Pay dar — güç kaynağı tam kapasiteye yakın çalışır, verimi düşer ve sesi artar.`,
        involved_part_ids: involved,
      });
    }
  }

  // --- C5: ekran kartı kasaya sığmalı --------------------------------------
  // İki uç da opsiyonel: kartın uzunluğu (K52) ve kasanın açıklığı (K62).
  // Biri bile bilinmiyorsa kural atlanır. Kullanıcıya bunun atlandığını arayüz
  // söyler; motor "veri eksik" diye bulgu üretmez, çünkü bulgular
  // SCHEMA.md bölüm 7'deki kurallardır.
  if (ready(gpu?.length_mm, pcCase?.max_gpu_length_mm) && gpu!.length_mm! > pcCase!.max_gpu_length_mm!) {
    errors.push({
      code: "C5",
      level: "error",
      message: `Ekran kartı ${gpu!.length_mm} mm, kasaya en fazla ${pcCase!.max_gpu_length_mm} mm sığıyor.`,
      involved_part_ids: [gpu!.id, pcCase!.id],
    });
  }

  // --- C6: anakart form faktörü kasa tarafından desteklenmeli ---------------
  if (
    ready(motherboard?.form_factor, pcCase?.supported_form_factors) &&
    Array.isArray(pcCase!.supported_form_factors) &&
    !pcCase!.supported_form_factors.includes(motherboard!.form_factor)
  ) {
    errors.push({
      code: "C6",
      level: "error",
      message: `Anakart ${motherboard!.form_factor} boyutunda, kasa şunları destekliyor: ${pcCase!.supported_form_factors.join(", ")}.`,
      involved_part_ids: [motherboard!.id, pcCase!.id],
    });
  }

  // --- W1: bellek hızı anakartın desteklediğinden yüksek --------------------
  if (
    ready(ram?.speed_mhz, motherboard?.max_memory_speed_mhz) &&
    ram!.speed_mhz > motherboard!.max_memory_speed_mhz
  ) {
    warnings.push({
      code: "W1",
      level: "warning",
      message: `Bellek ${ram!.speed_mhz} MHz ama anakart en fazla ${motherboard!.max_memory_speed_mhz} MHz destekliyor. Bellek düşük hızda çalışır.`,
      involved_part_ids: [ram!.id, motherboard!.id],
    });
  }

  // --- W2: bellek kapasitesi anakartın desteklediğinden yüksek --------------
  if (ready(ram?.capacity_gb, motherboard?.max_memory_gb) && ram!.capacity_gb > motherboard!.max_memory_gb) {
    warnings.push({
      code: "W2",
      level: "warning",
      message: `Bellek kiti ${ram!.capacity_gb} GB ama anakart en fazla ${motherboard!.max_memory_gb} GB destekliyor.`,
      involved_part_ids: [ram!.id, motherboard!.id],
    });
  }

  // W3 yukarıda, C4 ile aynı hesabın içinde üretiliyor.

  // --- W4: ne ekran kartı var ne de tümleşik grafik -------------------------
  if (ready(cpu?.has_igpu) && !gpu && !cpu!.has_igpu) {
    warnings.push({
      code: "W4",
      level: "warning",
      message: "Sistemde ekran kartı yok ve işlemcide tümleşik grafik bulunmuyor. Görüntü alınamaz.",
      involved_part_ids: [cpu!.id],
    });
  }

  // --- W5: güç kaynağı kasaya sığmayabilir ---------------------------------
  // Burada da iki uç opsiyonel (K62): güç kaynağının uzunluğu ve kasanın
  // açıklığı. Biri bilinmiyorsa kural atlanır, arayüz söyler.
  if (ready(psu?.length_mm, pcCase?.max_psu_length_mm) && psu!.length_mm! > pcCase!.max_psu_length_mm!) {
    warnings.push({
      code: "W5",
      level: "warning",
      message: `Güç kaynağı ${psu!.length_mm} mm, kasa için belirtilen sınır ${pcCase!.max_psu_length_mm} mm.`,
      involved_part_ids: [psu!.id, pcCase!.id],
    });
  }

  // Engelleyiciler önce: kullanıcı önce sistemi kurulabilir hale getirmeli.
  return [...errors, ...warnings];
}
