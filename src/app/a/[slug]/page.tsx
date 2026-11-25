import { notFound } from "next/navigation";
import Link from "next/link";
import AssetViewer from "@/components/Viewers";
import Card from "@/components/Card";
import { Actions, Comments, OwnerTools, ViewPing } from "@/components/AssetBits";
import { canEdit, currentUser, toMe } from "@/lib/auth";
import { listAssets, listComments, publicAsset } from "@/lib/db";
export const dynamic = "force-dynamic";
const NAMES = { model: "Model", hdri: "HDRI", texture: "Texture" };
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) { const a = publicAsset((await params).slug); return { title: a ? `${a.title} by ${a.owner} | ModelHub` : "Not found" }; }
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const u = await currentUser(), a = publicAsset((await params).slug, u?.id);
  if (!a) notFound();
  const me = toMe(u), mine = canEdit(u, a.ownerId), more = listAssets(u?.id).filter((x) => x.owner === a.owner && x.id !== a.id).slice(0, 4);
  return (
    <main className="wrap pagetop">
      <ViewPing id={a.id} />
      <Link href="/explore" className="back">Back to explore</Link>
      <div className="titlerow"><div><h1 className="title">{a.title}</h1><p className="byline">{NAMES[a.type]} by <Link href={`/u/${a.owner}`}>{a.owner}</Link>{a.featured && <span className="badge">Staff pick</span>}</p></div></div>
      <AssetViewer a={a} canPin={mine} />
      <Actions a={a} me={me} />
      <div className="detail">
        <div>
          {a.blurb && <p className="blurb">{a.blurb}</p>}
          <div className="chips tags">{a.tags.map((t) => <Link key={t} href={`/explore?q=${t}`} className="chip">{t}</Link>)}</div>
          {mine && <OwnerTools a={a} me={me} />}
          <Comments a={a} me={me} initial={listComments(a.id)} />
        </div>
        <dl className="facts"><dt>Views</dt><dd>{a.views.toLocaleString()}</dd><dt>Downloads</dt><dd>{a.downloads.toLocaleString()}</dd><dt>Likes</dt><dd>{a.likes}</dd><dt>Category</dt><dd>{a.category}</dd><dt>License</dt><dd>{a.license}</dd><dt>Published</dt><dd>{new Date(a.createdAt).toLocaleDateString()}</dd></dl>
      </div>
      {more.length > 0 && <section className="sec"><h2>More from {a.owner}</h2><div className="grid four">{more.map((x) => <Card key={x.id} a={x} me={me} />)}</div></section>}
    </main>
  );
}
