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
  meanPercent: 6.6,
  /** Tahminlerin %90'ı bu hatanın altında. */
  p90Percent: 13.7,
  /** En kötü tek nokta. Gizlenmiyor: %90 dilimin dışı da gerçek. */
  maxPercent: 35.3,
  /** Tahminlerin yüzde kaçı ±%10 içinde kaldı. */
  within10Percent: 79,
  /** Ölçümde kullanılan nokta sayısı. */
  points: 184,
  measuredAt: "2026-08-20",
  method:
    "birini-dışarıda-bırak: 184 ölçümün her biri, kendi verisi hesaba katılmadan aynı oyunun diğer ölçümlerinden tahmin edildi",

  /**
   * İlk hesap örneklem içindeydi (%6.6 dağılım) ve iyimserdi. Birini-dışarıda-
   * bırak yöntemine geçildi çünkü tahmin edilen noktanın kendisi orana
   * katılıyorsa ölçülen şey modelin doğruluğu değil, kendi verisini
   * ezberlemesi olur.
   *
   * **20 Ağustos 2026 güncellemesi.** Oyun paketi 8'den 23'e çıkınca yeniden
   * ölçüldü ve sayı KÖTÜLEŞTİ: ortalama %6.1 -> %6.6, %90 dilim %12.8 -> %13.7,
   * en kötü %27.8 -> %35.3. Bu bir gerileme değil, örneklemin genişlemesi:
   * yeni 15 oyun arasında raytracing zorunlu başlıklar var ve o oyunlarda
   * kartların sırası indeks sırasından belirgin şekilde ayrılıyor. Eski sayı
   * daha iyi görünüyordu çünkü daha dar bir oyun kümesini ölçüyordu.
   *
   * Sınır: 184 nokta hâlâ tek kaynaktan (ComputerBase) ve tek çözünürlükten
   * (1440p) geliyor. İkinci bir kaynak ya da ikinci bir çözünürlük geldiğinde
   * yeniden ölçülmeli.
   */
  provisional: true,
} as const;
