# 2026-08-18 — İş yükü alanı (workload): şema hazırlığı

Yeni özellik yok, davranış değişikliği yok. `benchmark_points` ve `perf_index`
tabloları artık ölçümün hangi iş yüküne ait olduğunu taşıyor. Beta'da tek
kullanılan değer `gaming`.

`SCHEMA.md` v1.1 → **v1.2**.

---

## Ne yapıldı

### 1. `SCHEMA.md`

**`benchmark_points`** ve **`perf_index`** tablolarına `workload` alanı:
`gaming`, `ai_inference`, `video_encode`, `productivity`.

**`perf_index` tekillik kısıtı** (`part_id`, `model_version`) →
(`part_id`, `workload`, `model_version`). Bölüm 11'deki indeks satırı da
buna göre güncellendi.

**Bölüm 2'ye not eklendi:** spec alanları uyumluluk içindir, performans tahmini
için kullanılmaz. Çekirdek sayısı, saat hızı, VRAM, CUDA çekirdeği gibi
alanlardan FPS veya indeks türetilmeyecek.

**Bölüm 10'a** (beta'ya dahil olmayanlar) çoklu iş yükü skorları eklendi.

### 2. `docs/KARARLAR.md`

| # | Karar |
|---|---|
| K35 | `workload` alanı; tekillik üç sütunlu; varsayılan değer yok |
| K36 | Çoklu iş yükü skorları hedefte var, beta kapsamı dışında |
| K37 | Spec alanları uyumluluk içindir, performans tahmini için kullanılmaz |

K14 "değiştirildi" olarak işaretlendi — tekillik kısmı K35'e devredildi,
`updated_at`'in ve dörtlü alanın bulunmaması kararları aynen geçerli.

### 3. Migration

`prisma/migrations/20260818152034_is_yuku_alani/migration.sql` — **elle yazıldı.**

Prisma'nın kendi ürettiği hâli çalışmıyordu:

```
⚠️ We found changes that cannot be executed:
  • Step 3 Added the required column `workload` to the `perf_index` table
    without a default value. There are 8 rows in this table.
```

Çözüm: sütun geçici bir varsayılanla eklenip hemen ardından varsayılan
düşürülüyor.

```sql
ALTER TABLE "perf_index" ADD COLUMN "workload" "Workload" NOT NULL DEFAULT 'gaming';
ALTER TABLE "perf_index" ALTER COLUMN "workload" DROP DEFAULT;
```

Mevcut 8 satır `gaming` oldu — bu uydurma bir etiket değil, o satırlar
gerçekten oyun indeksleri.

---

## Hangi kararlar verildi ve neden

**Varsayılan değer bilinçli olarak bırakılmadı.** Şemada `@default(gaming)`
olsaydı migration tek satır olurdu ve hiçbir kod değişmezdi. Yapılmadı: alanın
var olma sebebi "bu ölçüm hangi iş yükünün" sorusunu cevaplamak; varsayılan
olsaydı iş yükünü söylemeyi unutan kayıt sessizce `gaming` etiketi alırdı.
Projenin sessiz yanlışa karşı tavrı bunu dışlıyor.

**Neden şimdi, kullanılmayacakken.** Alan sonradan eklenseydi, bugün girilen
ölçümlerin hangi iş yüküne ait olduğu geriye dönük **tahmin edilmek** zorunda
kalırdı. Ölçüm verisi elle toplanıyor ve geriye dönük etiketlenemez.

**`workload` neden tekilliğin parçası.** Bir kart oyunda güçlü, yapay zekâ
çıkarımında vasat olabilir. Kısıt iki sütunlu kalsaydı ikinci iş yükünün
indeksi birincinin üzerine yazılırdı — ve bu sessizce olurdu.

---

## Kod tarafında yapmak zorunda kaldığım dört değişiklik

"Kod yazma" demiştin. Şema değişikliği dört yeri kırdı; hepsi ya derlemeyi ya
da doğrulamayı durduruyordu, `main`'in çalışır kalması için düzeltildi.
Hiçbirinde davranış değişmedi.

| Dosya | Ne değişti | Neden zorunlu |
|---|---|---|
| `prisma/schema.prisma` | `Workload` enum'ı, iki alan, yeni `@@unique` | Migration'ın kaynağı |
| `scripts/seed.mts` | `workload: "gaming"` + tekillik seçicisinin yeni adı | `tsc` hata veriyordu: `part_id_model_version` artık yok |
| `scripts/check-schema.mjs` | K14 tekillik denetimi → K35 denetimi, 7 yeni kontrol | Betik eski kısıtı arıyordu, `sema:kontrol` kırmızıya düşüyordu |
| `data/perf.ts` | Sorguya `workload: "gaming"` filtresi | Zorunlu değildi ama ikinci iş yükü eklendiğinde aynı parçanın iki satırı gelir, biri diğerinin üzerine yazılırdı — sessiz hata |

Son satır tartışmaya açık: bugün hiçbir şeyi bozmuyordu, çünkü `gaming` dışında
satır yok. Bir satırlık bir tuzağı açıkta bırakmamak için ekledim. İstemezsen
tek satır geri alınır.

---

## Ne doğrulandı

**Migration uygulandı, mevcut satırlar doğru dolduruldu:**

```
$ npx prisma migrate deploy
Applying migration `20260818152034_is_yuku_alani`
All migrations have been successfully applied.

$ npx prisma migrate status
Database schema is up to date!

perf_index: 8 satir
  nvidia-rtx-5090          100  gaming  v0.1
  intel-core-i9-15900k      92  gaming  v0.1
  ... (8 satırın hepsi gaming)
workload dagilimi: gaming=8
```

**Yeni tekillik gerçekten üç sütunlu — ölçüldü:**

```
TEKILLIK TESTI: nvidia-rtx-5090 icin 2 satir -> gaming:100, ai_inference:88
```

Aynı parça, aynı `model_version`, farklı iş yükü → iki satır bir arada
duruyor. Eski kısıtta bu mümkün değildi.

```
Ayni (part_id, workload, model_version) ikinci kez yazilamadi - kisit calisiyor
```

Deneme satırı silindi, tabloda 8 satır kaldı.

**Varsayılan gerçekten düşürüldü:**

```
  benchmark_points   varsayilan: YOK   null olabilir: NO
  perf_index         varsayilan: YOK   null olabilir: NO

Is yuku yazilmadan satir EKLENEMEDI:
  null value in column "workload" of relation "perf_index" violates not-null constraint
```

İş yükü söylenmeden satır yazılamıyor — K35'in istediği tam olarak buydu.

**Zincir:**

```
$ npx tsc --noEmit       (çıktı yok)
$ npm run lint           (çıktı yok)
$ npm run sema:kontrol   SONUC: 69 kontrolun tamami gecti.   (önceki: 62)
                         [OK] K35 perf_index: (part_id, workload, model_version) unique
                         [OK] K35 benchmark_points: workload varsayilani yok
                         [OK] K35 Workload enum dort degerli
$ npm test               74 passed (74)
$ npm run build          ✓ Compiled successfully
$ npm run db:seed        Performans indeksi: 8 parça, model_version 'v0.1'
                         Fiyat: 87 snapshot (0 yeni)
$ npm run dev + curl /   HTTP 200, 29 fiyat, 8 indeks sayfaya ulaşıyor
```

Sayfa değişiklikten önceki gibi çalışıyor — beklenen buydu, `workload` filtresi
zaten tek var olan değeri seçiyor.

---

## Açık kalan sorular

**S16 (yeni) — Oyun dışı ölçümlerde `game_id` ne olacak?** `benchmark_points`
şimdi dört iş yükünü kabul ediyor ama `game_id` hâlâ zorunlu; oyun dışı bir
ölçümün oyunu yok. Beta'da sorun çıkarmıyor. Üç seçenek `SORULAR.md`'de yazılı.
Şema "hazır" ama bu köşesi eksik — bunu bilerek bıraktım.

**S15, S14** — değişmedi.

Güncel liste: `SORULAR.md`
