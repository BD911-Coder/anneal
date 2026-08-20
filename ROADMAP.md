# Anneal — Yol Haritası

Bu belge projenin tamamını faz faz gösterir. Her fazın bir **bitiş ölçütü** vardır;
o karşılanmadan sonraki faza geçilmez.

Güncelleme: 20 Ağustos 2026 — **fazlar ürüne göre yeniden sıralandı.**

> **Sıralama ilkesi:** Fazlar ürünün kendisidir. Fiyat, katalog derinliği ve
> indeks kapsamı gibi altyapı işleri kendi başına faz değildir — hangi ürün
> özelliğini açtıkları belliyse o fazın alt maddesidir. Bir altyapı işi hiçbir
> özelliği açmıyorsa yapılmaz.
>
> Önceki sürümde altyapı öne, ürün arkaya düşmüştü: "fiyat" ve "katalog
> derinliği" birer fazdı, oyun bazlı FPS ise Faz 6'daki bir madde işaretiydi.

---

## Şu an neredeyiz

**Kod tarafı beta için bitti.** Eksik olan veri ve kullanıcı.

| | Durum |
|---|---|
| Site | Vercel'de canlı, arama motorlarına kapalı |
| Katalog | 237 gerçek parça |
| Uyumluluk motoru | 11 kural, hepsi gerçek veriyle tetikleniyor |
| Performans indeksi | 14 GPU + 12 CPU |
| Benchmark ölçümü | **298 nokta**, tek kaynak (ComputerBase) |
| Oyun bazlı FPS | **23 oyun, 60 ekran kartı** — çalışıyor |
| Fiyat | 22 parçada gerçek fiyat (USD, Newegg) |
| Kullanıcı | 0 |

**Katalog dağılımı:** GPU çipi 60 · GPU kartı 58 · CPU 42 · anakart 19 ·
RAM 20 · depolama 14 · kasa 12 · PSU 12

---

# FAZ A — Oyun bazlı FPS tahmini

**Ürünün kendisi burası.** Kullanıcı sistemini seçince tek bir soyut skor değil,
tanıdığı bir cümle görecek:

> **Cyberpunk 2077 — 1440p ultra: ~109 FPS**

`benchmark_points` zaten tam bu yapıda ve **178 ölçüm** duruyor. Bugün hiçbiri
kullanıcıya gösterilmiyor; motor bu tablodan yalnızca tek bir soyut indeks
üretiyor. Yani en değerli veri, ürüne dönüşmeden bekliyor.

**Bitiş ölçütü:** Kullanıcı bir sistem seçtiğinde, kartının kapsandığı her oyun
için FPS tahmini görüyor; sayının ölçüm mü türetme mi olduğunu ve hata payını
da görüyor.

## A.1 — Mevcut 178 ölçümden tahmin üret ve göster

Yeni veri toplamadan, **bugünkü veriyle** ne gösterilebiliyorsa o gösterilir.
Ayrıntılı plan ve ölçümler: **`docs/faz-a1-plani.md`**

- [x] `engine/fps-estimate.ts` — saf motor, oyun içi indeks oranıyla tahmin
- [x] `/engine` testleri — **16 test**, `tests/fps-estimate.test.ts`
- [x] Veri okuma yolu — `data/benchmarks.ts`, `benchmark_points` + `perf_index`
- [x] Arayüz: oyun listesi, FPS, **ölçüm mü türetme mi**, hata payı
- [x] Kapsam dışı kartta dürüst boşluk *(58/118 GPU'da veri yok)*
- [x] **Kaydedilmiş sistem sayfası** — paylaşılan link de listeyi gösteriyor.
      FPS **dondurulmaz**, bugünkü hesap ayrı kutuda (K102).
- [x] **Ana sayfa metni** durum başına ayrıldı; kapsam sayıları veriden
      okunuyor, metne gömülü değil (K103).

**Tarayıcıda doğrulandı** (20 Ağustos): RX 9070 GRE → 5 ölçüm + 3 tahmin,
RTX 5090 → 4 + 4, RTX 5080 (indekssiz) → "bu kart için ölçüm yok".
Sıra alfabetik, ölçüm/tahmin ayrı işaretli, hata payı listenin altında.
Paylaşım linki (`/sistem/s62dqq`, 4K'da kaydedilmiş) listeyi gösteriyor ve
çözünürlük uyuşmazlığını söylüyor.
`docs/log/2026-08-20-a1-oyun-bazli-fps.md` ·
`docs/log/2026-08-20-a1-paylasim-ve-metin.md`

**Kapsam (20 Ağustos, A.2 sonrası):** **23 oyun** × 14 çip = 322 hücre;
**184'ü ölçülmüş**, 138'i türetilebilir. Kart tarafında 46 kart çipinden
miras alıyor — **118 seçilebilir GPU'nun 60'ında** FPS gösterilebiliyor.

**Tek ayar var:** 1440p / ultra / DLSS-FSR Quality. Başka çözünürlük, başka
preset ve yerel (upscaling kapalı) çıktı **yok** — uydurulmayacak.

**CPU sayıya girmiyor.** Ölçüldü: CPU ölçümlerinin oyunları ile GPU
ölçümlerinin oyunları **sıfır kesişiyor**. A.1'in verdiği sayı GPU-sınırlı
FPS'tir ve arayüz bunu söyler.

## A.2 — Kapsamı büyüt

A.1 dürüst ama dar. Buradaki her madde doğrudan A.1'in kapsadığı hücre
sayısını artırıyor — altyapı işleri bu yüzden burada.

- [ ] **İkinci çözünürlük/ayar ekseni** — 1080p veya yerel 1440p ölçümü.
      Bugün tek ayar var; ikincisi olmadan "ayar seç" diye bir şey yok.
- [ ] **CPU ile GPU'yu aynı oyunda ölç** — kesişim sıfır olduğu sürece CPU
      hiçbir FPS sayısına giremez. En az 3 ortak oyun gerekiyor.
      **Mevcut kaynakta çözülmüyor (ölçüldü):** ComputerBase'in oyun başına
      benchmark makaleleri yalnızca GPU; CPU paketinin 9 oyunu GPU paketinin
      23 oyunuyla hâlâ sıfır kesişiyor. Başka kaynak gerekiyor.
- [ ] **İndeks kapsamı: 14 GPU → 30, 12 CPU → 20**
      - [x] **S37 ölçümü — sonuç olumsuz, köprü kurulmadı.** Dağılım %12.4
            (eşik %5), fark markadan değil **VRAM**'den geliyor. K77
            doğrulandı. `docs/log/2026-08-20-s37-kopru-olcumu.md`
      - [x] **Yeni kaynak araması yapıldı, sonuç olumsuz.** TechPowerUp,
            PCGamesHardware, Igor's Lab, TechSpot, Guru3D, GamersNexus:
            hepsinde FPS **grafik görselinde**, metinde sıfır. İzin sorun
            değil, biçim sorun. `docs/faz-a2-oyun-hedefi.md` bölüm 4
      - [x] **CPU 12 → 34 denendi, olmadı.** 16 Temmuz 2026 testinde 34
            işlemci var ama sayfa yalnızca toplu 720p rating yayınlıyor;
            oyun başına FPS yok. Rangliste'nin oyun başına sayfaları da
            içerik duvarının arkasına geçmiş. CPU 12'de kalıyor.
- [ ] **Kart varyantı 58 → 150** *(kalan çipler; her kart çipinden miras
      aldığı için kapsamı doğrudan büyütüyor)*
- [x] **Oyun sayısı 8 → 23** *(20 Ağustos)* — yapıldı. 15 oyun mevcut
      incelemeden alındı: aynı sürücü, aynı 14 kart, köprü yok, yeni kaynak
      yok. **120 yeni ölçüm, toplam 184.** Kaynağın oranı %2,6 → **%7,5**
      (K75 tavanı %10; payda toplamadan önce yeniden sayıldı: 2.448).
      Çıkarıcı mevcut 64 satırı **birebir** yeniden üretti.
      `docs/log/2026-08-20-a2-oyun-kapsami.md`
- [x] **Grup 2 (rekabetçi oyunlar) — KAPALI, kaynak yokluğundan** *(K105)*.
      CS2, Valorant, Fortnite, Apex, LoL, Dota 2: doğrulanmış kaynakta **0/6**.
      Tom's Hardware **kaynak yapılmayacak**, K80 aynası olarak kalıyor:
      tek bağımsız aynayı kaynağa çevirmek sapma ölçümünü kendi kendini
      ölçmeye dönüştürür. Yeniden açılma koşulu K105'te.
- [x] **CPU kapsamı büyütülemedi — ölçüldü** *(20 Ağustos)*. 16 Temmuz 2026
      CPU testinde 34 işlemci var ama sayfa yalnızca **toplu 720p rating**
      yayınlıyor, oyun başına FPS yok. Rangliste'nin oyun başına sayfaları
      içerik duvarının arkasına geçmiş. CPU 12'de kalıyor.

## A.3 — Doğruluk ölçümü ve yayınlanan hata payı

**Markanın kendisi bu madde.** Tahminini denetleyen ve hata payını yayınlayan
site, tahmin veren siteden farklı bir şeydir.

- [ ] Birini-dışarıda-bırak doğrulaması script'e dönsün, her veri turunda çalışsın
- [ ] Hata payı arayüzde yayınlansın
- [ ] Kapsam dışı ve düşük güvenli hücreler işaretlensin
- [ ] `docs/KARARLAR.md`'ye ölçülen hata payı ve ölçüm yöntemi yazılsın

**Son ölçüm** (birini-dışarıda-bırak, **184 nokta**, 20 Ağustos):
ortalama mutlak hata **%6.6**, medyan %5.4, %90 dilim %13.7, en kötü %35.3.
Noktaların %79'u ±%10 içinde.

Oyun paketi 8'den 23'e çıkınca sayı **kötüleşti** (%6.1 → %6.6). Gerileme
değil, örneklemin genişlemesi: yeni oyunlar arasında raytracing zorunlu
başlıklar var ve orada kartların sırası indeks sırasından ayrılıyor. Eski
sayı daha iyi görünüyordu çünkü daha dar bir kümeyi ölçüyordu.

**İndeks sapması** (`npm run indeks:sapma`, K80): ortalama **%5.2**, en büyük
**%11.5** — eşik %25, geçti. GPU tarafı belirgin İYİLEŞTİ (%4.9 → %3.6),
CPU tarafı değişmedi.

---

## Beta ölçütü — faz değil, kapı

**10 kişi siteye girip yardım almadan bir sistem toplayabildi.** *(CLAUDE.md)*

Bu bir faz değil; A bittikten sonra geçilmesi gereken bir kapıdır. Projenin tek
gerçek bilinmeyeni "insanlar burada sistem toplamak istiyor mu" ve bunu kod
değil kullanıcı cevaplıyor.

- [ ] **Fiyat — kalan beş kategori** *(anakart, RAM, PSU, kasa, depolama:
      hepsi hâlâ 0)*. Kullanıcı bugün yedi kategorili bir sistem toplayıp
      toplam fiyat **göremiyor**. B fazının da ön koşulu.
      - [x] Elle fiyat girişi — **22 parça** (17 GPU + 5 CPU), Newegg, USD.
            `docs/log/2026-08-20-elle-fiyat-girisi.md`
      - [ ] **eBay geliştirici + EPN başvurusu** *(sen — 20 dk)*. Fiyat verisi
            ve affiliate linkini birden çözüyor.
      - [ ] Kaynak kararı: Newegg pazaryeri elendi (K96 tavanı), Amazon konum
            engelli. `docs/log/2026-08-20-amazon-fiyat-denemesi.md`
- [ ] **Gerçek veriyi canlıya aktar** *(sen çalıştıracaksın)* — plan hazır ve
      onaylı: `docs/canliya-aktarim-plani.md`
- [ ] Kendin baştan sona kullan, 20 dakika *(sen — bunu hâlâ yapmadın)*
- [ ] 3 arkadaşına göster, izle, not al
- [ ] Çıkan sorunları düzelt
- [ ] Donanım forumlarında / Reddit'te paylaş
- [ ] 10 kişi ölçütüne ulaş

Bu kapı geçilmeden B'ye geçme. Kullanıcısı olmayan bir sistemi büyütmek,
projeyi öldüren en yaygın hatadır.

---

# FAZ B — Donanım önerisi

**Soruyu ters çevirmek.** A'da kullanıcı sistemi seçiyor, site FPS söylüyor.
B'de kullanıcı istediği sonucu söylüyor, site sistemi kuruyor:

> "40.000 TL bütçeyle Cyberpunk'ı 1440p ultra'da 60 FPS üstünde oynamak
> istiyorum" — **şu sistem**

Mevcut yükseltme önerisi motoru (`engine/upgrade.ts`) bunun temeli — bugün
"bütçe farkıyla ne yükseltilir" sorusunu zaten cevaplıyor. B, aynı motoru
sıfırdan sistem kurmaya genişletiyor.

**Bitiş ölçütü:** Kullanıcı bütçe + oyun + hedef FPS girip uyumlu, alınabilir
bir sistem alıyor.

- [ ] **Ön koşul: fiyat.** Bütçe sorusu fiyatsız sorulamaz — Beta kapısındaki
      fiyat maddesi bitmeden B başlamaz.
- [ ] Hedeften geriye çözüm — "60 FPS için hangi indeks gerekiyor"
- [ ] Bütçe dağıtımı — parçalar arası denge
- [ ] Uyumluluk motoruyla doğrulama *(11 kural zaten hazır)*
- [ ] **CPU soğutucusu** *(yeni kategori)* — şemada
      `case_specs.max_cpu_cooler_height_mm` var ama karşılığı yok, ölü alan.
      Sistem kuran bir motor soğutucusuz sistem öneremez.
      - [ ] Şema: `cooler` kategorisi + `cooler_specs`
      - [ ] Yeni kural: soğutucu yüksekliği ≤ kasa açıklığı
      - [ ] Yeni kural: soğutucu soket uyumluluğu
      - [ ] 12-15 soğutucu verisi
- [ ] **Katalog derinliği** — öneri motoru dar kataloğa mahkûmdur
      - [x] PSU 4 → **12**, Kasa 5 → **12**, Depolama 6 → **14**,
            RAM 14 → **20** *(20 Ağustos)*
      - [x] **K95 — PSU uzunluğu.** ATX12V genişlik (150) ve yüksekliği (86)
            sabitliyor; etiketsiz üçlüde ikisi tanınıyorsa kalan uzunluktur.
            `length_mm` dolu PSU **1 → 8**, W5 kombinasyonu **1 → 14**.
            `docs/log/2026-08-20-psu-uzunlugu-k95.md`
      - [ ] Anakart 19 → 60
      - [ ] Marka çeşitliliği — kasaların 11'i Fractal, PSU'ların 11'i Corsair

---

# FAZ C — Ek platformlar

**Bitiş ölçütü:** Kullanıcı masaüstü dışında en az bir platformda da FPS
tahmini alıyor.

- [ ] Laptop *(aynı çip adı farklı TGP'de farklı kart demek — bu ayrım şart)*
- [ ] Konsol *(sabit donanım, tahmin değil ölçüm; kıyas noktası olarak değerli)*
- [ ] El konsolu *(Steam Deck, ROG Ally)*

Her platform yeni bir şema sorusu getiriyor. Şu an açmıyoruz; A ve B
bitmeden buradaki hiçbir madde başlamaz.

---

# FAZ D — Nesiller arası tahmin

**Projenin senin için anlamı bu.** Yeni nesil çıktığında, kimse test etmeden
tahmin verebilmek. A.3'ün ölçüm disiplini olmadan bu faz anlamsız — tahminin
tuttuğunu söylemenin yolu ölçmektir.

**Bitiş ölçütü:** Yeni bir GPU duyurulduğunda site ilk 48 saatte tahmin
yayınlayabiliyor ve tahmin tutuyor.

- [ ] Nesiller arası eşleşen kalibrasyon seti *(aynı oyunlar, 3 nesil)*
- [ ] Ölçekleme modeli — mimari katsayısı, tek ölçümden seri tahmini
- [ ] Tahmin arşivi — yayınlanan tahminler kaydedilir
- [ ] **Geriye dönük denetim** — tahmin ne kadar tuttu, yayınla

---

# FAZ E — Gelir altyapısı

**Bitiş ölçütü:** Gelir en azından aylık gideri karşılıyor.

- [ ] Alan adı al *(anneal.com veya .dev)*
- [ ] Marka tescili — USPTO/EUIPO/TÜRKPATENT, sınıf 9 ve 42
- [ ] Arama motorlarına aç *(robots.txt + noindex kaldır)*
- [ ] Affiliate linklerini `/git/<slug>` katmanına bağla
- [ ] Affiliate açıklama metni ekle *(yasal zorunluluk)*
- [ ] Şahıs şirketi + mali müşavir *(ilk gelirle birlikte)*
- [ ] Bir kez hukuki danışma

---

# FAZ F — Büyüme

**Bitiş ölçütü yok** — buradan sonrası sürekli.

- [ ] **Kullanıcı FPS gönderimi** — satın alınamayan, kopyalanamayan veri seti.
      ⚠️ **Öne çekilmesi değerlendirilecek (K106).** Bu yalnızca bir büyüme
      özelliği değil; kapsamın **yapısal sınırının tek çıkışı**. Ölçüldü:
      23 oyunluk pakette Steam'in en çok oynanan ilk 100'ünden yalnızca
      **4 oyun** var. Sebep kaynak seçimi — inceleme siteleri paketlerini
      grafik olarak zorlayan yeni çıkışlara göre seçiyor, insanların ne
      oynadığına göre değil. İnceleme sitelerinden ne kadar veri alınırsa
      alınsın bu fark kapanmaz.
      - [ ] Gönderim formu *(hesap gerektirmeden)*
      - [ ] Doğrulama akışı — ekran görüntüsü, aykırı değer kontrolü
      - [ ] Ödül sistemi *(aylık bütçe ile hediye çeki)*
- [ ] Çoklu iş yükü skorları *(AI, video, üretkenlik — şema hazır, ölçüm yok)*
- [ ] Fiyat geçmişi grafikleri *(veri birikiyor, özellik yok)*
- [ ] Kullanıcı hesabı *(builds zaten kalıcı, sadece user_id eklenecek)*
- [ ] Mobil uygulama *(motor bağımsız, yeniden kullanılabilir)*
- [ ] Çoklu dil

---

## Bekleyen sorular

`SORULAR.md` güncel kaynak. Şu an açık olanlar:

| # | Konu | Faz |
|---|---|---|
| S16 | `benchmark_points.game_id` oyun dışı iş yüklerinde | F |
| S18 | Önizleme dağıtımları | B |
| S22 | 14 kullanılmayan zorunlu alan | B |
| S38 | Güç konnektörü alt tablosu | B |

---

## Kalıcı kurallar — asla esnetilmez

Bunlar 95+ kararın özeti. Yeni bir iş başlarken kontrol et:

1. **Uydurma yok.** Bulunamayan alan boş bırakılır, çıkarım yapılmaz *(K60)*
2. **Kural taşınırken harfi değil gerekçesi taşınır** *(K95b)*
3. **Kaynak defteri.** Her satırda `source`, `source_url`, `confidence`, `collected_at`
4. **Tek kaynaktan toplu alım yok.** Sayfa başına %10 tavanı *(K75/K84)*
5. **`robots.txt` yasaklıyorsa o kaynak kapalı.** Araç değiştirmek durumu değiştirmez
6. **`perf_index` yalnızca `benchmark_points`'ten hesaplanır** *(K71)*
7. **Fiziksel ölçü alanları zorunlu olmaz** *(K62)*
8. **Hata hep güvenli yöne.** Yanlış "sığar" demek, gereksiz uyarıdan pahalı
9. **`/engine` saf kalır.** Veritabanı, ağ, arayüz erişimi yok
10. **dev-seed canlıya çıkmaz.** Dört katman
11. **Sapma ölçülür ve kaydedilir** *(K80)*

---

## Şu an sıradaki tek iş

**A.1 — Mevcut 178 ölçümden oyun bazlı FPS üret ve göster.**

Plan hazır ve ölçümlere dayanıyor: **`docs/faz-a1-plani.md`**
Yeni veri toplamayı gerektirmiyor; bugünkü veriyle 60 GPU'da FPS
gösterilebiliyor.
