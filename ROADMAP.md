# Anneal — Yol Haritası

Bu belge projenin tamamını faz faz gösterir. Her fazın bir **bitiş ölçütü** vardır;
o karşılanmadan sonraki faza geçilmez.

Güncelleme: 20 Ağustos 2026 — A.1 bitti, **A.2 emekle çözülebilecek her şeyi
bitirdi**, beta kapısı envanteri çıkarıldı.

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
| Katalog | **332 gerçek parça** |
| Uyumluluk motoru | 11 kural, hepsi gerçek veriyle tetikleniyor |
| Performans indeksi | 14 GPU + 12 CPU |
| Benchmark ölçümü | **381 nokta**, tek kaynak (ComputerBase) |
| Hata payı | **script yazıyor**, eskiyince `kural:kontrol` duruyor |
| Oyun bazlı FPS | **23 oyun (1440p) + 8 oyun (4K)**, **94 ekran kartı** |
| Fiyat | 22 parçada gerçek fiyat (USD, Newegg) |
| Kullanıcı | 0 |

**Katalog dağılımı:** GPU çipi 60 · **GPU kartı 153** · CPU 42 · anakart 19 ·
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
- [x] Kapsam dışı kartta dürüst boşluk *(119/213 GPU'da veri yok)*
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
miras alıyor — **213 seçilebilir GPU'nun 94'ünde** FPS gösterilebiliyor.

**Tek ayar var:** 1440p / ultra / DLSS-FSR Quality. Başka çözünürlük, başka
preset ve yerel (upscaling kapalı) çıktı **yok** — uydurulmayacak.

**CPU sayıya girmiyor.** Ölçüldü: CPU ölçümlerinin oyunları ile GPU
ölçümlerinin oyunları **sıfır kesişiyor**. A.1'in verdiği sayı GPU-sınırlı
FPS'tir ve arayüz bunu söyler.

## A.2 — Kapsamı büyüt

A.1 dürüst ama dar. Buradaki her madde doğrudan A.1'in kapsadığı hücre
sayısını artırıyor — altyapı işleri bu yüzden burada.

- [x] **İkinci çözünürlük ekseni açıldı** *(20 Ağustos, K114)* — **4K**,
      8 oyun, 48 ölçüm. Oyun listesi artık seçili çözünürlüğü izliyor;
      mevcut 1080p/1440p/4K düğmeleri bu liste için de anlam kazandı.
      1080p'de hâlâ ölçüm yok ve arayüz bunu dürüstçe söylüyor.
- [ ] **CPU ile GPU'yu aynı oyunda ölç** — 🔒 **KAYNAK YOK (K113)**.
      Kesişim sıfır olduğu sürece CPU hiçbir FPS sayısına giremez.
      İki tur kaynak araması yapıldı, sekiz kaynak elendi: hepsinde FPS
      **grafik görselinde**, metinde sıfır. Bu bir arama eksikliği değil,
      sektörün yayın biçimi; ComputerBase istisna.
      Yeniden açılma koşulu K113'te.
- [ ] **İndeks kapsamı: 14 GPU → 30, 12 CPU → 20**
      - [x] **S37 ölçümü — sonuç olumsuz, köprü kurulmadı.** Dağılım %12.4
            (eşik %5), fark markadan değil **VRAM**'den geliyor. K77
            doğrulandı. `docs/log/2026-08-20-s37-kopru-olcumu.md`
      - [x] **Kaynak araması iki tur yapıldı, ikisi de olumsuz (K113).**
            TechPowerUp, PCGamesHardware, Igor's Lab, TechSpot, Guru3D,
            GamersNexus (Mega Charts), Notebookcheck: hepsinde FPS **grafik
            görselinde**, metinde sıfır. İzin sorun değil, **biçim** sorun.
            OpenBenchmarking tek yapılandırılmış aday ama 403 döndü.
      - [x] **CPU 12 → 34 denendi, olmadı.** 16 Temmuz 2026 testinde 34
            işlemci var ama sayfa yalnızca toplu 720p rating yayınlıyor;
            oyun başına FPS yok. Rangliste'nin oyun başına sayfaları da
            içerik duvarının arkasına geçmiş. CPU 12'de kalıyor.
- [x] **Kart varyantı 58 → 153** *(20 Ağustos)* — yapıldı. Aynı dört marka,
      yeni kaynak yok. **+95 kart**, kapsanan çip 20 → **47/60**,
      `length_mm` **%99 dolu**, C5 **125 → 245** kombinasyon.
      FPS gösterebilen GPU **60 → 87**. Öncelik uygulandı: indeksli 14 çipin
      12'sinde artık kart var (önce 8).
      - [ ] **`amd-rx-9070-gre`** — indeksli, hâlâ 0 kart. Dört markanın
            hiçbirinde ürün sayfası bulunamadı (Çin pazarına özel çıkış).
      - [ ] **`intel-arc-b580`** — indeksli, hâlâ 0 kart. 🔒 **ERİŞİM YOK
            (K121):** Arc'ı dört markadan hiçbiri yapmıyor; ASRock/Sparkle
            `robots.txt` izin veriyor ama sayfa ne `curl`'e ne tarayıcıya
            geliyor.
- [x] **İkinci ComputerBase GPU incelemesi ölçüldü** *(20 Ağustos, K123)* —
      var, ama **aynı tur**: parkur makalesi kart incelemesiyle aynı ölçümü
      yayınlıyor (ortak 8 kartın değerleri birebir aynı). Köprü değil.
      **Kazanç:** parkur makalesi 16 kart yayınlıyor (14 yerine) → **RTX 5080**
      alındı, indeksli çip 14 → **15**, FPS gösterilebilen GPU 87 → **94**.
      Yeni payda 2.448 → **2.808**; oran %9,51, tavana **13 satır** kaldı.
- [x] **Oyun sayısı 8 → 23** *(20 Ağustos)* — yapıldı. Mevcut kaynakta
      **alınacak oyun/kart kalmadı**: 1440p'de 23 oyunun hepsi alındı, her
      grupta 14 karttan 8'i (K75 tavanı), 4K'da 8 oyun. Kaynağın **%9,48**'i
      alınmış durumda (tavan %10). 15 oyun mevcut
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

## A.4 — Sunum: "ne performans alacağım" sorusunu gerçekten cevapla

Yeni beta ölçütünün doğrudan hedefi. **Dördü de veri gerektirmiyor**, toplamı
~2 gün. Ölçüm ve gerekçe: `docs/performans-eksikleri.md`

- [x] **30/42 işlemcide çelişkili ekran** *(K126)* — artık eksik olanın **adı**
      konuyor: "Sistem indeksi hesaplanamıyor", ve liste görünüyorsa "o liste
      yalnızca ekran kartına bakıyor" deniyor.
- [x] **CPU çerçevesi** *(K128)* — "bu sayılar yalnızca ekran kartına göredir",
      seçilen işlemcinin indeksi ve referansa göre yeri, darboğaz `cpu_limited`
      ise listenin başında uyarı.
- [x] **"Bu FPS iyi mi" eşik etiketleri** *(K127)* — 30/60/120 →
      `zor` · `oynanır` · `akıcı` · `yüksek tazeleme`. Eşiklerin **karar**
      olduğu arayüzde yazılı.
- [x] **Kapsanan oyunları baştan söyle** *(K129)* — ekran kartı seçilmeden de
      "bu çözünürlükte ölçümü olan 23 oyun: …" görünüyor.

## A.3 — Doğruluk ölçümü ve yayınlanan hata payı

**Markanın kendisi bu madde.** Tahminini denetleyen ve hata payını yayınlayan
site, tahmin veren siteden farklı bir şeydir.

- [x] **Birini-dışarıda-bırak doğrulaması script oldu** *(20 Ağustos)* —
      `npm run fps:sapma`, `lib/fps-margin.ts`'i kendisi yazıyor. İkiz komut
      `npm run indeks:sapma` da `lib/perf-margin.ts`'i yazıyor (K110).
- [x] **Eskime kontrolü** — `npm run kural:kontrol`, hata payının kaç ölçümle
      hesaplandığını güncel sayıyla karşılaştırıyor ve farklıysa **duruyor**.
      Sayı bu tur iki kez elle güncellendi; üçüncüde unutulacaktı.
- [x] Hata payı arayüzde yayınlansın — A.1'de yapıldı
- [x] `docs/KARARLAR.md`'ye ölçülen hata payı ve ölçüm yöntemi yazılsın
- [x] **`npm run sapma:tumu`** — iki ölçüm tek komutta; biri çalıştırılıp
      diğeri unutulmasın *(20 Ağustos)*
- [ ] Kapsam dışı ve düşük güvenli hücreler işaretlensin

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

> **Ölçüt değişti (20 Ağustos 2026).** Eskiden "10 kişi bir sistem toplayıp
> **toplam fiyatını** görebildi" idi. Yeni ölçüt:
>
> ### **10 kişi sistemini seçip ne performans alacağını anlayabildi.**
>
> **Gerekçe:** bu bir **performans tahmin sitesi**. Fiyat ve gelir modeli
> sonraki aşama — fiyat maddeleri **Faz E**'ye taşındı. Beta'nın cevaplaması
> gereken soru "insanlar burada fiyat karşılaştırır mı" değil, **"insanlar
> burada ne performans alacaklarını anlayabiliyor mu"**.

Bu bir faz değil; A bittikten sonra geçilmesi gereken bir kapıdır. Projenin tek
gerçek bilinmeyeni bu ve kod değil kullanıcı cevaplıyor.

**Envanter:** `docs/beta-kapisi-envanteri.md` (fiyat maddeleri artık Faz E'de).

### ✅ Kısıt kaldırıldı *(20 Ağustos, K124)*

- [x] **Fiyatsız parça seçilince sistem artık kaydedilebiliyor.** `saveBuild`
      `missing_price` ile reddetmiyor; `total_price_minor`, `currency` ve
      `unit_price_minor_at_save` opsiyonel oldu. **Kısmi toplam yazılmıyor** —
      eksik varsa `null` ve arayüz "Toplam fiyat dondurulmadı" deyip sebebini
      söylüyor (K92 ile aynı mantık).

### ✅ Envanterde bulundu ve düzeltildi *(20 Ağustos, K119)*

- [x] **Para birimi hatası** — USD fiyatlar açılır listede `₺` gösteriliyordu.
- [x] **Mobil taşma** — 375 px ekranda sayfa 660 px çiziliyordu. Artık 375 px.
- [x] **"31 oyunda" yanlış sayısı** — grup sayısı gösteriliyordu, 23 oyun var.

### ✅ Arayüz iki turda elden geçti *(20 Ağustos)*

- [x] **Birinci tur — sunum** *(K130–K137)*: tipografi hiyerarşisi, kontrast,
      ölçüldü/tahmin ayrımının renge bağlı olmaması, sonuç bölümlerinin
      önceliğe göre sıralanması.
- [x] **İkinci tur — görsel kimlik ve hareket** *(K138–K143)*: litografi
      maskesi arka planı, giriş hareketi ("tavlama" — ısı **yalnızca hareket
      süresince**, kalıcı hiçbir durumda değil), sayarak gelen sayılar, dolan
      indeks çubuğu, `prefers-reduced-motion` desteği. Kontrast taraması üç
      genişlik × iki temada tekrarlandı: **0 AA ihlali korundu**.

### ✅ Veri kapsamı açığı görünür oldu *(22 Ağustos, K144–K149)*

Katalogda 332 parça var, ölçüm 15 ekran kartı + 12 işlemcide. Eskiden ölçümsüz
bir parça seçen kullanıcı üç boş panele bakıyor ve nedenini seçtikten sonra
öğreniyordu.

- [x] **Listeler ölçüme göre gruplandı** — "Ölçümlü / Ölçüm yok" `optgroup`,
      ölçümlüler önce, ölçümsüzlerde satır içi işaret *(K145)*
- [x] **Sayfa dolu açılıyor** — ölçümlü ve uyumlu bir varsayılan sistem,
      `engine/default-build.ts`, 9 test *(K144)*
- [x] **Başlıktaki kapsam sayıları ne saydığını söylüyor** — 15 çip / 94
      seçenek / 213 kart, 12 / 42 işlemci *(K149)*
- [x] **Fiyatlar ₺** — kur ve tarihi tek yerde, arayüzde yazılı; bütçe
      karşılaştırmasındaki birim hatası düzeldi *(K148)*
- [x] **"Kontrol edilemeyenler" sonuçların altına indi** *(K147)*
- [x] **Depolama açılır liste**, stok kodu etiketten düştü *(K146)*

### 🟢 Eksik ama dürüstçe söyleniyor — engel değil

- 126/213 ekran kartında FPS yok · 1080p'de ölçüm yok · FPS işlemciyi hesaba
  katmıyor. Üçünü de arayüz açıkça yazıyor.

### ✅ Akışlar sınandı ve çalışıyor

- Sistem kaydetme · paylaşım linki · geri bildirim · çözünürlük geçişi ·
  konsol/ağ temiz.

### Kalan adımlar

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

- [ ] **Ön koşul: fiyat.** Bütçe sorusu fiyatsız sorulamaz — **Faz E**'deki
      fiyat maddesi bitmeden B başlamaz. (Fiyat 20 Ağustos'ta beta
      kapısından Faz E'ye taşındı.)
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

# FAZ E — Fiyat ve gelir altyapısı

> **Fiyat buraya taşındı (20 Ağustos 2026).** Beta ölçütünden çıkarıldı:
> bu bir performans tahmin sitesi, fiyat karşılaştırma sitesi değil. Fiyat
> zaten gelir modelinin (affiliate) ön koşulu — doğal yeri burası.

**Bitiş ölçütü:** Gelir en azından aylık gideri karşılıyor.

### Fiyat verisi

- [ ] **Kalan beş kategori.** Ölçüldü: anakart **0/19**, RAM **0/20**,
      PSU **0/12**, depolama **0/14**, kasa **0/12**. (GPU 17/118, CPU 5/42.)
      - [x] Elle fiyat girişi — **22 parça**, Newegg, USD.
      - [ ] **eBay geliştirici + EPN başvurusu** *(sen — 20 dk)*. Fiyat verisi
            ve affiliate linkini birden çözüyor.
      - [ ] Kaynak kararı: Newegg pazaryeri elendi (K96 tavanı), Amazon konum
            engelli. `docs/log/2026-08-20-amazon-fiyat-denemesi.md`
- [ ] **Para birimi/kur sorunu** — bugün tek para birimi (USD) ve K92 karışık
      birimde toplam üretmiyor. Çoklu birim gerekirse kur kaynağı ve tarihi
      ayrı bir karar.

### Gelir

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
| S22 | 14 kullanılmayan zorunlu alan *(içerik güncellendi)* | B |
| S38 | Güç konnektörü alt tablosu | B |
| **S44** | **K56 kontrolünün kör noktası** *(benchmark_points, perf_index)* | B |

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

**A — oyun bazlı FPS'i gerçekten kullanılır hale getirmek.**

Fiyat beta kapısından çıktı; sıradaki iş artık performans tarafında.
Eksiklerin ölçümü ve öncelik sırası: **`docs/performans-eksikleri.md`**

Kısaca: A.2'de **emekle** çözülebilecek veri işi kalmadı — kalan bütün
maddeler kaynak ya da erişim engelli (K105, K113, K121). Bu yüzden sıradaki
gerçek iş **yeni kaynak değil, elimizdeki veriyi kullanıcıya daha dürüst ve
daha kullanışlı sunmak**.
