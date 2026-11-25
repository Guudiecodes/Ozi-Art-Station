"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { PublicAsset, PublicComment } from "@/lib/db";
import { CATEGORIES, LICENSES } from "@/lib/lists";
import type { Me } from "@/lib/auth";

export function ViewPing({ id }: { id: string }) { useEffect(() => { fetch(`/api/assets/${id}/view`, { method: "POST" }); }, [id]); return null; }

export function Actions({ a, me }: { a: PublicAsset; me: Me }) {
  const r = useRouter(), [likes, setLikes] = useState(a.likes), [liked, setLiked] = useState(a.liked), [msg, setMsg] = useState("");
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 1800); };
  const like = async () => { if (!me) return r.push(`/login?next=/a/${a.slug}`); const x = await fetch(`/api/assets/${a.id}/like`, { method: "POST" }); if (x.ok) { const j = await x.json(); setLikes(j.likes); setLiked(j.liked); } };
  const copy = (t: string, m: string) => navigator.clipboard.writeText(t).then(() => flash(m), () => flash("Copy failed"));
  const url = () => `${location.origin}/a/${a.slug}`;
  const embed = () => copy(`<iframe title="${a.title}" src="${location.origin}/embed/${a.slug}" width="640" height="400" allowfullscreen style="border:0"></iframe>`, "Embed code copied");
  return (
    <div className="actions">
      <button className={`like big ${liked ? "on" : ""}`} onClick={like} aria-pressed={liked}>♥ {likes}</button>
      <button className="btnline" onClick={() => copy(url(), "Link copied")}>Share link</button>
      <button className="btnline" onClick={embed}>Embed</button>
      <a className="btn sm" href={`/api/assets/${a.id}/download`} download>Download</a>
      {msg && <span className="flash" role="status">{msg}</span>}
    </div>
  );
}

export function Comments({ a, me, initial }: { a: PublicAsset; me: Me; initial: PublicComment[] }) {
  const [list, setList] = useState(initial), [text, setText] = useState(""), [err, setErr] = useState("");
  const post = async (e: React.FormEvent) => {
    e.preventDefault(); const x = await fetch(`/api/assets/${a.id}/comments`, { method: "POST", body: JSON.stringify({ text }) });
    const j = await x.json(); if (!x.ok) return setErr(j.error); setErr(""); setText(""); setList((s) => [j, ...s]);
  };
  const del = async (id: string) => { const x = await fetch(`/api/assets/${a.id}/comments?c=${id}`, { method: "DELETE" }); if (x.ok) setList((s) => s.filter((c) => c.id !== id)); };
  return (
    <section className="comments"><h2>Comments ({list.length})</h2>
      {me ? <form onSubmit={post} className="cform"><textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a comment" rows={2} maxLength={500} required /><button className="btn sm">Post</button></form>
        : <p className="mutedp"><Link href={`/login?next=/a/${a.slug}`}>Log in</Link> to comment.</p>}
      {err && <p className="err">{err}</p>}
      {list.length === 0 && <p className="mutedp">No comments yet. Be the first.</p>}
      {list.map((c) => (
        <div key={c.id} className="comment"><div><Link href={`/u/${c.username}`}><strong>{c.username}</strong></Link> <small>{new Date(c.createdAt).toLocaleDateString()}</small><p>{c.text}</p></div>
          {me && (me.role === "admin" || me.id === c.userId) && <button className="linkbtn" onClick={() => del(c.id)}>Delete</button>}</div>
      ))}
    </section>
  );
}

export function OwnerTools({ a, me }: { a: PublicAsset; me: Me }) {
  const r = useRouter(), [open, setOpen] = useState(false), [err, setErr] = useState("");
  if (!me) return null;
  const save = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const f = Object.fromEntries(new FormData(e.currentTarget));
    const x = await fetch(`/api/assets/${a.id}`, { method: "PATCH", body: JSON.stringify(f) }); if (!x.ok) return setErr((await x.json()).error); setOpen(false); r.refresh();
  };
  const del = async () => { if (!confirm(`Delete "${a.title}"? This cannot be undone.`)) return; const x = await fetch(`/api/assets/${a.id}`, { method: "DELETE" }); if (x.ok) { r.push(`/u/${me.username}`); r.refresh(); } };
  const feature = async () => { await fetch(`/api/assets/${a.id}`, { method: "PATCH", body: JSON.stringify({ featured: !a.featured }) }); r.refresh(); };
  return (
    <div className="owner"><div className="chips">
      <button onClick={() => setOpen(!open)}>{open ? "Close editor" : "Edit details"}</button>
      {me.role === "admin" && <button onClick={feature}>{a.featured ? "Remove from staff picks" : "Add to staff picks"}</button>}
      <button className="danger" onClick={del}>Delete</button></div>
      {open && (
        <form onSubmit={save} className="form">
          <input name="title" defaultValue={a.title} required /><textarea name="blurb" defaultValue={a.blurb} rows={3} placeholder="Description" />
          <select name="category" defaultValue={a.category}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
          <select name="license" defaultValue={LICENSES.includes(a.license) ? a.license : LICENSES[0]}>{LICENSES.map((c) => <option key={c}>{c}</option>)}</select>
          <input name="tags" defaultValue={a.tags.join(", ")} placeholder="Tags, separated by commas" />
          {err && <p className="err">{err}</p>}<button className="btn sm">Save changes</button>
        </form>)}
    </div>
  );
}
