"use client";

import { useState } from "react";

import type { CurrentPrice } from "@/data/prices";
import type { BuilderCatalog } from "@/data/parts";
import { checkCompatibility } from "@/engine/compatibility";
import { estimateGameFps } from "@/engine/fps-estimate";
import type { FpsGameGroup } from "@/engine/fps-estimate";
import { resolveGpuSelection, resolvePerfIndex } from "@/engine/gpu-selection";
import { computePerformance } from "@/engine/performance";
import { suggestUpgrades } from "@/engine/upgrade";
import type {
  BuildInput,
  Finding,
  Resolution,
  UpgradeCategory,
  UpgradePart,
} from "@/engine/types";
import { formatIsoDate, formatPriceMinor } from "@/lib/format";
import { PERF_MARGIN } from "@/lib/perf-margin";

import { saveBuildAction } from "./actions";
import { GameFpsList } from "./game-fps";

// Motora giden kategoriler. Depolama burada yok: hiçbir uyumluluk kuralı
// depolamayı kullanmıyor (S12), ama kullanıcı yine de birden fazla disk seçebilir.
const ENGINE_CATEGORIES = ["cpu", "gpu", "motherboard", "ram", "psu", "case"] as const;
type EngineCategory = (typeof ENGINE_CATEGORIES)[number];

const CATEGORY_LABEL: Record<EngineCategory, string> = {
  cpu: "İşlemci",
  gpu: "Ekran kartı",
  motherboard: "Anakart",
  ram: "Bellek",
  psu: "Güç kaynağı",
  case: "Kasa",
};

// Motorun tanıdığı değer '2160p'; "4K" sadece ekranda yazan ad.
const RESOLUTIONS: { value: Resolution; label: string }[] = [
  { value: "1080p", label: "1080p" },
  { value: "1440p", label: "1440p" },
  { value: "2160p", label: "4K" },
];

type Selection = Partial<Record<EngineCategory, string>>;

type BuilderProps = {
  catalog: BuilderCatalog;
  prices: Record<string, CurrentPrice>;
  perfIndexes: Record<string, number>;
  fpsGroups: FpsGameGroup[];
};

export function Builder({ catalog, prices, perfIndexes, fpsGroups }: BuilderProps) {
  const [selection, setSelection] = useState<Selection>({});
  // Kart (AIB) seçimi çipten ayrı bir durum: opsiyonel ikinci katman (K86).
  // Çip değişince sıfırlanır — başka çipin kartı seçili kalamaz.
  const [gpuVariantId, setGpuVariantId] = useState<string | undefined>(undefined);
  const [storageIds, setStorageIds] = useState<string[]>([]);
  const [resolution, setResolution] = useState<Resolution>("1440p");
  const [budgetText, setBudgetText] = useState("");
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // --- Ekran kartı: çip + opsiyonel kart -------------------------------------
  const gpuChipId = selection.gpu;
  const gpuChip = catalog.gpu.find((item) => item.id === gpuChipId);
  const variantsForChip = catalog.gpu_variant.filter(
    (variant) => variant.chip_part_id === gpuChipId,
  );
  const gpuVariant = variantsForChip.find((variant) => variant.id === gpuVariantId);
  // Hangi sayının kurala gireceğine motor karar veriyor (K87), arayüz değil.
  const resolvedGpu = gpuChip ? resolveGpuSelection(gpuChip.spec, gpuVariant?.spec) : undefined;
  // Satın alınan, fiyatı toplanan ve sisteme kaydedilen satır: kart seçiliyse kart.
  const gpuPartId = gpuVariant?.id ?? gpuChipId;

  // Seçilen id'lerden motorun beklediği girdiyi kur.
  //
  // useMemo yok: en fazla altı parça aranıyor ve uyumluluk kontrolü on bir
  // kuraldan ibaret. Her çizimde yeniden hesaplamak, önbelleği doğru tutmaya
  // çalışmaktan ucuz — dosyanın geri kalanı da (fiyat toplamı, yükseltme
  // önerisi) aynı sebeple memo kullanmıyor.
  const buildInput: BuildInput = {};
  for (const category of ENGINE_CATEGORIES) {
    // Ekran kartı yukarıda ayrıca kuruldu: çip ile kartın birleşimi.
    if (category === "gpu") continue;
    const id = selection[category];
    if (!id) continue;
    const item = catalog[category].find((candidate) => candidate.id === id);
    if (item) {
      // Her kategorinin spec tipi farklı; atama kategori bazında güvenli.
      (buildInput as Record<string, unknown>)[category] = item.spec;
    }
  }
  if (resolvedGpu) buildInput.gpu = resolvedGpu.gpu;

  const findings = checkCompatibility(buildInput);
  const errors = findings.filter((finding) => finding.level === "error");
  const warnings = findings.filter((finding) => finding.level === "warning");

  // Uzunluk hiçbir seviyeden okunamadıysa C5 çalışamaz (K52, K87). Kasa
  // seçilmemişse zaten çalışmazdı; uyarı yine de gösteriliyor çünkü kullanıcı
  // kasayı sonra seçecek.
  const gpuLengthUnknown = resolvedGpu?.length_origin === "unknown";
  // Kart seçili ama TBP'si yayınlanmamış: güç hesabı çipin referans değeriyle
  // yapıldı (K87). Sessiz kalmak, kartın kendi değeriyle hesaplanmış gibi olurdu.
  const gpuTdpFromReference =
    gpuVariant !== undefined && resolvedGpu?.tdp_origin === "chip_reference";
  // Aynı durum güç kaynağı için (K62): uzunluk bilinmiyorsa W5 çalışamaz.
  const psuLengthUnknown = buildInput.psu !== undefined && buildInput.psu.length_mm === undefined;

  const selectedStorage = catalog.storage.filter((item) => storageIds.includes(item.id));
  const secilenSayisi = Object.values(selection).filter(Boolean).length + selectedStorage.length;

  // Seçilen bütün parçaların id'si — fiyat toplamı bunun üzerinden yürüyor.
  // Ekran kartında kart seçiliyse kartın id'si gider: fiyat kartın fiyatıdır,
  // kaydedilen de odur (K86).
  const selectedPartIds = [
    ...ENGINE_CATEGORIES.map((category) =>
      category === "gpu" ? gpuPartId : selection[category],
    ).filter((id): id is string => Boolean(id)),
    ...storageIds,
  ];

  // Toplam fiyat tamamen tam sayıyla (kuruş) toplanıyor; float'a hiç geçilmiyor.
  // useMemo yok: en fazla on parça toplanıyor, her çizimde yeniden hesaplamak
  // önbelleği doğru tutmaya çalışmaktan ucuz.
  const priceSummary = summarizePrice(selectedPartIds, prices);

  const cpuId = selection.cpu;

  // İndeks iki seviyeli okunur: kartın kendi ölçümü varsa o, yoksa çipinki (K86).
  // Bugün kart indeksi hiç yok, o yüzden origin her zaman "chip" çıkıyor —
  // ama arayüz bunu söylemek zorunda, çipin sayısı kartın ölçümü değildir.
  const gpuIndex = resolvePerfIndex(perfIndexes, gpuChipId, gpuVariantId);

  // Darboğaz göstergesi "bu parçayı katalogdaki en iyisiyle değiştirsem ne
  // kazanırım?" diye soruyor (K83). Motor katalogu tanımıyor; en iyileri
  // burada bulup girdi olarak veriyoruz.
  const bestIndex = (items: { id: string }[]) => {
    const values = items.map((item) => perfIndexes[item.id]).filter((v) => v !== undefined);
    return values.length > 0 ? Math.max(...values) : undefined;
  };
  const bestGpuIndex = bestIndex(catalog.gpu);
  const bestCpuIndex = bestIndex(catalog.cpu);

  // Oyun bazlı FPS — Faz A.1. Tek sistem indeksinin YANINDA duruyor, yerine
  // değil: indeks sistemin bütününü (işlemci dahil) anlatıyor, bu liste ise
  // yalnızca ekran kartına dayanıyor. İkisi farklı sorulara cevap.
  //
  // Ölçüm ve indeks çip seviyesinde (K86); kart seçiliyse de çipin id'si
  // gider. `origin === "chip"` uyarısı zaten ayrıca gösteriliyor.
  const fpsPartId = gpuIndex.origin === "variant" ? gpuVariantId : gpuChipId;
  const fpsRows = estimateGameFps(fpsPartId, gpuIndex.value, fpsGroups);

  const performance = computePerformance({
    resolution,
    gpu_index: gpuIndex.value,
    cpu_index: cpuId ? perfIndexes[cpuId] : undefined,
    best_gpu_index: bestGpuIndex,
    best_cpu_index: bestCpuIndex,
  });

  // Eksik indeksin iki ayrı sebebi var ve kullanıcıya farklı şey söylerler:
  // parça seçilmemiş olabilir (kullanıcı düzeltir), ya da parça seçili ama
  // ölçüm verisi henüz toplanmamış olabilir (kullanıcı düzeltemez).
  // İkincisi bugün normal hal: perf_index yalnızca benchmark_points'tan
  // hesaplanıyor ve o veri henüz yok (K71).
  const olcumEksik = !performance.ok && performance.missing.every((kind) => selection[kind]);

  // Yükseltme önerisi. Bütçe boşken de çalışır: 0 TL farkla daha iyi bir parça
  // varsa (aynı fiyata daha güçlü) onu da göstermek doğru.
  const budgetMinor = parseBudgetToMinor(budgetText);
  const upgrades = suggestUpgrades({
    resolution,
    current: {
      gpu: toUpgradePart(gpuPartId, prices, gpuIndex.value),
      cpu: toUpgradePart(cpuId, prices, cpuId ? perfIndexes[cpuId] : undefined),
    },
    budget_delta_minor: budgetMinor,
    candidates: {
      gpu: toCandidates(catalog.gpu, prices, perfIndexes),
      cpu: toCandidates(catalog.cpu, prices, perfIndexes),
    },
  });

  /** Seçim değiştiğinde paylaşım linki artık o sistemi göstermiyor. */
  function forgetShareLink() {
    setShareUrl(null);
    setSaveError(null);
  }

  function toggleStorage(id: string) {
    forgetShareLink();
    setStorageIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    setSaveError(null);

    // Çözünürlük de gidiyor: indeks kullanıcının o an baktığı çözünürlükte
    // donuyor (K43), sabit bir referansta değil.
    const result = await saveBuildAction(selectedPartIds, resolution);
    if (result.ok) {
      setShareUrl(`${window.location.origin}/sistem/${result.id}`);
    } else {
      setSaveError(result.message);
    }
    setSaving(false);
  }

  /** Bir parçanın indeksi neden yok: seçilmedi mi, verisi mi yok? */
  function eksikSebebi(kind: "gpu" | "cpu"): string {
    const id = kind === "gpu" ? gpuChipId : cpuId;
    const ad = kind === "gpu" ? "Ekran kartı" : "İşlemci";
    if (!id) return `${ad} seçilmedi.`;
    return `${ad} için performans verisi yok.`;
  }

  /** Öneride görünen parça adı — motor id döndürüyor, adı katalog biliyor. */
  function labelOf(category: UpgradeCategory, id: string): string {
    const fromCategory = catalog[category].find((item) => item.id === id)?.label;
    if (fromCategory) return fromCategory;
    // Mevcut ekran kartı bir AIB kartı olabilir; adı ayrı listede duruyor (K86).
    return catalog.gpu_variant.find((variant) => variant.id === id)?.label ?? id;
  }

  return (
    <div className="grid gap-8 md:grid-cols-2">
      {/* --- Seçim --- */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Parça seç</h2>

        <div className="flex flex-col gap-3">
          {ENGINE_CATEGORIES.map((category) => (
            <div key={category} className="flex flex-col gap-2">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">{CATEGORY_LABEL[category]}</span>
                <select
                  className="rounded border px-2 py-1"
                  value={selection[category] ?? ""}
                  onChange={(event) => {
                    forgetShareLink();
                    // Çip değişince kart seçimi düşer: başka çipin kartı seçili kalamaz.
                    if (category === "gpu") setGpuVariantId(undefined);
                    setSelection((current) => ({
                      ...current,
                      [category]: event.target.value || undefined,
                    }));
                  }}
                >
                  <option value="">— seçilmedi —</option>
                  {catalog[category].map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                      {prices[item.id] ? ` — ${formatPriceMinor(prices[item.id].price_minor)}` : ""}
                    </option>
                  ))}
                </select>
              </label>

              {/*
                Kart (AIB) seçimi opsiyonel ikinci katman (K86). Yalnızca seçili
                çipin kartı varsa görünür: kartı olmayan çipte boş bir kutu
                göstermek, kullanıcıya doldurulacak bir alan varmış hissi verir.
              */}
              {category === "gpu" && variantsForChip.length > 0 && (
                <label className="ml-1 flex flex-col gap-1 border-l-2 border-neutral-300 pl-3 text-sm">
                  <span className="font-medium">
                    Kart modeli <span className="font-normal opacity-60">(opsiyonel)</span>
                  </span>
                  <select
                    className="rounded border px-2 py-1"
                    value={gpuVariantId ?? ""}
                    onChange={(event) => {
                      forgetShareLink();
                      setGpuVariantId(event.target.value || undefined);
                    }}
                  >
                    <option value="">— belirtilmedi, referans değerler —</option>
                    {variantsForChip.map((variant) => (
                      <option key={variant.id} value={variant.id}>
                        {variant.label}
                        {prices[variant.id]
                          ? ` — ${formatPriceMinor(prices[variant.id].price_minor)}`
                          : ""}
                      </option>
                    ))}
                  </select>
                  <span className="text-xs opacity-60">
                    Aynı çipten çıkan kartlar uzunluk ve güç limitinde ayrışır. Kart
                    seçmezseniz üreticinin referans değerleri kullanılır.
                  </span>
                </label>
              )}
            </div>
          ))}

          <fieldset className="flex flex-col gap-1 text-sm">
            <legend className="font-medium">Depolama (birden fazla seçilebilir)</legend>
            {catalog.storage.map((item) => (
              <label key={item.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={storageIds.includes(item.id)}
                  onChange={() => toggleStorage(item.id)}
                />
                <span>
                  {item.label}{" "}
                  <span className="opacity-60">
                    ({item.storage_type}, {item.capacity_gb} GB)
                  </span>
                  {prices[item.id] && (
                    <span className="opacity-60">
                      {" "}
                      — {formatPriceMinor(prices[item.id].price_minor)}
                    </span>
                  )}
                </span>
              </label>
            ))}
          </fieldset>
        </div>
      </section>

      {/* --- Sonuç --- */}
      <section className="flex flex-col gap-6">
        {/* Toplam fiyat */}
        <div>
          <h2 className="mb-3 text-lg font-semibold">Toplam fiyat</h2>
          {secilenSayisi === 0 ? (
            <p className="text-sm opacity-70">Parça seçince toplanacak.</p>
          ) : (
            <div className="text-sm">
              {priceSummary.mixedCurrency ? (
                <p className="text-sm opacity-70">
                  Seçilen parçaların fiyatları farklı para birimlerinde (
                  {priceSummary.currencies.join(", ")}). Toplam hesaplanmıyor — kur
                  bilgisi olmadan bu sayı yanlış olurdu.
                </p>
              ) : (
                <p className="text-2xl font-semibold">
                  {formatPriceMinor(priceSummary.totalMinor, priceSummary.currency ?? "USD")}{" "}
                  <span className="align-middle text-xs font-normal opacity-60">tahmini</span>
                </p>
              )}
              <p className="mt-1 opacity-70">
                {priceSummary.latestIso
                  ? `Son güncelleme: ${formatIsoDate(priceSummary.latestIso)}`
                  : "Seçilen parçaların hiçbirinde fiyat kaydı yok."}
              </p>
              {priceSummary.missing > 0 && (
                <p className="mt-1 opacity-70">
                  {priceSummary.missing} parçanın fiyatı yok, toplama katılmadı.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Performans */}
        <div>
          <h2 className="mb-3 text-lg font-semibold">Performans</h2>

          <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="opacity-70">Çözünürlük:</span>
            {RESOLUTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  // Çözünürlük dondurulan indeksi belirliyor; değişince eldeki
                  // paylaşım linki artık bu ekrandakini göstermiyor.
                  forgetShareLink();
                  setResolution(option.value);
                }}
                className={`rounded border px-3 py-1 ${
                  resolution === option.value ? "border-blue-500 font-semibold" : "opacity-70"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {performance.ok ? (
            <div className="flex flex-col gap-2 text-sm">
              <p>
                <span className="text-2xl font-semibold">{performance.system_index}</span>
                {/* "/ 100" kaldirildi (K73): olcek artik sabit referans parcaya
                    bagli ve 100 tavan degil, orta nokta. RTX 4070 + Ryzen 5 9600X
                    sistemi 100 verir; daha hizli sistemler 100'u asar. */}
                <span className="text-xs opacity-60">
                  {" "}
                  tahmini sistem indeksi — referans sistem 100
                </span>
              </p>
              <p>
                <span className="opacity-60">Bant:</span> {performance.band}{" "}
                <span className="text-xs opacity-60">(tahmini)</span>
              </p>
              {/* Katalogun en iyileri bilinmiyorsa satir hic gosterilmez (K83). */}
              {performance.bottleneck_message && (
                <p>
                  <span className="opacity-60">Darboğaz:</span> {performance.bottleneck_message}{" "}
                  <span className="text-xs opacity-60">(tahmini)</span>
                  {performance.bottleneck_gain && (
                    <span className="block text-xs opacity-50">
                      Kataloğun en iyisine geçseniz: ekran kartı +
                      {performance.bottleneck_gain.gpu}, işlemci +
                      {performance.bottleneck_gain.cpu} indeks.
                    </span>
                  )}
                </p>
              )}
              <p className="text-xs opacity-50">
                Ekran kartı {performance.gpu_index}, işlemci {performance.cpu_index}. Bu
                çözünürlükte ağırlıklar: ekran kartı {performance.weights.gpu}, işlemci{" "}
                {performance.weights.cpu}. Motor sürümü {performance.model_version}. Gerçek FPS
                iddiası değildir.
              </p>
              {/* Çipin indeksi kartın ölçümü değildir (K86). Bugün her kart için
                  böyle; sessiz kalmak, kart bazlı ölçüm varmış gibi olurdu. */}
              {gpuVariant && gpuIndex.origin === "chip" && (
                <p className="text-xs opacity-50">
                  Ekran kartı indeksi {gpuChip?.label} çipi için ölçüldü; seçtiğiniz kart
                  için ayrı ölçüm yok. Fabrika hız aşırtması bu sayıya yansımaz.
                </p>
              )}
              {/* Hata payı ölçülür, tahmin edilmez (K79). Sayı ve ölçüm tarihi tek
                  yerde tanımlı; ölçüm tekrarlandığında lib/perf-margin.ts değişir. */}
              <p className="text-xs opacity-50">
                Ölçülen sapma: ortalama %{PERF_MARGIN.meanPercent}, en büyük %
                {PERF_MARGIN.maxPercent}. {PERF_MARGIN.method} ({PERF_MARGIN.measuredAt})
              </p>
            </div>
          ) : (
            <div className="text-sm opacity-70">
              {olcumEksik ? (
                <>
                  <p>Performans tahmini için henüz yeterli veri yok.</p>
                  <p className="mt-1 text-xs opacity-80">
                    Seçtiğiniz parçalar geçerli — uyumluluk kontrolü çalışıyor ve fiyat
                    toplanıyor. Eksik olan ölçüm verisi: performans indeksi gerçek
                    karşılaştırma sonuçlarından hesaplanıyor ve o veri henüz toplanmadı.
                    Uydurma bir sayı göstermektense hiç göstermiyoruz.
                  </p>
                </>
              ) : (
                <>
                  <p>Tahmin için hem işlemci hem ekran kartı gerekiyor.</p>
                  <ul className="mt-1 list-inside list-disc">
                    {performance.missing.map((kind) => (
                      <li key={kind}>{eksikSebebi(kind)}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>

        {/* Oyun bazlı FPS — Faz A.1. docs/faz-a1-plani.md
            Liste ve dürüstlük kuralları app/game-fps.tsx içinde; kaydedilmiş
            sistem sayfası da aynı bileşeni kullanıyor. */}
        <div>
          <h2 className="mb-3 text-lg font-semibold">Oyun bazlı FPS</h2>

          {gpuChipId === undefined ? (
            <p className="text-sm opacity-70">Oyun bazlı tahmin için ekran kartı seçin.</p>
          ) : (
            <GameFpsList rows={fpsRows} gpuSelected resolution={resolution} />
          )}
        </div>

        {/* Yükseltme önerisi */}
        <div>
          <h2 className="mb-3 text-lg font-semibold">Yükseltme önerisi</h2>

          <label className="flex flex-wrap items-center gap-2 text-sm">
            <span className="opacity-70">Bütçe farkı:</span>
            <span>+</span>
            <input
              className="w-28 rounded border px-2 py-1"
              inputMode="numeric"
              placeholder="2000"
              value={budgetText}
              onChange={(event) => setBudgetText(event.target.value)}
            />
            <span className="opacity-70">TL</span>
          </label>

          <div className="mt-3 text-sm">
            {olcumEksik ? (
              <p className="opacity-70">
                Yükseltme önerisi de performans verisine dayanıyor. Ölçüm toplanana kadar
                &ldquo;bu para neyi ne kadar artırır&rdquo; sorusuna dürüst bir cevap
                veremiyoruz.
              </p>
            ) : !performance.ok ? (
              <p className="opacity-70">
                Öneri için önce işlemci ve ekran kartı seçilmeli — artışın neye göre
                ölçüleceği belli olmuyor.
              </p>
            ) : upgrades.length === 0 ? (
              <p className="opacity-70">
                {budgetMinor === 0
                  ? "Bütçe farkı girin, bu parayla ne alınabileceğini arayalım."
                  : "Bu bütçeyle indeksi artıran bir değişiklik bulunamadı."}
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {upgrades.map((upgrade, index) => (
                  <li
                    key={upgrade.category}
                    className={`border-l-4 pl-3 ${
                      index === 0 ? "border-green-600" : "border-neutral-300"
                    }`}
                  >
                    <div>
                      <span className="opacity-60">
                        {CATEGORY_LABEL[upgrade.category as EngineCategory]}:
                      </span>{" "}
                      {labelOf(upgrade.category, upgrade.current_part_id)}{" "}
                      <span className="opacity-60">→</span>{" "}
                      <span className="font-medium">
                        {labelOf(upgrade.category, upgrade.suggested_part_id)}
                      </span>
                    </div>
                    <div className="text-xs opacity-70">
                      Fark: {upgrade.price_delta_minor >= 0 ? "+" : ""}
                      {formatPriceMinor(upgrade.price_delta_minor)} · İndeks{" "}
                      {upgrade.index_before} → {upgrade.index_after} (+{upgrade.index_delta}){" "}
                      <span className="opacity-80">tahmini</span>
                      {index === 0 && upgrades.length > 1 && " · en çok kazandıran"}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Seçilen sistem */}
        <div>
          <h2 className="mb-3 text-lg font-semibold">Seçilen sistem</h2>
          {secilenSayisi === 0 ? (
            <p className="text-sm opacity-70">Henüz parça seçilmedi.</p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {ENGINE_CATEGORIES.filter((category) => selection[category]).map((category) => {
                // Ekran kartında kart seçiliyse listede kart görünür: satın
                // alınan, fiyatı toplanan ve kaydedilen satır odur (K86).
                const item =
                  category === "gpu" && gpuVariant
                    ? gpuVariant
                    : catalog[category].find((candidate) => candidate.id === selection[category]);
                return (
                  <li key={category}>
                    <span className="opacity-60">{CATEGORY_LABEL[category]}:</span> {item?.label}
                    {category === "gpu" && gpuVariant && (
                      <span className="text-xs opacity-50"> · çip: {gpuChip?.label}</span>
                    )}
                    <PriceTag price={item ? prices[item.id] : undefined} />
                  </li>
                );
              })}
              {selectedStorage.map((item) => (
                <li key={item.id}>
                  <span className="opacity-60">Depolama:</span> {item.label}
                  <PriceTag price={prices[item.id]} />
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Paylaşılabilir link */}
        <div>
          <h2 className="mb-3 text-lg font-semibold">Kaydet ve paylaş</h2>

          <button
            type="button"
            onClick={save}
            disabled={saving || secilenSayisi === 0}
            className="rounded border px-3 py-1 text-sm disabled:opacity-40"
          >
            {saving ? "Kaydediliyor…" : "Sistemi kaydet"}
          </button>

          <p className="mt-2 text-xs opacity-60">
            Hesap gerekmez. Kaydedilen fiyat ve indeks o ana dondurulur, sonradan değişmez.
            İndeks şu an seçili çözünürlükte ({resolution}) hesaplanır. İndeks
            hesaplanamıyorsa — parça seçilmediği için ya da ölçüm verisi olmadığı için —
            sistem yine kaydedilir, indeks yerine sebebi görünür.
          </p>

          {shareUrl && (
            <div className="mt-3 text-sm">
              <p className="mb-1 opacity-70">Bu adres sistemi açar:</p>
              <input
                readOnly
                value={shareUrl}
                onFocus={(event) => event.currentTarget.select()}
                className="w-full rounded border px-2 py-1 font-mono text-xs"
              />
              <a className="mt-1 inline-block underline" href={shareUrl}>
                Kaydedilen sistemi aç →
              </a>
            </div>
          )}

          {saveError && <p className="mt-2 text-sm text-red-600">{saveError}</p>}
        </div>

        {/* Uyumluluk */}
        <div>
          <h2 className="mb-3 text-lg font-semibold">Uyumluluk</h2>

          {/*
            Uzunluğu bilinmeyen kart, C5'i sessizce atlatır (K52). Motor bunu
            bulgu olarak üretmiyor — bulgular SCHEMA.md bölüm 7'deki kurallardır
            ve "veri eksik" bir kural ihlali değil. Ama kullanıcı, kontrolün
            yapılmadığını "sorun bulunamadı" sanmamalı; o yüzden burada söyleniyor.
          */}
          {gpuLengthUnknown && (
            <p className="mb-3 border-l-4 border-slate-400 pl-3 text-sm">
              {gpuVariant
                ? // Kart seçiliyken çipin referans ölçüsüne DÜŞÜLMEZ (K87): AIB
                  // kartları referanstan uzun olur, referansla "sığar" demek
                  // satın alınıp takılamayan kart demektir.
                  "Seçtiğiniz kartın uzunluğu bilinmiyor, kasa uyumluluğu kontrol edilemedi. Çipin referans ölçüsü kullanılmadı: özel tasarım kartlar referans karttan uzun olur, o ölçüyle yapılan kontrol yanlış güven verirdi. Kartın ölçüsünü üreticinin sayfasından teyit et."
                : "Ekran kartının uzunluğu bilinmiyor, kasa uyumluluğu kontrol edilemedi. Kartın fiziksel ölçüsünü üreticinin sayfasından teyit et."}
            </p>
          )}

          {gpuTdpFromReference && (
            <p className="mb-3 border-l-4 border-slate-400 pl-3 text-sm">
              Seçtiğiniz kartın güç limiti (TBP) yayınlanmamış. Güç hesabı çipin referans
              değeriyle yapıldı — özel tasarım kartlar referanstan biraz daha fazla
              çekebilir.
            </p>
          )}

          {psuLengthUnknown && (
            <p className="mb-3 border-l-4 border-slate-400 pl-3 text-sm">
              Güç kaynağının uzunluğu bilinmiyor, kasa uyumluluğu kontrol edilemedi.
              Üreticinin sayfasından teyit et.
            </p>
          )}

          {findings.length === 0 ? (
            <p className="text-sm">
              {secilenSayisi === 0 ? "Parça seçince kontrol edilecek." : "Sorun bulunamadı."}
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {errors.length > 0 && (
                <FindingList
                  title={`Hata (${errors.length}) — sistem bu haliyle kurulamaz`}
                  findings={errors}
                  className="border-red-500"
                />
              )}
              {warnings.length > 0 && (
                <FindingList
                  title={`Uyarı (${warnings.length}) — kurulur ama dikkat`}
                  findings={warnings}
                  className="border-amber-500"
                />
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

/**
 * "2000" -> 200000 kuruş.
 *
 * Sadece rakamlar okunuyor: kullanıcı "2.000" veya "2000 TL" yazsa da aynı
 * sonucu vermeli. Kuruş girilmesi beklenmiyor, bütçe farkı tam TL.
 */
function parseBudgetToMinor(text: string): number {
  const digits = text.replace(/\D/g, "");
  if (digits.length === 0) return 0;
  return Number(digits) * 100;
}

/**
 * Seçili parçayı motorun aday tipine çevirir. Fiyatı yoksa hesap yapılamaz.
 *
 * İndeks hazır sayı olarak geliyor, id ile aranmıyor: ekran kartında seçili
 * satır bir kart olabilir ve kartın indeksi çipinden gelir (K86). Aramayı
 * burada tekrarlamak, çözümlemenin ikinci bir kopyası olurdu.
 */
function toUpgradePart(
  id: string | undefined,
  prices: Record<string, CurrentPrice>,
  perfIndex: number | undefined,
): UpgradePart | undefined {
  if (!id) return undefined;
  const price = prices[id];
  if (!price) return undefined;
  return { id, price_minor: price.price_minor, perf_index: perfIndex };
}

/** Katalog listesini aday listesine çevirir; fiyatı olmayanlar elenir. */
function toCandidates(
  items: { id: string }[],
  prices: Record<string, CurrentPrice>,
  perfIndexes: Record<string, number>,
): UpgradePart[] {
  return items
    .filter((item) => prices[item.id])
    .map((item) => ({
      id: item.id,
      price_minor: prices[item.id].price_minor,
      perf_index: perfIndexes[item.id],
    }));
}

/**
 * Seçilen parçaların fiyat özeti.
 *
 * Fiyatı olmayan parça toplama katılmaz ve ayrıca sayılır: eksik fiyatı sessizce
 * 0 saymak, kullanıcının gördüğü toplamı olduğundan ucuz gösterirdi.
 */
function summarizePrice(partIds: string[], prices: Record<string, CurrentPrice>) {
  let totalMinor = 0;
  let latestIso: string | null = null;
  let missing = 0;
  const currencies = new Set<string>();

  for (const id of partIds) {
    const price = prices[id];
    if (!price) {
      missing += 1;
      continue;
    }
    totalMinor += price.price_minor;
    currencies.add(price.currency);
    // "Son güncelleme": toplamı oluşturan fiyatların en yenisi.
    if (!latestIso || price.collected_at > latestIso) latestIso = price.collected_at;
  }

  // Farklı para birimlerindeki kuruşları toplamak sessizce yanlış bir sayı
  // üretir: 47900 (USD sent) + 749900 (TRY kuruş) toplanıp tek sembolle
  // gösterilirdi. Kur bilgisi yok ve olsa bile hangi tarihin kuru olduğu
  // sorusu açık. Toplam üretilmez, durum kullanıcıya söylenir.
  const mixedCurrency = currencies.size > 1;
  const currency = currencies.size === 1 ? [...currencies][0] : null;

  return { totalMinor, currency, mixedCurrency, currencies: [...currencies], latestIso, missing };
}

/** Fiyatı olan parçanın yanında fiyatı, olmayanda "fiyat yok" yazar. */
function PriceTag({ price }: { price?: CurrentPrice }) {
  if (!price) return <span className="opacity-40"> — fiyat yok</span>;
  return (
    <span className="opacity-60"> — {formatPriceMinor(price.price_minor, price.currency)}</span>
  );
}

function FindingList({
  title,
  findings,
  className,
}: {
  title: string;
  findings: Finding[];
  className: string;
}) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      <ul className="flex flex-col gap-2">
        {findings.map((finding) => (
          <li key={finding.code} className={`border-l-4 pl-3 text-sm ${className}`}>
            <span className="font-mono text-xs opacity-60">{finding.code}</span>{" "}
            {finding.message}
            <div className="mt-0.5 font-mono text-xs opacity-50">
              {finding.involved_part_ids.join(", ")}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
