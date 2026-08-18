import { getBuilderCatalog } from "@/data/parts";

import { Builder } from "./builder";

// Katalog her istekte veritabanından okunur. Beta'da önbellek yok:
// veri değiştiğinde sayfanın eskimiş kalması, hız kazancından daha kötü.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const catalog = await getBuilderCatalog();
  const toplamParca = Object.values(catalog).reduce((sum, list) => sum + list.length, 0);

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Anneal</h1>
        <p className="text-sm opacity-70">
          Sistem oluşturucu — {toplamParca} parça. Fiyat ve performans henüz yok.
        </p>
      </header>

      <Builder catalog={catalog} />
    </main>
  );
}
