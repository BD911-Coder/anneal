# 2026-08-22 — İngilizce varsayılan dil, çeviri katmanı

## Ne yapıldı

Bütün kullanıcıya görünen metinler bileşenlerden çıkarılıp `messages/`
altındaki dosyalara taşındı. Varsayılan ve kaynak dil **İngilizce**; Türkçe
mevcut metinden dolduruldu. Kütüphane **next-intl 4.13**.

**184 anahtar, 5 ad alanı, 2 dil.**

| Ad alanı | Ne içeriyor |
|---|---|
| `common` | site adı, meta etiketleri, geri bildirim formu, sunucu işlemi hataları, dil seçici |
| `parts` | kategori adları, seçici etiketleri, kapsam grupları, depolama, boş durum, seçilen sistem |
| `compatibility` | C1–C6 / W1–W5 kural cümleleri, başlıklar, "kontrol edilemeyenler" |
| `performance` | çözünürlük, sistem indeksi, bantlar, darboğaz, FPS listesinin bütün dürüstlük metinleri |
| `pricing` | toplam, kur notu, yükseltme önerisi, kaydedilmiş sistem fiyatları |

## Kararlar ve gerekçeleri

**K150 — Kural mesajları ICU, adlandırılmış parametreyle.** Motor artık her
bulgunun yanında `params` taşıyor (`C4 → {psuWatts: 550, requiredWatts: 579}`).
Metin birleştirme kullanılmadı: `"soket " + x` üç dilde üç ayrı kelime sırası
demek.

**Motor mantığı değişmedi.** `Finding.message` (Türkçe hazır cümle) yerinde
duruyor, `params` onun **yanına** eklendi. Arayüz `message`'ı hiç okumuyor;
motor ise arayüz olmadan da okunur çıktı verebiliyor — script'ler ve testler
onu kullanmaya devam ediyor. **153 testin hiçbiri değişmedi.**

Aynı desen bantlarda: `bandFor()` Türkçe etiketi döndürmeye devam ediyor,
yanına `bandKeyFor()` eklendi.

**K151 — Adreste dil öneki YOK.** next-intl'in yaygın kurulumu `/en/...`
kullanır; `SCHEMA.md` bölüm 9 adres yapısını sabitliyor. Önek eklemek
`/sistem/<id>` adreslerini kırardı — dağıtılmış her paylaşım linki ölürdü.
Dil sırası: `NEXT_LOCALE` çerezi → `Accept-Language` → `en`.

Bedeli açıkça yazıldı: aynı adres iki dilde farklı içerik döndürüyor. Bugün
sorun değil (sayfalar `force-dynamic`, arama motorlarına kapalı — K30); site
aramaya açılırsa yeniden düşünülmeli.

**K152 — `Intl` kullanımı, eski kararın tersine çevrilmesi.** `lib/format.ts`
bilinçli olarak `Intl` kullanmıyordu çünkü sunucu ve tarayıcı farklı dil/saat
dilimi kullanınca hydration uyuşmazlığı çıkıyordu. Sebep kalktı: dil istek
başına bir kez çözümlenip istemciye geçiyor, saat dilimi açıkça `UTC`.

**Para birimi dilden ayrı:** `locale` sayının nasıl yazılacağını, `currency`
hangi para birimi olduğunu söylüyor.

**K153 — Eksik anahtar dağıtımı durdurur.** `npm run dil:kontrol`. ICU
parametreleri de karşılaştırılıyor ama asimetrik — ayrıntısı KARARLAR'da.

## Ne doğrulandı

**İki dil, tarayıcıda:**

```
tr   Ölçümü olan ekran kartı · Ölçümlü — FPS tahmini verilebilir
     ₺54.939,18 · 1 USD = ₺41,00 (22.08.2026) · 20.08.2026
en   Graphics cards with measurements · Measured — FPS estimate available
     TRY 54,939.18 · 1 USD = TRY 41.00 (08/22/2026) · 08/20/2026
```

**ICU kural mesajları, İngilizce, gerçek veriyle:**

```
2 errors — this build cannot be assembled as configured
C2  The memory is DDR4 and the motherboard supports DDR5. These two cannot be
    fitted together.
C4  The power supply is rated 550 W; this build needs at least 579 W.
```

Çoğul (`2 errors`) ICU `plural` ile; parça id'leri çevrilmedi.

**Ham anahtar sızıntısı yok:** her iki dilde de sayfa metninde
`namespace.key` deseni aranıp sıfır sonuç alındı.

**Kontrast** (İngilizce, saydam yüzeyler ata zincirinde birleştirilerek):
256 öğe, 1440 koyu ve 375 açık → **0 AA ihlali**, yatay taşma yok.

**Komutlar:**

```
npm run lint            0 hata
npx tsc --noEmit        0 hata
npm test                153/153 (motor testleri DEĞİŞMEDİ)
npm run dil:kontrol     184 anahtar, tr tam, 1 uyarı (C6/supportedCount)
npm run sema:kontrol    83/83 (154 karar okundu)
npm run build           hatasız
git status lib/*margin* perf-margin.ts ve fps-margin.ts DEĞİŞMEDİ
```

## Açık kalan sorular

- **Dil seçici sayfanın en altında.** Adreste önek olmadığı için seçim bir
  çereze yazılıyor; keşfedilebilirliği düşük. Kullanıcı testinde izlenmeli.
- **Türkçe adresler İngilizce arayüzde de Türkçe** (`/sistem/…`,
  `/hakkinda`). Adres yapısı sabit olduğu için (SCHEMA.md bölüm 9) bilinçli.
- **`docs/` ve kod yorumları Türkçe kaldı.** Bu tur yalnızca kullanıcıya
  görünen metinleri kapsıyordu; proje sahibinin dili Türkçe.
