import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { currentUser } from "@/lib/auth";
import { BLOB } from "@/lib/env";
import { ready } from "@/lib/db";
import { KINDS, MIME } from "@/lib/storage";
import path from "path";

// Hands the owner's browser a short-lived token so a large file goes straight to Vercel Blob (a Vercel function cannot receive more than about 4.5 MB).
export async function POST(req: Request) {
  await ready();
  if (!BLOB) return NextResponse.json({ error: "Vercel Blob is not connected." }, { status: 400 });
  if (!(await currentUser())) return NextResponse.json({ error: "Owner only" }, { status: 401 });
  const body = (await req.json()) as HandleUploadBody;
  try {
    const out = await handleUpload({
      body, request: req,
      onBeforeGenerateToken: async (pathname) => {
        const ext = path.extname(pathname).toLowerCase(), ok = /^(private|public)\/[A-Za-z0-9][A-Za-z0-9._-]*$/.test(pathname) && KINDS[ext];
        if (!ok) throw new Error("Unsupported file.");
        return { allowedContentTypes: [MIME[ext], "application/octet-stream"], maximumSizeInBytes: KINDS[ext].max * 1024 * 1024, addRandomSuffix: false, allowOverwrite: true };
      },
    });
    return NextResponse.json(out);
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }
}
