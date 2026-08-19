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

**Zorunlu alan ölçütü:** Bir alan ancak bir uyumluluk kuralı ya da arayüz
tarafından kullanılıyorsa zorunlu olabilir. Yeni bir zorunlu alan önerirken
**"hangi kural bunu kullanıyor?"** sorusu cevaplanmak zorundadır; cevap yoksa
alan opsiyonel olur. Sebebi: zorunluluk, kaynağın o alanı yayınlamasına
bağımlılık yaratır ve yayınlamayan kaynaktan gelen doğru veriyi dışarıda
bırakır. `npm run sema:kontrol` bunu denetler. Bkz. `docs/KARARLAR.md` K56.

**İndeks istisnası:** Belgelenmiş sorgu yolları üzerindeki indeksler erken
optimizasyon sayılmaz, ancak `SCHEMA.md`'de tanımlı olmak zorundadır.
`SCHEMA.md` bölüm 11'de yazmayan indeks şemaya girmez.

---

## Veri kuralları

`SCHEMA.md` bölüm 0'daki yedi kural bağlayıcıdır. Özellikle:

- Fiyatlar **integer** (kuruş). Float fiyat kabul edilmez.
- `price_snapshots` ve `benchmark_points` **append-only**. UPDATE yazılmaz.
- Her dış veri önce `raw_imports`'a ham haliyle yazılır.
- Parça slug'ları bir kez atanır, **asla değişmez**.
- Motorun ürettiği her sayının yanında `model_version` bulunur.
- URL yapısı `SCHEMA.md` bölüm 9'da sabittir.
- **`perf_index` satırları yalnızca `benchmark_points`'tan hesaplanarak
  üretilir** (K71). Elle, seed ile ya da CSV ile satır yazılmaz. Hesaplanmış
  bir tabloda el yazması sayı olmaz; sayının nereden geldiği sorulamaz hale
  gelir. Bu tabloda `source` sütunu yok (K32), yani sahte satır damgalanamaz
  ve canlıda filtrelenemez — tek koruma satırın hiç yazılmaması. Ölçüm verisi
  toplanana kadar tablo boştur ve arayüz "henüz yeterli veri yok" der; bu bir
  hata değildir.
- **`shader_units` yalnızca aynı mimari içinde kullanılır.** Performans
  ölçekleme modeli bu alanla farklı marka ya da farklı nesil arasında
  karşılaştırma yapamaz. Sayının ne saydığını `shader_unit_type` söyler
  (`cuda_core`, `stream_processor`, `xe_vector_engine`) — iki satırın tipi
  farklıysa karşılaştırma geçersizdir. Bkz. `docs/KARARLAR.md` K57, K58.

### Fiziksel ölçüler

`case_specs` (üç açıklık alanı) ve `psu_specs.length_mm` doğrudan C5 ve W5
kurallarını besler. Yanlış değer, kullanıcıya "sığar" deyip sığmaması demektir.

- **Çıkarım yapılmaz.** Yalnızca üreticinin etiketlediği değer yazılır. Etiketsiz
  bir sayıdan uzunluk çıkarılabilse bile yazılmaz, boş bırakılır (K60).
- **Birden fazla değer varsa en küçüğü yazılır.** Yapılandırmaya göre değişen
  açıklıklarda kullanıcı hangi yapılandırmada olduğunu bilmiyor (K59).
- **Ondalıklı açıklık değerleri aşağı yuvarlanır.** 180.5 mm → 180 (K59).
- **Şüpheli değer sayfaya tekrar sorulur.** Pazarlama metnindeki değil, spec
  tablosundaki değer alınır.
- **Fiziksel ölçü alanları asla zorunlu olmaz** (K62). Üreticiler bu değerleri
  tutarsız yayınlıyor; zorunluluk veriyi dışarıda bırakmaktan başka işe
  yaramıyor. Kural eksik alanda kendini atlar, arayüz kullanıcıya bildirir.
  Bu duvara üç kez çarpıldı: K52, K56, K62.

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

Cevap bekleyen sorular depo kökündeki `SORULAR.md` dosyasında toplanır.
Raporlardaki "Açık kalan sorular" bölümü o günün fotoğrafıdır ve değişmez;
`SORULAR.md` güncel durumu gösterir. Bir soru cevaplandığında maddesi
"Kapanmış sorular" bölümüne taşınır, kalıcı bir karara dönüştüyse ayrıca
`docs/KARARLAR.md`'ye yazılır.

---

## Araç notları

Her oturumda yeniden keşfedilmesin diye yazıldı.

### Üretici sitelerinden sayfa okuma

Üç üretici üç farklı yol gerektiriyor. Sıra: önce `WebFetch`, olmazsa `curl`,
o da olmazsa tarayıcı paneli.

| Site | Çalışan yol | Çalışmayan |
|---|---|---|
| nvidia.com | `WebFetch` | — |
| amd.com | `curl` (tarayıcı `User-Agent` başlığıyla) | `WebFetch` → `ECONNRESET` |
| intel.com | `curl` (**tam tarayıcı başlık seti** gerekli) | `WebFetch` → 403, tek başına `User-Agent` → 403 |

AMD için `User-Agent` yetiyor:

```
-H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36"
```

Intel tek başına `User-Agent`'ı reddediyor (403); şu set 200 döndürüyor:

```
-H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
-H "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
-H "Accept-Language: en-US,en;q=0.9"
-H "sec-ch-ua: \"Chromium\";v=\"126\", \"Not)A;Brand\";v=\"24\""
-H "sec-ch-ua-platform: \"Windows\""
-H "Sec-Fetch-Dest: document" -H "Sec-Fetch-Mode: navigate" -H "Sec-Fetch-Site: none"
--compressed
```

Tarayıcı paneli de çalışır ama sayfa başına iki tool çağrısı gerektirir;
`curl` toplu indirme için çok daha ucuz.

**Sayfa yapıları:**
- AMD: `<dt>etiket</dt><dd>değer</dd>`. Etiketlere tooltip metni karışıyor,
  ilk anahtar kelimeye indirmek gerekiyor.
- Intel ARK: `<div class="tech-label"><span>etiket</span>` +
  `<div class="tech-data"><span>değer</span>`. Tarayıcıda JS bağlamından
  okunamıyor (`get_page_text` gerekir), ama `curl` ham HTML'i veriyor.

**Intel ARK'ta model listesi toplu alınabilir:** seri sayfası
(`/ark/products/series/<id>/...`) o ailedeki bütün SKU adreslerini içeriyor.
Bir SKU sayfasından da kendi seri sayfasının adresi çıkarılabiliyor. Tek tek
aramak yerine bu yol kullanılmalı.

**Adres desenleri tutarsız:** AMD'de `amd-radeon-rx-9070xt.html` (tiresiz) ama
`amd-radeon-rx-7900-gre.html` (tireli); 9000 serisinde pazarlama sayfası ile
spec sayfası ayrı adreslerde. İki varyantı da denemek gerekiyor.

### `/data` içe aktarma yolları — takma ad değil, göreli yol + `.ts`

`/data` altındaki dosyalar birbirini ve üretilen Prisma istemcisini **göreli
yolla ve `.ts` uzantısıyla** içe aktarır:

```ts
import { prisma } from "./client.ts";                       // "./client" DEĞİL
import { PrismaClient } from "../lib/generated/prisma/client.ts";  // "@/lib/..." DEĞİL
```

**Sebebi:** `@/` takma adını yalnızca Next'in derleyicisi çözüyor; çıplak Node
çözemiyor. Uzantısız göreli yolu da Node ESM çözemiyor. İkisi birleşince
`/data` katmanı hiçbir script'ten içe aktarılamıyordu — yani veri erişim
katmanı yalnızca tarayıcıda çalıştırılarak sınanabiliyordu.

Bunun somut bedeli: dev-seed filtresinin canlıda çalıştığını ölçmek için
sorguyu script içinde **kopyalamak** gerekiyordu, ki o zaman sınanan şey asıl
kod olmuyordu. `npm run seed:filtre-kontrol` bu yüzden var ve bu yüzden
gerçek `getCurrentPrices`'ı çağırabiliyor.

`allowImportingTsExtensions` tsconfig'te zaten açık (`scripts/*.mts` için
gerekiyordu). Next derlemesi `.ts` uzantılı içe aktarmayı sorunsuz çözüyor;
`npm run build` ile doğrulandı.

**Yeni dosya eklerken:** `/data` içinde bu deseni sürdür. `/app` içinden
`@/data/...` kullanmak sorun değil — orayı Next derliyor.

### Prisma

`prisma migrate dev` istemciyi **her zaman yenilemiyor**. Migration'dan sonra
`npx prisma generate` elle çalıştırılmalı; yenilenmemiş istemci yeni sütunu
tanımaz ve içe aktarma yarım kayıt bırakabilir. Bu iki kez yaşandı.

### Spec verisinde çapraz kontrol

Bir sayının doğru sütundan okunduğunu bağımsız olarak doğrulamanın yolu:

```
bant genişliği (GB/s) = bellek arayüzü (bit) × bellek hızı (Gbps) ÷ 8
```

Bu kontrol RTX 3080 10GB'da base clock'un boost diye okunduğunu yakaladı.
Yeni bir üreticiden veri alınırken uygulanmalı.

---

## Beta bitiş ölçütü

10 kişi siteye girip yardım almadan bir sistem toplayabildi.

Sıfır bug hedefi yoktur.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
