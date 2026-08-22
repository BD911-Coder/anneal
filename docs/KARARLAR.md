# Anneal — Kararlar

Verilen kalıcı kararlar. Buraya yazılan bir karar **kapanmıştır**, yeniden sorulmaz.
Değişmesi gerekirse eski madde silinmez; altına yeni madde eklenir ve eskisi
"değiştirildi" diye işaretlenir.

Her madde: ne karar verildi, ne zaman, neden.

---

## 2026-08-18 — Şema kararları (SCHEMA.md v1.0 → v1.1)

v1.0 şemayı Prisma'ya dökerken belirsiz kalan noktalar. Karar veren: proje sahibi.

### K1 — Append-only tablolarda `updated_at` yok

`price_snapshots` ve `benchmark_points` sadece `created_at` + `collected_at` taşır.

**Gerekçe:** Satır güncellenmiyorsa "son değişiklik anı" diye bir olgu yoktur.
Sütunu tutmak, olmayan bir işlemin mümkün olduğunu ima eder ve ileride birinin
UPDATE yazmasına zemin hazırlar.

### K2 — Spec tablolarında ayrı `id` yok, bağlantı tablosunda bileşik anahtar

Yedi kategori spec tablosunda `part_id` birincil anahtardır.
`build_items` birincil anahtarı (`build_id`, `part_id`) bileşiğidir.

**Gerekçe:** Satırın kimliği zaten sahibinden geliyorsa ikinci bir anahtar aynı
gerçeği iki yerde saklamaktır. Ayrıca bileşik anahtar, "aynı parça bir sistemde
iki kez" hatasını veritabanı seviyesinde imkânsız kılar.

### K3 — Olgusal iddia kuralı

Dış dünya hakkında olgusal iddia taşıyan her tabloda `source`, `source_url`,
`confidence`, `collected_at` bulunur. Kapsanan ve muaf tablolar `SCHEMA.md`
bölüm 1.3'te sayılıdır.

**Gerekçe:** v1.0'daki "dışarıdan veri taşıyan tablo" ifadesi hangi tabloların
kastedildiğini söylemiyordu ve her seferinde yorum gerektiriyordu. Ölçüt artık net:
tablo bir şeyin **öyle olduğunu** iddia ediyorsa, nereden bilindiği de yazılır.
Ek fayda: dev-seed damgası spec tablolarına da düşer.

### K4 — `benchmark_points.source_url` zorunlu

Bölüm 1.3'te opsiyonel, bu tabloda zorunlu.

**Gerekçe:** Bu tablo motorun kalibrasyon verisidir. Kaynağı olmayan bir ölçüm,
sonradan doğrulanamayacağı için veri değil gürültüdür.

### K5 — `case_specs.supported_form_factors` enum dizisi

`text[]` değil, `FormFactor[]`.

**Gerekçe:** Uyumluluk kuralı C6 bu alanı `motherboard_specs.form_factor` ile
karşılaştırıyor. İkisi de aynı enum olursa yazım hatası (`mATX` / `matx`) sessiz
bir uyumsuzluk hatası üretemez — veritabanı kabul etmez.

### K6 — `raw_imports.source` serbest metin kalır (bilinçli istisna)

Şemanın geri kalanında `source` enum'dur; burada `text`.

**Gerekçe:** Bu tablonun işi ham veriyi **olduğu gibi** saklamaktır. Kaynak adını
enum'a bağlamak, yeni bir veri kaynağı denemek için şema değişikliği gerektirirdi —
oysa `raw_imports`'ın varlık sebebi tam olarak henüz normalleştirilmemiş veriyi
kabul edebilmektir.

### K7 — Prisma enum değerlerinde takma ad (teknik zorunluluk)

Prisma enum değerleri tire, eğik çizgi içeremez ve rakamla başlayamaz. Şu değerler
kodda takma adla yazılır, **veritabanındaki gerçek değer değişmez**:

| SCHEMA.md / veritabanı | Koddaki ad |
|---|---|
| `dev-seed` | `dev_seed` |
| `DDR4/DDR5` | `DDR4_DDR5` |
| `E-ATX` | `E_ATX` |
| `sata-ssd` | `sata_ssd` |
| `1080p`, `1440p`, `2160p` | `R1080p`, `R1440p`, `R2160p` |

`cpu_specs.memory_type` üç değer alabildiği (`DDR4/DDR5` dahil), `motherboard_specs`
ve `ram_specs` ise ikisinden birini aldığı için iki ayrı enum tanımlıdır:
`CpuMemoryType` ve `MemoryType`.

---

## 2026-08-18 — Araç ve yapı kararları

Karar veren: Claude, "Karar yetkisi" bölümündeki yetki dahilinde. Bilgi amaçlı yazıldı.

### K8 — `perf_index` ne append-only'dir ne de olgusal iddia taşır — **KISMEN DEĞİŞTİRİLDİ, bkz. K14**

Kendi `id`'si, `created_at` ve `updated_at`'i vardır; K3'teki dörtlü alan yoktur.

**Gerekçe:** Bu tablo dış dünya hakkında iddia taşımaz, motorun kendi hesabını
tutar — kaynağı zaten `model_version` sütunudur. Adında `_snapshots` / `_points`
geçmediği için SCHEMA.md bölüm 0'daki append-only kuralı da kapsamaz.

> **2026-08-18 tarihinde değiştirildi.** Dörtlü alanın bulunmaması kararı geçerli.
> `updated_at` kaldırıldı ve tekillik kısıtı eklendi — bkz. K14.

### K9 — Prisma 7'de kalınır, sürüm düşürülmez

`npm audit` üç yüksek seviye uyarı veriyor (`deepmerge-ts`, Prisma CLI'ın
bağımlılığı üzerinden). Çözümü Prisma 6'ya düşmek olurdu, yapılmadı.

**Gerekçe:** Uyarı sadece geliştirme aracını etkiliyor, canlıda çalışan koda
girmiyor. Bir majör sürüm geriye gitmek, ileride tekrar yükseltme borcu yaratır.

### K10 — Veritabanı bağlantı adresi `prisma.config.ts` içinde

Prisma 7 `datasource.url`'ü şema dosyasında kabul etmiyor. `.env` dosyası Node'un
yerleşik `loadEnvFile` fonksiyonuyla okunuyor.

**Gerekçe:** Teknik zorunluluk. `dotenv` paketi eklemek yerine Node'un kendi
özelliği kullanıldı — yeni bağımlılık gerekmedi.

### K11 — Satır sonları depoda LF

`.gitattributes` ile `* text=auto eol=lf`.

**Gerekçe:** Windows'ta CRLF yüzünden dosyanın tamamı değişmiş gibi görünen sahte
farkları önlemek.

---

## 2026-08-18 — Depo kararları

Karar veren: proje sahibi.

### K12 — Depo herkese açık (public)

GitHub deposu public. Secret scanning ve push protection etkin.

**Gerekçe:** Push protection, bir anahtarın yanlışlıkla commit edilmesini
**gönderim anında** engeller — CLAUDE.md'deki "depoya sır sızmasını engelleyen bir
kontrol kurulur" maddesinin karşılığı budur. Bu koruma GitHub'da public depolarda
ücretsizdir.

**Sonucu bilerek kabul edildi:** Depodaki her şey ve tüm commit geçmişi artık
herkese açıktır. Public'e geçildikten sonra yazılan bir sırrı geri almak,
depoyu tekrar private yapmak veya commit'i silmekle çözülmez — anahtarın
iptal edilmesi gerekir.

Geçişten önce commit geçmişi tarandı: hiç `.env` benzeri dosya commit edilmemiş,
anahtar/parola deseni eşleşmesi çıkmamıştı.

### K13 — LICENSE dosyası eklenmez, proje lisanssız kalır

**Gerekçe:** Bilinçli tercih. Lisans dosyası olmayan bir depoda telif hakkı
varsayılan olarak sahibinde kalır; kod görünür olsa da kimse yasal olarak
kopyalayamaz, değiştiremez veya kendi projesinde kullanamaz.

**Sonucu:** Bu aynı zamanda dışarıdan katkı (pull request) kabul etmeyi de
belirsizleştirir. Katkı alınmak istenirse bir lisans seçilmesi gerekir.

---

## 2026-08-18 — Bekleyen kararların kapatılması

Karar veren: proje sahibi (K14, K15, K16); Claude (K17, yetki dahilinde).

### K14 — `perf_index`: `updated_at` yok, (`part_id`, `model_version`) tekil

> ⚠️ **Tekillik kısmı değiştirildi → K35.** Kısıt artık üç sütunlu:
> (`part_id`, `workload`, `model_version`). `updated_at`'in bulunmaması ve
> dörtlü alanın bulunmaması kararları aynen geçerli.

K8'in `updated_at` kısmını değiştirir. Dörtlü alanın bulunmaması kararı aynen geçerli.

**Gerekçe:** Bir parçanın bir motor sürümünde tek indeksi olur; tekillik kısıtı
bunu veritabanı seviyesinde garanti eder. Yeniden hesap yeni satır değil, aynı
satırın güncellenmesidir. "Ne zaman hesaplandı" bilgisini zaten `computed_at`
tutuyor — `updated_at` aynı gerçeği ikinci kez saklardı.

### K15 — İndeksler `SCHEMA.md`'de tanımlı olmak zorundadır

Belgelenmiş sorgu yolları üzerindeki indeksler erken optimizasyon sayılmaz, ancak
`SCHEMA.md` bölüm 11'de yazılı olmayan indeks şemaya giremez.
`raw_imports(status)` bu kural gereği silindi.

**Gerekçe:** "Erken optimizasyon yapma" kuralı ile "bu sorgu indekssiz çalışmaz"
gerçeği arasındaki gerilim, indeksi bir sorgu yoluna bağlamakla çözülüyor.
İndeksin gerekçesi belgede yazılıysa optimizasyon erken değil, tasarımın parçasıdır.
`raw_imports` yalnızca hata ayıklarken elle okunur — belgelenmiş sorgu yolu yok.

### K16 — `main` dal koruması: force-push ve dal silme engellendi, PR zorunlu değil

Yöneticiler dahil (`enforce_admins`).

**Gerekçe:** Force-push ve dal silme geri alınamaz, geçmişi yok eder. PR
zorunluluğu ise tek kişilik projede tören — inceleyecek ikinci kişi yok, her
değişiklik için dal açıp kendi PR'ını onaylamak zaman kaybı.

### K17 — Şema kontrol betiği Node ile yazıldı, Python ile değil

`scripts/check-schema.mjs`, `npm run sema:kontrol` ile çalışır. Bağımlılığı yok.

**Gerekçe:** İlk sürüm Python'du. Projede zaten Node var; betiği Node'a çevirmek
projeye ikinci bir dil çalıştırma zorunluluğu getirmemek demek. Hata bulursa
`1` ile çıkar, böylece ileride dağıtım öncesi kontrolde kullanılabilir.

---

## 2026-08-18 — Veritabanı bağlantısı

Karar veren: proje sahibi (K18); Claude (K19, K20, yetki dahilinde).

### K18 — İki secret scanning ayarının peşine düşülmeyecek

`secret_scanning_non_provider_patterns` ve `secret_scanning_validity_checks`
kapalı kalacak.

**Gerekçe:** Denendi. GitHub API isteği HTTP 200 dönüyor ama ayar `disabled`
kalıyor — bu iki özellik GitHub'ın ücretli **Secret Protection** paketine ait.
Ücretli pakete geçmek gerek görülmedi. Mevcut üç koruma yeterli sayıldı:
secret scanning, push protection, dependabot security updates.

### K19 — İki ayrı bağlantı adresi: `DATABASE_URL` ve `DIRECT_URL`

- `DATABASE_URL` — havuzlanmış (pooled) bağlantı, uygulamanın çalışma anı.
  `data/client.ts` bunu kullanır.
- `DIRECT_URL` — doğrudan bağlantı, migration'lar. `prisma.config.ts` bunu kullanır.

**Gerekçe:** Supabase havuzlanmış bağlantıyı pgbouncer üzerinden verir; şema
değişikliği (migration) bu yol üzerinden güvenilir çalışmaz. Uygulama tarafında
ise havuzlama gerekli, aksi halde sunucusuz ortamda bağlantı sayısı tükenir.
İki adresi ayrı tutmak, hangi işin hangi yoldan gittiğini açık kılar.

Değerler `.env.local` dosyasındadır ve asla commit edilmez.

### K20 — Prisma istemcisi `/data` altında, `/lib` altında değil

`data/client.ts` veritabanına erişen tek noktadır. Üretilen istemci kodu
`lib/generated/prisma` altında kalır (Prisma'nın çıktısı, elle yazılmaz).

**Gerekçe:** CLAUDE.md `/data`'yı veri erişim katmanı olarak tanımlıyor;
bağlantıyı açan nesne oraya aittir. `/lib` ortak yardımcılar içindir ve oradan
veritabanı açmak, `/engine`'in yanlışlıkla `/lib` üzerinden veritabanına
ulaşmasına kapı aralardı.

### K21 — Veritabanı parolası yenilenmeyecek

Bağlantı adresleri parolayla birlikte yazışmada paylaşıldı. Parola değiştirilmiyor.

**Gerekçe:** Parola depoya sızmadı. `.env.local` `.gitignore` içinde ve bu
`git check-ignore` ile doğrulandı; commit diff'i parola desenine karşı tarandı,
eşleşme çıkmadı; push protection etkin. Risk yalnızca sohbet kaydıyla sınırlı
kaldığı için yenileme gerek görülmedi.

**Not:** Parola yenilenirse tek yapılacak `.env.local`'i güncellemektir; başka
hiçbir yerde kayıtlı değildir.

---

## 2026-08-18 — Uyumluluk motoru

Karar veren: proje sahibi (K22, K23); Claude (K24, yetki dahilinde).

### K22 — Motor kendi sade tiplerini tanımlar, Prisma tiplerini almaz

`engine/types.ts` hiçbir şey içe aktarmaz. Veritabanı satırını bu tiplere çeviren
dönüştürücü `/data` altına, **arayüz adımında** yazılacak — şimdi yazmak, henüz
gerçek bir okuma ihtiyacı yokken tahminle yazmak olurdu.

**Gerekçe:** Prisma tiplerine bağlanmak — `import type` olsa bile — motoru
veritabanı şemasına yapıştırır. `/engine` kuralının üç gerekçesinin üçünü de
zayıflatırdı: mobilde Prisma istemcisini derlemek gerekirdi, testlerde 12 alanlı
nesneler kurmak zorunlu olurdu, iki motor sürümünü aynı girdiyle karşılaştırmak
üretilmiş bir artefakta bağımlı hale gelirdi.

**Bedeli:** Alan adları iki yerde yazılı. Bu risk `npm run sema:kontrol` içindeki
K22 kontrolüyle kapatıldı: `engine/types.ts`'teki her alan (`id` hariç, o
`parts`'tan gelir) `SCHEMA.md`'deki karşılık tabloda bulunmak zorunda. Kontrol
tek yönlüdür — motor tipleri şemanın alt kümesidir, tersi değil.

### K23 — W3 eşiği %10 değil %15

`gerekli <= psu.wattage < gerekli * 1.15` aralığında uyarı verilir.

**Gerekçe:** Güç kaynakları tam kapasiteye yakın çalışırken verimi düşer ve sesi
artar. %10 bu gerçeği yakalamak için dar kalıyordu. `SCHEMA.md` bölüm 7'deki
tanım da güncellendi.

### K24 — `/engine` saflık kontrolü betiğe eklendi

`npm run sema:kontrol`, `engine/*.ts` dosyalarında yasak içe aktarmaları arar:
Prisma, React/Next, `node:*`, `pg`, `/data`, `/lib` ve `fetch` çağrısı.

**Gerekçe:** CLAUDE.md bu kuralın "sessizce esnetilmemesini" istiyor. İnsan
dikkatine bırakılan kural er geç esner; kontrol otomatikleşince esneyemez.

---

## 2026-08-18 — İlk çalışan sayfa

Karar veren: Claude (K25–K28, yetki dahilinde). K26 proje sahibine önerildi.

### K25 — Veritabanı istemcisine sadece `/data` erişebilir

`data/client.ts` başka hiçbir katmandan içe aktarılmaz. `npm run sema:kontrol`
bunu denetler.

**Gerekçe:** dev-seed filtresi `data/parts.ts` içinde zorunlu. Başka bir katman
Prisma istemcisini doğrudan alırsa filtreyi atlayabilir; o zaman filtre
"zorunlu" olmaktan çıkıp "hatırlanması gereken" bir şeye dönüşür. CLAUDE.md
filtrenin çağıran kodun tercihine bırakılmamasını istiyor.

### K26 — Depolama motora girmez, arayüzde çoklu seçilebilir (S12 kapanışı)

`BuildInput`'ta `storage` alanı yok. Arayüzde kullanıcı istediği kadar disk
seçebilir; bu seçim sistem listesinde görünür ama motora gitmez.

**Gerekçe:** Beta'daki on bir kuralın hiçbiri depolamayı kullanmıyor, dolayısıyla
"kategori başına tek parça" kısıtı depolama için zaten geçerli değil — motor
depolamayı hiç görmüyor. Çoklu disk arayüz meselesi, motor meselesi değil.

**Depolama kuralı gerektiğinde** (`motherboard_specs.m2_slots` şemada duruyor,
doğal aday) `BuildInput`'a `storage: EngineStorage[]` **dizi olarak** eklenecek —
böylece tip iki kez değişmez.

### K27 — Prisma istemcisi `.ts` uzantılı içe aktarma üretir

`prisma/schema.prisma` içinde `importFileExtension = "ts"`, `tsconfig.json`
içinde `allowImportingTsExtensions: true`.

**Gerekçe:** Teknik zorunluluk. Seed script'i üretilen Prisma istemcisini Node
ile doğrudan çalıştırıyor; Node ESM uzantısız içe aktarmayı çözemiyor. Alternatif
`tsx` gibi bir paket eklemekti — Node'un kendi TypeScript desteği yeterliyken
yeni bağımlılık gerekmedi.

### K28 — Seed script'i `DEV_SEED_ALLOWED` bayrağı olmadan çalışmaz

Üç koşuldan biri sağlanırsa reddeder: `NODE_ENV=production`,
`VERCEL_ENV=production`, veya `DEV_SEED_ALLOWED !== "true"`.

**Gerekçe:** dev-seed korumasının 4. katmanı. Bayrak `.env.local` içinde;
canlı ortamda `.env.local` dosyası olmaz, değişkenler platformdan gelir —
dolayısıyla bayrak da olmaz. "Canlı veritabanı" adresi tahmin etmeye çalışmak
yerine ortamın kendisini ölçüt yapmak daha az kırılgan.

---

## 2026-08-18 — Geliştirme ve canlı veritabanı ayrımı

Karar veren: proje sahibi (K29).

### K29 — Geliştirme ve canlı ayrı veritabanlarıdır

İki ayrı Supabase projesi:

| Ortam | Nerede tanımlı | dev-seed |
|---|---|---|
| Geliştirme | `.env.local` (commit edilmez) | Var, 29 parça |
| Canlı | Dağıtım platformunun ortam değişkenleri | Yasak |

**Canlı bağlantı bilgileri hiçbir yerel dosyada bulunmaz.** `.env.local`
yalnızca geliştirme veritabanını gösterir.

**Gerekçe:** Tek veritabanı kullanıldığında dev-seed korumasının 2. ve 3.
katmanları birbiriyle çelişiyordu. 2. katman (veri erişiminde otomatik filtre)
satırların *görünmesini* engelliyor, 3. katman (dağıtım öncesi kontrol) ise
satırların *varlığını* yasaklıyor. Aynı veritabanında hem geliştirme yapıp hem
dağıtmak, 3. katmanın her dağıtımı durdurması demekti.

Ayrıca canlı adresin geliştirme makinesinde hiç bulunmaması, yanlış veritabanına
yazma ihtimalini ortadan kaldırıyor — hatırlamaya değil, erişimin yokluğuna
dayanan bir koruma.

**Yapılan geçiş:** Canlı veritabanındaki 58 dev-seed satırı (29 `parts` +
29 spec) tek işlemde silindi. Silme öncesi sayıldı, sonrası doğrulandı.
O veritabanında dev-seed olmayan hiç satır yoktu, gerçek veri kaybı olmadı.

**Not:** Silme işlemi tek seferlik yapıldı, depoya kalıcı bir silme aracı
eklenmedi. Ayrı veritabanlarıyla böyle bir araca ihtiyaç kalmıyor ve depoda
duran silme aracı başlı başına bir risk.

---

## 2026-08-18 — Dağıtım

Karar veren: proje sahibi (K30); Claude (K31, yetki dahilinde).

### K30 — Site beta bitene kadar arama motorlarına kapalı

İki katman:

- `app/robots.ts` → `/robots.txt`: `User-Agent: *` / `Disallow: /`
- `app/layout.tsx` metadata → `<meta name="robots" content="noindex, nofollow, nocache">`
  ve ayrıca `googlebot` için aynısı

**Gerekçe:** Yarım bir site indekslendiğinde, düzeldikten sonra bile bir süre
eski hâliyle aranır kalır; indeksten çıkmak girmekten çok daha yavaştır.

**İki katman neden:** `robots.txt` taramayı engeller, `noindex` meta etiketi
ise başka bir yerden link alınıp yine de taranırsa indekslenmeyi engeller.
Farklı işler yapıyorlar, biri diğerinin yerine geçmiyor.

**Kaldırma zamanı:** Beta bitiş ölçütü sağlandığında (10 kişi yardımsız sistem
toplayabildiğinde). O zamana kadar bu iki dosya değişmez.

### K31 — Dağıtım öncesi kontrol, Vercel build komutunun ilk adımı

`vercel.json`:

```
"buildCommand": "npm run dagitim:kontrol && prisma generate && next build"
```

**Gerekçe:** dev-seed korumasının 3. katmanı yazılı olmakla kalmamalı,
dağıtım hattında gerçekten çalışmalı. Build komutunun **ilk** adımı olması
bilinçli: canlı veritabanında dev-seed varsa derleme hiç başlamaz, boşuna
süre harcanmaz.

`prisma generate` de burada olmak zorunda: üretilen istemci `lib/generated/`
altında ve `.gitignore` içinde, yani depoda yok — her dağıtımda yeniden
üretilmesi gerekiyor.

**Kontrol `.env.local` okumadığı için** (K29) Vercel'de `DATABASE_URL` neyse
ona bakar. Yani canlı dağıtımda canlı veritabanını denetler.

---

## 2026-08-18 — Fiyat ve performans indeksi

### K32 — `perf_index` satırları dev-seed damgası taşıyamaz, koruma parça üzerinden yürür

Sahte performans indeksleri `source = 'dev-seed'` ile işaretlenemedi:
`perf_index` tablosunda `source` sütunu **yok** (SCHEMA.md bölüm 1.3 ve 4).

Karar: sütun eklenmedi. Bu satırların sahteliği bağlı oldukları parçadan gelir —
dev-seed bir parçanın indeksi de dev-seed'dir.

**Gerekçe:** `perf_index` dış dünya hakkında iddia taşımaz, motorun kendi
hesabıdır; kaynağı `model_version` sütunudur. Oraya `source` eklemek, şemanın
"olgusal iddia taşıyan tablo" ayrımını bozardı.

**Korumaya etkisi:**

| Katman | `perf_index` için durumu |
|---|---|
| 1. Damga | Yok — damgalanacak sütun yok |
| 2. Veri katmanı filtresi | **Var** — `data/perf.ts` parça ilişkisi üzerinden filtreler |
| 3. Dağıtım kontrolü | Dolaylı — `perf_index` taranmaz ama bağlı olduğu `parts` satırı taranır ve dağıtımı durdurur |
| 4. Seed reddi | Var — aynı script |

Dolaylı olan tek katman 3. Bir `perf_index` satırının canlıya sızması için
bağlı olduğu parçanın da canlıda olması gerekir; o parça zaten dağıtımı durdurur.

### K33 — Bant üst sınırı ve darboğaz eşiği: sınır değeri üst tarafa dahildir

`SCHEMA.md` bölüm 8 iki yerde sınırın hangi tarafa ait olduğunu söylemiyordu:

- Bant tablosu "0–25", "25–45" diye yazıyor; **25 hangi banda ait?**
- Darboğaz kuralı "`|fark| < 15` dengeli, `fark > 15` CPU sınırlıyor" diyor;
  **tam 15 hiçbir dala girmiyor.**

Karar: her iki yerde de sınır değeri üst/dış tarafa dahildir.
`index = 25` ikinci banda, `fark = 15` "CPU sınırlıyor"a girer.

**Gerekçe:** Bir değerin hiçbir dala düşmemesi sessiz hataya açık kapı bırakır.
Kuralın ucu açık kalacağına bir yöne kapatılması gerekiyordu; testler bu sınırları
tek tek ölçüyor (`tests/performance.test.ts`).

**Yuvarlama bandan önce yapılır.** Sistem indeksi bir ondalık basamağa
yuvarlanıp öyle banda sokulur. Sebebi: 24,96 ekranda "25,0" yazarken bandın
"1080p düşük" demesi, kullanıcı için açıklanamaz bir çelişki olurdu.

### K34 — dev-seed fiyatları sabit tarihli üç snapshot, seed tekrar yazmaz

Her parça için üç `price_snapshots` satırı üretiliyor: 20.07.2026, 03.08.2026,
17.08.2026. Tarihler koda sabit yazıldı, çalışma anından alınmıyor.

**Neden üç satır, bir değil:** "Güncel fiyat = en son `collected_at`'li satır"
tanımı tek satırla doğrulanamaz — yanlış satırı seçen bir hata görünmez kalırdı.

**Neden sabit tarih:** `price_snapshots` append-only. Çalışma anının tarihi
kullanılsaydı seed her çalıştığında yeni satır üretirdi ve o satırlar
silinemezdi. Seed, yazmadan önce hangi (parça, tarih) çiftlerinin zaten var
olduğuna bakar ve sadece eksikleri ekler — böylece tabloyu şişirmeden
tekrar çalışabilir.

**Satıcı adı `manual`.** Sahte fiyata gerçek bir satıcı adı yazmak, veriye
sahip olmadığımız bir kaynağı ima ederdi.

---

## 2026-08-18 — İş yükü ayrımı (SCHEMA.md v1.1 → v1.2)

Karar veren: proje sahibi (K35, K36, K37). Kod tarafında hiçbir davranış
değişmedi; bu bölüm ileriye dönük bir şema hazırlığıdır.

### K35 — `workload` alanı: `benchmark_points` ve `perf_index`, tekillik üç sütunlu

İki tabloya `workload` enum'ı eklendi:
`gaming`, `ai_inference`, `video_encode`, `productivity`.

`perf_index` tekillik kısıtı (`part_id`, `model_version`) → **(`part_id`,
`workload`, `model_version`)**. K14'ün tekillik kısmını değiştirir.

**Gerekçe:** Bir parçanın tek bir performans gerçeği yoktur. Oyunda güçlü bir
ekran kartı yapay zekâ çıkarımında vasat, video kodlamada iyi olabilir; bunlar
aynı sayıya sıkıştırılamayacak ayrı ölçümlerdir. Tekillik iki sütunlu kalsaydı
ikinci iş yükünün indeksi birincinin üzerine yazılır ve bu sessizce olurdu.

**Neden şimdi, kullanılmayacakken:** Alan sonradan eklenseydi, bugün girilen
bütün ölçümlerin hangi iş yüküne ait olduğu geriye dönük **tahmin edilmek**
zorunda kalırdı. Ölçüm verisi elle toplanıyor ve geriye dönük etiketlenemez.
Boş bir sütunun maliyeti, yanlış etiketlenmiş bir geçmişin maliyetinin yanında
yok sayılır.

**Varsayılan değer yok.** `workload`'ın veritabanı varsayılanı bilinçli olarak
tanımlanmadı: varsayılan olsaydı, iş yükünü söylemeyi unutan bir kayıt sessizce
`gaming` etiketi alırdı. Alanın var olma sebebi tam olarak bunu engellemek.

Mevcut sekiz `perf_index` satırı migration içinde `gaming` olarak dolduruldu —
bunlar gerçekten oyun indeksleri, uydurma bir etiket değil.

### K36 — Çoklu iş yükü skorları hedefte var, beta kapsamı dışında

Oyun / AI çıkarımı / video kodlama / üretkenlik skorları projenin hedefinde
var. Beta'da **yalnızca `gaming`** kullanılacak.

**Neden kapsam dışı:** Eksik olan şema değil, veri. Her iş yükü kendi ölçümünü
gerektirir — bir ekran kartının oyun performansını bilmek, aynı kartın çıkarım
performansı hakkında hiçbir şey söylemez. Dört iş yükü, dört ayrı ölçüm defteri
demektir; ölçümler elle toplanıyor ve beta'da bir tanesi bile tamamlanmadı.

**Türetme yolu kapalıdır.** Bu skorlar parçaların spec alanlarından
hesaplanamaz — bkz. K37.

**Şema hazır, ama tam değil:** `workload ≠ 'gaming'` olan bir ölçüm satırının
`game_id` alanına ne yazılacağı çözülmedi; bugün zorunlu bir alan ve oyun dışı
bir ölçümün oyunu yok. İş yükü genişletildiğinde ilk çözülecek şey budur.
→ `SORULAR.md` S16

### K37 — Spec alanları uyumluluk içindir, performans tahmini için kullanılmaz

Kategori spec tablolarındaki hiçbir alandan performans sayısı türetilmez.
CUDA çekirdek sayısı, saat hızı, çekirdek/thread sayısı, VRAM miktarı — bunlar
"hangi parça hangisine takılır" sorusu için tutulur, "bu parça ne kadar hızlı"
sorusu için değil.

**Gerekçe:** Bu değerler bir mimarinin içinde anlamlıdır, mimariler arasında
değildir. İki farklı nesilden veya iki farklı üreticiden aynı çekirdek sayısı
aynı performans demek değildir; aynı saat hızı da öyle. Bu alanlardan FPS veya
indeks üretmek, kaynağı olmayan bir sayıyı ölçülmüş gibi göstermek olur — ve
yanlışlığı kullanıcıya hiçbir yerde görünmez.

Performans sayısının tek meşru kaynağı `benchmark_points`'teki gerçek
ölçümlerdir. Motor da yalnızca `perf_index` üzerinden çalışır; parça
nesnelerinin spec alanlarını hiç görmez (K22, `engine/performance.ts`).

Bu karar `SCHEMA.md` bölüm 2'ye de not olarak yazıldı — kural, onu ihlal etmeye
en yakın yerde durmalı.

---

## 2026-08-18 — Beta'nın kalan üç özelliği

Karar veren: Claude, "Karar yetkisi" bölümündeki yetki dahilinde. K38 bir
şema sorusuna dokunuyor; alan **eklenmedi**, soru `SORULAR.md` S17'de açıldı.

### K38 — Dondurulan indeks 1440p referansıyla hesaplanır — **DEĞİŞTİRİLDİ, bkz. K43**

> ⚠️ **2026-08-18 tarihinde değiştirildi.** `builds.resolution` alanı eklendi;
> indeks artık sabit bir referansta değil, kullanıcının kaydettiği çözünürlükte
> hesaplanıyor. `REFERENCE_RESOLUTION` sabiti koddan kaldırıldı. Açık soru S17
> kapandı.


`builds.perf_index_snapshot` tek bir `float`. Ama sistem indeksi çözünürlüğe
göre değişiyor (bölüm 8) ve `builds` tablosunda çözünürlük sütunu **yok** —
dondurulan sayının hangi çözünürlüğe ait olduğu şemada yazmıyor.

Karar: dondurulan indeks her zaman **1440p** referansıyla hesaplanır. Sabit
`engine/performance.ts` içinde (`REFERENCE_RESOLUTION`), kayıtlı sistem sayfası
da bunu açıkça yazıyor.

**Gerekçe:** Üç seçenekten ortadaki ve arayüzün varsayılanı. Tek bir sayı
saklanacaksa neyi ifade ettiği sabit olmak zorunda; kullanıcının o an baktığı
çözünürlüğe göre değişseydi iki kayıt birbiriyle karşılaştırılamazdı.

**Alan eklenmedi.** `builds`'e `resolution` eklemek şema değişikliğidir ve
"Dur ve sor" kapsamındadır. Soru açıldı (S17), iş beklemesin diye alansız
çözümle devam edildi. Alan eklenirse bu karar değişir.

### K39 — Dondurulacak değer üretilemiyorsa kayıt reddedilir — **KISMEN DEĞİŞTİRİLDİ, bkz. K44**

> ⚠️ **2026-08-18 tarihinde değiştirildi.** İkinci gerekçe (indeks
> hesaplanamıyorsa reddet) kaldırıldı: `perf_index_snapshot` artık null
> olabiliyor ve ekran kartsız sistemler kaydedilebiliyor. Fiyatı olmayan parça
> nedeniyle reddetme aynen geçerli.


Sistem şu iki durumda **kaydedilmez**:

1. Seçili parçalardan birinin fiyatı yok → toplam dürüst olmaz.
2. İşlemci veya ekran kartı yok → sistem indeksi hesaplanamaz.

**Gerekçe:** `builds.total_price_minor` ve `perf_index_snapshot` zorunlu
alanlar; şema, kaydedilmiş her sistemin dondurulmuş bir fiyatı ve indeksi
olduğunu söylüyor. Eksik fiyata 0 demek toplamı olduğundan ucuz gösterirdi ve
bu sayı donduğu için sonradan düzeltilemezdi — paylaşılan link kalıcı olarak
yanlış bilgi taşırdı. Hata mesajı kullanıcıya sebebini söylüyor.

**Bilinen sınır:** iGPU'lu sistemler (ekran kartsız) uyumluluk kurallarına göre
geçerlidir ama şu an kaydedilemez, çünkü indeksleri hesaplanamıyor. Motor
iGPU indeksi üretmeye başladığında bu kısıt kendiliğinden kalkar.

### K40 — Yükseltme taraması sadece ekran kartı ve işlemciyi kapsar

`SCHEMA.md` bölüm 8 "her kategori için alternatifler taranır" diyor. Uygulamada
yalnızca `gpu` ve `cpu` taranıyor.

**Gerekçe:** Sistem indeksi formülü sadece bu iki parçayı kullanıyor. Bellek
veya kasa yükseltmesi indeksi hiç değiştirmez; taransalardı hepsi "0 artış"
ile elenirdi, yani tarama sonucu değiştirmeden süre harcardı. Daha spesifik
olan kural (indeks formülü) daha genel ifadeyi belirliyor.

Formül genişlerse (`UPGRADE_CATEGORIES` listesi) tarama da genişler.

**Seçim kuralı:** İndeks artışı en yüksek olan kazanır; eşitlikte **ucuz olan**
kazanır. İkinci kural olmasaydı sonuç aday listesinin sırasına bağlı kalırdı.

### K41 — Paylaşım kimliği: altı karakter, karışmayan alfabe

`builds.id` altı karakter, `abcdefghkmnpqrstuvwxyz23456789` alfabesinden.
Çakışırsa beş kez yeniden denenir.

**Gerekçe:** Birbirine karışan karakterler (`0`/`o`, `1`/`l`/`i`, `j`) alfabeden
çıkarıldı — link telefonda elle yazılabilmeli. 30 karakter, 6 hane ≈ 729 milyon
ihtimal; beta ölçeğinde çakışma pratikte imkânsız, yine de veritabanı kısıtı
yakalarsa yeniden deneniyor.

Rastgelelik `crypto.getRandomValues` ile üretiliyor ve modulo sapması reddetme
yöntemiyle giderildi: 256, 30'a tam bölünmediği için artan aralık atılıyor.

### K42 — Kaydedilen değerler tarayıcıdan gelmez, sunucuda yeniden hesaplanır

Sunucu işlemi (`saveBuildAction`) yalnızca **parça id'lerini** alır. Toplam
fiyat ve indeks, `/data` katmanında veritabanından okunarak orada hesaplanır.

**Gerekçe:** Tarayıcıdan gelen sayıya güvenilseydi, isteği elle düzenleyen biri
istediği fiyatı ve indeksi kaydedebilirdi. Kaydedilen değer kalıcı ve
paylaşılabilir olduğu için bu yanlış bilgi başkalarına da gösterilirdi.

---

## 2026-08-18 — Kayıt çözünürlüğü, indekssiz sistem ve canlıya geçiş

Karar veren: proje sahibi (K43, K44); Claude (K45, yetki dahilinde).
`SCHEMA.md` v1.2 → v1.3.

### K43 — `builds.resolution` eklendi, indeks kullanıcının çözünürlüğünde donar

`builds` tablosuna `resolution` enum'ı eklendi (`1080p`, `1440p`, `2160p`).
Dondurulan indeks artık sabit bir referansta değil, kullanıcının kaydettiği
çözünürlükte hesaplanıyor. Kayıtlı sistem sayfası hangi çözünürlük olduğunu
yazıyor. K38'i değiştirir; S17 kapandı.

**Gerekçe:** Sistem indeksi çözünürlüğe göre değişir. Sabit referans (1440p)
tek bir sayıyı anlamlı kılıyordu ama kullanıcının gördüğü sayıyla kaydettiği
sayı farklı olabiliyordu — 4K seçip kaydeden biri linkte başka bir sayı
görüyordu. Alan eklenince ikisi aynı oldu.

**Alan zorunlu (null olamaz), indeks hesaplanamasa bile yazılır.** Kullanıcının
o an baktığı çözünürlük, kaydın kendisi hakkında bir olgudur ve her zaman
bilinir. İki nullable sütunun "ikisi de null ya da ikisi de dolu" diye
birbirine bağlı olmasındansa, biri her zaman dolu olsun.

**Mevcut kayıtlar `1440p` ile dolduruldu** — eski K38 gereği gerçekten o
referansla hesaplanmışlardı, yani uydurma bir etiket değil.

### K44 — `perf_index_snapshot` null olabilir, iGPU sistemler kaydedilebilir

`builds.perf_index_snapshot` artık `float?`. Ekran kartsız (iGPU) sistemler
kaydedilebiliyor; indeks yerine kayıtlı sistem sayfası "performans tahmini için
ekran kartı gerekiyor" yazıyor. K39'un ikinci gerekçesini kaldırır.

**Gerekçe:** iGPU'lu sistem uyumluluk kurallarına göre **geçerlidir** (C4 ve W4
bunu açıkça sayar). Geçerli bir sistemin kaydedilememesi hatadır. Alanın zorunlu
olması, şemanın bir varsayımını (her sistemin indeksi vardır) kullanıcının
önüne engel olarak koyuyordu.

**Null yazılıyor, 0 değil.** 0 geçerli bir indeks değeridir ve "sistem çok
yavaş" demektir; hesaplanamayan bir şeyi 0 yazmak sistemi olmadığı kadar yavaş
gösterirdi — üstelik bu sayı donduğu için sonradan düzeltilemezdi. Null,
"hesaplanamadı" der ve sayfa sebebini yazar.

**`model_version` yine yazılıyor.** Anlamı biraz genişledi: "o indeksi üreten
sürüm" değil, "kayıt anındaki motor sürümü". Hangi sürümün indeks üretemediği
de bilgidir; ileride motor iGPU indeksi üretmeye başlarsa eski kayıtların hangi
sürümde donduğu bilinir.

**Kural kendi fonksiyonunu aldı.** `engine/performance.ts` içinde
`freezeSystemIndex()`: hesaplanabiliyorsa sayı, hesaplanamıyorsa `null`.
Üç satır ama "indeks yoksa ne yazılır" sorusunun cevabı tek yerde duruyor ve
test ediliyor — `/data` içinde kalsaydı test edilemezdi.

**Fiyat tarafı değişmedi:** fiyatı olmayan parça varsa kayıt hâlâ reddediliyor
(K39). Fark şu: fiyat her parça için **vardır ya da toplanamaz**; indeks ise
bazı geçerli sistemler için tanımsızdır.

### K45 — Migration'lar dağıtım hattında çalışır

`vercel.json` build komutu:

```
npm run dagitim:kontrol && prisma migrate deploy && prisma generate && next build
```

**Sebep — bulunmuş bir hata:** Hat bu adımı içermiyordu. `workload` migration'ı
(K35) yalnızca geliştirme veritabanına uygulanmıştı; canlı veritabanı şema
olarak bir sürüm geride kaldı. Kod `perf_index.workload` sütununu sorguluyor,
canlıda o sütun yok — yani canlı ana sayfa, dağıtım yapıldığı andan beri
sorgu hatası veriyor olmalı.

**Neden `dagitim:kontrol`'den sonra:** dev-seed kontrolü geçmeden veritabanına
şema değişikliği uygulanmamalı. Kontrol dururmuşsa migration da çalışmaz.

**Neden `next build`'den önce:** derleme sırasında sayfa verisi toplanıyor;
şema eski kalırsa derleme de hatalı veriyle çalışır.

`prisma migrate deploy` yalnızca bekleyen migration'ları uygular, şema
üretmez ve veri silmez — geriye dönük tehlikeli bir işlem değildir.

---

## 2026-08-18 — Önizleme dağıtımı riski

Karar veren: proje sahibi (K46); Claude (K47, yetki dahilinde).

Riski proje sahibi buldu: `prisma migrate deploy` build komutuna eklendikten
sonra (K45), ortam değişkenleri "Production and Preview" kapsamında kaldığı
sürece bir **önizleme dağıtımı canlı veritabanına migration uygulayabilirdi**.

### K46 — Ortam değişkenleri yalnızca Production kapsamında tanımlıdır

`DATABASE_URL` ve `DIRECT_URL` Vercel'de sadece **Production** kapsamında
tutulur. Preview ve Development kapsamlarında tanımlı değildir.

**Gerekçe:** Canlı veritabanının adresini eline geçiren her dağıtım ona
yazabilir. Önizleme dağıtımları her dal itişinde kendiliğinden oluşur; hiçbiri
canlı şemayı değiştirebilecek yetkiye sahip olmamalı. Migration geri alınamayan
bir işlemdir — "dikkat ederiz" yeterli bir koruma değildir.

**Bu deliği dev-seed kontrolü kapatmıyordu.** `dagitim:kontrol` canlı
veritabanında dev-seed satırı arar; canlı veritabanı temiz olduğu için kontrol
**geçerdi** ve migration çalışırdı. Yani 3. katman bu riske karşı değil,
başka bir riske karşı yazılmıştı. Kapsamı daraltmak tek gerçek çözümdü.

**Sonucu:** Önizleme dağıtımları artık veritabanı adresi görmüyor ve
derlenemiyor (K47). Bu bilinçli kabul edilen bir sonuçtur.

### K47 — Önizleme dağıtımları derlenmez; migration'lar ayrı bir betikten geçer

**Ölçülen davranış.** Veritabanı adresi olmadan build iki bağımsız noktada
duruyor:

1. `npm run dagitim:kontrol` → çıkış kodu **1**
   ("DATABASE_URL tanimli degil"). Zincir burada kesiliyor, `migrate deploy`
   adımına hiç ulaşılmıyor.
2. O adım atlansa bile `next build` → çıkış kodu **1**:
   `Failed to collect configuration for /`, sebep `data/client.ts` içindeki
   "DATABASE_URL tanımlı değil" hatası. Sayfalar `force-dynamic` olsa da Next
   derleme sırasında modülleri içe aktarıyor ve istemci orada kuruluyor.

Yani önizleme dağıtımı **başarısız olur**. Tehlikeli bir şey yapmaz, sadece
kırmızı görünür.

**Eklenen koruma:** `scripts/migrate-deploy.mjs`. `VERCEL_ENV` tanımlı ve
`production` değilse migration uygulanmaz, betik 0 ile çıkar. Build komutu:

```
npm run dagitim:kontrol && npm run dagitim:migration && prisma generate && next build
```

**Neden panel ayarı yetmiyor da bir de betik var:** K46 bir Vercel panel
ayarıdır; ileride biri "önizlemede de veritabanı lazım" diye kapsamı geri
genişletebilir ve bu depoda hiçbir iz bırakmaz. Betik depoda durur, değişirse
commit'te görünür. dev-seed korumasının dört katmanıyla aynı mantık: geri
alınamayan işlemler tek bir ayara bağlanmaz.

**Ölçüldü:**

```
VERCEL_ENV=preview     -> "Migration uygulanmadi: VERCEL_ENV='preview'"   çıkış 0
VERCEL_ENV=production  -> "3 migrations found... No pending migrations"    çıkış 0
VERCEL_ENV tanımsız    -> yerel çalıştırma, uygular                        çıkış 0
```

**Önizleme dağıtımlarının kapatılması ayrı bir karardır** — panel ayarı
gerektiriyor, `SORULAR.md` S18.

---

## 2026-08-19 — Veri kaynağı lisansı

Karar veren: proje sahibi.

### K48 — Kaggle veri setleri kullanılmaz; Wikidata (CC0) serbest

**Kaggle'daki donanım veri setleri kullanılmayacak.** Gerekçe: bunların çoğu
TechPowerUp gibi sitelerden kazınmış (scrape) ve yeniden dağıtım hakkı belirsiz.
Veri setinin Kaggle sayfasında "public domain" yazması, kazındığı sitenin
kullanım şartlarını geçersiz kılmaz. Lisansı belirsiz veriyi canlı bir siteye
koymak, sonradan kaldırılması gereken bir borçtur.

**Wikidata serbesttir.** Bütün içerik CC0 ile yayımlanır: kaynak gösterme
zorunluluğu bile yoktur, ticari kullanım dahil serbesttir.

**Bu bir lisans kararıdır, kalite kararı değil.** Wikidata'nın kullanılabilir
olması, kullanılmaya değer olduğu anlamına gelmiyor — kapsam ve doğruluk ayrı
bir soru ve ölçüldü: `docs/log/2026-08-19-wikidata-fizibilite.md`. Sonuç, beta
için birincil kaynak olamayacağı yönünde.

**Kural olarak:** Dışarıdan alınacak her veri kümesinin lisansı, veri koda
girmeden **önce** kontrol edilir. Kaynağı belirsizse alınmaz. `SCHEMA.md`
bölüm 1.3'teki `source` ve `source_url` alanları zaten bunu zorunlu kılıyor:
nereden geldiğini yazamadığın veriyi giremezsin.

---

## 2026-08-19 — Veri kaynağı: elle giriş

Karar veren: proje sahibi (K49, K50).

### K49 — Wikidata birincil veri kaynağı olmayacak

`docs/log/2026-08-19-wikidata-fizibilite.md` raporundaki ölçümler üzerine
karar verildi: Wikidata GPU/CPU verisi projeye birincil kaynak olarak
alınmayacak.

**Gerekçe — üçü birden:**

1. **Kapsam yok.** 153 GPU modeli, 284 CPU modeli. 2026 modeli hiç yok,
   2024'ten tek GPU var. Core i9-14900K gibi en çok satan bir işlemci
   kayıtlı bile değil.
2. **Alanlar yok.** `gpu_specs`'in sekiz alanından üçü Wikidata'da hiç
   tanımlı değil (`recommended_psu_watt`, `chipset`, `pcie_version`),
   `length_mm` %4 dolu, `vram_gb` için üç rakip özellik var ve hiçbiri
   modern kartlarda dolu değil.
3. **Doğruluk düşük.** Belirleyici örnek: Wikidata, Intel Core i7-3770'in
   soketini `LGA 1151` diye veriyor; doğrusu LGA1155. Bu alan doğrudan
   uyumluluk kuralı C1'i besliyor — yanlış soket, kullanıcıya takılamayacak
   bir sistemi "uyumlu" dedirtir. Ayrıca saat frekansı üç ayrı birimde
   girilmiş ve bir kartın TDP alanında sıcaklık değeri var.

**Lisans sorunu yoktu** — Wikidata CC0 (K48). Eleme tamamen kalite ve kapsam
gerekçesiyle.

**Kalıcı bir kapatma değil.** Veri CC0 ve topluluk düzenliyor; kapsam bir yıl
içinde artabilir. **2027 yazında tekrar bakılacak.** O zaman ölçülecek şey
aynı: `length_mm`, `recommended_psu_watt` ve `pcie_version` doldu mu, ve
bilinen bir yanlış değer (i7-3770 soketi) düzeldi mi.

### K50 — Parça verisi elle girilir; kaynak CSV depoda durur

Beta'nın parça verisi üretici ürün sayfalarından **elle** toplanır.

**Yöntem:**

| Adım | Nerede |
|---|---|
| Kaynak veri | `data/parts/<kategori>.csv` — depoda, versiyonlu |
| İçe aktarma | `npm run parca:aktar` (`scripts/import-parts.mts`) |
| 1. aşama | Her CSV satırı ham haliyle `raw_imports`'a |
| 2. aşama | Normalize edilip `parts` + kategori spec tablosuna |

Damga: `source = 'manufacturer'`, `confidence = 'high'`.

**Neden CSV depoda:** Veri kaynağı git geçmişinde durur; "bu sayı ne zaman ve
neden değişti" sorusu commit'ten cevaplanır. Veritabanı türetilmiş şeydir,
kaynak değil.

**Neden iki aşama:** `SCHEMA.md` bölüm 0, kural 3. Normalizasyon mantığında
hata bulunursa ham satır duruyor olur ve yeniden işlenebilir.

**Satır düzeyinde tek kaynak.** `source_url` şemada satır düzeyindedir, değer
düzeyinde değil. Bu yüzden bir satırın **bütün** değerleri aynı üretici
sayfasından gelir. O sayfada olmayan alan **boş bırakılır**; başka bir
kaynaktan doldurulursa satırın kaynak adresi yalan söyler.

**Zorunlu alan boşsa parça alınmaz.** İçe aktarma o satırı reddeder ve
`raw_imports.error` alanına sebebini yazar. Uydurma değerle doldurmak yerine
parça değiştirilir.

**Normalizasyon uydurma değildir.** Sayfada "Gen 5" yazarken `PCIe 5.0`
yazmak aynı olgunun başka yazımıdır. Sayfada olmayan hat sayısını (`x16`)
eklemek uydurmadır ve yapılmaz.

---

## 2026-08-19 — GPU ölçekleme alanları

Karar veren: proje sahibi.

### K51 — `gpu_specs`'e üç opsiyonel alan: `shader_units`, `boost_clock_mhz`, `memory_bandwidth_gbs`

Hepsi opsiyonel (`Int?`, `Int?`, `Float?`).
Migration: `20260818220913_gpu_olcekleme_alanlari`.

**Gerekçe:** Nesiller arası performans ölçekleme modelinin girdileri.

**K37 ile çelişmiyor.** K37, spec alanlarından **mutlak** performans sayısı
(FPS ya da indeks) türetilmesini yasaklar; gerekçesi bu değerlerin mimariler
arasında karşılaştırılamaz olmasıdır. Bu üç alan mutlak FPS türetimi için
değil, **aynı mimari içinde göreli ölçekleme** için tutulur — örneğin aynı
nesildeki iki kart arasındaki farkı tahmin etmek. Yasaklanan şey, farklı
mimarilerden aynı çekirdek sayısının aynı performans sayılmasıydı; burada
karşılaştırma mimari içinde kalıyor.

**Sınır nerede:** Bu alanlardan üretilen hiçbir sayı `perf_index`'in yerine
geçmez. `perf_index`'in tek meşru kaynağı `benchmark_points` olmaya devam
eder (K37, `SCHEMA.md` bölüm 4 ve 8). Ölçekleme modeli, ölçülmüş noktalar
arasındaki boşluğu doldurmak içindir; ölçümün kendisinin yerine geçmek için
değil.

**Opsiyonel olmalarının sebebi:** NVIDIA ürün sayfaları bu üç değeri her
model için vermiyor. Zorunlu olsalardı bulunamayan modeller hiç
aktarılamazdı — oysa eksik ölçekleme girdisi, eksik uyumluluk alanından
farklı olarak parçayı kullanılamaz yapmıyor.

### K52 — `gpu_specs.length_mm` opsiyonel

Migration: `20260818221920_gpu_uzunlugu_opsiyonel`.

**Gerekçe:** Bilinmeyen uzunluk, uzunluğu olmayan kart demek değildir.
Üreticiler yalnızca kendi referans kartlarının (NVIDIA'da Founders Edition)
ölçüsünü verir; FE üretilmeyen modellerde bu değer hiçbir resmi sayfada yok.
Alanı zorunlu tutmak motoru korumuyordu — sadece veriyi dışarıda bırakıyordu:
RTX 3050, 3060, 4060, 5060 gibi FE'siz modellerin tamamı içe aktarılamıyordu.

C5 kuralı zaten eksik alanda kuralı atlıyor (`ready()` koruması), yani motorun
davranışı değişmedi.

**Arayüz sessiz kalmaz.** Seçili kartın uzunluğu bilinmiyorsa uyumluluk
bölümünde şu yazılır: "Ekran kartının uzunluğu bilinmiyor, kasa uyumluluğu
kontrol edilemedi." Kullanıcı, kontrolün yapılmadığını "sorun bulunamadı"
sanmamalı.

**Neden motor bulgu üretmiyor:** Bulgular `SCHEMA.md` bölüm 7'deki kurallardır
ve "veri eksik" bir kural ihlali değildir. Motora W6 gibi bir kural eklemek,
şemada olmayan bir kuralı koda sokmak olurdu.

### K53 — Aile sayfaları geçerli kaynak sayılır

NVIDIA 30 ve 40 serisini model bazlı değil aile sayfalarında topluyor
(`rtx-4070-family`, `rtx-3060-3060ti`). Bu sayfalar `source_url` olarak kabul
edilir.

**Gerekçe:** Kuralın amacı, satırdaki değerlerin gerçekten o modele ait bir
üretici beyanı olmasıydı. Üretici o model için başka bir spec sayfası
yayınlamıyorsa, aile sayfası bu amacı karşılar. Ölçüt "sayfa tek modele ait
olsun" değil, "üreticinin o model için verdiği tek spec sayfası olsun".

Genel ürün listesi ya da pazarlama sayfası hâlâ kabul edilmez.

### K54 — Aynı slug ikinci kez geldiğinde güncellenir (S20 kapanışı)

İçe aktarma artık atlamıyor, **güncelliyor**. Tek koşul: yeni satırın kaynağı
mevcut satırınkinden düşük güvenilirlikte olmayacak.

Sıra: `manufacturer` > `manual` > `affiliate` > `import` > `user` > `dev-seed`

Düşükse satır atlanır ve sebebi `raw_imports.error`'a yazılır. Güncelleme
olduğunda hangi alanların değiştiği ekrana yazılır.

**Gerekçe:** dev-seed zaten "yerini gerçek veri alana kadar" duran veridir;
onu gerçek veriyle değiştirmek istenen şeydir. Gerçek veriyi sahte veriyle
ezmek ise istenmeyen şeydir — ve ikisi arasındaki farkı veritabanı zaten
`source` sütununda tutuyor, yeni bir alan gerekmedi.

**Sıralamada bir varsayım var:** Proje sahibi üç değeri saydı (`manufacturer`,
`manual`, `dev-seed`). Kalan üçü (`affiliate`, `import`, `user`) aradaki
boşluklara yerleştirildi. Pratikte belirleyici olan yalnızca sıranın en üstü,
çünkü bu script yalnızca `manufacturer` yazıyor.

### K55 — Ölçekleme modeli `memory_bandwidth_gbs`'e bağımlı olmayacak

Alan şemada kalır, opsiyoneldir, ama ölçekleme modeli onu girdi olarak
beklemez. `shader_units` × `boost_clock_mhz` yeterli sayılır.

**Gerekçe:** NVIDIA ürün sayfaları bant genişliğini vermiyor — üç örnek
sayfanın üçünde de yok. Verilen tek şey bellek arayüz genişliği (bit); bellek
hızı da yazılmadığı için bant genişliği hesaplanamıyor, hesaplamak uydurma
olurdu. Modeli bulunamayan bir girdiye bağlamak, modeli kullanılamaz yapardı.

### K56 — `pcie_version` ve `recommended_psu_watt` opsiyonel + zorunluluk ölçütü

Migration: `20260818224819_gpu_pcie_ve_psu_opsiyonel`.

**Gerekçe:** Şema tek üreticinin sayfa yapısına göre kurulmuştu. NVIDIA PCIe
sürümü veriyor, AMD vermiyor; AMD bant genişliği veriyor, NVIDIA vermiyor.
Kaynağa göre değişen bir şeye "zorunlu" denemez.

**Genel kural — zorunluluk ölçütü:**

> Bir alan ancak bir uyumluluk kuralı ya da arayüz tarafından kullanılıyorsa
> zorunlu olabilir.

Bu iki alan hiçbir yerde kullanılmıyordu:

```
$ grep -rn "pcie_version\|recommended_psu_watt" engine/ data/to-engine.ts app/
  (çıktı yok)
```

On bir uyumluluk kuralının hiçbiri bu alanlara bakmıyor. C4 gerekli gücü
işlemci ve kartın TDP'sinden hesaplıyor, `recommended_psu_watt`'ı kullanmıyor.
`EngineGpu` tipinde ikisi de yok. Zorunlulukları hiçbir şeyi korumuyordu;
yalnızca 23 gerçek AMD kartını dışarıda bırakıyordu.

Kural `CLAUDE.md` "Kalite" bölümüne de yazıldı: yeni bir zorunlu alan
önerilirken "hangi kural bunu kullanıyor" sorusu cevaplanmak zorunda.

`npm run sema:kontrol` bu kuralı denetliyor: zorunlu bir spec alanı `engine/`
ya da `app/` içinde hiç geçmiyorsa uyarı basıyor. Uyarı, hata değil —
kullanılmayan zorunlu alan bir tasarım kokusudur, kırık kod değil.

---

## 2026-08-19 — shader_units'in birimi

Karar veren: proje sahibi.

### K57 — `gpu_specs.shader_unit_type` eklendi (S23 kapanışı)

Enum: `cuda_core`, `stream_processor`, `xe_vector_engine`. Opsiyonel, ama
`shader_units` doluysa dolu olmak zorunda.
Migration: `20260818230404_shader_unit_type`.

Intel'in "Xe Vector Engines" sayısı ham haliyle `shader_units`'e yazılır,
tipi `xe_vector_engine` olur. NVIDIA `cuda_core`, AMD `stream_processor`.

**Gerekçe:** `shader_units` markalar arası karşılaştırılabilir **değildir**.
Intel'de yaklaşık 16 kat fark var (B580: 160 Xe Vector Engine, ALU karşılığı
~2560) ama NVIDIA ile AMD arasında da mimari fark var — aynı CUDA çekirdeği
sayısı ile aynı stream processor sayısı aynı performans demek değil.

Tip etiketi bu kısıtı **yapısal** hale getiriyor: sayının ne saydığını satırın
kendisi söylüyor, kodu yazanın hatırlamasına bırakılmıyor. Alternatif —
Intel'i boş bırakmak — bilgiyi tamamen atardı; ham sayıyı tipsiz yazmak ise
sessiz yanlış karşılaştırmaya kapı açardı.

### K58 — KALICI KURAL: `shader_units` yalnızca aynı mimari içinde kullanılır

> Performans ölçekleme modeli `shader_units`'i **yalnızca aynı mimari içinde**
> kullanabilir. Farklı marka ya da farklı nesil arasında bu alanla
> karşılaştırma yapılmaz.

**Gerekçe:** K37'nin (spec alanlarından performans türetilmez) ve K51'in
(ölçekleme alanları aynı mimari içindir) doğal sonucu, ama artık açıkça
yazılı. `shader_unit_type` bu kuralın ihlal edilip edilmediğini kontrol
edilebilir kılıyor: iki satırın tipi farklıysa karşılaştırma geçersizdir.

Kural `CLAUDE.md` "Veri kuralları" bölümüne de yazıldı.

`npm run sema:kontrol` denetler: `shader_units` dolu olan her CSV satırında
`shader_unit_type` da dolu olmalı.

---

## 2026-08-19 — Fiziksel ölçü disiplini

Karar veren: proje sahibi.

### K59 — Açıklık değerlerinde en küçüğü yazılır, ondalık aşağı yuvarlanır

Bir açıklık/tolerans değeri için üretici birden fazla sayı veriyorsa (yapılandırmaya
göre değişen) **en küçüğü** yazılır. Ondalıklı değerler **aşağı** yuvarlanır.

İlk uygulamalar:
- Fractal North `max_psu_length_mm` = **155** (sayfa: "1 HDD Tray: 255 mm max,
  2 HDD Tray: 155 mm max")
- Lian Li LANCOOL 216 `max_cpu_cooler_height_mm` = **180** (sayfa: 180.5 mm)

**Gerekçe:** Kullanıcı hangi yapılandırmayı kullandığını bilmiyor. Yanlış
"sığar" demek, gereksiz uyarıdan çok daha pahalı — kullanıcı parçayı alır ve
takamaz. Gereksiz uyarının bedeli bir cümle okumak; yanlış onayın bedeli iade
süreci.

Bu, `case_specs`'in üç alanını ve `psu_specs.length_mm`'i doğrudan etkiliyor;
bunlar C5 ve W5 kurallarını besliyor.

### K60 — Fiziksel ölçülerde çıkarım yapılmaz

Yalnızca üreticinin **etiketlediği** değer yazılır. Etiketsiz bir sayıdan hangi
eksenin uzunluk olduğu çıkarılabilse bile yazılmaz; alan boş bırakılır.

İlk uygulama: Corsair RM850e `length_mm` **boş**. Sayfa yalnızca
`Dimensions: 140x150x86` diyor, eksen sırası yazmıyor. Seasonic aynı üç sayıyı
`140 mm (L) x 150 mm (W) x 86 mm (H)` diye etiketliyor ve 150×86 ATX
standardının sabit ölçüleri — yani 140'ın uzunluk olduğu neredeyse kesin.
**Yine de yazılmadı.**

**Gerekçe:** "Bulamazsan boş bırak" kuralı, ilk zorlandığı yerde esnetilirse
kural olmaktan çıkar. Çıkarımın bu seferki doğruluğu, kuralın bir sonraki sefer
yanlış çıkarıma açılmasına değmez.

### K61 — `psu_specs.efficiency_rating` opsiyonel

Migration: `20260818233436_psu_efficiency_opsiyonel`.

**Gerekçe:** K56 ölçütü — hiçbir uyumluluk kuralı ve arayüz bu alanı
kullanmıyor; zaten S22 listesindeydi. Ayrıca üreticiler aynı sertifika sistemini
yayınlamıyor: Corsair RM850e sayfasında 80 PLUS satırı yok, yalnızca
"Cybenetics Gold" var. Değer sayfada yazdığı gibi girilir — `80+ Gold` da olur,
`Cybenetics Gold` da.

### K62 — KALICI KURAL: fiziksel ölçü alanları asla zorunlu olmaz

Uzunluk, yükseklik, açıklık gibi fiziksel ölçü alanlarının hiçbiri zorunlu
olamaz. İlgili kural eksik alanda kendini atlar, arayüz kullanıcıya bildirir.

`psu_specs.length_mm` opsiyonel oldu.
Migration: `20260818234304_psu_uzunluk_opsiyonel`.

**Gerekçe:** Üreticiler bu değerleri tutarsız yayınlıyor; zorunluluk veriyi
dışarıda bırakmaktan başka işe yaramıyor.

**Bu üçüncü kez aynı duvara çarpmamız:**

| Ne zaman | Alan | Karar |
|---|---|---|
| 1. | `gpu_specs.length_mm` — FE üretilmeyen kartlar | K52 |
| 2. | `pcie_version`, `recommended_psu_watt` — AMD yayınlamıyor | K56 |
| 3. | `psu_specs.length_mm` — Corsair eksen etiketlemiyor | **K62** |

Üçünde de aynı desen: şema tek bir üreticinin yayın alışkanlığına göre
kurulmuş, ikinci üretici gelince kırılmış. Kural artık genel: fiziksel ölçü
alanı zorunlu yapılmaz, bir üretici yayınlıyor diye.

K56'nın ölçütü (bir alan ancak bir kural ya da arayüz kullanıyorsa zorunlu
olabilir) tek başına yetmiyordu: `length_mm` **kullanılıyor** (C5, W5) ama
yine de zorunlu olmamalı. K62 bu boşluğu kapatıyor.

### K63 — Üretici veri sayfası (PDF) satır kaynağı olabilir

Kingston'ın aile sayfaları CAS gecikmesini SKU başına vermiyor; yalnızca
"CL30, CL32, CL36" biçiminde aralık yayınlıyor. Aynı sayfadaki filtre verisi
hız ve kapasiteyi SKU'ya bağlıyor ama gecikmeyi bağlamıyor.

`cas_latency` zorunlu bir alan olduğu için o sayfadan satır yazılamaz.
Kingston'ın SKU başına yayınladığı veri sayfası (`kingston.com/dataSheets/
<PARTNO>.pdf`) bütün değerleri tek belgede veriyor ve `source_url` oraya
verildi.

**Gerekçe:** `data/parts/README.md`'nin ölçütü "üreticinin o model için verdiği
tek spec sayfası" — belgenin HTML mi PDF mi olduğu ölçüt değil. WD SN850X
satırı zaten bir PDF veri sayfasından geliyordu; kural değişmedi, yazıya
döküldü.

### K64 — Sahte veri temizliği parçalarla sınırlı, fiyatlarla değil

`npm run seed:temizle` dev-seed **parçalarını** ve onlara bağlı bütün satırları
siler. Gerçek parçalara bağlı dev-seed fiyat ve `perf_index` satırlarına
dokunmaz.

İlk çalıştırmada: 17 parça, 51 fiyat, 1 perf_index, 32 build_items ve 5 sistem
kaydı silindi; gerçek parçalara bağlı 36 fiyat ve 7 perf_index satırı kaldı.

**Gerekçe:** Parçaların gerçek karşılığı var, fiyatların yok — fiyat kaynağı
henüz kurulmadı. Silinirse geliştirme ortamında hiç fiyat ve performans verisi
kalmaz, sayfa boş görünür. Sahte fiyatı canlıdan uzak tutan şey zaten veri
erişim katmanının otomatik filtresi (dev-seed korumasının 2. katmanı).

Beş sistem kaydı (`builds`) tamamen silindi. Üçü dev-seed parçaya bağlıydı ve
yalnızca o satırları silmek eksik parçalı, hiçbir işe yaramayan sistem kayıtları
bırakırdı. Hepsi 17 Ağustos tarihli test kayıtlarıydı.

### K65 — `has_igpu = false` yalnızca üretici açıkça söylüyorsa yazılır

Intel'in ARK spec sayfaları F serisi işlemcilerde grafik bölümünü **hiç
göstermiyor** — "yok" demiyor, alan sayfada bulunmuyor. Alanın yokluğundan
`has_igpu = false` çıkarmak, K60'ın yasakladığı çıkarımın aynısı.

Bu yüzden Core i5-14400F ve i7-14700F **eklenmedi**.

AMD Ryzen 5 7500F sayfası `Graphics Model = Discrete Graphics Card Required`
diyor — açık ifade. O satır yazıldı ve W4 kuralını tetikleyebilen tek işlemci o.

**Gerekçe:** `has_igpu` zorunlu bir alan ve W4 kuralını doğrudan besliyor.
Yanlış `false`, kullanıcıya olmayan bir uyarı gösterir; yanlış `true`, ekran
kartı olmayan bir sistemi onaylar. İkisi de sayfada yazmayan bir sayıdan
daha pahalı.

### K66 — Kuralların tetiklenebilirliği veriyle birlikte denetlenir

`npm run kural:kontrol` her uyumluluk kuralı için gerçek parçalardan oluşan
somut bir kombinasyon arar, bulduğunu ekrana yazar, bulamazsa hata verir.

**Gerekçe:** Veri gerçek oldu diye kuralların çalıştığı kanıtlanmış olmaz.
Veritabanında bir kuralı tetikleyecek parça çifti kalmadıysa o kural sessizce
ölü koda döner. Testler kuralın mantığını doğruluyor; bu script kuralın
**bugünkü veri kümesinde anlamı olduğunu** doğruluyor. İkisi farklı sorular.

İlk çalıştırmada W4 tetiklenemedi: veritabanındaki 39 işlemcinin hepsinde
tümleşik grafik vardı. Boşluk gerçekti, kural değil veri eksikti (bkz. K65).

### K67 — dev-seed filtresi kodda yazılı olmakla kalmaz, ölçülür

`npm run seed:filtre-kontrol` /data katmanını **iki ayrı süreçte**, iki farklı
`NODE_ENV` ile çalıştırır ve ne döndüğüne bakar. İki süreç zorunlu:
`visibility.ts`'teki `IS_LIVE` modül yüklenirken bir kez hesaplanıyor, tek
süreç içinde değiştirilemiyor.

İlk ölçüm (36 dev-seed fiyat satırı varken):

```
GELISTIRME (NODE_ENV=development, IS_LIVE=false)
  katalog parcasi     : 148
  gorunur fiyat       : 12
  dev-seed fiyat sizan: 12
CANLI      (NODE_ENV=production, IS_LIVE=true)
  katalog parcasi     : 148
  gorunur fiyat       : 0
  dev-seed fiyat sizan: 0
```

**Gerekçe:** Filtrenin kodda durması çalıştığını göstermez. K64 sahte fiyatları
bilerek bıraktı; o kararın güvenli olması tamamen bu filtreye bağlı. Bağlı
olunan şey ölçülmeden bırakılmaz.

Script sorguyu yeniden yazmaz, gerçek fonksiyonları (`getCurrentPrices`,
`getPerfIndexes`, `getBuilderCatalog`) çağırır. Yeniden yazsaydı /data içindeki
bir bağlantı hatası bu kontrolden kaçardı.

Ayrıca yanlış pozitife karşı iki kontrol var: veritabanında hiç dev-seed fiyat
satırı yoksa, ya da geliştirmede de hiç görünmüyorsa script hata verir —
"filtre çalışıyor" ile "veri zaten yok" karışmasın diye.

**Yan etki:** `/data` katmanının göreli içe aktarımları `.ts` uzantısı aldı ve
`data/client.ts` `@/` takma adı yerine göreli yola geçti. Takma adı yalnızca
Next'in derleyicisi çözüyor; çıplak Node çözemiyor. O satırlar takma adla
kaldığında /data hiçbir script'ten içe aktarılamıyor ve filtre ancak
**kopyalanarak** sınanabiliyordu — yani asıl sınanmak istenen şey sınanamıyordu.
`allowImportingTsExtensions` tsconfig'te zaten açıktı.

`perf_index` bu yolla kapatılamıyor: tabloda `source` sütunu yok, filtre
parçanın damgasına bakıyor ve gerçek parçaya bağlı sahte indeks canlıya çıkıyor.
Bkz. `SORULAR.md` S29.

### K68 — K62 `case_specs`'e de uygulandı, istisna kalmadı

`max_gpu_length_mm`, `max_cpu_cooler_height_mm` ve `max_psu_length_mm`
opsiyonel oldu. Migration: `20260819085800_kasa_olculeri_opsiyonel`.

`supported_form_factors` **zorunlu kaldı**: o bir fiziksel ölçü değil,
üreticinin listelediği uyumluluk beyanı, ve C6 onsuz hiç çalışamaz.

**Gerekçe:** K62 kalıcı kural olarak yazılmıştı ama yalnızca `psu_specs`'e
uygulanmıştı. Fractal Design üç ölçüyü de yayınladığı için sorun görünmüyordu —
bir üreticinin yayın alışkanlığına güvenmek, K52/K56/K62'de üç kez kırılan
şeyin ta kendisi. Dördüncü kez beklenmedi.

**Doğrulandı, sadece derlenmedi:** Node 304'ün üç ölçüsü geçici olarak CSV'de
boşaltıldı ve içe aktarıldı. Zincirin tamamı çalıştı:

```
[GUNCEL] fractal-design-node-304 — degisen: max_gpu_length_mm,
         max_cpu_cooler_height_mm, max_psu_length_mm
case_specs: max_gpu_length_mm=null, max_cpu_cooler_height_mm=null,
            max_psu_length_mm=null
C5  TETIKLENMEDI  — ekran karti kasaya sigmiyor
```

Motor çökmedi, uydurma bulgu üretmedi, kuralı atladı. Gerçek değerler geri
yazıldı.

Motorda artık **iki uç da** opsiyonel: C5 için hem `gpu.length_mm` (K52) hem
`case.max_gpu_length_mm`; W5 için hem `psu.length_mm` hem
`case.max_psu_length_mm`. Testlere iki yeni durum eklendi (110 test).

### K69 — Son ek anlamı üreticinin adlandırma sayfasından okunur

Intel'in ARK spec sayfaları F serisi işlemcilerde grafik bölümünü hiç
göstermiyor. K65 bu yüzden i5-14400F ve i7-14700F'i dışarıda bırakmıştı.

Intel'in resmî adlandırma sayfası
(`intel.com/content/www/us/en/processors/processor-numbers.html`) son ek
tablosunda şunu yazıyor:

| Form/Function | Suffix | Optimized/Designed for |
|---|---|---|
| Desktop | F | Requires discrete graphics |

Bu bir çıkarım değil, üreticinin yazılı beyanı — yalnızca başka bir sayfada.
İki işlemci de `has_igpu = false`, `confidence = high` ile eklendi.

**`source_url` neden ARK sayfası, adlandırma sayfası değil:** Satırın 15
alanından 14'ü ARK'ta yazılı, adlandırma sayfasında hiçbiri yok.
`SCHEMA.md` bölüm 1.3'te `source_url` satır düzeyinde ve
`data/parts/README.md` "satırdaki bütün değerler orada yazılı olmalıdır" diyor.
Adres adlandırma sayfasını gösterseydi, "20 çekirdek nereden geldi?" sorusunun
izi kopardı.

Adlandırma sayfası bunun yerine burada, kalıcı bir kural olarak duruyor:
**F son ekli her Intel masaüstü işlemcisinde `has_igpu = false`.** Tek satırın
gerekçesi değil, bütün seri için geçerli bir tanım — kararın yeri de burası.

K65 bu kararla değişti, silinmedi: ölçüt hâlâ "üretici açıkça söylemeli".
Değişen, "açıkça söyleme"nin aynı sayfada olmak zorunda olmadığı.

### K70 — Az kombinasyonlu kural uyarı alır

`npm run kural:kontrol` bir kuralı **3'ten az** kombinasyon tetikliyorsa
`UYARI` yazar. Çıkış kodu 0 kalır — bu bir hata değil.

**Gerekçe:** Yaşandı. W4 kataloğa tek bir işlemci girene kadar hiç
tetiklenmiyordu ve kimse fark etmemişti. Tek kombinasyona bağlı bir kural, o
parça katalogdan çıktığında aynı sessizliğe geri döner. Hata değil çünkü veri
kümesinin küçük olması bir hata değil, bir risk; insanın görmesi yeter.

Eşik neden 3: iki kombinasyon çoğu zaman tek bir parçanın iki farklı eşine denk
geliyor (C5 bugün tek kasaya bağlı, yalnızca GPU tarafı değişiyor). Üçüncü
kombinasyon genelde ikinci bir parçanın da işin içinde olduğunu gösteriyor.

Intel F serisi eklendikten sonra uyarı alan kural sayısı 4'ten 3'e indi:
C5 (2), W2 (2), W5 (1).

### K71 — KALICI KURAL: `perf_index` satırları yalnızca hesaplanarak üretilir

`perf_index` satırları **yalnızca `benchmark_points` verisinden hesaplanarak**
yazılır. Elle, seed ile, CSV ile ya da başka bir yoldan satır girilmez.

Elle konmuş 7 satır silindi:

```
delete from perf_index  ->  7 satir
perf_index: 0, benchmark_points: 0
```

`scripts/seed-prices.ts`'teki `PERF_INDEXES` ve `PERF_COMPUTED_AT` sabitleri
kaldırıldı; `scripts/seed.mts` bu tabloya artık yazmıyor ve **yazamıyor**:
script başında ve sonunda satır sayısını okuyup karşılaştırıyor, sayı
değişmişse hata verip çıkıyor.

```
Performans indeksi: seed yazmadı, tabloda 0 satır var (K71).
```

**Gerekçe:** Sorun damgalama değildi, satırların uydurma olmasıydı.
Hesaplanmış bir tabloda el yazması sayı olmaz — sayının nereden geldiği
sorulamaz hale gelir.

`perf_index`'e `source` sütunu **eklenmedi**; K32 geçerli, tablo dış dünya
hakkında iddia taşımıyor. Fiyattaki çözüm (dev-seed damgası + canlıda filtre,
K64/K67) burada uygulanamıyordu: damgalanamayan sahte satır gerçek bir parçaya
bağlandığında canlıda görünüyordu. Ölçüm:

```
CANLI (IS_LIVE=true)   gorunur fiyat: 0   gorunur perf indeksi: 7
```

Fiyat filtreleniyordu, indeks filtrelenemiyordu. Çözüm satırları silmek oldu.

**Beklenen durum bir hata değil:** ölçüm verisi toplanana kadar hiçbir parçanın
indeksi yok. Motor bunu zaten karşılıyordu (`computePerformance` eksik indekste
`{ ok: false, missing }` döndürüyor, K44); eksik olan arayüzün doğru cümleyi
kurmasıydı.

**Arayüzde ayrım yapıldı.** Eksik indeksin iki sebebi var ve kullanıcıya farklı
şey söylerler:

| Durum | Mesaj |
|---|---|
| Parça seçilmemiş | "Tahmin için hem işlemci hem ekran kartı gerekiyor." |
| Parça seçili, ölçüm yok | "Performans tahmini için henüz yeterli veri yok." |

Birincisini kullanıcı düzeltir, ikincisini düzeltemez. Aynısı yükseltme önerisi
bölümünde ve kaydedilmiş sistem sayfasında da yapıldı.

Doğrulandı (`npm run dev`, gerçek tarayıcı):

```
Ryzen 7 7800X3D + RTX 5090 secili:
  "Performans tahmini için henüz yeterli veri yok."
  "Yükseltme önerisi de performans verisine dayanıyor..."
Yalniz Ryzen 7 7800X3D secili:
  "Tahmin için hem işlemci hem ekran kartı gerekiyor."
  "Ekran kartı seçilmedi. / İşlemci için performans verisi yok."
Kaydedilen sistem sayfasi:
  "Performans tahmini için yeterli veri yok." — fiyat dondu, sayfa calisti
```

Konsolda hata yok, boş sayı gösterilmiyor, sayfa çökmüyor.

## 2026-08-19 — Benchmark toplama kararları

Karar veren: proje sahibi (K72, K73, K74).

### K72 — Kaynak başına satır tavanı ⚠️ DEĞİŞTİRİLDİ (2026-08-19, K75 ile)

**İlk hâli (yürürlükte değil):** bir (alan adı, oyun, çözünürlük, ayar)
kombinasyonundan en fazla 8 satır **ve aynı alan adından toplam en fazla 25
satır**.

25 sayısı aynı gün Faz 0 fizibilitesinde çöktü: 306 satırlık hedef, alan adı
başına 25 satırla 13 farklı kaynak gerektiriyordu; per-oyun okunabilir veri
doğrulanabilen kaynak sayısı ise 1'di (`docs/log/2026-08-19-faz0-fizibilite.md`
bölüm 4).

**Yürürlükteki kural K75'tir.** Bu madde kaydın bütünlüğü için duruyor;
uygulanmaz.

### K73 — İndeks ölçeği sabit referans parçaya bağlanır, 100 aşılabilir

```
gpu_idx(RTX 4070)      = 100
cpu_idx(Ryzen 5 9600X) = 100
```

`perf_index.index_value` artık "0–100" değil. Üst sınır yok; daha hızlı parçalar
100'ü aşar. Sütun zaten `Float`, veritabanı değişmedi — değişen `SCHEMA.md`
bölüm 4 ve bölüm 8.

**Gerekçe:** Göreli ölçekte — "kataloğun en hızlısı = 100" — yeni bir kart
çıktığı gün bütün indeksler aşağı kayar. Kullanıcının donanımı değişmediği hâlde
bandı düşer: dün "4K ultra" olan sistem bugün "1440p ultra" olur. Sabit
referansta bu olmaz, geçmişe dönük tutarlılık bozulmaz.

**Neden orta segment referans:** Hem üstünde hem altında yer kalsın. RTX 4070
ayrıca her yerde ölçülmüş bir kart, yani bol oran kenarı sağlıyor — ölçeğin
dayandığı düğümün iyi bağlı olması gerekiyor.

**İşlemci referansı Claude'un seçimi** (yetki dahilinde, proje sahibi yalnızca
ekran kartı referansını belirtti). İlk seçim Ryzen 5 7600 idi; Faz 2'de
**Ryzen 5 9600X ile değiştirildi.** Sebep ölçüm: kaynağın per-oyun işlemci
grafiklerinde 7600 yok, yalnızca paket ortalamasında var — yani referans
ölçülemiyordu ve ölçek çakılacak bir düğüm bulamıyordu. 9600X aynı ölçütü
karşılıyor (orta segment, üstünde 9800X3D altında i5-14400F) **ve** per-oyun
grafiklerinde ölçülü.

**Yan sonuç, bilerek kabul edildi:** İki referans da 100 olduğu için
**referans sistem her çözünürlükte tam 100 verir** (ağırlıklar ne olursa olsun,
`100·w_gpu + 100·w_cpu = 100`). Bant tablosunun sabit dayanağı bu.

**Bantlar yeniden yazıldı ama geçici.** Eski sınırlar (0–25 … 80–100) referans
değişince anlamını yitirdi. Yenileri (0–40 … 130+) şimdilik referans sistemin
100'de durduğu varsayımıyla yerleştirildi ve gerçek veri geldiğinde ölçülmüş
sistemlere karşı doğrulanmalı. Bilinen risk: ağırlıklı toplam orta segment
işlemciyi 100 saydığı için zayıf kartlı sistemleri yukarı çekebilir
(RTX 3060 + Ryzen 5 7600, 1080p'de `50·0.55 + 100·0.45 ≈ 73`). Doğrulanmadan
bantlar kesinleşmiş sayılmaz.

### K74 — İnterpolasyon yapılmaz, ölçülmeyen parça indekssiz kalır

Doğrudan ölçülmemiş bir parçaya, spec alanlarından (shader sayısı × saat hızı,
VRAM, bant genişliği) türetilmiş indeks yazılmaz. O parça `perf_index` almaz;
arayüz "performans verisi yok" der.

**Gerekçe — üç ayrı sebep, her biri tek başına yeterli:**

1. **K71'in yasakladığı şeyin matematikli hâli olurdu.** K71 dün yazıldı:
   `perf_index` satırları yalnızca `benchmark_points`'tan hesaplanarak üretilir.
   Spec'ten türetilen sayı `benchmark_points`'tan gelmiyor; içinde daha fazla
   aritmetik olan bir el yazması sayı oluyor.
2. **K57/K58 zaten aileler arası karşılaştırmayı geçersiz sayıyor.**
   `shader_units` yalnızca aynı mimari içinde anlamlı. İnterpolasyon en iyi
   ihtimalle aile içinde yapılabilirdi, ki kapsamayı çözmezdi.
3. **Kullanıcı ayırt edemezdi.** `perf_index`'te `confidence` sütunu yok ve
   olmamalı (K32) — tablo dış dünya hakkında iddia taşımıyor. "Bu satır
   ölçülmedi, tahmin edildi" bilgisi hiçbir yere yazılamıyor. Ölçülmüş indeksle
   tahmin edilmiş indeks ekranda aynı görünürdü.

Kapsamanın eksik kalması kabul edildi: ~60 kartın ~10'u incelemelerde nadir
ölçülüyor (RTX 3050 6GB, RTX 3060 8GB, RTX 3080 12GB, RTX 5050, RX 6700,
RX 9070 GRE, Arc A770 8GB, Arc A380/A580). Bunlar indekssiz kalacak.

**Bu, aynı duvara altıncı çarpış:** K52, K56, K60, K62, K71 ve şimdi K74.
Hepsinde aynı tercih yapıldı — eksik veriyi göstermek, uydurulmuş veriyi
göstermekten iyidir.

### K75 — Kaynak tavanı orandır, mutlak sayı değil

`benchmark_points` toplarken:

1. Bir sayfanın yayınladığı veri noktalarının **en fazla %10'u** alınır.
   **Payda (K84):** o sayfanın makine tarafından okunabilir biçimde
   yayınladığı **toplam FPS değeri sayısı** — yani kart/işlemci × oyun ×
   çözünürlük × ayar hücrelerinin tamamı. Bizim kataloğumuzda karşılığı olup
   olmaması, persentil mi ortalama mı olması fark etmez. Sayım yapılmadan oran
   uygulanamaz.
2. Tek bir (oyun, çözünürlük, ayar) grubunun **tamamı asla alınmaz** —
   grup 8 satırdan kısa olsa bile.
3. Kombinasyon başına **en fazla 8 satır** (K72'den devam ediyor).
4. ~~Her parçanın en az iki **farklı alan adından** ölçümü olur.~~
   ⚠️ **DEĞİŞTİRİLDİ (2026-08-19, K80 ile).** Yürürlükte değil.

**Gerekçe:** 25 sayısı keyfiydi ve yanlış şeyi ölçüyordu. Telif açısından önemli
olan alınan mutlak miktar değil, **alınan miktarın kaynağın bütününe oranı**.
Bir sayfanın 20 veri noktası varsa 25 satır zaten alınamaz; 800 veri noktası
varsa 25 satır gereksiz yere kısıtlayıcıdır. Oran her iki durumda da doğru
davranıyor.

2. madde 1. maddenin kaçağını kapatıyor: küçük bir grubun tamamı, oranı
aşmadan alınabilirdi. Bir grubun tamamı o grubun derlemesidir; oran ne derse
desin alınmaz.

Sınırın var olma sebebi değişmedi (`SCHEMA.md` bölüm 4): FPS sayısının kendisi
bir olgudur ve olgular telifle korunmaz, ama **derlemenin kendisi** korunur.
Tek tek sayı almakla bir veri tabanının önemli kısmını çekmek hukuken farklı
şeyler.

**Yöntemsel gerilim ve neden sıfır olamıyor:** İki kartın gücünü
karşılaştırmanın tek geçerli yolu aynı kaynakta aynı koşulda ölçülmüş
sayılarının oranı — farklı sitelerin FPS'leri doğrudan karşılaştırılamıyor
(test sahnesi, sürücü, bellek farklı). Yöntem aynı sayfadan en az iki satır
almayı **zorunlu** kılıyor. Tavan bu zorunluluğu karşılıyor, ötesine izin
vermiyor.

**Uygulama notu:** ComputerBase'in bir GPU benchmark sayfasında 24 grup ×
~14 kart ≈ 336 FPS değeri sayıldı, yani %10 ≈ 33 satır. CPU sayfasında 20
grafik × ~12 satır ≈ 240 değer, %10 ≈ 24 satır.

### K76 — Kapsam daraltıldı: ~30 GPU + ~20 CPU

Bütün katalog indekslenmeyecek. Ölçüm hedefi **güncel ve bir önceki nesil**,
kaynaklarda en sık ölçülen kartlarla sınırlı: kabaca 30 ekran kartı ve 20
işlemci.

Kapsam dışı: RDNA2 (RX 6000 serisi), Ampere (RTX 3000 serisi) ve benzeri eski
nesiller. Bu parçalar katalogda kalır, fiyatı ve uyumluluk kontrolü çalışır,
**yalnızca indeksleri olmaz**.

**Gerekçe:** Sağlam indeksli 30 kart, yarım yamalak indeksli 60 karttan iyi.
K74 zaten indekssiz parçaya izin veriyor ve arayüz bunu düzgün karşılıyor.

Faz 0 aritmetiği: 60 kart × 3 ölçüm = 306 satır hedefi, mevcut kaynak sayısıyla
karşılanamıyordu. Daraltılmış kapsam ~150 satır demek ve bu ulaşılabilir.

**Seçim ölçütü:** güncel + bir önceki nesil olmak **ve** kaynaklarda sık
ölçülmek. İkinci ölçüt birincisini eziyor — yeni ama kimsenin ölçmediği bir
kart kapsama girmez, çünkü zaten indekslenemez.

### K77 — Farklı sürücü dönemi köprülenmez

İki ölçüm grubu farklı sürücü döneminde alınmışsa aralarında köprü kurulmaz —
ortak kart bulunsa bile.

Eski nesil bir kart ancak **yeni kartlarla aynı incelemede** ölçülmüşse
indekslenir. O incelemede yoksa indekssiz kalır; eski bir incelemeden çekilip
bugünkü ölçeğe eklenmez.

**Gerekçe:** Sürücü sürümü FPS'i değiştiriyor ve değişim markaya ve nesle göre
farklı. 2022 incelemesindeki RX 6800 ile 2026 incelemesindeki RTX 5070'i ortak
bir kart üzerinden bağlamak, aradaki sürücü kazancını kartın gücü sanmak
demektir. Oyun paketi de aynı dönemde değişiyor ve aynı sorunu ikinci kez
üretiyor.

Bu, K76'nın kapsam kararını teknik olarak zorunlu kılan sebep: eski nesiller
"istenmediği için" değil, **ölçeğe dürüstçe bağlanamadıkları için** dışarıda.

### K78 — Yöntem kuralları Faz 0 ölçümünden çıktı

Faz 0'da yöntem 16 gerçek satırla sınandı ve bağımsız bir kaynakla
karşılaştırıldı. Üç kural o sınamanın sonucudur:

1. **Köprü en az 6 kart.** Faz 0'da 3 kartlık köprü kullanıldı ve köprünün
   arkasındaki grubun **tamamı** referansa göre aşağı kaydı (RX 7600 −%20.3,
   RTX 5060 Ti 16GB −%13.1). Üç kartın ortak hatası bütün gruba taşınıyor.
2. **Farklı upscaling rejimleri köprülenmez.** Faz 0'da A grubu Native, B grubu
   DLSS/FSR Quality idi. DLSS ile FSR aynı ayarda aynı işi yapmıyor; köprü
   kartları iki rejim arasında geçtiği için marka yönlü sapma girdi (NVIDIA
   üstte yüksek, AMD altta düşük). Köprü grupları aynı rejimde olmalı, tercihen
   Native.
3. **Parça başına en az 3 oyun.** İki oyunda tek bir oyunun kendine has
   davranışı doğrudan indekse yansıyor. Karşılaştırılan bağımsız kaynak 11 oyun
   kullanıyor; 3 alt sınır, 5 daha güvenli.

### K79 — Hata payı ölçülür, tahmin edilmez

Motorun ürettiği indeksin hata payı hakkında yazılan her ifade **ölçüme**
dayanır. Bugünkü ölçüm:

| | |
|---|---|
| **Ortalama mutlak sapma** | **%7.8** |
| **En büyük sapma** | **%20.3** (Radeon RX 7600) |
| Ölçüm tarihi | 2026-08-19 |
| Yöntem | ComputerBase'ten 16 satır (2 oyun, 1440p, 3 kartlık köprü) ile hesaplanan indeks, Tom's Hardware'in 11 oyunluk 1440p paketiyle karşılaştırıldı. İkisi de RTX 4070 = 100'e normalize edildi. 14 kart. |
| Kayıt | `docs/log/2026-08-19-faz0-fizibilite.md` bölüm 3 |

**Gerekçe:** "Yaklaşık", "tahmini", "±%10 civarı" gibi ifadeler ölçülmeden
yazıldığında uydurmadır — projenin K52'den K74'e kadar reddettiği şeyin aynısı.
Sayının yanında yöntemi ve tarihi durmalı ki sonradan doğrulanabilsin.

**Bu sayı geçicidir ve yeniden ölçülmelidir.** Ölçüldüğü koşullar, K78'in artık
**yasakladığı** koşullar: 2 oyun (asgari 3 olmalı), 3 kartlık köprü (asgari 6
olmalı), karışık upscaling rejimi (yasak). Yani %7.8/%20.3 **kötü senaryonun**
sayısıdır; gerçek toplama K78'e uyduğunda daha iyi çıkması beklenir.

Arayüzde bugün bu sayı gösterilirken hangi ölçüme dayandığı da yazılır. Gerçek
toplama bittikten sonra ölçüm tekrarlanır ve metin güncellenir.

### K80 — Ölçüt iki kaynak değil, sapmanın görülebilir olması

K75'in 4. maddesi ("her parçanın en az iki farklı alan adından ölçümü olur")
kaldırıldı. Yerine:

> **Her yayında sistematik sapma ölçülür ve kaydedilir.** Ölçüm, bağımsız bir
> kaynakla — mutlak FPS veren, kendisi kaynak olmayan — karşılaştırılır.
> **Sapma kaydedilmeden indeks yayınlanmaz.**

Bugünkü bağımsız kaynak: Tom's Hardware GPU Benchmarks Hierarchy. Veri kaynağı
olarak kullanılamıyor (11 oyunun geometrik ortalaması, `game_id` karşılığı yok)
ama tam da bu yüzden **kaynağımızdan bağımsız** ve 48 kartı mutlak FPS ile
kapsıyor.

**Gerekçe:** Maddenin amacı iki kaynak toplamak değildi, sistematik sapmanın
**görülebilir** olmasıydı. Ölçülüp kaydedilen çapraz kontrol bunu sağlıyor.
İki zayıf kaynağı ortalamak, bir iyi kaynağı ölçülü kullanmaktan iyi değil —
ortalama sapmayı yok etmiyor, yalnızca gizliyor.

**Bu bir gerileme değil, ölçütün doğru tanımlanmasıdır.** Eski madde bir
*araç*ı (iki alan adı) *amaç* sanıyordu. Yeni madde amacı doğrudan şart
koşuyor ve daha sıkı: eski hâlinde iki kaynak toplanır ama sapma hiç
ölçülmeyebilirdi.

**Neden şimdi:** Faz 1'de yedi alan adı sınandı, per-oyun FPS'i makine
tarafından okunabilir biçimde yayınlayan koşulsuz kaynak sayısı 1 çıktı.
Faz 1-A'da TechSpot ve PCGamesHardware tarayıcı paneliyle yeniden incelendi:

- **TechSpot** — grafikler raster resim. DOM'da `data-chart`/`data-series`
  yok, script'lerde `series`/`datasets`/`labels:[` deseni yok, metinde FPS
  yok. Gömülü veri yükü **yok**.
- **PCGamesHardware** — sayfa yalnızca kart seçim listesini metin olarak
  veriyor (ad + saat + bellek), FPS vermiyor. Ayrıca onay duvarı (consent)
  ve "Plus" ödeme duvarı var.

İkinci kaynak arayışı tükendi; ölçüt yeniden tanımlandı.

**Uygulama:** `lib/perf-margin.ts` her yayında güncellenir. Sapma ölçümü
yapılmadan `perf_index` satırları yayına alınmaz.

### K81 — `games` satırları elle girilir, `confidence = low`

`games` tablosundaki `name`, `release_year`, `gpu_weight`, `cpu_weight`
alanları elle girildi. Satırlar `source = manual`, `confidence = low` taşıyor;
`source_url` ölçümün alındığı inceleme sayfasını gösteriyor.

`gpu_weight` ve `cpu_weight` **hepsi 0.5** — yer tutucu.

**Gerekçe:** Oyun başına ağırlık hiçbir yerde yayınlanmıyor; uydurulacak bir
sayı olurdu. 0.5/0.5 görünür bir yer tutucu: oyunları birbirinden ayırdığını
iddia etmiyor. Hiçbir uyumluluk kuralı, arayüz ya da v0.2 indeks hesabı bu
alanları kullanmıyor — kullanılacakları gün ölçülmeleri gerekecek.

Alan zorunlu olduğu için boş bırakılamıyordu; `SCHEMA.md`'yi bunun için
değiştirmek yerine yer tutucu tercih edildi ve işaretlendi.

### K82 — Ölçek değişince motorun üç yeri düzeltildi

K73 ölçeği sabit referansa bağlayınca `/engine/performance.ts`'in üç yeri
yanlış hale geldi ve düzeltildi:

| Ne | Önce | Sonra |
|---|---|---|
| `MODEL_VERSION` | `v0.1` | `v0.2` |
| `clampIndex` | 100'de kırpıyordu | tavan yok, taban 0 |
| `BANDS` | 0–25 … 80–100 | 0–40 … 130+ |

**`clampIndex` en tehlikelisiydi:** 100'de kırpmak RTX 5090'ın 216'lık
indeksini RTX 4070 seviyesine indiriyordu. Sessizce yanlış sonuç veren tam da
bu tür bir hata — test yazılmasının sebebi bu.

**`MODEL_VERSION` ayrışması sayfayı boşaltıyordu:** arayüz indeksleri motorun
sürümüyle okuyor; `perf_index` v0.2 yazılıp motor v0.1 kalınca sayfa hiç indeks
bulamadı. Tarayıcıda görüldü, düzeltildi.

Arayüzdeki sabit "/ 100" metni de kaldırıldı: 100 artık tavan değil, referans
sistemin değeri.

### K83 — Darboğaz göstergesi marjinal kazanca çevrildi

Eski yöntem iki indeksin farkına bakıyordu (`|gpu_idx - cpu_idx| < 15` →
dengeli). Kaldırıldı. Yenisi:

```
kazanç_gpu = max(0, en_iyi_gpu_idx - gpu_idx) * w_gpu
kazanç_cpu = max(0, en_iyi_cpu_idx - cpu_idx) * w_cpu

en_büyük == 0                              → dengeli
|kazanç_gpu - kazanç_cpu| / en_büyük < 0.20 → dengeli
aksi halde kazancı büyük olan taraf sınırlıyor
```

**Gerekçe (proje sahibi):** GPU ve CPU indeksleri **farklı referanslara**
normalize (K73: GPU'da RTX 4070 = 100, CPU'da Ryzen 5 9600X = 100) ve dinamik
aralıkları farklı — GPU tarafında 61–216, CPU tarafında 100–144. Farklarını
almak iki ayrı cetvelin sayılarını çıkarmaktı. Marjinal kazanç ölçekten
bağımsızdır.

**Hatayı gösteren örnek:** RTX 5090 + Ryzen 7 9800X3D — piyasanın en hızlı oyun
işlemcisi — eski yöntemde "İşlemci sınırlıyor" diyordu (216 − 144.4 = 71.6 >
15). Yeni yöntemde her iki kazanç da 0, sonuç "Dengeli". Test bunu doğrudan
şart koşuyor.

**İki yan sonuç, ikisi de bilinçli:**

1. **Darboğaz artık çözünürlüğe göre değişebilir.** Kazançlar ağırlıklarla
   çarpılıyor; 4K'da işlemciyi yükseltmenin sistem indeksine katkısı zaten
   küçük. v0.1'de gösterge çözünürlükten etkilenmiyordu ve bu yanlıştı.
2. **Motor kataloğun en iyilerini girdi olarak alıyor** (`best_gpu_index`,
   `best_cpu_index`). Motor katalogu tanımaz — `/engine` kuralı. Verilmezlerse
   `bottleneck` **null** döner ve arayüz satırı hiç göstermez; "dengeli"
   demek, bilinmeyeni uydurmak olurdu.

Arayüz kararın gerekçesini de gösteriyor: "Kataloğun en iyisine geçseniz:
ekran kartı +116.3, işlemci +0 indeks."

### K84 — K75'in %10 oranında payda tanımlandı

Payda: **sayfanın makine tarafından okunabilir biçimde yayınladığı toplam FPS
değeri sayısı** — kart/işlemci × oyun × çözünürlük × ayar hücrelerinin tamamı.
Bizim kataloğumuzda karşılığı olup olmaması, persentil mi ortalama mı olması
fark etmez.

**Gerekçe:** Tanım yazılmadan aynı toplama %17 ile %100 arasında görünüyordu:

| Payda ne sayılırsa | CPU sayfasında alınan 42 satır |
|---|---|
| HTML satırı (187) | %22 |
| Ortalama bloğu (~90) | %47 |
| Kataloğumuzla eşleşen (~40) | ~%100 |
| **Bütün FPS değerleri (~240)** | **%17** |

Seçilen tanım kaynağın emeğinin bütününü ölçüyor ve dışarıdan doğrulanabilir —
sayfayı açan herkes aynı sayıya varır. Diğerleri bizim kataloğumuza bağlı,
yani kaynak açısından anlamsız.

### K85 — Turlar veride kalır, hesap tek tur seçer

`benchmark_points` append-only (K1): eski test turlarının satırları silinmez,
tabloda tarih olarak durur. Ama **`perf_index` yalnızca tek bir turdan
hesaplanır** (K77).

`scripts/compute-perf-index.mts` içinde `GUNCEL_TUR` listesi bunu tanımlar;
hesap yalnızca o `source_url` desenlerinden gelen satırları kullanır. Yeni bir
tura geçilirken eskisi listeden çıkarılır, satırları silinmez.

**Gerekçe:** K77 "farklı sürücü dönemi köprülenmez" diyor ama veriyi silmeyi
gerektirmiyor — append-only kuralıyla da çelişirdi. Ayrım veri katmanında değil
hesap katmanında yapılır: veri ne ölçüldüyse odur, hesap hangisini kullandığını
söyler.

**Uygulamada ortaya çıkan incelik:** ComputerBase'in işlemci ranglistesi
sayfasında **iki tur aynı adreste** duruyor (bellek-kanalı karşılaştırması ve
büyük sıralama). `source_url` tek başına turları ayırmıyordu; CPU satırlarına
çapa eklendi (`#rangliste-22`). Grup anahtarı `source_url` içerdiği için bu,
iki turu ayrı grup yapıyor ve karışmalarını engelliyor.

### K86 — Ekran kartı varyantı (AIB kartı) bir `parts` satırıdır

`gpu_specs` çip seviyesinde kalır (`nvidia-rtx-5080` = referans tasarım).
Piyasada satılan kart, `category = 'gpu'` olan **normal bir `parts` satırıdır**
ve yeni `gpu_variant_specs` tablosuyla çipine bağlanır (`chip_part_id`).

**Gerekçe:** `price_snapshots`, `build_items`, `click_events`, `perf_index` ve
`/parca/<slug>` adresi — beşi de `parts.id`'ye bağlı. Kart bir `parts` satırı
olduğunda beşi de **değişmeden** çalışır: fiyat karta yazılır, sistem kartı
kaydeder, ileride kartın kendi indeksi olabilir. Migration tek bir
`CREATE TABLE` oldu; mevcut hiçbir tabloya dokunulmadı.

**Reddedilen alternatifler:**

1. **Bağımsız `gpu_variants` tablosu** (kendi `id`'si, `parts` dışında):
   `price_snapshots`, `build_items` ve `perf_index`'in her birine ikinci bir
   nullable FK gerekirdi. "Fiyat ya parçaya ya varyanta bağlı" olan bir tablo
   her okuma yolunu ikiye çatallar; her yeni sorguda birinin unutulması mümkün.
2. **`gpu_specs`'e varyant sütunları:** aynı çipin beş kartı = `chipset`,
   `vram_gb`, `shader_units` değerlerinin beş kopyası. Kopyalanan gerçek ayrışır.
3. **`parts.parent_part_id` self-FK:** yalnızca ekran kartında anlamı olan bir
   sütun yedi kategoriye birden eklenirdi.

**Zorunlu tek alan `chip_part_id`.** K56'nın sorusuna ("hangi kural bunu
kullanıyor?") yalnızca o alan için cevap var: C4/C5 geri düşüşü, `perf_index`
çözümlemesi ve değişmeyen speclerin okunması. `length_mm` ve `tbp_watt` bir
kural tarafından kullanılıyor ama yine de opsiyonel — fiziksel ölçü zorunlu
olmaz (K62) ve TBP'yi zorunlu yapmak yayınlamayan üreticinin kartını dışarıda
bırakırdı (`pcie_version` dersi).

**`perf_index` iki seviyeli okunur:** `perf_index[kart] ?? perf_index[çip]`.
Tabloda değişiklik yok. Hangi seviyeden geldiği okuma anında türetilir ve
arayüz söyler; `source` sütunu açılmadı (K32 hâlâ geçerli). **Bugün kart
satırına indeks yazılmaz** — yazılabilmesinin tek yolu `benchmark_points`'ta
kart bazlı ölçüm bulunmasıdır (K71). Fabrika boost farkından indeks üretmek
K74'ün reddettiği interpolasyondur.

**Mevcut 60 çip satırına dokunulmadı.** Ölçüldü: `gpu_specs` imzası (60 satırın
metin hâlinin md5'i) migration ve seed sonrasında birebir aynı —
`9730f18749f0effdc171610b7b63613d`.

### K87 — Eksik veride kural davranışı: yaklaşık geri düşer, kesin atlanır

**Kural:** Yaklaşık ve pay içeren bir kural, eksik veride referans değere geri
düşer. Kesin ve paysız bir kural atlanır. Her iki durumda da arayüz kullanıcıya
durumu söyler; sessizce ne varsayılır ne atlanır.

Ekran kartındaki karşılığı:

| Durum | C4 (güç) | C5 (uzunluk) |
|---|---|---|
| Kart seçili, değeri var | kartın `tbp_watt`'ı | kartın `length_mm`'i |
| Kart seçili, değeri boş | **çipin `tdp_watt`'ı** | **kural atlanır** |
| Kart seçili değil | çipin `tdp_watt`'ı | çipin referans `length_mm`'i |

**Gerekçe:** C4'ün formülünde ×1.3 payı var; referans değerle çalışması,
kartın kendi değeriyle çalışmasından biraz daha kaba bir tahmindir ama yine
tahmindir. Onu atlamak, en yüksek sonuçlu kontrolü — güç kaynağı yetiyor mu —
en sık durumda sessiz bırakırdı.

C5'te pay yoktur ve AIB kartları referanstan **uzun** olur: ROG Strix ~358 mm,
referans ~304 mm. Kart seçiliyken referans ölçüye geri düşmek, 358 mm'lik karta
"sığar" demek olurdu; sonucu satın alınıp takılamayan bir karttır. K52'nin
kurduğu davranışın aynısı: bilinmeyen ölçüde kural kendini atlar, arayüz söyler.

**Ölçüldü** (`npm run varyant:kontrol`):

```
secim                             tdp   kaynak           uzunluk  kaynak           gerekli W  bulgular
CIP  nvidia-rtx-5090              575   chip_reference   304      chip_reference   1034       W5
KART asus-rog-strix-rtx-5090-oc   600   variant          358      variant          1066       C5,W3,W5
KART nvidia-rtx-5090-founders     575   chip_reference   304      variant          1034       W5
KART zotac-rtx-5090-solid         575   variant          -        unknown          1034       W5
```

Founders'ın TBP'si yok → güç çipten okundu. Zotac'ın uzunluğu yok → C5 atlandı,
çipin 304 mm'sine düşülmedi. Strix hem uzunluk hem TBP verdi → ikisi de kartın.

### K88 — Güç konnektörü şimdilik serbest metin

`gpu_variant_specs.power_connectors` tek bir `text?` alanıdır: `2x 8-pin + 1x 6-pin`.
Yapılandırılmış hâli (tip enum'u + adet, ya da alt tablo) **ertelendi**.

**Gerekçe (proje sahibi):** Hiçbir kural bu alanı okumuyor (K56). Kullanılmayan
bir yapıya migration harcanmaz. Kural gerektiğinde — "PSU'nun kartın istediği
konnektörü var mı" — yapılandırılır; o kural `psu_specs`'te de karşılık
gerektirir ve beta kapsamı dışındadır.

Serbest metnin bilinen bedeli: alan sorgulanamaz ve yazım birliği kod
tarafından zorlanamaz. Kabul edildi. → `SORULAR.md` S38.

### K89 — Kategori listesi çipleri gösterir, kartlar çipin altında

`/parca/kategori/gpu` ve sistem oluşturucudaki ekran kartı listesi **yalnızca
çipleri** listeler (sorgu `gpu_specs` ile join'li). Kart seçimi, çip seçildikten
sonra açılan opsiyonel ikinci bir kutudur ve yalnızca o çipin kartlarını gösterir.

**Gerekçe:** 60 çip yerine yüzlerce kart listelemek seçimi kolaylaştırmaz,
zorlaştırır. Kullanıcı önce "hangi güç sınıfı" sorusunu cevaplar, sonra isterse
"hangi kart" sorusunu. İkinci kutu, o çipin kartı yoksa **hiç görünmez**:
doldurulacak boş bir alan göstermek, seçim yapılması gerektiği izlenimi verir.

Yan sonuç: `build_items`'a kart seçiliyse **kartın** `part_id`'si yazılır, çipin
değil. Satın alınan, fiyatı toplanan ve kaydedilen satır odur; çip zaten
`chip_part_id` üzerinden bulunur.

### K90 — Çip/kart çözümlemesi `/engine` içinde, `/data`'da değil

`resolveGpuSelection` ve `resolvePerfIndex` fonksiyonları
`engine/gpu-selection.ts` dosyasındadır. Taslakta bu çözümlemenin
`/data/to-engine.ts` içinde olacağı yazıyordu; yer değişti.

**Gerekçe:** Bu iki fonksiyon **sessizce yanlış sonuç verebilen** yerlerdir —
yanlış sayıyı seçerlerse kural "sığar" der ve kart sığmaz. CLAUDE.md testi tam
olarak bu tür yerler için istiyor ve test yalnızca `/engine` için yazılıyor.
`/data` içinde kalsalardı ya test edilemezlerdi ya da "sadece /engine test
edilir" kuralı esnetilirdi. Ayrıca aynı çözümleme iki yerden çağrılıyor
(arayüz ve `saveBuild`); tek tanım olmasaydı ikisi zamanla ayrışırdı.

**`/engine` kuralı korunuyor:** dosya hiçbir şey içe aktarmıyor (yalnızca kendi
tiplerini), veritabanı/ağ/React yok. `npm run sema:kontrol` saflık kontrolü
`engine/gpu-selection.ts saf` diyor. `EngineGpu` tipi **değişmedi**; motorun
geri kalanı çip/kart ayrımını görmüyor, `checkCompatibility` yine tek bir
`EngineGpu` alıyor.

### K91 — Etiketsiz ölçü üçlüsünde en büyük değer uzunluktur

**Proje sahibinin kararı (2026-08-20).** Üreticinin kendi spec tablosunda ekran
kartı ölçüsü `348 x 146 x 72 mm` gibi **eksen etiketi olmadan** verilmişse, en
büyük değer `length_mm`'e yazılır. Ondalık **yukarı** yuvarlanır: 357.6 → 358.
Kalan iki eksen boş bırakılır — hangisinin yükseklik olduğu belirsizdir.

**Neden K60'ın istisnası değil:** K60 "etiketsiz bir sayıdan hangi eksenin
uzunluk olduğu çıkarılabilse bile yazılmaz" diyor. Buradaki dayanak çıkarım
değil **fiziksel sınır**: ekran kartının en uzun ekseni PCIe yuvasına paralel
olmak zorundadır; diğer iki eksen braket yüksekliği (~160 mm) ve kart kalınlığı
(~90 mm) ile sınırlıdır. 358 mm'lik bir kartın "yüksekliği" olamaz.

**Yuvarlama neden yukarı:** K59'un üçüncü maddesi kasa **açıklığını** aşağı
yuvarlıyor. İkisinin ortak mantığı aynı: **belirsizlikte kuralı yanıltmayan yön
seçilir.** Açıklıkta güvenli yön aşağı, kart uzunluğunda yukarıdır. Kartı kısa
göstermek, C5'in "sığar" demesine ve satın alınan kartın takılamamasına yol açar.

**Aynı ilke başka alanlarda:** MSI bazı kartlarda güç tüketimini `115 W or 120 W`
biçiminde iki değerle veriyor. C4'ü yanıltmayan yön büyük olandır; `tbp_watt`'a
120 yazılır. (K59'un "en küçüğü yaz" maddesi kasa açıklığı içindir ve buraya
uygulanmaz — orada küçük olan güvenli yöndü.)

**Ölçülen bedel:** Strict K60 ile ilk parti 58 kartın yalnızca 24'ünde uzunluk
olurdu (GIGABYTE ve SAPPHIRE eksenleri etiketliyor, ASUS ve MSI etiketlemiyor).
K91 ile **58/58 kartta uzunluk var**. Varyant katmanının gerekçesi buydu:
`gpu_specs.length_mm` 60 çipin 18'inde doluydu ve dolu olanlar referans kart
ölçüsüydü.

**Sınır:** Bu kural yalnızca **ekran kartı** ölçüsü içindir ve yalnızca
üreticinin kendi spec tablosundaki üçlü için geçerlidir. Kasa, güç kaynağı ve
soğutucu ölçülerinde K59/K60 aynen yürürlükte.

## 2026-08-20 — Elle fiyat girişi (Faz 1.1)

### K115 — Seed fiyat yazmaz

> **Numaralandırma düzeltmesi (2026-08-20).** Bu karar 2026-08-20'de yanlışlıkla
> K89 numarasıyla yazıldı; K89 zaten "kategori listesi çipleri gösterir" kararına aitti.
> İçerik değişmedi, yalnızca numara düzeltildi. Eski raporlarda K89 diye geçebilir.

`scripts/seed.mts` artık `price_snapshots`'a yazmıyor. `PRICES_MINOR` ve
`PRICE_DATES` kaldırıldı; script başta ve sonda satır sayısını karşılaştırıyor
ve değiştiyse hata verip çıkıyor — K71'deki `perf_index` bekçisinin aynısı.

Geliştirme veritabanındaki 87 dev-seed TRY satırı (29 parça) silindi.

**Gerekçe:** Sahte fiyatın tek işi akışı denemekti; o iş artık gerçek
fiyatlarla yapılıyor. Gerçek fiyatlar USD gelince TRY satırları zarar vermeye
başladı: aynı sistemde iki para birimi bir araya gelince toplam anlamsız
oluyor ve arayüz toplamı hiç gösteremiyor.

### K116 — Çip satırının fiyatı, kaydı sıkı bir kartından okunur

> **Numaralandırma düzeltmesi (2026-08-20).** Bu karar 2026-08-20'de yanlışlıkla
> K90 numarasıyla yazıldı; K90 zaten "çip/kart çözümlemesi /engine içinde" kararına aitti.
> İçerik değişmedi, yalnızca numara düzeltildi. Eski raporlarda K90 diye geçebilir.

`gpu_specs` satırı üreticinin referans tasarımıdır; mağazada öyle bir ürün
yoktur (K86). Çipin fiyatı şöyle belirlenir:

> O çipin, **mağazanın kendi sattığı**, **stokta** olan **en ucuz** kartından
> okunur.

Kayıt şartları:

- `source_url` = fiyatın okunduğu **kart sayfası**
- Referans alınan kart CSV satırında `reference_part_id` sütununda yazılı
- `confidence = medium`

İçe aktarıcı `reference_part_id`'yi **doğruluyor**: kart katalogda yoksa ya da
o çipin kartı değilse satır reddediliyor ve sebebi `raw_imports.error`'a
yazılıyor.

**Gerekçe:** Çipin fiyatı bir yaklaşıklıktır — aynı çipin premium kartı
belirgin şekilde pahalıdır. Yaklaşıklığın hangi karta dayandığı yazılmazsa
sayı sonradan doğrulanamaz. `medium` bu yaklaşıklığın damgası.

**Bilinen sınır:** `price_snapshots`'ta ayrı bir sütun yok; referans kartın
slug'ı CSV'de ve `raw_imports.payload`'da duruyor, veritabanı satırında
`product_url` kartın sayfasını gösteriyor. Sütun eklemek şema değişikliğidir
ve sorulmadan yapılmadı.

### K96 — Pazaryeri fiyatına iki kat tavanı

> **Numaralandırma düzeltmesi (2026-08-20).** Bu karar 2026-08-20'de yanlışlıkla
> K91 numarasıyla yazıldı; K91 zaten "etiketsiz ölçü üçlüsünde en büyük değer
> uzunluktur" kararına aitti. İçerik değişmedi, yalnızca numara düzeltildi.
> Eski raporlarda ve komut çıktılarında bu karar K91 diye geçebilir.

Perakendecinin kendi sattığı ürün ile pazaryeri satıcısının sattığı ürün aynı
sayfada görünür ama aynı şey değildir.

- Mağazanın kendi sattığı satır → `confidence = high`
- Pazaryeri satıcısı → satıcı adı `seller` sütununa yazılır,
  `confidence = medium`
- **Pazaryeri fiyatı, aynı çipin en ucuz mağaza fiyatının 2 katını geçerse
  ALINMAZ.** O sayı fiyat değil spekülasyondur.

O çipin mağaza satışlı hiçbir kartı yoksa **tavan hesaplanamaz ve satır
elenir** — sınırsız kabul etmektense atlamak doğru.

Kural içe aktarıcıda uygulanıyor, belgede kalmıyor: tavan CSV'nin kendisinden
hesaplanıyor ve elenen satırın sebebi `raw_imports.error`'a yazılıyor.

**Bu turda uygulanması:** iki pazaryeri satırı tavanın altında kaldı ve alındı
(MSI RTX 5080 VENTUS $1829.90 < $3399.98; ASUS TUF RX 9070 XT $1218.90 <
$1579.98). Mağaza referansı bulunamayan pazaryeri satırları (Seasonic
FOCUS GX-750, Samsung 990 PRO, WD SN850X, MSI B650 TOMAHAWK, SAPPHIRE PULSE
RX 9070) hiç yazılmadı.

### K92 — Farklı para birimleri toplanmaz

Arayüz, seçilen parçaların fiyatları farklı para birimlerindeyse **toplam
üretmez**; hangi birimlerin karıştığını söyler.

**Gerekçe:** `summarizePrice` kuruşları para biriminden bağımsız topluyor ve
son gördüğü birimin sembolünü basıyordu. 47900 (USD sent) + 389900 (TRY kuruş)
tek sembolle gösterilirdi. Kur bilgisi yok; olsa bile hangi tarihin kuru
olduğu ayrı bir soru. Sessizce yanlış bir sayı vermektense toplamı hiç
vermemek doğru.

### K93 — K77 ölçülerek doğrulandı, köprü kurulmadı

S37 sorusu kapandı: ComputerBase'in 2025 ve 2026 test turları arasında köprü
**kurulmaz**. K77 değişmedi, ölçümle desteklendi.

**Ölçüm.** Altı ortak kart (RTX 4090, 4070, 4060, RX 7800 XT, 7600, Arc B580),
her tur kendi içinde iki çarpanlı logaritmik uyumla çözüldü, altı kartın
performans vektörü kendi geometrik ortalamasına normalize edildi, kart başına
`A/B` oranı alındı. Sürücü ve oyun paketi değişimi düzgün olsaydı altı oran eşit
çıkardı.

| Ölçüt | Eşik | Ölçülen | Sonuç |
|---|---|---|---|
| Oranların dağılımı | < %5 | **%12.4** | kaldı |
| NVIDIA / AMD farkı | sistematik olmayacak | **+%14.8** | kaldı |

**Ama sebep marka değil, VRAM.** Kırılım:

| Grup | Oran (geo) | Dağılım |
|---|---|---|
| 8 GB (RTX 4060, RX 7600) | 0.884 | %13.9 |
| ≥12 GB (4090, 4070, 7800 XT, B580) | 1.064 | %7.8 |

8 GB'lık iki kart birlikte düşüyor — biri NVIDIA biri AMD. Sebebi Tur A'nın
paketindeki Dragon Age: The Veilguard: 1440p Quality'de RX 7600 **8.9 FPS**,
RTX 4060 **15.0 FPS**, aynı testte RTX 4070 58.5 FPS. VRAM duvarı, sürücü farkı
değil.

O oyun çıkarılınca ≥12 GB kartlar **%0.9 dağılımla** aynı yerde duruyor ve
marka farkı **+%0.6**'ya iniyor.

**Yine de köprü kurulmadı, üç sebeple:**

1. Ölçüt tam veri üzerinde uygulanır. Sonucu değiştirdiği için bir oyunu
   çıkarmak, sonuca göre veri seçmektir.
2. Sonuç kırılgan: tek oyun dağılımı %3.8'den %12.4'e taşıyor. Tur başına 4-5
   oyunla bu ölçüm bir köprüye izin verecek kadar kararlı değil.
3. Dragon Age dahilken ≥12 GB grubu da %7.8 veriyor (Arc B580 ayrışıyor) —
   "≥12 GB kartlarla köprü kurulur" demek için de erken.

**Gerekçe:** K77 bir varsayımdı, artık ölçülmüş bir bulgu. Ölçüm ayrıca
K77'nin *sebebini* düzeltti: tehlike "markaya göre farklı sürücü kazancı"
değil, **oyun paketinin VRAM talebi değiştiğinde bellek sınırındaki kartların
yer değiştirmesi**. Köprü kartı seçilirken bakılacak şey marka değil, o
kartların bellek sınırına takılıp takılmadığı.

Bu bulgu bir köprü kuralı değil; kural yazmak için tur başına 8+ oyun ve 8+
ortak kart gerekir. Bugünkü veriyle yalnızca "kurulmaz" denebilir.

Ölçüm kaydı: `docs/log/2026-08-20-s37-kopru-olcumu.md`.
Tur A'dan okunan 30 değer veritabanına **yazılmadı**.

### K94 — Sahte veri yazan script'ler hedefi doğrular, makineyi değil

`db:seed` ve `seed:temizle` yalnızca `.env.local`'in gösterdiği veritabanında
çalışır. Hedef adres `.env.local`'dekiyle birebir aynı değilse script durur.

Koruma `scripts/guard-dev-db.mjs` içinde, iki script için ortak.

**Kapatılan açık.** Eski koruma `DEV_SEED_ALLOWED` bayrağına bakıyordu ve o
bayrak `.env.local`'den geliyor. Node'un `loadEnvFile`'i **ortamdan gelen
değeri ezmez**, dosyadan geleni ezer. Yani:

```
DATABASE_URL='<canlı>' npm run db:seed
```

komutunda `DATABASE_URL` kabuktan (canlı), `DEV_SEED_ALLOWED` dosyadan
(`true`) geliyordu. Eski koruma "burası bir geliştirme makinesi" diye geçirir
ve **canlı veritabanına dev-seed yazardı.**

Hata bayrağın kendisinde değil, neyi tarif ettiğindeydi: bayrak **makineyi**
tarif ediyordu, **hedefi** değil. Yeni kontrol hedefe bakıyor.

**Ölçüldü — altı durum:**

| Durum | `db:seed` | `seed:temizle` |
|---|---|---|
| `.env.local` adresi | çalıştı | çalıştı (17 parça silindi) |
| Kabuktan farklı adres | **reddetti**, çıkış 1 | **reddetti**, çıkış 1 |
| `DATABASE_URL` yok | **reddetti**, çıkış 1 | **reddetti**, çıkış 1 |

Reddetme mesajı iki adresi de özetliyor (parola sızdırmadan):

```
Seed calistirilmadi. Sebep:
  - hedef .env.local'deki veritabani DEGIL
    (hedef: canli-ornek.supabase.com/postgres,
     .env.local: aws-0-eu-central-1.pooler.supabase.com/postgres)
```

`.env.local` yoksa ya da içinde `DATABASE_URL` yoksa da reddediyor:
karşılaştırılacak bir şey olmadan "burası geliştirme" denemez.

**Gerekçe:** dev-seed korumasının 1. ve 4. katmanları (damga + canlıda
çalışmama) bu açıkla birlikte kâğıt üzerinde kalıyordu. Koruma, hatırlamaya
değil erişimin doğrulanmasına dayanmalı — K29'un kurduğu mantığın aynısı.

Açık, canlıya aktarım planı yazılırken fark edildi
(`docs/canliya-aktarim-plani.md`); plan uygulanmadan önce kapatıldı.

## 2026-08-20 — PSU uzunluğu: standardın sabit ölçüsü (Faz 1.2 devamı)

Karar veren: proje sahibi.

### K95 — Etiketsiz PSU üçlüsünde standardın iki sabiti tanınıyorsa kalan uzunluktur

Üreticinin **kendi spec tablosunda** güç kaynağı ölçüsü eksen etiketi olmadan
üçlü halinde verilmişse ve üçlüde **hem 150 hem 86** varsa, kalan üçüncü değer
`psu_specs.length_mm`'e yazılır. ATX12V standardı güç kaynağının genişliğini
150 mm, yüksekliğini 86 mm olarak sabitler; değişebilen tek eksen derinliktir.

**Dört koşul, hepsi zorunlu:**

1. Değer üreticinin kendi spec tablosundan okunmuş olmalı — pazarlama
   metnindeki sayı değil.
2. Üçlüde **hem 150 hem 86 birlikte** bulunmalı.
3. Ürünün form faktörü **ATX** olmalı.
4. Ondalık varsa **yukarı** yuvarlanır.

**Kural kendini kapatır.** 150 veya 86 bulunamıyorsa değer yazılmaz, alan boş
kalır ve K60 aynen yürürlüktedir. Bu, kuralın en önemli güvenlik özelliğidir:
bu bir **tanıma** kuralıdır, çıkarım kuralı değil. Tanıyamazsa çalışmaz.
Standart dışı bir ünitede sessizce yanlış yazmaktansa hiç yazmaz.

**SFX ve SFX-L kapsam dışı.** Sabitleri farklı (125 × 63.5) ve ölçülmedi.
Kataloğun tek SFX'i olan Corsair SF750'nin sayfasında zaten ölçü yok — yani
SFX dalı bugün **sıfır satır doldururdu**. Ölçülmemiş bir standardın
sabitlerini kurala yazmak, ölçüm olmadan kural yazmak olur.

**Ölçüm (2026-08-20).** Karar veriden sonra verildi, önce değil:

- Katalogdaki 11 Corsair PSU sayfası çekildi. Yedisinde üçlü var, dördünde
  sayfada Dimensions satırı hiç yok (CX550, CX650, HX1200i, SF750).
- Üçlü veren **7/7 satırda 150 ve 86 istisnasız var**: `140x150x86` (dört
  satır) ve `160x150x86` (üç satır). Corsair'in gömülü JSON'undan çıkan
  dördüncü desen de aynı: `180mm x 150mm x 86mm`.
- **Bağımsız doğrulama, ekseni etiketleyen üreticiden.** Seasonic beş seri
  sayfasında üçlüyü etiketliyor. Toplanan her üçlü:
  `140 mm (L) x 150 mm (W) x 86 mm (H)`, `170 mm (L) x 150 (W) x 86 (H)`,
  `210 mm (L) x 150 (W) x 86 (H)`. Uzunluk 140→170→210 değişiyor, **W=150 ve
  H=86 hiç değişmiyor** ve etiket hangi eksen olduğunu açıkça söylüyor.
- İki marka, beş farklı uzunluk (140/160/170/180/210), **karşı örnek sıfır**.

**Ölçülen bedel:** `length_mm` dolu PSU **1 → 8** (12'de). W5 kombinasyonu
**1 → 14**; tetiklenen kasa 1'den 3'e çıktı (Terra 130, Pop Mini Air 150,
North 155). Kuralın iki ucu da tek satır olmaktan çıktı — asıl kırılganlık
buydu.

### Karşılaştırma — K95 ile K91: aynı mantık, aynı işlem değil

K91 "etiketsiz ölçü üçlüsünde **en büyük değer** uzunluktur" diyor ve bu
ekran kartı için doğru. **K91'in harfi PSU'da yanlış sonuç verir:**
`140x150x86` üçlüsünün en büyüğü 150'dir ve o **genişliktir**. K91'i olduğu
gibi taşımak dört Corsair'e yanlış uzunluk yazardı.

İki kararın dayanağı farklı:

| | Dayanak |
|---|---|
| **K91** (ekran kartı) | **Fiziksel sınır** — kartın en uzun ekseni PCIe yuvasına paralel olmak zorundadır; diğer ikisi braket yüksekliği ve kart kalınlığıyla sınırlıdır. |
| **K95** (güç kaynağı) | **Standardın sabit ölçüsü** — ATX12V genişliği ve yüksekliği sabitler; değişebilen tek eksen derinliktir. |

Ortak olan yalnızca şu: ikisi de çıkarım değil, bilinen bir zorunluluğun
okunmasıdır.

### K95b — GENEL KURAL: bir kural yeni alana taşınırken harfi değil gerekçesi taşınır

Bir kuralı yeni bir alana uygularken taşınan şey kuralın **işlemi** değil
**gerekçesidir**. Gerekçe o alanda geçerli değilse kural taşınmaz — işlem
tesadüfen doğru sonuç veriyor olsa bile.

**Gerekçe:** K91'in işlemi ("en büyüğünü al") PSU'ya taşınsaydı sessizce
yanlış veri üretirdi ve yanlışlık kural biçiminde göründüğü için
sorgulanmazdı. Kuralın kendisi doğru; taşındığı yerde dayanağı yoktu. Bir
kuralın nereye kadar geçerli olduğunu, kuralın metni değil gerekçesi belirler.

Bu yüzden her kural kaydında **neden** öyle olduğu yazılıdır; taşıma
tartışması gerekçe üzerinden yürütülür.

## 2026-08-20 — Faz A.1: oyun bazlı FPS

Karar veren: proje sahibi (S39, S40, S41).

### K97 — Ölçülmüş ve türetilmiş sayı arayüzde ayrılır

Oyun listesinde ölçülmüş FPS'e küçük bir işaret (`● ölçüldü`), türetilmişe
`○ tahmin ±%12.8` konur. İkisi aynı listede durur ama ayırt edilir.

**Gerekçe (proje sahibinin ifadesi):** *"Bu sitenin tüm duruşu — kullanıcı
sayının nereden geldiğini görmeli."* K116'nın çip fiyatında ve K74'ün kart
indeksinde kurduğu desenin aynısı: yaklaşıklığın damgası sayının yanında
durur, dipnotta değil.

İkinci ve sessiz bir işaret daha var: **türetilen sayı tam sayıya yuvarlanır,
ölçüm ondalığını korur.** Hata payı ±%10 iken ondalık basamak yanlış bir
kesinlik vaadidir; 87 dürüst, 87,4 değil.

### K98 — Oyun listesi FPS'e göre sıralanmaz

Sıra alfabetiktir (Türkçe).

**Gerekçe:** FPS'e göre sıralamak kullanıcıyı "en yüksek sayıyı gör" yönünde
koşullandırır. Oysa kullanıcı belirli bir oyunu arıyor; listeyi tarayıp kendi
oyununu bulması gerekiyor. Sıralama, hangi sayının önemli olduğuna dair sessiz
bir mesaj verir ve o mesaj burada yanlış olurdu.

Sıralama motorda değil arayüzde yapılır: bir sunum kararıdır, `/engine`'in işi
değil. `estimateGameFps` girdi sırasını korur ve testi bunu sabitler.

### K99 — Tek skor ile oyun listesinin çeliştiği gizlenmez

Listenin başında kalıcı bir not durur:

> Bu değerler, işlemcinin sınırlamadığı bir test sisteminde ölçülmüştür. Sizin
> işlemciniz bazı oyunlarda bu sayının altında kalmasına yol açabilir.
> Yukarıdaki sistem indeksi işlemciyi hesaba katar, bu liste katmaz — ikisi
> farklı şeyler ölçüyor.

**Gerekçe:** Çelişki gerçek ve kaçınılmaz. Ölçüldü: CPU ölçümlerinin oyunları
ile GPU ölçümlerinin oyunları **sıfır kesişiyor** (`cyberpunk-2077` ≠
`cyberpunk-2077-phantom-liberty`, `f1-24` ≠ `f1-25`), üstelik iki küme farklı
çözünürlük, preset ve upscaling ayarında. Yani A.1'in verdiği sayı GPU-sınırlı
FPS'tir ve işlemciyi hesaba katamaz. Zayıf CPU + güçlü GPU sisteminde tek skor
"işlemci sınırlıyor" derken liste yüksek FPS gösterir. Bu tarayıcıda görüldü:
RTX 5090 + Ryzen 5 9600X sisteminde tam olarak böyle oldu.

**Test sisteminin işlemcisi yazılmaz.** Proje sahibinin önerdiği metinde
"(RTX 5090 test sistemi)" ifadesi vardı; yazılmadı. İki sebep: RTX 5090 bir
ekran kartıdır (CPU ölçümlerinin sabitlenmiş GPU'su), ve GPU ölçümlerinin 64
satırında `cpu_part_id` **boştur** — hangi işlemcide ölçüldüğü verimizde
kayıtlı değil. Kaynağı olmayan bir iddia arayüze yazılmaz (K4, kaynak defteri).
Notun niyeti korundu, kaynaksız kısmı çıkarıldı.

### K100 — Türetilen FPS hiçbir tabloya yazılmaz

Okuma anında hesaplanır. Şema değişikliği yapılmadı, yeni tablo açılmadı.

**Gerekçe K71'in aynısı:** hesaplanmış bir sayı ölçüm tablosuna yazılırsa
ölçümden ayırt edilemez hale gelir ve "bu sayı nereden geldi" sorusu cevapsız
kalır. `benchmark_points` append-only ve gerçek ölçüm tablosudur.

### K101 — Ölçüm grubu: oyun + ayar, ve aynı parça grupta bir kez

`data/benchmarks.ts` ölçümleri (oyun, çözünürlük, preset, upscaling)
dörtlüsüne göre gruplar. Bir grup kullanılabilir sayılır ancak:

1. Aynı GPU grupta **birden fazla kez geçmiyorsa**, ve
2. Grupta **en az 3 farklı GPU** varsa.

**Gerekçe:** 1080p medium ölçümüyle 1440p ultra ölçümü aynı orana giremez.
Aynı GPU grupta iki kez geçiyorsa "bu kartın bu oyundaki FPS'i" sorusunun iki
cevabı olur; ortalamasını almak bir modelleme kararıdır ve verilmedi —
belirsizliği sessizce çözmektense grubu atlamak doğru.

**Bu kural bugün somut bir iş yapıyor:** 178 ölçümün 114'ü tek bir GPU'ya
(RTX 5090) sabitlenmiş CPU ölçümleridir ve o gruplarda aynı GPU 12-15 kez
geçer, dolayısıyla düşerler. Geriye tam olarak 8 GPU ölçüm grubu kalır.

Kural **veri şekline** bakıyor, `cpu_part_id`'ye sabitlenmiş bir filtreye
değil. Sebebi K95b: filtre yazılsaydı bugünkü veri şekline özel olurdu ve
ikinci bir ölçüm yöntemi geldiğinde sessizce yanlış davranırdı.

### K102 — Kaydedilmiş sistemde oyun bazlı FPS dondurulmaz, bugünkü hesap gösterilir

`/sistem/<id>` sayfasında oyun listesi **ayrı, kesikli çerçeveli bir kutuda**
durur ve dondurulmuş değerlerin üzerine yazmaz. Kutunun başında "bu liste
dondurulmamıştır" yazar.

**Üç gerekçe:**

1. **Dondurulmuş bir FPS yok ve olamaz.** `builds` tablosunda FPS alanı
   bulunmuyor; eklemek şema değişikliği olurdu ve K100'ü doğrudan ihlal ederdi
   (türetilen FPS hiçbir tabloya yazılmaz).
2. **Sayfada aynı sorunun kurulmuş cevabı zaten var: fiyat.** Dondurulmuş
   toplam "Kayıt anındaki değerler"de, güncel fiyat ayrı kesikli kutuda; biri
   diğerinin üstüne yazmıyor (SCHEMA.md bölüm 5). FPS o desene giriyor.
3. **Donmanın sebebi FPS'te yok.** `perf_index_snapshot` donuyor çünkü
   `model_version` değişebilir ve eski kaydın sayısını yeni motorunkiyle
   karşılaştırmak iki ayrı cetveli karıştırmak olur. FPS'in altındaki
   `benchmark_points` ise **append-only ölçüm**: geçmişe dönük değişmiyor,
   yalnızca üstüne ekleniyor. Bugünkü sayı kayıt anındakinden ancak *daha çok
   ölçüm olduğu için* farklı çıkar — bu bozulma değil iyileşme.

Ayrıca: bu özellikten önce kaydedilmiş sistemlerde liste hiç yoktu, yani onlar
için "kayıt anındaki FPS" diye bir şey zaten mevcut değil.

**Çözünürlük uyuşmazlığı söylenir.** Sistem 4K'da kaydedilmiş olabilir ama
elimizdeki ölçümler 1440p ultra. Bu durumda liste "seçili çözünürlük 4K, ama
ölçümler şu ayarda" der. 4K seçmiş birine 1440p sayısı gösterip susmak yanlış
olurdu.

### K103 — Arayüz metni durum başına ayrılır, tek cümleye sıkıştırılmaz

Ana sayfadaki tek cümle şunu diyordu: *"Fiyatlar örnek veridir; performans
tahmini için ölçüm verisi henüz toplanmadı."* İkinci yarısı **artık yanlıştı**
— 8 oyunda ve 60 ekran kartında FPS gösteriliyor.

Metin üç maddeye ayrıldı: oyun bazlı FPS, sistem indeksi, fiyat. Üçünün
olgunluğu farklı ve tek cümlede birleştirildiklerinde en kötümser olanı
hepsini temsil ediyordu.

**Kapsam sayıları metne gömülmez, veriden okunur.** `fpsGames` ve
`fpsCoveredGpus` sayfada hesaplanıyor; ölçüm eklendikçe metin kendiliğinden
güncelleniyor. Bu metnin eskimesinin sebebi tam olarak elle yazılmış olmasıydı.

Sayılan küme "ölçümü olan çip" değil **FPS gösterilebilen seçenek**: türetme
indeks gerektiriyor ve kartlar indeksi çiplerinden miras alıyor (K86). Yalnızca
ölçülmüş çipler sayılsaydı 14 çıkardı ve 46 kart görünmezdi.

### K104 — Oyun listesi tek bileşen, iki sayfa

`app/game-fps.tsx`. K97/K98/K99'un metinleri ve kuralları burada tek kopya
duruyor; oluşturucu ve kaydedilmiş sistem sayfası ikisi de bunu çağırıyor.

**Gerekçe:** iki kopya olsaydı biri güncellenip diğeri unutulurdu ve iki sayfa
aynı veri hakkında farklı şey söylerdi. Sıralama (K98) da bileşenin içinde,
yani çağıran taraf yanlışlıkla FPS'e göre sıralayamaz.

Aynı turda `RESOLUTION_LABEL` de `lib/format.ts`'e taşındı: aynı sayfada bir
kutu "4K", başka bir kutu "2160p" diyordu ve ikisi aynı şeydi.

## 2026-08-20 — Faz A.2: oyun kapsamı

### K105 — Tom's Hardware kaynak yapılmaz, ayna olarak kalır

**Proje sahibinin kararı.** Tom's Hardware `benchmark_points`'a veri kaynağı
olamaz. K80'in bağımsız aynası olarak kalır.

**Sonucu kabul edilmiştir:** Grup 2 — CS2, Valorant, Fortnite, Apex, LoL,
Dota 2 — bugün kataloğa **eklenemiyor**. Ölçüldü: doğrulanmış kaynağımızda
(ComputerBase) bu altı oyunun kapsamı **0/6** ve bu yapısal; hem Rangliste'de
hem 16 Temmuz 2026 tarihli yeni CPU testinde geçiş sayısı sıfır. Metin olarak
FPS yayınlayan başka ölçüm kaynağı bulunamadı (bkz. `docs/faz-a2-oyun-hedefi.md`
bölüm 4). Tom's Hardware bu oyunları ölçen tek itibarlı kaynaktı.

**Gerekçe (proje sahibinin ifadesi):** Tek bağımsız aynayı kaynağa çevirmek,
sapma ölçümünü **kendi kendini ölçmeye** dönüştürür. K80'in tek koşulu
sapmanın *görülebilir* olmasıdır; ayna kaynak olursa o koşul çöker ve geriye
ölçülemeyen bir hata payı kalır.

> **"Her sayının hata payı ölçülmüştür" iddiası, birkaç popüler oyundan
> değerlidir.**

Bu, K80'in "iki zayıf kaynağı ortalamak, bir iyi kaynağı ölçülü kullanmaktan
iyi değil" mantığının aynısı, bir adım ötesi: ölçüm aracını veri kaynağına
karıştırmamak.

**Yeniden açılma koşulu:** rekabetçi oyun FPS'ini **metin olarak** yayınlayan,
aynamız olmayan bir ölçüm kaynağı bulunursa Grup 2 yeniden değerlendirilir.
Tahmin hesaplayıcıları (howmanyfps, pc-builds, bottleneckcheck) bu koşulu
karşılamaz: ölçmüyorlar, donanımdan türetiyorlar.

### K106 — "Oyun sayısı" ile "tanıdık oyun" ayrı hedeflerdir

Ölçüldü: kaynağın 23 oyunluk paketinden Steam'in en çok oynanan ilk 100'ünde
olan **yalnızca 4** oyun var (CPU paketinin 9 oyunundan 1). Kapsam 8'den 23'e
çıktığında bile kullanıcının tanıdığı oyun sayısı 1'den 4'e çıkıyor.

**Sebep kaynak seçiminden geliyor, emek eksikliğinden değil.** Donanım
incelemeleri paketlerini *grafik olarak zorlayan yeni çıkışlara* göre seçer;
Steam'in en çok oynananları ise eski, rekabetçi ve düşük sistem gereksinimli
başlıklarla doludur. İki liste yapısal olarak farklı şeyleri optimize ediyor.

**Bunun tek çözümü kullanıcı katkısıdır.** İnceleme sitelerinden ne kadar veri
alınırsa alınsın bu fark kapanmaz. `ROADMAP.md` Faz F'deki "Kullanıcı FPS
gönderimi" maddesi bu yüzden yalnızca bir büyüme özelliği değil, **kapsamın
yapısal sınırının tek çıkışı** — öne çekilmesi ayrıca değerlendirilecek.

### K107 — Kart seçimi dengelenir, her grupta indeks aralığı çapalanır

Bir oyun grubundan 8 kart alınırken (K75 madde 3 tavanı) seçim şöyle yapılır:

1. O oyunda ölçülmüş **en düşük ve en yüksek indeksli** kart her zaman alınır.
2. Kalan 6 yer, **o ana kadar en az ölçülmüş** kartlara verilir.

**Gerekçe (1):** Her grubun oranı yalnızca o gruptaki noktalardan hesaplanıyor
(`ratioFor`). Aralık dar olursa oran gürültülü çıkar ve o oyunun bütün
türetilmiş FPS'leri kayar. Uçlar çapa görevi görüyor.

**Gerekçe (2):** Ölçümler 14 karta dengeli dağılırsa arayüzde **türetme değil
ölçüm** artar. Rastgele ya da sabit bir sekizli seçilseydi bazı kartlar 23
oyunun hepsinde ölçülü, bazıları hiçbirinde olmazdı.

Sonuç ölçüldü: 184 ölçüm 14 karta 12–19 aralığında dağıldı.

### K108 — Yalnızca raytracing grafiği olan oyunda render modu `upscaling` alanına yazılır

ComputerBase bazı oyunlarda yalnızca raytracing grafiği yayınlıyor (Crimson
Desert, Doom: The Dark Ages, Indiana Jones, Star Wars Outlaws). Bu satırlarda
`upscaling` alanına `DLSS/FSR Quality + Raytracing` biçiminde yazılır.

**Gerekçe:** Şemada render modu için alan yok. Yazılmasaydı arayüz "1440p
ultra, DLSS/FSR Native" derdi ve raytracing'in açık olduğunu **gizlemiş**
olurdu — FPS'i %30-50 değiştiren bir ayarı. Alanı boş bırakmak burada K60'ın
koruduğu şeyi korumuyor; tersine, var olan bir bilgiyi siliyor.

**Bilinen bedel:** `upscaling` alanı artık iki ayrı ayarı taşıyor ve
sorgulanamaz hale geldi ("hangi satırlar DLSS Quality kullandı" sorusu metin
eşleştirmesi gerektirir). Bugün hiçbir kural bu alanı okumuyor, yalnızca
arayüz gösteriyor; bedel bu yüzden kabul edildi. Doğrusu ayrı bir
`render_mode` alanıdır — `SORULAR.md` S42.

**Karşılaştırmayı bozmuyor:** her oyun kendi grubu olduğu için (K101), bir
oyunun RT'li ölçümleri yalnızca kendi aralarında oranlanıyor.

### K109 — `games.source_url` oyunun kendi olgularının kaynağıdır

Yeni 15 oyun satırında `source_url` **Steam mağaza sayfasıdır**, benchmark
incelemesi değil. `games` tablosu oyunun adını ve çıkış yılını taşıyor; o iki
olgunun kaynağı Steam. Benchmark'ın kaynağı zaten `benchmark_points.source_url`
içinde ayrıca duruyor.

**Bilinen tutarsızlık:** mevcut 17 oyun satırı ComputerBase incelemesini
gösteriyor, oysa çıkış yılları oradan gelmiyor. Sormadan geriye dönük
düzeltilmedi. → `SORULAR.md` S43

**Not:** `release_year` hiçbir kural ve arayüz tarafından kullanılmıyor, yani
K56 ölçütüne göre zorunlu olmamalı; şemada zorunlu. S22'nin kapsamındaki
alanlardan biri.

## 2026-08-20 — Hata payı otomatikleşti, render modu kendi alanına çıktı

### K110 — Yayınlanan hata payını script yazar, eskimesini kontrol yakalar

Arayüzdeki iki hata payı da (`lib/perf-margin.ts`, `lib/fps-margin.ts`) artık
**script tarafından yazılıyor**:

| Komut | Yazdığı dosya | Yöntem |
|---|---|---|
| `npm run indeks:sapma` | `lib/perf-margin.ts` | bağımsız aynayla karşılaştırma (K80) |
| `npm run fps:sapma` | `lib/fps-margin.ts` | birini-dışarıda-bırak |

**Üç parça var, üçü de gerekli:**

1. **İşaretli blok.** Script yalnızca `// === ÖLÇÜM BAŞLANGIÇ` ile
   `// === ÖLÇÜM BİTİŞ ===` arasını yazar. Blok dışındaki gerekçe, yöntem ve
   tarihî notlar elle yazılıyor ve script onlara dokunmuyor. Bütün dosyayı
   yazsaydı o yazılar her ölçümde silinirdi; hiç yazmasaydı sayı eskirdi.
   İşaretçi bulunamazsa script **hata verir** — "yazdım" deyip hiçbir şey
   yazmaması, tam olarak kaçınılan sessiz başarısızlık olurdu.
2. **Eşik aşılırsa dosya yazılmaz.** %25 eşiği aşan bir ölçüm yayına
   girmiyorsa, arayüzün okuduğu yere de işlenmez — durdurulmuş bir yayını
   yayınlanmış gibi göstermek olurdu.
**`npm run sapma:tumu` ikisini birden çalıştırır.** İki ayrı komut olması,
birinin çalıştırılıp diğerinin unutulmasına açıktı; eskime kontrolü bunu
yakalıyordu ama sonradan. Kısayol, hatayı hiç yapmamayı ucuzlaştırıyor.

3. **Eskime kontrolü.** İki dosya da ölçüm anındaki `benchmark_points` satır
   sayısını (`measuredAtPoints`) taşıyor. `npm run kural:kontrol` bunu güncel
   sayıyla karşılaştırıyor ve farklıysa **hata verip duruyor**, düzeltecek
   komutu da yazarak.

**Gerekçe:** Bu sayılar tek bir iş biriminde **iki kez** elle güncellendi
(oyun paketi 8→23 olunca ikisi de eskidi) ve üçüncüde unutulacaktı. Unutulsa
arayüz "±%12.8" demeye devam ederdi; gerçek değer %13.7 olduğu halde. Sessizce
yanlış bir kesinlik vaadi — projenin K52'den K74'e kadar reddettiği şeyin
aynısı, üstelik hata payının kendisinde.

**Otomasyonun kendisi de bir hatayı yakaladı:** `comparedParts` elle "20"
yazılmıştı, script "25" ölçtü.

### K111 — `render_mode` kendi alanı oldu, `upscaling` temizlendi

`benchmark_points.render_mode` enum: `raster`, `raytracing`, `pathtracing`.
Varsayılan `raster`.

Migration: `20260820142440_render_mode_alani` (alan) +
`20260820142632_render_mode_veri_tasima` (mevcut 32 satır).

**K108 geri alındı.** Raytracing bir süre `upscaling` alanına
`DLSS/FSR Native + Raytracing` biçiminde yazılıyordu. O karar kendi bedelini
yazmıştı: alan iki ayrı ayarı taşıyor ve sorgulanamaz hale geliyordu.

**Neden şimdi:** dört oyunken düzeltmek ucuz, kırk oyunken pahalı. Alan bir
kez kirlendikten sonra her yeni satır borcu büyütür.

**Neden `pathtracing` de tanımlandı:** bugün hiçbir satır kullanmıyor. Ama
sonradan eklenseydi, bugün girilmiş satırların hangi modda olduğu geriye dönük
tahmin edilmek zorunda kalırdı — `workload`'ın şemaya erken girmesinin
gerekçesiyle aynı.

**Veri taşıma neden migration içinde:** `benchmark_points` append-only ve
uygulama kodundan UPDATE yazılmaz. Append-only'nin amacı bir **ölçümün**
sessizce revize edilmemesi; burada FPS değeri değişmiyor, ayarın kaydedilme
biçimi düzeliyor. Migration'da yapılması değişikliği kayıt altına alıyor ve
tekrarlanabilir kılıyor.

**Grup anahtarı genişledi:** `(game_id, resolution, preset, upscaling,
render_mode)`. Aynı oyunun raster ve raytracing ölçümleri aynı orana giremez —
aralarındaki fark kartın gücü değil ayarın maliyetidir.

### K112 — `games.release_year` opsiyonel, değeri PC çıkışıdır

Migration: `20260820142939_games_release_year_opsiyonel`.

**Neden opsiyonel:** K56 ölçütü — hiçbir kural ve arayüz bu alanı kullanmıyor.
Ve her oyun Steam'de bulunmuyor: **Alan Wake 2 Epic'e özel çıktı**, Steam'de
satırı yok, yılı doğrulanamadı. Zorunluluk, doğrulanamayan bir yılı uydurmaya
zorlardı. Alan boş bırakıldı.

**Tanım: PC (Steam) çıkış yılı.** Konsolda daha önce çıkan oyunlarda PC
sürümünün yılı yazılır. Burası PC toplama sitesi ve ölçümler PC sürümünde
yapılıyor.

Doğrulama iki satırı düzeltti — ikisi de konsol/PC farkıydı:

| Oyun | Önce | Sonra | Sebep |
|---|---|---|---|
| Death Stranding 2 | 2025 | **2026** | PS5 2025, PC 2026 |
| Marvel's Spider-Man 2 | 2023 | **2025** | PS5 2023, PC 2025 |
| Alan Wake 2 | 2023 | **(boş)** | Steam'de yok (Epic'e özel) |

32 oyunun 31'i artık Steam'i kaynak gösteriyor (K109 tutarsızlığı kapandı);
Alan Wake 2 doğrulanamadığı için kaynağı ComputerBase kaldı.

### K113 — Donanım basını FPS'i görsel yayınlıyor; ComputerBase istisna

**İkinci tur kaynak araması da olumsuz** (2026-08-20). Ölçüt tekti ve önce
sorulan buydu: oyun başına FPS **makine tarafından okunabilir metin** olarak
mı yayınlanıyor?

| Kaynak | Metinde FPS | Görsel grafik | Sonuç |
|---|---|---|---|
| **ComputerBase** | ✅ 2.448 değer | — | kullanılıyor |
| GamersNexus (Mega Charts) | ❌ **0** | 32 | elendi |
| Notebookcheck | ❌ **0** (`fps` kelimesi bile 0 kez) | 39 | elendi |
| TechPowerUp | ❌ 0 | var | elendi (1. tur) |
| PCGamesHardware | ❌ 0 | var | elendi (1. tur) |
| Igor's Lab | ❌ 0 | 32 | elendi (1. tur) |
| TechSpot / HUB | ❌ 0 | 123 | elendi (1. tur) |
| Guru3D | görsel | var | elendi (1. tur) |
| OpenBenchmarking | **doğrulanamadı** — `robots.txt` izin veriyor ama sayfa **403** döndü | | denenemedi |
| Tom's Hardware | — | — | K105 gereği kaynak olamaz |
| howmanyfps, pc-builds, DropReference, PCGameBenchmark, TechBenchPro | metin ✅ ama **ölçüm değil türetme** | | reddedildi |

**Yazılan sonuç:** bu bir arama eksikliği değil, **sektörün yayın biçimi**.
Donanım basını benchmark sonucunu neredeyse istisnasız **grafik görseli**
olarak yayınlıyor. ComputerBase bu kuralın istisnası ve bugün tek kaynağımız
olmasının sebebi bu — tercih değil, zorunluluk.

**Sonuçları:**

1. **CPU kapsamı 12'de kalıyor.** Oyun bazlı FPS CPU'yu hesaba katamamaya
   devam ediyor (kesişim hâlâ sıfır).
2. **Tek kaynak riski yapısal.** İkinci bir metin kaynağı bulunana kadar
   çeşitlendirme mümkün değil; K80'in aynası bu riski görünür tutan tek şey.
3. **Bir sonraki arama turunda önce biçim sorulacak** (Igor's Lab dersi):
   izin en net olan kaynak bile sayıları görselde yayınlıyorsa kullanılamaz.
4. **Görselden sayı okumak seçenek değil.** OCR ya da grafik piksel ölçümü,
   kaynağı doğrulanamayan bir sayı üretir — K71'in reddettiği şeyin aynısı,
   bir katman daha gizlenmiş hali.

**Yeniden denenecek tek aday:** OpenBenchmarking, yapılandırılmış veri
yayınlayan tek aday ve `robots.txt` izin veriyor; 403 aşılabilirse oyun
kapsamı ölçülmeli. Ama Linux/sentetik ağırlıklı olması bekleniyor.

### K114 — İkinci çözünürlük ekseni açıldı, K75 tavanına pay bırakıldı

**Ölçüm:** kullandığımız inceleme her oyunu **üç çözünürlükte** yayınlıyor
(2560×1440, 3440×1440, 3840×2160) — sayfa başına 36 grafik, çözünürlük başına
36. Biz yalnızca 1440p'yi almıştık; **4K ve UWQHD tamamen alınmamıştı.**

**K75 hesabı yeniden yapıldı:**

| | Satır | Oran |
|---|---|---|
| Payda (yeniden sayıldı) | 2.448 | — |
| Tavan (%10) | 244 | — |
| Alınmış (1440p) | 184 | %7,5 |
| **Kalan yer** | **60** | — |
| Eklenen (4K) | 48 | — |
| **Yeni toplam** | **232** | **%9,48** |

**Neden 8 oyun × 6 kart, 6 oyun × 8 kart değil:** 4K grafiklerinde 14 değil
**9 kart** var (ComputerBase zayıf kartları 4K'da düşürüyor). 9'un 8'ini almak
grubun %89'u demekti — K75'in 2. maddesi "grubun tamamı asla alınmaz" diyor ve
%89 o maddenin ruhunu zorlar. 6/9 = **%67** hem daha az pay, hem daha çok oyun
kapsıyor.

**Tavan doldurulmadı.** %9,48'de durulup 12 satırlık pay bırakıldı: kaynak
sayfası değişirse (oyun eklenirse payda değişir) geriye dönük tavanı aşmamak
için.

**Arayüz sonucu:** oyun listesi artık kullanıcının seçtiği çözünürlüğü
**izliyor**. Mevcut 1080p/1440p/4K düğmeleri bu liste için de anlam kazandı.
Süzme, grubun kendi `resolution` alanıyla yapılıyor — metin eşleştirmesiyle
değil. Veri olmayan çözünürlükte liste dürüst boşluk veriyor: *"Bu çözünürlükte
(1080p) henüz ölçüm yok."*

Bu, "kart kapsam dışı" durumundan **ayrı** bir mesaj: birincisinde başka kart
seçmek işe yarar, ikincisinde yaramaz.

**Hata payı yine kötüleşti ve yine dürüst:** ortalama %6,6 → **%6,8**, %90
dilim %13,7 → **%15,0**. 4K'da kartlar arası sıralama indeks sırasından daha
çok ayrılıyor (VRAM sınırı devreye giriyor). Otomasyon (K110) sayıyı kendisi
güncelledi.

**Kart tarafında alınacak kalmadı:** 1440p'de her oyunda 14 karttan 8'i
alınmış ve K75'in 3. maddesi kombinasyon başına 8'i tavan yapıyor. Mevcut
gruplara kart eklenemez.

## 2026-08-20 — Kendi kendini denetleme turu

### K117 — Karar numaralarının tekilliği kontrole bağlandı

`npm run sema:kontrol` artık `docs/KARARLAR.md`'deki karar numaralarının
tekil olduğunu doğruluyor.

**Neden gerekliydi — üç kez yaşandı.** Karar numarası koda ve yorumlara atıf
olarak giriyor (`// K90: cip satirinin fiyati bir kartindan okunur`). Aynı
numara iki karara verilirse atıf hangisini gösterdiğini söyleyemez hale gelir
ve bu **sessiz** olur: kod çalışır, testler geçer, yalnızca okuyan insan yanlış
kararı okur.

Bu turda bulunan çakışmalar (K91 önceki turda düzeltilmişti):

| Numara | Çakışan kararlar | Çözüm |
|---|---|---|
| K89 | "kategori listesi çipleri gösterir" ↔ "seed fiyat yazmaz" | fiyat kararı → **K115** |
| K90 | "çözümleme `/engine` içinde" ↔ "çip fiyatı karttan okunur" | fiyat kararı → **K116** |

Her ikisinin de **canlı kod atfı** vardı: `scripts/seed.mts` (4 yer),
`scripts/seed-prices.ts`, `scripts/import-prices.mts`, `engine/fps-estimate.ts`,
`docs/faz-a1-plani.md`. Hepsi güncellendi.

**Kontrol yalnızca `### K<sayı> —` biçimini karar sayar.** "K95 ile K91:
aynı mantık, aynı işlem değil" gibi karşılaştırma başlıkları numara değildir;
o başlık da `### Karşılaştırma — ...` olarak yeniden yazıldı.

### K118 — K56 kontrolünün kapsamı `games`'i içerir

Kullanılmayan-zorunlu-alan kontrolü yalnızca yedi spec tablosuna bakıyordu.
`games` eklendi ve iki alan ortaya çıktı: **`gpu_weight`, `cpu_weight`** —
32 oyunun hepsinde `0.5` yer tutucu, ölçülmemiş, hiçbir yerde okunmuyor.

`games.name` **kimlik alanı** sayılıp kapsam dışına alındı: arayüzde görünüyor
ama alan adıyla değil (`games.name` → `game_name`), yani ad araması yanlış
pozitif üretiyordu. `parts.brand`/`model` de aynı rolde ve zaten kapsam dışı.

`benchmark_points` ve `perf_index` **bilinçli olarak kapsam dışı** — gerekçesi
ve doğru çözümü `SORULAR.md` S44'te.

### K119 — Envanterde bulunan üç arayüz hatası düzeltildi

Beta kapısı envanteri (bölüm 4) üç kod hatası buldu; üçü de burada düzeltildi.

**1. Para birimi yanlış gösteriliyordu.** `formatPriceMinor`'ın varsayılanı
`TRY` ve dört çağrı yerinde para birimi geçilmiyordu: USD fiyatlar açılır
listede `389,00 ₺` diye görünüyordu. Aynı ekranda toplam satırı `USD`
diyordu — **iki farklı para birimi yan yana**.

Bu bir görünüm kusuru değil yanlış bilgiydi. Düzeltildi:
`app/builder.tsx` 266, 295, 326, 547.

**2. Mobilde yatay taşma.** 375 px ekranda sayfa 660 px çiziliyordu. Kök
sebep: uzun bellek adları `<select>`in içsel genişliğini şişiriyor ve
grid/flex çocukları `min-w-0` olmadan içeriklerinden küçülemiyor. `select`lere
`w-full min-w-0`, grid'e `[&>*]:min-w-0` eklendi. Ölçüldü: 375 px ekranda
sayfa artık 375 px.

**3. Ana sayfa "31 oyunda" diyordu, 23 oyun vardı.** `fpsGroups.length`
**grup** sayısını veriyordu; 4K ekseni açılınca (K114) 23 oyun 31 grup oldu.
Ayrı `game_id` sayısına çevrildi.

**Üçünün ortak dersi:** ikisi (para birimi, oyun sayısı) veriden okunan
doğru sayıyı **yanlış biçimde** gösteriyordu. Sayının doğru olması yeterli
değil; nasıl gösterildiği de ölçülmeli. Envanter olmasa üçü de fark
edilmeden yabancıya gösterilirdi.

## 2026-08-20 — Kart varyantı kapsamı 58 → 153

### K120 — ASUS ölçü satırında birim seçilir, ilk üçlü alınmaz

ASUS eski ürün sayfalarında ölçüyü **aynı satırda hem inç hem metrik** veriyor:

```
7.87 " x 4.84 " x 1.496 " Inch20  x 12.3  x 3.8  Centimeter
12 x 5.43 x 2.55 inch305 x 138 x 65 mm
```

İlk üçlüyü almak inç değerini milimetre sanmaktır: RTX 3060 için **200 mm
yerine 8** yazılırdı. Toplama sırasında tam olarak bu oldu ve şüpheli değer
taraması yakaladı (`length_mm < 150`).

**Kural:** birim etiketine göre seçilir — sıra `mm` > `cm` > `inch`, bulunan
birim mm'ye çevrilir, K91 gereği **yukarı** yuvarlanır.

**Bu K60 ihlali değil:** birim sayfada **etiketli**. Doğru birimi seçmek
çıkarım değil okumadır; yanlış olan, etiketi görmezden gelip ilk sayıyı almaktı.

**Ders:** çok birimli yayın, etiketsiz yayından daha tehlikeli. Etiketsizde
K91 devreye girer ve dikkat çeker; çok birimlide sayı **makul görünür**
(8, 11, 12 hepsi geçerli bir "mm" gibi durur) ve sessizce yanlış olur.
Toplama sonrası aralık taraması bu yüzden zorunlu.

### K121 — Intel Arc kapsanamadı, sebebi kaynak erişimi

`intel-arc-b580` **indeksli** bir çip ve hâlâ **sıfır kartı var**.

Sebep: Arc kartlarını dört markadan hiçbiri yapmıyor (SAPPHIRE yalnızca AMD).
Baskın üreticiler ASRock ve Sparkle. `robots.txt` **ikisinde de izin veriyor**
— engel izin değil erişim:

| Yol | Sonuç |
|---|---|
| `curl` (tam başlık seti) | 836 bayt, 82 karakter metin — içerik yok |
| Tarayıcı paneli | `innerText` uzunluğu **0** — sayfa boş |

ASRock ürün sayfası her iki yolla da okunamadı. Sparkle denenmedi.

**Sonuç:** Arc B580 indeksli olmasına rağmen kart gösteremiyor. Bu, K113'ün
(kaynak biçimi) kardeşi bir engel: orada sayı görselde, burada sayfa hiç
gelmiyor. İkisi de emekle çözülmüyor.

### K122 — Kart toplamada slug önbelleği URL'i değil slug'ı anahtarlar

Toplama script'i indirdiği sayfayı **slug adıyla** önbellekliyor. Aynı slug
için ikinci bir URL denendiğinde (GIGABYTE'ın `-rev-10` varyantı, SAPPHIRE'ın
düzeltilmiş adresi) önbellek **eski sayfayı** verdi ve satır, verinin
okunmadığı bir `source_url` ile üretildi.

İki satırda yakalandı ve doğru adresli olan tutuldu. Kaynak defterinin anlamı
budur: satırdaki adres, sayının **gerçekten okunduğu** sayfa olmak zorunda.

**Bir sonraki toplamada:** önbellek anahtarı URL olmalı, slug değil.

## 2026-08-20 — Parkur makalesi, çerçeve düzeltmeleri, fiyatsız kayıt

### K123 — İkinci ComputerBase makalesi aynı turdur, köprü değildir

`nvidia-geforce-amd-radeon-benchmark-test-2026.97097` (parkur makalesi) ile
`amd-radeon-rx-9070-gre-test.97564` (kart incelemesi) **aynı ölçüm kümesini**
yayınlıyor. Kanıt: ortak sekiz kartın değerleri birebir aynı.

```
Cyberpunk 2077, 1440p, DLSS/FSR Quality — iki makalede de:
RTX 5090 202,6 · RTX 4090 149,3 · RTX 5070 Ti 124,6 · RX 9070 XT 120,4
RX 9070 109,4 · RTX 5070 108,5 · RX 7600 55,3 · RTX 4060 47,2
```

**Bu yüzden K77 ihlal edilmiyor.** K77 iki **ayrı ölçüm turunu** ortak kart
üzerinden bağlamayı yasaklıyor; burada ölçüm tek, sayfa iki. `GUNCEL_TUR`
listesine bu gerekçeyle eklendi.

**Kazanç:** parkur makalesi **16 kart** yayınlıyor (kart incelemesi 14).
Fazladan olan RTX 5080 alındı (7 kart × 5 oyun = 35 satır, aynı upscaling
rejimi — K78 uyumlu). Sonuç: indeksli çip **14 → 15**, FPS gösterilebilen
GPU **87 → 94**.

**K75 paydası da değişti:** parkur makalesi 2.808 değer yayınlıyor (2.448
yerine). Bütün satırlarımız **buna karşı** sayıldı — muhafazakâr okuma,
çünkü ölçüm aynı iş: `267/2808 = %9,51` (tavan 280).

### K125 — Aynı değerin iki kez geçmesi çelişki değildir

Ölçüm grubu kuralı (K101) "aynı GPU birden fazla kez geçiyorsa grup düşer"
diyordu. Parkur makalesi eklenince bu kural **beş oyunu listeden düşürdü**
(23 → 18): aynı ölçüm iki sayfadan geldiği için kart iki kez görünüyordu.

Kural keskinleştirildi: **önce aynı `(kart, değer)` ikilileri teke indirilir,
sonra çelişki aranır.** Geriye kalan tekrar gerçek çelişkidir — aynı kart,
**farklı** değer — ve o grup hâlâ düşer.

**Gerekçe:** tek bir ölçümün iki yayını, iki ölçüm değildir. Eski kural bunu
ayırt edemiyordu ve doğru veriyi kaybediyordu.

### K126 — Sistem indeksi ile oyun listesi ayrı ayrı adlandırılır

Arayüz eskiden *"Performans tahmini için henüz yeterli veri yok"* diyordu ve
**hemen altında dolu bir oyun FPS listesi** duruyordu. Kullanıcı için çelişki;
30/42 işlemcide bu hâl normaldi.

Metin artık eksik olanın **adını** koyuyor: *"Sistem indeksi hesaplanamıyor —
bu sayı işlemci ve ekran kartının ikisinin de ölçümünü gerektiriyor"*, ve
liste görünüyorsa *"o liste yalnızca ekran kartına bakıyor"* diye ekliyor.

**İlke:** iki farklı sayı, iki farklı soruya cevap veriyorsa, biri
hesaplanamadığında **hangisi** olduğu söylenir. "Veri yok" genel ifadesi,
elde olan veriyi de yokmuş gibi gösteriyordu.

### K127 — Oyun FPS'i eşiklerle yorumlanır; eşikler karar, ölçüm değil

`lib/fps-bands.ts`: **30 / 60 / 120** sınırlarıyla `zor` · `oynanır` ·
`akıcı` · `yüksek tazeleme`.

**Bunlar ölçüm değil.** "60 FPS akıcı mıdır" sorusunun deneysel cevabı yok;
ekranın tazeleme hızına ve oyunun türüne göre değişir. Bu yüzden sayının
yanında **yorum** olarak duruyorlar ve arayüz eşiklerin karar olduğunu
yazıyor.

**Neden yine de var:** "47 FPS" gören kullanıcı bunu iyi mi kötü mü bilemez.
Site performans **tahmini** yapıyorsa, tahmini yorumlamak da işinin parçası.
Ham sayıyı yorumsuz bırakmak dürüstlük değil, eksiklik.

### K128 — İşlemci sayıya girmiyorsa bu açıkça yazılır

Oyun FPS listesi GPU-sınırlı (K99) ve bunu düzeltecek veri yok (K113).
Sayı değiştirilemiyor; **çerçeve** düzeltildi:

1. Başlık cümlesi: *"Bu sayılar yalnızca ekran kartına göredir… seçtiğiniz
   işlemci bu sayılara girmiyor."*
2. Seçilen işlemcinin indeksi ve referansa göre yeri yazılıyor.
3. Sistem indeksinin darboğaz sonucu (K83) `cpu_limited` ise listenin başında
   *"aşağıdaki sayılar bu yüzden iyimser olabilir"* uyarısı çıkıyor.

**Gerekçe:** en yanıltıcı eksik **sessiz** olandı — kullanıcı hangi işlemciyi
seçerse seçsin aynı listeyi görüyor ve "işlemci fark etmiyormuş" sonucunu
çıkarıyordu. Sayıyı düzeltemiyorsak, sayının ne olmadığını söylemek zorundayız.

### K129 — Kapsanan oyunlar seçimden önce gösterilir

Ekran kartı seçilmeden de "bu çözünürlükte ölçümü olan 23 oyun: …" listesi
görünüyor.

**Gerekçe:** kullanıcı kartını seçtikten sonra tanımadığı bir listeyle
karşılaşıyordu (Steam ilk 100'ünden yalnızca 4 oyun — K106). Beklentiyi
baştan kurmak, sonradan hayal kırıklığı yaşatmaktan iyi.

### K124 — Fiyat kaydı engellemez

`saveBuild` artık `missing_price` ile reddetmiyor. Fiyatı olmayan parça
içeren sistem de kaydedilir ve paylaşılabilir.

Migration: `20260820172348_fiyatsiz_sistem_kaydedilebilir`.
`builds.total_price_minor`, `builds.currency` ve
`build_items.unit_price_minor_at_save` opsiyonel oldu.

**Gerekçe:** fiyat beta ölçütünden çıkarıldı — bu bir **performans tahmin
sitesi**. Fiyatın olmaması paylaşım akışını kilitlememeli; kilitliyordu.

**Ama kısmi toplam yazılmaz.** Bir parçanın fiyatı eksikken üretilen toplam
olduğundan ucuz görünür ve donduğu için sonradan düzeltilemez. Eksik varsa
`total_price_minor = null` ve arayüz *"Toplam fiyat dondurulmadı"* diyip
sebebini yazıyor. K92'nin karışık para birimi için verdiği kararla aynı
mantık: sessizce yanlış bir sayı vermektense hiç vermemek.

## 2026-08-20 — Sunum turu (UI/UX)

### K130 — Renk teması CSS değişkeniyle, sınıf ikiye katlanmadan

`app/globals.css` dört değişken daha tanımlıyor: `--muted`, `--border`,
`--surface`, `--accent`. Dosyada zaten bu desen vardı (`--background`,
`--foreground`) ve Tailwind'in kendi `@theme` mekanizması kullanıldı.

**Bu bir tasarım sistemi değil** (CLAUDE.md kısıtı). Alternatif, koyu tema
için her sınıfı ikiye katlamaktı (`text-neutral-600 dark:text-neutral-400`)
ve o hem daha uzun hem tutarsızlığa açıktı. Token katmanı, yardımcı sınıf
üreteci ya da bileşen kütüphanesi kurulmadı.

**Palet bilinçli olarak sakin:** nötr griler + **tek** vurgu rengi. Semantik
renk yalnızca hata (kırmızı) ve uyarı (kehribar). Neon, gradyan, RGB vurgu
ve gölge yığını yok — bu bir ölçüm aleti ve o görünüm güvenilirlik taşımıyor.

### K131 — `opacity-*` ile soluklaştırma bırakıldı

Gövde metninde `opacity-40/50/60` kullanılıyordu. `opacity-40` siyah metinde
beyaz üzerinde ~2.6:1 veriyor — WCAG AA'nın (4.5:1) belirgin altında.

Yerine `--muted` (#5c626e, **6.4:1**; koyu temada #9aa1ad, **7.1:1**).

**Ölçüldü:** açık temada 347, koyu temada 317 metin öğesi tarandı, **sıfır**
AA ihlali. Kaydedilmiş sistem sayfasında 224 öğe, sıfır ihlal.

### K132 — Ölçüldü/tahmin ayrımı renge bağlı değil

WCAG 1.4.1: renk tek başına bilgi taşımamalı. Eski hâlde ayrım yeşil nokta
(`●`) ile soluk halkaydı (`○`) — daralmış görme ya da tek renkli ekranda
kaybolurdu.

Yeni ayrım **üç ipucu** taşıyor:

| | Ölçüldü | Tahmin |
|---|---|---|
| Simge | `■` dolu | `□` boş |
| Kenarlık | düz | **kesikli** |
| Metin | "ölçüldü" | "tahmin ±%15,6" |

Hata payı artık rozetin içinde okunuyor, dipnotta değil. Renk hiç
kullanılmıyor; ayrım biçimden geliyor.

### K133 — Başlıklar sessiz, sayılar yüksek sesli

Tipografi ölçeği dört kademe: sayfa başlığı (`text-3xl`), bölüm başlığı
(**`text-xs` büyük harf, gri**), gövde (`text-sm`), yardımcı (`text-xs`
muted). Ana sayılar `text-4xl`/`text-2xl`.

Eskiden her bölüm başlığı `text-lg font-semibold` idi ve sayılarla aynı
ağırlıktaydı; göz nereye gideceğini bilmiyordu. Bu bir ölçüm aleti — gözün
gitmesi gereken yer **sayı**, başlık değil.

**Bütün sayılarda tabular figür** (`font-variant-numeric: tabular-nums`).
FPS listesi, fiyat ve indeks alt alta okunuyor; orantılı rakamlarla sütun
kayıyordu.

### K134 — Sonuç bölümleri önceliğe göre sıralandı

Eski sıra: fiyat → performans → FPS → yükseltme → seçilen sistem → kaydet →
**uyumluluk**. Uyumluluk en alttaydı.

Yeni sıra: **uyumluluk** → performans → FPS → fiyat → yükseltme → seçilen
sistem + kaydet.

**Gerekçe:** sistem kurulamıyorsa performans sayısı ikincildir. C1-C6
hataları "bu parçalar bir araya gelmez" diyor; onu en alta koymak, kullanıcıya
önce çalışmayacak bir sistemin FPS'ini göstermek demekti.

Uyumluluk bölümü **yalnızca söyleyecek bir şey varsa** çiziliyor; sorun yoksa
tek satırlık sessiz bir bilgi kalıyor.

### K135 — Boş durum: sonuç bölümleri hiç çizilmiyor

Hiçbir parça seçilmemişken yedi kategori **ve** yedi boş sonuç bölümü aynı
anda geliyordu. Artık sonuç sütununda tek bir panel var: sitenin ne
söyleyeceği, ne söylemeyeceği ve **ölçümü olan oyunların listesi** (K129).

"Ne görmeyeceksiniz" maddesi bilinçli: *"Ölçümü olmayan parçalarda uydurma
sayı. Veri yoksa yerinde neden olmadığı yazar."* Bu sitenin duruşu ilk
ekranda söyleniyor.

### K136 — Eksik veri hata gibi değil bilgi gibi görünür

"Ölçüm yok", "indeks hesaplanamıyor", "kontrol edilemedi" kutuları artık
nötr yüzey (`bg-surface`) ve nötr kenarlık taşıyor. Kırmızı/kehribar yalnızca
gerçek bulgular (C/W kuralları) ve kayıt hatası için.

**Gerekçe:** eksik veri bir hata değil, projenin bilinçli tercihi (K60, K71).
Kullanıcıya hata rengiyle göstermek, dürüstlüğü kusur gibi sunardı.

### K137 — Yükleme durumu denendi, ÇALIŞMADI, kaldırıldı

`app/loading.tsx` eklendi ve sayfa **hiç render olmadı**: iki `<main>` DOM'da
kalıyor, Suspense sınırı çözülmüyor, akan içerik gizli kalıyordu. Sunucu tam
HTML'i gönderiyordu (`curl` doğruladı) ama istemcideki takas tamamlanmıyordu.

Basitleştirilmiş sürüm de aynı davrandı. **Kaldırıldı.**

Doğrulanamayan bir iyileştirme yerine çalışan sayfa: yükleme iskeleti
kozmetik, kırık sayfa değil. Sebep bu kurulumda (Next 16 + `force-dynamic` +
önizleme vekili) tam olarak tespit edilemedi; tekrar denenecekse önce bu
ayrıştırılmalı. → `SORULAR.md` S45


### K138 — Görsel yön: litografi maskesi, ısı yalnızca harekette

**2026-08-20.** İkinci UI turunda üç yön çizildi ve karşılaştırıldı: (A)
tavlama fırını — die ızgarası + akkor turuncu kalıcı vurgu; (B) litografi
maskesi — devre izleri, mavi vurgu korunur; (C) ölçüm masası — ince ızgara,
ısı yalnızca FPS sayısının renginde.

**Seçilen: B'nin zemini + A'nın hareketi.** Arka plan litografi maskesi
(`app/backdrop.tsx`), kalıcı vurgu bugünkü mavi (`--accent`), ısı yalnızca
giriş animasyonunun içinde geçer.

**Gerekçe:** A'nın turuncusu kalıcı vurgu olsaydı, bu sitede kehribarın
taşıdığı **"uyarı"** anlamını (K130, K132) tüketirdi. Kullanıcı turuncu
gördüğünde "bir şey var" diye düşünmeli, "sayfa yüklendi" diye değil. Isı
metaforu 0.9 saniye süren bir hâle olarak kaldı; geride hiçbir renk
bırakmıyor ve hiçbir kalıcı durumda kullanılmıyor.

### K139 — Arka plan motifi çizim, fotoğraf değil; animasyonsuz

Motif tek bir satır içi SVG: dik açılı devre izleri, via kareleri, köşelerde
hizalama artıları. Tek renk (`--motif`) kullanıyor, iki temada kendi tonunu
alıyor.

**Gerekçe (fotoğraf değil):** fotoğraf hem ağır hem de içeriğin önüne geçer.
Bu SVG birkaç yüz bayt ve dosya isteği bile üretmiyor.

**Gerekçe (animasyonsuz):** sürekli çalışan bir arka plan efekti 375px
telefonda pili ve kaydırma akıcılığını yer. Hareket yalnızca giriş anında ve
yalnızca içerikte.

Opaklık ölçüldü, seçilmedi: açık temada `rgba(31,95,168,.07)`, koyu temada
`rgba(127,179,236,.12)`. Bu değerlerde gövde metninin kontrastı en kötü
durumda (çizginin tam üstündeki piksel) açık temada 6.4:1'den 5.9:1'e,
koyu temada 7.1:1'den 5.9:1'e iner — ikisi de AA eşiğinin (4.5:1) üstünde.

### K140 — Hareket öğe ekrana GİRERKEN çalışır, veri değişince değil

Üç hareket var ve üçü de bir kez çalışır: bölüm belirme (`anneal-belir`),
ısı hâlesi (`anneal-isi`), çubuk dolumu (`anneal-dol`). Sayı sayma
(`app/count-up.tsx`) yalnızca ilk girişte.

**Gerekçe:** FPS listesine bakan biri sabit bir tablo görmeli. Kullanıcı
çözünürlüğü ya da parçayı değiştirdiğinde bölümler yerinde durduğu için CSS
animasyonu yeniden tetiklenmiyor; `CountUp` de `sayildi` bayrağıyla ikinci
kez saymıyor, yeni değeri anında yazıyor.

`prefers-reduced-motion: reduce` açıksa: bölümler doğrudan son hâlinde
gelir, çubuk dolmaz, sayı saymaz ve **ısı hâlesi hiç çizilmez**
(`display: none`) — yani turuncu o kullanıcıya hiçbir zaman görünmez.

### K141 — Sayarak gelen sayı, ekrandaki gerçek sayının üstüne biner

`CountUp` React durumu tutmuyor; `value`'yu normal şekilde çiziyor ve sayma
sırasında `textContent`'i doğrudan yazıyor.

**İki gerekçe:**

1. **Dürüstlük.** JavaScript çalışmazsa, animasyon yarıda kalırsa ya da
   hareket azaltma açıksa ekranda gerçek sayı durur. Hiçbir koşulda 0
   görünmez. Animasyon her zaman `value` ile biter.
2. **Maliyet.** Saniyede 60 kez `setState` bütün ağacı yeniden çizerdi;
   değişen tek şey bir metin düğümü.

Ara değerler hedefle aynı basamakta yazılıyor (`toFixed`): 164.4'e sayarken
tam sayı gösterip sonda `.4` eklemek, sayının son anda zıplaması olurdu.

Sunucudan gelen sayılarda sayma **kapalı** (`animate={false}`): kaydedilmiş
sistem sayfasında gerçek sayı zaten boyanmış oluyor, sıfırlayıp saymak
"118 → 0 → 118" titremesi yaratırdı.

### K142 — İndeks çubuğunun ölçeği 0–200, referans 100 çentikli

Çubuk (`app/index-bar.tsx`) keyfi bir tavana göre değil, **sabit referans
sisteme** göre çiziliyor: 100 referansın değeri (K73), ölçeğin ucu onun iki
katı. 200'ü geçen indeks çubuğun sonuna dayanır.

**Gerekçe:** tavanı belirsiz bir çubuk, sayıyı olduğundan büyük ya da küçük
gösterir. Ölçek sabit olduğu için iki sistemin çubuğu karşılaştırılabilir.
Sayı her zaman çubuğun yanında yazılı — çubuk okuma yardımcısı, kaynak değil.
`aria-hidden`: sayıyı `<output>` zaten okutuyor.

**Oyun başına FPS çubuğu YAPILMADI.** K98 listeyi bilerek alfabetik
tutuyor; satır başına çubuk, kullanıcıyı tam da kaçınılan yöne — "en uzun
çubuğa bak" — koşullandırırdı.

### K143 — `-webkit-backdrop-filter` satırı standart özelliği DÜŞÜRÜYOR

`.cam` kuralına önce `backdrop-filter`, sonra `-webkit-backdrop-filter`
yazıldığında Tailwind v4'ün CSS işleyicisi (Lightning CSS) **ikisini de
düşürdü**: tarayıcıya giden kuralda yalnızca `background` kaldı ve
`getComputedStyle(...).backdropFilter` `none` döndü. Ön ekli satır silinince
standart özellik kurala geri geldi.

Ders: bu projede ön ek elle yazılmaz — CSS işleyicisi gerekeni kendisi
üretiyor, elle eklenen ön ek onu bozuyor. Bulunma yolu: kuralın **tarayıcıya
giden** hâlini `document.styleSheets` üzerinden okumak. Yazdığın CSS ile
servis edilen CSS aynı olmayabilir.


### K144 — Sayfa dolu açılır: varsayılan sistem seçili gelir

**2026-08-22.** Katalogda 332 parça var ama `perf_index` yalnızca **15 ekran
kartı ve 12 işlemci** için hesaplanmış. Boş formla karşılaşan kullanıcının
rastgele seçtiği parçanın ölçümlü çıkma ihtimali düşük; sonuç, sitenin ne
yaptığını hiç görmeden üç boş panele bakmaktı.

Sayfa artık ölçümlü bir ekran kartı + işlemci ve bunlarla **uyumluluk hatası
üretmeyen** anakart/bellek/güç kaynağı/kasa seçili açılıyor.

Seçim `engine/default-build.ts` içinde ve **test ediliyor** (9 test):

- **Sabit liste değil.** Parça slug'ı gömülseydi, o parça katalogdan çıktığında
  ya da ölçümü silindiğinde varsayılan sessizce bozulurdu. Seçim her istekte
  eldeki veriden yapılıyor.
- **Orta segment, amiral gemisi değil.** Ölçümlü parçalar indekse göre
  sıralanıp ortadaki alınıyor. İlk görülen sayının "en iyi" sanılması, yanlış
  bir çıpa olurdu.
- **Uyumluluğa motor karar veriyor.** Ön eleme (soket, bellek tipi, watt)
  yalnızca aramayı kısaltıyor; son sözü `checkCompatibility` söylüyor. Kuralların
  ikinci bir kopyası yazılmadı.
- **Hatasız kombinasyon yoksa `null`.** Uydurma bir varsayılan göstermektense
  form boş açılır.

K129/K135 ile ilişkisi: boş durum paneli kaldırılmadı, yalnızca ilk açılışta
görünmüyor. Kullanıcı seçimleri temizlediğinde yine çıkıyor.

### K145 — Parça listeleri ölçüm kapsamına göre gruplanır

Ekran kartı ve işlemci açılır listeleri iki `<optgroup>`a ayrıldı:

```
Ölçümlü — FPS tahmini verilebilir          (ekran kartı 15, işlemci 12)
Ölçüm yok — sadece uyumluluk kontrolü      (ekran kartı 45, işlemci 30)
```

Ölçümlüler önce. Ölçümsüz seçeneklerin metnine ayrıca `· ölçüm yok` ekleniyor:
açılır liste kapandığında `optgroup` başlığı görünmez olur, sonuç görünmez
olmamalı. Seçim yapıldıktan sonra listenin altında ayrıca bir cümle çıkıyor.

**Gruplama `perf_index` tablosundan türetiliyor**, gömülü listeden değil.
Ölçüm eklendiğinde gruplar kendiliğinden değişir.

**Kartlar (AIB) çiplerinin durumunu miras alır.** İndeks zaten iki seviyeli
okunuyor: kartın kendi ölçümü yoksa çipinki kullanılıyor (K86, K87). Kart
seçenekleri tek bir çipe ait olduğu için ayrı grup açılmıyor, işaret satır
içinde veriliyor.

Diğer kategorilerde indeks kavramı yok; onlar düz liste kaldı.

### K146 — Depolama açılır listeye çevrildi, stok kodu etiketten düştü

14 satırlık onay kutusu listesi sol sütunun üçte birini yiyordu ve diğer altı
kategoriyle aynı dilde konuşmuyordu. Artık `<select multiple>`.

Etiketten üretici stok kodu düşürülüyor (`stripSku`):

```
Samsung 990 EVO Plus 1TB (MZ-V9S1T0B/AM)  ->  Samsung 990 EVO Plus 1TB
```

Kural dar: **yalnızca sondaki** parantez ve **yalnızca içi büyük harf/rakam,
boşluksuz** ise. `Corsair VENGEANCE 32GB (2 x 16GB)` gibi anlamı olan parantez
silinmiyor. Veritabanındaki değer değişmiyor; tam hâli `title` ipucunda ve
seçilenler ayrıntı satırında duruyor.

### K147 — "Kontrol edilemeyenler" sonuçların altına indi

Blok sağ sütunun en üstündeydi: kullanıcının okuduğu ilk şey iki gri
"bunu bilmiyoruz" kutusuydu. Artık performans, FPS ve fiyattan **sonra**
geliyor ve `<details>` ile kapalı açılıyor; başlıkta kaç kontrolün
yapılamadığı yazıyor.

**İçerik aynen duruyor** — dürüstlük burada asıl mesele, gizlenen bir şey yok.
Düşen tek şey sıra ve vurgu.

**K134 bozulmadı:** uyumluluk HATALARI hâlâ en üstte. Aşağı inen şey hata
değil, "veri eksik olduğu için bu kural çalışmadı" bilgisi. "Sorun bulunamadı"
cümlesi de artık yalnız kalmıyor: yapılamayan kontrol varsa aşağıyı işaret
ediyor.

### K148 — Fiyatlar ekranda TRY, veritabanında kaynağın para biriminde

Fiyatlar USD olarak duruyor (22 satır, Newegg) ama bütçe kutusu TL soruyordu —
sayfa kendi içinde çelişiyordu.

**Veritabanı değişmedi.** Çevrim yalnızca ekrana basarken, `lib/currency.ts`
içinde. Kur bir bileşene gömülmedi: gömülseydi ikinci bir bileşen eklendiğinde
ikinci bir kur doğar ve ikisi ayrı zamanlarda eskirdi.

**Kur ELLE giriliyor** ve bu gizlenmiyor: arayüz her fiyat kutusunda
*"elle girilen kurla çevrildi: 1 USD = X ₺ (tarih). Canlı kur değildir."*
diyor. Otomatik kur bağlamak yeni bir dış bağımlılık ve beta kapsamı dışı.

Çevrim tam sayıyla: `usdKuruş × (TRY kuruş/USD) ÷ 100`, tek yuvarlama, float
yok (SCHEMA.md bölüm 0 kural 4). Çevrilemeyen para birimi `null` dönüyor ve o
satır hiç gösterilmiyor — 1:1 varsaymak sessizce yanlış sayı olurdu.

**Bu tur bulunan hata:** yükseltme motoruna USD senti gidiyordu, bütçe ise TL
kuruşu olarak. Motor ikisini karşılaştırıyordu, yani "bu bütçeyle şunu
alabilirsin" cevabı ~41 kat yanlıştı. Aday listesi artık çevrilmiş değerle
kuruluyor. Motorun kendisi değişmedi.

Farklı para birimlerinin toplanamaması kısıtı (eski `mixedCurrency` dalı)
kalktı: tek bir kur ve tarihi olduğu için toplam artık üretilebiliyor ve ikisi
de ekranda yazıyor.

Kaydedilmiş sistem sayfasında donan değer **kaynağın para biriminde** donmuş
durumda ve değişmiyor; ekrandaki ₺ karşılığı bugünkü kurla hesaplanıyor. Bu
sayfada ayrıca yazılı.

### K149 — Başlıktaki kapsam sayıları ne saydığını söylüyor

"23 oyun, 94 ekran kartı" iki soruya da cevap vermiyordu.

**23 oyun doğru ama eksik anlatılmış.** `games` tablosunda 32 satır var; 23'ü
KULLANILABİLİR bir ölçüm grubu bırakıyor. Grup en az üç farklı ekran kartı
istiyor ve aynı kartın çelişen değerleri grubu düşürüyor (K125). Aradaki 9
oyun tek bir karta sabitlenmiş CPU ölçümlerinden geliyor. Etiket artık
**"Ölçümü olan oyun"** diyor ve ölçütü bir cümleyle açıklıyor.

**94 uydurma bir sayı değil**, ama adı yanlıştı: 15 ölçümlü çip + o çiplere
bağlı 79 kart. Yani "FPS gösterilebilen SEÇENEK" sayısı, "ekran kartı" değil.
Etiket artık üç sayıyı birden veriyor: **15 çip ölçüldü, 94 seçenekte FPS
görünüyor, katalogda 213 ekran kartı var.** Kapsam açığı böylece başlıkta
görünüyor.

İşlemci için de aynı satır eklendi: **12 / 42**.


### K150 — Arayüz metinleri bileşenden çıktı, kaynak dil İngilizce

**2026-08-22.** Bütün kullanıcıya görünen metinler `messages/<dil>/<ad-alanı>.json`
dosyalarına taşındı. Varsayılan ve kaynak dil **`en`**; `tr` mevcut metinden
dolduruldu. Kütüphane `next-intl`.

**Ad alanları düz değil, özelliğe göre:** `common`, `parts`, `compatibility`,
`performance`, `pricing`. Tek büyük dosya iki kişinin aynı anda çeviri
yapmasını imkânsız kılar ve hangi metnin nerede kullanıldığını gizler.

**Kural mesajları (C1–C6, W1–W5) ICU ile ve ADLANDIRILMIŞ parametreyle.**
Motor artık her bulgunun yanında `params` taşıyor:

```
C1  { cpuSocket: "AM5", boardSocket: "LGA1700" }
C4  { psuWatts: 550, requiredWatts: 579 }
```

Metin birleştirme (`"soket " + x`) kullanılmadı: üç dilde üç ayrı kelime
sırası demek. Adlandırılmış parametre, çeviri dosyasının sırayı kendi diline
göre kurmasına izin veriyor. C3 ve C6 ayrıca `plural` kullanıyor.

**Motor mantığı DEĞİŞMEDİ.** `Finding.message` (Türkçe hazır cümle) yerinde
duruyor ve `params` onun YANINA eklendi:

- Arayüz `message`'ı hiç okumuyor, `code` + `params` ile çeviriden kuruyor.
- Motor arayüz olmadan da okunur bir çıktı verebiliyor; script'ler ve testler
  onu kullanmaya devam ediyor. Kaldırılsaydı `/engine` çeviri katmanı olmadan
  hiçbir şey söyleyemezdi.
- 153 testin hiçbiri değişmedi.

Aynı desen bantlar için: `bandFor()` Türkçe etiketi döndürmeye devam ediyor,
yanına `bandKeyFor()` eklendi ve arayüz onu kullanıyor.

**Hata payı dosyalarına DOKUNULMADI.** `lib/perf-margin.ts` ve
`lib/fps-margin.ts` içindeki `method` alanı Türkçe bir cümle; o dosyalar
kısıt gereği değişmediği için arayüz o alanı artık OKUMUYOR — yöntemin adı
`performance.*.method` anahtarından geliyor.

### K151 — Adreste dil öneki YOK; dil çerezden ve başlıktan çözümleniyor

next-intl'in yaygın kurulumu `/en/...`, `/tr/...` yol önekleri kullanır.
**Kullanılamaz:** `SCHEMA.md` bölüm 9 adres yapısını sabitliyor ve "sonradan
değiştirilmez" diyor. Önek eklemek `/sistem/<id>` adreslerini
`/en/sistem/<id>` yapardı — dağıtılmış her paylaşım linki kırılırdı.

Sıra: `NEXT_LOCALE` çerezi → `Accept-Language` başlığı → `en`.

Bedeli açıkça: aynı adres iki dilde farklı içerik döndürüyor. Sayfalar zaten
`force-dynamic` ve arama motorlarına kapalı (K30), yani bugün bir önbellek ya
da indeksleme sorunu doğurmuyor. **Site aramaya açılırsa bu yeniden
düşünülmeli.**

`/parca/…`, `/hakkinda`, `/gizlilik` gibi Türkçe adresler İngilizce arayüzde
de Türkçe kalıyor — adres yapısı sabit.

### K152 — Sayı, para ve tarih `Intl` üzerinden; para birimi dilden AYRI

Bu, eski bir kararın tersine çevrilmesi. `lib/format.ts` bilinçli olarak
`Intl` kullanmıyordu: değerler hem sunucuda hem tarayıcıda basılıyor ve iki
tarafın dil/saat dilimi farklı olursa React hydration uyuşmazlığı veriyordu.

**Sebep ortadan kalktı** çünkü ikisi de artık sabit: dil `i18n/request.ts`te
istek başına bir kez çözümlenip `NextIntlClientProvider` ile istemciye
geçiyor, saat dilimi açıkça `UTC`.

**Para birimi dilden ayrı bir mesele.** İngilizce okuyan bir kullanıcı da ₺
görmek isteyebilir: `locale` sayının nasıl yazılacağını, `currency` hangi para
birimi olduğunu söylüyor.

```
tr + TRY  ->  ₺54.939,18      1 USD = ₺41,00      20.08.2026
en + TRY  ->  TRY 54,939.18   1 USD = TRY 41.00   08/20/2026
```

Fiyat hâlâ hiçbir aşamada float'a çevrilmiyor: bölme yalnızca `Intl`e verilen
son adımda (SCHEMA.md bölüm 0, kural 4).

### K153 — Eksik çeviri anahtarı dağıtımı durdurur

`npm run dil:kontrol`. Ölçüt `en`: orada olup başka dilde olmayan anahtar
**hata** — o ekran, o dilde ham anahtar adını basar ve kullanıcı bunu görür.

Fazladan anahtar uyarı: ölü satırdır, ekranda bir şey bozmaz.

ICU parametreleri ve zengin metin etiketleri de karşılaştırılıyor ama
**asimetrik**:

- çeviride **fazla** değişken → **hata**; bileşen o adı göndermiyor, cümle
  çizilirken patlar
- çeviride **eksik** değişken → uyarı; bir dil kaynak dilin ihtiyaç duyduğu
  değişkene ihtiyaç duymayabilir. Bugün gerçek bir örneği var: İngilizce C6
  kuralı tekil/çoğul için `supportedCount` kullanıyor, Türkçede gerekmiyor.
  Hata saymak, çeviriyi İngilizcenin dilbilgisine mahkûm ederdi.


### K154 — İndeks tahmini için üç alan eklendi; istenen yedi alandan dördü ELDE YOK

**2026-08-22.** Spec'ten indeks tahmini için şemaya eklenen alanlar:

| Alan | Tablo | Kaynak |
|---|---|---|
| `l3_cache_mb` | `cpu_specs` | AMD "L3 Cache", Intel ARK "Cache" |
| `bus_width_bits` | `gpu_specs` | NVIDIA "Memory Interface Width", AMD "Memory Interface", Intel ARK "Graphics Memory Interface" |
| `architecture_family` | `gpu_specs` | NVIDIA "NVIDIA Architecture", AMD/Intel serinin yayınlanmış mimari adı |

**Kapsam: 60/60 ekran kartı, 42/42 işlemci.** Hepsi `source='manufacturer'`.

**İstenen ama alınamayan alanlar — üretici yayınlamıyor:**

| Alan | Durum |
|---|---|
| `memory_bandwidth_gbs` (geri doldurma) | NVIDIA **hiçbir** nesilde yayınlamıyor. 5080, 4090 ve 3080 sayfaları ham HTML'den denetlendi: yalnızca "Memory Interface Width" var. 30 kartın 27'si boş kalırdı. |
| `transistor_count` | AMD veriyor (53.9 B), NVIDIA vermiyor. |
| `process_node_nm` | NVIDIA ve AMD GPU sayfalarında yok; yalnızca Intel ARK'ta. |

Üçü de yarısı boş kalırdı. Proje sahibinin kendi kuralı: *"yarısı boş bir
öngörücü, hiç olmayandan kötüdür."* Bu yüzden eklenmediler.

**`bus_width_bits`, `memory_bandwidth_gbs`'in yerine geçiyor.** İkisi aynı
büyüklüğün iki yüzü: `bant genişliği = veri yolu × bellek hızı ÷ 8`. NVIDIA bu
çarpımın yalnızca ilk terimini yayınlıyor — ama o terim üç üreticide de tam
dolu. Yapısal olan ve tamamı elde olan tutuldu.

**Çapraz kontrol yapıldı.** Bant genişliği bilinen 21 AMD satırında
`veri yolu × hız ÷ 8` hesabı CSV'deki bant genişliğiyle **birebir tuttu**.
İki satır istisnadır: AMD, RX 7900 XTX ve XT sayfalarında "Memory Interface"
alanını yayınlamıyor; o iki değer aynı sayfadaki bant genişliği ve bellek
hızından çıkarıldı (960×8/20 = 384, 800×8/20 = 320). Bu ikisinde çapraz
kontrol döngüseldir ve kanıt değeri yoktur — kayda geçiyor.

Intel işlemcilerde L3 **iki bağımsız kaynaktan** doğrulandı: ARK spec
değeri ile Intel'in kendi adresindeki `-36m-cache-` parçası. 22 işlemcinin
22'sinde ikisi aynı.

### K155 — L3 önbellek, işlemci tahminini tabandan iyi hale getirdi

Ölçüm (birini-dışarıda-bırak, `npm run indeks:tahmin-sapma`):

```
CPU aileler arası          ort    p90  en kötü   taban
  boost × √cores  (eski)  13.6%  25.3%  32.8%    11.0%   <- taban DAHA IYI
  boost × √l3     (yeni)   4.1%   8.4%  13.2%    11.0%   <- 2.7 kat daha iyi
```

Ekleme öncesi model "hep ortalamayı söyle" tabanını yenemiyordu; sonrasında
belirgin şekilde yeniyor. **Eksik olan şey model değil veriydi.**

Aynı ölçüm ekran kartında da eksen değiştirdi: aile içinde
`bus_width × boost_clock`, `shader_units × boost_clock`'tan iyi çıktı
(RDNA 4: %7.8 → %3.3; Blackwell: %11.9 → %8.8). Aileler arasında ise TDP
en iyi eksen olarak kaldı (%15.3); veri yolu tek başına daha kötü (%19.3).

### K156 — Doğrulanamayan aile, iyimser bant taşıyamaz

Bir ailenin kendi hata bandını taşıyabilmesi için içinde **en az 4 ölçülmüş
parça** olmalı (LOO'nun anlamlı olabileceği en küçük sayı). Bugün bu ölçütü
yalnızca üç grup karşılıyor:

```
GPU   Blackwell n=5      RDNA 4 n=4
CPU   AM5 n=6
```

Kalanlar — Ada Lovelace (3), RDNA 3 (2), Xe2 (1) ve **hiç ölçümü olmayan**
Ampere (0), RDNA 2 (0), Alchemist (0) — **aileler arası bandı devralır**.

**Gerekçe:** doğrulanamamış bir ailenin hatası küçük değil, **bilinmiyor**.
Komşu ailenin bandını ödünç vermek ya da aradeğerlemek, ölçülmemiş bir şeye
ölçülmüş gibi dar bir bant takmak olurdu.

`n` her bandın yanında taşınıyor: hangi sayının dört veri noktasına dayandığı
görünmeden bant okunamaz.

### K157 — Varsayılan gösterim para birimi USD; çevrim yalnızca seçilirse

**2026-08-22.** Fiyat kaynağı USD yayınlıyor ve varsayılan gösterim artık
odur. Eskiden her fiyat elle girilen bir kurdan geçiyordu (K148); artık
varsayılan hâlde **çevrim yok** — kaynağın sayısı olduğu gibi görünüyor.

Kur ve tarihi yerinde duruyor, yalnızca kullanıcı başka bir para birimi
seçtiğinde devreye giriyor. **Para birimi seçimi dilden bağımsız:** `locale`
sayının nasıl yazılacağını, `currency` hangi para birimi olduğunu söylüyor.
İngilizce okuyan biri ₺, Türkçe okuyan biri $ görmek isteyebilir.

Kur notu da duruma bağlı: çevrim yapıldıysa kur ve tarihi, yapılmadıysa
"kaynağın para biriminde, çevrilmeden". Olmayan bir işlemi anlatmak kafa
karıştırır.

### K158 — Mimari ailesi kontrollü liste, serbest metin değil

`ArchitectureFamily` enum'ı; hem `gpu_specs` hem `cpu_specs` üzerinde ve
katalogdaki **her** parçada dolu (60/60 ekran kartı, 42/42 işlemci).

**Gerekçe:** tahmin "önce aile içinde" yapılıyor ve aile bir **gruplama
anahtarı**. Serbest metin olsaydı `RDNA 4` ile `RDNA4` iki ayrı aile sayılır,
grup ikiye bölünür ve birini-dışarıda-bırak doğrulaması sessizce
anlamsızlaşırdı — üstelik hata vermeden.

İşlemcide soket bir vekildi ama aynı şey değil: **AM5 hem Zen 4 hem Zen 5
taşıyor.** Ölçüm script'i önce sokete göre gruplandırıyordu; aile alanı
geldikten sonra gerçek mimari sınırına geçti.

### K159 — NVIDIA bant genişliğini yalnızca güncel serinin karşılaştırma
sayfasında yayınlıyor

Ürün sayfalarında yok (5080, 4090, 3080 ham HTML'den denetlendi: yalnızca
"Memory Interface Width"). **Karşılaştırma sayfasında var** ama yalnızca o
anki seri için: 50 serisinin yedi kartı geldi, 40 ve 30 serisinin tabloları
istemci tarafında yükleniyor ve sunucudan gelmiyor.

Sonuç: `memory_bandwidth_gbs` ölçümlü 15 karttan **12'sinde** dolu (%80).
Eksik üçü RTX 4060, 4070 ve 4090 — NVIDIA bu değeri hiçbir yüzeyinde
yayınlamıyor.

Pratik etkisi yok: `bus_width_bits` %100 dolu ve aynı büyüklüğün yapısal
yüzü. Tahmin ekseni o.

`process_node_nm` **hiçbir üreticide yok** (0/60, 0/42) ve `transistor_count_m`
yalnızca AMD'de (23/60). İkisi de şemada duruyor ama bugün tahmine
giremezler; doldurma yolu Wikidata/Wikipedia tarafında (Görev 4).

### K160 — Tahmin ayrı tabloda; K71 gevşetilmedi

`perf_index_estimated`, `perf_index`ten ayrı bir tablodur. **K71 aynen
geçerli:** ölçüm tablosuna tahmin satırı yazılmaz — bayrakla da, istisnayla
da, `source` sütunu eklenerek de.

K71'in verdiği güvence *"o tabloda sahte satır olamaz"*. Ayrı tablo o
güvenceyi bozmuyor; tersine, tahminlerin gidecek meşru bir yeri olduğu için
ölçüm tablosuna sızma basıncını kaldırıyor.

Çözümleme `/data` katmanında ve dönen kayıt `origin` alanını **her zaman**
taşıyor: çağıran taraf "bu sayı ölçüldü mü" sorusunu sormayı unutamaz, çünkü
cevabı almadan sayıya erişemiyor.

Sıra: tahminler önce yazılır, ölçümler üzerine yazar. **Ölçülen her zaman
kazanır** ve bu tek satırda görünür.

Model eğitimi `getMeasuredPerfIndexes` ile yapılıyor — modelin kendi
çıktısıyla eğitilmesi, kendi gürültüsünü veri sanması olurdu.

### K161 — Tahmin eksenleri ve KAPI KARARI

Ölçülen eksenler (`npm run indeks:tahmin-sapma`), seçilenler kalın:

```
GPU aile içi     bus_width × boost_clock   RDNA4 %3.3  Blackwell %8.8   <- SEÇİLDİ
                 shader_units × boost      RDNA4 %7.8  Blackwell %11.9
GPU aileler arası TDP                      %15.3 ort, p90 %35.4          <- SEÇİLDİ
                 bus_width                 %19.3
                 TDP × bus_width           %16.3
CPU aile içi     boost × √l3               zen_5 %11.0   (taban %21.6)   <- SEÇİLDİ
                 l3 tek başına             zen_5 %8.6
CPU aileler arası boost × √l3              %4.2 ort, p90 %8.4 (taban %10.5)
```

**KAPI: CPU spec tahmini GEÇTİ ve yayınlanıyor.** Kural şuydu: *aile içi hata
aile-ortalaması tabanının altına inerse spec tahmini yayınla.* zen_5 içinde
`boost × √l3` %11.0 verdi, taban %21.6 — belirgin şekilde altında. L3
eklenmeden önce en iyi eksen %13.6 veriyordu ve taban (%11.0) onu yeniyordu;
yani **eksik olan model değil veriydi.**

**Aile içi ile aileler arası arasında DAR BANT kazanıyor.** İkisi de
birini-dışarıda-bırak ile ölçüldü; ölçülmüş iki seçenekten dar olanı almak
kiraz toplamak değil, daha iyi doğrulanmış olanı seçmektir. Bugün işlemcide
aileler arası model (12 noktayla eğitiliyor) zen_5'in kendi modelinden
(4 nokta) dar çıkıyor ve bütün işlemciler onu alıyor.

**GPU aileler arası bant %20'yi aşıyor** (ölçülen p90 %30.7). Kullanıcının
kuralı gereği yayınlanıyor ama bant genişletilmiş hâliyle gösteriliyor ve
arayüz bunun geniş olduğunu söylüyor.

Sonuç kapsam: **60 ekran kartı çipi = 15 ölçülen + 45 tahmin**,
**42 işlemci = 12 ölçülen + 30 tahmin**. Boş panel kalmadı.

### K162 — "Ölçümlü / Ölçüm yok" gruplaması KALDIRILDI

K145 açılır listeleri ölçüm durumuna göre ikiye ayırıyordu. O ayrım, katalogun
bir bölümünde **hiç sonuç çıkmadığı** için vardı: kullanıcı seçmeden önce boş
panele düşeceğini bilmeliydi.

Kapsam tamamlanınca (60/60 çip, 42/42 işlemci bir değer döndürüyor) ayrımın
anlattığı durum ortadan kalktı. Bugün her seçim sonuç veriyor; fark sonucun
**ölçüldü mü tahmin mi** olduğu ve o, sonucun yanında bandıyla yazıyor.

Listede tutmak, olmayan bir engeli varmış gibi göstermek olurdu.

### K163 — Tahmin durumu türetilen sayılara TAŞINIR

Sistem indeksinin iki girdisi var; **biri tahminse türeyen sayı da tahmindir**
ve `≈` ile bandıyla gösteriliyor.

Birleşik bant **ağırlıklı toplam**, karekök değil. Bağımsız hatalar için
`√(a²+b²)` daha dar bir bant verirdi ama bu iki hata bağımsız değil: ikisi de
aynı ölçüm kümesinden, aynı yöntemle türetildi ve aynı yönde sapabilirler.
Toplamak geniş taraftan yanılmak demek — bir tahmin bandında doğru yön budur.

Oyun bazlı FPS'te bant iki parçalı: indeksin kendi bandı **+** FPS
türetmesinin ölçülmüş hata payı. Ölçülmüş bir oyun satırı bile, kartın
indeksi tahminse "tahmin" sayılıyor: ölçüm başka bir kartta yapıldı, bu karta
indeks üzerinden taşındı.

Örnek (RX 6600, ailesinde hiç ölçüm yok): sistem indeksi `≈77.6 ±%23`,
Alan Wake 2 `≈37 FPS ±%46.3` (30.7 + 15.6).

### K164 — Varsayılan sistem yalnızca ÖLÇÜLMÜŞ parçalardan kurulur

Kapsam tamamlandığı için tahmin edilmiş bir parça da sonuç verirdi. Yine de
varsayılan seçim `getMeasuredPerfIndexes` ile kuruluyor.

**Gerekçe:** kullanıcının gördüğü ilk ekran, sitenin neye dayandığını
göstermeli. Önce ölçülmüş veri, sonra boşluğun nasıl doldurulduğu.

### K165 — Wikidata spec taşımıyor; asıl kaynak Wikipedia tabloları

**2026-08-22, kuru çalışma** (`npm run wikidata:deneme`, hiçbir şey yazılmadı).

NVIDIA masaüstü GPU'ları için Wikidata **82 varlık** döndürdü ve katalogla
**7 tanesi** normalize adla eşleşti. Alan doluluğu:

```
transistör sayısı    2/82   %2
fabrikasyon süreci   0/82   %0
TDP                  2/82   %2
bant genişliği       0/82   %0
veri yolu genişliği  0/82   %0
yayın tarihi        63/82  %77
```

**Wikidata'da aradığımız spec alanları yok.** Yalnızca yayın tarihi dolu.

Sınıf kimliği ölçülerek bulundu, tahmin edilmedi: RTX 4090'ın (Q114062761)
`P31` değeri `Q183484` ("graphics processing unit") **değil**,
`Q122760264` ("graphics card model"). İlk sorgu bu yüzden sıfır döndürdü.

**Wikipedia tabloları zengin.** `List_of_Nvidia_graphics_processing_units`
wikitext'inde (549 KB, revizyon 1369488585) sütun geçişleri:

```
dolgu hızı (fillrate)   140      TDP / TBP               109
bant genişliği          110      çekirdek yapılandırması  87
saat hızı                73      veri yolu genişliği       72
transistör sayısı         6      fabrikasyon süreci         0
```

Yani proje sahibinin öngörüsü doğru çıktı: **veri Wikidata'da değil,
Wikipedia tablolarında.** Bir sonraki adım o tabloların ayrıştırılması.

**Lisans ayrımı satırda taşınacak:** Wikidata CC0 (atıf yükümlülüğü yok),
Wikipedia CC BY-SA (atıf **zorunlu**, kaynak makale + revizyon numarası ile).
İkisi aynı tabloda karışamaz.

**Uzlaştırma:** üretici değeri asla ezilmez. Dış değer çapraz kontrol olarak
kaydedilir; %5 üstü fark "incelenecek" işaretlenir ve insana gider. Üretici
sayfası birincil kaynak; dış kaynak onu doğrulayabilir ya da şüphe düşürebilir,
sessizce değiştiremez.

**Yazma yolu yok:** `--apply` bayrağı bilinçli olarak eklenmedi.

### K166 — Dolar kuru onaylandı: 1 USD = 41,00 ₺ (2026-08-22)

**Proje sahibinin kararı (S47).** `lib/currency.ts` içindeki `rateMinor: 4100`
artık benim koyduğum bir başlangıç değeri değil, onaylanmış değer.

Sayının **niteliği** değişmedi ve arayüz metni de değişmiyor: elle girilmiş bir
kur, canlı kur değil, `quotedAt` ekranda yazıyor. Onay, sayının doğru olduğunu
söylüyor; otomatik olduğunu değil.

Kapsam sınırı korunuyor: kur bir servisten çekilmiyor. Bu, yeni bir dış
bağımlılık demek ve beta kapsamı dışında. Kur eskidiğinde tek yerden, iki
satırla güncellenir — K157 ile birlikte okunur: varsayılan gösterim USD olduğu
için kur yalnızca kullanıcı TRY seçtiğinde bir sayıya dokunuyor.

### K167 — `process_node_nm` kaldırıldı: boş sütun, eksik sütundan kötüdür

**2026-08-22.** Alan K154 ile indeks tahmini ekseni olmak üzere eklenmişti ve
o gün de boştu — "seyrek ama ileride dolar" varsayımıyla bırakılmıştı.

**Ölçüm:** katalogda `gpu_specs` 0/60, `cpu_specs` 0/42. CSV'lerin hiçbirinde
tek bir dolu hücre yok. Wikidata kuru çalışmasında (K165) *fabrikasyon süreci*
sütunu **0/82** geçiş verdi; Wikipedia'nın NVIDIA tablosunda da **0** geçiş
var. Yani alanı dolduracak ne üretici sayfası ne dış kaynak var.

**Karar: sütun düşürülüyor.** Gerekçe: boş bir sütun bedava değil. `spec:kapsam`
çıktısında yer kaplayıp her seferinde "%0" satırı üretiyor, her yeni içe
aktarma yolunda boş geçilmesi gereken bir alan oluyor ve şemayı okuyan birine
"burada bir veri var" diye görünüyor. Eksik alan sorulabilir; boş alan
cevaplanmış gibi durur.

**Eski migration DÜZENLENMEDİ.** Sütunu ekleyen `20260822070000_mimari_ailesi_enum`
aynı zamanda `ArchitectureFamily` enum'unu kuruyor; içeriğini değiştirmek hem
o enum'u riske atardı hem de uygulanmış bir migration'ın checksum'ını bozup
geliştirme veritabanının sıfırlanmasını gerektirirdi. Bunun yerine ileriye
doğru düşüren bir migration yazıldı: `20260822190000_process_node_kaldirildi`.
Tarih olduğu gibi kalır, sütun gider.

**Veri kaybı yok** ve bu tahmin değil ölçüm: düşürülen iki sütunda `count(...)`
sıfır döndü.

`transistor_count_m` **kalıyor**: AMD yayınlıyor ve Wikipedia NVIDIA tablosunda
6 geçiş var — az ama sıfır değil.

### K168 — Wikipedia wikitext ayrıştırma kuralları

**2026-08-22.** `scripts/import-wikipedia-specs.mts`, MediaWiki API,
kuru çalışma. K165'in bıraktığı yerden: veri Wikipedia tablolarında.

**1. Sütun eşlemesi indekse değil BAŞLIĞA bakar.** Sütun sırası nesilden
nesile değişiyor — RTX 30 tablosunda TDP 23., RTX 50'de 25. sütun. Sabit
indeks bir nesilde doğru, ötekinde sessizce yanlış olurdu.

**2. Birim başlıktan okunur; birimsiz sütun KULLANILMAZ.** `transistors
(billion)` ×1000 ile milyona çevriliyor, `(million)` ×1 ile. Birim yazmayan
tablo atlanıyor — "muhtemelen milyondur" bir tahmindir ve K60'a girer.
Bedeli ölçüldü ve kabul edildi: AMD'nin `TBP` sütunu birimsiz olduğu için
AMD'den TDP okunmuyor. Kayıp yok, TDP zaten 60/60 dolu.

**3. Belirsiz hücre tahmin edilmez, GEREKÇESİYLE kaydedilir.** `"System
shared 64/128"` (tümleşik GPU), `"2x 128"` (çift çipli kart), `"128-256"`
(aralık) — üçü de sayı içeriyor ama hiçbiri tek bir değer değil. Sessizce
atlamak kapsamı olduğundan iyi gösterirdi; ölçmeye çalıştığımız şey kapsam.
790 satırdan 120'si böyle kaydedildi.

**4. Çözüm ALAN BAŞINA, satır başına değil.** Aynı model adı birden çok
satırda geçebiliyor ve bu her zaman hata değil: NVIDIA "RTX 4060"ı iki farklı
çiple yayınladı; satırlar bant genişliğinde AYNI, transistör sayısında
FARKLI. Önce satırın tamamı atılıyordu ve bu, transistör çelişkisi yüzünden
bant genişliğini de kaybettiriyordu. Artık adaylar bir alanda anlaşıyorsa o
alan kullanılıyor, anlaşmıyorsa yalnızca O ALAN düşüyor.

**5. Bölüm süzgeci güvenlik meselesi.** Yalnızca "Desktop" başlığı altındaki
tablolar okunuyor. Aynı model adı dizüstü tablosunda da var ve değerleri
farklı: "RTX 4090" dizüstünde 576 GB/s, masaüstünde 1008 GB/s. Süzgeç
olmasaydı ayrıştırıcı yanlış satırı doğru sanardı.

**6. Şablonla gelen tablolar kendi revizyonlarıyla atıf alır.** AMD'nin
RX 7000/9000 ve Intel'in Arc tabloları makalenin wikitext'inde yok; ayrı
şablon sayfalarında duruyor. O sayfalar ayrıca çekiliyor ve satır o sayfanın
revizyon numarasını taşıyor — CC BY-SA atfı veriyi taşıyan sayfaya verilmek
zorunda, çağıran makaleye değil.

**7. Eşleştirme sınırı veriden okunur, kalıptan değil.** Katalog adındaki
bellek eki (`...8GB`) düşürülürken kaç basamak kesileceği parçanın kendi
`vram_gb` değerinden alınıyor. Kalıpla iki kez yanlış kesildi: `\d+gb$`
"rtx30508gb"i "rtx" yaptı, `\d{1,2}gb$` "rtx305" yaptı — ikisi de model
numarasını yuttu.

**8. Uzlaştırma: üretici ezilmez, çelişki insana gider.** Bu tur üç çelişki
buldu ve üçü de yayınlanmadı, düzeltilmedi:

```
nvidia-rtx-5060-ti-16gb  memory_bandwidth_gbs  bizde 576  wiki 448  %22.2
nvidia-rtx-5060-ti-8gb   memory_bandwidth_gbs  bizde 576  wiki 448  %22.2
nvidia-rtx-5060          memory_bandwidth_gbs  bizde 480  wiki 448   %6.7
```

**Kimin haklı olduğunu üçüncü bir sayı söylüyor.** CLAUDE.md'deki çapraz
kontrol tersine çevrildi: `bellek hızı = bant genişliği × 8 ÷ veri yolu`.
RTX 5060 Ti'da bizim değerimiz **36 Gbps** ima ediyor — öyle bir bellek yok.
Wikipedia'nınki 28 Gbps veriyor, GDDR7'nin bu karttaki gerçek hızı.
**Bizim satırımız yanlış.** Yine de dış kaynak üzerine yazmadı: kural bir
çelişki bulunduğu için gevşetilmez, düzeltme üretici sayfasından yapılır.

Bu kontrol script'e kalıcı olarak eklendi (`TUTARLILIK KONTROLU` bölümü).

**9. `--apply` YOK.** Sebebi teknik değil, şema: dış değerin nereye yazılacağı
kararsız (`SORULAR.md` S48).

### K169 — Ölçüm hedefi seçimi: aile içi merkezilik, popülerlik değil

**2026-08-22.** `npm run olcum:hedefler`. 29 çip (ampere 12, rdna_2 12,
alchemist 5) ailesinde hiç ölçüm olmadığı için ±%30.7 taşıyor.

**Ölçüt spec uzayındaki merkezilik.** Model `indeks = k · x^b` ve log uzayında
oturuyor; ölçülecek ilk çip ailenin çapasıdır. Uçtan seçilen çapa ailenin öbür
ucunu ekstrapolasyonla tahmin ettirir, ortadan seçilen iki yöne de
interpolasyon bırakır.

**Ölçüt sınandı ve iki ölçüm TERS yönde çıktı.** Bütün küme üzerinden
(15 nokta) merkeze uzak yarı DAHA İYİ tahmin edildi (%10.9'a karşı %19.7);
aile içinde (9 nokta) merkeze uzak yarı DAHA KÖTÜ tahmin edildi (%10.1'e
karşı %3.7).

**Geçerli olan aile içi ölçüm.** Sebebi yapısal: bütün küme üzerinden yapılan
sınamada hatanın kaynağı ağırlıklı olarak dışarıda bırakılan noktanın AİLESİ,
merkezden uzaklığı değil — aile etkisi mesafe etkisini örtüyor. Çapanın işi
bir ailenin kendi modelini tutmak olduğu için doğru soru aile içinde sorulan
sorudur. İkisi de küçük örneklem; script çıktısında "eğilim, kanıt değil"
yazıyor.

**Tek ölçüm bandı DEĞİŞTİRMEZ ve bu liste öyle sunulmuyor.** Eşik dört
(`MIN_FAMILY_FOR_OWN_BAND`, K156); dördüncü ölçüm düşürür. Eşiğe ulaşmanın
kazancı ölçüldü: `blackwell` beş ölçümle ±%30.7 yerine ±%19.8, `rdna_4` dört
ölçümle ±%8.5 yerine ±%6.4.

**Kısa liste:** `amd-rx-6700` (rdna_2), `nvidia-rtx-3070-ti` (ampere),
`intel-arc-a750` (alchemist). Sıra ailenin taşıdığı çip sayısına göre.

Rapor: `docs/log/2026-08-22-olcum-hedefleri.md`.

### K170 — Provenance satır başından ALAN BAŞINA indi (S48 kapandı)

**2026-08-22.** `spec_field_sources` tablosu, `npm run kaynak:kontrol`,
`npm run wikipedia:aktar -- --apply`.

**Sorun:** spec tablolarındaki `source`/`source_url`/`confidence` üçlüsü satır
başınaydı. Bir `gpu_specs` satırının bant genişliği Wikipedia'dan, geri kalan
her alanı üreticiden gelebiliyor. Satırın tamamını `manufacturer` damgalamak
yalan; `wikipedia` damgalamak on üç alanı birden yalan yapıyor.

**Yan tablo seçildi, 30 paralel sütun değil.** Sütun yolu her spec tablosuna
alan sayısı kadar üçlü ekler (`gpu_specs`te 14 alan × 3 = 42 yeni sütun), her
yeni alanda migration ister ve "hangi alanlar Wikipedia'dan geldi" sorusunu 42
sütun taranarak cevaplatır. Yan tabloda aynı soru tek satırlık bir `WHERE`.

**Bedeli açıkça yazıldı:** (1) okurken ikinci bir sorgu, (2) `field_name` metin
sütunu, yani veritabanı "böyle bir alan var mı" diye soramıyor. İkincisinin
karşılığı `npm run kaynak:kontrol`: bilinmeyen alan adı, damgasız dolu alan ya
da atfı eksik lisanslı satır bulursa **duruyor**.

**Satır damgası kaldırılmadı**, anlamı değişti: artık defterde satırı olmayan
alanların **varsayılanı**. Geçiş bütün dolu alanları damgaladığı için bugün
varsayılana düşen alan yok — **2457 alan** `manufacturer` olarak yazıldı ve
damga değişmedi, yalnızca alan seviyesine indi.

**Öncelik kuralı yazma anında zorlanıyor.** Dış kaynak yalnızca `null` alanı
doldurabiliyor ve kontrol iki kere yapılıyor: script karar verirken, ve
`UPDATE ... WHERE <alan> IS NULL` ile veritabanında. İkincisi olmasaydı kural
script'in doğruluğuna bağlı kalırdı.

**Gerçek aktarım yapıldı:** 50 alan yazıldı (22 bant genişliği + 28 transistör
sayısı), **96 alana dokunulmadı** çünkü üretici değeri vardı. Bant genişliği
kapsamı 38/60 → **60/60**, transistör 23/60 → **51/60**.

**Atıf ALANI takip ediyor, satırı değil.** Arayüzde bant genişliği gösteriliyor;
CC BY-SA kredisi yalnızca gösterilen değer Wikipedia'dan geldiğinde çıkıyor.
Tarayıcıda doğrulandı: RTX 4090 → "(external source)" işareti + makale/revizyon
kredisi; RX 9070 XT → aynı alan, kredi **yok** (üreticiden).

**`varyant:kontrol` uyarlandı.** "Çip satırları kaynak CSV ile birebir aynı"
kontrolü dış kaynaklı alanları **defterden okuyup atlıyor**. CSV artık
`gpu_specs`in tek kaynağı değil; atlanan alan sayısı çıktıda yazıyor ki
sessizce genişlemesin.

**`raw_imports`a ne yazıldı:** makale başına bir satır — revizyon numarası,
wikitext boyutu, lisans ve **ayrıştırılmış satırlar**. Wikitext'in kendisi
yazılmadı: üç makale 834 KB ve revizyon numarası verildiğinde byte byte geri
getirilebiliyor. Saklanması gereken şey "hangi metinden okuduk" sorusunun
cevabı; revizyon numarası o cevabın kendisi.
