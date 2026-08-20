# Faz A.1 — Mevcut 178 ölçümden oyun bazlı FPS

**Durum:** plan, onay bekliyor. Kod yazılmadı.
**Tarih:** 20 Ağustos 2026

Bu belgedeki bütün sayılar geliştirme veritabanından **ölçüldü**, tahmin
edilmedi. Ölçüm komutları bölüm 6'da.

---

## 1. Veri gerçekte ne durumda

178 ölçümün hepsi `manual` / `review`, tek kaynak (ComputerBase). Ama **178
tek bir küme değil.** İki ayrı yöntemle toplanmış, birbirine değmeyen iki küme:

| | Satır | GPU | CPU | Ayar | Oyun |
|---|---|---|---|---|---|
| **GPU ölçümü** | 64 | 14 farklı | boş | 1440p ultra, DLSS/FSR Quality | 8 |
| **CPU ölçümü** | 114 | **hep RTX 5090** | 12 farklı | 1080p medium, upscaling yok | 9 |

Bu ayrım A.1'in bütün sınırlarını belirliyor, o yüzden en başta duruyor.

### GPU ölçümlerinin matrisi (64 satır)

8 oyun × 14 çip = 112 hücrenin **64'ü dolu (%57)**. Hiçbir çipte 8 oyunun
hepsi yok; en iyisinde 6, en kötüsünde 4 var.

```
                          alan anno acsh cod7 cp77 ds2  f125 hogw   TOPLAM
amd-rx-7600                  .    .    1    1    1    .    .    1        4
amd-rx-7800-xt               1    1    1    .    .    1    1    1        6
amd-rx-9060-xt               .    1    1    .    .    .    1    1        4
amd-rx-9070                  1    1    .    .    1    1    .    .        4
amd-rx-9070-gre              1    1    1    .    .    1    1    .        5
amd-rx-9070-xt               1    1    .    1    1    1    .    .        5
intel-arc-b580               .    .    1    1    .    .    1    1        4
nvidia-rtx-4060              .    .    1    1    1    .    .    1        4
nvidia-rtx-4070              .    1    1    1    .    1    1    1        6
nvidia-rtx-4090              1    .    .    1    1    1    .    .        4
nvidia-rtx-5060-ti-16gb      .    1    1    1    .    .    1    1        5
nvidia-rtx-5070              1    1    .    .    1    1    1    .        5
nvidia-rtx-5070-ti           1    .    .    .    1    1    1    .        4
nvidia-rtx-5090              1    .    .    1    1    .    .    1        4
                             8    8    8    8    8    8    8    8       64
```

Her oyunda tam 8 ölçüm var ve indeks aralığı geniş (61'den 216'ya) — bu,
bölüm 3'teki türetme yöntemini mümkün kılan şey.

---

## 2. Ne gösterebiliriz

### 2.1 Ölçülmüş hücre — doğrudan gösterim

64 hücrede sayı **ölçüm**. Tahmin bile değil; kaynağı olan bir gerçek.

Örnek (bugünkü veri, Cyberpunk 2077, 1440p ultra, DLSS/FSR Quality):

```
nvidia-rtx-5090   202.6 FPS      nvidia-rtx-5070-ti  124.6 FPS
nvidia-rtx-4090   149.3 FPS      amd-rx-9070-xt      120.4 FPS
amd-rx-9070       109.4 FPS      nvidia-rtx-5070     108.5 FPS
amd-rx-7600        55.3 FPS      nvidia-rtx-4060      47.2 FPS
```

### 2.2 Boş hücre — oyun içi indeks oranıyla türetme

Kalan 48 hücre için yöntem tek satır:

```
tahmin(çip, oyun) = perf_index(çip) × ortalama_oran(oyun)

ortalama_oran(oyun) = o oyundaki ölçümlerin  avg_fps / perf_index  ortalaması
```

**Neden bu işe yarıyor:** bir oyunun içinde FPS ile indeks arasındaki oran
yaklaşık sabit. Ölçüldü — oyun başına dağılım:

| Oyun | n | Oran aralığı | Dağılım |
|---|---|---|---|
| alan-wake-2 | 8 | 0.540–0.639 | %4.9 |
| anno-117 | 8 | 0.561–0.697 | %6.6 |
| assassins-creed-shadows | 8 | 0.406–0.528 | %7.5 |
| call-of-duty-black-ops-7 | 8 | 1.018–1.326 | %8.3 |
| cyberpunk-2077 | 8 | 0.774–0.938 | %5.7 |
| death-stranding-2 | 8 | 0.699–0.797 | %4.7 |
| f1-25 | 8 | 1.230–1.513 | %8.3 |
| hogwarts-legacy | 8 | 0.743–0.884 | %5.3 |

Oranların oyundan oyuna çok farklı olması (0.41'den 1.51'e) tam olarak bu
özelliğin sebebidir: **tek bir indeks, oyunlar arasındaki bu farkı zaten
gizliyor.** F1 25 ile Assassin's Creed aynı karta üç kat farklı FPS veriyor;
kullanıcının gördüğü tek skor bunu söylemiyor.

### 2.3 Kart (varyant) tarafı — çipten miras

`perf_index` iki seviyeli okunuyor (K74/K87, şema bölüm 4). Kartın kendi
ölçümü yok; çipininki kullanılır ve arayüz bunun çip ölçümü olduğunu söyler.

- 58 kartın **46'sı** indeksli bir çipe bağlı
- Kapsanmayan iki çip: `nvidia-rtx-4070-super`, `nvidia-rtx-5080` (12 kart)

### 2.4 Toplam kapsam

| | Sayı |
|---|---|
| Seçilebilir GPU (60 çip + 58 kart) | 118 |
| **FPS gösterilebilen** (14 çip + 46 kart) | **60 (%51)** |
| Hücre (8 oyun × 14 çip) | 112 |
| — ölçülmüş | 64 |
| — türetilmiş | 48 |

---

## 3. Ne gösteremeyiz — ve neden

Bu bölüm plan kadar önemli. Her madde ölçülmüş bir eksikliktir, tahmin değil.

### 3.1 Tek ayar var: 1440p / ultra / upscaling açık

64 GPU ölçümünün **hepsi** aynı ayarda. Ölçülen dağılım:

```
64  R1440p ultra DLSS/FSR Quality
```

Yani:

- **1080p yok, 2160p yok.** GPU tarafında sıfır satır.
- **Yerel (upscaling kapalı) yok.** Hepsi DLSS/FSR Quality ile.
- **Başka preset yok.** Sadece ultra.

**Sonuç:** A.1'de çözünürlük/ayar seçtiren bir arayüz **olmayacak**. Tek bir
ayar etiketi yazılacak ve upscaling'in açık olduğu o etikette görünecek —
"1440p ultra" demek ve DLSS'i söylememek yanlış olur.

### 3.2 CPU sayıya giremez — kesişim sıfır

Bu, ölçerken çıkan en sert bulgu:

```
GPU ölçümü oyunları : alan-wake-2, anno-117, assassins-creed-shadows,
                      call-of-duty-black-ops-7, cyberpunk-2077,
                      death-stranding-2, f1-25, hogwarts-legacy

CPU ölçümü oyunları : anno-1800, avowed, baldurs-gate-3,
                      cyberpunk-2077-phantom-liberty, f1-24,
                      horizon-forbidden-west, marvels-spider-man-2,
                      outcast-a-new-beginning, starfield

ORTAK OYUN          : SIFIR
```

Yakın görünen çiftler bile aynı oyun değil: `cyberpunk-2077` ile
`cyberpunk-2077-phantom-liberty` ayrı satırlar, `f1-24` ile `f1-25` ayrı
oyunlar. Üstelik iki küme farklı çözünürlük, farklı preset ve farklı
upscaling ayarında.

**Sonuç:** A.1'in verdiği sayı **GPU-sınırlı FPS**'tir. Zayıf bir işlemci bu
sayıyı düşürür ve model bunu göremez. Arayüz bunu açıkça söyleyecek. Bunu
düzeltmenin tek yolu A.2'deki "aynı oyunda hem CPU hem GPU ölç" maddesidir.

`games.gpu_weight` / `cpu_weight` ile harmanlamak da **çözüm değil**: 17
oyunun hepsinde ikisi de 0.5 yazıyor, yani ölçülmemiş yer tutucu. Ölçülmemiş
bir ağırlıkla harmanlamak, uydurmayı formüle gizlemek olur.

### 3.3 118 GPU'nun 58'inde hiçbir şey yok

46 indekssiz çip + indekssiz çipe bağlı 12 kart. Bunlarda tahmin **çıkmaz**;
arayüz "henüz yeterli ölçüm yok" der. Bu bir hata değil (CLAUDE.md, veri
kuralları).

### 3.4 Tek kaynak

178 ölçümün hepsi ComputerBase. İkinci bir kaynak yok, dolayısıyla
kaynaklar arası sapma ölçülemiyor. S37 zaten aynı kaynağın iki turu arasında
bile köprü kurulamadığını gösterdi (K93).

---

## 4. Hata payı — ölçüldü

Türetilen sayının hata payı **birini-dışarıda-bırak** ile ölçüldü: 64 noktanın
her biri, kendi verisi hesaba katılmadan tahmin edildi ve gerçek ölçümle
karşılaştırıldı.

```
ortalama mutlak hata   %6.1
medyan                 %4.9
%90 dilim              %12.8
en kötü                %27.8
+-%10 icinde kalan     %83
+-%15 icinde kalan     %95
```

**Yayınlanacak ifade:** türetilmiş hücrelerde "±%10 (10 tahminden 8'i)".
En kötü durumun %27.8 olduğu da bir yerde yazmalı — %90 dilimin dışı
gizlenmez.

Bu ölçüm A.3'te script'e dönecek ve her veri turunda yeniden çalışacak;
şimdilik tek seferlik yapıldı ve sayıları burada duruyor.

---

## 5. Uygulama planı

### 5.1 Şema değişikliği gerekmiyor

Türetilen FPS **hiçbir tabloya yazılmaz**, okuma anında hesaplanır.

Gerekçe K71'in aynısı: hesaplanmış bir sayı, ölçüm tablosuna yazılırsa
ölçümden ayırt edilemez hale gelir. `benchmark_points` append-only ve gerçek
ölçüm tablosudur; türetilmiş satır oraya girerse kaynak defteri anlamını
kaybeder. Yeni bir tablo da açılmıyor — hesap ucuz (oyun başına 8 satır) ve
kalıcı hale getirilmesi için bir sebep yok.

### 5.2 `engine/fps-estimate.ts` — yeni saf motor

`/engine` kuralı gereği veritabanı, ağ, React görmez. Girdi olarak ölçümleri
ve indeksleri alır, çıktı olarak oyun başına satır verir.

Kabaca:

```
girdi : gpu_index, oyun başına [(index, avg_fps)] listesi
çıktı : oyun başına { fps, kaynak: "olculdu" | "turetildi", hata_payi }
```

`kaynak` alanı arayüz için değil, **dürüstlük için** var: ölçülmüş sayı ile
türetilmiş sayı aynı yerde gösterilecekse ayırt edilebilmeli. Bu, K90'ın çip
fiyatında ve K74'ün kart indeksinde kurduğu desenin aynısı.

### 5.3 Testler — `/engine` kuralı gereği zorunlu

`tests/fps-estimate.test.ts`. En az şunlar:

- Ölçülmüş hücre **birebir ölçümü** döndürür, türetme yapılmaz
- Boş hücre oranla türetilir ve `kaynak: "turetildi"` işaretlenir
- İndekssiz çip → satır yok (null değil, hiç yok)
- Tek ölçümlü oyun → oran tek noktadan çıkar, hata payı yayınlanamaz
- Sıfır/negatif indeks kenar durumları

### 5.4 Veri okuma yolu

`/data` altında yeni bir okuma fonksiyonu: `benchmark_points` (gerçek, dev-seed
filtreli) + `perf_index` birlikte. `/data` içe aktarma kuralı gereği göreli yol
ve `.ts` uzantısı.

### 5.5 Arayüz

Sistem sayfasında, mevcut tek skorun **yanına** — yerine değil. Tek skor
sistemin bütününü (CPU dahil) anlatıyor; oyun listesi GPU-sınırlı FPS
anlatıyor. İkisi farklı sorulara cevap.

Gösterilecekler:

- Oyun adı ve FPS
- **Ayar etiketi:** "1440p ultra, DLSS/FSR Quality"
- **Ölçüm mü türetme mi** — türetilmişse hata payı
- **"Bu sayı ekran kartına göredir; işlemci hesaba katılmadı."**
- Kapsam dışı kartta: "bu kart için henüz ölçüm yok"

---

## 6. Ölçüm nasıl yapıldı

Bütün sayılar geliştirme veritabanına karşı, `source != 'dev_seed'` filtresiyle
alındı. Kullanılan sorgular:

- Küme ayrımı: `benchmark_points` satırlarının `cpu_part_id` doluluğuna göre
  bölünmesi; CPU'lu satırların hepsinin `gpu_part_id = nvidia-rtx-5090`
  olduğunun doğrulanması
- Matris: GPU × oyun çapraz sayımı
- Ayar profili: `resolution + preset + upscaling` üçlüsünün dağılımı
- Kesişim: iki kümenin `game_id` kümelerinin kesişimi
- Kapsam: `gpu_variant_specs.chip_part_id` ile indeksli çip kümesinin eşleşmesi
- Hata payı: birini-dışarıda-bırak; her nokta için oran, o noktanın kendisi
  hariç aynı oyunun diğer 7 ölçümünden hesaplandı

Ölçüm script'i geçiciydi ve silindi — A.3 bunu kalıcı bir script'e çevirecek.

---

## 7. Açık sorular

1. **Ölçülmüş ve türetilmiş sayı aynı listede yan yana mı dursun, yoksa
   türetilmişler ayrı mı gösterilsin?** Yan yana durursa liste dolu görünür
   ama karışma riski var; ayrılırsa dürüst ama liste parçalanır. Öneri: yan
   yana, ama türetilmişte hata payı satırın kendisinde yazılı.
2. **Hangi oyun önce gösterilsin?** Ölçülmüş hücresi olanlar önce mi, alfabetik
   mi, yoksa kullanıcının kartına en yakın ölçüm hangisindeyse o mu?
3. **Tek skor ile oyun listesi çelişirse ne yazılır?** Zayıf CPU + güçlü GPU
   sisteminde tek skor "işlemci sınırlıyor" derken oyun listesi yüksek FPS
   gösterecek. İkisi farklı şeyler söylüyor ve kullanıcı bunu çelişki olarak
   okuyabilir.
