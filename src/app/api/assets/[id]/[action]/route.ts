import crypto from "crypto";
import path from "path";
import { NextResponse } from "next/server";
import { VID, currentUser, ipOf, visitorId } from "@/lib/auth";
import { addAnnotation, bump, getAsset, log, removeAnnotation, toggleLike, updateAsset, ready } from "@/lib/db";
import { fileName, isStored, modelPreview, put, read, remove, serve, texturePreview } from "@/lib/storage";

const err = (m: string, s: number) => NextResponse.json({ error: m }, { status: s });
export const maxDuration = 60;
type P = { params: Promise<{ id: string; action: string }> };
const seen = new Map<string, number>();

export async function GET(req: Request, { params }: P) { await ready();
  const { id, action } = await params;
  if (action !== "download") return err("Not found", 404);
  const a = getAsset(id), owner = await currentUser();
  if (!a || (a.status !== "published" && !owner)) return err("Not found", 404);
  if (a.price > 0 && !owner) return NextResponse.redirect(new URL(`/a/${a.slug}?buy=1`, req.url));
  bump(a.id, "downloads");
  if (!isStored(a.file)) return NextResponse.redirect(new URL(a.file, req.url)); // bundled sample in /public
  return serve(a.file, { filename: `${a.slug}${path.extname(a.file)}` });
}
export async function POST(req: Request, { params }: P) { await ready();
  const { id, action } = await params, a = getAsset(id); if (!a) return err("Not found", 404);
  const owner = await currentUser();
  if (a.status !== "published" && !owner) return err("Not found", 404);
  if (action === "view") {
    const k = `${(await visitorId()) || ipOf(req)}:${a.id}`, now = Date.now();
    if (now - (seen.get(k) ?? 0) > 30 * 60e3) { seen.set(k, now); bump(a.id, "views"); if (seen.size > 5000) seen.clear(); }
    return NextResponse.json({ ok: true });
  }
  if (action === "like") {
    const vid = (await visitorId()) || crypto.randomBytes(9).toString("hex");
    const res = NextResponse.json(toggleLike(a.id, vid));
    res.cookies.set(VID, vid, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 365 * 86400 }); return res;
  }
  if (!owner) return err("Only the owner can do this.", 401);
  const b = await req.json().catch(() => ({}));
  if (action === "annotations") {
    const pos = Array.isArray(b.pos) && b.pos.length === 3 && b.pos.every((n: unknown) => typeof n === "number") ? b.pos : null, text = String(b.text || "").trim().slice(0, 200);
    if (!pos || !text) return err("Pin needs a position and text.", 400);
    return NextResponse.json(addAnnotation(a.id, { id: Math.random().toString(36).slice(2, 9), pos, text }), { status: 201 });
  }
  if (action === "preview") { // rebuild the public low-res copy from the private original
    if (!a.file.startsWith("private:")) return err("This asset has no private original.", 400);
    if (a.type === "hdri") return err("HDRIs have no automatic preview. Upload a smaller .hdr as the preview instead.", 400);
    try {
      const src = await read(a.file); if (!src) return err("The original file is missing from storage.", 404);
      const out = a.type === "model" ? await modelPreview(src) : await texturePreview(src);
      const old = a.preview; const ref = await put("public", fileName(a.type === "model" ? ".glb" : ".jpg", "p-"), out);
      updateAsset(a.id, { preview: ref, protectedPreview: true }); if (old.startsWith("/api/files/") && old !== a.file) await remove(old);
      log("edit", `Rebuilt preview for ${a.title}`); return NextResponse.json({ ok: true, size: out.length });
    } catch { return err("Could not build a preview from this file.", 422); }
  }
  return err("Not found", 404);
}
export async function DELETE(req: Request, { params }: P) { await ready();
  const { id, action } = await params; if (action !== "annotations") return err("Not found", 404);
  if (!(await currentUser())) return err("Only the owner can do this.", 401);
  const n = new URL(req.url).searchParams.get("n") || ""; return removeAnnotation(id, n) ? NextResponse.json({ ok: true }) : err("Not found", 404);
}
