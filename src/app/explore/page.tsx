import Gallery from "@/components/Gallery";
import { visitorId } from "@/lib/auth";
import { listAssets } from "@/lib/db";
export const dynamic = "force-dynamic";
export default async function Explore({ searchParams }: { searchParams: Promise<{ type?: string; q?: string }> }) {
  const sp = await searchParams;
  return (<main className="pagetop"><div className="wrap"><h1 className="title">Explore</h1></div>
    <Gallery key={`${sp.type}${sp.q}`} items={listAssets(await visitorId())} type={sp.type || "all"} q={sp.q || ""} /></main>);
}
