import Link from "next/link";
import { notFound } from "next/navigation";

import { getBuild } from "@/data/builds";
import { getCurrentPrices } from "@/data/prices";
import { bandFor } from "@/engine/performance";
import type { Resolution } from "@/engine/types";
import { formatIsoDate, formatPriceMinor } from "@/lib/format";

import { FeedbackForm } from "../../feedback-form";

// Kayıt dondurulmuş olsa da güncel fiyat her açılışta yeniden okunuyor.
export const dynamic = "force-dynamic";

// Motorun tanıdığı değer '2160p'; "4K" sadece ekranda yazan ad.
const RESOLUTION_LABEL: Record<Resolution, string> = {
  "1080p": "1080p",
  "1440p": "1440p",
  "2160p": "4K",
};

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
  const totalDelta = currentTotalMinor - build.total_price_minor;

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">{build.title ?? "Kaydedilmiş sistem"}</h1>
        <p className="text-sm opacity-70">
          {formatIsoDate(build.created_at)} tarihinde kaydedildi. Aşağıdaki değerler o günün
          değerleridir.
        </p>
      </header>

      {/* Dondurulmuş değerler */}
      <section className="rounded border p-4">
        <h2 className="mb-3 text-lg font-semibold">Kayıt anındaki değerler</h2>

        <div className="flex flex-col gap-3 text-sm">
          <div>
            <p className="text-2xl font-semibold">
              {formatPriceMinor(build.total_price_minor, build.currency)}
            </p>
            <p className="opacity-70">
              Toplam fiyat — {formatIsoDate(build.created_at)} tarihinde donduruldu
            </p>
          </div>

          {build.perf_index_snapshot !== null ? (
            <div>
              <p className="text-xl font-semibold">
                {build.perf_index_snapshot}
                <span className="text-sm font-normal opacity-60"> / 100</span>{" "}
                <span className="text-xs font-normal opacity-60">tahmini sistem indeksi</span>
              </p>
              <p className="opacity-70">
                {bandFor(build.perf_index_snapshot)}{" "}
                <span className="text-xs opacity-60">(tahmini)</span>
              </p>
              <p className="text-xs opacity-50">
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
              <p className="opacity-70">Performans tahmini için yeterli veri yok.</p>
              <p className="text-xs opacity-50">
                Bu sistem {RESOLUTION_LABEL[build.resolution]} seçiliyken kaydedildi. İndeks
                ekran kartı ve işlemcinin ikisini birden gerektiriyor ve her ikisinin de
                ölçüm verisinin bulunmasını şart koşuyor; kaydedildiği anda bu koşul
                sağlanmıyordu. Sistem geçerli, fiyatı dondu; sadece hızı hakkında bir sayı
                üretilemedi.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Parçalar */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Parçalar ({build.items.length})</h2>
        <ul className="flex flex-col gap-2 text-sm">
          {currentItems.map((item) => {
            const delta =
              item.current_price_minor === null
                ? null
                : item.current_price_minor - item.unit_price_minor_at_save;
            return (
              <li key={item.part_id} className="border-l-4 border-neutral-300 pl-3">
                <div>
                  <span className="opacity-60">
                    {CATEGORY_LABEL[item.category] ?? item.category}:
                  </span>{" "}
                  {item.label}
                </div>
                <div className="text-xs opacity-70">
                  Kayıt anında: {formatPriceMinor(item.unit_price_minor_at_save, build.currency)}
                  {item.current_price_minor !== null ? (
                    <>
                      {" · "}bugün: {formatPriceMinor(item.current_price_minor, build.currency)}
                      {delta !== null && delta !== 0 && (
                        <span className={delta > 0 ? "text-red-600" : "text-green-700"}>
                          {" "}
                          ({delta > 0 ? "+" : ""}
                          {formatPriceMinor(delta, build.currency)})
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

      {/* Güncel fiyat — ayrı kutu, dondurulmuş değerin üzerine yazılmıyor */}
      <section className="rounded border border-dashed p-4">
        <h2 className="mb-2 text-lg font-semibold">Bugünkü fiyat</h2>
        {allPricedNow ? (
          <p className="text-sm">
            <span className="text-xl font-semibold">
              {formatPriceMinor(currentTotalMinor, build.currency)}
            </span>{" "}
            <span className="text-xs opacity-60">tahmini</span>
            {totalDelta !== 0 && (
              <span className="opacity-70">
                {" — kayıt anına göre "}
                {totalDelta > 0 ? "+" : ""}
                {formatPriceMinor(totalDelta, build.currency)}
              </span>
            )}
          </p>
        ) : (
          <p className="text-sm opacity-70">
            Parçaların bir kısmının güncel fiyatı yok, bugünkü toplam hesaplanamıyor.
          </p>
        )}
        <p className="mt-1 text-xs opacity-60">
          Bu sayı bilgi içindir; yukarıdaki dondurulmuş toplamın yerine geçmez.
        </p>
      </section>

      <section className="rounded border p-4">
        <FeedbackForm buildId={build.id} />
      </section>

      <p className="text-sm">
        <Link className="underline" href="/">
          ← Yeni sistem oluştur
        </Link>
      </p>
    </main>
  );
}
