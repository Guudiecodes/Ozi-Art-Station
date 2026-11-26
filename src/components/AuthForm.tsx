"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AuthForm({ mode, next, needsKey }: { mode: "login" | "setup"; next: string; needsKey: boolean }) {
  const r = useRouter(), [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setBusy(true); setErr("");
    const res = await fetch(`/api/auth/${mode}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(new FormData(e.currentTarget))) });
    const j = await res.json().catch(() => ({}));
    if (res.ok) { r.push(next); r.refresh(); } else { setErr(j.error || "Could not sign in."); setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="form">
      <input name="email" type="email" placeholder="Owner email" autoComplete="username" required />
      <input name="password" type="password" placeholder={mode === "setup" ? "Choose a password (10+ characters)" : "Password"} autoComplete={mode === "setup" ? "new-password" : "current-password"} minLength={mode === "setup" ? 10 : undefined} required />
      {mode === "setup" && needsKey && <input name="key" type="password" placeholder="Setup key from the server settings" required />}
      {err && <p className="err" role="alert">{err}</p>}
      <button className="btn" disabled={busy}>{busy ? "Please wait..." : mode === "setup" ? "Create owner account" : "Log in"}</button>
    </form>
  );
}
