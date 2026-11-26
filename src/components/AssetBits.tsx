"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { money } from "@/lib/lists";

type A = { id: string; slug: string; free: boolean; price: number; currency: string; title: string; likes: number; liked: boolean };

// Counts one view per browser session.
export function ViewPing({ id }: { id: string }) {
  useEffect(() => { try { if (sessionStorage.getItem(`v:${id}`)) return; sessionStorage.setItem(`v:${id}`, "1"); } catch { /* storage blocked: count anyway */ } fetch(`/api/assets/${id}/view`, { method: "POST" }).catch(() => {}); }, [id]);
  return null;
}

const LABEL: Record<string, string> = { paystack: "Pay with Paystack", flutterwave: "Pay with Flutterwave" };
export function BuyBox({ a, gateways, owner }: { a: A; gateways: string[]; owner: boolean }) {
  const [open, setOpen] = useState(false), [email, setEmail] = useState(""), [busy, setBusy] = useState(""), [err, setErr] = useState("");
  useEffect(() => { if (!a.free && new URLSearchParams(location.search).get("buy")) setOpen(true); }, [a.free]);
  if (a.free) return <a className="btn" href={`/api/assets/${a.id}/download`}>Download free</a>;
  const pay = async (g: string) => {
    setErr(""); setBusy(g);
    const r = await fetch("/api/pay/init", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ asset: a.id, email, gateway: g }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok && j.url) location.href = j.url; else { setErr(j.error || "The payment could not start."); setBusy(""); }
  };
  return (
    <div className="buy">
      {!open ? <button className="btn" onClick={() => setOpen(true)} disabled={!gateways.length && !owner}>Buy for {money(a.price, a.currency)}</button> : (
        <form className="buyform" onSubmit={(e) => e.preventDefault()}>
          <label>Your email<input type="email" required placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus /></label>
          <p className="mutedp small">Your download link is tied to this email. {money(a.price, a.currency)} total. By paying you accept the <Link href="/legal/terms" target="_blank">terms</Link> and <Link href="/legal/refunds" target="_blank">refund policy</Link>.</p>
          <div className="row">{gateways.map((g) => <button key={g} className="btn" disabled={!!busy || !email} onClick={() => pay(g)}>{busy === g ? "Opening..." : LABEL[g]}</button>)}<button className="btnline" onClick={() => setOpen(false)}>Cancel</button></div>
        </form>
      )}
      {!gateways.length && <p className="mutedp small">{owner ? <>Checkout is off. <Link href="/admin/payments">Connect Paystack or Flutterwave</Link>.</> : "Checkout is not available right now. Please check back soon."}</p>}
      {err && <p className="err">{err}</p>}
    </div>
  );
}

export function LikeShare({ a }: { a: A }) {
  const [likes, setLikes] = useState(a.likes), [liked, setLiked] = useState(a.liked), [flash, setFlash] = useState("");
  const say = (m: string) => { setFlash(m); setTimeout(() => setFlash(""), 2200); };
  const like = async () => { const r = await fetch(`/api/assets/${a.id}/like`, { method: "POST" }); if (r.ok) { const j = await r.json(); setLikes(j.likes); setLiked(j.liked); } };
  const copy = async (t: string, m: string) => { try { await navigator.clipboard.writeText(t); say(m); } catch { window.prompt("Copy this:", t); } };
  const o = typeof location === "undefined" ? "" : location.origin;
  return (<>
    <button className={`like big ${liked ? "on" : ""}`} onClick={like} aria-pressed={liked}>{"♥"} {likes}</button>
    <button className="btnline" onClick={() => copy(`${o}/a/${a.slug}`, "Link copied")}>Copy link</button>
    <button className="btnline" onClick={() => copy(`<iframe src="${o}/embed/${a.slug}" title="${a.title.replace(/"/g, "")}" width="100%" height="520" style="border:0" allow="fullscreen"></iframe>`, "Embed code copied")}>Copy embed code</button>
    {flash && <span className="flash" role="status">{flash}</span>}
  </>);
}

// Shown on the order page while a payment is still being confirmed: re-checks with the gateway a few times.
export function OrderLive({ token, pending }: { token: string; pending: boolean }) {
  const r = useRouter(), [busy, setBusy] = useState(false);
  const check = async () => { setBusy(true); await fetch(`/api/orders/${token}/verify`, { method: "POST" }).catch(() => {}); setBusy(false); r.refresh(); };
  useEffect(() => { if (!pending) return; let n = 0; const id = setInterval(() => { if (++n > 10) return clearInterval(id); void check(); }, 4000); return () => clearInterval(id); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [pending]);
  return pending ? <button className="btnline" onClick={check} disabled={busy}>{busy ? "Checking..." : "Check payment again"}</button> : null;
}
