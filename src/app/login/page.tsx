import { SETUP_KEY } from "@/lib/env";
import { redirect } from "next/navigation";
import AuthForm from "@/components/AuthForm";
import { currentUser } from "@/lib/auth";
import { ownerHasPassword, ready } from "@/lib/db";
export const dynamic = "force-dynamic";
export const metadata = { title: "Owner login", robots: { index: false } };

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string }> }) { await ready();
  const sp = await searchParams, next = sp.next && sp.next.startsWith("/") && !sp.next.startsWith("//") ? sp.next : "/admin";
  if (await currentUser()) redirect(next);
  const setup = !ownerHasPassword();
  return (
    <main className="wrap narrow authbox">
      <h1 className="title">{setup ? "Set up the owner account" : "Owner login"}</h1>
      <p className="lead">{setup ? "First run. Enter the owner email and choose a password. Only this email can ever sign in." : "This site has one account, for the owner."}</p>
      <AuthForm mode={setup ? "setup" : "login"} next={next} needsKey={!!SETUP_KEY || process.env.NODE_ENV === "production"} />
    </main>
  );
}
