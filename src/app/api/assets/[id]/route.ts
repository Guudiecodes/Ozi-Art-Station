import { NextResponse } from "next/server";
import { canEdit, currentUser } from "@/lib/auth";
import { CATEGORIES, LICENSES, deleteAsset, getAsset, updateAsset } from "@/lib/db";

async function guard(id: string) {
  const u = await currentUser(), a = getAsset(id);
  if (!a) return { res: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  if (!canEdit(u, a.ownerId)) return { res: NextResponse.json({ error: "You can only change your own content." }, { status: 403 }) };
  return { u, a };
}
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard((await params).id); if (g.res) return g.res;
  const b = await req.json(); const p: Parameters<typeof updateAsset>[1] = {};
  if (typeof b.title === "string" && b.title.trim()) p.title = b.title.trim().slice(0, 80);
  if (typeof b.blurb === "string") p.blurb = b.blurb.slice(0, 600);
  if (CATEGORIES.includes(b.category)) p.category = b.category;
  if (LICENSES.includes(b.license)) p.license = b.license;
  if (typeof b.tags === "string") p.tags = b.tags.split(",").map((t: string) => t.trim().toLowerCase()).filter(Boolean).slice(0, 8);
  if (typeof b.featured === "boolean" && g.u!.role === "admin") p.featured = b.featured;
  return NextResponse.json({ slug: updateAsset(g.a!.id, p)!.slug });
}
export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard((await params).id); if (g.res) return g.res;
  deleteAsset(g.a!.id); return NextResponse.json({ ok: true });
}
