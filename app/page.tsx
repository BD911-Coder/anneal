import { getTranslations } from "next-intl/server";

import { getFpsGameGroups } from "@/data/benchmarks";
import { getMeasuredPerfIndexes, getResolvedPerfIndexes } from "@/data/perf";
import { getBuilderCatalog } from "@/data/parts";
import { getCurrentPrices } from "@/data/prices";
import { pickDefaultBuild } from "@/engine/default-build";
import { MODEL_VERSION } from "@/engine/performance";
import { SOURCE_CURRENCY } from "@/lib/currency";

import { Builder } from "./builder";
import { FeedbackForm } from "./feedback-form";

// Katalog her istekte veritabanından okunur. Beta'da önbellek yok:
// veri değiştiğinde sayfanın eskimiş kalması, hız kazancından daha kötü.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  // Sunucu bileşeni: çeviri ve dil `next-intl/server`den okunuyor.
  const [t, tParts, tPricing] = await Promise.all([
    getTranslations("common"),
    getTranslations("parts.coverage"),
    getTranslations("pricing"),
  ]);

  // Fiyat ve indeks, katalogla aynı anda okunuyor: üçü de bağımsız sorgu.
  const [catalog, prices, perfIndexes, fpsGroups] = await Promise.all([
    getBuilderCatalog(),
    getCurrentPrices(),
    // Sayfanın okuduğu sürüm ile motorun ürettiği sürüm hep aynı olmalı.
    // Çözümlenmiş indeks: ölçülen kazanır, tahmin boşluğu doldurur ve her
    // kayıt hangisi olduğunu söylüyor (K160).
    getResolvedPerfIndexes(MODEL_VERSION),
    // Oyun bazlı FPS ölçümleri (Faz A.1). Türetilen FPS hiçbir tabloya
    // yazılmaz; burada okunanlar ham ölçümler, hesap istemcide yapılıyor.
    getFpsGameGroups(MODEL_VERSION),
  ]);

  const toplamParca = Object.values(catalog).reduce((sum, list) => sum + list.length, 0);

  // Kapsam sayıları veriden okunuyor, metne gömülmüyor: ölçüm eklendikçe
  // başlıktaki sayı kendiliğinden güncellenir. Elle yazılsaydı ilk veri
  // turunda eskirdi.
  //
  // DİKKAT: `fpsGroups.length` GRUP sayısıdır, oyun sayısı değil. Aynı oyun
  // birden fazla çözünürlükte ölçülmüşse birden fazla grup üretir.
  //
  // `games` tablosunda 32 satır var ama burada 23 çıkıyor ve bu doğru: bir
  // oyun ancak KULLANILABİLİR bir ölçüm grubu bıraktığında sayılıyor. Grup
  // en az üç farklı ekran kartı istiyor ve aynı kartın çelişen değerleri
  // grubu düşürüyor (K125). Aradaki 9 oyun, tek bir karta sabitlenmiş CPU
  // ölçümlerinden geliyor ve FPS listesine giremiyor. Başlıktaki etiket bu
  // yüzden "ölçümü olan oyun" diyor, "oyun" değil (K149).
  const fpsGames = new Set(fpsGroups.map((group) => group.game_id)).size;

  // Ölçüm ÇİP seviyesinde (K86). Kartlar indeksi çiplerinden miras alıyor,
  // bu yüzden ölçümlü bir çipin kartı da FPS gösterebiliyor.
  //
  // İki sayı ayrı ayrı duruyor çünkü ayrı şeyler: `olcumluCip` gerçekten
  // ölçülmüş çip sayısı, `fpsGosterilebilen` ise kullanıcının seçebileceği
  // ve sonuç alabileceği SEÇENEK sayısı. Etiket hangisini saydığını
  // söylemezse, 94 sayısı katalogdaki 213 ekran kartıyla karıştırılıyor.
  // Kapsam artık TAM (K161): her çip ve her işlemci bir değer döndürüyor.
  // Anlamlı sayı "kaç tanesi ÖLÇÜLDÜ" — kalanı tahmin.
  const olculen = (id: string) => perfIndexes[id]?.origin === "measured";
  const olcumluCip = catalog.gpu.filter((chip) => olculen(chip.id)).length;
  const olcumluCpu = catalog.cpu.filter((cpu) => olculen(cpu.id)).length;

  // Sayfa dolu açılsın: ölçümü olan bir ekran kartı + işlemci ve bunlarla
  // uyumlu bir sistem (K144). Sunucuda hesaplanıyor, istemciye yalnızca
  // seçilen id'ler gidiyor.
  // Motor sayı bekliyor, kaynağını değil: düz haritaya indiriliyor.
  const indexValues: Record<string, number> = {};
  for (const [id, r] of Object.entries(perfIndexes)) indexValues[id] = r.value;

  // Varsayılan sistem YALNIZCA ölçülmüş parçalardan kuruluyor (K164).
  // Kapsam tamamlandığı için tahmin edilmiş bir parça da sonuç verirdi, ama
  // kullanıcının gördüğü ilk ekran ölçülmüş veriyi göstermeli: site önce
  // neye dayandığını göstersin, sonra boşluğu nasıl doldurduğunu.
  const measuredOnly = await getMeasuredPerfIndexes(MODEL_VERSION);
  const defaultSelection = pickDefaultBuild(catalog, measuredOnly);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:py-12">
      <header className="giris border-b border-border pb-6">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t("siteName")}</h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted">{t("tagline")}</p>

        {/*
          Üç ayrı durum var ve tek cümlede toplanamazlar: oyun bazlı FPS
          çalışıyor, sistem indeksi kısmen, fiyat çok az parçada. Tek cümleye
          sıkıştırıldığında en kötümser olan hepsini temsil ediyordu.
        */}
        <dl className="mt-5 grid gap-x-6 gap-y-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="font-semibold">{tParts("gamesTitle")}</dt>
            <dd className="mt-0.5 leading-relaxed text-muted">
              {tParts.rich("games", {
                count: fpsGames,
                b: (chunks) => <span className="num font-medium text-foreground">{chunks}</span>,
              })}
            </dd>
          </div>
          <div>
            <dt className="font-semibold">{tParts("gpusTitle")}</dt>
            <dd className="mt-0.5 leading-relaxed text-muted">
              {tParts.rich("gpus", {
                measured: olcumluCip,
                total: catalog.gpu.length,
                b: (chunks) => <span className="num font-medium text-foreground">{chunks}</span>,
              })}
            </dd>
          </div>
          <div>
            <dt className="font-semibold">{tParts("cpusTitle")}</dt>
            <dd className="mt-0.5 leading-relaxed text-muted">
              {tParts.rich("cpus", {
                measured: olcumluCpu,
                total: catalog.cpu.length,
                b: (chunks) => <span className="num font-medium text-foreground">{chunks}</span>,
              })}
            </dd>
          </div>
          <div>
            <dt className="font-semibold">{tPricing("coverageTitle")}</dt>
            <dd className="mt-0.5 leading-relaxed text-muted">
              {tPricing("coverageNote", { source: SOURCE_CURRENCY })}
            </dd>
          </div>
        </dl>

        <p className="mt-4 text-xs text-muted">
          {t.rich("catalogNote", {
            count: toplamParca,
            b: (chunks) => <span className="num">{chunks}</span>,
          })}
        </p>
      </header>

      <Builder
        catalog={catalog}
        prices={prices}
        perfIndexes={perfIndexes}
        fpsGroups={fpsGroups}
        defaultSelection={defaultSelection}
      />

      <section className="mt-12 border-t border-border pt-6">
        <FeedbackForm />
      </section>
    </main>
  );
}
