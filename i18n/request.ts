import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";

import { DEFAULT_LOCALE, LOCALES, NAMESPACES, isLocale } from "./locales.ts";
import type { Locale } from "./locales.ts";

/**
 * next-intl kurulumu — **ADRESTE DİL ÖNEKİ YOK**.
 *
 * next-intl'in yaygın kurulumu `/en/...`, `/tr/...` gibi yol önekleri kullanır.
 * Burada kullanılamaz: `SCHEMA.md` bölüm 9 adres yapısını sabitliyor ve
 * "sonradan değiştirilmez" diyor. Önek eklemek `/sistem/<id>` adreslerini
 * `/en/sistem/<id>` yapardı — yani dağıtılmış her paylaşım linki kırılırdı.
 *
 * Dil bunun yerine istekten çözümleniyor:
 *
 *   1. `NEXT_LOCALE` çerezi — kullanıcı bir dil seçtiyse o kazanır
 *   2. `Accept-Language` başlığı — tarayıcının tercihi
 *   3. `en` — varsayılan ve kaynak dil
 *
 * Bedeli: aynı adres iki dilde farklı içerik döndürüyor. Sayfalar zaten
 * `force-dynamic` ve arama motorlarına kapalı (K30), yani bugün bir önbellek
 * ya da indeksleme sorunu doğurmuyor. Site aramaya açılırsa bu yeniden
 * düşünülmeli.
 */
export default getRequestConfig(async () => {
  const locale = await resolveLocale();

  return {
    locale,
    /**
     * Saat dilimi AÇIKÇA veriliyor.
     *
     * Verilmeseydi sunucu kendi saat dilimini, tarayıcı kendininkini
     * kullanırdı ve aynı tarih iki tarafta farklı basılabilirdi — React
     * hydration uyuşmazlığı. `lib/format.ts` eskiden bu yüzden `Intl`
     * kullanmıyordu; saat dilimi sabitlenince sebep ortadan kalktı (K151).
     *
     * UTC seçildi çünkü veritabanındaki tarihler UTC ve gösterilen şey bir
     * takvim günü ("fiyat şu gün toplandı"), yerel bir an değil.
     */
    timeZone: "UTC",
    messages: await loadMessages(locale),
  };
});

/** Ad alanı dosyalarını tek bir mesaj nesnesinde birleştirir. */
async function loadMessages(locale: Locale) {
  const entries = await Promise.all(
    NAMESPACES.map(async (namespace) => {
      const mod = await import(`../messages/${locale}/${namespace}.json`);
      return [namespace, mod.default] as const;
    }),
  );
  return Object.fromEntries(entries);
}

async function resolveLocale(): Promise<Locale> {
  const chosen = (await cookies()).get("NEXT_LOCALE")?.value;
  if (isLocale(chosen)) return chosen;

  const header = (await headers()).get("accept-language");
  return parseAcceptLanguage(header);
}

/**
 * `Accept-Language` başlığından desteklenen ilk dili seçer.
 *
 * Elle ayrıştırılıyor: başlık basit ve tek iş için paket eklemek gereksiz.
 * `tr-TR` gibi bölgeli etiketler ana dile indiriliyor — `tr-TR` ile `tr-CY`
 * için ayrı çeviri yok.
 */
export function parseAcceptLanguage(header: string | null): Locale {
  if (!header) return DEFAULT_LOCALE;

  const ranked = header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.find((p) => p.trim().startsWith("q="));
      return { tag: tag.trim().toLowerCase(), q: q ? Number(q.split("=")[1]) : 1 };
    })
    .filter((entry) => entry.tag !== "" && !Number.isNaN(entry.q))
    .sort((a, b) => b.q - a.q);

  for (const entry of ranked) {
    const base = entry.tag.split("-")[0];
    if (isLocale(base)) return base;
  }
  return DEFAULT_LOCALE;
}

export { LOCALES };
