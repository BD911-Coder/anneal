# 2026-08-19 — Kalan dört kategori, dev-seed temizliği ve kural doğrulaması

## Ne yapıldı

Beş kategorinin kalan dördü gerçek üretici verisiyle dolduruldu, sahte veri
silindi, ve 11 uyumluluk kuralının her birinin gerçek veriyle tetiklenebildiği
somut örneklerle gösterildi.

### Kategori başına sonuç

| Kategori | Önce | Sonra | Yeni |
|---|---|---|---|
| GPU | 60 | 60 | — |
| CPU | 39 | 40 | 1 (Ryzen 5 7500F) |
| Anakart | 19 | 19 | — |
| RAM | 2 | 14 | 12 |
| Depolama | 2 | 6 | 4 |
| Kasa | 2 | 5 | 3 |
| PSU | 2 | 4 | 2 |
| **Toplam** | **126** | **148** | **22** |

Hepsi `source = manufacturer`. dev-seed parçası kalmadı.

### RAM — 12 yeni kit

| Marka | Adet | Kaynak yolu |
|---|---|---|
| Crucial | 4 | `curl` + sayfadaki gömülü spec JSON |
| Kingston | 4 | SKU başına veri sayfası PDF'i |
| G.SKILL | 4 | `/specification/...` sayfası (sunucu tarafında üretiliyor) |

DDR4 dörtlüsü: Kingston DDR4-3200 ve DDR4-3600, Crucial DDR4-3200,
G.SKILL Ripjaws V 128GB (8x16GB) DDR4-2400.

### Depolama — 4 yeni sürücü

Samsung 990 EVO Plus 1TB, 9100 PRO 1TB (PCIe 5.0), 870 EVO 1TB (SATA SSD);
WD Blue WD20EZBX 2TB (HDD). Üç `storage_type` değeri de temsil ediliyor.

### Kasa — 3 yeni kasa

Fractal Design Meshify 2 Compact, Node 304, Terra.

### PSU — 2 yeni güç kaynağı

Corsair RM650e ve RM1000e.

---

## Hangi kararlar verildi ve neden

### K63 — Üretici veri sayfası (PDF) satır kaynağı olabilir

Kingston'ın aile sayfası CAS gecikmesini SKU başına vermiyor, yalnızca
"CL30, CL32, CL36" aralığı yayınlıyor. `cas_latency` zorunlu alan; o sayfadan
satır yazılamaz. SKU başına veri sayfası PDF'i bütün değerleri tek belgede
veriyor, `source_url` oraya verildi. WD SN850X satırı zaten böyleydi.

### K64 — Sahte veri temizliği parçalarla sınırlı, fiyatlarla değil

Gerçek parçalara bağlı 36 dev-seed fiyat ve 7 `perf_index` satırı **silinmedi**.
Fiyatların gerçek karşılığı henüz yok; silinseydi geliştirme ortamında hiç
fiyat ve performans verisi kalmazdı.

Beş sistem kaydı (`builds`) tamamen silindi: üçü dev-seed parçaya bağlıydı,
eksik parçalı sistem kaydı hiçbir işe yaramıyor.

### K65 — `has_igpu = false` yalnızca üretici açıkça söylüyorsa yazılır

Intel ARK, F serisi işlemcilerde grafik bölümünü hiç göstermiyor — "yok"
demiyor, alan sayfada bulunmuyor. Alanın yokluğundan `false` çıkarmak K60'ın
yasakladığı çıkarım. **Core i5-14400F ve i7-14700F eklenmedi.**

AMD Ryzen 5 7500F sayfası `Graphics Model = Discrete Graphics Card Required`
diyor. O satır yazıldı.

### K66 — Kuralların tetiklenebilirliği veriyle birlikte denetlenir

Yeni script `npm run kural:kontrol`. Testler kuralın mantığını doğruluyor;
bu script kuralın bugünkü veri kümesinde anlamı olduğunu doğruluyor.

### K59/K60/K62 disiplini nerede iş gördü

| Yer | Sayfadaki metin | Yazılan | Kural |
|---|---|---|---|
| Meshify 2 Compact PSU | `200 mm (165 mm with HDD cage and front fan)` | 165 | K59 |
| Meshify 2 Compact GPU | `341 mm (360 mm without front fan)` | 341 | K59 |
| Terra CPU soğutucu | `48 mm (Max GPU) / 77 mm (Max CPU-Cooler)` | 48 | K59 |
| Corsair RM650e/RM1000e uzunluk | `Dimensions 140x150x86` (eksen etiketsiz) | **boş** | K60 |
| WD Blue okuma hızı | `Transfer Rate up to 215MB/s` (okuma demiyor) | **boş** | K60 |

Ondalıklı açıklık değeri hiçbir sayfada çıkmadı; aşağı yuvarlama uygulanmadı.

### Şüpheli değer sayfaya tekrar soruldu

Samsung 990 EVO Plus 1TB sayfası iki farklı okuma hızı gösteriyor: SKU başlığı
**7.150 MB/s**, aile rozeti **7.250 MB/s**. 2TB sayfası çapraz kontrol edildi —
onun başlığı 7.250 diyor, yani başlık SKU'ya özel, rozet aile geneli.
**7150** yazıldı.

### Kaynak seçimi: Seasonic yerine Corsair

Seasonic'in seri sayfaları watt değerini varyant sekmesinde tutuyor; düz metinde
boyut bloklarıyla eşleşmiyor. 750W bloğuna 1000W'ın boyutunu yazma riski vardı.
Corsair'in SKU başına sayfaları belirsizlik bırakmıyor.

---

## Ne doğrulandı

### 11 kuralın hepsi gerçek veriyle tetikleniyor

`npm run kural:kontrol` çıktısı:

```
Gercek parca: 40 cpu, 60 gpu, 19 anakart, 14 bellek, 4 psu, 5 kasa

C1  tamam  — islemci soketi != anakart soketi
      ornek : intel-core-i7-14700 + asus-tuf-gaming-x870-plus-wifi
      tetikleyen kombinasyon sayisi: 470
C2  tamam  — bellek tipi != anakart bellek tipi
      ornek : asus-prime-h770-plus-d4 + kingston-fury-kf572c38rwk2-32
      tetikleyen kombinasyon sayisi: 82
C3  tamam  — modul sayisi > anakart yuva sayisi
      ornek : asus-tuf-gaming-x870-plus-wifi + gskill-ripjaws-v-128gb-2400
      tetikleyen kombinasyon sayisi: 19
C4  tamam  — guc kaynagi gereken watti karsilamiyor
      ornek : intel-core-i7-14700 + nvidia-rtx-3090 + corsair-rm650e
      tetikleyen kombinasyon sayisi: 883
C5  tamam  — ekran karti kasaya sigmiyor
      ornek : nvidia-rtx-3090 + fractal-design-node-304
      tetikleyen kombinasyon sayisi: 2
C6  tamam  — anakart form faktoru kasa tarafindan desteklenmiyor
      ornek : asus-tuf-gaming-x870-plus-wifi + fractal-design-node-304
      tetikleyen kombinasyon sayisi: 36
W1  tamam  — bellek hizi anakartin destekledigini asiyor
      ornek : asus-prime-h770-plus-d4 + kingston-fury-kf572c38rwk2-32
      tetikleyen kombinasyon sayisi: 29
W2  tamam  — bellek kapasitesi anakartin destekledigini asiyor
      ornek : msi-pro-h610m-e + crucial-pro-ddr5-128gb-5600
      tetikleyen kombinasyon sayisi: 2
W3  tamam  — guc kaynagi yetiyor ama pay dar
      ornek : intel-core-i7-14700 + nvidia-rtx-3090 + seasonic-focus-gx-750
      tetikleyen kombinasyon sayisi: 1179
W4  tamam  — ekran karti yok ve islemcide tumlesik grafik yok
      ornek : amd-ryzen-5-7500f
      tetikleyen kombinasyon sayisi: 1
W5  tamam  — guc kaynagi kasaya sigmayabilir
      ornek : seasonic-focus-gx-750 + fractal-design-terra
      tetikleyen kombinasyon sayisi: 1

11 kuralin hepsi gercek veriyle tetiklenebiliyor.
```

**Üç kural tek bir parçaya bağlı.** Bu parça silinirse kural ölü koda döner:

| Kural | Tek bağ | Kombinasyon |
|---|---|---|
| W4 | `amd-ryzen-5-7500f` | 1 |
| W5 | `seasonic-focus-gx-750` (tek etiketli PSU uzunluğu) | 1 |
| C5 | `fractal-design-node-304` (310 mm) + RTX 3090 / 3090 Ti | 2 |
| W2 | `crucial-pro-ddr5-128gb-5600` + `msi-pro-h610m-e` | 2 |

### dev-seed temizliği

```
Silinen satirlar:
  (etkilenen sistemler isaretlendi): 5
  build_items: 32
  builds (yarim kalan sistemler): 5
  price_snapshots: 51
  perf_index: 1
  cpu_specs: 1
  motherboard_specs: 5
  ram_specs: 3
  psu_specs: 3
  storage_specs: 3
  case_specs: 2
  parts: 17

Kalan dev-seed parcasi: 0
```

### Diğer kontroller

```
npm test              108 test, 3 dosya, hepsi gecti
npm run sema:kontrol  73 kontrolun tamami gecti
npx tsc --noEmit      cikti yok
npm run parca:aktar   OZET: 0 yeni, 148 guncellendi, 0 atlandi, 0 hata
```

---

## Açık kalan sorular

1. **Üç kural tek parçaya bağlı.** W4, W5 ve C5 birer/ikişer kombinasyonla
   ayakta duruyor. `npm run kural:kontrol` bunu yakalar ama uyarı vermez,
   yalnızca sayıyı yazar. Eşik konsun mu (örneğin "5'ten az kombinasyon =
   uyarı")?

2. **Intel F serisi işlemciler eksik.** i5-14400F ve i7-14700F piyasada en çok
   satılan işlemciler arasında ama ARK sayfaları tümleşik grafiğin yokluğunu
   yazmıyor (K65). Intel'in başka bir sayfası bunu açıkça söylüyor mu?
   Yoksa `has_igpu` opsiyonel mi olmalı?

3. **`case_specs`'in üç ölçü alanı hâlâ zorunlu.** K62 "fiziksel ölçü alanları
   asla zorunlu olmaz" diyor ama `max_gpu_length_mm`,
   `max_cpu_cooler_height_mm` ve `max_psu_length_mm` zorunlu kaldı. Bu turda
   sorun çıkmadı — Fractal üçünü de yayınlıyor. Başka bir üretici gelince
   çıkacak.

4. **Sahte fiyatlar duruyor.** Gerçek parçalara bağlı 36 dev-seed fiyat satırı
   silinmedi (K64). Fiyat kaynağı kurulduğunda bunlar da temizlenmeli.
