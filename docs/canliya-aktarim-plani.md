# Canlıya veri aktarımı — hazır plan

**Durum: uygulanıyor (21 Ağustos 2026).** Seçilen yol **(a)**: komutları proje
sahibi çalıştırır. Canlı adres ne bu makineye ne de sohbet geçmişine girer —
K29'un koruduğu şey bu.

> **21 Ağustos yenilemesi.** Plan ilk yazıldığından beri katalog 208'den
> **332 parçaya** çıktı, **kart (AIB) varyantları** eklendi, fiyat kısıtı
> kalktı (K124) ve **4 yeni migration** yazıldı. Satır sayıları ve komut
> dizisi bugünkü duruma göre yenilendi.
>
> **Şema adımı DÜZELTİLDİ.** Eski plandaki komut yanlış veritabanına
> giderdi; ayrıntısı aşağıda, "0. Şema" başlığında.

---

## Yöntem: içe aktarıcıları canlıya karşı bir kez çalıştırmak

Veri kopyalanmıyor, **yeniden türetiliyor**. CSV'ler zaten depoda; canlı da
geliştirme gibi onlardan üretiliyor.

**Ölçülmüş dayanak:** Node'un `loadEnvFile`'i ortamdan gelen değişkeni **ezmez**.
Yani `.env.local` yerinde dururken tek komutluk canlı bağlantı çalışır ve
`.env.local` hiç değiştirilmez. 21 Ağustos'ta iki yönde de yeniden ölçüldü:

```
DATABASE_URL="postgresql://…kanit-testi.invalid…" npm run dagitim:kontrol
  -> Baglanti kurulamadi: kanit-testi.invalid/db      ← kabuktaki değer kazandı

DIRECT_URL="postgresql://…kanit-testi.invalid…" npx prisma migrate status
  -> Datasource "db": … at "kanit-testi.invalid:5432" ← kabuktaki değer kazandı
```

### Neden döküm (pg_dump) değil

Dev-seed satırlarını, `raw_imports` gürültüsünü ve `builds` kayıtlarını da
taşırdı. Filtrelenmiş bir döküm ise elle üretilmiş, kimsenin yeniden
türetemeyeceği bir nesne olurdu — projenin kaynak defteri disiplinine ters.

### Neden `.env.local`'e geçici yazmak değil

K29'u doğrudan ihlal eder ve o pencerede çalıştırılan **her** script canlıya
yazar. Ayrıca artık K94 bunu engelliyor: `db:seed` ve `seed:temizle` hedef
`.env.local`'dekiyle aynı değilse reddediyor.

### Neden depoya "yayınla" script'i değil

K29, kalıcı silme aracını tam bu gerekçeyle reddetmişti: geliştirme
makinesinden canlıya yazabilen bir araç, başlı başına risk.

---

## Uygulama sırası

Adres bir kez kabuk değişkenine alınır, dosyaya yazılmaz:

```bash
read -rs PROD_URL          # yapıştır, ekrana yazılmaz
```

**Hangi adres:** Supabase'in **doğrudan** bağlantı dizesi (havuzlanmış olan
değil). İki sebep: (1) migration havuzlanmış bağlantı üzerinden güvenilir
çalışmıyor, (2) tek bir adresle hem şema hem veri adımları yürüyor. Tek tur
içe aktarma için havuzlamanın faydası yok.

`migrate deploy` "prepared statement" ya da "pgbouncer" hatası verirse
havuzlanmış adres yapıştırılmış demektir.

### 0. Şema

Depoda **15 migration** var. Canlıda olmayabilecek olanlar (plan yazıldıktan
sonra eklendiler):

```
20260819195525_kart_varyanti
20260820142440_render_mode_alani
20260820142632_render_mode_veri_tasima
20260820142939_games_release_year_opsiyonel
20260820172348_fiyatsiz_sistem_kaydedilebilir
```

Şema eskiyse içe aktarma sütun hatası verir.

```bash
DIRECT_URL="$PROD_URL" npx prisma migrate status     # önce bak
DIRECT_URL="$PROD_URL" npx prisma migrate deploy     # sonra uygula
```

> **`DIRECT_URL`, `DATABASE_URL` DEĞİL.** Eski plan bu adımda
> `DATABASE_URL="$PROD_URL" npx prisma migrate deploy` diyordu ve bu **yanlış
> veritabanına giderdi**: `prisma.config.ts` migration hedefini `DIRECT_URL`'den
> okuyor, `DATABASE_URL`'den değil. Yalnızca `DATABASE_URL` verilseydi Prisma
> `.env.local`'deki `DIRECT_URL`'i — yani **geliştirme veritabanını** —
> kullanırdı. Migration sessizce geliştirmeye uygulanır, canlının şeması eski
> kalır ve bir sonraki adım sütun hatasıyla dururdu.
>
> Ölçüldü (21 Ağustos): `DATABASE_URL` kabuktan verildiğinde
> `prisma migrate status` **geliştirme** veritabanını gösteriyor; `DIRECT_URL`
> verildiğinde verilen adresi gösteriyor.

Sırada bir Vercel production dağıtımı varsa `dagitim:migration` zaten
`prisma migrate deploy` çalıştırıyor; o zaman bu adım atlanabilir.

### 1-4. Veri

Sıra bağımlılıktan geliyor: ölçüm ve fiyat `parts`'a, ölçüm ayrıca `games`'e
bağlı; indeks `benchmark_points`'a.

```bash
DATABASE_URL="$PROD_URL" npm run parca:aktar      # 331 CSV satırı -> 332 parça
DATABASE_URL="$PROD_URL" npm run olcum:aktar      # 32 oyun + 381 ölçüm
DATABASE_URL="$PROD_URL" npm run fiyat:aktar      # 22 fiyat
DATABASE_URL="$PROD_URL" npm run indeks:hesapla   # 27 indeks
```

`parca:aktar` **kart varyantlarını da** aktarıyor: `data/parts/variants/`
altındaki iki dosya (153 kart) ayrı bir komut gerektirmiyor. Kart satırları
`parts` + `gpu_variant_specs`'e gidiyor ve `chip_part_id` ile çiplerine
bağlanıyor (K86) — bu yüzden çip satırlarından **sonra** yazılmaları gerekiyor,
script bunu kendi içinde sıralıyor.

`perf_index` **kopyalanmıyor**, canlıda yeniden hesaplanıyor. K71 "yalnızca
`benchmark_points`'tan hesaplanarak üretilir" diyor; taşımak yerine türetmek
hem kurala uyuyor hem de aktarım sırasında bozulma ihtimalini kaldırıyor.

Hepsi idempotent: `parca:aktar` upsert eder, `fiyat:aktar` aynı gün fiyat varsa
atlar, `olcum:aktar` aynı ölçüm varsa atlar, `indeks:hesapla` upsert eder.
Yarıda kalırsa baştan çalıştırmak güvenli.

### 5-8. Doğrulama

```bash
DATABASE_URL="$PROD_URL" npm run sapma:tumu       # K80: sapma kaydedilmeden yayın yok
DATABASE_URL="$PROD_URL" npm run kural:kontrol    # 11 kural gerçek veriyle tetikleniyor mu
DATABASE_URL="$PROD_URL" npm run varyant:kontrol  # kart varyantı çözümlemesi (K86, K87)
DATABASE_URL="$PROD_URL" npm run dagitim:kontrol  # "dev-seed satiri yok" dönmeli
```

`sapma:tumu` iki ölçümü birden yapar ve **`lib/perf-margin.ts` ile
`lib/fps-margin.ts` dosyalarına yazar** (K110). Canlıya karşı çalıştırıldığında
bu bir doğrulama aracına dönüşüyor:

```bash
git diff lib/perf-margin.ts lib/fps-margin.ts
```

**Yalnızca `measuredAt` tarih satırı değişmeli.** Sayılardan biri değişirse
canlı ile geliştirme aynı veriye sahip değil demektir — devam edilmez.

Tarih satırını da geri almak için:

```bash
git checkout -- lib/perf-margin.ts lib/fps-margin.ts
```

**`seed:filtre-kontrol` bu listede YOK.** O kontrol dev-seed satırlarının
*varlığını* gerektiriyor: filtrenin çalıştığını, filtrelenecek satır olduğu
için kanıtlayabiliyor. Canlıda dev-seed satırı sıfır olduğu için orada
çalıştırmak hiçbir şey kanıtlamaz. Canlıdaki karşılığı `dagitim:kontrol`.

---

## Beklenen sonuç

| Tablo | Satır |
|---|---|
| `parts` | **332** |
| ├ `gpu_specs` (çip) | 60 |
| ├ `gpu_variant_specs` (kart) | 153 |
| ├ `cpu_specs` | 42 |
| ├ `motherboard_specs` | 19 |
| ├ `ram_specs` | 20 |
| ├ `psu_specs` | 12 |
| ├ `storage_specs` | 14 |
| └ `case_specs` | 12 |
| `games` | 32 |
| `benchmark_points` | **381** (1440p 219 · 1080p 114 · 4K 48) |
| `price_snapshots` | 22 |
| `perf_index` | **27** (15 ekran kartı + 12 işlemci, `model_version` `v0.2`) |
| `raw_imports` | ~766 (tek tur: 331 parça + 413 ölçüm + 22 fiyat) |
| dev-seed | **0** |

`sapma:tumu` çıktısı bugünkü ölçümle birebir aynı olmalı:

```
indeks:sapma   ortalama %4.9   en buyuk %11.5   25 parca   esik %25 GECTI
fps:sapma      ortalama %6.8   %90 dilim %15.6   en kotu %33.4   250 nokta
```

`dagitim:kontrol` başarılı çıktısı:

```
13 tablo tarandi.
dev-seed satiri yok. Dagitim serbest.
```

### Son adım: canlı sitede gözle bak

Fiyat kısıtı kalktığı için (K124) ölçüt değişti. Eskiden "bir sistem toplayıp
**toplam fiyatın** göründüğünü görmek" idi. Bugünkü ölçüt:

1. Bir ekran kartı seç → **oyun bazlı FPS listesi** gelmeli.
2. Bir işlemci de seç → **sistem indeksi** ve darboğaz satırı gelmeli.
3. **Sistemi kaydet** → paylaşım linki üretilmeli, link açıldığında
   dondurulmuş değerler görünmeli. Fiyatı olmayan parça seçiliyken de
   kaydedilebilmeli; toplam yerine "Toplam fiyat dondurulmadı" yazmalı.

---

## Canlı adres sohbete girmesin — iki komut adresi ekrana yazıyor

İkisi de hedef veritabanının **sunucu adını** basıyor. Yerelde bu iyi bir şey
(hangi veritabanına bağlandığını görüyorsun), ama çıktıyı yapıştırırken
o satır silinmelidir:

| Komut | Yazdığı satır |
|---|---|
| `parca:aktar` | `Hedef: <sunucu adı>` |
| `dagitim:kontrol` | `Hedef: <sunucu adı>/<veritabanı>` |

Satırı hiç görmeden atmak için: `... 2>&1 | grep -v "^Hedef:"`

Diğer komutlar adres yazmıyor.

---

## Kısıtlar nasıl karşılanıyor

| Kısıt | Nasıl |
|---|---|
| dev-seed hiçbir şey gitmeyecek | Canlı CSV'lerden üretiliyor; hiçbir CSV dev-seed içermiyor. `db:seed` çalıştırılmıyor **ve** K94 gereği çalıştırılamıyor. |
| Canlı bağlantı yerel dosyada kalmayacak | Adres yalnızca kabuk değişkeninde; `.env.local` hiç değişmiyor. |
| Canlı adres sohbete girmeyecek | İki komutun `Hedef:` satırı yapıştırılmadan önce siliniyor (üstteki tablo). |
| `dagitim:kontrol` temiz dönmeli | Son adım olarak çalıştırılıyor ve doğrulanıyor. |

## Bilinen riskler

1. **Adres kabuk geçmişine düşebilir.** `read -rs` ile alınırsa komut
   satırında görünmez; `history` dosyasına da yazılmaz.
2. **`raw_imports` hacmi.** İçe aktarıcılar canlıda da ham satır yazar
   (şema kural 3). Tek turda ~766 satır; tasarım gereği.
3. **Migration eskiyse** içe aktarma sütun hatasıyla durur — 0. adım bunun
   için önce geliyor ve `migrate status` ile önce bakılıyor.
4. **`sapma:tumu` depodaki iki dosyayı yazar.** Canlıya karşı çalıştırmak
   depoyu kirletir; `git diff` ile bakılıp `git checkout` ile geri alınır.
   Bu bilinçli: dosyanın değişmesi, sayının değişip değişmediğini gösteren
   ölçüm aracının kendisi.
