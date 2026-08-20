/**
 * Sistem indeksinin çubuğu.
 *
 * Ölçek 0–200 ve **referans 100 çentikle işaretli**. Ölçeğin ucu keyfî
 * seçilmedi ama bir tavan da değil: 100 sabit referans sistemin değeri
 * (K73), 200 onun iki katı. İndeks 200'ü geçerse çubuk sonuna dayanır ve
 * durur — çubuk okumayı kolaylaştıran bir yardımcı, sayının kaynağı değil.
 * Sayı her zaman çubuğun yanında yazılı.
 *
 * `aria-hidden`: sayıyı zaten `<output>` okutuyor, çubuk onu tekrar
 * söylemesin.
 *
 * Hareket: `.dolan` sınıfı çubuğu bir kez soldan doldurur. Genişlik satır
 * içinde yüzde olarak duruyor, yani animasyon çalışmasa da (JavaScript
 * kapalı, hareket azaltma açık) çubuk doğru uzunlukta.
 */
const OLCEK_UCU = 200;

export function IndexBar({ value }: { value: number }) {
  const yuzde = Math.min(100, (value / OLCEK_UCU) * 100);

  return (
    <div className="mt-3 max-w-md" aria-hidden="true">
      <div className="relative h-1.5 overflow-hidden rounded-full bg-border">
        <div className="dolan h-full rounded-full bg-accent" style={{ width: `${yuzde}%` }} />
        {/* Referans çentiği: 100 bu ölçeğin ortası. */}
        <div className="absolute inset-y-0 left-1/2 w-px bg-background" />
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-muted">
        <span className="num">0</span>
        <span>
          referans <span className="num">100</span>
        </span>
        <span className="num">{OLCEK_UCU}+</span>
      </div>
    </div>
  );
}
