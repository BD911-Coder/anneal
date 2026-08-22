// Çeviri dosyalarında EKSİK ANAHTAR var mı?
//
// Çalıştırma: npm run dil:kontrol
//
// Ölçüt `en`: kaynak dil o, yeni metin önce orada yazılıyor. `en`'de olup
// başka dilde olmayan anahtar HATA — o anahtarı çağıran ekran, o dilde ham
// anahtar adını basar ("parts.storage.howTo" gibi) ve kullanıcı bunu görür.
//
// Fazladan anahtar da raporlanıyor ama HATA DEĞİL uyarı: bir metin `en`'den
// kaldırıldığında diğer dillerde artık kalması, ekranda hiçbir şey bozmaz —
// yalnızca ölü satırdır.
//
// Ayrıca ICU parametreleri ve zengin metin etiketleri karşılaştırılıyor, ama
// ASİMETRİK olarak:
//
//   çeviride FAZLA değişken  -> HATA. Bileşen o adı göndermiyor; next-intl
//                               cümleyi çizerken patlar.
//   çeviride EKSİK değişken  -> uyarı. Bir dil, kaynak dilin ihtiyaç duyduğu
//                               bir değişkene ihtiyaç duymayabilir: İngilizce
//                               C6 kuralında tekil/çoğul için `supportedCount`
//                               kullanıyor, Türkçede çoğul eki gerekmiyor.
//                               Bunu hata saymak, çeviriyi İngilizcenin
//                               dilbilgisine mahkûm ederdi.

import { existsSync, readFileSync } from "node:fs";

import { DEFAULT_LOCALE, LOCALES, NAMESPACES } from "../i18n/locales.ts";

type Json = { [key: string]: Json | string };

/** İç içe nesneyi `a.b.c` -> metin sözlüğüne düzleştirir. */
function flatten(value: Json, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof child === "string") out.set(path, child);
    else for (const [k, v] of flatten(child, path)) out.set(k, v);
  }
  return out;
}

/**
 * ICU mesajındaki değişken adları.
 *
 * `{count, plural, one {# part} other {# parts}}` -> `count`
 * `<b>{total}</b>` -> `total`
 *
 * Basit bir tarayıcı: ilk virgüle ya da kapanışa kadar olan adı alıyor.
 * Tam bir ICU ayrıştırıcısı değil ve olmasına gerek yok — aranan şey
 * "aynı anahtarda aynı adlar kullanılmış mı".
 */
function icuParams(message: string): Set<string> {
  const names = new Set<string>();
  for (const match of message.matchAll(/\{\s*([a-zA-Z0-9_]+)\s*[,}]/g)) {
    names.add(match[1]);
  }
  return names;
}

/** XML benzeri etiketler: `<b>…</b>` -> `b`. Bileşen tarafında karşılığı olmalı. */
function richTags(message: string): Set<string> {
  const tags = new Set<string>();
  for (const match of message.matchAll(/<([a-zA-Z][a-zA-Z0-9]*)>/g)) tags.add(match[1]);
  return tags;
}

function load(locale: string, namespace: string): Map<string, string> | null {
  const path = `messages/${locale}/${namespace}.json`;
  if (!existsSync(path)) return null;
  return flatten(JSON.parse(readFileSync(path, "utf8")) as Json, namespace);
}

let hatalar = 0;
let uyarilar = 0;

// Kaynak dilin bütün anahtarları
const kaynak = new Map<string, string>();
for (const namespace of NAMESPACES) {
  const messages = load(DEFAULT_LOCALE, namespace);
  if (!messages) {
    console.error(`[HATA] messages/${DEFAULT_LOCALE}/${namespace}.json yok.`);
    hatalar += 1;
    continue;
  }
  for (const [key, value] of messages) kaynak.set(key, value);
}

console.log(`Kaynak dil '${DEFAULT_LOCALE}': ${kaynak.size} anahtar, ${NAMESPACES.length} ad alanı.`);

for (const locale of LOCALES) {
  if (locale === DEFAULT_LOCALE) continue;

  const hedef = new Map<string, string>();
  for (const namespace of NAMESPACES) {
    const messages = load(locale, namespace);
    if (!messages) {
      console.error(`[HATA] messages/${locale}/${namespace}.json yok.`);
      hatalar += 1;
      continue;
    }
    for (const [key, value] of messages) hedef.set(key, value);
  }

  const eksik = [...kaynak.keys()].filter((key) => !hedef.has(key));
  const fazla = [...hedef.keys()].filter((key) => !kaynak.has(key));

  console.log(`\n--- ${locale} ---`);
  console.log(`  anahtar: ${hedef.size}`);

  if (eksik.length > 0) {
    hatalar += eksik.length;
    console.error(`  [HATA] ${eksik.length} anahtar eksik:`);
    for (const key of eksik) console.error(`    - ${key}`);
  } else {
    console.log("  [OK  ] eksik anahtar yok");
  }

  if (fazla.length > 0) {
    uyarilar += fazla.length;
    console.log(`  [UYARI] ${fazla.length} fazladan anahtar (${DEFAULT_LOCALE}'de yok):`);
    for (const key of fazla) console.log(`    - ${key}`);
  }

  // ICU parametreleri ve zengin metin etiketleri iki dilde aynı mı?
  let parametreHatasi = 0;
  for (const [key, sourceText] of kaynak) {
    const targetText = hedef.get(key);
    if (targetText === undefined) continue;

    const beklenen = icuParams(sourceText);
    const gelen = icuParams(targetText);
    const eksikParam = [...beklenen].filter((n) => !gelen.has(n));
    const fazlaParam = [...gelen].filter((n) => !beklenen.has(n));

    const beklenenTag = richTags(sourceText);
    const gelenTag = richTags(targetText);
    const eksikTag = [...beklenenTag].filter((n) => !gelenTag.has(n));
    const fazlaTag = [...gelenTag].filter((n) => !beklenenTag.has(n));

    // Bileşenin göndermediği bir ad kullanmak çalışma anında patlar: HATA.
    if (fazlaParam.length || fazlaTag.length) {
      parametreHatasi += 1;
      hatalar += 1;
      console.error(`  [HATA] ${key} — çeviri, kaynakta olmayan değişken kullanıyor`);
      if (fazlaParam.length) console.error(`    fazla parametre: ${fazlaParam.join(", ")}`);
      if (fazlaTag.length) console.error(`    fazla etiket: ${fazlaTag.join(", ")}`);
    }

    // Kullanılmayan değişken hiçbir şeyi bozmaz; dilbilgisi farkı olabilir.
    if (eksikParam.length || eksikTag.length) {
      uyarilar += 1;
      console.log(`  [UYARI] ${key} — çeviri şu değişkenleri kullanmıyor:`);
      if (eksikParam.length) console.log(`    parametre: ${eksikParam.join(", ")}`);
      if (eksikTag.length) console.log(`    etiket: ${eksikTag.join(", ")}`);
    }
  }
  if (parametreHatasi === 0) console.log("  [OK  ] ICU parametreleri ve etiketler uyuşuyor");
}

console.log("");
if (hatalar > 0) {
  console.error(`SONUC: ${hatalar} hata. Dagitim durur.`);
  process.exit(1);
}
console.log(`SONUC: butun diller tam.${uyarilar > 0 ? ` (${uyarilar} uyari)` : ""}`);
