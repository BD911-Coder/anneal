// Alan bazında kaynak defterinin okuma yolu (K170).
//
// Spec tablolarındaki `source` sütunu SATIR başına. Bu dosya alan başına
// olanı okuyor: hangi sayının nereden geldiğini, ve lisans yükümlülüğü varsa
// atfın ne olduğunu.
//
// **Atıf kuralı:** Wikipedia içeriği CC BY-SA. Kredi, değeri GÖSTEREN yerde
// görünmek zorunda — satırın tamamında değil, o alanda. Bu yüzden okuma yolu
// da alan başına.

import { prisma } from "./client.ts";
import { visibleParts } from "./visibility.ts";

/** Bir alanın kaynağı. `article`/`revisionId` yalnızca lisanslı kaynakta dolu. */
export type FieldSource = {
  source: string;
  sourceUrl: string | null;
  confidence: string;
  license: string | null;
  article: string | null;
  revisionId: number | null;
};

/** Arayüzde gösterilen bir spec değeri ve kaynağı. */
export type SourcedValue = {
  value: number;
  source: FieldSource;
};

/**
 * Arayüzde gösterilen çip alanları.
 *
 * Bugün tek alan var: bant genişliği. Liste burada duruyor ki "hangi alanlar
 * gösteriliyor" sorusunun tek bir cevabı olsun — atıf kuralı da bu listeye
 * bağlı: gösterilmeyen bir alanın kredisi de gösterilmez.
 */
export const DISPLAYED_GPU_FIELDS = ["memory_bandwidth_gbs"] as const;
export type DisplayedGpuField = (typeof DISPLAYED_GPU_FIELDS)[number];

export type GpuChipFacts = Partial<Record<DisplayedGpuField, SourcedValue>>;

/**
 * Çip başına gösterilen spec değerleri + kaynakları.
 *
 * Kaynak satırı yoksa spec satırının kendi damgası kullanılıyor: defter bir
 * İSTİSNA defteridir, geçişte bütün dolu alanlar yazıldı ama sonradan elle
 * eklenen bir satır damgasız kalabilir. O durumda satırın damgası doğru
 * cevaptır — yanlış olan onu Wikipedia sanmaktır.
 */
export async function getGpuChipFacts(): Promise<Map<string, GpuChipFacts>> {
  const [specs, sources] = await Promise.all([
    prisma.gpuSpecs.findMany({
      where: { part: visibleParts() },
      select: {
        part_id: true,
        memory_bandwidth_gbs: true,
        source: true,
        source_url: true,
        confidence: true,
      },
    }),
    prisma.specFieldSource.findMany({
      where: {
        part: visibleParts(),
        field_name: { in: [...DISPLAYED_GPU_FIELDS] },
      },
    }),
  ]);

  const defter = new Map(sources.map((s) => [`${s.part_id}|${s.field_name}`, s]));
  const out = new Map<string, GpuChipFacts>();

  for (const spec of specs) {
    const facts: GpuChipFacts = {};
    if (spec.memory_bandwidth_gbs !== null) {
      const kayit = defter.get(`${spec.part_id}|memory_bandwidth_gbs`);
      facts.memory_bandwidth_gbs = {
        value: spec.memory_bandwidth_gbs,
        source: kayit
          ? {
              source: kayit.source,
              sourceUrl: kayit.source_url,
              confidence: kayit.confidence,
              license: kayit.license,
              article: kayit.source_article,
              revisionId: kayit.source_revision_id,
            }
          : {
              source: spec.source,
              sourceUrl: spec.source_url,
              confidence: spec.confidence,
              license: null,
              article: null,
              revisionId: null,
            },
      };
    }
    out.set(spec.part_id, facts);
  }
  return out;
}
