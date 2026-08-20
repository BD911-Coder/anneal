# Anneal — Alan Modeli (Domain Model) — v1.4

Bu dosya projenin veri yapısını tanımlar. Kod bundan türetilir, tersi değil.
Bir alan burada yoksa koda da girmez; kodda bir alan gerekiyorsa önce buraya eklenir.

---

## 0. Değişmez kurallar

Bu yedi kural şemanın her yerinde geçerlidir ve sonradan değiştirilmesi pahalıdır.

1. **Kalıcı kimlik.** Her parçanın kendi `id`'si vardır (slug). Satıcı stok kodu, ürün adı
   veya dış servis kimliği asla birincil anahtar olarak kullanılmaz.
2. **Geçmiş silinmez.** Fiyat ve benchmark verisi güncellenmez, yeni satır eklenir.
   Tablo adında `_snapshots` / `_points` geçiyorsa o tablo **append-only**'dir.
3. **Ham veri saklanır.** Dışarıdan gelen her veri önce `raw_imports`'a olduğu gibi yazılır,
   sonra normalize edilip asıl tabloya geçer.
4. **Para tam sayıdır.** Fiyatlar kuruş cinsinden `integer` tutulur (`149999` = 1.499,99 TL).
   Ondalıklı sayı (float/double) fiyat için asla kullanılmaz. Her fiyatın yanında
   para birimi ve zaman damgası bulunur.
5. **Motor bağımsızdır.** `/engine` klasöründeki kod veritabanına, arayüze veya ağa erişmez.
   Girdi alır, çıktı verir. Test edilebilir olmasının tek sebebi budur.
6. **Hesaplar sürümlüdür.** Motorun ürettiği her sayının yanında `model_version` bulunur.
7. **Adresler kalıcıdır.** URL yapısı baştan doğru kurulur, sonradan değiştirilmez.

---

## 1. Ortak alanlar

### 1.1 Kimlik

Her tabloda bir birincil anahtar bulunur. Üç biçimden biridir:

| Biçim | Nerede | Örnek |
|---|---|---|
| Kendi `id`'si | Bağımsız varlıklar | `parts`, `games`, `builds`, `price_snapshots` |
| Sahibinin `part_id`'si | Kategori spec tabloları | `gpu_specs.part_id` |
| Bileşik anahtar | Bağlantı tabloları | `build_items (build_id, part_id)` |

Spec tablolarında ve bağlantı tablolarında **ayrı bir `id` sütunu yoktur.**
Gerekçe: satırın kimliği zaten sahibinden geliyorsa ikinci bir anahtar
tutmak, aynı gerçeği iki yerde saklamak demektir.

### 1.2 Zaman

| Alan | Tip | Açıklama | Nerede |
|---|---|---|---|
| `created_at` | timestamptz | Kayıt oluşturulma anı | **Her tabloda** |
| `updated_at` | timestamptz | Son değişiklik anı | Append-only **olmayan** tablolarda |

Append-only tablolarda (`price_snapshots`, `benchmark_points`) `updated_at`
**yoktur.** Satır güncellenmediği için "son değişiklik anı" diye bir şey olamaz;
sütunu tutmak var olmayan bir işlemin mümkün olduğunu ima eder.

`perf_index` de `updated_at` taşımaz: satır güncellenebilir ama "ne zaman
hesaplandı" bilgisini zaten `computed_at` tutar, ikinci bir zaman damgası
aynı gerçeği tekrarlar.

### 1.3 Olgusal iddia alanları

**Kural:** Dış dünya hakkında olgusal bir iddia taşıyan her tabloda şu dört alan bulunur.
"Bu ekran kartının TDP'si 220W" bir iddiadır ve nereden geldiği sorulabilir olmalıdır.

| Alan | Tip | Açıklama |
|---|---|---|
| `source` | enum | `manual`, `dev-seed`, `manufacturer`, `affiliate`, `user`, `import` |
| `source_url` | text? | Verinin alındığı adres |
| `confidence` | enum | `high`, `medium`, `low` |
| `collected_at` | timestamptz | Verinin **toplandığı** an (kaydedildiği an değil) |

**Bulunduğu tablolar:** `parts`, yedi kategori spec tablosu (`gpu_specs`, `cpu_specs`,
`motherboard_specs`, `ram_specs`, `psu_specs`, `storage_specs`, `case_specs`),
`games`, `price_snapshots`, `benchmark_points`.

**Muaf tablolar:** `builds`, `build_items`, `click_events`, `feedback`, `raw_imports`.
Gerekçe: bunlar dış dünya hakkında iddia taşımaz. Kullanıcının kendi eylemini
(sistem kaydetme, tıklama, geri bildirim) veya ham veriyi olduğu gibi tutarlar.
`raw_imports.source` ayrı bir istisnadır — bkz. `docs/KARARLAR.md`, K6.

> `source = 'dev-seed'` olan hiçbir satır canlı ortamda gösterilmez.
> Bu filtre veri erişim katmanında zorunludur, çağıran kodun tercihine bırakılmaz.

---

## 2. Parça kataloğu

### `parts` — bütün donanımın ortak tablosu

| Alan | Tip | Not |
|---|---|---|
| `id` | text | Slug. Örn: `nvidia-rtx-5070`, `amd-ryzen-7-7800x3d` |
| `category` | enum | `gpu`, `cpu`, `motherboard`, `ram`, `psu`, `storage`, `case` |
| `brand` | text | `NVIDIA`, `AMD`, `Intel`, `ASUS`... |
| `model` | text | Görünen ad |
| `release_year` | int? | |
| `is_active` | bool | Piyasadan kalktıysa `false` — satır silinmez |

**Slug kuralı:** küçük harf, boşluk yerine tire, marka + model. Bir kez atandıktan
sonra **asla değişmez**. Görünen ad değişebilir, slug değişmez.

### Kategori tabloları

Her kategori kendi tablosunda, `part_id` ile `parts`'a bağlanır. Uyumluluk kuralları
tipli sütunlara ihtiyaç duyduğu için JSON kullanılmaz.

> **Spec alanları uyumluluk içindir, performans tahmini için kullanılmaz.**
>
> Bu tablolardaki hiçbir alandan performans sayısı türetilmez. Çekirdek sayısı,
> saat hızı, VRAM miktarı, CUDA çekirdeği gibi değerler "hangi parça hangisine
> takılır" sorusunu cevaplamak için burada; "bu parça ne kadar hızlı" sorusunu
> cevaplamak için değil.
>
> **Gerekçe:** Bu değerler mimari içinde anlamlıdır, mimariler arasında değildir.
> İki farklı nesilden ya da iki farklı üreticiden aynı çekirdek sayısı aynı
> performans demek değildir; aynı saat hızı da öyle. Bu alanlardan FPS ya da
> indeks üretmek, kaynağı olmayan bir sayıyı ölçülmüş gibi göstermek olur.
>
> Performans sayısının tek meşru kaynağı `benchmark_points`'teki ölçümlerdir;
> motor da yalnızca `perf_index` üzerinden çalışır (bölüm 4 ve 8).
> Bkz. `docs/KARARLAR.md` K37.

Aşağıdaki tabloların hepsinde **`part_id` birincil anahtardır**, ayrı `id` yoktur (bölüm 1.1).
Hepsi olgusal iddia taşır; dolayısıyla hepsinde `source`, `source_url`, `confidence`,
`collected_at` bulunur (bölüm 1.3). Tekrar olmasın diye aşağıdaki listelerde yazılmadı.

**`gpu_specs`**

| Alan | Tip |
|---|---|
| `part_id` | FK |
| `chipset` | text |
| `vram_gb` | int |
| `vram_type` | text (`GDDR6`, `GDDR7`) |
| `tdp_watt` | int |
| `length_mm` | int? |
| `recommended_psu_watt` | int? |
| `pcie_version` | text? |
| `shader_units` | int? |
| `shader_unit_type` | enum? (`cuda_core`, `stream_processor`, `xe_vector_engine`) |
| `boost_clock_mhz` | int? |
| `memory_bandwidth_gbs` | float? |

`length_mm`, `recommended_psu_watt` ve `pcie_version` **opsiyoneldir**
(K52, K56). Hangi alanı hangi üreticinin yayınladığı kaynağa göre değişiyor:
NVIDIA PCIe sürümü veriyor, AMD vermiyor; AMD bant genişliği veriyor, NVIDIA
vermiyor. Kaynağa göre değişen bir şeye "zorunlu" denemez.

**Zorunluluk ölçütü (K56):** Bir alan ancak bir uyumluluk kuralı ya da arayüz
tarafından kullanılıyorsa zorunlu olabilir.

`length_mm` hakkında (K52): Bilinmeyen uzunluk, uzunluğu olmayan kart
demek değildir; üreticiler yalnızca kendi referans kartlarının ölçüsünü verir.
Boşsa C5 kuralı atlanır ve **arayüz bunu kullanıcıya söyler** — sessizce
atlanmaz.

Şu alan markalar arası karşılaştırılabilir **değildir**: `shader_units` (K57).
`shader_unit_type` bu kısıtı yapısal hale getirir: sayının ne saydığını satırın
kendisi söyler, hatırlamaya bırakılmaz. `shader_units` doluysa
`shader_unit_type` da dolu olmak zorundadır; `npm run sema:kontrol` denetler.

> **Kalıcı kural:** Performans ölçekleme modeli `shader_units`'i **yalnızca aynı
> mimari içinde** kullanabilir. Farklı marka ya da farklı nesil arasında bu
> alanla karşılaştırma yapılmaz.

Son dört alan da **opsiyoneldir** ve K37'nin istisnası değildir: mutlak FPS ya da
indeks türetmek için değil, **aynı mimari içinde göreli ölçekleme** için
tutulurlar. Nesiller arası karşılaştırmada kullanılmazlar.
Bkz. `docs/KARARLAR.md` K51.

> **`gpu_specs` çip seviyesidir.** Satır bir çipin **referans tasarımını**
> tanımlar (`nvidia-rtx-5080`); `length_mm`, `tdp_watt` ve `boost_clock_mhz`
> çip üreticisinin referans kartı için yayınladığı değerlerdir. Piyasada satılan
> kart (ASUS ProArt RTX 5080, ROG Strix RTX 5080) ayrı bir satırdır —
> `gpu_variant_specs`.

**`gpu_variant_specs`** — ekran kartı varyantı (AIB kartı)

Piyasada satılan kart, çipin kendisi değildir: aynı RTX 5080 çipinden ROG Strix
~358 mm, ProArt ~304 mm çıkar. Fark C5'i doğrudan etkiler. Kart, `category = 'gpu'`
olan normal bir `parts` satırıdır ve bu tabloyla çipine bağlanır (K86).

| Alan | Tip | Not |
|---|---|---|
| `part_id` | FK | Birincil anahtar. Kartın kendi `parts` satırı |
| `chip_part_id` | FK | Kartın çipi — `gpu_specs` satırı olan bir parça |
| `length_mm` | int? | C5 kullanır |
| `height_mm` | int? | |
| `thickness_slots` | float? | 2, 2.5, 3 — yarım slot değerleri yuvarlanmaz |
| `tbp_watt` | int? | C4 kullanır |
| `recommended_psu_watt` | int? | |
| `power_connectors` | text? | Serbest metin: `2x 8-pin + 1x 6-pin` (K88) |
| `boost_clock_mhz` | int? | Fabrika boost, **varsayılan** mod |
| `boost_clock_oc_mhz` | int? | OC / performans BIOS modu, ayrıca yayınlanmışsa |
| `fan_count` | int? | |
| `hdmi_count` | int? | |
| `displayport_count` | int? | |
| `usb_c_count` | int? | |

**Zorunlu tek alan `chip_part_id`'dir** (K86). K56'nın sorusuna — "hangi kural
bunu kullanıyor?" — yalnızca o alan için cevap var: C4 ve C5'in geri düşüşü,
`perf_index` çözümlemesi ve arayüzün değişmeyen specleri okuması bu bağı
kullanır. Çipi bilinmeyen bir kart yoktur. `length_mm` ve `tbp_watt` bir kural
tarafından kullanılır ama yine de opsiyoneldir: fiziksel ölçü zorunlu olmaz
(K62) ve TBP'yi zorunlu yapmak, yayınlamayan üreticinin kartını dışarıda
bırakırdı (K56, `pcie_version` dersi).

**Değişmeyen alanlar bu tabloda tekrarlanmaz.** Çip, `shader_units`,
`shader_unit_type`, VRAM kapasitesi ve tipi, bellek hızı, arayüz genişliği,
`memory_bandwidth_gbs`, `pcie_version` — hepsi `chip_part_id` üzerinden
`gpu_specs`'ten okunur. Tek kaynak orasıdır; kopyalanan gerçek zamanla ayrışır.

> **Bu tablodaki hiçbir alandan performans sayısı türetilmez.** Yukarıdaki K37
> notu burada da geçerlidir ve daha keskindir: `boost_clock_mhz` ile
> `boost_clock_oc_mhz` farkından indeks üretmek, K74'ün reddettiği
> interpolasyonun saat hızıyla yapılmış hâlidir. İki alan da yalnızca gösterim
> ve kaynak defteri içindir.
>
> **Silikon kalitesi (binning) alanı yoktur.** Üreticiler yayınlamıyor.
> Gözlemlenebilir karşılıkları (boost, TBP, konnektör) ham hâliyle saklanır,
> yorumlanmaz.

`power_connectors` **serbest metindir** (K88): hiçbir kural okumuyor, o yüzden
yapılandırılmış hâli (tip + adet ya da alt tablo) ertelendi. Kural gerektiğinde
yapılandırılır. Bkz. `SORULAR.md` S38.

**`cpu_specs`**

| Alan | Tip |
|---|---|
| `part_id` | FK |
| `socket` | text (`AM5`, `LGA1851`) |
| `cores` | int |
| `threads` | int |
| `base_clock_mhz` | int |
| `boost_clock_mhz` | int |
| `tdp_watt` | int |
| `memory_type` | enum (`DDR4`, `DDR5`, `DDR4/DDR5`) |
| `has_igpu` | bool |

**`motherboard_specs`**

| Alan | Tip |
|---|---|
| `part_id` | FK |
| `socket` | text |
| `chipset` | text (`B650`, `X870`) |
| `form_factor` | enum (`ATX`, `mATX`, `ITX`, `E-ATX`) |
| `memory_type` | enum (`DDR4`, `DDR5`) |
| `memory_slots` | int |
| `max_memory_gb` | int |
| `max_memory_speed_mhz` | int |
| `m2_slots` | int |

**`ram_specs`**

| Alan | Tip |
|---|---|
| `part_id` | FK |
| `memory_type` | enum (`DDR4`, `DDR5`) |
| `capacity_gb` | int — tek modül değil, **kit toplamı** |
| `module_count` | int |
| `speed_mhz` | int |
| `cas_latency` | int |

**`psu_specs`**

| Alan | Tip |
|---|---|
| `part_id` | FK |
| `wattage` | int |
| `efficiency_rating` | text? (`80+ Gold`, `Cybenetics Gold`) |
| `modularity` | enum (`full`, `semi`, `none`) |
| `length_mm` | int? |

`efficiency_rating` **opsiyoneldir** (K61): hiçbir kural kullanmıyor ve her
üretici aynı sertifika sistemini yayınlamıyor — Corsair bazı modellerde yalnızca
Cybenetics veriyor, 80 PLUS vermiyor. Değer sayfada yazdığı gibi girilir.

> **Fiziksel ölçü kuralları** (K59, K60) — `case_specs` ve `psu_specs.length_mm`
> doğrudan C5 ve W5 kurallarını besler:
>
> 1. **Çıkarım yapılmaz.** Yalnızca üreticinin **etiketlediği** değer yazılır.
>    Etiketsiz bir sayıdan hangi eksenin uzunluk olduğu çıkarılabilse bile
>    yazılmaz, boş bırakılır.
> 2. **Birden fazla değer varsa en küçüğü yazılır.** Kullanıcı hangi
>    yapılandırmayı kullandığını bilmiyor; yanlış "sığar" demek, gereksiz
>    uyarıdan çok daha pahalı.
> 3. **Ondalıklı açıklık değerleri aşağı yuvarlanır.** 180.5 mm → 180.
> 4. **Fiziksel ölçü alanları asla zorunlu olmaz** (K62). Üreticiler bu
>    değerleri tutarsız yayınlıyor; zorunluluk veriyi dışarıda bırakmaktan
>    başka işe yaramıyor. İlgili kural eksik alanda kendini atlar, arayüz
>    kullanıcıya bildirir.
> 5. **ATX güç kaynağında sabit iki eksen tanınıyorsa kalan uzunluktur**
>    (K95). Etiketsiz üçlüde **hem 150 hem 86** varsa, kalan değer
>    `psu_specs.length_mm`'e yazılır — ATX12V genişliği 150, yüksekliği 86 mm
>    olarak sabitler. Biri yoksa kural kendini kapatır ve 1. madde işler.
>    SFX/SFX-L kapsam dışıdır. Bu, K91'in ekran kartı kuralı **değildir**:
>    orada en büyük değer uzunluktur, PSU'da en büyük değer genişliktir.

**`storage_specs`**

| Alan | Tip |
|---|---|
| `part_id` | FK |
| `storage_type` | enum (`nvme`, `sata-ssd`, `hdd`) |
| `capacity_gb` | int |
| `interface` | text (`PCIe 4.0 x4`) |
| `read_speed_mbs` | int? |

**`case_specs`**

| Alan | Tip |
|---|---|
| `part_id` | FK |
| `supported_form_factors` | **enum dizisi** — `FormFactor[]` (`{ATX, mATX, ITX}`) |
| `max_gpu_length_mm` | int, **opsiyonel** (K62) |
| `max_cpu_cooler_height_mm` | int, **opsiyonel** (K62) |
| `max_psu_length_mm` | int, **opsiyonel** (K62) |

Üç ölçü alanı da opsiyoneldir: fiziksel ölçü alanı zorunlu yapılmaz (K62).
Eksikse C5 ve W5 kuralları kendini atlar, arayüz kullanıcıya bildirir.
`supported_form_factors` zorunlu kalır — o bir ölçü değil, üreticinin
listelediği uyumluluk beyanıdır ve C6 onsuz hiç çalışamaz.

---

## 3. Fiyat

### `price_snapshots` — **append-only**

| Alan | Tip | Not |
|---|---|---|
| `id` | uuid | |
| `part_id` | FK | |
| `retailer` | text | `incehesap`, `vatan`, `manual` |
| `price_minor` | **integer** | Kuruş. `149999` = 1.499,99 TL |
| `currency` | text | `TRY` |
| `in_stock` | bool? | |
| `product_url` | text? | |
| `source`, `confidence`, `collected_at` | — | Ortak alanlar |

Güncelleme yok. Bir parçanın güncel fiyatı = en son `collected_at`'li satır.
Fiyat geçmişi bu tablodan doğrudan çıkar; **bugün biriktirilmezse sonradan üretilemez.**

Append-only olduğu için `updated_at` sütunu **yoktur** (bölüm 1.2).

---

## 4. Benchmark ve performans

### `games`

| Alan | Tip | Not |
|---|---|---|
| `id` | text | Slug: `cyberpunk-2077` |
| `name` | text | |
| `release_year` | int? | **PC (Steam) çıkış yılı.** Doğrulanamıyorsa boş |
| `gpu_weight` | float | 0–1, oyunun GPU'ya bağımlılığı |
| `cpu_weight` | float | 0–1 |

Olgusal iddia taşır: `source`, `source_url`, `confidence`, `collected_at` bulunur (bölüm 1.3).
`source_url` **oyunun kendi olgularının** (ad, çıkış yılı) kaynağını gösterir —
benchmark'ın kaynağı `benchmark_points.source_url` içinde ayrıca durur (K109).

`release_year` **opsiyoneldir** (K112): hiçbir kural ve arayüz kullanmıyor
(K56 ölçütü) ve her oyun Steam'de bulunmuyor — Alan Wake 2 Epic'e özel çıktı,
Steam'de satırı yok. Zorunluluk, doğrulanamayan bir yılı uydurmaya zorlardı.

**Tanım: PC çıkışı.** Konsolda daha önce çıkan oyunlarda PC sürümünün yılı
yazılır (Death Stranding 2: PS5 2025, PC 2026 → **2026**). Burası PC toplama
sitesi; ölçümler PC sürümünde yapılıyor.

### `benchmark_points` — **append-only**

Elle toplanan gerçek ölçümler. Motorun kalibrasyon verisi.

| Alan | Tip | Not |
|---|---|---|
| `id` | uuid | |
| `gpu_part_id` | FK | |
| `cpu_part_id` | FK? | Bilinmiyorsa null |
| `game_id` | FK | |
| `workload` | enum | `gaming`, `ai_inference`, `video_encode`, `productivity` |
| `resolution` | enum | `1080p`, `1440p`, `2160p` |
| `preset` | enum | `low`, `medium`, `high`, `ultra` |
| `upscaling` | text? | `none`, `DLSS-Q`, `FSR-Q` — **yalnızca upscaling** |
| `render_mode` | enum | `raster`, `raytracing`, `pathtracing` |
| `avg_fps` | float | |
| `one_percent_low_fps` | float? | |
| `source_type` | enum | `review`, `user_submission`, `own_test` |
| `source`, `confidence`, `collected_at` | — | Bölüm 1.3 |
| `source_url` | text | **Burada zorunlu** (bölüm 1.3'te opsiyonel). Kaynak defteri budur. |

**Neden `render_mode` ayrı bir alan** (K111): raytracing FPS'i %30-50 değiştirir,
yani `upscaling` kadar belirleyici bir ayardır. Bir süre `upscaling` alanına
`DLSS/FSR Native + Raytracing` biçiminde yazıldı; bu, alanı sorgulanamaz hale
getiriyordu — "hangi satırlar DLSS Quality kullandı" sorusu metin eşleştirmesi
gerektiriyordu. Dört oyunken düzeltmek ucuz, kırk oyunken pahalı olurdu.

Varsayılanı **`raster`**: kaynakların büyük çoğunluğu raster ölçüyor ve mevcut
satırların hepsi öyleydi. `pathtracing` bugün hiçbir satırda kullanılmıyor ama
şemaya şimdi girdi — sonradan eklenirse bugünkü satırların hangi modda olduğu
geriye dönük tahmin edilmek zorunda kalırdı (`workload` ile aynı gerekçe).

İki ölçüm ancak **aynı** `(game_id, resolution, preset, upscaling, render_mode)`
beşlisindeyse karşılaştırılabilir; motorun grup anahtarı budur (K101).

> Tek bir kaynaktan toplu veri alınmaz. Her satır ayrı ayrı, kaynağı yazılarak girilir.

Append-only olduğu için `updated_at` sütunu **yoktur** (bölüm 1.2).

**İş yükü alanı beta'da sadece `gaming` değerini alır.** Diğer üç değer şemada tanımlı ama
beta'da hiçbir satır onları kullanmaz. Alanın şimdi açılmasının sebebi: sonradan
eklenirse bugün girilen bütün ölçümlerin hangi iş yüküne ait olduğu geriye dönük
tahmin edilmek zorunda kalırdı.

Varsayılan değeri **yoktur**: iş yükünü söylemeden ölçüm girilemez. Değeri olan
bir varsayılan, yanlış etiketlenmiş satırı sessizce meşrulaştırırdı.

> `workload ≠ 'gaming'` olan satırlar için `game_id`'nin ne olacağı henüz
> çözülmedi — bugün zorunlu bir alan ve oyun dışı bir ölçümün oyunu yok.
> Bkz. `SORULAR.md` S16.

### `perf_index` — hesaplanmış, sürümlü

| Alan | Tip | Not |
|---|---|---|
| `part_id` | FK | Sadece `gpu` ve `cpu` |
| `workload` | enum | `gaming`, `ai_inference`, `video_encode`, `productivity` |
| `index_value` | float | Referans parça = 100. Daha hızlı parçalar 100'ü **aşar** (K73). |
| `model_version` | text | `v0.1` |
| `computed_at` | timestamptz | |

Aynı parça için farklı `model_version`'lar bir arada durur. Eski sürümler silinmez —
model değiştiğinde karşılaştırma yapabilmenin tek yolu budur.

**Tekillik kısıtı:** (`part_id`, `workload`, `model_version`) üçlüsü tekildir.
Bir parçanın, bir iş yükünde, bir motor sürümünde tek indeksi olur; yeniden hesap
yeni satır değil, aynı satırın güncellenmesidir. Bu tablo append-only değildir.

**Neden `workload` tekilliğin parçası:** Bir ekran kartı oyunda güçlü, yapay zekâ
çıkarımında vasat olabilir — bunlar aynı parçanın iki ayrı gerçeğidir ve tek bir
sayıya sıkıştırılamaz. Tekillik iki sütunlu kalsaydı ikinci iş yükünün indeksi
birincinin üzerine yazılırdı.

**İş yükü alanı beta'da sadece `gaming` değerini alır.** Varsayılan değeri yoktur;
hangi iş yükünün indeksi olduğunu söylemeden satır yazılamaz.

Olgusal iddia taşımaz — dörtlü alan (bölüm 1.3) burada bulunmaz. Motorun kendi
hesabıdır, kaynağı `model_version` sütunudur. `updated_at` de yoktur (bölüm 1.2).

**İki seviye: çip ve kart.** `part_id` bir çipi de (`gpu_specs`) bir kartı da
(`gpu_variant_specs`) gösterebilir — ikisi de `parts` satırıdır, tabloda
değişiklik gerekmez. Okuma sırası:

```
indeks(kart) = perf_index[kart.part_id]  ??  perf_index[kart.chip_part_id]
```

Hangi seviyeden geldiği okuma anında türetilir ve arayüze verilir; şemada
sütunu yoktur (`perf_index`'te `source` yok — K32). Arayüz, çipten gelen bir
sayıyı kartın ölçümü gibi göstermez.

> **Bugün kart satırına `perf_index` yazılmaz.** Yazılabilmesinin tek yolu
> `benchmark_points`'ta kart bazlı ölçüm bulunmasıdır (K71); o alan da
> `gpu_part_id` ile kartı gösterebilir. Fabrika boost farkından üretilen bir
> kart indeksi K74 ihlalidir.

---

## 5. Sistemler

### `builds`

| Alan | Tip | Not |
|---|---|---|
| `id` | text | Kısa, paylaşılabilir slug: `k3n9x2` |
| `title` | text? | Kullanıcının verdiği ad |
| `total_price_minor` | integer | **Kayıt anında dondurulur** |
| `currency` | text | |
| `resolution` | enum | `1080p`, `1440p`, `2160p` — kullanıcının kaydettiği çözünürlük |
| `perf_index_snapshot` | float? | Kayıt anındaki indeks. Hesaplanamadıysa **null** |
| `model_version` | text | Kayıt anındaki motor sürümü |
| `created_at` | timestamptz | |

**Neden dondurulur:** Altı ay önce paylaşılan bir link bugün açıldığında, o günün
fiyatını ve o günün hesabını göstermelidir. Canlı fiyatla hesaplanırsa eski linkler
yanlış bilgi verir ve bu sonradan düzeltilemez.

Güncel fiyatı ayrıca göstermek serbest — ama dondurulmuş değerin üzerine yazılmaz.

**Neden `resolution` saklanır:** Sistem indeksi çözünürlüğe göre değişir (bölüm 8).
Çözünürlük yazılmasaydı dondurulan sayı neyi ifade ettiği bilinmeyen bir sayı
olurdu. Kullanıcı hangi çözünürlükte kaydettiyse indeks o çözünürlükte hesaplanır
ve kayıtlı sistem sayfası hangisi olduğunu yazar.

Bu alan indeks hesaplanamasa da doldurulur: kullanıcının o an baktığı çözünürlük,
kaydın kendisi hakkında bir olgudur.

**Neden `perf_index_snapshot` null olabilir:** Ekran kartsız (iGPU) bir sistem
uyumluluk kurallarına göre geçerlidir (bölüm 7, C4 ve W4) ama indeksi
hesaplanamaz — `perf_index` yalnızca `gpu` ve `cpu` için vardır. Alan zorunlu
kalsaydı geçerli bir sistem kaydedilemezdi; bu bir hatadır.

Null, "indeks sıfır" demek **değildir**: hesaplanamadı demektir. Kayıtlı sistem
sayfası sayı yerine sebebini yazar. Sıfır yazılsaydı sistem, olmadığı kadar
yavaş görünürdü ve bu sayı donduğu için düzeltilemezdi.

`model_version` bu durumda da yazılır ve "kayıt anında hangi motor sürümü
çalışıyordu" sorusunu cevaplar — hangi sürümün indeks üretemediği de bilgidir.

### `build_items`

Birincil anahtar **bileşiktir: (`build_id`, `part_id`)**. Ayrı `id` yoktur (bölüm 1.1).
Yan etkisi istenen bir kısıttır: aynı parça bir sistemde iki satır olamaz, adet
`quantity` ile ifade edilir.

| Alan | Tip |
|---|---|
| `build_id` | FK — birincil anahtarın parçası |
| `part_id` | FK — birincil anahtarın parçası |
| `quantity` | int |
| `unit_price_minor_at_save` | integer |

> `builds` ilk günden kalıcı bir nesnedir. Kullanıcı hesabı eklendiğinde yapılacak
> tek şey bu tabloya `user_id` eklemektir — yeniden yazım gerekmez.

---

## 6. Yardımcı tablolar

### `raw_imports`

| Alan | Tip |
|---|---|
| `id` | uuid |
| `source` | text |
| `payload` | jsonb / text |
| `imported_at` | timestamptz |
| `status` | enum (`pending`, `processed`, `failed`) |
| `error` | text? |

Normalizasyon mantığında hata bulunduğunda buradan yeniden işlenir.

### `click_events` — yönlendirme katmanı

| Alan | Tip |
|---|---|
| `id` | uuid |
| `part_id` | FK |
| `build_id` | FK? |
| `target_url` | text |
| `created_at` | timestamptz |

Ürün linkleri `/git/<part-slug>` üzerinden geçer. Beta'da sadece tıklama sayar;
affiliate'e geçildiğinde hedef adres tek noktadan değiştirilir.

### `feedback`

| Alan | Tip |
|---|---|
| `id` | uuid |
| `message` | text |
| `build_id` | FK? |
| `page_url` | text? |
| `created_at` | timestamptz |

E-posta veya kişisel veri toplanmaz.

---

## 7. Uyumluluk kuralları

**Bunlar veri değil, koddur.** `/engine/compatibility.ts` içinde saf fonksiyonlar olarak
yazılır. Veritabanına erişmez, parça nesnelerini girdi alır.

### Engelleyici (hata)

| # | Kural |
|---|---|
| C1 | `cpu.socket === motherboard.socket` |
| C2 | `ram.memory_type === motherboard.memory_type` |
| C3 | `ram.module_count <= motherboard.memory_slots` |
| C4 | `psu.wattage >= tahmini_tüketim` |
| C5 | `gpu.length_mm <= case.max_gpu_length_mm` |
| C6 | `motherboard.form_factor ∈ case.supported_form_factors` |

**Tahmini tüketim (C4):**
```
temel   = cpu.tdp_watt + gpu.tdp_watt + 100
gerekli = ceil(temel * 1.3)
```
1.3 katsayısı geçici tepe yükler ve verim payı içindir.
GPU seçilmemişse `gpu.tdp_watt` 0 sayılır — iGPU'lu sistem geçerli bir sistemdir.

W3'ün üst sınırı %15'tir: güç kaynakları tam kapasiteye yakın çalışırken verimi
düşer ve sesi artar, %10 bu gerçeği yakalamak için dar kalıyordu.

### Ekran kartında hangi sayı kullanılır — çip mi kart mı

Kullanıcı çip seçer, kart seçimi opsiyoneldir (bölüm 2, `gpu_variant_specs`).
C4 ve C5'in okuduğu değer buna göre değişir — ve **kart seçili ama değeri boşsa
iki kural aynı davranmaz** (K87).

| Durum | C4 (güç) | C5 (uzunluk) |
|---|---|---|
| Kart seçili, değeri var | kartın `tbp_watt`'ı | kartın `length_mm`'i |
| Kart seçili, değeri boş | **çipin `tdp_watt`'ı** — arayüz "referans değerle" der | **kural atlanır** — arayüz söyler |
| Kart seçili değil | çipin `tdp_watt`'ı | çipin referans `length_mm`'i |

**Neden aynı değiller:** C4 yaklaşık bir hesaptır ve içinde ×1.3 payı vardır;
referans değerle çalışması, en yüksek sonuçlu kuralı en sık durumda sessiz
bırakmaktan iyidir. C5 tam sayı karşılaştırmasıdır, payı yoktur ve AIB kartları
referanstan **uzun** olur — referansa geri düşmek 358 mm'lik karta "sığar"
demek olurdu, yani satın alınıp takılamayan kart.

> **Genel kural (K87):** Yaklaşık ve pay içeren kural, eksik veride referansa
> geri düşer. Kesin ve paysız kural atlanır. Her iki durumda da arayüz
> kullanıcıya durumu söyler; sessizce ne varsayılır ne atlanır.

Çözümleme motorun içinde, `/engine/gpu-selection.ts`'te saf fonksiyon olarak
yapılır; motora yine tek bir `EngineGpu` girer, katalog yapısını tanımaz.

### Uyarı (engellemez)

| # | Kural |
|---|---|
| W1 | `ram.speed_mhz > motherboard.max_memory_speed_mhz` → RAM düşük hızda çalışır |
| W2 | `ram.capacity_gb > motherboard.max_memory_gb` |
| W3 | `psu.wattage` gerekliye çok yakın: `gerekli <= wattage < gerekli * 1.15` |
| W4 | Sistemde GPU yok ve `cpu.has_igpu === false` |
| W5 | `psu.length_mm > case.max_psu_length_mm` |

Her kuralın çıktısı: `{ code, level, message, involved_part_ids[] }`

---

## 8. Performans motoru — v0.1

`/engine/performance.ts`. Saf fonksiyon. Oyun bazlı FPS **değil** — tek skor.

### Sistem indeksi

Motor girdisini yalnızca `perf_index`'ten alır. Parçanın spec alanlarına
(çekirdek sayısı, saat hızı, VRAM) **bakmaz** — sebebi bölüm 2'deki notta.

Beta'da okunan iş yükü `gaming`'dir.

```
gpu_idx = perf_index(gpu)      // 0-100, workload = 'gaming'
cpu_idx = perf_index(cpu)      // 0-100, workload = 'gaming'

ağırlıklar (çözünürlüğe göre):
  1080p → gpu 0.55, cpu 0.45
  1440p → gpu 0.75, cpu 0.25
  2160p → gpu 0.88, cpu 0.12

system_index = gpu_idx * w_gpu + cpu_idx * w_cpu
```

### Ölçek — sabit referans (K73)

İndeks bir sıralama değil, **sabit bir referans parçaya göre orandır**:

```
gpu_idx(RTX 4070)      = 100   (referans ekran kartı)
cpu_idx(Ryzen 5 9600X) = 100   (referans işlemci)
```

Daha hızlı parçalar 100'ü aşar; üst sınır yoktur.

**Neden en hızlı parça 100 değil:** ölçek kataloğun en hızlısına bağlanırsa,
daha hızlı bir kart eklendiği gün bütün indeksler aşağı kayar. Kullanıcının
donanımı değişmediği hâlde bandı düşer ve aşağıdaki tablo sessizce anlam
değiştirir. Sabit referansta bu olmaz; geçmişe dönük tutarlılık korunur.

Referansların ikisi de **orta segment** seçildi: üstünde de altında da yer
kalsın diye. İkisi de 100 olduğu için **referans sistem her çözünürlükte tam
100 verir** — ağırlıklar ne olursa olsun. Bant tablosunun sabit dayanağı budur.

### Bantlar

| İndeks | Etiket |
|---|---|
| 0–40 | 1080p düşük ayar |
| 40–65 | 1080p orta/yüksek ayar |
| 65–90 | 1440p yüksek ayar |
| 90–130 | 1440p ultra / 4K yüksek |
| 130+ | 4K ultra |

> **Bu sınırlar geçicidir.** Referans değişince eski sınırlar (0–25 … 80–100)
> anlamını yitirdi ve yenileri şimdilik referans sistemin 100'de durduğu
> varsayımıyla yerleştirildi. Gerçek `benchmark_points` verisi geldiğinde
> ölçülmüş sistemlere karşı **doğrulanmaları gerekiyor**; özellikle ağırlıklı
> toplamın orta segment işlemciyi 100 sayması, zayıf kartlı sistemleri
> olduğundan yukarı çekebilir. Doğrulanmadan bantlar kesinleşmiş sayılmaz.

### Darboğaz göstergesi — marjinal kazanç (K83)

Soru şu: **"hangi parçayı değiştirirsem daha çok kazanırım?"**

```
kazanç_gpu = max(0, en_iyi_gpu_idx - gpu_idx) * w_gpu
kazanç_cpu = max(0, en_iyi_cpu_idx - cpu_idx) * w_cpu

en_büyük = max(kazanç_gpu, kazanç_cpu)

en_büyük == 0                             → dengeli (yükseltilecek bir şey yok)
|kazanç_gpu - kazanç_cpu| / en_büyük < 0.20 → dengeli
kazanç_gpu > kazanç_cpu                    → GPU sınırlıyor
kazanç_cpu > kazanç_gpu                    → CPU sınırlıyor
```

`en_iyi_gpu_idx` / `en_iyi_cpu_idx` kataloğun o andaki en yüksek indeksleridir
ve motora **girdi olarak** verilir — motor katalogu tanımaz. Verilmezlerse
`bottleneck` **null** döner ve arayüz satırı hiç göstermez; bilinmeyen şey
uydurulmaz.

Kazançlar ağırlıklarla çarpılır çünkü kazanç ancak sistem indeksine yansıdığı
kadar gerçektir: 4K'da işlemciyi yükseltmenin katkısı zaten küçüktür. Bunun
sonucu olarak **darboğaz kararı çözünürlüğe göre değişebilir** — v0.1'de
değişmiyordu.

**Neden fark değil kazanç:** İki indeks farklı referanslara göre normalize
(`gpu_idx`'te RTX 4070 = 100, `cpu_idx`'te Ryzen 5 9600X = 100, bkz. K73) ve
dinamik aralıkları farklı. Farklarını almak iki ayrı cetvelin sayılarını
çıkarmaktı; RTX 5090 + Ryzen 7 9800X3D — piyasanın en hızlı oyun işlemcisi —
"işlemci sınırlıyor" çıkıyordu. Marjinal kazanç ölçekten bağımsızdır.

Çıktı her zaman "tahmini" ibaresiyle gösterilir. Gerçek FPS iddiası edilmez.

### Yükseltme önerisi

Girdi: mevcut sistem, bütçe farkı (örn. +2000 TL).
Her kategori için, `mevcut_fiyat + fark` bütçesindeki alternatifler taranır,
`system_index` artışı en yüksek olan seçilir.

Çıktı: `{ category, current_part, suggested_part, price_delta_minor, index_delta }`

---

## 9. URL yapısı

Sonradan değiştirilmez.

| Adres | İçerik |
|---|---|
| `/` | Ana sayfa / sistem oluşturucu |
| `/parca/<slug>` | Parça detayı |
| `/parca/kategori/<category>` | Kategori listesi |
| `/sistem/<build-id>` | Kaydedilmiş sistem (paylaşılabilir) |
| `/git/<part-slug>` | Satıcıya yönlendirme |
| `/hakkinda`, `/gizlilik` | Statik sayfalar |

---

## 10. Beta'ya dahil olmayanlar

Bu tablolar ve alanlar **şimdi yazılmaz**, ama şema onları engellemeyecek şekilde kurulur:

- `users` → `builds.user_id` eklenerek bağlanacak
- Oyun bazlı FPS → `benchmark_points` + `games` zaten hazır, motor genişleyecek
- Otomatik fiyat → `price_snapshots` yapısı aynı kalır, sadece yeni `source` değeri
- Mobil → motor bağımsız olduğu için değişiklik gerekmez
- **Çoklu iş yükü skorları** (AI çıkarımı, video kodlama, üretkenlik) →
  `workload` alanı ve tekillik kısıtı hazır. Eksik olan şema değil **veri**:
  her iş yükü kendi ölçümünü gerektirir, spec alanlarından türetilemez.
  Bkz. `docs/KARARLAR.md` K36. `game_id`'nin oyun dışı ölçümlerde ne olacağı
  açık soru (`SORULAR.md` S16).

---

## 11. İndeksler

Bir indeks ancak **belgelenmiş bir sorgu yolunu** hızlandırıyorsa eklenir ve
buraya yazılır. Burada olmayan indeks şemaya girmez.

Birincil anahtarların ve tekillik kısıtlarının kendiliğinden ürettiği indeksler
burada sayılmaz.

| Tablo | İndeks | Hangi sorgu yolu için |
|---|---|---|
| `parts` | (`source`) | Dev-seed filtresi. Veri erişim katmanı canlı ortamda her sorguya `source <> 'dev-seed'` ekler; bu sütun her okumada taranır. |
| `parts` | (`category`) | Kategori listesi sayfası — `/parca/kategori/<category>` (bölüm 9). |
| `price_snapshots` | (`part_id`, `collected_at`) | "Güncel fiyat = en son `collected_at`'li satır" tanımının kendisi. Tablo append-only olduğu için sürekli büyür; bu yol indekssiz çalışamaz. |
| `benchmark_points` | (`gpu_part_id`, `game_id`, `resolution`) | Motorun kalibrasyon verisini okuma yolu — belirli GPU + oyun + çözünürlük için ölçümler. |
| `perf_index` | (`part_id`, `workload`, `model_version`) **UNIQUE** | Hem tekillik kısıtı (bölüm 4) hem de motorun indeks okuma yolu. |
| `gpu_variant_specs` | (`chip_part_id`) | "Bu çipin kartları" — kart seçim listesi ve parça detay sayfası. Kartlar her zaman çipleriyle birlikte okunur, tek başına değil. |

**Silinen indeks:** `raw_imports(status)` kaldırıldı — `raw_imports` yalnızca hata
ayıklarken elle okunur, belgelenmiş bir sorgu yolu değildir.

---

## 12. Kararlar

Şemayla ilgili verilen kalıcı kararlar (K1-K7) `docs/KARARLAR.md` dosyasındadır.
Tek yerde tutulmalarının sebebi: aynı kararın iki dosyada durup zamanla
birbirinden ayrışmasını önlemek.

Bu belge **ne** olduğunu tanımlar; `docs/KARARLAR.md` belirsiz kalan noktaların
**neden** öyle çözüldüğünü anlatır.

Bu şemanın çalışan karşılığı `prisma/schema.prisma` dosyasındadır ve alan adları
buradakiyle birebir aynıdır. İndeks tanımları orada bulunur; indeks bir alan
değildir, bu belgenin kapsamı dışındadır.
