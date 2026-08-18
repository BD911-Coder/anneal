// Kaydedilmiş sistemleri yazar ve okur.
//
// SCHEMA.md bölüm 5'in kuralı: toplam fiyat ve performans indeksi **kayıt
// anında dondurulur**. Altı ay sonra açılan bir link, o günün fiyatını ve o
// günün hesabını göstermelidir; canlı fiyatla hesaplansaydı eski linkler
// yanlış bilgi verirdi ve bu sonradan düzeltilemezdi.
//
// Dondurulan değerler istemciden GELMEZ. Sayfa ne gönderirse göndersin, fiyat
// ve indeks burada, veritabanından okunarak yeniden hesaplanır — yoksa
// tarayıcıdan istediği toplamı yazan biri sahte bir sistem kaydedebilirdi.

import { MODEL_VERSION, REFERENCE_RESOLUTION, computePerformance } from "@/engine/performance";

import { prisma } from "./client";
import { getPerfIndexes } from "./perf";
import { getCurrentPrices } from "./prices";
import { IS_LIVE, visibleParts } from "./visibility";

/** Paylaşılabilir kimlik: `k3n9x2` (SCHEMA.md bölüm 5). */
const ID_LENGTH = 6;

// Karışabilecek harfler yok: 0/o, 1/l/i, i/j. Link telefonda elle yazılabilsin.
const ID_ALPHABET = "abcdefghkmnpqrstuvwxyz23456789";

/** Aynı kimliğin ikinci kez üretilmesi ihtimaline karşı deneme sayısı. */
const ID_ATTEMPTS = 5;

function newBuildId(): string {
  // Rastgeleliği modulo ile daraltmıyoruz: 256, alfabe uzunluğuna tam
  // bölünmediği için artık kalan aralık atılıyor (reddetme yöntemi).
  const limit = Math.floor(256 / ID_ALPHABET.length) * ID_ALPHABET.length;
  let id = "";
  while (id.length < ID_LENGTH) {
    const bytes = crypto.getRandomValues(new Uint8Array(ID_LENGTH));
    for (const byte of bytes) {
      if (byte >= limit) continue;
      id += ID_ALPHABET[byte % ID_ALPHABET.length];
      if (id.length === ID_LENGTH) break;
    }
  }
  return id;
}

export type SaveBuildFailure =
  | "empty" // hiç parça seçilmemiş
  | "unknown_part" // gönderilen id kataloğda yok
  | "missing_price" // fiyatı olmayan parça var, toplam dürüst olmaz
  | "no_index" // ekran kartı/işlemci indeksi yok, dondurulacak sayı yok
  | "id_collision"; // beş denemede de boş kimlik bulunamadı

export type SaveBuildResult =
  | { ok: true; id: string }
  | { ok: false; reason: SaveBuildFailure; parts?: string[] };

/**
 * Seçilen parçaları kalıcı, paylaşılabilir bir sistem olarak kaydeder.
 * Hesap gerektirmez — `builds` tablosunda kullanıcı alanı yoktur.
 */
export async function saveBuild(partIds: string[], title?: string): Promise<SaveBuildResult> {
  // Aynı parça iki kez gönderilmiş olabilir; bileşik anahtar zaten buna izin
  // vermez, o yüzden yazmadan önce tekilleştiriliyor.
  const ids = [...new Set(partIds.filter(Boolean))];
  if (ids.length === 0) return { ok: false, reason: "empty" };

  const parts = await prisma.part.findMany({
    where: { id: { in: ids }, ...visibleParts() },
    select: { id: true, category: true },
  });
  if (parts.length !== ids.length) {
    const found = new Set(parts.map((part) => part.id));
    return { ok: false, reason: "unknown_part", parts: ids.filter((id) => !found.has(id)) };
  }

  const [prices, perfIndexes] = await Promise.all([
    getCurrentPrices(),
    getPerfIndexes(MODEL_VERSION),
  ]);

  // Fiyatı olmayan parça 0 sayılmaz: toplam olduğundan ucuz görünür ve bu
  // dondurulduğu için sonradan düzeltilemez. Kayıt reddedilir.
  const unpriced = ids.filter((id) => !prices[id]);
  if (unpriced.length > 0) return { ok: false, reason: "missing_price", parts: unpriced };

  const gpuId = parts.find((part) => part.category === "gpu")?.id;
  const cpuId = parts.find((part) => part.category === "cpu")?.id;
  const performance = computePerformance({
    resolution: REFERENCE_RESOLUTION,
    gpu_index: gpuId ? perfIndexes[gpuId] : undefined,
    cpu_index: cpuId ? perfIndexes[cpuId] : undefined,
  });
  // `builds.perf_index_snapshot` zorunlu bir alan: şema, kaydedilmiş her
  // sistemin dondurulmuş bir indeksi olduğunu söylüyor. Hesaplanamıyorsa
  // uydurma bir sayı yazmak yerine kayıt reddedilir.
  if (!performance.ok) return { ok: false, reason: "no_index", parts: performance.missing };

  const items = ids.map((id) => ({
    part_id: id,
    quantity: 1, // beta'da adet seçimi yok; her parça bir kez
    unit_price_minor_at_save: prices[id].price_minor,
  }));
  const totalMinor = items.reduce((sum, item) => sum + item.unit_price_minor_at_save, 0);
  // Beta'da tek para birimi var; ilk parçanınki hepsini temsil ediyor.
  const currency = prices[ids[0]].currency;

  for (let attempt = 0; attempt < ID_ATTEMPTS; attempt++) {
    const id = newBuildId();
    try {
      await prisma.build.create({
        data: {
          id,
          title: title?.trim() || null,
          total_price_minor: totalMinor,
          currency,
          perf_index_snapshot: performance.system_index,
          model_version: performance.model_version,
          build_items: { create: items },
        },
      });
      return { ok: true, id };
    } catch (error) {
      // P2002: benzersizlik ihlali — kimlik tutmuş, yenisini dene.
      const code = (error as { code?: string }).code;
      if (code !== "P2002") throw error;
    }
  }

  return { ok: false, reason: "id_collision" };
}

export type SavedBuildItem = {
  part_id: string;
  label: string;
  category: string;
  quantity: number;
  unit_price_minor_at_save: number;
};

export type SavedBuild = {
  id: string;
  title: string | null;
  created_at: string; // ISO
  total_price_minor: number;
  currency: string;
  perf_index_snapshot: number;
  model_version: string;
  items: SavedBuildItem[];
};

/**
 * Kaydedilmiş sistemi dondurulmuş hâliyle okur. Bulunamazsa `null`.
 *
 * Burada `visibleParts()` kullanılmıyor: piyasadan kalkmış (`is_active = false`)
 * bir parça kayıtlı sistemde görünmeye devam etmeli — kayıt geçmişin fotoğrafı.
 * Ama dev-seed kuralı geçerli: canlıda sahte parça içeren bir sistem hiç
 * açılmaz, yarısı gösterilmez.
 */
export async function getBuild(id: string): Promise<SavedBuild | null> {
  const build = await prisma.build.findUnique({
    where: { id },
    include: {
      build_items: {
        include: { part: { select: { brand: true, model: true, category: true, source: true } } },
        orderBy: { part_id: "asc" },
      },
    },
  });
  if (!build) return null;

  if (IS_LIVE && build.build_items.some((item) => item.part.source === "dev_seed")) {
    return null;
  }

  return {
    id: build.id,
    title: build.title,
    created_at: build.created_at.toISOString(),
    total_price_minor: build.total_price_minor,
    currency: build.currency,
    perf_index_snapshot: build.perf_index_snapshot,
    model_version: build.model_version,
    items: build.build_items.map((item) => ({
      part_id: item.part_id,
      label: `${item.part.brand} ${item.part.model}`,
      category: item.part.category,
      quantity: item.quantity,
      unit_price_minor_at_save: item.unit_price_minor_at_save,
    })),
  };
}
