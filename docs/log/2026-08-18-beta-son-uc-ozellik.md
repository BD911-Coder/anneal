# 2026-08-18 — Beta'nın kalan üç özelliği

Paylaşılabilir link, yükseltme önerisi, geri bildirim. Üçü de çalışıyor ve
ölçüldü.

---

## Ne yapıldı

### 1. Paylaşılabilir link

Seçilen sistem `builds` + `build_items` olarak kaydediliyor, `/sistem/<id>`
adresinden açılıyor, hesap gerekmiyor.

**Dondurulan değerler:** toplam fiyat, parça başına birim fiyat, sistem indeksi
ve o indeksi üreten `model_version`. Kayıtlı sistem sayfası bunları gösteriyor;
güncel fiyat **ayrı bir kutuda**, farkıyla birlikte. Dondurulmuş sayının
üzerine yazılmıyor.

**Kaydedilen değerler tarayıcıdan gelmiyor** (K42). Sunucu işlemi sadece parça
id'lerini alıyor; fiyat ve indeks `/data` içinde veritabanından okunarak orada
hesaplanıyor. Aksi hâlde isteği elle düzenleyen biri istediği fiyatı
kaydedebilir ve o yanlış bilgi kalıcı olarak paylaşılabilirdi.

| Dosya | İşi |
|---|---|
| `data/builds.ts` | Kaydetme, okuma, paylaşım kimliği üretme |
| `app/actions.ts` | Tarayıcı ile `/data` arasındaki köprü |
| `app/sistem/[id]/page.tsx` | Kayıtlı sistem sayfası |

### 2. Yükseltme önerisi

`engine/upgrade.ts` — saf fonksiyon, 23 test. Bütçe farkı (TL) giriliyor,
o paraya sığan ve sistem indeksini en çok artıran değişiklik bulunuyor.

Çıktı: hangi kategori, hangi parçadan hangisine, kaç TL fark, indeks kaçtan
kaça çıkıyor.

Aday parçaları çağıran taraf veriyor; motor katalogdan haberdar değil.

### 3. Geri bildirim

Tek satır kutu, `feedback` tablosuna yazıyor. Ana sayfada ve kayıtlı sistem
sayfasında var; ikincisinde `build_id` ile ilişkilendiriliyor.

E-posta veya ad sorulmuyor — tabloda o alanlar zaten yok. Kullanıcıya da
"kişisel bilgi yazmayın" deniyor, yoksa iletişim bilgisini kendisi yazar.

### 4. S16 kapatılmadı, ertelendi

Proje sahibinin kararı `SORULAR.md`'ye işlendi: beta'da tek iş yükü var,
`game_id` zorunluluğu doğru davranış, ikinci iş yükünde bakılacak.

---

## Hangi kararlar verildi ve neden

| # | Karar |
|---|---|
| K38 | Dondurulan indeks 1440p referansıyla hesaplanır |
| K39 | Dondurulacak değer üretilemiyorsa kayıt reddedilir |
| K40 | Yükseltme taraması sadece ekran kartı ve işlemciyi kapsar |
| K41 | Paylaşım kimliği: altı karakter, karışmayan alfabe |
| K42 | Kaydedilen değerler sunucuda yeniden hesaplanır |

**K38 — bir şema sorusuna çarptım, alan eklemedim.**
`builds.perf_index_snapshot` tek bir sayı, ama sistem indeksi çözünürlüğe göre
değişiyor ve `builds`'te çözünürlük sütunu yok. Alan eklemek "Dur ve sor"
kapsamında; iş beklemesin diye alansız çözümle devam ettim: dondurulan indeks
her zaman 1440p referansıyla hesaplanıyor ve sayfa bunu açıkça yazıyor.
**Karar senin:** `SORULAR.md` S17.

**K39 — bazı sistemler kaydedilemiyor.** Fiyatı olmayan parça varsa veya
işlemci/ekran kartı seçilmemişse kayıt reddediliyor ve sebebi yazılıyor.
Eksik fiyata 0 demek, toplamı olduğundan ucuz gösterirdi — ve o sayı donduğu
için paylaşılan link kalıcı olarak yanlış bilgi taşırdı.

Bilinen sınır: iGPU'lu (ekran kartsız) sistemler uyumluluk kurallarına göre
geçerli ama şu an kaydedilemiyor, çünkü indeksleri hesaplanamıyor.

**K40 — "her kategori taranır" ifadesi ekran kartı ve işlemciye indirildi.**
İndeks formülü sadece bu ikisini kullanıyor; bellek veya kasa yükseltmesi
indeksi hiç değiştirmiyor, taransalardı hepsi "0 artış" ile elenirdi.

**Eşitlikte ucuz olan kazanır.** Bu kural olmasaydı iki parça aynı artışı
verdiğinde sonuç, aday listesinin sırasına bağlı kalırdı. Test bunu ölçüyor.

---

## Ne doğrulandı

Doğrulama için geçici bir rota (`app/tmp-dogrula/route.ts`) açıldı, gerçek kod
yolu çalıştırıldı, sonra silindi. Depoya girmedi.

**Kaydetme çalışıyor:**

```
KAYDETME: {"ok":true,"id":"q8g23w"}

DONDURULMUS KAYIT:
  id: q8g23w | baslik: "Deneme sistemi"      <- baştaki/sondaki boşluk kırpıldı
  toplam: 6279400 | indeks: 60 | surum: v0.1
  parca sayisi: 7
    cpu          AMD Ryzen 7 7800X3D                     1499900  adet 1
    motherboard  ASUS TUF Gaming B650-PLUS                689900  adet 1
    psu          Corsair RM850e                           499900  adet 1
    ram          Corsair Vengeance 32GB DDR5-6000         329900  adet 1
    case         Fractal Design North                     489900  adet 1
    gpu          NVIDIA GeForce RTX 5070                 2450000  adet 1
    storage      Samsung 990 PRO 1TB                      319900  adet 1
  parca fiyatlari toplami: 6279400            <- builds.total_price_minor ile aynı
```

İndeks 60, motorun 1440p için ürettiği sayıyla birebir aynı (gpu 54, cpu 78).

**Reddedilmesi gerekenler reddediliyor:**

```
indeks yok  -> {"ok":false,"reason":"no_index","parts":["gpu","cpu"]}
bilinmeyen  -> {"ok":false,"reason":"unknown_part","parts":["boyle-bir-parca-yok"]}
bos secim   -> {"ok":false,"reason":"empty"}
olmayan id  -> null                       (sayfa: HTTP 404)
```

**Dondurma gerçekten çalışıyor — ölçüldü.** RTX 5070'in fiyatına yeni bir
snapshot eklendi (24.500,00 → 29.500,00), sayfa yeniden açıldı:

```
Kayıt anındaki değerler:  62.794,00 ₺      <- DEĞİŞMEDİ
RTX 5070 satırı:          Kayıt anında: 24.500,00 ₺ · bugün: 29.500,00 ₺ (+5.000,00 ₺)
Bugünkü fiyat:            67.794,00 ₺ — kayıt anına göre +5.000,00 ₺
```

Fiyatı değişmeyen parçalar iki tarafta da aynı sayıyı gösterdi
(`Kayıt anında: 14.999,00 ₺ · bugün: 14.999,00 ₺`).

Deneme satırı sonra silindi; `price_snapshots` yine 87 satır ve sayfa
62.794,00 ₺'ye döndü. Bu satır geliştirme veritabanına doğrulama için
yazıldı ve aynı işlemde geri alındı — canlı veriye dokunulmadı.

**Geri bildirim:**

```
gecerli      -> {"ok":true}                      (baştaki/sondaki boşluk kırpıldı)
bos          -> {"ok":false,"reason":"empty"}
501 karakter -> {"ok":false,"reason":"too_long"}
sahte build  -> {"ok":true}    <- mesaj kaydedildi, geçersiz build_id null'landı
```

Son satır bilinçli: yazının kendisi, hangi sayfadan geldiğinden değerli.

**Sayfalar:**

```
GET /sistem/q8g23w   HTTP 200   "Kayıt anındaki değerler", "Bugünkü fiyat",
                                "1440p yüksek ayar", "v0.1", geri bildirim kutusu
GET /sistem/zzzzzz   HTTP 404
GET /                HTTP 200   "Yükseltme önerisi", "Bütçe farkı", "Kaydet ve paylaş",
                                "Hesap gerekmez", "Ne eksik, ne yanlış?"
```

**Zincir:**

```
$ npx tsc --noEmit       (çıktı yok)
$ npm run lint           (çıktı yok)
$ npm run sema:kontrol   SONUC: 70 kontrolun tamami gecti.
                         [OK] engine/upgrade.ts saf
$ npm test               97 passed (97)    — 46 uyumluluk + 28 performans + 23 yükseltme
$ npm run build          ✓ Compiled successfully
                         └ ƒ /sistem/[id]
```

**Doğrulanmayan:** Tarayıcıda tıklama akışı — parça seçip "Sistemi kaydet"e
basmak, bütçe kutusuna yazıp önerinin değişmesini görmek. Sunucu tarafı ve
motor ölçüldü; ekrandaki etkileşimi sen doğrulayacaksın.

**Geliştirme veritabanında kalanlar:** `q8g23w` kimlikli deneme sistemi ve
üç geri bildirim satırı. Silmedim; `/sistem/q8g23w` adresini açıp kayıtlı
sistem sayfasını hemen görebilirsin.

---

## Açık kalan sorular

**S17 (yeni) — `builds` tablosuna `resolution` alanı eklensin mi?** 4K seçip
kaydeden kullanıcı, linkte 1440p indeksini görüyor. Sayfa bunu yazıyor ama
beklenenden farklı. İki seçenek `SORULAR.md`'de.

**S16 — ertelendi** (senin kararın, bu oturumda işlendi).

**S15, S14** — değişmedi.

Güncel liste: `SORULAR.md`
