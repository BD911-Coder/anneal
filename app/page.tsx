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
  const [catalog, prices, perfIndexes] = await Promise.all([
    getBuilderCatalog(),
    getCurrentPrices(),
    // Sayfanın okuduğu sürüm ile motorun ürettiği sürüm hep aynı olmalı.
    getPerfIndexes(MODEL_VERSION),
  ]);

  const toplamParca = Object.values(catalog).reduce((sum, list) => sum + list.length, 0);

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Anneal</h1>
        <p className="text-sm opacity-70">
          Sistem oluşturucu — {toplamParca} parça. Fiyatlar ve performans tahmini örnek
          veridir.
        </p>
      </header>

      <Builder catalog={catalog} prices={prices} perfIndexes={perfIndexes} />

      <section className="rounded border p-4">
        <FeedbackForm />
      </section>
    </main>
  );
}
