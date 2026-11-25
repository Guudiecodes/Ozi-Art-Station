"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
export default function AuthForm({ mode }: { mode: "login" | "register" }) {
  const r = useRouter(), next = useSearchParams().get("next") || "/", [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  const reg = mode === "register";
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setBusy(true); setErr("");
    const res = await fetch(`/api/auth/${mode}`, { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(e.currentTarget))) });
    if (res.ok) { r.push(next); r.refresh(); } else { setErr((await res.json()).error || "Something went wrong."); setBusy(false); }
  };
  return (
    <main className="wrap narrow authbox">
      <h1 className="title">{reg ? "Create your account" : "Log in"}</h1>
      <p className="lead">{reg ? "Upload models, HDRIs and textures, and like and comment on other people's work." : "Welcome back."}</p>
      <form onSubmit={submit} className="form">
        {reg ? (<><input name="username" placeholder="Username" autoComplete="username" required /><input name="email" type="email" placeholder="Email" autoComplete="email" required /></>) : <input name="login" placeholder="Username or email" autoComplete="username" required />}
        <input name="password" type="password" placeholder={reg ? "Password, 8 characters or more" : "Password"} autoComplete={reg ? "new-password" : "current-password"} required />
        {err && <p className="err">{err}</p>}
        <button className="btn" disabled={busy}>{busy ? "One moment" : reg ? "Create account" : "Log in"}</button>
      </form>
      <p className="mutedp">{reg ? <>Already registered? <Link href="/login">Log in</Link></> : <>New here? <Link href="/register">Create an account</Link></>}</p>
    </main>
  );
}
