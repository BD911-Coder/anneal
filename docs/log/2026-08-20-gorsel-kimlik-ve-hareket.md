# 2026-08-20 — İkinci UI turu: görsel kimlik ve hareket

## Ne yapıldı

Siteye görsel bir kimlik ve giriş hareketi eklendi. İçerik, sayılar ve
dürüstlük metinleri **değişmedi**; önceki turun tipografi hiyerarşisi,
ölçüldü/tahmin ayrımı ve sonuç öncelik sırası korundu.

### Önce üç yön çizildi ve karşılaştırıldı

Tek bir prototip sayfasında (`public/tasarim-turu-2.html`, karar verildikten
sonra silindi) üç yön **aynı içerikle** yan yana kondu — uyumluluk hatası,
sistem indeksi, dört satır FPS:

| | Motif | Renk | Hareket |
|---|---|---|---|
| **A — Tavlama fırını** | wafer die ızgarası + akkor | grafit zemin, **turuncu vurgu** | kart sıcak gelir, soğur |
| **B — Litografi maskesi** | devre izleri, via, hizalama artıları | bugünkü **mavi** vurgu | bir kez geçen pozlama çizgisi |
| **C — Ölçüm masası** | ince ızgara + üstte soluk akkor | bugünkü palet | yalnızca sıralı beliriş |

**Seçilen: B'nin zemini + A'nın hareketi** (proje sahibi). Ek kısıtı:

> Turuncu/akkor SADECE hareket süresince görünecek, hiçbir kalıcı durumda
> kullanılmayacak. Uyarı rengi olarak anlamı korunmalı. `prefers-reduced-motion`
> açıksa ısı hiç görünmez.

### Uygulanan

**Arka plan** — `app/backdrop.tsx`: tek satır içi SVG. Dik açılı devre
izleri, via kareleri, köşelerde hizalama artıları. Ekrana sabit,
**animasyonsuz**, tek renk (`--motif`), iki temada kendi tonunu alıyor.

**Hareket** — `app/globals.css`:

- `anneal-belir` — bölüm aşağıdan yukarı belirir (0.5 sn)
- `anneal-isi` — çevresinde akkor hâle, 0.9 sn'de sıfıra iner
- `anneal-dol` — indeks çubuğu soldan dolar (0.8 sn)
- sıralı geliş: bölüm başına 0.08 sn gecikme

**Sayarak gelen sayı** — `app/count-up.tsx`: sistem indeksi ve 23 satırlık
FPS listesi.

**İndeks çubuğu** — `app/index-bar.tsx`: ölçek 0–200, referans 100 çentikli.

**Cam yüzey** — üç panelde (`boş durum`, `Seçilen sistem`, `Kayıt anındaki
değerler`): saydam yüzey + `backdrop-filter: blur(8px)`.

## Kararlar ve gerekçeleri

**K138 — Isı kalıcı vurgu olmadı.** A yönünün turuncusu kalıcı vurgu olsaydı,
bu sitede kehribarın taşıdığı "uyarı" anlamını (K130, K132) tüketirdi.
Kullanıcı turuncu gördüğünde "bir şey var" diye düşünmeli, "sayfa yüklendi"
diye değil.

**K139 — Motif çizim, fotoğraf değil; animasyonsuz.** Fotoğraf hem ağır hem de
içeriğin önüne geçer. Sürekli çalışan arka plan efekti 375px telefonda pili ve
kaydırma akıcılığını yer.

Opaklık **ölçüldü, seçilmedi**: açık `rgba(31,95,168,.07)`, koyu
`rgba(127,179,236,.12)`. Çizginin tam üstündeki pikselde gövde metni açık
temada 6.4:1 → 5.9:1, koyu temada 7.1:1 → 5.9:1. İkisi de AA (4.5:1) üstünde.

**K140 — Hareket giriş anında, veri değişince değil.** FPS listesine bakan biri
sabit bir tablo görmeli. Seçim değiştiğinde bölümler yerinde durduğu için CSS
animasyonu yeniden tetiklenmiyor; `CountUp` `sayildi` bayrağıyla ikinci kez
saymıyor.

**K141 — Sayma, gerçek sayının üstüne biner.** React `value`'yu çiziyor; sayma
`textContent`'e yazıyor ve her zaman `value` ile bitiyor. JavaScript
çalışmazsa ya da animasyon yarıda kalırsa ekranda doğru sayı durur —
**hiçbir koşulda 0 görünmez**. Ara değerler hedefle aynı basamakta
(`toFixed`): 164.4'e sayarken tam sayı gösterip sonda `.4` eklemek zıplama
olurdu.

Sunucudan gelen sayılarda sayma kapalı (`animate={false}`): kaydedilmiş sistem
sayfasında gerçek sayı zaten boyanmış, sıfırlayıp saymak "118 → 0 → 118"
titremesi yaratırdı.

**K142 — Çubuk ölçeği 0–200, referans 100.** Tavanı belirsiz bir çubuk sayıyı
olduğundan büyük ya da küçük gösterir. **Oyun başına FPS çubuğu YAPILMADI**:
K98 listeyi bilerek alfabetik tutuyor, satır başına çubuk kullanıcıyı tam da
kaçınılan yöne — "en uzun çubuğa bak" — koşullandırırdı.

**K143 — `-webkit-backdrop-filter` standart özelliği düşürdü.** Ön ekli satır
yazılınca Lightning CSS **ikisini birden** attı; tarayıcıya giden kuralda
yalnızca `background` kaldı. Ön ekli satır silinince standart özellik geri
geldi. Bu projede ön ek elle yazılmaz.

## Ne doğrulandı

**Kontrast taraması — üç genişlik × iki tema, iki sayfa.** Tarayıcıda,
saydam yüzeyleri ata zincirinde birleştirerek (`.cam` rgba yüzeyleri dahil):

```
/ (GPU + CPU seçili, 6 sonuç bölümü, 23 FPS satırı) — 299 öğe
  1440 açık  0 ihlal   1440 koyu  0 ihlal
   768 açık  0 ihlal    768 koyu  0 ihlal
   375 açık  0 ihlal    375 koyu  0 ihlal

/ (boş durum) — 76 öğe
  1440 açık  0 ihlal    375 koyu  0 ihlal

/sistem/hbmk3x — 194 öğe
  1440 açık  0 ihlal   1440 koyu  0 ihlal
   768 açık  0 ihlal    768 koyu  0 ihlal
   375 açık  0 ihlal    375 koyu  0 ihlal
```

Üç genişlikte de yatay taşma yok (`scrollWidth === innerWidth`). Konsol temiz.

**Hareket bağlandı** (tarayıcıda okunan hesaplanmış değerler):

```
bölüm animasyonu   anneal-belir, gecikme 0.16s (3. bölüm)
ısı hâlesi         anneal-isi,  gecikme 0.16s (bölümü izliyor)
                   rgba(255,138,60,.45) 0 0 0 1px, rgba(255,108,30,.26) 0 0 26px
çubuk              anneal-dol, genişlik 82.2% (indeks 164.4 / 200)
cam yüzey          rgba(246,247,249,.72) + backdrop-filter: blur(8px)
```

**`prefers-reduced-motion` ölçüldü.** Medya kuralı CSSOM'dan zorla açılarak:

```
bölüm animasyonu   none
ısı hâlesi         display: none      <- turuncu HİÇ çizilmiyor
çubuk animasyonu   none
çubuk genişliği    59.8%              <- doğru değer yerinde duruyor
```

**Kaydedilmiş sistem sayfasında sayma kapalı**: 23 FPS satırı ilk çizimde
gerçek değerleriyle geldi (`65.3`), titreme yok.

**Komutlar:**

```
npm run lint            0 hata
npx tsc --noEmit        0 hata
npm test                144/144
npm run sema:kontrol    82/82 (144 karar okundu, numaralar tekil)
npm run kural:kontrol   11/11 kural gerçek veriyle tetikleniyor
npm run build           hatasız, 4 sayfa
```

## Açık kalan sorular

- **Ekran görüntüsü alınamadı.** Bu oturumda tarayıcı paneli görüntülenmediği
  için `screenshot` çalışmadı; doğrulama DOM ve hesaplanmış CSS değerleri
  üzerinden yapıldı. Hareketin *hissi* — hâlenin ne kadar güçlü göründüğü,
  gecikme merdiveninin hızı — gözle bakılarak ayarlanmadı. Proje sahibi
  siteyi açıp bakmalı; hâle fazla güçlüyse `--motif` gibi tek yerden
  kısılabilir (`anneal-isi` içindeki iki rgba değeri).
- **375px'te akıcılık ölçülmedi, sadece taşma ölçüldü.** Gerçek telefonda
  kare düşmesi olup olmadığı bilinmiyor. Sürekli çalışan animasyon
  bulunmadığı için risk düşük ama sınanmadı.
