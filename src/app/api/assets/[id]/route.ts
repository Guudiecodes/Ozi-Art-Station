import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { CATEGORIES, LICENSES, deleteAsset, getAsset, log, updateAsset, ready } from "@/lib/db";
import { CURRENCIES } from "@/lib/lists";
import { remove } from "@/lib/storage";

async function guard(id: string) {
  const u = await currentUser(), a = getAsset(id);
  if (!u) return { res: NextResponse.json({ error: "Only the owner can change content." }, { status: 401 }) };
  if (!a) return { res: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  return { a };
}
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) { await ready();
  const g = await guard((await params).id); if (g.res) return g.res;
  const b = await req.json().catch(() => ({})), p: Parameters<typeof updateAsset>[1] = {}, a = g.a!;
  if (typeof b.title === "string" && b.title.trim()) p.title = b.title.trim().slice(0, 80);
  if (typeof b.blurb === "string") p.blurb = b.blurb.slice(0, 600);
  if (CATEGORIES.includes(b.category)) p.category = b.category;
  if (LICENSES.includes(b.license)) p.license = b.license;
  if (typeof b.tags === "string") p.tags = b.tags.split(",").map((t: string) => t.trim().toLowerCase()).filter(Boolean).slice(0, 8);
  if (typeof b.featured === "boolean") p.featured = b.featured;
  if (b.status === "published" || b.status === "draft") p.status = b.status;
  if (b.price !== undefined) { const n = Number(b.price); if (!Number.isFinite(n) || n < 0 || n > 1e9) return NextResponse.json({ error: "Price must be 0 or more." }, { status: 400 }); p.price = Math.round(n * 100) / 100; }
  if (CURRENCIES.includes(b.currency)) p.currency = b.currency;
  const before = `${a.price} ${a.currency}`;
  const out = updateAsset(a.id, p)!;
  if (`${out.price} ${out.currency}` !== before) log("price", `${out.title}: ${before} to ${out.price} ${out.currency}`); else log("edit", `Edited ${out.title}`);
  return NextResponse.json({ slug: out.slug });
}
export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) { await ready();
  const g = await guard((await params).id); if (g.res) return g.res;
  const a = g.a!; deleteAsset(a.id); await remove(a.file); if (a.preview !== a.file) await remove(a.preview); log("delete", `Deleted ${g.a!.title}`); return NextResponse.json({ ok: true });
}
