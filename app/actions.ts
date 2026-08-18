"use server";

// Tarayıcıdan çağrılan sunucu işlemleri.
//
// Bu dosyanın işi sadece köprü kurmak: gelen veriyi doğrular ve /data
// katmanına devreder. Hesap burada yapılmaz — fiyat ve indeks, /data içinde
// veritabanından okunarak hesaplanıyor. Sebebi: tarayıcıdan gelen sayıya
// güvenilmez, güvenilseydi herkes istediği toplamı kaydedebilirdi.

import { saveBuild } from "@/data/builds";
import { saveFeedback } from "@/data/feedback";
import type { Resolution } from "@/engine/types";

export type SaveBuildAction =
  | { ok: true; id: string }
  | { ok: false; message: string };

/** Kullanıcıya gösterilecek hata cümleleri — kod adları ekrana çıkmasın. */
const SAVE_BUILD_MESSAGE: Record<string, string> = {
  empty: "Kaydetmeden önce en az bir parça seçin.",
  unknown_part: "Seçilen parçalardan biri artık kataloğda yok. Sayfayı yenileyip tekrar deneyin.",
  missing_price: "Fiyatı olmayan parça var. Toplam fiyat dondurulacağı için sistem kaydedilmiyor.",
  id_collision: "Sistem kimliği üretilemedi. Lütfen tekrar deneyin.",
};

export async function saveBuildAction(
  partIds: string[],
  resolution: Resolution,
  title?: string,
): Promise<SaveBuildAction> {
  const result = await saveBuild(partIds, resolution, title);
  if (result.ok) return { ok: true, id: result.id };

  return {
    ok: false,
    message: SAVE_BUILD_MESSAGE[result.reason] ?? "Sistem kaydedilemedi.",
  };
}

export type SendFeedbackAction = { ok: true } | { ok: false; message: string };

export async function sendFeedbackAction(
  message: string,
  buildId?: string | null,
  pageUrl?: string | null,
): Promise<SendFeedbackAction> {
  const result = await saveFeedback({ message, buildId, pageUrl });
  if (result.ok) return { ok: true };

  return {
    ok: false,
    message:
      result.reason === "empty"
        ? "Önce bir şeyler yazın."
        : "Mesaj çok uzun. Lütfen kısaltın.",
  };
}
