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

### S10 — Supabase bağlantı bilgileri bekleniyor 🔴 ENGELLEYİCİ

Sürücü paketleri kuruldu, yapılandırma hazır, `.env.local` oluşturuldu — ama
içi **yer tutucu**. Gerçek değerler olmadan migration çalıştırılamaz.

Gereken iki değer (Supabase panelinde **Project Settings → Database**):

| Değişken | Supabase'deki adı | Port |
|---|---|---|
| `DATABASE_URL` | Connection pooling → Transaction | 6543 |
| `DIRECT_URL` | Direct connection | 5432 |

**İki yol var:**

1. **Önerilen:** `.env.local` dosyasını kendin doldur, sonra bana "hazır" de.
   Parola sohbet geçmişine hiç girmez.
2. Adresleri bana ver, ben dosyaya yazayım.

Parolada `@ : / ? # [ ]` gibi karakter varsa percent-encode edilmeli
(`p@ss` → `p%40ss`). İstersen ham parolayı ben kodlarım.

---

### S4 — Test koşucusu

`/tests` şu an sadece README. Motor kodu (`compatibility.ts`, `performance.ts`)
yazılırken bir koşucu gerekecek, muhtemelen `vitest`.

**Durum:** Ertelendi — motor adımında sorulacak.

---

## Kapanmış sorular

### S1 — Şemadaki altı indeks ✅ 2026-08-18

**Cevap:** `raw_imports(status)` silindi, diğer beşi kaldı ve `SCHEMA.md`
bölüm 11'e yazıldı. `CLAUDE.md`'ye kural eklendi: belgelenmiş sorgu yolları
üzerindeki indeksler erken optimizasyon sayılmaz, ancak `SCHEMA.md`'de tanımlı
olmak zorundadır. → `docs/KARARLAR.md` K15

### S2 — Prisma sürücü paketi izni ✅ 2026-08-18

**Cevap:** Kuruldu — `@prisma/adapter-pg` 7.9.1 ve `pg` 8.23.0. Ek tip paketi
(`@types/pg`) gerekmedi, `tsc` temiz geçti. → `docs/KARARLAR.md` K19, K20

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

**Cevap:** `dependabot_security_updates` açıldı (önce vulnerability alerts
gerekiyordu). Diğer ikisi açılamadı — S9'da kapandı.

### S8 — `main` dalı korumasız ✅ 2026-08-18

**Cevap:** Dal koruması kuruldu. Force-push ve dal silme engellendi, yöneticiler
dahil. PR zorunluluğu konmadı — tek kişilik projede gereksiz tören.
→ `docs/KARARLAR.md` K16

### S9 — İki secret scanning ayarı açılamadı ✅ 2026-08-18

**Cevap:** Peşine düşülmeyecek. İki ayar GitHub'ın ücretli **Secret Protection**
paketine ait; API 200 dönüp ayarı sessizce yok sayıyor. Mevcut üç koruma
(secret scanning, push protection, dependabot) yeterli sayıldı.
→ `docs/KARARLAR.md` K18
