import path from "path";
import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { UPLOADS, getSettings, log, updateSettings } from "@/lib/db";
import { fileName, locate, put } from "@/lib/storage";
import fs from "fs";

const bad = (m: string, s = 400) => NextResponse.json({ error: m }, { status: s });
// Add a hero character: any rigged .glb that uses the Mixamo or Ready Player Me skeleton. Animations are supplied by the site if the file has none.
export async function POST(req: Request) {
  if (!(await currentUser())) return bad("Owner only", 401);
  const f = await req.formData(), file = f.get("file");
  if (!(file instanceof File) || path.extname(file.name).toLowerCase() !== ".glb") return bad("Choose a rigged .glb file.");
  if (file.size > 60 * 1048576) return bad("Character files must be under 60 MB.", 413);
  const name = String(f.get("name") || file.name.replace(/\.[^.]+$/, "")).trim().slice(0, 40);
  const ref = put("public", fileName(".glb", "char-"), Buffer.from(await file.arrayBuffer()));
  const s = getSettings(), id = `c${Date.now().toString(36)}`;
  updateSettings({ characters: [...s.characters, { id, name, file: ref, scale: 1, y: 0, enabled: true }] });
  log("settings", `Added hero character ${name}`); return NextResponse.json({ id }, { status: 201 });
}
export async function DELETE(req: Request) {
  if (!(await currentUser())) return bad("Owner only", 401);
  const id = new URL(req.url).searchParams.get("id") || "", s = getSettings(), c = s.characters.find((x) => x.id === id);
  if (!c) return bad("Not found", 404); if (c.builtin) return bad("Built-in characters can be switched off, not deleted.");
  if (s.characters.length <= 1) return bad("Keep at least one character.");
  const abs = locate(c.file); if (abs && abs.startsWith(UPLOADS)) fs.rmSync(abs, { force: true });
  const rest = s.characters.filter((x) => x.id !== id);
  updateSettings({ characters: rest, heroCharacter: s.heroCharacter === id ? rest.find((x) => x.enabled)?.id ?? rest[0].id : s.heroCharacter });
  log("settings", `Removed hero character ${c.name}`); return NextResponse.json({ ok: true });
}
