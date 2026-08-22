// Para birimi çevrimi — TEK YER.
//
// Fiyatlar veritabanında kaynağın yayınladığı para biriminde duruyor (bugün
// hepsi USD, Newegg). Veritabanındaki değer HİÇ DEĞİŞMİYOR; çevrim yalnızca
// ekrana basarken yapılıyor. Sebebi SCHEMA.md bölüm 0 kural 4 ve K92 ile aynı:
// kaynağın söylediği sayı kaynağın söylediği gibi durur, türetilen sayı
// türetildiği yerde kalır.
//
// Kur bir bileşene gömülmüyor çünkü gömülseydi ikinci bir bileşen eklendiğinde
// ikinci bir kur doğardı ve ikisi ayrı zamanlarda eskirdi.

/**
 * Kur ve alındığı gün.
 *
 * **`rateMinor` ELLE GİRİLİYOR.** Bu sayı bir ölçüm değil, bir insanın o gün
 * baktığı değer. Otomatik güncellenmiyor: kur servisi bağlamak yeni bir dış
 * bağımlılık ve beta kapsamı dışında.
 *
 * Bunun bedeli: sayı eskir. Bedeli ödenebilir kılan şey, eskimenin
 * GİZLENMEMESİ — `quotedAt` arayüzde yazıyor, yani kullanıcı fiyatın hangi
 * günün kuruyla çevrildiğini görüyor ve canlı bir kur sanmıyor.
 *
 * Güncellemek için: aşağıdaki iki satır. Başka hiçbir yerde kur yok.
 */
export const USD_TRY = {
  /**
   * 1 USD kaç kuruş eder.
   *
   * Integer tutuluyor: fiyat hiçbir aşamada float'a çevrilmiyor
   * (SCHEMA.md bölüm 0, kural 4). `4100` = 41,00 ₺.
   */
  rateMinor: 4100,
  /** Kurun bakıldığı gün. Arayüz bu tarihi gösteriyor. */
  quotedAt: "2026-08-22",
  /**
   * `true` olduğu sürece arayüz "elle girilen kur" diyor. Kur bir kaynaktan
   * otomatik gelmeye başlarsa bu bayrak kalkar ve metin değişir.
   */
  manual: true,
} as const;

/**
 * Fiyat kaynağının yayınladığı para birimi. Veritabanındaki değer budur.
 */
export const SOURCE_CURRENCY = "USD";

/**
 * Ekranda gösterilen para birimi — VARSAYILAN kaynağın kendisi (K157).
 *
 * Eskiden TRY idi ve her fiyat elle girilmiş bir kurdan geçiyordu. Artık
 * varsayılan çevrim YOK: kaynağın yayınladığı sayı olduğu gibi görünüyor ve
 * kur yalnızca kullanıcı başka bir para birimi seçtiğinde devreye giriyor.
 *
 * **Para birimi seçimi dilden bağımsızdır.** İngilizce okuyan biri ₺ görmek
 * isteyebilir, Türkçe okuyan biri $ görmek isteyebilir. `locale` sayının nasıl
 * yazılacağını söylüyor, `currency` hangi para birimi olduğunu — ikisi ayrı
 * eksen ve ayrı ayrı seçiliyor.
 */
export const DEFAULT_DISPLAY_CURRENCY = SOURCE_CURRENCY;

/** Kullanıcının seçebileceği para birimleri. */
export const DISPLAY_CURRENCIES = ["USD", "TRY"] as const;
export type DisplayCurrency = (typeof DISPLAY_CURRENCIES)[number];

/** Geriye dönük ad — bileşenler bunu kullanıyordu. */
export const DISPLAY_CURRENCY: DisplayCurrency = DEFAULT_DISPLAY_CURRENCY;

/**
 * Kaynağın para birimindeki kuruşu, ekranda gösterilecek para birimine çevirir.
 *
 * Çevrilemeyen para birimi için `null` döner — 1:1 varsaymak, kullanıcıya
 * sessizce yanlış bir sayı göstermek olurdu. Çağıran taraf `null` gördüğünde
 * fiyatı hiç göstermez ya da sebebini yazar.
 *
 * Hesap tam sayıyla: `usdKuruş × (TRY kuruş / USD) ÷ 100`. Bölme sonunda tek
 * bir yuvarlama var; ara adımda float yok.
 */
export function toDisplayMinor(
  minor: number,
  currency: string,
  target: DisplayCurrency = DEFAULT_DISPLAY_CURRENCY,
): number | null {
  // Aynı para birimi: ÇEVRİM YOK. Varsayılan hâlde bu dal çalışıyor, yani
  // kaynağın sayısı hiçbir kurdan geçmeden ekrana gidiyor.
  if (currency === target) return minor;
  if (currency === "USD" && target === "TRY") {
    return Math.round((minor * USD_TRY.rateMinor) / 100);
  }
  if (currency === "TRY" && target === "USD") {
    return Math.round((minor * 100) / USD_TRY.rateMinor);
  }
  return null;
}

/**
 * Çevrim yapıldı mı? Kur notu yalnızca yapıldıysa gösterilir — olmayan bir
 * işlemi anlatmak kafa karıştırır (K157).
 */
export function isConverted(currency: string, target: DisplayCurrency): boolean {
  return currency !== target;
}

// Kurun ekranda nasıl yazılacağı burada DEĞİL: sayı `USD_TRY.rateMinor`,
// biçim `lib/format.ts`, cümle `messages/<dil>/pricing.json`. Üçü de kendi
// yerinde duruyor.
