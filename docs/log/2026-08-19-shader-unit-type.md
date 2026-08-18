# 2026-08-19 — shader_unit_type: birimi satırın kendisi söylüyor

---

## Ne yapıldı

**`gpu_specs.shader_unit_type` eklendi** (K57). Enum: `cuda_core`,
`stream_processor`, `xe_vector_engine`. Opsiyonel, ama `shader_units` doluysa
dolu olmak zorunda. Migration `20260818230404_shader_unit_type`.

**Intel'in Xe Vector Engines sayısı artık yazılı.** Önceki adımda boş
bırakılmıştı (S23); şimdi ham haliyle `shader_units`'e giriyor ve tipi
`xe_vector_engine` oluyor.

**Kalıcı kural yazıldı** (K58, `CLAUDE.md` "Veri kuralları"):

> Performans ölçekleme modeli `shader_units`'i yalnızca aynı mimari içinde
> kullanabilir. Farklı marka ya da farklı nesil arasında bu alanla
> karşılaştırma yapılmaz.

**`npm run sema:kontrol`'e kontrol eklendi:** `shader_units` dolu olan her CSV
satırında `shader_unit_type` da dolu olmalı.

---

## Hangi kararlar verildi ve neden

**K57 — proje sahibinin kararı.** Boş bırakmak bilgiyi tamamen atardı; tipsiz
ham sayı yazmak sessiz yanlış karşılaştırmaya kapı açardı. Tip etiketi kısıtı
**yapısal** hale getiriyor: sayının ne saydığını satırın kendisi söylüyor,
kodu yazanın hatırlamasına bırakılmıyor.

**K58 — kalıcı kural.** K37 ve K51'in doğal sonucu ama artık açıkça yazılı.
`shader_unit_type` kuralın ihlal edilip edilmediğini kontrol edilebilir kılıyor:
iki satırın tipi farklıysa karşılaştırma geçersizdir.

---

## Ne doğrulandı

```
$ npm run parca:aktar
OZET: 0 yeni, 61 guncellendi, 0 atlandi (dusuk guvenilirlik), 0 hata.

veritabanı, gpu_specs.shader_unit_type dağılımı:
  cuda_core: 30    stream_processor: 23    xe_vector_engine: 7
  spec siz gpu: 0
```

```
$ npm run sema:kontrol
--- shader_units / shader_unit_type (K57) ---
  [OK  ] K57 gpu-amd.csv: her shader_units'in tipi var
  [OK  ] K57 gpu-intel.csv: her shader_units'in tipi var
  [OK  ] K57 gpu-nvidia.csv: her shader_units'in tipi var
SONUC: 73 kontrolun tamami gecti.

$ npm test               107 passed (107)
$ npx tsc --noEmit       (çıktı yok)
```

---

## İki tökezleme

**1. Prisma istemcisi yine yenilenmedi.** `prisma migrate dev` sonrası istemci
yeni sütunu tanımadı, içe aktarma `Unknown argument shader_unit_type` verdi.
`npx prisma generate` elle çalıştırılınca geçti. **İkinci kez oluyor**, bu
yüzden `CLAUDE.md` araç notlarına yazıldı.

Bu kez yarım kayıt kalmadı — geçen sefer eklenen `$transaction` sarmalayıcısı
işini yaptı (`spec siz gpu: 0`).

**2. `SCHEMA.md`'ye yazdığım cümle ayrıştırıcıyı yanılttı.** Satır
``**`shader_units` markalar arası...`` şeklinde başlıyordu; `sema:kontrol`'ün
tablo adı deseni (`**\`ad\``) bunu yeni bir tablo sandı ve "Sadece SCHEMA.md'de:
shader_units" hatası verdi. Cümle yeniden yazıldı.

---

## Açık kalan sorular

**S23 kapandı.** S22, S18, S16, S15 değişmedi.

Güncel liste: `SORULAR.md`
