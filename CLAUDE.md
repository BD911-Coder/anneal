# Anneal — Proje Kuralları

Bu dosya her oturumda geçerlidir. Kurallar yeniden müzakere edilmez.

---

## Proje hakkında

PC toplama ve performans tahmin sitesi. Kullanıcı donanım seçer; site uyumluluğu
kontrol eder, toplam fiyatı ve tahmini performansı gösterir, bütçe farkıyla
yükseltme önerir.

**Şu an: Beta.** Kapsam `SCHEMA.md` bölüm 10'da sınırlanmıştır.

Alan modeli `SCHEMA.md` dosyasındadır ve tek kaynaktır. Şemada olmayan bir alan
koda girmez; kodda bir alan gerekiyorsa önce `SCHEMA.md` güncellenir.

---

## Kimle çalışıyorsun

Proje sahibinin teknik bilgisi sınırlıdır ve bu bilinçli bir kısıttır, geçici değil.

- **Basitlik soyutlamadan önce gelir.** Bir dosyaya bakan biri ne yaptığını anlayabilmeli.
- **Her yapı gerekçesiyle açıklanır.** Bir soyutlamayı neden koyduğun açıklanamıyorsa, koyma.
- **Yeni kütüphane eklemeden önce sor.** Gerekçesini bir cümleyle söyle.
- **Küçük adımlarla ilerle.** Bir seferde bir özellik. "Çalışıyor mu?" diye sor, cevabı bekle.
- **"Düzelttim" deme, doğrula.** Çalıştığını gösteren somut çıktı olmadan tamamlandı sayma.
- Türkçe konuş. Kod, değişken ve fonksiyon adları İngilizce.

---

## Karar yetkisi

**Kendi başına karar ver, sadece raporla:**

- Kütüphane sürümleri, yapılandırma, klasör içi düzen
- İsimlendirme, kod organizasyonu, yardımcı fonksiyonlar
- `SCHEMA.md`'nin kendi içindeki açık çelişkiler → daha spesifik olan bölüm
  kazanır, kararı `docs/KARARLAR.md`'ye yaz
- Dil/araç kısıtlarından doğan teknik zorunluluklar

**Dur ve sor:**

- `SCHEMA.md`'ye alan ekleme/çıkarma
- Yeni kütüphane veya servis
- Beta kapsamı dışına çıkmak
- Veri kaybı riski olan işlemler
- Kurallardan birinin esnetilmesi

---

## Mimari

### Uygulanan ilkeler

- **Tek sorumluluk:** Bir dosya bir iş yapar.
- **Açık/kapalı:** Yeni veri kaynağı eklemek = yeni adaptör yazmak. Mevcut kod değişmez.
- **Bağımlılığın tersine çevrilmesi:** `/engine` veritabanını tanımaz.

### Uygulanmayanlar

Bağımlılık enjeksiyon konteynerleri, her sınıf için soyut arayüz, derin kalıtım
hiyerarşileri, mikroservis, GraphQL, Docker/Kubernetes, kendi tasarım sistemi.

Bunlar çok kişilik ekiplerin sorunlarını çözer. Bu proje tek kişilik.

### Klasör yapısı

```
/app          Sayfalar ve arayüz
/engine       Saf hesaplama — DB, ağ, arayüz erişimi YOK
/data         Veri erişim katmanı + kaynak adaptörleri
/lib          Ortak yardımcılar
/scripts      Seed, içe aktarma, yedekleme
/tests        Sadece /engine testleri
```

### `/engine` kuralı

Bu klasördeki hiçbir dosya veritabanı, `fetch`, dosya sistemi veya React içe aktarmaz.
Girdi alır, çıktı verir. Sebebi: test edilebilirlik, mobil uygulamada yeniden
kullanılabilirlik, ve motor sürümleri arasında karşılaştırma yapabilmek.

Bu kural ihlal edilirse söyle, sessizce esnetme.

---

## Kalite

**Kullanılır:**
- TypeScript, `strict` açık. `any` kullanılmaz.
- Test **sadece** `/engine` için: uyumluluk kuralları ve performans hesabı.
  Bu iki yer sessizce yanlış sonuç verebilen tek yerlerdir.
- Anlamlı isimler. Yorum, "ne" yaptığını değil "neden" öyle yaptığını açıklar.

**Kullanılmaz:**
- %100 test kapsamı hedefi
- Arayüz bileşenleri için test
- Erken performans optimizasyonu

---

## Veri kuralları

`SCHEMA.md` bölüm 0'daki yedi kural bağlayıcıdır. Özellikle:

- Fiyatlar **integer** (kuruş). Float fiyat kabul edilmez.
- `price_snapshots` ve `benchmark_points` **append-only**. UPDATE yazılmaz.
- Her dış veri önce `raw_imports`'a ham haliyle yazılır.
- Parça slug'ları bir kez atanır, **asla değişmez**.
- Motorun ürettiği her sayının yanında `model_version` bulunur.
- URL yapısı `SCHEMA.md` bölüm 9'da sabittir.

### dev-seed koruması

Dört katman, hepsi zorunlu:

1. Sahte verinin `source` alanı `dev-seed`'dir.
2. Veri erişim katmanı, canlı ortamda `source = 'dev-seed'` satırlarını **otomatik
   filtreler**. Bu, çağıran kodun tercihine bırakılmaz.
3. Dağıtım öncesi kontrol: canlı veritabanında tek bir `dev-seed` satırı varsa
   dağıtım durur.
4. Seed script'i, canlı veritabanına bağlıysa çalışmayı reddeder.

---

## Git

**Git ve GitHub işlemlerini sen yürütürsün.** Proje sahibinin komut yazması beklenmez.

- `main` her zaman çalışır durumdadır ve otomatik olarak canlıya gider.
- Her özellik için ayrı dal. Çalıştığı doğrulandıktan sonra `main`'e alınır.
- **Commit zamana göre değil duruma göre atılır: çalışan her hal bir commit.**
  Yarım kalmış veya bozuk kod commit edilmez.
- Her oturumun sonunda push. İstisnasız.
- Kilometre taşlarında sürüm etiketi (`beta-0.1`).
- Commit mesajları Türkçe, ne yapıldığını açıkça söyler.

### Sırlar

`.env.local` ve tüm anahtarlar `.gitignore` içindedir ve **asla** commit edilmez.
Depoya sır sızmasını engelleyen bir kontrol kurulur. Bir anahtarın koda gömüldüğünü
görürsen dur ve uyar.

### Yedekleme

Git veritabanını yedeklemez. Haftalık otomatik veritabanı dışa aktarımı kurulur.

### Oturum sonu

Proje sahibi her oturum sonunda üç soru sorar. Cevabı hazır tut:

1. Bugün ne değişti?
2. Commit ve push yapıldı mı?
3. Canlıda çalışıyor mu?

"Dünkü çalışan haline dön" dendiğinde açıklama istemeden geri al, sonra ne olduğunu anlat.

---

## Raporlama

Her iş biriminin sonunda `docs/log/YYYY-AA-GG-konu.md` yazılır ve commit edilir:

- Ne yapıldı
- Hangi kararlar verildi ve neden
- Ne doğrulandı (komut çıktısıyla)
- Açık kalan sorular

**Rapor yazıldıktan sonra dosyanın tam yolu ekranda gösterilir.**

Kalıcı kararlar `docs/KARARLAR.md`'ye tarih ve gerekçeyle eklenir.

---

## Beta bitiş ölçütü

10 kişi siteye girip yardım almadan bir sistem toplayabildi.

Sıfır bug hedefi yoktur.
