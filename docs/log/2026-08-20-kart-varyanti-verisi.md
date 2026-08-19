# 2026-08-20 — Kart varyantı verisi, ilk parti

**58 kart, 10 çip, 4 marka.** Hepsi üreticinin kendi spec sayfasından, satır
başına tek adres. Veri `data/parts/variants/` altında; **veritabanına
aktarılmadı** (varyant içe aktarıcısı henüz yok).

---

## 1. Ne toplandı

| Çip | Kart | Markalar |
|---|---|---|
| RTX 5090 | 6 | ASUS ×2, MSI ×2, GIGABYTE ×2 |
| RTX 5080 | 6 | ASUS ×2, MSI ×2, GIGABYTE ×2 |
| RTX 5070 Ti | 6 | ASUS ×2, MSI ×2, GIGABYTE ×2 |
| RTX 5070 | 6 | ASUS ×2, MSI ×2, GIGABYTE ×2 |
| RTX 5060 Ti 16GB | 6 | ASUS ×2, MSI ×2, GIGABYTE ×2 |
| RTX 4070 SUPER | 6 | ASUS ×2, MSI ×2, GIGABYTE ×2 |
| RTX 4060 | 6 | ASUS ×1, MSI ×2, GIGABYTE ×3 |
| RX 9070 XT | 6 | ASUS ×2, GIGABYTE ×2, SAPPHIRE ×2 |
| RX 9070 | 5 | ASUS ×2, GIGABYTE ×1, SAPPHIRE ×2 |
| RX 9060 XT | 5 | ASUS ×2, GIGABYTE ×1, SAPPHIRE ×2 |

Marka dağılımı: ASUS 19, GIGABYTE 19, MSI 14, SAPPHIRE 6.

Dosyalar:

```
data/parts/variants/gpu-variant-nvidia.csv   42 kart
data/parts/variants/gpu-variant-amd.csv      16 kart
data/parts/variants/README.md
```

**Neden alt klasör:** `npm run parca:aktar` `data/parts/*.csv`'yi okuyor ve dosya
adının ilk parçasını kategori sayıyor. `gpu-variant-*.csv` kök klasörde dursaydı
"kategori = gpu" diye okunup `gpu_specs`'e yazılmaya çalışılır ve 58 satır hata
verirdi. Alt klasör içe aktarıcı tarafından görülmüyor.

## 2. Hangi alan ne kadar doldu

| Alan | Dolu | Boş | Sebep |
|---|---|---|---|
| `length_mm` | **58** | 0 | K91 sayesinde (aşağıda) |
| `recommended_psu_watt` | 58 | 0 | Dört marka da yayınlıyor |
| `power_connectors` | 57 | 1 | ASUS ProArt RTX 5090 sayfasında yok |
| `boost_clock_mhz` | 52 | 6 | SAPPHIRE spec bloğunda saat yok |
| `boost_clock_oc_mhz` | 33 | 25 | GIGABYTE ve SAPPHIRE tek değer veriyor |
| `hdmi_count` / `displayport_count` | 52 | 6 | SAPPHIRE port dağılımı vermiyor |
| `thickness_slots` | 25 | 33 | Yalnızca ASUS ve SAPPHIRE slot cinsinden veriyor |
| **`tbp_watt`** | **20** | **38** | Yalnızca MSI ("Power consumption") ve SAPPHIRE ("Typical Board Power") |
| `usb_c_count` | 3 | 55 | Yalnızca ASUS ProArt kartlarında USB-C var |
| `height_mm` | 0 | 58 | K91 yalnızca uzunluğu çözüyor, kalan eksenler belirsiz |
| `fan_count` | 0 | 58 | Hiçbir üretici spec tablosunda vermiyor |
| `release_year` | 0 | 58 | Spec sayfalarında yok |

`tbp_watt` boş olan 38 kartta C4, çipin referans `tdp_watt`'ına geri düşecek ve
arayüz bunu söyleyecek — K87'nin tam olarak tasarlandığı durum.

## 3. Karar: K91 (onaylandı)

ASUS ve MSI ölçüyü **eksen etiketi olmadan** veriyor: `348 x 146 x 72 mm`.
K60 aynen uygulansaydı bu kartlarda `length_mm` boş kalırdı.

**Onaylanan kural:** en büyük değer uzunluktur, ondalık **yukarı** yuvarlanır
(357.6 → 358). Dayanak çıkarım değil fiziksel sınır: kartın en uzun ekseni PCIe
yuvasına paralel olmak zorunda. Yuvarlama yönü K59'la aynı mantık —
**belirsizlikte kuralı yanıltmayan yön** seçilir; açıklıkta aşağı, kart
uzunluğunda yukarı.

**Ölçülen etki:** strict K60 ile 58 kartın **24'ünde** uzunluk olurdu
(GIGABYTE `L=360 W=150 H=75`, SAPPHIRE `330.8(L) X 128.5(W)` etiketliyor).
K91 ile **58/58**.

Aynı ilkenin ikinci uygulaması: MSI bazı kartlarda `115 W or 120 W` yazıyor;
C4'ü yanıltmayan yön büyük olan, `tbp_watt = 120`. → `docs/KARARLAR.md` K91

## 4. Markalarda çıkan sorunlar

**PALIT — atlandı.** `robots.txt`'inde `Disallow: /en/` var; İngilizce ürün
sayfalarının tamamı kapalı. Yerine AMD tarafında SAPPHIRE kullanıldı.

**ZOTAC — atlandı.** `robots.txt` serbest (`Crawl-delay: 10`) ama ürün listesi
JS ile doluyor, `curl` boş dönüyor ve adres deseni tahmin edilemedi (8 aday
adresin hepsi liste sayfasına düştü). Yerine NVIDIA tarafında üç marka kaldı.

**MSI'da AMD kartı yok.** Ürün sitemap'inde 639 ekran kartı adresi var, 83'ü
Radeon, **RX 9000 serisi sıfır**. MSI bu nesilde AMD kartı yapmıyor. RX 9070 XT
/ 9070 / 9060 XT'de dördüncü marka olarak SAPPHIRE kullanıldı.

**MSI ve GIGABYTE paralel isteği engelliyor.** İkisi de Akamai arkasında.
`xargs -P 4` ile denenen 31 GIGABYTE adresinin **hepsi** 403 döndü; aynı
adresler tek tek istendiğinde 200 döndü. Sıralı + 2 sn aralıklı döngüye
geçildi. Bu iki sitede `robots.txt` bile tam tarayıcı başlık seti olmadan 403
veriyor — "yasak mı" sorusu ancak doğru başlıklarla sorulabiliyor.
`CLAUDE.md` araç notlarına yazıldı.

**SAPPHIRE'ın `robots.txt`'i yok** (adres 404 sayfasına gidiyor) — kısıt yok.

**ASUS ROG sayfaları farklı yapıda:** `/spec/` sayfasının `<title>`'ı SKU kodu
(`ROG-ASTRAL-RTX5080-O16G-GAMING`), pazarlama adı sayfa gövdesinde. Ayrıca
ASUS ve MSI'da etiketler önce liste olarak, sonra değerleriyle geçiyor;
"etiketten sonraki ilk satır" kuralı boş değer okuyor. Not `CLAUDE.md`'ye
yazıldı.

## 5. Ne doğrulandı

```
58 kart, 10 cip, tekrarli slug yok
uzunluk araligi 140-420 mm disinda satir: yok
tbp 50-700 W disinda: yok    psu 300-1600 W disinda: yok
boost 1000-4000 MHz disinda: yok
OC saati varsayilandan dusuk olan satir: yok
source_url'i https ile baslamayan satir: yok

capraz kontrol (kart TBP >= cipin referans TDP'si): 20 kartin hepsi tutarli
```

Çapraz kontrol `CLAUDE.md`'nin istediği türden: AIB kartı referanstan **az** güç
çekmez; bir satır bunu ihlal etseydi yanlış sütun okunmuş olurdu.

İki kart ayrıca elle, kaynak sayfaya bakılarak doğrulandı (onay turundaki örnek):
ASUS ROG Astral RTX 5090 OC ve GIGABYTE AORUS RTX 5090 MASTER.

## 6. Açık kalan

- **Veri veritabanında değil.** Varyant içe aktarıcısı yazılmadı; bu iş için
  `parca:aktar`'a `gpu_variant_specs` adaptörü gerekiyor. Bu turda kod
  yazılmadı, yalnızca veri toplandı.
- **Geliştirme veritabanındaki üç dev-seed kart duruyor**
  (`asus-rog-strix-rtx-5090-oc`, `zotac-rtx-5090-solid`,
  `nvidia-rtx-5090-founders`). Gerçek veri içeri alınınca silinmeli — ikisi
  aynı çipin kartı ve biri artık gerçek listede de var.
- **`fan_count` ve `height_mm` şemada duruyor ama hiç dolmuyor.** Dört
  üreticinin hiçbiri spec tablosunda vermiyor. Bir sonraki partiden sonra da
  boşsa alanların şemadan çıkarılması konuşulmalı.
- **Fiyat yok.** Kart satırlarının fiyatı ayrı bir iş; şu an yalnızca çip
  seviyesinde dev-seed fiyat var.
