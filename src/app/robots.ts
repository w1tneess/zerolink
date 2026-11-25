import type { MetadataRoute } from "next";
import { getEnv } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getEnv().APP_BASE_URL.replace(/\/+$/, "");
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/report"],
      disallow: ["/admin", "/api/"],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
