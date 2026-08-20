// FPS'in ne anlama geldiği — eşik etiketleri.
//
// **Bunlar ölçüm değil KARAR.** Hata payları gibi ölçülemezler; "60 FPS akıcı
// mıdır" sorusunun deneysel bir cevabı yok, ekranın tazeleme hızına ve oyunun
// türüne göre değişir. Bu yüzden sayının yanında değil, sayının **yorumu**
// olarak duruyorlar ve kaynakları burada yazılı.
//
// Neden yine de var: ham sayı tek başına bir şey söylemiyor. "47 FPS" gören
// kullanıcı bunu iyi mi kötü mü bilemez; site performans tahmini yapıyorsa
// tahmini yorumlamak da işinin parçası.
//
// Eşikler yaygın kabul gören sınırlar:
//   30  — konsol nesillerinin uzun süre hedefi; altı belirgin takılma
//   60  — masaüstü oyunun klasik hedefi, 60 Hz ekranın tavanı
//   120 — yüksek tazelemeli ekranların (120/144 Hz) alt sınırı

export type FpsBand = {
  /** Bu değerin ALTI bu banda girer; `Infinity` en üst bant. */
  max: number;
  label: string;
  /** Tailwind renk sınıfı — bantlar tek renkte olmasın diye. */
  tone: string;
};

export const FPS_BANDS: FpsBand[] = [
  { max: 30, label: "zor", tone: "text-red-600" },
  { max: 60, label: "oynanır", tone: "text-amber-600" },
  { max: 120, label: "akıcı", tone: "text-emerald-600" },
  { max: Infinity, label: "yüksek tazeleme", tone: "text-sky-600" },
];

export function bandFor(fps: number): FpsBand {
  for (const b of FPS_BANDS) if (fps < b.max) return b;
  return FPS_BANDS[FPS_BANDS.length - 1];
}

/** Arayüzde eşiklerin nereden geldiğini söyleyen tek cümle. */
export const FPS_BAND_NOTE =
  "Eşikler (30 / 60 / 120) yaygın kabul gören sınırlardır, ölçüm değil yorumdur; " +
  "ekranınızın tazeleme hızına göre değişir.";
