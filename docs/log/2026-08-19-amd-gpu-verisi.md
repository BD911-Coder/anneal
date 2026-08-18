# 2026-08-19 — AMD Radeon RX 6000/7000/9000 GPU verisi

> **Düzeltme (2026-08-19, aynı gün):** `release_year` sayısı 12 yazılmıştı,
> doğrusu **15**. CSV'den sayarken yanlış saymışım; dosyanın kendisi doğruydu,
> yalnızca bu rapordaki sayı yanlıştı. Aşağıda üstü çizili olarak düzeltildi.

> **Veri toplandı, içe aktarılamadı.** 23 satırın tamamı zorunlu alan
> eksikliğinden reddediliyor. Sebep bir veri kalitesi sorunu değil: AMD ürün
> sayfaları `pcie_version` alanını hiç yayınlamıyor. Karar bekliyor (S21).

---

## Ne yapıldı

`data/parts/gpu-amd.csv` — **23 satır**. RX 6400'den RX 9070 XT'ye masaüstü
modeller, kaynak amd.com ürün sayfaları, `source='manufacturer'`.

| Seri | Satır | Modeller |
|---|---|---|
| RX 9000 | 4 | 9070 XT, 9070, 9070 GRE, 9060 XT |
| RX 7000 | 7 | 7900 XTX, 7900 XT, 7900 GRE, 7800 XT, 7700 XT, 7600 XT, 7600 |
| RX 6000 | 12 | 6950 XT, 6900 XT, 6800 XT, 6800, 6750 XT, 6700 XT, 6700, 6650 XT, 6600 XT, 6600, 6500 XT, 6400 |

---

## Araç notu: WebFetch amd.com'a yine bağlanamadı

`ECONNRESET` — 2026-08-19 tarihli önceki raporda da aynı sorun vardı.
Sayfalar `curl` ile çekildi ve HTML'deki `<dt>etiket</dt><dd>değer</dd>`
çiftlerinden ayrıştırıldı. Aynı işi yapıyor, sadece araç farklı.

**Adres deseni seriler arasında tutarsız:** `amd-radeon-rx-9070xt.html` ama
`amd-radeon-rx-7900-gre.html`, `amd-radeon-rx-6950-xt.html`. İki varyantı da
deneyen bir indirici yazıldı.

**9000 serisinin ürün sayfası ile spec sayfası ayrı.**
`amd-radeon-rx-9070-xt.html` (tireli) pazarlama sayfası, spec içermiyor;
spec `amd-radeon-rx-9070xt.html` (tiresiz) adresinde.

---

## Hangi alanlar boş kaldı

| Alan | Dolu | Boş | Sebep |
|---|---|---|---|
| `chipset`, `vram_gb`, `vram_type`, `tdp_watt` | 23 | 0 | Her sayfada var |
| `shader_units` | 23 | 0 | "Stream Processors" |
| `boost_clock_mhz` | 23 | 0 | "Boost Frequency" |
| `memory_bandwidth_gbs` | 23 | 0 | **AMD hepsinde veriyor** |
| `release_year` | ~~12~~ **15** | ~~11~~ **8** | "Launch Date" eski sayfalarda var, yenilerde yok |
| `recommended_psu_watt` | 22 | 1 | 7900 GRE'nin eski şablonunda yok |
| `length_mm` | 0 | **23** | AMD kart ölçüsü yayınlamıyor |
| `pcie_version` | 0 | **23** | AMD sayfalarında "PCI Express" hiç geçmiyor |

**NVIDIA ile karşılaştırma — iki taraf farklı şeyleri yayınlıyor:**

| Alan | NVIDIA 30 satır | AMD 23 satır |
|---|---|---|
| `memory_bandwidth_gbs` | 3 dolu | **23 dolu** |
| `release_year` | 0 dolu | **15 dolu** |
| `length_mm` | 17 dolu | 0 dolu |
| `pcie_version` | 30 dolu | **0 dolu** |

AMD, K55'te "bulunmuyor" denen bant genişliğini her kartta veriyor. NVIDIA'nın
vermediği çıkış tarihini de 15 kartta veriyor. Buna karşılık NVIDIA'nın verdiği
PCIe sürümünü ve kart uzunluğunu hiç vermiyor.

---

## Tutarlılık kontrolü

NVIDIA'da RTX 3080 10GB'da yakalanan hata türü (base clock'un boost diye
okunması) burada arandı. Yöntem: **bant genişliği bağımsız olarak
doğrulanabiliyor** — arayüz genişliği × bellek hızı ÷ 8 sonucu vermeli.

```
9070 XT   256-bit × 20 Gbps = 640 GB/s   sayfa: 640   ✓
9070 GRE  192-bit × 18 Gbps = 432 GB/s   sayfa: 432   ✓
7900 XTX  384-bit × 20 Gbps = 960 GB/s   sayfa: 960   ✓
7800 XT   256-bit × 19.5    = 624 GB/s   sayfa: 624   ✓
6700 XT   192-bit × 16      = 384 GB/s   sayfa: 384   ✓
6400       64-bit × 16      = 128 GB/s   sayfa: 128   ✓
```

23 satırın tamamında tutuyor. Bu, bellek üçlüsünün (boyut, arayüz, hız) doğru
sütundan okunduğunu bağımsız olarak gösteriyor.

**İki değer şüpheli göründü, ikisi de sayfaya tekrar soruldu:**

1. **RX 9070 GRE boost 2790 MHz**, RX 9070'in 2520'sinden yüksek — üstelik daha
   az compute unit ile (48'e karşı 56). Ayrıştırma hatası olabilirdi. Sayfaya
   tekrar bakıldı: game frequency de yüksek (2220'ye karşı 2070). Yani sayfanın
   kendi değeri, tutarlı. Olduğu gibi yazıldı.

2. **RX 6500 XT "Max Memory Size = 8 GB"**, oysa yaygın kart 4 GB. Sayfa
   gerçekten 8 GB diyor — alan adı "Max" olduğu için en büyük varyantı
   gösteriyor. Aşağıda not var.

---

## Hangi modellerde sorun çıktı

**1. RX 7650 GRE — AMD'de ürün sayfası yok.** Denenen adreslerin hepsi 404;
arama yalnızca sürücü indirme sayfasını buluyor, o da spec içermiyor.
**Satır yazılmadı.** Kapsamda istenmişti ama uydurmaktansa eksik bırakıldı.

**2. `Max Memory Size` alan adı iki modelde varyantı gizliyor.** AMD tek sayfada
en büyük bellek seçeneğini yazıyor:
- **RX 6500 XT** — 4 GB ve 8 GB satıldı, sayfa 8 GB diyor
- **RX 9060 XT** — 8 GB ve 16 GB satılıyor, sayfa 16 GB diyor

NVIDIA'da bu varyantlar ayrı satır yapılmıştı (5060 Ti 8/16 gibi), çünkü NVIDIA
her varyantı ayrı specliyor. AMD'de ayrı veri yok; ayrı satır açmak, olmayan
bir sayfadan veri uydurmak olurdu. **Tek satır yazıldı, büyük varyantla.**

**3. RX 6700'de bellek hızı iki değerli:** "Up to 16 Gbps / Up to 14 Gbps".
Bant genişliği tek değer (320 GB/s) ve 160-bit × 16 ile tutuyor, o yazıldı.

**4. RX 7900 GRE eski şablonda** — `Minimum PSU Recommendation` yok, 7000
serisinin diğer altı kartında var.

---

## Ne doğrulandı

**İçe aktarma denendi, 23 satırın 23'ü reddedildi:**

```
$ npm run parca:aktar
gpu-amd.csv (gpu) — 23 satir
  [HATA ] amd-rx-9070-xt — zorunlu alan bos: pcie_version
  [HATA ] amd-rx-7900-gre — zorunlu alan bos: recommended_psu_watt, pcie_version
  ...
```

Reddedilme sebebi veri kalitesi değil: CSV doğru ayrıştırıldı, bütün değerler
yerinde. Eksik olan iki alanı AMD yayınlamıyor.

**Bu iki alanı hiçbir yer kullanmıyor:**

```
$ grep -rn "pcie_version\|recommended_psu_watt" engine/ data/to-engine.ts app/
  (çıktı yok)
```

On bir uyumluluk kuralının hiçbiri bu alanlara bakmıyor. C4 gerekli gücü
TDP'lerden hesaplıyor, `recommended_psu_watt`'ı kullanmıyor. `EngineGpu`
tipinde ikisi de yok. Arayüzde de gösterilmiyorlar.

**Diğer:**

```
$ npm test               107 passed (107)
$ npm run sema:kontrol   SONUC: 70 kontrolun tamami gecti.
$ npx tsc --noEmit       (çıktı yok)
$ npm run lint           (çıktı yok)
$ npm run build          ✓ Compiled successfully
```

Şemaya ve koda dokunulmadı; bu iş biriminde yalnızca veri toplandı.

---

## Açık kalan sorular

**S21 (yeni, engelleyici)** — `pcie_version` ve `recommended_psu_watt`
zorunluluğu 23 AMD kartını dışarıda bırakıyor. Önerim ikisini de opsiyonel
yapmak; gerekçe K52 ile aynı ve burada daha güçlü, çünkü bu iki alanı hiçbir
kural kullanmıyor. `SCHEMA.md` değişikliği olduğu için kendi başıma yapmadım.

**S18, S16, S15** değişmedi.

Güncel liste: `SORULAR.md`
