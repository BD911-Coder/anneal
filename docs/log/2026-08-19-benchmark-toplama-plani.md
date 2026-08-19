# 2026-08-19 — `benchmark_points` toplama planı

Soru: K71 gereği `perf_index` yalnızca `benchmark_points`'tan hesaplanacak.
O veri nasıl toplanır, nasıl indekse çevrilir, ne kadar sürer?

**Kod yazılmadı, veri toplanmadı, hiçbir siteye gidilmedi.** Bu bir plan.
Aşağıdaki parça sayıları 2026-08-19'da canlı veritabanından okundu.

---

## 0. Başlangıç durumu

```
benchmark_points : 0
games            : 0
perf_index       : 0
```

Kapsanacak parçalar:

| | Adet | Aileler |
|---|---|---|
| GPU | 60 | NVIDIA Ampere 12, Ada 10, Blackwell 8 · AMD RDNA2 12, RDNA3 7, RDNA4 4 · Intel Alchemist 5, Battlemage 2 |
| CPU | 42 | AMD Zen4 12, Zen5 8 · Intel Raptor Lake 12, Arrow Lake 10 |

Beş chipset iki ayrı kart olarak duruyor (aynı yonga, farklı VRAM):
RTX 3050, 3060, 3080, 4060 Ti, 5060 Ti. Bunlar **ayrı ayrı ölçülmeli** — 8 GB
ile 16 GB aynı yongada bile aynı FPS'i vermiyor, fark oyuna göre değişiyor.
Birinden diğerini kopyalamak uydurma olur.

---

## 1. Kaç ölçüm noktası gerekiyor?

### Önce yapıyı görmek gerekiyor: iki ayrı ölçüm evreni var

`SCHEMA.md` bölüm 8 iki indeks istiyor: `perf_index(gpu)` ve `perf_index(cpu)`.
Bunlar **aynı ölçümden çıkmaz**:

- **GPU indeksi** GPU-sınırlı ölçüm ister: yüksek çözünürlük/ayar, işlemci
  yolu tıkamayacak kadar güçlü. Yoksa iki farklı kart aynı FPS'i verir ve
  aralarındaki fark ölçülemez.
- **CPU indeksi** CPU-sınırlı ölçüm ister: 1080p, düşük/orta ayar, en güçlü
  kart. Yoksa bütün işlemciler aynı FPS'i verir.

Bir ölçüm noktası ikisine birden hizmet edemez. Bu, gereken sayıyı ikiye
katlıyor ve planın en pahalı gerçeği.

### İkinci gerçek: farklı kaynakların FPS'leri doğrudan karşılaştırılamaz

İki ayrı sitenin "Cyberpunk 2077, 1440p ultra" sayıları aynı şeyi ölçmüyor:
test sahnesi, sürücü sürümü, bellek hızı, arka plan yükü farklı. A sitesinin
RTX 4070'i 62 FPS, B sitesinin 71 FPS diyorsa bu iki sayı **toplanamaz**.

Ama **aynı kaynak içindeki oran** taşınabilir. A sitesi aynı testte 4070'i 62,
4080'i 96 gösteriyorsa "4080 ≈ 1.55 × 4070" bilgisi kaynaktan bağımsız
olarak doğrudur.

Bu yüzden asıl birim tek bir FPS değil, **aynı kaynakta aynı koşulda ölçülmüş
iki kart arasındaki oran**. Toplama stratejisinin tamamı bunun üzerine kuruluyor
ve dağınık kaynaktan toplama disiplinine de birebir uyuyor: her sayfadan birkaç
karşılaştırılabilir satır almak, tam da ihtiyaç duyulan şey.

### Minimum sayı

Graf olarak düşünüldüğünde: düğümler = kartlar, kenarlar = aynı kaynak-oyun-
çözünürlük-ayar grubundaki kart çiftleri. 60 kartı tek bir bağlı bileşende
toplamak için teorik minimum **59 kenar**, yani ~60 ölçüm noktası.

**Bu minimum kullanılmamalı.** Zincir tek sıra hâlindeyse tek bir yanlış sayı
kendisinden sonraki bütün kartları kaydırır ve bunu fark ettirecek hiçbir şey
olmaz. Çelişkiyi görebilmek için her kartın en az iki bağımsız yoldan bağlı
olması gerekiyor.

**Önerilen yoğunluk: her parça için en az 3 ölçüm, en az 2 farklı kaynaktan.**

| Evren | Parça | Ölçüm/parça | Toplam nokta |
|---|---|---|---|
| GPU (GPU-sınırlı) | 60 | 3 | **180** |
| CPU (CPU-sınırlı) | 42 | 3 | **126** |
| | | | **~306** |

Daha az istenirse alt sınır 2 ölçüm/parça = ~204 nokta. 2'nin altına inilirse
çapraz kontrol imkânı kalmıyor.

### Hangi oyunlar ve çözünürlükler

Kısıt: seçilen kombinasyon hem **kaynaklarda sık ölçülen** hem de **kartları
birbirinden ayıran** olmalı. Nadir bir oyun seçilirse veri bulunamaz; hafif bir
oyun seçilirse bütün üst segment kartlar aynı çıkar.

**Önerilen üç oyunluk çekirdek set** (`games` tablosuna girecek):

| Rol | Ne aranıyor | `gpu_weight` / `cpu_weight` |
|---|---|---|
| Ağır GPU testi | Işın izleme, yüksek çözünürlük yükü. Üst segmenti ayırır. | ~0.90 / 0.10 |
| Dengeli/ana akım | En çok oynanan türden, her incelemede var | ~0.70 / 0.30 |
| CPU ağırlıklı | Simülasyon/strateji ya da kalabalık açık dünya. İşlemcileri ayırır. | ~0.35 / 0.65 |

Belirli oyun adları bilerek yazılmadı: seçim, **kaynaklarda hangi oyunun
gerçekten sık ölçüldüğüne** bakılarak yapılmalı (bölüm 4'teki fizibilite adımı).
Bugünden isim sabitlemek, veri bulunmayan bir oyunu plana çakmak olur.

`games.gpu_weight` / `cpu_weight` alanları burada işe yarıyor: hangi ölçümün
hangi indekse ne kadar katkı vereceğini bu ağırlıklar belirler (bölüm 3).

**İki basamaklı çözünürlük merdiveni.** Tek bir çözünürlük 60 kartın tamamını
kapsamıyor:

| Basamak | Koşul | Kimi ayırır |
|---|---|---|
| Üst | 1440p ultra | Orta ve üst segment (~45 kart) |
| Alt | 1080p yüksek | Giriş segmenti — RX 6400, A380, RTX 3050, RX 6500 XT |

İki basamak **aynı ölçekte** olmalı. Bunun tek yolu **örtüşme**: her iki
basamakta da ölçülmüş 6–8 orta segment kart (örneğin RTX 3060 12GB, RX 6600 XT,
Arc B580, RTX 4060). Bu kartlar iki basamağı birbirine dikiyor; onlar olmadan
iki ayrı ölçek çıkar ve karşılaştırma geçersiz olur.

CPU tarafında tek basamak yeter: 1080p, orta ayar, sabit üst segment kart.

---

## 2. Kaynak olarak ne kullanılabilir?

### Telif disiplini neden var — ve sınırın nerede olduğu

FPS sayısının kendisi bir **olgu**dur; olgular telifle korunmaz. Korunan şey
**derlemenin kendisi**: bir sitenin oluşturduğu veri tabanının önemli bir
kısmını çekip almak, tek tek sayıları almaktan hukuken farklı bir şey.

Bu yüzden `SCHEMA.md`'deki kural ("tek bir kaynaktan toplu veri alınmaz") bir
üslup tercihi değil, riski gerçekten azaltan tek ayrım. Ek olarak `source_url`
zorunluluğu (K4) her satırda atıf bırakıyor.

**Ama bölüm 1'deki yöntem aynı kaynaktan en az iki satır istiyor** — oran
ancak öyle çıkıyor. "Toplu" ile "iki satır" arasındaki sınır bugün yazılı
değil. Somut bir sınır öneriyorum:

> Bir (kaynak alan adı, oyun, çözünürlük, ayar) kombinasyonundan **en fazla 8
> satır** alınır ve o sayfadaki listenin tamamı hiçbir zaman alınmaz. Her
> kartın en az iki **farklı alan adından** ölçümü olur.

8 sayı: iki basamağı dikmeye yetecek örtüşmeyi sağlıyor, 20-30 kartlık bir
inceleme grafiğinin tamamını almaya yetmiyor. **Bu bir öneri, karar değil —
`SORULAR.md` S30.**

### Kaynak türleri

| Tür | `source_type` | Değer | Sorun |
|---|---|---|---|
| Bağımsız donanım incelemeleri | `review` | Ana kaynak. Aynı testte çok kart → oran kenarı | Sayılar sık sık **resim grafik** içinde; HTML tablo şart |
| Üretici lansman ölçümleri | `review` | Yeni kartlarda tek veri olabiliyor | Taraflı, kendi kartını iyi gösterir → `confidence` düşük |
| Proje sahibinin kendi testi | `own_test` | En güvenilir, koşulu biliniyor | Tek makine, tek kart; ölçek zincirine bir düğüm ekler |
| Kullanıcı gönderimi | `user_submission` | İleride hacim | Beta'da yok, doğrulama mekanizması yok |

**Kaynak seçiminin asıl ölçütü telif değil, okunabilirlik.** Sayılar bar
grafiği resmindeyse `curl` işe yaramaz; resimden sayı okumak hem yavaş hem
hatalı. Öncelik sırası:

1. Sayıları **HTML tablo** olarak yayınlayan siteler
2. Sayıları metin olarak yazan (grafik altında liste veren) siteler
3. Yalnızca resim grafik verenler — **son çare**, ve alınan her satır
   `confidence = medium`

Hangi sitenin hangi kategoriye girdiği **ölçülmeden yazılmamalı**. Bölüm 4'teki
fizibilite adımı tam olarak bunu yapıyor — Wikidata raporundaki (`2026-08-19-
wikidata-fizibilite.md`) yaklaşımın aynısı: önce ölç, sonra karar ver.

`robots.txt` ve kullanım şartları her alan adı için ayrı ayrı kontrol edilmeli;
otomatik toplu indirmeyi yasaklayan siteden toplu indirme yapılmaz.

---

## 3. `benchmark_points` → `perf_index` hesabı

### Sorun

Girdi: farklı kaynaklardan, farklı oyunlarda, farklı koşullarda, **düzensiz
dağılmış** FPS sayıları. Her kart her oyunda ölçülmüş değil.
Çıktı: parça başına tek bir sayı.

Ortalama almak yanlış: ağır bir oyunda ölçülmüş kart, hafif bir oyunda ölçülmüş
karta göre haksız yere düşük çıkar.

### Önerilen model: iki çarpanlı logaritmik uyum

Her ölçüm için model:

```
fps(kart i, grup j)  ≈  perf(i) × zorluk(j)
```

`grup j` = (kaynak adresi, oyun, çözünürlük, ayar, upscaling). Aynı gruptaki
bütün sayılar karşılaştırılabilir; `zorluk(j)` o grubun ölçek katsayısı.

Logaritma alınca toplamsal olur ve klasik iki yönlü uyum problemine döner:

```
log fps(i,j) = log perf(i) + log zorluk(j) + hata
```

### Çözüm — kütüphane gerekmeyen, açıklanabilir yineleme

```
perf(i) = 1  (hepsi için)
50 kez tekrarla:
    zorluk(j) = geometrik ortalama_i ( fps(i,j) / perf(i) )
    perf(i)   = geometrik ortalama_j ( fps(i,j) / zorluk(j) )
```

İki satırlık bir döngü, yeni bağımlılık yok, hızlı yakınsıyor. Yaptığı şey tek
cümleyle anlatılabilir: **"her kartın performansı, ölçüldüğü grupların
zorluğuna göre düzeltilmiş FPS'lerinin ortalamasıdır; grup zorluğu da o grupta
ölçülen kartların performansına göre belirlenir."**

Geometrik ortalama seçildi çünkü oranlarla çalışıyoruz: 2 kat hızlı ile 2 kat
yavaş simetrik olmalı, aritmetik ortalamada olmuyor.

**Oyun ağırlığı burada giriyor:** GPU indeksi hesaplanırken her grup
`games.gpu_weight` ile ağırlıklandırılır — CPU-sınırlı bir oyunun GPU hakkında
söylediği az. CPU indeksinde `cpu_weight` kullanılır. Aynı ham veriden iki
farklı indeks bu şekilde çıkar.

### 0–100'e ölçekleme — burada bir karar gerekiyor

Doğal refleks "en hızlı kart = 100" demek. **Bu yanlış olur.** Sebebi
`SCHEMA.md` bölüm 8'deki bant tablosu:

| İndeks | Etiket |
|---|---|
| 65–80 | 1440p ultra / 4K yüksek |
| 80–100 | 4K ultra |

Bantlar indekse **mutlak** anlam yüklüyor. En hızlı kart 100 kabul edilirse,
kataloğa daha hızlı bir kart girdiği gün bütün indeksler aşağı kayar ve
kullanıcının donanımı değişmediği hâlde "4K ultra" sistemi "1440p ultra"ya
düşer. Sayı sessizce yalan söylemeye başlar.

**Öneri: sabit referans parça.** Kataloğa girenden bağımsız, seçilmiş bir kart
kalıcı olarak 100 kabul edilir (RTX 4090 uygun aday: bant tablosundaki "4K
ultra" tanımına oturuyor ve her yerde ölçülmüş, yani bol oran kenarı var).

```
index(i) = 100 × perf(i) / perf(referans)
```

Sonucu: daha hızlı kartlar **100'ü aşar**. `perf_index.index_value` zaten
`Float`, veritabanı bunu kabul ediyor — ama `SCHEMA.md` "0–100" diyor.
**Şema metni değişmeli, bu yüzden karar sorulmadan uygulanmaz → `SORULAR.md`
S31.**

CPU indeksi için aynı yapı, ayrı referans (aday: Ryzen 7 9800X3D).

### Model sürümü

Bu hesap `v0.1`'in yerine geçmiyor, yeni bir hesap. `model_version = 'v0.2'`
ile yazılmalı; `v0.1` satırları zaten silindi ama sürüm numarasını yeniden
kullanmak, ileride "hangi hesap" sorusunu cevapsız bırakır.

### Ölçülmeyen kartlar — planın en tartışmalı yeri

İstenen: 60 kartın tamamı kapsansın, doğrudan ölçülmeyenler interpolasyonla.

**Bunun K71 ile çeliştiğini söylemem gerekiyor.** K71 dün yazıldı ve şöyle
diyor: `perf_index` satırları yalnızca `benchmark_points` verisinden
hesaplanarak üretilir. Spec alanlarından (shader sayısı × saat hızı) türetilen
bir indeks, `benchmark_points`'tan hesaplanmış olmuyor — daha fazla matematik
içeren bir el yazması sayı oluyor. Ayrıca:

- K57/K58: `shader_units` yalnızca **aynı mimari içinde** karşılaştırılabilir.
  Yani interpolasyon en iyi ihtimalle aile içinde yapılabilir, ailelerin
  arasında hiç yapılamaz.
- `perf_index` tablosunda `confidence` sütunu **yok** ve olmamalı (K32) —
  yani "bu satır ölçülmedi, tahmin edildi" bilgisi hiçbir yere yazılamaz.
  Kullanıcı ölçülmüş indeks ile tahmin edilmiş indeksi ayırt edemez.

**Önerim: v0.2'de interpolasyon yapılmasın.** Ölçülmeyen kart indeks almaz,
arayüz o parça için "performans verisi yok" der — bu mekanizma dün kuruldu ve
çalıştığı doğrulandı. Eksik veriyi göstermek, uydurulmuş veriyi göstermekten
iyidir; proje bu tercihi K52, K56, K60, K62, K71'de beş kez yaptı.

Kapsama tahmini: 60 kartın ~50'si incelemelerde düzenli ölçülüyor. Zor
bulunacaklar (~10): RTX 3050 6GB, RTX 3060 8GB, RTX 3080 12GB, RTX 5050,
RX 6700 (XT değil), RX 9070 GRE, Arc A770 8GB, Arc A380/A580.

**Interpolasyon yine de istenirse** minimum güvenli hâli şudur ve K71'e bir ek
gerektirir:

1. Yalnızca **aynı mimari ailesi** içinde (K58).
2. Yalnızca **aynı chipset'in VRAM varyantları** ve bir üst/bir alt modeli
   ölçülmüş kartlar için.
3. Ayrı bir `model_version` ile (`v0.2-tahmin`) — böylece kullanıcıya
   gösterilirken ayırt edilebilir, çünkü model sürümü zaten ekranda yazıyor.

3. madde, `confidence` sütunu olmadan ayrımı yapmanın tek yolu.
**Karar gerekiyor → `SORULAR.md` S32.**

---

## 4. Bu işin gerçekçi büyüklüğü

### Ölçülmüş temel

Bu oturumda 24 satır gerçek üretici verisi toplandı (12 RAM, 4 depolama,
3 kasa, 2 PSU, 3 CPU): kabaca **65 tool çağrısı**, satır başına ~2.7 çağrı.
Sayfalar tek üründü ve yapıları öğrenildikten sonra tekrar eden işti.

Benchmark toplama bundan **pahalı**, üç sebeple: sayfalar daha ağır, sayılar
sık sık resimde, ve her satır için oyun/çözünürlük/ayar/upscaling dörtlüsünün
doğru okunması gerekiyor (yanlış ayar = yanlış grup = bozuk oran).

### Faz planı

| Faz | İş | Satır | Tool çağrısı | Oturum |
|---|---|---|---|---|
| 0 | **Fizibilite**: 3-4 aday kaynakta sayılar HTML mi resim mi, hangi oyunlar sık ölçülmüş | — | 25–40 | 0.5 |
| 1 | `games` tablosu: 3 oyun + ağırlıkları, kaynağıyla | 3 | 10–15 | 0.25 |
| 2 | GPU ölçümleri, üst basamak (1440p ultra, ~45 kart × 3) | ~135 | 90–130 | 1.5–2 |
| 3 | GPU ölçümleri, alt basamak + örtüşme (1080p yüksek) | ~45 | 35–50 | 0.5–1 |
| 4 | CPU ölçümleri (1080p, sabit kart, 42 × 3) | ~126 | 80–120 | 1–1.5 |
| 5 | Hesap script'i + `/engine` testleri + `kural:kontrol` benzeri denetim | — | 30–50 | 1 |
| 6 | Arayüz doğrulaması, rapor, kararlar | — | 20–30 | 0.5 |
| | **Toplam** | **~309** | **290–435** | **5–7** |

Oturum = bu oturumun büyüklüğünde bir çalışma bloğu.

### Riskler — büyüklüğü asıl bunlar belirler

1. **Sayılar resimdeyse** faz 2-4 iki katına çıkar, hata oranı yükselir.
   Faz 0 tam olarak bunu ölçmek için var; sonucu kötüyse plan yeniden
   boyutlandırılmalı.
2. **Zincir kopması.** Alt basamak ile üst basamak arasında yeterli örtüşme
   kart bulunamazsa iki ayrı ölçek çıkar ve birleştirilemez. Faz 3'te örtüşme
   kartları **önce** toplanmalı.
3. **Eski kartlar.** RDNA2 ve Ampere artık yeni incelemelerde yer almıyor;
   2021-2022 incelemelerine inmek gerekebilir, o dönemin sürücüleriyle ölçülmüş
   sayılar bugünkülerle aynı grupta değil. Grup anahtarına kaynak adresi dahil
   olduğu için model bunu zaten ayırıyor, ama oran kenarı sayısı düşüyor.
4. **8 satır sınırı** (S30) daraltılırsa gereken sayfa sayısı, dolayısıyla tool
   çağrısı artar.

---

## Açık kalan sorular

Üçü de karar bekliyor, `SORULAR.md`'ye eklendi:

- **S30** — Aynı kaynaktan kaç satır alınabilir? ("toplu" nerede başlıyor)
- **S31** — İndeks ölçeği sabit referans parçaya mı bağlanacak (ve 100 aşılabilir mi)?
- **S32** — Ölçülmeyen kartlar indekssiz mi kalacak, yoksa aile içi interpolasyon mu?

Ayrıca karara bağlanmamış ama planı etkileyen: faz 0'ın sonucu, oyun seçimini
ve toplam büyüklüğü değiştirebilir. **Faz 0 yapılmadan faz 2'ye başlanmamalı.**
