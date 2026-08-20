// Oyun bazlı FPS listesi — Faz A.1'in arayüzü.
//
// İki sayfada kullanılıyor: sistem oluşturucu (app/builder.tsx) ve kaydedilmiş
// sistem (app/sistem/[id]/page.tsx). Tek dosyada durmasının sebebi, dürüstlük
// kurallarının iki yerde ayrışmaması:
//
//   K97 — ölçülmüş ve türetilmiş ayrı işaretlenir
//   K98 — FPS'e göre sıralanmaz, alfabetik
//   K99 — tek skorla çeliştiği gizlenmez, listenin başında not
//
// Bu üçü metin olarak burada duruyor. İki kopya olsaydı biri güncellenip
// diğeri unutulurdu ve iki sayfa aynı veri hakkında farklı şey söylerdi.

import { countByOrigin } from "@/engine/fps-estimate";
import type { GameFpsEstimate } from "@/engine/fps-estimate";
import type { Resolution } from "@/engine/types";
import type { Bottleneck } from "@/engine/types";
import { RESOLUTION_LABEL } from "@/lib/format";
import { FPS_BAND_NOTE, bandFor } from "@/lib/fps-bands";
import { FPS_MARGIN } from "@/lib/fps-margin";

type GameFpsListProps = {
  rows: GameFpsEstimate[];
  /** Sistemde ekran kartı var mı? Yoksa bileşen hiçbir şey çizmez. */
  gpuSelected: boolean;
  /**
   * Kullanıcının seçtiği (ya da sistemin kaydedildiği) çözünürlük.
   *
   * Ölçümün yapıldığı çözünürlükle aynı olmak zorunda değil: bugün elimizde
   * yalnızca 1440p ölçümü var. Farklıysa söylenir — 4K seçmiş birine 1440p
   * sayısı gösterip susmak yanlış olurdu.
   */
  resolution?: Resolution;
  /**
   * Seçili çözünürlükte hiç ölçüm grubu var mı?
   *
   * "Kart kapsam dışı" ile "bu çözünürlükte hiç veri yok" farklı iki durum ve
   * kullanıcıya farklı şey söylerler: birincisinde başka kart seçmek işe
   * yarar, ikincisinde yaramaz.
   */
  hasDataForResolution?: boolean;
  /**
   * Seçilen işlemcinin indeksi ve adı. Liste GPU-sınırlı olduğu için
   * işlemci sayıya girmiyor (K99) — ama kullanıcının işlemcisinin nerede
   * durduğunu SÖYLEMEK, sayıyı değiştirmeden yanıltıcılığı azaltıyor.
   */
  cpuIndex?: number;
  cpuLabel?: string;
  /** Sistem indeksinin darboğaz sonucu (K83). Listeye de bağlanıyor. */
  bottleneck?: Bottleneck | null;
};

/** İşlemci indeksinin referansı — K73'teki sabit referans parça = 100. */
const REFERANS_CPU_INDEKS = 100;

export function GameFpsList({
  rows,
  gpuSelected,
  resolution,
  hasDataForResolution = true,
  cpuIndex,
  cpuLabel,
  bottleneck,
}: GameFpsListProps) {
  if (!gpuSelected) return null;

  if (!hasDataForResolution) {
    return (
      <p className="rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-muted">
        {resolution ? <>Bu çözünürlükte ({RESOLUTION_LABEL[resolution]}) </> : "Bu çözünürlükte "}
        henüz ölçüm yok. Ölçüm verisi olan çözünürlüğü seçerseniz liste görünür.
      </p>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-muted">
        Bu kart için ölçüm yok. Oyun bazlı FPS yalnızca ölçüm verisi toplanmış kartlarda
        gösterilebiliyor; uydurma bir sayı göstermektense hiç göstermiyoruz.
      </p>
    );
  }

  // K98: FPS'e göre SIRALANMAZ. FPS'e göre dizmek kullanıcıyı "en yüksek sayıyı
  // gör" yönünde koşullandırır; oysa kullanıcı belirli bir oyunu arıyor.
  // Sıralama motorda değil burada: bir sunum kararıdır.
  const sorted = [...rows].sort((a, b) => a.game_name.localeCompare(b.game_name, "tr"));
  const counts = countByOrigin(rows);

  // Bütün satırlar aynı ayardaysa etiket bir kez başta yazılır; farklıysa satır
  // satır. Bugün tek ayar var, ama ikinci ayar geldiğinde satırın hangi ayarda
  // ölçüldüğü kaybolmamalı.
  const settings = new Set(rows.map((row) => row.setting_label));
  const singleSetting = settings.size === 1 ? [...settings][0] : null;

  return (
    <div className="flex flex-col gap-4">
      {/* K99: tek skor ile bu liste farklı şeyler ölçüyor. Çelişki gerçek ve
          gizlenmiyor. Test sisteminin işlemcisi ölçüm satırlarımızda kayıtlı
          DEĞİL (cpu_part_id boş), o yüzden hangi işlemci olduğu yazılmıyor. */}
      <div className="rounded-md border border-amber-600/35 bg-amber-500/[0.07] p-3 text-xs leading-relaxed">
        <p>
          <strong className="font-semibold">Bu sayılar yalnızca ekran kartına göredir.</strong>{" "}
          İşlemcinin sınırlamadığı bir test sisteminde ölçülmüştür; seçtiğiniz işlemci bu
          sayılara girmiyor. İşlemciye yüklenen oyunlarda gerçek sonuç bunun altında
          kalabilir.
        </p>
        {cpuIndex !== undefined && (
          <p className="mt-2">
            Seçtiğiniz işlemci{cpuLabel ? ` (${cpuLabel})` : ""}: indeks{" "}
            <span className="num font-semibold">{cpuIndex}</span>, referans{" "}
            <span className="num">{REFERANS_CPU_INDEKS}</span>.{" "}
            {cpuIndex < REFERANS_CPU_INDEKS
              ? "Referansın altında; işlemciye yüklenen oyunlarda fark daha belirgin olur."
              : cpuIndex > REFERANS_CPU_INDEKS
                ? "Referansın üstünde."
                : "Referans işlemcinin kendisi."}
          </p>
        )}
        {bottleneck === "cpu_limited" && (
          <p className="mt-2 font-semibold">
            Sistem indeksi bu kurulumda işlemciyi sınırlayıcı buluyor — aşağıdaki sayılar
            bu yüzden iyimser olabilir.
          </p>
        )}
        {cpuIndex === undefined && (
          <p className="mt-2">
            Henüz ölçümü olan bir işlemci seçmediniz. Liste yalnızca ekran kartına baktığı
            için yine de görünüyor.
          </p>
        )}
      </div>

      {singleSetting && (
        <p className="text-xs text-muted">
          Ayar: <span className="font-medium text-foreground">{singleSetting}</span>
        </p>
      )}

      {/*
        Ölçülmüş / tahmin ayrımı RENGE BAĞLI DEĞİL: ölçülmüş satır dolu bir
        kare ve düz kenarlık taşıyor, tahmin satırı boş kare ve KESİKLİ
        kenarlık. Renk yalnızca üçüncü bir ipucu (WCAG 1.4.1).
      */}
      <ul className="divide-y divide-border overflow-hidden rounded-md border border-border">
        {sorted.map((row) => {
          const band = bandFor(row.fps);
          const olculdu = row.origin === "measured";
          return (
            <li
              key={row.game_id}
              className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2.5 sm:flex-nowrap"
            >
              <span className="min-w-0 flex-1 truncate text-sm">{row.game_name}</span>

              {/* Sayı ile birimi arasında belirgin hiyerarşi. */}
              <span className="flex shrink-0 items-baseline gap-1">
                <output className="num text-xl font-semibold tracking-tight">{row.fps}</output>
                <span className="text-[11px] text-muted">FPS</span>
              </span>

              <span className={`w-32 shrink-0 text-xs ${band.tone}`}>{band.label}</span>

              <span
                className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] ${
                  olculdu
                    ? "border border-border bg-surface text-foreground"
                    : "border border-dashed border-border text-muted"
                }`}
                title={
                  olculdu
                    ? "Bu sayı ölçüldü, hesaplanmadı."
                    : `Ölçüm yok; bu kartın indeksinden hesaplandı. Ortalama hata %${FPS_MARGIN.meanPercent}.`
                }
              >
                <span aria-hidden="true">{olculdu ? "■" : "□"}</span>{" "}
                {olculdu ? "ölçüldü" : <>tahmin ±%<span className="num">{FPS_MARGIN.p90Percent}</span></>}
              </span>

              {!singleSetting && (
                <span className="shrink-0 text-[11px] text-muted">{row.setting_label}</span>
              )}
            </li>
          );
        })}
      </ul>

      <div className="space-y-1 text-xs leading-relaxed text-muted">
        <p>
          <span className="num font-medium text-foreground">{counts.measured}</span> oyunda
          sayı doğrudan ölçüm,{" "}
          <span className="num font-medium text-foreground">{counts.derived}</span> oyunda bu
          kartın ölçümü yok ve indeksinden hesaplandı.
        </p>
        <p>
          Hesaplananın ölçülen hata payı: ortalama %
          <span className="num">{FPS_MARGIN.meanPercent}</span>, tahminlerin %90&apos;ı %
          <span className="num">{FPS_MARGIN.p90Percent}</span> altında, en kötü %
          <span className="num">{FPS_MARGIN.maxPercent}</span>. {FPS_MARGIN.method} (
          {FPS_MARGIN.measuredAt})
        </p>
        <p>{FPS_BAND_NOTE}</p>
      </div>
    </div>
  );
}
