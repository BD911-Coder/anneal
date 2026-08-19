// Parçaların güncel fiyatını okur.
//
// "Güncel fiyat" tanımı SCHEMA.md bölüm 3'te: bir parçanın en son
// `collected_at`'li price_snapshots satırı. Tablo append-only olduğu için
// eski satırlar durur; burada okunan sadece en sonuncusudur.

import { prisma } from "./client.ts";
import { visibleParts, visibleRows } from "./visibility.ts";

export type CurrentPrice = {
  price_minor: number; // kuruş — integer, float asla kullanılmaz
  currency: string;
  collected_at: string; // ISO. Biçimlendirme lib/format.ts'in işi.
};

/**
 * Parça id'si -> güncel fiyat.
 *
 * Map değil düz nesne döndürür: bu veri sunucu bileşeninden istemci bileşenine
 * geçiyor ve düz JSON en az sürprizli taşıma biçimi.
 *
 * Fiyatı olmayan parça anahtarda hiç bulunmaz — "fiyat yok" ile "fiyat 0"
 * karışmasın diye 0 yazılmıyor.
 */
export async function getCurrentPrices(): Promise<Record<string, CurrentPrice>> {
  const rows = await prisma.priceSnapshot.findMany({
    where: { ...visibleRows(), part: visibleParts() },
    // (part_id, collected_at) indeksi tam bu sıralama için var (SCHEMA.md 11).
    orderBy: [{ part_id: "asc" }, { collected_at: "desc" }],
    distinct: ["part_id"],
    select: { part_id: true, price_minor: true, currency: true, collected_at: true },
  });

  const prices: Record<string, CurrentPrice> = {};
  for (const row of rows) {
    prices[row.part_id] = {
      price_minor: row.price_minor,
      currency: row.currency,
      collected_at: row.collected_at.toISOString(),
    };
  }
  return prices;
}
