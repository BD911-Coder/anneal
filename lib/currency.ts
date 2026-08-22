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

/** Ekranda gösterilen para birimi. Kaynağın para birimi bu değil. */
export const DISPLAY_CURRENCY = "TRY";

/**
 * Kaynağın para birimindeki kuruşu, ekranda gösterilecek TRY kuruşuna çevirir.
 *
 * Çevrilemeyen para birimi için `null` döner — 1:1 varsaymak, kullanıcıya
 * sessizce yanlış bir sayı göstermek olurdu. Çağıran taraf `null` gördüğünde
 * fiyatı hiç göstermez ya da sebebini yazar.
 *
 * Hesap tam sayıyla: `usdKuruş × (TRY kuruş / USD) ÷ 100`. Bölme sonunda tek
 * bir yuvarlama var; ara adımda float yok.
 */
export function toDisplayMinor(minor: number, currency: string): number | null {
  if (currency === DISPLAY_CURRENCY) return minor;
  if (currency === "USD") return Math.round((minor * USD_TRY.rateMinor) / 100);
  return null;
}

/** Kur notunun metni — iki sayfada aynı cümle çıksın diye tek tanım. */
export function rateNote(): string {
  return USD_TRY.manual
    ? `Fiyatlar USD kaynaktan elle girilen kurla çevrildi: 1 USD = ${formatRate()} ₺ (${USD_TRY.quotedAt}). Canlı kur değildir.`
    : `1 USD = ${formatRate()} ₺ (${USD_TRY.quotedAt}).`;
}

/** `4100` -> `41,00` */
function formatRate(): string {
  const major = Math.trunc(USD_TRY.rateMinor / 100);
  const cents = USD_TRY.rateMinor % 100;
  return `${major},${String(cents).padStart(2, "0")}`;
}
