import path from "path";
// Where Arzzet keeps its data. On your own PC or a server with a disk it is the `data` folder.
// On Vercel the disk is read-only and wiped between requests, so a database (Neon) and file storage (Cloudflare R2) must be connected.
export const ON_VERCEL = !!process.env.VERCEL;
export const DB_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.NEON_DATABASE_URL || "";
export const DATA_DIR = ON_VERCEL ? "/tmp/arzzet-data" : path.join(process.cwd(), "data");
export const r2 = () => {
  const e = process.env, account = e.R2_ACCOUNT_ID, accessKeyId = e.R2_ACCESS_KEY_ID, secretAccessKey = e.R2_SECRET_ACCESS_KEY, bucket = e.R2_BUCKET;
  return account && accessKeyId && secretAccessKey && bucket ? { endpoint: e.R2_ENDPOINT || `https://${account}.r2.cloudflarestorage.com`, accessKeyId, secretAccessKey, bucket } : null;
};
// Vercel Blob: created from the Storage tab in Vercel, no card needed. Adds BLOB_READ_WRITE_TOKEN to the project.
export const BLOB = !!process.env.BLOB_READ_WRITE_TOKEN && !r2();
// SECRET_KEY is accepted as a shorter name for APP_SECRET and SETUP_KEY.
export const APP_SECRET = process.env.APP_SECRET || process.env.SECRET_KEY || "";
export const SETUP_KEY = process.env.SETUP_KEY || process.env.SECRET_KEY || "";
// What is actually persistent right now. Shown in the admin panel so a half-connected deploy is never a surprise.
export const storageMode = () => ({ db: DB_URL ? "neon" : ON_VERCEL ? "temporary" : "disk", files: r2() ? "r2" : BLOB ? "blob" : ON_VERCEL ? "temporary" : "disk" }) as { db: "neon" | "temporary" | "disk"; files: "r2" | "blob" | "temporary" | "disk" };
