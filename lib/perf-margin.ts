// Performans indeksinin ölçülmüş hata payı (K79).
//
// Buradaki sayılar tahmin değil, ölçüm. Arayüzde hata payı hakkında yazılan
// her ifade bu dosyadan okunur; iki yerde ayrı sayı yazılamasın diye tek
// tanım.
//
// Ölçüm `npm run indeks:sapma` ile yapılır. Script bu dosyayı KENDİ YAZMAZ:
// sayının yanındaki yöntem ve tarih insan tarafından gözden geçirilsin diye
// elle işlenir. K80: sapma kaydedilmeden indeks yayınlanmaz.

export const PERF_MARGIN = {
  meanPercent: 4.9,
  maxPercent: 11.5,
  measuredAt: "2026-08-19",
  method:
    "26 parçanın indeksi, bağımsız bir kaynağın aynı parçalar için verdiği sıralamayla karşılaştırıldı",

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
   * Bu, ikinci bir bağımsız kaynak bulunduğunda yeniden ölçülmeli.
   */
  provisional: true,
} as const;
