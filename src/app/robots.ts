import type { MetadataRoute } from "next";
import { getSettings, ready } from "@/lib/db";
export const dynamic = "force-dynamic";
export default async function robots(): Promise<MetadataRoute.Robots> { await ready();
  const u = getSettings().siteUrl;
  return { rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/order", "/login", "/embed"] }, ...(u ? { sitemap: `${u}/sitemap.xml` } : {}) };
}
