"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import type { CurrentPrice } from "@/data/prices";
import type { BuilderCatalog } from "@/data/parts";
import { checkCompatibility } from "@/engine/compatibility";
import type { DefaultBuild } from "@/engine/default-build";
import { estimateGameFps } from "@/engine/fps-estimate";
import type { FpsGameGroup } from "@/engine/fps-estimate";
import { resolveGpuSelection, resolvePerfIndex } from "@/engine/gpu-selection";
import { bandKeyFor, computePerformance } from "@/engine/performance";
import { suggestUpgrades } from "@/engine/upgrade";
import type {
  Bottleneck,
  BuildInput,
  Finding,
  Resolution,
  UpgradeCategory,
  UpgradePart,
} from "@/engine/types";
import { DISPLAY_CURRENCY, SOURCE_CURRENCY, USD_TRY, toDisplayMinor } from "@/lib/currency";
import {
  formatDisplayPrice,
  formatIsoDate,
  formatNumber,
  formatPriceMinor,
  stripSku,
} from "@/lib/format";
import { PERF_MARGIN } from "@/lib/perf-margin";

import { saveBuildAction } from "./actions";
import { CountUp } from "./count-up";
import { GameFpsList } from "./game-fps";
import { IndexBar } from "./index-bar";

// Motora giden kategoriler. Depolama burada yok: hiçbir uyumluluk kuralı
// depolamayı kullanmıyor (S12), ama kullanıcı yine de birden fazla disk seçebilir.
const ENGINE_CATEGORIES = ["cpu", "gpu", "motherboard", "ram", "psu", "case"] as const;
type EngineCategory = (typeof ENGINE_CATEGORIES)[number];

// Motorun tanıdığı değerler. Ekranda ne yazacaklarını
// `performance.resolution.<value>` söylüyor — "4K" bir çeviri kararı.
const RESOLUTIONS: Resolution[] = ["1080p", "1440p", "2160p"];

/** K73: sabit referans sistemin indeksi. Tavan değil, ölçüt. */
const REFERENCE_INDEX = 100;

/**
 * Motorun darboğaz türü -> mesaj anahtarı.
 *
 * Motor `cpu_limited` diyor, çeviri dosyası `cpuLimited` bekliyor: veri
 * adlandırması ile mesaj adlandırması ayrı dünyalar ve eşlemeyi bir yerde
 * yapmak, her çağrıda dize çevirmekten açık.
 */
const BOTTLENECK_KEY: Record<Bottleneck, string> = {
  balanced: "balanced",
  cpu_limited: "cpuLimited",
  gpu_limited: "gpuLimited",
};

type Selection = Partial<Record<EngineCategory, string>>;

type BuilderProps = {
  catalog: BuilderCatalog;
  prices: Record<string, CurrentPrice>;
  perfIndexes: Record<string, number>;
  fpsGroups: FpsGameGroup[];
  /**
   * Sayfa ilk açıldığında dolu gelecek seçim (K144).
   *
   * Sunucuda `pickDefaultBuild` ile hesaplanıyor ve **yalnızca başlangıç
   * değeri** olarak kullanılıyor. Paylaşılan bir linkten gelen seçim
   * geri yüklendiğinde bu prop'a hiç bakılmaz: geri yüklenen seçim
   * `useState`'in başlangıcına o zaman kendisi girer.
   *
   * `null`: ölçümlü parçalardan uyumlu bir sistem kurulamadı; form boş açılır.
   */
  defaultSelection: DefaultBuild | null;
};

export function Builder({
  catalog,
  prices,
  perfIndexes,
  fpsGroups,
  defaultSelection,
}: BuilderProps) {
  // Ad alanları ayrı çağrılıyor: bir bileşenin hangi metin kümesini kullandığı
  // çağrıdan okunabilsin (K150).
  const t = useTranslations("parts");
  const tPerf = useTranslations("performance");
  const tComp = useTranslations("compatibility");
  const tPrice = useTranslations("pricing");
  const tCommon = useTranslations("common");
  const locale = useLocale();

  /** Sayı biçimi dile göre: binlik ve ondalık ayracı değişiyor. */
  const sayi = (value: number) => formatNumber(value, locale);
  /** Kategori adı — motorun anahtarı, ekranın çevirisi. */
  const kategoriAdi = (category: EngineCategory | "storage") => t(`category.${category}`);

  /**
   * Kur notu: cümle çeviri dosyasında, sayı `lib/currency.ts`te, biçim
   * `Intl`de. Üçü de kendi yerinde duruyor.
   */
  const kurNotu = tPrice(USD_TRY.manual ? "rateNoteManual" : "rateNoteAuto", {
    source: SOURCE_CURRENCY,
    // Kur da bir para tutarı: sembolü ve ondalık ayracı dile göre çıksın diye
    // `Intl`in para biçimlendiricisinden geçiyor.
    rate: formatPriceMinor(USD_TRY.rateMinor, DISPLAY_CURRENCY, locale),
    date: formatIsoDate(USD_TRY.quotedAt, locale),
  });

  // Başlangıç değeri tembel: `pickDefaultBuild` sunucuda bir kez çalıştı,
  // burada yalnızca kategori adlarına çevriliyor. Sonraki çizimlerde
  // kullanıcının seçimi geçerli — varsayılan bir daha uygulanmaz.
  const [selection, setSelection] = useState<Selection>(() =>
    defaultSelection
      ? {
          cpu: defaultSelection.cpu,
          gpu: defaultSelection.gpu,
          motherboard: defaultSelection.motherboard,
          ram: defaultSelection.ram,
          psu: defaultSelection.psu,
          case: defaultSelection.case,
        }
      : {},
  );
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
    const category = kategoriAdi(kind);
    return id
      ? tPerf("missing.noData", { category })
      : tPerf("missing.notSelected", { category });
  }

  /** Öneride görünen parça adı — motor id döndürüyor, adı katalog biliyor. */
  function labelOf(category: UpgradeCategory, id: string): string {
    const fromCategory = catalog[category].find((item) => item.id === id)?.label;
    if (fromCategory) return fromCategory;
    // Mevcut ekran kartı bir AIB kartı olabilir; adı ayrı listede duruyor (K86).
    return catalog.gpu_variant.find((variant) => variant.id === id)?.label ?? id;
  }

  const hicSecimYok = secilenSayisi === 0;

  /**
   * Bu parçanın FPS tahmini üretilebiliyor mu? (K145)
   *
   * Cevap `perf_index` tablosundan geliyor, gömülü bir listeden değil: ölçüm
   * eklendiğinde ya da silindiğinde gruplar kendiliğinden değişir.
   *
   * Kartlar (AIB) çiplerinin durumunu miras alır — indeks zaten iki seviyeli
   * okunuyor ve kartın kendi ölçümü yoksa çipinki kullanılıyor (K86, K87).
   */
  const olcumlu = (id: string) => perfIndexes[id] !== undefined;
  const olcumluKart = (variant: { chip_part_id: string; id: string }) =>
    olcumlu(variant.id) || olcumlu(variant.chip_part_id);

  /** Ölçümlüler önce. Grup içindeki sıra katalogdan geldiği gibi kalıyor. */
  function olcumeGoreAyir<T extends { id: string }>(items: readonly T[]) {
    return {
      olcumlu: items.filter((item) => olcumlu(item.id)),
      olcumsuz: items.filter((item) => !olcumlu(item.id)),
    };
  }

  /** Seçenek metni: ad + (varsa) fiyat. Fiyat çevrilemiyorsa hiç yazılmıyor. */
  function secenekMetni(id: string, label: string): string {
    const price = prices[id];
    const tl = price ? formatDisplayPrice(price.price_minor, price.currency, locale) : null;
    return tl ? `${label} — ${tl}` : label;
  }

  return (
    // Mobil önce: tek sütun. Geniş ekranda seçim solda YAPIŞIK kalıyor —
    // kullanıcı sonuçları okurken seçimini değiştirmek için yukarı kaymak
    // zorunda kalmasın. `min-w-0`: grid çocukları içeriklerinden küçülemez
    // ve uzun bellek adları <select>i şişirip 375 px'te taşma yapıyordu.
    <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-12 [&>*]:min-w-0">
      {/* ---------------- Seçim ---------------- */}
      <section aria-labelledby="secim-basligi" className="lg:sticky lg:top-6 lg:self-start">
        <SectionTitle id="secim-basligi">{t("heading")}</SectionTitle>

        <div className="mt-4 flex flex-col gap-4">
          {ENGINE_CATEGORIES.map((category) => (
            <div key={category} className="flex flex-col gap-2">
              {/* Etiket açıkça bağlanıyor (label/for) — sarmalamak da çalışır
                  ama ekran okuyucu için açık bağ daha güvenilir. */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`sec-${category}`} className="text-sm font-medium">
                  {kategoriAdi(category)}
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
                  <option value="">{t("notSelected")}</option>
                  {/*
                    Ekran kartı ve işlemci ÖLÇÜM DURUMUNA göre ikiye ayrılıyor
                    (K145). Katalogda 331 parça var ama ölçümü olan 15 ekran
                    kartı ve 12 işlemci; ayrım olmadan kullanıcı büyük
                    ihtimalle ölçümsüz bir parça seçip üç boş panele bakıyordu.
                    Sonucu SEÇMEDEN ÖNCE görsün diye ölçümsüz seçeneklerin
                    metnine de kısa bir işaret ekleniyor.

                    Diğer kategorilerde indeks kavramı yok; onlar düz liste.
                  */}
                  {category === "gpu" || category === "cpu" ? (
                    (() => {
                      // `catalog[category]` iki farklı spec tipinin birleşimi;
                      // gruplama yalnızca `id` alanına bakıyor, spec tipini
                      // hiç okumuyor. Daraltma bu yüzden güvenli.
                      const gruplar = olcumeGoreAyir<{ id: string; label: string }>(
                        catalog[category],
                      );
                      return (
                        <>
                          {gruplar.olcumlu.length > 0 && (
                            <optgroup label={t("coverageGroup.measured")}>
                              {gruplar.olcumlu.map((item) => (
                                <option key={item.id} value={item.id}>
                                  {secenekMetni(item.id, item.label)}
                                </option>
                              ))}
                            </optgroup>
                          )}
                          {gruplar.olcumsuz.length > 0 && (
                            <optgroup label={t("coverageGroup.unmeasured")}>
                              {gruplar.olcumsuz.map((item) => (
                                <option key={item.id} value={item.id}>
                                  {secenekMetni(item.id, item.label)} · {t("unmeasuredMarker")}
                                </option>
                              ))}
                            </optgroup>
                          )}
                        </>
                      );
                    })()
                  ) : (
                    catalog[category].map((item) => (
                      <option key={item.id} value={item.id}>
                        {secenekMetni(item.id, item.label)}
                      </option>
                    ))
                  )}
                </select>

                {/* Seçim yapıldıktan sonra da görünsün: açılır liste kapanınca
                    optgroup başlığı kaybolur, sonuç kaybolmamalı. */}
                {(category === "gpu" || category === "cpu") &&
                  selection[category] !== undefined &&
                  !olcumlu(selection[category]!) && (
                    <p className="text-xs leading-relaxed text-muted">
                      {t("unmeasuredNote", {
                        category: kategoriAdi(category).toLocaleLowerCase(locale),
                      })}
                    </p>
                  )}
              </div>

              {/*
                Kart (AIB) seçimi opsiyonel ikinci katman (K86). Yalnızca seçili
                çipin kartı varsa görünür: kartı olmayan çipte boş bir kutu
                göstermek, kullanıcıya doldurulacak bir alan varmış hissi verir.
              */}
              {category === "gpu" && variantsForChip.length > 0 && (
                <div className="flex flex-col gap-1.5 border-l-2 border-border pl-3">
                  <label htmlFor="sec-gpu-variant" className="text-sm font-medium">
                    {t("variant.label")}{" "}
                    <span className="font-normal text-muted">({t("variant.optional")})</span>
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
                    <option value="">{t("variant.unspecified")}</option>
                    {/* Kart, çipinin ölçüm durumunu miras alır (K86, K87):
                        kartın kendi indeksi yoksa çipinki kullanılıyor. Çipi
                        ölçümsüzse kart da FPS üretemez ve bunu söylüyor. */}
                    {variantsForChip.map((variant) => (
                      <option key={variant.id} value={variant.id}>
                        {secenekMetni(variant.id, variant.label)}
                        {olcumluKart(variant) ? "" : ` · ${t("unmeasuredMarker")}`}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs leading-relaxed text-muted">{t("variant.hint")}</p>
                </div>
              )}
            </div>
          ))}

          {/*
            Depolama da açılır liste (K146). Onay kutusu listesi 14 satırla
            sol sütunun üçte birini yiyordu ve diğer altı kategoriyle aynı
            dilde konuşmuyordu. Birden fazla seçilebildiği için `multiple`.

            Etiketlerden üretici stok kodu düşürülüyor (`stripSku`); tam hâli
            `title` ipucunda ve aşağıdaki seçilenler satırında duruyor.
          */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="sec-storage" className="text-sm font-medium">
              {t("storage.label")}{" "}
              <span className="font-normal text-muted">({t("storage.multipleHint")})</span>
            </label>
            <select
              id="sec-storage"
              multiple
              size={6}
              className="w-full min-w-0 rounded-md border border-border bg-background px-2.5 py-2 text-sm"
              value={storageIds}
              onChange={(event) => {
                forgetShareLink();
                setStorageIds([...event.target.selectedOptions].map((option) => option.value));
              }}
            >
              {catalog.storage.map((item) => (
                <option key={item.id} value={item.id} title={item.label}>
                  {secenekMetni(item.id, stripSku(item.label))} ·{" "}
                  {t("storage.detail", { type: item.storage_type, capacity: sayi(item.capacity_gb) })}
                </option>
              ))}
            </select>
            <p className="text-xs leading-relaxed text-muted">{t("storage.howTo")}</p>

            {/* Ayrıntı satırı: stok kodu dahil tam ad ve fiyat. */}
            {selectedStorage.length > 0 && (
              <ul className="mt-1 flex flex-col gap-1 text-xs text-muted">
                {selectedStorage.map((item) => {
                  const price = prices[item.id];
                  const tl = price
                    ? formatDisplayPrice(price.price_minor, price.currency, locale)
                    : null;
                  return (
                    <li key={item.id}>
                      {item.label}
                      {tl && <span className="num"> — {tl}</span>}
                    </li>
                  );
                })}
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      forgetShareLink();
                      setStorageIds([]);
                    }}
                    className="text-accent underline"
                  >
                    {t("storage.clear")}
                  </button>
                </li>
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* ---------------- Sonuçlar ---------------- */}
      {/* `sonuclar`: bölümler sırayla belirir (app/globals.css). Gecikme
          merdiveni CSS'te; burada tek sınıf duruyor. */}
      <div className="sonuclar flex flex-col gap-10">
        {hicSecimYok ? (
          /*
            Boş durum: yedi kategori + yedi sonuç bölümü aynı anda gelince
            kullanıcı nereye bakacağını bilmiyordu. Hiçbir şey seçilmemişken
            sonuç bölümleri hiç çizilmiyor; yerine sitenin ne söyleyeceği
            yazıyor ve kapsanan oyunlar baştan görünüyor (K129).
          */
          <section
            aria-labelledby="bos-durum"
            className="cam rounded-lg border border-border p-6"
          >
            <h2 id="bos-durum" className="text-lg font-semibold tracking-tight">
              {t("empty.heading")}
            </h2>
            <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
              {t("empty.intro")}
            </p>

            <dl className="mt-5 space-y-3 text-sm">
              <div>
                <dt className="font-medium">{t("empty.willSeeTitle")}</dt>
                <dd className="mt-0.5 leading-relaxed text-muted">{t("empty.willSee")}</dd>
              </div>
              <div>
                <dt className="font-medium">{t("empty.willNotSeeTitle")}</dt>
                <dd className="mt-0.5 leading-relaxed text-muted">{t("empty.willNotSee")}</dd>
              </div>
            </dl>

            <div className="mt-5 border-t border-border pt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
                {t("empty.coveredGamesTitle")}
              </h3>
              {kapsananOyunlar.length > 0 ? (
                <p className="mt-2 text-sm leading-relaxed">
                  {t.rich("empty.coveredGames", {
                    count: kapsananOyunlar.length,
                    resolution: tPerf(`resolution.${resolution}`),
                    // Oyun adları çevrilmez; liste ayracı da dile göre
                    // değişebilsin diye mesajın içinde değil, burada birleşiyor.
                    list: kapsananOyunlar.join(", "),
                    b: (chunks) => <span className="num font-medium">{chunks}</span>,
                    muted: (chunks) => <span className="text-muted">{chunks}</span>,
                  })}
                </p>
              ) : (
                <p className="mt-2 text-sm text-muted">{t("empty.noneAtResolution")}</p>
              )}
            </div>
          </section>
        ) : (
          <>
            {/*
              SIRALAMA ÖNCELİĞE GÖRE. Uyumluluk hataları en üstte çünkü sistem
              kurulamıyorsa performans sayısı ikincil. Eskiden en alttaydı.
            */}
            {(errors.length > 0 || warnings.length > 0) && (
              <section aria-labelledby="uyumluluk-basligi">
                <SectionTitle id="uyumluluk-basligi">{tComp("heading")}</SectionTitle>

                <div className="mt-4 flex flex-col gap-4">
                  {errors.length > 0 && (
                    <FindingList
                      title={tComp("errors", { count: errors.length })}
                      findings={errors}
                      className="border-red-600 dark:border-red-500"
                    />
                  )}
                  {warnings.length > 0 && (
                    <FindingList
                      title={tComp("warnings", { count: warnings.length })}
                      findings={warnings}
                      className="border-amber-600 dark:border-amber-500"
                    />
                  )}
                </div>
              </section>
            )}

            {findings.length === 0 && (
              <p className="text-sm text-muted">
                {tComp("noIssues")}
                {(gpuLengthUnknown || gpuTdpFromReference || psuLengthUnknown) && (
                  <> {tComp("noIssuesButSkipped")}</>
                )}
              </p>
            )}

            {/* ---- Performans ---- */}
            <section aria-labelledby="performans-basligi">
              <SectionTitle id="performans-basligi">{tPerf("heading")}</SectionTitle>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted">{tPerf("resolution.label")}</span>
                <div className="flex gap-1.5" role="group" aria-label={tPerf("resolution.label")}>
                  {RESOLUTIONS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={resolution === option}
                      onClick={() => {
                        // Çözünürlük dondurulan indeksi belirliyor; değişince
                        // eldeki paylaşım linki artık bu ekrandakini göstermiyor.
                        forgetShareLink();
                        setResolution(option);
                      }}
                      className={`rounded-md border px-3 py-1 text-sm ${
                        resolution === option
                          ? "border-accent bg-accent/10 font-medium text-accent"
                          : "border-border text-muted"
                      }`}
                    >
                      {tPerf(`resolution.${option}`)}
                    </button>
                  ))}
                </div>
              </div>

              {performance.ok ? (
                <div className="mt-4">
                  {/* Sayı ile etiketi arasında belirgin hiyerarşi. */}
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <output className="num text-4xl font-semibold tracking-tight">
                      <CountUp value={performance.system_index} />
                    </output>
                    {/* K73: 100 tavan değil, sabit referans sistemin değeri. */}
                    <span className="text-sm text-muted">
                      {tPerf.rich("systemIndex.suffix", {
                        reference: sayi(REFERENCE_INDEX),
                        b: (chunks) => <span className="num">{chunks}</span>,
                      })}
                    </span>
                  </div>

                  <IndexBar value={performance.system_index} />

                  <p className="mt-2 text-sm">
                    {tPerf(`band.${bandKeyFor(performance.system_index)}`)}{" "}
                    <span className="text-xs text-muted">({tCommon("estimated")})</span>
                  </p>

                  {/* Kataloğun en iyileri bilinmiyorsa satır hiç gösterilmez (K83). */}
                  {performance.bottleneck_message && performance.bottleneck && (
                    <div className="mt-3 rounded-md border border-border bg-surface px-3 py-2.5">
                      <p className="text-sm">
                        <span className="font-medium">{tPerf("bottleneck.label")}</span>{" "}
                        {/* Metin motorun hazır cümlesinden değil, darboğaz
                            TÜRÜNDEN üretiliyor: motor Türkçe yazıyor, arayüz
                            kendi dilinde söylüyor (K150). */}
                        {tPerf(`bottleneck.${BOTTLENECK_KEY[performance.bottleneck]}`)}
                      </p>
                      {performance.bottleneck_gain && (
                        <p className="mt-1 text-xs text-muted">
                          {tPerf.rich("bottleneck.gain", {
                            gpu: sayi(performance.bottleneck_gain.gpu),
                            cpu: sayi(performance.bottleneck_gain.cpu),
                            b: (chunks) => <span className="num">{chunks}</span>,
                          })}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="mt-3 space-y-1 text-xs leading-relaxed text-muted">
                    <p>
                      {tPerf.rich("systemIndex.weights", {
                        gpuIndex: sayi(performance.gpu_index),
                        cpuIndex: sayi(performance.cpu_index),
                        gpuWeight: sayi(performance.weights.gpu),
                        cpuWeight: sayi(performance.weights.cpu),
                        modelVersion: performance.model_version,
                        b: (chunks) => <span className="num">{chunks}</span>,
                      })}
                    </p>
                    {/* Çipin indeksi kartın ölçümü değildir (K86). */}
                    {gpuVariant && gpuIndex.origin === "chip" && (
                      <p>
                        {tPerf("systemIndex.chipMeasurement", { chip: gpuChip?.label ?? "" })}
                      </p>
                    )}
                    {/* Hata payı ölçülür, tahmin edilmez (K79). */}
                    <p>
                      {tPerf("systemIndex.margin", {
                        mean: sayi(PERF_MARGIN.meanPercent),
                        max: sayi(PERF_MARGIN.maxPercent),
                        // `PERF_MARGIN.method` Türkçe ve o dosyaya
                        // dokunulmuyor; yöntem adı çeviriden okunuyor.
                        method: tPerf("systemIndex.method"),
                        measuredAt: PERF_MARGIN.measuredAt,
                      })}
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
                      <p className="text-sm">{tPerf("missing.indexTitle")}</p>
                      <ul className="mt-1.5 list-inside list-disc text-xs text-muted">
                        {performance.missing.map((kind) => (
                          <li key={kind}>{eksikSebebi(kind)}</li>
                        ))}
                      </ul>
                      <p className="mt-2 text-xs leading-relaxed text-muted">
                        {tPerf("missing.partsStillValid")}
                        {fpsRows.length > 0 && (
                          <>
                            {" "}
                            <span className="font-medium text-foreground">
                              {tPerf("missing.fpsStillShown")}
                            </span>{" "}
                            {tPerf("missing.fpsStillShownWhy")}
                          </>
                        )}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm">{tPerf("missing.needBoth")}</p>
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
              <SectionTitle id="fps-basligi">{tPerf("fps.heading")}</SectionTitle>
              <div className="mt-4">
                {gpuChipId === undefined ? (
                  <div className="rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-muted">
                    <p>{tPerf("fps.pickGpu")}</p>
                    {kapsananOyunlar.length > 0 ? (
                      <p className="mt-1.5 text-xs leading-relaxed">
                        {tPerf.rich("fps.coveredGames", {
                          count: kapsananOyunlar.length,
                          list: kapsananOyunlar.join(", "),
                          b: (chunks) => <span className="num">{chunks}</span>,
                        })}
                      </p>
                    ) : (
                      <p className="mt-1.5 text-xs">{tPerf("fps.noneAtResolution")}</p>
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
              <SectionTitle id="fiyat-basligi">{tPrice("totalHeading")}</SectionTitle>
              <div className="mt-4">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <output className="num text-2xl font-semibold tracking-tight">
                    {formatPriceMinor(priceSummary.totalMinor, DISPLAY_CURRENCY, locale)}
                  </output>
                  <span className="text-xs text-muted">{tCommon("estimated")}</span>
                </div>
                <div className="mt-2 space-y-0.5 text-xs text-muted">
                  <p>
                    {priceSummary.latestIso
                      ? tPrice("lastUpdated", {
                          date: formatIsoDate(priceSummary.latestIso, locale),
                        })
                      : tPrice("noPriceRecord")}
                  </p>
                  {/* Kur canlı değil ve öyle sunulmuyor (K148). */}
                  <p>{kurNotu}</p>
                  {priceSummary.missing > 0 && (
                    <p>{tPrice("missingCount", { count: priceSummary.missing })}</p>
                  )}
                  {priceSummary.unconvertible > 0 && (
                    <p>{tPrice("unconvertibleCount", { count: priceSummary.unconvertible })}</p>
                  )}
                </div>
              </div>
            </section>

            {/*
              ---- Kontrol edilemeyenler ----

              Bu blok eskiden sağ sütunun EN ÜSTÜNDEydi ve kullanıcının okuduğu
              ilk şey iki gri "bunu bilmiyoruz" kutusuydu (K147). İçerik aynen
              duruyor — dürüstlük burada asıl mesele — ama sırası ve vurgusu
              düştü: performans, FPS ve fiyattan sonra geliyor ve kapalı
              açılıyor.

              K134 bozulmadı: uyumluluk HATALARI hâlâ en üstte. Aşağı inen şey
              hata değil, "veri eksik olduğu için bu kural çalışmadı" bilgisi.
            */}
            {(gpuLengthUnknown || gpuTdpFromReference || psuLengthUnknown) && (
              <section aria-labelledby="kontrol-edilemeyen-basligi">
                <details className="rounded-md border border-border bg-surface">
                  <summary className="cursor-pointer px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted">
                    <span id="kontrol-edilemeyen-basligi">
                      {tComp("uncheckable.heading", {
                        count: [gpuLengthUnknown, gpuTdpFromReference, psuLengthUnknown].filter(
                          Boolean,
                        ).length,
                      })}
                    </span>
                  </summary>

                  <div className="space-y-2 border-t border-border px-3 py-3">
                    {gpuLengthUnknown && (
                      <p className="text-sm leading-relaxed text-muted">
                        {tComp(
                          gpuVariant
                            ? "uncheckable.gpuLengthWithCard"
                            : "uncheckable.gpuLengthChipOnly",
                        )}
                      </p>
                    )}
                    {gpuTdpFromReference && (
                      <p className="text-sm leading-relaxed text-muted">
                        {tComp("uncheckable.gpuTdpFromReference")}
                      </p>
                    )}
                    {psuLengthUnknown && (
                      <p className="text-sm leading-relaxed text-muted">
                        {tComp("uncheckable.psuLength")}
                      </p>
                    )}
                  </div>
                </details>
              </section>
            )}

            {/* ---- Yükseltme önerisi ---- */}
            <section aria-labelledby="yukseltme-basligi">
              <SectionTitle id="yukseltme-basligi">{tPrice("upgrade.heading")}</SectionTitle>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <label htmlFor="butce" className="text-xs text-muted">
                  {tPrice("upgrade.budgetLabel")}
                </label>
                <div className="flex items-center gap-1.5">
                  <span aria-hidden="true" className="text-sm text-muted">
                    +
                  </span>
                  <input
                    id="butce"
                    className="num w-28 rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
                    inputMode="numeric"
                    placeholder={tPrice("upgrade.budgetPlaceholder")}
                    value={budgetText}
                    onChange={(event) => setBudgetText(event.target.value)}
                  />
                  <span className="text-sm text-muted">{DISPLAY_CURRENCY}</span>
                </div>
              </div>

              <div className="mt-3">
                {olcumEksik ? (
                  <p className="text-sm leading-relaxed text-muted">
                    {tPrice("upgrade.needsMeasurement")}
                  </p>
                ) : !performance.ok ? (
                  <p className="text-sm leading-relaxed text-muted">{tPrice("upgrade.needsParts")}</p>
                ) : upgrades.length === 0 ? (
                  <p className="text-sm text-muted">
                    {tPrice(budgetMinor === 0 ? "upgrade.enterBudget" : "upgrade.nothingFound")}
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
                            {kategoriAdi(upgrade.category as EngineCategory)}:
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
                          {tPrice.rich("upgrade.delta", {
                            // Motora zaten gösterim para biriminde değer verildi
                            // (K148); burada ikinci bir çevrim YOK.
                            price:
                              (upgrade.price_delta_minor >= 0 ? "+" : "") +
                              formatPriceMinor(
                                upgrade.price_delta_minor,
                                DISPLAY_CURRENCY,
                                locale,
                              ),
                            before: sayi(upgrade.index_before),
                            after: sayi(upgrade.index_after),
                            delta: "+" + sayi(upgrade.index_delta),
                            b: (chunks) => <span className="num">{chunks}</span>,
                          })}
                          {index === 0 && upgrades.length > 1 && ` · ${tPrice("upgrade.bestValue")}`}
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
              className="cam rounded-lg border border-border p-4 sm:p-5"
            >
              <SectionTitle id="sistem-basligi">{t("selected.heading")}</SectionTitle>

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
                      <span className="text-muted">{kategoriAdi(category)}:</span> {item?.label}
                      {category === "gpu" && gpuVariant && (
                        <span className="text-xs text-muted">
                          {" · "}
                          {t("selected.chip", { name: gpuChip?.label ?? "" })}
                        </span>
                      )}
                      <PriceTag price={item ? prices[item.id] : undefined} />
                    </li>
                  );
                })}
                {selectedStorage.map((item) => (
                  <li key={item.id}>
                    <span className="text-muted">{kategoriAdi("storage")}:</span> {item.label}
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
                  {saving ? t("selected.saving") : t("selected.save")}
                </button>

                <p className="mt-2 text-xs leading-relaxed text-muted">
                  {t("selected.saveNote", { resolution: tPerf(`resolution.${resolution}`) })}
                </p>

                {shareUrl && (
                  <div className="mt-4">
                    <label htmlFor="paylasim-linki" className="text-xs text-muted">
                      {t("selected.shareLabel")}
                    </label>
                    <input
                      id="paylasim-linki"
                      readOnly
                      value={shareUrl}
                      onFocus={(event) => event.currentTarget.select()}
                      className="mt-1 w-full rounded-md border border-border bg-background px-2.5 py-1.5 font-mono text-xs"
                    />
                    <a className="mt-2 inline-block text-sm text-accent underline" href={shareUrl}>
                      {t("selected.openSaved")}
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
  // Bütçe kutusu TL soruyor; fiyat kaynağı USD. Çevrilmeden verilseydi motor
  // USD sentini TL kuruşuyla karşılaştırır ve "bu bütçeyle şunu alabilirsin"
  // cevabı ~41 kat yanlış çıkardı (K148).
  const converted = toDisplayMinor(price.price_minor, price.currency);
  if (converted === null) return undefined;
  return { id, price_minor: converted, perf_index: perfIndex };
}

/** Katalog listesini aday listesine çevirir; fiyatı olmayanlar elenir. */
function toCandidates(
  items: { id: string }[],
  prices: Record<string, CurrentPrice>,
  perfIndexes: Record<string, number>,
): UpgradePart[] {
  // Fiyatı olmayan ya da çevrilemeyen aday elenir: ikisi de "bu parçanın
  // TL karşılığını bilmiyoruz" demek ve bütçe karşılaştırmasına giremez.
  return items
    .map((item): UpgradePart | null => {
      const price = prices[item.id];
      if (!price) return null;
      const converted = toDisplayMinor(price.price_minor, price.currency);
      if (converted === null) return null;
      return { id: item.id, price_minor: converted, perf_index: perfIndexes[item.id] };
    })
    .filter((item): item is UpgradePart => item !== null);
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
  let unconvertible = 0;

  for (const id of partIds) {
    const price = prices[id];
    if (!price) {
      missing += 1;
      continue;
    }
    // Toplam TEK para biriminde yürüyor: her satır önce ekranın para birimine
    // çevriliyor (K148). Eskiden farklı para birimleri hiç toplanmıyordu
    // çünkü kur yoktu; artık tek bir kur ve tarihi var ve ikisi de ekranda
    // yazıyor. Çevrilemeyen satır toplama girmiyor.
    const converted = toDisplayMinor(price.price_minor, price.currency);
    if (converted === null) {
      unconvertible += 1;
      continue;
    }
    totalMinor += converted;
    // "Son güncelleme": toplamı oluşturan fiyatların en yenisi.
    if (!latestIso || price.collected_at > latestIso) latestIso = price.collected_at;
  }

  return { totalMinor, latestIso, missing, unconvertible };
}

/** Fiyatı olan parçanın yanında fiyatı, olmayanda "fiyat yok" yazar. */
function PriceTag({ price }: { price?: CurrentPrice }) {
  const t = useTranslations("pricing");
  const locale = useLocale();

  // opacity-40 yerine `text-muted`: %40 saydamlık gövde metninde WCAG AA'yı
  // (4.5:1) karşılamıyordu; --muted 6.4:1 veriyor.
  if (!price) return <span className="text-muted"> {t("noPrice")}</span>;
  const tl = formatDisplayPrice(price.price_minor, price.currency, locale);
  // Çevrilemeyen para birimi: sayı hiç gösterilmiyor, sebebi yazılıyor.
  if (!tl) {
    return (
      <span className="text-muted"> {t("unconvertible", { currency: price.currency })}</span>
    );
  }
  return <span className="num text-muted"> — {tl}</span>;
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
  // Kural cümlesi motorun hazır metninden DEĞİL, `code` + `params` ile
  // çeviriden kuruluyor (K150). Böylece "soket X, anakart Y" sırasını dil
  // kendisi belirliyor; metin birleştirme yok.
  const t = useTranslations("compatibility.rules");

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
            {t(finding.code, finding.params)}
            <div className="mt-0.5 font-mono text-xs text-muted">
              {finding.involved_part_ids.join(", ")}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
