# 2026-08-18 — Açık soruların tek dosyada toplanması

---

## Ne yapıldı

**1. Depo köküne `SORULAR.md` oluşturuldu.** Üç günlük raporuna dağılmış "Açık
kalan sorular" bölümleri tek listede toplandı: S1–S8. Her madde bağlamı,
seçenekleri ve kaynak raporuyla birlikte yazıldı; S1 için öneri de eklendi.

**2. `CLAUDE.md` raporlama bölümü güncellendi.** `SORULAR.md`'nin yeri, raporlarla
ilişkisi ve bir soru cevaplandığında ne olacağı kurala bağlandı.

---

## Hangi kararlar verildi ve neden

**Taşıma değil, oluşturma yapıldı.** İstek "`docs/SORULAR.md` dosyasını köke taşı"
şeklindeydi ama böyle bir dosya hiç yoktu — ne depoda ne çalışma klasöründe.
Açık sorular o ana kadar ayrı bir dosyada tutulmuyordu, her raporun sonundaki
bölümlere dağılmıştı. Tahmin edip yanlış dosyayı taşımak yerine soruldu; proje
sahibi kökte yeni bir `SORULAR.md` oluşturulmasını seçti.

**Gerekçedeki varsayım düzeltildi.** İstekteki sebep "alt klasörler dışarıdan
okunamıyor" idi. GitHub'da alt klasörler okunabiliyor; `docs/KARARLAR.md` şu an
tarayıcıdan görünür durumda. Dosyanın kökte olmasının gerçek faydası görünürlük —
`SORULAR.md` bu gerekçeyle kökte tutuluyor.

**Raporlardaki soru bölümleri silinmedi.** İki katman ayrıldı: `docs/log/`
altındaki raporlar o günün değişmez fotoğrafı, `SORULAR.md` güncel durum.
Rapor geçmişe dönük olarak doğru kalmalı, bu yüzden içindeki liste dondurulmuş
bırakıldı.

---

## Ne doğrulandı

```
$ find docs -type f | sort
docs/KARARLAR.md
docs/log/2026-08-18-depo-gorunurlugu-ve-kural-guncellemesi.md
docs/log/2026-08-18-iskelet-ve-sema.md
docs/log/2026-08-18-karar-yetkisi-ve-raporlama.md

$ git ls-files | grep -i sorular
(çıktı yok — dosya hiç mevcut değildi)
```

Yeni dosya ve kural güncellemesi sonrası:

```
$ ls *.md
CLAUDE.md
SCHEMA.md
SORULAR.md

$ grep -c "^### S" SORULAR.md
8
```

Kod tarafında değişiklik yok; şema, derleme ve bağımlılıklar bu iş biriminde
etkilenmedi.

---

## Açık kalan sorular

`SORULAR.md` içindeki sekiz maddenin tamamı hâlâ açık. Bu iş birimi yeni soru
üretmedi, mevcut olanları toplayıp görünür hale getirdi.

Güncel liste: `SORULAR.md`
