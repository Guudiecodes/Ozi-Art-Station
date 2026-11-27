import path from "path";
import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { BLOB } from "@/lib/env";
import { ready } from "@/lib/db";
import { KINDS, direct, signUpload } from "@/lib/storage";

// Browsers upload large files straight to Cloudflare R2 (a Vercel function cannot receive more than about 4.5 MB). Without R2 this answers "local" and the form posts the file normally.
export async function POST(req: Request) {
  await ready();
  if (!(await currentUser())) return NextResponse.json({ error: "Owner only" }, { status: 401 });
  if (!direct()) return NextResponse.json({ mode: "local" });
  const b = await req.json().catch(() => ({})), ext = String(b.ext || "").toLowerCase(), what = String(b.kind);
  if (!KINDS[ext] || !["original", "preview", "character"].includes(what)) return NextResponse.json({ error: "Unsupported file." }, { status: 400 });
  if (what === "character" && ext !== ".glb") return NextResponse.json({ error: "Characters must be .glb." }, { status: 400 });
  const s = await signUpload(what === "original" ? "private" : "public", path.extname(ext) || ext, what === "preview" ? "p-" : what === "character" ? "char-" : "");
  return NextResponse.json({ mode: BLOB ? "blob" : "direct", ref: s.ref, url: s.url, type: s.type, pathname: "pathname" in s ? s.pathname : undefined });
}
