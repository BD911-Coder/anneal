// Wikipedia wikitext ayrıştırıcı — spec çapraz kontrolü. KURU ÇALIŞMA.
//
// Çalıştırma:
//   npm run wikipedia:deneme               rapor
//   npm run wikipedia:deneme -- --ayrinti  başarısız satırların tamamı
//   npm run wikipedia:deneme -- --makale=List_of_Intel_graphics_processing_units
//
// **HİÇBİR ŞEY YAZMAZ.** `--apply` bayrağı bilinçli olarak YOK — dış değerin
// nereye yazılacağı henüz kararlı değil (raporun sonundaki "YAZMA YOLU"
// bölümü ve SORULAR.md S48).
//
// Neden bu script var: Wikidata kuru çalışmasında (K165) aradığımız spec
// alanlarının Wikidata'da OLMADIĞI ölçüldü; dolu olan yer Wikipedia'nın
// tabloları. Bu script o tabloları okur.
//
// ---------------------------------------------------------------------------
// LİSANS — CC BY-SA, atıf ZORUNLU
// ---------------------------------------------------------------------------
//
// Wikipedia içeriği CC BY-SA. Atıf teknik bir ayrıntı değil: veriyi gösteren
// her yerde kaynak makale ve REVİZYON NUMARASI görünmek zorunda. Bu yüzden
// ayrıştırılan her satır `sourceArticle` + `sourceRevisionId` taşıyor ve
// raporun sonunda atıf bloğu basılıyor. Revizyon olmadan "hangi hâline atıf
// veriyoruz" sorusu cevapsız kalır.
//
// ---------------------------------------------------------------------------
// UZLAŞTIRMA — üretici verisi ASLA ezilmez
// ---------------------------------------------------------------------------
//
// Üretici değeri varsa dış değer onun üstüne YAZILMAZ; çapraz kontrol olarak
// karşılaştırılır ve %5 üstü fark "incelenecek" işaretlenir. Üretici sayfası
// birincil kaynak; dış kaynak onu doğrulayabilir ya da şüphe düşürebilir,
// sessizce değiştiremez.
//
// ---------------------------------------------------------------------------
// AYRIŞTIRMA DURUŞU — sessizce atlamak yok
// ---------------------------------------------------------------------------
//
// Wikitext tabloları `rowspan`, `colspan`, dipnot, şablon, birim eki ve
// nesilden nesile DEĞİŞEN sütun sırası içeriyor. Bir hücre anlaşılmadığında
// tahmin edilmez: satır GEREKÇESİYLE kaydedilir ve rapora girer. Sessiz
// atlama, kapsamın olduğundan iyi görünmesine yol açar — ölçmeye çalıştığımız
// şey tam olarak kapsam.

import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";

import {
  MEDIAWIKI_API,
  WIKIPEDIA_ARTICLES,
  DISCREPANCY_THRESHOLD_PCT,
  RATE_LIMIT_MS,
  USER_AGENT,
  crossCheck,
  getJson,
  normalizeModel,
  type Discrepancy,
} from "./wiki-common.mts";

for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) loadEnvFile(file);
}

const args = process.argv.slice(2);
const AYRINTI = args.includes("--ayrinti");
/** Tablo teshisi: kabul edilen her tablonun sutun eslemesi ve ilk satirlari. */
const TABLO_DOK = args.includes("--tablo-dok");
const makaleFiltre = args.find((a) => a.startsWith("--makale="))?.split("=")[1];

// ===========================================================================
// 1. AĞ — MediaWiki API, HTML kazıma DEĞİL
// ===========================================================================
//
// Kazıma yerine API: sayfa düzeni değiştiğinde kazıyıcı sessizce yanlış veri
// üretir; API sürümlü ve revizyon numarası veriyor. CC BY-SA atıfı da zaten
// revizyon numarası istiyor.

type Sayfa = { title: string; revid: number; wikitext: string };

async function sayfaGetir(title: string): Promise<Sayfa> {
  const url =
    `${MEDIAWIKI_API}?action=parse&prop=wikitext|revid&format=json&formatversion=2` +
    `&page=${encodeURIComponent(title)}`;
  const data = (await getJson(url)) as {
    parse?: { title?: string; revid?: number; wikitext?: string };
    error?: { info?: string };
  };
  if (data.error) throw new Error(data.error.info ?? "bilinmeyen API hatasi");
  const p = data.parse;
  if (!p?.wikitext) throw new Error("wikitext bos dondu");
  return { title: p.title ?? title, revid: p.revid ?? 0, wikitext: p.wikitext };
}

// ===========================================================================
// 2. HÜCRE TEMİZLEME
// ===========================================================================

/** Bir dizeyi verilen ayraçta ÜST SEVİYEDE böler (`{{ }}`, `[[ ]]` ve `<>` içine girmez). */
function ustSeviyeBol(s: string, ayrac: string): string[] {
  const parts: string[] = [];
  let cur = "";
  let kume = 0;
  let kose = 0;
  let etiket = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "{" && s[i + 1] === "{") { kume++; cur += "{{"; i++; continue; }
    if (s[i] === "}" && s[i + 1] === "}") { kume = Math.max(0, kume - 1); cur += "}}"; i++; continue; }
    if (s[i] === "[" && s[i + 1] === "[") { kose++; cur += "[["; i++; continue; }
    if (s[i] === "]" && s[i + 1] === "]") { kose = Math.max(0, kose - 1); cur += "]]"; i++; continue; }
    if (s[i] === "<") etiket++;
    if (s[i] === ">") etiket = Math.max(0, etiket - 1);
    if (kume === 0 && kose === 0 && etiket === 0 && s.startsWith(ayrac, i)) {
      parts.push(cur);
      cur = "";
      i += ayrac.length - 1;
      continue;
    }
    cur += s[i];
  }
  parts.push(cur);
  return parts;
}

/**
 * Şablonları çözer. Derinlik takipli, regex değil: `{{tooltip|a|{{b}}}}` gibi
 * iç içe şablonlarda regex yanlış yerde kapanır.
 *
 * Tanınan birkaç şablonun değeri KORUNUR; tanınmayan şablon DÜŞER. Düşürmek
 * "uydurma yok" kuralının gereği: şablonun ne ürettiğini bilmeden içeriğini
 * veri saymak, olmayan bir sayıyı okumak olur. `{{n/a}}` de böyle düşüyor ve
 * geriye boş hücre kalıyor — doğrusu bu.
 */
function sablonCoz(s: string): string {
  let out = "";
  let i = 0;
  while (i < s.length) {
    if (s[i] === "{" && s[i + 1] === "{") {
      let depth = 0;
      let j = i;
      for (; j < s.length; j++) {
        if (s[j] === "{" && s[j + 1] === "{") { depth++; j++; continue; }
        if (s[j] === "}" && s[j + 1] === "}") { depth--; j++; if (depth === 0) { j++; break; } }
      }
      const govde = s.slice(i + 2, Math.max(i + 2, j - 2));
      const parcalar = ustSeviyeBol(sablonCoz(govde), "|");
      const ad = (parcalar[0] ?? "").trim().toLowerCase();
      if (ad === "tooltip" || ad === "nowrap" || ad === "abbr") {
        out += parcalar[1] ?? "";
      } else if (ad === "sort" || ad === "val" || ad === "nts" || ad === "formatnum") {
        // İlk sayısal argüman. {{sort|1008|1008.0}} ikisini de taşıyor.
        out += parcalar.slice(1).find((p) => /\d/.test(p)) ?? "";
      }
      i = j;
      continue;
    }
    out += s[i];
    i++;
  }
  return out;
}

/**
 * Ham hücre metnini okunur metne indirger.
 *
 * `<br>` SATIR SONU oluyor: çok değerli hücreler (taban/turbo, iki model)
 * orada ayrılıyor ve sayı okuyucu o ayrımı görmek zorunda.
 */
function hucreTemizle(raw: string): string {
  let s = raw;
  s = s.replace(/<!--[\s\S]*?-->/g, "");
  s = s.replace(/<ref[^>]*\/>/gi, "");
  s = s.replace(/<ref[\s\S]*?<\/ref>/gi, "");
  s = sablonCoz(s);
  s = s.replace(/\[\[([^\]|]*)\|([^\]]*)\]\]/g, "$2").replace(/\[\[([^\]]*)\]\]/g, "$1");
  s = s.replace(/\[https?:\/\/\S+\s+([^\]]*)\]/g, "$1").replace(/\[https?:\/\/\S+\]/g, "");
  s = s.replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/<sup>[\s\S]*?<\/sup>/gi, "");
  s = s.replace(/<[^>]*>/g, "");
  s = s
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&minus;/gi, "-")
    .replace(/&times;/gi, "x")
    .replace(/&amp;/gi, "&")
    .replace(/&#8203;|&thinsp;|&hairsp;/gi, "")
    .replace(/&[a-z]+;/gi, " ");
  s = s.replace(/'{2,}/g, "");
  return s
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l !== "")
    .join("\n")
    .trim();
}

// ===========================================================================
// 3. TABLO IZGARASI — rowspan / colspan açılıyor
// ===========================================================================

type Hucre = { metin: string };

type Tablo = {
  basliklar: string[];
  satirlar: Hucre[][];
  /** Tablonun bulunduğu başlık yolu: "Desktop GPUs > GeForce RTX 40 series" */
  bolum: string;
  /** Ayrıştırma sırasında dikkat çeken şeyler — sessizce yutulmuyor. */
  notlar: string[];
};

/** Wikitext'i `{|` ... `|}` tablolarına böler; iç içe tabloyu doğru kapatır. */
function tablolariBul(wikitext: string): { raw: string; index: number }[] {
  const out: { raw: string; index: number }[] = [];
  let i = 0;
  while (i < wikitext.length) {
    const bas = wikitext.indexOf("{|", i);
    if (bas === -1) break;
    let depth = 0;
    let j = bas;
    for (; j < wikitext.length; j++) {
      if (wikitext.startsWith("{|", j)) { depth++; j++; continue; }
      if (wikitext.startsWith("|}", j)) { depth--; j++; if (depth === 0) { j++; break; } }
    }
    out.push({ raw: wikitext.slice(bas, j), index: bas });
    i = Math.max(j, bas + 2);
  }
  return out;
}

/** `rowspan="3"` / `colspan=2` / `colspan="2'` — tırnak tutarsız, hatta hatalı yazılabiliyor. */
function span(attrs: string, ad: "rowspan" | "colspan"): number {
  const m = attrs.match(new RegExp(`${ad}\\s*=\\s*["']?\\s*(\\d+)`, "i"));
  const n = m ? Number(m[1]) : 1;
  return Number.isFinite(n) && n > 0 && n < 100 ? n : 1;
}

/**
 * Hücreyi öznitelik ve içerik olarak ayırır.
 *
 * MediaWiki kuralı: ilk ÜST SEVİYE `|` özniteliği içerikten ayırır. Ayraç
 * yoksa hücrenin tamamı içeriktir — ama `| rowspan="4" {{n/a}}` gibi
 * yazımlarda öznitelik ayraçsız duruyor, o yüzden tanınan öznitelik kalıpları
 * içerikten ayrıca temizleniyor.
 */
const OZNITELIK_KALIBI =
  /\b(rowspan|colspan|style|class|align|valign|scope|width|height|bgcolor|title|id|data-sort-value)\s*=\s*("[^"]*"|'[^']*'|\S+)/gi;

function hucreAyir(chunk: string): { attrs: string; icerik: string } {
  const parcalar = ustSeviyeBol(chunk, "|");
  if (parcalar.length >= 2 && /^[^[{]*=/.test(parcalar[0])) {
    return { attrs: parcalar[0], icerik: parcalar.slice(1).join("|") };
  }
  const attrs = chunk.match(OZNITELIK_KALIBI)?.join(" ") ?? "";
  return { attrs, icerik: attrs ? chunk.replace(OZNITELIK_KALIBI, "") : chunk };
}

/** Bir satırın ham metnini hücrelere böler. Satır başı `|`/`!`, satır içi `||`/`!!`. */
function satirHucreleri(satirRaw: string): { attrs: string; icerik: string; baslikMi: boolean }[] {
  const out: { attrs: string; icerik: string; baslikMi: boolean }[] = [];
  let cur: { baslikMi: boolean; buf: string } | null = null;
  const bitir = () => {
    if (!cur) return;
    const acik = cur;
    for (const parca of ustSeviyeBol(acik.buf, acik.baslikMi ? "!!" : "||")) {
      const { attrs, icerik } = hucreAyir(parca);
      out.push({ attrs, icerik, baslikMi: acik.baslikMi });
    }
    cur = null;
  };
  for (const line of satirRaw.split("\n")) {
    if (/^\s*[|!]-/.test(line) || /^\s*\|\+/.test(line)) continue;
    const m = line.match(/^\s*(\||!)(.*)$/);
    if (m) {
      bitir();
      cur = { baslikMi: m[1] === "!", buf: m[2] };
    } else if (cur) {
      cur.buf += "\n" + line;
    }
  }
  bitir();
  return out;
}

/** Izgarayı açar: `rowspan` aşağı, `colspan` sağa taşınır. */
function tabloAyristir(raw: string, bolum: string): Tablo {
  const notlar: string[] = [];
  const govde = raw.replace(/^\{\|[^\n]*\n?/, "").replace(/\n?\|\}\s*$/, "");
  const hamSatirlar = govde.split(/\n\s*\|-[^\n]*\n?/);

  const tasima: ({ hucre: Hucre; kalan: number } | undefined)[] = [];
  const basliklarKatman: string[][] = [];
  const satirlar: Hucre[][] = [];
  let veriBasladi = false;

  for (const hamSatir of hamSatirlar) {
    const hucreler = satirHucreleri(hamSatir);
    if (hucreler.length === 0) continue;

    const satir: Hucre[] = [];
    let col = 0;
    for (const c of hucreler) {
      while (tasima[col] && tasima[col]!.kalan > 0) { satir[col] = tasima[col]!.hucre; col++; }
      const rs = span(c.attrs, "rowspan");
      const cs = span(c.attrs, "colspan");
      const h: Hucre = { metin: hucreTemizle(c.icerik) };
      for (let k = 0; k < cs; k++) {
        satir[col] = h;
        if (rs > 1) tasima[col] = { hucre: h, kalan: rs };
        col++;
      }
    }
    while (tasima[col] && tasima[col]!.kalan > 0) { satir[col] = tasima[col]!.hucre; col++; }
    for (const t of tasima) if (t && t.kalan > 0) t.kalan--;

    const tumuBaslik = hucreler.every((c) => c.baslikMi);
    if (tumuBaslik && !veriBasladi) {
      basliklarKatman.push(satir.map((h) => h?.metin ?? ""));
    } else if (tumuBaslik) {
      notlar.push("tablo ortasinda tekrar eden baslik satiri atlandi");
    } else {
      veriBasladi = true;
      satirlar.push(satir);
    }
  }

  // Sütun etiketi = o sütuna denk gelen BÜTÜN başlık katmanlarının birleşimi.
  // Sütun sırası nesilden nesile değişiyor; eşleme sıraya değil ETİKETE bakıyor.
  const genislik = Math.max(
    0,
    ...basliklarKatman.map((k) => k.length),
    ...satirlar.map((s) => s.length),
  );
  const basliklar: string[] = [];
  for (let c = 0; c < genislik; c++) {
    const parcalar: string[] = [];
    for (const katman of basliklarKatman) {
      const t = (katman[c] ?? "").replace(/\n/g, " ").trim();
      if (t && !parcalar.includes(t)) parcalar.push(t);
    }
    basliklar[c] = parcalar.join(" ").toLowerCase();
  }
  return { basliklar, satirlar, bolum, notlar };
}

// ===========================================================================
// 4. SAYI OKUMA — belirsizlik tahmin edilmez, kaydedilir
// ===========================================================================

type SayiSonuc =
  | { tip: "deger"; deger: number; alternatif?: number }
  | { tip: "yok" }
  | { tip: "belirsiz"; sebep: string };

/**
 * Hücre metninden tek bir sayı çıkarır.
 *
 * Kabul edilen biçimler ve neden:
 * - `1008.0`                tek değer
 * - `~169.4`                yaklaşık işareti düşer, sayı kalır
 * - `2235 (2520)`           parantezli ikinci değer ALTERNATİF sayılır
 *                           (taban/turbo); ilki alınır, ikincisi raporda durur
 * - `12,999`                binlik ayracı temizlenir
 *
 * REDDEDİLEN biçimler ve neden:
 * - `128-256` aralık         hangi uç doğru bilinmiyor
 * - `288` + `320` iki satır  iki ayrı modelin değeri olabilir
 * Bunlar `belirsiz` döner ve satır rapora girer. Ortalama almak ya da ilkini
 * seçmek, kaynakta olmayan bir sayı üretmek olur (K60).
 */
function sayiOku(metin: string): SayiSonuc {
  const ham = metin.trim();
  if (ham === "" || /^(n\/?a|unknown|tbd|tba|\?+|-|—|–)$/i.test(ham)) return { tip: "yok" };

  const satirlar = ham.split("\n").map((s) => s.trim()).filter(Boolean);
  const asil: number[] = [];
  const alternatif: number[] = [];

  for (const satir of satirlar) {
    const parantezli = /^[(\[]/.test(satir);
    const temiz = satir
      .replace(/[()\[\]~≈*]/g, " ")
      .replace(/(\d),(\d{3})\b/g, "$1$2")
      .trim();
    // Aralık: iki sayı arasında tire/en-dash.
    if (/\d\s*[-–—]\s*\d/.test(temiz)) {
      return { tip: "belirsiz", sebep: `aralik degeri: "${ham.replace(/\n/g, " / ")}"` };
    }
    const m = temiz.match(/-?\d+(?:\.\d+)?/g);
    if (!m) continue;
    if (m.length > 1) {
      return { tip: "belirsiz", sebep: `hucrede birden fazla sayi: "${ham.replace(/\n/g, " / ")}"` };
    }
    (parantezli ? alternatif : asil).push(Number(m[0]));
  }

  if (asil.length === 0 && alternatif.length === 0) return { tip: "yok" };
  if (asil.length === 0) return { tip: "belirsiz", sebep: `yalnizca parantezli deger: "${ham.replace(/\n/g, " / ")}"` };
  const tekil = [...new Set(asil)];
  if (tekil.length > 1) {
    return { tip: "belirsiz", sebep: `satirda farkli degerler: "${ham.replace(/\n/g, " / ")}"` };
  }
  return alternatif.length > 0
    ? { tip: "deger", deger: asil[0], alternatif: alternatif[0] }
    : { tip: "deger", deger: asil[0] };
}

// ===========================================================================
// 5. SÜTUN EŞLEME — sıraya değil BAŞLIĞA bakılır
// ===========================================================================
//
// Sütun sırası nesiller arasında değişiyor (RTX 30 ile RTX 50 tablosu aynı
// sırada değil), bu yüzden indeks sabitlenemez. Eşleme başlık metnine bakıyor
// ve BİRİM de başlıktan okunuyor: birimi belirsiz sütun kullanılmıyor.

type Alan =
  | "memory_bandwidth_gbs"
  | "bus_width_bits"
  | "tdp_watt"
  | "transistor_count_m"
  | "die_size_mm2"
  | "fillrate_pixel_gps"
  | "fillrate_texture_gts"
  | "memory_size_gb";

/** Şemada karşılığı OLAN alanlar. Diğerleri yalnızca ölçülüp raporlanıyor. */
const SEMADA_VAR: Alan[] = [
  "memory_bandwidth_gbs",
  "bus_width_bits",
  "tdp_watt",
  "transistor_count_m",
];

type SutunKural = {
  alan: Alan;
  /** Başlık bu kalıba uymak zorunda. */
  eslesir: RegExp;
  /** Bu kalıba uyuyorsa sütun REDDEDİLİR (yanlış sütunu yakalamamak için). */
  eslesmez?: RegExp;
  /** Başlıktan birim çarpanı. `null` dönerse sütun kullanılmaz. */
  carpan?: (baslik: string) => number | null;
};

const SUTUN_KURALLARI: SutunKural[] = [
  {
    alan: "memory_bandwidth_gbs",
    eslesir: /bandwidth/,
    // "memory clock" ve "transfer" sütunları da "memory" içeriyor; bant
    // genişliği sütunu GB/s birimini başlıkta taşır.
    eslesmez: /clock|transfer|gt\/s|cache/,
    carpan: (b) => (/gb\s*\/\s*s|gbyte\/s|gigabyte per second/.test(b) ? 1 : null),
  },
  {
    alan: "bus_width_bits",
    eslesir: /bus\s*width|memory\s*(bus|interface)\s*width|interface\s*width/,
    eslesmez: /bus\s*type|pcie/,
    carpan: (b) => (/\bbit\b|\(bit/.test(b) ? 1 : null),
  },
  {
    alan: "tdp_watt",
    eslesir: /\btdp\b|\btbp\b|thermal design power|board power|power draw/,
    eslesmez: /idle|per watt|efficiency/,
    carpan: (b) => (/watt|\(w\)|\bw\b/.test(b) ? 1 : null),
  },
  {
    alan: "transistor_count_m",
    eslesir: /transistor/,
    // Şemadaki birim MİLYON. Milyar yazan tablo 1000 ile çarpılır; birim
    // yazmayan tablo KULLANILMAZ — "muhtemelen milyon" bir tahmindir.
    carpan: (b) => (/billion|\(b\)/.test(b) ? 1000 : /million|\(m\)/.test(b) ? 1 : null),
  },
  {
    alan: "die_size_mm2",
    eslesir: /die\s*size/,
    carpan: (b) => (/mm/.test(b) ? 1 : null),
  },
  { alan: "fillrate_pixel_gps", eslesir: /fillrate.*pixel|pixel.*\(gp\/s\)/, carpan: () => 1 },
  { alan: "fillrate_texture_gts", eslesir: /fillrate.*texture|texture.*\(gt\/s\)/, carpan: () => 1 },
  {
    alan: "memory_size_gb",
    // Yalnızca eşleştirmede kullanılıyor (8 GB / 16 GB aynı adlı iki satır).
    eslesir: /memory\s*(configuration)?\s*size|size\s*\(gb\)|memory\s*\(gb\)/,
    eslesmez: /cache|bus|bandwidth|die/,
    carpan: (b) => (/\bgb\b|gib/.test(b) ? 1 : null),
  },
];

/**
 * Adı taşıyan sütun(lar).
 *
 * Çoğul: Intel'in tablosunda başlık "Branding and Model" ve iki sütuna
 * yayılıyor — marka bir sütunda ("Arc"), model numarası diğerinde ("A770 16
 * GB"). Yalnızca ilkini almak bütün satırlara aynı adı verirdi. Eşleşen
 * sütunlar sırayla birleştiriliyor; `normalizeModel` marka önekini zaten
 * düşürdüğü için birleştirmenin bedeli yok.
 */
const MODEL_BASLIK = /(^|\s)(model|graphics|name|product|card|chip|gpu|board|branding)\b/;
/** Başlık bir ad sözcüğüyle BAŞLIYORSA sütun addır — içinde başka ne geçerse geçsin. */
const MODEL_BASLIK_BASI = /^(model|graphics|name|product|card|chip|gpu|board|branding)\b/;
/**
 * "Code name" de "name" içeriyor ama model adı değil, çip kodu.
 *
 * Bu eleme yalnızca başlık bir ad sözcüğüyle BAŞLAMIYORSA uygulanıyor: AMD
 * tablolarının başlığı "Model (Code name)" ve orası gerçekten model sütunu.
 */
const MODEL_BASLIK_DEGIL = /code\s*name|codename|architecture|family/;

type SutunHarita = { model: number[]; alanlar: Map<Alan, { sutun: number; carpan: number }> };

function sutunlariEsle(basliklar: string[]): { harita: SutunHarita | null; sebep?: string } {
  const model: number[] = [];
  for (let c = 0; c < basliklar.length; c++) {
    const b = basliklar[c].replace(/\s+/g, " ").trim();
    const adSutunu = MODEL_BASLIK_BASI.test(b) || (MODEL_BASLIK.test(b) && !MODEL_BASLIK_DEGIL.test(b));
    if (!adSutunu) continue;
    // Ad sütunları bitişiktir; araya başka sütun girdiyse ilk öbek alınır.
    if (model.length > 0 && c !== model[model.length - 1] + 1) break;
    model.push(c);
  }
  if (model.length === 0) return { harita: null, sebep: "model sutunu bulunamadi" };

  const alanlar = new Map<Alan, { sutun: number; carpan: number }>();
  for (const kural of SUTUN_KURALLARI) {
    for (let c = 0; c < basliklar.length; c++) {
      const b = basliklar[c];
      if (!b || !kural.eslesir.test(b)) continue;
      if (kural.eslesmez?.test(b)) continue;
      const carpan = kural.carpan ? kural.carpan(b) : 1;
      if (carpan === null) continue;
      // Aynı alan için ikinci bir sütun varsa İLKİ tutulur ve not düşülür;
      // ikisini birden okumak hangi sütunun doğru olduğunu belirsizleştirir.
      if (!alanlar.has(kural.alan)) alanlar.set(kural.alan, { sutun: c, carpan });
    }
  }
  return { harita: { model, alanlar } };
}

// ===========================================================================
// 6. BÖLÜM SÜZGECİ — yalnızca masaüstü
// ===========================================================================
//
// Bu ayrım güvenlik meselesi: aynı model adı hem masaüstü hem dizüstü
// tablosunda geçiyor ("RTX 4090" dizüstünde 576 GB/s, masaüstünde 1008 GB/s).
// Bölüm süzgeci olmasa ayrıştırıcı yanlış satırı doğru sanardı.

const MASAUSTU = /desktop/i;
const MASAUSTU_DEGIL = /mobile|notebook|laptop|mobility|workstation|server|embedded|console|professional|quadro|tesla|firepro|instinct|data center|max series/i;

function bolumKabul(bolumYolu: string): boolean {
  if (MASAUSTU_DEGIL.test(bolumYolu)) return false;
  return MASAUSTU.test(bolumYolu);
}

/** Wikitext'i başlık yolu + o başlığın altındaki metin parçalarına böler. */
function bolumler(wikitext: string): { yol: string; metin: string }[] {
  const out: { yol: string; metin: string }[] = [];
  const satirlar = wikitext.split("\n");
  const yigin: string[] = [];
  let buf: string[] = [];
  const bosalt = () => {
    if (buf.length > 0) out.push({ yol: yigin.join(" > "), metin: buf.join("\n") });
    buf = [];
  };
  for (const line of satirlar) {
    const m = line.match(/^(={2,6})\s*(.*?)\s*\1\s*$/);
    if (m) {
      bosalt();
      const seviye = m[1].length - 2;
      yigin.length = Math.min(yigin.length, seviye);
      yigin[seviye] = hucreTemizle(m[2]);
      yigin.length = seviye + 1;
      continue;
    }
    buf.push(line);
  }
  bosalt();
  return out;
}

/**
 * Masaüstü bölümlerindeki ÇÖZÜLMEMİŞ şablon çağrıları.
 *
 * AMD'nin RX 7000/9000 ve Intel'in Arc tabloları makalenin kendisinde DEĞİL,
 * ayrı şablon sayfalarında duruyor (`{{AMD Radeon RX 9000}}`). Wikitext'te
 * yalnızca çağrı görünüyor. Bunlar ayrı sayfa olarak çekiliyor ve KENDİ
 * revizyon numaralarıyla atıf alıyorlar — atıf, veriyi taşıyan sayfaya
 * verilmek zorunda.
 */
const BICIM_SABLONU =
  /^(main|further|see also|row hover highlight|notelist|reflist|cite|efn|anchor|as of|update|multiple image|infobox|nowrap|toc|div col|clear|hatnote|about|redirect|for|excerpt|sticky|sort-under|sortname|legend|small|center)/i;

function tabloSablonlari(metin: string): string[] {
  const out: string[] = [];
  for (const line of metin.split("\n")) {
    const m = line.trim().match(/^\{\{([^|{}]+?)(\|[^{}]*)?\}\}$/);
    if (!m) continue;
    const ad = m[1].trim();
    if (BICIM_SABLONU.test(ad)) continue;
    out.push(ad);
  }
  return out;
}

// ===========================================================================
// 7. SATIR ÇIKARIMI
// ===========================================================================

type WikiSatir = {
  model: string;
  normal: string;
  degerler: Partial<Record<Alan, number>>;
  alternatifler: Partial<Record<Alan, number>>;
  kaynakSayfa: string;
  revizyon: number;
  bolum: string;
};

type Basarisiz = { sayfa: string; bolum: string; model: string; sebep: string };

/**
 * Ad sütunlarını tek bir hücre metnine birleştirir.
 *
 * Aynı metin iki sütunda tekrar ediyorsa bir kez alınır: `rowspan` ile
 * taşınan marka hücresi iki sütuna da düşebiliyor.
 */
function modelHucresi(satir: Hucre[], sutunlar: number[]): string {
  const parcalar: string[] = [];
  for (const c of sutunlar) {
    const t = (satir[c]?.metin ?? "").trim();
    if (t && !parcalar.includes(t)) parcalar.push(t);
  }
  return parcalar.join(" ");
}

/**
 * Model hücresini tek bir ada indirger.
 *
 * `<br>` bu hücrede İKİ farklı iş yapıyor ve ayırt etmek zorunlu:
 *
 * - **Satır kaydırma:** `GeForce RTX<br>4060` tek bir addır, tabloyu dar
 *   tutmak için bölünmüş. Birleştirilir.
 * - **İki ayrı model:** `GeForce RTX 4070<br>GeForce RTX 4070 Super` iki
 *   modelin verisini tek hücrede gösterir. Hangi sayının hangi modele ait
 *   olduğu belli değildir; satır REDDEDİLİR.
 *
 * Ayrım ölçütü: bir satırın kendi başına TAM bir model adı olması, yani hem
 * seri sözcüğü (RTX, RX, Arc…) hem de model numarası taşıması. İki tam ad
 * varsa hücre çok modellidir. `GeForce RTX` numarasız, `4060` serisizdir —
 * ikisi de tek başına ad değildir, o yüzden birleşirler.
 */
function modelAdiCoz(ham: string): { ad?: string; sorun?: string } {
  const satirlar = ham
    .split("\n")
    .map((l) => l.trim())
    // Parantezli parça ÇİP KODUDUR, model adı değil: AMD tablosunun başlığı
    // "Model (Code name)" ve hücre "Radeon RX 9070 XT<br>(Navi 48)" yazıyor.
    // Bellek boyutu parantezi ("(12 GB)") KORUNUYOR — o gerçekten modelin
    // parçası ve iki ürünü birbirinden ayırıyor.
    .map((l) => l.replace(/\(([^)]*)\)/g, (tam, ic: string) => (/\d+\s*[gm]b/i.test(ic) ? tam : "")))
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  if (satirlar.length === 0) return { sorun: "model hucresi bos" };
  const tamAd = satirlar.filter(
    (l) => /(rtx|gtx|\brx\b|arc|radeon|geforce|titan|quadro|firepro)/i.test(l) && /\d{3,4}/.test(l),
  );
  if (tamAd.length > 1) {
    return { sorun: `model hucresinde birden fazla ad: "${satirlar.join(" / ")}"` };
  }
  const ad = satirlar.join(" ").replace(/\s+/g, " ").trim();
  if (!/\d/.test(ad)) return { sorun: `model adinda numara yok: "${ad}"` };
  return { ad };
}

function satirlariCikar(
  tablo: Tablo,
  sayfa: Sayfa,
  basarisizlar: Basarisiz[],
): { satirlar: WikiSatir[]; toplam: number } {
  const { harita, sebep } = sutunlariEsle(tablo.basliklar);
  if (!harita) {
    basarisizlar.push({
      sayfa: sayfa.title,
      bolum: tablo.bolum,
      model: `(${tablo.satirlar.length} satirlik tablo)`,
      sebep: sebep ?? "sutun eslemesi yapilamadi",
    });
    return { satirlar: [], toplam: tablo.satirlar.length };
  }
  // Şemada karşılığı olan tek bir alan bile yoksa tablo bizim için boştur.
  if (![...harita.alanlar.keys()].some((a) => SEMADA_VAR.includes(a))) {
    return { satirlar: [], toplam: 0 };
  }

  const satirlar: WikiSatir[] = [];
  for (const satir of tablo.satirlar) {
    const modelHam = modelHucresi(satir, harita.model);
    const { ad: model, sorun: modelSorunu } = modelAdiCoz(modelHam);
    if (!model) {
      basarisizlar.push({
        sayfa: sayfa.title,
        bolum: tablo.bolum,
        model: modelHam.replace(/\n/g, " / ") || "(bos)",
        sebep: modelSorunu ?? "model hucresi bos",
      });
      continue;
    }

    const degerler: Partial<Record<Alan, number>> = {};
    const alternatifler: Partial<Record<Alan, number>> = {};
    let hucreSorunu: string | null = null;
    for (const [alan, { sutun, carpan }] of harita.alanlar) {
      const metin = satir[sutun]?.metin ?? "";
      const sonuc = sayiOku(metin);
      if (sonuc.tip === "deger") {
        degerler[alan] = Math.round(sonuc.deger * carpan * 1000) / 1000;
        if (sonuc.alternatif !== undefined) alternatifler[alan] = sonuc.alternatif * carpan;
      } else if (sonuc.tip === "belirsiz" && SEMADA_VAR.includes(alan)) {
        hucreSorunu = `${alan}: ${sonuc.sebep}`;
      }
    }
    if (hucreSorunu) {
      basarisizlar.push({ sayfa: sayfa.title, bolum: tablo.bolum, model, sebep: hucreSorunu });
      // Satır tamamen atılmıyor: okunabilen alanlar duruyor, okunamayan alan
      // yok sayılıyor ve gerekçesi rapora giriyor.
    }
    if (Object.keys(degerler).length === 0) continue;

    satirlar.push({
      model,
      normal: normalizeModel(model),
      degerler,
      alternatifler,
      kaynakSayfa: sayfa.title,
      revizyon: sayfa.revid,
      bolum: tablo.bolum,
    });
  }
  return { satirlar, toplam: tablo.satirlar.length };
}

// ===========================================================================
// 8. ÇALIŞTIRMA
// ===========================================================================

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL tanimli degil.");
  process.exit(1);
}
const { prisma } = await import("../data/client.ts");

const cizgi = (s = "=") => console.log(s.repeat(76));

console.log("WIKIPEDIA WIKITEXT AYRISTIRICI — KURU CALISMA");
console.log("Hicbir sey yazilmadi: ne veritabanina, ne CSV'ye.\n");
console.log(`User-Agent : ${USER_AGENT}`);
console.log(`Hiz siniri : istekler arasi ${RATE_LIMIT_MS} ms`);
console.log(`Lisans     : Wikipedia CC BY-SA — her satir makale + revizyon tasiyor\n`);

const makaleler = (makaleFiltre ? [makaleFiltre] : [...WIKIPEDIA_ARTICLES]) as string[];

type MakaleSonuc = {
  sayfa: Sayfa;
  tabloToplam: number;
  tabloMasaustu: number;
  satirToplam: number;
  satirOkunan: number;
  sablonlar: { ad: string; sayfa?: Sayfa }[];
};

const tumSatirlar: WikiSatir[] = [];
const basarisizlar: Basarisiz[] = [];
const makaleSonuclari: MakaleSonuc[] = [];
const kaynakSayfalar: Sayfa[] = [];

for (const makale of makaleler) {
  cizgi();
  console.log(`MAKALE: ${makale}`);
  cizgi();
  let sayfa: Sayfa;
  try {
    sayfa = await sayfaGetir(makale);
  } catch (err) {
    console.log(`  HATA: ${(err as Error).message}\n`);
    continue;
  }
  kaynakSayfalar.push(sayfa);
  console.log(`  revizyon ${sayfa.revid} · ${(sayfa.wikitext.length / 1024).toFixed(0)} KB`);

  const sonuc: MakaleSonuc = {
    sayfa,
    tabloToplam: 0,
    tabloMasaustu: 0,
    satirToplam: 0,
    satirOkunan: 0,
    sablonlar: [],
  };

  const isle = (kaynak: Sayfa, bolumYolu: string, metin: string) => {
    for (const t of tablolariBul(metin)) {
      sonuc.tabloToplam++;
      if (!bolumKabul(bolumYolu)) continue;
      sonuc.tabloMasaustu++;
      const tablo = tabloAyristir(t.raw, bolumYolu);
      if (TABLO_DOK) {
        const { harita, sebep } = sutunlariEsle(tablo.basliklar);
        console.log(`
  --- TABLO ${bolumYolu} (${kaynak.title})`);
        console.log(`      basliklar: ${tablo.basliklar.map((b, i) => `${i}:${b.slice(0, 26)}`).join(" | ")}`);
        if (!harita) console.log(`      ESLESME YOK: ${sebep}`);
        else {
          console.log(`      model sutunlari: ${harita.model.join(", ")}`);
          for (const [alan, k] of harita.alanlar) console.log(`      ${alan} -> sutun ${k.sutun} (x${k.carpan})`);
          for (const satir of tablo.satirlar.slice(0, 3)) {
            console.log(`      satir: model="${modelHucresi(satir, harita.model).replace(/\n/g, " / ")}"` +
              [...harita.alanlar].map(([a, k]) => ` ${a}="${(satir[k.sutun]?.metin ?? "").replace(/\n/g, " / ")}"`).join(""));
          }
        }
      }
      const { satirlar, toplam } = satirlariCikar(tablo, kaynak, basarisizlar);
      sonuc.satirToplam += toplam;
      sonuc.satirOkunan += satirlar.length;
      tumSatirlar.push(...satirlar);
    }
  };

  const bolumListesi = bolumler(sayfa.wikitext);
  for (const b of bolumListesi) isle(sayfa, b.yol, b.metin);

  // Şablonla gelen tablolar (AMD RX 7000/9000, Intel Arc) ayrı sayfalar.
  const sablonAdlari = new Set<string>();
  for (const b of bolumListesi) {
    if (!bolumKabul(b.yol)) continue;
    for (const ad of tabloSablonlari(b.metin)) sablonAdlari.add(`${ad}|${b.yol}`);
  }
  for (const kayit of sablonAdlari) {
    const [ad, yol] = kayit.split("|");
    try {
      const sablonSayfa = await sayfaGetir(`Template:${ad}`);
      kaynakSayfalar.push(sablonSayfa);
      sonuc.sablonlar.push({ ad, sayfa: sablonSayfa });
      isle(sablonSayfa, yol, sablonSayfa.wikitext);
    } catch (err) {
      sonuc.sablonlar.push({ ad });
      basarisizlar.push({
        sayfa: makale,
        bolum: yol,
        model: `{{${ad}}}`,
        sebep: `sablon sayfasi okunamadi: ${(err as Error).message}`,
      });
    }
  }

  console.log(`  tablo: ${sonuc.tabloToplam} bulundu, ${sonuc.tabloMasaustu} masaustu bolumunde`);
  if (sonuc.sablonlar.length > 0) {
    console.log(`  sablonla gelen tablo sayfasi: ${sonuc.sablonlar.length}`);
    for (const s of sonuc.sablonlar) {
      console.log(`    Template:${s.ad}${s.sayfa ? ` — revizyon ${s.sayfa.revid}` : " — OKUNAMADI"}`);
    }
  }
  const oran = sonuc.satirToplam > 0 ? ((sonuc.satirOkunan / sonuc.satirToplam) * 100).toFixed(1) : "0.0";
  console.log(`  satir: ${sonuc.satirOkunan} / ${sonuc.satirToplam} okundu (%${oran})\n`);
  makaleSonuclari.push(sonuc);
}

// --- Katalogla eşleştirme --------------------------------------------------

cizgi();
console.log("KATALOGLA ESLESME");
cizgi();

const gpuSpecler = await prisma.gpuSpecs.findMany({
  select: {
    part_id: true,
    vram_gb: true,
    memory_bandwidth_gbs: true,
    bus_width_bits: true,
    tdp_watt: true,
    transistor_count_m: true,
    part: { select: { brand: true, model: true } },
  },
});

/** Parça kimliği -> spec satırı. Rapor boyunca birden çok yerde okunuyor. */
const specHarita = new Map(gpuSpecler.map((s) => [s.part_id, s]));

const wikiIndeks = new Map<string, WikiSatir[]>();
for (const s of tumSatirlar) {
  const liste = wikiIndeks.get(s.normal) ?? [];
  liste.push(s);
  wikiIndeks.set(s.normal, liste);
}

/**
 * Katalog adındaki bellek eki ("16gb") düşürülür: wiki satırı adında taşımıyor.
 *
 * Kaç basamak düşeceği TAHMİN EDİLMİYOR, parçanın kendi `vram_gb` değerinden
 * okunuyor. Kalıpla denendi ve iki kez yanlış yerden kesti: `\d+gb$` açgözlü
 * davranıp "rtx30508gb" adını "rtx" yaptı, `\d{1,2}gb$` ise "rtx305" —
 * ikisi de model numarasının bir parçasını yuttu. Doğru sınır zaten
 * veritabanında duruyor.
 */
function bellekEkiniAt(normal: string, vramGb: number): string {
  const ek = `${vramGb}gb`;
  return normal.endsWith(ek) ? normal.slice(0, -ek.length) : normal;
}

/**
 * Kademe öneki ile eşleşme — yalnızca TEK aday varsa.
 *
 * Intel'in tablosu ürünü "Arc 7 A770" diye yazıyor; katalogda "Arc A770"
 * duruyor. Normalize edildiğinde "7a770" ile "a770" oluyor ve tam ad eşleşmesi
 * kaçıyor. Aradaki fark Intel'in kademe rakamı (3/5/7/B).
 *
 * Kural dar tutuldu: wiki adı katalog adıyla BİTECEK ve fazlalık en çok iki
 * karakter olacak. Böylece "rx6800" ile "rx6800xt" gibi gerçekten farklı iki
 * ürün birbirine karışmıyor (fazlalık sonda, önde değil). Birden fazla wiki
 * adı uyuyorsa eşleşme yapılmıyor: hangisi olduğu bilinemez.
 */
function kademeOnekiIleBul(normal: string, indeks: Map<string, WikiSatir[]>): WikiSatir[] {
  if (normal.length < 4) return [];
  const uyanlar = [...indeks.keys()].filter(
    (k) => k !== normal && k.endsWith(normal) && k.length - normal.length <= 2,
  );
  return uyanlar.length === 1 ? (indeks.get(uyanlar[0]) ?? []) : [];
}

type Eslesme = {
  partId: string;
  /** Aynı ada karşılık gelen bütün wiki satırları. Çözüm ALAN BAŞINA yapılıyor. */
  adaylar: WikiSatir[];
  yontem: string;
};

/**
 * Bir alanın değerini adaylardan çözer.
 *
 * Aynı model adı birden fazla wiki satırında geçebiliyor ve bu her zaman bir
 * hata değil: NVIDIA "RTX 4060"ı iki farklı çiple (AD106/AD107) yayınladı,
 * satırlar bant genişliğinde ve TDP'de AYNI, transistör sayısında FARKLI.
 *
 * Bu yüzden çözüm satır seçmekle değil ALAN BAŞINA yapılıyor: adayların
 * hepsi aynı değeri veriyorsa değer kullanılır, farklı değer veriyorlarsa
 * O ALAN belirsizdir ve düşer — diğer alanlar bundan etkilenmez.
 *
 * Eski davranış tek bir çelişkili alan yüzünden satırın TAMAMINI atıyordu ve
 * bu, RTX 4060/4070'in bant genişliğini transistör sayısı yüzünden
 * kaybettiriyordu.
 */
function alanCoz(
  adaylar: WikiSatir[],
  alan: Alan,
): { deger: number; kaynak: WikiSatir } | { celiskili: number[] } | null {
  const bulunan = adaylar.filter((a) => a.degerler[alan] !== undefined);
  if (bulunan.length === 0) return null;
  const tekil = [...new Set(bulunan.map((a) => a.degerler[alan]!))];
  if (tekil.length > 1) return { celiskili: tekil };
  return { deger: tekil[0], kaynak: bulunan[0] };
}

const eslesmeler: Eslesme[] = [];
const eslesmeyen: string[] = [];
/** Alan bazında çözülemeyenler: "part.alan — a / b" */
const belirsizAlan: string[] = [];

for (const spec of gpuSpecler) {
  const normal = normalizeModel(spec.part.model);
  let adaylar = wikiIndeks.get(normal) ?? [];
  let yontem = "tam ad";
  if (adaylar.length === 0) {
    adaylar = wikiIndeks.get(bellekEkiniAt(normal, spec.vram_gb)) ?? [];
    yontem = "bellek eki dusuruldu";
  }
  if (adaylar.length === 0) {
    adaylar = kademeOnekiIleBul(normal, wikiIndeks);
    yontem = "kademe oneki";
  }
  if (adaylar.length === 0) {
    adaylar = kademeOnekiIleBul(bellekEkiniAt(normal, spec.vram_gb), wikiIndeks);
    yontem = "bellek eki dusuruldu + kademe oneki";
  }
  if (adaylar.length === 0) { eslesmeyen.push(spec.part_id); continue; }

  // Aynı adlı birden fazla satır varsa önce bellek boyutuyla ayrıştırılıyor:
  // "RTX 3080" wiki'de 10 GB ve 12 GB olarak iki satır, katalogda iki parça.
  if (adaylar.length > 1) {
    const boyutla = adaylar.filter((a) => a.degerler.memory_size_gb === spec.vram_gb);
    if (boyutla.length >= 1 && boyutla.length < adaylar.length) {
      adaylar = boyutla;
      yontem = `${yontem} + bellek boyutu`;
    }
  }
  eslesmeler.push({ partId: spec.part_id, adaylar, yontem });
}

console.log(`Katalogdaki GPU cipi        : ${gpuSpecler.length}`);
console.log(`Wikipedia'dan okunan satir  : ${tumSatirlar.length}`);
console.log(`Eslesen cip                 : ${eslesmeler.length}`);
console.log(`Eslesmeyen cip              : ${eslesmeyen.length}`);
if (eslesmeyen.length > 0) {
  console.log(`Eslesmeyenler: ${eslesmeyen.slice(0, AYRINTI ? eslesmeyen.length : 12).join(", ")}` +
    (!AYRINTI && eslesmeyen.length > 12 ? ` … (+${eslesmeyen.length - 12})` : ""));
  // Eşleşmeyenin YAKININDAKİ wiki adları: eşleşmemenin sebebi ad biçimi mi,
  // yoksa kaynakta gerçekten yok mu — bunu ayırt etmenin tek yolu.
  console.log("\n  Eslesmeyenin kaynaktaki en yakin adlari (adlandirma farki mi, yoklugu mu?):");
  for (const id of eslesmeyen) {
    const spec = specHarita.get(id)!;
    const normal = normalizeModel(spec.part.model);
    const sayi = normal.match(/\d{3,4}/)?.[0];
    const yakin = sayi ? [...wikiIndeks.keys()].filter((k) => k.includes(sayi)).slice(0, 5) : [];
    console.log(`  ${id.padEnd(24)} "${normal}" -> ${yakin.length > 0 ? yakin.join(", ") : "kaynakta bu numarayla ad yok"}`);
  }
}

// --- Alan kapsamı ----------------------------------------------------------

console.log();
cizgi();
console.log("ALAN KAPSAMI — dis kaynak ne kazandiriyor?");
cizgi();
console.log("  alan                     bugun dolu   wiki'de var   YENI DOLACAK   celisme");

const kazanim = new Map<Alan, { bugun: number; wiki: number; yeni: number; celisme: number }>();
const farklar: (Discrepancy & { kaynak: string; revizyon: number })[] = [];

for (const alan of SEMADA_VAR) {
  kazanim.set(alan, { bugun: 0, wiki: 0, yeni: 0, celisme: 0 });
}
for (const spec of gpuSpecler) {
  for (const alan of SEMADA_VAR) {
    const k = kazanim.get(alan)!;
    const mevcut = (spec as unknown as Record<string, number | null>)[alan];
    if (mevcut !== null && mevcut !== undefined) k.bugun++;
  }
}
/** Çözülmüş dış değerler: parça + alan -> değer ve o değerin kaynağı. */
const disDegerler = new Map<string, { deger: number; kaynak: WikiSatir }>();

for (const e of eslesmeler) {
  const spec = specHarita.get(e.partId)!;
  for (const alan of SEMADA_VAR) {
    const cozum = alanCoz(e.adaylar, alan);
    if (cozum === null) continue;
    if ("celiskili" in cozum) {
      belirsizAlan.push(
        `${e.partId}.${alan}: ${e.adaylar.length} wiki satiri farkli deger veriyor (${cozum.celiskili.join(" / ")})`,
      );
      continue;
    }
    const k = kazanim.get(alan)!;
    k.wiki++;
    disDegerler.set(`${e.partId}|${alan}`, cozum);
    const mevcut = (spec as unknown as Record<string, number | null>)[alan];
    if (mevcut === null || mevcut === undefined) {
      k.yeni++;
      continue;
    }
    const fark = crossCheck(e.partId, alan, mevcut, cozum.deger);
    if (fark) {
      k.celisme++;
      farklar.push({ ...fark, kaynak: cozum.kaynak.kaynakSayfa, revizyon: cozum.kaynak.revizyon });
    }
  }
}
for (const alan of SEMADA_VAR) {
  const k = kazanim.get(alan)!;
  console.log(
    `  ${alan.padEnd(24)} ${String(k.bugun).padStart(3)}/${gpuSpecler.length}` +
      `      ${String(k.wiki).padStart(3)}` +
      `          ${String(k.yeni).padStart(3)}` +
      `            ${String(k.celisme).padStart(3)}`,
  );
}

// Alan bazında çözülemeyenler — sessizce düşmüyor.
if (belirsizAlan.length > 0) {
  console.log(`\n  ALAN BAZINDA BELIRSIZ (kullanilmadi): ${belirsizAlan.length}`);
  for (const b of belirsizAlan.slice(0, AYRINTI ? belirsizAlan.length : 10)) console.log(`  ${b}`);
  if (!AYRINTI && belirsizAlan.length > 10) {
    console.log(`  … (+${belirsizAlan.length - 10}) — tamami icin: --ayrinti`);
  }
}

// Şemada karşılığı olmayan alanlar — ölçülüyor ama yazılacak yeri yok.
console.log("\n  SEMADA KARSILIGI OLMAYAN alanlar (yalnizca olculdu):");
for (const alan of ["die_size_mm2", "fillrate_pixel_gps", "fillrate_texture_gts"] as Alan[]) {
  const kac = eslesmeler.filter((e) => {
    const c = alanCoz(e.adaylar, alan);
    return c !== null && !("celiskili" in c);
  }).length;
  console.log(`  ${alan.padEnd(24)} eslesen cipte ${kac} deger var — yazilacak sutun YOK`);
}

// --- Öncelik: NVIDIA'nın yayınlamadığı bant genişlikleri -------------------

console.log();
cizgi();
console.log("ONCELIK — RTX 4060 / 4070 / 4090 bant genisligi (NVIDIA yayinlamiyor)");
cizgi();
const oncelik = ["nvidia-rtx-4060", "nvidia-rtx-4070", "nvidia-rtx-4090"];
for (const id of oncelik) {
  const spec = specHarita.get(id);
  if (!spec) { console.log(`  ${id.padEnd(22)} katalogda YOK`); continue; }
  const cozum = disDegerler.get(`${id}|memory_bandwidth_gbs`);
  const mevcut = spec.memory_bandwidth_gbs;
  console.log(
    `  ${id.padEnd(22)} bugun: ${mevcut === null ? "BOS" : mevcut}` +
      `   wikipedia: ${cozum ? cozum.deger : "-"}` +
      `   ${cozum ? `(${cozum.kaynak.kaynakSayfa} rev ${cozum.kaynak.revizyon})` : "(deger cozulemedi)"}`,
  );
}
const bantDolan = eslesmeler.filter(
  (e) =>
    specHarita.get(e.partId)!.memory_bandwidth_gbs === null &&
    disDegerler.has(`${e.partId}|memory_bandwidth_gbs`),
);
console.log(`\n  Bant genisligi bugun bos olan ${gpuSpecler.filter((s) => s.memory_bandwidth_gbs === null).length} cipten ${bantDolan.length} tanesi dolabilir.`);

// --- Çelişki listesi -------------------------------------------------------

console.log();
cizgi();
console.log(`CELISKI LISTESI — %${DISCREPANCY_THRESHOLD_PCT} ustu fark (UZERINE YAZILMAZ, insana gider)`);
cizgi();
if (farklar.length === 0) {
  console.log("  Yok. Eslesen her alanda uretici ve Wikipedia degerleri %5 icinde.");
} else {
  farklar.sort((a, b) => b.diffPct - a.diffPct);
  console.log("  parca                        alan                     uretici    wikipedia   fark   kaynak");
  for (const f of farklar) {
    console.log(
      `  ${f.partId.padEnd(28)} ${f.field.padEnd(24)} ${String(f.manufacturer).padStart(8)}` +
        ` ${String(f.external).padStart(11)}   %${String(f.diffPct).padEnd(5)} rev ${f.revizyon}`,
    );
  }
}

// --- Bağımsız tutarlılık kontrolü ------------------------------------------
//
// CLAUDE.md'deki çapraz kontrol: bant genişliği = veri yolu × bellek hızı ÷ 8.
// Veri yolu bizde dolu (60/60), yani her bant genişliği değerinden ÖRTÜK
// bellek hızı hesaplanabiliyor. Bu, hangi tarafın doğru olduğunu üçüncü bir
// sayıyla sınamanın yolu: bugünün bellek teknolojileri 1-32 Gbps aralığında;
// bunun dışına düşen bir örtük hız, o bant genişliğinin yanlış olduğunu
// söyler.
//
// Bu kontrol RTX 3080 10GB'da base clock'un boost diye okunduğunu yakalamıştı.

console.log();
cizgi();
console.log("TUTARLILIK KONTROLU — ortuk bellek hizi = bant genisligi x 8 / veri yolu");
cizgi();
const MAKUL_GBPS = { alt: 1, ust: 34 };
console.log(`  Makul aralik: ${MAKUL_GBPS.alt}-${MAKUL_GBPS.ust} Gbps (GDDR5 ... GDDR7)`);
console.log("  parca                        veri yolu   uretici bw -> Gbps   wikipedia bw -> Gbps");
let supheli = 0;
for (const e of eslesmeler) {
  const spec = specHarita.get(e.partId)!;
  const dis = disDegerler.get(`${e.partId}|memory_bandwidth_gbs`);
  if (!spec.bus_width_bits) continue;
  const gbps = (bw: number) => Math.round(((bw * 8) / spec.bus_width_bits!) * 10) / 10;
  const uretici = spec.memory_bandwidth_gbs === null ? null : gbps(spec.memory_bandwidth_gbs);
  const wiki = dis ? gbps(dis.deger) : null;
  const disari = (v: number | null) => v !== null && (v < MAKUL_GBPS.alt || v > MAKUL_GBPS.ust);
  if (!disari(uretici) && !disari(wiki)) continue;
  supheli++;
  console.log(
    `  ${e.partId.padEnd(28)} ${String(spec.bus_width_bits).padStart(4)} bit` +
      `   ${spec.memory_bandwidth_gbs ?? "-"} -> ${uretici ?? "-"}${disari(uretici) ? " (MAKUL DEGIL)" : ""}` +
      `   ${dis ? dis.deger : "-"} -> ${wiki ?? "-"}${disari(wiki) ? " (MAKUL DEGIL)" : ""}`,
  );
}
if (supheli === 0) {
  console.log("  Suphesiz: hem uretici hem Wikipedia degerleri makul bellek hizi veriyor.");
}

// --- Ayrıştırılamayanlar ---------------------------------------------------

console.log();
cizgi();
console.log("AYRISTIRILAMAYAN SATIRLAR — sessizce atlanmadi");
cizgi();
console.log(`  Toplam: ${basarisizlar.length}`);
const sebepGrup = new Map<string, number>();
for (const b of basarisizlar) {
  const anahtar = b.sebep.split(":")[0];
  sebepGrup.set(anahtar, (sebepGrup.get(anahtar) ?? 0) + 1);
}
for (const [sebep, adet] of [...sebepGrup.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(adet).padStart(4)}  ${sebep}`);
}
const gosterilecek = AYRINTI ? basarisizlar : basarisizlar.slice(0, 15);
if (gosterilecek.length > 0) {
  console.log(`\n  ${AYRINTI ? "Tamami" : `Ilk ${gosterilecek.length}`}:`);
  for (const b of gosterilecek) {
    console.log(`  ${b.sayfa.slice(0, 28).padEnd(28)} ${b.bolum.slice(-34).padEnd(34)} ${b.model.slice(0, 24).padEnd(24)} ${b.sebep}`);
  }
  if (!AYRINTI && basarisizlar.length > gosterilecek.length) {
    console.log(`  … (+${basarisizlar.length - gosterilecek.length}) — tamami icin: --ayrinti`);
  }
}

// --- Atıf ------------------------------------------------------------------

console.log();
cizgi();
console.log("ATIF — CC BY-SA (veriyi gosteren HER YERDE gorunmek zorunda)");
cizgi();
for (const s of kaynakSayfalar) {
  console.log(`  "${s.title}", Wikipedia, revizyon ${s.revid}`);
  console.log(`    https://en.wikipedia.org/w/index.php?oldid=${s.revid} — CC BY-SA 4.0`);
}

// --- Yazma yolu ------------------------------------------------------------

console.log();
cizgi();
console.log("YAZMA YOLU — henuz YOK, ve sebebi bir karar bekliyor");
cizgi();
console.log("  Uzlastirma kurali islemeye hazir: uretici degeri varsa dis deger");
console.log(`  UZERINE YAZMAZ, %${DISCREPANCY_THRESHOLD_PCT} ustu fark yukaridaki listeye duser.`);
console.log("  Cozulmemis olan sey NEREYE yazilacagi:");
console.log("    - gpu_specs satirinin provenance'i SATIR BASINA (source, source_url,");
console.log("      confidence). Tek bir alani Wikipedia'dan doldurmak, satirin");
console.log("      'manufacturer' damgasini yalan yapar.");
console.log("    - Capraz kontrol degerlerinin (celismeyenler dahil) duracagi bir");
console.log("      tablo yok.");
console.log("  Ikisi de SCHEMA.md degisikligi; karar proje sahibinin (SORULAR.md S48).");
console.log("\nHICBIR SEY YAZILMADI.");

await prisma.$disconnect();
