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
