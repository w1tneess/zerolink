import type { MetadataRoute } from "next";
import { getEnv } from "@/lib/env";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getEnv().APP_BASE_URL.replace(/\/+$/, "");
  return [
    { url: `${baseUrl}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${baseUrl}/report`, changeFrequency: "monthly", priority: 0.5 },
  ];
}
