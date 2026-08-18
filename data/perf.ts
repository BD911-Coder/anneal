// Parçaların performans indeksini okur (sadece gpu ve cpu).
//
// perf_index motorun kendi hesabıdır, dış dünya hakkında iddia taşımaz; bu
// yüzden şemada `source` sütunu yoktur (SCHEMA.md bölüm 1.3 ve 4). dev-seed
// filtresi bu tabloda parçanın kendisi üzerinden uygulanır: sahte bir parçanın
// indeksi de sahtedir ve canlıda o parça zaten görünmez.

import { prisma } from "./client";
import { visibleParts } from "./visibility";

/**
 * Parça id'si -> indeks değeri (0-100).
 *
 * `model_version` zorunlu parametre: hangi motor sürümünün sayısını okuduğunu
 * söylemeden indeks okumak, eski ve yeni sürümü karıştırmanın en kolay yolu.
 */
export async function getPerfIndexes(modelVersion: string): Promise<Record<string, number>> {
  const rows = await prisma.perfIndex.findMany({
    where: { model_version: modelVersion, part: visibleParts() },
    select: { part_id: true, index_value: true },
  });

  const indexes: Record<string, number> = {};
  for (const row of rows) {
    indexes[row.part_id] = row.index_value;
  }
  return indexes;
}
