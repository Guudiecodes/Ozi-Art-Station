import crypto from "crypto";
import { cookies } from "next/headers";
import { sessionUser, type User } from "./db";

export const COOKIE = "mh_session";
export const VID = "mh_vid"; // anonymous visitor id, used for likes
export const hashPw = (pw: string, salt = crypto.randomBytes(16).toString("hex")) => ({ salt, hash: crypto.scryptSync(pw, salt, 64).toString("hex") });
export const checkPw = (pw: string, u: User) => {
  if (!u.hash) return false;
  const a = Buffer.from(hashPw(pw, u.salt).hash, "hex"), b = Buffer.from(u.hash, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};
// Only the owner can hold a session, so a signed-in user is always the owner.
export async function currentUser() { return sessionUser((await cookies()).get(COOKIE)?.value); }
export const visitorId = async () => (await cookies()).get(VID)?.value;
export type Me = { id: string; username: string; role: User["role"] } | null;
export const toMe = (u?: User): Me => (u ? { id: u.id, username: u.username, role: u.role } : null);

// Small in-memory limiter for the login form and the payment endpoints.
const hits = new Map<string, number[]>();
export function limited(key: string, max: number, windowMs: number) {
  const now = Date.now(), list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  list.push(now); hits.set(key, list); return list.length > max;
}
export const ipOf = (req: Request) => (req.headers.get("x-forwarded-for") || "local").split(",")[0].trim();
