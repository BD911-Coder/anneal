// Wikidata + Wikipedia'dan spec toplama — ALTYAPI, henüz içe aktarma yok.
//
// Çalıştırma:
//   npm run wikidata:deneme        NVIDIA masaüstü GPU'ları için kuru çalışma
//
// **HİÇBİR ŞEY YAZMAZ.** Ne veritabanına, ne CSV'ye. Bu script bugün tek bir
// soruyu cevaplıyor: *"bu kaynaklarda ne var ve katalogla ne kadarı
// eşleşiyor?"* Yazma yolu (`--apply`) bilinçli olarak YOK — eklenmeden önce
// uzlaştırma kurallarının gerçek veriyle sınanması gerekiyor.
//
// ---------------------------------------------------------------------------
// LİSANS — iki kaynak, iki farklı yükümlülük
// ---------------------------------------------------------------------------
//
// **Wikidata: CC0.** Atıf yükümlülüğü yok. Yine de `source_url` yazılır çünkü
// bu projede her olgusal iddia kaynağını taşır (SCHEMA.md bölüm 1.3) — bu bir
// lisans gereği değil, kendi kuralımız.
//
// **Wikipedia: CC BY-SA.** Atıf ZORUNLU ve bu teknik bir ayrıntı değil:
// veriyi gösteren her yerde kaynak makale ve **revizyon numarası** görünmek
// zorunda. Bu yüzden satır başına `source_article` ve `source_revision_id`
// tutuluyor; revizyon olmadan "hangi hâline atıf veriyoruz" sorusu
// cevapsız kalır.
//
// Bu ikisi aynı tabloda karışamaz: hangi satırın hangi lisansla geldiği
// satırın kendisinde durmalı. `provenance.license` alanı bunu taşıyor.
//
// ---------------------------------------------------------------------------
// UZLAŞTIRMA — üretici verisi ASLA ezilmez
// ---------------------------------------------------------------------------
//
// Eşleşme normalize edilmiş model adıyla yapılıyor. Bir alan üreticiden
// gelmişse dış değer onun ÜSTÜNE YAZILMAZ; çapraz kontrol olarak kaydedilir.
// %5'ten büyük fark "incelenecek" diye işaretlenir ve insana gider.
//
// Gerekçe: üretici sayfası birincil kaynak. Dış kaynak onu doğrulayabilir ya
// da şüphe düşürebilir, ama sessizce değiştiremez.

import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../lib/generated/prisma/client.ts";

for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) loadEnvFile(file);
}

// ---------------------------------------------------------------------------
// Ağ nezaketi
// ---------------------------------------------------------------------------

/**
 * Wikimedia açık bir `User-Agent` istiyor: kim, ne için, nasıl ulaşılır.
 * Genel bir tarayıcı dizesi kullanmak hem kurallara aykırı hem de sorun
 * çıktığında bizi bulunamaz yapar.
 */
const USER_AGENT =
  "AnnealBot/0.1 (PC build & performance estimator; https://github.com/BD911-Coder/anneal; contact via repository issues)";

/** İstekler arası bekleme. Wikimedia için ölçülü bir hız. */
const RATE_LIMIT_MS = 1200;

const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getJson(url: string, accept = "application/sparql-results+json"): Promise<unknown> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: accept },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
  await bekle(RATE_LIMIT_MS);
  return res.json();
}

// ---------------------------------------------------------------------------
// Wikidata
// ---------------------------------------------------------------------------

const SPARQL_ENDPOINT = "https://query.wikidata.org/sparql";

/**
 * NVIDIA masaüstü GPU'ları.
 *
 * `wdt:P31/wdt:P279*` — "örneği" ve alt sınıf zinciri: Wikidata'da GPU'lar tek
 * bir sınıfa bağlı değil, "graphics processing unit" altında dallanıyor.
 *
 * OPTIONAL kullanılıyor çünkü aranan alanların çoğu Wikidata'da SEYREK.
 * Zorunlu yapılsaydı sorgu az sayıda kayıt döndürür ve doluluk oranı
 * ölçülemezdi — ölçmek istediğimiz şey tam olarak o.
 */
const NVIDIA_GPU_SPARQL = `
SELECT ?item ?itemLabel ?transistors ?process ?tdp ?memBandwidth ?busWidth ?released
WHERE {
  # Sinif kimlikleri OLCULEREK bulundu, tahmin edilmedi: RTX 4090'in
  # (Q114062761) P31 degeri Q183484 DEGIL, Q122760264 ("graphics card model").
  # Uretici filtresiyle donen 138 varligin sinif dagilimina bakildi.
  VALUES ?cls { wd:Q122760264 wd:Q122760330 wd:Q133176289 wd:Q183484 }
  ?item wdt:P31/wdt:P279* ?cls .
  ?item wdt:P176 wd:Q182477 .                 # manufacturer: Nvidia
  OPTIONAL { ?item wdt:P1141 ?transistors }   # number of transistors
  OPTIONAL { ?item wdt:P2179 ?process }       # fabrication method / node
  OPTIONAL { ?item wdt:P2791 ?tdp }           # power consumed
  OPTIONAL { ?item wdt:P2874 ?memBandwidth }  # memory bandwidth
  OPTIONAL { ?item wdt:P2803 ?busWidth }      # bus width
  OPTIONAL { ?item wdt:P577 ?released }       # publication date
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
}
LIMIT 400
`;

type SparqlBinding = Record<string, { value: string } | undefined>;

async function wikidataNvidiaGpus(): Promise<SparqlBinding[]> {
  const url = `${SPARQL_ENDPOINT}?query=${encodeURIComponent(NVIDIA_GPU_SPARQL)}&format=json`;
  const data = (await getJson(url)) as { results?: { bindings?: SparqlBinding[] } };
  return data.results?.bindings ?? [];
}

// ---------------------------------------------------------------------------
// Wikipedia — MediaWiki API, HTML kazıma DEĞİL
// ---------------------------------------------------------------------------
//
// Kazıma yerine API: sayfa düzeni değiştiğinde kazıyıcı sessizce yanlış
// veri üretir, API sürümlü ve revizyon numarası veriyor. CC BY-SA atıfı da
// zaten revizyon numarası istiyor.

const MEDIAWIKI_API = "https://en.wikipedia.org/w/api.php";

export const WIKIPEDIA_ARTICLES = [
  "List_of_Nvidia_graphics_processing_units",
  "List_of_AMD_graphics_processing_units",
  "List_of_Intel_graphics_processing_units",
] as const;

/** Makalenin güncel revizyon numarası ve wikitext'i — atıf için ikisi de gerekli. */
async function wikipediaRevision(
  title: string,
): Promise<{ revid: number; timestamp: string; bytes: number } | null> {
  const url =
    `${MEDIAWIKI_API}?action=query&prop=revisions&rvprop=ids|timestamp|size` +
    `&format=json&formatversion=2&titles=${encodeURIComponent(title)}`;
  const data = (await getJson(url, "application/json")) as {
    query?: { pages?: { revisions?: { revid: number; timestamp: string; size: number }[] }[] };
  };
  const rev = data.query?.pages?.[0]?.revisions?.[0];
  return rev ? { revid: rev.revid, timestamp: rev.timestamp, bytes: rev.size } : null;
}

// ---------------------------------------------------------------------------
// Uzlaştırma
// ---------------------------------------------------------------------------

/**
 * Model adını eşleştirme için normalize eder.
 *
 * "GeForce RTX 4070 Ti SUPER" -> "rtx4070tisuper"
 *
 * Marka önekleri düşüyor çünkü katalogdaki `model` alanı onları taşıyor ama
 * Wikidata etiketi taşımayabiliyor. Kalan dizede yalnızca harf ve rakam var:
 * boşluk, tire ve büyük/küçük harf farkı eşleşmeyi bozmamalı.
 */
export function normalizeModel(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(nvidia|geforce|amd|radeon|intel|arc)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}

export type Discrepancy = {
  partId: string;
  field: string;
  manufacturer: number;
  external: number;
  diffPct: number;
};

/** Fark eşiği: bunun üstü "incelenecek" olarak işaretlenir, ezilmez. */
export const DISCREPANCY_THRESHOLD_PCT = 5;

/**
 * Üreticiden gelen değerle dış değeri karşılaştırır.
 *
 * Dönen `null`: fark eşiğin altında, çapraz kontrol geçti.
 * Dönen kayıt: fark büyük — İNSANA gider, üzerine yazılmaz.
 */
export function crossCheck(
  partId: string,
  field: string,
  manufacturer: number | null,
  external: number | null,
): Discrepancy | null {
  if (manufacturer === null || external === null || manufacturer === 0) return null;
  const diffPct = (Math.abs(external - manufacturer) / manufacturer) * 100;
  if (diffPct <= DISCREPANCY_THRESHOLD_PCT) return null;
  return {
    partId,
    field,
    manufacturer,
    external,
    diffPct: Math.round(diffPct * 10) / 10,
  };
}

// ---------------------------------------------------------------------------
// Kuru çalışma raporu
// ---------------------------------------------------------------------------

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL tanimli degil.");
  process.exit(1);
}
const prisma = new PrismaClient({ adapter: new PrismaPg(connectionString) });

console.log("Wikidata + Wikipedia spec toplama — KURU CALISMA");
console.log("Hicbir sey yazilmadi: ne veritabanina, ne CSV'ye.\n");
console.log(`User-Agent : ${USER_AGENT}`);
console.log(`Hiz siniri : istekler arasi ${RATE_LIMIT_MS} ms\n`);

// --- 1. Wikidata sorgusu ----------------------------------------------------
console.log("=".repeat(72));
console.log("WIKIDATA — NVIDIA masaustu GPU'lari (CC0, atif yukumlulugu yok)");
console.log("=".repeat(72));

let bindings: SparqlBinding[] = [];
try {
  bindings = await wikidataNvidiaGpus();
} catch (err) {
  console.error(`Sorgu basarisiz: ${(err as Error).message}`);
}

console.log(`Donen varlik sayisi: ${bindings.length}\n`);

const ALANLAR = ["transistors", "process", "tdp", "memBandwidth", "busWidth", "released"];
if (bindings.length > 0) {
  console.log("Alan doluluk orani:");
  console.log("  alan            dolu / toplam    yuzde");
  for (const alan of ALANLAR) {
    const dolu = bindings.filter((b) => b[alan]?.value).length;
    const pct = ((dolu / bindings.length) * 100).toFixed(0);
    console.log(`  ${alan.padEnd(15)} ${String(dolu).padStart(4)} / ${bindings.length}      ${pct.padStart(3)}%`);
  }
}

// --- 2. Katalogla eslesme ---------------------------------------------------
const gpuParts = await prisma.part.findMany({
  where: { category: "gpu" },
  select: { id: true, model: true },
});
// Yalnizca cip satirlari: kart (AIB) satirlari uretici modelleri, Wikidata'da
// karsiliklari yok.
const chipIds = new Set((await prisma.gpuSpecs.findMany({ select: { part_id: true } })).map((r) => r.part_id));
const chips = gpuParts.filter((p) => chipIds.has(p.id));
const nvidiaChips = chips.filter((p) => p.id.startsWith("nvidia-"));

const katalogIndeks = new Map(nvidiaChips.map((p) => [normalizeModel(p.model), p]));
let eslesen = 0;
const eslesenOrnek: string[] = [];
for (const b of bindings) {
  const label = b.itemLabel?.value;
  if (!label) continue;
  const hit = katalogIndeks.get(normalizeModel(label));
  if (hit) {
    eslesen += 1;
    if (eslesenOrnek.length < 6) eslesenOrnek.push(`${label} -> ${hit.id}`);
  }
}

console.log("\n" + "=".repeat(72));
console.log("KATALOGLA ESLESME");
console.log("=".repeat(72));
console.log(`Katalogdaki NVIDIA cipi     : ${nvidiaChips.length}`);
console.log(`Wikidata'dan donen varlik   : ${bindings.length}`);
console.log(`Normalize adla eslesen      : ${eslesen}`);
if (eslesenOrnek.length > 0) {
  console.log("Ornek eslesmeler:");
  for (const e of eslesenOrnek) console.log(`  ${e}`);
}

// --- 3. Wikipedia revizyonlari ----------------------------------------------
console.log("\n" + "=".repeat(72));
console.log("WIKIPEDIA — MediaWiki API (CC BY-SA, ATIF ZORUNLU)");
console.log("=".repeat(72));
console.log("Her satir kaynak makaleyi ve REVIZYON numarasini tasiyacak;");
console.log("revizyon olmadan 'hangi haline atif veriyoruz' sorusu cevapsiz kalir.\n");

for (const title of WIKIPEDIA_ARTICLES) {
  try {
    const rev = await wikipediaRevision(title);
    if (rev) {
      console.log(`  ${title}`);
      console.log(`    revizyon ${rev.revid}  ${rev.timestamp}  ${(rev.bytes / 1024).toFixed(0)} KB`);
    } else {
      console.log(`  ${title} — revizyon okunamadi`);
    }
  } catch (err) {
    console.log(`  ${title} — HATA: ${(err as Error).message}`);
  }
}

// --- 4. Wikipedia tablolari NE TASIYOR? ------------------------------------
//
// Wikidata'da spec alanlari bos cikti; asil soru Wikipedia tablolarinda ne
// oldugu. Tam wikitext bir kez cekilip aranan sutun basliklari sayiliyor.
console.log("\n" + "=".repeat(72));
console.log("WIKIPEDIA TABLOLARI — hangi sutunlar var?");
console.log("=".repeat(72));
try {
  const url =
    `${MEDIAWIKI_API}?action=parse&prop=wikitext&format=json&formatversion=2` +
    `&page=${encodeURIComponent(WIKIPEDIA_ARTICLES[0])}`;
  const data = (await getJson(url, "application/json")) as { parse?: { wikitext?: string } };
  const wikitext = data.parse?.wikitext ?? "";
  console.log(`  wikitext ${(wikitext.length / 1024).toFixed(0)} KB okundu\n`);

  const sutunlar: [string, string][] = [
    ["transistor sayisi", "transistors?\\s*\\("],
    ["fabrikasyon sureci", "fab\\s*\\(nm\\)|process\\s*\\(nm\\)|lithograph"],
    ["veri yolu genisligi", "bus\\s*width"],
    ["bant genisligi", "bandwidth"],
    ["TDP / TBP", "\\bTDP\\b|\\bTBP\\b"],
    ["cekirdek yapilandirmasi", "core\\s*config"],
    ["dolgu hizi (fillrate)", "fillrate|fill\\s*rate"],
    ["saat hizi", "core\\s*clock|clock\\s*\\(MHz\\)"],
    ["bellek boyutu", "memory\\s*size|\\bVRAM\\b"],
  ];
  console.log("  sutun                      gecis sayisi");
  for (const [ad, kalip] of sutunlar) {
    const g = wikitext.match(new RegExp(kalip, "gi"))?.length ?? 0;
    console.log(`  ${ad.padEnd(26)} ${String(g).padStart(5)}`);
  }
} catch (err) {
  console.log(`  HATA: ${(err as Error).message}`);
}

console.log("\n" + "=".repeat(72));
console.log("UZLASTIRMA KURALI (henuz uygulanmadi)");
console.log("=".repeat(72));
console.log(`  Uretici degeri varsa DIS DEGER UZERINE YAZMAZ.`);
console.log(`  Fark %${DISCREPANCY_THRESHOLD_PCT} uzerindeyse "incelenecek" isaretlenir, insana gider.`);
console.log(`  Eslesme normalize edilmis model adiyla.`);
console.log("\nYAZMA YOLU YOK: --apply bayragi bilerek eklenmedi.");

await prisma.$disconnect();
