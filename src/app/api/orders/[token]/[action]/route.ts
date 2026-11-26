import path from "path";
import { NextResponse } from "next/server";
import { bump, getAsset, getSettings, log, orderByToken, setOrder } from "@/lib/db";
import { baseUrl, settle } from "@/lib/pay";
import { fileResponse, locate } from "@/lib/storage";

type P = { params: Promise<{ token: string; action: string }> };
const err = (m: string, s: number) => NextResponse.json({ error: m }, { status: s });

// Customer download, allowed only for a paid order and only up to the download limit set in the admin panel.
export async function GET(req: Request, { params }: P) {
  const { token, action } = await params, o = orderByToken(token);
  if (action !== "download" || !o) return err("Not found", 404);
  if (o.status !== "paid") return err("This order is not paid.", 402);
  const max = getSettings().maxDownloads; if (o.downloads >= max) return err(`Download limit reached (${max}). Contact the seller to reset it.`, 429);
  const a = getAsset(o.assetId); if (!a) return err("This asset is no longer available. Contact the seller.", 410);
  setOrder(o.id, { downloads: o.downloads + 1 }); bump(a.id, "downloads"); log("download", `${o.email} downloaded ${a.title}`);
  const abs = locate(a.file); if (!abs) return NextResponse.redirect(new URL(a.file, req.url));
  return fileResponse(abs, `${a.slug}${path.extname(abs)}`);
}
// "Check payment again" button on the order page.
export async function POST(req: Request, { params }: P) {
  const { token, action } = await params, o = orderByToken(token);
  if (action !== "verify" || !o) return err("Not found", 404);
  return NextResponse.json({ status: await settle(o, baseUrl(req)) });
}
