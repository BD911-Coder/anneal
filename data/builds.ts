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

// Göreli yol + `.ts`: bu iki içe aktarma çalışma anında çözülüyor ve `@/`
// takma adını yalnızca Next'in derleyicisi çözebiliyor. Takma adla yazıldığında
// /data katmanı hiçbir script'ten çağrılamıyor — npm run varyant:kontrol'ün
// saveBuild'i gerçekten çalıştırabilmesinin sebebi bu satırlar (CLAUDE.md,
// araç notları). `import type` erimediği için orada takma ad sorun değil.
import { resolvePerfIndex } from "../engine/gpu-selection.ts";
import { MODEL_VERSION, freezeSystemIndex } from "../engine/performance.ts";
import type { Resolution } from "@/engine/types";

import { prisma } from "./client.ts";
import { getPerfIndexes } from "./perf.ts";
import { getCurrentPrices } from "./prices.ts";
import { toEngineResolution, toPrismaResolution } from "./to-engine.ts";
import { IS_LIVE, visibleParts } from "./visibility.ts";

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
  | "id_collision"; // beş denemede de boş kimlik bulunamadı

export type SaveBuildResult =
  | { ok: true; id: string }
  | { ok: false; reason: SaveBuildFailure; parts?: string[] };

/**
 * Seçilen parçaları kalıcı, paylaşılabilir bir sistem olarak kaydeder.
 * Hesap gerektirmez — `builds` tablosunda kullanıcı alanı yoktur.
 */
export async function saveBuild(
  partIds: string[],
  resolution: Resolution,
  title?: string,
): Promise<SaveBuildResult> {
  // Aynı parça iki kez gönderilmiş olabilir; bileşik anahtar zaten buna izin
  // vermez, o yüzden yazmadan önce tekilleştiriliyor.
  const ids = [...new Set(partIds.filter(Boolean))];
  if (ids.length === 0) return { ok: false, reason: "empty" };

  const parts = await prisma.part.findMany({
    where: { id: { in: ids }, ...visibleParts() },
    // gpu_variant_specs de okunuyor: kaydedilen ekran kartı bir AIB kartı
    // olabilir ve o kartın indeksi çipinden gelir (K86). Bağ olmadan hangi
    // çipin indeksinin donacağı bilinemez.
    select: {
      id: true,
      category: true,
      gpu_variant_specs: { select: { chip_part_id: true } },
    },
  });
  if (parts.length !== ids.length) {
    const found = new Set(parts.map((part) => part.id));
    return { ok: false, reason: "unknown_part", parts: ids.filter((id) => !found.has(id)) };
  }

  const [prices, perfIndexes] = await Promise.all([
    getCurrentPrices(),
    getPerfIndexes(MODEL_VERSION),
  ]);

  // K124: fiyat kaydı ENGELLEMEZ. Fiyat beta ölçütünden çıktı (site performans
  // tahmini yapıyor), dolayısıyla fiyatın olmaması paylaşım akışını
  // kilitlememeli. Eskiden burada `missing_price` ile reddediliyordu.
  //
  // Ama fiyatı olmayan parça 0 SAYILMAZ: kısmi toplam olduğundan ucuz görünür
  // ve donduğu için sonradan düzeltilemez. Eksik varsa toplam `null` olur —
  // K92'nin karışık para birimi için verdiği kararla aynı mantık.
  const unpriced = ids.filter((id) => !prices[id]);

  // Ekran kartı iki satır olabilir: çip (gpu_specs) ya da kart (gpu_variant_specs).
  // Kart kaydedilmişse indeks çipinden okunur — arayüzün yaptığının aynısı,
  // aynı fonksiyonla (K86). İkisi birden gönderilirse kart kazanır: kullanıcının
  // gördüğü ve fiyatı donan satır odur.
  const gpuParts = parts.filter((part) => part.category === "gpu");
  const gpuVariant = gpuParts.find((part) => part.gpu_variant_specs);
  const gpuChipId =
    gpuVariant?.gpu_variant_specs?.chip_part_id ??
    gpuParts.find((part) => !part.gpu_variant_specs)?.id;
  const cpuId = parts.find((part) => part.category === "cpu")?.id;
  // İndeks kullanıcının kaydettiği çözünürlükte donar (K43). Hesaplanamıyorsa
  // null yazılır ve kayıt yine de yapılır: ekran kartsız (iGPU) bir sistem
  // geçerlidir, kaydedilememesi hatadır (K44).
  const indexSnapshot = freezeSystemIndex({
    resolution,
    gpu_index: resolvePerfIndex(perfIndexes, gpuChipId, gpuVariant?.id).value,
    cpu_index: cpuId ? perfIndexes[cpuId] : undefined,
  });

  const items = ids.map((id) => ({
    part_id: id,
    quantity: 1, // beta'da adet seçimi yok; her parça bir kez
    unit_price_minor_at_save: prices[id]?.price_minor ?? null,
  }));
  // Tek bir parçanın fiyatı bile eksikse toplam üretilmez (K124).
  const totalMinor =
    unpriced.length > 0
      ? null
      : items.reduce((sum, item) => sum + (item.unit_price_minor_at_save ?? 0), 0);
  // Beta'da tek para birimi var; fiyatı olan ilk parçanınki hepsini temsil
  // ediyor. Hiç fiyat yoksa null.
  const currency = ids.map((id) => prices[id]?.currency).find((c) => c !== undefined) ?? null;

  for (let attempt = 0; attempt < ID_ATTEMPTS; attempt++) {
    const id = newBuildId();
    try {
      await prisma.build.create({
        data: {
          id,
          title: title?.trim() || null,
          total_price_minor: totalMinor,
          currency,
          resolution: toPrismaResolution(resolution),
          perf_index_snapshot: indexSnapshot,
          // İndeks üretilemese de yazılır: hangi motor sürümünün üretemediği
          // de bilgidir (SCHEMA.md bölüm 5).
          model_version: MODEL_VERSION,
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
  /** Kayıt anında fiyatı yoksa `null` (K124). */
  unit_price_minor_at_save: number | null;
};

export type SavedBuild = {
  id: string;
  title: string | null;
  created_at: string; // ISO
  /** Fiyatsız parça varsa `null` — kısmi toplam yazılmaz (K124). */
  total_price_minor: number | null;
  currency: string | null;
  resolution: Resolution;
  /** Hesaplanamadıysa null — "indeks sıfır" demek değil (K44). */
  perf_index_snapshot: number | null;
  model_version: string;
  items: SavedBuildItem[];
  /**
   * Sistemdeki ekran kartının **çip** id'si — kart (AIB) kaydedilmişse onun
   * çipi, çip kaydedilmişse kendisi. Ekran kartı yoksa `undefined`.
   *
   * Ayrıca duruyor çünkü `items` yalnızca kaydedilen satırı taşıyor ve o satır
   * bir kart olabilir; ölçüm ve indeks ise çip seviyesinde (K86). Bağ olmadan
   * sayfa hangi çipin ölçümünü okuyacağını bilemez.
   */
  gpu_chip_part_id?: string;
  /** Kart kaydedildiyse kartın id'si. Çip kaydedildiyse `undefined`. */
  gpu_variant_part_id?: string;
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
        include: {
          part: {
            select: {
              brand: true,
              model: true,
              category: true,
              source: true,
              // Kaydedilen ekran kartı bir AIB kartı olabilir; ölçüm ve indeks
              // çipten okunur (K86). saveBuild da aynı bağı kuruyor.
              gpu_variant_specs: { select: { chip_part_id: true } },
            },
          },
        },
        orderBy: { part_id: "asc" },
      },
    },
  });
  if (!build) return null;

  if (IS_LIVE && build.build_items.some((item) => item.part.source === "dev_seed")) {
    return null;
  }

  // saveBuild'deki çözümlemenin aynısı: kart kaydedilmişse çipi onun üstünden
  // bulunur, yoksa doğrudan çip satırı kullanılır.
  const gpuItems = build.build_items.filter((item) => item.part.category === "gpu");
  const gpuVariant = gpuItems.find((item) => item.part.gpu_variant_specs);
  const gpuChipId =
    gpuVariant?.part.gpu_variant_specs?.chip_part_id ??
    gpuItems.find((item) => !item.part.gpu_variant_specs)?.part_id;

  return {
    id: build.id,
    title: build.title,
    created_at: build.created_at.toISOString(),
    total_price_minor: build.total_price_minor,
    currency: build.currency,
    resolution: toEngineResolution(build.resolution),
    perf_index_snapshot: build.perf_index_snapshot,
    model_version: build.model_version,
    items: build.build_items.map((item) => ({
      part_id: item.part_id,
      label: `${item.part.brand} ${item.part.model}`,
      category: item.part.category,
      quantity: item.quantity,
      unit_price_minor_at_save: item.unit_price_minor_at_save,
    })),
    gpu_chip_part_id: gpuChipId,
    gpu_variant_part_id: gpuVariant?.part_id,
  };
}
