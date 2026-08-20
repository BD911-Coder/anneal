# 2026-08-20 — Hata payı otomatikleşti, render modu kendi alanına çıktı

Üç iş: hata payı script'i (A.3'ten öne çekildi), `render_mode` alanı (S42),
çıkış yılı doğrulaması (S43). İkisi şema değişikliği, üç migration.

---

## 1. Hata payı script'i (K110)

**Sorun somuttu:** iki hata payı sayısı bu tur **iki kez** elle güncellendi.
Üçüncüde unutulsa arayüz "±%12.8" demeye devam ederdi; doğrusu %13.7 olduğu
halde. Sessizce yanlış bir kesinlik vaadi — projenin K52'den K74'e reddettiği
şeyin aynısı, üstelik hata payının kendisinde.

| Komut | Yazdığı dosya | Yöntem |
|---|---|---|
| `npm run indeks:sapma` | `lib/perf-margin.ts` | bağımsız aynayla karşılaştırma (K80) |
| `npm run fps:sapma` | `lib/fps-margin.ts` | birini-dışarıda-bırak |

### Üç parça, üçü de gerekli

**İşaretli blok.** Script yalnızca `// === ÖLÇÜM BAŞLANGIÇ` ile
`// === ÖLÇÜM BİTİŞ ===` arasını yazıyor. Gerekçe ve tarihî notlar blok
dışında, elle. Bütün dosyayı yazsaydı o yazılar her ölçümde silinirdi.

İşaretçi bulunamazsa script **hata veriyor** — ve bu tasarım kendini kanıtladı:
sınama sırasında PowerShell'in `Set-Content -Encoding utf8` çağrısı dosyanın
kodlamasını bozdu; script sessizce yazmak yerine durdu.

**Eşik aşılırsa dosya yazılmaz.** %25'i aşan bir ölçüm yayına girmiyorsa
arayüzün okuduğu yere de işlenmez.

**Eskime kontrolü.** İki dosya da ölçüm anındaki `benchmark_points` satır
sayısını taşıyor (`measuredAtPoints`). `npm run kural:kontrol` karşılaştırıyor.
Bilerek bozup sınandı:

```
HATA: yayinlanan hata payi eskimis.
  lib/fps-margin.ts: hata payi 250 olcumle hesaplanmis (2026-08-20),
  su an 298 olcum var. Yeniden olc: npm run fps:sapma
```

Çıkış kodu 1 — durur, düzeltecek komutu söyler.

### Otomasyon ilk çalıştırmada bir hata yakaladı

`comparedParts` elle **20** yazılmıştı; script **25** ölçtü. Elle girilen
sayının yanlış olduğu, otomatikleştirilince ortaya çıktı.

---

## 2. `render_mode` kendi alanı oldu (K111, S42 kapandı)

`benchmark_points.render_mode` enum: `raster`, `raytracing`, `pathtracing`.

**K108 geri alındı.** Raytracing bir süre `upscaling` alanına
`DLSS/FSR Native + Raytracing` biçiminde yazılıyordu ve o karar kendi bedelini
yazmıştı: alan iki ayrı ayarı taşıyor, sorgulanamaz hale geliyordu.

**Neden şimdi:** dört oyunken ucuz, kırk oyunken pahalı.

**Veri taşıma migration içinde yapıldı.** `benchmark_points` append-only ve
uygulama kodundan UPDATE yazılmaz. Append-only'nin amacı bir **ölçümün**
sessizce revize edilmemesi; burada FPS değeri değişmiyor, ayarın kaydedilme
biçimi düzeliyor — ve değişiklik migration geçmişinde kayıtlı kalıyor.

```
20260820142440_render_mode_alani          alan + enum
20260820142632_render_mode_veri_tasima    32 satir (4 oyun)
```

Sonuç:

```
  16  DLSS/FSR Native      raytracing
  40  DLSS/FSR Native      raster
  16  DLSS/FSR Quality     raytracing
 112  DLSS/FSR Quality     raster
 114  null                 raster
upscaling'de hala '+ Raytracing' gecen: 0
```

**Grup anahtarı genişledi** (K101 → K111): `(game_id, resolution, preset,
upscaling, render_mode)`. Aynı oyunun raster ve raytracing ölçümleri aynı
orana giremez — aralarındaki fark kartın gücü değil ayarın maliyetidir.

`pathtracing` bugün kullanılmıyor ama şimdi tanımlandı: sonradan eklenseydi
bugünkü satırların modu geriye dönük tahmin edilmek zorunda kalırdı
(`workload`'ın erken tanımlanma gerekçesiyle aynı).

---

## 3. Çıkış yılları doğrulandı (K112, S43 kapandı)

17 oyunun yılı Steam'den doğrulandı. Üç satır değişti ve **hiçbiri yazım hatası
değildi** — ikisi konsol/PC farkı, biri kaynak yokluğu:

| Oyun | Önce | Sonra | Sebep |
|---|---|---|---|
| Death Stranding 2 | 2025 | **2026** | PS5 2025, PC 2026 |
| Marvel's Spider-Man 2 | 2023 | **2025** | PS5 2023, PC 2025 |
| Alan Wake 2 | 2023 | **(boş)** | Steam'de yok — Epic'e özel |

**Tanım yazıldı: `release_year` = PC (Steam) çıkış yılı.** Burası PC toplama
sitesi ve ölçümler PC sürümünde yapılıyor.

**`release_year` opsiyonel oldu** (migration
`20260820142939_games_release_year_opsiyonel`). Gerekçe iki katmanlı: K56
ölçütüyle zaten zorunlu olmamalıydı (hiçbir kural/arayüz kullanmıyor), ve Alan
Wake 2 doğrulanamadı. Zorunluluk, doğrulanamayan bir yılı uydurmaya zorlardı.

32 oyunun **31'i** artık Steam'i kaynak gösteriyor; Alan Wake 2'nin kaynağı
ComputerBase kaldı çünkü orada da yıl yok, yalnızca ad var.

---

## 4. Ne doğrulandı

```
npm run indeks:sapma  lib/perf-margin.ts yazildi: meanPercent 5.2,
                      maxPercent 11.5, comparedParts 25, measuredAtPoints 298
npm run fps:sapma     lib/fps-margin.ts yazildi: meanPercent 6.6, p90 13.7,
                      maxPercent 35.3, points 184, measuredAtPoints 298
npm run kural:kontrol Hata payi guncel: 298 olcumle hesaplanmis. 11/11 kural
npm run sema:kontrol  81/81
npm test              5 dosya, 144 test
npm run lint          temiz
npm run build         hatasiz
```

**İdempotency sınandı:** iki script arka arkaya iki kez çalıştırıldı, ikinci
çalıştırma sonrası fark birebir aynı kaldı.

**Şema kontrolü bir şey yakaladı:** SCHEMA.md'ye yazdığım
`**\`render_mode\` neden ayrı alan**` satırını ayrıştırıcı **tablo adı**
sandı ve "Sadece SCHEMA.md'de: render_mode" dedi. Cümle
`**Neden \`render_mode\` ayrı bir alan**` diye yeniden yazıldı. Kontrol
doğru davrandı.

### Tarayıcıda

Render modu artık ayrı bir bileşen olarak görünüyor ve `upscaling` temiz:

```
1440p ultra, DLSS/FSR Quality, Raytracing
1440p ultra, DLSS/FSR Native, Raytracing
```

23 oyun, 12 ölçüm + 11 tahmin, hata payı satırı yeni sayılarla.

**Dev sunucusu yeniden başlatıldı.** Prisma istemcisi yenilendikten sonra
çalışmakta olan sunucu eski istemciyi tutuyordu ve
`PrismaClientValidationError` ile 500 döndürüyordu. PID 44856 durduruldu ve
sunucu yeniden başlatıldı; sonrasında bütün istekler 200/304. Konsolda görünen
hatalar yeniden başlatma öncesinden kalan tampon kayıtlarıdır (aynı digest).

> **Araç notu:** migration + `prisma generate` sonrası çalışan `next dev`
> **yeniden başlatılmalı**. CLAUDE.md'deki "prisma generate elle çalıştırılmalı"
> notunun devamı bu.

---

## 5. Açık kalan sorular

1. **`gpu_weight` / `cpu_weight` hâlâ 0.5 yer tutucu**, 32 oyunun hepsinde.
   Hiçbir kural kullanmıyor ama şemada zorunlu — S22 kapsamında.
2. **Tek kaynak riski değişmedi.** 184 GPU ölçümünün tamamı tek incelemeden.
3. **`fps:sapma` ve `indeks:sapma` ayrı komut.** Biri çalıştırılıp diğeri
   unutulabilir; `kural:kontrol` ikisini de denetliyor, yani unutma yakalanıyor
   ama tek komutla ikisini çalıştıran bir kısayol yok.
4. **Alan Wake 2'nin yılı boş.** Epic Games Store doğrulanabilir bir kaynak
   olabilir ama denenmedi — yeni kaynak, `robots.txt` kontrolü gerekir.
