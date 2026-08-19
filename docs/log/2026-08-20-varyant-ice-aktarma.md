# 2026-08-20 — 58 kart veritabanında

`parca:aktar`'a `gpu_variant_specs` adaptörü eklendi, 58 kart içeri alındı, üç
dev-seed kart silindi. **C5 artık 2 değil 55 kombinasyonda tetikleniyor** ve
eşik uyarısından çıktı.

---

## 1. İçe aktarıcı adaptörü

`data/parts/variants/` klasörü ayrıca okunuyor; oradaki her satır kart sayılıyor.
Kategori dosya adından değil **klasörden** geliyor — kök klasördeki davranış
(dosya adının ilk parçası = kategori) hiç değişmedi.

Kart satırı `category = 'gpu'` olan bir `parts` satırı + `gpu_variant_specs`
satırı olarak, **tek işlemde** yazılıyor (mevcut desen: spec yazımı patlarsa
spec'siz `parts` satırı kalmasın).

Üç yapısal koruma, hepsi satırı reddediyor ve sebebi `raw_imports.error`'a yazıyor:

1. `chip_part_id` katalogda yoksa → `chip_part_id katalogda yok: <id>`
2. Gösterilen parça çip değilse (`gpu_specs` satırı yoksa) → hiyerarşi iki
   seviyedir, kartın kartı olmaz
3. Kartın slug'ı zaten bir çip satırıysa → aynı parça hem çip hem kart olamaz

Tek zorunlu alan `chip_part_id` (K86). `length_mm` ve `tbp_watt` bir kural
tarafından kullanılıyor ama opsiyonel (K62, K87).

## 2. İçe aktarma

```
npm run parca:aktar
OZET: 58 yeni, 149 guncellendi, 0 atlandi (dusuk guvenilirlik), 0 hata.
raw_imports: 2900 satir. manufacturer kaynakli parca: 150 -> 208.
```

## 3. Dev-seed kartların silinmesi

Üç kart (`asus-rog-strix-rtx-5090-oc`, `zotac-rtx-5090-solid`,
`nvidia-rtx-5090-founders`) ve bağlı 9 sahte fiyat satırı silindi. Silme
öncesi her satırın `source = 'dev-seed'` olduğu doğrulandı; biri bile
`manufacturer` olsaydı script duracaktı.

Kalıcı taraf da kapatıldı:

- `scripts/seed.mts` artık kart üretmiyor — bir sonraki `db:seed` onları geri
  getiremez.
- `scripts/seed-prices.ts`'ten üç kartın fiyatı çıkarıldı.
- **`scripts/purge-dev-seed.mjs`'te bir açık vardı:** silme sırasında
  `gpu_variant_specs` yoktu. `npm run seed:temizle` çalıştırılsaydı `parts`
  silinirken yabancı anahtar hatası verip yarım kalırdı. Eklendi ve çip
  satırından **önce** siliniyor.

## 4. Doğrulama

### Çip satırları bozulmadı mı

**md5 imzası yöntemi terk edildi.** Beklenen değeri vermedi ve sebebi
öğreticiydi: içe aktarma aynı değerleri yeniden yazdığında `updated_at`
değişiyor, satırın metin hâlinin md5'i de değişiyor. Yani imza "veri bozuldu mu"
sorusunu değil **"satıra dokunuldu mu"** sorusunu cevaplıyordu. Ölçüldü: 60
satırın 60'ında `updated_at` bugüne kaydı, alan bazlı imza ise sabit.

Yerine **DB ↔ kaynak CSV karşılaştırması** kondu: CSV bu tablonun tek kaynağı,
eşitlik bozulmadıkça satır bozulmamıştır. Alan alan, 11 sütun:

```
npm run varyant:kontrol
  gpu_specs (cip)          : 60
  gpu_variant_specs (kart) : 58
  parts.category = 'gpu'   : 118
  [OK] cip + kart = toplam gpu parcasi
  [OK] hicbir parca hem cip hem kart degil
  [OK] her kartin cipi bir cip satiri
  CSV ile karsilastirilan  : 60 cip
  [OK] cip satirlari kaynak CSV ile birebir ayni
  [OK] CSV'deki her cip veritabaninda
  [OK] cip listesi yalnizca cipleri iceriyor      (katalog.gpu = 60)
  [OK] kartlar cip listesine sizmiyor
  [OK] kart secilmeyince cipin degerleri aynen geciyor (60 cip)
SONUC: 33 kontrolun tamami gecti.
```

### Kurallar — C5 iki katmandan çıktı

`kural:kontrol` artık kartları da deniyor: çip listesi + kart listesi, kartlar
`resolveGpuSelection` ile çözümlenerek (arayüzün kullandığı fonksiyonun aynısı).

| Kural | Önce | Sonra |
|---|---|---|
| **C5** ekran kartı kasaya sığmıyor | **2 (UYARI)** | **55 (tamam)** |
| C4 güç yetmiyor | 907 | 2440 |
| W3 pay dar | 1219 | 2514 |
| W2 bellek kapasitesi | 2 (UYARI) | 2 (UYARI) |
| W5 PSU kasaya sığmıyor | 1 (UYARI) | 1 (UYARI) |

```
Gercek parca: 42 cpu, 60 cip + 58 kart gpu, 19 anakart, 14 bellek, 4 psu, 5 kasa
11 kuralin hepsi gercek veriyle tetiklenebiliyor.
UYARI: 2 kural 3 kombinasyondan az ile ayakta.   (once 3 idi)
```

C5'in 2'den 55'e çıkması varyant katmanının asıl gerekçesiydi: çiplerin 42'sinde
uzunluk yok, kartların **58'inde de var**.

### Kartın değeri gerçekten kullanılıyor mu

Arayüzün yaptığı hesabın aynısı (seçim → `resolveGpuSelection` →
`checkCompatibility`), gerçek katalogla:

```
1) RTX 5090 — kart secilmedi
   uzunluk 304 mm (chip_reference)  ->  C5 YOK
2) RTX 5090 — ASUS ROG Astral OC secildi
   uzunluk 358 mm (variant)
   HATA C5: Ekran kartı 358 mm, kasaya en fazla 355 mm sığıyor.
   Arayuz notu: kartin TBP'si yayinlanmamis, guc hesabi cipin referans degeriyle yapildi.

5) RX 9060 XT — kart secilmedi        (i9-14900KS + 550W)
   guc 160 W (chip_reference) -> gereken 533 W
   UYARI W3: Güç kaynağı 550W, gereken 533W. Pay dar…
6) RX 9060 XT — SAPPHIRE NITRO+ secildi   (AYNI islemci, AYNI PSU)
   guc 182 W (variant) -> gereken 562 W
   HATA C4: Güç kaynağı 550W, bu sistem için en az 562W gerekiyor.
```

İkinci çift tam olarak istenen kanıt: **tek değişen şey kart seçimi**, güç
kaynağı yeterliyken yetersize dönüyor çünkü hesap kartın TBP'sini (182 W)
kullanıyor, çipin referansını (160 W) değil.

### Tarayıcı

Çalışan `next dev` sunucusuna istek atıldı:

```
HTTP 200
"Sistem oluşturucu — 225 parça"                      (170 -> 225: +58 kart, -3 dev-seed)
"ROG Astral GeForce RTX 5090 …"      istemci verisinde var
"NITRO+ AMD Radeon RX 9070 XT"       istemci verisinde var
value="asus-rog-astral-rtx-5090-oc"  cip listesinde YOK  (K89 dogru)
value="nvidia-rtx-5090"              cip listesinde var
```

**Eksik olan:** kart kutusunu açıp seçimi tarayıcıda tıklayarak yapmadım — bu
oturumda tarayıcı aracı yok. Kutunun arkasındaki hesap yukarıda gerçek katalogla
ölçüldü. Elle bakmak istersen: `npm run dev` → RTX 5090 seç → altında açılan
"Kart modeli" kutusundan **ROG Astral**'ı seç → kasayı **Fractal Design North**
yap; C5 hatası çıkmalı.

### Diğer

```
npx tsc --noEmit        cikti yok
npm run lint            cikti yok
npm test                128 test
npm run sema:kontrol    80/80
npm run db:kontrol      18/18 tablo
```

## 5. Açık kalan

- **`varyant:kontrol`'ün 4. bölümü artık atlanıyor:** "kart içeren sistem
  kaydı" ölçümü fiyatı olan bir kart gerektiriyor; dev-seed kart fiyatları
  silindi, gerçek kartlarda fiyat yok. Kart fiyatı girildiğinde ölçüm kendi
  kendine geri gelecek.
- **Kartlarda fiyat yok.** Sistem kaydetme fiyatı olmayan parçayı reddediyor
  (`missing_price`), yani şu an kart seçilerek sistem kaydedilemiyor. Bir
  sonraki iş birimi bu.
- Kart bazlı `perf_index` hâlâ yok ve olmayacak — `benchmark_points`'ta kart
  bazlı ölçüm bulunana kadar (K71, K74).
- `fan_count`, `height_mm`, `release_year` 58 kartın hiçbirinde dolu değil.
