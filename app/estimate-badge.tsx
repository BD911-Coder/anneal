"use client";

import { useLocale, useTranslations } from "next-intl";

import type { ResolvedIndex } from "@/data/perf";
import { formatNumber } from "@/lib/format";

/**
 * Tahmin edilmiş bir sayının yanındaki işaret.
 *
 * ÜÇ İPUCU, HİÇBİRİ TEK BAŞINA RENGE BAĞLI DEĞİL (WCAG 1.4.1, K132 deseni):
 *   1. sayının önünde `≈`
 *   2. yanında bandın kendisi — `±31%`
 *   3. metin etiketi — "spec'ten tahmin" / "aile ortalaması"
 *
 * `family-mean` AYRI etiketleniyor: o bir model çıktısı değil, ailenin
 * ölçülmüş ortalaması. İkisini aynı kelimeyle anlatmak, ortalamayı olduğundan
 * bilgili göstermek olurdu.
 */
export function EstimateBadge({ index }: { index: ResolvedIndex }) {
  const t = useTranslations("performance.estimate");
  const locale = useLocale();

  if (index.origin === "measured") return null;

  const bant = t("band", { band: formatNumber(index.bandPct, locale) });
  const kaynak =
    index.bandSourceFamily === null
      ? t("bandSourceCross")
      : t("bandSourceOwn", { family: index.bandSourceFamily });

  return (
    <span
      className="inline-flex shrink-0 items-baseline gap-1 rounded border border-dashed border-border px-1.5 py-0.5 text-[11px] text-muted"
      title={
        index.method === "spec-model"
          ? t("specModelTitle", {
              band: formatNumber(index.bandPct, locale),
              source: kaynak,
              n: index.nUsed,
            })
          : t("familyMeanTitle", { n: index.nUsed })
      }
    >
      <span className="num">{bant}</span>
      <span>·</span>
      <span>
        {index.method === "spec-model" ? t("specModelLabel") : t("familyMeanLabel")}
      </span>
    </span>
  );
}

/**
 * Tahmin edilmiş sayının kendisi: `≈124`.
 *
 * Ölçülmüşse hiçbir şey eklemiyor — ölçülen sayı süslenmez.
 */
export function EstimatePrefix({ index }: { index: ResolvedIndex }) {
  const t = useTranslations("performance.estimate");
  if (index.origin === "measured") return null;
  return (
    <span aria-hidden="true" className="text-muted">
      {t("prefix")}
    </span>
  );
}
