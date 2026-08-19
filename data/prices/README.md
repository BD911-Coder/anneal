# Fiyat verisi — elle girilen CSV dosyaları

Bu klasördeki CSV'ler **kaynak veridir**. `price_snapshots` bunlardan türetilir.
Depoda durmalarının sebebi `data/parts/` ile aynı: her değişiklik commit'te
görünsün, "bu fiyat ne zaman ve nereden okundu" sorusu git geçmişinden
cevaplanabilsin.

İçe aktarma: `npm run fiyat:aktar`

---

## Kurallar

**Her satır tek bir perakendeci ürün sayfasından gelir.** `source_url` o
sayfanın adresidir ve fiyat orada yazılı olmalıdır.

**`price_snapshots` append-only** (`SCHEMA.md` bölüm 0 kural 2). Fiyat
güncellenmez; yeni bir gözlem yeni bir satırdır. Aynı parça + aynı
`collected_at` ikinci kez gelirse içe aktarma **atlar**, üzerine yazmaz.

**Fiyat bulunamayan parça atlanır.** Satır hiç yazılmaz. Uydurma fiyat, yanlış
"bu sistem şu kadar" demektir.

**Fiyat integer, kuruş cinsinden** (`SCHEMA.md` bölüm 0 kural 1). CSV'de dolar
yazılır (`479.00`), içe aktarıcı 100 ile çarpar. Float asla veritabanına
girmez.

**Para birimi USD.** Marka hedefi global; TRY'ye çevirmek kur tarihi taşımayan
ikinci bir varsayım eklerdi.

---

## Sütunlar

| Alan | Not |
|---|---|
| `part_id` | Katalogdaki slug. Yoksa satır reddedilir. |
| `retailer` | Fiyatın okunduğu mağaza — `Newegg` |
| `seller` | Sayfadaki satıcı. `Newegg` ise mağazanın kendisi; başka bir ad pazaryeri satıcısıdır. |
| `price_usd` | Sayfada yazan fiyat, dolar |
| `in_stock` | `true` / `false` / boş (bilinmiyor) |
| `product_url` | Ürün sayfası — `source_url` da bu olur |
| `confidence` | Aşağıya bak |
| `collected_at` | Fiyatın **okunduğu** gün |

### `confidence` ne zaman düşürülür

| Durum | Değer |
|---|---|
| Mağazanın kendi sattığı ürün, satır tam o parça | `high` |
| Pazaryeri satıcısı (`seller` ≠ `Newegg`) | `medium` |
| **GPU çipi satırı** — fiyat o çipin bir kartından okundu | `medium` |

**Çip satırlarının fiyatı neden `medium`:** `gpu_specs` satırı üreticinin
referans tasarımıdır, mağazada öyle bir ürün yoktur (K86). Çipin fiyatı, o
çipin **bulunabilen en ucuz, stokta ve mağazanın kendi sattığı** kartından
okunur. Bu bir yaklaşıklıktır: aynı çipin premium kartı belirgin şekilde
pahalıdır. Kullanıcı kart seçerse o kartın kendi fiyatı kullanılır.
