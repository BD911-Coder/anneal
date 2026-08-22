// Sayfa ilk açıldığında gösterilecek varsayılan sistemi seçer.
//
// NEDEN VAR: katalogda 331 parça var ama ölçümü olan 15 ekran kartı ve 12
// işlemci. Boş bir formla karşılaşan kullanıcı büyük ihtimalle ölçümü olmayan
// bir parça seçiyor ve sitenin ne yaptığını hiç görmeden üç boş panele
// bakıyordu. Varsayılan seçim, ilk saniyede dolu bir ekran gösteriyor.
//
// NEDEN MOTORDA: burada uyumluluk kararı veriliyor ve o karar test edilmeli.
// Arayüzde dursaydı, "varsayılan sistem uyumsuz çıktı" hatası ancak birisi
// gözüyle görünce anlaşılırdı.
//
// NEDEN SABİT LİSTE DEĞİL: parça slug'ı gömülseydi, o parça katalogdan
// çıktığında ya da ölçümü silindiğinde varsayılan sessizce bozulurdu. Seçim
// her seferinde eldeki veriden yapılıyor.
//
// Bu dosya `perf_index` ya da FPS hesabını DEĞİŞTİRMİYOR; ikisini de yalnızca
// okuyor.

// `.ts` uzantısı bilinçli: bu dosya `/scripts` altındaki bir kontrolden çıplak
// Node ile de yüklenebilmeli ve Node uzantısız göreli yolu çözemiyor. Motorun
// geri kalanı uzantısız yazılmış çünkü oradaki içe aktarmalar `import type` —
// tip içe aktarmaları derlemede siliniyor, çalışma anında çözülmüyorlar.
// Aynı gerekçe CLAUDE.md'de `/data` için yazılı.
import { checkCompatibility, requiredWattage } from "./compatibility.ts";
import type {
  BuildInput,
  EngineCase,
  EngineCpu,
  EngineGpu,
  EngineMotherboard,
  EnginePsu,
  EngineRam,
} from "./types";

type Item<TSpec> = { id: string; spec: TSpec };

export type DefaultBuildCandidates = {
  cpu: Item<EngineCpu>[];
  gpu: Item<EngineGpu>[];
  motherboard: Item<EngineMotherboard>[];
  ram: Item<EngineRam>[];
  psu: Item<EnginePsu>[];
  case: Item<EngineCase>[];
};

export type DefaultBuild = {
  cpu: string;
  gpu: string;
  motherboard: string;
  ram: string;
  psu: string;
  case: string;
};

/**
 * Orta segment seçilir, amiral gemisi değil.
 *
 * Ölçümü olan parçalar indekse göre sıralanıp ortadaki alınıyor. En hızlısını
 * varsayılan yapmak, siteyi gördüğü ilk sayıyı "en iyi" sanan bir kullanıcıya
 * yanlış bir çıpa verirdi; en yavaşı da tersini yapardı.
 */
function medianIndex(count: number): number {
  return Math.floor((count - 1) / 2);
}

/**
 * Ortadan başlayıp iki yana açılan sıra: 3, 2, 4, 1, 5…
 *
 * İlk aday uyumlu bir sistem kuramazsa (soketi olan anakart yoksa, gücü yeten
 * güç kaynağı yoksa) komşusuna geçiliyor. Böylece "orta segment" tercihi
 * korunuyor ama tek bir parçanın eksiği bütün varsayılanı düşürmüyor.
 */
function fromMiddleOutward<T>(sorted: T[]): T[] {
  if (sorted.length === 0) return [];
  const start = medianIndex(sorted.length);
  const out: T[] = [sorted[start]];
  for (let step = 1; out.length < sorted.length; step += 1) {
    const before = start - step;
    const after = start + step;
    if (before >= 0) out.push(sorted[before]);
    if (after < sorted.length) out.push(sorted[after]);
  }
  return out;
}

/** Arama üst sınırı: bulunamayan varsayılan, sayfayı yavaşlatan aramadan iyidir. */
const MAX_CHECKS = 4000;

/**
 * Ölçümü olan bir ekran kartı + işlemci ve bunlarla **uyumluluk hatası
 * üretmeyen** anakart/bellek/güç kaynağı/kasa seçer.
 *
 * Uyumluluğa `checkCompatibility` karar veriyor — burada kuralların bir kopyası
 * yazılmadı. Ön eleme (soket, bellek tipi, watt) yalnızca aramayı kısaltmak
 * için; son sözü her zaman motor söylüyor.
 *
 * Hiçbir kombinasyon hatasız çıkmazsa `null` döner ve arayüz boş formu
 * gösterir. Uydurma bir varsayılan göstermektense hiç göstermemek doğru.
 */
export function pickDefaultBuild(
  candidates: DefaultBuildCandidates,
  perfIndexes: Record<string, number>,
): DefaultBuild | null {
  const measured = <TSpec>(items: Item<TSpec>[]) =>
    items
      .filter((item) => perfIndexes[item.id] !== undefined)
      .sort((a, b) => perfIndexes[a.id] - perfIndexes[b.id]);

  const gpus = fromMiddleOutward(measured(candidates.gpu));
  const cpus = fromMiddleOutward(measured(candidates.cpu));
  if (gpus.length === 0 || cpus.length === 0) return null;

  let checks = 0;
  // Hatasız ama uyarılı bir sistem bulunursa yedekte tutulur: uyarısız bir
  // sistem varsa o tercih edilir, yoksa uyarılı olan boş ekrandan iyidir.
  let uyarili: DefaultBuild | null = null;

  for (const gpu of gpus) {
    for (const cpu of cpus) {
      const boards = candidates.motherboard.filter((mb) => mb.spec.socket === cpu.spec.socket);
      const gerekenWatt = requiredWattage(cpu.spec.tdp_watt, gpu.spec.tdp_watt);

      for (const mb of boards) {
        const rams = candidates.ram.filter(
          (ram) =>
            ram.spec.memory_type === mb.spec.memory_type &&
            ram.spec.module_count <= mb.spec.memory_slots &&
            ram.spec.capacity_gb <= mb.spec.max_memory_gb,
        );
        const psus = candidates.psu
          .filter((psu) => psu.spec.wattage >= gerekenWatt)
          .sort((a, b) => a.spec.wattage - b.spec.wattage);
        const cases = candidates.case.filter((kasa) =>
          kasa.spec.supported_form_factors.includes(mb.spec.form_factor),
        );

        for (const ram of rams) {
          for (const psu of psus) {
            for (const kasa of cases) {
              if (checks >= MAX_CHECKS) return uyarili;
              checks += 1;

              const input: BuildInput = {
                cpu: cpu.spec,
                gpu: gpu.spec,
                motherboard: mb.spec,
                ram: ram.spec,
                psu: psu.spec,
                case: kasa.spec,
              };
              const findings = checkCompatibility(input);
              if (findings.some((finding) => finding.level === "error")) continue;

              const secim: DefaultBuild = {
                cpu: cpu.id,
                gpu: gpu.id,
                motherboard: mb.id,
                ram: ram.id,
                psu: psu.id,
                case: kasa.id,
              };
              if (findings.length === 0) return secim;
              uyarili ??= secim;
            }
          }
        }
      }
    }
  }

  return uyarili;
}
