# 2026-08-22 — Wikipedia wikitext ayrıştırıcı (kuru çalışma, YAZMA YOK)

## Ne yapıldı

`scripts/import-wikipedia-specs.mts` yazıldı. MediaWiki API üzerinden üç
makalenin wikitext'i alınıp tabloları ayrıştırılıyor, katalogla eşleştiriliyor
ve **hiçbir şey yazılmadan** rapor üretiliyor.

```
npm run wikipedia:deneme                 rapor
npm run wikipedia:deneme -- --ayrinti    ayristirilamayan satirlarin tamami
npm run wikipedia:deneme -- --tablo-dok  kabul edilen tablolarin sutun eslemesi
npm run wikipedia:deneme -- --makale=... tek makale
```

Gerekçe K165'ten geliyor: Wikidata'da aradığımız spec alanları **yok** (0-%2
doluluk), Wikipedia tablolarında **var**. Bu tur o tabloları okunur hale
getirdi.

`scripts/wiki-common.mts` ayrıldı: `User-Agent`, hız sınırı, `normalizeModel`,
`crossCheck` iki script'in ortak parçası. Script'ten script'e `import` etmek
diğerinin bütün raporunu çalıştırırdı.

## Ayrıştırma — ne çözüldü

| Sorun | Çözüm |
|---|---|
| `rowspan` / `colspan` | Izgara açılıyor; taşıma aşağı ve sağa |
| İki-üç katmanlı başlık | Sütun etiketi katmanların birleşimi (`memory configuration bandwidth (gb/s)`) |
| Sütun sırası nesilden nesile değişiyor | Eşleme indekse değil **başlık metnine** bakıyor |
| Birim eki | Çarpan **başlıktan** okunuyor: `transistors (billion)` → ×1000. Birim yazmıyorsa sütun **kullanılmıyor** |
| Dipnot, `<ref>`, `{{efn}}`, `{{n/a}}` | Şablon çözücü derinlik takipli; tanınmayan şablon düşer |
| `{{tooltip\|görünen\|açıklama}}` | Görünen değer korunur |
| Bozuk yazım (`colspan="2'`) | `["']?` ile tolere ediliyor — gerçek bir satırda vardı (RTX 4090) |
| `GeForce RTX<br>4090` | Satır kaydırma; birleştiriliyor |
| `RTX 4070<br>RTX 4070 Super` | İki ad; satır **reddediliyor** |
| `Radeon RX 9070 XT<br>(Navi 48)` | Parantezli parça çip kodu, düşürülüyor; `(12 GB)` korunuyor |
| AMD RX 7000/9000 ve Intel Arc tabloları makalede yok | Şablon sayfaları ayrıca çekiliyor, **kendi revizyonlarıyla** |
| Dizüstü tablosunda aynı model adı | Bölüm süzgeci: yalnızca "Desktop" |

## Kararlar

**K168 — Ayrıştırma kuralları ve sessiz atlamama.** Ayrıntısı `docs/KARARLAR.md`.
Özeti: belirsiz hücre tahmin edilmez, satır gerekçesiyle rapora girer;
çözüm **alan başına** yapılır (bir alandaki çelişki diğer alanları düşürmez);
üretici değeri asla ezilmez.

## Ne doğrulandı

```
npm run lint            0 hata
npx tsc --noEmit        0 hata
npm test                171/171 (motor testleri degismedi)
npm run wikipedia:deneme
```

### Ayrıştırma başarı oranı — makale başına

| Makale | Revizyon | Tablo (masaüstü) | Satır |
|---|---|---|---|
| List of Nvidia GPUs | 1369488585 | 90 (25) | **504 / 517 — %97,5** |
| List of AMD GPUs | 1364362273 | 57 (33) + 13 şablon | **278 / 288 — %96,5** |
| List of Intel GPUs | 1368155295 | 18 (2) + 2 şablon | **8 / 8 — %100** |

Toplam **790 satır** okundu, **120 satır** gerekçesiyle kaydedildi.
Gerekçe dağılımı: `bus_width` 40, `bant genişliği` 36, `model adında numara
yok` 21, `transistör` 17, `TDP` 6. Hepsi gerçek belirsizlik:

- `"System shared 64/128"` — tümleşik GPU'lar, tek sayı yok
- `"2x 128"` — çift çipli kartlar
- `"Riva TNT"` — numarasız eski model

### Katalogla eşleşme

**60 / 60 çip eşleşti.** Dört yol sırayla deneniyor: tam ad → bellek eki
düşürülmüş ad → kademe öneki (`Arc 7 A770` ↔ `Arc A770`) → ikisi birden.

Bellek eki düşürme **kalıpla iki kez yanlış kesti** (`rtx30508gb` → `rtx` ve
sonra `rtx305`); doğrusu parçanın kendi `vram_gb` değerinden kesmek.

### Alan kapsamı — dış kaynak ne kazandırıyor

| alan | bugün dolu | wiki'de var | **yeni dolacak** | çelişme |
|---|---|---|---|---|
| `memory_bandwidth_gbs` | 38/60 | 60 | **22** | 3 |
| `bus_width_bits` | 60/60 | 30 | 0 | 0 |
| `tdp_watt` | 60/60 | 28 | 0 | 0 |
| `transistor_count_m` | 23/60 | 28 | **28** | 0 |

**Öncelik karşılandı:** NVIDIA'nın yayınlamadığı üç değer de kaynakta var.

```
nvidia-rtx-4060   bugun: BOS   wikipedia: 272     rev 1369488585
nvidia-rtx-4070   bugun: BOS   wikipedia: 504.2   rev 1369488585
nvidia-rtx-4090   bugun: BOS   wikipedia: 1008    rev 1369488585
```

Bant genişliği boş olan **22 çipin 22'si** dolabilir durumda.

### ÇELİŞKİ LİSTESİ — üzerine yazılmadı

| parça | alan | üretici | wikipedia | fark |
|---|---|---|---|---|
| `nvidia-rtx-5060-ti-16gb` | `memory_bandwidth_gbs` | 576 | 448 | **%22,2** |
| `nvidia-rtx-5060-ti-8gb` | `memory_bandwidth_gbs` | 576 | 448 | **%22,2** |
| `nvidia-rtx-5060` | `memory_bandwidth_gbs` | 480 | 448 | %6,7 |

**Bağımsız üçüncü sayı hangi tarafın yanlış olduğunu söylüyor.** CLAUDE.md'deki
çapraz kontrol (`bant genişliği = veri yolu × bellek hızı ÷ 8`) tersine
çevrildi: veri yolu bizde dolu, yani her bant genişliği bir **örtük bellek
hızı** veriyor.

```
nvidia-rtx-5060-ti   128 bit   bizim 576 -> 36 Gbps (MAKUL DEGIL)   wiki 448 -> 28 Gbps
```

36 Gbps diye bir bellek yok; GDDR7'nin bu karttaki hızı 28. **Bizim değerimiz
yanlış, Wikipedia'nınki doğru.** RTX 5060'ta da (480 → 30 Gbps) aynı yönde
şüphe var ama tek başına kanıtlamıyor.

Yine de **hiçbiri düzeltilmedi**: uzlaştırma kuralı dış kaynağın üreticiyi
ezmesini yasaklıyor ve bu kural bir çelişki bulunduğu için gevşetilmez.
Düzeltme, üretici sayfasına tekrar bakılarak ayrı bir iş olarak yapılır.

### Şemada karşılığı olmayan alanlar

`die_size_mm2` (28 değer), `fillrate_pixel_gps` (28), `fillrate_texture_gts`
(28) okunuyor ama **yazılacak sütun yok**. Sütun açmak `SCHEMA.md`
değişikliğidir ve hangi kuralın kullanacağı cevaplanmadan açılmaz (K56).

## Açık kalan sorular

- **S48 — dış değer nereye yazılacak?** İki engel var ve ikisi de şema kararı:
  1. `gpu_specs` provenance'ı **satır başına** (`source`, `source_url`,
     `confidence`). Tek alanı Wikipedia'dan doldurmak satırın `manufacturer`
     damgasını yalan yapar.
  2. Çelişmeyen çapraz kontrol değerlerinin duracağı bir tablo yok.
  Bu yüzden `--apply` bayrağı yazılmadı.
- **RTX 5060 Ti bant genişliği düzeltilmeli.** Üretici sayfasından yeniden
  okunacak; bu turda dokunulmadı.
- **AMD tablolarında `TBP` sütunu birimsiz** (`tbp`), bu yüzden TDP okunmuyor.
  Kayıp yok (TDP 60/60 dolu) ama çapraz kontrol de yapılamıyor. Kural
  gevşetilirse "birim yazmıyorsa kullanma" ilkesi delinir; şimdilik böyle.
