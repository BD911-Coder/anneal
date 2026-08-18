// Yükseltme önerisi — SCHEMA.md bölüm 8.
//
// Saf fonksiyon: girdi alır, çıktı verir. Veritabanı, ağ, dosya sistemi ve
// React erişimi yoktur ve olmamalıdır. Aday parçaları çağıran taraf verir;
// motor katalogdan haberdar değildir.
//
// Soru şu: "elimde şu kadar fazla param var, hangi parçayı değiştirirsem
// sistem indeksim en çok artar?"

import { computePerformance, round1 } from "./performance";
import type {
  UpgradeCategory,
  UpgradeInput,
  UpgradePart,
  UpgradeSuggestion,
} from "./types";

/**
 * Taranan kategoriler.
 *
 * Sadece ikisi var çünkü sistem indeksi formülü (bölüm 8) yalnızca bu ikisini
 * kullanıyor. Belleği ya da kasayı yükseltmek indeksi değiştirmez; taransalardı
 * hepsi 0 artışla elenirdi, yani tarama boşuna olurdu. Motor v0.1 için doğru
 * olan bu; formül genişlerse liste de genişler (docs/KARARLAR.md K40).
 */
export const UPGRADE_CATEGORIES: UpgradeCategory[] = ["gpu", "cpu"];

/**
 * Bir adayın öneri olabilmesi için gereken şartlar.
 *
 * Ayrı fonksiyon olmasının sebebi: "neden bu parça önerilmedi" sorusunun
 * cevabı tek yerde dursun.
 */
function isEligible(
  candidate: UpgradePart,
  currentPart: UpgradePart,
  budgetDeltaMinor: number,
): boolean {
  if (candidate.id === currentPart.id) return false;
  // İndeksi olmayan parça için "ne kadar hızlanır" sorusu cevaplanamaz;
  // tahmin edilmez, aday sayılmaz.
  if (candidate.perf_index === undefined || candidate.perf_index === null) return false;
  return candidate.price_minor - currentPart.price_minor <= budgetDeltaMinor;
}

/**
 * Bütçe farkına sığan en iyi yükseltmeler — kategori başına en fazla bir tane,
 * indeks artışına göre büyükten küçüğe sıralı. İlk eleman "en iyi öneri"dir.
 *
 * Boş dizi dönebilir: bütçe yetmiyorsa, mevcut parçalar zaten en iyisiyse veya
 * hesap için gereken indeksler eksikse. Bu durumda öneri **uydurulmaz**.
 */
export function suggestUpgrades(input: UpgradeInput): UpgradeSuggestion[] {
  const { resolution, current, budget_delta_minor, candidates } = input;

  // Sistem indeksi hem ekran kartını hem işlemciyi ister. Biri eksikse
  // "şu kadar artar" cümlesi kurulamaz.
  const before = computePerformance({
    resolution,
    gpu_index: current.gpu?.perf_index,
    cpu_index: current.cpu?.perf_index,
  });
  if (!before.ok) return [];

  const suggestions: UpgradeSuggestion[] = [];

  for (const category of UPGRADE_CATEGORIES) {
    const currentPart = current[category];
    // Mevcut parçanın fiyatı bilinmiyorsa "kaç TL fark" hesaplanamaz.
    if (!currentPart || currentPart.price_minor === undefined) continue;

    let best: UpgradeSuggestion | null = null;

    for (const candidate of candidates[category] ?? []) {
      if (!isEligible(candidate, currentPart, budget_delta_minor)) continue;

      const after = computePerformance({
        resolution,
        // Sadece taranan kategori değişir, diğeri mevcut sistemden gelir.
        gpu_index: category === "gpu" ? candidate.perf_index : before.gpu_index,
        cpu_index: category === "cpu" ? candidate.perf_index : before.cpu_index,
      });
      if (!after.ok) continue;

      // İki sayı da zaten yuvarlanmış; farkı tekrar yuvarlamak float artığını
      // (6.199999999999999 gibi) çıktıdan uzak tutuyor.
      const indexDelta = round1(after.system_index - before.system_index);
      if (indexDelta <= 0) continue; // yükseltme değilse öneri de değil

      const suggestion: UpgradeSuggestion = {
        category,
        current_part_id: currentPart.id,
        suggested_part_id: candidate.id,
        price_delta_minor: candidate.price_minor - currentPart.price_minor,
        index_before: before.system_index,
        index_after: after.system_index,
        index_delta: indexDelta,
      };

      // Aynı indeks artışını iki parça veriyorsa ucuz olan kazanır — sonuç
      // aday sırasına göre değişmesin diye kural açıkça yazıldı.
      const better =
        !best ||
        suggestion.index_delta > best.index_delta ||
        (suggestion.index_delta === best.index_delta &&
          suggestion.price_delta_minor < best.price_delta_minor);

      if (better) best = suggestion;
    }

    if (best) suggestions.push(best);
  }

  return suggestions.sort(
    (a, b) => b.index_delta - a.index_delta || a.price_delta_minor - b.price_delta_minor,
  );
}
