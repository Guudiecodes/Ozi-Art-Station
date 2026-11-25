"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import type { Me } from "@/lib/auth";

export function Header({ me }: { me: Me }) {
  const path = usePathname(), r = useRouter(), [q, setQ] = useState(""), [menu, setMenu] = useState(false);
  if (path.startsWith("/embed")) return null;
  const logout = async () => { await fetch("/api/auth/logout", { method: "POST" }); setMenu(false); r.push("/"); r.refresh(); };
  return (
    <header className="top">
      <Link href="/" className="logo"><span className="mark" />ModelHub</Link>
      <nav className="links" aria-label="Browse">
        <Link href="/explore?type=model">Models</Link><Link href="/explore?type=hdri">HDRIs</Link><Link href="/explore?type=texture">Textures</Link><Link href="/explore">Explore</Link>
      </nav>
      <form className="search" onSubmit={(e) => { e.preventDefault(); r.push(`/explore?q=${encodeURIComponent(q)}`); }}>
        <input aria-label="Search" placeholder="Search models, HDRIs, textures" value={q} onChange={(e) => setQ(e.target.value)} />
      </form>
      <div className="acct">
        {me ? (<>
          <Link href="/upload" className="btn sm">Upload</Link>
          <button className="avatar" onClick={() => setMenu(!menu)} aria-label="Account menu" aria-expanded={menu}>{me.username[0].toUpperCase()}</button>
          {menu && <div className="menu" onClick={() => setMenu(false)}><Link href={`/u/${me.username}`}>My profile</Link><Link href="/upload">Upload</Link><button onClick={logout}>Log out</button></div>}
        </>) : (<><Link href="/login" className="tl">Log in</Link><Link href="/register" className="btn sm">Sign up</Link></>)}
      </div>
    </header>
  );
}
export function Footer() {
  const path = usePathname(); if (path.startsWith("/embed")) return null;
  const col = (t: string, l: [string, string][]) => <div><h4>{t}</h4>{l.map(([n, h]) => <Link key={n} href={h}>{n}</Link>)}</div>;
  return (
    <footer className="foot"><div className="wrap fgrid">
      <div><Link href="/" className="logo"><span className="mark" />ModelHub</Link><p>A home for 3D models, HDRIs and textures. Upload, inspect in the browser, and share with a link.</p></div>
      {col("Explore", [["Models", "/explore?type=model"], ["HDRIs", "/explore?type=hdri"], ["Textures", "/explore?type=texture"], ["Newest", "/explore"]])}
      {col("Create", [["Upload", "/upload"], ["Sign up", "/register"], ["Log in", "/login"]])}
      <div><h4>Licenses</h4><p>Every asset shows its license. CC0 assets are free for any use.</p></div>
    </div><div className="wrap legal">Sample models come from the Khronos glTF and three.js example sets. Replace them with client content.</div></footer>
  );
}
