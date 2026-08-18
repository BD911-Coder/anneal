# 2026-08-18 — Önizleme dağıtımı riski

Riski proje sahibi buldu: `prisma migrate deploy` build komutuna eklendikten
sonra (K45), ortam değişkenleri "Production and Preview" kapsamında kaldığı
sürece bir önizleme dağıtımı **canlı veritabanına migration uygulayabilirdi**.

Kapsam Production'a çekildi. Bu rapor, ondan sonra ne olduğunu ölçer.

---

## Bu deliği mevcut korumalar kapatmıyordu

`dagitim:kontrol` (dev-seed korumasının 3. katmanı) canlı veritabanında
dev-seed satırı arar. Canlı veritabanı **temiz**, yani kontrol **geçerdi** ve
`migrate deploy` çalışırdı.

Yani 3. katman bu riske karşı değil, başka bir riske karşı yazılmıştı.
Kapsamı daraltmak tek gerçek çözümdü.

---

## Önizleme dağıtımı şimdi ne yapıyor: ölçüldü

Veritabanı adresi olmadan build **iki bağımsız noktada** duruyor.

**1. `dagitim:kontrol` — çıkış kodu 1:**

```
$ env -u DATABASE_URL -u DIRECT_URL node scripts/check-deploy.mjs
DATABASE_URL tanimli degil.
Bu kontrol dagitim hedefine bakar; adres ortam degiskeninden gelir.
cikis kodu: 1
```

Zincir burada kesiliyor — `migrate deploy` adımına **hiç ulaşılmıyor**.

**2. O adım atlansa bile `next build` — çıkış kodu 1:**

`.env` ve `.env.local` geçici olarak kenara alınıp Vercel'in önizleme ortamı
birebir simüle edildi:

```
$ env -u DATABASE_URL -u DIRECT_URL npx next build
Error: Failed to collect configuration for /
  [cause]: Error: DATABASE_URL tanımlı değil.   (data/client.ts:14)
Error: Failed to collect page data for /sistem/[id]
next build cikis kodu: 1
```

Sayfalar `force-dynamic` olsa da Next derleme sırasında modülleri içe aktarıyor
ve Prisma istemcisi orada kuruluyor.

Her iki dosya da testten sonra geri kondu (88 ve 881 bayt, orijinalleriyle
aynı).

**Sonuç:** Önizleme dağıtımı **başarısız olur**. Tehlikeli bir şey yapmaz,
sadece kırmızı görünür.

---

## Eklenen koruma: migration ayrı bir betikten geçiyor

`scripts/migrate-deploy.mjs` — `VERCEL_ENV` tanımlı ve `production` değilse
migration uygulamaz, 0 ile çıkar (hata değil, bilinçli atlama).

Build komutu:

```
npm run dagitim:kontrol && npm run dagitim:migration && prisma generate && next build
```

**Neden panel ayarı yetmiyor da bir de betik var:** K46 bir Vercel panel
ayarıdır. İleride biri "önizlemede de veritabanı lazım" diye kapsamı geri
genişletirse bu depoda hiçbir iz bırakmaz. Betik depoda durur; değişirse
commit'te görünür. dev-seed korumasının dört katmanıyla aynı mantık: geri
alınamayan işlemler tek bir ayara bağlanmaz.

**Üç durumda da ölçüldü:**

```
VERCEL_ENV=preview     -> "Migration uygulanmadi: VERCEL_ENV='preview'"    çıkış 0
VERCEL_ENV=production  -> "3 migrations found... No pending migrations"     çıkış 0
VERCEL_ENV tanımsız    -> yerel çalıştırma, uygular                          çıkış 0
```

Üçüncüsü bilinçli: yerelde kısıtlama yok, geliştirici kendi veritabanına
uygulayabilmeli.

---

## Kararlar

| # | Karar | Kim |
|---|---|---|
| K46 | Ortam değişkenleri yalnızca Production kapsamında | Proje sahibi |
| K47 | Önizleme dağıtımları derlenmez; migration'lar ayrı betikten geçer | Claude |

---

## Ne doğrulandı

```
$ npx tsc --noEmit       (çıktı yok)
$ npm run lint           (çıktı yok)
$ npm run sema:kontrol   SONUC: 70 kontrolun tamami gecti.
$ npm test               105 passed (105)
$ npm run build          ✓ Compiled successfully
```

**Doğrulanmayan:** Vercel'deki gerçek davranış. Panel ayarını ve önizleme
dağıtımının nasıl göründüğünü buradan göremiyorum; bir sonraki dal itişinde
proje sahibi görecek.

---

## Açık kalan sorular

**S18 (yeni) — Önizleme dağıtımları kapatılsın mı?** Önerim: kapat. Bu projede
bir dalın çalıştığı yerelde doğrulanıyor, önizleme adresine ihtiyaç yok.
Vercel → Settings → Git → Ignored Build Step → `[ "$VERCEL_ENV" != "production" ]`.
Alternatifler ve doğrulama yöntemi `SORULAR.md`'de.

**Bekleyen:** Canlı sayfa kontrolü (proje sahibi sonra verecek). Bir önceki
oturumda düzeltilen migration hattının canlıda işe yarayıp yaramadığı hâlâ
doğrulanmadı.

**S16 — ertelendi. S15 — açık.**

Güncel liste: `SORULAR.md`
