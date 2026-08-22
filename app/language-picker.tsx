"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";

import { LOCALES, LOCALE_LABEL } from "@/i18n/locales";
import type { Locale } from "@/i18n/locales";

import { setLocaleAction } from "./locale-action";

/**
 * Dil seçici.
 *
 * Adreste dil öneki olmadığı için (SCHEMA.md bölüm 9 adresleri sabitliyor)
 * seçim bir çereze yazılıyor ve sayfa yeniden çiziliyor. Kullanıcının
 * seçtiği dil `Accept-Language` başlığını geçer — tarayıcısı Türkçe olan
 * biri siteyi İngilizce okumayı seçebilmeli.
 *
 * Sayfanın sonunda, sessiz: dil değiştirmek sık yapılan bir iş değil ve
 * içeriğin önüne geçmemeli.
 */
export function LanguagePicker({ current }: { current: string }) {
  const t = useTranslations("common.language");
  const [pending, startTransition] = useTransition();

  return (
    <nav
      aria-label={t("label")}
      className="mx-auto w-full max-w-6xl px-4 pb-8 sm:px-6"
    >
      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4 text-xs">
        <span className="text-muted">{t("label")}</span>
        {LOCALES.map((locale) => {
          const active = locale === current;
          return (
            <button
              key={locale}
              type="button"
              lang={locale}
              aria-current={active ? "true" : undefined}
              disabled={active || pending}
              onClick={() => startTransition(() => setLocaleAction(locale as Locale))}
              className={`rounded-md border px-2.5 py-1 ${
                active ? "border-accent font-medium text-accent" : "border-border text-muted"
              }`}
            >
              {LOCALE_LABEL[locale]}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
