# 2026-08-20 — PSU uzunluğu: K95 ve W5'in kırılganlığı

W5 tek PSU satırına bağlıydı ve bu kuralı ölü koda dönmeye bir adım uzakta
bırakıyordu. **K95 onaylandı ve uygulandı: `length_mm` dolu PSU 1 → 8,
W5 kombinasyonu 1 → 14.** Eşik uyarısı 2'den **1**'e indi.

Ayrıca `docs/KARARLAR.md`'deki **K91 numara çakışması** düzeltildi.

---

## 1. Ne yapıldı

### Ölçüm — karar öncesi

Katalogdaki 11 Corsair PSU sayfası sıralı olarak yeniden çekildi (hepsi 200).
Değer sayfanın **kendi** spec tablosundan (`TechSpecItem` satırı) okundu;
Corsair sayfalarındaki gömülü başka-ürün JSON'ları çapa olarak kullanılmadı —
bu tuzak önceki turda RM750e sayfasından RM850e'nin wattını okutmuştu.

| Üçlü | Kaç PSU | 150 | 86 | Kalan |
|---|---|---|---|---|
| `140x150x86` | 4 (RM650e, RM750e, RM850e, RM1000e) | ✓ | ✓ | **140** |
| `160x150x86` | 1 (RM750x) | ✓ | ✓ | **160** |
| `160mm x 150mm x 86mm` | 2 (RM750x SHIFT, RM850x SHIFT) | ✓ | ✓ | **160** |
| — | 4 (CX550, CX650, HX1200i, SF750) | sayfada Dimensions satırı **yok** | | |

Üçlü veren **7/7 satırda 150 ve 86 istisnasız var.**

**Bağımsız doğrulama, ekseni etiketleyen üreticiden.** Corsair tek marka ve
etiketlemeyen taraf; tek başına yeterli değildi. Seasonic'in beş seri sayfası
çekildi, toplanan **her** üçlü:

```
140 mm (L) x 150 mm (W) x 86 mm (H)   × 14
170 mm (L) x 150 mm (W) x 86 mm (H)   ×  8
210 mm (L) x 150 mm (W) x 86 mm (H)   ×  8
```

Uzunluk 140 → 170 → 210 diye değişiyor, **W=150 ve H=86 hiç değişmiyor**, ve
etiket hangi eksenin hangisi olduğunu açıkça söylüyor. Corsair'in gömülü
JSON'undan çıkan dördüncü desen (`180mm x 150mm x 86mm`) de aynı.

**İki marka, beş farklı uzunluk (140/160/170/180/210), karşı örnek sıfır.**

### Uygulama

`data/parts/psu-corsair.csv`'ye yedi uzunluk yazıldı. Değerler elle
girilmedi — çekilen sayfalardan K95'in dört koşulunu uygulayan bir çıkarıcıyla
türetildi, koşul sağlanmayan dört satır otomatik olarak boş bırakıldı.
Dokunulan satırlarda `collected_at` bugüne çekildi, çünkü sayfa bugün
yeniden okundu.

---

## 2. Verilen kararlar

### K95 — Etiketsiz PSU üçlüsünde standardın iki sabiti tanınıyorsa kalan uzunluktur

Dört koşul, hepsi zorunlu: üreticinin **kendi spec tablosu**, üçlüde **hem 150
hem 86**, form faktörü **ATX**, ondalık **yukarı** yuvarlanır.

**Kural kendini kapatır.** 150 veya 86 yoksa değer yazılmaz ve K60 aynen
işler. Bu bir **tanıma** kuralıdır, çıkarım kuralı değil — tanıyamazsa
çalışmaz. Standart dışı bir ünitede sessizce yanlış yazmaktansa hiç yazmaz.

**SFX/SFX-L kapsam dışı.** Sabitleri farklı (125 × 63.5) ve **ölçülmedi**.
Kataloğun tek SFX'i olan SF750'nin sayfasında zaten ölçü yok, yani SFX dalı
bugün sıfır satır doldururdu. Ölçülmemiş bir standardın sabitlerini kurala
yazmak, ölçüm olmadan kural yazmak olurdu.

### K95 ile K91: aynı mantık, aynı işlem değil

K91 "en büyük değer uzunluktur" diyor. **K91'in harfi PSU'da yanlış sonuç
verir:** `140x150x86` üçlüsünün en büyüğü 150'dir ve o **genişliktir**. K91'i
olduğu gibi taşımak dört Corsair'e yanlış uzunluk yazardı.

| | Dayanak |
|---|---|
| **K91** (ekran kartı) | **Fiziksel sınır** — en uzun eksen PCIe yuvasına paralel olmak zorunda |
| **K95** (güç kaynağı) | **Standardın sabit ölçüsü** — ATX12V genişlik ve yüksekliği sabitler |

### K95b — GENEL KURAL: bir kural yeni alana taşınırken harfi değil gerekçesi taşınır

Gerekçe o alanda geçerli değilse kural taşınmaz — işlem tesadüfen doğru sonuç
veriyor olsa bile. K91'in işlemi PSU'ya taşınsaydı sessizce yanlış veri
üretirdi ve yanlışlık **kural biçiminde göründüğü için** sorgulanmazdı.

### Numaralandırma düzeltmesi: pazaryeri tavanı K91 → **K96**

`docs/KARARLAR.md`'de iki tane K91 vardı. Pazaryeri fiyat tavanı kararı
**K96** oldu; içerik değişmedi. Atıf veren yerler güncellendi:
`scripts/import-prices.mts` (üç yer), `ROADMAP.md`, ve iki rapor.

İki raporun başına sonradan-eklenen-not konuldu; **kaydedilmiş komut çıktısı
(`OZET: ... 0 elendi (K91)`) o gün çalıştığı haliyle bırakıldı.** Geçmiş
çıktıyı düzeltmek, olmayan bir çalıştırmayı kaydetmek olurdu.

---

## 3. Ne doğrulandı

`npm run kural:kontrol` — **W5 = 14, ölçülen sayı.**

```
Gercek parca: 42 cpu, 60 cip + 58 kart gpu, 19 anakart, 20 bellek, 12 psu, 12 kasa

C5  tamam  — ekran karti kasaya sigmiyor                        125
W2  UYARI  — bellek kapasitesi anakarti asiyor                    2
W5  tamam  — guc kaynagi kasaya sigmayabilir                     14
      ornek : corsair-rm650e + fractal-design-terra
      mesaj : Güç kaynağı 140 mm, kasa için belirtilen sınır 130 mm.

11 kuralin hepsi gercek veriyle tetiklenebiliyor.
UYARI: 1 kural 3 kombinasyondan az ile ayakta.
```

**Eşik uyarısı 2 → 1.** Geriye yalnızca W2 kaldı.

W5'in dağılımı — kuralın iki ucu da tek satır olmaktan çıktı:

| Kasa | Açıklık | Kaç PSU tetikliyor |
|---|---|---|
| Fractal Terra | 130 mm | 8 |
| Fractal Pop Mini Air | 150 mm | 3 (160 mm'lik RMx/SHIFT'ler) |
| Fractal North | 155 mm | 3 |

`npm run parca:aktar` — `0 yeni, 236 guncellendi, 0 atlandi, 0 hata`.
Değişen alanlar yalnızca beklenen yedi satırda: `length_mm` (7), `collected_at` (3).

`npm run sema:kontrol` — `SONUC: 80 kontrolun tamami gecti.`

`npm test` — `Test Files 4 passed (4), Tests 128 passed (128)`.

---

## 4. Açık kalan sorular

1. **Dört PSU'da ölçü hâlâ yok** (CX550, CX650, HX1200i, SF750) çünkü Corsair
   bu sayfalarda Dimensions satırını hiç yayınlamıyor. Hiçbir kural bunu
   kurtaramaz; başka kaynak ya da başka model gerekir.
2. **SFX ölçülmedi.** Katalogda ölçü yayınlayan SFX PSU olmadığı için ölçüm
   yapılamadı. SFX'li kasa (Ridge) katalogda var ve `max_psu_length_mm` alanı
   boş — yani W5 o uçta da sessiz.
3. **Marka çeşitliliği hâlâ dar.** PSU'ların 11'i Corsair. K95 Seasonic'te de
   geçerli ama Seasonic'in seri sayfaları watt değerini varyant sekmesinde
   tutuyor; yeni Seasonic satırı eklemek hâlâ zor.
4. **Kasa CSV'leri her içe aktarımda `supported_form_factors` "değişti"
   gösteriyor** (11 satır). Bu tur benim dokunmadığım dosyalarda oldu, yani
   önceden var. Muhtemelen dizi sırası normalizasyonu; zararsız görünüyor ama
   gerçek değişikliği gürültüye boğuyor. Ayrıca bakılmalı.
