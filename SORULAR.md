# Anneal — Açık Sorular

Cevap bekleyen kararların güncel listesi. Kök dizinde durmasının sebebi:
göz önünde olsun, aranmasın.

**Nasıl işler:**

- Yeni bir soru çıktığında buraya eklenir.
- Cevaplanınca madde **Kapanmış sorular** bölümüne taşınır, cevabı yazılır.
- Kalıcı bir karara dönüşen cevap ayrıca `docs/KARARLAR.md`'ye geçer.

`docs/log/` altındaki raporlar o günün fotoğrafıdır ve değişmez;
bu dosya güncel durumu gösterir.

Son güncelleme: 2026-08-18

---

## Açık sorular

### S1 — Şemadaki altı indeks onaylanmadı

`prisma/schema.prisma` içinde `SCHEMA.md`'de tanımlı olmayan altı indeks var:

| İndeks | Savunulabilir mi? |
|---|---|
| `parts(source)` | Evet — dev-seed filtresinin çalıştığı sütun |
| `price_snapshots(part_id, collected_at)` | Evet — "güncel fiyat = en son satır" sorgusunun tanımı |
| `parts(category)` | Hayır, erken |
| `benchmark_points(gpu_part_id, game_id, resolution)` | Hayır, erken |
| `perf_index(part_id, model_version)` | Hayır, erken |
| `raw_imports(status)` | Hayır, erken |

CLAUDE.md "erken performans optimizasyonu kullanılmaz" diyor.

**Seçenekler:** hepsi kalsın / sadece ilk ikisi kalsın / hepsi silinsin.
**Önerim:** ilk ikisi kalsın, diğer dördü silinsin.

Kaynak: `docs/log/2026-08-18-iskelet-ve-sema.md`

---

### S2 — Prisma 7 sürücü paketi izni

Prisma 7 tek başına veritabanına bağlanamıyor; `@prisma/adapter-pg` + `pg`
paketleri gerekiyor. Veritabanı adımına gelindiğinde kurulması şart.

**Karar gereken:** iki paketin kurulmasına onay.

Kaynak: `docs/log/2026-08-18-iskelet-ve-sema.md`

---

### S3 — `npm audit` üç yüksek seviye uyarı

Kaynak: Prisma CLI'ın bağımlılığı `deepmerge-ts`. Sadece geliştirme aracını
etkiliyor, canlıda çalışan koda girmiyor. Çözümü Prisma 6'ya düşmek olurdu;
K9 gereği yapılmadı.

**Karar gereken:** olduğu gibi bırakılsın mı, yoksa Prisma yeni sürüm
çıkardığında mı bakılsın.

Kaynak: `docs/log/2026-08-18-iskelet-ve-sema.md`

---

### S4 — Test koşucusu kurulmadı

`/tests` şu an sadece README. Motor kodu (`compatibility.ts`, `performance.ts`)
yazılırken bir koşucu gerekecek.

**Karar gereken:** paket izni (muhtemelen `vitest`), motor adımında sorulacak.

Kaynak: `docs/log/2026-08-18-iskelet-ve-sema.md`

---

### S5 — Şema kararlarının taşınması onaylanmadı

Şema kararlarının (K1–K7) tam metni `SCHEMA.md` bölüm 11'den
`docs/KARARLAR.md`'ye taşındı. `SCHEMA.md` bölüm 11 artık kısa bir işaretçi.

Gerekçe: aynı metin iki dosyada durursa bir karar değiştiğinde ayrışır.

**Karar gereken:** taşıma onaylanıyor mu, yoksa tam metin `SCHEMA.md`'ye
geri mi dönsün.

Kaynak: `docs/log/2026-08-18-karar-yetkisi-ve-raporlama.md`

---

### S6 — Karşılaştırma betiği depoda değil

`SCHEMA.md` ↔ `prisma/schema.prisma` eşleşmesini denetleyen betik (17 tablo,
39 karar kontrolü) geçici klasörde duruyor, depoda yok.

`/scripts` altına alınırsa her şema değişikliğinde tekrar çalıştırılabilir.

**Karar gereken:** betik depoya alınsın mı.

Kaynak: `docs/log/2026-08-18-karar-yetkisi-ve-raporlama.md`

---

### S7 — Üç GitHub güvenlik ayarı kapalı

Etkin olanlar: secret scanning, push protection.
Kapalı olanlar:

- `dependabot_security_updates` — bağımlılık açıkları için otomatik PR
- `secret_scanning_non_provider_patterns` — bilinen sağlayıcılara ait olmayan desenler
- `secret_scanning_validity_checks` — bulunan anahtarın hâlâ geçerli olup olmadığı

**Karar gereken:** açılsın mı.

Kaynak: `docs/log/2026-08-18-depo-gorunurlugu-ve-kural-guncellemesi.md`

---

### S8 — `main` dalı korumasız

Depo public ama `main`'e doğrudan push edilebiliyor. CLAUDE.md "`main` her
zaman çalışır durumdadır" diyor; dal koruması bunu kuraldan mekanizmaya çevirir.

**Dikkat:** kurulursa Git işlemlerini ben yürüttüğüm için benim akışımı da
etkiler — her değişiklik dal + PR üzerinden gitmek zorunda kalır.

**Karar gereken:** dal koruması kurulsun mu.

Kaynak: `docs/log/2026-08-18-depo-gorunurlugu-ve-kural-guncellemesi.md`

---

## Kapanmış sorular

Henüz yok.
