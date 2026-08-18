# 2026-08-18 — Fiyat ve performans indeksi

Sayfa artık üç yeni şey gösteriyor: toplam fiyat (son güncelleme tarihiyle),
çözünürlüğe göre sistem indeksi, ve darboğaz göstergesi. Hepsi "tahmini"
ibaresiyle.

**Kapsam kararı (proje sahibi):** Gerçek veri girişi ertelendi, dev-seed
verisiyle devam ediliyor. CSV içe aktarma sonraya kaldı.

---

## Ne yapıldı

### 1. Seed genişletildi

**Fiyat.** 29 parçanın her birine üç `price_snapshots` satırı: 20.07, 03.08 ve
17.08.2026. Toplam 87 satır, hepsi `source='dev-seed'`, `confidence='low'`,
`retailer='manual'`, kuruş cinsinden **integer**.

**Performans indeksi.** 4 ekran kartı + 4 işlemci için `perf_index` satırı,
`model_version='v0.1'`. Değerler elle konmuş sıralama; en güçlü kart 100.

Sayılar `scripts/seed-prices.ts` dosyasında ayrı duruyor — `seed.mts` zaten 29
parçanın teknik özelliğini taşıyordu, fiyat tablosu da eklenince tek dosyada
iki ayrı veri kümesi olacaktı.

### 2. `engine/performance.ts` yazıldı

`SCHEMA.md` bölüm 8'in karşılığı. Saf fonksiyon: girdi indeksler + çözünürlük,
çıktı sistem indeksi + bant + darboğaz. Veritabanını, ağı ve React'i tanımıyor;
saflık kontrolü bunu ölçüyor.

Motor parça nesnesi değil, hazır indeks alıyor. Sebebi: `perf_index` motorun
**çıktısı**, girdisi değil — motorun kendi ürettiği tabloyu okuması onu
veritabanına bağlardı.

`tests/performance.test.ts`: 28 test. Bant sınırları, eşik değerleri, ağırlıklar,
yuvarlama, eksik girdi ve kırpma tek tek ölçülüyor.

### 3. Veri katmanı

| Dosya | İşi |
|---|---|
| `data/visibility.ts` | dev-seed filtresi — **tek tanım**, üç okuma dosyası da bunu kullanıyor |
| `data/prices.ts` | Güncel fiyat = en son `collected_at`'li satır |
| `data/perf.ts` | `model_version`'a göre indeks okuma |
| `lib/format.ts` | Kuruş → `62.794,00 ₺`, ISO → `17.08.2026` |

Filtre `data/parts.ts` içinden çıkarılıp kendi dosyasına alındı: üç ayrı dosya
aynı filtreyi kopyalasaydı zamanla ayrışırdı ve 2. katman "zorunlu" olmaktan
çıkardı.

`lib/format.ts` `Intl`/`toLocaleString` kullanmıyor. Bu değerler hem sunucuda
hem tarayıcıda basılıyor; iki tarafın dil verisi farklı olursa React uyumsuzluk
hatası verir. Elle biçimlendirme her yerde aynı çıktıyı üretir.

### 4. Sayfa

Toplam fiyat + son güncelleme, çözünürlük seçici (1080p / 1440p / 4K), sistem
indeksi, bant etiketi, darboğaz göstergesi. Her sayının yanında "tahmini".
Parça listelerinde ve seçilen sistem dökümünde de fiyat görünüyor.

---

## Hangi kararlar verildi ve neden

| # | Karar | Kim |
|---|---|---|
| K32 | `perf_index` dev-seed damgası taşıyamaz, koruma parça üzerinden | Claude |
| K33 | Bant üst sınırı ve darboğaz eşiği üst tarafa dahil | Claude |
| K34 | dev-seed fiyatları sabit tarihli üç snapshot, seed tekrar yazmaz | Claude |

**K32 — "Hepsi `source='dev-seed'` olsun" isteği `perf_index` için
uygulanamadı.** O tabloda `source` sütunu yok ve olmaması bilinçli: motorun
kendi hesabı dış dünya hakkında iddia taşımaz, kaynağı `model_version`'dır.
Sütun eklemek şemanın ayrımını bozardı. Koruma bağlı olduğu parça üzerinden
yürüyor; ayrıntı ve dört katmanın durumu `docs/KARARLAR.md` K32'de.

**K33 — Şema iki sınır değerini tanımsız bırakmıştı.** Bant tablosu "0–25",
"25–45" diyor ama 25'in hangi banda ait olduğunu söylemiyor; darboğaz kuralı
tam 15 farkı hiçbir dala sokmuyor. İkisi de üst tarafa kapatıldı.

**K34 — Tek fiyat satırı yerine üç.** Tek satır olsaydı "en son satırı seç"
mantığındaki bir hata görünmezdi. Tarihler sabit çünkü tablo append-only:
çalışma anı kullanılsaydı her seed yeni satır üretir, o satırlar da silinemezdi.

**Motor sürümü tek yerde.** `MODEL_VERSION` `engine/performance.ts` içinde;
seed script'i de sayfa da oradan okuyor. İki yerde yazılsaydı ayrışabilir ve
sayfa hiç indeks bulamazdı.

---

## Ne doğrulandı

**Seed çalıştı, ikinci kez çalıştırınca satır çoğaltmadı:**

```
$ npm run db:seed
Toplam 29 parça, 29 tanesi dev-seed.
Fiyat: 87 snapshot (87 yeni), 29 parçada fiyat var.
Performans indeksi: 8 parça, model_version 'v0.1'.

$ npm run db:seed          (ikinci çalıştırma)
Fiyat: 87 snapshot (0 yeni), 29 parçada fiyat var.
Performans indeksi: 8 parça, model_version 'v0.1'.
```

**Fiyat geçmişi gerçekten üç satır ve doğru sırada:**

```
nvidia-rtx-5090 fiyat geçmişi:
  2026-07-20  8929906  manual  dev_seed
  2026-08-03  9214903  manual  dev_seed
  2026-08-17  9499900  manual  dev_seed
```

**Sayfa en sonuncusunu okuyor.** Sunucudan gelen veride
`"nvidia-rtx-5090":{"price_minor":9499900,...,"collected_at":"2026-08-17..."}` —
temmuz satırı değil, ağustos satırı. Üç tarih olmasaydı bu kanıtlanamazdı.

**`perf_index` tablosu:**

```
nvidia-rtx-5090          100  v0.1      intel-core-i9-15900k      92  v0.1
amd-ryzen-7-7800x3d       78  v0.1      intel-core-i5-14600k      68  v0.1
amd-rx-9070-xt            62  v0.1      amd-ryzen-5-7600          55  v0.1
nvidia-rtx-5070           54  v0.1      nvidia-rtx-5060           33  v0.1
```

**Motor çıktısı — RTX 5090 + Ryzen 5 7600, çözünürlük değişince:**

```
1080p: indeks 79.8 | 1440p ultra / 4K yüksek | cpu_limited
1440p: indeks 88.8 | 4K ultra                | cpu_limited
2160p: indeks 94.6 | 4K ultra                | cpu_limited
```

Zayıf işlemci 1080p'de sistemi bir bant aşağı çekiyor, 4K'da çekmiyor —
ağırlıkların çalıştığının kanıtı.

**Fiyat biçimlendirme (tam sayı aritmetiği):**

```
149999  -> 1.499,99 ₺        100 -> 1,00 ₺
9499900 -> 94.999,00 ₺         0 -> 0,00 ₺
7 parçalık örnek sistem: 6279400 kuruş -> 62.794,00 ₺
```

**dev-seed korumasının 3. katmanı yeni satırları da yakalıyor.** Kontrol
geliştirme veritabanına yöneltildiğinde:

```
DAGITIM DURDU.
Canli veritabaninda 145 adet dev-seed satiri var:
  - parts: 29    - price_snapshots: 87    - (spec tabloları: 29)
çıkış kodu: 1
```

Fiyat satırları taramaya kendiliğinden girdi — kontrol tablo listesini elle
tutmuyor, `source` sütunu olan tabloları buluyor.

**Zincir:**

```
$ npx tsc --noEmit       (çıktı yok)
$ npm run lint           (çıktı yok)
$ npm run sema:kontrol   SONUC: 62 kontrolun tamami gecti.
                         [OK] engine/performance.ts saf
$ npm test               74 passed (74)   — 46 uyumluluk + 28 performans
$ npm run build          ✓ Compiled successfully
$ npm run dev + curl /   sayfa açıldı, 29 parçanın fiyatı ve 8 indeks geldi
```

**Doğrulanmayan:** Tarayıcıda tıklayarak parça seçme akışı. Sayfanın ilk hâli
ve sunucudan gelen veri ölçüldü; seçim yapıldıktan sonraki ekran proje sahibinin
gözüyle doğrulanacak. Beklenen sayılar yukarıda yazılı.

---

## Açık kalan sorular

**S15 — Darboğaz göstergesi çözünürlüğü hesaba katmıyor.** Aynı sistem 1080p'de
ve 4K'da aynı uyarıyı alıyor; oysa 4K'da işlemcinin payı %12. Eşiğin
çözünürlüğe göre değişmesi bir motor davranışı değişikliğidir ve `v0.2`
gerektirir. Acil değil.

**S14 — Vercel hesabı (engelleyici, önceki oturumdan).** Değişmedi.

Güncel liste: `SORULAR.md`
