# 2026-08-22 — Dört ölçüm eşiği: donanım almadan önce modellendi

## Soru

K156 eşiği dört ölçüm koyuyor. Donanıma yatırım yapmadan önce: **rdna_2,
ampere ve alchemist'in her biri dörder ölçüm alsa ne olur?**

`npm run olcum:hedefler` — 6. bölüm. **Tamamı ekstrapolasyon**, script de
çıktısının başında bunu yazıyor.

## Neden ekstrapolasyon, ve neden yine de yapıldı

Ölçülmemiş bir ailenin ölçülünce ne vereceği bilinemez. Bilinen tek şey,
**eşiği geçmiş ailelerin ne verdiği**. Aşağıdaki sayılar o gözlemin ödünç
verilmesi.

Yine de yapılıyor çünkü "bilinmez" cevabı donanım alma kararını
cevaplamıyor. Cevap veriliyor ama neye dayandığı ve nerede kırılacağı da
yazılıyor.

## 1. Eşiği geçmiş ailelerde dört ölçüm ne verdi?

`n > 4` olan ailede **bütün dörtlü alt kümeler** ayrı ayri ölçüldü:
blackwell'in 5 noktasından 5 farklı dörtlü çıkıyor ve her biri kendi bandını
veriyor.

| aile | tür | n | dörtlü bant: ort / en dar / en geniş |
|---|---|---|---|
| `rdna_4` | GPU | 4 | ±%6,4 / ±%6,4 / ±%6,4 |
| `blackwell` | GPU | 5 | **±%16,9** / ±%6,0 / ±%25,9 |
| `zen_5` | CPU | 4 | ±%21,2 / ±%21,2 / ±%21,2 |

**Toplam 7 dörtlü küme: ortalama ±%16,0, aralık ±%6,0 … ±%25,9.**

İşlemci ailesi de sayıldı: ekseni farklı (`boost × √L3`) ama **yöntem aynı**
ve n=4 gözlemimiz ikiden üçe çıkıyor. Tabloda ayrı sütunda duruyor.

Blackwell'in dörtlüleri arasındaki fark dikkat çekici: aynı aileden hangi dört
kartın seçildiğine göre bant ±%6,0 ile ±%25,9 arasında değişiyor. **Hangi
dördü seçtiğin, kaç tane seçtiğin kadar önemli** — K169'un merkezilik ölçütü
bu yüzden var.

## 2. Üç hedef aile için beklenen bant

| aile | bugün | dört ölçümden sonra (beklenen) |
|---|---|---|
| `rdna_2` | ±%30,7 | ±%6,0 … ±%25,9 (merkez ±%16,0) |
| `ampere` | ±%30,7 | ±%6,0 … ±%25,9 (merkez ±%16,0) |
| `alchemist` | ±%30,7 | ±%6,0 … ±%25,9 (merkez ±%16,0) |

**Aile başına ayrı bir sayı verilmiyor.** Ayrıştırmayı deneyen ölçüm de
yapıldı — ailenin eksen yayılımı ile bandı arasındaki ilişki:

| aile | n | yayılım | kendi bandı |
|---|---|---|---|
| `rdna_4` | 4 | ×1,9 | ±%6,4 |
| `zen_5` | 4 | ×2,1 | ±%21,2 |
| `blackwell` | 5 | ×3,8 | ±%19,8 |

Üç gözlem. Yön okunabiliyor gibi duruyor ama `zen_5` onu bozuyor: dar yayılımlı
bir aile geniş bant verdi. **Katsayı çıkarılamaz**, o yüzden üç hedef aile için
aynı aralık kullanılıyor.

## 3. Aileler arası bant ne olur?

Bu soru geriye doğru ölçülebiliyor: bugünkü kümede **daha az aileyle** ne
oluyordu?

| ölçülü aile | eğitim noktası | aileler arası bant |
|---|---|---|
| 3 | 9 | ±%52,8 (10 kombinasyon) |
| 4 | 12 | ±%36,8 (5 kombinasyon) |
| 5 | 15 | **±%30,7** (bugün) |

Azalan getiri: −16,0 puan, sonra −6,1 puan.

**Uzatma modeli `bant = a + b/k`** (`k` = ölçülü aile sayısı). Biçim bir seçim:
azalan getiri beklentisi hem gerekçe hem gözlem. Doğrusal uzatma bandı sekizde
negatife düşürürdü.

```
a = -3.9, b = 168.5
k    gozlenen   model    kalinti
3    ±%52.8     ±%52.3    0.5 puan
4    ±%36.8     ±%38.2   -1.4 puan
5    ±%30.7     ±%29.8    0.9 puan
8    —          ±%17.1   <- EKSTRAPOLASYON
```

Model eldeki üç noktayı **1,4 puandan iyi** tutturuyor. Yine de k=8, en büyük
gözlemin üç aile ötesinde ve simülasyon "daha çok aile" ile "daha çok nokta"yı
**ayıramıyor** — ikisi birlikte artıyor.

## 4. Kaç çip yer değiştirir?

- **29 çip** kendi ailesinin bandına geçer (rdna_2 12, ampere 12, alchemist 5)
- **19 çip** aileler arası bantta kalır (ada_lovelace 10, rdna_3 7, xe2 2 —
  eşiği geçemeyen aileler), ama o bant da daralır

Yani **12 ölçüm**, 60 çipin 29'unu ±%30,7'den ortalama ±%16 civarına taşıyor;
kalan 19 çip için bant ±%30,7'den ~±%17'ye iniyor (ekstrapolasyon).

## Ne doğrulandı

```
npm run lint            0 hata
npx tsc --noEmit        0 hata
npm test                171/171
npm run olcum:hedefler  (butun sayilar bu ciktidan)
```

`lib/perf-margin.ts`, `lib/fps-margin.ts` ve `benchmark_points` değişmedi;
script yalnızca okuyor.

## Açık kalan sorular

- **Ölçüm kaynağı hâlâ yok.** Bu model "ölçersen ne olur" sorusunu
  cevaplıyor; "nereden ölçersin" sorusu K113'te kapalı duruyor. ComputerBase
  parkuru bu üç ailenin kartlarını yayınlıyor mu, ayrıca bakılmalı.
- **Eşiğin kendisi sorgulanmadı.** `rdna_4` dörtle ±%6,4 verirken `zen_5`
  dörtle ±%21,2 veriyor. Eşiği beşe çıkarmak neyi değiştirirdi, ölçülmedi —
  blackwell'in beşli bandı (±%19,8) dörtlü ortalamasından (±%16,9) **daha
  geniş** çıktı, yani sayı büyüdükçe bandın daralacağı garanti değil.
