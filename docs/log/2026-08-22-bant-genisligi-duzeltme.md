# 2026-08-22 — RTX 5060 Ti bant genişliği: hata bizdeydi

## Soru

K168 üç çelişki bulmuştu: `nvidia-rtx-5060-ti-16gb`, `-8gb` (bizde 576,
Wikipedia 448) ve `nvidia-rtx-5060` (bizde 480, Wikipedia 448). İç tutarlılık
kontrolü bizim 576'mızın **36 Gbps** bellek ima ettiğini gösteriyordu — öyle
bir bellek yok.

Sorulan: **bu bizim okuma hatamız mı, yoksa NVIDIA gerçekten 576 mı
yayınlıyor?**

## Cevap: ikisi de değil — NVIDIA bu alanı HİÇ yayınlamıyor

İki sayfa yeniden okundu (`WebFetch`, satırların kendi `source_url`'i):

```
https://www.nvidia.com/en-us/geforce/graphics-cards/50-series/rtx-5060-family/
  RTX 5060 Ti  CUDA 4608 · Boost 2.57 GHz · 16/8 GB GDDR7 · 128-bit · 180 W
  RTX 5060     CUDA 3840 · Boost 2.50 GHz · 8 GB GDDR7 · 128-bit · 145 W
  "Memory bandwidth (GB/sec) is not listed in the specifications table."

https://www.nvidia.com/en-us/geforce/graphics-cards/50-series/rtx-5090/
  "Memory Bandwidth is not listed" · 32 GB GDDR7 · 512-bit
```

Yani sorun **üç yanlış sayı değil, sekiz yanlış kaynak iddiası.** RTX 50
serisinin sekiz satırında bant genişliği `manufacturer` damgalıydı ve
`source_url` o değeri içermeyen bir sayfayı gösteriyordu. Değerler bizde
türetilmişti (`veri yolu × bellek hızı ÷ 8`); altısı doğru, ikisi yanlış.

Bu, aranan "daha fazlası var mı" sorusunun cevabı: vardı — üç değil sekiz
satır, ama beşinde sayı doğru, yalnızca kaynağı yanlıştı.

## Düzeltme — üretici yolundan

1. `data/parts/gpu-nvidia.csv`: sekiz `memory_bandwidth_gbs` hücresi
   **boşaltıldı**. Üretici yayınlamıyorsa üretici CSV'si de iddia etmez.
2. `npm run parca:aktar`: alanlar `null` oldu, damgaları silindi (2457 → 2449).
3. `npm run wikipedia:aktar -- --apply`: sekizi de dolduruldu, `wikipedia`
   damgası ve atfıyla (2449 + 58).

**Dış kaynak üreticiyi ezmedi.** Ezilecek bir şey kalmamıştı: alan önce
kaynaksız kaldığı için boşaldı, sonra boş alan dolduruldu.

| parça | eski | yeni | örtük hız |
|---|---|---|---|
| `nvidia-rtx-5060-ti-16gb` | 576 | **448** | 36 → 28 Gbps |
| `nvidia-rtx-5060-ti-8gb` | 576 | **448** | 36 → 28 Gbps |
| `nvidia-rtx-5060` | 480 | **448** | 30 → 28 Gbps |
| `nvidia-rtx-5090` | 1792 | 1792 | 28 Gbps (damga düzeldi) |
| `nvidia-rtx-5080` | 960 | 960 | 30 Gbps (damga düzeldi) |
| `nvidia-rtx-5070-ti` | 896 | 896 | 28 Gbps (damga düzeldi) |
| `nvidia-rtx-5070` | 672 | 672 | 28 Gbps (damga düzeldi) |
| `nvidia-rtx-5050` | 320 | 320 | 20 Gbps (damga düzeldi) |

Beş satırda Wikipedia bizim sayımızı **doğruladı** — bağımsız bir onay.

## Yan bulgu: içe aktarma dış değerleri siliyordu

`parca:aktar`, `update: specData` ile CSV'deki boş hücreyi `null` olarak
yazıyor. Wikipedia'dan gelen 22 alanın hepsi CSV'de boş; bir sonraki içe
aktarma onları **sessizce silecekti**.

İki kural eklendi (K171):

- **Boş hücre bir değer değildir.** CSV'de boş olan ve defterde dış kaynaklı
  olan alanlar güncellemeden çıkarılıyor. Üretici değeri hâlâ dış değeri ezer;
  ezen şeyin bir DEĞER olması gerekiyor, yokluk değil.
- **İçe aktarma defteri tazeliyor.** Yazdığı her dolu alana damga koyuyor,
  `null` yaptığı alanın damgasını siliyor, dış kaynaklı alana dokunmuyor.

Doğrulandı: `parca:aktar` çalıştıktan sonra `nvidia-rtx-4090` hâlâ
`bw=1008 (wikipedia)`, `tr=76300 (wikipedia)`.

## `npm run bant:kontrol` — bütün katalog

```
BELLEK TIPINE GORE ORTUK HIZ DAGILIMI
  tip            cip   ortuk hizlar
  GDDR6           39   14 15.5 16 17 17.5 18 19 19.5 20
  GDDR6X          12   19.01 19.5 21 21.01 22.4 23.01
  GDDR7            7   28 30
  GDDR6/GDDR6X     2   14 21.01

SONUC: 60 cipin tamami tutarli.
```

**Kontrolün sınırı da ölçüldü:** RTX 5060'ın eski değeri (480 → 30 Gbps) bu
kontrolden **geçerdi**, çünkü 30 Gbps GDDR7 gerçekten var (RTX 5080 kullanıyor).
Onu yakalayan şey dış kaynakla karşılaştırma oldu. İki kontrol birbirinin
yerine geçmiyor: **iç tutarlılık imkânsızı yakalar, dış karşılaştırma yanlışı.**

## Ne doğrulandı

```
npm run lint            0 hata, 0 uyari
npx tsc --noEmit        0 hata
npm test                171/171
npm run sema:kontrol    90/90
npm run kaynak:kontrol  6218/6218
npm run bant:kontrol    60/60 tutarli
npm run varyant:kontrol 20/20
npm run kural:kontrol   11/11
npm run build           hatasiz
```

`lib/perf-margin.ts`, `lib/fps-margin.ts`, `benchmark_points` değişmedi.

## Açık kalan sorular

- **Diğer üreticilerde aynı sınıf hata var mı?** AMD ve Intel bant genişliğini
  gerçekten yayınlıyor (23/23 ve 7/7 dolu ve tutarlı), ama bu tur yalnızca
  NVIDIA sayfaları yeniden okundu. Aynı "kaynakta olmayan değeri kaynağa
  atfetme" hatası başka alanlarda da olabilir; `kaynak:kontrol` damgayı
  denetliyor ama damganın **doğru** olup olmadığını denetleyemiyor.
- **Türetilmiş değerler nereye yazılmalı?** Bu tur türetmeyi tamamen kaldırdı.
  İleride türetme gerekirse `Source` enum'unda karşılığı yok (`import` en
  yakını) ve türetmenin formülü hiçbir yerde saklanmıyor.
