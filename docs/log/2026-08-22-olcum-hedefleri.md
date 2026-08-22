# 2026-08-22 — Ölçüm hedefleri: ±%30,7 bandını hangi çip daraltır?

## Soru

Katalogdaki 60 ekran kartı çipinin **29'u** ailesinde hiç ölçüm olmadığı için
aileler arası modelden tahmin ediliyor ve **±%30,7** bandı taşıyor:
`ampere` 12, `rdna_2` 12, `alchemist` 5.

Sorulan: **hangi tek çip ölçülürse bu bant en çok daralır?** Seçim ölçütü
popülerlik değil, **spec uzayındaki merkezilik**.

`scripts/plan-measurement-targets.mts` — `npm run olcum:hedefler`.
Hiçbir şey yazmıyor, ölçüyor ve sıralıyor.

## Önce dürüstlük: tek ölçüm bandı KENDİ BAŞINA daraltmaz

`MIN_FAMILY_FOR_OWN_BAND = 4` (K156). Bir aile kendi bandını ancak dört
ölçümle taşıyabiliyor; üçe kadar aileler arası modelde kalıyor. Yani
"bir tane ölç, bant düşsün" diye bir şey yok — **dördüncü ölçüm** düşürüyor.

Tek ölçümün değeri şu: ailenin dört ölçümlük yolunun **ilk adımı** ve nereye
konduğu sonraki üçünün ne kadar iş göreceğini belirliyor.

Eşiğe ulaşmanın ne kazandırdığı tahmin değil, ölçüldü:

| aile | ölçüm | aileler arası bant | kendi bandı | fark |
|---|---|---|---|---|
| `rdna_4` | 4 | ±%8,5 | **±%6,4** | 2,1 puan |
| `blackwell` | 5 | ±%30,7 | **±%19,8** | **10,8 puan** |

`blackwell` bugünkü durumun aynısı: aileler arası bant ±%30,7 iken kendi
bandı ±%19,8. Ölçümsüz üç ailenin eşiğe ulaşınca göreceği kazanç bu
büyüklükte.

## Merkezilik gerçekten işe yarıyor mu — ölçüldü

İki ayrı ölçüm yapıldı ve **ikisi ters yönde çıktı**. Hangisinin geçerli
olduğu önemli:

**Bütün küme üzerinden (15 nokta) — merkezilik lehine ÇIKMADI:**

```
merkeze yakin yari: ortalama hata %19.7
merkeze uzak  yari: ortalama hata %10.9      (-8.7 puan, ters yon)
nvidia-rtx-5090   merkezden %137 uzakta  ->  hata %2.0
```

**Aile içinde (9 nokta) — merkezilik LEHİNE:**

```
rdna_4      9% -> %3.9   18% -> %1.0   47% -> %1.9   60% -> %6.4
blackwell   4% -> %0.7   13% -> %9.5   33% -> %1.5  115% -> %12.3  143% -> %19.8

merkeze yakin yari: %3.7 · uzak yari: %10.1      (+6.4 puan)
```

**Geçerli olan ikincisi** ve sebebi yapısal: bütün küme üzerinden yapılan
ölçümde, dışarıda bırakılan noktanın hatası çoğunlukla *hangi aileden
geldiğinden* geliyor, merkezden uzaklığından değil — aile etkisi mesafe
etkisini örtüyor. Çapanın işi ise tam olarak **bir ailenin kendi modelini
tutmak**; o yüzden aile içi ölçüm doğru sorunun cevabı.

Her ikisi de küçük örneklem: 15 ve 9 nokta. Eğilim, kanıt değil — ve script
bunu çıktısında kendisi yazıyor.

## KISA LİSTE — aile başına bir çip

| # | çip | aile | ailede | merkezden | ölçü |
|---|---|---|---|---|---|
| 1 | **`amd-rx-6700`** | `rdna_2` | 12 çip | %12,4 | 10 GB · 175 W · eksen 392.000 |
| 2 | **`nvidia-rtx-3070-ti`** | `ampere` | 12 çip | %1,1 | 8 GB · 290 W · eksen 453.120 |
| 3 | **`intel-arc-a750`** | `alchemist` | 5 çip | %0,0 | 8 GB · 225 W · eksen 524.800 |

Eksen `veri yolu (bit) × boost saati (MHz)` — modelin kendi ekseni (K161),
başka bir ölçüt uydurulmadı.

Sıra ailenin büyüklüğüne göre: `rdna_2` ve `ampere` 12'şer çip taşıyor,
`alchemist` 5.

**Ampere'de çapa neredeyse tam merkezde** (%1,1) — RTX 3070 Ti ailenin
log-medyanına oturuyor. **Alchemist'te A750 merkezin kendisi** (%0,0).
`rdna_2` en zoru: RX 6700 medyandan %12,4 uzakta ve ailenin en uzak üyesi
çapadan %164 uzakta kalıyor (aralık oranı ×4,0).

Eşiğe ulaşmak için çapanın yanına gerekecek üç ölçüm (uçlar + ara nokta):

```
rdna_2      amd-rx-6400, amd-rx-6950-xt, amd-rx-6700-xt
ampere      nvidia-rtx-3050-6gb, nvidia-rtx-3090-ti, nvidia-rtx-3070
alchemist   intel-arc-a380, intel-arc-a770-8gb, intel-arc-a770-16gb
```

Bunlar merkeze göre değil **aralığa** göre seçildi: çapa ortayı tutuyor,
bu üçü uçları — eğri iki uçtan da bağlanmış oluyor.

## Ne doğrulandı

```
npm run lint            0 hata
npx tsc --noEmit        0 hata
npm test                171/171
npm run olcum:hedefler  (yukaridaki butun sayilar bu ciktidan)
```

`lib/perf-margin.ts`, `lib/fps-margin.ts` ve `benchmark_points` **değişmedi**;
script yalnızca okuyor.

## Açık kalan sorular

- **Bu çipler ölçülebilir mi?** Liste spec uzayına bakıyor, kaynak
  bulunabilirliğine değil. `alchemist` için K121 zaten erişim engeli
  kaydetmişti (Arc kartlarının sayfaları alınamıyor); ölçüm kaynağı
  (ComputerBase parkuru) bu çipleri yayınlıyor mu ayrı bir soru.
- **Eşik dört mü kalmalı?** `rdna_4` dört ölçümle ±%6,4 veriyor, `blackwell`
  beş ölçümle ±%19,8. Eşiğin kendisi bir karar (K156) ve bu iki sayı onu
  sorgulamak için yeterli değil.
