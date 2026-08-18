# Parça verisi — elle girilen CSV dosyaları

Bu klasördeki CSV'ler **kaynak veridir**. Veritabanı bunlardan türetilir,
tersi değil. Depoda durmalarının sebebi: her değişiklik commit'te görünsün,
"bu sayı ne zaman ve neden değişti" sorusu git geçmişinden cevaplanabilsin.

İçe aktarma: `npm run parca:aktar`

---

## Kurallar

**Her satır tek bir üretici ürün sayfasından gelir.** `source_url` o sayfanın
adresidir ve satırdaki **bütün** değerler orada yazılı olmalıdır.

Sebep: `SCHEMA.md` bölüm 1.3'te `source_url` satır düzeyindedir, değer
düzeyinde değil. Bir alanı başka bir kaynaktan doldurursak satırın kaynak
adresi yalan söyler. Bu yüzden **o sayfada olmayan alan boş bırakılır.**

**Boş alan uydurulmaz.** Zorunlu bir alan boşsa o parça içe aktarılmaz ve
hata olarak raporlanır — parçayı değiştirmek gerekir.

**Slug bir kez atanır, asla değişmez** (`SCHEMA.md` bölüm 2). Küçük harf,
boşluk yerine tire, marka + model.

**Normalizasyon uydurma değildir.** Sayfada "Gen 5" yazıyorsa `PCIe 5.0`
yazmak aynı olgunun başka yazımıdır. Ama sayfada olmayan hat sayısını
(`x16`) eklemek uydurmadır — eklenmez.

---

## Sabitler

İçe aktarma script'i her satıra şunları ekler:

| Alan | Değer | Sebep |
|---|---|---|
| `source` | `manufacturer` | Veri üreticinin kendi sayfasından |
| `confidence` | `high` | Üreticinin kendi ürünü hakkındaki beyanı |
| `category` | dosya adı | `cpu.csv` -> `cpu` |

`collected_at` CSV'de sütun olarak durur: verinin **toplandığı** an, içe
aktarıldığı an değil (`SCHEMA.md` bölüm 1.3).

---

## Dosyalar

| Dosya | Kategori | Zorunlu spec alanları |
|---|---|---|
| `cpu.csv` | cpu | socket, cores, threads, base_clock_mhz, boost_clock_mhz, tdp_watt, memory_type, has_igpu |
| `gpu.csv` | gpu | chipset, vram_gb, vram_type, tdp_watt, length_mm, recommended_psu_watt, pcie_version |

Her dosyada ayrıca: `id`, `brand`, `model`, `release_year` (opsiyonel),
`collected_at`, `source_url`.
