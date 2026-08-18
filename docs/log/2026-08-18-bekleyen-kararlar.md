# 2026-08-18 — Bekleyen kararların kapatılması

---

## Ne yapıldı

**1. `perf_index` düzeltildi.** `updated_at` kaldırıldı, (`part_id`,
`model_version`) üzerine tekillik kısıtı eklendi. Provenance dörtlüsü eklenmedi.

**2. İndeksler karara bağlandı.** `raw_imports(status)` silindi. Kalan beş indeks
`SCHEMA.md`'ye yeni **bölüm 11 — İndeksler** olarak yazıldı; her biri hangi sorgu
yolunu hızlandırdığıyla birlikte. Eski "Kararlar" bölümü 12'ye kaydı.

**3. `CLAUDE.md`'ye indeks kuralı eklendi.** Kalite bölümünde, "erken performans
optimizasyonu kullanılmaz" maddesinin hemen altına istisna olarak.

**4. Karşılaştırma betiği depoya alındı.** `scripts/check-schema.mjs`,
`npm run sema:kontrol`.

**5. GitHub güvenlik ayarları.** `dependabot_security_updates` açıldı. Diğer iki
ayar açılamadı (aşağıda).

**6. `main` dal koruması kuruldu.** Force-push ve dal silme engellendi,
yöneticiler dahil. PR zorunluluğu konmadı.

---

## Hangi kararlar verildi ve neden

`docs/KARARLAR.md`'ye dört yeni madde eklendi, bir madde değiştirildi:

| # | Karar | Kim |
|---|---|---|
| K8 | **Kısmen değiştirildi** — `perf_index`'in `updated_at`'i kaldırıldı, dörtlü alan kararı geçerli | — |
| K14 | `perf_index`: `updated_at` yok, (`part_id`, `model_version`) tekil | Proje sahibi |
| K15 | İndeksler `SCHEMA.md`'de tanımlı olmak zorundadır | Proje sahibi |
| K16 | Dal koruması: force-push/silme engelli, PR zorunlu değil | Proje sahibi |
| K17 | Kontrol betiği Node ile yazıldı, Python ile değil | Claude |

**K17'nin gerekçesi:** Betiğin ilk sürümü Python'du. Depoya alınırken Node'a
çevrildi — projede zaten Node var, ikinci bir dil çalıştırma zorunluluğu
getirmemek için. Bağımlılığı yok, hata bulursa `1` ile çıkıyor, böylece ileride
dağıtım öncesi kontrolde kullanılabilir.

**`SCHEMA.md` bölüm numaraları değişti:** yeni bölüm 11 "İndeksler" eklendiği için
"Kararlar" 11'den 12'ye kaydı. Bu numaraya atıf yapan tek yer `SORULAR.md` idi,
o da bu iş biriminde yeniden yazıldı. `docs/log/` altındaki eski raporlar
o günün fotoğrafı olduğu için dokunulmadı.

---

## Ne doğrulandı

**Şema kontrolü — 52 kontrol:**

```
$ npm run sema:kontrol
SCHEMA.md tablo sayisi : 17
Prisma tablo sayisi    : 17
...
  [OK  ] K14 perf_index: updated_at yok
  [OK  ] K14 perf_index: (part_id, model_version) unique

--- Indeksler (K15: SCHEMA.md bolum 11'de tanimli olmali) ---
  [OK  ] K15 benchmark_points(gpu_part_id,game_id,resolution) belgelenmis
  [OK  ] K15 parts(category) belgelenmis
  [OK  ] K15 parts(source) belgelenmis
  [OK  ] K15 perf_index(part_id,model_version) belgelenmis
  [OK  ] K15 price_snapshots(part_id,collected_at) belgelenmis
  (+ ters yön: her belgelenmiş indeks şemada var mı)

SONUC: 52 kontrolun tamami gecti.
```

**Betiğin kendisi de test edildi.** Geçen bir test, betiğin çalıştığını
kanıtlamaz — bu yüzden geçici bir kopyaya kasten üç hata enjekte edildi
(belgelenmemiş indeks, `perf_index`'e `updated_at`, uydurma alan):

```
SONUC: 3 SORUN (53 kontrol calisti)
  - ram_specs: FAZLA uydurma_alan
  - K14 perf_index: updated_at yok
  - K15 raw_imports(status) belgelenmis

bozuk şema çıkış kodu: 1
gerçek şema çıkış kodu: 0
```

**Prisma ve derleme:**

```
$ npx prisma validate
The schema at prisma\schema.prisma is valid 🚀

$ npx prisma generate
✔ Generated Prisma Client (7.9.1)

$ npm run build
✓ Compiled successfully in 442ms

$ npx tsc --noEmit
(çıktı yok)

$ npm run lint
(çıktı yok)
```

**GitHub ayarları:**

```
$ gh api repos/BD911-Coder/anneal --jq '.security_and_analysis'
{"dependabot_security_updates":{"status":"enabled"},
 "secret_scanning":{"status":"enabled"},
 "secret_scanning_push_protection":{"status":"enabled"},
 "secret_scanning_non_provider_patterns":{"status":"disabled"},
 "secret_scanning_validity_checks":{"status":"disabled"}}

$ gh api repos/BD911-Coder/anneal/branches/main/protection --jq '...'
{"admin_dahil":true,"dal_silme_izni":false,"force_push_izni":false,"pr_zorunlu":false}
```

---

## Açık kalan sorular

**1. İki secret scanning ayarı açılamadı (yeni: S9).**
`secret_scanning_non_provider_patterns` ve `secret_scanning_validity_checks`
istendi ama açılmadı. GitHub API isteği **HTTP 200 döndürüyor, ayar yine de
`disabled` kalıyor** — sessizce reddediliyor, hata mesajı vermiyor. Büyük
ihtimalle ücretli özellik (GitHub Secret Protection).

`dependabot_security_updates` için önce `vulnerability-alerts` açılması
gerekiyordu; o adım atılınca sorunsuz etkinleşti.

**2. Devredenler (bu adımda bilinçli olarak yapılmadı):**

- Prisma sürücü paketi (`@prisma/adapter-pg` + `pg`) → veritabanı adımında
- `npm audit` uyarısı → Prisma 7'de kalınıyor, dokunulmayacak (K9)
- Test koşucusu → motor adımında

Güncel liste: `SORULAR.md`
