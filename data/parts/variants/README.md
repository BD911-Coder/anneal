# Ekran kartı varyantı (AIB kartı) verisi

`gpu_variant_specs` satırlarının kaynak CSV'leri (K86). Her satır bir üreticinin
kendi ürün sayfasından gelir ve `source_url` o sayfanın adresidir.

**Neden alt klasörde:** `npm run parca:aktar` yalnızca `data/parts/` altındaki
`.csv` dosyalarını okur ve dosya adının ilk parçasını kategori sayar. Bu
dosyalar `gpu` kategorisine ait **değil** — `gpu_specs` değil
`gpu_variant_specs` besliyorlar. Alt klasörde durdukları için içe aktarıcı
onları görmez ve yanlış tabloya yazmaya çalışmaz. Varyant içe aktarıcısı
yazıldığında bu klasörü hedef alacak.

---

## Sütunlar

`SCHEMA.md` bölüm 2, `gpu_variant_specs` + olgusal iddia dörtlüsü (bölüm 1.3).
`source` her satırda `manufacturer`'dır ve CSV'de yazmaz.

`chip_part_id` **zorunludur**: kartın bağlandığı çipin slug'ı, `gpu_specs`
satırı olan bir parça olmak zorunda.

## Uygulanan kurallar

- **K91 — etiketsiz ölçü üçlüsü.** ASUS ve MSI ölçüyü `348 x 146 x 72 mm`
  biçiminde, hangi eksenin ne olduğunu söylemeden veriyor. En büyük değer
  `length_mm`'e yazılır, ondalık **yukarı** yuvarlanır (357.6 → 358). Kalan iki
  eksen (`height_mm`) boş bırakılır — hangisinin yükseklik olduğu belirsiz.
  GIGABYTE (`L=360 W=150 H=75`) ve SAPPHIRE (`330.8(L) X 128.5(W)`) eksenleri
  etiketliyor; onlarda L doğrudan okunur.
- **K60 — çıkarım yok.** Sayfada olmayan alan boş kalır. `fan_count`,
  `height_mm` ve `release_year` hiçbir üreticide kullanılabilir biçimde
  yayınlanmadığı için tamamen boş.
- **K62 — fiziksel ölçü zorunlu değil.** Boş `length_mm` C5'i atlatır, uydurma
  değer yazılmaz.
- **Normalizasyon uydurma değildir.** `power_connectors` üreticiye göre
  `16 pin*1` / `16-pin x 1` / `1 x 16-pin` yazılıyor; hepsi `1 x 16-pin`
  biçimine getirildi. Tip ve adet değişmedi. SAPPHIRE'ın `12V-2x6(H++)
  External Power Connector` ifadesinde adet yazmadığı için `12V-2x6` yazıldı,
  adet uydurulmadı.

## Hangi üretici neyi yayınlıyor

| Alan | ASUS | MSI | GIGABYTE | SAPPHIRE |
|---|---|---|---|---|
| Uzunluk | ✓ (etiketsiz) | ✓ (etiketsiz) | ✓ (L=) | ✓ (L) |
| Slot kalınlığı | ✓ | — | — | ✓ |
| **TBP** | — | ✓ | — | ✓ |
| Önerilen PSU | ✓ | ✓ | ✓ | ✓ |
| Boost (varsayılan + OC) | ✓ ✓ | ✓ ✓ | ✓ (tek) | — |
| Port dağılımı | ✓ | ✓ | ✓ | — |
| Fan sayısı | — | — | — | — |

`tbp_watt` yalnızca MSI ve SAPPHIRE'da var. Boş olan kartlarda C4, çipin
referans `tdp_watt`'ına geri düşer ve arayüz bunu söyler (K87).

## Kart eklerken

1. Üreticinin **spec sayfasını** aç (pazarlama sayfası değil).
2. `robots.txt`'i kontrol et. PALIT `/en/` altını yasaklıyor — o marka alınmaz.
3. Değerleri sayfadan olduğu gibi al; olmayanı boş bırak.
4. Slug bir kez atanır, asla değişmez.
