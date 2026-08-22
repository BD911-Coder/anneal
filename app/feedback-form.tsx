"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { MAX_FEEDBACK_LENGTH } from "@/lib/limits";

import { sendFeedbackAction } from "./actions";

/**
 * Tek satırlık geri bildirim kutusu.
 *
 * E-posta veya ad sorulmuyor: `feedback` tablosunda o alanlar yok ve
 * toplanmayan veri sızdırılamaz. Kullanıcıya da bunu söylüyoruz, yoksa
 * iletişim bilgisini kendisi yazar.
 */
export function FeedbackForm({ buildId }: { buildId?: string }) {
  const t = useTranslations("common.feedback");
  const [message, setMessage] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (state === "sending") return;

    setState("sending");
    setError(null);

    const result = await sendFeedbackAction(
      message,
      buildId ?? null,
      typeof window === "undefined" ? null : window.location.pathname,
    );

    if (result.ok) {
      setMessage("");
      setState("sent");
    } else {
      setError(result.message);
      setState("idle");
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 text-sm">
      <label className="text-xs font-semibold uppercase tracking-wider text-muted" htmlFor="feedback-message">
        {t("label")}
      </label>
      <div className="flex gap-2">
        <input
          id="feedback-message"
          className="min-w-0 flex-1 rounded-md border border-border bg-background px-2.5 py-1.5"
          value={message}
          maxLength={MAX_FEEDBACK_LENGTH}
          placeholder={t("placeholder")}
          onChange={(event) => {
            setMessage(event.target.value);
            if (state === "sent") setState("idle");
          }}
        />
        <button
          type="submit"
          className="rounded-md border border-border px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={state === "sending" || message.trim().length === 0}
        >
          {state === "sending" ? t("sending") : t("send")}
        </button>
      </div>

      <p className="text-xs text-muted">
        {t("privacy")}
      </p>

      {state === "sent" && <p className="text-xs">{t("sent")}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </form>
  );
}
