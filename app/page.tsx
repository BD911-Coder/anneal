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
  // turunda eskirdi — bu metnin bu tura kadar eskimiş olmasının sebebi buydu.
  //
  // Sayılan küme "ölçümü olan çip" değil, **FPS gösterilebilen seçenek**:
  // türetme indeks gerektiriyor, kartlar da indeksi çiplerinden miras alıyor
  // (K86). Yalnızca ölçülmüş çipler sayılsaydı 46 kart görünmez ve rakam
  // gerçekte gösterilenin çok altında kalırdı.
  const fpsGames = fpsGroups.length;
  const fpsCoveredGpus =
    catalog.gpu.filter((chip) => perfIndexes[chip.id] !== undefined).length +
    catalog.gpu_variant.filter((card) => perfIndexes[card.chip_part_id] !== undefined).length;

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Anneal</h1>
        {/* Üç ayrı durum var ve tek cümlede toplanamazlar: parça bilgisi tam,
            fiyat kısmen var, ölçüm verisi kartların yarısında var. Eski metin
            "ölçüm verisi henüz toplanmadı" diyordu ve bu artık doğru değil —
            60 GPU'da oyun bazlı FPS gösteriliyor. */}
        <p className="text-sm opacity-70">
          Sistem oluşturucu — {toplamParca} parça. Parça bilgileri üretici sayfalarından.
        </p>
        <ul className="mt-1 flex flex-col gap-0.5 text-xs opacity-60">
          <li>
            <span className="font-medium">Oyun bazlı FPS:</span> {fpsGames} oyunda,{" "}
            {fpsCoveredGpus} ekran kartında gösteriliyor. Her sayının ölçüm mü tahmin mi
            olduğu yanında yazılı.
          </li>
          <li>
            <span className="font-medium">Sistem indeksi:</span> ekran kartı ve işlemcinin
            ikisinde de ölçüm gerektiriyor; kataloğun bir bölümünde henüz yok.
          </li>
          <li>
            <span className="font-medium">Fiyat:</span> yalnızca bir bölüm parçada var, tek
            kaynaktan ve tek para biriminde.
          </li>
        </ul>
      </header>

      <Builder
        catalog={catalog}
        prices={prices}
        perfIndexes={perfIndexes}
        fpsGroups={fpsGroups}
      />

      <section className="rounded border p-4">
        <FeedbackForm />
      </section>
    </main>
  );
}
