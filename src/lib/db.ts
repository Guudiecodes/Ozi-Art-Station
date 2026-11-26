// File-backed store (data/db.json). Every read/write goes through this file, so moving to Postgres later means rewriting only this module.
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { CATEGORIES, LICENSES } from "./lists";
import { dec, enc, hint } from "./secret";
export { CATEGORIES, LICENSES };

export type AssetType = "model" | "hdri" | "texture";
export type Gateway = "paystack" | "flutterwave";
export type Annotation = { id: string; pos: [number, number, number]; text: string };
export type User = { id: string; username: string; email: string; hash: string; salt: string; role: "admin" | "user" | "system"; bio: string; createdAt: number };
export type Asset = {
  id: string; slug: string; type: AssetType; title: string;
  file: string;       // the original. "private:NAME" is only served to paying customers and the owner. Anything else is a public path.
  preview: string;    // what the viewer and cards load. Always public.
  protectedPreview: boolean; // true when preview is a reduced copy of a private original
  ownerId: string; category: string; license: string; tags: string[]; blurb: string;
  views: number; downloads: number; sales: number; likedBy: string[]; featured: boolean; status: "published" | "draft";
  price: number; currency: string; size: number; createdAt: number; annotations: Annotation[];
};
export type Order = {
  id: string; token: string; assetId: string; assetTitle: string; email: string; amount: number; currency: string;
  gateway: Gateway | "manual"; reference: string; status: "pending" | "paid" | "failed" | "refunded";
  downloads: number; createdAt: number; paidAt?: number; note?: string;
};
export type Ev = { t: number; type: string; text: string };
export type Character = { id: string; name: string; file: string; scale: number; y: number; enabled: boolean; builtin?: boolean; note?: string };
export type Settings = {
  siteName: string; tagline: string; heroTitle: string; heroText: string; supportEmail: string; siteUrl: string; currency: string;
  maxDownloads: number; footerNote: string; heroCharacter: string; showSwitcher: boolean; autoSwitch: boolean; switchSeconds: number; characters: Character[];
  legal: { terms: string; privacy: string; refunds: string };
  payments: {
    default: Gateway;
    paystack: { enabled: boolean; publicKey: string; secretKey: string; webhookSecret: string };
    flutterwave: { enabled: boolean; publicKey: string; secretKey: string; secretHash: string };
  };
  email: { resendKey: string; from: string };
};
export type PublicAsset = Omit<Asset, "likedBy" | "file" | "ownerId"> & { likes: number; liked: boolean; owner: string; free: boolean };
type Day = { views: number; downloads: number; orders: number };
type DB = { users: User[]; sessions: { token: string; userId: string; expires: number }[]; assets: Asset[]; orders: Order[]; events: Ev[]; daily: Record<string, Day>; settings: Settings };

export const OWNER_EMAIL = () => (process.env.OWNER_EMAIL || "jokesonyou146@gmail.com").trim().toLowerCase();
export const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "db.json");
export const UPLOADS = path.join(DATA_DIR, "uploads");   // public previews, hero characters
export const PRIVATE = path.join(DATA_DIR, "private");   // originals that are for sale

const SECRETS = ["payments.paystack.secretKey", "payments.paystack.webhookSecret", "payments.flutterwave.secretKey", "payments.flutterwave.secretHash", "email.resendKey"];
const getPath = (o: any, p: string) => p.split(".").reduce((x, k) => (x == null ? x : x[k]), o);
const setPath = (o: any, p: string, v: unknown) => { const ks = p.split("."); const last = ks.pop()!; const t = ks.reduce((x, k) => (x[k] ??= {}), o); t[last] = v; };
const merge = (b: any, o: any): any => {
  if (o === undefined || o === null) return b;
  if (Array.isArray(b) || typeof b !== "object" || b === null) return o;
  const r = { ...b }; for (const k of Object.keys(o)) r[k] = merge(b[k], o[k]); return r;
};

const defaultSettings = (): Settings => ({
  siteName: "Arzzet", tagline: "3D models, HDRIs and textures",
  heroTitle: "3D you can inspect before you buy.",
  heroText: "Rotate, relight and zoom every asset in your browser. Download free files instantly, or buy the full quality file in a minute.",
  supportEmail: "", siteUrl: "", currency: "NGN", maxDownloads: 10, footerNote: "", heroCharacter: "woman", showSwitcher: true, autoSwitch: true, switchSeconds: 9,
  legal: { terms: "", privacy: "", refunds: "" },
  characters: [
    { id: "woman", name: "Michelle", file: "/characters/Michelle.glb", scale: 1, y: 0, enabled: true, builtin: true, note: "Woman" },
    { id: "man", name: "Alex", file: "/characters/Man.glb", scale: 1, y: 0, enabled: true, builtin: true, note: "Man" },
    { id: "soldier", name: "Soldier", file: "/characters/Soldier.glb", scale: 0.92, y: 0, enabled: true, builtin: true, note: "Soldier" },
  ],
  payments: {
    default: "paystack",
    paystack: { enabled: false, publicKey: "", secretKey: "", webhookSecret: "" },
    flutterwave: { enabled: false, publicKey: "", secretKey: "", secretHash: "" },
  },
  email: { resendKey: "", from: "" },
});

const mk = (slug: string, type: AssetType, title: string, file: string, category: string, blurb: string, tags: string[], i: number, featured = false): Asset => ({
  id: slug, slug, type, title, file, preview: file, protectedPreview: false, ownerId: "system", category, license: "Sample asset, replace with client content", tags, blurb,
  views: 0, downloads: 0, sales: 0, likedBy: [], featured, status: "published", price: 0, currency: "NGN", size: 0, createdAt: Date.now() - i * 1000, annotations: [],
});
const seed = (): DB => ({
  users: [{ id: "system", username: "modelhub", email: "", hash: "", salt: "", role: "system", bio: "Sample content published by the platform.", createdAt: Date.now() }],
  sessions: [], orders: [], events: [], daily: {}, settings: defaultSettings(),
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

// The cache lives on globalThis so every route bundle (and dev hot reload) sees the same data.
const G = globalThis as unknown as { __mh?: { db: DB | null; timer: NodeJS.Timeout | null } };
const S = (G.__mh ??= { db: null, timer: null });

function migrate(db: any): DB {
  db.users ||= []; db.sessions ||= []; db.assets ||= []; db.orders ||= []; db.events ||= []; db.daily ||= {};
  db.settings = merge(defaultSettings(), db.settings || {});
  if (db.settings.siteName === "ModelHub") db.settings.siteName = "Arzzet";
  delete db.comments;
  const owner = OWNER_EMAIL();
  // Public accounts are closed: only the owner email keeps a usable account.
  for (const u of db.users as User[]) if (u.role !== "system") u.role = u.email && u.email.toLowerCase() === owner ? "admin" : "user";
  const ok = new Set((db.users as User[]).filter((u) => u.role === "admin").map((u) => u.id));
  db.sessions = db.sessions.filter((s: any) => ok.has(s.userId) && s.expires > Date.now());
  for (const a of db.assets as Asset[]) {
    a.price ??= 0; a.currency ||= db.settings.currency; a.status ||= "published"; a.preview ||= a.file; a.sales ??= 0; a.size ??= 0;
    a.protectedPreview ??= false; a.likedBy ||= []; a.annotations ||= []; a.views ??= 0; a.downloads ??= 0;
  }
  return db as DB;
}
function load(): DB {
  if (S.db) return S.db;
  try { S.db = migrate(JSON.parse(fs.readFileSync(FILE, "utf8"))); } catch { S.db = migrate(seed()); }
  save(); return S.db!;
}
function save() {
  if (S.timer) { clearTimeout(S.timer); S.timer = null; }
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = FILE + ".tmp"; fs.writeFileSync(tmp, JSON.stringify(S.db, null, 2)); fs.renameSync(tmp, FILE);
}
const saveSoon = () => { if (!S.timer) S.timer = setTimeout(() => { S.timer = null; save(); }, 400); };
const uid = () => crypto.randomBytes(6).toString("hex");
const today = () => new Date().toISOString().slice(0, 10);
function daily(k: keyof Day) { const db = load(); const d = (db.daily[today()] ??= { views: 0, downloads: 0, orders: 0 }); d[k]++; }

// activity log
export function log(type: string, text: string) { const db = load(); db.events.push({ t: Date.now(), type, text }); if (db.events.length > 1500) db.events.splice(0, db.events.length - 1500); saveSoon(); }
export const recentEvents = (n = 20) => load().events.slice(-n).reverse();

// users and sessions
export const findUser = (k: string) => load().users.find((u) => u.id === k || u.username.toLowerCase() === k.toLowerCase() || (u.email && u.email.toLowerCase() === k.toLowerCase()));
export const ownerUser = () => load().users.find((u) => u.role === "admin");
export const ownerHasPassword = () => !!ownerUser()?.hash;
export function setOwnerPassword(hash: string, salt: string) {
  const db = load(); let u = db.users.find((x) => x.email.toLowerCase() === OWNER_EMAIL());
  if (u) { u.hash = hash; u.salt = salt; u.role = "admin"; }
  else { u = { id: uid(), username: "owner", email: OWNER_EMAIL(), hash, salt, role: "admin", bio: "", createdAt: Date.now() }; db.users.push(u); }
  db.sessions = db.sessions.filter((s) => s.userId === u!.id); save(); return u;
}
export function createSession(userId: string) {
  const db = load(); const token = crypto.randomBytes(24).toString("hex"); db.sessions = db.sessions.filter((s) => s.expires > Date.now());
  db.sessions.push({ token, userId, expires: Date.now() + 30 * 864e5 }); save(); return token;
}
export const sessionUser = (token?: string) => { if (!token) return undefined; const s = load().sessions.find((x) => x.token === token && x.expires > Date.now()); const u = s ? findUser(s.userId) : undefined; return u?.role === "admin" ? u : undefined; };
export function endSession(token: string) { const db = load(); db.sessions = db.sessions.filter((s) => s.token !== token); save(); }

// settings
const decrypted = (s: Settings): Settings => { const c = JSON.parse(JSON.stringify(s)); for (const p of SECRETS) setPath(c, p, dec(getPath(c, p))); return c; };
export const getSettings = () => decrypted(load().settings);
export function publicSettings() {
  const s = getSettings();
  return { legal: s.legal, siteUrl: s.siteUrl, siteName: s.siteName, tagline: s.tagline, heroTitle: s.heroTitle, heroText: s.heroText, supportEmail: s.supportEmail, currency: s.currency, footerNote: s.footerNote, heroCharacter: s.heroCharacter, showSwitcher: s.showSwitcher, autoSwitch: s.autoSwitch, switchSeconds: s.switchSeconds, characters: s.characters.filter((c) => c.enabled),
    gateways: (["paystack", "flutterwave"] as Gateway[]).filter((g) => s.payments[g].enabled && !!s.payments[g].secretKey), defaultGateway: s.payments.default };
}
export function adminSettings() {
  const c: any = getSettings();
  for (const p of SECRETS) { const v = getPath(c, p); setPath(c, p, { set: !!v, hint: hint(v) }); }
  return c;
}
// A blank secret keeps the saved one. "__clear__" removes it.
export function updateSettings(patch: any) {
  const db = load();
  for (const p of SECRETS) {
    const v = getPath(patch, p);
    if (v === undefined || v === "") { const ks = p.split("."); const last = ks.pop()!; const t = ks.reduce((x: any, k) => x?.[k], patch); if (t) delete t[last]; }
    else setPath(patch, p, v === "__clear__" ? "" : enc(String(v).trim()));
  }
  db.settings = merge(db.settings, patch); save(); return db.settings;
}

// assets
const pub = (a: Asset, viewer?: string): PublicAsset => {
  const { likedBy, file: _f, ownerId, ...rest } = a;
  return { ...rest, likes: likedBy.length, liked: !!viewer && likedBy.includes(viewer), owner: findUser(ownerId)?.username ?? "modelhub", free: a.price <= 0 };
};
export const listAssets = (viewer?: string, drafts = false) => load().assets.filter((a) => drafts || a.status === "published").map((a) => pub(a, viewer)).sort((a, b) => b.createdAt - a.createdAt);
export const getAsset = (k: string) => load().assets.find((a) => a.id === k || a.slug === k);
export const publicAsset = (k: string, viewer?: string, drafts = false) => { const a = getAsset(k); return a && (drafts || a.status === "published") ? pub(a, viewer) : undefined; };
type NewAsset = Pick<Asset, "type" | "title" | "file" | "preview" | "protectedPreview" | "ownerId" | "category" | "license" | "tags" | "blurb" | "price" | "currency" | "status" | "size">;
export function createAsset(d: NewAsset) {
  const db = load(); const base = d.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || d.type;
  let slug = base, n = 2; while (db.assets.some((a) => a.slug === slug)) slug = `${base}-${n++}`;
  const a: Asset = { ...d, id: slug, slug, views: 0, downloads: 0, sales: 0, likedBy: [], featured: false, createdAt: Date.now(), annotations: [] };
  db.assets.unshift(a); save(); return a;
}
export function updateAsset(id: string, p: Partial<Pick<Asset, "title" | "category" | "license" | "tags" | "blurb" | "featured" | "status" | "price" | "currency" | "preview" | "protectedPreview">>) { const a = getAsset(id); if (!a) return null; Object.assign(a, p); save(); return a; }
const rmFile = (ref: string) => {
  if (ref.startsWith("private:")) fs.rmSync(path.join(PRIVATE, path.basename(ref.slice(8))), { force: true });
  else if (ref.startsWith("/api/files/")) fs.rmSync(path.join(UPLOADS, path.basename(ref)), { force: true });
};
export function deleteAsset(id: string) {
  const db = load(); const a = getAsset(id); if (!a) return null;
  db.assets = db.assets.filter((x) => x !== a); rmFile(a.file); if (a.preview !== a.file) rmFile(a.preview);
  save(); return a;
}
export function toggleLike(id: string, viewer: string) {
  const a = getAsset(id); if (!a) return null;
  const on = a.likedBy.includes(viewer); a.likedBy = on ? a.likedBy.filter((x) => x !== viewer) : [...a.likedBy, viewer]; saveSoon();
  return { likes: a.likedBy.length, liked: !on };
}
export function bump(id: string, k: "views" | "downloads") { const a = getAsset(id); if (a) { a[k]++; daily(k); saveSoon(); } return a; }
export function addAnnotation(id: string, n: Annotation) { const a = getAsset(id); if (!a) return null; a.annotations.push(n); save(); return n; }
export function removeAnnotation(id: string, nid: string) { const a = getAsset(id); if (!a) return false; a.annotations = a.annotations.filter((x) => x.id !== nid); save(); return true; }

// orders
export function createOrder(d: Pick<Order, "assetId" | "assetTitle" | "email" | "amount" | "currency" | "gateway"> & Partial<Pick<Order, "status" | "note">>) {
  const db = load();
  const o: Order = { id: uid(), token: crypto.randomBytes(24).toString("hex"), reference: `MH-${Date.now().toString(36)}-${crypto.randomBytes(3).toString("hex")}`, status: "pending", downloads: 0, createdAt: Date.now(), ...d };
  if (o.status === "paid") o.paidAt = Date.now();
  db.orders.unshift(o); save(); return o;
}
export const listOrders = () => load().orders;
export const getOrder = (id: string) => load().orders.find((o) => o.id === id);
export const orderByToken = (t: string) => (t ? load().orders.find((o) => o.token === t) : undefined);
export const orderByRef = (r: string) => (r ? load().orders.find((o) => o.reference === r) : undefined);
export function setOrder(id: string, p: Partial<Pick<Order, "status" | "note" | "downloads">>) { const o = getOrder(id); if (!o) return null; Object.assign(o, p); save(); return o; }
export function markPaid(o: Order) {
  if (o.status === "paid") return false;
  o.status = "paid"; o.paidAt = Date.now(); const a = getAsset(o.assetId); if (a) a.sales++; daily("orders");
  log("order", `Paid: ${o.assetTitle} (${o.currency} ${o.amount}) by ${o.email}`); save(); return true;
}

export function stats() {
  const all = load().assets.filter((a) => a.status === "published");
  return { assets: all.length, models: all.filter((a) => a.type === "model").length, hdris: all.filter((a) => a.type === "hdri").length, textures: all.filter((a) => a.type === "texture").length, downloads: all.reduce((s, a) => s + a.downloads, 0), likes: all.reduce((s, a) => s + a.likedBy.length, 0) };
}
export function adminStats() {
  const db = load(); const paid = db.orders.filter((o) => o.status === "paid"); const revenue: Record<string, number> = {};
  for (const o of paid) revenue[o.currency] = (revenue[o.currency] || 0) + o.amount;
  const days = Array.from({ length: 14 }, (_, i) => { const d = new Date(Date.now() - (13 - i) * 864e5).toISOString().slice(0, 10); return { date: d, ...(db.daily[d] ?? { views: 0, downloads: 0, orders: 0 }) }; });
  return { revenue, paid: paid.length, pending: db.orders.filter((o) => o.status === "pending").length, assets: db.assets.length, drafts: db.assets.filter((a) => a.status === "draft").length,
    views: db.assets.reduce((s, a) => s + a.views, 0), downloads: db.assets.reduce((s, a) => s + a.downloads, 0), likes: db.assets.reduce((s, a) => s + a.likedBy.length, 0), days };
}
