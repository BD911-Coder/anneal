# 2026-08-18 — Depo kurulumu, proje iskeleti ve şema v1.1

> Not: Bu rapor geriye dönük yazıldı. Raporlama kuralı iş bittikten sonra
> konuldu; bundan sonrakiler iş biriminin sonunda yazılacak.

İlgili commit'ler: `dc3982b`, `d876cb0`, `6332d7b`, `f2c5f38`

---

## Ne yapıldı

**1. Depo kuruldu.** `CLAUDE.md` ve `SCHEMA.md` başlıklarına proje adı "Anneal"
eklendi. Git başlatıldı, `.gitignore` yazıldı, GitHub deposuna bağlanıp push edildi.
Depo push öncesinde tamamen boştu, üzerine yazılan bir şey olmadı.

**2. `.gitattributes` eklendi.** Windows CRLF kaynaklı sahte dosya farklarını önlemek için.

**3. Proje iskeleti kuruldu.** Next.js 16 (App Router) + TypeScript `strict` +
Tailwind 4 + Prisma 7. Klasör yapısı açıldı: `/app` `/engine` `/data` `/lib`
`/scripts` `/tests`, her biri ne iş yaptığını anlatan bir README ile.
`SCHEMA.md`'deki 17 tablonun tamamı `prisma/schema.prisma` içine yazıldı.

**4. Şema kararları uygulandı, `SCHEMA.md` v1.1 oldu.** Belirsiz kalan beş nokta
proje sahibi tarafından karara bağlandı, hem belgeye hem şemaya işlendi.

---

## Hangi kararlar verildi ve neden

Kararların tamamı gerekçeleriyle `docs/KARARLAR.md` dosyasındadır (K1–K11).
Özet:

| # | Karar | Kim verdi |
|---|---|---|
| K1 | Append-only tablolarda `updated_at` yok | Proje sahibi |
| K2 | Spec tablolarında `part_id` birincil anahtar; `build_items` bileşik anahtar | Proje sahibi |
| K3 | Olgusal iddia taşıyan tabloda dörtlü alan bulunur | Proje sahibi |
| K4 | `benchmark_points.source_url` zorunlu | Proje sahibi |
| K5 | `supported_form_factors` → `FormFactor[]` | Proje sahibi |
| K6 | `raw_imports.source` serbest metin (istisna) | Proje sahibi |
| K7 | Prisma enum takma adları (teknik zorunluluk) | Claude |
| K8 | `perf_index` ne append-only ne olgusal iddia taşır | Claude |
| K9 | Prisma 7'de kalınır, sürüm düşürülmez | Proje sahibi |
| K10 | Bağlantı adresi `prisma.config.ts` içinde | Claude (teknik zorunluluk) |
| K11 | Satır sonları depoda LF | Claude |

**Kurulan paketler:** `next`, `react`, `react-dom` (çatı ve arayüz kütüphanesi),
`typescript` + `@types/*` (tip kontrolü), `tailwindcss` + `@tailwindcss/postcss`
(stil), `eslint` + `eslint-config-next` (statik kontrol), `prisma` +
`@prisma/client` (şema ve veritabanı erişimi). Başka paket eklenmedi;
`dotenv` gerekiyordu, Node'un yerleşik `loadEnvFile` fonksiyonuyla çözüldü.

---

## Ne doğrulandı

```
$ npx prisma validate
The schema at prisma\schema.prisma is valid 🚀

$ npx prisma generate
✔ Generated Prisma Client (7.9.1) to .\lib\generated\prisma

$ npm run build
✓ Compiled successfully
✓ Generating static pages (4/4)

$ npx tsc --noEmit
(çıktı yok — hata yok)

$ npm run lint
(çıktı yok — uyarı yok)
```

**Şema karşılaştırması** (SCHEMA.md ↔ prisma/schema.prisma, ayrıştırıcı betikle,
gözle değil):

```
SCHEMA.md tablo sayisi : 17
Prisma tablo sayisi    : 17
Eksik alan: yok    Fazla alan: yok
Kararlar (K1-K6): 39 kontrolun 39'u gecti
SONUC: Tum kontroller gecti.
```

**Veritabanı bağlantısı kurulmadı, migration çalıştırılmadı.**
`prisma validate` ve `generate` bağlantı gerektirmiyor.

---

## Açık kalan sorular

**1. Şemadaki altı indeks onaylanmadı.** `parts(category)`, `parts(source)`,
`price_snapshots(part_id, collected_at)`, `benchmark_points(gpu_part_id, game_id,
resolution)`, `perf_index(part_id, model_version)`, `raw_imports(status)`.

`SCHEMA.md`'de tanımlı değiller ve CLAUDE.md "erken performans optimizasyonu
kullanılmaz" diyor. İkisi savunulabilir (`parts(source)` dev-seed filtresinin
çalıştığı sütun, `price_snapshots(part_id, collected_at)` "güncel fiyat" sorgusunun
tanımı); diğer dördü gerçekten erken. **Karar bekliyor.**

**2. Prisma 7 tek başına veritabanına bağlanamıyor.** Sürücü paketi
(`@prisma/adapter-pg` + `pg`) gerekecek. Veritabanı adımında sorulacak.

**3. `npm audit` üç yüksek seviye uyarı veriyor.** Kaynak: Prisma CLI'ın
bağımlılığı `deepmerge-ts`. Sadece geliştirme aracında, canlıda çalışan kodda
değil. K9 gereği dokunulmadı.

**4. Test koşucusu kurulmadı.** `/tests` şimdilik sadece README. Motor kodu
yazılırken kurulacak, paket izni istenecek.
