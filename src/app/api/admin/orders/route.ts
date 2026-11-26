import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { createOrder, getAsset, getOrder, log, markPaid, setOrder } from "@/lib/db";

const bad = (m: string, s = 400) => NextResponse.json({ error: m }, { status: s });
// Manual order: for bank transfers or cash. Creates a paid order and gives you a download link to send the customer.
export async function POST(req: Request) {
  if (!(await currentUser())) return bad("Owner only", 401);
  const b = await req.json().catch(() => ({})), a = getAsset(String(b.assetId || "")), email = String(b.email || "").trim().toLowerCase();
  if (!a) return bad("Choose an asset."); if (!/^\S+@\S+\.\S+$/.test(email)) return bad("Enter the customer's email.");
  const o = createOrder({ assetId: a.id, assetTitle: a.title, email, amount: a.price, currency: a.currency, gateway: "manual", note: String(b.note || "").slice(0, 200) });
  markPaid(o); return NextResponse.json({ token: o.token }, { status: 201 });
}
export async function PATCH(req: Request) {
  if (!(await currentUser())) return bad("Owner only", 401);
  const b = await req.json().catch(() => ({})), o = getOrder(String(b.id || "")); if (!o) return bad("Not found", 404);
  if (b.action === "resetDownloads") setOrder(o.id, { downloads: 0 });
  else if (b.action === "refund") { setOrder(o.id, { status: "refunded" }); log("order", `Refunded or revoked: ${o.assetTitle} for ${o.email}`); }
  else if (b.action === "markPaid") { if (o.status === "refunded") setOrder(o.id, { status: "pending" }); markPaid(o); }
  else return bad("Unknown action");
  return NextResponse.json({ ok: true });
}
