# Vekil skor toplama — elle doldurulacak

**Ne için:** ölçümü olmayan aileleri (`ampere`, `rdna_2`, `alchemist`)
çapalayabilmek. Sorulan soru: *kamuya açık bir sentetik skor, bizim
ölçülmüş indeksimizin vekili olabilir mi?*

**Neden elle:** OpenBenchmarking'in `robots.txt` dosyası `ClaudeBot`'u tam
yolla yasaklıyor (K173). Yasak **otomatik ajana** bakıyor; tarayıcısında
sayfayı okuyan bir insana değil. Bu yüzden toplama sende, çözümleme bende.

---

## 1. Hangi test profili? — öncelik sırası

Modelimiz **rasterizasyon** performansını anlatıyor. Bu yüzden oyun ve
grafik profilleri, saf hesap (compute) profillerinin önünde.

İkinci ölçüt **kapsam**: bizim kartlarımızın çoğu o profilde ölçülmüş olmalı.
Üç sonucu olan bir profil, mükemmel bir test bile olsa işe yaramaz.

### Öncelikli (rasterizasyon, geniş kapsam)

| # | Profil | Neden |
|---|---|---|
| 1 | **Unigine Superposition** | Saf rasterizasyon, tek sayı (FPS), Linux'ta çok yaygın çalıştırılıyor |
| 2 | **Unigine Heaven** | Daha eski ama kapsamı en geniş olan; eski kartlar da var |
| 3 | **Unigine Valley** | Heaven'ın kardeşi; Heaven yoksa bak |
| 4 | **GravityMark** | Vulkan, yeni kartlarda kapsam iyi |
| 5 | **vkmark** | Vulkan, hafif; kapsam orta |
| 6 | **Xonotic** | OpenGL oyun, Linux'ta çok yaygın; yüksek çözünürlük/ultra ayar seç |

### Kullanma (hesap ağırlıklı — farklı bir şeyi ölçüyorlar)

Blender · LuxCoreRender · OctaneBench · NAMD · hashcat · mixbench · cl-mem ·
Geekbench Compute · her türlü OpenCL/CUDA hesap testi.

Bunlar hesap birimini ölçüyor; bizim indeksimiz oyun karesi. Bir kartın
hesapta iyi olması oyunda iyi olduğunu **söylemez** ve tam olarak bu yüzden
vekil olarak kullanılamazlar.

### Nasıl seçilir — pratik kural

1. Yukarıdaki listeden **tek bir profille** başla ve **on sekiz satırın
   çoğunu** o profille doldurmaya çalış.
2. O profilde kartların yarısından azı varsa bir sonrakine geç.
3. **Profilleri karıştırma.** Farklı profillerin skorları aynı sütuna
   girerse regresyon anlamsızlaşır. Karıştırman gerekiyorsa `test_profile`
   sütunu zaten satır başına; çözümleme profili ayrı ayrı ele alır.

> **Not:** profil adları hafızadan yazıldı ve siteye bakılamadı (K173).
> Adı birebir tutmayabilir; sitedeki karşılığını bulup **tam adını** yaz.

---

## 2. Aynı satırda hangi sistem?

Skor tek başına anlamsız. Aynı kart, farklı sürücü ve farklı işlemciyle
farklı sayı verir. Bu yüzden her satırda **sürücü sürümü**, **işlemci** ve
**işletim sistemi** de isteniyor.

**Mümkün olduğunca benzer sistemler seç.** Aynı profilde birden fazla sonuç
varsa: işlemcisi güçlü olanı (kartı sınırlamasın) ve sürücüsü yeni olanı
tercih et.

---

## 3. Baştan söylenen sorun: Linux + sürücü yığını

OpenBenchmarking sonuçları **Linux**. AMD kartları **Mesa** sürücüsüyle,
NVIDIA kartları **tescilli** sürücüyle çalışıyor. Bu iki yığın aynı donanımdan
farklı performans çıkarır ve fark **markaya göre sistematiktir**.

Sonuç: kalıntılar (regresyonun ıskaladığı miktar) **mimariye göre değil
markaya göre** kümeleniyorsa, sebep büyük olasılıkla budur — ve o hâlde vekil,
**marka içinde** işe yarasa bile **markalar arası çapalama için
kullanılamaz**. Çözümleme bu kontrolü baştan yapıyor ve raporun en üstüne
yazıyor.

Bunu bilerek topluyoruz: sonuç olumsuz çıkarsa da bir bilgi.

---

## 4. Dosya

`data/proxy/openbenchmarking.csv` — on sekiz satır, slug'lar dolu, geri kalanı
boş. Yalnızca boş hücreleri doldur, satır ekleme/silme.

| Sütun | Ne yazılacak |
|---|---|
| `part_id` | **DOLU, dokunma** |
| `test_profile` | Profilin sitedeki tam adı |
| `score` | Sayı, ondalık nokta ile |
| `unit` | `fps`, `points`, `score` … sitede ne yazıyorsa |
| `resolution` | `1920x1080`, `2560x1440` … |
| `preset` | `Extreme`, `Ultra`, `High` … yoksa boş |
| `driver` | Sürücü sürümü — `Mesa 24.1.3`, `NVIDIA 550.90` |
| `cpu` | Sonuçtaki işlemci |
| `os` | `Ubuntu 24.04`, `Arch` … |
| `result_id` | Sonuç kimliği (adresin sonundaki kod) |
| `result_url` | Sonucun tam adresi |
| `collected_at` | Topladığın gün, `2026-08-23` |

Boş bırakılan satır **atlanır**, hata sayılmaz: elde ne varsa onunla çalışılır.

---

## 5. Doldurunca

```bash
npm run vekil:aktar      # dogrular, ham veriyi raw_imports'a yazar
npm run vekil:analiz     # regresyon, R2, kalinti dagilimi, MARKA kontrolu
```

`vekil:analiz` şu kapıyı uygular: **aile içi kalıntı yayılımı ≥ %30,7 ise
vekil bir şey katmıyor** — çünkü zaten aileler arası modelin bandı o.
