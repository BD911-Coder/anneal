# Performans tarafındaki eksikler — ölçüm, çözülebilirlik, öncelik

**Tarih:** 20 Ağustos 2026. Ölçüldü, uygulanmadı.

Fiyat beta kapısından çıktı (Faz E'ye taşındı). Yeni ölçüt: **10 kişi
sistemini seçip ne performans alacağını anlayabildi.** Bu belge o ölçüte
göre neyin eksik olduğunu sıralıyor.

Her madde için üç soru: **bugün çözülebilir mi · neye bağlı · ne kadar iş.**

---

## Bugünkü durum — ölçüldü

```
GPU        87/213 secilebilir kartta FPS var, 126'sinda YOK
CPU        12/42 indeksli
oyun       23 (1440p) + 8 (4K), 1080p SIFIR
olcum      346 nokta (GPU 232, CPU 114)
K75        232/2448 = %9,48  -> kaynakta KALAN YER 12 SATIR
1% low     0/346 toplandi
```

**En sert kısıt bu son satırlarda:** kullandığımız tek kaynakta K75 tavanına
**12 satır** kaldı. Yani aşağıdaki eksiklerin çoğu "daha çok toplayarak"
çözülemez — kaynak doldu.

---

## 1. 🔴 CPU oyun bazlı FPS'e hiç girmiyor

**Kullanıcı hangi işlemciyi seçerse seçsin aynı FPS sayısını görüyor.**
Ryzen 5 7500F ile Ryzen 7 9800X3D arasında liste hiç değişmiyor.

En yanıltıcı eksik bu, çünkü **sessiz**: sayı yanlış görünmüyor, sadece
işlemciyi umursamıyor. Kullanıcı "işlemci fark etmiyormuş" sonucunu çıkarır.

### Neden — yeniden ölçüldü (2026-08-20)

CPU ölçümlerinin oyunları ile GPU ölçümlerinin oyunları **sıfır kesişiyor**
ve bu kaynağın yöntemi:

| | Oyun | Ayar | GPU |
|---|---|---|---|
| GPU ölçümü | 23 oyun | 1440p/4K ultra | 14 farklı kart |
| CPU ölçümü | 9 oyun | 720p–1080p CPU-limit | hep RTX 5090 |

ComputerBase GPU ve CPU için **bilerek ayrı oyun paketi** kullanıyor: CPU
paketi işlemciyi ayırt eden (simülasyon, strateji) oyunlardan, GPU paketi
grafik olarak zorlayanlardan seçiliyor.

**Bu turda dört yol daha denendi, dördü de kapalı:**

| Yol | Sonuç |
|---|---|
| ComputerBase oyun başına benchmark makaleleri | **yalnızca GPU** — üç makale daha kontrol edildi (Halo, Hell Let Loose, AC Black Flag); hiçbirinde CPU bölümü yok |
| CPU paketinin 9 oyunu için eski GPU incelemesi | veri var ama **farklı sürücü dönemi** → K77 bunu yasaklıyor |
| Metin yayınlayan başka CPU kaynağı | K113: sekiz kaynak elendi, hepsinde sayı görselde |
| Tom's Hardware (CS2 dahil per-oyun CPU verisi) | K105: aynamız, kaynak yapılamaz |

### Çözülebilir mi?

**Ölçümle: hayır.** Bugün elimizdeki hiçbir veriyle CPU'yu oyun FPS'ine
dürüstçe sokamayız.

**Modelle: evet ama ölçülemez.** Fiziksel olarak doğru model
`FPS = min(GPU-sınırlı, CPU-sınırlı)`. GPU-sınırlı tarafı var; CPU-sınırlı
tarafı **başka oyunlar** için var. Aradaki eşlemeyi kurmak bir varsayım
gerektirir ve o varsayımın hata payı **ölçülemez** — projenin K71/K79'da
reddettiği şeyin ta kendisi.

### Bugün yapılabilecek olan: sayıyı değil, **çerçeveyi** düzeltmek

Sayıyı değiştirmeden yanıltıcılığı azaltan üç iş — üçü de **veri
gerektirmiyor**:

1. **Listeye işlemciyi göster.** Şu an not "işlemcinin sınırlamadığı bir test
   sisteminde ölçülmüştür" diyor ama kullanıcının kendi işlemcisinin nerede
   durduğunu söylemiyor. Elimizde CPU indeksi var: *"Seçtiğiniz işlemci
   referansın %X'i; CPU'ya yüklenen oyunlarda bu sayının altında
   kalabilirsiniz."* — **yarım gün.**
2. **CPU seçilmeden liste gösterilmesin ya da uyarı çıksın.** Bugün işlemci
   seçilmemişken bile tam liste geliyor; kullanıcı sayının işlemciden
   bağımsız olduğunu fark etmiyor. — **birkaç saat.**
3. **Darboğaz göstergesini listeye bağla.** Sistem indeksi zaten "işlemci
   sınırlıyor" diyebiliyor (K83); o uyarı listenin başında da görünsün. —
   **birkaç saat.**

**Gerçek çözüm** aynı oyunda hem CPU hem GPU ölçümü, ve o **kullanıcı
katkısına** bağlı (Faz F, K106). Bu maddenin ROADMAP'te öne çekilmesinin
ikinci gerekçesi bu.

---

## 2. 🔴 126/213 ekran kartında hiç veri yok

87 kartta FPS var, **126'sında yok**. Arayüz dürüstçe söylüyor ama
kullanıcının kartı bu 126'nın içindeyse site ona **hiçbir şey** söylemiyor.

### Neden

`perf_index` yalnızca `benchmark_points`'tan hesaplanıyor (K71) ve
ölçümümüz **14 çipte** var. Kalan 46 çip ve onların kartları indekssiz.

S37 ölçümü (K93) iki tur arasında köprü kurulamayacağını gösterdi: dağılım
%12,4, eşik %5. Yani eski incelemelerden kart eklemek ölçeği bozar.

### Çözülebilir mi?

**Kısmen, ve pahalı.** Üç yol:

| Yol | Bağlı olduğu şey | İş |
|---|---|---|
| Aynı dönemde ikinci bir GPU incelemesi bulmak | ComputerBase'in aynı sürücü döneminde başka bir çok-kartlı incelemesi olması | **ölçülmedi** — bu turda bakılmadı, bakılmalı |
| Yeni kaynak | K113: yok | — |
| Kullanıcı katkısı | Faz F | büyük |

**Not:** K75 tavanı burada da bağlayıcı — mevcut incelemeden 12 satır kaldı.
Yeni kart eklemek **yeni bir inceleme** gerektiriyor, yeni bir sayfa = yeni
payda.

**Öncelik:** madde 1'den sonra gelir, çünkü kapsam dışı kullanıcı en azından
**yanıltılmıyor** — hiçbir şey görmüyor. Madde 1'de yanlış bir izlenim
veriliyor; burada yalnızca boşluk var.

---

## 3. 🟡 1080p ekseni boş, 4K yalnızca 8 oyunda

```
1440p  23 oyun
4K      8 oyun
1080p   0
```

1080p hâlâ en yaygın oyun çözünürlüğü ve sitede hiç yok.

### Çözülebilir mi?

**Hayır — kaynak 1080p yayınlamıyor.** ComputerBase GPU incelemesi üç
çözünürlük veriyor: 2560×1440, 3440×1440 (UWQHD), 3840×2160. **1080p
paketinde yok** çünkü modern kartlar 1080p'de CPU-sınırlı oluyor.

4K'yı 8'den 23 oyuna çıkarmak **teknik olarak mümkün ama yer yok**: 15 oyun
× 6 kart = 90 satır gerekir, K75'te **12 satır** kaldı.

UWQHD (3440×1440) hiç alınmadı ve alınabilir — ama o da aynı 12 satırlık
yere sığmak zorunda ve 1080p'den daha az kullanıcıyı ilgilendiriyor.

**Bağlı olduğu şey:** ikinci bir kaynak (K113 ile kapalı) ya da aynı
sürücü döneminde ikinci bir ComputerBase incelemesi.

---

## 4. 🟡 Oyunlar tanıdık değil

23 oyunluk pakette Steam'in en çok oynanan ilk 100'ünden **4 oyun** var
(ARC Raiders, Battlefield 6, Cyberpunk 2077, KCD2). CPU paketinin 9
oyunundan 1.

### Çözülebilir mi?

**Hayır, ve sebebi yapısal (K106).** İnceleme siteleri paketlerini *grafik
olarak zorlayan yeni çıkışlara* göre seçer; Steam'in en çok oynananları
eski, rekabetçi ve düşük gereksinimli başlıklarla doludur. İki liste farklı
şeyleri optimize ediyor.

Rekabetçi oyunlar (CS2, Valorant, Dota 2…) K105 ile kapandı: kaynak yok.

**Tek çıkış kullanıcı katkısı** — Faz F.

**Ama bir ara adım var ve ucuz:** listede **hangi oyunların olduğunu**
kullanıcıya baştan söylemek. Bugün kullanıcı kartını seçtikten sonra
tanımadığı 23 oyunla karşılaşıyor. Karşılama metninde "şu 23 oyunda ölçüm
var" demek beklentiyi doğru kurar. — **birkaç saat.**

---

## 5. Kullanıcı açısından: "bu site bana ne söylüyor?"

Yukarıdakiler veri eksikleri. Bunlar **sunum** eksikleri ve çoğu ucuz.

### 5a. 🔴 30/42 işlemcide hiçbir sayı yok

CPU'ların yalnızca **12'si** indeksli. Kalan 30'unda sistem indeksi
hesaplanamıyor ve kullanıcı *"Performans tahmini için henüz yeterli veri
yok"* görüyor — **ama oyun FPS listesi yine de geliyor** (o yalnızca GPU'ya
bakıyor).

Yani aynı ekranda: "performans tahmini yok" **ve** dolu bir FPS listesi.
Kullanıcı açısından çelişkili.

**Çözülebilir mi:** evet, sunum işi. İkisinin farklı sorular olduğunu
söylemek yeterli. — **birkaç saat.** (S41'in bir başka yüzü.)

### 5b. 🟡 "Bu FPS iyi mi?" sorusunun cevabı yok

Sistem indeksinin bandı var ("1440p ultra / 4K yüksek"). **Oyun FPS
listesinin karşılığı yok.** 47 FPS iyi mi? 144 Hz ekranı olan için hayır,
60 Hz için sınırda.

**Çözülebilir mi:** evet, ve veri gerektirmiyor — eşik etiketleri
(`<30 zor`, `30-60 oynanır`, `60-120 akıcı`, `>120 yüksek tazeleme`).
Eşikler **karar** gerektirir, ölçüm değil. — **yarım gün.**

### 5c. 🟡 Ayar değiştirme yok: yalnızca "ultra + upscaling açık"

Zayıf bir kartta Cyberpunk 47 FPS görüldüğünde doğal soru **"peki orta
ayarda?"**. Cevap veremiyoruz — kaynak yalnızca ultra yayınlıyor.

Bu, kapsam dışı 126 kart kadar önemli: kapsanan kart bile kullanıcının asıl
sorusuna cevap vermiyor.

**Çözülebilir mi:** hayır, kaynağa bağlı. Aynı sınıf: kullanıcı katkısı.

### 5d. 🟡 Raytracing verisi elimizde ama kullanılmıyor

Ölçüldü: 1440p'de **13 oyunun hem raster hem RT grafiği var**; biz yalnızca
raster aldık. RT verisi kullanıcıya "RT açarsam ne olur" sorusunu
cevaplatırdı.

**Çözülebilir mi:** teknik olarak evet — şema `render_mode` ile hazır (K111).
**Ama yer yok:** 13 oyun × 6 kart = 78 satır gerekir, K75'te 12 satır kaldı.
En fazla **2 oyunda** RT eklenebilir, ki bu da tutarsız bir deneyim olur.

### 5e. 🟢 1% low / takılma hiç toplanmadı

`one_percent_low_fps` sütunu şemada var, **0/346 satırda dolu**. Ortalama FPS
takılmayı göstermez; 8 GB kartlarda asıl şikâyet takılmadır.

Kaynak yayınlıyor (ComputerBase "FPS, 1% Perzentil" grubu — çıkarıcı zaten
görüyor, almıyoruz). **Ama yine K75:** 1% low almak satır sayısını ikiye
katlar, yer yok.

### 5f. 🟢 Sistem indeksi ile oyun listesi çelişebilir

S41'de kayıtlı, arayüz not düşüyor. Madde 1 çözülmeden kalıcı.

---

## Öncelik sırası

| # | Eksik | Bugün çözülür mü | Neye bağlı | İş |
|---|---|---|---|---|
| **1** | **CPU'nun FPS'e girmesi — çerçeve düzeltmesi** *(1.1–1.3)* | ✅ **evet** | veri gerekmiyor | **~1 gün** |
| **2** | "Bu FPS iyi mi" eşik etiketleri *(5b)* | ✅ evet | eşiklerin kararı | yarım gün |
| **3** | 30/42 CPU'da çelişkili ekran *(5a)* | ✅ evet | veri gerekmiyor | birkaç saat |
| **4** | Kapsanan oyunları baştan söylemek *(4 ara adım)* | ✅ evet | veri gerekmiyor | birkaç saat |
| 5 | Aynı dönemde ikinci GPU incelemesi var mı | ❓ **ölçülmedi** | ComputerBase'in yayın takvimi | 1 tur araştırma |
| 6 | CPU'nun FPS'e gerçekten girmesi | ❌ hayır | aynı oyunda CPU+GPU ölçümü → kullanıcı katkısı | Faz F |
| 7 | 126 GPU'da veri | ❌ hayır | yeni kaynak (K113 kapalı) / kullanıcı katkısı | Faz F |
| 8 | 1080p ekseni | ❌ hayır | kaynak 1080p yayınlamıyor | — |
| 9 | Ayar değiştirme *(5c)*, RT *(5d)*, 1% low *(5e)* | ❌ hayır | **K75 tavanı: 12 satır kaldı** | — |
| 10 | Tanıdık oyunlar | ❌ hayır | K106: yapısal | Faz F |

### Okunması gereken iki satır

**İlk dördü veri gerektirmiyor ve toplamı ~2 gün.** Dördü de "elimizdeki
sayıyı daha dürüst sun" işi — yeni ölçüte (*"ne performans alacağını
anlayabildi"*) doğrudan hizmet ediyorlar.

**5'ten sonrası ya kaynak ya tavan engelli.** K75'te 12 satır kalması, bu
kaynağın bitmiş olduğu anlamına geliyor: RT, 1% low, 4K genişletme, UWQHD —
hepsi teknik olarak hazır ve hiçbiri sığmıyor.

---

## Açık kalan soru

**Aynı sürücü döneminde ikinci bir ComputerBase GPU incelemesi var mı?**
(tabloda 5. sıra) Bu turda bakılmadı. Varsa madde 2, 3 ve 9'un bir kısmını
aynı anda açar — yeni payda, yeni tavan demektir. K77 sürücü döneminin
doğrulanmasını şart koşuyor ve oyun makalelerinin test sistemi sayfaları
içerik duvarının arkasındaydı; GPU incelemelerinde durum farklı olabilir.
