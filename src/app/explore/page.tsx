import Gallery from "@/components/Gallery";
import { currentUser, toMe } from "@/lib/auth";
import { listAssets } from "@/lib/db";
export const dynamic = "force-dynamic";
export default async function Explore({ searchParams }: { searchParams: Promise<{ type?: string; q?: string }> }) {
  const sp = await searchParams, u = await currentUser();
  return (<main className="pagetop"><div className="wrap"><h1 className="title">Explore</h1></div>
    <Gallery key={`${sp.type}${sp.q}`} items={listAssets(u?.id)} me={toMe(u)} type={sp.type || "all"} q={sp.q || ""} /></main>);
}
