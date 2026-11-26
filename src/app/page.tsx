import Link from "next/link";
import Hero from "@/components/Hero";
import Card from "@/components/Card";
import { visitorId } from "@/lib/auth";
import { listAssets, publicSettings, stats } from "@/lib/db";
export const dynamic = "force-dynamic";

export default async function Home() {
  const all = listAssets(await visitorId()), s = stats(), set = publicSettings();
  const picks = all.filter((a) => a.featured).slice(0, 4), latest = all.slice(0, 8);
  const n = (t: string) => all.filter((a) => a.type === t).length;
  const tiles = [["model", "Models", "Rotate, relight and annotate 3D models. Preview in the browser, then download or buy the GLB."], ["hdri", "HDRIs", "Skies and studio lighting, shown on a chrome ball so you can judge the light."], ["texture", "Textures", "Tileable surfaces, previewed on a sphere, cube or plane."]];
  const sample = set.characters.map(({ id, name, file, scale, y, note }) => ({ id, name, file, scale, y, note }));
  return (<>
    <section className="hero">
      <div className="heroCanvas"><Hero characters={sample} initial={set.heroCharacter} showSwitcher={set.showSwitcher} autoSwitch={set.autoSwitch} switchSeconds={set.switchSeconds} /></div>
      <div className="heroText">
        <h1>{set.heroTitle}</h1>
        <p>{set.heroText}</p>
        <form action="/explore" className="herosearch"><input name="q" aria-label="Search" placeholder="Search the library" /><button className="btn">Search</button></form>
        <div className="row"><Link className="btn" href="/explore">Explore the library</Link><Link className="btnline lg" href="/explore?type=model">Browse models</Link></div>
      </div>
    </section>

    <section className="stats wrap" aria-label="Library statistics">
      {[[s.assets, "assets"], [s.models, "models"], [s.hdris + s.textures, "HDRIs and textures"], [s.downloads, "downloads"]].map(([v, l]) => <div key={l}><strong>{(+v).toLocaleString()}</strong><span>{l}</span></div>)}
    </section>

    <section className="wrap sec"><h2>Browse by type</h2>
      <div className="tiles">{tiles.map(([k, t, d]) => <Link key={k} href={`/explore?type=${k}`} className="tile"><h3>{t}</h3><p>{d}</p><span>{n(k)} available</span></Link>)}</div>
    </section>

    {picks.length > 0 && <section className="wrap sec"><div className="sechead"><h2>Featured</h2><Link href="/explore">See everything</Link></div>
      <div className="grid four">{picks.map((a) => <Card key={a.id} a={a} />)}</div></section>}

    <section className="wrap sec"><div className="sechead"><h2>Latest additions</h2><Link href="/explore">See everything</Link></div>
      <div className="grid four">{latest.map((a) => <Card key={a.id} a={a} />)}</div></section>

    <section className="wrap sec"><h2>How buying works</h2>
      <ol className="steps">
        <li><h3>Preview in 3D</h3><p>Open any asset and inspect it with real lighting. Orbit, zoom, switch to clay or wireframe, and read the pins the creator left on key details.</p></li>
        <li><h3>Pay securely</h3><p>Enter your email and pay with Paystack or Flutterwave. Cards, bank transfer and mobile money are handled by the gateway, not by this site.</p></li>
        <li><h3>Download the full file</h3><p>The moment the payment is confirmed you get a download page. A copy of the link is emailed to you when email is switched on.</p></li>
      </ol>
    </section>

    <section className="wrap sec"><h2>What you get</h2>
      <div className="feat">
        {[["A real viewer", "Orbit with inertia, swap materials, relight with six environments, view the wireframe, and take screenshots."], ["Annotations", "Pins on exact points of a model so you know what to look at before you buy."], ["Free and paid assets", "Free files download in one click. Paid files unlock after the payment is verified with the gateway."], ["Clear licenses", "CC0, CC-BY, CC-BY-NC, all rights reserved or a commercial license, shown on every page."], ["Embeds and sharing", "Every asset has its own link and an embed code that works on any website."], ["Protected originals", "Public previews are reduced copies. The full quality file is only released to paying customers."]]
          .map(([t, d]) => <div key={t}><h3>{t}</h3><p>{d}</p></div>)}</div>
    </section>

    <section className="cta"><div className="wrap"><h2>Find your next asset</h2><p>New models, lighting and surfaces are added regularly.</p><Link className="btn invert" href="/explore">Explore the library</Link></div></section>
  </>);
}
