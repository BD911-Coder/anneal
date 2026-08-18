# 2026-08-19 — Araç notları CLAUDE.md'ye eklendi, GPU toplamı

---

## Ne yapıldı

**`CLAUDE.md`'ye "Araç notları" bölümü eklendi.** İki başlık:

1. **Üretici sitelerinden sayfa okuma** — hangi site hangi araçla okunuyor,
   `curl` için gereken `User-Agent` başlığı, sayfa yapısı tuzakları, adres
   deseni tutarsızlıkları.
2. **Spec verisinde çapraz kontrol** — bant genişliği = arayüz × hız ÷ 8.

**Intel Arc verisi bu iş biriminde toplanmadı** — bir önceki iş biriminde
tamamlanmış ve commit `9cf45db` ile push edilmişti. Tekrar istendiği için
durum doğrulandı, veri yeniden çekilmedi.

---

## Hangi kararlar verildi ve neden

**Veri toplama tekrarlanmadı.** `data/parts/gpu-intel.csv` 7 satırla yerinde,
içe aktarılmış, veritabanında NVIDIA 30 + AMD 23 + Intel 7 = 60 gerçek GPU var.
Aynı sayfaları tekrar çekmek üretici sitelerine gereksiz istek atmak ve
`collected_at` tarihini sebepsiz değiştirmek olurdu.

**Araç notu `CLAUDE.md`'ye yazıldı, `docs/KARARLAR.md`'ye değil.** Bu bir karar
değil, operasyonel bilgi — "şu site şu araçla okunuyor". `KARARLAR.md` neden
öyle seçildiğini anlatan kalıcı kararlar için.

---

## GPU toplamı — üç dosya

**60 GPU**, hepsi veritabanında `source='manufacturer'` ile.

| Alan | NVIDIA (30) | AMD (23) | Intel (7) | Toplam (60) |
|---|---|---|---|---|
| `chipset` | 30 | 23 | 7 | **60** |
| `vram_gb` | 30 | 23 | 7 | **60** |
| `vram_type` | 30 | 23 | 7 | **60** |
| `tdp_watt` | 30 | 23 | 7 | **60** |
| `boost_clock_mhz` | 30 | 23 | 7 | **60** |
| `recommended_psu_watt` | 30 | 22 | 1 | 53 |
| `shader_units` | 30 | 23 | 0 | 53 |
| `pcie_version` | 30 | **0** | 7 | 37 |
| `memory_bandwidth_gbs` | 3 | 23 | 7 | 33 |
| `release_year` | **0** | 15 | 7 | 22 |
| `length_mm` | 17 | **0** | 1 | **18** |

**confidence:** 18 satır `medium` (referans kart ölçüsü yazılan satırlar),
42 satır `high`.

---

## Eksik kalan modeller

| Model | Sebep |
|---|---|
| **RX 7650 GRE** | AMD'de ürün sayfası yok. Denenen adreslerin hepsi 404; arama yalnızca sürücü indirme sayfasını buluyor, o da spec içermiyor. Kapsamda istenmişti, uydurmamak için boş bırakıldı. |
| **RX 6500 XT 4GB** | AMD tek sayfada "Max Memory Size = 8 GB" yazıyor, küçük varyantı ayrı speclemiyor. Ayrı satır açmak olmayan bir sayfadan veri uydurmak olurdu. Tek satır, 8 GB ile. |
| **RX 9060 XT 8GB** | Aynı sebep. Tek satır, 16 GB ile. |

NVIDIA ve Intel tarafında kapsam dışı kalan model yok. NVIDIA'da VRAM
varyantları ayrı satır yapılabildi (3080 10/12, 4060 Ti 8/16, 5060 Ti 8/16,
3060 12/8, 3050 8/6), çünkü NVIDIA her varyantı ayrı specliyor. Intel'de
A770 8GB ve 16GB ayrı SKU sayfası olduğu için ayrı satır oldu.

---

## Ne doğrulandı

```
$ wc -l data/parts/gpu-intel.csv     8 (başlık + 7 satır)
$ git log --oneline -1 -- data/parts/gpu-intel.csv
  9cf45db Intel Arc GPU verisi (7 satır) — GPU tarafı kapandı

veritabanı, category='gpu' ve source='manufacturer':
  NVIDIA: 30    AMD: 23    Intel: 7    toplam: 60
```

```
$ npm test               107 passed (107)
$ npm run sema:kontrol   SONUC: 70 kontrolun tamami gecti.
$ npx tsc --noEmit       (çıktı yok)
$ npm run lint           (çıktı yok)
$ npm run build          ✓ Compiled successfully
```

Bu iş biriminde koda, şemaya ve veriye dokunulmadı; yalnızca `CLAUDE.md`
büyüdü.

---

## Açık kalan sorular

S23, S22, S18, S16, S15 — değişmedi.

Güncel liste: `SORULAR.md`
