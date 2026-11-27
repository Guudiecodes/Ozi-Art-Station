import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { testGateway } from "@/lib/pay";
import { ready } from "@/lib/db";

export async function POST(req: Request) { await ready();
  if (!(await currentUser())) return NextResponse.json({ error: "Owner only" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  if (b.gateway !== "paystack" && b.gateway !== "flutterwave") return NextResponse.json({ error: "Unknown gateway" }, { status: 400 });
  return NextResponse.json(await testGateway(b.gateway));
}
