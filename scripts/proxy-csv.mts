// Vekil skor CSV'sinin okuma ve doğrulama yolu — TEK TANIM.
//
// Ayrı dosya olmasının sebebi: `import-proxy-scores.mts` doğrudan çalışan bir
// script. Çözümleme ondan `import` etseydi, çözümleme her koşumda içe
// aktarmanın raporunu da çalıştırırdı. (Aynı tuzağa `wiki-common.mts` ile bir
// kez daha düşüldü.)

import { readFileSync } from "node:fs";

/** Elle doldurulan sablon. Tek adres, iki script buradan okuyor. */
export const PROXY_CSV = "data/proxy/openbenchmarking.csv";

export type VekilSatir = {
  part_id: string;
  test_profile: string;
  score: number;
  unit: string;
  resolution: string;
  preset: string;
  driver: string;
  cpu: string;
  os: string;
  result_id: string;
  result_url: string;
  collected_at: string;
};

/** Doldurulmuş satırları okur; boş satırlar sessizce atlanmaz, sayılır. */
export function vekilSatirlariOku(yol = PROXY_CSV): { satirlar: VekilSatir[]; bos: string[]; hatalar: string[] } {
  const metin = readFileSync(yol, "utf8").trim().split("\n");
  const basliklar = metin[0].split(",").map((h) => h.trim());
  const satirlar: VekilSatir[] = [];
  const bos: string[] = [];
  const hatalar: string[] = [];

  for (const ham of metin.slice(1)) {
    if (!ham.trim()) continue;
    const hucre: Record<string, string> = {};
    const parcalar = ham.split(",");
    basliklar.forEach((ad, i) => (hucre[ad] = (parcalar[i] ?? "").trim()));

    if (!hucre.part_id) continue;
    if (!hucre.score) {
      bos.push(hucre.part_id);
      continue;
    }

    // Doldurulmuş bir satır EKSİK olamaz: skor varsa kaynağı da olmak zorunda.
    // Kaynaksız bir sayı, K3'ün yasakladığı şey.
    const eksik = ["test_profile", "unit", "result_id", "result_url", "driver", "cpu", "os"].filter(
      (alan) => !hucre[alan],
    );
    if (eksik.length > 0) {
      hatalar.push(`${hucre.part_id}: skor var ama eksik alan — ${eksik.join(", ")}`);
      continue;
    }
    const skor = Number(hucre.score);
    if (!Number.isFinite(skor) || skor <= 0) {
      hatalar.push(`${hucre.part_id}: skor okunamadi ("${hucre.score}")`);
      continue;
    }
    satirlar.push({
      part_id: hucre.part_id,
      test_profile: hucre.test_profile,
      score: skor,
      unit: hucre.unit,
      resolution: hucre.resolution,
      preset: hucre.preset,
      driver: hucre.driver,
      cpu: hucre.cpu,
      os: hucre.os,
      result_id: hucre.result_id,
      result_url: hucre.result_url,
      collected_at: hucre.collected_at,
    });
  }
  return { satirlar, bos, hatalar };
}
