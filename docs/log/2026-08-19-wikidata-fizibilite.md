# 2026-08-19 — Wikidata SPARQL fizibilite raporu

Soru: GPU ve CPU teknik verisi Wikidata'dan çekilebilir mi?

**Kısa cevap: hayır, birincil kaynak olarak kullanılamaz.** Şemamızın ihtiyaç
duyduğu alanların çoğu Wikidata'da ya hiç yok ya da modern parçalarda boş.
Kod yazılmadı, veritabanına dokunulmadı — bu sadece ölçüm.

Bütün sayılar 2026-08-19'da `query.wikidata.org` üzerinde canlı sorgularla
alındı.

---

## 1. Örnek sorgu ve çıktısı

Gerçek bir içe aktarmanın kullanacağı sorgu bu olurdu. CPU tarafı seçildi
çünkü iki taraftan güçlü olanı o.

```sparql
SELECT ?itemLabel ?nativeAd ?soketLabel ?cekirdek ?thread ?tdp ?base ?boost ?tarih WHERE {
  ?item wdt:P31   wd:Q122967152 ;    # instance of: CPU model
        wdt:P1041 ?soket ;           # socket supported
        wdt:P1141 ?cekirdek ;        # number of processor cores
        wdt:P2229 ?tdp .             # thermal design power
  OPTIONAL { ?item wdt:P7443 ?thread }
  OPTIONAL { ?item wdt:P1705 ?nativeAd }
  # base ve boost aynı özellikte (P2149) duruyor, nitelikle ayrılıyor:
  OPTIONAL { ?item p:P2149 [ psv:P2149 [ wikibase:quantityAmount ?base  ] ; pq:P459 wd:Q73207925 ] }
  OPTIONAL { ?item p:P2149 [ psv:P2149 [ wikibase:quantityAmount ?boost ] ; pq:P459 wd:Q73208059 ] }
  OPTIONAL { ?item wdt:P577 ?d . BIND(SUBSTR(STR(?d),1,10) AS ?tarih) }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
ORDER BY DESC(?tarih) ?itemLabel
```

**Sonuç: 42 satır.** Dünyadaki bütün işlemciler içinden, soket + çekirdek +
TDP üçünü birden taşıyan kayıt sayısı bu. İlk satırlar:

```
ad                            soket         cek thr tdp base boost tarih
Q136373684                    Socket AM5    12  24  120 4.4  5.5   2025-03-12
Ryzen 9 9950X3D               Socket AM5    16  32  170 4.3  5.7   2025-03-12
Intel Core Ultra 9 285K       LGA 1851      24  24  250 -    -     2024-10-24
Ryzen 9 9900X                 Socket AM5    12  24  120 4.4  5.6   2024-08-15
Ryzen 9 9950X                 Socket AM5    16  32  170 4.3  5.7   2024-08-15
AMD Ryzen 7 7800X3D           Socket AM5    8   16  120 4.2  5     2023-04-06
AMD Ryzen 9 7950X3D           Socket AM5    16  32  120 4.2  5.7   2023-02-28
Intel Core i9-9900K           LGA 1151      8   16  95  3.6  5     2018-10-01
...
Intel Core i7-3770            LGA 1151      4   8   77  -    -     -
Intel Core i7-8700K           LGA 1151      6   12  65  3200000000 4600000000 -
Intel Xeon Phi 7295           LGA 3647      72  -   320 -    -     -
```

Bu on üç satır bile üç ayrı sorunu gösteriyor — aşağıda.

---

## 2. Alan alan karşılık: `gpu_specs`

Ölçüm evreni: `P31 = graphics card model` (Q122760264) olan **153 kayıt**.

| SCHEMA.md alanı | Wikidata karşılığı | Kapsam | Değerlendirme |
|---|---|---|---|
| `part_id` | — | — | Slug bizim, Wikidata'dan gelmez |
| `chipset` | **yok** | 0 | En yakını `P179 part of the series` (89) — "GeForce 50 series", yonga adı değil |
| `vram_gb` | **üç rakip özellik** | ~0 | Aşağıda |
| `vram_type` | `P12323 RAM type` | 34/153 (%22) | GDDR5/6/5X/6X. **GDDR7 hiç yok** |
| `tdp_watt` | `P2229 thermal design power` | 29/153 (%19) | Birim karışık (aşağıda) |
| `length_mm` | `P2043 length` | **6/153 (%4)** | 5'i mm, 1'i cm |
| `recommended_psu_watt` | **özellik yok** | 0 | Wikidata'da böyle bir özellik tanımlı değil |
| `pcie_version` | `P8107 bus` | 3/153 (%2) | Değer sadece "PCI Express" — sürüm ve hat sayısı yok |

**`vram_gb` neden kullanılamaz:** Üç ayrı özellik aynı işi yapmaya çalışıyor ve
hiçbiri modern kartlarda dolu değil.

| Özellik | GPU modellerinde | Örnek değerler |
|---|---|---|
| `P2928 storage capacity` | 26 | — |
| `P13525 RAM capacity` | 6 | 2 megabyte, 64 kilobyte, 512 kilobyte (retro cihazlar) |
| `P13788 VRAM capacity` | 3 | 128 kibibyte, 4 gibibyte, 6 mebibyte |

Yani "VRAM kaç GB" sorusunun tek ve güvenilir bir cevabı yok.

**Kesişim ölçüldü:** TDP **ve** uzunluğu birlikte olan kart sayısı **6**.
TDP **ve** VRAM tipi birlikte olan **4**.

Sekiz alandan ikisi kısmen doluyor, biri %4, üçü hiç yok.

---

## 3. Alan alan karşılık: `cpu_specs`

Ölçüm evreni: `P31 = CPU model` (Q122967152) olan **284 kayıt**.

| SCHEMA.md alanı | Wikidata karşılığı | Kapsam | Değerlendirme |
|---|---|---|---|
| `part_id` | — | — | Slug bizim |
| `socket` | `P1041 socket supported` | 90/284 (%32) | Değer "Socket AM5" — metin normalize edilmeli |
| `cores` | `P1141 number of processor cores` | 124/284 (%44) | En iyi kapsanan alan |
| `threads` | `P7443 number of processor threads` | 80/284 (%28) | |
| `base_clock_mhz` | `P2149` + nitelik `P459 = Q73207925` | 69/284 (%24) | Nitelikle ayrılıyor, iyi tasarım |
| `boost_clock_mhz` | `P2149` + nitelik `P459 = Q73208059` | (aynı) | |
| `tdp_watt` | `P2229 thermal design power` | 67/284 (%24) | |
| `memory_type` | `P12323 RAM type` | **5/284 (%2)** | Pratikte yok |
| `has_igpu` | `P2560 GPU` | 10/284 (%4) | Varlığı "var" der, **yokluğu "yok" demez** — bilinmiyor ile yok ayırt edilemiyor |

Dokuz alandan beşi işe yarar oranda, ikisi pratikte boş.

**İyi haber:** `base` ve `boost` saat hızları tek bir özellikte durup nitelikle
ayrılıyor. Ölçüldü:

```
P2149 = 5   -> nitelik: boost clock frequency
P2149 = 4.2 -> nitelik: base clock frequency        (Ryzen 7 7800X3D)
```

---

## 4. Kapsam: modern parçalar var mı?

**Sınıf büyüklükleri:** 153 GPU modeli, 284 CPU modeli. (Karşılaştırma için:
tek başına TechPowerUp veritabanında binlerce kart var.)

**Yayın tarihine göre dağılım:**

| Yıl | GPU modeli | CPU modeli |
|---|---|---|
| 2020 | 6 | — |
| 2021 | 4 | 1 |
| 2022 | 13 | — |
| 2023 | 9 | 3 |
| 2024 | **1** | 3 |
| 2025 | 10 | 3 |
| 2026 | **0** | **0** |

Tarih taşıyan CPU kaydı toplam **22**. 2026 modeli hiç yok.

**Kendi dev-seed parçalarımız Wikidata'da var mı?** Beşi arandı, hepsi kayıt
olarak **var** — ama teknik alanları boş:

| Parça | QID | TDP | Uzunluk | Tarih |
|---|---|---|---|---|
| GeForce RTX 5070 | Q131692955 | yok | yok | 2025-02-01 |
| GeForce RTX 5060 | Q133882280 | yok | yok | 2025-05-01 |
| Radeon RX 9070 XT | Q131697583 | yok | yok | yok |
| Ryzen 5 7600X | Q130272739 | yok | — | yok |
| Ryzen 7 9800X3D | Q131499897 | 120 | — | yok |

**Core i9-14900K Wikidata'da hiç yok.** Aranan dört Intel modelinden yalnızca
Core Ultra 9 285K bulundu. Yani en çok satan masaüstü işlemcilerden biri
kayıtlı değil.

---

## 5. Veri kalitesi: üç ayrı sorun, hepsi ölçüldü

**a) Birimler tutarsız.** Aynı özellik farklı birimlerle girilmiş; içe aktarma
her satırın birimini okumak ve çevirmek zorunda kalır.

```
CPU saat frekansı (P2149):  gigahertz 68  |  hertz 34  |  megahertz 19
GPU uzunluğu (P2043):       millimetre 5  |  centimetre 1
GPU TDP (P2229):            watt 28  |  "Watt" 1  |  degree Celsius 1
```

Son satır yazım hatası değil: bir kartın TDP alanına **sıcaklık** girilmiş.

Sorgu çıktısındaki `Intel Core i7-8700K ... 3200000000 4600000000` da bunun
sonucu — o kayıt hertz cinsinden.

**b) Değerler yanlış olabiliyor.** Doğrulandı:

```
Intel Core i7-3770 -> Wikidata soketi: LGA 1151
```

Gerçeği LGA 1155. Bu alan uyumluluk kuralı C1'i doğrudan besliyor; yanlış
soket, kullanıcıya "bu işlemci bu anakarta takılır" dedirtir. Bizim şemamızın
`confidence` alanı tam bu yüzden var ama bu satır `high` ile girilemezdi.

**c) Kayıtların adı yok.** Modern GPU kayıtlarının çoğunda İngilizce etiket
bulunmuyor; ad yalnızca `P1705 native label` / `P1813 short name` gibi metin
özelliklerinde duruyor.

```
Q131692955 (RTX 5070): labels {} , aliases {}   — 19 özellik var, etiket yok
2024+ 11 GPU kaydının 9'unda İngilizce etiket yok
```

Ada göre eşleştirme yapan bir içe aktarma bunları sessizce atlardı.

**d) Tekrarlar var.** `AMD Ryzen Threadripper 1950X` sorgu sonucunda iki ayrı
kayıt olarak görünüyor.

**e) Evren karışık.** 42 satırlık sonuçta masaüstü işlemcilerin yanında mobil
(Socket FP6), gömülü (FCBGA) ve sunucu (Xeon Phi, LGA 3647) parçaları var.
Beta yalnızca masaüstüyle ilgileniyor; ayıklama elle yapılmak zorunda.

---

## 6. Değerlendirme

**Birincil kaynak olarak kullanılamaz.** Sebep tek bir eksik alan değil,
üçünün birleşimi:

1. **Kapsam yok.** 153 GPU / 284 CPU, ve satmakta olan parçaların çoğu eksik.
2. **Alanlar yok.** GPU'da sekiz alandan üçü hiç tanımlı değil
   (`recommended_psu_watt`, `chipset`, `pcie_version`), `length_mm` %4.
3. **Güvenilirlik düşük.** Doğrulanmış yanlış değer, üç farklı birim,
   TDP alanında sıcaklık.

Uyumluluk motorumuzun altı engelleyici kuralından dördü Wikidata'da olmayan
ya da güvenilmez alanlara dayanıyor: C4 (TDP), C5 (uzunluk), C1 (soket).
Yanlış veri burada sessiz değil, gürültülü şekilde yanlış sonuç üretir —
kullanıcıya alamayacağı bir sistemi "uyumlu" der.

**Wikidata'nın işe yaradığı yerler var, ama bunlar bizim ihtiyacımız değil:**

- `P577 publication date` → `parts.release_year` için makul (94/153 GPU).
- `P176 manufacturer` → `parts.brand` (127/153).
- `P13418 TechPowerUp GPU Specs Database ID` (99/153) ve
  `P13844 TechPowerUp CPU Specs Database ID` (6/284) → kimlik eşleştirme için
  işaretçi. **Ama** o veritabanının içeriğini çekmek lisans olarak zaten
  kapalı (K48), yani bu kimlikler bize bir şey açmıyor.

Yani Wikidata'dan gelebilecek şey "marka ve çıkış yılı" — bunlar da zaten
üretici sayfasında yazan, en kolay bulunan iki alan.

---

## 7. Öneri

**Beta için elle giriş.** 30-60 parça, üretici ürün sayfasından. Şema bunu
zaten destekliyor: `source = 'manufacturer'`, `source_url` = ürün sayfasının
adresi, `confidence = 'high'`. Her satırın nereden geldiği tek tek yazılı olur
ve `SCHEMA.md` bölüm 1.3'ün istediği tam olarak budur.

Beta bitiş ölçütü "10 kişi bir sistem toplayabildi" — bunun için binlerce
parça gerekmiyor. Kategori başına 5-10 doğru parça, binlerce şüpheli parçadan
iyidir.

**Wikidata sonra tekrar bakılabilir.** Veri CC0 ve topluluk düzenliyor;
kapsam bir yıl içinde artabilir. Kalıcı bir karar değil, bugünün ölçümü.

**Yapılmayacak:** Kaggle veri setleri (K48).

---

## 8. Yöntem

- Sorgular `https://query.wikidata.org/sparql` adresine `curl` ile,
  `Accept: application/sparql-results+json` ve projeyi tanıtan bir
  `User-Agent` başlığıyla gönderildi.
- Kayıt arama için `wbsearchentities` API'si kullanıldı.
- İki ağır sorgu (alt sınıf gezinmesi ve üçlü UNION) zaman aşımına uğradı;
  parçalanıp tekrar çalıştırıldı. Rapordaki her sayı başarılı bir sorgudan
  geliyor.
- Kod yazılmadı, hiçbir dosya `/data` veya `/engine` altına eklenmedi,
  veritabanına dokunulmadı.

---

## Açık kalan sorular

**S19 (yeni) — Gerçek parça verisi nereden gelecek?** Wikidata elendi, Kaggle
kapalı. Önerim elle giriş; onay ve kaç parçayla başlanacağı kararı gerekiyor.

**S18, S16, S15** — değişmedi.

Güncel liste: `SORULAR.md`
