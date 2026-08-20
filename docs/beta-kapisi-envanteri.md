# Beta kapısı envanteri — sitenin bir yabancıya gösterilebilir olması için ne eksik?

**Tarih:** 20 Ağustos 2026. Ölçüldü, sonra kritik olanlar düzeltildi.

> **Güncelleme (aynı gün, denetim turu):** 2, 3 ve 4 numaralı maddeler
> **düzeltildi** (K119). Aşağıdaki metin bulundukları andaki hâllerini
> anlatıyor; durumları özet tablosunda güncel.

Her madde tek soruya göre sıralandı: **bu olmadan yabancıya gösterilebilir mi?**

---

## 🔴 ENGELLEYİCİ — bu hâliyle gösterilemez

### 1. Beş kategoride hiç fiyat yok

```
gpu           17/118 fiyatli
cpu            5/ 42 fiyatli
motherboard    0/ 19
ram            0/ 20
psu            0/ 12
storage        0/ 14
case           0/ 12
```

Kullanıcı yedi kategorili bir sistem toplayıp **toplam fiyat göremiyor**.
Üstelik fiyatsız parça seçilirse sistem **kaydedilemiyor** (`missing_price`) —
yani paylaşım akışı da kilitleniyor.

**Sitenin vaadi "toplam fiyatını gösterir".** Bu vaat bugün yedi kategorinin
beşinde tutulmuyor.

### 2. Para birimi yanlış gösteriliyor — USD fiyatlar ₺ ile

Parça açılır listelerinde `389,00 ₺` yazıyor; gerçek değer **389,00 USD**.
`formatPriceMinor`'ın varsayılanı `TRY` ve dört çağrı yerinde para birimi
geçilmiyor:

```
app/builder.tsx:266  parca listesi
app/builder.tsx:295  kart (varyant) listesi
app/builder.tsx:326  secilen parca satiri
app/builder.tsx:547  yukseltme onerisi
```

Toplam satırı (`:353`) ve kaydedilmiş sistem sayfası doğru gösteriyor — yani
**aynı ekranda iki farklı para birimi** görünüyor: liste ₺, toplam USD.

Bu bir görünüm kusuru değil **yanlış bilgi**: 9800X3D'yi 479 lira sanan biri
siteye bir daha güvenmez.

### 3. Mobil tarayıcıda kırık

375 px genişlikte sayfa **660 px** çiziliyor — yatay kaydırma var, içerik
taşıyor.

Kök sebep bulundu: uzun RAM adları (`G.SKILL Trident Z5 Neo
F5-6000J3038F16GX2-TZ5N 32GB (2x16GB) DDR5-6000 CL30`) `<select>`in içsel
genişliğini şişiriyor ve flex çocukları `min-w-0` olmadan küçülmüyor. O tek
etiket gizlenince taşma kayboluyor.

**Beta testçilerinin çoğu telefondan bakar.** Bu hâliyle link gönderilemez.

---

## 🟡 UTANDIRIR — gösterilebilir ama önce düzeltilmeli

### 4. Ana sayfa "31 oyunda" diyor, 23 oyun var

`app/page.tsx:36` — `fpsGroups.length` **grup** sayısını veriyor (23 oyun ×
1440p + 8 oyun × 4K = 31), oyun sayısını değil. Doğru sayı **23**.

Sayı veriden okunuyor (K103 gereği, doğru), ama yanlış şeyi sayıyor.

---

## 🟢 DÜRÜSTÇE SÖYLENİYOR — gösterilebilir

### 5. 58/118 ekran kartında FPS yok

14 çip + 46 kart = 60 GPU'da FPS var. Kalan 58'de arayüz *"Bu kart için ölçüm
yok... uydurma bir sayı göstermektense hiç göstermiyoruz"* diyor.

Eksik ama **dürüst ve açıklanmış**. Yabancıya gösterilmesini engellemez.

### 6. 1080p'de hiç ölçüm yok

1440p'de 23 oyun, 4K'da 8 oyun, 1080p'de sıfır. Arayüz: *"Bu çözünürlükte
(1080p) henüz ölçüm yok."* Aynı gerekçe.

### 7. Oyun bazlı FPS işlemciyi hesaba katmıyor

Listenin başında kalıcı not var (K99). Ölçüldü ve kaynak bulunamadı (K113).

---

## ✅ ÇALIŞIYOR — sınandı

| Akış | Durum | Kanıt |
|---|---|---|
| Sistem kaydetme | ✓ | `/sistem/hbmk3x` oluştu |
| Paylaşım linki açma | ✓ | dondurulmuş değerler + bugünkü FPS kutusu geldi |
| Geri bildirim | ✓ | *"Teşekkürler, kaydedildi."* |
| Çözünürlük geçişi | ✓ | 1440p 23 oyun ↔ 4K 8 oyun ↔ 1080p dürüst boşluk |
| Konsol / ağ | ✓ | güncel yüklemede 500 yok, bütün istekler 200/304 |

> **Not:** tarayıcı aracının konsol tamponu gezinmeler arası temizlenmiyor;
> görünen `PrismaClientValidationError` kayıtları dev sunucusu yeniden
> başlatılmadan önceki oturuma ait (aynı digest). Güncel ağ dökümünde 500 yok.

---

## Özet: beta kapısına ne kaldı

| # | Madde | Engelleyici mi? | Kim |
|---|---|---|---|
| 1 | Beş kategoriye fiyat | 🔴 evet | **AÇIK** — veri işi, kaynak kararı bekliyor |
| 2 | Para birimi hatası | 🔴 evet | ✅ **düzeltildi** (K119) |
| 3 | Mobil taşma | 🔴 evet | ✅ **düzeltildi** (K119) |
| 4 | "31 oyunda" sayısı | 🟡 | ✅ **düzeltildi** (K119) |
| 5-7 | Kapsam boşlukları | 🟢 hayır | dürüstçe söyleniyor |

**2, 3 ve 4 düzeltildi ve tarayıcıda doğrulandı:** 375 px ekranda sayfa
375 px (taşma yok), açılır listede `499,99 USD`, başlıkta `23 oyunda`.

**Geriye tek engel kaldı: fiyat verisi.** Bu bir veri işi ve bu turda
çözülemez — kaynak kararı hâlâ açık (eBay başvurusu bekliyor, Amazon konum
engelli, Newegg pazaryeri K96 tavanıyla elendi).

Yani: **kod tarafında beta kapısı temiz. Kalan tek gerçek engel fiyat.**
