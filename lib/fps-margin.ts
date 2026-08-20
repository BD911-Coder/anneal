// Oyun bazlı FPS tahmininin ölçülmüş hata payı — Faz A.1.
//
// Buradaki sayılar tahmin değil, ölçüm. Arayüzde hata payı hakkında yazılan
// her ifade bu dosyadan okunur; iki yerde ayrı sayı yazılamasın diye tek
// tanım. `lib/perf-margin.ts` ile aynı desen.
//
// Ölçüm `npm run fps:sapma` ile yapılır (ikisini birden: `npm run sapma:tumu`) ve **script aşağıdaki işaretli bloğu
// kendisi yazar** (K110). Blok dışındaki her şey elle yazılır ve script ona
// dokunmaz: sayı otomatik güncellenir, gerekçe insan tarafından gözden
// geçirilir.

export const FPS_MARGIN = {
  // === ÖLÇÜM BAŞLANGIÇ — npm run fps:sapma yazar, elle değiştirme ===
  /** Ortalama mutlak hata. */
  meanPercent: 6.8,
  /** Tahminlerin %90'ı bu hatanın altında. */
  p90Percent: 15.6,
  /** En kötü tek nokta. Gizlenmiyor: %90 dilimin dışı da gerçek. */
  maxPercent: 33.4,
  /** Tahminlerin yüzde kaçı ±%10 içinde kaldı. */
  within10Percent: 78,
  /** Ölçümde kullanılan nokta sayısı (türetilebilir hücreler). */
  points: 250,
  /** Ölçüm anındaki `benchmark_points` satır sayısı — eskime kontrolü (K110). */
  measuredAtPoints: 381,
  measuredAt: "2026-08-20",
  // === ÖLÇÜM BİTİŞ ===

  method:
    "birini-dışarıda-bırak: her ölçüm, kendi verisi hesaba katılmadan aynı oyunun diğer ölçümlerinden tahmin edildi",

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
