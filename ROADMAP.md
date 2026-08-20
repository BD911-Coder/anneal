# Anneal — Yol Haritası

Bu belge projenin tamamını faz faz gösterir. Her fazın bir **bitiş ölçütü** vardır;
o karşılanmadan sonraki faza geçilmez.

Güncelleme: 20 Ağustos 2026

---

## Şu an neredeyiz

**Kod tarafı beta için bitti.** Eksik olan veri ve kullanıcı.

| | Durum |
|---|---|
| Site | Vercel'de canlı, arama motorlarına kapalı |
| Katalog | 237 gerçek parça |
| Uyumluluk motoru | 11 kural, hepsi gerçek veriyle tetikleniyor |
| Performans indeksi | 14 GPU + 7 CPU (60 ve 40 üzerinden) |
| Benchmark ölçümü | 106 nokta, tek kaynak (ComputerBase) |
| Fiyat | 22 parçada gerçek fiyat (USD, Newegg) |
| Kullanıcı | 0 |

**Katalog dağılımı:** GPU çipi 60 · GPU kartı 58 · CPU 40 · anakart 19 · RAM 14 ·
depolama 6 · kasa 5 · PSU 4

---

## FAZ 1 — Beta'yı test edilebilir hale getirmek

**Neden:** Site şu an bir yabancıya gösterilemez. Fiyat yok, bazı kategorilerde
4-5 seçenek var, kartların yarısında performans tahmini çıkmıyor.

**Bitiş ölçütü:** Rastgele bir kullanıcı siteye girip baştan sona bir sistem
toplayabiliyor ve toplam fiyatını görüyor.

### 1.1 — Fiyat 🔴 ENGELLEYICI

Şu an kart seçili bir sistem **kaydedilemiyor**, çünkü kartlarda fiyat yok.
Yani çalışan bir özellik yarıda kalmış durumda.

- [ ] **eBay geliştirici + EPN başvurusu** *(sen — 20 dk, onay birkaç gün sürebilir)*
      Fiyat verisi ve affiliate linkini birden çözüyor. Onayı beklerken 1.2'ye geç.
- [x] **Elle fiyat girişi** *(Claude Code + senin doğrulaman)* — **22 parça**
      (17 GPU + 5 CPU), Newegg, USD, `source='manual'`. Hedef 60-80'di;
      pazaryeri satıcıları ve URL bulma maliyeti yüzünden orada kalındı.
      Anakart/RAM/PSU/kasa/depolama **fiyatsız** — bkz.
      `docs/log/2026-08-20-elle-fiyat-girisi.md`.
- [x] Kart seçili sistemin kaydedilebildiğini tarayıcıda doğrula — Claude
      doğruladı (i9-14900K + MSI RTX 5080 GAMING TRIO OC → 2.299,98 USD,
      `/sistem/4dkdcw` oluştu). Sen de bir kez bak.
- [ ] **Kalan beş kategoriye fiyat** *(anakart, RAM, PSU, kasa, depolama —
      hepsi hâlâ 0)*. Kullanıcı bugün yedi kategorili bir sistem toplayıp
      toplam fiyat **göremiyor**.
      - Newegg: bu beş kategoride denenen listelerin hepsi pazaryeri
        satıcısıydı, K96 tavanı hesaplanamadığı için elendi.
      - **Amazon denendi, kapalı:** konum engeli — ürün ve arama
        sayfalarında sıfır fiyat gösteriliyor ("Deliver to Turkey / No
        featured offers available"). `docs/log/2026-08-20-amazon-fiyat-denemesi.md`
      - **Kaynak kararı bekliyor** (dört seçenek raporda). eBay API maddesi
        yukarıda ve bu turdan sonra daha öncelikli görünüyor.

### 1.2 — Kategori derinliği

Dört kategori beta için fazla dar. Kullanıcının seçenek hissi olmalı.

- [x] PSU: 4 → **12** *(550W–1200W, Bronze→Platinum, biri SFX)*
- [x] Kasa: 5 → **12** *(ITX/mATX/ATX/E-ATX, GPU açıklığı 290–423 mm)*
- [x] Depolama: 6 → **14** *(Gen5/Gen4 NVMe, SATA SSD, HDD; 1–4 TB)*
- [x] RAM: 14 → **20** *(DDR5 16–128 GB / 5200–8000, DDR4 32–128 GB)*
- [x] **K95 — PSU uzunluğu** *(20 Ağustos)*. ATX12V genişliği (150) ve
      yüksekliğini (86) sabitliyor; etiketsiz üçlüde bu ikisi tanınıyorsa kalan
      değer uzunluktur. `length_mm` dolu PSU **1 → 8**.
      `docs/log/2026-08-20-psu-uzunlugu-k95.md`

Sonuç: eşik uyarısı 3 → **1**. C5 uyarıdan çıktı (2 → 125 kombinasyon),
**W5 de çıktı (1 → 14 kombinasyon)** — K95 ile kuralın iki ucu da tek satır
olmaktan kurtuldu, tetiklenen kasa 1'den 3'e çıktı.
Kalan tek uyarı: W2 (2 kombinasyon).

Marka çeşitliliği hâlâ dar — kasaların 11'i Fractal, PSU'ların 11'i Corsair.
`docs/log/2026-08-20-kategori-derinligi.md`

Kurallar aynen geçerli: üretici sayfaları, K59/K60/K62/K95, uydurma yok.

### 1.3 — Performans indeksi kapsamı

46 GPU ve 33 CPU'da tahmin çıkmıyor. Dürüst ama zayıf.

- [x] **S37 ölçümü** — yapıldı, **sonuç olumsuz: köprü kurulmadı.**
      Dağılım %12.4 (eşik %5), NVIDIA/AMD farkı +%14.8. K77 doğrulandı.
      Ölçüm sebebi de düzeltti: fark markadan değil **VRAM**'den geliyor —
      8 GB kartlar oyun paketi değişince yer değiştiriyor.
      GPU kapsamı 14'te kalıyor. `docs/log/2026-08-20-s37-kopru-olcumu.md`
- [ ] Yeni kaynak araması — bir tur, denenmemiş adaylar
- [ ] Hedef: 30 GPU + 15 CPU indeksli

---

## FAZ 2 — Beta ölçütü

**Neden:** Bu projenin tek gerçek bilinmeyeni "insanlar burada sistem toplamak
istiyor mu". Kod ve veri bu soruyu cevaplamıyor; kullanıcı cevaplıyor.

**Bitiş ölçütü:** **10 kişi siteye girip sana hiçbir şey sormadan bir sistem
toplayabildi.**

- [ ] **Gerçek veriyi canlıya aktar** *(sen çalıştıracaksın)* — plan hazır ve
      onaylı: `docs/canliya-aktarim-plani.md`. Altı komut, adres kabuk
      değişkeninde kalır, `.env.local` değişmez. Faz 2'nin ilk adımı: site
      gerçek veriyle dolmadan kimseye gösterilemez.
- [ ] Kendin baştan sona kullan, 20 dakika *(sen — bunu hâlâ yapmadın)*
- [ ] 3 arkadaşına göster, izle, not al
- [ ] Çıkan sorunları düzelt
- [ ] Donanım forumlarında / Reddit'te paylaş
- [ ] Geri bildirim formundan geleni oku
- [ ] 10 kişi ölçütüne ulaş

Bu faz bitmeden Faz 3'e geçme. Kullanıcısı olmayan bir sistemi büyütmek,
projeyi öldüren en yaygın hatadır.

---

## FAZ 3 — Kapsam ve kalite

**Neden:** Kullanıcı olduğu doğrulandıktan sonra derinleşmek anlamlı.

**Bitiş ölçütü:** Kullanıcılar "eksik" demeyi bıraktı; katalog ve tahmin
güvenilir hale geldi.

### 3.1 — CPU soğutucusu *(yeni kategori)*

Şemada `case_specs.max_cpu_cooler_height_mm` var ama karşılığı yok — ölü alan.
9800X3D veya 14900K alan kullanıcı soğutucu almak zorunda.

- [ ] Şema: `cooler` kategorisi + `cooler_specs`
- [ ] Yeni kural: soğutucu yüksekliği ≤ kasa açıklığı
- [ ] Yeni kural: soğutucu soket uyumluluğu
- [ ] 12-15 soğutucu verisi

### 3.2 — Katalog genişletmesi

Meşru tavan ~1450 satır. Kademeli git, hepsini bir seferde alma.

- [ ] Anakart 19 → 60
- [ ] GPU kart varyantı 58 → 150 *(kalan çipler)*
- [ ] RAM / SSD / PSU / kasa derinleştirme

### 3.3 — Kullanıcı FPS gönderimi

**Projenin en değerli varlığı burada başlıyor.** Satın alınamayan, kopyalanamayan
veri seti.

- [ ] Gönderim formu *(hesap gerektirmeden)*
- [ ] Doğrulama akışı — ekran görüntüsü, aykırı değer kontrolü
- [ ] Ödül sistemi *(aylık bütçe ile hediye çeki)*

---

## FAZ 4 — Gelir altyapısı

**Neden:** Ancak trafik varsa anlamlı. Affiliate programları zaten mevcut trafik
şartı arıyor.

**Bitiş ölçütü:** Gelir en azından aylık gideri karşılıyor.

- [ ] Alan adı al *(anneal.com veya .dev)*
- [ ] Marka tescili — USPTO/EUIPO/TÜRKPATENT, sınıf 9 ve 42
- [ ] Arama motorlarına aç *(robots.txt + noindex kaldır)*
- [ ] Affiliate linklerini `/git/<slug>` katmanına bağla
- [ ] Affiliate açıklama metni ekle *(yasal zorunluluk)*
- [ ] Şahıs şirketi + mali müşavir *(ilk gelirle birlikte)*
- [ ] Bir kez hukuki danışma

---

## FAZ 5 — Asıl hedef: nesiller arası tahmin

**Neden:** Projenin sen için anlamı bu. Yeni nesil çıktığında, kimse test etmeden
tahmin verebilmek.

**Bitiş ölçütü:** Yeni bir GPU duyurulduğunda site ilk 48 saatte tahmin
yayınlayabiliyor ve tahmin tutuyor.

- [ ] Nesiller arası eşleşen kalibrasyon seti *(aynı oyunlar, 3 nesil)*
- [ ] Ölçekleme modeli — mimari katsayısı, tek ölçümden seri tahmini
- [ ] Tahmin arşivi — yayınlanan tahminler kaydedilir
- [ ] **Geriye dönük denetim** — tahmin ne kadar tuttu, yayınla

Son madde markanın kendisi: tahminlerini geçmişe dönük denetleyen site.

---

## FAZ 6 — Büyüme

**Bitiş ölçütü yok** — buradan sonrası sürekli.

- [ ] Çoklu iş yükü skorları *(AI, video, üretkenlik — şema hazır, ölçüm yok)*
- [ ] Fiyat geçmişi grafikleri *(veri birikiyor, özellik yok)*
- [ ] Kullanıcı hesabı *(builds zaten kalıcı, sadece user_id eklenecek)*
- [ ] Mobil uygulama *(motor bağımsız, yeniden kullanılabilir)*
- [ ] Çoklu dil

---

## Bekleyen sorular

`SORULAR.md` güncel kaynak. Şu an açık olanlar:

| # | Konu | Faz |
|---|---|---|
| S16 | `benchmark_points.game_id` oyun dışı iş yüklerinde | 6 |
| S18 | Önizleme dağıtımları | 3 |
| S22 | 14 kullanılmayan zorunlu alan | 3 |
| S38 | Güç konnektörü alt tablosu | 3 |

---

## Kalıcı kurallar — asla esnetilmez

Bunlar 90+ kararın özeti. Yeni bir iş başlarken kontrol et:

1. **Uydurma yok.** Bulunamayan alan boş bırakılır, çıkarım yapılmaz *(K60)*
2. **Kaynak defteri.** Her satırda `source`, `source_url`, `confidence`, `collected_at`
3. **Tek kaynaktan toplu alım yok.** Sayfa başına %10 tavanı *(K75/K84)*
4. **`robots.txt` yasaklıyorsa o kaynak kapalı.** Araç değiştirmek durumu değiştirmez
5. **`perf_index` yalnızca `benchmark_points`'ten hesaplanır** *(K71)*
6. **Fiziksel ölçü alanları zorunlu olmaz** *(K62)*
7. **Hata hep güvenli yöne.** Yanlış "sığar" demek, gereksiz uyarıdan pahalı
8. **`/engine` saf kalır.** Veritabanı, ağ, arayüz erişimi yok
9. **dev-seed canlıya çıkmaz.** Dört katman
10. **Sapma ölçülür ve kaydedilir** *(K80)*

---

## Şu an sıradaki tek iş

**1.1 — Fiyat.** Diğer her şey bekleyebilir; bu bir özelliği bloke ediyor.

Başlangıç: eBay başvurusu *(sen)* + elle fiyat girişi *(Claude Code)*.
