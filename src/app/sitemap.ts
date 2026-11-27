import type { MetadataRoute } from "next";
import { getSettings, listAssets, ready } from "@/lib/db";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> { await ready();
  const u = getSettings().siteUrl || "http://localhost:3000";
  return [{ url: u }, { url: `${u}/explore` }, ...["terms", "privacy", "refunds"].map((p) => ({ url: `${u}/legal/${p}` })), ...listAssets().map((a) => ({ url: `${u}/a/${a.slug}`, lastModified: new Date(a.createdAt) }))];
}
