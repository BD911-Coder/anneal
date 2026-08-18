# 2026-08-19 — NVIDIA RTX 30/40/50 GPU verisi ve altı karar

---

## Ne yapıldı

**1. Şema: üç ölçekleme alanı** (K51). `shader_units`, `boost_clock_mhz`,
`memory_bandwidth_gbs` — hepsi opsiyonel.
Migration `20260818220913_gpu_olcekleme_alanlari`.

**2. Şema: `length_mm` opsiyonel** (K52).
Migration `20260818221920_gpu_uzunlugu_opsiyonel`. Motor tipi, dönüştürücü ve
C5 kuralı buna göre güncellendi. Arayüz uzunluk bilinmediğinde uyarı gösteriyor.

**3. İçe aktarma script'i üç değişiklik:**
- Kategori artık dosya adının ilk tireye kadarki kısmı (`gpu-nvidia.csv` → `gpu`)
- `confidence` CSV sütunundan okunuyor, yoksa `high`
- S20 kapandı: aynı slug güncelleniyor, kaynak sırası korunuyor (K54)

**4. Seed script'ine aynı koruma eklendi.** `npm run db:seed` artık gerçek
veriyle dolu bir slug'ın üzerine yazmıyor.

**5. `data/parts/gpu-nvidia.csv` — 30 satır.** RTX 3050'den 5090'a bütün
masaüstü modeller, VRAM varyantları ayrı satır.

**6. `data/parts/gpu.csv` silindi.** Tek satırı (`nvidia-rtx-5090`) yeni
dosyada ve daha eksiksiz; aynı slug'ın iki kaynak dosyada durması, "hangisi
doğru" sorusunu üretirdi.

---

## Hangi kararlar verildi ve neden

| # | Karar | Kim |
|---|---|---|
| K51 | Üç ölçekleme alanı, opsiyonel | Proje sahibi |
| K52 | `length_mm` opsiyonel + arayüz uyarısı | Proje sahibi |
| K53 | Aile sayfaları geçerli kaynak | Proje sahibi |
| K54 | Aynı slug güncellenir, kaynak sırası korunur (S20) | Proje sahibi |
| K55 | Ölçekleme modeli bant genişliğine bağlı olmayacak | Proje sahibi |

**Kaynak sıralamasında bir varsayım var (K54).** Proje sahibi üç değeri saydı:
`manufacturer` > `manual` > `dev-seed`. Kalan üçü (`affiliate`, `import`,
`user`) aradaki boşluklara yerleştirildi. Pratikte belirleyici olan yalnızca
sıranın en üstü, çünkü içe aktarma yalnızca `manufacturer` yazıyor.

**Motor "veri eksik" bulgusu üretmiyor (K52).** Bulgular `SCHEMA.md` bölüm
7'deki kurallardır; "veri eksik" bir kural ihlali değildir. Motora W6 gibi bir
kural eklemek şemada olmayan bir kuralı koda sokmak olurdu. Uyarı arayüzde.

**Seed korumasını kendim ekledim.** Karar metninde yoktu ama aynı mantığın
sonucu: içe aktarma gerçek veriyi koruyorken seed script'inin onu ezmesi
tutarsız olurdu. `npm run db:seed` bu adımdan sonra 31 gerçek parçayı sessizce
dev-seed'e çevirebilecek durumdaydı.

---

## Veri: 30 satır, kaç alan boş kaldı

| Alan | Dolu | Boş | Not |
|---|---|---|---|
| `chipset`, `vram_gb`, `vram_type`, `tdp_watt`, `recommended_psu_watt`, `pcie_version` | 30 | 0 | Zorunlu alanların tamamı dolu |
| `shader_units` | 30 | 0 | Her sayfada var |
| `boost_clock_mhz` | 30 | 0 | Her sayfada var |
| `length_mm` | 17 | **13** | Founders Edition üretilmeyen modeller |
| `memory_bandwidth_gbs` | 3 | **27** | Yalnızca 50 serisinin bir kısmında var |
| `release_year` | 0 | **30** | NVIDIA ürün sayfalarında çıkış tarihi yok |

**`length_mm` boş kalanlar (13):** 5070 Ti, 5060 Ti 16GB, 5060 Ti 8GB, 5060,
5050, 4070 Ti SUPER, 4070 Ti, 4060 Ti 16GB, 4060, 3060 12GB, 3060 8GB,
3050 8GB, 3050 6GB.

**`memory_bandwidth_gbs` dolu olanlar (3):** 5060 Ti 16GB ve 8GB (576),
5060 (480). Diğer bütün sayfalarda bu satır yok — K55'in gerekçesi bu.

**`confidence` dağılımı:** 17 satır `medium` (FE ölçüsü yazılmış),
13 satır `high` (uzunluk yok, geri kalan her şey üreticinin kendi beyanı).

---

## Hangi modellerde sorun çıktı

**1. RTX 3080 10GB — yanlış değer yakalandı ve düzeltildi.** İlk çekimde boost
clock 1.44 GHz geldi; 12GB varyantının 1.71'iyle uyuşmuyordu. Sayfaya tekrar
soruldu: 1.44 **base clock**, boost 1.71. Değer düzeltildi. Diğer 29 satırda
böyle bir tutarsızlık görülmedi.

**2. RTX 4070 — `vram_type` sayfada iki değer.** NVIDIA "12 GB GDDR6 / 12 GB
GDDR6X" yazıyor (sonradan GDDR6'lı revizyon çıktı). Karar gereği tek satır ve
`GDDR6/GDDR6X` yazıldı. Aynı durum RTX 3060 Ti'de de var (GDDR6/GDDR6X).

**3. RTX 4060 Ti 16GB — uzunluk bilinçli olarak boş bırakıldı.** Sayfanın
ortak "Length" satırı 244 mm diyor ama Founders Edition yalnızca 8GB
varyantında üretildi. 16GB'a FE ölçüsü yazmak, olmayan bir karta ait ölçüyü
o modele atfetmek olurdu. 8GB satırında 244 yazılı.

**4. RTX 4080 ailesinde PCIe satırı farklı biçimde.** Tablo "PCI Express Gen 4"
başlığı altında "Yes" diyor, sayı vermiyor. Ayrıca sorulup doğrulandı,
`PCIe 4.0` olarak normalize edildi (K50'deki "Gen 5 → PCIe 5.0" ile aynı).

**5. 30 ve 40 serisinde model bazlı sayfa yok.** Aile sayfaları kullanıldı
(K53). 50 serisinde 5090, 5080 ve 5050'nin kendi sayfası var.

---

## Ne doğrulandı

**İçe aktarma — 30 satır, 0 hata:**

```
$ npm run parca:aktar
gpu-nvidia.csv (gpu) — 30 satir
  [GUNCEL] nvidia-rtx-5090 — degisen: release_year, source, source_url, confidence,
           collected_at, chipset, length_mm, pcie_version, shader_units, boost_clock_mhz
  [YENI  ] nvidia-rtx-5080
  ...
OZET: 27 yeni, 4 guncellendi, 0 atlandi (dusuk guvenilirlik), 0 hata.
raw_imports: 33 satir. manufacturer kaynakli parca: 31.
```

Üç dev-seed kart (5090, 5070, 5060) gerçek veriyle **güncellendi** ve hangi
alanların değiştiği satır satır yazıldı — S20 kararının çalıştığının kanıtı.

**Seed koruması — ters yön de ölçüldü:**

```
$ npm run db:seed
  [ATLA] nvidia-rtx-5060 — gercek veri var (source='manufacturer')
  [ATLA] nvidia-rtx-5070 — gercek veri var (source='manufacturer')
  [ATLA] nvidia-rtx-5090 — gercek veri var (source='manufacturer')
Toplam 57 parça, 26 tanesi dev-seed.
```

Sahte veri gerçek verinin üzerine yazmadı.

**Arayüz uyarısı — tarayıcıda görüldü:**

```
Ekran kartı = RTX 3060 12GB (uzunluk bilinmiyor), kasa = NR200P:
  "Uyumluluk
   Ekran kartının uzunluğu bilinmiyor, kasa uyumluluğu kontrol edilemedi.
   Kartın fiziksel ölçüsünü üreticinin sayfasından teyit et.
   Sorun bulunamadı."

Ekran kartı = RTX 5090 (304 mm) seçilince:
  "Uyumluluk
   Sorun bulunamadı."
```

Uyarı yalnızca uzunluk bilinmediğinde çıkıyor.

**Diğer:**

```
$ npm test               107 passed (107)   (+2: K52 davranışı)
$ npm run sema:kontrol   SONUC: 70 kontrolun tamami gecti.
$ npx tsc --noEmit       (çıktı yok)
$ npm run lint           (çıktı yok)
$ npm run build          ✓ Compiled successfully
```

---

## Açık kalan sorular

**S20 kapandı.** S18, S16, S15 değişmedi.

**Yeni bir şey açılmadı**, ama iki not:

1. **`release_year` hiçbir NVIDIA satırında yok.** Alan opsiyonel, sorun
   çıkarmıyor; ama kataloğu yıla göre sıralamak ileride istenirse bu veri
   üreticinin ürün sayfasında bulunmuyor, başka kaynak gerekir.

2. **Canlıda hâlâ 0 parça.** Bu veri geliştirme veritabanına yazıldı. Canlıya
   gitmesi için içe aktarmanın canlı `DATABASE_URL` ile çalıştırılması gerekiyor —
   ayrı bir adım ve ayrı bir karar.

Güncel liste: `SORULAR.md`
