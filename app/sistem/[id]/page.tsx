import Link from "next/link";
import { notFound } from "next/navigation";

import { getFpsGameGroups } from "@/data/benchmarks";
import { getBuild } from "@/data/builds";
import { getPerfIndexes } from "@/data/perf";
import { getCurrentPrices } from "@/data/prices";
import { estimateGameFps } from "@/engine/fps-estimate";
import { resolvePerfIndex } from "@/engine/gpu-selection";
import { MODEL_VERSION, bandFor } from "@/engine/performance";
import { RESOLUTION_LABEL, formatIsoDate, formatPriceMinor } from "@/lib/format";

import { FeedbackForm } from "../../feedback-form";
import { GameFpsList } from "../../game-fps";

// Kayıt dondurulmuş olsa da güncel fiyat her açılışta yeniden okunuyor.
export const dynamic = "force-dynamic";

const CATEGORY_LABEL: Record<string, string> = {
  cpu: "İşlemci",
  gpu: "Ekran kartı",
  motherboard: "Anakart",
  ram: "Bellek",
  psu: "Güç kaynağı",
  storage: "Depolama",
  case: "Kasa",
};

export default async function SavedBuildPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const build = await getBuild(id);
  if (!build) notFound();

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
    getPerfIndexes(MODEL_VERSION),
  ]);

  const gpuIndex = resolvePerfIndex(
    perfIndexes,
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
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:py-12">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">{build.title ?? "Kaydedilmiş sistem"}</h1>
        {/* Sayfada artık üç kutu var ve hepsi aynı ana ait değil: dondurulmuş
            değerler o günün, bugünkü fiyat ve oyun bazlı FPS bugünün. Tek
            cümlede "aşağıdaki değerler o günün" demek ikisini karıştırırdı. */}
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          {formatIsoDate(build.created_at)} tarihinde kaydedildi. Dondurulan değerler o
          güne aittir; kesikli çerçeveli kutular bugünün verisiyle hesaplanır.
        </p>
      </header>

      {/* Dondurulmuş değerler */}
      <section className="mt-8 rounded-lg border border-border p-4 sm:p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Kayıt anındaki değerler</h2>

        <div className="flex flex-col gap-3 text-sm">
          <div>
            {/* K124: fiyatsiz parca iceren sistem de kaydedilir; toplam null
                olur ve KISMI toplam yazilmaz. */}
            {build.total_price_minor !== null ? (
              <>
                <output className="num block text-3xl font-semibold tracking-tight">
                  {formatPriceMinor(build.total_price_minor, build.currency ?? "USD")}
                </output>
                <p className="text-sm text-muted">
                  Toplam fiyat — {formatIsoDate(build.created_at)} tarihinde donduruldu
                </p>
              </>
            ) : (
              <>
                <p className="text-sm text-muted">Toplam fiyat dondurulmadı.</p>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  Sistemdeki parçalardan en az birinin kayıt anında fiyatı yoktu. Eksik
                  fiyatla üretilen toplam olduğundan ucuz görünürdü ve donduğu için
                  sonradan düzeltilemezdi; bu yüzden hiç yazılmadı.
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
                  tahmini sistem indeksi — referans sistem <span className="num">100</span>
                </span>
              </p>
              <p className="text-sm text-muted">
                {bandFor(build.perf_index_snapshot)}{" "}
                <span className="text-xs text-muted">(tahmini)</span>
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                {RESOLUTION_LABEL[build.resolution]} için, motor sürümü {build.model_version} ile
                hesaplandı. Gerçek FPS iddiası değildir.
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
              <p className="text-sm text-muted">Performans tahmini için yeterli veri yok.</p>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                Bu sistem {RESOLUTION_LABEL[build.resolution]} seçiliyken kaydedildi. İndeks
                ekran kartı ve işlemcinin ikisini birden gerektiriyor ve her ikisinin de
                ölçüm verisinin bulunmasını şart koşuyor; kaydedildiği anda bu koşul
                sağlanmıyordu. Sistem geçerli; sadece hızı hakkında bir sayı üretilemedi.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Parçalar */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Parçalar ({build.items.length})</h2>
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
                  <span className="text-muted">
                    {CATEGORY_LABEL[item.category] ?? item.category}:
                  </span>{" "}
                  {item.label}
                </div>
                <div className="num mt-0.5 text-xs text-muted">
                  {item.unit_price_minor_at_save !== null
                    ? `Kayıt anında: ${formatPriceMinor(item.unit_price_minor_at_save, build.currency ?? "USD")}`
                    : "Kayıt anında fiyatı yoktu"}
                  {item.current_price_minor !== null ? (
                    <>
                      {" · "}bugün: {formatPriceMinor(item.current_price_minor, build.currency ?? "USD")}
                      {delta !== null && delta !== 0 && (
                        <span className={delta > 0 ? "text-red-700 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"}>
                          {" "}
                          ({delta > 0 ? "+" : ""}
                          {formatPriceMinor(delta, build.currency ?? "USD")})
                        </span>
                      )}
                    </>
                  ) : (
                    <> · bugün fiyatı yok</>
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
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Bugünkü oyun bazlı FPS</h2>
          <p className="mb-4 mt-2 text-xs leading-relaxed text-muted">
            Bu liste <span className="font-medium">dondurulmamıştır</span>: bugünkü ölçüm
            verisiyle ve motor sürümü {MODEL_VERSION} ile hesaplandı. Yukarıdaki sistem
            indeksi ise {formatIsoDate(build.created_at)} tarihinde dondu. Ölçüm verisi
            yalnızca üstüne eklenerek büyüdüğü için bu sayılar zamanla değişebilir.
          </p>
          <GameFpsList
            rows={fpsRows}
            gpuSelected
            resolution={build.resolution}
            hasDataForResolution={fpsGroupsForRes.length > 0}
            cpuIndex={cpuPartId ? perfIndexes[cpuPartId] : undefined}
          />
        </section>
      )}

      {/* Güncel fiyat — ayrı kutu, dondurulmuş değerin üzerine yazılmıyor */}
      <section className="mt-8 rounded-lg border border-dashed border-border p-4 sm:p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Bugünkü fiyat</h2>
        {allPricedNow ? (
          <p className="text-sm">
            <span className="num text-2xl font-semibold tracking-tight">
              {formatPriceMinor(currentTotalMinor, build.currency ?? "USD")}
            </span>{" "}
            <span className="text-xs text-muted">tahmini</span>
            {totalDelta !== null && totalDelta !== 0 && (
              <span className="text-sm text-muted">
                {" — kayıt anına göre "}
                {totalDelta > 0 ? "+" : ""}
                {formatPriceMinor(totalDelta, build.currency ?? "USD")}
              </span>
            )}
          </p>
        ) : (
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            Parçaların bir kısmının güncel fiyatı yok, bugünkü toplam hesaplanamıyor.
          </p>
        )}
        <p className="mt-1 text-xs text-muted">
          Bu sayı bilgi içindir; yukarıdaki dondurulmuş toplamın yerine geçmez.
        </p>
      </section>

      <section className="mt-8 rounded-lg border border-border p-4 sm:p-5">
        <FeedbackForm buildId={build.id} />
      </section>

      <p className="text-sm">
        <Link className="text-accent underline" href="/">
          ← Yeni sistem oluştur
        </Link>
      </p>
    </main>
  );
}
