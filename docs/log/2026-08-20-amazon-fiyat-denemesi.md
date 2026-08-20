# 2026-08-20 — Amazon fiyat denemesi: kapalı

> **Sonradan eklenen not (2026-08-20).** Bu raporda "K91" diye geçen
> pazaryeri tavanı kararı **K96** olarak yeniden numaralandırıldı — K91 zaten
> başka bir karara aitti. Metindeki atıflar düzeltildi; içerik değişmedi.

Faz 1.1'in kalan beş kategorisi (anakart, RAM, PSU, kasa, depolama) için
Amazon denendi. **Kullanılamıyor.** Veri toplanmadı, tek satır yazılmadı.

Durum CAPTCHA değil; daha kesin bir şey: **Amazon.com bu oturuma hiç fiyat
göstermiyor.**

---

## 1. `robots.txt` — engel yok

`https://www.amazon.com/robots.txt`, `User-agent: *` bloğunda `/dp/` ve
`/gp/product/` yollarını yasaklamıyor; yalnızca alt yollar kapalı
(`/dp/shipping/`, `/gp/product/e-mail-friend` gibi). Yani kural tarafında
sorun yoktu.

## 2. `curl` — sayfa geliyor, fiyat gelmiyor

```
https://www.amazon.com/dp/B0BHCCNSRH   (MSI MAG B650 Tomahawk WiFi)
boyut: 2.253.717 bayt
title: Amazon.com: MSI MAG B650 Tomahawk WiFi Gaming Motherboard...
captcha: hayir
```

Sayfa tam geliyor ama **fiyat kutuları boş**:

```html
<div id="corePrice_desktop" ...>
  <div class="a-section a-spacing-small">   </div>
</div>
<div id="merchant-info" class="a-section a-spacing-base"> <span class=""> </span> </div>
```

Sayfada 16 dolar değeri var ama hepsi **sponsorlu ürünlere** ait — `priceAmount`
alanlarının içeriği "Vetroo 1000W Power Supply", "Vetroo 850W SFX" gibi başka
ürünler. Ana ürünün fiyatı HTML'de hiç yok.

Bunlardan birini almak, Newegg'de `product-buy-box` çapası kurulmadan önce
yaşanan hatanın aynısı olurdu: **yanlış ürünün fiyatını yazmak.**

## 3. Tarayıcı — sebebi burada görünüyor

Sayfa tarayıcı panelinde açıldığında JS çalışıyor ve kutular doluyor, ama
içleri şu:

```
No featured offers available
This item cannot be shipped to your selected delivery location.
Please choose a different delivery location.
Deliver to Turkey
```

Sayfadaki dolar değeri sayısı: **0**.

Tek ürüne özgü olmadığını doğrulamak için arama sayfası da denendi:

```
https://www.amazon.com/s?k=samsung+990+pro+2tb+ssd
sonuc karti : 16
dolar degeri: 0
```

**16 sonuç, sıfır fiyat.** Amazon.com oturumu Türkiye'ye konumluyor ve ABD
fiyatlarını göstermiyor. Ürün sayfası da arama sayfası da fiyatsız.

---

## 4. Sonuç ve neden burada durduldu

| Kaynak | Durum |
|---|---|
| Newegg | Ürün sayfaları çalışıyor; arama/kategori sayfaları CAPTCHA |
| **Amazon** | **Fiyat hiç gösterilmiyor — konum engeli** |
| Best Buy | `robots.txt` 0 bayt, izin doğrulanamıyor (önceki tur) |

Proje sahibinin talimatı açıktı: *"Amazon da CAPTCHA veya erişim sorunu
çıkarırsa DUR ve söyle — üçüncü bir kaynak aramaktansa durumu birlikte
değerlendirelim."* Üçüncü kaynak aranmadı.

**Faz 1.1 tamamlanmadı.** Fiyat durumu değişmedi:

| Kategori | Parça | Fiyatlı |
|---|---|---|
| GPU (çip + kart) | 118 | 17 |
| CPU | 42 | 5 |
| Anakart | 19 | **0** |
| RAM | 14 | **0** |
| Depolama | 6 | **0** |
| Kasa | 5 | **0** |
| PSU | 4 | **0** |

Bir kullanıcı bugün baştan sona yedi kategorili bir sistem toplayıp **toplam
fiyat göremiyor** — beş kategoride hiç fiyat yok. Bu doğrulama yapılmadı,
çünkü yapılabilecek bir şey yok.

---

## 5. Değerlendirilecek seçenekler

Karar proje sahibinin; hiçbiri kendiliğinden uygulanmadı.

1. **Konum sorununu çözmek.** Amazon'un fiyat göstermemesi teknik bir engel
   değil, coğrafi bir tercih. ABD'den erişilen bir oturum fiyatları
   gösterecektir. Bu, altyapı kararı.
2. **Türkiye perakendecileri + TRY.** Fiyatlar zaten TRY'ye dönerdi ve
   K92 sayesinde karışık para birimi artık sessizce yanlış toplam üretmiyor.
   Ama "marka hedefi global, fiyat USD olsun" kararıyla çelişir.
3. **Newegg'de devam, pazaryeri tavanını gevşetmek.** K96 şu an mağaza
   referansı olmayan pazaryeri satırını eliyor. Beş kategoride denenen
   listelerin **hepsi** pazaryeri satıcısıydı; tavan gevşetilirse fiyat
   girilebilir ama spekülatif sayılar veritabanına girer.
4. **eBay geliştirici + EPN başvurusu** (ROADMAP 1.1'in ilk maddesi, hâlâ
   işaretsiz). Fiyat verisini API'den almak bu turda yaşanan üç engeli birden
   çözer.

Dördüncü seçenek zaten yol haritasında duruyor ve bu turdan sonra daha
öncelikli görünüyor.

---

## Açık kalan sorular

1. **Fiyat kaynağı kararı** — yukarıdaki dört seçenekten hangisi? Faz 1.1
   bu karar verilmeden bitmiyor.
2. **Newegg fiyatları bir günün fotoğrafı** (2026-08-20, 22 parça). Tekrar
   sıklığı hâlâ kararlaşmadı.
