import path from "path";
import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { CATEGORIES, LICENSES, createAsset, getSettings, log } from "@/lib/db";
import { CURRENCIES } from "@/lib/lists";
import { KINDS, fileName, modelPreview, put, texturePreview } from "@/lib/storage";

export const dynamic = "force-dynamic";
const bad = (m: string, s = 400) => NextResponse.json({ error: m }, { status: s });

// Owner-only upload. The original goes to private storage. A public preview is either the file you supply, a reduced copy we build, or the original (free assets).
export async function POST(req: Request) {
  const u = await currentUser(); if (!u) return bad("Log in as the owner to upload.", 401);
  const f = await req.formData(), file = f.get("file"), pf = f.get("preview");
  if (!(file instanceof File) || !file.size) return bad("Choose a file.");
  const ext = path.extname(file.name).toLowerCase(), kind = KINDS[ext];
  if (!kind) return bad("Supported files: .glb models, .hdr HDRIs, and .jpg .png .webp textures.");
  if (file.size > kind.max * 1048576) return bad(`File is over ${kind.max} MB.`, 413);
  const buf = Buffer.from(await file.arrayBuffer()), name = fileName(ext);
  const original = put("private", name, buf);

  let preview = "", prot = false, warning = "";
  if (pf instanceof File && pf.size) {
    const pe = path.extname(pf.name).toLowerCase();
    if (KINDS[pe]?.type !== kind.type) return bad("The preview must be the same kind of file as the original.");
    preview = put("public", fileName(pe, "p-"), Buffer.from(await pf.arrayBuffer())); prot = true;
  } else if (f.get("lowres") === "on" && kind.type !== "hdri") {
    try { preview = put("public", fileName(kind.type === "model" ? ".glb" : ".jpg", "p-"), kind.type === "model" ? await modelPreview(buf) : await texturePreview(buf)); prot = true; }
    catch { warning = "Could not build a low-res preview from this file, so the public preview is the full file."; }
  } else if (kind.type === "hdri" && f.get("lowres") === "on") warning = "HDRIs cannot be reduced automatically. Upload a smaller .hdr as the preview, or the public preview is the full file.";
  if (!preview) preview = put("public", fileName(ext, "p-"), buf);

  const cat = String(f.get("category")), lic = String(f.get("license")), cur = String(f.get("currency")), price = Math.max(0, Number(f.get("price")) || 0);
  const a = createAsset({
    type: kind.type, title: String(f.get("title") || file.name.replace(/\.[^.]+$/, "")).slice(0, 80), file: original, preview, protectedPreview: prot, ownerId: u.id, size: file.size,
    category: CATEGORIES.includes(cat) ? cat : CATEGORIES[1], license: LICENSES.includes(lic) ? lic : LICENSES[0],
    tags: String(f.get("tags") || "").split(",").map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 8), blurb: String(f.get("blurb") || "").slice(0, 600),
    price: Math.round(price * 100) / 100, currency: CURRENCIES.includes(cur) ? cur : getSettings().currency, status: f.get("status") === "draft" ? "draft" : "published",
  });
  log("upload", `Uploaded ${a.title} (${a.type}, ${a.price > 0 ? `${a.currency} ${a.price}` : "free"})`);
  return NextResponse.json({ slug: a.slug, warning }, { status: 201 });
}
