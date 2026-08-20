// Hata payı dosyalarındaki işaretli bloğu yazar (K110).
//
// Neden blok: sayı otomatik güncellenmeli ama yanındaki gerekçe, yöntem ve
// tarihî notlar insan tarafından yazılıyor. Script bütün dosyayı yazsaydı o
// yazılar her ölçümde silinirdi; hiç yazmasaydı sayı eskirdi. Blok ikisini
// ayırıyor.
//
// Neden işaretçi, düzenli ifade değil: alan adına göre arayan bir düzenli
// ifade, dosya biçimlendirilince sessizce eşleşmeyi bırakır ve script "yazdım"
// deyip hiçbir şey yazmaz. İşaretçi bulunamazsa burası HATA verir.

import { readFileSync, writeFileSync } from "node:fs";

const BASLA = "// === ÖLÇÜM BAŞLANGIÇ";
const BITIS = "// === ÖLÇÜM BİTİŞ ===";

/**
 * `path` dosyasındaki işaretli bloğun içini `satirlar` ile değiştirir.
 *
 * Blok işaretçilerinin kendisi korunur — çağıran taraf onları GÖNDERMEZ,
 * yalnızca blok gövdesini verir. Satırlar girintisiz verilir; girinti açılış
 * işaretçisinden okunur.
 */
export function blokYaz(path: string, satirlar: string[]): void {
  const metin = readFileSync(path, "utf8");

  const bas = metin.indexOf(BASLA);
  const son = metin.indexOf(BITIS);
  if (bas === -1 || son === -1 || son < bas) {
    throw new Error(
      `${path}: ÖLÇÜM bloğu bulunamadı. İşaretçiler silinmiş ya da bozulmuş — ` +
        `sayı sessizce eski kalmasın diye bu bir hata.`,
    );
  }

  // Acilis isaretcisinin bulundugu satirin girintisi blogun girintisidir.
  const satirBasi = metin.lastIndexOf("\n", bas) + 1;
  const girinti = metin.slice(satirBasi, bas);

  const acilisSonu = metin.indexOf("\n", bas) + 1;
  const govde = satirlar.map((s) => girinti + s).join("\n") + "\n";

  writeFileSync(path, metin.slice(0, acilisSonu) + govde + metin.slice(son - girinti.length), "utf8");
}

/** `12.34` -> `12.3` (bir ondalık, sayı olarak). */
export function bir(v: number): string {
  return v.toFixed(1);
}

/** Bugünün tarihi, YYYY-AA-GG. */
export function bugun(): string {
  return new Date().toISOString().slice(0, 10);
}
