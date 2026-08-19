# Anneal — Açık Sorular

Cevap bekleyen kararların güncel listesi. Kök dizinde durmasının sebebi:
proje sahibinin kullandığı okuma yolu `docs/` klasör sayfasına erişemiyor.

**Nasıl işler:**

- Yeni bir soru çıktığında buraya eklenir.
- Cevaplanınca madde **Kapanmış sorular** bölümüne taşınır, cevabı yazılır.
- Kalıcı bir karara dönüşen cevap ayrıca `docs/KARARLAR.md`'ye geçer.

`docs/log/` altındaki raporlar o günün fotoğrafıdır ve değişmez;
bu dosya güncel durumu gösterir.

Son güncelleme: 2026-08-19

---

## Açık sorular

### S25 — Üç kural tek bir parçaya bağlı

`npm run kural:kontrol` 11 kuralın hepsinin tetiklenebildiğini gösteriyor, ama
bazıları çok ince bir ipe bağlı:

| Kural | Tek bağ | Tetikleyen kombinasyon |
|---|---|---|
| W4 | `amd-ryzen-5-7500f` | 1 |
| W5 | `seasonic-focus-gx-750` | 1 |
| C5 | `fractal-design-node-304` + RTX 3090/3090 Ti | 2 |
| W2 | `crucial-pro-ddr5-128gb-5600` + `msi-pro-h610m-e` | 2 |

O parça katalogdan çıkarsa kural sessizce ölü koda döner. Script bunu yakalar
ama uyarı vermiyor, yalnızca sayıyı yazıyor.

**Karar gereken:** Eşik konsun mu? Örneğin "5'ten az kombinasyon = uyarı".
Yoksa sayı bilgi olarak kalsın mı?

### S26 — Intel F serisi işlemciler `has_igpu` yüzünden eklenemiyor

i5-14400F ve i7-14700F piyasada en çok satılan işlemciler arasında. Intel'in
ARK spec sayfaları F serisinde grafik bölümünü **hiç göstermiyor** — "yok"
demiyor, alan sayfada bulunmuyor. Alanın yokluğundan `has_igpu = false`
çıkarmak K60'ın yasakladığı çıkarım, bu yüzden eklenmediler (K65).

AMD aynı durumu açıkça yazıyor: Ryzen 5 7500F sayfasında
`Graphics Model = Discrete Graphics Card Required`.

**Karar gereken:** Intel'in başka bir sayfası (ürün karşılaştırma, ARK
filtreleri) bunu açıkça söylüyor mu ve satır kaynağı sayılır mı? Yoksa
`has_igpu` opsiyonel mi olmalı — ama o zaman W4 eksik alanda kendini atlar
ve kullanıcı "görüntü alamazsın" uyarısını hiç görmez.

### S27 — `case_specs`'in üç ölçü alanı K62'ye rağmen zorunlu

K62 kalıcı kural: fiziksel ölçü alanları asla zorunlu olmaz. Ama
`case_specs.max_gpu_length_mm`, `max_cpu_cooler_height_mm` ve
`max_psu_length_mm` hâlâ zorunlu.

Bu turda sorun çıkmadı: Fractal Design üçünü de yayınlıyor. Üçünü birden
yayınlamayan bir üretici geldiğinde çıkacak — K52, K56 ve K62'de üç kez
olduğu gibi.

**Karar gereken:** Şimdi mi opsiyonel yapılsın, yoksa dördüncü kez duvara
çarpılınca mı?

### S28 — Gerçek parçalara bağlı sahte fiyatlar duruyor

`npm run seed:temizle` dev-seed parçalarını sildi, ama gerçek parçalara bağlı
**36 dev-seed fiyat** ve **7 `perf_index`** satırına dokunmadı (K64).
Sebebi: fiyat kaynağı henüz kurulmadı; silinseydi geliştirme ortamında hiç
fiyat ve performans verisi kalmazdı.

Bunları canlıdan uzak tutan tek şey şu an veri erişim katmanının otomatik
filtresi ve dağıtım öncesi kontrolü.

**Karar gereken:** Gerçek fiyat kaynağı kurulunca bu satırlar silinecek —
o ana kadar duracaklar. Ara bir adım gerekiyor mu?

### S22 — 14 zorunlu spec alanı hiçbir kural ya da arayüzde kullanılmıyor

K56 ile eklenen kontrol ilk çalıştırmada 14 alan buldu:

```
gpu_specs.chipset, vram_gb, vram_type
cpu_specs.cores, threads, base_clock_mhz, boost_clock_mhz
motherboard_specs.chipset, m2_slots
ram_specs.cas_latency
psu_specs.efficiency_rating, modularity
storage_specs.interface
case_specs.max_cpu_cooler_height_mm
```

Bunların hepsi şu an **zorunlu**. K56'nın ölçütüne göre olmamaları gerekir:
hiçbir uyumluluk kuralı ve hiçbir arayüz bu alanlara bakmıyor.

`pcie_version`'ın AMD kartlarını nasıl dışarıda bıraktığını gördük. Aynı şey
bu 14 alan için de olabilir: bir üretici `cas_latency` ya da `m2_slots`
yayınlamıyorsa o parça hiç içeri giremez — oysa hiçbir kuralı etkilemiyor.

**Ama hepsi aynı değil:**

- `vram_gb`, `vram_type`, `chipset` — kullanıcı kart seçerken görmek isteyeceği
  şeyler. Arayüzde **henüz** gösterilmiyor, ama gösterilmesi planlanıyorsa
  zorunlu kalmaları savunulabilir.
- `cas_latency`, `m2_slots`, `efficiency_rating`, `modularity` — ne kuralda ne
  arayüzde; ileride kural gelebilir (`m2_slots` için depolama kuralı doğal aday).
- `max_cpu_cooler_height_mm` — kasa uyumluluğunun eksik ayağı; soğutucu
  kategorisi beta kapsamında değil.

**Karar gereken:** Hepsi opsiyonel mi olsun, bir kısmı mı, yoksa "arayüzde
gösterilecek" diye bırakılsın mı? Acil değil — şu an hiçbir veri girişini
engellemiyor, çünkü elle girilen CSV'lerde bu alanlar dolu geliyor.

### S18 — Önizleme dağıtımları kapatılsın mı?

Ortam değişkenleri artık sadece Production kapsamında (K46). Sonucu: her dal
itişinde oluşan **önizleme dağıtımları derlenemiyor ve başarısız oluyor**.
Tehlikeli bir şey yapmıyorlar — iki ayrı noktada duruyorlar (K47) — ama Vercel
panelinde ve GitHub'da kırmızı görünüyorlar.

**Önerim: önizleme dağıtımlarını kapat.** Gerekçe: bu projede bir dalın
çalıştığı yerelde `npm run dev` ile doğrulanıyor, önizleme adresine ihtiyaç yok.
Beta testçileri de canlı adrese girecek. Kapatılırsa hem gürültü biter hem de
canlı veritabanına yaklaşabilecek bir dağıtım türü hiç oluşmaz.

**Nasıl:** Vercel → Settings → Git → **Ignored Build Step** → komut:

```
[ "$VERCEL_ENV" != "production" ]
```

Vercel'in kuralı: bu komut **0 ile çıkarsa derleme atlanır**, 1 ile çıkarsa
devam eder. Yukarıdaki ifade production dışında 0 döner, yani sadece canlı
dağıtımlar derlenir.

Bunu buradan doğrulayamıyorum (panel ayarı). Doğru kurulduğunu şuradan
anlarsın: bir dal itişinden sonra Vercel'de dağıtım "Build skipped" der,
"Error" demez.

**Alternatifler:**

1. **Hiçbir şey yapma.** Önizlemeler başarısız olmaya devam eder. Zararsız,
   sadece gürültülü.
2. **Önizlemelere geliştirme veritabanını ver.** Preview kapsamına geliştirme
   veritabanı adresini yaz. O zaman önizlemeler çalışır — ama `dagitim:kontrol`
   geliştirme veritabanında dev-seed bulup duracağı için build komutunun da
   ortama göre davranması gerekir. Karmaşıklık artar; beta'da karşılığı yok.

Acil değil. Karar verilene kadar önizlemeler başarısız olur, canlı etkilenmez.
→ `docs/KARARLAR.md` K46, K47

### S16 — Oyun dışı ölçümlerde `game_id` ne olacak? ⏸️ ERTELENDİ (2026-08-18)

**Proje sahibinin kararı:** Şimdi karar verilmeyecek. Beta'da tek iş yükü var
ve `game_id` zorunluluğu **doğru davranıştır** — oyun ölçümünün oyunu olmalı.
İkinci iş yükü eklendiğinde bakılacak. Soru kapanmadı, ertelendi.

---

`benchmark_points.workload` eklendi ve dört değeri var, ama tablonun `game_id`
alanı **zorunlu**. Oyun dışı bir ölçümün (`ai_inference`, `video_encode`,
`productivity`) oyunu yok.

Beta'da sorun çıkarmıyor: yalnızca `gaming` kullanılıyor ve her satırın oyunu
var. İş yükü genişletildiğinde ilk çözülecek şey bu.

**Seçenekler:**

1. `game_id` opsiyonel yapılır (`FK?`) — en küçük değişiklik, ama "oyun ölçümünün
   oyunu olmalı" garantisi veritabanı seviyesinde kaybolur.
2. Ayrı bir `workload_targets` tablosu açılır: her iş yükünün kendi hedefi olur
   (oyun, model, kodek profili). Doğru olan bu ama beta'da karşılığı yok.
3. Oyun dışı ölçümler ayrı bir tabloya yazılır.

Acil değil, karar iş yükü genişletildiğinde verilir.
→ `docs/KARARLAR.md` K35, K36

### S15 — Darboğaz göstergesi çözünürlüğü hesaba katmıyor

Motor v0.1'de darboğaz, iki indeksin **ham farkına** bakıyor: fark 15'i geçerse
zayıf olan taraf "sınırlıyor" sayılıyor. Bu, `SCHEMA.md` bölüm 8'deki somut
kuralın birebir uygulanması.

**Sorun:** Aynı sistem 1080p'de ve 4K'da aynı darboğaz uyarısını alıyor. Oysa
4K'da işlemcinin payı yalnızca %12; orada 20 puan zayıf bir işlemci pratikte
sorun çıkarmaz. Şu an kullanıcı 4K seçtiğinde de "İşlemci sınırlıyor" yazısını
görüyor ve bu yazı o çözünürlükte yanıltıcı.

`SCHEMA.md` bölüm 8'de bunu ima eden yarım bir satır var
(`beklenen_cpu = gpu_idx * (w_cpu / w_gpu ile ölçeklenmiş eşik)`) ama tamamlanmamış
ve altındaki somut kural onu kullanmıyor. Daha spesifik olan kural uygulandı.

**Karar gereken:** Eşik çözünürlüğe göre değişsin mi? Örneğin 1080p'de 15,
1440p'de 25, 4K'da 40 puan. Bu bir motor davranışı değişikliğidir; yapılırsa
`model_version` `v0.2` olur ve eski hesaplar `v0.1` olarak durmaya devam eder.

Acil değil — beta bunu bilerek kullanabilir. → `docs/KARARLAR.md` K33

---

## Kapanmış sorular

### S24 — `psu_specs.length_mm` zorunlu, K60 boş bırakılmasını gerektiriyor ✅ 2026-08-19

**Cevap:** Opsiyonel oldu (1. seçenek) ve kalıcı kural yazıldı: fiziksel ölçü
alanları asla zorunlu olmaz. `corsair-rm850e` içeri alındı. Motor tipi,
dönüştürücü, W5 kuralı ve arayüz uyarısı GPU'daki kalıbın aynısı.
→ `docs/KARARLAR.md` K62

### S23 — Intel'de `shader_units` boş bırakıldı ✅ 2026-08-19

**Cevap:** `shader_unit_type` alanı eklendi (2. seçeneğin güvenli hâli).
Intel'in Xe Vector Engines sayısı ham haliyle yazılıyor, tipi
`xe_vector_engine`. NVIDIA `cuda_core`, AMD `stream_processor`. Kalıcı kural:
ölçekleme modeli bu alanı yalnızca aynı mimari içinde kullanabilir.
→ `docs/KARARLAR.md` K57, K58

### S21 — `pcie_version` ve `recommended_psu_watt` zorunlu ✅ 2026-08-19

**Cevap:** İkisi de opsiyonel oldu. Genel kural kondu: bir alan ancak bir
uyumluluk kuralı ya da arayüz tarafından kullanılıyorsa zorunlu olabilir.
Kural `CLAUDE.md` "Kalite" bölümüne ve `docs/KARARLAR.md` K56'ya yazıldı;
`npm run sema:kontrol` denetliyor. 23 AMD kartı içeri alındı.

### S20 — Aynı slug ikinci kez geldiğinde ne olacak? ✅ 2026-08-19

**Cevap:** Güncellensin (1. ve 2. seçeneğin birleşimi). Tek koşul: yeni satırın
kaynağı mevcut satırınkinden düşük güvenilirlikte olmayacak
(`manufacturer` > `manual` > `affiliate` > `import` > `user` > `dev-seed`).
Düşükse atlanır ve `raw_imports.error`'a yazılır. Güncelleme olduğunda değişen
alanlar ekrana yazılır.

Aynı koruma seed script'ine de eklendi: `npm run db:seed` artık gerçek veriyle
dolu bir slug'ın üzerine yazmıyor. → `docs/KARARLAR.md` K54

### S19 — Gerçek parça verisi nereden gelecek? ✅ 2026-08-19

**Cevap:** Elle giriş, üretici ürün sayfalarından. Wikidata birincil kaynak
olmayacak (fizibilite raporundaki LGA1155 hatası belirleyici oldu), bir yıl
sonra tekrar bakılacak. Kaggle lisans nedeniyle kapalı.

Miktar ve dağılım proje sahibi tarafından verildi: CPU 8, GPU 8, anakart 6,
RAM 4, PSU 4, kasa 4, depolama 4 — toplam 38. Seçim kriteri: on bir uyumluluk
kuralının her biri en az bir parça çiftiyle tetiklenebilmeli.

Kaynak CSV `data/parts/` altında, depoda versiyonlu.
→ `docs/KARARLAR.md` K49, K50

### S17 — `builds` tablosuna `resolution` alanı ✅ 2026-08-18

**Cevap:** Alan eklendi (2. seçenek). Dondurulan indeks artık sabit bir
referansta değil, kullanıcının kaydettiği çözünürlükte hesaplanıyor; kayıtlı
sistem sayfası hangi çözünürlük olduğunu yazıyor. `REFERENCE_RESOLUTION` sabiti
koddan kaldırıldı. Migration `20260818172814_kayit_cozunurlugu_ve_indekssiz_sistem`;
mevcut kayıtlar `1440p` ile dolduruldu — eski davranış zaten oydu.
→ `docs/KARARLAR.md` K43 (K38'i değiştirir)

### S14 — Vercel hesabı ve dağıtım bağlantısı ✅ 2026-08-18

**Cevap:** Site canlıda. Proje sahibi Vercel hesabını açtı, depoyu bağladı ve
dağıtımı tarayıcıdan yaptı. Ortam değişkenleri Vercel'de Production kapsamında
tanımlı; `DEV_SEED_ALLOWED` **tanımlanmadı** — yokluğu 4. katman korumasıdır.

**İlk deneme `dagitim:kontrol`'e takılıp durdu, bağlantı düzeltilince geçti.**
Yani dev-seed korumasının 3. katmanı yazılı olmakla kalmadı, gerçek dağıtım
hattında da çalıştığını kanıtladı.

Canlıda 0 parça — beklenen: canlı veritabanında dev-seed verisi yok ve gerçek
veri girişi henüz yapılmadı (CSV içe aktarma ertelenmişti).
→ `docs/KARARLAR.md` K45

### S13 — dev-seed verisi canlı olacak veritabanında duruyor ✅ 2026-08-18

**Cevap:** Ayrı bir geliştirme veritabanı açıldı (1. seçenek). `.env.local`
artık yalnızca geliştirmeyi gösteriyor; canlı bağlantı bilgileri hiçbir yerel
dosyada durmuyor, dağıtım platformunda tutulacak. Canlı veritabanındaki 58
dev-seed satırı silindi. Dağıtım öncesi kontrol (3. katman) yazıldı:
`npm run dagitim:kontrol`. → `docs/KARARLAR.md` K29

### S12 — Kategori başına tek parça varsayımı ✅ 2026-08-18

**Cevap:** `BuildInput`'ta `storage` alanı yok ve olmayacak — beta'daki on bir
kuralın hiçbiri depolamayı kullanmıyor, yani motor depolamayı hiç görmüyor.
Çoklu disk arayüzde çözüldü: kullanıcı istediği kadar disk seçiyor, seçim sistem
listesinde görünüyor, motora gitmiyor. Depolama kuralı gerektiğinde
`storage: EngineStorage[]` dizi olarak eklenecek. → `docs/KARARLAR.md` K26

### S11 — Veritabanı parolası sohbet geçmişine girdi ✅ 2026-08-18

**Cevap:** Yenilenmeyecek. Parola depoya sızmadı — `.env.local` yok sayılıyor
(`git check-ignore` ile doğrulandı), commit diff'i tarandı, push protection
etkin. → `docs/KARARLAR.md` K21

### S4 — Test koşucusu ✅ 2026-08-18

**Cevap:** `vitest` 4.1.10 kuruldu. `vitest.config.mts` testleri `tests/` altıyla
sınırlıyor, ortam `node` — arayüz bileşeni test edilmediği için tarayıcı ortamı
kurulmadı. `npm test` ve `npm run test:izle`.

### S10 — Supabase bağlantı bilgileri ✅ 2026-08-18

**Cevap:** Bilgiler verildi, `.env.local` dolduruldu, migration
(`20260818102429_ilk_sema`) çalıştı. 17 tablo, 12 enum ve 5 indeks oluştu;
`npm run db:kontrol` hepsini doğruluyor. Paroladaki iki `#` percent-encode
edildi (`%23`) — kodlanmasaydı parola ilk `#`'te kesilecekti.

### S1 — Şemadaki altı indeks ✅ 2026-08-18

**Cevap:** `raw_imports(status)` silindi, diğer beşi kaldı ve `SCHEMA.md`
bölüm 11'e yazıldı. `CLAUDE.md`'ye kural eklendi: belgelenmiş sorgu yolları
üzerindeki indeksler erken optimizasyon sayılmaz, ancak `SCHEMA.md`'de tanımlı
olmak zorundadır. → `docs/KARARLAR.md` K15

### S2 — Prisma sürücü paketi izni ✅ 2026-08-18

**Cevap:** Kuruldu — `@prisma/adapter-pg` 7.9.1 ve `pg` 8.23.0. Ek tip paketi
(`@types/pg`) gerekmedi, `tsc` temiz geçti. → `docs/KARARLAR.md` K19, K20

### S3 — `npm audit` üç yüksek seviye uyarı ✅ 2026-08-18

**Cevap:** Prisma 7'de kalınıyor, dokunulmayacak. Uyarı yalnızca geliştirme
aracını etkiliyor. → `docs/KARARLAR.md` K9

### S5 — Şema kararlarının taşınması ✅ 2026-08-18

**Cevap:** Onaylandı. Kararların tam metni `docs/KARARLAR.md`'de kalır,
`SCHEMA.md` bölüm 12 işaretçi olarak durur.

### S6 — Karşılaştırma betiği depoda değil ✅ 2026-08-18

**Cevap:** `scripts/check-schema.mjs` olarak depoya alındı, `npm run sema:kontrol`
ile çalışıyor. Python yerine Node'a çevrildi. → `docs/KARARLAR.md` K17

### S7 — GitHub güvenlik ayarları ✅ 2026-08-18 (kısmen)

**Cevap:** `dependabot_security_updates` açıldı (önce vulnerability alerts
gerekiyordu). Diğer ikisi açılamadı — S9'da kapandı.

### S8 — `main` dalı korumasız ✅ 2026-08-18

**Cevap:** Dal koruması kuruldu. Force-push ve dal silme engellendi, yöneticiler
dahil. PR zorunluluğu konmadı — tek kişilik projede gereksiz tören.
→ `docs/KARARLAR.md` K16

### S9 — İki secret scanning ayarı açılamadı ✅ 2026-08-18

**Cevap:** Peşine düşülmeyecek. İki ayar GitHub'ın ücretli **Secret Protection**
paketine ait; API 200 dönüp ayarı sessizce yok sayıyor. Mevcut üç koruma
(secret scanning, push protection, dependabot) yeterli sayıldı.
→ `docs/KARARLAR.md` K18
