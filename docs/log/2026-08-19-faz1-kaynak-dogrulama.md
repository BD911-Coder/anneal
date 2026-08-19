# 2026-08-19 — Faz 1: kaynak doğrulama

Faz 0'da bir kaynak (ComputerBase) doğrulanmıştı. Bu tur, kalan adayların
**per-oyun FPS verisini HTML metin olarak** yayınlayıp yayınlamadığını ölçtü.

**Veri toplanmadı, `benchmark_points`'a tek satır yazılmadı.**
**Harcanan: 17 tool çağrısı.** (Faz 0: 25. Kaynak doğrulama toplamı: 42.)

---

## 1. Sonuç tablosu

| Alan adı | Per-oyun FPS, HTML metin? | Karar |
|---|---|---|
| **computerbase.de** | **Evet** — `<li class="chart__row">`, sunucu tarafında üretiliyor | **KULLANILABİLİR** (GPU + CPU) |
| **notebookcheck.net** | **Evet** — 227 satırlık HTML tablo, per-oyun × çözünürlük × ayar | **KOŞULLU** — aşağıya bak |
| tomshardware.com | Hayır — HTML tablodaki sayı 11 oyunun ortalaması; per-oyun grafikler PNG | Kaynak değil, **çapraz kontrol** |
| techspot.com | Hayır — grafikler JPG (`articles-info/.../images/*.jpg`) | Kullanılamaz |
| guru3d.com | Hayır — inceleme alt sayfasında hiç sayı yok, içerik JS ile geliyor | Kullanılamaz |
| pcgameshardware.de | Hayır — Rangliste sayfasında 220 satır metin var, FPS yok; veri JS/veritabanı bileşeninde | Kullanılamaz |
| techpowerup.com | — | **Elendi** (Faz 0, kullanım şartları) |

**Doğrulanmış, koşulsuz kullanılabilir kaynak sayısı: 1.**

---

## 2. Notebookcheck neden "koşullu"

Tablo teknik olarak mükemmel: 227 satır, oyun başına dört ayar (Low/Medium/
High/Ultra 1080p) artı QHD ve 4K sütunları, hepsi düz HTML.

İki sorun var.

**a) Dizüstü kartları.** Sayfa "Computer Games on Laptop Graphics Cards" ve
satırlar `NVIDIA GeForce RTX 5090 Laptop` biçiminde. Kataloğumuz masaüstü.
Aynı adı taşıyan dizüstü ve masaüstü kart aynı parça değil; karıştırılırsa
indeks sessizce yanlış olur.

**b) Tablo ölçüm ile tahmini karıştırıyor.** Sayfanın kendi açıklaması:

> "May Stutter — This graphics card has not been explicitly tested on this game.
> Based on **interpolated** information from surrounding graphics cards of
> similar performance"

Yani hücrelerin bir kısmı ölçüm değil, Notebookcheck'in kendi interpolasyonu.
Bunları almak, **K74'ün reddettiği interpolasyonu başkasının yaptığı hâliyle
içeri almak** olur — üstelik `benchmark_points`'a "ölçüm" diye girer ve
`source_type = review` damgası yalan söyler.

Kullanılacaksa hücre düzeyinde ayıklama şart: yalnızca açıkça test edilmiş
değerler, ve yalnızca masaüstü karşılığı doğrulanmış satırlar. Bu, satır başına
maliyeti ciddi biçimde artırıyor.

---

## 3. Tom's Hardware'in rolü netleşti

Faz 0'da "kaynak olamaz" denmişti (11 oyunun geometrik ortalaması, `game_id`
karşılığı yok). Faz 1 bunu bir avantaja çeviriyor:

**Tom's, üretim verisinin tek bağımsız doğrulama aracı.** Tek kaynaktan veri
toplanıyorsa, o kaynağın sistematik sapmasını görecek ikinci bir göz gerekiyor
ve Tom's tam olarak bunu yapabiliyor — 48 kartı kapsıyor, HTML tablo, mutlak
FPS veriyor. K79'daki %7.8 / %20.3 ölçümü zaten bu şekilde alındı.

Veri kaynağı değil, **kalibrasyon aynası**. Bu ayrımın kayda geçmesi gerekiyor.

---

## 4. Planı bloke eden bulgu: K75'in 4. maddesi karşılanamıyor

K75 dün yazıldı ve 4. maddesi şu:

> Her parçanın en az iki **farklı alan adından** ölçümü olur.

Doğrulanmış kaynak sayısı **1**. Notebookcheck koşullu ve dizüstü ağırlıklı.
Bu maddeyle bugün **hiçbir parça** indekslenemez.

Madde keyfi değil, Faz 0'ın ölçtüğü şeyin karşılığı: tek kaynağın sistematik
sapması (%20.3'e varan) ancak ikinci bir kaynakla görülüyor.

**Dört yol var:**

| Yol | Ne gerekiyor | Risk |
|---|---|---|
| **A.** Daha derin kaynak araştırması — JS ile çizilen grafiklerin veri yükü sayfada gömülü olabilir; tarayıcı paneliyle bakılır | ~1 oturum, sonuç garantisiz | Emek boşa gidebilir |
| **B.** K75.4'ü gevşet: tek kaynak yeterli, **ama** Tom's ile çapraz kontrol zorunlu ve sapma her yayında ölçülüp kaydedilir | Karar | Sistematik sapma indekse girer; ölçülür ama düzeltilmez |
| **C.** İkinci kaynak `own_test` olsun — proje sahibinin kendi makinesi | Donanım, zaman | Tek makine, tek kart; ölçeğe bir düğüm ekler, kapsama çözmez |
| **D.** Notebookcheck'i hücre ayıklamasıyla kullan | Ayıklama disiplini + masaüstü eşleme | Yanlış satır alma riski yüksek |

**Önerim: A, sonra B.** Bir oturumluk derin arama ucuz; başarısız olursa B
dürüst bir geri çekilme — çünkü sapmayı *gizlemiyor*, ölçüp yazıyor (K79 zaten
bu disiplini kurdu).

C ve D'yi şimdilik bırakırdım: C kapsamayı çözmüyor, D'nin hata riski
kazancından büyük.

→ **`SORULAR.md` S34.**

---

## 5. Kapsam aritmetiği — K75 oranı ne veriyor

K75 mutlak tavanı kaldırdı, oranı getirdi. Ölçülen:

```
ComputerBase benchmark sayfasi:  24 grup x ~14 kart  =  ~336 veri noktasi
K75 %10 tavani                =  ~33 satir/sayfa
K76 hedefi (~30 GPU + ~20 CPU, parca basina 3 olcum)  =  ~150 satir
```

**~5 ComputerBase sayfası yeterli.** Yani K75'in oran kuralı, K72'nin 25'lik
mutlak tavanının yarattığı tıkanıklığı gerçekten çözüyor — Faz 0'daki "13 alan
adı gerekiyor" sorunu ortadan kalktı.

Kalan tıkanıklık kaynak **çeşitliliği**, miktarı değil (bölüm 4).

---

## 6. Uygulanan kararlar

Bu turda kod tarafına yansıyanlar:

- **K75** kaynak tavanı orana çevrildi; K72 "değiştirildi" olarak işaretlendi
  ve kaydın bütünlüğü için duruyor.
- **K76** kapsam ~30 GPU + ~20 CPU'ya daraltıldı.
- **K77** farklı sürücü dönemi köprülenmez; eski nesil kart ancak yeni
  kartlarla aynı incelemede ölçülmüşse indekslenir.
- **K78** Faz 0'ın üç dersi kural oldu: köprü ≥6 kart, farklı upscaling
  rejimleri köprülenmez, parça başına ≥3 oyun.
- **K79** hata payı ölçülür. Sayı tek yerde: `lib/perf-margin.ts`
  (%7.8 ortalama, %20.3 en büyük, 2026-08-19, yöntemiyle). Arayüz bu dosyadan
  okuyor; iki yerde ayrı sayı yazılamıyor.

`lib/perf-margin.ts` içinde `provisional: true` var ve sebebi yazılı: ölçüm
K78'in artık **yasakladığı** koşullarda alındı (2 oyun, 3 kartlık köprü, karışık
upscaling). Yani bu kötü senaryonun sayısı; gerçek toplama sonrası yeniden
ölçülecek.

---

## Açık kalan sorular

- **S34** — Tek doğrulanmış kaynakla K75.4 karşılanamıyor. Dört yol, önerilen
  A→B. **Bu karar verilmeden Faz 2 (toplama) başlamamalı.**
- Faz 0'dan devam: eski nesil kartların ölçeğe bağlanması. K77 bunu kısmen
  kapattı (aynı incelemede ölçülmüşse indekslenir, yoksa hayır) ama pratikte
  kaç eski kartın yeni incelemelerde yer aldığı **ölçülmedi**. K76 zaten eski
  nesilleri kapsam dışı bıraktığı için bu soru şimdilik ertelenebilir.
