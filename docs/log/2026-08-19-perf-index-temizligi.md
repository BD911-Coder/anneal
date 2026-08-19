# 2026-08-19 — S29: `perf_index` temizliği ve kalıcı kural

## Ne yapıldı

Elle konmuş 7 `perf_index` satırı silindi, seed script'i bu tabloya yazmayı
bıraktı ve yazamaz hale geldi, arayüz "veri yok" halini düzgün karşılıyor.

`perf_index`'e `source` sütunu **eklenmedi**. K32 geçerli: tablo dış dünya
hakkında iddia taşımıyor.

---

## Hangi kararlar verildi ve neden

### K71 — `perf_index` satırları yalnızca hesaplanarak üretilir

Kalıcı kural: `perf_index` satırları **yalnızca `benchmark_points` verisinden
hesaplanarak** yazılır. Elle, seed ile ya da CSV ile satır girilmez.

**Neden damgalama değil silme:** Fiyatta işe yarayan çözüm (dev-seed damgası +
canlıda otomatik filtre, K64/K67) burada uygulanamıyordu. Ölçüm bunu göstermişti:

```
CANLI (IS_LIVE=true)   gorunur fiyat: 0   gorunur perf indeksi: 7
```

Fiyat filtreleniyor, indeks filtrelenemiyordu — çünkü filtre parçanın damgasına
bakıyor ve parçalar gerçekti. Damgalanamayan sahte satırın tek çaresi hiç
olmaması.

### Silme öncesi durum

```
benchmark_points | perf_index | builds
0                | 7          | 0
```

`benchmark_points` = 0, yani 7 satırın hiçbiri hesaplanmış değildi; hepsi
`scripts/seed-prices.ts`'te elle yazılmış sıralamaydı.

```
delete from perf_index  ->  7 satir
perf_index: 0, benchmark_points: 0
```

---

## Ne doğrulandı

### Seed artık yazmıyor ve yazamıyor

`PERF_INDEXES` ve `PERF_COMPUTED_AT` sabitleri `scripts/seed-prices.ts`'ten
kaldırıldı. `scripts/seed.mts` başta ve sonda satır sayısını okuyup
karşılaştırıyor; sayı değiştiyse hata verip çıkıyor.

```
$ npm run db:seed
...
Fiyat: 87 snapshot (51 yeni), 29 parçada fiyat var.
Performans indeksi: seed yazmadı, tabloda 0 satır var (K71).
```

Seed çalıştırıldığı için dev-seed parçaları yeniden oluştu; `npm run
seed:temizle` ile geri alındı (17 parça, 51 fiyat silindi).

### Arayüz — gerçek tarayıcıda, `npm run dev` ile

Eksik indeksin iki sebebi var ve kullanıcıya farklı şey söylerler. Ayrım
yapıldı:

**Ryzen 7 7800X3D + RTX 5090 seçili** (ikisi de seçili, ölçüm yok):

```
Performans tahmini için henüz yeterli veri yok.

Seçtiğiniz parçalar geçerli — uyumluluk kontrolü çalışıyor ve fiyat
toplanıyor. Eksik olan ölçüm verisi: performans indeksi gerçek karşılaştırma
sonuçlarından hesaplanıyor ve o veri henüz toplanmadı. Uydurma bir sayı
göstermektense hiç göstermiyoruz.

[Yükseltme önerisi]
Yükseltme önerisi de performans verisine dayanıyor. Ölçüm toplanana kadar
"bu para neyi ne kadar artırır" sorusuna dürüst bir cevap veremiyoruz.
```

**Yalnız Ryzen 7 7800X3D seçili** (eski mesaj, hâlâ doğru):

```
Tahmin için hem işlemci hem ekran kartı gerekiyor.
  Ekran kartı seçilmedi.
  İşlemci için performans verisi yok.
```

**Kaydedilmiş sistem sayfası** (`/sistem/zcuvf3`, test için kaydedildi ve
sonra silindi):

```
109.998,00 ₺
Toplam fiyat — 19.08.2026 tarihinde donduruldu

Performans tahmini için yeterli veri yok.

Bu sistem 1440p seçiliyken kaydedildi. İndeks ekran kartı ve işlemcinin
ikisini birden gerektiriyor ve her ikisinin de ölçüm verisinin bulunmasını
şart koşuyor; kaydedildiği anda bu koşul sağlanmıyordu. Sistem geçerli,
fiyatı dondu; sadece hızı hakkında bir sayı üretilemedi.
```

Fiyat çalışıyor, uyumluluk çalışıyor, sayfa çökmüyor, boş sayı yok.
`read_console_messages` her iki sayfada da **hata döndürmedi**.

Ayrıca iki eskimiş metin düzeltildi: ana sayfa başlığı ("performans tahmini
örnek veridir" artık doğru değil) ve kaydetme notu ("Ekran kartı seçilmemişse"
tek sebep sayıyordu).

### Veritabanı son durumu

```
parts | devseed | perf | prices | builds
150   | 0       | 0    | 36     | 0
```

36 fiyat satırı dev-seed olarak duruyor — K64 bilinçli kararı, canlıda
filtreleniyor ve ölçüldü.

### Kontroller

```
npm run seed:filtre-kontrol  gelistirmede 12 dev-seed fiyat, canlida 0
                             perf indeksi iki ortamda da 0
npm run kural:kontrol        11 kural tetikleniyor, 3 UYARI (C5, W2, W5)
npm test                     110 test, hepsi gecti
npm run sema:kontrol         73 kontrolun tamami gecti
npx tsc --noEmit             cikti yok
npm run lint                 cikti yok
npm run build                Compiled successfully
```

---

## Belgelere yazılanlar

- `docs/KARARLAR.md` **K71** — kalıcı kural, gerekçesi ve ölçümüyle.
- `CLAUDE.md` **veri kuralları** — `perf_index` maddesi eklendi.
- `CLAUDE.md` **araç notları** — `/data` içe aktarma yolları (takma ad yerine
  göreli yol + `.ts` uzantısı, sebebiyle).
- `SORULAR.md` — S29 kapandı.

---

## Açık kalan sorular

1. **Ölçüm verisi nereden gelecek?** `benchmark_points` boş ve doldurulana
   kadar performans ekranı "veri yok" diyecek. Beta bitiş ölçütü "10 kişi
   yardım almadan sistem toplayabildi" — performans tahmini olmadan bu ölçüt
   karşılanır mı, yoksa ölçüm toplama beta kapsamına mı giriyor?

2. **Sahte fiyatlar hâlâ duruyor** (36 satır, K64). Canlıda filtreleniyor ve
   bu ölçüldü, ama perf_index'te seçilen yol "sil" oldu. Fiyat için de aynı
   yola geçilecek mi, yoksa gerçek fiyat kaynağı kurulana kadar duracak mı?

3. **Üç kural hâlâ eşiğin altında:** C5 (2), W2 (2), W5 (1).
