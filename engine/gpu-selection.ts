// Çip + (opsiyonel) kart -> motorun tek ekran kartı girdisi.
//
// SCHEMA.md bölüm 2 (`gpu_variant_specs`) ve bölüm 7. Kararlar: K86, K87.
//
// Neden /engine içinde: bu dosya saf bir karardır — hangi sayının kurala
// gireceğini seçer ve yanlış seçerse sonuç sessizce yanlış olur ("sığar" deyip
// sığmayan kart). CLAUDE.md testi tam olarak bu tür yerler için istiyor.
// Veritabanı, ağ, arayüz yok; girdi iki düz nesne, çıktı bir düz nesne.
//
// Motorun geri kalanı çip/kart ayrımını GÖRMEZ: checkCompatibility yine tek bir
// EngineGpu alır. Katalog yapısı motora sızmaz.

import type {
  EngineGpu,
  EngineGpuVariant,
  ResolvedGpu,
  ResolvedPerfIndex,
} from "./types";

/**
 * Kural şu (K87): **yaklaşık ve pay içeren kural eksik veride referansa geri
 * düşer, kesin ve paysız kural atlanır.**
 *
 * - **Güç (C4)** yaklaşıktır ve içinde ×1.3 payı vardır. Kartın TBP'si
 *   yayınlanmamışsa çipin `tdp_watt`'ına düşülür; kuralı atlamak, en yüksek
 *   sonuçlu kontrolü (güç kaynağı yetiyor mu) en sık durumda sessiz bırakırdı.
 * - **Uzunluk (C5)** tam sayı karşılaştırmasıdır, payı yoktur ve AIB kartları
 *   referanstan **uzun** olur. Kart seçiliyken referans ölçüye düşmek 358 mm'lik
 *   karta "sığar" demek olurdu. Bu yüzden kartın uzunluğu boşsa değer boş
 *   bırakılır ve C5 kendini atlar (K52'nin kurduğu davranış).
 *
 * Her iki durumda da nereden okunduğu geri döner; arayüz bunu kullanıcıya söyler.
 */
export function resolveGpuSelection(chip: EngineGpu, variant?: EngineGpuVariant): ResolvedGpu {
  if (!variant) {
    return {
      gpu: chip,
      tdp_origin: "chip_reference",
      // Çipin uzunluğu da bilinmiyor olabilir (K52): 60 satırın 18'inde dolu.
      length_origin: chip.length_mm === undefined ? "unknown" : "chip_reference",
    };
  }

  const tdpFromVariant = variant.tbp_watt !== undefined;
  const lengthFromVariant = variant.length_mm !== undefined;

  return {
    gpu: {
      // Kimlik kartındır: kullanıcı onu seçti, bulgularda onu görmeli.
      id: variant.id,
      tdp_watt: tdpFromVariant ? variant.tbp_watt! : chip.tdp_watt,
      // Dikkat: burada çipin length_mm'ine DÜŞÜLMÜYOR. Bilerek.
      length_mm: variant.length_mm,
    },
    tdp_origin: tdpFromVariant ? "variant" : "chip_reference",
    length_origin: lengthFromVariant ? "variant" : "unknown",
  };
}

/**
 * `perf_index` iki seviyeli okunur (K86): kartın kendi ölçülmüş indeksi varsa o,
 * yoksa çipinki.
 *
 * Bugün hiçbir kartın kendi indeksi yok ve olamaz — indeks yalnızca
 * `benchmark_points`'tan hesaplanır (K71) ve kart bazlı ölçümümüz yok. Fabrika
 * boost farkından indeks türetmek K74'ün reddettiği interpolasyondur. Bu
 * fonksiyon o günü bekliyor; bugün her zaman çipin indeksini döndürüyor.
 *
 * `origin` boş bırakılmıyor çünkü çipten gelen bir sayı kartın ölçümü değildir
 * ve arayüz bunu söylemek zorunda.
 */
export function resolvePerfIndex(
  indexes: Readonly<Record<string, number | undefined>>,
  chipId: string | undefined,
  variantId?: string,
): ResolvedPerfIndex {
  if (variantId !== undefined) {
    const own = indexes[variantId];
    if (own !== undefined) return { value: own, origin: "variant" };
  }

  if (chipId !== undefined) {
    const fromChip = indexes[chipId];
    if (fromChip !== undefined) return { value: fromChip, origin: "chip" };
  }

  return { value: undefined, origin: null };
}
