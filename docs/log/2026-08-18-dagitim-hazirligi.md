# 2026-08-18 — Dağıtım hazırlığı: robots, noindex, build hattı

> **Bu iş birimi yarım kaldı.** Vercel hesabı yok ve CLI oturumu kapalı;
> hesap açma ile kimlik doğrulama benim yapabileceğim işler değil. Koda
> bağlı her şey bitti ve doğrulandı. Kalan üç madde (proje bağlama, canlı
> ortam değişkenleri, canlı doğrulama) proje sahibini bekliyor.

---

## Ne yapıldı

**1. Arama motorlarına kapatıldı** (K30). İki katman:
`app/robots.ts` → `/robots.txt` `Disallow: /`, ve `app/layout.tsx` metadata →
`noindex, nofollow, nocache` + ayrıca `googlebot` etiketi.

**2. Dağıtım hattı yazıldı** (K31). `vercel.json`:

```
"buildCommand": "npm run dagitim:kontrol && prisma generate && next build"
```

**3. `docs/KARARLAR.md`** K30 ve K31.

**Yapılamayanlar:** Vercel projesini depoya bağlamak, canlı ortam
değişkenlerini tanımlamak, canlı adresi doğrulamak. Üçü de hesaba ve oturuma
bağlı. Adım adım talimat `SORULAR.md` S14'te.

---

## Hangi kararlar verildi ve neden

| # | Karar | Kim |
|---|---|---|
| K30 | Beta bitene kadar arama motorlarına kapalı | Proje sahibi |
| K31 | Dağıtım öncesi kontrol, build komutunun ilk adımı | Claude |

**Neden iki ayrı engelleme katmanı (K30):** `robots.txt` taramayı engeller,
`noindex` meta etiketi başka bir yerden link alınıp yine de taranırsa
indekslenmeyi engeller. Farklı işler yapıyorlar; biri diğerinin yerine geçmez.

**Neden kontrol ilk adım (K31):** Canlı veritabanında dev-seed varsa derleme
hiç başlamasın, boşuna süre harcanmasın. Ayrıca `prisma generate` de build
komutunda olmak zorunda: üretilen istemci `lib/generated/` altında ve
`.gitignore` içinde, depoda yok.

**`DEV_SEED_ALLOWED` Vercel'e yazılmayacak.** Yokluğu 4. katman korumasının
kendisi: seed script'i bayrak olmadan çalışmayı reddediyor (K28).

---

## Ne doğrulandı

**Vercel'in çalıştıracağı komut yerelde birebir simüle edildi — canlı
`DATABASE_URL` ile:**

```
$ DATABASE_URL='<canlı>' npm run dagitim:kontrol && npx prisma generate && npx next build
Hedef: aws-0-eu-central-1.pooler.supabase.com/postgres
12 tablo tarandi.
dev-seed satiri yok. Dagitim serbest.
✔ Generated Prisma Client (7.9.1)
✓ Compiled successfully

Route (app)
┌ ƒ /
├ ○ /_not-found
└ ○ /robots.txt

zincir çıkış kodu: 0
```

**Kirli veritabanı hedef gösterilince zincir duruyor** — 3. katmanın hatta
gerçekten bağlı olduğunun kanıtı:

```
$ DATABASE_URL='<geliştirme>' npm run dagitim:kontrol && npx prisma generate && npx next build
DAGITIM DURDU.
Canli veritabaninda 58 adet dev-seed satiri var:
zincir çıkış kodu: 1
next build çalıştı mı?: 0 kez
```

Derleme hiç başlamadı.

**robots.txt ve noindex çıktısı:**

```
$ curl /robots.txt          (HTTP 200)
User-Agent: *
Disallow: /

$ curl /  ->  <meta name="robots" content="noindex, nofollow, nocache"/>
              <meta name="googlebot" content="noindex, nofollow"/>
```

---

## Açık kalan sorular

**S14 — Vercel hesabı ve dağıtım bağlantısı (engelleyici).** Adım adım
talimat `SORULAR.md` içinde. Özet: `vercel.com`'da GitHub ile kaydol, depoyu
içe aktar, Production kapsamında `DATABASE_URL` ve `DIRECT_URL` tanımla,
`DEV_SEED_ALLOWED` tanımlama.

**Yan not:** Canlı veritabanı parolası bir kez sohbet geçmişine girmişti
(K21'de yenilenmemesine karar verilmişti). Vercel'e yazarken yenilemek iyi bir
fırsat — parola başka hiçbir yerde kayıtlı değil, yenilenirse sadece Vercel'e
yazılır.

Güncel liste: `SORULAR.md`
