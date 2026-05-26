import type { MetadataRoute } from "next";

const SITE_URL = "https://novelagent.kr";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin/",
          "/api/",
          "/auth/",
          "/studio/",
          "/works/",
          "/account/",
          "/onboarding",
          "/verify-phone",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
