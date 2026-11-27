// File storage. Local disk by default; Cloudflare R2 when the R2_* variables are set (required on Vercel).
// Private originals are never public: they are only ever released after the owner or a paid order is checked.
import fs from "fs";
import path from "path";
import { Readable } from "stream";
import { BLOB, DATA_DIR, r2 } from "./env";
import type { AssetType } from "./db";

const PRIVATE = path.join(DATA_DIR, "private"), UPLOADS = path.join(DATA_DIR, "uploads");
export const KINDS: Record<string, { type: AssetType; max: number }> = {
  ".glb": { type: "model", max: 120 }, ".hdr": { type: "hdri", max: 80 },
  ".jpg": { type: "texture", max: 40 }, ".jpeg": { type: "texture", max: 40 }, ".png": { type: "texture", max: 40 }, ".webp": { type: "texture", max: 40 },
};
export const MIME: Record<string, string> = { ".glb": "model/gltf-binary", ".hdr": "application/octet-stream", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };
export const fileName = (ext: string, prefix = "") => `${prefix}${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
export const SAFE_REF = /^(private:|\/api\/files\/)[A-Za-z0-9][A-Za-z0-9._-]*$/;
export const direct = () => !!r2() || BLOB; // true: browsers upload straight to R2 (serverless functions cannot take big request bodies)

// A reference is "private:NAME" (an original for sale) or "/api/files/NAME" (a public preview or hero character).
const parse = (ref: string) => (ref.startsWith("private:") ? { dir: "private" as const, name: path.basename(ref.slice(8)) } : ref.startsWith("/api/files/") ? { dir: "public" as const, name: path.basename(ref) } : null);
const keyOf = (ref: string) => { const p = parse(ref); return p ? `${p.dir}/${p.name}` : null; };
const localPath = (ref: string) => { const p = parse(ref); return p ? path.join(p.dir === "private" ? PRIVATE : UPLOADS, p.name) : null; };
export const isStored = (ref: string) => !!parse(ref);

let client: unknown;
async function s3() {
  const c = r2()!, { S3Client } = await import("@aws-sdk/client-s3");
  return (client ??= new S3Client({ region: "auto", endpoint: c.endpoint, forcePathStyle: true, credentials: { accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey } })) as InstanceType<typeof S3Client>;
}
const refFor = (dir: "private" | "public", name: string) => (dir === "private" ? `private:${name}` : `/api/files/${name}`);

export async function put(dir: "private" | "public", name: string, buf: Buffer) {
  const ref = refFor(dir, name);
  if (BLOB) { const { put: bput } = await import("@vercel/blob"); await bput(`${dir}/${name}`, buf, { access: "private", allowOverwrite: true, addRandomSuffix: false, contentType: MIME[path.extname(name).toLowerCase()] || "application/octet-stream" }); }
  else if (r2()) { const { PutObjectCommand } = await import("@aws-sdk/client-s3"); await (await s3()).send(new PutObjectCommand({ Bucket: r2()!.bucket, Key: `${dir}/${name}`, Body: buf, ContentType: MIME[path.extname(name).toLowerCase()] || "application/octet-stream" })); }
  else { const d = path.dirname(localPath(ref)!); fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(localPath(ref)!, buf); }
  return ref;
}
// A short-lived address the browser can upload to directly (R2 only). The server later checks the object exists before using it.
export const blobPath = (ref: string) => keyOf(ref);
export async function signUpload(dir: "private" | "public", ext: string, prefix = "") {
  if (BLOB) { const name = fileName(ext, prefix); return { ref: refFor(dir, name), type: MIME[ext] || "application/octet-stream", pathname: `${dir}/${name}`, url: "" }; }
  const name = fileName(ext, prefix), ref = refFor(dir, name), { PutObjectCommand } = await import("@aws-sdk/client-s3"), { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
  const type = MIME[ext] || "application/octet-stream";
  return { ref, type, url: await getSignedUrl(await s3(), new PutObjectCommand({ Bucket: r2()!.bucket, Key: `${dir}/${name}`, ContentType: type }), { expiresIn: 900 }) };
}
export async function size(ref: string): Promise<number | null> {
  if (BLOB) { try { const { head } = await import("@vercel/blob"); return (await head(keyOf(ref)!)).size; } catch { return null; } }
  if (r2()) { try { const { HeadObjectCommand } = await import("@aws-sdk/client-s3"); const h = await (await s3()).send(new HeadObjectCommand({ Bucket: r2()!.bucket, Key: keyOf(ref)! })); return h.ContentLength ?? 0; } catch { return null; } }
  const p = localPath(ref); return p && fs.existsSync(p) ? fs.statSync(p).size : null;
}
export async function read(ref: string): Promise<Buffer | null> {
  if (BLOB) { try { const { get } = await import("@vercel/blob"); const g = await get(keyOf(ref)!, { access: "private" }); return g && g.stream ? Buffer.from(await new Response(g.stream).arrayBuffer()) : null; } catch { return null; } }
  if (r2()) { try { const { GetObjectCommand } = await import("@aws-sdk/client-s3"); const o = await (await s3()).send(new GetObjectCommand({ Bucket: r2()!.bucket, Key: keyOf(ref)! })); return Buffer.from(await o.Body!.transformToByteArray()); } catch { return null; } }
  const p = localPath(ref); return p && fs.existsSync(p) ? fs.readFileSync(p) : null;
}
export async function remove(ref: string) {
  if (!isStored(ref)) return;
  if (BLOB) { try { const { del } = await import("@vercel/blob"); await del(keyOf(ref)!); } catch { /* already gone */ } return; }
  if (r2()) { try { const { DeleteObjectCommand } = await import("@aws-sdk/client-s3"); await (await s3()).send(new DeleteObjectCommand({ Bucket: r2()!.bucket, Key: keyOf(ref)! })); } catch { /* already gone */ } }
  else fs.rmSync(localPath(ref)!, { force: true });
}
// Send a stored file to the browser. R2: a redirect to a short-lived signed address. Disk: streamed.
export async function serve(ref: string, opts: { filename?: string; cache?: string } = {}) {
  const ext = path.extname(ref).toLowerCase(), cache = opts.cache ?? "private, no-store";
  if (BLOB) {
    const k = keyOf(ref); if (!k) return new Response("Not found", { status: 404 });
    try {
      const { get } = await import("@vercel/blob"), g = await get(k, { access: "private" });
      if (!g || !g.stream) return new Response("Not found", { status: 404 });
      const headers: Record<string, string> = { "Content-Type": MIME[ext] || "application/octet-stream", "Cache-Control": cache };
      if (g.blob.size) headers["Content-Length"] = String(g.blob.size);
      if (opts.filename) headers["Content-Disposition"] = `attachment; filename="${opts.filename.replace(/[^\w.\-]+/g, "_")}"`;
      return new Response(g.stream, { headers });
    } catch { return new Response("Not found", { status: 404 }); }
  }
  if (r2()) {
    const { GetObjectCommand } = await import("@aws-sdk/client-s3"), { getSignedUrl } = await import("@aws-sdk/s3-request-presigner"), k = keyOf(ref); if (!k) return new Response("Not found", { status: 404 });
    const url = await getSignedUrl(await s3(), new GetObjectCommand({ Bucket: r2()!.bucket, Key: k, ...(opts.filename ? { ResponseContentDisposition: `attachment; filename="${opts.filename.replace(/[^\w.\-]+/g, "_")}"` } : {}), ResponseContentType: MIME[ext] }), { expiresIn: 600 });
    return new Response(null, { status: 302, headers: { Location: url, "Cache-Control": opts.cache ? "public, max-age=300" : "private, no-store" } });
  }
  const abs = localPath(ref); if (!abs || !fs.existsSync(abs)) return new Response("Not found", { status: 404 });
  const headers: Record<string, string> = { "Content-Type": MIME[ext] || "application/octet-stream", "Content-Length": String(fs.statSync(abs).size), "Cache-Control": cache };
  if (opts.filename) headers["Content-Disposition"] = `attachment; filename="${opts.filename.replace(/[^\w.\-]+/g, "_")}"`;
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
