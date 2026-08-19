# 2026-08-20 — Elle fiyat girişi (Faz 1.1)

**22 parçada gerçek fiyat var** (17 GPU + 5 CPU), hepsi Newegg, USD,
`source='manual'`. Kart seçili sistem artık kaydedilebiliyor — 1.1'in
engelleyici maddesi kalktı.

**Hedef 60-80 parçaydı, 22'de kalındı.** Sebepleri bölüm 5'te, tahmin değil
sayıyla.

---

## 1. Kurulan yol

| | |
|---|---|
| Kaynak veri | `data/prices/newegg.csv` (git'te, satır başına bir sayfa) |
| İçe aktarma | `npm run fiyat:aktar` → `scripts/import-prices.mts` |
| Kural belgesi | `data/prices/README.md` |

İçe aktarıcı diğerleriyle aynı deseni izliyor: her satır önce `raw_imports`'a
ham hâliyle, sonra normalize. `price_snapshots` append-only olduğu için aynı
parça + aynı gün ikinci kez gelirse **atlanıyor**, üzerine yazılmıyor.

Fiyat CSV'de dolar (`479.00`), veritabanına kuruş (`47900`). Float hiç
kullanılmıyor: metin noktadan bölünüp iki tam sayı toplanıyor.

**`robots.txt` kontrolü yapıldı.** Amazon ve Newegg ürün sayfaları `*` için
serbest (Newegg'in `Disallow: /` satırları yalnızca `ChangeDetection`, `008`,
`Nutch` içindi). Best Buy `robots.txt` **0 bayt** dönüyor — izin
doğrulanamadığı için kullanılmadı. Newegg seçildi.

Newegg'in **arama ve kategori sayfaları CAPTCHA** veriyor; yalnızca `/p/...`
ürün sayfaları okunabiliyor. Adres bulma bu yüzden arama motoru üzerinden
yürüdü ve maliyetin büyük kısmı burada.

## 2. Fiyat nereden okunuyor

Sayfada onlarca fiyat var: sponsorlu ürünler, benzer ürünler, paketler. İlk
görülen `$` işaretini almak yanlış ürünün fiyatını yazar — nitekim ilk
denemede bir sponsorlu ürünün $289.99'u geldi.

Çıkarıcı `product-buy-box` çapasını kullanıyor: sayfanın "bu ürünü şu fiyata
al" kutusu. Aynı kutudan **satıcı** da okunuyor (bölüm 3).

---

## 3. Üç kural, üçü de bu turda gerçek satır eledi

### K90 — Çip satırının fiyatı

`gpu_specs` satırı üreticinin referans tasarımı; mağazada öyle bir ürün yok
(K86). Çipin fiyatı, o çipin **mağazanın kendi sattığı, stokta, en ucuz**
kartından okunuyor. `reference_part_id` sütununda hangi kart olduğu yazılı ve
içe aktarıcı bunu doğruluyor — kart katalogda yoksa ya da o çipin kartı
değilse satır reddediliyor. `confidence = medium`.

Örnek: `nvidia-rtx-5070` = $839.99, referans `gigabyte-rtx-5070-gaming-oc`.
Aynı çipin MSI GAMING TRIO OC'si $849.99 — daha pahalı olduğu için referans
olmadı.

### K91 — Pazaryeri fiyatına iki kat tavanı

Perakendecinin kendi sattığı ürünle pazaryeri satıcısının sattığı ürün aynı
sayfada görünüyor ama aynı şey değil.

**Bu turda yakalanan somut örnek:** MSI RTX 5070 VENTUS 2X OC'nin Newegg
sayfasında fiyat **$949.00**, satıcı "NothingButSavings". Aynı çipin mağaza
satışlı kartı $839.99. Pilotta bu satır alınmadı.

Tavan içe aktarıcıda uygulanıyor, belgede kalmıyor. İki pazaryeri satırı
tavanın altında kaldı ve alındı:

| Satır | Fiyat | Tavan | Sonuç |
|---|---|---|---|
| MSI RTX 5080 VENTUS 3X OC | $1829.90 | $3399.98 | alındı, `medium` |
| ASUS TUF RX 9070 XT OC | $1218.90 | $1579.98 | alındı, `medium` |

Mağaza referansı bulunamayan pazaryeri satırları **hiç yazılmadı** (bölüm 5).

### K92 — Farklı para birimleri toplanmaz

`summarizePrice` kuruşları para biriminden bağımsız topluyor ve son gördüğü
birimin sembolünü basıyordu. Gerçek fiyatlar USD, dev-seed fiyatlar TRY olduğu
için bu **canlı bir hataydı**: 47900 (USD sent) + 389900 (TRY kuruş) tek
sembolle gösterilirdi.

Artık toplam üretilmiyor ve hangi birimlerin karıştığı yazılıyor. Tarayıcıda
iki hâl de doğrulandı.

### K89 — Seed fiyat yazmaz

87 dev-seed TRY satırı (29 parça) silindi. Kalıcı taraf da kapatıldı:
`scripts/seed.mts` artık fiyat yazmıyor ve yazarsa duruyor (K71'deki
`perf_index` bekçisinin aynısı). `PRICES_MINOR` / `PRICE_DATES` kaldırıldı.

---

## 4. Sonuç

```
npm run fiyat:aktar
OZET: 19 yeni, 3 atlandi, 0 elendi (K91), 0 hata.
Gercek fiyati olan parca: 22
```

| Kategori | Parça | Fiyatlı | Eksik |
|---|---|---|---|
| GPU (çip + kart) | 118 | **17** | 101 |
| CPU | 42 | **5** | 37 |
| Anakart | 19 | 0 | 19 |
| RAM | 14 | 0 | 14 |
| Depolama | 6 | 0 | 6 |
| Kasa | 5 | 0 | 5 |
| PSU | 4 | 0 | 4 |

**GPU 17:** 11 kart (RTX 5070 ×2, 5070 Ti, 5080 ×4, 5090, RX 9070 XT ×3) +
6 çip (RTX 5070, 5070 Ti, 5080, 5090, RX 9070 XT, RX 9060 XT).

**CPU 5:** Ryzen 7 9800X3D, Ryzen 7 7800X3D, Ryzen 9 9950X3D,
Core Ultra 9 285K, Core i9-14900K.

### Doğrulandı — gerçek tarayıcıda

```
Core i9-14900K + MSI RTX 5080 GAMING TRIO OC (çip: RTX 5080)
Toplam fiyat: 2.299,98 USD tahmini      (499,99 + 1.799,99)
Son güncelleme: 20.08.2026
Sistemi kaydet -> /sistem/4dkdcw
```

Kart seçiliyken kaydedilen fiyat **kartın** fiyatı, çipin değil (K86). Test
kaydı silindi.

Farklı para birimi hâli de doğrulandı: TRY fiyatlı bir parça eklenince toplam
yerine "Seçilen parçaların fiyatları farklı para birimlerinde (USD, TRY).
Toplam hesaplanmıyor" çıkıyordu. O TRY satırları artık silindi.

---

## 5. Neden 22'de kalındı — atlananlar ve sebepleri

Hedef 60-80'di. İki engel çıktı, ikisi de tahmin değil ölçüm:

**a) Adres bulma pahalı.** Newegg'in arama ve kategori sayfaları CAPTCHA
veriyor. Her parçanın ürün sayfası arama motoruyla tek tek bulunmak zorunda
ve bir arama ortalama **2-3 kullanılabilir adres** döndürüyor. 60 parça için
~25 arama + ~25 çekim gerekiyordu.

**b) Pazaryeri satıcıları listelerin çoğunu kaplıyor.** K91'in mağaza
referansı olmadan tavan hesaplanamıyor ve satır eleniyor. Bu tur atlananlar:

| Parça | Fiyat | Satıcı | Neden atlandı |
|---|---|---|---|
| MSI RTX 5070 VENTUS 2X OC | $949.00 | NothingButSavings | Aynı çipin mağaza fiyatı $839.99 — pazaryeri, alınmadı |
| SAPPHIRE PULSE RX 9070 | $899.00 | GH ELECTRONICS | O çipin mağaza satışlı kartı yok; üstelik daha hızlı olan RX 9070 XT mağazada $789.99 |
| Seasonic FOCUS GX-750 | $275.75 | C.N.E Technology | Mağaza referansı yok, tavan hesaplanamıyor |
| Samsung 990 PRO 2TB | $388.95 | BioStar | aynı |
| WD_BLACK SN850X 2TB | $330.77 | roboshine | aynı |
| MSI MAG B650 TOMAHAWK WIFI | $387.90 | Quantum Drift | aynı |
| GIGABYTE AORUS RTX 5090 ICE | $4699.99 | Newegg | **Stokta yok** + katalogdaki `...-master` değil, `ICE` — farklı SKU |
| ASUS PRIME RTX 5070 12G | $819.99 | Newegg | Katalogdaki satır `...-oc`; bu liste OC değil, farklı SKU |
| MSI RTX 5070 Ti GAMING TRIO OC **PLUS** | $1399.00 | GH ELECTRONICS | Katalogda `...-gaming-trio-oc` var, PLUS ayrı SKU |
| SAPPHIRE PULSE RX 9060 XT | $519.99 | Newegg | Katalog satırı `...-oc`; liste başlığında OC yok, eşleşme belirsiz — **kart satırı** atlandı, aynı liste **çip** fiyatı olarak kullanıldı |
| Corsair RM750 | — | — | Sayfada buy-box fiyatı yok |

**Anakart, RAM, PSU, kasa ve depolamanın hiçbirinde fiyat yok.** Denenen
dört listenin dördü de pazaryeri satıcısıydı ve mağaza referansı olmadığı
için elendi.

---

## Açık kalan sorular

1. **Fiyatsız kategoriler 1.1'i tam bitirmiyor.** Kullanıcı baştan sona bir
   sistem toplayıp **toplam fiyat** görebilmeli; şu an yalnızca GPU + CPU
   fiyatlı. Anakart/RAM/PSU/kasa/depolama için mağaza satışlı liste bulmak
   ayrı bir tur gerektiriyor — belki başka bir perakendeci (Amazon `robots.txt`
   ürün sayfalarına izin veriyor ve denenmedi).
2. **Referans kart veritabanı satırında görünmüyor.** K90 gereği CSV'de ve
   `raw_imports`'ta duruyor, `product_url` kartın sayfasını gösteriyor; ama
   `price_snapshots`'ta ayrı bir sütun yok. Sütun eklemek şema değişikliği —
   istenirse ayrı bir karar.
3. **Fiyatlar bir günün fotoğrafı.** Hepsi 2026-08-20. `price_snapshots`
   append-only olduğu için ikinci bir tur geçmişi biriktirir; ne sıklıkla
   tekrarlanacağı kararlaşmadı.
