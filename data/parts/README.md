# Parça verisi — elle girilen CSV dosyaları

Bu klasördeki CSV'ler **kaynak veridir**. Veritabanı bunlardan türetilir,
tersi değil. Depoda durmalarının sebebi: her değişiklik commit'te görünsün,
"bu sayı ne zaman ve neden değişti" sorusu git geçmişinden cevaplanabilsin.

İçe aktarma: `npm run parca:aktar`

---

## Kurallar

**Her satır tek bir üretici ürün sayfasından gelir.** `source_url` o sayfanın
adresidir ve satırdaki **bütün** değerler orada yazılı olmalıdır.

**Aile sayfaları kabul edilir** (K53). Üretici o model için ayrı bir sayfa
yayınlamıyorsa — NVIDIA 30 ve 40 serisini `rtx-4070-family` gibi ortak
sayfalarda topluyor — bu sayfa "o modelin spec sayfası" sayılır. Ölçüt:
üreticinin o model için verdiği **tek** spec sayfası olması. Genel bir ürün
listesi ya da pazarlama sayfası kabul edilmez.

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

## Sabitler ve sütunlar

| Alan | Nereden | Sebep |
|---|---|---|
| `source` | Sabit: `manufacturer` | Veri üreticinin kendi sayfasından |
| `confidence` | **CSV sütunu**, yoksa `high` | Satır bazında değişebilir — aşağı bak |
| `category` | Dosya adı, ilk tireye kadar | `gpu-nvidia.csv` -> `gpu` |

**Dosya adı deseni:** `<kategori>[-<kaynak>].csv`. Aynı kategoriyi birden fazla
kaynaktan ayrı dosyalarda tutabilmek için; `gpu.csv` ve `gpu-nvidia.csv` ikisi de
`gpu` kategorisine yazar.

**`confidence` ne zaman düşürülür:** Satırdaki bir değer üreticinin kendi
referans ürününe aitse ve piyasadaki bütün varyantlar için geçerli değilse.
Tipik örnek: `length_mm`. NVIDIA yalnızca Founders Edition ölçüsünü verir;
üçüncü parti kartlar farklı uzunlukta olur. FE ölçüsü yazılan satırda
`confidence` = `medium`.

### Aynı slug ikinci kez gelirse (S20 / K54)

İçe aktarma **günceller**, hata vermez. Tek koşul: yeni satırın kaynağı
mevcut satırınkinden daha düşük güvenilirlikte olmayacak.

Sıra: `manufacturer` > `manual` > `affiliate` > `import` > `user` > `dev-seed`

Düşükse satır atlanır ve sebebi `raw_imports.error`'a yazılır. Güncelleme
olduğunda hangi alanların değiştiği ekrana yazılır.

`collected_at` CSV'de sütun olarak durur: verinin **toplandığı** an, içe
aktarıldığı an değil (`SCHEMA.md` bölüm 1.3).

---

## Dosyalar

| Dosya | Kategori | Zorunlu spec alanları |
|---|---|---|
| `cpu.csv` | cpu | socket, cores, threads, base_clock_mhz, boost_clock_mhz, tdp_watt, memory_type, has_igpu |
| `gpu*.csv` | gpu | chipset, vram_gb, vram_type, tdp_watt, recommended_psu_watt, pcie_version |

`gpu` için opsiyonel alanlar: `length_mm` (K52), `shader_units`,
`boost_clock_mhz`, `memory_bandwidth_gbs` (K51). Bunlar boşsa satır yine
aktarılır.

Her dosyada ayrıca: `id`, `brand`, `model`, `release_year` (opsiyonel),
`collected_at`, `source_url`.
