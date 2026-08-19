# 2026-08-20 — S37: K77 köprü ölçümü

K77 ("farklı sürücü dönemi köprülenmez") ComputerBase'in iki test turu için
ölçülerek sınandı.

**Sonuç: köprü kurulmaz. K77 doğrulandı.** Ölçüt açık farkla karşılanmadı.
Köprü kurulmadı, `perf_index` değişmedi, `benchmark_points`'a satır yazılmadı.

---

## 1. Ölçülen şey

İki tur, altı ortak kart:

| | Tur A (2025) | Tur B (2026, güncel) |
|---|---|---|
| Makale | Büyük karşılaştırma (90695) | RX 9070 GRE testi (97564) |
| Oyunlar | Black Myth: Wukong, Dragon Age: The Veilguard, Final Fantasy XVI, Hellblade 2, Silent Hill 2 | Alan Wake 2, Anno 117, AC Shadows, CoD BO7, Cyberpunk 2077, Death Stranding 2, F1 25, Hogwarts Legacy |
| Koşul | 1440p, DLSS/FSR Quality, Rasterizer | aynı |
| Gözlem | 30 | 28 |

Ortak kartlar: RTX 4090, RTX 4070, RTX 4060, RX 7800 XT, RX 7600, Arc B580.

**Yöntem:** her tur *kendi içinde* iki çarpanlı logaritmik uyumla çözüldü
(indeks hesabının aynısı), altı kartın performans vektörü kendi geometrik
ortalamasına normalize edildi, sonra kart başına `A/B` oranı alındı.

Mutlak seviye anlamsız — iki tur bağımsız normalize edildiği için oranların
geometrik ortalaması tanımı gereği 1. **Anlamlı olan dağılım.** Sürücü ve oyun
paketi değişimi bütün kartlarda aynı oranda etki ettiyse altı oran birbirine
eşit çıkar.

Tur B verisi zaten veritabanında; Tur A verisi yalnızca bu ölçüm için okundu ve
**içe aktarılmadı**.

## 2. Sonuç — ölçüt karşılanmadı

```
kart               marka    tur A   tur B    oran
nvidia-rtx-4090    NVIDIA   2.372   2.106   1.126
nvidia-rtx-4070    NVIDIA   1.277   1.149   1.112
nvidia-rtx-4060    NVIDIA   0.695   0.712   0.976
amd-rx-7800-xt     AMD      1.233   1.139   1.082
amd-rx-7600        AMD      0.572   0.714   0.801
intel-arc-b580     Intel    0.674   0.713   0.945

dagilim (std/ort)  : 12.4%      olcut: <%5
en buyuk / en kucuk: 1.407  (%40.7)
NVIDIA ortalama    : 1.069
AMD    ortalama    : 0.931
NVIDIA / AMD farki : +14.8%     olcut: sistematik fark olmayacak
```

**İki ölçüt de karşılanmadı.** Dağılım eşiğin iki buçuk katı; marka farkı
%14.8. K77'nin uyardığı durum bu ölçümde görünüyor.

---

## 3. Ama sebebi marka değil — bu kısım kayda değer

Marka ortalamalarındaki fark ilk bakışta "NVIDIA sürücüsü kazandı" gibi
duruyor. Kırılım başka bir şey söylüyor.

**VRAM'e göre ayrıldığında (hiçbir oyun çıkarılmadan):**

| Grup | Kart | Oran (geo) | Dağılım |
|---|---|---|---|
| 8 GB | RTX 4060, RX 7600 | 0.884 | %13.9 |
| ≥12 GB | RTX 4090, RTX 4070, RX 7800 XT, Arc B580 | 1.064 | %7.8 |

8 GB'lık iki kart **birlikte** aşağı düşüyor — biri NVIDIA, biri AMD. Marka
ayrımı bunu açıklamıyor; bellek açıklıyor.

Tur A'nın oyun paketinde Dragon Age: The Veilguard var ve 1440p Quality'de
8 GB kartlar çöküyor: **RX 7600 = 8.9 FPS, RTX 4060 = 15.0 FPS** — aynı testte
RTX 4070 58.5 FPS. Bu bir sürücü farkı değil, VRAM duvarı.

**O oyun çıkarılınca:**

| Grup | Oran (geo) | Dağılım |
|---|---|---|
| ≥12 GB (4 kart) | 0.997 | **%0.9** |
| 8 GB (2 kart) | 1.007 | %8.2 |
| altı kartın hepsi | — | %3.8 |
| ≥12 GB içinde NVIDIA/AMD farkı | — | **+%0.6** |

≥12 GB kartlar iki tur arasında **%0.9 dağılımla** aynı yerde duruyor ve marka
farkı yok. Yani sürücü/paket değişimi bu kartlar için gerçekten düzgün.

## 4. Yine de köprü kurulmadı — üç sebep

**a) Ölçüt tam veri üzerinde uygulanır.** Dragon Age'i çıkarmak sonucu
değiştirdiği için çıkarmak, sonuca göre veri seçmek olur. Hiçbir oyun
çıkarılmadan dağılım %12.4.

**b) Sonuç kırılgan.** Tek bir oyun dağılımı %3.8'den %12.4'e taşıyor. Tur
başına 4-5 oyun ve altı kartla bu ölçüm, bir köprüye izin verecek kadar
kararlı değil.

**c) VRAM açıklaması bile ölçütü kurtarmıyor.** Dragon Age dahilken ≥12 GB
grubu da %7.8 dağılım veriyor — Arc B580 (0.945) diğer üçünden (1.08–1.13)
ayrılıyor. Yani "≥12 GB kartlarla köprü kurulur" demek için de erken.

**Köprü kurulmadı, kurulması önerilmiyor.** GPU indeks kapsamı 14'te kalıyor.

## 5. Ölçümün sınırları

- Tur B'de altı kartın oyun kapsamı eşit değil (kart başına 4–6 oyun);
  K75 rotasyonunun sonucu. Uyum yöntemi dengesiz veriyi kaldırıyor ama
  tahmin gürültüsü artıyor.
- ≥12 GB grubunda n=4, 8 GB grubunda n=2. Bu sayılarla "marka farkı yok"
  demek, "marka farkı ölçülemedi" demenin kibar hâli.
- Tur A'dan 30 değer okundu, hiçbiri veritabanına yazılmadı. Yazılsaydı da
  K85 gereği hesaba girmezdi (`GUNCEL_TUR` filtresi).

---

## Açık kalan sorular

1. **Köprü hangi koşulda güvenli olurdu?** Ölçüm bir yön gösteriyor:
   VRAM sınırına takılmayan kartlarla, VRAM uçurumu olan oyunlar dışarıda
   bırakılarak. Ama bunu kural hâline getirmek için daha çok veri gerekiyor —
   tur başına 8+ oyun ve 8+ ortak kart.
2. **GPU kapsamı 14'te.** S37 kapandı ama sorunu çözmedi. Kalan yol yeni
   kaynak (Faz 1.3'ün ikinci maddesi).
