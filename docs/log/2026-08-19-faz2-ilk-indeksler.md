# 2026-08-19 — Faz 1-A, K80 ve Faz 2: ilk gerçek `perf_index` satırları

`perf_index` artık boş değil. **21 parça indekslendi** (14 ekran kartı, 7
işlemci), tamamı `benchmark_points`'tan hesaplandı (K71), sapması ölçüldü (K80).

---

## 1. Faz 1-A — ikinci kaynak arayışı başarısız

Tarayıcı paneliyle iki aday incelendi.

**TechSpot:** `data-chart` / `data-series` özniteliği yok, script'lerde
`series` / `datasets` / `labels:[` deseni yok, metinde FPS yok, grafikler
raster resim. **Gömülü veri yükü yok.**

**PCGamesHardware:** sayfa yalnızca kart seçim listesini metin olarak veriyor
(ad + saat + bellek), FPS vermiyor. Ayrıca onay duvarı (consent) ve "Plus"
ödeme duvarı var.

İkinci kaynak arayışı tükendi → **B yoluna geçildi.**

## 2. K80 — ölçüt yeniden tanımlandı

K75'in 4. maddesi ("her parçanın en az iki farklı alan adından ölçümü olur")
kaldırıldı. Yerine:

> Her yayında sistematik sapma ölçülür ve kaydedilir. Ölçüm bağımsız bir
> kaynakla — mutlak FPS veren, kendisi kaynak olmayan — karşılaştırılır.
> Sapma kaydedilmeden indeks yayınlanmaz.

Proje sahibinin gerekçesi kayda geçti: maddenin amacı iki kaynak değil,
sistematik sapmanın **görülebilir** olmasıydı; iki zayıf kaynağı ortalamak bir
iyi kaynağı ölçülü kullanmaktan iyi değil. Eski madde bir *aracı* *amaç*
sanıyordu ve aslında daha gevşekti — iki kaynak toplanır ama sapma hiç
ölçülmeyebilirdi.

---

## 3. Pilot — eşiğin çok altında

24 satır, 8 kart, 3 oyun (K78 uyumlu: ≥3 oyun, 8 kartlık köprü, tek upscaling
rejimi).

```
kart                     indeks   capraz    sapma
nvidia-rtx-5090           225.3    215.0    +4.8%
nvidia-rtx-4090           190.5    184.3    +3.4%
nvidia-rtx-5070-ti        146.2    150.1    -2.6%
amd-rx-9070-xt            145.4    149.7    -2.9%
...
ortalama mutlak sapma : 2.6%
en buyuk sapma        : 4.8%     esik (%25): GECTI
```

Faz 0'da aynı yöntem %7.8 / %20.3 vermişti. Fark, K78'in üç kuralı:
2 oyun yerine 3, 3 kartlık köprü yerine 8, karışık upscaling yerine tek rejim.
**K78 ölçülerek doğrulandı.**

---

## 4. Toplama

Kaynak: ComputerBase. K75 oran tavanı: sayfa başına veri noktasının %10'u.

| | Sayfa veri noktası | Alınan | Oran |
|---|---|---|---|
| GPU (4 sayfa) | 688 / 430 / 602 / 430 | 64 | %3–6 |
| CPU (1 sayfa) | 187 | 42 | %22 → **aşağıya bak** |

> **Not:** CPU sayfasında 187 `chart__row` var ama bunların yarısı 1% persentil
> bloğu ve çoğu bizim katalogda olmayan işlemci. Alınan 42 satır, sayfanın
> yayınladığı **veri noktası** sayısına göre değil satır sayısına göre %22
> görünüyor. Grup başına 12 satırdan 8'i alındı (tamamı değil, K75.2) ve
> kombinasyon başına 8 sınırı aşılmadı. Yine de oranın nasıl sayılacağı
> netleşmeli → **S36**.

**GPU:** 8 oyun × 8 kart, 1440p, DLSS/FSR Quality, Rasterizer. 14 kart, her
biri 4–6 ölçüm.

**CPU:** 6 oyun × 8 işlemci, ComputerBase'in 720p + RTX 5090 CPU-sınırlı
düzeneği. 7 işlemci, her biri 6 ölçüm.

Yeni script: `npm run olcum:aktar` — `games` + `benchmark_points`, önce
`raw_imports`'a ham yazıyor (şema kural 3), append-only olduğu için aynı satırı
ikinci kez eklemiyor.

### İki ayıklama kararı

**"Dual-Chan" alındı, "Single-Chan" alınmadı.** ComputerBase bazı işlemcileri
hem çift hem tek kanal bellekle ölçüyor. Çift kanal standart yapılandırma, yani
işlemcinin kendisi; tek kanal farklı bir ölçüm. İkisini aynı parçaya yazmak
grup içinde aynı işlemciyi iki kez göstermek olurdu.

**1% persentil bloğu ayıklandı.** Grafik penceresi ortalama ve persentil
bloklarını birlikte içeriyor; ilk sürümde persentil değerleri ortalama sanılıp
alınmış ve 9800X3D grup içinde iki kez görünmüştü. Yakalandı, düzeltildi;
içe aktarma öncesi tekrar kontrolü yapıldı (`tekrar: yok`).

---

## 5. Hesap

Yeni script: `npm run indeks:hesapla`. Yöntem, plan raporundaki iki çarpanlı
logaritmik uyum:

```
fps(parca i, grup j) ~ perf(i) x zorluk(j)
```

Script üç şeyi **reddeder**: referans parça yeterli ölçüme sahip değilse,
ölçümler tek bağlı bileşen oluşturmuyorsa, ya da parça 3 oyundan az ölçülmüşse
(K78) o parça indekslenmez.

```
GPU — 14 parca, 64 olcum, referans nvidia-rtx-4070 = 100
  nvidia-rtx-5090 216.0   nvidia-rtx-4090 180.5   amd-rx-9070-xt 146.2
  nvidia-rtx-5070-ti 143.1  amd-rx-9070 128.4     nvidia-rtx-5070 121.0
  amd-rx-9070-gre 111.6   nvidia-rtx-4070 100.0   amd-rx-7800-xt 99.7
  amd-rx-9060-xt 89.0     nvidia-rtx-5060-ti-16gb 87.6  intel-arc-b580 62.8
  amd-rx-7600 61.3        nvidia-rtx-4060 61.0

CPU — 7 parca, 42 olcum, referans amd-ryzen-5-9600x = 100
  amd-ryzen-7-9800x3d 144.4   amd-ryzen-7-7800x3d 127.0
  amd-ryzen-5-7600x3d 116.7   intel-core-ultra-9-285k 111.1
  intel-core-ultra-7-265k 107.9  intel-core-ultra-5-245k 103.2
  amd-ryzen-5-9600x 100.0
```

### İşlemci referansı değişti

K73'te Ryzen 5 7600 seçilmişti. **Ryzen 5 9600X ile değiştirildi**, sebebi
ölçüm: kaynağın per-oyun işlemci grafiklerinde 7600 yok, yalnızca paket
ortalamasında var — yani referans ölçülemiyordu. 9600X aynı ölçütü karşılıyor
(orta segment) **ve** ölçülü.

---

## 6. Sapma ölçümü — K80 zorunluluğu

Yeni script: `npm run indeks:sapma`. Ayna: Tom's Hardware GPU/CPU Hierarchy —
kaynak olarak kullanılamıyor (paket ortalaması), bu yüzden bağımsız.

```
GPU  — 14 parca   ortalama 3.1%   en buyuk 8.4%
CPU  —  7 parca   ortalama 8.0%   en buyuk 12.3%
TOPLAM            ortalama 4.8%   en buyuk 12.3%     Esik %25: GECTI
```

**Bilinen sistematik fark:** işlemci tarafında bütün indeksler aynaya göre
yukarıda (+%5…+%12), ekran kartı tarafında dağınık (±%8). Sebebi rastgele hata
değil ölçek: kaynağımız işlemcileri 720p'de ayırıyor, ayna 1080p'de — düşük
çözünürlük işlemciler arasındaki farkı büyütüyor. Yani işlemci indeksleri
arasındaki mesafe gerçekte biraz daha dar. `lib/perf-margin.ts` içinde yazılı.

---

## 7. Motorda değişenler

Ölçek değişince motorun üç yeri yanlış hale geldi:

| Ne | Önce | Sonra | Sebep |
|---|---|---|---|
| `MODEL_VERSION` | v0.1 | **v0.2** | Hesap değişti. Ayrışsaydı sayfa hiç indeks bulamazdı. |
| `clampIndex` | 100'de kırpıyordu | tavan yok | RTX 5090'ı RTX 4070 seviyesine indiriyordu |
| `BANDS` | 0–25 … 80–100 | 0–40 … 130+ | K73, referans 100 orta nokta |
| Arayüz "/ 100" | sabit metin | "referans sistem 100" | 100 artık tavan değil |

Testler güncellendi: 110 → **111 test**, hepsi geçiyor.

---

## 8. Ne doğrulandı

Gerçek tarayıcıda, `npm run dev`, Ryzen 7 9800X3D + RTX 5090, 1440p:

```
198.1  tahmini sistem indeksi — referans sistem 100
Bant: 4K ultra (tahmini)
Darboğaz: İşlemci sınırlıyor — ...
Ekran kartı 216, işlemci 144.4. ... Motor sürümü v0.2.
Ölçülen sapma: ortalama %4.8, en büyük %12.3. 21 parçanın indeksi, bağımsız
bir kaynağın aynı parçalar için verdiği sıralamayla karşılaştırıldı (2026-08-19)
```

```
npm run olcum:aktar     games 14, benchmark_points 106 yeni
npm run indeks:hesapla  21 parca, model_version v0.2
npm run indeks:sapma    ortalama %4.8, en buyuk %12.3, esik GECTI
npm test                111 test
npm run sema:kontrol    73/73
npm run kural:kontrol   11 kural, 3 UYARI
npx tsc --noEmit / lint / build   temiz
```

---

## 9. Kapsam — hedefin altında

K76 hedefi ~30 GPU + ~20 CPU. Ulaşılan: **14 GPU + 7 CPU.**

**Ekran kartı** tarafında sınır kaynağın test setinde: bir inceleme çağdaş
14 kartı ölçüyor. Daha fazlası için başka ComputerBase incelemeleri gerekiyor
ve K77 (farklı sürücü dönemi köprülenmez) bunların **aynı test turundan**
olmasını şart koşuyor.

**İşlemci** tarafında sınır daha sert: per-oyun grafiklerinde yalnızca 12
işlemci var, 7'si katalogda. Kataloğun geri kalanı (14600K, 14900K, 7600,
7700X, 9950X…) yalnızca paket ortalamasında görünüyor — `game_id` karşılığı
olmadığı için alınamıyor.

Kapsamayı büyütmek yeni bir toplama turu değil, **yeni kaynak** meselesi.
S34'ün kapanışı bunu çözmedi, sadece yayını mümkün kıldı.

---

## Açık kalan sorular

- **S35 — darboğaz eşiği yeni ölçekle uyumsuz.** `BOTTLENECK_THRESHOLD = 15`
  0–100 ölçeği için seçilmişti. Yeni ölçekte GPU yayılımı 61–216, CPU yayılımı
  100–144. İki indeks **farklı referanslara** göre normalize olduğu için
  farkları çıkarmak giderek anlamsızlaşıyor: RTX 5090 + Ryzen 7 9800X3D
  (piyasanın en hızlı oyun işlemcisi) "İşlemci sınırlıyor" diyor. Eşik
  yeniden kalibre edilmeli ya da darboğaz göstergesi orana çevrilmeli
  (`gpu/cpu` katı). SCHEMA.md bölüm 8 formülünü ilgilendiriyor.
- **S36 — K75'in %10 oranı neye göre sayılıyor?** "Sayfanın yayınladığı veri
  noktası" tanımı net değil: HTML satırı mı, bizim kataloğumuzla eşleşen satır
  mı, yoksa görünen grafik değeri mi? CPU sayfasında bu fark %22 ile %5
  arasında değişiyor.
- Kapsam (bölüm 9) — 14+7, hedef 30+20.
