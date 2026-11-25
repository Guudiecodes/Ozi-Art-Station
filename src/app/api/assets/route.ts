import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { CATEGORIES, DATA_DIR, LICENSES, createAsset, listAssets, type AssetType } from "@/lib/db";

export const dynamic = "force-dynamic";
const KINDS: Record<string, { type: AssetType; max: number }> = { ".glb": { type: "model", max: 80 }, ".hdr": { type: "hdri", max: 60 }, ".jpg": { type: "texture", max: 25 }, ".jpeg": { type: "texture", max: 25 }, ".png": { type: "texture", max: 25 }, ".webp": { type: "texture", max: 25 } };
export async function GET() { return NextResponse.json(listAssets((await currentUser())?.id)); }
export async function POST(req: Request) {
  const u = await currentUser(); if (!u) return NextResponse.json({ error: "Log in to upload." }, { status: 401 });
  const f = await req.formData(), file = f.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a file." }, { status: 400 });
  const ext = path.extname(file.name).toLowerCase(), kind = KINDS[ext];
  if (!kind) return NextResponse.json({ error: "Supported files: .glb models, .hdr HDRIs, and .jpg .png .webp textures." }, { status: 400 });
  if (file.size > kind.max * 1048576) return NextResponse.json({ error: `File is over ${kind.max} MB.` }, { status: 413 });
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
  fs.mkdirSync(path.join(DATA_DIR, "uploads"), { recursive: true });
  fs.writeFileSync(path.join(DATA_DIR, "uploads", name), Buffer.from(await file.arrayBuffer()));
  const cat = String(f.get("category")), lic = String(f.get("license"));
  const a = createAsset({
    type: kind.type, title: String(f.get("title") || file.name.replace(/\.[^.]+$/, "")).slice(0, 80), file: `/api/files/${name}`, ownerId: u.id,
    category: CATEGORIES.includes(cat) ? cat : CATEGORIES[1], license: LICENSES.includes(lic) ? lic : LICENSES[0],
    tags: String(f.get("tags") || "").split(",").map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 8), blurb: String(f.get("blurb") || "").slice(0, 600),
  });
  return NextResponse.json({ slug: a.slug }, { status: 201 });
}
