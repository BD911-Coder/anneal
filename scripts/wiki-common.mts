// Wikimedia kaynaklarında ortak olan şeyler — TEK YER.
//
// İki script bunu kullanıyor: `import-wikidata-specs.mts` (kuru çalışma, K165)
// ve `import-wikipedia-specs.mts` (wikitext ayrıştırıcı, K168).
//
// Ayrı dosya olmasının sebebi: script'ler doğrudan çalışan dosyalar, yani
// birinden diğerine `import` etmek diğerinin BÜTÜN raporunu çalıştırır.
// Ortak olan şey ortak bir yere konur.

/**
 * Wikimedia açık bir `User-Agent` istiyor: kim, ne için, nasıl ulaşılır.
 * Genel bir tarayıcı dizesi kullanmak hem kurallara aykırı hem de sorun
 * çıktığında bizi bulunamaz yapar.
 */
export const USER_AGENT =
  "AnnealBot/0.1 (PC build & performance estimator; https://github.com/BD911-Coder/anneal; contact via repository issues)";

/** İstekler arası bekleme. Wikimedia için ölçülü bir hız. */
export const RATE_LIMIT_MS = 1200;

export const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Hız sınırlı JSON isteği. Bekleme İSTEKTEN SONRA: son istekten sonra da bekler. */
export async function getJson(url: string, accept = "application/json"): Promise<unknown> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: accept },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
  const data = await res.json();
  await bekle(RATE_LIMIT_MS);
  return data;
}

export const MEDIAWIKI_API = "https://en.wikipedia.org/w/api.php";

/** Ayrıştırılacak makaleler. Üçü de "list of ... graphics processing units". */
export const WIKIPEDIA_ARTICLES = [
  "List_of_Nvidia_graphics_processing_units",
  "List_of_AMD_graphics_processing_units",
  "List_of_Intel_graphics_processing_units",
] as const;

/**
 * Model adını eşleştirme için normalize eder.
 *
 * "GeForce RTX 4070 Ti SUPER" -> "rtx4070tisuper"
 *
 * Marka önekleri düşüyor çünkü katalogdaki `model` alanı onları taşıyor ama
 * dış kaynağın etiketi taşımayabiliyor. Kalan dizede yalnızca harf ve rakam
 * var: boşluk, tire ve büyük/küçük harf farkı eşleşmeyi bozmamalı.
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
