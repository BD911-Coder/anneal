# 2026-08-20 — A.1 tamamlandı: paylaşım sayfası ve ana sayfa metni

Önceki turda A.1 yalnızca sistem oluşturucuda çalışıyordu. İki eksik kapandı:
paylaşılan link artık listeyi gösteriyor, ana sayfadaki eskimiş cümle ayrıldı.

---

## 1. Paylaşılan sistem sayfası — dondurma kararı

**Soru:** kayıt anındaki değerler mi gösterilecek, güncel hesap mı?

**Karar: bugünkü hesap, ayrı kutuda, açıkça etiketli (K102).**

Üç gerekçe, en belirleyicisi ilki:

1. **Dondurulmuş bir FPS yok ve olamaz.** `builds` tablosunda FPS alanı
   bulunmuyor. Eklemek şema değişikliği olurdu (sorulması gerekirdi) ve
   **K100'ü doğrudan ihlal ederdi** — türetilen FPS hiçbir tabloya yazılmaz.
2. **Sayfada aynı sorunun kurulmuş cevabı zaten vardı: fiyat.** Dondurulmuş
   toplam "Kayıt anındaki değerler"de, güncel fiyat ayrı kesikli kutuda; biri
   diğerinin üstüne yazmıyor. FPS aynı desene girdi, kesikli çerçeve dahil.
3. **Donmanın sebebi FPS'te yok.** `perf_index_snapshot` donuyor çünkü
   `model_version` değişebilir ve eski kaydın sayısını yeni motorunkiyle
   karşılaştırmak iki ayrı cetveli karıştırmak olur. FPS'in altındaki
   `benchmark_points` ise **append-only ölçüm**: geçmişe dönük değişmiyor,
   yalnızca üstüne ekleniyor. Bugünkü sayı kayıt anındakinden ancak *daha çok
   ölçüm olduğu için* farklı çıkar — bu bozulma değil iyileşme.

Ayrıca bu özellikten önce kaydedilmiş sistemlerde liste hiç yoktu; onlar için
"kayıt anındaki FPS" diye bir şey zaten mevcut değil.

Kutunun başındaki metin bunu açıkça söylüyor:

> Bu liste **dondurulmamıştır**: bugünkü ölçüm verisiyle ve motor sürümü v0.2
> ile hesaplandı. Yukarıdaki sistem indeksi ise 20.08.2026 tarihinde dondu.
> Ölçüm verisi yalnızca üstüne eklenerek büyüdüğü için bu sayılar zamanla
> değişebilir.

### Yan bulgu: çözünürlük uyuşmazlığı

Sistem 4K'da kaydedilebiliyor ama elimizdeki ölçümler 1440p ultra. 4K seçmiş
birine 1440p sayısı gösterip susmak yanlış olurdu; liste bunu söylüyor.
Test için kasten 4K'da bir sistem kaydedildi ve not tetiklendi.

### Sayfa başlığı da düzeltildi

Başlıkta *"Aşağıdaki değerler o günün değerleridir"* yazıyordu. Sayfada artık
üç kutu var ve ikisi bugünün (güncel fiyat, oyun bazlı FPS) — cümle yanlış hale
gelmişti. Yeni hali hangi kutunun ne olduğunu söylüyor.

---

## 2. Ana sayfa metni (K103)

Eski cümle:

> Fiyatlar örnek veridir; performans tahmini için ölçüm verisi henüz toplanmadı.

İkinci yarısı **artık yanlıştı**. Üç maddeye ayrıldı çünkü üç şeyin olgunluğu
farklı ve tek cümlede birleştiklerinde en kötümser olan hepsini temsil ediyordu:

```
Oyun bazlı FPS: 8 oyunda, 60 ekran kartında gösteriliyor. Her sayının ölçüm
                mü tahmin mi olduğu yanında yazılı.
Sistem indeksi: ekran kartı ve işlemcinin ikisinde de ölçüm gerektiriyor;
                kataloğun bir bölümünde henüz yok.
Fiyat:          yalnızca bir bölüm parçada var, tek kaynaktan ve tek para
                biriminde.
```

**Kapsam sayıları metne gömülmedi, veriden okunuyor.** Bu metnin eskimesinin
sebebi tam olarak elle yazılmış olmasıydı; aynı hatayı tekrarlamamak için `8`
ve `60` sayfada hesaplanıyor.

İlk yazdığım hesap yanlıştı ve düzeltildi: ölçüm gruplarındaki parça id'lerini
saymak **14** veriyordu, çünkü gruplar yalnızca çip içeriyor. Doğru küme "FPS
gösterilebilen seçenek" — indeksi olan çipler **artı** indeksi olan bir çipe
bağlı kartlar (K86 miras). O da 60 veriyor ve planın ölçtüğü sayıyla aynı.

---

## 3. Ortak bileşen (K104)

Liste iki sayfada görünüyor. `app/game-fps.tsx` olarak tek dosyaya çıkarıldı;
oluşturucudaki kopya silindi.

Sebep: K97/K98/K99'un metinleri iki yerde dursaydı biri güncellenip diğeri
unutulurdu ve iki sayfa aynı veri hakkında farklı şey söylerdi. Sıralama da
bileşenin içinde, yani çağıran taraf yanlışlıkla FPS'e göre sıralayamaz.

Aynı turda `RESOLUTION_LABEL` `lib/format.ts`'e taşındı — doğrulama sırasında
aynı sayfada bir kutunun "4K", başka bir kutunun "2160p" dediği görüldü.

---

## 4. Ne doğrulandı

```
npx tsc --noEmit   temiz
npm run lint       temiz
npm test           5 dosya, 144 test
npm run build      hatasız
npm run sema:kontrol  81/81
```

### Tarayıcıda

Ekran görüntüsü yine alınamadı (tarayıcı paneli görüntülenmiyor); doğrulama
sayfanın kendi DOM'undan okunan `innerText` ile yapıldı.

**Ana sayfa başlığı:**

```
Sistem oluşturucu — 237 parça. Parça bilgileri üretici sayfalarından.
Oyun bazlı FPS: 8 oyunda, 60 ekran kartında gösteriliyor. ...
Sistem indeksi: ...
Fiyat: ...
```

**Paylaşım linki** — arayüzden i9-14900K + RTX 5070 sistemi 4K'da kaydedildi,
`/sistem/s62dqq` oluştu ve açıldı:

```
20.08.2026 tarihinde kaydedildi. Toplam fiyat ve sistem indeksi o gün
donduruldu; kesikli çerçeveli kutular bugünün verisiyle hesaplanır.

Kayıt anındaki değerler       1.339,98 USD · indeks 120.2 · 4K · v0.2

Bugünkü oyun bazlı FPS
  Bu liste dondurulmamıştır: bugünkü ölçüm verisiyle ...
  Seçili çözünürlük 4K, ama elimizdeki ölçümler yukarıdaki ayarda.
  Alan Wake 2                65.3 FPS  ● ölçüldü
  Anno 117: Pax Romana       82.5 FPS  ● ölçüldü
  Assassin's Creed Shadows     61 FPS  ○ tahmin ±%12.8
  Call of Duty: Black Ops 7   140 FPS  ○ tahmin ±%12.8
  Cyberpunk 2077            108.5 FPS  ● ölçüldü
  Death Stranding 2          96.3 FPS  ● ölçüldü
  F1 25                     148.8 FPS  ● ölçüldü
  Hogwarts Legacy             101 FPS  ○ tahmin ±%12.8
```

Cyberpunk'ta RTX 5070'in ölçülmüş değeri **108.5** — planın 1. bölümündeki ham
ölçüm tablosuyla birebir aynı. Sayı ölçümden geçiyor, yolda değişmiyor.

**Oluşturucu** refactor sonrası da çalışıyor: RX 9070 GRE yine 5 ölçüm +
3 tahmin, varsayılan 1440p olduğu için uyuşmazlık notu çıkmıyor.

Konsol hatası yok.

---

## 5. Açık kalan sorular

1. **Hata payı hâlâ tek seferlik.** `lib/fps-margin.ts` elle işlenmiş; veri
   değişirse eskiyeceğini fark edecek bir mekanizma yok. A.3'ün ilk maddesi.
2. **Paylaşım sayfasındaki liste zamanla değişecek.** K102 bunu bilerek kabul
   ediyor ve kutu bunu yazıyor, ama biri altı ay önce paylaştığı linki açıp
   "sayı değişmiş" diyebilir. Bugünkü cevap: kutu zaten dondurulmadığını
   söylüyor. Kullanıcı geri bildirimi gelirse yeniden bakılmalı.
3. **Geliştirme veritabanında artık bir test sistemi var** (`s62dqq`).
   Zararsız, ama canlıya aktarımda `builds` tablosu taşınmıyorsa sorun değil;
   taşınıyorsa temizlenmeli.
