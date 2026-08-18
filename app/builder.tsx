"use client";

import { useMemo, useState } from "react";

import type { BuilderCatalog } from "@/data/parts";
import { checkCompatibility } from "@/engine/compatibility";
import type { BuildInput, Finding } from "@/engine/types";

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

type Selection = Partial<Record<EngineCategory, string>>;

export function Builder({ catalog }: { catalog: BuilderCatalog }) {
  const [selection, setSelection] = useState<Selection>({});
  const [storageIds, setStorageIds] = useState<string[]>([]);

  // Seçilen id'lerden motorun beklediği girdiyi kur.
  const buildInput = useMemo<BuildInput>(() => {
    const input: BuildInput = {};
    for (const category of ENGINE_CATEGORIES) {
      const id = selection[category];
      if (!id) continue;
      const item = catalog[category].find((candidate) => candidate.id === id);
      if (item) {
        // Her kategorinin spec tipi farklı; atama kategori bazında güvenli.
        (input as Record<string, unknown>)[category] = item.spec;
      }
    }
    return input;
  }, [selection, catalog]);

  const findings = useMemo(() => checkCompatibility(buildInput), [buildInput]);
  const errors = findings.filter((finding) => finding.level === "error");
  const warnings = findings.filter((finding) => finding.level === "warning");

  const selectedStorage = catalog.storage.filter((item) => storageIds.includes(item.id));
  const secilenSayisi = Object.values(selection).filter(Boolean).length + selectedStorage.length;

  function toggleStorage(id: string) {
    setStorageIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  }

  return (
    <div className="grid gap-8 md:grid-cols-2">
      {/* --- Seçim --- */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Parça seç</h2>

        <div className="flex flex-col gap-3">
          {ENGINE_CATEGORIES.map((category) => (
            <label key={category} className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{CATEGORY_LABEL[category]}</span>
              <select
                className="rounded border px-2 py-1"
                value={selection[category] ?? ""}
                onChange={(event) =>
                  setSelection((current) => ({
                    ...current,
                    [category]: event.target.value || undefined,
                  }))
                }
              >
                <option value="">— seçilmedi —</option>
                {catalog[category].map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
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
                </span>
              </label>
            ))}
          </fieldset>
        </div>
      </section>

      {/* --- Sonuç --- */}
      <section className="flex flex-col gap-6">
        <div>
          <h2 className="mb-3 text-lg font-semibold">Seçilen sistem</h2>
          {secilenSayisi === 0 ? (
            <p className="text-sm opacity-70">Henüz parça seçilmedi.</p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {ENGINE_CATEGORIES.filter((category) => selection[category]).map((category) => {
                const item = catalog[category].find(
                  (candidate) => candidate.id === selection[category],
                );
                return (
                  <li key={category}>
                    <span className="opacity-60">{CATEGORY_LABEL[category]}:</span> {item?.label}
                  </li>
                );
              })}
              {selectedStorage.map((item) => (
                <li key={item.id}>
                  <span className="opacity-60">Depolama:</span> {item.label}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h2 className="mb-3 text-lg font-semibold">Uyumluluk</h2>

          {findings.length === 0 ? (
            <p className="text-sm">
              {secilenSayisi === 0
                ? "Parça seçince kontrol edilecek."
                : "Sorun bulunamadı."}
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
