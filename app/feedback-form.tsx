"use client";

import { useState } from "react";

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
      <label className="font-medium" htmlFor="feedback-message">
        Geri bildirim
      </label>
      <div className="flex gap-2">
        <input
          id="feedback-message"
          className="min-w-0 flex-1 rounded border px-2 py-1"
          value={message}
          maxLength={MAX_FEEDBACK_LENGTH}
          placeholder="Ne eksik, ne yanlış?"
          onChange={(event) => {
            setMessage(event.target.value);
            if (state === "sent") setState("idle");
          }}
        />
        <button
          type="submit"
          className="rounded border px-3 py-1 disabled:opacity-40"
          disabled={state === "sending" || message.trim().length === 0}
        >
          {state === "sending" ? "Gönderiliyor…" : "Gönder"}
        </button>
      </div>

      <p className="text-xs opacity-60">
        E-posta veya kişisel bilgi yazmayın — sadece mesajınız kaydedilir.
      </p>

      {state === "sent" && <p className="text-xs">Teşekkürler, kaydedildi.</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </form>
  );
}
