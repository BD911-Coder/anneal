import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { getFpsGameGroups } from "@/data/benchmarks";
import { getBuild } from "@/data/builds";
import { getResolvedPerfIndexes } from "@/data/perf";
import { getCurrentPrices } from "@/data/prices";
import { estimateGameFps } from "@/engine/fps-estimate";
import { resolvePerfIndex } from "@/engine/gpu-selection";
import { MODEL_VERSION, bandKeyFor } from "@/engine/performance";
import { DISPLAY_CURRENCY, SOURCE_CURRENCY, USD_TRY, isConverted } from "@/lib/currency";
import {
  formatDisplayPrice,
  formatIsoDate,
  formatNumber,
  formatPriceMinor,
} from "@/lib/format";

import { FeedbackForm } from "../../feedback-form";
import { GameFpsList } from "../../game-fps";
import { IndexBar } from "../../index-bar";

// Kayıt dondurulmuş olsa da güncel fiyat her açılışta yeniden okunuyor.
export const dynamic = "force-dynamic";

export default async function SavedBuildPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const build = await getBuild(id);
  if (!build) notFound();

  const [t, tPerf, tPrice, tCommon, tParts, locale] = await Promise.all([
    getTranslations("pricing.saved"),
    getTranslations("performance"),
    getTranslations("pricing"),
    getTranslations("common"),
    getTranslations("parts"),
    getLocale(),
  ]);

  const sayi = (value: number) => formatNumber(value, locale);
  const fiyat = (minor: number) =>
    formatDisplayPrice(minor, build.currency ?? SOURCE_CURRENCY, locale) ??
    tPrice("unconvertible", { currency: build.currency ?? SOURCE_CURRENCY });

  // Çevrim yapılmadıysa kur cümlesi de yok (K157): varsayılan gösterim
  // kaynağın kendi para birimi ve o hâlde anlatılacak bir işlem yok.
  const kurNotu = !isConverted(SOURCE_CURRENCY, DISPLAY_CURRENCY)
    ? tPrice("rateNoteNone", { source: SOURCE_CURRENCY })
    : tPrice(USD_TRY.manual ? "rateNoteManual" : "rateNoteAuto", {
        source: SOURCE_CURRENCY,
    // Kur da bir para tutarı: sembolü ve ondalık ayracı dile göre çıksın diye
    // `Intl`in para biçimlendiricisinden geçiyor.
        rate: formatPriceMinor(USD_TRY.rateMinor, "TRY", locale),
        date: formatIsoDate(USD_TRY.quotedAt, locale),
      });

  // Güncel fiyat ayrıca gösterilir ama dondurulmuş değerin üzerine YAZILMAZ
  // (SCHEMA.md bölüm 5). İki sayı yan yana durur.
  const currentPrices = await getCurrentPrices();

  // --- Oyun bazlı FPS: DONDURULMUŞ DEĞİL, bugünkü hesap (K102) -------------
  //
  // Üç sebep:
  //
  // 1. Dondurulmuş bir FPS yok ve olamaz. `builds` tablosunda FPS alanı
  //    bulunmuyor; eklemek şema değişikliği olurdu ve K100'ü ihlal ederdi
  //    (türetilen FPS hiçbir tabloya yazılmaz).
  // 2. Bu sayfada aynı sorunun kurulmuş cevabı zaten var: fiyat. Dondurulmuş
  //    toplam "Kayıt anındaki değerler"de, güncel fiyat ayrı kutuda; biri
  //    diğerinin üstüne yazmıyor. FPS de o desene giriyor.
  // 3. Donmanın sebebi FPS'te yok. `perf_index_snapshot` donuyor çünkü
  //    `model_version` değişebilir ve eski kaydın sayısını yeni motorunkiyle
  //    karşılaştırmak iki ayrı cetveli karıştırmak olur. FPS'in altındaki
  //    `benchmark_points` ise append-only ÖLÇÜM: geçmişe dönük değişmiyor,
  //    yalnızca üstüne ekleniyor. Bugünkü sayı kayıt anındakinden ancak daha
  //    çok ölçüm olduğu için farklı çıkar — bu bozulma değil iyileşme.
  //
  // Ayrıca: bugünden önce kaydedilmiş sistemlerde bu liste hiç yoktu. Onlar
  // için "kayıt anındaki FPS" diye bir şey zaten mevcut değil.
  const [fpsGroups, perfIndexes] = await Promise.all([
    getFpsGameGroups(MODEL_VERSION),
    getResolvedPerfIndexes(MODEL_VERSION),
  ]);

  // Motor sayı bekliyor; çözümlenmiş kayıttan düz haritaya iniyoruz.
  const indexValues: Record<string, number> = {};
  for (const [id, r] of Object.entries(perfIndexes)) indexValues[id] = r.value;

  const gpuIndex = resolvePerfIndex(
    indexValues,
    build.gpu_chip_part_id,
    build.gpu_variant_part_id,
  );
  // Ölçüm ve indeks çip seviyesinde (K86); kart kaydedilmişse de çipin id'si
  // gider.
  const fpsPartId =
    gpuIndex.origin === "variant" ? build.gpu_variant_part_id : build.gpu_chip_part_id;
  // Kaydedilen sistemin çözünürlüğü dondurulmuş (K43); liste onu izler.
  const fpsGroupsForRes = fpsGroups.filter((group) => group.resolution === build.resolution);
  const fpsRows = estimateGameFps(fpsPartId, gpuIndex.value, fpsGroupsForRes);
  // Kaydedilen sistemin işlemcisi — liste GPU-sınırlı olduğu için sayıya
  // girmiyor, ama nerede durduğu söyleniyor (çerçeve düzeltmesi).
  const cpuPartId = build.items.find((i) => i.category === "cpu")?.part_id;

  const currentItems = build.items.map((item) => ({
    ...item,
    current_price_minor: currentPrices[item.part_id]?.price_minor ?? null,
  }));

  const pricedNow = currentItems.filter((item) => item.current_price_minor !== null);
  const allPricedNow = pricedNow.length === currentItems.length;
  const currentTotalMinor = pricedNow.reduce(
    (sum, item) => sum + (item.current_price_minor ?? 0),
    0,
  );
  // Dondurulmus toplam yoksa fark da yok (K124).
  const totalDelta =
    build.total_price_minor === null ? null : currentTotalMinor - build.total_price_minor;

  return (
    // `sonuclar`: bölümler sırayla belirir (app/globals.css).
    <main className="sonuclar mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:py-12">
      <header className="giris">
        <h1 className="text-3xl font-semibold tracking-tight">
          {build.title ?? t("frozenHeading")}
        </h1>
        {/* Sayfada artık üç kutu var ve hepsi aynı ana ait değil: dondurulmuş
            değerler o günün, bugünkü fiyat ve oyun bazlı FPS bugünün. Tek
            cümlede "aşağıdaki değerler o günün" demek ikisini karıştırırdı. */}
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          {t("intro", { date: formatIsoDate(build.created_at, locale) })}
        </p>
      </header>

      {/* Dondurulmuş değerler */}
      <section className="cam mt-8 rounded-lg border border-border p-4 sm:p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
          {t("frozenHeading")}
        </h2>

        <div className="flex flex-col gap-3 text-sm">
          <div>
            {/* K124: fiyatsiz parca iceren sistem de kaydedilir; toplam null
                olur ve KISMI toplam yazilmaz. */}
            {build.total_price_minor !== null ? (
              <>
                <output className="num block text-3xl font-semibold tracking-tight">
                  {fiyat(build.total_price_minor)}
                </output>
                <p className="text-sm text-muted">
                  {t("totalFrozen", { date: formatIsoDate(build.created_at, locale) })}
                </p>
                {/*
                  DONAN ŞEY KAYNAĞIN SAYISI, ekrandaki değil (K148). Kayıt
                  {build.currency ?? "USD"} olarak dondu ve o sayı değişmiyor;
                  ekrandaki ₺ karşılığı bugünkü kurla hesaplanıyor, yani kur
                  değişirse bu satır da değişir.
                */}
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  {t("frozenCurrencyNote", {
                    currency: build.currency ?? SOURCE_CURRENCY,
                    target: DISPLAY_CURRENCY,
                  })}
                </p>
              </>
            ) : (
              <>
                <p className="text-sm text-muted">{t("totalNotFrozen")}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  {t("totalNotFrozenWhy")}
                </p>
              </>
            )}
          </div>

          {build.perf_index_snapshot !== null ? (
            <div>
              <p>
                <output className="num text-3xl font-semibold tracking-tight">
                  {build.perf_index_snapshot}
                </output>
                {/* K73: 100 tavan degil, sabit referans sistemin degeri. */}
                <span className="ml-2 text-sm font-normal text-muted">
                  {tPerf.rich("systemIndex.suffix", {
                    reference: sayi(100),
                    b: (chunks) => <span className="num">{chunks}</span>,
                  })}
                </span>
              </p>
              <IndexBar value={build.perf_index_snapshot} />
              <p className="mt-2 text-sm text-muted">
                {tPerf(`band.${bandKeyFor(build.perf_index_snapshot)}`)}{" "}
                <span className="text-xs text-muted">({tCommon("estimated")})</span>
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                {t("frozenIndexNote", {
                  resolution: tPerf(`resolution.${build.resolution}`),
                  modelVersion: build.model_version,
                })}
              </p>
            </div>
          ) : (
            // İndeks yerine 0 yazılmıyor: hesaplanamadı ile "çok yavaş" aynı şey
            // değil (K44). Sebebi yazılıyor.
            //
            // Sebep iki türlü olabilir ve kayıt hangisi olduğunu taşımıyor:
            // sistemde ekran kartı ya da işlemci yoktu, veya o parçaların ölçüm
            // verisi henüz toplanmamıştı (K71). İkisini de kapsayan bir cümle
            // yazılıyor — kayda bakıp hangisi olduğunu uydurmaktansa.
            <div>
              <p className="text-sm text-muted">{t("noIndexTitle")}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                {t("noIndexWhy", { resolution: tPerf(`resolution.${build.resolution}`) })}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Parçalar */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
          {t("partsHeading", { count: build.items.length })}
        </h2>
        <ul className="flex flex-col gap-2 text-sm">
          {currentItems.map((item) => {
            // Fark ancak IKI fiyat da varsa hesaplanir (K124).
            const delta =
              item.current_price_minor === null || item.unit_price_minor_at_save === null
                ? null
                : item.current_price_minor - item.unit_price_minor_at_save;
            return (
              <li key={item.part_id} className="border-l-2 border-border pl-3">
                <div>
                  <span className="text-muted">{tParts(`category.${item.category}`)}:</span>{" "}
                  {item.label}
                </div>
                <div className="num mt-0.5 text-xs text-muted">
                  {item.unit_price_minor_at_save !== null
                    ? t("atSave", { price: fiyat(item.unit_price_minor_at_save) })
                    : t("noPriceAtSave")}
                  {item.current_price_minor !== null ? (
                    <>
                      {" · "}
                      {t("today", { price: fiyat(item.current_price_minor) })}
                      {delta !== null && delta !== 0 && (
                        <span className={delta > 0 ? "text-red-700 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"}>
                          {" ("}
                          {delta > 0 ? "+" : ""}
                          {fiyat(delta)}
                          {")"}
                        </span>
                      )}
                    </>
                  ) : (
                    <> · {t("noPriceToday")}</>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Oyun bazlı FPS — ayrı kutu, dondurulmuş değerin üzerine yazılmıyor.
          Kesikli çerçeve "bu sayı bugünün" demenin görsel karşılığı; bugünkü
          fiyat kutusuyla aynı dil. */}
      {build.gpu_chip_part_id !== undefined && (
        <section className="mt-8 rounded-lg border border-dashed border-border p-4 sm:p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
            {t("todayFpsHeading")}
          </h2>
          <p className="mb-4 mt-2 text-xs leading-relaxed text-muted">
            {t.rich("todayFpsNote", {
              modelVersion: MODEL_VERSION,
              date: formatIsoDate(build.created_at, locale),
              b: (chunks) => <span className="font-medium">{chunks}</span>,
            })}
          </p>
          <GameFpsList
            rows={fpsRows}
            gpuSelected
            resolution={build.resolution}
            hasDataForResolution={fpsGroupsForRes.length > 0}
            cpuIndex={cpuPartId ? indexValues[cpuPartId] : undefined}
            gpuIndexOrigin={
              // Kaydedilen sistemin FPS listesi bugünkü indeksle hesaplanıyor
              // (K102); o indeks tahmin ise liste de tahmin işareti taşır.
              fpsPartId ? perfIndexes[fpsPartId] : undefined
            }
            // Sayılar sunucudan geliyor ve zaten boyanmış: sayma titreme olurdu.
            animateNumbers={false}
          />
        </section>
      )}

      {/* Güncel fiyat — ayrı kutu, dondurulmuş değerin üzerine yazılmıyor */}
      <section className="mt-8 rounded-lg border border-dashed border-border p-4 sm:p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
          {t("todayHeading")}
        </h2>
        {allPricedNow ? (
          <p className="text-sm">
            <span className="num text-2xl font-semibold tracking-tight">
              {fiyat(currentTotalMinor)}
            </span>{" "}
            <span className="text-xs text-muted">{tCommon("estimated")}</span>
            {totalDelta !== null && totalDelta !== 0 && (
              <span className="text-sm text-muted">
                {" "}
                {t("todayVsSaved", {
                  delta: (totalDelta > 0 ? "+" : "") + fiyat(totalDelta),
                })}
              </span>
            )}
          </p>
        ) : (
          <p className="mt-1.5 text-sm leading-relaxed text-muted">{t("todayIncomplete")}</p>
        )}
        <p className="mt-1 text-xs leading-relaxed text-muted">
          {t("todayNote")} {kurNotu}
        </p>
      </section>

      <section className="mt-8 rounded-lg border border-border p-4 sm:p-5">
        <FeedbackForm buildId={build.id} />
      </section>

      <p className="text-sm">
        <Link className="text-accent underline" href="/">
          {tCommon("backToBuilder")}
        </Link>
      </p>
    </main>
  );
}
