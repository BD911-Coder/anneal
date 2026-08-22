"use client";

// Oyun bazlı FPS listesi — Faz A.1'in arayüzü.
//
// İki sayfada kullanılıyor: sistem oluşturucu (app/builder.tsx) ve kaydedilmiş
// sistem (app/sistem/[id]/page.tsx). Tek dosyada durmasının sebebi, dürüstlük
// kurallarının iki yerde ayrışmaması:
//
//   K97 — ölçülmüş ve türetilmiş ayrı işaretlenir
//   K98 — FPS'e göre sıralanmaz, alfabetik
//   K99 — tek skorla çeliştiği gizlenmez, listenin başında not
//
// Bu üçü artık METİN olarak burada DEĞİL, `messages/<dil>/performance.json`
// içinde (K150). Kural yine tek yerde: iki sayfa aynı mesaj anahtarlarını
// çağırıyor.

import { useLocale, useTranslations } from "next-intl";

import type { ResolvedIndex } from "@/data/perf";
import { countByOrigin } from "@/engine/fps-estimate";
import { deriveBand } from "@/engine/index-prediction";
import type { GameFpsEstimate } from "@/engine/fps-estimate";
import type { Bottleneck, Resolution } from "@/engine/types";
import { formatNumber } from "@/lib/format";
import { bandFor } from "@/lib/fps-bands";
import { FPS_MARGIN } from "@/lib/fps-margin";

import { CountUp } from "./count-up";

type GameFpsListProps = {
  rows: GameFpsEstimate[];
  /** Sistemde ekran kartı var mı? Yoksa bileşen hiçbir şey çizmez. */
  gpuSelected: boolean;
  /**
   * Kullanıcının seçtiği (ya da sistemin kaydedildiği) çözünürlük.
   *
   * Ölçümün yapıldığı çözünürlükle aynı olmak zorunda değil: bugün elimizde
   * yalnızca 1440p ölçümü var. Farklıysa söylenir — 4K seçmiş birine 1440p
   * sayısı gösterip susmak yanlış olurdu.
   */
  resolution?: Resolution;
  /**
   * Seçili çözünürlükte hiç ölçüm grubu var mı?
   *
   * "Kart kapsam dışı" ile "bu çözünürlükte hiç veri yok" farklı iki durum ve
   * kullanıcıya farklı şey söylerler: birincisinde başka kart seçmek işe
   * yarar, ikincisinde yaramaz.
   */
  hasDataForResolution?: boolean;
  /**
   * Seçilen işlemcinin indeksi ve adı. Liste GPU-sınırlı olduğu için
   * işlemci sayıya girmiyor (K99) — ama kullanıcının işlemcisinin nerede
   * durduğunu SÖYLEMEK, sayıyı değiştirmeden yanıltıcılığı azaltıyor.
   */
  cpuIndex?: number;
  cpuLabel?: string;
  /** Sistem indeksinin darboğaz sonucu (K83). Listeye de bağlanıyor. */
  bottleneck?: Bottleneck | null;
  /**
   * FPS sayıları sayarak mı gelsin?
   *
   * Sistem oluşturucuda evet: liste kullanıcı ekran kartını seçince ekrana
   * girer, sayma o girişin parçası. Kaydedilmiş sistem sayfasında hayır:
   * orada sayı sunucudan geliyor ve zaten boyanmış oluyor — sıfırlayıp
   * saymak titreme olurdu.
   */
  animateNumbers?: boolean;
  /**
   * Bu listenin dayandığı ekran kartı indeksi ölçüldü mü, tahmin mi?
   *
   * Tahminse **türetilen FPS de tahmindir** (K163) ve bandı iki parçadan
   * oluşur: indeksin kendi bandı + FPS türetmesinin ölçülmüş hata payı.
   * Ölçülmüş bir indeksten türeyen satır bu işareti taşımaz; onun hata payı
   * zaten listenin altında yazılı.
   */
  gpuIndexOrigin?: ResolvedIndex;
};

/** İşlemci indeksinin referansı — K73'teki sabit referans parça = 100. */
const REFERANS_CPU_INDEKS = 100;

export function GameFpsList({
  rows,
  gpuSelected,
  resolution,
  hasDataForResolution = true,
  cpuIndex,
  cpuLabel,
  bottleneck,
  animateNumbers = true,
  gpuIndexOrigin,
}: GameFpsListProps) {
  const t = useTranslations("performance");
  const locale = useLocale();

  if (!gpuSelected) return null;

  const sayi = (value: number) => formatNumber(value, locale);

  // İndeks tahminse listenin TAMAMI tahmin: satırların hepsi o indeksten
  // türüyor. Bant, indeksin bandına türetmenin kendi hata payı EKLENEREK
  // bulunuyor — iki hata bağımsız değil, geniş taraftan yanılmak doğru yön.
  const indeksTahmin = gpuIndexOrigin?.origin === "estimated" ? gpuIndexOrigin : null;
  const bilesikBant = indeksTahmin
    ? deriveBand(indeksTahmin.bandPct, FPS_MARGIN.p90Percent)
    : null;

  if (!hasDataForResolution) {
    return (
      <p className="rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-muted">
        {t("fps.noDataForResolution", {
          resolution: resolution ? t(`resolution.${resolution}`) : "",
        })}
      </p>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-muted">
        {t("fps.noDataForCard")}
      </p>
    );
  }

  // K98: FPS'e göre SIRALANMAZ. FPS'e göre dizmek kullanıcıyı "en yüksek sayıyı
  // gör" yönünde koşullandırır; oysa kullanıcı belirli bir oyunu arıyor.
  // Sıralama motorda değil burada: bir sunum kararıdır.
  //
  // Karşılaştırma DİLE göre: `localeCompare` Türkçede ç/ğ/ı/ö/ş/ü'yü doğru
  // yerleştiriyor, İngilizcede farklı bir sıra doğru. Sabit "tr" yazılsaydı
  // İngilizce liste Türkçe alfabeye göre sıralanırdı.
  const sorted = [...rows].sort((a, b) => a.game_name.localeCompare(b.game_name, locale));
  const counts = countByOrigin(rows);

  // Bütün satırlar aynı ayardaysa etiket bir kez başta yazılır; farklıysa satır
  // satır. Bugün tek ayar var, ama ikinci ayar geldiğinde satırın hangi ayarda
  // ölçüldüğü kaybolmamalı.
  const settings = new Set(rows.map((row) => row.setting_label));
  const singleSetting = settings.size === 1 ? [...settings][0] : null;

  return (
    <div className="flex flex-col gap-4">
      {/* K99: tek skor ile bu liste farklı şeyler ölçüyor. Çelişki gerçek ve
          gizlenmiyor. Test sisteminin işlemcisi ölçüm satırlarımızda kayıtlı
          DEĞİL (cpu_part_id boş), o yüzden hangi işlemci olduğu yazılmıyor. */}
      <div className="rounded-md border border-amber-600/35 bg-amber-500/[0.07] p-3 text-xs leading-relaxed">
        <p>
          <strong className="font-semibold">{t("fps.gpuOnlyTitle")}</strong>{" "}
          {t("fps.gpuOnlyBody")}
        </p>
        {cpuIndex !== undefined && (
          <p className="mt-2">
            {t("fps.cpuStanding", {
              label: cpuLabel ? ` (${cpuLabel})` : "",
              index: sayi(cpuIndex),
              reference: sayi(REFERANS_CPU_INDEKS),
            })}{" "}
            {cpuIndex < REFERANS_CPU_INDEKS
              ? t("fps.cpuBelow")
              : cpuIndex > REFERANS_CPU_INDEKS
                ? t("fps.cpuAbove")
                : t("fps.cpuEqual")}
          </p>
        )}
        {bottleneck === "cpu_limited" && (
          <p className="mt-2 font-semibold">{t("fps.cpuLimitedWarning")}</p>
        )}
        {cpuIndex === undefined && <p className="mt-2">{t("fps.noCpuMeasured")}</p>}
      </div>

      {indeksTahmin && (
        <div className="rounded-md border border-dashed border-border bg-surface p-3 text-xs leading-relaxed text-muted">
          <p>
            <span className="font-medium text-foreground">
              {t("estimate.derivedEstimate")}
            </span>{" "}
            {t("estimate.derivedBandNote")}
          </p>
          <p className="mt-1">
            {indeksTahmin.method === "spec-model"
              ? t("estimate.specModelTitle", {
                  band: sayi(indeksTahmin.bandPct),
                  source:
                    indeksTahmin.bandSourceFamily === null
                      ? t("estimate.bandSourceCross")
                      : t("estimate.bandSourceOwn", { family: indeksTahmin.bandSourceFamily }),
                  n: indeksTahmin.nUsed,
                })
              : t("estimate.familyMeanTitle", { n: indeksTahmin.nUsed })}
          </p>
          {indeksTahmin.bandSourceFamily === null && (
            <p className="mt-1">{t("estimate.wideBandNote")}</p>
          )}
        </div>
      )}

      {singleSetting && (
        <p className="text-xs text-muted">
          {t.rich("fps.setting", {
            setting: singleSetting,
            b: (chunks) => <span className="font-medium text-foreground">{chunks}</span>,
          })}
        </p>
      )}

      {/*
        Ölçülmüş / tahmin ayrımı RENGE BAĞLI DEĞİL: ölçülmüş satır dolu bir
        kare ve düz kenarlık taşıyor, tahmin satırı boş kare ve KESİKLİ
        kenarlık. Renk yalnızca üçüncü bir ipucu (WCAG 1.4.1).
      */}
      <ul className="divide-y divide-border overflow-hidden rounded-md border border-border">
        {sorted.map((row) => {
          const band = bandFor(row.fps);
          const olculdu = row.origin === "measured";
          return (
            <li
              key={row.game_id}
              className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2.5 sm:flex-nowrap"
            >
              {/* Oyun adı ÇEVRİLMEZ: eser adı, marka gibi. */}
              <span className="min-w-0 flex-1 truncate text-sm">{row.game_name}</span>

              {/* Sayı ile birimi arasında belirgin hiyerarşi. */}
              <span className="flex shrink-0 items-baseline gap-1">
                <output className="num text-xl font-semibold tracking-tight">
                  {indeksTahmin && (
                    <span aria-hidden="true" className="text-muted">
                      {t("estimate.prefix")}
                    </span>
                  )}
                  <CountUp value={row.fps} animate={animateNumbers} />
                </output>
                <span className="text-[11px] text-muted">{t("fps.unit")}</span>
              </span>

              <span className={`w-32 shrink-0 text-xs ${band.tone}`}>
                {t(`fpsBand.${band.key}`)}
              </span>

              <span
                className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] ${
                  olculdu
                    ? "border border-border bg-surface text-foreground"
                    : "border border-dashed border-border text-muted"
                }`}
                title={
                  olculdu
                    ? t("fps.measuredTitle")
                    : t("fps.estimateTitle", { mean: sayi(FPS_MARGIN.meanPercent) })
                }
              >
                <span aria-hidden="true">{olculdu && !indeksTahmin ? "■" : "□"}</span>{" "}
                {/* İndeks tahminse satır ölçülmüş olsa bile türetilmiş sayılır:
                    ölçüm başka bir kartta yapıldı, bu karta indeksten taşındı. */}
                {olculdu && !indeksTahmin
                  ? t("fps.measured")
                  : t("fps.estimate", {
                      margin: sayi(bilesikBant ?? FPS_MARGIN.p90Percent),
                    })}
              </span>

              {!singleSetting && (
                <span className="shrink-0 text-[11px] text-muted">{row.setting_label}</span>
              )}
            </li>
          );
        })}
      </ul>

      <div className="space-y-1 text-xs leading-relaxed text-muted">
        <p>
          {t.rich("fps.counts", {
            measured: counts.measured,
            derived: counts.derived,
            b: (chunks) => <span className="num font-medium text-foreground">{chunks}</span>,
          })}
        </p>
        <p>
          {t("fps.marginNote", {
            mean: sayi(FPS_MARGIN.meanPercent),
            p90: sayi(FPS_MARGIN.p90Percent),
            max: sayi(FPS_MARGIN.maxPercent),
            // `FPS_MARGIN.method` TÜRKÇE bir cümle ve o dosyaya
            // dokunulmuyor; yöntemin adı çeviri dosyasından okunuyor.
            method: t("fps.method"),
            measuredAt: FPS_MARGIN.measuredAt,
          })}
        </p>
        <p>{t("fps.bandNote")}</p>
      </div>
    </div>
  );
}
