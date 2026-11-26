import { NextResponse } from "next/server";
import { ipOf, limited } from "@/lib/auth";
import { createOrder, getAsset, publicSettings, setOrder, type Gateway } from "@/lib/db";
import { baseUrl, initCheckout } from "@/lib/pay";

const bad = (m: string, s = 400) => NextResponse.json({ error: m }, { status: s });
// The price always comes from the server's own record of the asset, never from the browser.
export async function POST(req: Request) {
  if (limited(`pay:${ipOf(req)}`, 12, 10 * 60e3)) return bad("Too many attempts. Try again in a few minutes.", 429);
  const b = await req.json().catch(() => ({})), a = getAsset(String(b.asset || "")), email = String(b.email || "").trim().toLowerCase();
  if (!a || a.status !== "published") return bad("Asset not found.", 404);
  if (a.price <= 0) return bad("This asset is free. Use the download button.");
  if (!/^\S+@\S+\.\S+$/.test(email)) return bad("Enter a valid email address. Your download link is tied to it.");
  const ps = publicSettings(), g = b.gateway as Gateway;
  if (!ps.gateways.includes(g)) return bad("That payment method is not available.");
  const o = createOrder({ assetId: a.id, assetTitle: a.title, email, amount: a.price, currency: a.currency, gateway: g });
  try { return NextResponse.json({ url: await initCheckout(g, o, baseUrl(req)) }); }
  catch (e) { const m = (e as Error).message; const msg = !m || m === "fetch failed" || /abort/i.test(m) ? "Could not reach the payment provider. Please try again." : m; setOrder(o.id, { status: "failed", note: msg }); return bad(msg, 502); }
}
