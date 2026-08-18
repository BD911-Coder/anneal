// Hem sunucunun hem tarayıcının bilmesi gereken sınırlar.
//
// Kendi dosyasında durmasının sebebi teknik: bu sabitler /data içinde
// tanımlansaydı, onları içe aktaran tarayıcı bileşeni veritabanı istemcisini
// de paketine çekerdi. Buradaki hiçbir şey veritabanına bağlı değildir.
//
// Doğrulama yine de sunucuda yapılır — tarayıcıdaki sınır kolaylık içindir,
// güvenlik değil.

/** Geri bildirim mesajının en fazla uzunluğu. */
export const MAX_FEEDBACK_LENGTH = 500;
