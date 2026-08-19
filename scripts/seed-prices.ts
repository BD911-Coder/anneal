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
export const PRICES_MINOR: Record<string, number> = {
  // İşlemciler
  "amd-ryzen-5-7600": 749900,
  "amd-ryzen-7-7800x3d": 1499900,
  "intel-core-i5-14600k": 1125000,
  "intel-core-i9-15900k": 2499900,

  // Ekran kartları
  "nvidia-rtx-5060": 1399900,
  "nvidia-rtx-5070": 2450000,
  "nvidia-rtx-5090": 9499900,
  "amd-rx-9070-xt": 3275000,

  // Ekran kartı varyantları (AIB kartları) — çipin fiyatı değil kartın fiyatı
  "asus-rog-strix-rtx-5090-oc": 10999900,
  "zotac-rtx-5090-solid": 9799900,
  "nvidia-rtx-5090-founders": 9499900,

  // Anakartlar
  "asus-tuf-b650-plus": 689900,
  "msi-mag-b650m-mortar": 579900,
  "gigabyte-a620i-ax": 549900,
  "asrock-b760m-ddr4": 389900,
  "asus-rog-z890-extreme": 3299900,

  // Bellekler
  "corsair-vengeance-ddr5-32gb-6000": 329900,
  "gskill-trident-ddr5-64gb-7200": 849900,
  "kingston-fury-ddr4-32gb-3600": 249900,
  "corsair-dominator-ddr5-128gb-5600": 1799900,

  // Güç kaynakları
  "msi-mag-a550bn": 189900,
  "seasonic-focus-gx-650": 345000,
  "corsair-rm850e": 499900,
  "corsair-hx1200": 975000,

  // Kasalar
  "fractal-design-north": 489900,
  "lian-li-lancool-216": 379900,
  "cooler-master-nr200p": 399900,
  "phanteks-g360a": 289900,

  // Depolama
  "samsung-990-pro-1tb": 319900,
  "samsung-990-pro-2tb": 569900,
  "crucial-mx500-1tb": 189900,
  "seagate-barracuda-2tb": 149900,
};

/**
 * Fiyat geçmişi: parça başına üç tarih.
 *
 * Tek satır yazılsaydı "güncel fiyat = en son collected_at'li satır" tanımı
 * doğrulanamazdı — yanlış satırı seçen bir hata görünmez kalırdı.
 *
 * Tarihler sabit, çalışma anı değil: `price_snapshots` append-only olduğu için
 * her seed çalıştırmasında yeni satır üretmek geri alınamaz bir birikim olurdu.
 * `factor`, eski tarihlerdeki fiyatı üretir (fiyatlar zamanla artmış).
 */
export const PRICE_DATES = [
  { at: new Date("2026-07-20T12:00:00Z"), factor: 0.94 },
  { at: new Date("2026-08-03T12:00:00Z"), factor: 0.97 },
  { at: new Date("2026-08-17T12:00:00Z"), factor: 1 },
] as const;

// PERF_INDEXES ve PERF_COMPUTED_AT kaldırıldı (K71).
//
// Burada 8 parçanın indeksi elle yazılıydı — ölçüm değil, gözle konmuş bir
// sıralama. perf_index hesaplanmış bir tablo; satırları yalnızca
// benchmark_points verisinden türetilir. Ölçüm toplanana kadar bu tablo boş
// kalır ve arayüz "henüz yeterli veri yok" der.
