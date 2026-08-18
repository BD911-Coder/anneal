# /data — veri erişim katmanı ve kaynak adaptörleri

Veritabanına erişen tek katman burasıdır. `/engine` buraya bağımlı değildir.

**Zorunlu:** canlı ortamda `source = 'dev-seed'` satırları bu katmanda otomatik
filtrelenir. Bu, çağıran kodun tercihine bırakılmaz (dev-seed korumasının 2. katmanı).

Yeni veri kaynağı eklemek = buraya yeni adaptör yazmak. Mevcut kod değişmez.
