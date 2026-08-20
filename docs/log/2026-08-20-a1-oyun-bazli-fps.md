# 2026-08-20 — Faz A.1: oyun bazlı FPS çalışıyor

178 ölçüm ilk kez kullanıcıya görünüyor. Kullanıcı ekran kartını seçtiğinde
sekiz oyun için FPS görüyor, her sayının ölçüm mü tahmin mi olduğu yanında
yazıyor.

**Şema değişmedi. Yeni tablo açılmadı. Türetilen tek bir sayı bile
veritabanına yazılmadı.**

---

## 1. Ne yapıldı

| Dosya | Ne |
|---|---|
| `engine/fps-estimate.ts` | Saf motor. Oyun içi indeks oranıyla tahmin. |
| `tests/fps-estimate.test.ts` | **16 test** |
| `data/benchmarks.ts` | Ölçüm gruplarını okur, motorun tipine çevirir |
| `lib/fps-margin.ts` | Ölçülmüş hata payı, tek tanım (`perf-margin.ts` deseni) |
| `app/builder.tsx` | Oyun listesi bölümü |
| `app/page.tsx` | Grupları okuyup Builder'a verir |

Oyun listesi, tek sistem indeksinin **yanında** duruyor — yerine değil. İndeks
sistemin bütününü (işlemci dahil) anlatıyor, liste yalnızca ekran kartına
dayanıyor. Bunun bir yan etkisi ortaya çıktı ve iyi bir yan etki: **işlemci
seçilmeden de FPS listesi görünüyor**, çünkü liste işlemciye ihtiyaç duymuyor.

---

## 2. Verilen kararlar

Proje sahibi üç soruyu cevapladı; hepsi `docs/KARARLAR.md`'ye geçti.

**K97 — ölçülmüş ve türetilmiş ayrılır.** `● ölçüldü` / `○ tahmin ±%12.8`.
Gerekçe proje sahibinin ifadesiyle: *"Bu sitenin tüm duruşu."*

Buna sessiz bir ikinci işaret eklendi: **türetilen sayı tam sayıya yuvarlanır,
ölçüm ondalığını korur.** Hata payı ±%10 iken ondalık yanlış bir kesinlik
vaadi; 87 dürüst, 87,4 değil. Ekranda `202.6` ile `96` yan yana durunca fark
okunuyor.

**K98 — FPS'e göre sıralanmaz, alfabetik.** Sıralama motorda değil arayüzde;
bir sunum kararıdır ve `estimateGameFps` girdi sırasını korur (testi var).

**K99 — çelişki gizlenmez.** Listenin başında kalıcı not.

**K100 — türetilen FPS hiçbir tabloya yazılmaz.** K71'in gerekçesi.

**K101 — grup anahtarı (oyun + çözünürlük + preset + upscaling)**, ve bir grup
ancak aynı GPU'yu bir kez içeriyorsa ve en az 3 farklı GPU varsa kullanılır.

---

## 3. Proje sahibinin metnine yapılan tek değişiklik

S41 için önerilen notta *"güçlü bir işlemciyle (RTX 5090 test sistemi)
ölçülmüştür"* yazıyordu. **Parantez yazılmadı.**

İki sebep:

1. RTX 5090 bir **ekran kartıdır** — o, CPU ölçümlerinin sabitlenmiş GPU'su.
   İşlemci olarak yazmak yanlış olurdu.
2. GPU ölçümlerinin 64 satırında `cpu_part_id` **boş**. Hangi işlemcide
   ölçüldüğü verimizde kayıtlı değil; yazsaydık kaynağı olmayan bir iddia
   arayüze girerdi.

Notun geri kalanı ve niyeti aynen uygulandı. Ekrandaki hali:

> Bu değerler, işlemcinin sınırlamadığı bir test sisteminde ölçülmüştür. Sizin
> işlemciniz bazı oyunlarda bu sayının altında kalmasına yol açabilir.
> Yukarıdaki sistem indeksi işlemciyi hesaba katar, bu liste katmaz — ikisi
> farklı şeyler ölçüyor.

---

## 4. Ne doğrulandı

### Testler ve derleme

```
npx vitest run tests/fps-estimate.test.ts
  Test Files  1 passed (1)
       Tests  16 passed (16)

npm test
  Test Files  5 passed (5)
       Tests  144 passed (144)

npm run lint      -> temiz
npm run build     -> Finished TypeScript, 4/4 sayfa, hata yok
```

### Veri katmanı gerçek veriye karşı

```
GRUP SAYISI: 8
  alan-wake-2                8 olcum  [1440p ultra, DLSS/FSR Quality]
  anno-117                   8 olcum  [1440p ultra, DLSS/FSR Quality]
  assassins-creed-shadows    8 olcum  [1440p ultra, DLSS/FSR Quality]
  call-of-duty-black-ops-7   8 olcum  [1440p ultra, DLSS/FSR Quality]
  cyberpunk-2077             8 olcum  [1440p ultra, DLSS/FSR Quality]
  death-stranding-2          8 olcum  [1440p ultra, DLSS/FSR Quality]
  f1-25                      8 olcum  [1440p ultra, DLSS/FSR Quality]
  hogwarts-legacy            8 olcum  [1440p ultra, DLSS/FSR Quality]
```

**K101 çalıştı:** 178 ölçümün 114'ü CPU ölçümüdür ve o gruplarda aynı GPU
(RTX 5090) 12-15 kez geçtiği için dokuz grubun hepsi düştü. Geriye tam olarak
sekiz GPU grubu kaldı — elle filtre yazmadan.

### Tarayıcıda

Ekran görüntüsü alınamadı (tarayıcı paneli görüntülenmiyor, sayfa kare
üretmiyor); doğrulama sayfanın kendi DOM'undan okunan `innerText` ile yapıldı.

**RX 9070 GRE** — 5 ölçüm + 3 tahmin:

```
Alan Wake 2                       62.4 FPS  ● ölçüldü
Anno 117: Pax Romana              71.9 FPS  ● ölçüldü
Assassin's Creed Shadows          57.8 FPS  ● ölçüldü
Call of Duty: Black Ops 7          129 FPS  ○ tahmin ±%12.8
Cyberpunk 2077                      96 FPS  ○ tahmin ±%12.8
Death Stranding 2: On the Beach   80.9 FPS  ● ölçüldü
F1 25                            155.9 FPS  ● ölçüldü
Hogwarts Legacy                     93 FPS  ○ tahmin ±%12.8

5 oyunda sayı doğrudan ölçüm; 3 oyunda bu kartın ölçümü yok ve indeksinden
hesaplandı. ... ortalama %6.1, tahminlerin %90'ı %12.8 altında, en kötü %27.8.
```

Sıra alfabetik: F1 25 en yüksek FPS'e sahip ama listenin sonlarında, Cyberpunk
ortada. **FPS'e göre sıralanmadığı buradan görülüyor.**

**MSI RTX 5090 Gaming Trio (kart seçili)** — 4 + 4. Kart seçilince liste
çipin ölçümlerine düşüyor; mevcut *"indeksi çip için ölçüldü"* uyarısı zaten
görünüyor.

**RTX 5080 (indekssiz çip)** — kapsam dışı:

```
Bu kart için ölçüm yok. Oyun bazlı FPS yalnızca ölçüm verisi toplanmış
kartlarda gösterilebiliyor; uydurma bir sayı göstermektense hiç
göstermiyoruz.
```

**K99'un senaryosu canlı görüldü.** RTX 5090 + Ryzen 5 9600X seçilince tek
skor *"İşlemci sınırlıyor"* derken liste 138–290 FPS gösterdi. Not tam olarak
bunu açıklıyor.

Konsol hatası yok.

---

## 5. Açık kalan sorular

1. **Kaydedilen sistem sayfasında (`/sistem/[id]`) oyun listesi yok.**
   Kapsam olarak istenmedi ve yapılmadı; ama paylaşılan bir sistem linkini
   açan kişi FPS görmüyor. Küçük bir iş, ayrıca karar verilmeli.
2. **Hata payı tek seferlik ölçüldü.** `lib/fps-margin.ts` sayıları elle
   işlenmiş durumda. A.3 bunu script'e çevirecek; o zamana kadar veri
   değişirse sayı eskir ve bunu fark edecek bir mekanizma **yok**.
3. **Hata payı tek kaynak ve tek ayardan ölçüldü.** 64 nokta ComputerBase'ten
   ve hepsi 1440p ultra + upscaling. İkinci kaynak ya da ikinci ayar
   geldiğinde yeniden ölçülmeli — bugünkü sayı o çeşitliliği görmemiş.
4. **Ana sayfa açıklaması eskidi.** Başlıkta hâlâ *"performans tahmini için
   ölçüm verisi henüz toplanmadı"* yazıyor; artık sekiz oyunda toplandı.
   Metin bu turda değiştirilmedi çünkü indeks tarafı için hâlâ büyük ölçüde
   doğru; ayrıca gözden geçirilmeli.
