import { redirect } from "next/navigation";
import { AdminNav } from "@/components/AdminForms";
import { currentUser } from "@/lib/auth";
import { storageMode } from "@/lib/env";
import { ready } from "@/lib/db";
export const dynamic = "force-dynamic";
export const metadata = { title: "Admin", robots: { index: false } };
export default async function AdminLayout({ children }: { children: React.ReactNode }) { await ready();
  const sm = storageMode();
  if (!(await currentUser())) redirect("/login?next=/admin");
  return <div className="admin"><aside><AdminNav /></aside><main className="amain">
    {(sm.db === "temporary" || sm.files === "temporary") && <div className="warnbox" role="alert"><strong>Nothing you do here is saved permanently yet.</strong> This site is running on Vercel without {sm.db === "temporary" ? "a database" : ""}{sm.db === "temporary" && sm.files === "temporary" ? " or " : ""}{sm.files === "temporary" ? "file storage" : ""}, so changes disappear within hours. Connect Neon and Vercel Blob (or Cloudflare R2) using docs/VERCEL.md, then redeploy.</div>}
    {children}</main></div>;
}
