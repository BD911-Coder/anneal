# 2026-08-18 — Uyumluluk kuralları motoru

---

## Ne yapıldı

**1. `vitest` 4.1.10 kuruldu.** `vitest.config.mts` testleri `tests/` altıyla
sınırlıyor, ortam `node` — arayüz bileşeni test edilmediği için tarayıcı ortamı
kurulmadı. `npm test`, `npm run test:izle`.

**2. `engine/types.ts` yazıldı.** Motorun girdi tipleri. Hiçbir şey içe aktarmaz.
Sadece uyumluluk kurallarının kullandığı alanlar var — `EngineCpu` dört alan,
`EngineGpu` üç alan, vb. Parçaların hepsi opsiyonel: kullanıcı sistemi parça
parça topluyor, yarım sistem de kontrol edilebilmeli.

**3. `engine/compatibility.ts` yazıldı.** Altı engelleyici (C1–C6) ve beş uyarı
(W1–W5) kuralı. Çıktı `{ code, level, message, involved_part_ids[] }`.
Engelleyiciler uyarılardan önce sıralanıyor.

**4. `tests/compatibility.test.ts` yazıldı.** 46 test.

**5. `npm run sema:kontrol` genişletildi.** İki yeni kontrol grubu:
motor tipleri ↔ `SCHEMA.md` alan adı kontrolü ve `/engine` saflık kontrolü.

**6. `SCHEMA.md` bölüm 7 güncellendi.** W3 eşiği %15, ve GPU yokken C4'ün
`gpu.tdp_watt`'ı 0 sayacağı yazıldı.

---

## Hangi kararlar verildi ve neden

| # | Karar | Kim |
|---|---|---|
| K22 | Motor kendi sade tiplerini tanımlar, dönüştürücü arayüz adımına ertelendi | Proje sahibi |
| K23 | W3 eşiği %10 değil %15 | Proje sahibi |
| K24 | `/engine` saflık kontrolü betiğe eklendi | Claude |

**Girdi tipi tartışması.** Prisma tiplerini içe aktarma izni verilmişti ama
alınmadı. `import type` olsa bile motoru veritabanı şemasına yapıştırırdı:
mobilde Prisma istemcisini derlemek gerekirdi, testlerde 12 alanlı nesneler
kurmak zorunlu olurdu, iki motor sürümünü aynı girdiyle karşılaştırmak üretilmiş
bir artefakta bağımlı hale gelirdi. Bedeli alan adlarının iki yerde yazılı
olması — bu risk K22 kontrolüyle kapatıldı.

**Dönüştürücü yazılmadı.** Henüz veritabanından okuyan bir şey yok; şimdi yazmak
tahminle yazmak olurdu.

**Onaylanan dört varsayım:** eksik parça = kural atlanır; C4'te GPU yoksa
`tdp_watt` 0 sayılır; mesajlar Türkçe, `code` sabit; kategori başına tek parça
(bu sonuncusu S12 olarak ertelendi, depolamada çoklu disk yaygın).

---

## Ne doğrulandı

**46 test, hepsi geçiyor:**

```
$ npm test
 Test Files  1 passed (1)
      Tests  46 passed (46)
   Duration  384ms
```

Kapsam: on bir kuralın her biri için en az bir geçen ve bir kalan durum,
C4 sınır durumları, W3 eşik durumları, eksik parçalar, tip sisteminden
geçmeyen (null/undefined alanlı) veri, bulgu sıralaması ve biçimi.

**C4 sınır testleri** (cpu 120W + gpu 250W + 100 = 470; ×1.3 = **611W gerekli**):

| PSU | Beklenen | Sonuç |
|---|---|---|
| 610W | C4 hata | ✅ |
| 611W | geçer, W3 uyarısı | ✅ |
| 702W | W3 uyarısı (611 × 1.15 = 702.65) | ✅ |
| 703W | uyarı yok | ✅ |
| 850W | temiz | ✅ |

Ayrı olarak: `ceil` yuvarlaması (335 × 1.3 = 435.5 → 436) ve güç yetersizken
C4 ile W3'ün ikisinin birden üretilmediği test edildi.

**Şema ve saflık kontrolü — 60 kontrol:**

```
$ npm run sema:kontrol
--- Motor tipleri (K22: engine/types.ts <-> SCHEMA.md) ---
  [OK  ] K22 EngineCpu -> cpu_specs
  [OK  ] K22 EngineGpu -> gpu_specs
  [OK  ] K22 EngineMotherboard -> motherboard_specs
  [OK  ] K22 EngineRam -> ram_specs
  [OK  ] K22 EnginePsu -> psu_specs
  [OK  ] K22 EngineCase -> case_specs

--- /engine saflik kontrolu ---
  [OK  ] engine/compatibility.ts saf
  [OK  ] engine/types.ts saf

SONUC: 60 kontrolun tamami gecti.
```

**Yeni kontroller kasten bozularak test edildi.** Geçici kopyaya `EngineGpu`'ya
şemada olmayan bir alan ve `compatibility.ts`'e `@/data/client` içe aktarması
enjekte edildi:

```
  [HATA] engine/compatibility.ts saf -> /data veya /lib
SONUC: 2 SORUN (60 kontrol calisti)
  - K22 EngineGpu -> gpu_specs semada yok: uydurma_alan
  - engine/compatibility.ts saf /data veya /lib
çıkış kodu: 1
```

**Diğer:**

```
$ npx tsc --noEmit     (çıktı yok)
$ npm run lint         (çıktı yok)
$ npm run build        ✓ Compiled successfully in 454ms
```

Lint önce altı uyarı vermişti — testlerde "alanı çıkarmak için destructuring"
deseni kullanılmıştı. `{ ...uyumluSistem, gpu: undefined }` yazımına geçildi;
hem uyarı kalktı hem test daha okunur oldu.

---

## Açık kalan sorular

**1. S12 — Kategori başına tek parça varsayımı (ertelendi).** `BuildInput` her
kategoriden en fazla bir parça alıyor. Beta'daki on bir kural bunu gerektirmiyor
ama depolamada çoklu disk yaygın. Arayüz adımında yeniden bakılacak.

**2. Dönüştürücü henüz yok.** `/data` altında Prisma satırını `BuildInput`'a
çeviren fonksiyon arayüz adımında yazılacak (K22).

Güncel liste: `SORULAR.md`
