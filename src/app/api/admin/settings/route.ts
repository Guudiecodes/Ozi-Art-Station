import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { adminSettings, getSettings, log, updateSettings, type Character } from "@/lib/db";
import { CURRENCIES } from "@/lib/lists";

const str = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
const num = (v: unknown, lo: number, hi: number, d: number) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };

export async function GET() {
  if (!(await currentUser())) return NextResponse.json({ error: "Owner only" }, { status: 401 });
  return NextResponse.json(adminSettings());
}
// Accepts only the fields below, so a request can never add arbitrary file paths or flags.
export async function PATCH(req: Request) {
  if (!(await currentUser())) return NextResponse.json({ error: "Owner only" }, { status: 401 });
  const b = await req.json().catch(() => ({})), cur = getSettings(), p: any = {}, what: string[] = [];
  for (const [k, max] of [["siteName", 60], ["tagline", 120], ["heroTitle", 120], ["heroText", 300], ["supportEmail", 120], ["footerNote", 200]] as const) if (typeof b[k] === "string") { p[k] = str(b[k], max); what.push(k); }
  if (typeof b.siteUrl === "string") { const s = str(b.siteUrl, 200).replace(/\/$/, ""); if (s && !/^https?:\/\/[^\s]+$/.test(s)) return NextResponse.json({ error: "Site URL must start with http:// or https://" }, { status: 400 }); p.siteUrl = s; }
  if (CURRENCIES.includes(b.currency)) p.currency = b.currency;
  if (b.maxDownloads !== undefined) p.maxDownloads = Math.round(num(b.maxDownloads, 1, 1000, cur.maxDownloads));
  if (typeof b.showSwitcher === "boolean") p.showSwitcher = b.showSwitcher;
  if (typeof b.autoSwitch === "boolean") p.autoSwitch = b.autoSwitch;
  if (b.switchSeconds !== undefined) p.switchSeconds = Math.round(num(b.switchSeconds, 4, 60, cur.switchSeconds));
  if (b.legal && typeof b.legal === "object") { p.legal = {}; for (const k of ["terms", "privacy", "refunds"]) if (typeof b.legal[k] === "string") p.legal[k] = String(b.legal[k]).slice(0, 20000); what.push("legal"); }
  if (Array.isArray(b.characters)) {
    const by = new Map(cur.characters.map((c) => [c.id, c])), out: Character[] = [], used = new Set<string>();
    for (const c of b.characters) { const o = by.get(c?.id); if (!o) continue; used.add(o.id); out.push({ ...o, name: str(c.name, 40) || o.name, scale: num(c.scale, 0.3, 3, o.scale), y: num(c.y, -1, 1, o.y), enabled: !!c.enabled }); }
    for (const o of cur.characters) if (!used.has(o.id)) out.push(o);
    p.characters = out; what.push("characters");
    if (!out.some((c) => c.enabled)) return NextResponse.json({ error: "Keep at least one character enabled." }, { status: 400 });
  }
  if (typeof b.heroCharacter === "string" && cur.characters.some((c) => c.id === b.heroCharacter)) p.heroCharacter = b.heroCharacter;
  if (b.payments) {
    const pm: any = (p.payments = {}), i = b.payments;
    if (i.default === "paystack" || i.default === "flutterwave") pm.default = i.default;
    for (const [g, fields] of [["paystack", ["publicKey", "secretKey", "webhookSecret"]], ["flutterwave", ["publicKey", "secretKey", "secretHash"]]] as const) {
      if (!i[g]) continue; pm[g] = {};
      if (typeof i[g].enabled === "boolean") pm[g].enabled = i[g].enabled;
      for (const f of fields) if (typeof i[g][f] === "string") pm[g][f] = str(i[g][f], 200);
    }
    what.push("payments");
  }
  if (b.email) { p.email = {}; if (typeof b.email.from === "string") p.email.from = str(b.email.from, 160); if (typeof b.email.resendKey === "string") p.email.resendKey = str(b.email.resendKey, 200); what.push("email"); }
  updateSettings(p); log("settings", `Changed settings: ${what.join(", ") || "none"}`);
  return NextResponse.json(adminSettings());
}
