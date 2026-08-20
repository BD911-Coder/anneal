/**
 * Arka plan motifi — litografi maskesi.
 *
 * Çip üretiminde maske, devre desenini ve köşelerdeki hizalama işaretlerini
 * taşıyan cam levhadır. Buradaki çizim onun soyutlaması: dik açılı devre
 * izleri, via kareleri, köşelerde hizalama artıları.
 *
 * Neden fotoğraf değil çizim: fotoğraf hem ağır hem de içeriğin önüne geçer.
 * Bu SVG birkaç yüz bayt, tek renk (`--motif`) kullanıyor ve iki temada da
 * kendi kendine doğru tonu alıyor.
 *
 * Neden animasyonsuz: sürekli çalışan bir arka plan efekti telefonda pili
 * ve kaydırma akıcılığını yer. Hareket yalnızca giriş anında, içerikte.
 *
 * `aria-hidden`: ekran okuyucu için bir anlamı yok.
 */
export function Backdrop() {
  return (
    <div className="motif-katmani" aria-hidden="true">
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 800 600"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
      >
        {/* Devre izleri. Yalnızca dik açı: litografi maskeleri böyle çizilir. */}
        <g stroke="var(--motif)" strokeWidth="1">
          <path d="M0 90h180l40-40h150v-50" />
          <path d="M0 150h120l50 50h260v90h180" />
          <path d="M800 220H620l-40 40H330v120H150l-60 60H0" />
          <path d="M60 600V470l40-40h180v-60h140l40-40h340" />
          <path d="M800 520H560l-50-50H360v130" />
          <path d="M240 0v70l40 40v90" />
          <path d="M470 0v40l50 50h280" />
          <path d="M690 600V430l-40-40V270" />
        </g>

        {/* Via: iki katmanı birleştiren delik. İzlerin kırıldığı yerde. */}
        <g fill="var(--motif)">
          <rect x="176" y="46" width="8" height="8" />
          <rect x="426" y="286" width="8" height="8" />
          <rect x="576" y="256" width="8" height="8" />
          <rect x="146" y="426" width="8" height="8" />
          <rect x="516" y="86" width="8" height="8" />
          <rect x="646" y="386" width="8" height="8" />
        </g>

        {/* Hizalama işaretleri — maskenin dört köşesindeki artılar. */}
        <g stroke="var(--motif)" strokeWidth="1.5">
          <path d="M40 40h26M53 27v26" />
          <path d="M760 40h-26M747 27v26" />
          <path d="M40 560h26M53 547v26" />
          <path d="M760 560h-26M747 547v26" />
        </g>
      </svg>
    </div>
  );
}
