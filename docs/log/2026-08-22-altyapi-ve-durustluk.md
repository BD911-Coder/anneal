# 2026-08-22 — Altyapı turu: makullük, regresyon, Prisma tuzağı, pano, dürüstlük sayfası

Beş iş, hepsi ayrı dalda, hepsi `main`'e alındı. Vekil indeks kapısı ayrı
raporda: `docs/log/2026-08-22-proxy-indeks-kapisi.md`.

## 1. Makullük denetimi (K174) — `npm run makul:kontrol`

RTX 5060 Ti hatası tek bir alana bakarak görünmüyordu; **iki alanın
birbiriyle çelişmesinden** çıktı. O desen tek script'te toplandı.

**1136 kontrol, 0 ihlal.** Kurulan kısıtlar: bant genişliği ↔ veri yolu ↔
bellek tipi · VRAM ↔ veri yolu ↔ yonga kapasitesi · TDP ↔ önerilen güç
kaynağı · marka ↔ shader birimi tipi · aile içi transistör/shader oranı ·
kart TBP ↔ çip TDP · kart saati ↔ çip saati · OC ↔ normal saat · çekirdek ↔
iş parçacığı · taban ↔ boost · çekirdek başına L3 · kit kapasitesi ↔ modül
sayısı · bellek hızı ↔ kuşak · azami bellek ↔ yuva · okuma hızı ↔ arayüz.

**İlk çalıştırma dört anakartı işaretledi ve dördü de doğru çıktı.** MSI Z890
gerçekten "DDR5-9200+(OC)" yazıyor. Eşik gevşetildi, veri değil. Ders:
üreticinin "azami desteklenen" alanı JEDEC değil OC rakamı taşıyor.

**Kurulamayan üç kısıt her çalıştırmada basılıyor:** dolgu hızı ↔ ROP
(sütun yok), çip alanı ↔ transistör yoğunluğu (`die_size` yok), güç
konnektörü ↔ TBP (serbest metin, S38).

`bant:kontrol` kaldırıldı, kuralı bu script'in içinde — eşikler iki yerde
yaşamasın.

## 2. Tahmin regresyon koşumu (K175) — `npm run tahmin:degerlendir`

Değerlendirme kümesi **dondurulmuş** (`data/eval/estimation-eval-set.json`):
ölçüm eklendikçe tablo kendiliğinden değişirse "model mi düzeldi, veri mi
değişti" sorusu cevapsız kalır.

Temel 34 satır. Bugünkü sayılar (p90, birini-dışarıda-bırak):

| | GPU | CPU |
|---|---|---|
| **motor** (kullanıcının gördüğü) | **27,3** | **8,4** |
| aileler arası | 30,7 | 8,4 |
| aile modeli | 19,8 | — |
| aile ortalaması | 93,8 | 20,4 |

Üç şey görünüyor: motor aileler arası modelden iyi (fark blackwell'den
geliyor), aile ortalaması çok kötü (model kurmanın değeri ölçüldü), ve
**`xe2` tek ölçümle %69,1 hata veriyor** — tablodaki en kötü satır.

**Yan bulgu:** LOO'da eşik fiilen beşe çıkıyor. Dört ölçümlü bir aile,
değerlendirilen nokta çıkarılınca üçe düşüyor ve kendi modelini kuramıyor.
Dört ölçüm gerçek kullanımda yeter, değerlendirmede yetmez.

`npm run kontrol:tumu` on iki adımı tek komutta çalıştırıyor; hiçbiri
diğerini durdurmuyor.

## 3. Prisma tuzağı yapısal olarak kapatıldı (K176)

Tuzak CLAUDE.md'de yazılıydı ve **üç kez** tetiklendi. Belgelenmiş ve yine de
üç kez tetiklenen bir tuzak, belge sorunu değildir.

**Ölçüt damga değil, şemanın kendisi:** üretilen istemci, üretildiği şemanın
tam metnini içinde taşıyor (`inlineSchema`). Damga dosyası unutulabilir; metin
yalan söyleyemez.

Ölçülerek bulunan ayrıntı: istemcinin içindeki metin `prisma format` geçmiş
hâli ve **780 satırın 43'ü** yalnızca hizalamadan farklı. Karşılaştırma satır
içi boşlukları normalleştiriyor.

Sınandı: şemaya alan eklenince kontrol **durdu**, geri alınınca **geçti**,
`--duzelt` ile **kendisi üretti**.

`pretest` / `prebuild` / `pretypecheck` → `--duzelt` (bayat istemciyle
çalışmak imkânsız). `kontrol:tumu` → düzeltmesiz (durumu görmesi gerekiyor).

**Kapsamadığı yer yazıldı:** ayakta duran `next dev` eski istemciyi bellekte
tutuyor; migration'dan sonra yeniden başlatılmalı.

## 4. `/veri` — iç veri kalitesi panosu (K177)

Beş script'e dağılmış bilgi tek ekranda: alan başına kapsam **ve kaynak
dağılımı**, aile başına ölçülen/tahmin/bant, makullük ihlalleri, dış kaynaklı
alanların listesi, spec'i tamamen dış kaynaktan gelen parça sayısı.

Tarayıcıda doğrulandı:

```
Katalog 332 parca · Olculmus indeks 27 · Dis kaynakli alan 58 ·
Spec'i tamamen dis kaynakli parca 0

gpu_specs.memory_bandwidth_gbs  60/60  wikipedia 30 · manufacturer 30
gpu_specs.transistor_count_m    51/60  wikipedia 28 · manufacturer 23
gpu_specs.length_mm             18/60  manufacturer 18      <- en ince alan

rdna_4     4 parca · 4 olculen · ±%6.4  kendi ailesi
blackwell  8 parca · 5 olculen · ±%19.8 kendi ailesi
ampere    12 parca · 0 olculen · ±%30.7 aileler arasi
```

Makullük kuralları `lib/plausibility.ts`'e taşındı: hem script hem pano
oradan okuyor, iki kopya iki farklı cevap demektir.

**Panonun boş bıraktığı bölüm boşluğunu kendisi anlatıyor:** "açık çekişmeli
değerler". Çelişkiler içe aktarma sırasında hesaplanıyor ve hiçbir tabloya
yazılmıyor; pano bu yüzden o soruyu cevaplayamıyor ve cevaplayamadığını
yazıyor.

## 5. Dürüstlük sayfası (K178) — `/hakkinda`

İngilizce kaynak, Türkçe çeviri, kendi ad alanı. Kapsam sayıları her istekte
veritabanından okunuyor; oyun sayısı ana sayfayla aynı fonksiyondan geliyor.

Tarayıcıda iki dilde doğrulandı:

```
en  "Today that is 15 graphics chips and 12 processors, out of 60 chips and
     42 processors... The measurements come from 381 published data points."
     "Game FPS: mean error 6.8%, 90th percentile 15.6%, worst single point 33.4%."
tr  "Bugun bu 15 ekran karti cipi ve 12 islemci — katalogdaki 60 cip ve 42
     islemcinin icinden."
```

"Bilmediklerimiz" bölümü altı madde; vekil skor maddesi **"sınanmadı,
çürütülmedi"** diyor (K173).

## Ne doğrulandı

```
npm run kontrol:tumu
  GECTI  prisma:kontrol · lint · tsc · test · sema:kontrol · dil:kontrol
  GECTI  tahmin:degerlendir · kural:kontrol · varyant:kontrol
  GECTI  kaynak:kontrol · makul:kontrol · build
  SONUC: 12 adim gecti.
```

`lib/perf-margin.ts`, `lib/fps-margin.ts` ve `benchmark_points` değişmedi.
K71 korunuyor: `perf_index`e tek satır yazılmadı.

## Açık kalan sorular

- **Çekişmeli değerler kalıcı değil.** Kaydetmek şema kararı; verilmedi.
- **Pano çeviri katmanında değil** (iç sayfa, tek okuyucu). Halka açılırsa
  bu karar değişmeli.
- **Dürüstlük sayfasının metni taslak.** Proje sahibi düzeltecek.
