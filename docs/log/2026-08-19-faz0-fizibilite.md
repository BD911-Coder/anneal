# 2026-08-19 — Faz 0: benchmark kaynak fizibilitesi

Plan raporundaki (`2026-08-19-benchmark-toplama-plani.md`) faz 0. Amaç: toplamaya
başlamadan önce kaynakların gerçekte ne verdiğini ölçmek.

**Veri toplanmadı, `benchmark_points`'a tek satır yazılmadı.** Yöntem sınaması
için okunan 16 sayı geçici klasörde kaldı ve silindi.

**Harcanan: 25 tool çağrısı.**

---

## 1. Kullanım şartları — bir kaynak tamamen elendi

Yedi alan adının `robots.txt`'si okundu.

| Alan adı | Durum |
|---|---|
| **techpowerup.com** | **ELENDİ.** Aşağıya bak. |
| computerbase.de | `*` için yalnızca forum/api/arama yolları kapalı. Makale sayfaları açık. |
| guru3d.com | `Content-Signal: search=yes, ai-train=no, use=reference`, `Allow: /` |
| pcgameshardware.de | `Content-signal: search=yes, ai-train=no`, inceleme yolları açık |
| tomshardware.com | Genel engel yok |
| techspot.com | Genel engel yok |
| notebookcheck.net | Yalnızca iki teknik yol kapalı |

**TechPowerUp neden elendi.** `robots.txt`'nin başında düz metin olarak:

> "Use of any device, tool, or process designed to data mine or scrape the
> content using automated means is prohibited without prior written permission"

ve devamında yasaklanan kullanımlar arasında AB Telif Direktifi Madde 4
kapsamındaki metin/veri madenciliği ile yapay zekâ ve dil modeli geliştirme
sayılıyor. Ayrıca:

```
User-agent: ClaudeBot
Disallow: /gpu-specs/
Disallow: /cpu-specs/
```

Yani hem genel yasak var hem de tam olarak bu araç adıyla ilgili yollar
kapatılmış. **TechPowerUp otomatik toplama için kullanılamaz.** İzin istenip
alınmadıkça bu kaynak kapalı sayılmalı.

`ai-train=no` sinyali (Guru3D, PCGH) bizi doğrudan bağlamıyor — model eğitmiyoruz
— ama `use=reference` ifadesi atıflı referans kullanımını işaret ediyor ve
bizim `source_url` disiplinimiz zaten bu.

---

## 2. Sayılar HTML'de mi, resimde mi?

İki kaynak derinlemesine incelendi.

### Tom's Hardware — GPU Benchmarks Hierarchy

- **HTML tablo**, `curl` ile okunuyor. 2 tablo × 48 kart.
- Üç çözünürlük (1080p / 1440p / 4K Ultra), her hücrede hem yüzde hem
  **mutlak FPS**: `85.7% (143.4)`.
- Kataloğumuzun **48/60 kartını** kapsıyor.

**Ama `benchmark_points`'a giremez.** Sayfanın kendi ifadesiyle:

> "The FPS score is the geometric mean (equal weighting) of all 11 games."

Bu bir **oyun paketinin geometrik ortalaması**, tek bir oyunun ölçümü değil.
`benchmark_points.game_id` zorunlu ve bunun karşılığı yok; uydurma bir "oyun"
kaydı açmak veriyi yalanlamak olur.

Sayfa per-oyun grafikleri de sunuyor ama:

> "These charts only cover current-gen GPUs for readability."

ve o grafikler **PNG resim** (`cdn.mos.cms.futurecdn.net/...png`). Okunamaz.

**Sonuç: Tom's hiyerarşisi kaynak değil, çapraz kontrol aracı.** Bölüm 4'te
tam olarak bu amaçla kullanıldı.

### ComputerBase — aradığımız yapı

Bir inceleme makalesinin benchmark sayfası (`.../seite-3`) sunucu tarafında
üretiliyor ve `curl` ham HTML'i veriyor. Grafikler `<li class="chart__row">`
listeleri, yani **sayılar düz metin**:

```
Alan Wake 2, 2.560 x 1.440, DLSS/FSR Quality - Rasterizer
  GeForce RTX 5090 (32 GB)   138,0
  GeForce RTX 4090 (24 GB)   110,6
  GeForce RTX 5070 Ti (16 GB) 83,8
  ...
```

Her grup başlığı şemamızın istediği dörtlüyü taşıyor: **oyun + çözünürlük +
upscaling + rasterizer/raytracing**. Tek sayfada 24 grup sayıldı (4 oyun × 2
çözünürlük × 3 sekme). Makale çok sayfalı, "Gaming-Benchmarks Seite 1–5".

**İşlemci tarafı da aynı yapıda.** CPU-Rangliste sayfasında 187 `chart__row`,
720p + RTX 5090 ile — yani doğru CPU-sınırlı yapılandırma — ve per-oyun
grafikleri (Anno 1800, Avowed, Baldur's Gate 3, CP2077, F1 24, Horizon FW,
Spider-Man 2, Outcast, Starfield) ayrı ayrı listeleniyor.

Bir sınırlama: CPU satırlarının etiketinde bellek yapılandırması yazıyor
(`DDR5-5600CL26`). `benchmark_points`'ta bu alan yok. Karşılaştırılabilirliği
etkiliyor ama `source_url` kaydı tuttuğu için izlenebilir; şimdilik sorun değil.

---

## 3. Yöntem sınaması — gerçek veriyle

Bölüm 3'teki yinelemeli uyum, ComputerBase'ten okunan **16 gerçek satırla**
sınandı. K72'nin 8 satır/kombinasyon tavanına uyuldu:

- **Grup A** — ARC Raiders, 1440p, Native, Rasterizer → 8 kart
- **Grup B** — AC Shadows, 1440p, DLSS/FSR Quality, Rasterizer → 8 kart
- Köprü: 3 kart (RTX 4070, RX 9070 GRE, RX 7800 XT)

Algoritma 200 yinelemede yakınsadı, 14 kartı tek ölçeğe yerleştirdi
(RTX 4070 = 100):

```
rtx-5090        239.2      rx-7800-xt       98.3
rtx-4090        205.8      rx-9060-xt       86.1
rtx-5070-ti     154.2      rtx-5060-ti-16   82.0
rx-9070-xt      132.3      arc-b580         61.8
rtx-5070        131.7      rtx-4060         59.6
rx-9070         122.9      rx-7600          46.5
rx-9070-gre     104.7
rtx-4070        100.0      grup zorlugu: A=85.4  B=56.1
```

**Yöntem çalışıyor.** Kısmi örtüşmeden tek ölçek çıkıyor, sıralama mantıklı,
yeni kütüphane gerekmedi.

### Bağımsız kaynakla çapraz kontrol

Aynı 14 kart, Tom's Hardware'in 11 oyunluk paketiyle (1440p Ultra), ikisi de
RTX 4070 = 100'e normalize:

| kart | ComputerBase | Tom's | fark |
|---|---|---|---|
| rtx-5090 | 239.2 | 215.0 | **+11.2%** |
| rtx-4090 | 205.8 | 184.3 | **+11.7%** |
| rtx-5070-ti | 154.2 | 150.1 | +2.7% |
| rx-9070-xt | 132.3 | 149.7 | **−11.6%** |
| rtx-5070 | 131.7 | 123.9 | +6.3% |
| rx-9070 | 122.9 | 133.7 | −8.1% |
| rx-9070-gre | 104.7 | 111.3 | −5.9% |
| rtx-4070 | 100.0 | 100.0 | 0.0% |
| rx-7800-xt | 98.3 | 108.9 | −9.7% |
| rx-9060-xt | 86.1 | 86.5 | −0.5% |
| rtx-5060-ti-16 | 82.0 | 94.3 | **−13.1%** |
| arc-b580 | 61.8 | 65.2 | −5.2% |
| rtx-4060 | 59.6 | 61.2 | −2.6% |
| rx-7600 | 46.5 | 58.4 | **−20.3%** |

**Ortalama mutlak sapma %7.8, en büyük %20.3.**

### Sapmanın sebebi — planı değiştiren üç ders

1. **Üç köprü kartı az.** B grubunun tamamı Tom's'a göre aşağıda okunuyor.
   Sebep yapısal: B grubu ölçeğe yalnızca 3 kart üzerinden bağlı, o üç kartın
   ortak hatası bütün gruba taşınıyor. **Köprü en az 6 kart olmalı.**
2. **Farklı upscaling ayarları köprülenmemeli.** A grubu Native, B grubu
   DLSS/FSR Quality. DLSS ile FSR aynı ayarda aynı işi yapmıyor; köprü kartları
   iki farklı rejim arasında geçiş yaptığı için marka yönlü sapma giriyor
   (NVIDIA üstte yüksek, AMD altta düşük okunuyor).
3. **İki oyun yetmiyor.** Tom's 11 oyun kullanıyor. Tek oyunun kendine has
   davranışı (RX 7600'ün AC Shadows'ta düşmesi) doğrudan indekse yansıyor.
   **Parça başına 3 ölçüm alt sınır, 5 daha güvenli.**

Bunların hiçbiri yöntemi geçersiz kılmıyor — hepsi toplama disiplinine dönüşen
düzeltmeler.

---

## 4. Planı bozan asıl bulgu: K72 tavanı ile hedef uyuşmuyor

K72 dün karara bağlandı: **alan adı başına toplam 25 satır**.

Plan hedefi ~306 satır. Basit aritmetik:

```
306 satir / 25 satir-per-alan-adi  =  13 farkli alan adi
```

Ve bu alan adlarının hepsinde **makine tarafından okunabilir per-oyun** veri
olması gerekiyor. Faz 0'da bulunan durum:

| | Adet |
|---|---|
| İncelenen alan adı | 7 |
| Kullanım şartları nedeniyle elenen | 1 (TechPowerUp) |
| Per-oyun HTML metin verisi **doğrulanmış** | **1** (ComputerBase) |
| Yalnızca paket ortalaması (game_id yok) | 1 (Tom's) |
| Okunabilirliği henüz ölçülmemiş | 4 |

Kalan dördü de doğrulansa **5 alan adı × 25 = 125 satır** eder. Hedefin
%40'ı. Köprü kartları da bu bütçeden yendiği için gerçek kapsama daha düşük
olur.

**Bu bir çelişki ve karar gerektiriyor.** Üç yol var:

| Yol | Sonuç |
|---|---|
| **A.** Alan adı tavanını yükselt (25 → 60-80) | Hedef tutar. Telif riski artar; K72'nin gerekçesi zayıflar. |
| **B.** Hedefi düşür: parça başına 2 ölçüm | ~204 satır, yine 8+ alan adı gerekiyor. Faz 0'ın 3. dersine ters — 2 ölçüm zaten az çıktı. |
| **C.** Kapsamı daralt: yalnızca en çok satan ~30 GPU + ~20 CPU | ~150 satır, 6 alan adı yeter. Kalan parçalar indekssiz kalır (K74 bunu zaten normal sayıyor). |

**Önerim: C, sonra gerekirse A.** Kapsamı daraltmak, tavanı gevşetmekten daha
az risk taşıyor ve K74 ile zaten tutarlı: indeksi olmayan parça kullanıcıya
"veri yok" diyor, yalan söylemiyor. En çok tercih edilen kartlarda indeks olması,
bütün kartlarda yarım yamalak indeks olmasından iyi.

→ **`SORULAR.md` S33.**

---

## 5. Ölçülen büyüklük — plan tahmini vs gerçek

| | Plan tahmini | Faz 0 gerçeği |
|---|---|---|
| Faz 0 tool çağrısı | 25–40 | **25** |
| Faz 0 oturum | 0.5 | ~0.4 |

Tahmin tuttu. Ama faz 2-4 tahminleri **şu an geçersiz**, çünkü:

- Kaynak sayısı beklenenden az çıktı (bölüm 4). Satır başına maliyet, sayfa
  başına alınabilen satır sayısına bağlı ve tavan bunu 25'e kilitliyor.
- ComputerBase'te bir sayfadan 24 grup okunabiliyor — teknik olarak ucuz, ama
  tavan yüzünden o sayfadan en fazla 25 satır alınabiliyor. **Darboğaz teknik
  değil, politika.**
- Yeni bir alan adına geçmek, o alan adının yapısını öğrenmeyi gerektiriyor:
  ComputerBase'in yapısını çözmek 12 çağrı aldı. Her yeni kaynak için ~8-12
  çağrılık sabit maliyet var.

**S33 kararlanmadan faz 2 yeniden boyutlandırılamaz.** Kaba tahmin, C yolu
seçilirse: ~150 satır, 6 alan adı, ~6 × 10 = 60 çağrı öğrenme + ~150 çağrı
toplama ≈ **210 çağrı, 2.5–3 oturum** (önceki tahmin 5–7 oturumdu).

---

## 6. Toplamaya başlamadan önce netleşmesi gerekenler

1. **S33** — kapsam/tavan çelişkisi (bölüm 4). Bu karar verilmeden toplama
   başlamamalı.
2. **Oyun seçimi.** ComputerBase'in bugünkü paketi Alan Wake 2, Anno 117,
   ARC Raiders, AC Shadows ve devamı; CPU tarafında Anno 1800, Avowed, BG3,
   CP2077, F1 24, Horizon FW, Spider-Man 2, Outcast, Starfield. `games`
   tablosuna hangilerinin gireceği, **birden fazla kaynakta ortak** olanlara
   bakılarak seçilmeli — tek kaynağın paketine bağlanmak, o kaynak paketini
   değiştirdiğinde veriyi öksüz bırakır.
3. **Köprü kuralı yazılmalı:** en az 6 ortak kart, ve köprü grupları aynı
   upscaling rejiminde olmalı (tercihen Native).
4. **Eski nesil sorunu ölçülmedi.** RDNA2 ve Ampere kartları bugünkü
   incelemelerde yok; 2021-2022 makalelerinde farklı oyun paketi ve sürücü var.
   Bu kartların ölçeğe nasıl bağlanacağı henüz bilinmiyor ve faz 2'nin en
   riskli parçası.

---

## Açık kalan sorular

- **S33** — Kapsam mı daralsın, alan adı tavanı mı yükselsin? (bölüm 4)
- Eski nesil kartların ölçeğe bağlanması (yukarıda 4. madde) — ölçülmedi,
  faz 0'ın ikinci bir turu gerekebilir.
