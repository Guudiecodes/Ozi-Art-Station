import type { MetadataRoute } from "next";
import { getSettings, listAssets } from "@/lib/db";
export const dynamic = "force-dynamic";
export default function sitemap(): MetadataRoute.Sitemap {
  const u = getSettings().siteUrl || "http://localhost:3000";
  return [{ url: u }, { url: `${u}/explore` }, ...["terms", "privacy", "refunds"].map((p) => ({ url: `${u}/legal/${p}` })), ...listAssets().map((a) => ({ url: `${u}/a/${a.slug}`, lastModified: new Date(a.createdAt) }))];
}
