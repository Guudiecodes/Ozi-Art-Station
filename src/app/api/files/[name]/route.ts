import path from "path";
import { serve } from "@/lib/storage";
import { ready } from "@/lib/db";

// Public previews and hero characters. Originals that are for sale are "private:" references and never pass through here.
export async function GET(_: Request, { params }: { params: Promise<{ name: string }> }) { await ready();
  return serve(`/api/files/${path.basename((await params).name)}`, { cache: "public, max-age=31536000, immutable" });
}
