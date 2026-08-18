# 2026-08-18 — Kayıt çözünürlüğü, indekssiz sistem ve canlıya geçiş

İki şema kararı uygulandı, S14 kapandı, `beta-0.1` etiketi atıldı.
`SCHEMA.md` v1.2 → **v1.3**.

---

## Ne yapıldı

### 1. `builds.resolution` (S17 kapandı)

Dondurulan indeks artık sabit bir referansta değil, **kullanıcının kaydettiği
çözünürlükte** hesaplanıyor. Kayıtlı sistem sayfası hangi çözünürlük olduğunu
yazıyor. `REFERENCE_RESOLUTION` sabiti koddan kaldırıldı.

Çözünürlük **zorunlu** alan: indeks hesaplanamasa bile yazılıyor. Kullanıcının
o an baktığı çözünürlük kaydın kendisi hakkında bir olgudur ve her zaman
bilinir; iki nullable sütunun birbirine bağlı olmasındansa biri her zaman dolu.

Ayrıca: arayüzde çözünürlük değiştirildiğinde eldeki paylaşım linki
temizleniyor — o link artık ekrandaki hesabı göstermiyor.

### 2. `perf_index_snapshot` null olabiliyor (K39 gevşedi)

Ekran kartsız (iGPU) sistemler artık kaydedilebiliyor. İndeks yerine sayfa
"Performans tahmini için ekran kartı gerekiyor" yazıyor.

**Null yazılıyor, 0 değil.** 0 geçerli bir indekstir ve "çok yavaş" demektir;
hesaplanamayanı 0 yazmak sistemi olmadığı kadar yavaş gösterirdi — üstelik bu
sayı donduğu için düzeltilemezdi.

Kural kendi fonksiyonunu aldı: `engine/performance.ts` içinde
`freezeSystemIndex()`. Üç satır, ama "indeks yoksa ne yazılır" sorusunun cevabı
tek yerde duruyor ve **test ediliyor** — `/data` içinde kalsaydı test edilemezdi.

### 3. Migration

`prisma/migrations/20260818172814_kayit_cozunurlugu_ve_indekssiz_sistem/`

```sql
ALTER TABLE "builds" ADD COLUMN "resolution" "Resolution" NOT NULL DEFAULT '1440p';
ALTER TABLE "builds" ALTER COLUMN "resolution" DROP DEFAULT;
ALTER TABLE "builds" ALTER COLUMN "perf_index_snapshot" DROP NOT NULL;
```

Mevcut kayıtlar `1440p` ile dolduruldu — eski K38 gereği gerçekten o referansla
hesaplanmışlardı, uydurma etiket değil.

### 4. Testler

`tests/performance.test.ts`'e sekiz test eklendi (28 → 36). Toplam **105 test** (46 uyumluluk + 36 performans + 23 yükseltme).
İki kararı da doğrudan ölçüyorlar: dondurulan indeksin çözünürlüğe göre
değişmesi, ekran kartsız sistemde `null` dönmesi, ve `null` ile gerçek `0`'ın
ayırt edilebilmesi.

### 5. S14 kapandı — site canlıda

`SORULAR.md` ve `docs/KARARLAR.md` güncellendi. Dikkat çeken nokta: ilk dağıtım
denemesi `dagitim:kontrol`'e takılıp durmuş. Yani dev-seed korumasının 3.
katmanı, gerçek dağıtım hattında da çalıştığını kanıtladı.

---

## Bulunan hata: canlı veritabanı migration almıyordu

`vercel.json` build komutu `prisma migrate deploy` içermiyordu:

```
npm run dagitim:kontrol && prisma generate && next build
```

Sonucu: `workload` migration'ı (K35) yalnızca geliştirme veritabanına
uygulanmıştı. Canlı veritabanı şema olarak bir sürüm geride kaldı. Kod
`perf_index.workload` sütununu sorguluyor, canlıda o sütun yok — canlı ana
sayfanın, dağıtım yapıldığı andan beri sorgu hatası veriyor olması gerekir.

Düzeltildi (K45):

```
npm run dagitim:kontrol && prisma migrate deploy && prisma generate && next build
```

Sıra bilinçli: dev-seed kontrolü geçmeden veritabanına şema değişikliği
uygulanmaz; şema güncellenmeden de derleme yapılmaz.

**Bu düzeltme ancak yeni bir dağıtımla etkili olur.** Bu commit push edildiğinde
Vercel otomatik dağıtım yapacak ve bekleyen iki migration canlıya inecek.

---

## Hangi kararlar verildi ve neden

| # | Karar |
|---|---|
| K43 | `builds.resolution` eklendi, indeks kullanıcının çözünürlüğünde donar (K38 değişti) |
| K44 | `perf_index_snapshot` null olabilir, iGPU sistemler kaydedilebilir (K39 gevşedi) |
| K45 | Migration'lar dağıtım hattında çalışır |

K38 ve K39 silinmedi, "değiştirildi" işaretiyle yerinde duruyor.

**Çözünürlük çevirisi `data/to-engine.ts`'e girdi.** Prisma enum üyesi `R1440p`,
motorunki `1440p` (K7). Bu çeviri diğerlerinden farklı olarak **iki yönlü**:
çözünürlük hem okunuyor hem yazılıyor.

---

## Ne doğrulandı

Doğrulama için yine geçici bir rota açıldı, gerçek kod yolu çalıştırıldı,
sonra silindi.

**Ekran kartsız sistem artık kaydediliyor:**

```
iGPU SISTEM (ekran karti yok):
  kayit  : {"ok":true,"id":"526ncu"}
  okunan : cozunurluk=1440p | indeks=null | surum=v0.1 | toplam=2924500 | parca=6
```

Önceki oturumda aynı sistem `{"ok":false,"reason":"no_index"}` ile
reddediliyordu.

**Aynı parçalar, farklı çözünürlük, farklı dondurulmuş indeks:**

```
AYNI PARCALAR @ 1080p: indeks=79.8   (id 3dazgd)
AYNI PARCALAR @ 2160p: indeks=94.6   (id 666gq4)
```

İki kaydın toplam fiyatı aynı (12.734.500 kuruş), indeksi farklı. Sayılar
motorun testlerdeki değerleriyle birebir aynı.

**Migration öncesi kayıt bozulmadı:**

```
q8g23w: cozunurluk=1440p | indeks=60 | toplam=6279400
```

**Sayfalar:**

```
/sistem/526ncu  HTTP 200  "Performans tahmini için ekran kartı gerekiyor"
                          "1440p seçiliyken kaydedildi ... Sistem geçerli;
                           sadece hızı hakkında bir sayı üretilemiyor."
/sistem/666gq4  HTTP 200  94.6  ·  "4K için, motor sürümü v0.1 ile hesaplandı"
/sistem/3dazgd  HTTP 200  79.8  ·  "1080p için, motor sürümü v0.1 ile hesaplandı"
```

**Zincir:**

```
$ npx prisma migrate deploy   Applying `20260818172814_kayit_cozunurlugu_...`
$ npx prisma migrate status   Database schema is up to date!
$ npx tsc --noEmit            (çıktı yok)
$ npm run lint                (çıktı yok)
$ npm run sema:kontrol        SONUC: 70 kontrolun tamami gecti.
$ npm test                    105 passed (105)
$ npm run build               ✓ Compiled successfully
```

**Doğrulanmayan:** Canlı sitenin bu dağıtımdan sonraki hâli. Migration'ların
canlıya inip inmediğini ve ana sayfanın hatasız açıldığını dağıtım bittikten
sonra proje sahibi doğrulayacak.

**Geliştirme veritabanında kalanlar:** dört deneme sistemi (`q8g23w`, `526ncu`,
`3dazgd`, `666gq4`). Silinmedi — kayıtlı sistem sayfasının üç farklı hâlini
(indeksli, indekssiz, farklı çözünürlük) açıp görmek için duruyorlar.

---

## Açık kalan sorular

**S16 — ertelendi** (proje sahibinin kararı).
**S15 — açık:** darboğaz göstergesi çözünürlüğü hesaba katmıyor. Acil değil.

S14 ve S17 kapandı.

Güncel liste: `SORULAR.md`
