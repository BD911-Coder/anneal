/**
 * Desteklenen diller — TEK KAYNAK.
 *
 * Hem çalışma anındaki çözümleme (`i18n/request.ts`) hem de eksik anahtar
 * kontrolü (`npm run dil:kontrol`) buradan okuyor. İki yerde ayrı liste
 * olsaydı, yeni bir dil eklendiğinde kontrolün kapsamı dışında kalabilirdi.
 */
export const LOCALES = ["en", "tr"] as const;

export type Locale = (typeof LOCALES)[number];

/**
 * Varsayılan VE kaynak dil.
 *
 * Kaynak dil olması şu demek: bir metin önce burada yazılır, diğer diller
 * ondan türetilir. Eksik anahtar kontrolü de `en`'i ölçüt alır — `en`'de olup
 * başka dilde olmayan anahtar hatadır.
 */
export const DEFAULT_LOCALE: Locale = "en";

/**
 * Mesaj dosyaları ÖZELLİK ADINA göre bölünmüş.
 *
 * Tek büyük dosya, iki kişinin aynı anda çeviri yapmasını imkânsız kılar ve
 * hangi metnin nerede kullanıldığını gizler. Bir bileşen hangi ad alanını
 * çağırdığını söylüyor, o dosyaya bakmak yetiyor.
 */
export const NAMESPACES = [
  "common",
  "parts",
  "compatibility",
  "performance",
  "pricing",
] as const;

export type Namespace = (typeof NAMESPACES)[number];

/** Ekranda görünen dil adları — her dil kendi adıyla yazılır. */
export const LOCALE_LABEL: Record<Locale, string> = {
  en: "English",
  tr: "Türkçe",
};

export function isLocale(value: string | undefined): value is Locale {
  return value !== undefined && (LOCALES as readonly string[]).includes(value);
}
