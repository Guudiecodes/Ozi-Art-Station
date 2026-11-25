import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE, checkPw, hashPw } from "@/lib/auth";
import { createSession, createUser, endSession, findUser } from "@/lib/db";

const err = (m: string, s = 400) => NextResponse.json({ error: m }, { status: s });
export async function POST(req: Request, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params; const jar = await cookies();
  if (action === "logout") { const t = jar.get(COOKIE)?.value; if (t) endSession(t); jar.delete(COOKIE); return NextResponse.json({ ok: true }); }
  const b = await req.json().catch(() => ({}));
  let user;
  if (action === "register") {
    const username = String(b.username || "").trim(), email = String(b.email || "").trim().toLowerCase(), pw = String(b.password || "");
    if (!/^[a-z0-9_]{3,20}$/i.test(username)) return err("Username must be 3 to 20 letters, numbers or underscores.");
    if (!/^\S+@\S+\.\S+$/.test(email)) return err("Enter a valid email address.");
    if (pw.length < 8) return err("Password must be at least 8 characters.");
    if (findUser(username) || findUser(email)) return err("That username or email is already registered.", 409);
    const { hash, salt } = hashPw(pw); user = createUser(username, email, hash, salt);
  } else if (action === "login") {
    const u = findUser(String(b.login || "").trim());
    if (!u || !checkPw(String(b.password || ""), u)) return err("Wrong username or password.", 401);
    user = u;
  } else return err("Unknown action", 404);
  jar.set(COOKIE, createSession(user.id), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 30 * 86400 });
  return NextResponse.json({ username: user.username });
}
