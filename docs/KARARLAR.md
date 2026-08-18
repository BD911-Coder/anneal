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
