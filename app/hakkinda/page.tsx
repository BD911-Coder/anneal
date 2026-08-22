import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { getFpsGameGroups } from "@/data/benchmarks";
import { getDurustlukSayilari } from "@/data/quality";
import { MODEL_VERSION } from "@/engine/performance";
import { MIN_FAMILY_FOR_OWN_BAND } from "@/engine/index-prediction";
import { FPS_MARGIN } from "@/lib/fps-margin";

// Dürüstlük sayfası — `/hakkinda` (K178).
//
// Bu sayfa sitenin asıl farkı: her rakip bir sayı gösteriyor, hiçbiri o
// sayıya ne kadar güvendiğini söylemiyor.
//
// Kapsam sayıları metne GÖMÜLMÜYOR, her istekte veritabanından okunuyor
// (K103). Dürüstlük sayfasında eskimiş bir sayı, sayfanın kendi iddiasını
// çürütür.
export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getTranslations("about");
  return { title: `${t("title")} — Anneal` };
}

/** ICU `<b>` ve `<code>` etiketleri — çeviri metni biçimi kendisi taşıyor. */
const ETIKETLER = {
  b: (chunks: ReactNode) => <b className="font-semibold text-foreground">{chunks}</b>,
  code: (chunks: ReactNode) => (
    <code className="rounded bg-foreground/5 px-1 py-0.5 font-mono text-[0.85em]">{chunks}</code>
  ),
};

function Bolum({ baslik, children }: { baslik: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold tracking-tight">{baslik}</h2>
      <div className="mt-2 flex flex-col gap-3 text-sm leading-relaxed text-muted">{children}</div>
    </section>
  );
}

export default async function HakkindaPage() {
  const t = await getTranslations("about");

  const [sayilar, fpsGroups] = await Promise.all([
    getDurustlukSayilari(),
    getFpsGameGroups(MODEL_VERSION),
  ]);

  // Oyun sayısı ana sayfayla AYNI kaynaktan: iki sayfa farklı sayı yazamaz.
  const oyunlar = (resolution: string) =>
    new Set(fpsGroups.filter((g) => g.resolution === resolution).map((g) => g.game_id)).size;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:py-12">
      <header className="border-b border-border pb-5">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("title")}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">{t("intro")}</p>
      </header>

      <Bolum baslik={t("measured.heading")}>
        <p>
          {t.rich("measured.body", {
            ...ETIKETLER,
            measuredGpu: sayilar.measuredGpu,
            measuredCpu: sayilar.measuredCpu,
            gpuChips: sayilar.gpuChips,
            cpus: sayilar.cpus,
            points: sayilar.points,
          })}
        </p>
        <p>
          {t.rich("measured.games", {
            ...ETIKETLER,
            games1440: oyunlar("1440p"),
            games2160: oyunlar("2160p"),
          })}
        </p>
        <p>{t("measured.noBlend")}</p>
      </Bolum>

      <Bolum baslik={t("estimated.heading")}>
        <p>{t.rich("estimated.body", ETIKETLER)}</p>
        <p>{t.rich("estimated.how", { ...ETIKETLER, threshold: MIN_FAMILY_FOR_OWN_BAND })}</p>
        <p>{t("estimated.cards")}</p>
      </Bolum>

      <Bolum baslik={t("bands.heading")}>
        <p>{t.rich("bands.body", ETIKETLER)}</p>
        <p>
          {t.rich("bands.numbers", {
            ...ETIKETLER,
            fpsMean: FPS_MARGIN.meanPercent,
            fpsP90: FPS_MARGIN.p90Percent,
            fpsMax: FPS_MARGIN.maxPercent,
            // İki uç: iyi ölçülmüş bir ailenin bandı ve hiç ölçümü olmayan
            // bir ailenin bandı. İkisi de ölçülmüş sayı (K172).
            bandBest: 6.4,
            bandWorst: 30.7,
          })}
        </p>
        <p>{t("bands.worst")}</p>
      </Bolum>

      <Bolum baslik={t("specs.heading")}>
        <p>{t.rich("specs.body", ETIKETLER)}</p>
        <p>{t.rich("specs.wikipedia", { ...ETIKETLER, wikiFields: sayilar.wikiFields })}</p>
        <p>{t("specs.checks")}</p>
      </Bolum>

      <Bolum baslik={t("unknown.heading")}>
        <ul className="flex list-disc flex-col gap-2 pl-5">
          <li>{t("unknown.cpu")}</li>
          <li>{t("unknown.resolution")}</li>
          <li>{t("unknown.coverage", { gpuCards: sayilar.gpuChips + sayilar.gpuCards })}</li>
          <li>{t("unknown.price", { pricedParts: sayilar.pricedParts })}</li>
          <li>{t("unknown.platform")}</li>
          <li>{t("unknown.proxy")}</li>
        </ul>
      </Bolum>

      <Bolum baslik={t("audit.heading")}>
        <p>{t("audit.body")}</p>
        <p>{t("audit.note")}</p>
      </Bolum>

      <footer className="mt-10 border-t border-border pt-4 text-xs text-muted">
        {t("updated")}
      </footer>
    </main>
  );
}
