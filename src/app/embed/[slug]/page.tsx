import { notFound } from "next/navigation";
import AssetViewer from "@/components/Viewers";
import { publicAsset } from "@/lib/db";
export const dynamic = "force-dynamic";
export default async function Embed({ params }: { params: Promise<{ slug: string }> }) {
  const a = publicAsset((await params).slug); if (!a) notFound();
  return <div className="embed"><AssetViewer a={a} canPin={false} /></div>;
}
