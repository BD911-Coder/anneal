# 2026-08-19 — Zorunluluk ölçütü, AMD kartlarının içeri alınması

---

## Ne yapıldı

**1. `pcie_version` ve `recommended_psu_watt` opsiyonel oldu** (K56).
Migration `20260818224819_gpu_pcie_ve_psu_opsiyonel`.

**2. Genel kural kondu ve iki yere yazıldı.** `CLAUDE.md` "Kalite" bölümü ve
`docs/KARARLAR.md` K56:

> Bir alan ancak bir uyumluluk kuralı ya da arayüz tarafından kullanılıyorsa
> zorunlu olabilir. Yeni bir zorunlu alan önerirken "hangi kural bunu
> kullanıyor?" sorusu cevaplanmak zorundadır.

**3. 23 AMD kartı içe aktarıldı.** Veritabanında artık 54 `manufacturer`
kaynaklı parça var.

**4. `npm run sema:kontrol`'e yeni kontrol eklendi.** Zorunlu spec alanları
`engine/` ya da `app/` içinde kullanılıyor mu — kullanılmıyorsa **uyarı** basar.

**5. İçe aktarmada bir bütünlük açığı kapatıldı.** `parts` ve spec satırı artık
tek işlemde yazılıyor.

---

## Hangi kararlar verildi ve neden

**K56 — proje sahibinin kararı.** Gerekçe: şema tek üreticinin sayfa yapısına
göre kurulmuştu. NVIDIA PCIe sürümü veriyor, AMD vermiyor; AMD bant genişliği
veriyor, NVIDIA vermiyor. Kaynağa göre değişen bir şeye "zorunlu" denemez.

Ölçüt uygulanabilir çıktı: bu iki alan hiçbir kuralda ve arayüzde
kullanılmıyordu, zorunlulukları hiçbir şeyi korumuyordu.

**İşlem sarmalayıcı — benim kararım.** Aşağıdaki olaydan sonra eklendi.

---

## Yaptığım hata ve düzeltmesi

**Migration'dan sonra Prisma istemcisini yenilemeden içe aktarma çalıştırdım.**
`prisma migrate dev` istemciyi normalde yeniler ama bu çalıştırmada eski
istemci devrede kaldı ve `recommended_psu_watt: null` değerini reddetti.

Sonuç: `parts` satırı yazıldı, `gpu_specs` satırı yazılamadı.
**22 parça spec'siz kaldı.**

```
$ select p.id from parts p left join gpu_specs g on g.part_id=p.id
  where p.category='gpu' and g.part_id is null
spec satiri olmayan gpu: 22
```

Bu, "0 yeni, 31 guncellendi, 23 hata" özetinin altında görünmüyordu — özet
satırı hata sayısını veriyor ama yarım kalmış yazımı göstermiyordu. Fark
etmemin sebebi `manufacturer kaynakli parca: 54` sayısının hata sayısıyla
çelişmesiydi.

**İki adımda düzeltildi:**

1. **Kalıcı önlem:** `parts` ve spec yazımı `prisma.$transaction` içine alındı.
   Spec yazımı patlarsa parça satırı da geri alınır; yarım kayıt kalmaz.
2. **Veri düzeltmesi:** İstemci yenilendi, içe aktarma tekrar çalıştırıldı.

```
$ npm run parca:aktar
OZET: 0 yeni, 54 guncellendi, 0 atlandi (dusuk guvenilirlik), 0 hata.

spec satiri olmayan gpu: 0
spec satiri olmayan cpu: 0
```

---

## Ne doğrulandı

**AMD kartları içeri girdi:**

```
$ npm run parca:aktar
gpu-amd.csv (gpu) — 23 satir
  [GUNCEL] amd-rx-9070-xt — degisen: chipset, length_mm, pcie_version,
           shader_units, boost_clock_mhz, memory_bandwidth_gbs, source, ...
  [GUNCEL] amd-rx-9070 — degisiklik yok
  ... 23 satirin 23'u
OZET: 0 yeni, 54 guncellendi, 0 atlandi, 0 hata.
```

`amd-rx-9070-xt`'de değişen alanların listelenmesinin sebebi: o slug dev-seed
verisinde de vardı, gerçek veriyle değiştirildi (K54).

**Veritabanı durumu:**

```
  manufacturer: 54
  dev-seed: 25
  pcie_version bos gpu_specs: 23   (AMD kartlari)
  spec satiri olmayan parca: 0
```

**Yeni kontrol çalışıyor ve 14 alan buldu:**

```
$ npm run sema:kontrol
--- Zorunlu alan kullanimi (K56) ---
  [UYARI] 14 zorunlu alan hicbir kural ya da arayuzde kullanilmiyor:
          gpu_specs.chipset, vram_gb, vram_type
          cpu_specs.cores, threads, base_clock_mhz, boost_clock_mhz
          motherboard_specs.chipset, m2_slots
          ram_specs.cas_latency
          psu_specs.efficiency_rating, modularity
          storage_specs.interface
          case_specs.max_cpu_cooler_height_mm

SONUC: 70 kontrolun tamami gecti.
çıkış kodu: 0
```

**Uyarı, hata değil** — çıkış kodu 0. Kullanılmayan zorunlu alan bir tasarım
kokusudur, kırık kod değil; dağıtımı durdurmamalı.

İlk sürümde `part` ilişki alanları da listeleniyordu (21 uyarı). İlişki alanı
veritabanı sütunu değil; ayrıştırıcının zaten sütunları ayıklayan listesi
kullanılarak elendi.

**Diğer:**

```
$ npm test               107 passed (107)
$ npx tsc --noEmit       (çıktı yok)
$ npm run lint           (çıktı yok)
$ npm run build          ✓ Compiled successfully
```

---

## Açık kalan sorular

**S22 (yeni)** — Kontrolün bulduğu 14 zorunlu alan. Hepsi aynı değil:
`vram_gb`/`vram_type`/`chipset` arayüzde gösterilmesi planlanıyorsa zorunlu
kalmaları savunulabilir; `cas_latency`, `m2_slots`, `efficiency_rating` gibi
alanlar için böyle bir plan yok. Acil değil — şu an hiçbir veri girişini
engellemiyor.

**S21 kapandı.** S18, S16, S15 değişmedi.

Güncel liste: `SORULAR.md`
