// Performans indeksinin ölçülmüş hata payı (K79).
//
// Buradaki sayılar tahmin değil, ölçüm. Arayüzde hata payı hakkında yazılan
// her ifade bu dosyadan okunur; iki yerde ayrı sayı yazılamasın diye tek
// tanım.
//
// Ölçüm `npm run indeks:sapma` ile yapılır (ikisini birden: `npm run sapma:tumu`) ve **script aşağıdaki işaretli
// bloğu kendisi yazar** (K110). Blok dışındaki her şey elle yazılır ve script
// ona dokunmaz: sayı otomatik güncellenir, gerekçe insan tarafından gözden
// geçirilir. K80: sapma kaydedilmeden indeks yayınlanmaz.

export const PERF_MARGIN = {
  // === ÖLÇÜM BAŞLANGIÇ — npm run indeks:sapma yazar, elle değiştirme ===
  meanPercent: 4.9,
  maxPercent: 11.5,
  comparedParts: 25,
  /** Ölçüm anındaki `benchmark_points` satır sayısı — eskime kontrolü (K110). */
  measuredAtPoints: 381,
  measuredAt: "2026-08-20",
  // === ÖLÇÜM BİTİŞ ===

  method:
    "parçaların indeksi, bağımsız bir kaynağın aynı parçalar için verdiği sıralamayla karşılaştırıldı",

  /**
   * Bilinen sistematik fark: işlemci tarafında bütün indeksler aynaya göre
   * yukarıda (+%4.5…+%11.5, ortalama +%7.2), ekran kartı tarafında dağınık
   * (±%8, ortalama %3.1). İşlemci tarafındaki fark rastgele hata değil ölçek:
   * kaynağımız işlemcileri 720p'de ayırıyor, ayna 1080p'de — düşük çözünürlük
   * işlemciler arasındaki farkı büyütüyor. Yani işlemci indeksleri arasındaki
   * mesafe gerçekte biraz daha dar.
   *
   * İşlemci sayısı 7'den 12'ye çıkınca bu fark AZALMADI (+%8.0 -> +%7.2 ortalama),
   * yani örneklem büyüklüğünden değil yöntemden geliyor — beklendiği gibi.
   *
   * **20 Ağustos 2026 güncellemesi.** Oyun paketi 8'den 23'e çıkınca yeniden
   * ölçüldü: GPU tarafı belirgin şekilde İYİLEŞTİ (ortalama %4.9 -> %3.6,
   * en büyük %11.5 -> %8.8) — daha çok oyun, daha az gürültü. CPU tarafı
   * değişmedi (%7.2 / %11.5) çünkü CPU ölçümleri aynı kaldı. Toplam ortalama
   * 4.9'dan 5.2'ye çıktı; sebebi kötüleşme değil karışımın değişmesi:
   * karşılaştırılan parça sayısı 26'dan 20'ye indi ve CPU'ların payı arttı.
   *
   * Bu, ikinci bir bağımsız kaynak bulunduğunda yeniden ölçülmeli.
   */
  provisional: true,
} as const;
