// Encrypts payment keys and the like before they are written to data/db.json (AES-256-GCM).
// The key comes from APP_SECRET, or from data/.secret which is created on first run.
import crypto from "crypto";
import fs from "fs";
import path from "path";

const DIR = path.join(process.cwd(), "data");
let key: Buffer | null = null;
function getKey() {
  if (key) return key;
  const env = process.env.APP_SECRET;
  if (env) return (key = crypto.createHash("sha256").update(env).digest());
  const f = path.join(DIR, ".secret");
  try { key = Buffer.from(fs.readFileSync(f, "utf8").trim(), "hex"); } catch {
    fs.mkdirSync(DIR, { recursive: true });
    key = crypto.randomBytes(32); fs.writeFileSync(f, key.toString("hex"), { mode: 0o600 });
  }
  return key;
}
export const isEnc = (v: unknown): v is string => typeof v === "string" && v.startsWith("enc:1:");
export function enc(plain: string) {
  if (!plain) return "";
  const iv = crypto.randomBytes(12), c = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const body = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return `enc:1:${iv.toString("hex")}:${c.getAuthTag().toString("hex")}:${body.toString("hex")}`;
}
export function dec(v: string) {
  if (!isEnc(v)) return v || "";
  try {
    const [, , iv, tag, body] = v.split(":");
    const d = crypto.createDecipheriv("aes-256-gcm", getKey(), Buffer.from(iv, "hex")); d.setAuthTag(Buffer.from(tag, "hex"));
    return Buffer.concat([d.update(Buffer.from(body, "hex")), d.final()]).toString("utf8");
  } catch { return ""; }
}
export const hint = (plain: string) => (plain ? `${plain.slice(0, 7)}••••${plain.slice(-4)}` : "");
