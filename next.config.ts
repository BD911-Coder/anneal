import createNextIntlPlugin from "next-intl/plugin";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
};

// Dil yapılandırması `i18n/request.ts` içinde. Eklenti, sunucu bileşenlerinin
// istek başına doğru mesaj kümesini görmesini sağlıyor.
const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

export default withNextIntl(nextConfig);
