// Sayı, tarih ve çözünürlük biçimlendirme.
//
// Intl / toLocaleString kullanılmıyor. Sebebi: bu değerler hem sunucuda hem
// tarayıcıda basılıyor ve iki tarafın dil verisi farklı olursa React uyumsuzluk
// hatası veriyor. Elle biçimlendirme her yerde aynı çıktıyı üretir.

import type { Resolution } from "@/engine/types";

/**
 * Kuruş -> okunur fiyat. `149999` -> `1.499,99 ₺`
 *
 * Hesap tamamen tam sayıyla yapılır; fiyat hiçbir aşamada float'a çevrilmez
 * (SCHEMA.md bölüm 0, kural 4).
 */
export function formatPriceMinor(minor: number, currency = "TRY"): string {
  const negative = minor < 0;
  const absolute = Math.abs(minor);
  const major = Math.trunc(absolute / 100);
  const cents = absolute % 100;

  // Binlik ayracı: sağdan üçer basamak.
  const grouped = String(major).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const symbol = currency === "TRY" ? "₺" : currency;

  return `${negative ? "-" : ""}${grouped},${String(cents).padStart(2, "0")} ${symbol}`;
}

/**
 * ISO tarih -> `17.08.2026`
 *
 * Metin üzerinden okunuyor, Date nesnesine çevrilmiyor: çevrilseydi tarih
 * makinenin saat dilimine göre bir gün kayabilirdi.
 */
export function formatIsoDate(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split("-");
  return `${day}.${month}.${year}`;
}

/**
 * Çözünürlüğün ekranda görünen adı. Motorun tanıdığı değer `2160p`; "4K"
 * yalnızca ekranda yazan ad.
 *
 * Tek yerde durmasının sebebi yaşandı: aynı sayfada bir kutu "4K", başka bir
 * kutu "2160p" diyordu ve ikisi aynı şeydi.
 */
export const RESOLUTION_LABEL: Record<Resolution, string> = {
  "1080p": "1080p",
  "1440p": "1440p",
  "2160p": "4K",
};
