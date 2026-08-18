# 2026-08-18 — Depo görünürlüğü ve kural güncellemesi

---

## Ne yapıldı

**1. Depo herkese açık yapıldı.** `BD911-Coder/anneal` artık public.

**2. Secret scanning ve push protection etkinleştirildi.** Push protection, bir
anahtar yanlışlıkla commit edilirse gönderimi anında reddeder.

**3. LICENSE eklenmedi.** Bilinçli karar, `docs/KARARLAR.md` K13.

**4. `CLAUDE.md`'deki iki bölüm güncellendi.** "Karar yetkisi" ve "Raporlama"
bölümleri önceki iş biriminde eklenmişti; metin son haliyle yenilendi.
Yeni gelen madde: **rapor yazıldıktan sonra dosyanın tam yolu ekranda gösterilir.**

---

## Hangi kararlar verildi ve neden

`docs/KARARLAR.md`'ye iki kalıcı karar eklendi:

- **K12 — Depo public, secret scanning + push protection açık.** Push protection,
  CLAUDE.md'deki "depoya sır sızmasını engelleyen bir kontrol kurulur" maddesinin
  karşılığı ve public depolarda ücretsiz.
- **K13 — Lisanssız kalır.** Lisans dosyası olmayan depoda telif sahibinde kalır;
  kod görünür olsa da kimse yasal olarak kullanamaz.

**Bölümler yeniden eklenmedi, güncellendi.** İki bölüm zaten `CLAUDE.md`'de
mevcuttu. Aynı başlıkları ikinci kez eklemek dosyada çelişkili iki kural bloğu
bırakırdı; mevcut bölümlerin metni yenisiyle değiştirildi.

**Küçük sapma:** "Karar yetkisi" maddesinde `KARARLAR.md` yerine `docs/KARARLAR.md`
yazıldı — dosyanın gerçek yolu bu.

---

## Ne doğrulandı

**Public'e geçmeden önce commit geçmişi tarandı:**

```
$ git log --all --pretty=format: --name-only | sort -u | grep -iE '\.env|\.pem$|\.key$|secret|credential'
.env.example

$ MSYS_NO_PATHCONV=1 git show 'HEAD:.env.example'
DATABASE_URL="postgresql://KULLANICI:PAROLA@SUNUCU:5432/anneal?schema=public"

$ git grep -nIE "(gh[pousr]_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|password\s*=\s*['\"][^'\"]{4,})" $(git rev-list --all)
(eşleşme yok)
```

Geçmişte tek "sır benzeri" dosya `.env.example` ve içeriği yer tutucu.

**Görünürlük:**

```
$ gh repo view BD911-Coder/anneal --json visibility,isPrivate
{"isPrivate":false,"visibility":"PUBLIC"}
```

**Güvenlik ayarları:**

```
$ gh api -X PATCH repos/BD911-Coder/anneal ...
{"secret_scanning":{"status":"enabled"},
 "secret_scanning_push_protection":{"status":"enabled"},
 "dependabot_security_updates":{"status":"disabled"},
 "secret_scanning_non_provider_patterns":{"status":"disabled"},
 "secret_scanning_validity_checks":{"status":"disabled"}}
```

Kod tarafında değişiklik yok; şema, derleme ve testler bu iş biriminde
etkilenmedi.

---

## Açık kalan sorular

**1. Üç güvenlik ayarı kapalı kaldı** — istenmediği için açılmadı, bilgi olsun:
`dependabot_security_updates` (bağımlılık açıkları için otomatik PR),
`secret_scanning_non_provider_patterns` (bilinen sağlayıcılara ait olmayan
desenler), `secret_scanning_validity_checks` (bulunan anahtarın hâlâ geçerli
olup olmadığını kontrol). Açılmasını istersen söyle.

**2. Depo public oldu ama `main` dalı korumasız.** Şu an doğrudan `main`'e push
edilebiliyor. CLAUDE.md "`main` her zaman çalışır durumdadır" diyor; dal koruması
bunu kural olmaktan çıkarıp mekanizma haline getirir. Ayar değişikliği olduğu
için kendi başıma yapmadım.

**3. Önceki raporlardan devreden maddeler:** altı indeksin onayı, Prisma sürücü
paketi (`@prisma/adapter-pg` + `pg`), `npm audit` uyarısı, test koşucusu,
karşılaştırma betiğinin `/scripts` altına alınması, şema kararlarının
`SCHEMA.md`'den taşınmasının onayı.
Bkz. `docs/log/2026-08-18-iskelet-ve-sema.md` ve
`docs/log/2026-08-18-karar-yetkisi-ve-raporlama.md`.
