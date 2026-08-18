# 2026-08-18 — İlk çalışan sayfa: seed, veri katmanı, sistem oluşturucu

---

## Ne yapıldı

**1. dev-seed verisi.** `scripts/seed.mts`, `npm run db:seed`. 29 parça:
4 işlemci, 4 ekran kartı, 5 anakart, 4 bellek, 4 güç kaynağı, 4 kasa, 4 disk.
Tümü `source='dev-seed'`, `confidence='low'`. Upsert olduğu için tekrar
çalıştırılabilir.

Veri, **her kuralı tetikleyebilecek** şekilde seçildi: farklı soketler (C1),
DDR4 bellek + DDR5 anakart (C2), 4 modüllü kit + 2 yuvalı anakart (C3), 575W
ekran kartı + 550W güç kaynağı (C4), 357 mm kart + 330 mm kasa (C5), E-ATX
anakart + ITX kasa (C6), 7200 MHz bellek + 5600 MHz anakart (W1), 128 GB kit +
64 GB sınırı (W2), dar paylı güç kaynağı (W3), iGPU'suz işlemci (W4), 200 mm
güç kaynağı + 130 mm kasa (W5).

**2. Veri katmanı.** `data/to-engine.ts` (dönüştürücü, K22'nin ikinci yarısı) ve
`data/parts.ts` (katalog sorgusu + dev-seed filtresi).

**3. İlk çalışan sayfa.** `app/page.tsx` sunucu bileşeni katalogu okuyor,
`app/builder.tsx` istemci bileşeni seçim tutup `checkCompatibility` çağırıyor.

---

## Hangi kararlar verildi ve neden

| # | Karar | Kim |
|---|---|---|
| K25 | `data/client` sadece `/data` içinden içe aktarılır | Claude |
| K26 | Depolama motora girmez, arayüzde çoklu (S12 kapanışı) | Claude, öneri onaylandı |
| K27 | Prisma istemcisi `.ts` uzantılı içe aktarma üretir | Claude (teknik zorunluluk) |
| K28 | Seed `DEV_SEED_ALLOWED` bayrağı olmadan çalışmaz | Claude |

**S12 nasıl kapandı:** Soru "çoklu disk destekleyelim mi" değil, "motorun girdi
tipi çoklu parça almalı mı" idi. Beta'daki on bir kuralın hiçbiri depolamayı
kullanmıyor — `BuildInput`'ta `storage` alanı zaten yok. Yani çoklu disk motoru
hiç ilgilendirmiyor, arayüz meselesi. Arayüzde çözüldü, motor değişmedi.

**dev-seed korumasının dört katmanı — nerede duruyor:**

| Katman | Nerede | Durum |
|---|---|---|
| 1. `source='dev-seed'` damgası | `scripts/seed.mts` | ✅ |
| 2. Veri katmanında otomatik filtre | `data/parts.ts` `visibleParts()` | ✅ ölçüldü |
| 3. Dağıtım öncesi kontrol | — | ❌ yok, bkz. S13 |
| 4. Seed canlıya bağlıysa reddeder | `scripts/seed.mts` `refuseIfLive()` | ✅ ölçüldü |

---

## Ne doğrulandı

**Seed korumaları — reddettiği ölçüldü:**

```
$ DEV_SEED_ALLOWED=false node scripts/seed.mts
Seed çalıştırılmadı. Sebep:
  - DEV_SEED_ALLOWED bayrağı 'true' değil
çıkış kodu: 1

$ NODE_ENV=production node scripts/seed.mts
Seed çalıştırılmadı. Sebep:
  - NODE_ENV=production
çıkış kodu: 1
```

**Seed çalıştı:**

```
$ npm run db:seed
Hedef: aws-0-eu-central-1.pooler.supabase.com
Kaynak damgası: source='dev-seed', confidence='low'
  gpu 4   cpu 4   motherboard 5   ram 4   psu 4   storage 4   case 4
Toplam 29 parça, 29 tanesi dev-seed.
```

**Sayfa tarayıcıda açıldı ve motor uçtan uca çalıştı.**

Kasten uyumsuz sistem (i5-14600K + RTX 5090 + B650 anakart + DDR4 bellek +
550W güç + NR200P kasa) — **5 hata + 1 uyarı**:

```
C1  İşlemci soketi LGA1700, anakart soketi AM5. Bu ikisi takılamaz.
C2  Bellek DDR4, anakart DDR5 destekliyor. Bu ikisi takılamaz.
C4  Güç kaynağı 550W, bu sistem için en az 1040W gerekiyor.
C5  Ekran kartı 357 mm, kasaya en fazla 330 mm sığıyor.
C6  Anakart ATX boyutunda, kasa şunları destekliyor: ITX.
W5  Güç kaynağı 140 mm, kasa için belirtilen sınır 130 mm.
```

C4 hesabı elle doğrulandı: 125 + 575 + 100 = 800; 800 × 1.3 = **1040W**.

Uyumlu sistem (Ryzen 5 7600 + RTX 5060 + B650 + DDR5-6000 + RM850e + North):
**"Sorun bulunamadı."**

Dar paylı sistem (i9-15900K + RTX 5070 + RM850e) — sadece W3:
```
W3  Güç kaynağı 850W, gereken 784W. Pay dar...
```
253 + 250 + 100 = 603; × 1.3 = 784; 784 ≤ 850 < 901 → doğru.

**dev-seed filtresi canlı ortamda ölçüldü.** Üretim sunucusu ayağa kaldırılıp
sayfa çekildi:

```
HTTP 200
option sayısı: 6                      (yalnızca "— seçilmedi —" yer tutucuları)
dev-seed parça adı: görünmüyor (doğru)
```

Geliştirmede 29 parça, canlıda 0. Filtre çalışıyor.

**Diğer:**

```
$ npm run sema:kontrol   SONUC: 61 kontrolun tamami gecti.
$ npm test               46 passed (46)
$ npx tsc --noEmit       (çıktı yok)
$ npm run lint           (çıktı yok)
$ npm run build          ✓ Compiled successfully
```

`sema:kontrol`'e yeni kontrol eklendi (K25): `data/client` `/data` dışından
içe aktarılıyor mu.

---

## Açık kalan sorular

**1. S13 — dev-seed verisi ileride canlı olacak veritabanında duruyor.**
29 sahte parça Supabase'deki tek veritabanına yazıldı. Aynı veritabanı canlıya
çıkarsa dev-seed korumasının 3. katmanı (dağıtım öncesi kontrol) dağıtımı
durdurmak zorunda. 2. katman çalışıyor ama o *görünürlüğü* engelliyor,
*varlığı* değil.

Önerim: geliştirme için ayrı bir Supabase projesi. Karar bekliyor.

**2. Dağıtım öncesi kontrol (3. katman) henüz yazılmadı.** S13 kararı verilince
yazılacak — hangi veritabanına bakacağı o karara bağlı.

Güncel liste: `SORULAR.md`
