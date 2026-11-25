import { notFound } from "next/navigation";
import Card from "@/components/Card";
import { currentUser, toMe } from "@/lib/auth";
import { findUser, listAssets } from "@/lib/db";
export const dynamic = "force-dynamic";
export default async function Profile({ params }: { params: Promise<{ username: string }> }) {
  const p = findUser((await params).username); if (!p || p.role === "system" && false) notFound();
  const me = await currentUser(), mine = listAssets(me?.id).filter((a) => a.owner === p.username);
  const likes = mine.reduce((s, a) => s + a.likes, 0), views = mine.reduce((s, a) => s + a.views, 0);
  return (
    <main className="wrap pagetop">
      <div className="profile"><div className="avatar big">{p.username[0].toUpperCase()}</div>
        <div><h1 className="title">{p.username}</h1><p className="mutedp">{p.bio || "No bio yet."}</p>
          <p className="byline">{mine.length} uploads · {views.toLocaleString()} views · {likes} likes{p.role === "admin" && <span className="badge">Site owner</span>}</p></div></div>
      {mine.length === 0 ? <p className="empty">Nothing uploaded yet.</p> : <div className="grid four">{mine.map((a) => <Card key={a.id} a={a} me={toMe(me)} />)}</div>}
    </main>
  );
}
