import type { MetadataRoute } from "next";

const siteUrl = "https://nexora-pos.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/sales", "/products", "/customers", "/settings", "/api"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
