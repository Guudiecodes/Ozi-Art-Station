// File-backed store (data/db.json). Every read/write goes through this file, so moving to Postgres later means rewriting only this module.
import fs from "fs";
import path from "path";
import { CATEGORIES, LICENSES } from "./lists";
export { CATEGORIES, LICENSES };

export type AssetType = "model" | "hdri" | "texture";
export type Annotation = { id: string; pos: [number, number, number]; text: string };
export type User = { id: string; username: string; email: string; hash: string; salt: string; role: "admin" | "user" | "system"; bio: string; createdAt: number };
export type Asset = { id: string; slug: string; type: AssetType; title: string; file: string; ownerId: string; category: string; license: string; tags: string[]; blurb: string; views: number; downloads: number; likedBy: string[]; featured: boolean; createdAt: number; annotations: Annotation[] };
export type Comment = { id: string; assetId: string; userId: string; text: string; createdAt: number };
export type PublicAsset = Omit<Asset, "likedBy"> & { likes: number; liked: boolean; owner: string };
export type PublicComment = Comment & { username: string };
type DB = { users: User[]; sessions: { token: string; userId: string; expires: number }[]; assets: Asset[]; comments: Comment[] };

export const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "db.json");

const mk = (slug: string, type: AssetType, title: string, file: string, category: string, blurb: string, tags: string[], i: number, featured = false): Asset => ({
  id: slug, slug, type, title, file, ownerId: "system", category, license: "Sample asset, replace with client content", tags, blurb, views: 0, downloads: 0, likedBy: [], featured, createdAt: Date.now() - i * 1000, annotations: [],
});
const seed = (): DB => ({
  users: [{ id: "system", username: "modelhub", email: "", hash: "", salt: "", role: "system", bio: "Sample content published by the platform.", createdAt: Date.now() }],
  sessions: [], comments: [],
  assets: [
    mk("damaged-helmet", "model", "Damaged Helmet", "/models/DamagedHelmet.glb", "Hard surface", "Sci-fi helmet with full PBR textures, a good test of metal and emissive maps.", ["helmet", "pbr", "scifi"], 0, true),
    mk("boom-box", "model", "Boom Box", "/models/BoomBox.glb", "Props", "Retro stereo with sharp edges and detailed maps.", ["audio", "retro"], 1, true),
    mk("sheen-chair", "model", "Sheen Chair", "/models/SheenChair.glb", "Furniture & Home", "Upholstered chair that shows fabric sheen.", ["furniture", "fabric"], 2, true),
    mk("lantern", "model", "Lantern", "/models/Lantern.glb", "Props", "Street lantern with emissive glass.", ["light", "metal"], 3),
    mk("avocado", "model", "Avocado", "/models/Avocado.glb", "Food & Drink", "Organic form with soft shading.", ["food", "organic"], 4),
    mk("duck", "model", "Duck", "/models/Duck.glb", "Characters & Creatures", "The classic glTF test duck.", ["toy", "classic"], 5),
    mk("venice-sunset", "hdri", "Venice Sunset", "/hdri/venice_sunset_1k.hdr", "Sky & Light", "Warm low sun over a canal. Soft, golden light.", ["sunset", "outdoor", "warm"], 6, true),
    mk("pedestrian-overpass", "hdri", "Pedestrian Overpass", "/hdri/pedestrian_overpass_1k.hdr", "Sky & Light", "Overcast city sky with even, neutral light.", ["city", "overcast", "neutral"], 7),
    mk("red-brick", "texture", "Red Brick", "/tex/brick_diffuse.jpg", "Surfaces", "Tileable brick wall colour map.", ["brick", "wall"], 8),
    mk("hardwood", "texture", "Hardwood Floor", "/tex/hardwood2_diffuse.jpg", "Surfaces", "Warm hardwood planks, colour map.", ["wood", "floor"], 9),
    mk("grass-light", "texture", "Light Grass", "/tex/grasslight-big.jpg", "Nature & Plants", "Seamless grass ground cover.", ["grass", "ground"], 10),
  ],
});
let cache: DB | null = null;
function load(): DB {
  if (cache) return cache;
  try { cache = JSON.parse(fs.readFileSync(FILE, "utf8")); } catch { cache = seed(); save(); }
  return cache!;
}
function save() { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(cache, null, 2)); }
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

// users and sessions
export const findUser = (k: string) => load().users.find((u) => u.id === k || u.username.toLowerCase() === k.toLowerCase() || (u.email && u.email.toLowerCase() === k.toLowerCase()));
export function createUser(username: string, email: string, hash: string, salt: string) {
  const db = load(); const real = db.users.filter((u) => u.role !== "system").length;
  const u: User = { id: uid(), username, email, hash, salt, role: real === 0 ? "admin" : "user", bio: "", createdAt: Date.now() };
  db.users.push(u); save(); return u;
}
export function createSession(userId: string) {
  const db = load(); const token = uid() + uid() + uid(); db.sessions = db.sessions.filter((s) => s.expires > Date.now());
  db.sessions.push({ token, userId, expires: Date.now() + 30 * 864e5 }); save(); return token;
}
export const sessionUser = (token?: string) => { if (!token) return undefined; const s = load().sessions.find((x) => x.token === token && x.expires > Date.now()); return s ? findUser(s.userId) : undefined; };
export function endSession(token: string) { const db = load(); db.sessions = db.sessions.filter((s) => s.token !== token); save(); }
export function updateBio(id: string, bio: string) { const u = findUser(id); if (u) { u.bio = bio.slice(0, 300); save(); } }

// assets
const pub = (a: Asset, viewer?: string): PublicAsset => {
  const { likedBy, ...rest } = a;
  return { ...rest, likes: likedBy.length, liked: !!viewer && likedBy.includes(viewer), owner: findUser(a.ownerId)?.username ?? "unknown" };
};
export const listAssets = (viewer?: string) => load().assets.map((a) => pub(a, viewer)).sort((a, b) => b.createdAt - a.createdAt);
export const getAsset = (k: string) => load().assets.find((a) => a.id === k || a.slug === k);
export const publicAsset = (k: string, viewer?: string) => { const a = getAsset(k); return a ? pub(a, viewer) : undefined; };
export function createAsset(d: Pick<Asset, "type" | "title" | "file" | "ownerId" | "category" | "license" | "tags" | "blurb">) {
  const db = load(); const base = d.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || d.type;
  let slug = base, n = 2; while (db.assets.some((a) => a.slug === slug)) slug = `${base}-${n++}`;
  const a: Asset = { ...d, id: slug, slug, views: 0, downloads: 0, likedBy: [], featured: false, createdAt: Date.now(), annotations: [] };
  db.assets.unshift(a); save(); return a;
}
export function updateAsset(id: string, p: Partial<Pick<Asset, "title" | "category" | "license" | "tags" | "blurb" | "featured">>) { const a = getAsset(id); if (!a) return null; Object.assign(a, p); save(); return a; }
export function deleteAsset(id: string) {
  const db = load(); const a = getAsset(id); if (!a) return null;
  db.assets = db.assets.filter((x) => x !== a); db.comments = db.comments.filter((c) => c.assetId !== a.id);
  if (a.file.startsWith("/api/files/")) fs.rmSync(path.join(DATA_DIR, "uploads", path.basename(a.file)), { force: true });
  save(); return a;
}
export function toggleLike(id: string, userId: string) {
  const a = getAsset(id); if (!a) return null;
  const on = a.likedBy.includes(userId); a.likedBy = on ? a.likedBy.filter((x) => x !== userId) : [...a.likedBy, userId]; save();
  return { likes: a.likedBy.length, liked: !on };
}
export function bump(id: string, k: "views" | "downloads") { const a = getAsset(id); if (a) { a[k]++; save(); } return a; }
export function addAnnotation(id: string, n: Annotation) { const a = getAsset(id); if (!a) return null; a.annotations.push(n); save(); return n; }

// comments
export const listComments = (assetId: string): PublicComment[] => load().comments.filter((c) => c.assetId === assetId).sort((a, b) => b.createdAt - a.createdAt).map((c) => ({ ...c, username: findUser(c.userId)?.username ?? "unknown" }));
export function addComment(assetId: string, userId: string, text: string) { const c: Comment = { id: uid(), assetId, userId, text, createdAt: Date.now() }; load().comments.push(c); save(); return { ...c, username: findUser(userId)?.username ?? "unknown" }; }
export const getComment = (id: string) => load().comments.find((c) => c.id === id);
export function deleteComment(id: string) { const db = load(); db.comments = db.comments.filter((c) => c.id !== id); save(); }

export function stats() {
  const db = load();
  return { assets: db.assets.length, creators: db.users.filter((u) => u.role !== "system").length, downloads: db.assets.reduce((s, a) => s + a.downloads, 0), likes: db.assets.reduce((s, a) => s + a.likedBy.length, 0) };
}
