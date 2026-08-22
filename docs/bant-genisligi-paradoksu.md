# Bant genişliği paradoksu — analiz

**22 Ağustos 2026.** Ölçüm komutu: `npm run bant:analiz`. Hiçbir şey yazmaz.

---

## Soru

K172 iki sayı buldu ve ikisi çelişiyor göründü:

```
blackwell, n=5 ölçümle                    ±%19,8
blackwell, dörtlü alt kümelerin ortalaması ±%16,9
```

Beşinci ölçüm bandı **genişletmiş** görünüyor. Bu, veri stratejimizin
dayandığı varsayımla çelişir: *daha çok ölçüm bandı daraltır.*

Dört açıklama ayrı ayrı sınandı.

---

## Cevap: paradoks GERÇEK DEĞİL — ama teselli edici bir sebepten değil

**Karşılaştırılan iki sayı aynı şeyi ölçmüyordu.** Bant tahmincisi şu:

```ts
bandFromErrors = sorted[min(n - 1, floor(0.9 * n))]
```

| n | floor(0,9n) | seçilen indeks | bu maksimum mu? |
|---|---|---|---|
| 3 | 2 | 2 | **evet** |
| 4 | 3 | 3 | **evet** |
| 5 | 4 | 4 | **evet** |
| 8 | 7 | 7 | **evet** |
| 10 | 9 | 9 | **evet** |
| 11 | 9 | 9 | hayır |
| 15 | 13 | 13 | hayır |

**n ≤ 10 için yayınladığımız "%90 dilim bandı" aslında MAKSİMUM hatadır.**

Maksimum, örneklem büyüdükçe **asla küçülmez**. Daha çok nokta = daha çok
çekiliş = daha büyük ya da eşit maksimum. Yani "n=5 bandı, n=4 bandından
geniş" cümlesi bir veri bulgusu değil, tahmincinin tanımının kendisi.

Somut olarak blackwell'in beş LOO hatası: `12,3 · 19,8 · 0,7 · 1,5 · 9,5`.
Bandı taşıyan tek sayı **19,8** ve o, ailenin log-merkezinden **%103** uzakta
duran RTX 5090'ın hatası. Dörtlü alt kümelerden 5090'ı dışarıda bırakan
küme ±%6,0 veriyor; 5090'ı içeren kümeler 19,7-25,9 arasında.

Bant, ailenin **en uç üyesinin** hatasından ibaret.

---

## Dört açıklamanın tek tek durumu

### (c) Farklı yöntem — **ANA SEBEP, doğrulandı**

Yukarıda. İki sayı hiçbir zaman karşılaştırılabilir değildi: biri 5 hatanın
maksimumu, öteki 4 hatanın maksimumunun ortalaması. Üstelik dörtlü kümelerde
model **3** noktayla eğitiliyor, beşlide **4** noktayla — eğitim boyutu da
farklı.

### (b) Küçük örneklem — **doğrulandı, hem de fazlasıyla**

Blackwell'in dörtlü bantları: `13,0 · 19,7 · 25,9 · 6,0 · 20,1`.
**Aynı aile, aynı yöntem, hangi dördünü seçtiğinize göre ±%6,0 ile ±%25,9.**
Dört katlık bir oynaklık.

Önyükleme (4000 tekrar) n=5 bandı için **±%9,5 … ±%19,8** aralığı veriyor.
Dörtlü ortalama (16,9) bu aralığın **içinde**. Yani iki sayı istatistiksel
olarak ayırt edilemiyor.

> **Önyüklemenin kendi sınırı:** bir maksimumu önyüklerken üst uç
> **dejenere** olur — yeniden örnekleme gözlenen maksimumu aşamaz, o yüzden
> aralığın üst ucu her zaman gözlenen değere yapışır. Bu, tahmincinin maksimum
> olmasının ikinci bir bedeli.

### (a) Beşinci nokta aykırı mı — **kısmen, ama soru yanlış kurulmuş**

RTX 5090 ailenin en uç noktası (merkezden %103) ve en büyük LOO hatasını
veriyor (%19,8). Ama "beşinci ölçüm" diye bir şey yok: beş nokta bir küme,
hangisinin "beşinci" olduğu keyfi. Doğru ifade şu — **bandı ailenin en uç
üyesi belirliyor**, kaçıncı sırada ölçüldüğü değil.

### (d) n=5'te LOO 4 eğitim noktası bırakıyor — **kararsızlık BULUNAMADI**

Öğrenme eğrisi (k eğitim noktasıyla eğit, **dışarıdaki** noktaları tahmin et;
metrik ortalama mutlak hata, maksimum değil — bu yüzden k'ye göre yapısal
olarak artmıyor):

| k (eğitim noktası) | ölçüm | ort. mutlak hata | medyan | en kötü |
|---|---|---|---|---|
| 3 | 28 | **%8,5** | %6,9 | %25,9 |
| 4 | 5 | **%8,8** | %9,5 | %19,8 |

Aile bazında: blackwell k=3 → %9,0, k=4 → %8,8.

**Üç noktayla dört nokta arasında ölçülebilir bir fark yok.** Model 3 noktada
"kararsız" değil; ama 4 noktada da belirgin biçimde daha iyi değil.

---

## Stratejik cevap: daha çok ölçüm toplamaya değer mi?

**Kısa cevap: evet, ama sandığımız sebepten değil.**

### Ölçmediğimiz şey: bandın kademeli daralması

Elimizdeki 15 ölçümle, bir aileye 3 yerine 4 nokta vermenin hatayı azalttığını
**gösteremiyoruz** (%8,5 → %8,8; fark yönü bile yanlış tarafta ve örneklem 5).
Bu "azaltmıyor" demek değil — **"15 ölçümle söyleyemeyiz"** demek. Dürüst
cevap bu.

### Ölçtüğümüz şey: model sınıfı değiştirmek

Asıl kazanç kademeli değil, **eşikte** ve ölçülmüş durumda:

| | bant |
|---|---|
| blackwell, aileler arası modelle | ±%30,7 |
| blackwell, kendi modeliyle | **±%19,8** |
| rdna_4, aileler arası modelle | ±%8,5 |
| rdna_4, kendi modeliyle | **±%6,4** |

Yani dört ölçümün değeri, o dördün getirdiği hassasiyet değil; ailenin
**aileler arası modelden kendi modeline geçmesi**. Bu bir eşik etkisi:
sıfırdan dörde giderken kazanılıyor, dörtten beşe giderken ölçülemiyor.

### Aile başına kaç ölçüm?

- **0 → 4: kanıtlanmış kazanç.** Ölçümsüz bir aile ±%30,7 taşıyor; eşiği
  geçen iki ailenin ikisi de belirgin biçimde daraldı.
- **4 → 5+: ölçülemedi.** Elimizdeki veri bu farkı göremiyor. Üstelik yayın
  tarafında ters etki var: bant maksimum olduğu için, n büyüdükçe
  **yayınlanan bant büyür** — tahminler iyileşse bile.
- **Öneri:** aile başına **dört** ölçüm hedeflensin, beşinci ancak o ailenin
  en uç üyesi ölçülmemişse eklensin. Bandı zaten uç nokta belirliyor; uç
  ölçülmeden eklenen ortadaki bir nokta bandı değiştirmiyor, yalnızca
  maksimum çekilişi çoğaltıyor.

### On iki ölçümün beklenen etkisi (K172 güncellemesi)

K172 "dört ölçüm × üç aile" için ±%16 civarı bir bant beklemişti. O sayı
**hâlâ geçerli ama artık nereden geldiği daha net**: eşiği geçen üç ailenin
dörtlü bantlarının ortalaması. Aralığın genişliği (±%6 … ±%26) bir belirsizlik
değil, **hangi dördü ölçtüğünüze bağlı gerçek bir fark**.

---

## Eşiğin doğru ifadesi (K156 düzeltmesi)

`MIN_FAMILY_FOR_OWN_BAND = 4` **üretim kuralıdır ve eğitim kümesi boyutunu
söyler**: bir ailenin kendi modelini kurup kendi bandını taşıyabilmesi için
elde dört ölçüm olmalı, model o dördün tamamıyla eğitilir.

**Değerlendirme ayrı bir iştir.** Birini-dışarıda-bırak, sırayla bir noktayı
eğitimden çıkarır; n=4 ailede eğitim 3'e düşer — `fit()`'in asgarisi. Bu
yüzden regresyon tablosunda `aile-modeli` satırı yalnızca n≥5 ailelerde
görünür.

İkisi çelişmiyor, **farklı sorulara cevap veriyorlar**:

- **Dört**: ürün bu aileye kendi bandını takabilir mi?
- **Beş**: o bandın ne kadar doğru olduğunu ölçebilir miyiz?

---

## Karar bekleyen: bant tahmincisi değişmeli mi?

**Sorun:** n ≤ 10'da bant = maksimum. Sonuçları:

1. Yayınlanan bant, örneklem büyüdükçe **kötüleşiyor gibi görünür** —
   tahminler aynı kalsa bile.
2. İki farklı n'deki bantlar karşılaştırılamaz (bu analizin sebebi).
3. Maksimumun güven aralığı üst uçta dejenere.

**Seçenekler:**

- **A. Bırak.** Maksimum, kullanıcıya verilen en muhafazakâr sözdür:
  "gördüğünüz en kötü sapma buydu". Yanlış değil, sadece adı yanlış — "%90
  dilim" demeyip "en kötü gözlenen" demek yeterdi.
- **B. Ara değerli p90.** `sorted` üzerinde doğrusal ara değer. Küçük n'de
  maksimuma yakın ama ona yapışmıyor ve n'ye göre monoton artmıyor.
- **C. Etiketleri değiştir, sayıyı bırak.** Arayüz "±%X" yerine "gözlenen en
  kötü sapma %X" desin.

**Bu bir karar ve proje sahibinin.** Değişiklik `engine/index-prediction.ts`
içindeki tek bir fonksiyona dokunur ama **yayınlanan her bandı** ve regresyon
temelini değiştirir. `lib/perf-margin.ts` / `lib/fps-margin.ts` etkilenmez —
onlar ayrı ölçümler ve dokunulmadı.

**Benim önerim: C, sonra B.** Önce dürüstlük ucuz: sayının adını doğru koymak
bugün yapılabilir ve hiçbir sayıyı değiştirmez. B ise ölçüm disiplinini
etkiler, regresyon temeli yenilenmeli ve gerekçesi ayrı bir karara yazılmalı.
