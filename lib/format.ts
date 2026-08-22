// Sayı, para ve tarih biçimlendirme — hepsi `Intl` üzerinden.
//
// **Bu bir yön değişikliği (K151).** Eskiden `Intl` bilinçli olarak
// kullanılmıyordu: değerler hem sunucuda hem tarayıcıda basılıyor ve iki
// tarafın dil/saat dilimi farklı olursa React hydration uyuşmazlığı veriyordu.
//
// Sebep ortadan kalktı çünkü artık ikisi de SABİT:
//
//   dil         — `i18n/request.ts` istekten bir kez çözümlüyor ve aynı değer
//                 `NextIntlClientProvider` ile istemciye geçiyor
//   saat dilimi — açıkça `UTC`
//
// Elle biçimlendirme tek dilde çalışıyordu; ikinci dil gelince binlik ayracı,
// ondalık ayracı ve para sembolünün yeri dile göre değişmek zorunda.
//
// PARA BİRİMİ DİLDEN AYRI BİR MESELE. İngilizce okuyan bir kullanıcı da ₺
// görmek isteyebilir: `locale` sayının nasıl yazılacağını, `currency` hangi
// para birimi olduğunu söylüyor. İkisi ayrı parametre.

import type { Resolution } from "@/engine/types";

import { DISPLAY_CURRENCY, toDisplayMinor } from "./currency.ts";

/** Tarihler takvim günü olarak gösteriliyor; saat dilimi kaymasın diye UTC. */
const TIME_ZONE = "UTC";

/**
 * Kuruş -> okunur fiyat.
 *
 * Hesap tamamen tam sayıyla yapılır; fiyat hiçbir aşamada float'a çevrilmez
 * (SCHEMA.md bölüm 0, kural 4). `Intl`e verilen bölme son adımda ve yalnızca
 * gösterim için.
 */
export function formatPriceMinor(minor: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}

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
export function formatDisplayPrice(
  minor: number,
  currency: string,
  locale: string,
): string | null {
  const converted = toDisplayMinor(minor, currency);
  if (converted === null) return null;
  return formatPriceMinor(converted, DISPLAY_CURRENCY, locale);
}

/** Ondalıklı ya da tam sayı — indeks, FPS, adet. */
export function formatNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value);
}

/**
 * ISO tarih -> dile göre kısa tarih.
 *
 * Metinden `Date`e çevrilirken gün kaymasın diye tarih parçaları elle
 * okunuyor ve `Date.UTC` ile kuruluyor; biçimlendirme de UTC'de. `new
 * Date("2026-08-20")` zaten UTC gece yarısı verir ama yerel saat diliminde
 * biçimlendirilirse bir gün geriye kayabilir.
 */
export function formatIsoDate(iso: string, locale: string): string {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat(locale, {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Çözünürlüğün mesaj anahtarı. Motorun tanıdığı değer `2160p`; ekranda ne
 * yazacağını `performance.resolution.*` söylüyor.
 */
export const RESOLUTION_KEY: Record<Resolution, Resolution> = {
  "1080p": "1080p",
  "1440p": "1440p",
  "2160p": "2160p",
};

/**
 * Üretici stok kodunu etiketten çıkarır.
 *
 * `Samsung 990 EVO Plus 1TB (MZ-V9S1T0B/AM)` -> `Samsung 990 EVO Plus 1TB`
 *
 * Yalnızca **sondaki** parantez ve yalnızca içi stok koduna benziyorsa:
 * büyük harf/rakamla başlayan, küçük harf ve boşluk içermeyen dizi. Bu dar
 * kural bilinçli — `(2 x 16GB)` gibi anlamı olan parantezleri silmemeli.
 *
 * Parça adları ÇEVRİLMEZ: marka ve model dilden bağımsızdır. Bu işlem bir
 * çeviri değil, gürültü temizliği.
 */
export function stripSku(label: string): string {
  return label.replace(/\s*\(([A-Z0-9][A-Z0-9\-/.]*)\)\s*$/, "").trim();
}
