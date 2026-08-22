# 2026-08-22 — Veri kapsamı açığını görünür kılmak

## Sorun

Katalogda **332 parça**, `perf_index` tablosunda **15 ekran kartı + 12
işlemci**. Kullanıcı ölçümü olmayan bir parça seçince (örn. RX 7600 XT +
Ryzen 5 7600) sistem indeksi, oyun bazlı FPS ve yükseltme önerisi panelleri
birden boş kalıyordu — ve **neden** boş kaldığı seçimden sonra anlaşılıyordu.

Altı iş yapıldı. Hiçbiri `perf_index` ya da FPS hesabına dokunmuyor; hepsi
sunum ve kapsamın görünürlüğü. `lib/perf-margin.ts` ve `lib/fps-margin.ts`
değiştirilmedi (`git status` ile doğrulandı).

## Ne yapıldı

### 1. Listeler ölçüm kapsamına göre gruplandı (K145)

Ekran kartı ve işlemci listeleri iki `<optgroup>`:

```
Ölçümlü — FPS tahmini verilebilir          ekran kartı 15 · işlemci 12
Ölçüm yok — sadece uyumluluk kontrolü      ekran kartı 45 · işlemci 30
```

Ölçümlüler önce. Ölçümsüz seçeneklerin metninde ayrıca `· ölçüm yok` yazıyor —
liste kapandığında `optgroup` başlığı görünmez oluyor, sonuç görünmez olmamalı.
Seçildikten sonra listenin altında bir cümle daha çıkıyor.

Gruplama `perf_index`'ten türetiliyor, gömülü listeden değil. Kartlar (AIB)
çiplerinin durumunu miras alıyor — indeks zaten iki seviyeli okunuyor (K86/K87).

### 2. Sayfa dolu açılıyor (K144)

`engine/default-build.ts`: ölçümlü bir ekran kartı + işlemci ve bunlarla
**uyumluluk hatası üretmeyen** anakart/bellek/güç kaynağı/kasa seçiliyor.
Sunucuda hesaplanıp istemciye yalnızca id'ler geçiyor.

Orta segment seçiliyor (indekse göre sıralanıp ortadaki), amiral gemisi değil.
Uyumluluğa `checkCompatibility` karar veriyor; kuralların ikinci kopyası
yazılmadı. Hatasız kombinasyon bulunamazsa `null` döner ve form boş açılır.

Varsayılan **yalnızca başlangıç değeri**. Paylaşılan linkten seçim geri yükleme
yolu bugün builder'da yok (kaydedilen sistem ayrı sayfada açılıyor); eklendiğinde
`useState` başlangıcına o girer ve varsayılana hiç bakılmaz.

### 3. Başlıktaki kapsam sayıları düzeltildi (K149)

**"94 ekran kartı" uydurma bir sayı değildi**, ama adı yanlıştı: 15 ölçümlü çip
+ o çiplere bağlı 79 kart = FPS gösterilebilen **seçenek** sayısı. "23 oyun" da
doğruydu: `games` tablosunda 32 satır var, 23'ü kullanılabilir ölçüm grubu
bırakıyor (grup ≥3 farklı kart istiyor, çelişen değer grubu düşürüyor — K125).

Başlık artık kapsam açığını gösteriyor:

```
Ölçümü olan oyun          23 oyunda FPS listesi çıkıyor…
Ölçümü olan ekran kartı   15 çip ölçüldü; … 94 seçenekte FPS görünüyor — 213 içinden
Ölçümü olan işlemci       12 işlemci ölçüldü, 42 işlemcinin içinden
```

### 4. Fiyatlar TRY'ye çevrildi (K148)

`lib/currency.ts` — kur, tarihi ve çevrim tek yerde. Veritabanı değişmedi.
Arayüz her fiyat kutusunda *"elle girilen kurla çevrildi: 1 USD = 41,00 ₺
(2026-08-22). Canlı kur değildir."* diyor. Çevrim tam sayıyla, float yok.

**Bu iş bir hata ortaya çıkardı:** yükseltme motoruna USD senti gidiyor, bütçe
kutusu TL kuruşu topluyordu. Motor ikisini karşılaştırıyordu — "bu bütçeyle
şunu alabilirsin" cevabı ~41 kat yanlıştı. Aday listesi artık çevrilmiş değerle
kuruluyor; motorun kendisi değişmedi.

### 5. "Kontrol edilemeyenler" aşağı indi (K147)

Sağ sütunun en üstünden performans/FPS/fiyat panellerinin **altına**. Kapalı
`<details>`, başlıkta kaç kontrolün yapılamadığı yazıyor. İçerik aynen duruyor.

K134 bozulmadı: uyumluluk **hataları** hâlâ en üstte. Aşağı inen şey hata değil,
"veri eksik olduğu için bu kural çalışmadı" bilgisi.

### 6. Depolama açılır listeye çevrildi (K146)

14 satırlık onay kutusu listesi → `<select multiple>`. Etiketten üretici stok
kodu düşürüldü; kural dar (yalnızca sondaki parantez, içi büyük harf/rakam ve
boşluksuz), `(2 x 16GB)` gibi anlamlı parantezler kalıyor. Tam ad `title`
ipucunda ve seçilenler ayrıntı satırında.

## Ne doğrulandı

**Tarayıcıda, canlı sayfada:**

```
varsayılan seçim   gpu amd-rx-9070-gre (indeks 108.2) · cpu intel-core-ultra-9-285k (110.3)
                   msi-mag-b860-tomahawk-wifi · corsair-vengeance-ddr5-32gb-6000
                   corsair-rm750e · fractal-design-define-7-compact
                   uyumluluk bulgusu: 0 · seçim süresi 1 ms
ilk ekran          sistem indeksi 108.7 · 23 satır FPS · toplam 23.739,00 ₺
optgroup           gpu 15/45 · cpu 12/30, ölçümlüler önce
depolama           multiple=true, etiket "Crucial T705 2TB PCIe Gen5 NVMe M.2 · nvme, 2000 GB"
ölçümsüz seçilince "Bu ekran kartı için ölçüm yok: uyumluluk kontrolü çalışır…"
bölüm sırası       Performans · Oyun bazlı FPS · Toplam fiyat ·
                   Kontrol edilemeyenler (1) [kapalı] · Yükseltme önerisi · Seçilen sistem
kaydedilmiş sistem 54.939,18 ₺ · parça satırları ₺ · "Donan değer USD cinsindendir"
```

**Kontrast taraması** — üç genişlik × iki tema, saydam yüzeyler ata zincirinde
birleştirilerek: 272 öğe, **her kombinasyonda 0 AA ihlali**. Yatay taşma yok
(375 / 768 / 1440). Konsol temiz.

**Komutlar:**

```
npm run lint            0 hata
npx tsc --noEmit        0 hata
npm test                153/153 (9 yeni: engine/default-build)
npm run sema:kontrol    83/83 (150 karar okundu, numaralar tekil)
npm run kural:kontrol   11/11 kural gerçek veriyle tetikleniyor
npm run varyant:kontrol 20/20
npm run build           hatasız
git status lib/         perf-margin.ts ve fps-margin.ts DEĞİŞMEDİ
```

`npm run seed:filtre-kontrol` "hiçbir şey kanıtlamıyor" diyor: geliştirme
veritabanında dev-seed satırı kalmamış, filtrelenecek satır olmadığı için test
bir şey ölçemiyor. Script bunu kendisi söylüyor ve bu tur öncesinde de böyleydi;
bu değişikliklerle ilgisi yok.

## Açık kalan sorular

- **Kur değeri onaylanmadı.** `lib/currency.ts` içindeki `1 USD = 41,00 ₺`
  benim koyduğum bir başlangıç değeri, ölçülmüş ya da doğrulanmış bir sayı
  değil. Sitedeki her fiyat bu sayıya bağlı. Doğru kur girilene kadar fiyatlar
  yanlış — arayüz "elle girilen kur" dediği için yanıltıcı değil ama yanlış.
  → `SORULAR.md` S47
- **`<select multiple>` masaüstünde Ctrl/⌘ gerektiriyor.** Altına açıklama
  yazıldı ama bu desen bilinen bir kullanılabilirlik sorunu. Kullanıcı
  testinde depolama seçimi izlenmeli.
- **Varsayılan işlemci "Core Ultra 9 285K"** — indeks sırasına göre ortanca
  (110.3) ama adı amiral gemisi gibi okunuyor. Ölçümlü 12 işlemcinin dağılımı
  dar olduğu için böyle; ölçüm sayısı arttıkça kendiliğinden değişecek.
