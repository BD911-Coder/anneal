// Performans indeksinin ölçülmüş hata payı (K79).
//
// Buradaki sayılar tahmin değil, ölçüm. Arayüzde hata payı hakkında yazılan
// her ifade bu dosyadan okunur; iki yerde ayrı sayı yazılamasın diye tek
// tanım.
//
// Ölçüm tekrarlandığında YALNIZCA bu dosya değişir. Metni değiştirmeden
// sayıyı güncellemek yasak: `method` ve `measuredAt` sayının hangi koşulda
// çıktığını söylüyor ve sayı onlarsız yanıltıcı.

export const PERF_MARGIN = {
  meanPercent: 7.8,
  maxPercent: 20.3,
  measuredAt: "2026-08-19",
  method:
    "İki bağımsız kaynağın aynı 14 kart için verdiği indeksler karşılaştırıldı",

  /**
   * Bu ölçüm K78'in artık YASAKLADIĞI koşullarda alındı: 2 oyun (asgari 3
   * olmalı), 3 kartlık köprü (asgari 6 olmalı), karışık upscaling rejimi.
   * Yani kötü senaryonun sayısı; gerçek toplama K78'e uyduğunda daha iyi
   * çıkması bekleniyor. Toplama bitince yeniden ölçülüp burası güncellenecek.
   */
  provisional: true,
} as const;
