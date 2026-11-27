import { NextResponse } from "next/server";
import { visitorId } from "@/lib/auth";
import { listAssets, ready } from "@/lib/db";

export const dynamic = "force-dynamic";
// Public list: published assets only. Uploading happens in the admin panel (/api/admin/upload).
export async function GET() { await ready(); return NextResponse.json(listAssets(await visitorId())); }
