# Anneal — Açık Sorular

Cevap bekleyen kararların güncel listesi. Kök dizinde durmasının sebebi:
proje sahibinin kullandığı okuma yolu `docs/` klasör sayfasına erişemiyor.

**Nasıl işler:**

- Yeni bir soru çıktığında buraya eklenir.
- Cevaplanınca madde **Kapanmış sorular** bölümüne taşınır, cevabı yazılır.
- Kalıcı bir karara dönüşen cevap ayrıca `docs/KARARLAR.md`'ye geçer.

`docs/log/` altındaki raporlar o günün fotoğrafıdır ve değişmez;
bu dosya güncel durumu gösterir.

Son güncelleme: 2026-08-19

---

## Açık sorular

### S38 — Güç konnektörü serbest metin, yapılandırılmadı ⏸️ ERTELENDİ (2026-08-19)

**Proje sahibinin kararı:** Şimdilik tek serbest metin alanı
(`gpu_variant_specs.power_connectors`, örn. `2x 8-pin + 1x 6-pin`).
Gerekçe: hiçbir kural bu alanı okumuyor (K56), kullanılmayan yapıya migration
harcanmaz. Kural gerektiğinde yapılandırılır. → `docs/KARARLAR.md` K88

---

Serbest metnin bilinen bedeli: alan **sorgulanamaz** ve yazım birliği kod
tarafından zorlanamaz. `2x 8-pin`, `2 x 8 pin`, `8-pin ×2` aynı veriyi üç
farklı biçimde tutabilir.

Yapılandırma gerektiğinde iki seçenek var:

1. **İki sütun** — `power_connector_type` enum? + `power_connector_count` int?.
   Ucuz ama karışık yapılandırmayı (`2x 8-pin + 1x 6-pin`) ifade edemez.
2. **Alt tablo** — `gpu_variant_power_connectors (part_id, connector_type,
   count)`, bileşik anahtar. Karışığı kaybetmeden tutar.

Tetikleyici olay: **"PSU'nun kartın istediği konnektörü var mı" kuralı**. O
kural `psu_specs`'te de konnektör sayıları gerektirir ve beta kapsamı dışıdır.
Kural yazılmadan yapılandırmaya gerek yok.

### S22 — 14 zorunlu spec alanı hiçbir kural ya da arayüzde kullanılmıyor

K56 ile eklenen kontrol ilk çalıştırmada 14 alan buldu:

```
gpu_specs.chipset, vram_gb, vram_type
cpu_specs.cores, threads, base_clock_mhz, boost_clock_mhz
motherboard_specs.chipset, m2_slots
ram_specs.cas_latency
psu_specs.efficiency_rating, modularity
storage_specs.interface
case_specs.max_cpu_cooler_height_mm
```

Bunların hepsi şu an **zorunlu**. K56'nın ölçütüne göre olmamaları gerekir:
hiçbir uyumluluk kuralı ve hiçbir arayüz bu alanlara bakmıyor.

`pcie_version`'ın AMD kartlarını nasıl dışarıda bıraktığını gördük. Aynı şey
bu 14 alan için de olabilir: bir üretici `cas_latency` ya da `m2_slots`
yayınlamıyorsa o parça hiç içeri giremez — oysa hiçbir kuralı etkilemiyor.

**Ama hepsi aynı değil:**

- `vram_gb`, `vram_type`, `chipset` — kullanıcı kart seçerken görmek isteyeceği
  şeyler. Arayüzde **henüz** gösterilmiyor, ama gösterilmesi planlanıyorsa
  zorunlu kalmaları savunulabilir.
- `cas_latency`, `m2_slots`, `efficiency_rating`, `modularity` — ne kuralda ne
  arayüzde; ileride kural gelebilir (`m2_slots` için depolama kuralı doğal aday).
- `max_cpu_cooler_height_mm` — kasa uyumluluğunun eksik ayağı; soğutucu
  kategorisi beta kapsamında değil.

**Karar gereken:** Hepsi opsiyonel mi olsun, bir kısmı mı, yoksa "arayüzde
gösterilecek" diye bırakılsın mı? Acil değil — şu an hiçbir veri girişini
engellemiyor, çünkü elle girilen CSV'lerde bu alanlar dolu geliyor.

### S18 — Önizleme dağıtımları kapatılsın mı?

Ortam değişkenleri artık sadece Production kapsamında (K46). Sonucu: her dal
itişinde oluşan **önizleme dağıtımları derlenemiyor ve başarısız oluyor**.
Tehlikeli bir şey yapmıyorlar — iki ayrı noktada duruyorlar (K47) — ama Vercel
panelinde ve GitHub'da kırmızı görünüyorlar.

**Önerim: önizleme dağıtımlarını kapat.** Gerekçe: bu projede bir dalın
çalıştığı yerelde `npm run dev` ile doğrulanıyor, önizleme adresine ihtiyaç yok.
Beta testçileri de canlı adrese girecek. Kapatılırsa hem gürültü biter hem de
canlı veritabanına yaklaşabilecek bir dağıtım türü hiç oluşmaz.

**Nasıl:** Vercel → Settings → Git → **Ignored Build Step** → komut:

```
[ "$VERCEL_ENV" != "production" ]
```

Vercel'in kuralı: bu komut **0 ile çıkarsa derleme atlanır**, 1 ile çıkarsa
devam eder. Yukarıdaki ifade production dışında 0 döner, yani sadece canlı
dağıtımlar derlenir.

Bunu buradan doğrulayamıyorum (panel ayarı). Doğru kurulduğunu şuradan
anlarsın: bir dal itişinden sonra Vercel'de dağıtım "Build skipped" der,
"Error" demez.

**Alternatifler:**

1. **Hiçbir şey yapma.** Önizlemeler başarısız olmaya devam eder. Zararsız,
   sadece gürültülü.
2. **Önizlemelere geliştirme veritabanını ver.** Preview kapsamına geliştirme
   veritabanı adresini yaz. O zaman önizlemeler çalışır — ama `dagitim:kontrol`
   geliştirme veritabanında dev-seed bulup duracağı için build komutunun da
   ortama göre davranması gerekir. Karmaşıklık artar; beta'da karşılığı yok.

Acil değil. Karar verilene kadar önizlemeler başarısız olur, canlı etkilenmez.
→ `docs/KARARLAR.md` K46, K47

### S16 — Oyun dışı ölçümlerde `game_id` ne olacak? ⏸️ ERTELENDİ (2026-08-18)

**Proje sahibinin kararı:** Şimdi karar verilmeyecek. Beta'da tek iş yükü var
ve `game_id` zorunluluğu **doğru davranıştır** — oyun ölçümünün oyunu olmalı.
İkinci iş yükü eklendiğinde bakılacak. Soru kapanmadı, ertelendi.

---

`benchmark_points.workload` eklendi ve dört değeri var, ama tablonun `game_id`
alanı **zorunlu**. Oyun dışı bir ölçümün (`ai_inference`, `video_encode`,
`productivity`) oyunu yok.

Beta'da sorun çıkarmıyor: yalnızca `gaming` kullanılıyor ve her satırın oyunu
var. İş yükü genişletildiğinde ilk çözülecek şey bu.

**Seçenekler:**

1. `game_id` opsiyonel yapılır (`FK?`) — en küçük değişiklik, ama "oyun ölçümünün
   oyunu olmalı" garantisi veritabanı seviyesinde kaybolur.
2. Ayrı bir `workload_targets` tablosu açılır: her iş yükünün kendi hedefi olur
   (oyun, model, kodek profili). Doğru olan bu ama beta'da karşılığı yok.
3. Oyun dışı ölçümler ayrı bir tabloya yazılır.

Acil değil, karar iş yükü genişletildiğinde verilir.
→ `docs/KARARLAR.md` K35, K36

---

## Kapanmış sorular

### S37 — GPU kapsamı 14'te kilitli, K77 ikinci turu engelliyor ✅ 2026-08-20

**Proje sahibinin kararı:** K77'yi bu çift için ölçerek sına. Altı ortak kartın
iki turdaki örtük oranları hesaplansın. Dağılım %5'in altındaysa güvenli;
NVIDIA/AMD ortalamaları arasında sistematik fark varsa köprü kurulmaz.

**Cevap: köprü kurulmaz, K77 doğrulandı.**

| Ölçüt | Eşik | Ölçülen |
|---|---|---|
| Oranların dağılımı | < %5 | **%12.4** |
| NVIDIA / AMD farkı | sistematik olmayacak | **+%14.8** |

Ama ölçüm K77'nin *sebebini* düzeltti: fark markadan değil **VRAM**'den
geliyor. 8 GB'lık iki kart (RTX 4060 ve RX 7600 — biri NVIDIA biri AMD)
birlikte düşüyor, çünkü Tur A'nın paketindeki Dragon Age: The Veilguard'da
1440p Quality'de çöküyorlar (RX 7600 8.9 FPS). O oyun çıkarılınca ≥12 GB
kartlar %0.9 dağılımla aynı yerde duruyor.

Köprü yine de kurulmadı: ölçüt tam veri üzerinde uygulanır, sonuç tek oyuna
aşırı duyarlı, ve Dragon Age dahilken ≥12 GB grubu da %7.8 veriyor.

GPU indeks kapsamı **14'te kalıyor**. Kalan yol yeni kaynak (Faz 1.3).
→ `docs/KARARLAR.md` K93, `docs/log/2026-08-20-s37-kopru-olcumu.md`

### S15 — Darboğaz göstergesi çözünürlüğü hesaba katmıyor ✅ 2026-08-19

**S35 ile birlikte kendiliğinden kapandı.** Sorulan şey "eşik çözünürlüğe göre
değişsin mi" idi; K83'ün marjinal kazanç yöntemi eşiği tamamen kaldırdı ve
çözünürlük ağırlıkları doğrudan kazanç hesabına girdi:

```
kazanç_gpu = max(0, en_iyi_gpu_idx - gpu_idx) * w_gpu
kazanç_cpu = max(0, en_iyi_cpu_idx - cpu_idx) * w_cpu
```

4K'da `w_cpu = 0.12` olduğu için işlemciyi yükseltmenin kazancı orada zaten
küçük çıkıyor — S15'in tarif ettiği "20 puan zayıf işlemci 4K'da sorun
çıkarmaz" durumu artık hesabın içinde. Ayrı bir eşik tablosuna gerek kalmadı.

`model_version` v0.2 oldu, v0.1 hesapları eski sürümle duruyor — S15'in
öngördüğü gibi. → `docs/KARARLAR.md` K83

### S35 — Darboğaz eşiği yeni ölçekle uyumsuz ✅ 2026-08-19

**Proje sahibinin kararı:** Marjinal kazanç yöntemiyle yeniden yaz. Mevcut
sistemin indeksini hesapla, sonra iki senaryo: GPU'yu katalogdaki en iyisiyle
değiştir, CPU'yu katalogdaki en iyisiyle değiştir. Hangisi çok kazandırıyorsa o
parça sınırlıyor. İki kazanç arasındaki fark %20'den azsa "dengeli".

**Cevap:** Uygulandı. `SCHEMA.md` bölüm 8 yeniden yazıldı, motor değişti,
`BOTTLENECK_THRESHOLD` yerini `BOTTLENECK_BALANCE_RATIO = 0.2` aldı.

Motor kataloğun en iyilerini **girdi olarak** alıyor (`best_gpu_index`,
`best_cpu_index`) — `/engine` katalogu tanımaz. Verilmezse `bottleneck` null
döner, arayüz satırı göstermez.

Doğrulandı: **9800X3D + RTX 5090 → "Dengeli"** (eskiden "İşlemci sınırlıyor").
RTX 4060 + 9800X3D → "Ekran kartı sınırlıyor", kazanç +116.3 / +0.
114 test geçiyor. → `docs/KARARLAR.md` K83

### S36 — K75'in %10 oranı neye göre sayılıyor? ✅ 2026-08-19

**Proje sahibinin kararı:** Payda = sayfanın makine-okunur yayınladığı toplam
FPS değeri sayısı (kart × oyun × çözünürlük × ayar hücreleri). Ek olarak
kombinasyon başına en fazla 8 satır ve tek bir (oyun, çözünürlük, ayar)
grubunun tamamı asla alınmaz.

**Cevap:** K75'in 1. maddesine tanım yazıldı. → `docs/KARARLAR.md` K84

Geriye dönük kontrol: Faz 2'de alınan 42 CPU satırı, bu tanımla sayfanın ~240
FPS değerinin **%17**'si — tavanın üstünde. Raporda %22 görünmesinin sebebi
paydanın HTML satırı sayılmasıydı; tanım netleşince toplama zaten uyumlu çıktı.

### S34 — Tek doğrulanmış kaynakla K75.4 karşılanamıyor ✅ 2026-08-19

**Proje sahibinin kararı: önce A, olmazsa B — ama B bir gerileme değil.**

**A denendi, başarısız.** TechSpot ve PCGamesHardware tarayıcı paneliyle
incelendi: TechSpot'ta gömülü veri yükü yok (grafikler raster resim, DOM'da
`data-chart` yok, script'lerde seri deseni yok); PCGH yalnızca kart seçim
listesini metin veriyor, ayrıca onay ve ödeme duvarı var.

**B uygulandı.** K75.4 kaldırıldı, yerine K80: *"Her yayında sistematik sapma
ölçülür ve kaydedilir. Ölçüm bağımsız bir kaynakla — mutlak FPS veren, kendisi
kaynak olmayan — karşılaştırılır. Sapma kaydedilmeden indeks yayınlanmaz."*

Proje sahibinin gerekçesi: maddenin amacı iki kaynak değil, sistematik sapmanın
**görülebilir** olmasıydı. İki zayıf kaynağı ortalamak, bir iyi kaynağı ölçülü
kullanmaktan iyi değil. → `docs/KARARLAR.md` K80

**Sonuç:** Faz 2 yayınlandı. 21 parça indekslendi, sapma %4.8 ortalama /
%12.3 en büyük ölçüldü ve `lib/perf-margin.ts`'e işlendi.

### S33 — K72 tavanı ile toplama hedefi uyuşmuyor ✅ 2026-08-19

**Proje sahibinin kararı: ikisi birden.**

1. **Tavan kuralı değişti** — mutlak sayı yerine oran: bir sayfanın yayınladığı
   veri noktalarının en fazla %10'u; tek bir (oyun, çözünürlük, ayar) grubunun
   tamamı asla alınmaz; kombinasyon başına 8 satır sınırı kalıyor.
   Gerekçe: *"25 sayısı keyfiydi ve yanlış şeyi ölçüyordu. Önemli olan alınan
   miktarın kaynağın bütününe oranı."* → K72 "değiştirildi" olarak işaretlendi,
   yürürlükteki kural **K75**.
2. **Kapsam daraldı**: ~30 GPU + ~20 CPU, güncel + bir önceki nesil,
   kaynaklarda en sık ölçülenler. Eski nesiller (RDNA2, Ampere) kapsam dışı.
   → **K76**

Ayrıca aynı kararla: farklı sürücü döneminde ölçülmüş sonuçlar köprülenmez
(**K77**), Faz 0'ın üç dersi kural oldu (**K78**), hata payı ölçülür ve
`lib/perf-margin.ts`'te tek yerde durur (**K79**).

**Faz 1 doğrulaması:** K75'in oran kuralı tıkanıklığı gerçekten çözdü —
ComputerBase'in bir benchmark sayfasında ~336 veri noktası ölçüldü, %10 ≈ 33
satır, K76 hedefi ~150 satır, yani ~5 sayfa yetiyor. Faz 0'daki "13 alan adı
gerekiyor" sorunu ortadan kalktı. Kalan tıkanıklık kaynak **çeşitliliği** →
**S34**.

### S32 — Ölçülmeyen kartlar indekssiz mi kalacak? ✅ 2026-08-19

**Proje sahibinin kararı:** İnterpolasyon **yapılmayacak**. "İtirazın benim
isteğimden doğru — K71'in yasakladığı şeyin matematikli hâli olurdu ve
`perf_index`'te `confidence` olmadığı için kullanıcı ayırt edemezdi."

Ölçülmeyen kartlar indekssiz kalır, arayüz "performans verisi yok" der.
→ `docs/KARARLAR.md` K74

### S31 — İndeks ölçeği neye bağlanacak? ✅ 2026-08-19

**Proje sahibinin kararı:** Sabit referans parça, 100 aşılabilir. Referans
**orta segment** olsun (RTX 4070) — hem üstünde hem altında yer kalsın.
`SCHEMA.md` bölüm 8'deki "0-100" ifadesi düzeltilsin, bant tablosu referansa
göre yeniden yazılsın.

**Cevap:** Uygulandı. `gpu_idx(RTX 4070) = 100`, `cpu_idx(Ryzen 5 7600) = 100`
(işlemci referansı Claude'un seçimi, yetki dahilinde). İki referans da 100
olduğu için referans sistem her çözünürlükte tam 100 veriyor; bant tablosunun
dayanağı bu. Bantlar yeniden yazıldı ama **geçici** — gerçek veriyle
doğrulanmadan kesinleşmiş sayılmaz. → `docs/KARARLAR.md` K73

### S30 — Aynı kaynaktan en fazla kaç satır alınabilir? ✅ 2026-08-19

**Proje sahibinin kararı:** 8 satır/kombinasyon sınırı kabul, **ek olarak aynı
alan adından toplam 25 satır tavanı**. Gerekçe: 8 kombinasyon × 8 satır = 64
satır tek kaynaktan gelirdi, bu artık "dağınık" değil.

→ `docs/KARARLAR.md` K72

**Not:** Faz 0 bu tavanın toplama hedefiyle uyuşmadığını ölçtü — **S33**.

### S29 — `perf_index` sahte veriyi canlıdan ayıramıyor ✅ 2026-08-19

**Proje sahibinin kararı:** 7 uydurma satır **silinecek**. `source` sütunu
eklenmeyecek — K32 hâlâ geçerli, tablo dış dünya iddiası taşımıyor. Sorun
damgalama değil, satırların uydurma olması. Hesaplanmış bir tabloda el yazması
sayı olmaz. Bu kural seed script'ine de konacak, arayüz durumu düzgün
karşılayacak.

**Cevap:** Uygulandı.

- 7 satır silindi (`delete from perf_index -> 7 satir`). `benchmark_points`
  zaten 0'dı, yani satırların hiçbiri hesaplanmış değildi.
- `scripts/seed-prices.ts`'ten `PERF_INDEXES` ve `PERF_COMPUTED_AT` kaldırıldı.
- `scripts/seed.mts` bu tabloya yazmıyor **ve yazamıyor**: başta ve sonda satır
  sayısını okuyup karşılaştırıyor, değişmişse hata verip çıkıyor.
  Çıktı: `Performans indeksi: seed yazmadı, tabloda 0 satır var (K71).`
- Arayüz "parça seçilmedi" ile "ölçüm verisi yok" durumlarını ayırıyor;
  gerçek tarayıcıda üç ekranda da doğrulandı, konsolda hata yok.

→ `docs/KARARLAR.md` K71, `CLAUDE.md` veri kuralları

### S28 — Gerçek parçalara bağlı sahte fiyatlar duruyor ✅ 2026-08-19

**Proje sahibinin kararı:** Fiyat satırlarının `source` değeri kontrol edilecek;
dev-seed ise veri katmanının bunları canlıda filtrelediği **ölçülecek**,
filtrelemiyorsa açık kapatılacak.

**Cevap:** 36 satırın hepsi zaten `source = 'dev-seed'` idi. Yeni script
`npm run seed:filtre-kontrol` /data katmanını iki ayrı süreçte iki farklı
`NODE_ENV` ile çalıştırıp ölçtü:

```
GELISTIRME (NODE_ENV=development, IS_LIVE=false)
  gorunur fiyat       : 12
  dev-seed fiyat sizan: 12
CANLI      (NODE_ENV=production, IS_LIVE=true)
  gorunur fiyat       : 0
  dev-seed fiyat sizan: 0
```

Açık yok. Ölçüm gerçek fonksiyonları (`getCurrentPrices`) çağırıyor, sorguyu
yeniden yazmıyor. → `docs/KARARLAR.md` K67

`perf_index` tarafı aynı şekilde kapatılamadı; **S29** olarak açık kaldı.

### S27 — `case_specs`'in üç ölçü alanı K62'ye rağmen zorunlu ✅ 2026-08-19

**Proje sahibinin kararı:** K62 her yerde geçerli, istisna olmaz. Üçü de
opsiyonel olacak.

**Cevap:** `max_gpu_length_mm`, `max_cpu_cooler_height_mm` ve
`max_psu_length_mm` opsiyonel oldu.
Migration: `20260819085800_kasa_olculeri_opsiyonel`.
`supported_form_factors` zorunlu kaldı — o bir ölçü değil, uyumluluk beyanı.
→ `docs/KARARLAR.md` K68

### S26 — Intel F serisi işlemciler `has_igpu` yüzünden eklenemiyor ✅ 2026-08-19

**Proje sahibinin kararı:** Intel'in resmî işlemci adlandırma sayfasında F son
eki "tümleşik grafik yok" olarak tanımlı. Bu çıkarım değil, farklı sayfadaki
üretici beyanı. i5-14400F ve i7-14700F eklenecek.

**Cevap:** İkisi de eklendi. Adlandırma sayfası son ek tablosunda
`Desktop / F / Requires discrete graphics` yazıyor. W4'ün tetikleyen
kombinasyon sayısı 1'den 3'e çıktı, uyarı eşiğinin üstüne geçti.
→ `docs/KARARLAR.md` K69

### S25 — Üç kural tek bir parçaya bağlı ✅ 2026-08-19

**Proje sahibinin kararı:** 3'ten az kombinasyonla tetiklenen kural UYARI
versin, hata değil.

**Cevap:** Eşik eklendi. `npm run kural:kontrol` artık az kombinasyonlu
kuralları `UYARI` olarak işaretliyor ve çıkış kodunu 0 bırakıyor. Intel F
serisi eklenince uyarı alan kural sayısı 4'ten 3'e indi (C5, W2, W5).
→ `docs/KARARLAR.md` K70

### S24 — `psu_specs.length_mm` zorunlu, K60 boş bırakılmasını gerektiriyor ✅ 2026-08-19

**Cevap:** Opsiyonel oldu (1. seçenek) ve kalıcı kural yazıldı: fiziksel ölçü
alanları asla zorunlu olmaz. `corsair-rm850e` içeri alındı. Motor tipi,
dönüştürücü, W5 kuralı ve arayüz uyarısı GPU'daki kalıbın aynısı.
→ `docs/KARARLAR.md` K62

### S23 — Intel'de `shader_units` boş bırakıldı ✅ 2026-08-19

**Cevap:** `shader_unit_type` alanı eklendi (2. seçeneğin güvenli hâli).
Intel'in Xe Vector Engines sayısı ham haliyle yazılıyor, tipi
`xe_vector_engine`. NVIDIA `cuda_core`, AMD `stream_processor`. Kalıcı kural:
ölçekleme modeli bu alanı yalnızca aynı mimari içinde kullanabilir.
→ `docs/KARARLAR.md` K57, K58

### S21 — `pcie_version` ve `recommended_psu_watt` zorunlu ✅ 2026-08-19

**Cevap:** İkisi de opsiyonel oldu. Genel kural kondu: bir alan ancak bir
uyumluluk kuralı ya da arayüz tarafından kullanılıyorsa zorunlu olabilir.
Kural `CLAUDE.md` "Kalite" bölümüne ve `docs/KARARLAR.md` K56'ya yazıldı;
`npm run sema:kontrol` denetliyor. 23 AMD kartı içeri alındı.

### S20 — Aynı slug ikinci kez geldiğinde ne olacak? ✅ 2026-08-19

**Cevap:** Güncellensin (1. ve 2. seçeneğin birleşimi). Tek koşul: yeni satırın
kaynağı mevcut satırınkinden düşük güvenilirlikte olmayacak
(`manufacturer` > `manual` > `affiliate` > `import` > `user` > `dev-seed`).
Düşükse atlanır ve `raw_imports.error`'a yazılır. Güncelleme olduğunda değişen
alanlar ekrana yazılır.

Aynı koruma seed script'ine de eklendi: `npm run db:seed` artık gerçek veriyle
dolu bir slug'ın üzerine yazmıyor. → `docs/KARARLAR.md` K54

### S19 — Gerçek parça verisi nereden gelecek? ✅ 2026-08-19

**Cevap:** Elle giriş, üretici ürün sayfalarından. Wikidata birincil kaynak
olmayacak (fizibilite raporundaki LGA1155 hatası belirleyici oldu), bir yıl
sonra tekrar bakılacak. Kaggle lisans nedeniyle kapalı.

Miktar ve dağılım proje sahibi tarafından verildi: CPU 8, GPU 8, anakart 6,
RAM 4, PSU 4, kasa 4, depolama 4 — toplam 38. Seçim kriteri: on bir uyumluluk
kuralının her biri en az bir parça çiftiyle tetiklenebilmeli.

Kaynak CSV `data/parts/` altında, depoda versiyonlu.
→ `docs/KARARLAR.md` K49, K50

### S17 — `builds` tablosuna `resolution` alanı ✅ 2026-08-18

**Cevap:** Alan eklendi (2. seçenek). Dondurulan indeks artık sabit bir
referansta değil, kullanıcının kaydettiği çözünürlükte hesaplanıyor; kayıtlı
sistem sayfası hangi çözünürlük olduğunu yazıyor. `REFERENCE_RESOLUTION` sabiti
koddan kaldırıldı. Migration `20260818172814_kayit_cozunurlugu_ve_indekssiz_sistem`;
mevcut kayıtlar `1440p` ile dolduruldu — eski davranış zaten oydu.
→ `docs/KARARLAR.md` K43 (K38'i değiştirir)

### S14 — Vercel hesabı ve dağıtım bağlantısı ✅ 2026-08-18

**Cevap:** Site canlıda. Proje sahibi Vercel hesabını açtı, depoyu bağladı ve
dağıtımı tarayıcıdan yaptı. Ortam değişkenleri Vercel'de Production kapsamında
tanımlı; `DEV_SEED_ALLOWED` **tanımlanmadı** — yokluğu 4. katman korumasıdır.

**İlk deneme `dagitim:kontrol`'e takılıp durdu, bağlantı düzeltilince geçti.**
Yani dev-seed korumasının 3. katmanı yazılı olmakla kalmadı, gerçek dağıtım
hattında da çalıştığını kanıtladı.

Canlıda 0 parça — beklenen: canlı veritabanında dev-seed verisi yok ve gerçek
veri girişi henüz yapılmadı (CSV içe aktarma ertelenmişti).
→ `docs/KARARLAR.md` K45

### S13 — dev-seed verisi canlı olacak veritabanında duruyor ✅ 2026-08-18

**Cevap:** Ayrı bir geliştirme veritabanı açıldı (1. seçenek). `.env.local`
artık yalnızca geliştirmeyi gösteriyor; canlı bağlantı bilgileri hiçbir yerel
dosyada durmuyor, dağıtım platformunda tutulacak. Canlı veritabanındaki 58
dev-seed satırı silindi. Dağıtım öncesi kontrol (3. katman) yazıldı:
`npm run dagitim:kontrol`. → `docs/KARARLAR.md` K29

### S12 — Kategori başına tek parça varsayımı ✅ 2026-08-18

**Cevap:** `BuildInput`'ta `storage` alanı yok ve olmayacak — beta'daki on bir
kuralın hiçbiri depolamayı kullanmıyor, yani motor depolamayı hiç görmüyor.
Çoklu disk arayüzde çözüldü: kullanıcı istediği kadar disk seçiyor, seçim sistem
listesinde görünüyor, motora gitmiyor. Depolama kuralı gerektiğinde
`storage: EngineStorage[]` dizi olarak eklenecek. → `docs/KARARLAR.md` K26

### S11 — Veritabanı parolası sohbet geçmişine girdi ✅ 2026-08-18

**Cevap:** Yenilenmeyecek. Parola depoya sızmadı — `.env.local` yok sayılıyor
(`git check-ignore` ile doğrulandı), commit diff'i tarandı, push protection
etkin. → `docs/KARARLAR.md` K21

### S4 — Test koşucusu ✅ 2026-08-18

**Cevap:** `vitest` 4.1.10 kuruldu. `vitest.config.mts` testleri `tests/` altıyla
sınırlıyor, ortam `node` — arayüz bileşeni test edilmediği için tarayıcı ortamı
kurulmadı. `npm test` ve `npm run test:izle`.

### S10 — Supabase bağlantı bilgileri ✅ 2026-08-18

**Cevap:** Bilgiler verildi, `.env.local` dolduruldu, migration
(`20260818102429_ilk_sema`) çalıştı. 17 tablo, 12 enum ve 5 indeks oluştu;
`npm run db:kontrol` hepsini doğruluyor. Paroladaki iki `#` percent-encode
edildi (`%23`) — kodlanmasaydı parola ilk `#`'te kesilecekti.

### S1 — Şemadaki altı indeks ✅ 2026-08-18

**Cevap:** `raw_imports(status)` silindi, diğer beşi kaldı ve `SCHEMA.md`
bölüm 11'e yazıldı. `CLAUDE.md`'ye kural eklendi: belgelenmiş sorgu yolları
üzerindeki indeksler erken optimizasyon sayılmaz, ancak `SCHEMA.md`'de tanımlı
olmak zorundadır. → `docs/KARARLAR.md` K15

### S2 — Prisma sürücü paketi izni ✅ 2026-08-18

**Cevap:** Kuruldu — `@prisma/adapter-pg` 7.9.1 ve `pg` 8.23.0. Ek tip paketi
(`@types/pg`) gerekmedi, `tsc` temiz geçti. → `docs/KARARLAR.md` K19, K20

### S3 — `npm audit` üç yüksek seviye uyarı ✅ 2026-08-18

**Cevap:** Prisma 7'de kalınıyor, dokunulmayacak. Uyarı yalnızca geliştirme
aracını etkiliyor. → `docs/KARARLAR.md` K9

### S5 — Şema kararlarının taşınması ✅ 2026-08-18

**Cevap:** Onaylandı. Kararların tam metni `docs/KARARLAR.md`'de kalır,
`SCHEMA.md` bölüm 12 işaretçi olarak durur.

### S6 — Karşılaştırma betiği depoda değil ✅ 2026-08-18

**Cevap:** `scripts/check-schema.mjs` olarak depoya alındı, `npm run sema:kontrol`
ile çalışıyor. Python yerine Node'a çevrildi. → `docs/KARARLAR.md` K17

### S7 — GitHub güvenlik ayarları ✅ 2026-08-18 (kısmen)

**Cevap:** `dependabot_security_updates` açıldı (önce vulnerability alerts
gerekiyordu). Diğer ikisi açılamadı — S9'da kapandı.

### S8 — `main` dalı korumasız ✅ 2026-08-18

**Cevap:** Dal koruması kuruldu. Force-push ve dal silme engellendi, yöneticiler
dahil. PR zorunluluğu konmadı — tek kişilik projede gereksiz tören.
→ `docs/KARARLAR.md` K16

### S9 — İki secret scanning ayarı açılamadı ✅ 2026-08-18

**Cevap:** Peşine düşülmeyecek. İki ayar GitHub'ın ücretli **Secret Protection**
paketine ait; API 200 dönüp ayarı sessizce yok sayıyor. Mevcut üç koruma
(secret scanning, push protection, dependabot) yeterli sayıldı.
→ `docs/KARARLAR.md` K18
