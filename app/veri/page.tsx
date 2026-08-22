import { getVeriKalitesi } from "@/data/quality";
import { KURULAMAYAN_KISITLAR } from "@/lib/plausibility";

// Veri kalitesi panosu — İÇ SAYFA (K177).
//
// Genel gezinmeden bağlantı verilmiyor: bu sayfa kullanıcı için değil, proje
// sahibi için. "Veri nerede ince" sorusunun cevabı bugüne kadar beş ayrı
// script'e dağılmıştı.
//
// **Salt okunur.** Hiçbir şey yazmıyor, hiçbir form yok.
//
// **Çeviri katmanında DEĞİL** ve bu bilinçli: tek okuyucusu var ve o kişi
// Türkçe okuyor. K150 kullanıcıya görünen metinleri çeviriye taşıdı; burası
// bir iç araç, kamuya açık bir yüzey değil. Sayfa halka açılırsa çeviriye
// girmesi gerekir.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Veri kalitesi — Anneal",
  // Site zaten aramaya kapalı (K30); bu satır sayfanın niyetini de yazıyor.
  robots: { index: false, follow: false },
};

function Yuzde({ dolu, toplam }: { dolu: number; toplam: number }) {
  const oran = toplam === 0 ? 0 : Math.round((dolu / toplam) * 100);
  const renk = oran === 100 ? "text-foreground" : oran >= 50 ? "text-muted" : "text-red-500";
  return (
    <span className={`num ${renk}`}>
      {dolu}/{toplam} <span className="text-xs">(%{oran})</span>
    </span>
  );
}

export default async function VeriPage() {
  const k = await getVeriKalitesi();

  const gpuAileler = k.aileler.filter((a) => a.tur === "gpu");
  const cpuAileler = k.aileler.filter((a) => a.tur === "cpu");

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <header className="border-b border-border pb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Veri kalitesi</h1>
        <p className="mt-1 text-sm text-muted">
          İç sayfa. Genel gezinmeden bağlantı verilmiyor, hiçbir şey yazmıyor.
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-muted">Katalog</dt>
            <dd className="num">{k.toplamParca} parça</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Ölçülmüş indeks</dt>
            <dd className="num">{k.olculenToplam} parça</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Dış kaynaklı alan</dt>
            <dd className="num">{k.disKaynakliAlan.length}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Spec&apos;i tamamen dış kaynaklı parça</dt>
            <dd className="num">{k.tamamenDisKaynakli}</dd>
          </div>
        </dl>
      </header>

      {/* --- Alan kapsamı --- */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold">Alan kapsamı ve kaynağı</h2>
        <p className="mt-1 text-sm text-muted">
          Hangi alan ne kadar dolu ve o değerler nereden geldi. Kaynak damgası alan
          başına tutuluyor (K170); damgası olmayan dolu alan yoksa &quot;—&quot; sütunu boş.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[36rem] text-sm">
            <thead className="text-left text-xs text-muted">
              <tr className="border-b border-border">
                <th className="py-1.5 pr-3">Tablo</th>
                <th className="py-1.5 pr-3">Alan</th>
                <th className="py-1.5 pr-3">Dolu</th>
                <th className="py-1.5">Kaynak dağılımı</th>
              </tr>
            </thead>
            <tbody>
              {k.alanKapsami.map((a) => (
                <tr key={`${a.tablo}.${a.alan}`} className="border-b border-border/50">
                  <td className="py-1.5 pr-3 text-xs text-muted">{a.tablo}</td>
                  <td className="py-1.5 pr-3 font-mono text-xs">{a.alan}</td>
                  <td className="py-1.5 pr-3">
                    <Yuzde dolu={a.dolu} toplam={a.toplam} />
                  </td>
                  <td className="py-1.5 text-xs text-muted">
                    {Object.entries(a.kaynaklar)
                      .sort((x, y) => y[1] - x[1])
                      .map(([ad, adet]) => `${ad} ${adet}`)
                      .join(" · ") || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* --- Aile durumu --- */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold">Aile başına ölçüm, tahmin ve bant</h2>
        <p className="mt-1 text-sm text-muted">
          Bant, motorun o aile için gerçekten seçtiği bant — kullanıcı hangi sayıyı
          görüyorsa o. Eşik dört ölçüm (K156).
        </p>
        {[
          { baslik: "Ekran kartı", liste: gpuAileler },
          { baslik: "İşlemci", liste: cpuAileler },
        ].map((grup) => (
          <div key={grup.baslik} className="mt-4">
            <h3 className="text-sm font-semibold">{grup.baslik}</h3>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[32rem] text-sm">
                <thead className="text-left text-xs text-muted">
                  <tr className="border-b border-border">
                    <th className="py-1.5 pr-3">Aile</th>
                    <th className="py-1.5 pr-3">Parça</th>
                    <th className="py-1.5 pr-3">Ölçülen</th>
                    <th className="py-1.5 pr-3">Tahmin</th>
                    <th className="py-1.5 pr-3">Bant</th>
                    <th className="py-1.5">Bant nereden</th>
                  </tr>
                </thead>
                <tbody>
                  {grup.liste.map((a) => (
                    <tr key={`${a.tur}-${a.aile}`} className="border-b border-border/50">
                      <td className="py-1.5 pr-3 font-mono text-xs">{a.aile}</td>
                      <td className="num py-1.5 pr-3">{a.parca}</td>
                      <td className="num py-1.5 pr-3">{a.olculen}</td>
                      <td className="num py-1.5 pr-3">{a.tahmin}</td>
                      <td className="num py-1.5 pr-3">
                        {a.bandPct === null ? "—" : `±%${a.bandPct.toFixed(1)}`}
                      </td>
                      <td className="py-1.5 text-xs text-muted">{a.bandKaynagi}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </section>

      {/* --- Makullük --- */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold">
          Makullük ihlalleri{" "}
          <span className="text-sm font-normal text-muted">
            ({k.ihlaller.length} ihlal / {k.makullukKontrol} kontrol)
          </span>
        </h2>
        {k.ihlaller.length === 0 ? (
          <p className="mt-2 text-sm text-muted">
            İhlal yok. Bu, verinin doğru olduğunu değil, <strong>imkânsız olmadığını</strong>{" "}
            söyler (K174).
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1.5 text-sm">
            {k.ihlaller.map((i, idx) => (
              <li key={`${i.partId}-${i.kural}-${idx}`} className="border-b border-border/50 pb-1.5">
                <span className="font-mono text-xs">{i.partId}</span>{" "}
                <span className="text-xs text-muted">[{i.kural}]</span>
                <div className="text-xs text-muted">{i.gerekce}</div>
              </li>
            ))}
          </ul>
        )}
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-muted">Kurulamayan kısıtlar</summary>
          <ul className="mt-2 flex flex-col gap-1 font-mono text-xs text-muted">
            {KURULAMAYAN_KISITLAR.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </details>
      </section>

      {/* --- Dış kaynaklı alanlar --- */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold">Dış kaynaklı alanlar</h2>
        <p className="mt-1 text-sm text-muted">
          Üreticiden gelmeyen her değer. Lisans yükümlülüğü olan kaynakta makale ve
          revizyon numarası da satırda duruyor — atıf bunlarla veriliyor.
        </p>
        {k.disKaynakliAlan.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Yok.</p>
        ) : (
          <div className="mt-3 max-h-96 overflow-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <thead className="text-left text-xs text-muted">
                <tr className="border-b border-border">
                  <th className="py-1.5 pr-3">Parça</th>
                  <th className="py-1.5 pr-3">Alan</th>
                  <th className="py-1.5 pr-3">Kaynak</th>
                  <th className="py-1.5">Atıf</th>
                </tr>
              </thead>
              <tbody>
                {k.disKaynakliAlan.map((d) => (
                  <tr key={`${d.partId}-${d.alan}`} className="border-b border-border/50">
                    <td className="py-1.5 pr-3 font-mono text-xs">{d.partId}</td>
                    <td className="py-1.5 pr-3 font-mono text-xs">{d.alan}</td>
                    <td className="py-1.5 pr-3 text-xs">{d.kaynak}</td>
                    <td className="py-1.5 text-xs text-muted">
                      {d.makale ? `${d.makale} · rev ${d.revizyon ?? "—"}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* --- Çekişmeli değerler --- */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold">Açık çekişmeli değerler</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          <strong>Bu bölüm boş ve boş olmasının sebebi bir eksiklik.</strong> Üretici ile
          dış kaynağın çeliştiği alanlar içe aktarma <em>sırasında</em> hesaplanıyor ve
          hiçbir tabloya yazılmıyor (K168). Yani &quot;bugün açık çekişme var mı&quot;
          sorusunu bu sayfa cevaplayamıyor; cevabı görmek için{" "}
          <code className="font-mono text-xs">npm run wikipedia:deneme</code> çalıştırmak
          gerekiyor.
          <br />
          Çekişmeleri kalıcı kaydetmek bir şema kararı ve verilmedi.
        </p>
      </section>

      <footer className="mt-10 border-t border-border pt-4 text-xs text-muted">
        Bu sayfa hiçbir şey yazmaz. Sayılar her istekte veritabanından okunur.
      </footer>
    </main>
  );
}
