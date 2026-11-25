import fs from "fs";
import path from "path";
import { DATA_DIR } from "@/lib/db";
const TYPES: Record<string, string> = { ".glb": "model/gltf-binary", ".hdr": "application/octet-stream", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };
export async function GET(_: Request, { params }: { params: Promise<{ name: string }> }) {
  const n = path.basename((await params).name), p = path.join(DATA_DIR, "uploads", n);
  if (!fs.existsSync(p)) return new Response("Not found", { status: 404 });
  return new Response(fs.readFileSync(p), { headers: { "Content-Type": TYPES[path.extname(n).toLowerCase()] || "application/octet-stream", "Cache-Control": "public, max-age=31536000, immutable" } });
}
