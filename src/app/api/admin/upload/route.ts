import path from "path";
import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { CATEGORIES, LICENSES, createAsset, getSettings, log, ready } from "@/lib/db";
import { CURRENCIES } from "@/lib/lists";
import { KINDS, SAFE_REF, fileName, modelPreview, put, read, size, texturePreview } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
const bad = (m: string, s = 400) => NextResponse.json({ error: m }, { status: s });

// Owner-only upload. The original goes to private storage. A public preview is either the file you supply, a reduced copy we build, or the original (free assets).
// Two ways in: a normal form post (disk, small files), or JSON naming files the browser already sent straight to R2 (Vercel).
export async function POST(req: Request) {
  await ready();
  const u = await currentUser(); if (!u) return bad("Log in as the owner to upload.", 401);
  const isJson = (req.headers.get("content-type") || "").includes("application/json");
  const body = isJson ? await req.json().catch(() => ({})) : null, form = isJson ? null : await req.formData();
  const g = (k: string): string => (isJson ? (body[k] == null ? "" : String(body[k])) : String(form!.get(k) ?? ""));
  let original = "", fname = "", bytes = 0, buf: Buffer | null = null, previewRef = "";
  const pf = form?.get("preview"), file = form?.get("file");
  if (isJson) {
    original = g("fileRef"); fname = g("fileName") || original;
    if (!SAFE_REF.test(original) || !original.startsWith("private:")) return bad("Upload did not finish. Try again.");
    const n = await size(original); if (n == null) return bad("The uploaded file was not found. Try again."); bytes = n;
    previewRef = g("previewRef"); if (previewRef && (!SAFE_REF.test(previewRef) || !previewRef.startsWith("/api/files/") || (await size(previewRef)) == null)) return bad("The preview upload did not finish.");
  } else {
    if (!(file instanceof File) || !file.size) return bad("Choose a file."); fname = file.name; bytes = file.size;
  }
  const ext = path.extname(isJson ? original : fname).toLowerCase(), kind = KINDS[ext];
  if (!kind) return bad("Supported files: .glb models, .hdr HDRIs, and .jpg .png .webp textures.");
  if (bytes > kind.max * 1048576) return bad(`File is over ${kind.max} MB.`, 413);
  const need = async () => (buf ??= isJson ? await read(original) : Buffer.from(await (file as File).arrayBuffer()));
  if (!isJson) original = await put("private", fileName(ext), (await need())!);

  let preview = "", prot = false, warning = "";
  if (previewRef) { if (path.extname(previewRef).toLowerCase() && KINDS[path.extname(previewRef).toLowerCase()]?.type !== kind.type) return bad("The preview must be the same kind of file as the original."); preview = previewRef; prot = true; }
  else if (pf instanceof File && pf.size) {
    const pe = path.extname(pf.name).toLowerCase();
    if (KINDS[pe]?.type !== kind.type) return bad("The preview must be the same kind of file as the original.");
    preview = await put("public", fileName(pe, "p-"), Buffer.from(await pf.arrayBuffer())); prot = true;
  } else if ((g("lowres") === "on" || g("lowres") === "true") && kind.type !== "hdri") {
    try { const src = await need(); if (!src) throw new Error("missing"); preview = await put("public", fileName(kind.type === "model" ? ".glb" : ".jpg", "p-"), kind.type === "model" ? await modelPreview(src) : await texturePreview(src)); prot = true; }
    catch { warning = "Could not build a low-res preview from this file, so the public preview is the full file."; }
  } else if (kind.type === "hdri" && (g("lowres") === "on" || g("lowres") === "true")) warning = "HDRIs cannot be reduced automatically. Upload a smaller .hdr as the preview, or the public preview is the full file.";
  if (!preview) { const src = await need(); if (!src) return bad("Could not read the uploaded file.", 500); preview = await put("public", fileName(ext, "p-"), src); }

  const cat = g("category"), lic = g("license"), cur = g("currency"), price = Math.max(0, Number(g("price")) || 0);
  const a = createAsset({
    type: kind.type, title: (g("title") || fname.replace(/\.[^.]+$/, "")).slice(0, 80), file: original, preview, protectedPreview: prot, ownerId: u.id, size: bytes,
    category: CATEGORIES.includes(cat) ? cat : CATEGORIES[1], license: LICENSES.includes(lic) ? lic : LICENSES[0],
    tags: g("tags").split(",").map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 8), blurb: g("blurb").slice(0, 600),
    price: Math.round(price * 100) / 100, currency: CURRENCIES.includes(cur) ? cur : getSettings().currency, status: g("status") === "draft" ? "draft" : "published",
  });
  log("upload", `Uploaded ${a.title} (${a.type}, ${a.price > 0 ? `${a.currency} ${a.price}` : "free"})`);
  return NextResponse.json({ slug: a.slug, warning }, { status: 201 });
}
