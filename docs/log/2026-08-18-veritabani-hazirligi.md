# 2026-08-18 — Veritabanı bağlantısı: hazırlık

> **Bu iş birimi yarım kaldı.** Migration çalıştırılamadı — Supabase bağlantı
> bilgileri henüz verilmedi. Yapılabilen her şey yapıldı ve doğrulandı;
> eksik olan tek şey `.env.local` içindeki gerçek değerler.

---

## Ne yapıldı

**1. Sürücü paketleri kuruldu.** `@prisma/adapter-pg` 7.9.1 ve `pg` 8.23.0.
Prisma 7 doğrudan bağlanmıyor, bir sürücü adaptörü istiyor. Ek tip paketi
(`@types/pg`) gerekmedi.

**2. `.env.example` gerçek değişken adlarıyla yenilendi.** `DATABASE_URL` ve
`DIRECT_URL`, hangisinin ne için olduğu ve percent-encode notuyla birlikte.

**3. `.env.local` oluşturuldu** — şu an yer tutucu değerlerle. `.gitignore`
tarafından yok sayıldığı doğrulandı.

**4. `prisma.config.ts` güncellendi.** Artık `.env.local`'i de okuyor ve
migration'lar için `DIRECT_URL` kullanıyor.

**5. `data/client.ts` yazıldı.** Veritabanına erişen tek nokta. Havuzlanmış
bağlantıyı (`DATABASE_URL`) adaptörle kullanıyor, geliştirmede bağlantı
birikmesin diye tek örnek (singleton) tutuyor.

**6. `scripts/db-check.mjs` yazıldı** (`npm run db:kontrol`). Her iki bağlantıyı
ayrı ayrı deniyor, `public` şemadaki tabloları `prisma/schema.prisma`'daki
`@@map` adlarıyla karşılaştırıyor, satır sayılarını ve enum tiplerini yazdırıyor.
Parolayı çıktıya sızdırmıyor — adresten sadece sunucu, port ve veritabanı adı
gösteriliyor.

**7. `npm run db:migrate` script'i eklendi** (`prisma migrate dev`).

---

## Hangi kararlar verildi ve neden

`docs/KARARLAR.md`'ye üç yeni madde:

| # | Karar | Kim |
|---|---|---|
| K18 | İki secret scanning ayarının peşine düşülmeyecek — ücretli paket | Proje sahibi |
| K19 | İki ayrı bağlantı adresi: `DATABASE_URL` (havuzlanmış) / `DIRECT_URL` (doğrudan) | Claude |
| K20 | Prisma istemcisi `/data` altında, `/lib` altında değil | Claude |

**K19'un gerekçesi:** Supabase havuzlanmış bağlantıyı pgbouncer üzerinden verir;
şema değişikliği bu yol üzerinden güvenilir çalışmaz. Uygulama tarafında ise
havuzlama gerekli. İkisini ayırmak hangi işin hangi yoldan gittiğini açık kılıyor.

**K20'nin gerekçesi:** CLAUDE.md `/data`'yı veri erişim katmanı olarak tanımlıyor.
Bağlantıyı `/lib`'den açmak, `/engine`'in yanlışlıkla `/lib` üzerinden
veritabanına ulaşmasına kapı aralardı.

---

## Ne doğrulandı

```
$ npx tsc --noEmit
(çıktı yok — pg tipleri sorun çıkarmadı, @types/pg gerekmedi)

$ npm run build
✓ Compiled successfully in 457ms

$ npm run sema:kontrol
SONUC: 52 kontrolun tamami gecti.

$ git check-ignore -v .env.local
.gitignore:3:.env.*     .env.local
```

**Doğrulanamayan:** bağlantının kendisi, migration ve 17 tablonun oluşması.
Bunlar gerçek bağlantı bilgisi gerektiriyor. `npm run db:kontrol` bunu
gösterecek komut — henüz çalıştırılmadı.

---

## Açık kalan sorular

**1. S10 — Supabase bağlantı bilgileri bekleniyor (engelleyici).**
Gereken iki değer Supabase panelinde **Project Settings → Database** altında:
`DATABASE_URL` için "Connection pooling → Transaction" (port 6543),
`DIRECT_URL` için "Direct connection" (port 5432).

Önerilen yol: `.env.local` dosyası proje sahibi tarafından doldurulsun, böylece
parola sohbet geçmişine hiç girmez. Alternatifi adresleri bana vermek.

**2. S4 — Test koşucusu**, motor adımında.

Güncel liste: `SORULAR.md`
