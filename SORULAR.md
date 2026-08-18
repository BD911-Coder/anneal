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

### S16 — Oyun dışı ölçümlerde `game_id` ne olacak? ⏸️ ERTELENDİ (2026-08-18)

**Proje sahibinin kararı:** Şimdi karar verilmeyecek. Beta'da tek iş yükü var
ve `game_id` zorunluluğu **doğru davranıştır** — oyun ölçümünün oyunu olmalı.
İkinci iş yükü eklendiğinde bakılacak. Soru kapanmadı, ertelendi.

---

`benchmark_points.workload` eklendi ve dört değeri var, ama tablonun `game_id`
alanı **zorunlu**. Oyun dışı bir ölçümün (`ai_inference`, `video_encode`,
`productivity`) oyunu yok.

Beta'da sorun çıkarmıyor: yalnızca `gaming` kullanılıyor ve her satırın oyunu
var. İş yükü genişletildiğinde ilk çözülecek şey bu.

**Seçenekler:**

1. `game_id` opsiyonel yapılır (`FK?`) — en küçük değişiklik, ama "oyun ölçümünün
   oyunu olmalı" garantisi veritabanı seviyesinde kaybolur.
2. Ayrı bir `workload_targets` tablosu açılır: her iş yükünün kendi hedefi olur
   (oyun, model, kodek profili). Doğru olan bu ama beta'da karşılığı yok.
3. Oyun dışı ölçümler ayrı bir tabloya yazılır.

Acil değil, karar iş yükü genişletildiğinde verilir.
→ `docs/KARARLAR.md` K35, K36

### S15 — Darboğaz göstergesi çözünürlüğü hesaba katmıyor

Motor v0.1'de darboğaz, iki indeksin **ham farkına** bakıyor: fark 15'i geçerse
zayıf olan taraf "sınırlıyor" sayılıyor. Bu, `SCHEMA.md` bölüm 8'deki somut
kuralın birebir uygulanması.

**Sorun:** Aynı sistem 1080p'de ve 4K'da aynı darboğaz uyarısını alıyor. Oysa
4K'da işlemcinin payı yalnızca %12; orada 20 puan zayıf bir işlemci pratikte
sorun çıkarmaz. Şu an kullanıcı 4K seçtiğinde de "İşlemci sınırlıyor" yazısını
görüyor ve bu yazı o çözünürlükte yanıltıcı.

`SCHEMA.md` bölüm 8'de bunu ima eden yarım bir satır var
(`beklenen_cpu = gpu_idx * (w_cpu / w_gpu ile ölçeklenmiş eşik)`) ama tamamlanmamış
ve altındaki somut kural onu kullanmıyor. Daha spesifik olan kural uygulandı.

**Karar gereken:** Eşik çözünürlüğe göre değişsin mi? Örneğin 1080p'de 15,
1440p'de 25, 4K'da 40 puan. Bu bir motor davranışı değişikliğidir; yapılırsa
`model_version` `v0.2` olur ve eski hesaplar `v0.1` olarak durmaya devam eder.

Acil değil — beta bunu bilerek kullanabilir. → `docs/KARARLAR.md` K33

---

## Kapanmış sorular

### S17 — `builds` tablosuna `resolution` alanı ✅ 2026-08-18

**Cevap:** Alan eklendi (2. seçenek). Dondurulan indeks artık sabit bir
referansta değil, kullanıcının kaydettiği çözünürlükte hesaplanıyor; kayıtlı
sistem sayfası hangi çözünürlük olduğunu yazıyor. `REFERENCE_RESOLUTION` sabiti
koddan kaldırıldı. Migration `20260818172814_kayit_cozunurlugu_ve_indekssiz_sistem`;
mevcut kayıtlar `1440p` ile dolduruldu — eski davranış zaten oydu.
→ `docs/KARARLAR.md` K43 (K38'i değiştirir)

### S14 — Vercel hesabı ve dağıtım bağlantısı ✅ 2026-08-18

**Cevap:** Site canlıda. Proje sahibi Vercel hesabını açtı, depoyu bağladı ve
dağıtımı tarayıcıdan yaptı. Ortam değişkenleri Vercel'de Production kapsamında
tanımlı; `DEV_SEED_ALLOWED` **tanımlanmadı** — yokluğu 4. katman korumasıdır.

**İlk deneme `dagitim:kontrol`'e takılıp durdu, bağlantı düzeltilince geçti.**
Yani dev-seed korumasının 3. katmanı yazılı olmakla kalmadı, gerçek dağıtım
hattında da çalıştığını kanıtladı.

Canlıda 0 parça — beklenen: canlı veritabanında dev-seed verisi yok ve gerçek
veri girişi henüz yapılmadı (CSV içe aktarma ertelenmişti).
→ `docs/KARARLAR.md` K45

### S13 — dev-seed verisi canlı olacak veritabanında duruyor ✅ 2026-08-18

**Cevap:** Ayrı bir geliştirme veritabanı açıldı (1. seçenek). `.env.local`
artık yalnızca geliştirmeyi gösteriyor; canlı bağlantı bilgileri hiçbir yerel
dosyada durmuyor, dağıtım platformunda tutulacak. Canlı veritabanındaki 58
dev-seed satırı silindi. Dağıtım öncesi kontrol (3. katman) yazıldı:
`npm run dagitim:kontrol`. → `docs/KARARLAR.md` K29

### S12 — Kategori başına tek parça varsayımı ✅ 2026-08-18

**Cevap:** `BuildInput`'ta `storage` alanı yok ve olmayacak — beta'daki on bir
kuralın hiçbiri depolamayı kullanmıyor, yani motor depolamayı hiç görmüyor.
Çoklu disk arayüzde çözüldü: kullanıcı istediği kadar disk seçiyor, seçim sistem
listesinde görünüyor, motora gitmiyor. Depolama kuralı gerektiğinde
`storage: EngineStorage[]` dizi olarak eklenecek. → `docs/KARARLAR.md` K26

### S11 — Veritabanı parolası sohbet geçmişine girdi ✅ 2026-08-18

**Cevap:** Yenilenmeyecek. Parola depoya sızmadı — `.env.local` yok sayılıyor
(`git check-ignore` ile doğrulandı), commit diff'i tarandı, push protection
etkin. → `docs/KARARLAR.md` K21

### S4 — Test koşucusu ✅ 2026-08-18

**Cevap:** `vitest` 4.1.10 kuruldu. `vitest.config.mts` testleri `tests/` altıyla
sınırlıyor, ortam `node` — arayüz bileşeni test edilmediği için tarayıcı ortamı
kurulmadı. `npm test` ve `npm run test:izle`.

### S10 — Supabase bağlantı bilgileri ✅ 2026-08-18

**Cevap:** Bilgiler verildi, `.env.local` dolduruldu, migration
(`20260818102429_ilk_sema`) çalıştı. 17 tablo, 12 enum ve 5 indeks oluştu;
`npm run db:kontrol` hepsini doğruluyor. Paroladaki iki `#` percent-encode
edildi (`%23`) — kodlanmasaydı parola ilk `#`'te kesilecekti.

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
