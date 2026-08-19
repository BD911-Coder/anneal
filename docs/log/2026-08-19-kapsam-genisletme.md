# 2026-08-19 — İndeks kapsamını genişletme

Hedef: 30 GPU + 15 CPU. **Ulaşılan: 14 GPU + 12 CPU.**

İşlemci tarafı 7'den 12'ye çıktı. **Ekran kartı tarafı 14'te kaldı ve
K77 altında bu sınır aşılamıyor** — sebebi aşağıda, ölçülerek.

---

## 1. Plan: hangi sayfa neyi ekliyor

### Ekran kartı — iki test turu var, köprülenemiyorlar

ComputerBase'in GPU incelemeleri **iki ayrı test turuna** ayrılıyor ve ayrımı
oyun paketi belli ediyor:

| Tur | Örnek makale | Oyun paketi | Kart |
|---|---|---|---|
| **B (güncel, 2026)** | RX 9070 GRE testi (97564) | Alan Wake 2, Anno 117, ARC Raiders, AC Shadows, CoD BO7, Cyberpunk 2077, Death Stranding 2, F1 25, Hogwarts Legacy | **14** |
| **A (2025)** | Büyük karşılaştırma (90695), RTX 5050 (93679), RX 9060 XT 8GB (93007) | Dragon Age: The Veilguard, Dragon's Dogma 2, … | **19** |

Tur A'nın 19 kartı: RTX 4090, 4080 Super, 4070 Ti Super, 4070 Super, 4070,
4060 Ti, 4060, RTX 3080, 3060 Ti, RX 7900 XTX, 7900 XT, 7900 GRE, 7800 XT,
7700 XT, 7600, RX 6800 XT, 6700 XT, Arc A770, Arc B580.

**İki tur arasındaki örtüşme tam 6 kart:** RTX 4090, 4070, 4060, RX 7800 XT,
RX 7600, Arc B580. K78'in köprü alt sınırı da 6 — yani teknik olarak köprü
kurulabilirdi ve 14 + 13 = **27 kart** olurdu.

**K77 bunu yasaklıyor:** *"İki ölçüm grubu farklı sürücü döneminde alınmışsa
aralarında köprü kurulmaz — ortak kart bulunsa bile."* Farklı oyun paketi,
farklı yıl. Köprü kurulmadı.

Bir de doğrulama yaptım: RX 9070 GRE incelemesinin grafiklerinde gerçekten
14 kart mı var, yoksa çıkarıcım mı kesiyor? Bir grafiğin ham satırlarını
sonuna kadar okudum — **76 satır, ama bu 14 kartın beş ayrı alt grafiği.**
Kart sayısı gerçekten 14. GPU tarafında yapılabilecek başka bir şey yok.

### İşlemci — aynı sayfada iki tur, büyüğü seçildi

İşlemci ranglistesi sayfasında (89909) **her oyun için iki ayrı grafik** var:

| Grafik | İçerik | Katalogla eşleşen |
|---|---|---|
| Bellek-kanalı karşılaştırması | 12 işlemci, hepsi `Dual-Chan`/`Single-Chan` etiketli | 7 |
| **Büyük sıralama** | **22 işlemci** | **12** |

Faz 2'de yanlışlıkla küçük olanı kullanmıştım: çıkarıcı grafik satırlarını
12'de kesiyordu ve 22'lik grafikte ilk 12'yi alıyordu. Alınan veri **yanlış
değildi** (hepsi ortalama bloğundan, doğru değerler) ama eksikti.

Büyük sıralamaya geçince eklenen 5 işlemci:
**Ryzen 9 9950X3D, Ryzen 7 9700X, Core i9-14900K, Core i7-14700K,
Core i5-14600K.**

Dokuz oyunun hepsinde 22'lik grafik var; her işlemci 6 oyunda ölçülü (K78'in
alt sınırı 3).

**Alınmayanlar ve sebepleri:** 9850X3D, 9950X3D2, 7700X3D, 7500X3D, 5800X3D,
3600 — katalogda yok. `Ultra 7 270K Plus`, `Ultra 5 250K Plus` — "Plus"
etiketinin ne olduğu belirsiz, `Single-Chan`'i dışarıda bırakan disiplinin
aynısı. `i5-14600K D4` — DDR4 yapılandırması; **D5 alındı**, bugünün standardı.

---

## 2. K77 uygulaması: veri kalır, hesap seçer

İki tur da `benchmark_points` içinde. Tablo append-only (K1) ve tarih olarak
doğru olan da bu — eski ölçüm silinmez.

Ama **indeks yalnızca tek turdan hesaplanır.** `compute-perf-index.mts`'e
`GUNCEL_TUR` listesi eklendi; hesap yalnızca o `source_url` desenlerinden gelen
satırları kullanıyor:

```
GUNCEL_TUR = [
  "amd-radeon-rx-9070-gre-test.97564",   // GPU
  "rangliste.89909/#rangliste-22",       // CPU, büyük sıralama
]
```

İki turu ayırmak için CPU satırlarının `source_url`'üne çapa eklendi
(`#rangliste-22`). Aynı sayfadaki bellek-kanalı grafiği ayrı bir grup olarak
duruyor ve hesaba girmiyor.

Yeni bir tura geçildiğinde eskisi listeden çıkarılır, satırları silinmez.

---

## 3. Sonuç

```
GPU — 14 parca, 64 olcum, referans nvidia-rtx-4070 = 100
  (degismedi)

CPU — 12 parca, 72 olcum, referans amd-ryzen-5-9600x = 100
  amd-ryzen-7-9800x3d      144.4     intel-core-ultra-9-285k  110.3
  amd-ryzen-9-9950x3d      139.7     amd-ryzen-7-9700x        106.3
  amd-ryzen-7-7800x3d      128.6     intel-core-ultra-7-265k  105.6
  amd-ryzen-5-7600x3d      119.0     intel-core-i5-14600k     104.8
  intel-core-i9-14900k     114.3     intel-core-ultra-5-245k  102.4
  intel-core-i7-14700k     112.7     amd-ryzen-5-9600x        100.0

Toplam 26 parca, model_version v0.2
```

`benchmark_points`: 106 → **178 satır** (72 yeni). `games`: 14 → **17**.

### Sapma ölçümü (K80 zorunluluğu)

```
GPU  — 14 parca   ortalama 3.1%   en buyuk  8.4%
CPU  — 11 parca   ortalama 7.2%   en buyuk 11.5%
TOPLAM            ortalama 4.9%   en buyuk 11.5%    Esik %25: GECTI
```

(CPU'da 11 parça karşılaştırıldı: Ryzen 7 9700X aynada yok.)

**Not düşülmeye değer bulgu:** işlemci tarafındaki sistematik yukarı sapma,
örneklem 7'den 12'ye çıkınca **azalmadı** (+%8.0 → +%7.2 ortalama). Yani bu
fark örneklem büyüklüğünden değil yöntemden geliyor — kaynağımız işlemcileri
720p'de ayırıyor, ayna 1080p'de. Beklenen buydu ve ölçüm doğruladı.
`lib/perf-margin.ts` bu gözlemle birlikte güncellendi.

---

## 4. Ne doğrulandı

```
npm run olcum:aktar     games 3 yeni, benchmark_points 72 yeni (106 atlandi)
npm run indeks:hesapla  26 parca (14 GPU + 12 CPU), v0.2
npm run indeks:sapma    ortalama %4.9, en buyuk %11.5, esik GECTI
npm test                114 test
npm run sema:kontrol    73/73
npm run kural:kontrol   11 kural, 3 UYARI
npx tsc --noEmit / lint / build   temiz
```

---

## 5. Hedefe neden ulaşılamadı — ve ne gerekiyor

| | Hedef | Ulaşılan | Engel |
|---|---|---|---|
| GPU | 30 | **14** | K77: tek turda 14 kart var, ikinci tur köprülenemiyor |
| CPU | 15 | **12** | Kaynağın büyük sıralamasında katalogla eşleşen 12 işlemci var |

GPU tarafında 30'a çıkmanın **iki yolu** var, ikisi de karar gerektiriyor:

**(a) İkinci bir kaynak.** Faz 1'de yedi alan adı denendi, per-oyun makine
okunur veri veren tek kaynak ComputerBase çıktı. Yeni aday aranabilir.

**(b) K77'yi bu özel çift için ölçerek gevşetmek.** Tur A ile B arasında 6
ortak kart var. Sürücü değişimi **düzgün** (bütün kartlarda aynı oranda) ise
model bunu grup zorluğuna soğurur ve köprü güvenlidir; değişim **markaya
göre farklıysa** köprü bozuktur. Bu test edilebilir: 6 ortak kartın iki turdaki
örtük oranları hesaplanır, marka bazında sistematik ayrışma var mı bakılır.
Ölçüm ucuz (tur A'dan ~18 satır yeter) ve sonucu K77'yi ya doğrular ya da bu
çift için istisna gerekçesi verir.

Kendiliğimden yapmadım: K77 açık bir kural ve onu ölçüme dayanarak gevşetmek
proje sahibinin kararı. **`SORULAR.md` S37.**

---

## Açık kalan sorular

- **S37** — GPU kapsamı 14'te kilitli. İkinci kaynak mı aransın, yoksa K77
  bu çift için ölçülerek mi sınansın?
- Bantlar hâlâ geçici (K73), ölçülmüş sistemlere karşı doğrulanmadı.
- `lib/perf-margin.ts` `provisional: true` — tek aynayla ölçüldü.
