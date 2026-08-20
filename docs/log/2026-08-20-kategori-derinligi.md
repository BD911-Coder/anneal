# 2026-08-20 — Faz 1.2: kategori derinliği

Dört dar kategori hedeflenen sayılara ulaştı. **29 yeni parça**, hepsi
üreticinin kendi ürün sayfasından.

| Kategori | Önce | Sonra | Hedef |
|---|---|---|---|
| PSU | 4 | **12** | 12 ✓ |
| Kasa | 5 | **12** | 12 ✓ |
| Depolama | 6 | **14** | 14 ✓ |
| RAM | 14 | **20** | 20 ✓ |

Katalog toplamı 208 → **237** gerçek parça.

---

## 1. PSU — 4 → 12

Sekiz yeni Corsair. Kapsam 550W–1200W, Bronze'dan Platinum'a, biri SFX.

| Güç | Model | Verimlilik | Modülerlik |
|---|---|---|---|
| 550W | CX550 | 80+ Bronze | yok |
| 650W | CX650 | 80+ Bronze | yok |
| 750W | RM750e | Cybenetics Gold | tam |
| 750W | RM750x | Cybenetics Gold | tam |
| 750W | RM750x SHIFT | 80+ Gold | tam |
| 750W | SF750 (SFX) | 80+ Platinum | tam |
| 850W | RM850x SHIFT | 80+ Gold | tam |
| 1200W | HX1200i | 80+ Platinum | tam |

**Yanlış ürünün fiyatı hatasının spec karşılığı yakalandı.** Corsair ürün
sayfalarında benzer ürünlerin spec'leri de JSON olarak gömülü duruyor. İlk
çıkarıcı RM750e sayfasından **RM850e'nin 850W'ını** okuyordu. Sayfanın kendi
spec tablosu (`TechSpecItem` satırları) çapa olarak kullanılınca düzeldi.

`length_mm` sekizinde de **boş** (K60): Corsair "Dimensions 160mm x 150mm x
86mm" diyor ama ekseni etiketlemiyor.

## 2. Kasa — 5 → 12

Yedi yeni Fractal Design. GPU açıklığı **290–423 mm**, form faktörler ITX'ten
E-ATX'e.

**K59 (birden fazla değer varsa en küçüğü) sekiz alanda iş gördü:**

| Kasa | Alan | Sayfada yazan | Yazılan |
|---|---|---|---|
| Meshify 2 | GPU | `Open layout: 470 mm (445 mm w/ front fan) - Storage layout: 290 mm` | **290** |
| North XL | GPU | `413 mm with front fan / 380 mm with 33 mm radiator` | **380** |
| North XL | PSU | `1 HDD Tray: 290mm max, 2 HDD Trays: 175 mm` | **175** |
| North XL | soğutucu | `155 mm (Mesh) / 185 mm (TG) / 169 mm (R)` | **155** |
| Torrent | GPU | `461 mm total, 423 mm with front fan mounted` | **423** |
| Define 7 Compact | GPU | `341 mm (360 mm without front fan)` | **341** |
| Define 7 Compact | PSU | `200 mm total (165 mm w/ HDD cage ...)` | **165** |
| Ridge | GPU | `325 mm with SSD installed. 335 mm without SSD` | **325** |

**K60:** Ridge'in `max_psu_length_mm` alanı **boş**. Sayfa "SFX-L" diyor — bu
bir ölçü değil, form faktör adı. Uzunluğu yazmak için SFX-L standardına bakmak
gerekirdi ve o sayfada yok.

Meshify 2 dikkat çekici: E-ATX'e kadar anakart alıyor ama depolama düzeninde
kataloğun **en dar GPU açıklığına** sahip kasa (290 mm).

## 3. Depolama — 6 → 14

| Sürücü | Arayüz | Okuma |
|---|---|---|
| Crucial T705 2TB | NVMe PCIe **Gen5** x4 | 14.500 MB/s |
| Crucial T500 2TB | NVMe PCIe Gen4 x4 | 7.400 MB/s |
| Crucial P310 2TB | NVMe PCIe Gen4 x4, **M.2 2230** | 7.100 MB/s |
| Samsung 990 EVO Plus 2TB | PCIe 4.0 | 7.250 MB/s |
| Samsung 990 PRO 4TB | PCIe 4.0 | 7.450 MB/s |
| Samsung 870 EVO 2TB | SATA III | 560 MB/s |
| WD Blue WD10EZEX 1TB | SATA HDD 7200 RPM | — |
| WD Blue WD40EZAX 4TB | SATA HDD 5400 RPM | — |

WD satırlarında `read_speed_mbs` yine **boş** (K60): sayfa "Transfer Rate up to
150MB/s" diyor, "okuma hızı" demiyor. Mevcut WD20EZBX kararı aynen sürdürüldü.

Crucial'ın SSD sayfaları RAM sayfalarıyla aynı gömülü JSON yapısını kullanıyor,
aynı çıkarıcı çalıştı.

## 4. RAM — 14 → 20

| Kit | Tip | Hız | CL |
|---|---|---|---|
| Crucial 16GB (2x8) | DDR5 | 5200 | 42 |
| Crucial 64GB (2x32) | DDR5 | 5200 | 42 |
| Crucial 64GB (2x32) | DDR5 | 5600 | 46 |
| Crucial Pro 32GB (2x16) | DDR5 | 5600 | 46 |
| Crucial 64GB (2x32) | DDR4 | 3200 | 22 |
| Kingston FURY 64GB (2x32) | DDR5 | 6400 | 32 |

Kapsam: DDR5 **16–128 GB / 5200–8000 MHz**, DDR4 **32–128 GB / 2400–3600 MHz**.
16GB kit kataloğun en küçüğü.

Kingston satırı yine SKU başına veri sayfası PDF'inden (K63); metin
doğrulandı: `KF564C32BBEK2-64 64GB (32GB 4G x 64-Bit x 2 pcs.) DDR5-6400 CL32`.

---

## 5. Kural denetimi — eşik uyarıları azaldı

```
Gercek parca: 42 cpu, 60 cip + 58 kart gpu, 19 anakart, 20 bellek,
              12 psu, 12 kasa

C1  tamam    islemci soketi != anakart soketi              500
C2  tamam    bellek tipi != anakart bellek tipi            105
C3  tamam    modul sayisi > yuva sayisi                     19
C4  tamam    guc kaynagi yetmiyor                        9.107
C5  tamam    ekran karti kasaya sigmiyor                   125
C6  tamam    anakart form faktoru desteklenmiyor            66
W1  tamam    bellek hizi anakarti asiyor                    35
W2  UYARI    bellek kapasitesi anakarti asiyor               2
W3  tamam    guc kaynagi yetiyor ama pay dar             8.466
W4  tamam    ekran karti yok, iGPU yok                       3
W5  UYARI    guc kaynagi kasaya sigmayabilir                 1

11 kuralin hepsi tetikleniyor.
UYARI: 2 kural 3 kombinasyondan az ile ayakta.
```

**Eşik uyarısı 3'ten 2'ye indi.** C5 uyarıdan çıktı ve şimdi 125 kombinasyonla
tetikleniyor — yeni kasaların dar GPU açıklıkları (Meshify 2: 290 mm,
Node 304: 310 mm, Terra: 322 mm, Ridge: 325 mm) sayesinde.

C4 ve W3 de belirgin şekilde güçlendi: CX550 ve CX650 katalogdaki en zayıf
güç kaynakları olduğu için güç kuralları artık binlerce kombinasyonda
tetikleniyor.

**Kalan iki uyarı:**

- **W2 (2 kombinasyon)** — tek 128 GB DDR4 kiti (G.SKILL Ripjaws V) ile tek
  düşük kapasiteli anakart (MSI PRO H610M-E, 96 GB) çiftine bağlı. Yeni RAM
  kitleri 128 GB'ı aşmadığı için değişmedi.
- **W5 (1 kombinasyon)** — hâlâ tek etiketli PSU uzunluğuna bağlı
  (Seasonic FOCUS GX-750, 140 mm). Sekiz yeni Corsair'in **hiçbirinde**
  uzunluk yok, çünkü Corsair ekseni etiketlemiyor (K60). Kasa tarafı
  genişledi ama kuralın diğer ucu tek satırda kaldı.

---

## Açık kalan sorular

1. **Marka çeşitliliği dar.** Kasaların 11'i Fractal Design, PSU'ların 11'i
   Corsair. Sebep teknik: üç ölçüyü de yayınlayan ve `curl` ile okunabilen
   kaynaklar bunlar. be quiet! Cloudflare arkasında ("Just a moment...").
   Lian Li, NZXT, Phanteks denenmedi.
2. **W5 tek satıra bağlı kalmayı sürdürüyor.** Ekseni etiketleyen bir PSU
   üreticisi bulunmadıkça bu kural kırılgan. Seasonic etiketliyor ama seri
   sayfaları watt değerini varyant sekmesinde tutuyor (önceki tur bulgusu).
3. **Crucial MX500/BX500 adresleri tutmadı**, iki SATA SSD alınamadı;
   depolama hedefi başka modellerle karşılandı.
