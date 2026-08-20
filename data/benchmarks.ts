// Oyun bazlı FPS için ölçüm gruplarını okur — Faz A.1.
//
// dev-seed filtresi data/visibility.ts'te tanımlı (2. katman). Motorun tipine
// çeviri burada yapılıyor; /engine veritabanını tanımıyor.
//
// Üretilen FPS hiçbir tabloya yazılmaz, okuma anında hesaplanır. Bu dosya
// yalnızca ham ölçümleri ve indeksleri toplayıp motora verir.

import type { FpsGameGroup, FpsMeasurement } from "@/engine/fps-estimate";
import type { Resolution } from "@/engine/types";

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

/** Kullanıcıya gösterilecek ayar etiketi. Upscaling ve render modu gizlenmez. */
function settingLabel(
  resolution: string,
  preset: string,
  upscaling: string | null,
  renderMode: string,
): string {
  // Prisma enum üyesi `R1440p`; veritabanındaki gerçek değer bu (K7 deseni).
  const cozunurluk = resolution.replace(/^R/, "");
  const temel = `${cozunurluk} ${preset}`;

  // "1440p ultra" deyip DLSS'i söylememek yanlış olurdu: ölçüm upscaling
  // açıkken yapıldı ve bu sayıyı belirgin şekilde yükseltiyor.
  const ayar = !upscaling || upscaling === "none" ? `${temel}, yerel` : `${temel}, ${upscaling}`;

  // Aynı gerekçe render modu için: raytracing FPS'i %30-50 değiştiriyor (K111).
  // `raster` yazılmıyor çünkü varsayılan hal o; ayırt edici olan diğer ikisi.
  if (renderMode === "raster") return ayar;
  return `${ayar}, ${renderMode === "pathtracing" ? "Path Tracing" : "Raytracing"}`;
}

/**
 * Oyun + ayar bileşimi başına ölçüm grupları.
 *
 * **Neden ayar da gruplama anahtarı:** 1080p medium ölçümüyle 1440p ultra
 * ölçümü aynı orana giremez. Bugün veritabanında tam olarak bu iki ayar var
 * ve karıştırılsalardı oran anlamsız çıkardı. Render modu da anahtarın
 * parçası (K111): aynı oyunun raster ve raytracing ölçümleri aynı orana
 * giremez, aralarındaki fark kartın gücü değil ayarın maliyetidir.
 *
 * **Aynı GPU için ÇELİŞEN değer varsa grup düşer** (K125). "Bu kartın bu
 * oyundaki FPS'i" sorusunun iki farklı cevabı olamaz; hangisinin
 * gösterileceği bir karardır, ortalamasını almak da bir modelleme kararıdır
 * ve verilmedi. Belirsizliği sessizce çözmektense grubu atlamak doğru.
 *
 * **Ama AYNI değerin iki kez geçmesi çelişki değil.** ComputerBase aynı
 * ölçümü iki sayfada yayınlıyor (kart incelemesi + parkur makalesi) ve
 * değerler birebir aynı. Bunları iki ayrı ölçüm saymak, tek bir ölçümü
 * çelişki sanıp o oyunu listeden düşürürdü — nitekim düşürdü ve 23 oyun
 * 18'e indi. Aynı değerler önce teke indiriliyor, çelişki kontrolü ondan
 * sonra yapılıyor.
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
        render_mode: true,
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
    resolution: Resolution;
    setting_label: string;
    measurements: FpsMeasurement[];
  };
  const buckets = new Map<string, Bucket>();

  for (const row of rows) {
    const label = settingLabel(row.resolution, row.preset, row.upscaling, row.render_mode);
    const key = `${row.game_id}|${label}`;

    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        game_id: row.game_id,
        game_name: row.game.name,
        // Prisma enum uyesi `R1440p`; motorun bekledigi `1440p` (K7 deseni).
        resolution: row.resolution.replace(/^R/, "") as Resolution,
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

  return [...buckets.values()]
    .map((bucket) => {
      // Aynı (kart, değer) ikilisi birden fazla sayfadan gelmiş olabilir;
      // tek ölçümün iki yayını çelişki değildir (K125). Önce teke indir.
      const gorulen = new Set<string>();
      bucket.measurements = bucket.measurements.filter((m) => {
        const anahtar = `${m.part_id}|${m.avg_fps}`;
        if (gorulen.has(anahtar)) return false;
        gorulen.add(anahtar);
        return true;
      });
      return bucket;
    })
    .filter((bucket) => {
      const ids = bucket.measurements.map((m) => m.part_id);
      const distinct = new Set(ids);

      // Buraya kalan tekrar GERÇEK çelişkidir: aynı kart, farklı değer.
      if (distinct.size !== ids.length) return false;
      return distinct.size >= MIN_DISTINCT_GPUS;
    });
}
