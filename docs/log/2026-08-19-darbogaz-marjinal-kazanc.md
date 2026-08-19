# 2026-08-19 — Darboğaz göstergesi ve kaynak oranının paydası

İki karar uygulandı: darboğaz göstergesi marjinal kazanç yöntemine çevrildi
(S35), K75'in %10 oranında payda tanımlandı (S36). Üçüncü bir soru (S15)
birincisiyle kendiliğinden kapandı.

---

## S35 — darboğaz göstergesi yeniden yazıldı

### Neden değişti

`perf_index` gerçek veriyle doldurulunca eski yöntem gözle görülür biçimde
yanlış sonuç vermeye başladı:

```
RTX 5090 (216) + Ryzen 7 9800X3D (144.4), 1440p
  eski: 216 - 144.4 = 71.6 > 15  ->  "İşlemci sınırlıyor"
```

Piyasanın en hızlı oyun işlemcisi "sınırlıyor" diye gösteriliyordu.

Sebep yapısal: K73'ten sonra iki indeks **farklı referanslara** normalize
(GPU'da RTX 4070 = 100, CPU'da Ryzen 5 9600X = 100) ve dinamik aralıkları
farklı — GPU tarafı 61–216, CPU tarafı 100–144. İki ayrı cetvelin sayılarını
çıkarmak anlamsızdı.

### Yeni yöntem

```
kazanç_gpu = max(0, en_iyi_gpu_idx - gpu_idx) * w_gpu
kazanç_cpu = max(0, en_iyi_cpu_idx - cpu_idx) * w_cpu

en_büyük == 0                               -> dengeli
|kazanç_gpu - kazanç_cpu| / en_büyük < 0.20 -> dengeli
aksi halde kazancı büyük olan taraf sınırlıyor
```

Soru artık ölçekten bağımsız: *"hangisini değiştirirsem daha çok kazanırım?"*

`BOTTLENECK_THRESHOLD = 15` kaldırıldı, yerine `BOTTLENECK_BALANCE_RATIO = 0.2`.

### İki yan sonuç, ikisi de bilinçli

**1. Darboğaz artık çözünürlüğe göre değişebilir.** Kazançlar ağırlıklarla
çarpılıyor. v0.1'de gösterge çözünürlükten etkilenmiyordu ve bu **S15'in
şikâyet ettiği şeydi** — aşağıya bak.

**2. Motor kataloğun en iyilerini girdi olarak alıyor.** `/engine` katalogu
tanımaz; `best_gpu_index` / `best_cpu_index` çağıran taraftan gelir.
Verilmezse `bottleneck` **null** döner ve arayüz satırı hiç göstermez —
"dengeli" demek bilinmeyeni uydurmak olurdu.

Arayüz kararın gerekçesini de yazıyor:
`Kataloğun en iyisine geçseniz: ekran kartı +116.3, işlemci +0 indeks.`

### Doğrulandı — gerçek tarayıcıda

```
Ryzen 7 9800X3D + RTX 5090, 1440p
  198.1 tahmini sistem indeksi — referans sistem 100
  Bant: 4K ultra (tahmini)
  Darboğaz: Dengeli — işlemci ve ekran kartı birbirine yakın güçte. (tahmini)
  Kataloğun en iyisine geçseniz: ekran kartı +0, işlemci +0 indeks.

Ryzen 7 9800X3D + RTX 4060, 1440p
  81.9 tahmini sistem indeksi — referans sistem 100
  Bant: 1440p yüksek ayar (tahmini)
  Darboğaz: Ekran kartı sınırlıyor — ... (tahmini)
  Kataloğun en iyisine geçseniz: ekran kartı +116.3, işlemci +0 indeks.
```

Test doğrudan şart koşuyor: *"kataloğun en iyi kartı + en iyi işlemcisi
'işlemci sınırlıyor' DEMEZ"*. 111 → **114 test**.

Ayrıca bir yazım hatası düzeltildi: indeks satırında sayı ile metin bitişik
yazılıyordu (`198.1tahmini`).

---

## S15 — üç oturumdur açık olan soru kendiliğinden kapandı

S15 (2026-08-18) şunu soruyordu: *"Aynı sistem 1080p'de ve 4K'da aynı darboğaz
uyarısını alıyor. Eşik çözünürlüğe göre değişsin mi? Örneğin 1080p'de 15,
1440p'de 25, 4K'da 40 puan."*

K83 eşiği tamamen kaldırdı ve çözünürlük ağırlıklarını doğrudan kazanç
hesabına soktu. 4K'da `w_cpu = 0.12` olduğu için işlemciyi yükseltmenin kazancı
orada zaten küçük çıkıyor — S15'in tarif ettiği durum artık hesabın içinde.
Ayrı bir eşik tablosuna gerek kalmadı.

S15 ayrıca `model_version`'ın v0.2 olmasını öngörmüştü; o da oldu (K82).

---

## S36 — %10 oranının paydası

K75 "bir sayfanın yayınladığı veri noktalarının en fazla %10'u" diyordu ama
"veri noktası"nı tanımlamıyordu. Faz 2'de aynı toplama, tanıma göre %17 ile
%100 arasında görünüyordu:

| Payda ne sayılırsa | CPU sayfasında alınan 42 satır |
|---|---|
| HTML satırı (187) | %22 |
| Ortalama bloğu (~90) | %47 |
| Kataloğumuzla eşleşen (~40) | ~%100 |
| **Bütün FPS değerleri (~240)** | **%17** |

**Karar:** payda = sayfanın makine tarafından okunabilir biçimde yayınladığı
**toplam FPS değeri sayısı** — kart/işlemci × oyun × çözünürlük × ayar
hücrelerinin tamamı. Kataloğumuzda karşılığı olup olmaması, persentil mi
ortalama mı olması fark etmez.

Bu tanım kaynağın emeğinin bütününü ölçüyor ve dışarıdan doğrulanabilir:
sayfayı açan herkes aynı sayıya varır. Diğer tanımlar bizim kataloğumuza bağlı,
yani kaynak açısından anlamsız.

**Geriye dönük kontrol:** Faz 2'de alınan 42 CPU satırı bu tanımla **%17** —
tavanın altında. Raporda %22 görünmesinin sebebi paydanın HTML satırı
sayılmasıydı; tanım netleşince toplama zaten uyumlu çıktı. Yeniden toplama
gerekmedi.

K75'in diğer iki maddesi değişmedi: kombinasyon başına en fazla 8 satır, tek
bir (oyun, çözünürlük, ayar) grubunun tamamı asla alınmaz.

---

## Ne doğrulandı

```
npm test                114 test, hepsi gecti
npm run sema:kontrol    73/73
npm run kural:kontrol   11 kural tetikleniyor, 3 UYARI (C5, W2, W5)
npm run indeks:sapma    ortalama %4.8, en buyuk %12.3, esik GECTI
npx tsc --noEmit        cikti yok
npm run lint            cikti yok
npm run build           Compiled successfully
```

Tarayıcı doğrulaması yukarıda; konsolda hata yok.

---

## Açık kalan sorular

- **Kapsam** — 14 GPU + 7 CPU indeksli, K76 hedefi 30 + 20. Sınır toplama
  değil kaynak: bir inceleme çağdaş 14 kartı ölçüyor, CPU per-oyun
  grafiklerinde 12 işlemci var ve 7'si katalogda.
- **Bantlar hâlâ geçici** (K73). 0–40 / 40–65 / 65–90 / 90–130 / 130+ sınırları
  referans sistemin 100'de durduğu varsayımıyla yerleştirildi; ölçülmüş
  sistemlere karşı doğrulanmadılar.
- **`lib/perf-margin.ts` `provisional: true`** — sapma tek bir aynayla ölçüldü.
  İkinci bağımsız kaynak bulunursa yeniden ölçülmeli.
