# 2026-08-20 — A.2: oyun kapsamı 8 → 23, Grup 2 kapandı

**120 yeni ölçüm.** Yeni kaynak yok, köprü yok, kural esnetmesi yok — hepsi
zaten kullandığımız incelemenin içindeydi.

| | Önce | Sonra |
|---|---|---|
| Oyun | 8 | **23** |
| GPU ölçümü | 64 | **184** |
| `benchmark_points` | 178 | **298** |
| Kaynağın oranı (K75 tavanı %10) | %2,6 | **%7,5** |

---

## 1. Grup 2 kapandı (K105)

Proje sahibinin kararı: **Tom's Hardware kaynak yapılmayacak**, K80 aynası
olarak kalıyor. Sonuç kabul edildi: CS2, Valorant, Fortnite, Apex, LoL,
Dota 2 bugün eklenemiyor.

> Tek bağımsız aynayı kaynağa çevirmek, sapma ölçümünü kendi kendini ölçmeye
> dönüştürür. **"Her sayının hata payı ölçülmüştür" iddiası, birkaç popüler
> oyundan değerlidir.**

Yeniden açılma koşulu K105'te yazılı: rekabetçi oyun FPS'ini **metin olarak**
yayınlayan, aynamız olmayan bir ölçüm kaynağı.

---

## 2. Toplama

### Önce payda sayıldı (K75)

K75 "sayım yapılmadan oran uygulanamaz" diyor. Altı oyun sayfası yeniden
çekildi ve `>NN,N<` deseni sayıldı:

```
seite-3: 544   seite-5: 476   seite-7: 476
seite-4: 340   seite-6: 340   seite-8: 272
TOPLAM PAYDA = 2448
```

184 / 2448 = **%7,5**. Tavanın içinde.

### Çıkarıcı mevcut veriye karşı doğrulandı

Toplamadan önce, çıkarıcının elle toplanmış 64 satırı yeniden üretip
üretemediği sınandı:

```
DOGRULAMA: 64 birebir, 0 farkli, 0 bulunamadi  (toplam 64)
```

**64/64 birebir.** Bu olmadan yeni 120 satıra güvenilemezdi.

### Kart seçimi kural oldu (K107)

Her oyunda 14 karttan 8'i alınıyor (K75 madde 3). Seçim:

1. O oyunun **en düşük ve en yüksek indeksli** kartı her zaman → oranı çapalar
2. Kalan 6 yer **o ana kadar en az ölçülmüş** kartlara → ölçüm 14 karta yayılır

Sonuç: 184 ölçüm 14 karta **12–19** aralığında dağıldı. Sabit bir sekizli
seçilseydi bazı kartlar 23 oyunun hepsinde ölçülü, bazıları hiçbirinde
olmazdı.

### Raytracing gizlenmedi (K108)

Dört oyunda ComputerBase yalnızca RT grafiği yayınlıyor (Crimson Desert,
Doom: The Dark Ages, Indiana Jones, Star Wars Outlaws). Şemada render modu
alanı yok. Boş bırakmak, FPS'i %30-50 değiştiren bir ayarı **gizlemek**
olurdu; mod `upscaling` alanına yazıldı:

```
1440p ultra, DLSS/FSR Native + Raytracing
```

Bedeli kabul edildi ve yazıldı: alan artık iki ayrı ayarı taşıyor ve
sorgulanamaz. Doğrusu ayrı bir `render_mode` alanı → **S42**.

### Çıkış yılları uydurulmadı (K109)

`games.release_year` zorunlu ama hiçbir kural/arayüz kullanmıyor. 15 oyunun
yılı Steam mağaza sayfasından doğrulandı ve `source_url` **Steam'i** gösteriyor
— oyunun kendi olgularının kaynağı orası. Mevcut 17 satırdaki tutarsızlık
sormadan düzeltilmedi → **S43**.

---

## 3. CPU kapsamı büyütülemedi — ölçüldü

16 Temmuz 2026 tarihli CPU testinde **34 işlemci** var (katalogda 12). Plandaki
tek kontrol buydu ve sonuç olumsuz:

```
grafik sayisi: 4
   Leistungsrating 720p + Astral RTX 5090 x Durchschnitts-FPS
   Leistungsrating 720p + Astral RTX 5090 x Frametimes
   Leistungsrating x Multi-Core
   Leistungsrating x Single-Core
```

Yalnızca **toplu rating**, üstelik 720p'de — oyun başına FPS yok. Rangliste'nin
oyun başına sayfaları da artık içerik duvarının arkasında (`seite-2` ve
`seite-3` 10,8 KB'lık duvar sayfası döndürüyor).

**CPU 12'de kalıyor.** Mevcut 114 CPU satırı erişilebilirken toplanmıştı.

---

## 4. Ne doğrulandı

### Sapma — K80'in zorunlu adımı

```
GPU  — ortalama 3.6%   en buyuk 8.8%
CPU  — ortalama 7.2%   en buyuk 11.5%
TOPLAM  ortalama mutlak sapma: 5.2%   en buyuk: 11.5%
Esik %25: GECTI
```

**GPU tarafı belirgin şekilde iyileşti** (%4.9 → %3.6 ortalama, %11.5 → %8.8
en büyük): daha çok oyun, daha az gürültü. CPU tarafı değişmedi çünkü CPU
ölçümleri aynı kaldı. Toplam ortalama 4.9'dan 5.2'ye çıktı — kötüleşme değil,
karışımın değişmesi: karşılaştırılan parça 26'dan 20'ye indi, CPU'nun payı
arttı. `lib/perf-margin.ts` güncellendi.

### FPS hata payı — yeniden ölçüldü, kötüleşti

Veri değişince eski sayı eskidi; birini-dışarıda-bırak 184 nokta üzerinde
tekrarlandı:

```
                     önce (64)   sonra (184)
ortalama mutlak hata   %6.1        %6.6
medyan                 %4.9        %5.4
%90 dilim              %12.8       %13.7
en kötü                %27.8       %35.3
±%10 içinde            %83         %79
```

**Sayı kötüleşti ve bu dürüst sonuç.** Gerileme değil, örneklemin genişlemesi:
yeni 15 oyun arasında raytracing zorunlu başlıklar var ve o oyunlarda kartların
sırası indeks sırasından belirgin şekilde ayrılıyor. Eski sayı daha iyi
görünüyordu çünkü daha dar bir oyun kümesini ölçüyordu. `lib/fps-margin.ts`
güncellendi, arayüz yeni sayıyı gösteriyor.

### Diğer

```
npm run olcum:aktar   games: 32 satir, 15 yeni. benchmark_points: 120 yeni,
                      178 atlandi (zaten var). Tabloda 298 satir.
npm run indeks:hesapla  26 parca, model_version v0.2
npm test              5 dosya, 144 test
npm run lint          temiz
npm run sema:kontrol  81/81
npm run kural:kontrol 11 kuralin hepsi tetikleniyor, W5 = 14
npm run build         hatasiz
```

### Tarayıcıda

Ana sayfa başlığı **kendiliğinden güncellendi** — K103'ün amacı buydu:

```
Oyun bazlı FPS: 23 oyunda, 60 ekran kartında gösteriliyor.
```

RX 9070 GRE seçildiğinde 23 oyun listelendi, alfabetik, **12 ölçüm + 11
tahmin**. Ayarlar artık farklılaştığı için satır başına ayar etiketi
kendiliğinden açıldı — A.1'de bunun için yazılmış `singleSetting` kontrolü
ilk kez devreye girdi:

```
ARC Raiders                        92 FPS  ○ tahmin ±%13.7  1440p ultra, DLSS/FSR Native
Crimson Desert                   59.9 FPS  ● ölçüldü        1440p ultra, DLSS/FSR Quality + Raytracing
Doom: The Dark Ages                56 FPS  ○ tahmin ±%13.7  1440p ultra, DLSS/FSR Native + Raytracing
Resident Evil Requiem           126.6 FPS  ● ölçüldü        1440p ultra, DLSS/FSR Quality
```

Konsol hatası yok. Ekran görüntüsü yine alınamadı (tarayıcı paneli
görüntülenmiyor); doğrulama DOM'dan okunan `innerText` ile yapıldı.

---

## 5. Kayda geçen kısıt: "oyun sayısı" ≠ "tanıdık oyun" (K106)

23 oyunluk pakette Steam'in en çok oynanan ilk 100'ünden **yalnızca 4 oyun**
var (ARC Raiders, Battlefield 6, Cyberpunk 2077, KCD2). CPU paketinin 9
oyunundan 1.

Sebep emek eksikliği değil **kaynak seçimi**: donanım incelemeleri paketlerini
grafik olarak zorlayan yeni çıkışlara göre seçer; Steam'in en çok oynananları
eski, rekabetçi ve düşük gereksinimli başlıklarla doludur. İki liste yapısal
olarak farklı şeyleri optimize ediyor.

**İnceleme sitelerinden ne kadar veri alınırsa alınsın bu fark kapanmaz.** Tek
çözüm kullanıcı katkısı; `ROADMAP.md` Faz F'deki madde bu yüzden işaretlendi
ve öne çekilmesi değerlendirilecek.

---

## 6. Açık kalan sorular

1. **S42** — render modu için ayrı alan gerekli mi? (K108'in bedeli)
2. **S43** — mevcut 17 oyunun `source_url`'i düzeltilsin mi? (K109)
3. **Tek kaynak riski büyüdü.** 184 GPU ölçümünün tamamı tek incelemeden.
   K80'in aynası bunu görünür tutuyor ama kaynak çeşitliliği hâlâ yok.
4. **CPU tarafı dondu.** 12 işlemci, 9 oyun, ve kaynak sayfası artık duvarın
   arkasında — mevcut veri yeniden doğrulanamıyor bile.
5. **Hata payı hâlâ elle işleniyor.** Bu tur iki kez güncellendi
   (`perf-margin`, `fps-margin`); A.3 bunu script'e çevirmeli, yoksa bir
   sonraki veri turunda unutulur.
