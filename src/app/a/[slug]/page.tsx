import Link from "next/link";
import { notFound } from "next/navigation";
import AssetViewer from "@/components/AssetViewer";
import Card from "@/components/Card";
import { BuyBox, LikeShare, ViewPing } from "@/components/AssetBits";
import { currentUser, visitorId } from "@/lib/auth";
import { getAsset, listAssets, publicAsset, publicSettings } from "@/lib/db";
import { money } from "@/lib/lists";
export const dynamic = "force-dynamic";

const KIND = { model: "3D model", hdri: "HDRI", texture: "Texture" };
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) { const a = publicAsset((await params).slug); return a ? { title: a.title, description: a.blurb || `${a.title}, a ${KIND[a.type]} you can preview in 3D.`, openGraph: { title: a.title, description: a.blurb } } : { title: "Not found" }; }
export default async function AssetPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params, owner = !!(await currentUser()), vid = await visitorId();
  const a = publicAsset(slug, vid, owner); if (!a) notFound();
  const set = publicSettings(), raw = getAsset(a.id)!;
  const related = listAssets(vid).filter((x) => x.id !== a.id && (x.category === a.category || x.type === a.type)).slice(0, 4);
  return (
    <main className="wrap pagetop">
      <ViewPing id={a.id} />
      <Link href="/explore" className="back">Back to the library</Link>
      <h1 className="title">{a.title}</h1>
      <p className="byline">{KIND[a.type]} in {a.category}{a.status === "draft" && <span className="badge">Draft, only you can see this</span>}</p>
      <AssetViewer asset={a} canEdit={owner} />
      <div className="actions">
        <BuyBox a={a} gateways={set.gateways} owner={owner} />
        <LikeShare a={a} />
      </div>
      <div className="detail">
        <div>
          {a.blurb && <p className="blurb">{a.blurb}</p>}
          {a.tags.length > 0 && <div className="chips tags">{a.tags.map((t) => <Link key={t} className="chip" href={`/explore?q=${encodeURIComponent(t)}`}>{t}</Link>)}</div>}
          {owner && (
            <div className="owner"><strong>Owner tools</strong>
              <div className="row"><Link className="btn sm" href={`/admin/assets/${a.id}`}>Edit price and details</Link><a className="btnline" href={`/api/assets/${a.id}/download`}>Download original</a></div>
              <p className="mutedp small">{a.sales} sale{a.sales === 1 ? "" : "s"}. {a.protectedPreview ? "The public preview is a reduced copy." : "The public preview is the full file."}</p>
            </div>
          )}
        </div>
        <dl className="facts">
          <dt>Price</dt><dd>{a.free ? "Free" : money(a.price, a.currency)}</dd>
          <dt>License</dt><dd>{a.license}</dd>
          <dt>Type</dt><dd>{KIND[a.type]}</dd>
          <dt>Format</dt><dd>{(raw.file.split(".").pop() || "").toUpperCase()}</dd>
          <dt>Views</dt><dd>{a.views.toLocaleString()}</dd>
          <dt>Downloads</dt><dd>{a.downloads.toLocaleString()}</dd>
          <dt>Added</dt><dd>{new Date(a.createdAt).toLocaleDateString("en", { year: "numeric", month: "short", day: "numeric" })}</dd>
          {set.supportEmail && <><dt>Questions</dt><dd><a href={`mailto:${set.supportEmail}`}>{set.supportEmail}</a></dd></>}
        </dl>
      </div>
      {related.length > 0 && <section className="sec"><h2>More like this</h2><div className="grid four">{related.map((r) => <Card key={r.id} a={r} />)}</div></section>}
    </main>
  );
}
