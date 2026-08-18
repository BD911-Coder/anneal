# 2026-08-18 — İlk migration, veritabanı ayakta

---

## Ne yapıldı

**1. `.env.local` gerçek değerlerle dolduruldu.** Supabase'in iki adresi:
havuzlanmış (6543, transaction mode) ve oturum (5432, session mode).

**2. Parolada percent-encode yapıldı.** Parola iki tane `#` içeriyordu.
Kodlanmasaydı URL ayrıştırıcı ilk `#`'ten sonrasını "fragment" sayacak, parola
`Q` olarak kesilecek ve kimlik doğrulama sessizce başarısız olacaktı.
`#` → `%23`. Diğer karakterler (`*`, `.`, `_`) URL'de geçerli, dokunulmadı.

**3. İlk migration çalıştırıldı:** `20260818102429_ilk_sema`.

**4. `scripts/db-check.mjs` iyileştirildi.** İlk çalıştırmada enum sorgusu şema
filtresi içermiyordu ve Supabase'in kendi `auth`/`storage` enum'larını da
listeliyordu (24 tip görünüyordu, gerçekte bizim 12). Sorgu `public` şemayla
sınırlandı. Ayrıca K7 takma adlarının veritabanına doğru indiğini doğrulayan
kontrol eklendi.

---

## Hangi kararlar verildi ve neden

Yeni kalıcı karar yok. Uygulanan kararlar: K19 (iki ayrı bağlantı adresi),
K20 (istemci `/data` altında).

**Migration `DIRECT_URL` üzerinden gitti** — K19'un pratikteki karşılığı.
Supabase'in oturum modu havuzu DDL'i sorunsuz kabul etti, gölge veritabanı
(shadow database) sorunu çıkmadı.

---

## Ne doğrulandı

**Bağlantı — her iki adres de:**

```
$ npm run db:kontrol
--- Baglanti ---
  [OK  ] DATABASE_URL (havuzlanmis) -> aws-0-eu-central-1.pooler.supabase.com:6543/postgres
         PostgreSQL 17.6 on x86_64-pc-linux-gnu
  [OK  ] DIRECT_URL (dogrudan) -> aws-0-eu-central-1.pooler.supabase.com:5432/postgres
         PostgreSQL 17.6 on x86_64-pc-linux-gnu
```

**Migration:**

```
$ npx prisma migrate dev --name ilk_sema
Applying migration `20260818102429_ilk_sema`
Your database is now in sync with your schema.
```

**17 tablonun 17'si, hepsi sorgulanabilir durumda (0 satır):**

```
benchmark_points  build_items  builds     case_specs  click_events
cpu_specs         feedback     games      gpu_specs   motherboard_specs
parts             perf_index   price_snapshots        psu_specs
ram_specs         raw_imports  storage_specs
```

**12 enum tipi (public şema):** BenchmarkSourceType, Confidence, CpuMemoryType,
FormFactor, ImportStatus, MemoryType, Modularity, PartCategory, Preset,
Resolution, Source, StorageType.

**K7 takma adları — veritabanındaki gerçek değerler:**

```
  [OK  ] Source.'dev-seed'
  [OK  ] CpuMemoryType.'DDR4/DDR5'
  [OK  ] FormFactor.'E-ATX'
  [OK  ] StorageType.'sata-ssd'
  [OK  ] Resolution.'1080p'

SONUC: 17 tablonun 17'i mevcut, 12 enum tipi olusmus, K7 takma adlari dogru.
```

Kodda `dev_seed` yazıyor ama veritabanına `dev-seed` olarak indi — K7 çalışıyor.

**İndeksler — SCHEMA.md bölüm 11 ile birebir, fazlası yok:**

```
  index  benchmark_points(gpu_part_id, game_id, resolution)
  index  parts(category)
  index  parts(source)
  UNIQUE perf_index(part_id, model_version)
  index  price_snapshots(part_id, collected_at)
  toplam: 5
```

`perf_index` tekillik kısıtı da veritabanında UNIQUE olarak duruyor — K14.

**`.env.local` commit'e girmedi:** `git check-ignore` ile doğrulandı.

---

## Açık kalan sorular

**1. S11 — Parola sohbet geçmişine girdi (yeni).** Bağlantı adresleri parolayla
birlikte yazışmada paylaşıldı. Depoya sızmadı — `.env.local` yok sayılıyor ve
push protection etkin — ama parolanın kendisi artık sohbet kaydında duruyor.
Supabase panelinden veritabanı parolasını yenilemek (rotate) temiz olan yol.
Yenilenirse `.env.local` güncellenmeli, başka hiçbir yerde kayıtlı değil.

**2. S4 — Test koşucusu**, motor adımında.

Güncel liste: `SORULAR.md`
