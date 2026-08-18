# 2026-08-19 — Intel Arc verisi ve GPU tarafının kapanışı

---

## Ne yapıldı

`data/parts/gpu-intel.csv` — **7 satır**, hepsi içe aktarıldı.

| Model | Slug | VRAM | TBP |
|---|---|---|---|
| Arc B580 | `intel-arc-b580` | 12 GB | 190 W |
| Arc B570 | `intel-arc-b570` | 10 GB | 150 W |
| Arc A770 16GB | `intel-arc-a770-16gb` | 16 GB | 225 W |
| Arc A770 8GB | `intel-arc-a770-8gb` | 8 GB | 225 W |
| Arc A750 | `intel-arc-a750` | 8 GB | 225 W |
| Arc A580 | `intel-arc-a580` | 8 GB | 185 W |
| Arc A380 | `intel-arc-a380` | 6 GB | 75 W |

**A770 iki satır oldu.** İstenen listede tek yazıyordu ama Intel 8GB ve 16GB
için **ayrı SKU sayfaları** yayınlıyor ve değerler gerçekten farklı: bant
genişliği 512 / 560 GB/s, bellek hızı 16 / 17.5 Gbps. NVIDIA'daki VRAM varyantı
kuralı ile aynı durum.

---

## Araç notu: Intel hem WebFetch'i hem curl'ü engelliyor

```
WebFetch  -> HTTP 403 Forbidden
curl      -> HTTP 403, 494 bayt
```

Sayfalar **tarayıcı panelinden** okundu (`preview_start` + `get_page_text`).
Üç üretici, üç farklı erişim yolu gerektirdi:

| Üretici | Çalışan yol |
|---|---|
| NVIDIA | `WebFetch` |
| AMD | `curl` (WebFetch `ECONNRESET`) |
| Intel | Tarayıcı paneli (ikisi de 403) |

---

## Intel ARK gerçekten en detaylısı — ama beklenmedik yerde

**Intel Reference Card Attributes** bölümü, AMD'de hiç bulunamayan iki alanı
veriyor: `Dimensions (Length x Width)` ve `Minimum Power Supply Unit`.

**Ama sadece B580'de var.** Diğer altı modelde bu bölüm yok — Intel yalnızca
B580 için referans kart yayınlamış. Sonuç: `length_mm` 1/7, `recommended_psu_watt`
1/7.

Buna karşılık Intel'in **her satırda** verdiği şeyler: `pcie_version` (hat
sayısıyla birlikte), `memory_bandwidth_gbs`, `release_year`. Üçü de AMD ya da
NVIDIA'da eksik kalan alanlardı.

---

## Karar verilen noktalar

**1. `shader_units` boş bırakıldı** — yeni soru S23.

Intel'in yayınladığı sayı "Xe Vector Engines" (B580 için 160). NVIDIA'nın CUDA
Cores'u ve AMD'nin Stream Processors'ı ALU sayar ve birbiriyle karşılaştırılabilir;
Intel'inki SIMD motoru sayıyor ve yaklaşık 16 kat küçük. Aynı sütuna yazmak
ölçekleme modelini sessizce bozardı. Seçenekler S23'te.

**2. `boost_clock_mhz`'e Intel'in "Graphics Clock" değeri yazıldı.** Intel ayrı
bir boost figürü yayınlamıyor; bu, kartın kayıtlı çalışma frekansı ve aynı
birimde (MHz). Anlamı NVIDIA/AMD'nin "boost"undan biraz farklı — orada tepe
frekans, burada Intel'in ilan ettiği grafik saati.

**3. `pcie_version`'a hat sayısı da yazıldı** (`PCIe 4.0 x8`). NVIDIA satırları
hatsız (`PCIe 4.0`), çünkü NVIDIA sayfaları hat sayısı vermiyordu — K50: sayfada
olmayan hat sayısını eklemek uydurmadır. Intel sayfada veriyor, o yüzden yazıldı.
Sütun biçimi üreticiye göre değişiyor ama her değer kendi kaynağına sadık.
A380'deki "(x16 slot required)" notu alınmadı; o slot gereksinimi, arayüz sürümü
değil.

---

## Tutarlılık kontrolü

Bant genişliği = arayüz genişliği × bellek hızı ÷ 8:

```
B580        192-bit × 19    ÷ 8 = 456   sayfa: 456   ✓
B570        160-bit × 19    ÷ 8 = 380   sayfa: 380   ✓
A770 16GB   256-bit × 17.5  ÷ 8 = 560   sayfa: 560   ✓
A770 8GB    256-bit × 16    ÷ 8 = 512   sayfa: 512   ✓
A380         96-bit × 15.5  ÷ 8 = 186   sayfa: 186   ✓
```

Xe Vector Engines / Xe-cores oranı da mimari içinde sabit: Battlemage'de 8
(B580 20→160, B570 18→144), Alchemist'te 16 (A770 32→512, A750 28→448,
A580 24→384, A380 8→128). İki bağımsız kontrol de tutuyor; okuma hatası yok.

---

## GPU tarafı toplamı — üç dosya

**60 GPU**, hepsi veritabanında (`source='manufacturer'`).

| Alan | NVIDIA (30) | AMD (23) | Intel (7) | Toplam (60) |
|---|---|---|---|---|
| `chipset` | 30 | 23 | 7 | **60** |
| `vram_gb` | 30 | 23 | 7 | **60** |
| `vram_type` | 30 | 23 | 7 | **60** |
| `tdp_watt` | 30 | 23 | 7 | **60** |
| `boost_clock_mhz` | 30 | 23 | 7 | **60** |
| `recommended_psu_watt` | 30 | 22 | 1 | 53 |
| `shader_units` | 30 | 23 | 0 | 53 |
| `pcie_version` | 30 | 0 | 7 | 37 |
| `memory_bandwidth_gbs` | 3 | 23 | 7 | 33 |
| `release_year` | 0 | 15 | 7 | 22 |
| `length_mm` | 17 | 0 | 1 | **18** |

**Beş alan 60/60 dolu.** Bunlar üç üreticinin de istisnasız yayınladığı
değerler — ve uyumluluk kurallarının kullandığı `tdp_watt` bunların içinde.

**En zayıf alan `length_mm`: 60'ın 18'i.** Üç üretici de yalnızca kendi referans
kartının ölçüsünü veriyor, üçüncü parti kartlar farklı. C5 kuralı bu yüzden
kartların çoğunda atlanacak — arayüz kullanıcıya bunu söylüyor (K52).

**Hiçbir alan üç üreticide birden dolu değil**, `pcie_version` AMD'de sıfır,
`shader_units` Intel'de sıfır, `memory_bandwidth_gbs` NVIDIA'da neredeyse sıfır.
K56'nın gerekçesi burada sayıyla görünüyor: şema tek üreticiye göre kurulsaydı
diğer ikisi dışarıda kalırdı.

**confidence dağılımı:** 18 satır `medium` (referans kart ölçüsü yazılan
satırlar), 42 satır `high`.

---

## Ne doğrulandı

```
$ npm run parca:aktar
gpu-intel.csv (gpu) — 7 satir
  [YENI  ] intel-arc-b580 ... [YENI  ] intel-arc-a380
OZET: 7 yeni, 54 guncellendi, 0 atlandi (dusuk guvenilirlik), 0 hata.
raw_imports: 256 satir. manufacturer kaynakli parca: 61.
```

61 = 60 GPU + 1 CPU (Ryzen 7 9800X3D).

```
$ npm test               107 passed (107)
$ npm run sema:kontrol   SONUC: 70 kontrolun tamami gecti.
$ npx tsc --noEmit       (çıktı yok)
$ npm run lint           (çıktı yok)
$ npm run build          ✓ Compiled successfully
```

---

## Önceki raporda düzeltme

`2026-08-19-amd-gpu-verisi.md` içinde `release_year` sayısı **12** yazılmıştı;
doğrusu **15**. CSV doğruydu, rapordaki sayım yanlıştı. O rapora düzeltme notu
eklendi ve sayı üstü çizili olarak güncellendi.

---

## Açık kalan sorular

**S23 (yeni)** — Intel'de `shader_units` boş: üç üretici aynı birimi
yayınlamıyor. Önerim boş kalması; ölçekleme gerektiğinde bilinçli olarak
doldurulabilir.

**S22, S18, S16, S15** değişmedi.

**GPU tarafı kapandı.** Sırada CPU, anakart, RAM, PSU, kasa ve depolama var —
şu an yalnızca 1 gerçek CPU ve 25 dev-seed parça duruyor.

Güncel liste: `SORULAR.md`
