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
      <p className="text-sm opacity-70">
        {resolution ? <>Bu çözünürlükte ({RESOLUTION_LABEL[resolution]}) </> : "Bu çözünürlükte "}
        henüz ölçüm yok. Ölçüm verisi olan çözünürlüğü seçerseniz liste görünür.
      </p>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm opacity-70">
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
    <div className="flex flex-col gap-3 text-sm">
      {/* K99: tek skor ile bu liste farklı şeyler ölçüyor. Çelişki gerçek ve
          gizlenmiyor. Test sisteminin işlemcisi ölçüm satırlarımızda kayıtlı
          DEĞİL (cpu_part_id boş), o yüzden hangi işlemci olduğu yazılmıyor —
          yazılsaydı kaynağı olmayan bir iddia olurdu. */}
      <div className="rounded border border-amber-500/40 bg-amber-500/5 p-3 text-xs">
        <p>
          <span className="font-medium">Bu sayılar yalnızca ekran kartına göredir.</span>{" "}
          İşlemcinin sınırlamadığı bir test sisteminde ölçülmüştür; seçtiğiniz işlemci bu
          sayılara <span className="font-medium">girmiyor</span>. İşlemciye yüklenen
          oyunlarda gerçek sonuç bunun altında kalabilir.
        </p>
        {/* Sayıyı değiştirmiyoruz (veri yok) ama kullanıcının işlemcisinin
            nerede durduğunu SÖYLÜYORUZ — çerçeve düzeltmesi. */}
        {cpuIndex !== undefined && (
          <p className="mt-1.5">
            Seçtiğiniz işlemci{cpuLabel ? ` (${cpuLabel})` : ""}: indeks{" "}
            <span className="font-medium">{cpuIndex}</span> — referans işlemci{" "}
            {REFERANS_CPU_INDEKS}.{" "}
            {cpuIndex < REFERANS_CPU_INDEKS
              ? "Referansın altında; işlemciye yüklenen oyunlarda fark daha belirgin olur."
              : cpuIndex > REFERANS_CPU_INDEKS
                ? "Referansın üstünde."
                : "Referans işlemcinin kendisi."}
          </p>
        )}
        {bottleneck === "cpu_limited" && (
          <p className="mt-1.5 font-medium">
            Sistem indeksi bu kurulumda işlemciyi sınırlayıcı buluyor — aşağıdaki sayılar
            bu yüzden iyimser olabilir.
          </p>
        )}
        {cpuIndex === undefined && (
          <p className="mt-1.5">
            Henüz ölçümü olan bir işlemci seçmediniz. Liste yalnızca ekran kartına baktığı
            için yine de görünüyor.
          </p>
        )}
      </div>

      {singleSetting && (
        <p className="text-xs opacity-60">
          Ayar: <span className="font-medium">{singleSetting}</span>. Şu an tek ayarda ölçüm
          var; başka çözünürlük ve preset için veri toplanmadı.
        </p>
      )}

      <ul className="flex flex-col divide-y rounded border">
        {sorted.map((row) => (
          <li key={row.game_id} className="flex items-baseline gap-3 p-2">
            <span className="flex-1">{row.game_name}</span>
            <span className="text-lg font-semibold tabular-nums">{row.fps}</span>
            <span className="text-xs opacity-60">FPS</span>
            {/* Ham sayı tek başına bir şey söylemiyor: 47 FPS iyi mi? */}
            <span className={`w-28 shrink-0 text-xs ${bandFor(row.fps).tone}`}>
              {bandFor(row.fps).label}
            </span>
            {/* K97: ölçülmüş ve türetilmiş AYRILIR. Kullanıcı sayının nereden
                geldiğini görmeli — bu sitenin tüm duruşu. */}
            {row.origin === "measured" ? (
              <span
                className="w-24 shrink-0 text-right text-xs text-emerald-600"
                title="Bu sayı ölçüldü, hesaplanmadı."
              >
                ● ölçüldü
              </span>
            ) : (
              <span
                className="w-24 shrink-0 text-right text-xs opacity-60"
                title={`Ölçüm yok; bu kartın indeksinden hesaplandı. Ortalama hata %${FPS_MARGIN.meanPercent}.`}
              >
                ○ tahmin ±%{FPS_MARGIN.p90Percent}
              </span>
            )}
            {!singleSetting && <span className="text-xs opacity-50">{row.setting_label}</span>}
          </li>
        ))}
      </ul>

      <p className="text-xs opacity-50">
        {counts.measured} oyunda sayı doğrudan ölçüm; {counts.derived} oyunda bu kartın
        ölçümü yok ve indeksinden hesaplandı. Hesaplananın ölçülen hata payı: ortalama %
        {FPS_MARGIN.meanPercent}, tahminlerin %90&apos;ı %{FPS_MARGIN.p90Percent} altında, en
        kötü %{FPS_MARGIN.maxPercent}. {FPS_MARGIN.method} ({FPS_MARGIN.measuredAt})
      </p>
      <p className="text-xs opacity-50">{FPS_BAND_NOTE}</p>
    </div>
  );
}
