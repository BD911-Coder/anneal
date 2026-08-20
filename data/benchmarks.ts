// Oyun bazlı FPS için ölçüm gruplarını okur — Faz A.1.
//
// dev-seed filtresi data/visibility.ts'te tanımlı (2. katman). Motorun tipine
// çeviri burada yapılıyor; /engine veritabanını tanımıyor.
//
// Üretilen FPS hiçbir tabloya yazılmaz, okuma anında hesaplanır. Bu dosya
// yalnızca ham ölçümleri ve indeksleri toplayıp motora verir.

import type { FpsGameGroup, FpsMeasurement } from "@/engine/fps-estimate";

import { prisma } from "./client.ts";
import { visibleParts, visibleRows } from "./visibility.ts";

/**
 * Bir grup, oranı yayınlanmaya değecek kadar çeşitli olmalı.
 *
 * 3 farklı GPU: iki nokta her zaman bir doğru verir ve oranın gerçekten sabit
 * olup olmadığını göstermez. Motordaki `MIN_RATIO_MEASUREMENTS` ile aynı sayı,
 * ama farklı bir soruyu soruyor — orada "kaç ölçüm", burada "kaç farklı parça".
 */
const MIN_DISTINCT_GPUS = 3;

/** Kullanıcıya gösterilecek ayar etiketi. Upscaling gizlenmez. */
function settingLabel(resolution: string, preset: string, upscaling: string | null): string {
  // Prisma enum üyesi `R1440p`; veritabanındaki gerçek değer bu (K7 deseni).
  const cozunurluk = resolution.replace(/^R/, "");
  const temel = `${cozunurluk} ${preset}`;

  // "1440p ultra" deyip DLSS'i söylememek yanlış olurdu: ölçüm upscaling
  // açıkken yapıldı ve bu sayıyı belirgin şekilde yükseltiyor.
  if (!upscaling || upscaling === "none") return `${temel}, yerel`;
  return `${temel}, ${upscaling}`;
}

/**
 * Oyun + ayar bileşimi başına ölçüm grupları.
 *
 * **Neden ayar da gruplama anahtarı:** 1080p medium ölçümüyle 1440p ultra
 * ölçümü aynı orana giremez. Bugün veritabanında tam olarak bu iki ayar var
 * ve karıştırılsalardı oran anlamsız çıkardı.
 *
 * **Neden aynı GPU iki kez geçen grup düşüyor:** o durumda "bu kartın bu
 * oyundaki FPS'i" sorusunun iki cevabı olur ve hangisinin gösterileceği bir
 * karardır — ortalamasını almak da bir modelleme kararıdır ve verilmedi.
 * Belirsizliği sessizce çözmektense grubu atlamak doğru.
 *
 * Bu iki kural bugün somut bir iş yapıyor: 178 ölçümün 114'ü tek bir GPU'ya
 * (RTX 5090) sabitlenmiş CPU ölçümleridir. O satırlarda aynı GPU bir grupta
 * 12 kez geçiyor, dolayısıyla grupları düşüyor. Kural veri şekline bakıyor,
 * `cpu_part_id`'ye sabitlenmiş bir filtreye değil — yeni veri geldiğinde de
 * doğru davranır.
 */
export async function getFpsGameGroups(modelVersion: string): Promise<FpsGameGroup[]> {
  const [rows, indexRows] = await Promise.all([
    prisma.benchmarkPoint.findMany({
      where: {
        ...visibleRows(),
        // Beta yalnızca oyun ölçümünü okur (K35, K36).
        workload: "gaming",
        gpu_part: visibleParts(),
      },
      select: {
        gpu_part_id: true,
        game_id: true,
        resolution: true,
        preset: true,
        upscaling: true,
        avg_fps: true,
        game: { select: { name: true } },
      },
    }),
    prisma.perfIndex.findMany({
      where: { model_version: modelVersion, workload: "gaming", part: visibleParts() },
      select: { part_id: true, index_value: true },
    }),
  ]);

  const indexes = new Map(indexRows.map((row) => [row.part_id, row.index_value]));

  // Anahtar: oyun + ayar. Ayrı ayarlar ayrı gruplar.
  type Bucket = {
    game_id: string;
    game_name: string;
    setting_label: string;
    measurements: FpsMeasurement[];
  };
  const buckets = new Map<string, Bucket>();

  for (const row of rows) {
    const label = settingLabel(row.resolution, row.preset, row.upscaling);
    const key = `${row.game_id}|${label}`;

    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        game_id: row.game_id,
        game_name: row.game.name,
        setting_label: label,
        measurements: [],
      };
      buckets.set(key, bucket);
    }

    bucket.measurements.push({
      part_id: row.gpu_part_id,
      avg_fps: row.avg_fps,
      index: indexes.get(row.gpu_part_id),
    });
  }

  return [...buckets.values()].filter((bucket) => {
    const ids = bucket.measurements.map((m) => m.part_id);
    const distinct = new Set(ids);

    // Aynı GPU birden fazla kez geçiyorsa grup belirsiz — atlanır.
    if (distinct.size !== ids.length) return false;
    return distinct.size >= MIN_DISTINCT_GPUS;
  });
}
