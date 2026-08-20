# 2026-08-20 — Yol haritası ürüne göre yeniden sıralandı, A.1 planı

Kod yazılmadı. İki belge üretildi ve `benchmark_points` ölçüldü.

---

## 1. Ne yapıldı

### Sıralama düzeltildi

Proje sahibinin tespiti: altyapı işleri öne, ürünün kendisi arkaya kalmıştı.
Somut hali — "fiyat" ve "katalog derinliği" birer **faz** iken, oyun bazlı FPS
tahmini Faz 6'nın içinde tek satırlık bir madde işaretiydi:

```
- [ ] Çoklu iş yükü skorları (AI, video, üretkenlik — şema hazır, ölçüm yok)
```

Yeni yapı:

| | Faz | Ne |
|---|---|---|
| **A** | Oyun bazlı FPS tahmini | ürünün kendisi |
| **B** | Donanım önerisi | soruyu ters çevirmek |
| **C** | Ek platformlar | laptop, konsol, el konsolu |
| D | Nesiller arası tahmin | eski Faz 5 |
| E | Gelir altyapısı | eski Faz 4 |
| F | Büyüme | eski Faz 6 |

**Altyapı işleri artık alt madde.** Nereye gittikleri:

| Altyapı işi | Yeni yeri | Neden orası |
|---|---|---|
| İndeks kapsamı (eski 1.3) | **A.2** | doğrudan A.1'in hücre sayısını büyütüyor |
| Kart varyantı 58 → 150 | **A.2** | her kart çipinden miras aldığı için kapsam |
| Fiyat (eski 1.1) | **Beta kapısı** + B ön koşulu | toplam fiyat göstermeyi bloke ediyor |
| Katalog derinliği (eski 1.2) | **B** | öneri motoru dar kataloğa mahkûm |
| CPU soğutucusu (eski 3.1) | **B** | sistem kuran motor soğutucusuz sistem öneremez |
| Kullanıcı FPS gönderimi (eski 3.3) | **F** | trafik olmadan anlamsız |

**Beta ölçütü faz olmaktan çıkarıldı, kapı oldu.** CLAUDE.md'deki "10 kişi"
ölçütü aynen duruyor ama bir faz değil; A ile B arasında geçilmesi gereken bir
kapı olarak işaretlendi. Bir faz iş listesidir, bu ise bir sınavdır.

### A.1 planı çıkarıldı

`docs/faz-a1-plani.md`. Bütün sayıları geliştirme veritabanından ölçüldü.

---

## 2. Verilen kararlar

**Sıralama ilkesi belgeye yazıldı:** bir altyapı işi kendi başına faz olamaz;
hangi ürün özelliğini açtığı belliyse o fazın alt maddesidir, hiçbir özelliği
açmıyorsa yapılmaz. Bu ilke ROADMAP'in başında duruyor ki bir dahaki sefere
aynı kayma sessizce olmasın.

**Türetilen FPS hiçbir tabloya yazılmayacak** (A.1 planı 5.1). Okuma anında
hesaplanacak. Gerekçe K71'in aynısı: hesaplanmış sayı ölçüm tablosuna
yazılırsa ölçümden ayırt edilemez hale gelir. Şema değişikliği gerekmiyor.

---

## 3. Ne ölçüldü

**178 ölçüm tek bir küme değil.** İki ayrı yöntemle toplanmış, birbirine
değmeyen iki küme:

| | Satır | GPU | CPU | Ayar |
|---|---|---|---|---|
| GPU ölçümü | 64 | 14 farklı | boş | 1440p ultra, DLSS/FSR Quality |
| CPU ölçümü | 114 | **hep RTX 5090** | 12 farklı | 1080p medium, upscaling yok |

**En sert bulgu: iki kümenin oyunları sıfır kesişiyor.**

```
GPU oyunları : alan-wake-2, anno-117, assassins-creed-shadows,
               call-of-duty-black-ops-7, cyberpunk-2077,
               death-stranding-2, f1-25, hogwarts-legacy
CPU oyunları : anno-1800, avowed, baldurs-gate-3,
               cyberpunk-2077-phantom-liberty, f1-24,
               horizon-forbidden-west, marvels-spider-man-2,
               outcast-a-new-beginning, starfield
ORTAK        : SIFIR
```

Yakın görünenler bile ayrı satır: `cyberpunk-2077` ≠
`cyberpunk-2077-phantom-liberty`, `f1-24` ≠ `f1-25`. **Sonuç: A.1'in vereceği
sayı GPU-sınırlı FPS'tir, CPU'yu hesaba katamaz.** Bu, planın en çok yer ayıran
maddesi oldu ve A.2'ye somut bir iş çıkardı ("en az 3 ortak oyun").

**Kapsam:**

| | Sayı |
|---|---|
| Seçilebilir GPU (60 çip + 58 kart) | 118 |
| FPS gösterilebilen (14 çip + 46 kart) | **60 (%51)** |
| Hücre (8 oyun × 14 çip) | 112 → 64 ölçülmüş, 48 türetilebilir |

**Türetmenin hata payı ölçüldü — birini-dışarıda-bırak, 64 nokta.** Her nokta,
kendi verisi hesaba katılmadan tahmin edildi:

```
ortalama mutlak hata   %6.1
medyan                 %4.9
%90 dilim              %12.8
en kötü                %27.8
+-%10 icinde kalan     %83
+-%15 icinde kalan     %95
```

İlk hesap örneklem içindeydi (%6.6 dağılım) ve iyimserdi; dışarıda-bırak
yöntemine geçildi çünkü tahmin edilen noktanın kendisi orana katılıyorsa
ölçülen şey modelin doğruluğu değil, kendi verisini ezberlemesi olur.

**Ölçüm script'i geçiciydi ve silindi.** A.3 bunu kalıcı script'e çevirecek —
bugün tek seferlik bir sayı üretildi, sürekli bir denetim kurulmadı.

---

## 4. Açık kalan sorular

`SORULAR.md`'ye üç yeni madde eklendi:

- **S39** — Ölçülmüş ve türetilmiş FPS aynı listede yan yana mı dursun?
- **S40** — Oyun listesi hangi sırayla gösterilsin?
- **S41** — Tek skor "işlemci sınırlıyor" derken oyun listesi yüksek FPS
  gösterirse ne yazılır? (CPU kesişimi sıfır olduğu için kaçınılmaz)

Ayrıca planda duran ama karar gerektirmeyen bilinen sınırlar: tek ayar
(1440p ultra + upscaling), tek kaynak (ComputerBase), 118 GPU'nun 58'inde
hiçbir veri yok.
