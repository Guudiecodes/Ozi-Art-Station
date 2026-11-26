"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import type { Me } from "@/lib/auth";

export function Header({ me, siteName }: { me: Me; siteName: string }) {
  const path = usePathname(), r = useRouter(), [q, setQ] = useState(""), [menu, setMenu] = useState(false);
  if (path.startsWith("/embed")) return null;
  const logout = async () => { await fetch("/api/auth/logout", { method: "POST" }); setMenu(false); r.push("/"); r.refresh(); };
  return (
    <header className="top">
      <Link href="/" className="logo"><span className="mark" />{siteName}</Link>
      <nav className="links" aria-label="Browse">
        <Link href="/explore?type=model">Models</Link><Link href="/explore?type=hdri">HDRIs</Link><Link href="/explore?type=texture">Textures</Link><Link href="/explore">Explore</Link>
      </nav>
      <form className="search" onSubmit={(e) => { e.preventDefault(); r.push(`/explore?q=${encodeURIComponent(q)}`); }}>
        <input aria-label="Search" placeholder="Search models, HDRIs, textures" value={q} onChange={(e) => setQ(e.target.value)} />
      </form>
      <div className="acct">
        {me && (<>
          <Link href="/admin/upload" className={`btnline sm ${path === "/admin/upload" ? "cur" : ""}`}>Upload</Link>
          <Link href="/admin" className={`btn sm ${path === "/admin" ? "cur" : ""}`}>Admin</Link>
          <button className="avatar" onClick={() => setMenu(!menu)} aria-label="Account menu" aria-expanded={menu}>{me.username[0].toUpperCase()}</button>
          {menu && <div className="menu" onClick={() => setMenu(false)}><Link href="/admin">Admin panel</Link><Link href="/admin/upload">Upload</Link><Link href="/admin/settings">Settings</Link><button onClick={logout}>Log out</button></div>}
        </>)}
      </div>
    </header>
  );
}
export function Footer({ siteName, note, email, owner }: { siteName: string; note: string; email: string; owner: boolean }) {
  const path = usePathname(); if (path.startsWith("/embed") || path.startsWith("/admin")) return null;
  const col = (t: string, l: [string, string][]) => <div><h4>{t}</h4>{l.map(([n, h]) => <Link key={n} href={h}>{n}</Link>)}</div>;
  return (
    <footer className="foot"><div className="wrap fgrid">
      <div><Link href="/" className="logo"><span className="mark" />{siteName}</Link><p>3D models, HDRIs and textures. Preview every asset in your browser, then download it free or buy the full file.</p></div>
      {col("Explore", [["Models", "/explore?type=model"], ["HDRIs", "/explore?type=hdri"], ["Textures", "/explore?type=texture"], ["Newest", "/explore"]])}
      {col("Account", owner ? [["Admin panel", "/admin"], ["Upload", "/admin/upload"]] : [["Owner login", "/login"]])}
      <div><h4>Licenses and support</h4><p>Every asset shows its license. CC0 assets are free for any use.</p><Link href="/legal/terms">Terms</Link><Link href="/legal/privacy">Privacy</Link><Link href="/legal/refunds">Refunds</Link>{email && <a href={`mailto:${email}`}>{email}</a>}</div>
    </div><div className="wrap legal">{note || "Sample assets come from the Khronos glTF and three.js example sets. Replace them in the admin panel."}</div></footer>
  );
}
