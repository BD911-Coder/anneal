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
  // Liste kullanıcının seçtiği çözünürlüğü izler. Süzme metin eşleştirmesiyle
  // değil, grubun kendi `resolution` alanıyla yapılıyor.
  const fpsGroupsForRes = fpsGroups.filter((group) => group.resolution === resolution);
  const fpsRows = estimateGameFps(fpsPartId, gpuIndex.value, fpsGroupsForRes);
  // Kapsanan oyunlar seçimden ÖNCE gösteriliyor; beklenti baştan kurulsun.
  const kapsananOyunlar = [...new Set(fpsGroupsForRes.map((g) => g.game_name))].sort((a, b) =>
    a.localeCompare(b, "tr"),
  );

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

  const hicSecimYok = secilenSayisi === 0;

  return (
    // Mobil önce: tek sütun. Geniş ekranda seçim solda YAPIŞIK kalıyor —
    // kullanıcı sonuçları okurken seçimini değiştirmek için yukarı kaymak
    // zorunda kalmasın. `min-w-0`: grid çocukları içeriklerinden küçülemez
    // ve uzun bellek adları <select>i şişirip 375 px'te taşma yapıyordu.
    <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-12 [&>*]:min-w-0">
      {/* ---------------- Seçim ---------------- */}
      <section aria-labelledby="secim-basligi" className="lg:sticky lg:top-6 lg:self-start">
        <SectionTitle id="secim-basligi">Parça seç</SectionTitle>

        <div className="mt-4 flex flex-col gap-4">
          {ENGINE_CATEGORIES.map((category) => (
            <div key={category} className="flex flex-col gap-2">
              {/* Etiket açıkça bağlanıyor (label/for) — sarmalamak da çalışır
                  ama ekran okuyucu için açık bağ daha güvenilir. */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`sec-${category}`} className="text-sm font-medium">
                  {CATEGORY_LABEL[category]}
                </label>
                <select
                  id={`sec-${category}`}
                  className="w-full min-w-0 rounded-md border border-border bg-background px-2.5 py-2 text-sm"
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
                      {prices[item.id]
                        ? ` — ${formatPriceMinor(prices[item.id].price_minor, prices[item.id].currency)}`
                        : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/*
                Kart (AIB) seçimi opsiyonel ikinci katman (K86). Yalnızca seçili
                çipin kartı varsa görünür: kartı olmayan çipte boş bir kutu
                göstermek, kullanıcıya doldurulacak bir alan varmış hissi verir.
              */}
              {category === "gpu" && variantsForChip.length > 0 && (
                <div className="flex flex-col gap-1.5 border-l-2 border-border pl-3">
                  <label htmlFor="sec-gpu-variant" className="text-sm font-medium">
                    Kart modeli <span className="font-normal text-muted">(opsiyonel)</span>
                  </label>
                  <select
                    id="sec-gpu-variant"
                    className="w-full min-w-0 rounded-md border border-border bg-background px-2.5 py-2 text-sm"
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
                          ? ` — ${formatPriceMinor(prices[variant.id].price_minor, prices[variant.id].currency)}`
                          : ""}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs leading-relaxed text-muted">
                    Aynı çipten çıkan kartlar uzunluk ve güç limitinde ayrışır. Kart
                    seçmezseniz üreticinin referans değerleri kullanılır.
                  </p>
                </div>
              )}
            </div>
          ))}

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">
              Depolama <span className="font-normal text-muted">(birden fazla)</span>
            </legend>
            {catalog.storage.map((item) => (
              <label key={item.id} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5 shrink-0"
                  checked={storageIds.includes(item.id)}
                  onChange={() => toggleStorage(item.id)}
                />
                <span className="min-w-0">
                  {item.label}{" "}
                  <span className="text-muted">
                    ({item.storage_type}, <span className="num">{item.capacity_gb}</span> GB)
                  </span>
                  {prices[item.id] && (
                    <span className="num text-muted">
                      {" "}
                      — {formatPriceMinor(prices[item.id].price_minor, prices[item.id].currency)}
                    </span>
                  )}
                </span>
              </label>
            ))}
          </fieldset>
        </div>
      </section>

      {/* ---------------- Sonuçlar ---------------- */}
      <div className="flex flex-col gap-10">
        {hicSecimYok ? (
          /*
            Boş durum: yedi kategori + yedi sonuç bölümü aynı anda gelince
            kullanıcı nereye bakacağını bilmiyordu. Hiçbir şey seçilmemişken
            sonuç bölümleri hiç çizilmiyor; yerine sitenin ne söyleyeceği
            yazıyor ve kapsanan oyunlar baştan görünüyor (K129).
          */
          <section
            aria-labelledby="bos-durum"
            className="rounded-lg border border-border bg-surface p-6"
          >
            <h2 id="bos-durum" className="text-lg font-semibold tracking-tight">
              Soldan parça seçin
            </h2>
            <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
              Ekran kartı seçtiğinizde oyun bazlı FPS listesi gelir. İşlemciyi de
              seçerseniz sistem indeksi ve darboğaz analizi eklenir. Uyumluluk kontrolü
              ilk parçadan itibaren çalışır.
            </p>

            <dl className="mt-5 space-y-3 text-sm">
              <div>
                <dt className="font-medium">Ne göreceksiniz</dt>
                <dd className="mt-0.5 leading-relaxed text-muted">
                  Oyun başına tahmini FPS, sistem indeksi, uyumluluk hataları ve
                  yükseltme önerisi.
                </dd>
              </div>
              <div>
                <dt className="font-medium">Ne görmeyeceksiniz</dt>
                <dd className="mt-0.5 leading-relaxed text-muted">
                  Ölçümü olmayan parçalarda uydurma sayı. Veri yoksa yerinde neden
                  olmadığı yazar.
                </dd>
              </div>
            </dl>

            <div className="mt-5 border-t border-border pt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
                Ölçümü olan oyunlar
              </h3>
              {kapsananOyunlar.length > 0 ? (
                <p className="mt-2 text-sm leading-relaxed">
                  <span className="num font-medium">{kapsananOyunlar.length}</span> oyun,{" "}
                  {RESOLUTIONS.find((r) => r.value === resolution)?.label} için:{" "}
                  <span className="text-muted">{kapsananOyunlar.join(", ")}</span>
                </p>
              ) : (
                <p className="mt-2 text-sm text-muted">
                  Bu çözünürlükte henüz ölçüm yok; başka çözünürlük seçin.
                </p>
              )}
            </div>
          </section>
        ) : (
          <>
            {/*
              SIRALAMA ÖNCELİĞE GÖRE. Uyumluluk hataları en üstte çünkü sistem
              kurulamıyorsa performans sayısı ikincil. Eskiden en alttaydı.
            */}
            {(errors.length > 0 || warnings.length > 0 || gpuLengthUnknown ||
              gpuTdpFromReference || psuLengthUnknown) && (
              <section aria-labelledby="uyumluluk-basligi">
                <SectionTitle id="uyumluluk-basligi">Uyumluluk</SectionTitle>

                <div className="mt-4 flex flex-col gap-4">
                  {errors.length > 0 && (
                    <FindingList
                      title={`Hata (${errors.length}) — sistem bu haliyle kurulamaz`}
                      findings={errors}
                      className="border-red-600 dark:border-red-500"
                    />
                  )}
                  {warnings.length > 0 && (
                    <FindingList
                      title={`Uyarı (${warnings.length}) — kurulur ama dikkat`}
                      findings={warnings}
                      className="border-amber-600 dark:border-amber-500"
                    />
                  )}

                  {/*
                    Uzunluğu bilinmeyen kart, C5'i sessizce atlatır (K52). Motor
                    bunu bulgu olarak üretmiyor — "veri eksik" bir kural ihlali
                    değil. Ama kullanıcı, kontrolün yapılmadığını "sorun
                    bulunamadı" sanmamalı; bu yüzden burada söyleniyor.
                    Görsel olarak HATA gibi değil BİLGİ gibi duruyor.
                  */}
                  {(gpuLengthUnknown || gpuTdpFromReference || psuLengthUnknown) && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
                        Kontrol edilemeyenler
                      </h3>
                      {gpuLengthUnknown && (
                        <p className="rounded-md border border-border bg-surface px-3 py-2 text-sm leading-relaxed text-muted">
                          {gpuVariant
                            ? "Seçtiğiniz kartın uzunluğu bilinmiyor, kasa uyumluluğu kontrol edilemedi. Çipin referans ölçüsü kullanılmadı: özel tasarım kartlar referans karttan uzun olur, o ölçüyle yapılan kontrol yanlış güven verirdi. Kartın ölçüsünü üreticinin sayfasından teyit et."
                            : "Ekran kartının uzunluğu bilinmiyor, kasa uyumluluğu kontrol edilemedi. Kartın fiziksel ölçüsünü üreticinin sayfasından teyit et."}
                        </p>
                      )}
                      {gpuTdpFromReference && (
                        <p className="rounded-md border border-border bg-surface px-3 py-2 text-sm leading-relaxed text-muted">
                          Seçtiğiniz kartın güç limiti (TBP) yayınlanmamış. Güç hesabı
                          çipin referans değeriyle yapıldı — özel tasarım kartlar
                          referanstan biraz daha fazla çekebilir.
                        </p>
                      )}
                      {psuLengthUnknown && (
                        <p className="rounded-md border border-border bg-surface px-3 py-2 text-sm leading-relaxed text-muted">
                          Güç kaynağının uzunluğu bilinmiyor, kasa uyumluluğu kontrol
                          edilemedi. Üreticinin sayfasından teyit et.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </section>
            )}

            {findings.length === 0 && !gpuLengthUnknown && !gpuTdpFromReference &&
              !psuLengthUnknown && (
              <p className="text-sm text-muted">
                Uyumluluk: sorun bulunamadı.
              </p>
            )}

            {/* ---- Performans ---- */}
            <section aria-labelledby="performans-basligi">
              <SectionTitle id="performans-basligi">Performans</SectionTitle>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted">Çözünürlük</span>
                <div className="flex gap-1.5" role="group" aria-label="Çözünürlük">
                  {RESOLUTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={resolution === option.value}
                      onClick={() => {
                        // Çözünürlük dondurulan indeksi belirliyor; değişince
                        // eldeki paylaşım linki artık bu ekrandakini göstermiyor.
                        forgetShareLink();
                        setResolution(option.value);
                      }}
                      className={`rounded-md border px-3 py-1 text-sm ${
                        resolution === option.value
                          ? "border-accent bg-accent/10 font-medium text-accent"
                          : "border-border text-muted"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {performance.ok ? (
                <div className="mt-4">
                  {/* Sayı ile etiketi arasında belirgin hiyerarşi. */}
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <output className="num text-4xl font-semibold tracking-tight">
                      {performance.system_index}
                    </output>
                    {/* K73: 100 tavan değil, sabit referans sistemin değeri. */}
                    <span className="text-sm text-muted">
                      tahmini sistem indeksi — referans sistem{" "}
                      <span className="num">100</span>
                    </span>
                  </div>

                  <p className="mt-2 text-sm">
                    {performance.band} <span className="text-xs text-muted">(tahmini)</span>
                  </p>

                  {/* Kataloğun en iyileri bilinmiyorsa satır hiç gösterilmez (K83). */}
                  {performance.bottleneck_message && (
                    <div className="mt-3 rounded-md border border-border bg-surface px-3 py-2.5">
                      <p className="text-sm">
                        <span className="font-medium">Darboğaz:</span>{" "}
                        {performance.bottleneck_message}
                      </p>
                      {performance.bottleneck_gain && (
                        <p className="mt-1 text-xs text-muted">
                          Kataloğun en iyisine geçseniz: ekran kartı{" "}
                          <span className="num">+{performance.bottleneck_gain.gpu}</span>,
                          işlemci{" "}
                          <span className="num">+{performance.bottleneck_gain.cpu}</span>{" "}
                          indeks.
                        </p>
                      )}
                    </div>
                  )}

                  <div className="mt-3 space-y-1 text-xs leading-relaxed text-muted">
                    <p>
                      Ekran kartı <span className="num">{performance.gpu_index}</span>,
                      işlemci <span className="num">{performance.cpu_index}</span>. Bu
                      çözünürlükte ağırlıklar: ekran kartı{" "}
                      <span className="num">{performance.weights.gpu}</span>, işlemci{" "}
                      <span className="num">{performance.weights.cpu}</span>. Motor sürümü{" "}
                      {performance.model_version}. Gerçek FPS iddiası değildir.
                    </p>
                    {/* Çipin indeksi kartın ölçümü değildir (K86). */}
                    {gpuVariant && gpuIndex.origin === "chip" && (
                      <p>
                        Ekran kartı indeksi {gpuChip?.label} çipi için ölçüldü; seçtiğiniz
                        kart için ayrı ölçüm yok. Fabrika hız aşırtması bu sayıya yansımaz.
                      </p>
                    )}
                    {/* Hata payı ölçülür, tahmin edilmez (K79). */}
                    <p>
                      Ölçülen sapma: ortalama %
                      <span className="num">{PERF_MARGIN.meanPercent}</span>, en büyük %
                      <span className="num">{PERF_MARGIN.maxPercent}</span>.{" "}
                      {PERF_MARGIN.method} ({PERF_MARGIN.measuredAt})
                    </p>
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-md border border-border bg-surface px-3 py-3">
                  {olcumEksik ? (
                    <>
                      {/* Bu metin EKSİK OLANIN ADINI koyuyor (K126). Eskiden
                          "performans tahmini için yeterli veri yok" diyordu ve
                          hemen altında dolu bir FPS listesi duruyordu. */}
                      <p className="text-sm">
                        <span className="font-medium">Sistem indeksi</span> hesaplanamıyor —
                        bu sayı işlemci ve ekran kartının ikisinin de ölçümünü gerektiriyor.
                      </p>
                      <ul className="mt-1.5 list-inside list-disc text-xs text-muted">
                        {performance.missing.map((kind) => (
                          <li key={kind}>{eksikSebebi(kind)}</li>
                        ))}
                      </ul>
                      <p className="mt-2 text-xs leading-relaxed text-muted">
                        Seçtiğiniz parçalar geçerli — uyumluluk kontrolü çalışıyor.
                        {fpsRows.length > 0 && (
                          <>
                            {" "}
                            <span className="font-medium text-foreground">
                              Aşağıdaki oyun bazlı FPS listesi yine de görünüyor:
                            </span>{" "}
                            o liste yalnızca ekran kartına bakıyor, işlemciyi hesaba
                            katmıyor. İki sayı farklı sorulara cevap veriyor.
                          </>
                        )}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm">
                        Sistem indeksi için hem işlemci hem ekran kartı gerekiyor.
                      </p>
                      <ul className="mt-1.5 list-inside list-disc text-xs text-muted">
                        {performance.missing.map((kind) => (
                          <li key={kind}>{eksikSebebi(kind)}</li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              )}
            </section>

            {/* ---- Oyun bazlı FPS (A.1) ---- */}
            <section aria-labelledby="fps-basligi">
              <SectionTitle id="fps-basligi">Oyun bazlı FPS</SectionTitle>
              <div className="mt-4">
                {gpuChipId === undefined ? (
                  <div className="rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-muted">
                    <p>Oyun bazlı tahmin için ekran kartı seçin.</p>
                    {kapsananOyunlar.length > 0 ? (
                      <p className="mt-1.5 text-xs leading-relaxed">
                        Bu çözünürlükte ölçümü olan{" "}
                        <span className="num">{kapsananOyunlar.length}</span> oyun:{" "}
                        {kapsananOyunlar.join(", ")}.
                      </p>
                    ) : (
                      <p className="mt-1.5 text-xs">
                        Bu çözünürlükte henüz ölçüm yok; başka çözünürlük seçin.
                      </p>
                    )}
                  </div>
                ) : (
                  <GameFpsList
                    rows={fpsRows}
                    gpuSelected
                    resolution={resolution}
                    hasDataForResolution={fpsGroupsForRes.length > 0}
                    cpuIndex={cpuId ? perfIndexes[cpuId] : undefined}
                    cpuLabel={cpuId ? catalog.cpu.find((c) => c.id === cpuId)?.label : undefined}
                    bottleneck={performance.ok ? performance.bottleneck : null}
                  />
                )}
              </div>
            </section>

            {/* ---- Toplam fiyat ---- */}
            <section aria-labelledby="fiyat-basligi">
              <SectionTitle id="fiyat-basligi">Toplam fiyat</SectionTitle>
              <div className="mt-4">
                {priceSummary.mixedCurrency ? (
                  <p className="rounded-md border border-border bg-surface px-3 py-2.5 text-sm leading-relaxed text-muted">
                    Seçilen parçaların fiyatları farklı para birimlerinde (
                    {priceSummary.currencies.join(", ")}). Toplam hesaplanmıyor — kur
                    bilgisi olmadan bu sayı yanlış olurdu.
                  </p>
                ) : (
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <output className="num text-2xl font-semibold tracking-tight">
                      {formatPriceMinor(
                        priceSummary.totalMinor,
                        priceSummary.currency ?? "USD",
                      )}
                    </output>
                    <span className="text-xs text-muted">tahmini</span>
                  </div>
                )}
                <div className="mt-2 space-y-0.5 text-xs text-muted">
                  <p>
                    {priceSummary.latestIso
                      ? `Son güncelleme: ${formatIsoDate(priceSummary.latestIso)}`
                      : "Seçilen parçaların hiçbirinde fiyat kaydı yok."}
                  </p>
                  {priceSummary.missing > 0 && (
                    <p>
                      <span className="num">{priceSummary.missing}</span> parçanın fiyatı
                      yok, toplama katılmadı.
                    </p>
                  )}
                </div>
              </div>
            </section>

            {/* ---- Yükseltme önerisi ---- */}
            <section aria-labelledby="yukseltme-basligi">
              <SectionTitle id="yukseltme-basligi">Yükseltme önerisi</SectionTitle>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <label htmlFor="butce" className="text-xs text-muted">
                  Bütçe farkı
                </label>
                <div className="flex items-center gap-1.5">
                  <span aria-hidden="true" className="text-sm text-muted">
                    +
                  </span>
                  <input
                    id="butce"
                    className="num w-28 rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
                    inputMode="numeric"
                    placeholder="2000"
                    value={budgetText}
                    onChange={(event) => setBudgetText(event.target.value)}
                  />
                  <span className="text-sm text-muted">TL</span>
                </div>
              </div>

              <div className="mt-3">
                {olcumEksik ? (
                  <p className="text-sm leading-relaxed text-muted">
                    Yükseltme önerisi de performans verisine dayanıyor. Ölçüm toplanana
                    kadar &ldquo;bu para neyi ne kadar artırır&rdquo; sorusuna dürüst bir
                    cevap veremiyoruz.
                  </p>
                ) : !performance.ok ? (
                  <p className="text-sm leading-relaxed text-muted">
                    Öneri için önce işlemci ve ekran kartı seçilmeli — artışın neye göre
                    ölçüleceği belli olmuyor.
                  </p>
                ) : upgrades.length === 0 ? (
                  <p className="text-sm text-muted">
                    {budgetMinor === 0
                      ? "Bütçe farkı girin, bu parayla ne alınabileceğini arayalım."
                      : "Bu bütçeyle indeksi artıran bir değişiklik bulunamadı."}
                  </p>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {upgrades.map((upgrade, index) => (
                      <li
                        key={upgrade.category}
                        className={`border-l-2 pl-3 ${
                          index === 0 ? "border-accent" : "border-border"
                        }`}
                      >
                        <div className="text-sm">
                          <span className="text-muted">
                            {CATEGORY_LABEL[upgrade.category as EngineCategory]}:
                          </span>{" "}
                          {labelOf(upgrade.category, upgrade.current_part_id)}{" "}
                          <span aria-hidden="true" className="text-muted">
                            →
                          </span>{" "}
                          <span className="font-medium">
                            {labelOf(upgrade.category, upgrade.suggested_part_id)}
                          </span>
                        </div>
                        <div className="mt-0.5 text-xs text-muted">
                          Fark:{" "}
                          <span className="num">
                            {upgrade.price_delta_minor >= 0 ? "+" : ""}
                            {formatPriceMinor(
                              upgrade.price_delta_minor,
                              priceSummary.currency ?? "USD",
                            )}
                          </span>{" "}
                          · İndeks <span className="num">{upgrade.index_before}</span> →{" "}
                          <span className="num">{upgrade.index_after}</span> (
                          <span className="num">+{upgrade.index_delta}</span>) tahmini
                          {index === 0 && upgrades.length > 1 && " · en çok kazandıran"}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            {/* ---- Seçilen sistem + kaydet ---- */}
            <section
              aria-labelledby="sistem-basligi"
              className="rounded-lg border border-border bg-surface p-4 sm:p-5"
            >
              <SectionTitle id="sistem-basligi">Seçilen sistem</SectionTitle>

              <ul className="mt-3 flex flex-col gap-1 text-sm">
                {ENGINE_CATEGORIES.filter((category) => selection[category]).map((category) => {
                  // Ekran kartında kart seçiliyse listede kart görünür: satın
                  // alınan, fiyatı toplanan ve kaydedilen satır odur (K86).
                  const item =
                    category === "gpu" && gpuVariant
                      ? gpuVariant
                      : catalog[category].find(
                          (candidate) => candidate.id === selection[category],
                        );
                  return (
                    <li key={category}>
                      <span className="text-muted">{CATEGORY_LABEL[category]}:</span>{" "}
                      {item?.label}
                      {category === "gpu" && gpuVariant && (
                        <span className="text-xs text-muted"> · çip: {gpuChip?.label}</span>
                      )}
                      <PriceTag price={item ? prices[item.id] : undefined} />
                    </li>
                  );
                })}
                {selectedStorage.map((item) => (
                  <li key={item.id}>
                    <span className="text-muted">Depolama:</span> {item.label}
                    <PriceTag price={prices[item.id]} />
                  </li>
                ))}
              </ul>

              <div className="mt-5 border-t border-border pt-4">
                <button
                  type="button"
                  onClick={save}
                  disabled={saving || hicSecimYok}
                  className="rounded-md border border-accent bg-accent px-4 py-2 text-sm font-medium text-background disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? "Kaydediliyor…" : "Sistemi kaydet"}
                </button>

                <p className="mt-2 text-xs leading-relaxed text-muted">
                  Hesap gerekmez. Kaydedilen fiyat ve indeks o ana dondurulur, sonradan
                  değişmez. İndeks şu an seçili çözünürlükte ({resolution}) hesaplanır.
                  İndeks hesaplanamıyorsa — parça seçilmediği için ya da ölçüm verisi
                  olmadığı için — sistem yine kaydedilir, indeks yerine sebebi görünür.
                </p>

                {shareUrl && (
                  <div className="mt-4">
                    <label htmlFor="paylasim-linki" className="text-xs text-muted">
                      Bu adres sistemi açar
                    </label>
                    <input
                      id="paylasim-linki"
                      readOnly
                      value={shareUrl}
                      onFocus={(event) => event.currentTarget.select()}
                      className="mt-1 w-full rounded-md border border-border bg-background px-2.5 py-1.5 font-mono text-xs"
                    />
                    <a className="mt-2 inline-block text-sm text-accent underline" href={shareUrl}>
                      Kaydedilen sistemi aç →
                    </a>
                  </div>
                )}

                {saveError && (
                  <p
                    role="alert"
                    className="mt-3 rounded-md border border-red-600/40 bg-red-500/[0.07] px-3 py-2 text-sm text-red-700 dark:text-red-400"
                  >
                    {saveError}
                  </p>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Bölüm başlığı — tipografi ölçeğinin tek yerde durması için.
 *
 * Yerel bir sunum yardımcısı; tasarım sistemi değil. Başlıklar sessiz
 * (küçük, büyük harf, gri), veriler yüksek sesli: bu bir ölçüm aleti ve
 * gözün gitmesi gereken yer sayı, başlık değil.
 */
function SectionTitle({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="text-xs font-semibold uppercase tracking-wider text-muted">
      {children}
    </h2>
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
  // opacity-40 yerine `text-muted`: %40 saydamlık gövde metninde WCAG AA'yı
  // (4.5:1) karşılamıyordu; --muted 6.4:1 veriyor.
  if (!price) return <span className="text-muted"> — fiyat yok</span>;
  return (
    <span className="num text-muted">
      {" "}
      — {formatPriceMinor(price.price_minor, price.currency)}
    </span>
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
          <li key={finding.code} className={`border-l-2 pl-3 text-sm leading-relaxed ${className}`}>
            {/* Kod renk değil METİN olarak taşınıyor: hata/uyarı ayrımı
                kenarlık rengiyle DE gösteriliyor ama tek başına renge
                bağlı değil — başlıkta "Hata"/"Uyarı" yazıyor. */}
            <span className="font-mono text-xs text-muted">{finding.code}</span>{" "}
            {finding.message}
            <div className="mt-0.5 font-mono text-xs text-muted">
              {finding.involved_part_ids.join(", ")}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
