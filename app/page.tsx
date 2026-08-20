import { getFpsGameGroups } from "@/data/benchmarks";
import { getPerfIndexes } from "@/data/perf";
import { getBuilderCatalog } from "@/data/parts";
import { getCurrentPrices } from "@/data/prices";
import { MODEL_VERSION } from "@/engine/performance";

import { Builder } from "./builder";
import { FeedbackForm } from "./feedback-form";

// Katalog her istekte veritabanından okunur. Beta'da önbellek yok:
// veri değiştiğinde sayfanın eskimiş kalması, hız kazancından daha kötü.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  // Fiyat ve indeks, katalogla aynı anda okunuyor: üçü de bağımsız sorgu.
  const [catalog, prices, perfIndexes, fpsGroups] = await Promise.all([
    getBuilderCatalog(),
    getCurrentPrices(),
    // Sayfanın okuduğu sürüm ile motorun ürettiği sürüm hep aynı olmalı.
    getPerfIndexes(MODEL_VERSION),
    // Oyun bazlı FPS ölçümleri (Faz A.1). Türetilen FPS hiçbir tabloya
    // yazılmaz; burada okunanlar ham ölçümler, hesap istemcide yapılıyor.
    getFpsGameGroups(MODEL_VERSION),
  ]);

  const toplamParca = Object.values(catalog).reduce((sum, list) => sum + list.length, 0);

  // Kapsam sayıları veriden okunuyor, metne gömülmüyor: ölçüm eklendikçe
  // başlıktaki sayı kendiliğinden güncellenir. Elle yazılsaydı ilk veri
  // turunda eskirdi — bu metnin bu tura kadar eskimesinin sebebi buydu.
  //
  // DİKKAT: `fpsGroups.length` GRUP sayısıdır, oyun sayısı değil. Aynı oyun
  // birden fazla çözünürlükte ölçülmüşse birden fazla grup üretir.
  const fpsGames = new Set(fpsGroups.map((group) => group.game_id)).size;
  // Sayılan küme "ölçümü olan çip" değil, **FPS gösterilebilen seçenek**:
  // türetme indeks gerektiriyor ve kartlar indeksi çiplerinden miras alıyor.
  const fpsCoveredGpus =
    catalog.gpu.filter((chip) => perfIndexes[chip.id] !== undefined).length +
    catalog.gpu_variant.filter((card) => perfIndexes[card.chip_part_id] !== undefined).length;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:py-12">
      <header className="border-b border-border pb-6">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Anneal</h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted">
          Donanım seç, ne performans alacağını gör. Her sayının nereden geldiği yanında
          yazılı — ölçüm mü, hesap mı.
        </p>

        {/*
          Üç ayrı durum var ve tek cümlede toplanamazlar: oyun bazlı FPS
          çalışıyor, sistem indeksi kısmen, fiyat çok az parçada. Tek cümleye
          sıkıştırıldığında en kötümser olan hepsini temsil ediyordu.
        */}
        <dl className="mt-5 grid gap-x-6 gap-y-3 text-xs sm:grid-cols-3">
          <div>
            <dt className="font-semibold">Oyun bazlı FPS</dt>
            <dd className="mt-0.5 leading-relaxed text-muted">
              <span className="num font-medium text-foreground">{fpsGames}</span> oyun,{" "}
              <span className="num font-medium text-foreground">{fpsCoveredGpus}</span> ekran
              kartı
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Sistem indeksi</dt>
            <dd className="mt-0.5 leading-relaxed text-muted">
              İşlemci ve ekran kartının ikisinde de ölçüm gerekiyor; kataloğun bir bölümünde
              henüz yok
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Fiyat</dt>
            <dd className="mt-0.5 leading-relaxed text-muted">
              Yalnızca bir bölüm parçada, tek kaynaktan ve tek para biriminde
            </dd>
          </div>
        </dl>

        <p className="mt-4 text-xs text-muted">
          Katalog: <span className="num">{toplamParca}</span> parça, bilgiler üretici
          sayfalarından.
        </p>
      </header>

      <Builder
        catalog={catalog}
        prices={prices}
        perfIndexes={perfIndexes}
        fpsGroups={fpsGroups}
      />

      <section className="mt-12 border-t border-border pt-6">
        <FeedbackForm />
      </section>
    </main>
  );
}
