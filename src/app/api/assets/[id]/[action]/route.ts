import { NextResponse } from "next/server";
import { canEdit, currentUser } from "@/lib/auth";
import { addAnnotation, addComment, bump, deleteComment, getAsset, getComment, toggleLike } from "@/lib/db";

const err = (m: string, s: number) => NextResponse.json({ error: m }, { status: s });
type P = { params: Promise<{ id: string; action: string }> };
export async function GET(req: Request, { params }: P) {
  const { id, action } = await params;
  if (action !== "download") return err("Not found", 404);
  const a = bump(id, "downloads"); if (!a) return err("Not found", 404);
  return NextResponse.redirect(new URL(a.file, req.url));
}
export async function POST(req: Request, { params }: P) {
  const { id, action } = await params, a = getAsset(id); if (!a) return err("Not found", 404);
  if (action === "view") { bump(id, "views"); return NextResponse.json({ ok: true }); }
  const u = await currentUser(); if (!u) return err("Log in first.", 401);
  const b = await req.json().catch(() => ({}));
  if (action === "like") return NextResponse.json(toggleLike(id, u.id));
  if (action === "comments") {
    const text = String(b.text || "").trim().slice(0, 500); if (!text) return err("Write a comment first.", 400);
    return NextResponse.json(addComment(a.id, u.id, text), { status: 201 });
  }
  if (action === "annotations") {
    if (!canEdit(u, a.ownerId)) return err("Only the owner can add pins.", 403);
    const pos = Array.isArray(b.pos) && b.pos.length === 3 && b.pos.every((n: unknown) => typeof n === "number") ? b.pos : null, text = String(b.text || "").trim().slice(0, 200);
    if (!pos || !text) return err("Pin needs a position and text.", 400);
    return NextResponse.json(addAnnotation(a.id, { id: Math.random().toString(36).slice(2, 9), pos, text }), { status: 201 });
  }
  return err("Not found", 404);
}
export async function DELETE(req: Request, { params }: P) {
  const { action } = await params; if (action !== "comments") return err("Not found", 404);
  const u = await currentUser(), c = getComment(new URL(req.url).searchParams.get("c") || "");
  if (!c) return err("Not found", 404); if (!canEdit(u, c.userId)) return err("Not allowed.", 403);
  deleteComment(c.id); return NextResponse.json({ ok: true });
}
