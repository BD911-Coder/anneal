# 2026-08-22 — Alan bazında kaynak defteri, ve ilk gerçek dış aktarım

## Sorun

Spec tablolarında `source`/`source_url`/`confidence` **satır başına**. Wikipedia
ayrıştırıcısı (K168) çalışır hale gelince bu yetmez oldu: bir `gpu_specs`
satırının bant genişliği Wikipedia'dan, diğer on üç alanı üreticiden geliyor.
Satırın tamamını `manufacturer` damgalamak yalan, `wikipedia` damgalamak on üç
alanı birden yalan yapıyor.

## Ne yapıldı

### 1. `spec_field_sources` — yan tablo (K170)

`(part_id, field_name)` birincil anahtar. Alanlar: `source`, `source_url`,
`confidence`, `collected_at`, `license`, `source_article`, `source_revision_id`.

**Neden yan tablo, 30 paralel sütun değil:** sütun yolu her spec tablosuna alan
sayısı kadar üçlü ekler — `gpu_specs`te 14 alan × 3 = **42 yeni sütun** — her
yeni alanda migration ister ve "hangi alanlar Wikipedia'dan geldi" sorusunu 42
sütun taranarak cevaplatır. Yan tabloda aynı soru tek satırlık bir `WHERE`.

**Bedeli iki tane ve ikisi de yazılı:** okurken ikinci bir sorgu, ve
`field_name`'in metin olması (veritabanı "böyle bir alan var mı" diye soramıyor).
İkincisinin karşılığı `npm run kaynak:kontrol`.

**Satır damgası kaldırılmadı**, anlamı değişti: defterde satırı olmayan alanların
varsayılanı. Geçiş bütün dolu alanları yazdığı için bugün varsayılana düşen alan
yok.

### 2. Geçiş — damga değişmedi, seviye indi

Migration'ın geri doldurma adımı sütun listesini **elle yazmıyor**,
`information_schema`'dan okuyor: elle yazılan liste eksik kalır ve eksikliği
ancak birisi fark edince anlaşılır.

```
toplam alan damgasi: 2457
  manufacturer 2457
nvidia-rtx-4090: chipset=manufacturer, vram_gb=manufacturer, … (12 alan)
```

### 3. `npm run kaynak:kontrol` — dört soru

1. Defterdeki her `field_name` gerçekten o tabloda var mı?
2. Dolu olan her spec alanının damgası var mı?
3. Lisanslı kaynaktan gelen her satır makale + revizyon + lisans taşıyor mu?
4. Dış kaynaklı alanlar hangileri? (liste)

### 4. Gerçek aktarım — `npm run wikipedia:aktar -- --apply`

**Öncelik kuralı iki yerde zorlanıyor:** script karar verirken, ve
`UPDATE gpu_specs SET <alan> = $1 WHERE part_id = $2 AND <alan> IS NULL`.
İkincisi olmasaydı kural script'in doğruluğuna bağlı kalırdı.

```
Doldurulacak bos alan : 50
Dokunulmayacak alan   : 96 (uretici degeri var)
raw_imports satiri    : 18 (makale basina bir)
YAZILAN alan          : 50
```

**Yazılan 50 alan:** 22 `memory_bandwidth_gbs` + 28 `transistor_count_m`.

| parça | alan | değer |
|---|---|---|
| `nvidia-rtx-4090` | `memory_bandwidth_gbs` | 1008 |
| `nvidia-rtx-4080-super` | `memory_bandwidth_gbs` | 736.3 |
| `nvidia-rtx-4080` | `memory_bandwidth_gbs` | 716.8 |
| `nvidia-rtx-4070-ti-super` | `memory_bandwidth_gbs` | 672.3 |
| `nvidia-rtx-4070-ti` · `-4070` · `-4070-super` | `memory_bandwidth_gbs` | 504.2 |
| `nvidia-rtx-4060-ti-8gb` · `-16gb` | `memory_bandwidth_gbs` | 288 |
| `nvidia-rtx-4060` | `memory_bandwidth_gbs` | 272 |
| `nvidia-rtx-3090-ti` · `-3090` | `memory_bandwidth_gbs` | 1008.3 · 936.2 |
| `nvidia-rtx-3080-ti` · `-3080-12gb` · `-3080-10gb` | `memory_bandwidth_gbs` | 912.4 · 912.4 · 760.3 |
| `nvidia-rtx-3070-ti` · `-3070` · `-3060-ti` | `memory_bandwidth_gbs` | 608.3 · 448 · 448 |
| `nvidia-rtx-3060-12gb` · `-3060-8gb` | `memory_bandwidth_gbs` | 336 · 224 |
| `nvidia-rtx-3050-8gb` · `-3050-6gb` | `memory_bandwidth_gbs` | 224 · 168 |
| NVIDIA 50 serisi (5) + 40 serisi (6) + 30 serisi (6) | `transistor_count_m` | 8700 … 92200 |
| Intel Arc (5) | `transistor_count_m` | 7200 … 21700 |

**Kapsam — veritabanından yeniden okundu:**

| alan | önce | sonra |
|---|---|---|
| `memory_bandwidth_gbs` | 38/60 | **60/60** |
| `bus_width_bits` | 60/60 | 60/60 |
| `tdp_watt` | 60/60 | 60/60 |
| `transistor_count_m` | 23/60 | **51/60** |

Alan damgaları: `manufacturer` 2457, `wikipedia` 50.

### 5. Atıf — alanı takip ediyor, satırı değil

Bant genişliği "Seçilen sistem" listesinde gösteriliyor. Kredi **yalnızca**
gösterilen değer Wikipedia'dan geldiğinde çıkıyor.

Bu gösterim bilerek eklendi: gösterilmeyen bir değerin atıf kuralı sınanamaz.
Gösterilen alanların listesi tek yerde — `data/spec-sources.ts` içindeki
`DISPLAYED_GPU_FIELDS`.

### 6. `varyant:kontrol` uyarlandı

"Çip satırları kaynak CSV ile birebir aynı" kontrolü, dış kaynaklı alanları
**defterden okuyup** atlıyor — alan alan, satır satır değil. CSV artık
`gpu_specs`in tek kaynağı değil. Atlanan alan sayısı çıktıda yazıyor.

## Ne doğrulandı

**Tarayıcıda, canlı sayfada** (İngilizce arayüz):

```
RTX 4090 secili   Graphics card: NVIDIA GeForce RTX 4090 · memory bandwidth
                  1,008 GB/s (external source)
                  Memory bandwidth comes from Wikipedia: "List of Nvidia
                  graphics processing units", revision 1369488585 — CC BY-SA 4.0.
RX 9070 XT secili Graphics card: AMD Radeon RX 9070 XT · memory bandwidth
                  640 GB/s        <- kredi YOK (uretici degeri)
```

**Komutlar:**

```
npm run lint            0 hata
npx tsc --noEmit        0 hata
npm test                171/171 (motor testleri degismedi)
npm run sema:kontrol    90/90 (yeni tablo ve indeks belgelendi)
npm run kaynak:kontrol  6210/6210
npm run kural:kontrol   11/11
npm run varyant:kontrol 20/20
npm run dil:kontrol     184+ anahtar, iki dil tam
npm run build           hatasiz
```

`lib/perf-margin.ts`, `lib/fps-margin.ts` ve `benchmark_points` **değişmedi**.
K71 korunuyor: `perf_index`e tek satır yazılmadı.

## Açık kalan sorular

- **Dev sunucu Prisma istemcisini yenilemiyor.** Migration'dan sonra sayfa
  "column does not exist" verdi; sebep şema değil, ayakta duran sunucunun eski
  istemciyi tutması. Yeniden başlatınca geçti. CLAUDE.md'deki Prisma notunun
  bir kardeşi — migration sonrası dev sunucu da yeniden başlatılmalı.
- **Diğer spec tabloları için dış kaynak yok.** Defter bütün spec tablolarını
  kapsıyor ama bugün yalnızca `gpu_specs` alanlarında dış kaynak var.
- **Gösterilen tek alan bant genişliği.** Transistör sayısı 51 çipte dolu ama
  hiçbir yerde gösterilmiyor; gösterilirse `DISPLAYED_GPU_FIELDS`e girmesi ve
  atfının da çıkması gerekir.
