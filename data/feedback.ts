// Geri bildirim yazar.
//
// E-posta, ad veya başka kişisel veri toplanmaz — `feedback` tablosunda böyle
// bir alan yoktur (SCHEMA.md bölüm 6). Toplanmayan veri sızdırılamaz.

import { MAX_FEEDBACK_LENGTH } from "@/lib/limits";

import { prisma } from "./client.ts";

export type SaveFeedbackResult = { ok: true } | { ok: false; reason: "empty" | "too_long" };

export async function saveFeedback(input: {
  message: string;
  buildId?: string | null;
  pageUrl?: string | null;
}): Promise<SaveFeedbackResult> {
  const message = input.message.trim();
  if (message.length === 0) return { ok: false, reason: "empty" };
  if (message.length > MAX_FEEDBACK_LENGTH) return { ok: false, reason: "too_long" };

  // Sistem gerçekten var mı? Yoksa geri bildirimi kaybetmek yerine ilişkisiz
  // kaydediyoruz: yazının kendisi, hangi sayfadan geldiğinden daha değerli.
  let buildId: string | null = input.buildId ?? null;
  if (buildId) {
    const exists = await prisma.build.findUnique({ where: { id: buildId }, select: { id: true } });
    if (!exists) buildId = null;
  }

  await prisma.feedback.create({
    data: {
      message,
      build_id: buildId,
      page_url: input.pageUrl ?? null,
    },
  });

  return { ok: true };
}
