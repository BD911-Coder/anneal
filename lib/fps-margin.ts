// Oyun bazlı FPS tahmininin ölçülmüş hata payı — Faz A.1.
//
// Buradaki sayılar tahmin değil, ölçüm. Arayüzde hata payı hakkında yazılan
// her ifade bu dosyadan okunur; iki yerde ayrı sayı yazılamasın diye tek
// tanım. `lib/perf-margin.ts` ile aynı desen.
//
// Ölçüm 20 Ağustos 2026'da tek seferlik yapıldı. A.3 bunu kalıcı bir script'e
// çevirecek ve her veri turunda yeniden çalıştıracak; o zamana kadar sayı
// elle işlenir ve yöntemi yanında durur.

export const FPS_MARGIN = {
  /** Ortalama mutlak hata. */
  meanPercent: 6.1,
  /** Tahminlerin %90'ı bu hatanın altında. */
  p90Percent: 12.8,
  /** En kötü tek nokta. Gizlenmiyor: %90 dilimin dışı da gerçek. */
  maxPercent: 27.8,
  /** Tahminlerin yüzde kaçı ±%10 içinde kaldı. */
  within10Percent: 83,
  /** Ölçümde kullanılan nokta sayısı. */
  points: 64,
  measuredAt: "2026-08-20",
  method:
    "birini-dışarıda-bırak: 64 ölçümün her biri, kendi verisi hesaba katılmadan aynı oyunun diğer ölçümlerinden tahmin edildi",

  /**
   * İlk hesap örneklem içindeydi (%6.6 dağılım) ve iyimserdi. Birini-dışarıda-
   * bırak yöntemine geçildi çünkü tahmin edilen noktanın kendisi orana
   * katılıyorsa ölçülen şey modelin doğruluğu değil, kendi verisini
   * ezberlemesi olur.
   *
   * Sınır: 64 nokta tek kaynaktan (ComputerBase) ve tek ayardan (1440p ultra,
   * DLSS/FSR Quality) geliyor. İkinci bir kaynak ya da ikinci bir ayar
   * geldiğinde bu sayı yeniden ölçülmeli — bugünkü hali o çeşitliliği
   * görmemiş bir ölçümdür.
   */
  provisional: true,
} as const;
