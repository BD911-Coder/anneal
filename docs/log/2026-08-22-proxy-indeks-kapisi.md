# 2026-08-22 — Vekil indeks kapısı: kaynak kapalı, kapı değerlendirilemedi

## Ne sorulacaktı

Ölçümü olmayan üç ailenin (`ampere`, `rdna_2`, `alchemist`) çapalanabilmesi
için: **kamuya açık bir sentetik skor, bizim ölçülmüş indeksimizin vekili
olabilir mi?**

Plan: 15 ölçümlü kartın OpenBenchmarking skorlarını topla, ölçülmüş indekse
karşı regresyon kur, R² ve kalıntı yayılımını ölç, uyumun markalar ve
mimariler arasında tutup tutmadığına bak. Kapı: aile içi kalıntı yayılımı
≥ %30,7 ise vekil bir şey katmıyor.

## Ne oldu: tek satır veri alınmadı

```
https://openbenchmarking.org/robots.txt

User-agent: ClaudeBot
Disallow: /
```

Site, bu ajanı **adıyla ve tam yolla** yasaklıyor. Projenin kalıcı
kurallarından biri burada tek başına belirleyici:

> `robots.txt` yasaklıyorsa o kaynak kapalı. **Araç değiştirmek durumu
> değiştirmez.**

Tarayıcı `User-Agent`'ı takmak yasağı kaldırmaz, yalnızca gizler. Yapılmadı.

Ek gözlem: düz istek **403** dönüyor (Cloudflare). K113'te kaydedilen 403 buydu
— o gün "biçim sorunu" sanılmıştı, asıl sebep erişim politikası.

## Kapı GEÇİLEMEDİ değil, DEĞERLENDİRİLEMEDİ

Bu ayrım kaydedilmeye değer:

- **Değerlendirilemedi:** ölçüt hiç uygulanmadı, çünkü uygulanacak veri yok.
- **Geçilemedi** olsaydı: veri gelirdi, regresyon kurulurdu, kalıntı yayılımı
  %30,7'yi aşardı ve vekil fikri **çürütülmüş** olurdu.

Vekil fikri bugün **sınanmamış** durumda. Bir sonraki tur bunu "denendi,
olmadı" diye kapatmasın.

## Görev 2 atlandı

Vekil çapalama (`method='proxy-anchored'` satırları, ek öngörücü, yeni bantlar)
tamamen bu skorlara bağlıydı. Ön koşul yok, iş yok. `perf_index_estimated`
şemasına dokunulmadı, `perf_index`e tek satır yazılmadı.

## Premis düzeltmesi

Görev tanımı OpenBenchmarking'i *"sonuçlar herkese açık karşılaştırma için
gönderilmiş, açık platform"* diye tanımlıyordu. **Veri kamuya açık olabilir;
otomatik erişim açık değil.** İkisi ayrı sorular ve ikincisinin cevabı bugün
hayır.

Diğer iki aday zaten kapalıydı: **Geekbench Browser** (resmî API yok, kazıma
politikası belirsiz — yalnızca elle çapraz kontrol) ve **kaynağı
doğrulanamayan derlemeler** (Kaggle vb.). Yani bu tur vekil skoru için **açık
hiçbir otomatik kaynak kalmadı.**

## Yeniden açılma koşulu — üçü de proje sahibinin elinde

1. **Elle toplama.** `robots.txt` insana değil otomatik ajana bakıyor. 15
   kartın skoru bir CSV'ye yazılırsa regresyon tarafı bir günlük iş:
   `npm run indeks:tahmin-sapma` deseni hazır.
2. **Phoronix Test Suite.** Araç sonuçları programatik indiriyor; kendi
   makinende çalıştırırsan veri kendi elinden gelir.
3. **Politika değişirse.** `ClaudeBot` satırı kalkarsa yol açılır.

## Ne doğrulandı

```
curl robots.txt          200 — ClaudeBot: Disallow: /
curl https://openbenchmarking.org/   403
```

Kod değişmedi; bu tur yalnızca karar ve kayıt üretti.
→ `docs/KARARLAR.md` K173
