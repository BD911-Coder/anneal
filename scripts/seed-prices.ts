// Sahte fiyat ve performans indeksi verisi — scripts/seed.mts tarafından kullanılır.
//
// Ayrı dosyada durmasının sebebi: seed.mts zaten 29 parçanın teknik özelliğini
// taşıyor; fiyat tablosu da eklenince tek dosyada iki ayrı veri kümesi olurdu.
//
// Buradaki bütün sayılar uydurmadır (confidence 'low'). Gerçek fiyat girişi
// CSV içe aktarmayla gelecek.

/**
 * Parça id'si -> güncel fiyat, **kuruş** cinsinden integer.
 * `749900` = 1.499,00 değil, 7.499,00 TL (SCHEMA.md bölüm 0, kural 4).
 */
// PRICES_MINOR ve PRICE_DATES kaldırıldı (K115).
//
// Seed artık fiyat yazmıyor. Gerçek fiyatlar data/prices/*.csv'den geliyor;
// elle yazılmış TRY sayıları USD gerçek fiyatlarla aynı tabloda durunca
// toplamı bozuyordu.

// PERF_INDEXES ve PERF_COMPUTED_AT kaldırıldı (K71).
//
// Burada 8 parçanın indeksi elle yazılıydı — ölçüm değil, gözle konmuş bir
// sıralama. perf_index hesaplanmış bir tablo; satırları yalnızca
// benchmark_points verisinden türetilir. Ölçüm toplanana kadar bu tablo boş
// kalır ve arayüz "henüz yeterli veri yok" der.
