# Anneal — Açık Sorular

Cevap bekleyen kararların güncel listesi. Kök dizinde durmasının sebebi:
proje sahibinin kullandığı okuma yolu `docs/` klasör sayfasına erişemiyor.

**Nasıl işler:**

- Yeni bir soru çıktığında buraya eklenir.
- Cevaplanınca madde **Kapanmış sorular** bölümüne taşınır, cevabı yazılır.
- Kalıcı bir karara dönüşen cevap ayrıca `docs/KARARLAR.md`'ye geçer.

`docs/log/` altındaki raporlar o günün fotoğrafıdır ve değişmez;
bu dosya güncel durumu gösterir.

Son güncelleme: 2026-08-18

---

## Açık sorular

### S2 — Prisma sürücü paketi izni

Prisma 7 tek başına veritabanına bağlanamıyor; `@prisma/adapter-pg` + `pg`
paketleri gerekiyor.

**Durum:** Ertelendi — veritabanı adımında sorulacak.

---

### S4 — Test koşucusu

`/tests` şu an sadece README. Motor kodu (`compatibility.ts`, `performance.ts`)
yazılırken bir koşucu gerekecek, muhtemelen `vitest`.

**Durum:** Ertelendi — motor adımında sorulacak.

---

### S9 — İki secret scanning ayarı açılamadı

`secret_scanning_non_provider_patterns` ve `secret_scanning_validity_checks`
açılmak istendi. GitHub API isteği **HTTP 200 döndürüyor ama ayar `disabled`
kalıyor** — sessizce reddediliyor. Büyük ihtimalle ücretli özellik
(GitHub Secret Protection) gerektiriyor.

Etkin olanlar: secret scanning, push protection, dependabot security updates.

**Karar gereken:** Peşine düşülsün mü (GitHub arayüzünden denenip ücretli olup
olmadığı görülebilir), yoksa mevcut üç koruma yeterli mi sayılsın.

Kaynak: `docs/log/2026-08-18-bekleyen-kararlar.md`

---

## Kapanmış sorular

### S1 — Şemadaki altı indeks ✅ 2026-08-18

**Cevap:** `raw_imports(status)` silindi, diğer beşi kaldı ve `SCHEMA.md`
bölüm 11'e yazıldı. `CLAUDE.md`'ye kural eklendi: belgelenmiş sorgu yolları
üzerindeki indeksler erken optimizasyon sayılmaz, ancak `SCHEMA.md`'de tanımlı
olmak zorundadır. → `docs/KARARLAR.md` K15

### S3 — `npm audit` üç yüksek seviye uyarı ✅ 2026-08-18

**Cevap:** Prisma 7'de kalınıyor, dokunulmayacak. Uyarı yalnızca geliştirme
aracını etkiliyor. → `docs/KARARLAR.md` K9

### S5 — Şema kararlarının taşınması ✅ 2026-08-18

**Cevap:** Onaylandı. Kararların tam metni `docs/KARARLAR.md`'de kalır,
`SCHEMA.md` bölüm 12 işaretçi olarak durur.

### S6 — Karşılaştırma betiği depoda değil ✅ 2026-08-18

**Cevap:** `scripts/check-schema.mjs` olarak depoya alındı, `npm run sema:kontrol`
ile çalışıyor. Python yerine Node'a çevrildi. → `docs/KARARLAR.md` K17

### S7 — GitHub güvenlik ayarları ✅ 2026-08-18 (kısmen)

**Cevap:** Üçü de açılmak istendi. `dependabot_security_updates` açıldı
(önce vulnerability alerts açılması gerekiyordu). Diğer ikisi açılamadı —
devamı S9'da.

### S8 — `main` dalı korumasız ✅ 2026-08-18

**Cevap:** Dal koruması kuruldu. Force-push ve dal silme engellendi, yöneticiler
dahil. PR zorunluluğu konmadı — tek kişilik projede gereksiz tören.
→ `docs/KARARLAR.md` K16
