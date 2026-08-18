import type { MetadataRoute } from "next";

// Beta bitene kadar site arama motorlarına kapalı (K30).
// Yarım bir site indekslenirse, düzeldikten sonra bile eski hâliyle
// aranır hale gelir; indeksten çıkarmak girmekten çok daha yavaştır.
//
// Bu dosya /robots.txt adresini üretir. Tek başına yeterli değil —
// app/layout.tsx içindeki noindex meta etiketi ikinci katman.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: "/",
    },
  };
}
