// Sayı, tarih ve çözünürlük biçimlendirme.
//
// Intl / toLocaleString kullanılmıyor. Sebebi: bu değerler hem sunucuda hem
// tarayıcıda basılıyor ve iki tarafın dil verisi farklı olursa React uyumsuzluk
// hatası veriyor. Elle biçimlendirme her yerde aynı çıktıyı üretir.

import type { Resolution } from "@/engine/types";

import { DISPLAY_CURRENCY, toDisplayMinor } from "./currency.ts";

/**
 * Kuruş -> okunur fiyat. `149999` -> `1.499,99 ₺`
 *
 * Hesap tamamen tam sayıyla yapılır; fiyat hiçbir aşamada float'a çevrilmez
 * (SCHEMA.md bölüm 0, kural 4).
 */
const SYMBOL: Record<string, string> = { TRY: "₺", USD: "$" };

export function formatPriceMinor(minor: number, currency = "USD"): string {
  const negative = minor < 0;
  const absolute = Math.abs(minor);
  const major = Math.trunc(absolute / 100);
  const cents = absolute % 100;

  // Binlik ayracı: sağdan üçer basamak.
  const grouped = String(major).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const symbol = SYMBOL[currency] ?? currency;

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

/**
 * Kaynağın para birimindeki kuruşu, ekranda gösterilecek para biriminde
 * biçimlendirir.
 *
 * Fiyat gösteren her yer bunu çağırır; `formatPriceMinor` doğrudan
 * çağrılmaz. Sebebi: çevrimi atlayan tek bir çağrı, sayfanın bir köşesinde
 * USD'yi ₺ sembolüyle gösterirdi.
 *
 * Çevrilemeyen para birimi -> `null`. Çağıran taraf fiyatı hiç göstermez;
 * 1:1 varsayıp yanlış sayı basmaktansa boş bırakmak doğru.
 */
export function formatDisplayPrice(minor: number, currency: string): string | null {
  const converted = toDisplayMinor(minor, currency);
  if (converted === null) return null;
  return formatPriceMinor(converted, DISPLAY_CURRENCY);
}

/**
 * Üretici stok kodunu etiketten çıkarır.
 *
 * `Samsung 990 EVO Plus 1TB (MZ-V9S1T0B/AM)` -> `Samsung 990 EVO Plus 1TB`
 *
 * Yalnızca **sondaki** parantez ve yalnızca içi stok koduna benziyorsa:
 * büyük harf/rakamla başlayan, küçük harf ve boşluk içermeyen dizi. Bu dar
 * kural bilinçli — `(2 x 16GB)` gibi anlamı olan parantezleri silmemeli.
 *
 * Veritabanındaki değer değişmiyor; bu yalnızca ekran etiketi. Tam hâli
 * seçilen parçanın ayrıntı satırında ve `title` ipucunda duruyor.
 */
export function stripSku(label: string): string {
  return label.replace(/\s*\(([A-Z0-9][A-Z0-9\-/.]*)\)\s*$/, "").trim();
}
