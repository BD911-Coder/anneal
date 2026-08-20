"use client";

import { useEffect, useRef } from "react";

/**
 * Sayarak gelen sayı.
 *
 * ÜÇ KURAL:
 *
 * 1. **Ekrandaki sayı her zaman gerçek sayıdır.** React `value`'yu çiziyor;
 *    sayma onun üstüne geçici olarak biniyor ve yine `value` ile bitiyor.
 *    JavaScript çalışmazsa ya da animasyon yarıda kalırsa doğru sayı kalır —
 *    hiçbir koşulda 0 görünmez.
 *
 * 2. **Yalnızca BİR KEZ, öğe ekrana girdiğinde sayar.** Kullanıcı seçim
 *    değiştirdiğinde sayı yerinde güncellenir, yeniden saymaz. Veri okunurken
 *    hareket olmaz: FPS listesine bakan biri sabit bir tablo görmeli.
 *
 * 3. `prefers-reduced-motion` açıksa hiç saymaz.
 *
 * Sayma sırasında React durumu değil doğrudan `textContent` yazılıyor. Sebebi:
 * saniyede 60 kez `setState` çağırmak bütün ağacı yeniden çizdirirdi, oysa
 * değişen tek şey bir metin düğümü. Animasyon bittiğinde sayı yine React'in
 * çizdiği değere eşit olduğu için ikisi çelişmiyor.
 *
 * `animate={false}`: sayı sunucudan gelmişse kullanılır. O durumda gerçek sayı
 * zaten boyanmış olur; sıfırlayıp saymak "118 → 0 → 118" titremesi yaratırdı.
 */
export function CountUp({
  value,
  animate = true,
  durationMs = 700,
}: {
  value: number;
  animate?: boolean;
  durationMs?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  // Sayma yalnızca ilk girişte; sonraki değer değişiklikleri anında yansır.
  const sayildi = useRef(false);

  useEffect(() => {
    if (sayildi.current) return;
    sayildi.current = true;

    if (!animate || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const el = ref.current;
    if (!el) return;

    // Ara değerler hedefle aynı basamakta yazılır: 164.4'e sayarken tam
    // sayı gösterip sonda ".4" eklemek, sayının son anda zıplaması olurdu.
    const basamak = (String(value).split(".")[1] ?? "").length;

    let frame = 0;
    const start = performance.now();
    const step = (now: number) => {
      const oran = Math.min(1, (now - start) / durationMs);
      // Hızlı başlar, yumuşak durur: sayının son hâlinde oturması gerekiyor.
      const egri = 1 - Math.pow(1 - oran, 3);
      el.textContent = (value * egri).toFixed(basamak);
      if (oran < 1) frame = requestAnimationFrame(step);
      else el.textContent = String(value);
    };
    frame = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(frame);
      // Yarıda kesilirse ekranda ara değer kalmasın.
      el.textContent = String(value);
    };
  }, [value, animate, durationMs]);

  return <span ref={ref}>{value}</span>;
}
