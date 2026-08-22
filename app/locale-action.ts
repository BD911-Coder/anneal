"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { LOCALES } from "@/i18n/locales";
import type { Locale } from "@/i18n/locales";

/** Bir yıl: dil tercihi her oturumda yeniden sorulmamalı. */
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/**
 * Dil tercihini çereze yazar.
 *
 * Çerez seçildi çünkü adreste dil öneki yok (SCHEMA.md bölüm 9). Değer
 * sunucuda doğrulanıyor: istemciden gelen dizeye güvenilmez, desteklenmeyen
 * bir değer yazılırsa `i18n/request.ts` onu yok sayardı ama çerezde çöp
 * kalırdı.
 */
export async function setLocaleAction(locale: Locale): Promise<void> {
  if (!(LOCALES as readonly string[]).includes(locale)) return;

  (await cookies()).set("NEXT_LOCALE", locale, {
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
    sameSite: "lax",
  });

  // Sayfalar `force-dynamic` ama render sonucu istek içinde önbelleklenmiş
  // olabilir; yeni dil hemen görünsün.
  revalidatePath("/", "layout");
}
