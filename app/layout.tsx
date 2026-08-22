import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import "./globals.css";

import { Backdrop } from "./backdrop";
import { LanguagePicker } from "./language-picker";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * Meta etiketleri de çeviriden okunuyor: başlık ve açıklama kullanıcıya
 * görünen metinler ve bileşen içinde sabit kalamazlar.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("common.meta");

  return {
    title: t("title"),
    description: t("description"),

    // Beta bitene kadar arama motorlarına kapalı (K30).
    // robots.txt tarama isteğini engeller, bu meta etiketi ise başka bir yerden
    // link alınıp yine de taranırsa indekslenmeyi engeller. İkisi ayrı iş yapar.
    robots: {
      index: false,
      follow: false,
      nocache: true,
      googleBot: { index: false, follow: false },
    },
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Dil istekten çözümleniyor (`i18n/request.ts`), adresten değil:
  // SCHEMA.md bölüm 9 adres yapısını sabitliyor.
  const locale = await getLocale();

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Backdrop />
        {/*
          Mesajlar sağlayıcıya veriliyor: istemci bileşenleri (`builder`,
          `game-fps`) sunucuyla AYNI dili ve aynı metinleri görsün. Farklı
          görselerdi hydration uyuşmazlığı olurdu.
        */}
        <NextIntlClientProvider>
          {children}
          <LanguagePicker current={locale} />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
