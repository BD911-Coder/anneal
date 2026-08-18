# 2026-08-19 — Elle veri girişi: iki parçalık akış denemesi

S19 kapandı: elle giriş onaylandı. Bu rapor, **38 parçanın 2'si** için tam
akışı (üretici sayfası → CSV → içe aktarma) kurup ölçüyor.

Kalan 36 parça **başlatılmadı** — bir karar bekliyor (S20, aşağıda) ve akışın
doğrulanması isteniyordu.

---

## Ne kuruldu

| Parça | Ne işe yarıyor |
|---|---|
| `data/parts/cpu.csv`, `data/parts/gpu.csv` | Kaynak veri, depoda versiyonlu |
| `data/parts/README.md` | CSV kuralları — kaynak, boş alan, normalizasyon |
| `scripts/import-parts.mts` | İki aşamalı içe aktarma |
| `npm run parca:aktar` | Çalıştırma |

Kararlar: **K49** (Wikidata birincil kaynak olmayacak, 2027 yazında tekrar
bakılacak), **K50** (elle giriş yöntemi).

---

## 1. Üretici sayfasından spec çekme

### AMD Ryzen 7 9800X3D — sekiz alanın sekizi bulundu

Kaynak: `amd.com/.../amd-ryzen-7-9800x3d.html`

```
# of CPU Cores      -> 8
# of Threads        -> 16
Base Clock          -> 4.7 GHz
Max. Boost Clock    -> Up to 5.2 GHz
Default TDP         -> 120W
CPU Socket          -> AM5
System Memory Type  -> DDR5
Graphics Model      -> AMD Radeon™ Graphics     (-> has_igpu = true)
Launch Date         -> 11/07/2024               (-> release_year = 2024)
```

`cpu_specs`'in zorunlu sekiz alanı da sayfada yazılı. Eksik yok.

### NVIDIA GeForce RTX 5090 — yedi alanın yedisi, biri normalize edildi

Kaynak: `nvidia.com/en-us/geforce/graphics-cards/50-series/rtx-5090/`

```
GPU Memory Size          -> "32 GB GDDR7"
GPU Memory Type          -> "GDDR7"
Total Graphics Power     -> "575" watts
Required System Power    -> "1000" watts minimum
Card Length              -> "304 mm"
PCI Express Interface    -> "Gen 5"
```

**`pcie_version` = `PCIe 5.0`.** Sayfa "Gen 5" diyor; bu aynı olgunun başka
yazımı, normalizasyon. Ama dev-seed'de yazan `PCIe 5.0 x16`'daki **hat sayısı
(x16) sayfada yok — eklenmedi.** Uydurma ile normalizasyon arasındaki çizgi
burada.

**`chipset` = `GeForce RTX 5090`.** Yonga kod adı (GB202) sayfada yok. Ürün
adı, üreticinin kendi yonga tanımı olarak alındı; ileride aynı yongayı taşıyan
üçüncü parti kartlar eklendiğinde `model` değişir, `chipset` aynı kalır.

**`release_year` boş bırakıldı** — NVIDIA ürün sayfasında çıkış tarihi yazmıyor.
Bu alan şemada opsiyonel (`release_year Int?`), o yüzden parça yine de geçerli.

### Araç notu

`WebFetch` NVIDIA sayfasını okudu ama **amd.com'a bağlanamadı** (bir denemede
`ECONNRESET`, bir denemede 60 sn zaman aşımı). AMD sayfası `curl` ile çekilip
HTML'den ayrıştırıldı. İkisi de aynı şeyi yapıyor — üretici sayfasından okuma —
sadece araç farklı.

---

## 2. CSV: kaynak veri depoda

```
data/parts/cpu.csv
id,brand,model,release_year,collected_at,source_url,socket,cores,threads,...
amd-ryzen-7-9800x3d,AMD,Ryzen 7 9800X3D,2024,2026-08-19,https://www.amd.com/...,AM5,8,16,4700,5200,120,DDR5,true
```

**Satır düzeyinde tek kaynak.** `source_url` şemada satır düzeyindedir, değer
düzeyinde değil (`SCHEMA.md` bölüm 1.3). Bu yüzden bir satırın **bütün**
değerleri aynı sayfadan gelmek zorunda; olmayan alan boş bırakılıyor. Aksi
halde satırın kaynak adresi yalan söylerdi.

`source` ve `confidence` CSV'de yok — içe aktarma sabit olarak `manufacturer`
ve `high` yazıyor. `collected_at` CSV'de sütun: verinin **toplandığı** an.

**Slug düzeltmesi:** İlk denemede GPU'ya `nvidia-geforce-rtx-5090` slug'ı
verilmişti. `SCHEMA.md` bölüm 2'nin kendi örneği `nvidia-rtx-5070` — yani
"geforce" içermiyor. Slug bir kez atanınca değişmediği için bu kalıcı bir hata
olurdu; iki satır silinip CSV `nvidia-rtx-5090` olarak düzeltildi ve yeniden
aktarıldı.

---

## 3. İçe aktarma: iki aşama

`SCHEMA.md` bölüm 0, kural 3 gereği önce ham, sonra normalize.

```
$ npm run parca:aktar
Hedef: aws-0-eu-central-1.pooler.supabase.com
Kaynak damgasi: source='manufacturer', confidence='high'

cpu.csv (cpu) — 1 satir
  [TAMAM] amd-ryzen-7-9800x3d
gpu.csv (gpu) — 1 satir
  [ATLA ] nvidia-rtx-5090 — slug zaten var (mevcut source='dev_seed') — davranis karari bekleniyor, S20

OZET: 1 aktarildi, 1 atlandi (slug var), 0 hata.
raw_imports: 2 satir. manufacturer kaynakli parca: 1.
```

**Veritabanında ne var:**

```
=== 1. ASAMA: raw_imports (ham) ===
  processed  manual-csv:data/parts/cpu.csv
     payload: {"id":"amd-ryzen-7-9800x3d","brand":"AMD","cores":"8",...}
  failed     manual-csv:data/parts/gpu.csv
     payload: {"id":"nvidia-rtx-5090","brand":"NVIDIA","chipset":"GeForce RTX 5090",...}
     error  : slug zaten var (mevcut source='dev_seed') — davranis karari bekleniyor, S20

=== 2. ASAMA: normalize edilmis parca ===
  parts: amd-ryzen-7-9800x3d | AMD Ryzen 7 9800X3D | yil=2024 | kategori=cpu
         source=manufacturer confidence=high collected_at=2026-08-19
         source_url=https://www.amd.com/en/products/processors/desktops/ryzen/...
  cpu_specs: soket=AM5 cekirdek=8 thread=16 base=4700 boost=5200
             tdp=120 bellek=DDR5 igpu=true
             source=manufacturer confidence=high

=== kaynak dagilimi ===
  manufacturer: 1
  dev_seed: 29
```

Ham satır CSV'deki hâliyle duruyor (hepsi metin, çevrilmemiş). Başarısız satır
da `raw_imports`'ta duruyor — CSV silinse bile ne denendiği kayıtlı.

**Zorunlu alan boşsa** satır reddediliyor ve `raw_imports.error`'a
`zorunlu alan bos: <alanlar>` yazılıyor. Bu denemede tetiklenmedi; iki parçanın
da zorunlu alanları tamdı.

---

## 4. Cevap bekleyen soru — akışı engelliyor

**S20: aynı slug ikinci kez geldiğinde ne olacak?**

Bu, denemenin ortasında **kendiliğinden çıktı**: `nvidia-rtx-5090` slug'ı
veritabanında zaten dev-seed olarak vardı.

Ve bu tek seferlik bir kaza değil. Şu an 29 dev-seed parça var; elle girilecek
gerçek parçaların çoğu **aynı fiziksel donanım**. Slug marka+model'den
türetildiği ve asla değişmediği için çakışma kaçınılmaz.

Şu anki geçici davranış: dokunma, atla, sebebi yaz.

Dört seçenek ve önerim (2. seçenek: dev-seed'in üzerine yaz, gerçek verinin
üzerine yazma) `SORULAR.md` S20'de.

**Kalan 36 parça bu karar verilmeden aktarılamaz** — çoğu aynı çakışmaya
girecek.

---

## 5. Sırada ne var (karar sonrası)

Onay gelirse kalan 36 parça aynı akıştan geçecek. Dağılım ve kural kapsamı
planı:

| Kategori | Adet | Kural kapsamı için gereken çeşitlilik |
|---|---|---|
| CPU | 8 | AM5 + LGA1851 karışık (**C1**), en az biri `has_igpu=false` (**W4**), biri yüksek TDP (**C4**) |
| GPU | 8 | NVIDIA 50 + AMD 9000, 60'tan 90'a; biri uzun kart (**C5**), biri çok aç (**C4**) |
| Anakart | 6 | 3 AM5 farklı chipset + 3 Intel; DDR4 ve DDR5 ikisi de (**C2**), biri 2 yuvalı (**C3**), biri düşük `max_memory_speed` (**W1**), biri düşük `max_memory_gb` (**W2**), biri E-ATX (**C6**) |
| RAM | 4 | DDR5 farklı hız/kapasite + 1 DDR4 (**C2**), biri 4 modüllü (**C3**), biri yüksek hız (**W1**), biri yüksek kapasite (**W2**) |
| PSU | 4 | 550W–1000W (**C4**, **W3**), biri uzun gövde (**W5**) |
| Kasa | 4 | ITX/mATX/ATX (**C6**), GPU açıklığı farklı (**C5**), biri dar PSU yuvası (**W5**) |
| Depolama | 4 | Kurala girmiyor (S12) |

Hangi parçanın hangi kuralı tetiklediği, parçalar seçildikten sonra **gerçek
spec değerleriyle** tablo hâlinde yazılacak — şu an tahmin yazmıyorum, çünkü
hangi değerin sayfada bulunacağı belli değil.

**Riskli görünen alan:** `case_specs` (`max_gpu_length_mm`,
`max_cpu_cooler_height_mm`, `max_psu_length_mm`) ve `psu_specs.length_mm`.
Kasa üreticileri bu üçünü genelde yazıyor ama PSU uzunluğunu her marka
vermiyor. Zorunlu alan bulunamazsa o parça değiştirilecek ve raporda yazılacak.

---

## Ne doğrulandı

```
$ npm run parca:aktar    1 aktarildi, 1 atlandi, 0 hata
$ npx tsc --noEmit       (çıktı yok)
$ npm run lint           (çıktı yok)
$ npm run sema:kontrol   SONUC: 70 kontrolun tamami gecti.
$ npm test               105 passed (105)
$ npm run build          ✓ Compiled successfully
```

Veritabanında: 30 parça (29 dev-seed + 1 manufacturer), 2 `raw_imports` satırı.

**Doğrulanmayan:** Tarayıcıda yeni parçanın listede görünmesi. Sunucu tarafı
ölçüldü, ekranı proje sahibi görecek.

---

## Açık kalan sorular

**S20 (yeni, engelleyici)** — aynı slug ikinci kez geldiğinde ne olacak?

**S18, S16, S15** — değişmedi. **S19 kapandı.**

Güncel liste: `SORULAR.md`
