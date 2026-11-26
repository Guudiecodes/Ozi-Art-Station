import type { MetadataRoute } from "next";
import { getSettings } from "@/lib/db";
export const dynamic = "force-dynamic";
export default function robots(): MetadataRoute.Robots {
  const u = getSettings().siteUrl;
  return { rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/order", "/login", "/embed"] }, ...(u ? { sitemap: `${u}/sitemap.xml` } : {}) };
}
