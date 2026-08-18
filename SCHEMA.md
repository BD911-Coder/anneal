# Anneal — Alan Modeli (Domain Model) — v1.0

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

Her tabloda bulunur:

| Alan | Tip | Açıklama |
|---|---|---|
| `id` | text / uuid | Kalıcı kimlik |
| `created_at` | timestamptz | Kayıt oluşturulma anı |
| `updated_at` | timestamptz | Son değişiklik anı |

Dışarıdan veri taşıyan her tabloda ayrıca:

| Alan | Tip | Açıklama |
|---|---|---|
| `source` | enum | `manual`, `dev-seed`, `manufacturer`, `affiliate`, `user`, `import` |
| `source_url` | text? | Verinin alındığı adres |
| `confidence` | enum | `high`, `medium`, `low` |
| `collected_at` | timestamptz | Verinin **toplandığı** an (kaydedildiği an değil) |

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

**`gpu_specs`**

| Alan | Tip |
|---|---|
| `part_id` | FK |
| `chipset` | text |
| `vram_gb` | int |
| `vram_type` | text (`GDDR6`, `GDDR7`) |
| `tdp_watt` | int |
| `length_mm` | int |
| `recommended_psu_watt` | int |
| `pcie_version` | text |

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
| `efficiency_rating` | text (`80+ Bronze`, `80+ Gold`) |
| `modularity` | enum (`full`, `semi`, `none`) |
| `length_mm` | int |

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
| `supported_form_factors` | text[] (`{ATX, mATX, ITX}`) |
| `max_gpu_length_mm` | int |
| `max_cpu_cooler_height_mm` | int |
| `max_psu_length_mm` | int |

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

---

## 4. Benchmark ve performans

### `games`

| Alan | Tip | Not |
|---|---|---|
| `id` | text | Slug: `cyberpunk-2077` |
| `name` | text | |
| `release_year` | int | |
| `gpu_weight` | float | 0–1, oyunun GPU'ya bağımlılığı |
| `cpu_weight` | float | 0–1 |

### `benchmark_points` — **append-only**

Elle toplanan gerçek ölçümler. Motorun kalibrasyon verisi.

| Alan | Tip | Not |
|---|---|---|
| `id` | uuid | |
| `gpu_part_id` | FK | |
| `cpu_part_id` | FK? | Bilinmiyorsa null |
| `game_id` | FK | |
| `resolution` | enum | `1080p`, `1440p`, `2160p` |
| `preset` | enum | `low`, `medium`, `high`, `ultra` |
| `upscaling` | text? | `none`, `DLSS-Q`, `FSR-Q` |
| `avg_fps` | float | |
| `one_percent_low_fps` | float? | |
| `source_type` | enum | `review`, `user_submission`, `own_test` |
| `source_url`, `confidence`, `collected_at` | — | **Zorunlu.** Kaynak defteri budur. |

> Tek bir kaynaktan toplu veri alınmaz. Her satır ayrı ayrı, kaynağı yazılarak girilir.

### `perf_index` — hesaplanmış, sürümlü

| Alan | Tip | Not |
|---|---|---|
| `part_id` | FK | Sadece `gpu` ve `cpu` |
| `index_value` | float | 0–100 |
| `model_version` | text | `v0.1` |
| `computed_at` | timestamptz | |

Aynı parça için farklı `model_version`'lar bir arada durur. Eski sürümler silinmez —
model değiştiğinde karşılaştırma yapabilmenin tek yolu budur.

---

## 5. Sistemler

### `builds`

| Alan | Tip | Not |
|---|---|---|
| `id` | text | Kısa, paylaşılabilir slug: `k3n9x2` |
| `title` | text? | Kullanıcının verdiği ad |
| `total_price_minor` | integer | **Kayıt anında dondurulur** |
| `currency` | text | |
| `perf_index_snapshot` | float | Kayıt anındaki indeks |
| `model_version` | text | O indeksi üreten motor sürümü |
| `created_at` | timestamptz | |

**Neden dondurulur:** Altı ay önce paylaşılan bir link bugün açıldığında, o günün
fiyatını ve o günün hesabını göstermelidir. Canlı fiyatla hesaplanırsa eski linkler
yanlış bilgi verir ve bu sonradan düzeltilemez.

Güncel fiyatı ayrıca göstermek serbest — ama dondurulmuş değerin üzerine yazılmaz.

### `build_items`

| Alan | Tip |
|---|---|
| `build_id` | FK |
| `part_id` | FK |
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

### Uyarı (engellemez)

| # | Kural |
|---|---|
| W1 | `ram.speed_mhz > motherboard.max_memory_speed_mhz` → RAM düşük hızda çalışır |
| W2 | `ram.capacity_gb > motherboard.max_memory_gb` |
| W3 | `psu.wattage` gerekliye çok yakın (%10'dan az pay) |
| W4 | Sistemde GPU yok ve `cpu.has_igpu === false` |
| W5 | `psu.length_mm > case.max_psu_length_mm` |

Her kuralın çıktısı: `{ code, level, message, involved_part_ids[] }`

---

## 8. Performans motoru — v0.1

`/engine/performance.ts`. Saf fonksiyon. Oyun bazlı FPS **değil** — tek skor.

### Sistem indeksi

```
gpu_idx = perf_index(gpu)      // 0-100
cpu_idx = perf_index(cpu)      // 0-100

ağırlıklar (çözünürlüğe göre):
  1080p → gpu 0.55, cpu 0.45
  1440p → gpu 0.75, cpu 0.25
  2160p → gpu 0.88, cpu 0.12

system_index = gpu_idx * w_gpu + cpu_idx * w_cpu
```

### Bantlar

| İndeks | Etiket |
|---|---|
| 0–25 | 1080p düşük ayar |
| 25–45 | 1080p orta/yüksek ayar |
| 45–65 | 1440p yüksek ayar |
| 65–80 | 1440p ultra / 4K yüksek |
| 80–100 | 4K ultra |

### Darboğaz göstergesi (basit)

```
beklenen_cpu = gpu_idx * (w_cpu / w_gpu ile ölçeklenmiş eşik)
fark = gpu_idx - cpu_idx

|fark| < 15  → dengeli
fark > 15    → CPU sınırlıyor
fark < -15   → GPU sınırlıyor
```

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
