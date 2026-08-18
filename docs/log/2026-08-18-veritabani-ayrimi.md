# 2026-08-18 — Geliştirme ve canlı veritabanı ayrımı, 3. katman

---

## Ne yapıldı

**1. `.env.local` geliştirme veritabanına çevrildi.** Canlı bağlantı bilgileri
dosyadan çıkarıldı; artık hiçbir yerel dosyada bulunmuyor. `.env.example`'a
bunun kural olduğu yazıldı.

**2. Geliştirme veritabanı kuruldu.** `prisma migrate deploy` ile 17 tablo,
ardından seed ile 29 parça.

**3. Canlı veritabanı temizlendi.** 58 dev-seed satırı silindi.

**4. dev-seed korumasının 3. katmanı yazıldı.** `scripts/check-deploy.mjs`,
`npm run dagitim:kontrol`.

**5. `docs/KARARLAR.md` K29** yazıldı.

---

## Hangi kararlar verildi ve neden

**K29 — Geliştirme ve canlı ayrı veritabanlarıdır.** Karar proje sahibinin.

Tek veritabanı kullanıldığında dev-seed korumasının 2. ve 3. katmanları
birbiriyle çelişiyordu: 2. katman satırların *görünmesini* engelliyor, 3. katman
*varlığını* yasaklıyor. Aynı veritabanında hem geliştirip hem dağıtmak,
3. katmanın her dağıtımı durdurması demekti.

Ek fayda: canlı adres geliştirme makinesinde hiç bulunmadığı için yanlış
veritabanına yazma ihtimali kalmıyor — hatırlamaya değil, erişimin yokluğuna
dayanan bir koruma.

**Kontrol `.env.local` okumuyor.** Bilinçli: `.env.local` geliştirmeyi gösterir
ve orada dev-seed olması normaldir. Kontrol dağıtım hattında çalışır ve
`DATABASE_URL`'i platformdan alır, yani her zaman dağıtımın gerçek hedefine bakar.

**Tablo listesi elle yazılmadı.** Kontrol, `information_schema`'dan `source`
sütunu olan tabloları buluyor. Şemaya yeni tablo eklendiğinde kapsam kendiliğinden
genişliyor; kimsenin listeyi güncellemeyi hatırlaması gerekmiyor.

**Kalıcı silme aracı eklenmedi.** Silme tek seferlik yapıldı. Ayrı
veritabanlarıyla böyle bir araca ihtiyaç kalmıyor ve depoda duran bir silme
aracı başlı başına risk.

---

## Ne doğrulandı

**Bağlantı değişti:**

```
DATABASE_URL  proje: <geliştirme-proje-ref>  port: 6543   parola çözüldü: EVET, birebir
DIRECT_URL    proje: <geliştirme-proje-ref>  port: 5432   parola çözüldü: EVET, birebir
eski canlı proje adı geçiyor mu?: hayır (doğru)
```

Paroladaki `!` URL'de geçerli bir karakter, kodlama gerekmedi.

**Geliştirme veritabanı kuruldu:**

```
$ npx prisma migrate deploy
Applying migration `20260818102429_ilk_sema`
All migrations have been successfully applied.

$ npm run db:seed
Toplam 29 parça, 29 tanesi dev-seed.

$ npm run db:kontrol
SONUC: 17 tablonun 17'i mevcut, 12 enum tipi olusmus, K7 takma adlari dogru.
```

**Canlı veritabanı — silme öncesi sayım:**

```
Hedef veritabanı (CANLI): <canlı-proje-ref> @ aws-0-eu-central-1...
  case_specs   4    cpu_specs    4    gpu_specs     4
  motherboard_specs 5             parts       29
  psu_specs    4    ram_specs    4    storage_specs 4
  benchmark_points 0   games 0   price_snapshots 0   raw_imports 0

SİLİNECEK TOPLAM: 58 satır
dev-seed OLMAYAN parts satırı (dokunulmayacak): 0
```

**Silme — tek işlem, yabancı anahtar sırasıyla:**

```
  gpu_specs 4, cpu_specs 4, motherboard_specs 5, ram_specs 4,
  psu_specs 4, storage_specs 4, case_specs 4, parts 29
Toplam 58 satır silindi, işlem onaylandı.
```

Canlıda dev-seed olmayan hiç satır yoktu; gerçek veri kaybı olmadı.

**3. katman — üç durumda da ölçüldü:**

```
canlı (temizlendi)  -> çıkış kodu: 0    "dev-seed satiri yok. Dagitim serbest."
geliştirme (kirli)  -> çıkış kodu: 1    "DAGITIM DURDU. 58 adet dev-seed satiri var"
DATABASE_URL yok    -> çıkış kodu: 1    adres verilmeden kontrol yapılmıyor
```

Geliştirme veritabanına yöneltildiğinde durdurması, kontrolün gerçekten
çalıştığının kanıtı — canlı temiz olduğu için tek başına "geçti" çıktısı bir şey
kanıtlamazdı.

**Uygulama yeni veritabanından okuyor.** Sayfa açıldı: "29 parça", ve kasten
uyumsuz sistem yine 5 hata + 1 uyarı üretti (C1, C2, C4, C5, C6, W5) — aynı
sonuçlar, yeni veritabanı.

**Diğer:**

```
$ npm run sema:kontrol   SONUC: 61 kontrolun tamami gecti.
$ npm test               46 passed (46)
$ npx tsc --noEmit       (çıktı yok)
$ npm run lint           (çıktı yok)
$ npm run build          ✓ Compiled successfully
```

**dev-seed korumasının dört katmanı — artık tamam:**

| Katman | Nerede | Durum |
|---|---|---|
| 1. `source='dev-seed'` damgası | `scripts/seed.mts` | ✅ |
| 2. Veri katmanında otomatik filtre | `data/parts.ts` | ✅ ölçüldü |
| 3. Dağıtım öncesi kontrol | `scripts/check-deploy.mjs` | ✅ ölçüldü |
| 4. Seed canlıya bağlıysa reddeder | `scripts/seed.mts` | ✅ ölçüldü |

---

## Açık kalan sorular

Yok. `SORULAR.md` şu an boş.

**Sıradaki iş için not:** dağıtım henüz kurulmadı. Kurulduğunda
`npm run dagitim:kontrol` dağıtım hattına eklenmeli, yoksa 3. katman yazılı
olduğu halde çalışmaz.
