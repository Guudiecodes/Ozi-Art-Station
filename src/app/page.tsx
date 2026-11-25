import Link from "next/link";
import Hero from "@/components/Hero";
import Card from "@/components/Card";
import { currentUser, toMe } from "@/lib/auth";
import { listAssets, stats } from "@/lib/db";
export const dynamic = "force-dynamic";

export default async function Home() {
  const u = await currentUser(), me = toMe(u), all = listAssets(u?.id), s = stats();
  const picks = all.filter((a) => a.featured).slice(0, 4), latest = all.slice(0, 8);
  const n = (t: string) => all.filter((a) => a.type === t).length;
  const tiles = [["model", "Models", "Rotate, relight and annotate 3D models. Download the GLB."], ["hdri", "HDRIs", "Skies and studio lighting, with a chrome ball to judge the light."], ["texture", "Textures", "Tileable surfaces, previewed on a sphere, cube or plane."]];
  return (<>
    <section className="hero">
      <div className="heroCanvas"><Hero /></div>
      <div className="heroText">
        <h1>3D you can inspect, share and download.</h1>
        <p>Upload models, HDRIs and textures. View them in the browser with real lighting, then send a link or embed them anywhere.</p>
        <form action="/explore" className="herosearch"><input name="q" aria-label="Search" placeholder="Search the library" /><button className="btn">Search</button></form>
        <div className="row"><Link className="btn" href="/explore">Explore the library</Link><Link className="btnline lg" href={me ? "/upload" : "/register"}>{me ? "Upload your work" : "Create a free account"}</Link></div>
      </div>
    </section>

    <section className="stats wrap" aria-label="Library statistics">
      {[[s.assets, "assets"], [s.creators, "creators"], [s.downloads, "downloads"], [s.likes, "likes"]].map(([v, l]) => <div key={l}><strong>{(+v).toLocaleString()}</strong><span>{l}</span></div>)}
    </section>

    <section className="wrap sec"><h2>Browse by type</h2>
      <div className="tiles">{tiles.map(([k, t, d]) => <Link key={k} href={`/explore?type=${k}`} className="tile"><h3>{t}</h3><p>{d}</p><span>{n(k)} available</span></Link>)}</div>
    </section>

    {picks.length > 0 && <section className="wrap sec"><div className="sechead"><h2>Staff picks</h2><Link href="/explore">See everything</Link></div>
      <div className="grid four">{picks.map((a) => <Card key={a.id} a={a} me={me} />)}</div></section>}

    <section className="wrap sec"><div className="sechead"><h2>Latest uploads</h2><Link href="/explore">See everything</Link></div>
      <div className="grid four">{latest.map((a) => <Card key={a.id} a={a} me={me} />)}</div></section>

    <section className="wrap sec"><h2>How it works</h2>
      <ol className="steps">
        <li><h3>Create an account</h3><p>It is free. The first account on a new install becomes the site owner and can feature work and moderate comments.</p></li>
        <li><h3>Upload a file</h3><p>Drop in a .glb model, an .hdr sky or a .jpg, .png or .webp texture. Add a title, tags, a category and a license.</p></li>
        <li><h3>Share it</h3><p>Every asset gets its own page, a link, an embed code and a download button. Add pins to point out details.</p></li>
      </ol>
    </section>

    <section className="wrap sec"><h2>What you get</h2>
      <div className="feat">
        {[["Real viewer", "Orbit with inertia, swap materials, relight with six environments, view the wireframe, and take screenshots."], ["Annotations", "Owners pin notes to exact points on a model so viewers know what to look at."], ["Accounts and profiles", "Every creator has a public page with their uploads. Owners edit or delete their own work."], ["Likes and comments", "Logged-in members like assets and discuss them. Owners and the site admin can remove comments."], ["Downloads and embeds", "One click to download the original file. Paste the embed code into any website."], ["License on every asset", "CC0, CC-BY, CC-BY-NC or all rights reserved, shown clearly on the page."]]
          .map(([t, d]) => <div key={t}><h3>{t}</h3><p>{d}</p></div>)}</div>
    </section>

    <section className="cta"><div className="wrap"><h2>Have 3D work to show?</h2><p>Publish your first asset in under a minute.</p><Link className="btn invert" href={me ? "/upload" : "/register"}>{me ? "Upload now" : "Sign up free"}</Link></div></section>
  </>);
}
