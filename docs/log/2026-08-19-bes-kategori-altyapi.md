# 2026-08-19 — Fiziksel ölçü kuralları, beş kategori için içe aktarma

> **Bu iş birimi eksik bitti.** Altyapı tamam ve doğrulandı; veri toplama
> 74 parçanın **10'unda** durdu. Sebebi ve kalanın planı aşağıda.

---

## Ne yapıldı

**1. Üç kalıcı kural yazıldı** (K59, K60, K61) — `docs/KARARLAR.md` ve
`CLAUDE.md` "Veri kuralları → Fiziksel ölçüler".

**2. `psu_specs.efficiency_rating` opsiyonel oldu** (K61).
Migration `20260818233436_psu_efficiency_opsiyonel`.

**3. İçe aktarma script'i beş kategori için genişletildi:** `motherboard`,
`ram`, `psu`, `storage`, `case`. Her biri kendi zorunlu alan listesi, enum
çevirisi ve `$transaction` sarmalayıcısıyla.

**4. On parça toplandı ve içe aktarıldı** — kategori başına iki tane.

---

## Kararlar

| # | Karar |
|---|---|
| K59 | Açıklık değerlerinde **en küçüğü** yazılır; ondalık **aşağı** yuvarlanır |
| K60 | Fiziksel ölçülerde **çıkarım yapılmaz**, yalnızca etiketli değer yazılır |
| K61 | `psu_specs.efficiency_rating` opsiyonel |

**K59 ilk uygulamaları:** Fractal North `max_psu_length_mm` = **155** (sayfa:
"1 HDD Tray: 255 mm, 2 HDD Tray: 155 mm"); Lian Li LANCOOL 216
`max_cpu_cooler_height_mm` = **180** (sayfa: 180.5 mm).

**K60 ilk uygulaması:** Corsair RM850e `length_mm` **boş**. Sayfa
`Dimensions: 140x150x86` diyor, eksen sırası yok. Seasonic aynı üç sayıyı
`140 mm (L) x 150 mm (W) x 86 mm (H)` diye etiketliyor ve 150×86 ATX
standardının sabit ölçüleri — 140'ın uzunluk olduğu neredeyse kesin. **Yine de
yazılmadı**, çünkü kural ilk zorlandığı yerde esnetilirse kural olmaktan çıkar.

---

## Toplanan 10 parça

| Kategori | Parçalar |
|---|---|
| Anakart | ASUS TUF GAMING X870-PLUS WIFI, MSI MAG B850 TOMAHAWK MAX WIFI |
| RAM | Corsair VENGEANCE DDR5-6000 CL30 32GB ve 64GB |
| PSU | Corsair RM850e, Seasonic FOCUS GX-750 |
| Kasa | Fractal Design North, Lian Li LANCOOL 216 |
| Depolama | Samsung 990 PRO 2TB, WD_BLACK SN850X 2TB |

Beşi dev-seed slug'larıyla aynıydı ve gerçek veriyle değiştirildi (K54).

---

## Tutarlılık kontrolü bir hata yakaladı

**WD_BLACK SN850X 2TB okuma hızı.** Arama özeti "2TB = 7,200 MB/s" diyordu.
Üreticinin datasheet PDF'inde kapasite sütunları **8TB, 4TB, 2TB, 1TB**
sırasında; TBW satırı (4800 / 2400 / 1200 / 600) bu sırayı bağımsız olarak
doğruluyor. O hizalamaya göre 7,200 **8TB'nin** değeri, 2TB = **7,300 MB/s**.

RTX 3080 10GB'da base clock'un boost diye okunmasıyla aynı hata sınıfı.
Özete güvenilseydi yanlış değer yazılacaktı.

---

## Ne doğrulandı

**Beş yeni kategori de içeri girdi:**

```
motherboard-asus.csv (motherboard) — 1 satir   [YENI  ] asus-tuf-gaming-x870-plus-wifi
motherboard-msi.csv  (motherboard) — 1 satir   [YENI  ] msi-mag-b850-tomahawk-max-wifi
psu-corsair.csv      (psu)         — 1 satir   [HATA ] corsair-rm850e — zorunlu alan bos: length_mm
psu-seasonic.csv     (psu)         — 1 satir   [YENI  ] seasonic-focus-gx-750
ram-corsair.csv      (ram)         — 2 satir   [GUNCEL] + [YENI  ]
case-fractal.csv     (case)        — 1 satir
case-lianli.csv      (case)        — 1 satir
storage-samsung.csv  (storage)     — 1 satir   [GUNCEL]
storage-wd.csv       (storage)     — 1 satir   [YENI  ]
```

**Kasa satırları, enum dizisi dahil doğru yazıldı:**

```
fractal-design-north: {ATX,mATX,ITX}        gpu=355 cooler=170 psu=155
lian-li-lancool-216:  {E-ATX,ATX,mATX,ITX}  gpu=392 cooler=180 psu=220
```

`E-ATX` değeri veritabanına doğru indi (Prisma'da `E_ATX`, K7).

**Veritabanı:** 108 gerçek parça.

```
gpu 60 · cpu 39 · motherboard 2 · ram 2 · storage 2 · case 2 · psu 1
dev-seed kalan: 18
```

```
$ npm run sema:kontrol   SONUC: 73 kontrolun tamami gecti.
$ npm test               107 passed (107)
$ npx tsc --noEmit       (çıktı yok)
$ npm run lint           (çıktı yok)
$ npm run build          ✓ Compiled successfully
```

---

## Neden 10'da durdu

Kalan 64 parça, ürün başına en az bir spec sayfası çekimi demek — arama
adımlarıyla birlikte 80-120 ayrı istek. Bu iş biriminde tamamlanmadı.

Aceleye getirip doğrulanmamış satır üretmek, aynı mesajda konulan üç kuralı
(K59, K60 ve "şüpheli değer teyit edilir") ilk uygulamada delmek olurdu —
özellikle PSU ve kasa kategorilerinde, ki oradaki değerler doğrudan C5 ve W5'i
besliyor. On parçanın her biri spec tablosundan tek tek okundu, biri
(SN850X) tekrar teyit edilip düzeltildi.

**Altyapı hazır olduğu için kalan iş artık mekanik:** CSV biçimleri sabit,
içe aktarma beş kategoriyi tanıyor, kurallar yazılı. Kalan dağılım:

| Kategori | Kalan | Not |
|---|---|---|
| Anakart | ~26 | 11 chipset daha: X870E, B650E, B650, A620, Z890, B860, H810, Z790, B760, H770, H610 |
| RAM | ~14 | G.Skill, Kingston, Crucial; DDR4 dörtlüsü dahil |
| PSU | ~4 | be quiet!, MSI, farklı verimlilik sınıfları |
| Kasa | ~4 | NZXT, Corsair, ITX ve mATX örnekleri |
| Depolama | ~6 | Gen5 NVMe, Crucial, Kingston |

---

## Açık kalan sorular

**S24 (yeni, engelleyici)** — `psu_specs.length_mm` zorunlu ama K60 boş
bırakılmasını gerektiriyor. İlk çarpışma hemen çıktı (`corsair-rm850e`
reddedildi) ve Corsair'in birçok modelinde aynı etiketleme var.

`gpu_specs.length_mm` aynı sorunu yaşamış ve **K52 ile opsiyonel yapılmıştı**;
gerekçe birebir aynı. Önerim aynı çözüm.

**S22, S18, S16, S15** değişmedi.

Güncel liste: `SORULAR.md`
