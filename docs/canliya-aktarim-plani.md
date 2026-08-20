# Canlıya veri aktarımı — hazır plan

**Durum: onaylandı, uygulama Faz 2'ye ertelendi.** Canlıda kullanıcı yok;
verinin orada olmasının bugün faydası yok. Bu belge, sıra geldiğinde
uygulanmak üzere duruyor.

Seçilen yol: **komutları proje sahibi çalıştırır.** Canlı adres ne bu makineye
ne de sohbet geçmişine girer — K29'un koruduğu şey bu.

---

## Yöntem: içe aktarıcıları canlıya karşı bir kez çalıştırmak

Veri kopyalanmıyor, **yeniden türetiliyor**. CSV'ler zaten depoda; canlı da
geliştirme gibi onlardan üretiliyor.

**Ölçülmüş dayanak:** Node'un `loadEnvFile`'i ortamdan gelen değişkeni **ezmez**.

```
DATABASE_URL="postgres://ORTAMDAN" node t.mjs
once : postgres://ORTAMDAN
sonra: postgres://ORTAMDAN     ← loadEnvFile dosyadan gelenle ezmedi
```

Yani `.env.local` yerinde dururken tek komutluk canlı bağlantı çalışır ve
`.env.local` hiç değiştirilmez.

### Neden döküm (pg_dump) değil

17 dev-seed parça, ~3000 `raw_imports` ve `builds` gürültüsünü de taşırdı.
Filtrelenmiş bir döküm ise elle üretilmiş, kimsenin yeniden türetemeyeceği bir
nesne olurdu — projenin kaynak defteri disiplinine ters.

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

### 0. Şema

Depoda 11 migration var; son ikisi (`kasa_olculeri_opsiyonel`,
`kart_varyanti`) canlıda olmayabilir. Şema eskiyse içe aktarma sütun hatası
verir.

En temizi: **sırada bir Vercel production dağıtımı varsa onu kullan** —
`dagitim:migration` zaten `prisma migrate deploy` çalıştırıyor. Yoksa:

```bash
DATABASE_URL="$PROD_URL" npx prisma migrate deploy
```

### 1-4. Veri

Sıra bağımlılıktan geliyor: fiyat ve ölçüm `parts`'a, ölçüm ayrıca `games`'e
bağlı.

```bash
DATABASE_URL="$PROD_URL" npm run parca:aktar      # 208 parça + spec satırları
DATABASE_URL="$PROD_URL" npm run olcum:aktar      # 17 oyun + 178 ölçüm
DATABASE_URL="$PROD_URL" npm run fiyat:aktar      # 22 fiyat
DATABASE_URL="$PROD_URL" npm run indeks:hesapla   # 26 indeks
```

`perf_index` **kopyalanmıyor**, canlıda yeniden hesaplanıyor. K71 "yalnızca
`benchmark_points`'tan hesaplanarak üretilir" diyor; taşımak yerine türetmek
hem kurala uyuyor hem de aktarım sırasında bozulma ihtimalini kaldırıyor.

Hepsi idempotent: `parca:aktar` upsert eder, `fiyat:aktar` aynı gün varsa
atlar, `olcum:aktar` aynı ölçüm varsa atlar. Yarıda kalırsa baştan
çalıştırmak güvenli.

### 5-6. Doğrulama

```bash
DATABASE_URL="$PROD_URL" npm run indeks:sapma     # K80: sapma kaydedilmeden yayın yok
DATABASE_URL="$PROD_URL" npm run dagitim:kontrol  # "dev-seed satiri yok" dönmeli
```

---

## Beklenen sonuç

| Tablo | Satır |
|---|---|
| `parts` | 208 (+ 208 spec satırı) |
| `games` / `benchmark_points` | 17 / 178 |
| `price_snapshots` | 22 |
| `perf_index` | 26 |
| dev-seed | **0** |

`indeks:sapma` çıktısı `lib/perf-margin.ts`'teki sayılarla tutarlı olmalı
(ortalama %4.9, en büyük %11.5). Tutarsızsa canlı ve geliştirme aynı veriye
sahip değil demektir; devam edilmez.

Son adım: canlı sitede bir sistem toplayıp toplam fiyatın göründüğünü görmek.

---

## Kısıtlar nasıl karşılanıyor

| Kısıt | Nasıl |
|---|---|
| dev-seed hiçbir şey gitmeyecek | Canlı CSV'lerden üretiliyor; hiçbir CSV dev-seed içermiyor. `db:seed` çalıştırılmıyor **ve** K94 gereği çalıştırılamıyor. |
| Canlı bağlantı yerel dosyada kalmayacak | Adres yalnızca kabuk değişkeninde; `.env.local` hiç değişmiyor. |
| `dagitim:kontrol` temiz dönmeli | Son adım olarak çalıştırılıyor ve doğrulanıyor. |

## Bilinen riskler

1. **Adres kabuk geçmişine düşebilir.** `read -rs` ile alınırsa komut
   satırında görünmez; `history` dosyasına da yazılmaz.
2. **`raw_imports` hacmi.** İçe aktarıcılar canlıda da ham satır yazar
   (şema kural 3). ~3000 satır beklenir; tasarım gereği.
3. **Migration eskiyse** içe aktarma sütun hatasıyla durur — 0. adım bunun
   için önce geliyor.
