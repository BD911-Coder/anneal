# 2026-08-18 — Karar yetkisi ve raporlama düzeni

---

## Ne yapıldı

**1. `CLAUDE.md`'ye iki bölüm eklendi.**

- **Karar yetkisi** — "Kimle çalışıyorsun" bölümünün ardına. Hangi kararların
  tek başıma verilip sadece raporlanacağı, hangilerinde durup soracağım
  yazılı hale geldi.
- **Raporlama** — Git bölümünün ardına. Yerleşimin sebebi: commit'le birlikte
  yazılacak bir çıktıyı tanımlıyor, oturum sonu soruları da hemen üstünde.

**2. `docs/KARARLAR.md` oluşturuldu.** Bugüne kadar verilen 11 kalıcı karar
(K1–K11) tarih ve gerekçeyle yazıldı, kimin verdiği belirtildi.

**3. `docs/log/` açıldı.** Bugünün işi için iki rapor yazıldı; ilki geriye dönük
olduğunu kendi içinde belirtiyor.

---

## Hangi kararlar verildi ve neden

**Şema kararları `SCHEMA.md`'den `docs/KARARLAR.md`'ye taşındı.**

`SCHEMA.md` bölüm 11 kararların tam metnini içeriyordu. Yeni kural kalıcı
kararların yerini `docs/KARARLAR.md` olarak belirleyince aynı metin iki dosyada
durur hale geldi. Kopyalamak yerine taşıdım: bir karar değiştiğinde iki dosyanın
ayrışması, hangisinin doğru olduğunun belirsizleşmesi demektir.

`SCHEMA.md` bölüm 11 yerinde duruyor ama artık kısa bir işaretçi. İş bölümü:

- `SCHEMA.md` → **ne** olduğu (alan modeli, tek kaynak)
- `docs/KARARLAR.md` → belirsizliklerin **neden** öyle çözüldüğü

`prisma/schema.prisma` içindeki "SCHEMA.md bölüm 11" atıfları da güncellendi.

Bu, alan ekleme/çıkarma olmadığı için "Karar yetkisi" bölümündeki *kendi başına
karar ver* kapsamında görüldü (klasör içi düzen). Yanlışsa geri alınması kolay.

---

## Ne doğrulandı

```
$ npx prisma validate
The schema at prisma\schema.prisma is valid 🚀

$ npm run build
✓ Compiled successfully

$ npx tsc --noEmit
(çıktı yok — hata yok)
```

Şema karşılaştırma betiği tekrar çalıştırıldı — belge yeniden düzenlendikten
sonra da alan eşleşmesinin bozulmadığını görmek için:

```
SCHEMA.md tablo sayisi : 17
Prisma tablo sayisi    : 17
Eksik alan: yok    Fazla alan: yok
Kararlar (K1-K6): 39 kontrolun 39'u gecti
SONUC: Tum kontroller gecti.
```

Şema dosyalarının içeriği bu iş biriminde değişmedi; sadece yorum satırlarındaki
atıflar güncellendi.

---

## Açık kalan sorular

**1. Şema kararları taşındı — onaylıyor musun?** `SCHEMA.md` bölüm 11 artık tam
metin değil işaretçi. Tam metnin belgede kalmasını istersen geri alırım.

**2. Önceki rapordaki dört açık madde duruyor:** indeks onayı, Prisma sürücü
paketi, `npm audit` uyarısı, test koşucusu.
Bkz. `docs/log/2026-08-18-iskelet-ve-sema.md`.

**3. Karşılaştırma betiği depoda değil.** Şema ↔ belge eşleşmesini denetleyen
betik şu an geçici klasörde duruyor. `/scripts` altına alınması işe yarar
(her şema değişikliğinde tekrar çalıştırılabilir), ama bu bir araç kurma kararı
— istersen bir sonraki adımda yaparım.
