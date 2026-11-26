import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE, checkPw, currentUser, hashPw, ipOf, limited } from "@/lib/auth";
import { OWNER_EMAIL, createSession, endSession, findUser, log, ownerHasPassword, setOwnerPassword } from "@/lib/db";
import { baseUrl } from "@/lib/pay";

const err = (m: string, s = 400) => NextResponse.json({ error: m }, { status: s });
export async function POST(req: Request, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params, jar = await cookies();
  if (action === "logout") { const t = jar.get(COOKIE)?.value; if (t) endSession(t); jar.delete(COOKIE); return NextResponse.json({ ok: true }); }
  const b = await req.json().catch(() => ({}));
  const start = () => {
    const u = findUser(OWNER_EMAIL())!;
    jar.set(COOKIE, createSession(u.id), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 30 * 86400, secure: baseUrl(req).startsWith("https") });
    log("login", "Owner signed in");
  };

  if (action === "login") {
    if (limited(`login:${ipOf(req)}`, 8, 10 * 60e3)) return err("Too many attempts. Wait ten minutes and try again.", 429);
    const email = String(b.email || "").trim().toLowerCase(), u = email === OWNER_EMAIL() ? findUser(email) : undefined;
    if (!u || !checkPw(String(b.password || ""), u)) return err("Wrong email or password.", 401);
    start(); return NextResponse.json({ ok: true });
  }
  if (action === "setup") { // first run only: the owner email chooses a password
    if (ownerHasPassword()) return err("The owner account is already set up. Log in instead.", 409);
    if (limited(`setup:${ipOf(req)}`, 8, 10 * 60e3)) return err("Too many attempts. Wait ten minutes and try again.", 429);
    const key = process.env.SETUP_KEY;
    if (process.env.NODE_ENV === "production" && !key) return err("Set SETUP_KEY in the server environment before creating the owner account.", 403);
    if (key && String(b.key || "") !== key) return err("The setup key is wrong.", 403);
    if (String(b.email || "").trim().toLowerCase() !== OWNER_EMAIL()) return err("Use the owner email address.", 403);
    const pw = String(b.password || ""); if (pw.length < 10) return err("Password must be at least 10 characters.");
    const { hash, salt } = hashPw(pw); setOwnerPassword(hash, salt); start(); return NextResponse.json({ ok: true });
  }
  if (action === "password") {
    const u = await currentUser(); if (!u) return err("Log in first.", 401);
    if (!checkPw(String(b.current || ""), u)) return err("Current password is wrong.", 403);
    const pw = String(b.next || ""); if (pw.length < 10) return err("New password must be at least 10 characters.");
    const { hash, salt } = hashPw(pw); setOwnerPassword(hash, salt); start(); log("settings", "Owner password changed");
    return NextResponse.json({ ok: true });
  }
  return err("Unknown action", 404);
}
