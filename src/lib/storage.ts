// Local-disk storage for uploads. Swapping this file for Cloudflare R2 later does not touch the rest of the app.
import fs from "fs";
import path from "path";
import { Readable } from "stream";
import { PRIVATE, UPLOADS, type AssetType } from "./db";

export const KINDS: Record<string, { type: AssetType; max: number }> = {
  ".glb": { type: "model", max: 120 }, ".hdr": { type: "hdri", max: 80 },
  ".jpg": { type: "texture", max: 40 }, ".jpeg": { type: "texture", max: 40 }, ".png": { type: "texture", max: 40 }, ".webp": { type: "texture", max: 40 },
};
export const MIME: Record<string, string> = { ".glb": "model/gltf-binary", ".hdr": "application/octet-stream", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };
export const fileName = (ext: string, prefix = "") => `${prefix}${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
export function put(dir: "private" | "public", name: string, buf: Buffer) {
  const d = dir === "private" ? PRIVATE : UPLOADS; fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, name), buf);
  return dir === "private" ? `private:${name}` : `/api/files/${name}`;
}
// Resolve a stored reference to a file on disk. Public paths under /public return null (they are redirected instead).
export function locate(ref: string) {
  if (ref.startsWith("private:")) return path.join(PRIVATE, path.basename(ref.slice(8)));
  if (ref.startsWith("/api/files/")) return path.join(UPLOADS, path.basename(ref));
  return null;
}
export function fileResponse(abs: string, filename?: string, extra: Record<string, string> = {}) {
  if (!fs.existsSync(abs)) return new Response("Not found", { status: 404 });
  const st = fs.statSync(abs), ext = path.extname(abs).toLowerCase();
  const headers: Record<string, string> = { "Content-Type": MIME[ext] || "application/octet-stream", "Content-Length": String(st.size), ...extra };
  if (filename) headers["Content-Disposition"] = `attachment; filename="${filename.replace(/[^\w.\-]+/g, "_")}"`;
  return new Response(Readable.toWeb(fs.createReadStream(abs)) as unknown as ReadableStream, { headers });
}

// Reduced copies that are safe to show publicly while the full file stays behind the paywall.
export async function modelPreview(buf: Buffer): Promise<Buffer> {
  const { NodeIO } = await import("@gltf-transform/core");
  const { ALL_EXTENSIONS } = await import("@gltf-transform/extensions");
  const { dedup, prune, simplify, textureCompress, weld } = await import("@gltf-transform/functions");
  const { MeshoptDecoder, MeshoptSimplifier } = await import("meshoptimizer");
  const sharp = (await import("sharp")).default;
  await MeshoptDecoder.ready; await MeshoptSimplifier.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder });
  const doc = await io.readBinary(new Uint8Array(buf));
  await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: 0.25, error: 0.02 }), dedup(), prune(), textureCompress({ encoder: sharp, resize: [768, 768] }));
  return Buffer.from(await io.writeBinary(doc));
}
export async function texturePreview(buf: Buffer): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  return sharp(buf).rotate().resize({ width: 800, withoutEnlargement: true }).jpeg({ quality: 72 }).toBuffer();
}
