# 2026-08-19 — Ekran kartı varyantı (AIB kartı) desteği

Onaylanan tasarım uygulandı: çip ile kart artık iki ayrı satır.
`gpu_specs` çip seviyesinde kaldı, kart `gpu_variant_specs` oldu.
**Mevcut 60 çip satırına dokunulmadı** — ölçüldü, imzası birebir aynı.

Kapsam: şema + migration + motor + arayüz + testler. **Veri toplanmadı**;
kart verisi olarak yalnızca dev-seed satırları var ve canlıda filtreleniyor.

---

## 1. Ne yapıldı

| Katman | Değişiklik |
|---|---|
| `SCHEMA.md` | Ek A taslağı **asıl bölümlere taşındı ve silindi**. Bölüm 2'ye `gpu_variant_specs`, bölüm 4'e iki seviyeli indeks okuma, bölüm 7'ye C4/C5 tablosu, bölüm 11'e indeks. v1.3 → **v1.4** |
| `prisma/schema.prisma` | `GpuVariantSpecs` modeli + `Part` üzerinde iki ilişki (kart olarak / çip olarak) |
| Migration | `20260819195525_kart_varyanti` — **tek `CREATE TABLE`**, mevcut tablolara dokunmuyor |
| `/engine` | Yeni dosya `gpu-selection.ts`: `resolveGpuSelection`, `resolvePerfIndex`. `EngineGpu` **değişmedi** |
| `/data` | `to-engine.ts` + `toEngineGpuVariant`; `parts.ts` + `gpu_variant` listesi; `builds.ts` kart kaydında indeksi çipten okuyor |
| `/app` | Çip seçilince açılan opsiyonel "Kart modeli" kutusu + üç yeni açıklama satırı |
| `/tests` | `gpu-selection.test.ts` — 14 test. 114 → **128** |
| `/scripts` | `check-gpu-variant.mts` (`npm run varyant:kontrol`), seed'e üç dev-seed kart, `check-schema.mjs` yeni tabloyu denetliyor |
| Belgeler | `KARARLAR.md` K86-K90, `CLAUDE.md` iki yeni bölüm, `SORULAR.md` S38 |

---

## 2. Kararlar

### K86 — Kart bir `parts` satırıdır

`category = 'gpu'` olan normal bir parça; `gpu_variant_specs.chip_part_id` ile
çipine bağlanıyor. Sebep: `price_snapshots`, `build_items`, `click_events`,
`perf_index` ve `/parca/<slug>` hepsi `parts.id`'ye bağlı — kart bir `parts`
satırı olduğunda **beşi de değişmeden çalışıyor**. Migration tek tablo oldu.

Bağımsız `gpu_variants` tablosu reddedildi: üç tabloya nullable ikinci FK
eklemek ve her okuma yolunu çatallamak gerekirdi.

**Zorunlu tek alan `chip_part_id`.** K56'nın sorusuna ("hangi kural kullanıyor?")
yalnızca o alan için cevap var. `length_mm` ve `tbp_watt` kural tarafından
kullanılıyor ama K62 ve geri düşüş sebebiyle yine opsiyonel.

### K87 — Onaylanan asimetri genel kural oldu

> Yaklaşık ve pay içeren kural, eksik veride referansa geri düşer.
> Kesin ve paysız kural atlanır. İkisinde de arayüz durumu söyler.

`CLAUDE.md` "Eksik veride kural davranışı" bölümüne ve `KARARLAR.md` K87'ye
yazıldı. Yeni kural yazarken sorulacak soru: *bu bir tahmin mi, bir ölçü
karşılaştırması mı?*

### K88 — Güç konnektörü serbest metin (proje sahibinin kararı)

`power_connectors text?` — `2x 8-pin + 1x 6-pin`. Yapılandırma ertelendi:
hiçbir kural okumuyor, kullanılmayan yapıya migration harcanmıyor.
→ `SORULAR.md` S38 (ertelenmiş madde, tetikleyicisi yazıldı).

### K89 — Kategori listesi çipleri gösterir

Ekran kartı listesi yalnızca çipleri listeliyor (sorgu `gpu_specs` join'li).
Kart, çip seçildikten sonra açılan ikinci kutuda ve **yalnızca o çipin kartları**
görünüyor. O çipin kartı yoksa kutu **hiç çizilmiyor**. Yan sonuç: kart
seçiliyse `build_items`'a kartın id'si yazılıyor, çipin değil.

### K90 — Çözümleme `/engine`'e taşındı (taslaktan sapma)

Taslakta çözümlemenin `/data/to-engine.ts` içinde olacağı yazıyordu.
`engine/gpu-selection.ts`'e taşıdım. Sebebi iki tane:

1. Bu fonksiyon **sessizce yanlış sonuç verebilen** yer — yanlış sayıyı seçerse
   kural "sığar" der ve kart sığmaz. `CLAUDE.md` testi tam bu tür yerler için
   istiyor, test de yalnızca `/engine` için yazılıyor. `/data`'da kalsaydı ya
   test edilemezdi ya da kural esnetilirdi.
2. Aynı çözümleme iki yerden çağrılıyor: arayüz ve `saveBuild`. Tek tanım
   olmasaydı ikisi zamanla ayrışırdı.

**`/engine` kuralı korundu:** dosya yalnızca kendi tiplerini içe aktarıyor;
`sema:kontrol` saflık denetimi `engine/gpu-selection.ts saf` diyor. `EngineGpu`
tipi değişmedi, `checkCompatibility` hâlâ tek bir `EngineGpu` alıyor —
çip/kart ayrımını motorun geri kalanı görmüyor.

---

## 3. Ne doğrulandı

### Üç ölçüm (istenen)

```
npm run varyant:kontrol

--- 1. Cip satirlari bozulmadi mi ---
  gpu_specs (cip)          : 60
  gpu_variant_specs (kart) : 3
  parts.category = 'gpu'   : 63
  [OK] cip + kart = toplam gpu parcasi
  [OK] hicbir parca hem cip hem kart degil
  [OK] her kartin cipi bir cip satiri
  gpu_specs imzasi         : 9730f18749f0effdc171610b7b63613d
  (varyant oncesi olculen imza: 9730f18749f0effdc171610b7b63613d)
  [OK] gpu_specs imzasi varyant oncesiyle ayni

--- 2. Kart secmeyen akis degisti mi ---
  katalog.gpu (cip listesi): 60
  katalog.gpu_variant      : 3
  [OK] cip listesi yalnizca cipleri iceriyor
  [OK] kartlar cip listesine sizmiyor
  [OK] kart secilmeyince cipin degerleri aynen geciyor (60 cip)
  indeksi olan cip         : 14
  [OK] cip indeksleri okunmaya devam ediyor

--- 3. Kart secilince C4/C5 hangi degeri kullaniyor ---
  Sabit parcalar: amd-ryzen-7-9800x3d (120W), corsair-hx1200 (1200W),
                  fractal-design-north (355 mm)

  secim                             tdp   kaynak           uzunluk  kaynak           gerekli W  bulgular
  CIP  nvidia-rtx-5090              575   chip_reference   304      chip_reference   1034       W5
  KART asus-rog-strix-rtx-5090-oc   600   variant          358      variant          1066       C5,W3,W5
  KART nvidia-rtx-5090-founders     575   chip_reference   304      variant          1034       W5
  KART zotac-rtx-5090-solid         575   variant          -        unknown          1034       W5

--- 4. Kart iceren sistem kaydi (indeks cipten donuyor mu) ---
  kaydedilen parcalar : asus-rog-strix-rtx-5090-oc, amd-ryzen-7-7800x3d
  donan indeks        : 194.2
  cipin indeksi       : 216 (chip)
  [OK] kaydedilen satir kartin kendisi
  [OK] cip ayrica kaydedilmedi
  [OK] indeks hesaplandi (kartin cipinden okundu)
  (olcum kaydi silindi: v7q4sk)

SONUC: 23 kontrolun tamami gecti.
```

**Tablo K87'nin kendisi:** Strix hem uzunluk hem TBP verdiği için ikisi de
kartın (358 mm → C5 hatası, 600 W → gerekli 1066 W ve W3). Founders'ın TBP'si
yok → güç **çipten** okundu (575). Zotac'ın uzunluğu yok → C5 **atlandı**,
çipin 304 mm'sine düşülmedi; düşülseydi kasa 355 mm olduğu için "sığar"
denecekti.

Ölçüm gerçek kodu çağırıyor: `getBuilderCatalog`, `resolveGpuSelection`,
`checkCompatibility` ve `saveBuild`. Sorgu ya da çözümleme script içinde
yeniden yazılmadı (`seed:filtre-kontrol` ile aynı gerekçe).

### Geri kalan

```
npm test                128 test (114 -> 128, 14 yeni)
npm run sema:kontrol    80/80 — yeni tablo denetime dahil
npm run kural:kontrol   11 kural tetikleniyor, 3 UYARI (degismedi)
npm run db:kontrol      18 tablonun 18'i mevcut
npm run indeks:sapma    ortalama %4.9, en buyuk %11.5, esik GECTI
npm run seed:filtre-kontrol
    GELISTIRME: katalog 170 parca
    CANLI     : katalog 150 parca, dev-seed fiyat sizan 0
npx tsc --noEmit        cikti yok
npm run lint            cikti yok
npm run build           Compiled successfully
```

dev-seed kartlarının canlıda görünmediği ayrıca doğrulanmış oldu: geliştirmede
170, canlıda 150 parça (aradaki 20 dev-seed, üç kart dahil).

### Sayfa gerçekten çiziliyor mu

Tarayıcı paneli bu oturumda yok; `npm run dev` + `curl` ile ölçüldü:

```
HTTP 200, 66 KB
"oluşturucu — 170 parça"                        -> var
"ROG Strix GeForce RTX 5090 OC"                 -> yalnizca istemci verisinde
value="nvidia-rtx-5090"      (cip <option>)     -> var
value="asus-rog-strix-..."   (kart <option>)    -> YOK  (K89 dogru)
"Kart modeli"                                   -> ilk HTML'de yok (dogru:
                                                   cip secilince aciliyor)
```

**Eksik doğrulama, açıkça söylüyorum:** kart kutusunun tarayıcıda açılıp
seçimin ekrandaki sayıları değiştirdiği **gerçek bir tarayıcıda görülmedi** —
bu oturumda tarayıcı aracı yoktu. Kutunun arkasındaki bütün mantık test ve
ölçüm script'iyle doğrulandı, ama ekran görüntüsü yok. `npm run dev` açıp
bir RTX 5090 seçmen ve altındaki kutuyu denemen yeterli.

---

## 4. Yol boyunca çıkan iki şey

**`data/builds.ts` hiçbir script'ten çağrılamıyordu.** `@/engine/...` takma adı
çalışma anında çözülmüyor (CLAUDE.md araç notları, aynı duvara üçüncü çarpma).
İki içe aktarma göreli yola + `.ts` uzantısına çevrildi; `saveBuild` ancak
bundan sonra ölçülebildi. `import type` erimediği için o satır takma adla kaldı.

**`buildInput`'taki `useMemo` kaldırıldı.** React derleyicisinin lint kuralı
(`react-hooks/preserve-manual-memoization`) türetilmiş bir değeri bağımlılık
listesinde kabul etmiyordu. Dosyanın geri kalanı (fiyat toplamı, yükseltme
önerisi) zaten memo kullanmıyor; altı parça araması ve on bir kuralı her
çizimde hesaplamak, önbelleği doğru tutmaya çalışmaktan ucuz.

---

## 5. Açık kalan sorular

- **S38** — güç konnektörü serbest metin; yapılandırma "PSU konnektör kuralı"
  yazılınca gündeme gelecek (ertelendi, karar verildi).
- **Kart verisi yok.** Katalogda yalnızca üç dev-seed kart var ve canlıda
  görünmüyorlar. Gerçek kart verisi girilene kadar özellik canlıda **görünmez**
  — kutu yalnızca kartı olan çipte açılıyor. Veri toplama ayrı bir iş birimi.
- **`gpu_specs.length_mm` hâlâ 18/60.** Varyant katmanı bunu kapatmanın yolunu
  açtı ama kapatmadı: kapanması kart verisi girilmesine bağlı.
- **Kart bazlı `perf_index` yok ve olmayacak** — `benchmark_points`'ta kart
  bazlı ölçüm bulunana kadar (K71, K74). Şema hazır, veri yok.
- **Tarayıcıda gözle görülmedi** (yukarıda).
- Önceki oturumlardan devam: bantlar hâlâ geçici (K73), `lib/perf-margin.ts`
  `provisional: true`, S37 ertelendi.
