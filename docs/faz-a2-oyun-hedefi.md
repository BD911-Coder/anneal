# Faz A.2 — Oyun hedefi: ne eklenebilir, ne eklenemez

**Durum:** plan. Veri toplanmadı, kod yazılmadı.
**Tarih:** 20 Ağustos 2026

Bütün sayılar ölçüldü. Steam listesi canlı alındı, kaynak sayfaları çekilip
sayıldı. Yöntem bölüm 6'da.

---

## 0. Tek cümlelik sonuç

> **Grup 1'de 15 oyun bugün eklenebilir — yeni kaynak da gerekmiyor, köprü de.
> Grup 2'de 6 oyunun 6'sı eklenemez ve engel emek değil kaynak.**

---

## 1. Steam'in en çok oynananları (canlı, 20 Ağustos 2026)

Steam'in ilk 100'ü alındı. İki uyarı, ikisi de listeyi kullanmadan önce
bilinmeli:

**a) İlk 100'ün 11'i oyun değil.** Bongo Cat, TBH: Task Bar Hero, Wallpaper
Engine, Crosshair X, OBS Studio, VTube Studio, Blender, Soundpad, tModLoader,
FiveM, VRChat. Benchmark hedefi seçerken elenirler.

**b) Grup 2'nin yarısı Steam'de yok.** Valorant, League of Legends ve Fortnite
Riot/Epic kendi istemcilerinde çalışıyor; Steam listesinden **çıkarılamazlar**.
Senin altılı listenden yalnızca üçü (CS2, Apex, Dota 2) bu listede.

### Grup 1 — GPU-sınırlı AAA, son 6 yıl (2020+)

| # | Oyun | Yıl | # | Oyun | Yıl |
|---|---|---|---|---|---|
| 5 | Palworld | 2024 | 61 | Wuthering Waves | 2024 |
| 16 | GTA V Enhanced | 2024 | 69 | ARK: Survival Ascended | 2023 |
| 20 | HELLDIVERS 2 | 2024 | 71 | Forza Horizon 6 | 2026 |
| 27 | **Battlefield 6** | 2025 | 78 | Where Winds Meet | 2025 |
| 35 | **Cyberpunk 2077** ✓ | 2020 | 79 | Monster Hunter Wilds | 2025 |
| 36 | **Baldur's Gate 3** ✓ | 2023 | 80 | Mortal Shell II | 2026 |
| 44 | Black Myth: Wukong | 2024 | 85 | **ARC Raiders** | 2025 |
| 50 | ELDEN RING | 2022 | 89 | Path of Exile 2 | 2024 |
| 54 | Farming Simulator 25 | 2024 | 94 | **Kingdom Come: Deliverance II** | 2025 |
| 60 | ELDEN RING NIGHTREIGN | 2025 | | | |

**Kalın** = doğrulanmış kaynağımızda ölçümü var. ✓ = katalogda zaten var.

Sınırda bırakılanlar: Red Dead Redemption 2 (PC 2019, altı yılın kenarı),
EA SPORTS FC 26 ve NBA 2K26 (spor, ayrı bir yük profili).

### Grup 2 — CPU-sınırlı rekabetçi

| # | Oyun | Steam'de? |
|---|---|---|
| 1 | **Counter-Strike 2** | ✓ |
| 2 | **Dota 2** | ✓ |
| 3 | PUBG: BATTLEGROUNDS | ✓ |
| 4 | **Apex Legends** | ✓ |
| 10 | Delta Force | ✓ |
| 11 | Rust | ✓ |
| 19 | NARAKA: BLADEPOINT | ✓ |
| 25 | Overwatch | ✓ |
| 26 | Team Fortress 2 | ✓ |
| 28 | Rainbow Six Siege | ✓ |
| 30 | Marvel Rivals | ✓ |
| 37 | Deadlock | ✓ |
| 40 | Escape from Tarkov | ✓ |
| 96 | Squad | ✓ |
| — | **Valorant** | ✗ Riot |
| — | **League of Legends** | ✗ Riot |
| — | **Fortnite** | ✗ Epic |

**Kalın** = senin adını verdiğin altı oyun.

---

## 2. Mevcut kaynakta ne var — ölçüldü

### GPU tarafı: RX 9070 GRE testi (2026-06-02)

**Katalogdaki 64 GPU ölçümünün tamamı bu tek incelemeden geliyor.** Ve
incelemede aldığımızdan **çok daha fazlası var:**

| | Sayı |
|---|---|
| İncelemedeki oyun | **23** |
| Bizim aldığımız | 8 |
| **Alınmamış** | **15** |
| İncelemedeki kart | 14 *(katalogdaki 14 indeksli GPU ile birebir aynı)* |
| Çözünürlük | 3 (2560×1440, 3440×1440, 3840×2160) + RT varyantları |
| **Yayınlanan toplam FPS değeri** | **2.448** *(6 oyun sayfasında sayıldı)* |
| Bizim aldığımız oran | %2,6 |

23 oyunun tamamı: Alan Wake 2, Anno 117, ARC Raiders, Assassin's Creed Shadows,
Battlefield 6, Borderlands 4, Call of Duty: Black Ops 7, Crimson Desert,
Cyberpunk 2077, Death Stranding 2, Doom: The Dark Ages, F1 25, Hogwarts Legacy,
Indiana Jones und der große Kreis, Kingdom Come: Deliverance 2, Mafia: The Old
Country, Pragmata, Resident Evil Requiem, Star Wars Outlaws, TES IV: Oblivion,
The Last of Us Part II, The Outer Worlds 2, Warhammer 40k: Space Marine 2.

FPS sayıları **metinde** — makine tarafından okunabilir (`138,0`, `110,6`
doğrudan HTML'de bulundu).

### CPU tarafı: Rangliste (güncelleme 2026-08-03) + 7700X3D testi (2026-07-16)

| | Sayı |
|---|---|
| Oyun | 9 — **hepsi zaten katalogda** |
| İşlemci (Rangliste'de aldığımız) | 12 |
| İşlemci (7700X3D testinde görünen) | **34** |
| Rekabetçi oyun | **0** |

**Rekabetçi oyun kapsamı sıfır ve bu yapısal.** Hem Rangliste'de hem 16 Temmuz
2026 tarihli yeni CPU testinde Counter-Strike, Valorant, Dota, Fortnite ve
Apex kelimelerinin geçiş sayısı **sıfır**. Tek bir incelemenin tercihi değil,
yayının yöntemi.

### Steam listesiyle örtüşme — asıl rahatsız edici sayı

| | Steam ilk 100'de olan |
|---|---|
| GPU paketindeki 23 oyundan | **4** (ARC Raiders, Battlefield 6, Cyberpunk 2077, KCD2) |
| CPU paketindeki 9 oyundan | **1** (Baldur's Gate 3) |

ComputerBase paketini **grafik olarak zorlayan yeni çıkışlara** göre seçiyor,
insanların ne oynadığına göre değil. Bu, A.2'nin "oyun sayısını artır"
hedefiyle "insanların oynadığı oyunları kapsa" hedefinin **aynı şey olmadığını**
gösteriyor. 15 oyun eklemek kapsamı 8'den 23'e çıkarır ama Steam ilk 100'ünde
tanıdıklık yalnızca 1'den 4'e çıkar.

---

## 3. Aynı sürücü dönemi köprüsü — sorunun kendisi ortadan kalkıyor

K77 farklı sürücü dönemlerini köprülemeyi yasaklıyor; aynı dönem içi
yasaklanmamış ama hiç ölçülmemişti.

**Ölçüm sonucu: bu soruyu şimdilik cevaplamaya gerek yok.** Eldeki en büyük
kazanç (15 oyun) **tek bir incelemenin içinde** — aynı sürücü, aynı 14 kart,
aynı test sistemi. Köprü kurulmuyor çünkü kurulacak bir boşluk yok.

Köprü sorusu ancak şu kaynaklara uzanmak istenirse doğuyor:

| Makale | Tarih | Not |
|---|---|---|
| Halo: Campaign Evolved | 2026-07-23 | GPU-only |
| Hell Let Loose: Vietnam | 2026-08-12 | GPU-only |
| Stalker 2 „2.0" | 2026-08-19 | GPU-only |

ComputerBase oyun başına benchmark makalesi yayınlıyor (`/artikel/gaming/…`)
ve bunlar GRE incelemesinden **sonraki** tarihlerde. Ama:

- Hepsi **yalnızca GPU** — CPU bölümü yok, yani A.2'nin "CPU ile GPU'yu aynı
  oyunda ölç" maddesini çözmüyorlar.
- **Sürücü sürümleri okunamadı:** bu makalelerin "Testsystem" sayfaları
  içerik duvarının arkasında (`seite-2` çekildi, 10,8 KB'lık duvar sayfası
  döndü). Yani aynı dönemde olup olmadıkları **doğrulanamıyor**.

Sürücü doğrulanamıyorsa K77 gereği köprü kurulamaz. Karar: **köprü denenmez,
15 oyun tek incelemeden alınır.**

---

## 4. Yeni kaynak araması — ölçüt: FPS metinde mi?

Ölçüt tek: oyun başına FPS **makine tarafından okunabilir metin** olarak mı
yayınlanıyor? Grafik görseli okunamaz, okunmaya çalışılırsa uydurma olur.

| Kaynak | Erişim | Metinde FPS | Rekabetçi oyun | Sonuç |
|---|---|---|---|---|
| **ComputerBase** | serbest | ✅ 2.448 değer | ❌ 0 | Grup 1 için kullanılıyor |
| TechPowerUp | serbest | ❌ **0** (grafikler görsel) | — | elendi |
| PCGamesHardware | serbest, `ai-train=no` | ❌ **0** | — | elendi |
| Igor's Lab | serbest **+ AI beslemesi** | ❌ **0** (32 görsel) | — | elendi |
| TechSpot / HUB | serbest | ❌ **0** (123 grafik görseli) | — | elendi |
| Guru3D, GamersNexus | `Allow`, `ai-train=no` | grafikler görsel | — | elendi |
| Tom's Hardware | — | — | ✅ CS2 paketinde var | **kullanılamaz, aşağıya bak** |
| howmanyfps, pc-builds, bottleneckcheck | — | ✅ metin | ✅ hepsi | **reddedildi, aşağıya bak** |

**Igor's Lab dersi:** `llms.txt`, AI beslemesi, açık alıntı izni — kullanım
izni en net kaynak. Ama sayılar görselde. **İzin makine-okunurluk demek
değil.** Bu, gelecekteki kaynak aramalarında ilk sorulacak soruyu belirliyor:
izinden önce biçimi sor.

**Tom's Hardware neden kullanılamaz:** CPU test paketinde CS2 var ve Grup 2
için tek bulunan itibarlı ölçüm kaynağı o. Ama Tom's Hardware bizim **bağımsız
aynamız** (K80): indeksin sistematik sapması onunla ölçülüyor. Kaynak yapılırsa
sapma ölçümü kendi kendini ölçmeye döner ve K80'in tek koşulu — sapmanın
görülebilir olması — çöker. **Grup 2 için Tom's Hardware'i kaynak yapmak, hata
payı ölçümünü feda etmek demektir.** Bu takas ayrıca kararlaştırılmalı; bu plan
onu önermiyor.

**Tahmin hesaplayıcıları neden reddedildi:** Rekabetçi oyunlar için arama alanı
neredeyse tamamen `howmanyfps.com`, `pc-builds.com`, `bottleneckcheck.com` gibi
sitelerle dolu. Bunlar FPS'i **ölçmüyor, donanımdan türetiyor** — yani bizim
`fps-estimate.ts`'imizin yaptığının aynısını, yöntemini yayınlamadan yapıyorlar.
Bir tahminden tahmin üretmek K71'in reddettiği şeyin ta kendisi.

---

## 5. Sonuç — sayıyla

### Bugün eklenebilir

| | Şimdi | Sonra |
|---|---|---|
| Oyun (GPU) | 8 | **23** |
| GPU ölçüm hücresi | 64 | **184** *(15 oyun × 8 kart)* |
| Kaynağın oranı (K75 tavanı %10) | %2,6 | **%7,5** ✅ |
| Steam ilk 100'ünde tanıdık oyun | 1 | **4** |

**Yeni kaynak gerekmiyor, köprü gerekmiyor, K77 devreye girmiyor.** Aynı
inceleme, aynı sürücü, aynı 14 kart.

**K75 uyarısı:** %7,5 tavanın altında ama sayım **toplamadan önce
tekrarlanmalı** — payda (2.448) bu planın ölçümü, ve K75 "sayım yapılmadan
oran uygulanamaz" diyor. Sayfa değişmiş olabilir.

### Bugün eklenemez

| | Sayı | Engel |
|---|---|---|
| **Grup 2, senin altı oyunun** | **0 / 6** | Doğrulanmış kaynakta sıfır kapsam |
| Valorant, LoL, Fortnite | 0 / 3 | Steam'de yok **ve** metin yayınlayan ölçüm kaynağı bulunamadı |
| CS2, Dota 2, Apex | 0 / 3 | Yalnızca Tom's Hardware'de (aynamız, kaynak olamaz) |
| Grup 1'in Steam'deki kalanı | 0 / 15 | Kaynağın paketinde yok *(Elden Ring, Wukong, Helldivers 2, Monster Hunter Wilds…)* |

**Grup 2'de engel emek değil kaynak.** Ne kadar çalışılırsa çalışılsın, metin
olarak rekabetçi oyun FPS'i yayınlayan, aynamız olmayan bir ölçüm kaynağı bu
turda bulunamadı.

### Ek bulgu: CPU indeksi büyütülebilir

16 Temmuz 2026 tarihli CPU testinde **34 işlemci** var; katalogda 12 indeksli
CPU var. A.2'nin "12 CPU → 20" hedefi bu tek kaynaktan karşılanabilir
görünüyor.

**Doğrulanması gereken:** o sayfada görülen 201 sayı oyun başına FPS mi, yoksa
yalnızca toplu "Leistungsrating" mi? Sayfa başlığı toplu rating diyor. Oyun
başına değer yoksa CPU tarafı Rangliste'ye bağlı kalır. **Bu, toplamaya
başlamadan önce yapılacak tek kontrol.**

---

## 6. Önerilen sıra

1. **15 oyunu mevcut incelemeden al.** En büyük kazanç, en düşük risk, yeni
   karar gerektirmiyor. Öncesinde K75 paydasını yeniden say.
2. **CPU testinin oyun başına değer verip vermediğini kontrol et.** Veriyorsa
   CPU indeksi 12 → 34'e kadar açılabilir.
3. **Grup 2'yi kapat ve sebebini yaz.** Kaynak bulunana kadar rekabetçi oyun
   eklenmiyor; arayüz zaten kapsam dışını dürüstçe söylüyor.
4. **Tom's Hardware takasını ayrıca sor.** Grup 2 gerçekten isteniyorsa, bedeli
   hata payı ölçümünü kaybetmek. Bu bir kural esnetmesi ve sorulmadan yapılmaz.

---

## 7. Ölçüm nasıl yapıldı

- **Steam:** `store.steampowered.com/charts/mostplayed` tarayıcıda açıldı, ilk
  100 canlı okundu (20 Ağustos 2026).
- **ComputerBase:** `robots.txt` kontrol edildi (`/artikel/` serbest). GRE
  incelemesinin 1. sayfasından oyun listesi, `seite-3`…`seite-8`'den FPS
  değerleri **sayıldı** (`>NN,N<` deseni: 544+340+476+340+476+272 = 2.448).
  Kart adları düzenli ifadeyle çıkarıldı (14 kart). CPU tarafında Rangliste ve
  7700X3D testi çekilip oyun adları arandı.
- **Aday kaynaklar:** her biri için `robots.txt` + bir gerçek inceleme sayfası
  çekildi; metindeki ondalık FPS deseni ile grafik görseli sayısı karşılaştırıldı.
- **Arama:** rekabetçi oyun CPU benchmark'ı için web araması yapıldı; dönen
  sonuçların baskın kısmı tahmin hesaplayıcısıydı.

Hiçbir FPS değeri dosyaya yazılmadı. Toplama başlamadı.

---

## 8. Açık kalan sorular

1. **CPU testi oyun başına değer veriyor mu?** (bölüm 5, ek bulgu)
2. **ComputerBase oyun makalelerinin sürücü sürümü okunamıyor** — içerik duvarı.
   Tarayıcı paneliyle okunabilir mi, denenmedi.
3. **Kaynak çeşitliliği tek noktada kaldı.** 184 GPU ölçümünün tamamı tek
   incelemeden gelecek. K80'in aynası bunu görünür tutuyor ama tek kaynak
   riski büyüyor.
4. **"Oyun sayısı" ile "tanıdık oyun" aynı hedef değil.** 23 oyuna çıkıldığında
   bile Steam ilk 100'ünden yalnızca 4 oyun kapsanıyor. A.2'nin hedefi hangisi,
   ayrıca kararlaştırılmalı.
