import { getFpsGameGroups } from "@/data/benchmarks";
import { getPerfIndexes } from "@/data/perf";
import { getBuilderCatalog } from "@/data/parts";
import { getCurrentPrices } from "@/data/prices";
import { pickDefaultBuild } from "@/engine/default-build";
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
  const olcumluCip = catalog.gpu.filter((chip) => perfIndexes[chip.id] !== undefined).length;
  const olcumluKart = catalog.gpu_variant.filter(
    (card) => perfIndexes[card.chip_part_id] !== undefined,
  ).length;
  const fpsGosterilebilen = olcumluCip + olcumluKart;
  const toplamEkranKarti = catalog.gpu.length + catalog.gpu_variant.length;
  const olcumluCpu = catalog.cpu.filter((cpu) => perfIndexes[cpu.id] !== undefined).length;

  // Sayfa dolu açılsın: ölçümü olan bir ekran kartı + işlemci ve bunlarla
  // uyumlu bir sistem (K144). Sunucuda hesaplanıyor, istemciye yalnızca
  // seçilen id'ler gidiyor.
  const defaultSelection = pickDefaultBuild(catalog, perfIndexes);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:py-12">
      <header className="giris border-b border-border pb-6">
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
        <dl className="mt-5 grid gap-x-6 gap-y-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="font-semibold">Ölçümü olan oyun</dt>
            <dd className="mt-0.5 leading-relaxed text-muted">
              <span className="num font-medium text-foreground">{fpsGames}</span> oyunda FPS
              listesi çıkıyor. Bir oyun, en az üç farklı ekran kartıyla ölçüldüğünde listeye
              giriyor.
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Ölçümü olan ekran kartı</dt>
            <dd className="mt-0.5 leading-relaxed text-muted">
              <span className="num font-medium text-foreground">{olcumluCip}</span> çip
              ölçüldü; kartlar çiplerinin ölçümünü kullandığı için{" "}
              <span className="num font-medium text-foreground">{fpsGosterilebilen}</span>{" "}
              seçenekte FPS görünüyor —{" "}
              <span className="num">{toplamEkranKarti}</span> ekran kartının içinden.
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Ölçümü olan işlemci</dt>
            <dd className="mt-0.5 leading-relaxed text-muted">
              <span className="num font-medium text-foreground">{olcumluCpu}</span> işlemci
              ölçüldü, <span className="num">{catalog.cpu.length}</span> işlemcinin içinden.
              Sistem indeksi ikisinde de ölçüm istiyor.
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Fiyat</dt>
            <dd className="mt-0.5 leading-relaxed text-muted">
              Yalnızca bir bölüm parçada ve tek kaynaktan. Kaynak USD yayınlıyor; ekranda
              elle girilen kurla ₺ gösteriliyor
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
        defaultSelection={defaultSelection}
      />

      <section className="mt-12 border-t border-border pt-6">
        <FeedbackForm />
      </section>
    </main>
  );
}
