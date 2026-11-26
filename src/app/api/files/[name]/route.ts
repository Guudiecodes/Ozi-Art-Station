import path from "path";
import { UPLOADS } from "@/lib/db";
import { fileResponse } from "@/lib/storage";

// Public previews and hero characters. Originals that are for sale live in data/private and never pass through here.
export async function GET(_: Request, { params }: { params: Promise<{ name: string }> }) {
  return fileResponse(path.join(UPLOADS, path.basename((await params).name)), undefined, { "Cache-Control": "public, max-age=31536000, immutable" });
}
