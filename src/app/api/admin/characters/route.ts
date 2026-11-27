import path from "path";
import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { getSettings, log, ready, updateSettings } from "@/lib/db";
import { SAFE_REF, fileName, put, remove, size } from "@/lib/storage";

const bad = (m: string, s = 400) => NextResponse.json({ error: m }, { status: s });
// Add a hero character: any rigged .glb that uses the Mixamo or Ready Player Me skeleton. Animations are supplied by the site if the file has none.
export async function POST(req: Request) {
  await ready();
  if (!(await currentUser())) return bad("Owner only", 401);
  let ref = "", name = "";
  if ((req.headers.get("content-type") || "").includes("application/json")) { // file already sent straight to R2
    const b = await req.json().catch(() => ({})); ref = String(b.ref || ""); name = String(b.name || "Character").trim().slice(0, 40);
    if (!SAFE_REF.test(ref) || !ref.startsWith("/api/files/char-") || !ref.endsWith(".glb")) return bad("Upload did not finish. Try again.");
    const n = await size(ref); if (n == null) return bad("The uploaded file was not found. Try again."); if (n > 60 * 1048576) return bad("Character files must be under 60 MB.", 413);
  } else {
    const f = await req.formData(), file = f.get("file");
    if (!(file instanceof File) || path.extname(file.name).toLowerCase() !== ".glb") return bad("Choose a rigged .glb file.");
    if (file.size > 60 * 1048576) return bad("Character files must be under 60 MB.", 413);
    name = String(f.get("name") || file.name.replace(/\.[^.]+$/, "")).trim().slice(0, 40);
    ref = await put("public", fileName(".glb", "char-"), Buffer.from(await file.arrayBuffer()));
  }
  const s = getSettings(), id = `c${Date.now().toString(36)}`;
  updateSettings({ characters: [...s.characters, { id, name, file: ref, scale: 1, y: 0, enabled: true }] });
  log("settings", `Added hero character ${name}`); return NextResponse.json({ id }, { status: 201 });
}
export async function DELETE(req: Request) {
  await ready();
  if (!(await currentUser())) return bad("Owner only", 401);
  const id = new URL(req.url).searchParams.get("id") || "", s = getSettings(), c = s.characters.find((x) => x.id === id);
  if (!c) return bad("Not found", 404); if (c.builtin) return bad("Built-in characters can be switched off, not deleted.");
  if (s.characters.length <= 1) return bad("Keep at least one character.");
  await remove(c.file);
  const rest = s.characters.filter((x) => x.id !== id);
  updateSettings({ characters: rest, heroCharacter: s.heroCharacter === id ? rest.find((x) => x.enabled)?.id ?? rest[0].id : s.heroCharacter });
  log("settings", `Removed hero character ${c.name}`); return NextResponse.json({ ok: true });
}
