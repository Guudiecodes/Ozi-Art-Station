import { NextResponse } from "next/server";
import { getSettings, orderByRef } from "@/lib/db";
import { baseUrl, settle } from "@/lib/pay";

// Gateways call this when a payment completes, even if the customer closed the tab.
// The body is only used to find the order. Payment status always comes from asking the gateway (verify).
export async function POST(req: Request, { params }: { params: Promise<{ gateway: string }> }) {
  const { gateway } = await params, s = getSettings();
  const body = await req.json().catch(() => ({}));
  if (gateway === "flutterwave") {
    const want = s.payments.flutterwave.secretHash;
    if (want && req.headers.get("verif-hash") !== want) return NextResponse.json({ error: "Bad signature" }, { status: 401 });
  } else if (gateway !== "paystack") return NextResponse.json({ error: "Unknown gateway" }, { status: 404 });
  const ref = String(body?.data?.reference || body?.data?.tx_ref || body?.txRef || ""), o = orderByRef(ref);
  if (o && o.gateway === gateway) await settle(o, baseUrl(req));
  return NextResponse.json({ ok: true });
}
