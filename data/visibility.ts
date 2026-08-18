// dev-seed korumasının 2. katmanı — tek tanım.
//
// Canlı ortamda `source = 'dev-seed'` satırları OTOMATİK filtrelenir. Bu filtre
// çağıran kodun tercihine bırakılmaz. Kendi dosyasında durmasının sebebi:
// /data altındaki her okuma dosyası (parts, prices, perf) aynı tanımı kullansın,
// filtre iki yerde ayrışmasın.

export const IS_LIVE = process.env.NODE_ENV === "production";

/**
 * `parts` tablosu üzerindeki filtre.
 *
 * Geliştirmede dev-seed görünür, yoksa üzerinde çalışacak veri kalmaz.
 */
export function visibleParts() {
  return IS_LIVE
    ? { is_active: true, source: { not: "dev_seed" as const } }
    : { is_active: true };
}

/**
 * Kendi `source` sütununu taşıyan tablolar için filtre (örn. price_snapshots).
 *
 * Parçanın kendisi gerçek olup fiyatının sahte olması mümkün; bu yüzden satırın
 * kendi damgasına da bakılır, parçanınkine güvenilmez.
 */
export function visibleRows() {
  return IS_LIVE ? { source: { not: "dev_seed" as const } } : {};
}
