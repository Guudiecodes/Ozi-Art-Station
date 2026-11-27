import { NextResponse } from "next/server";
import { orderByRef, ready } from "@/lib/db";
import { baseUrl, settle } from "@/lib/pay";

// The customer lands here after paying. We verify with the gateway, then send them to their order page.
export async function GET(req: Request) { await ready();
  const q = new URL(req.url).searchParams, base = baseUrl(req);
  const o = orderByRef(q.get("reference") || q.get("trxref") || q.get("tx_ref") || "");
  if (!o) return NextResponse.redirect(new URL("/", base));
  await settle(o, base);
  return NextResponse.redirect(new URL(`/order/${o.token}`, base));
}
