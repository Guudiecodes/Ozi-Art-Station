import { redirect } from "next/navigation";
import { AdminNav } from "@/components/AdminForms";
import { currentUser } from "@/lib/auth";
export const dynamic = "force-dynamic";
export const metadata = { title: "Admin", robots: { index: false } };
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await currentUser())) redirect("/login?next=/admin");
  return <div className="admin"><aside><AdminNav /></aside><main className="amain">{children}</main></div>;
}
