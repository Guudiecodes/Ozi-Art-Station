import crypto from "crypto";
import { cookies } from "next/headers";
import { sessionUser, type User } from "./db";

export const COOKIE = "mh_session";
export const hashPw = (pw: string, salt = crypto.randomBytes(16).toString("hex")) => ({ salt, hash: crypto.scryptSync(pw, salt, 64).toString("hex") });
export const checkPw = (pw: string, u: User) => !!u.hash && crypto.timingSafeEqual(Buffer.from(hashPw(pw, u.salt).hash, "hex"), Buffer.from(u.hash, "hex"));
export async function currentUser() { return sessionUser((await cookies()).get(COOKIE)?.value); }
export type Me = { id: string; username: string; role: User["role"] } | null;
export const toMe = (u?: User): Me => (u ? { id: u.id, username: u.username, role: u.role } : null);
export const canEdit = (u: User | undefined, ownerId: string) => !!u && (u.role === "admin" || u.id === ownerId);
