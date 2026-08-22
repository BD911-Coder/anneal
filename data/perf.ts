// Parçaların performans indeksini okur (sadece gpu ve cpu).
//
// İKİ KAYNAK, TEK ÇÖZÜMLEME (K160):
//
//   perf_index            ölçümden hesaplanan — K71, yalnızca benchmark_points
//   perf_index_estimated  spec'ten tahmin edilen — ayrı tablo
//
// **Ölçülen her zaman kazanır.** Tahmin yalnızca boşluğu doldurur ve dönen
// kayıt hangisi olduğunu HER ZAMAN söyler: `origin` alanı opsiyonel değil.
// Çağıran taraf "bu sayı ölçüldü mü" sorusunu sormayı unutamaz çünkü cevabı
// almadan sayıya erişemiyor.
//
// dev-seed filtresi her iki tabloda da parçanın kendisi üzerinden uygulanır:
// sahte bir parçanın indeksi de sahtedir ve canlıda o parça zaten görünmez.

import { prisma } from "./client.ts";
import { visibleParts } from "./visibility.ts";

export type EstimateMethod = "spec-model" | "family-mean";

/**
 * Çözümlenmiş indeks.
 *
 * `origin: "measured"` olduğunda bant alanları yoktur — ölçülmüş bir sayının
 * tahmin bandı olmaz. Hata payı ayrı bir şeydir ve `lib/perf-margin.ts`te
 * yayınlanır.
 */
export type ResolvedIndex =
  | { value: number; origin: "measured" }
  | {
      value: number;
      origin: "estimated";
      method: EstimateMethod;
      /** Bandın yüzde genişliği — ailenin kendi doğrulamasından. */
      bandPct: number;
      /** Band hangi ailenin doğrulamasından geldi; `null` = aileler arası. */
      bandSourceFamily: string | null;
      /** Bandın dayandığı ölçüm sayısı. Dört veri noktası ile on iki farklıdır. */
      nUsed: number;
    };

/**
 * Parça id'si -> çözümlenmiş indeks.
 *
 * `model_version` zorunlu parametre: hangi motor sürümünün sayısını okuduğunu
 * söylemeden indeks okumak, eski ve yeni sürümü karıştırmanın en kolay yolu.
 */
export async function getResolvedPerfIndexes(
  modelVersion: string,
): Promise<Record<string, ResolvedIndex>> {
  const [measured, estimated] = await Promise.all([
    prisma.perfIndex.findMany({
      // Beta yalnızca oyun indeksini okur (K35, K36).
      where: { model_version: modelVersion, workload: "gaming", part: visibleParts() },
      select: { part_id: true, index_value: true },
    }),
    prisma.perfIndexEstimated.findMany({
      where: { model_version: modelVersion, workload: "gaming", part: visibleParts() },
      select: {
        part_id: true,
        index_value: true,
        method: true,
        error_band_pct: true,
        error_band_source_family: true,
        n_used: true,
      },
    }),
  ]);

  const out: Record<string, ResolvedIndex> = {};

  // Önce tahminler yazılıyor, sonra ölçümler ÜZERİNE yazıyor. Sıra bilinçli:
  // aynı parçada ikisi de varsa ölçülen kazanır ve bu tek satırda görünür.
  for (const row of estimated) {
    out[row.part_id] = {
      value: row.index_value,
      origin: "estimated",
      method: row.method === "spec_model" ? "spec-model" : "family-mean",
      bandPct: row.error_band_pct,
      bandSourceFamily: row.error_band_source_family,
      nUsed: row.n_used,
    };
  }
  for (const row of measured) {
    out[row.part_id] = { value: row.index_value, origin: "measured" };
  }

  return out;
}

/**
 * Yalnızca sayılar — motorun ve script'lerin beklediği düz harita.
 *
 * Ölçülen ve tahmin edilen burada AYRIŞMAZ; bu yüzden arayüz bunu
 * kullanmamalı. Motor zaten "bu sayı nereden geldi" sorusunu sormuyor:
 * indeksi girdi olarak alıyor, kaynağını değil.
 */
export async function getPerfIndexes(modelVersion: string): Promise<Record<string, number>> {
  const resolved = await getResolvedPerfIndexes(modelVersion);
  const out: Record<string, number> = {};
  for (const [id, r] of Object.entries(resolved)) out[id] = r.value;
  return out;
}

/**
 * Yalnızca ÖLÇÜLEN indeksler.
 *
 * Tahmin modelinin eğitim kümesi burası: kendi çıktısıyla eğitilmesi
 * (`perf_index_estimated`'ı okuması) modelin kendi gürültüsünü veri sanması
 * olurdu.
 */
export async function getMeasuredPerfIndexes(
  modelVersion: string,
): Promise<Record<string, number>> {
  const rows = await prisma.perfIndex.findMany({
    where: { model_version: modelVersion, workload: "gaming", part: visibleParts() },
    select: { part_id: true, index_value: true },
  });
  const out: Record<string, number> = {};
  for (const row of rows) out[row.part_id] = row.index_value;
  return out;
}
