"use server";

// Tarayıcıdan çağrılan sunucu işlemleri.
//
// Bu dosyanın işi sadece köprü kurmak: gelen veriyi doğrular ve /data
// katmanına devreder. Hesap burada yapılmaz — fiyat ve indeks, /data içinde
// veritabanından okunarak hesaplanıyor. Sebebi: tarayıcıdan gelen sayıya
// güvenilmez, güvenilseydi herkes istediği toplamı kaydedebilirdi.

import { getTranslations } from "next-intl/server";

import { saveBuild } from "@/data/builds";
import { saveFeedback } from "@/data/feedback";
import type { Resolution } from "@/engine/types";

export type SaveBuildAction =
  | { ok: true; id: string }
  | { ok: false; message: string };

/**
 * Kullanıcıya gösterilecek hata cümleleri ÇEVİRİ DOSYASINDA (K150).
 *
 * Burada yalnızca sebep kodu ile mesaj anahtarı eşleşiyor. Sunucu işlemi
 * isteğin dilini biliyor, o yüzden cümleyi burada kurup istemciye hazır
 * gönderiyoruz — istemciye kod gönderip orada çevirmek de olurdu ama o zaman
 * her çağıran taraf aynı eşlemeyi tekrarlardı.
 */
const SAVE_BUILD_KEY: Record<string, string> = {
  empty: "saveEmpty",
  unknown_part: "saveUnknownPart",
  id_collision: "saveIdCollision",
};

export async function saveBuildAction(
  partIds: string[],
  resolution: Resolution,
  title?: string,
): Promise<SaveBuildAction> {
  const result = await saveBuild(partIds, resolution, title);
  if (result.ok) return { ok: true, id: result.id };

  const t = await getTranslations("common.errors");
  const key = SAVE_BUILD_KEY[result.reason];
  return { ok: false, message: key ? t(key) : t("saveFailed") };
}

export type SendFeedbackAction = { ok: true } | { ok: false; message: string };

export async function sendFeedbackAction(
  message: string,
  buildId?: string | null,
  pageUrl?: string | null,
): Promise<SendFeedbackAction> {
  const result = await saveFeedback({ message, buildId, pageUrl });
  if (result.ok) return { ok: true };

  const t = await getTranslations("common.errors");
  return {
    ok: false,
    message: result.reason === "empty" ? t("feedbackEmpty") : t("feedbackTooLong"),
  };
}
