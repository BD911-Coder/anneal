# 2026-08-19 — CPU verisi: AMD Ryzen 7000/9000, Intel 14. nesil + Ultra 200S

---

## Ne yapıldı

**39 CPU toplandı ve içe aktarıldı.** 0 hata.

| Dosya | Satır | Kapsam |
|---|---|---|
| `data/parts/cpu-amd.csv` | 19 | Ryzen 7000 ve 9000, X / X3D / non-X |
| `data/parts/cpu-intel.csv` | 20 | 14. nesil (10) + Core Ultra 200S (10) |

**`data/parts/cpu.csv` silindi.** Tek satırı (`amd-ryzen-7-9800x3d`) artık
`cpu-amd.csv` içinde ve aynı slug'ın iki kaynak dosyada durması "hangisi doğru"
sorusunu üretirdi — GPU tarafında `gpu.csv` için verilen kararın aynısı.

---

## Alan doluluğu: CPU tarafında boşluk yok

| Dosya | Satır | Boş alan |
|---|---|---|
| `cpu-amd.csv` | 19 | **yok** — 15 sütunun 15'i her satırda dolu |
| `cpu-intel.csv` | 20 | **yok** — 15 sütunun 15'i her satırda dolu |

GPU tarafındaki tablo bunun tam tersiydi (`length_mm` 18/60, `pcie_version`
37/60). Sebep: `cpu_specs`'in sekiz zorunlu alanı da üreticinin standart
spec setinde — soket, çekirdek, thread, saat hızları, TDP, bellek tipi, iGPU.
GPU tarafında sorun çıkaran alanlar (kart uzunluğu, önerilen PSU) fiziksel kart
özellikleriydi ve üretici bunları yalnızca kendi referans kartı için veriyor.
İşlemcinin "referans kartı" yok.

**Dağılım:**

```
cpu-amd.csv    soket: AM5 19          bellek: DDR5 19
cpu-intel.csv  soket: LGA1700 10, LGA1851 10
               bellek: DDR4/DDR5 10, DDR5 10
```

Uyumluluk kuralları için iyi çeşitlilik: C1 (soket) iki farklı Intel soketi ve
AM5 ile tetiklenebiliyor, C2 (bellek tipi) DDR4/DDR5 ve DDR5-only ayrımıyla.

---

## Tutarlılık kontrolü

GPU'da bant genişliği formülü kullanılmıştı. CPU'da eşdeğer bir formül yok;
onun yerine **yapısal desenler** kontrol edildi:

**1. Thread / çekirdek oranı — mimari imzası.**

```
AMD Ryzen 7000/9000    thread = 2 x çekirdek     19/19 satırda  ✓
Intel 14. nesil        thread > çekirdek         10/10  ✓  (P-core'larda HT)
Intel Ultra 200S       thread = çekirdek         10/10  ✓  (Arrow Lake HT'yi kaldırdı)
```

Üçü de beklenen desende. Ultra 200S'te thread = çekirdek olması bir hata
değil, mimarinin kendisi — ve bu, doğru sütundan okunduğunun bağımsız kanıtı.

**2. X3D boost'u non-X3D muadilinden yüksek olamaz** (3D önbellek ısı sınırı):

```
9900X3D 5500 ≤ 9900X 5600   ✓
7800X3D 5000 ≤ 7700X  5400   ✓
7600X3D 4700 ≤ 7600X  5300   ✓
9950X3D 5700 = 9950X  5700   ✓ (eşit, AMD böyle veriyor)
7950X3D 5700 = 7950X  5700   ✓
```

**3. Intel'de base clock hangi sütundan alınıyor.** 14. nesil ve Ultra hibrit
mimari; ARK hem "Performance-core Base Frequency" hem "Efficient-core Base
Frequency" veriyor. P-core değeri alındı — 65W parçalarda düşük çıkması
(i9-14900: 2000 MHz, i7-14700: 2100 MHz) beklenen davranış, hata değil.

---

## Kapsam kararları

**F / KF varyantları alınmadı** — istendiği gibi. Ayrıca alınmayanlar ve sebebi:

| Hariç | Sebep |
|---|---|
| `F`, `KF` | İstendi: grafik birimi dışında aynı |
| `T` (35W masaüstü) | OEM odaklı düşük güç serisi; ana masaüstü listesinde değil |
| `E`, `TE`, `UA`, `TA` | Gömülü (embedded) varyantlar |
| `HX`, `H`, `U`, `V` | Mobil |

**Core Ultra 7 270K ve Ultra 5 250K dahil edildi.** Bunlar "200S **Plus**"
olarak pazarlanıyor, yani adı birebir "200S" değil. Aynı soket (LGA1851), aynı
nesil, masaüstü. Kapsam dışı sayılmaları gerekiyorsa iki satır silinir.

---

## Ne doğrulandı

```
$ npm run parca:aktar
cpu-amd.csv (cpu) — 19 satir
cpu-intel.csv (cpu) — 20 satir
  [GUNCEL] intel-core-i5-14600k — degisen: source, source_url, confidence, collected_at
OZET: 35 yeni, 64 guncellendi, 0 atlandi (dusuk guvenilirlik), 0 hata.
raw_imports: 477 satir. manufacturer kaynakli parca: 99.
```

`intel-core-i5-14600k` dev-seed olarak duruyordu, gerçek veriyle güncellendi —
K54 kuralı üçüncü kez çalıştı.

**Veritabanı:**

```
  gpu          manufacturer  60
  cpu          manufacturer  39
  cpu          dev-seed       1     (intel-core-i9-15900k — uydurma model)
  motherboard  dev-seed       5
  ram          dev-seed       4
  psu          dev-seed       4
  storage      dev-seed       4
  case         dev-seed       4
  spec siz cpu: 0
```

99 gerçek parça. Kalan 22 dev-seed satırı henüz gerçek veriyle
değiştirilmemiş kategorilerde.

```
$ npm test               107 passed (107)
$ npm run sema:kontrol   SONUC: 73 kontrolun tamami gecti.
$ npx tsc --noEmit       (çıktı yok)
$ npm run lint           (çıktı yok)
$ npm run build          ✓ Compiled successfully
```

---

## Araç notu düzeltildi

Önceki oturumda "intel.com → tarayıcı paneli, `curl` → 403" yazılmıştı.
**Yanlış değil ama eksikti:** `curl` tek başına `User-Agent` ile 403 alıyor,
**tam tarayıcı başlık setiyle 200 dönüyor**.

```
sadece UA:   HTTP 403
tam başlık:  HTTP 200
```

Bu, 20 Intel sayfasını tarayıcıyla tek tek gezmek yerine toplu indirmeyi
mümkün kıldı. `CLAUDE.md` araç notu düzeltildi; ayrıca iki şey eklendi:
Intel ARK'ın `tech-label` / `tech-data` yapısı ve seri sayfalarından SKU
listesinin toplu alınabilmesi.

---

## Açık kalan sorular

**Yeni soru açılmadı.** S22, S18, S16, S15 değişmedi.

**Sırada:** anakart, RAM, PSU, kasa, depolama — hâlâ 22 dev-seed satırı var.
Bu kategorilerde `case_specs` ve `psu_specs.length_mm` riskli görünüyor;
GPU'daki `length_mm` deneyimi, üreticilerin fiziksel ölçüleri tutarsız
yayınladığını gösterdi.

Güncel liste: `SORULAR.md`
