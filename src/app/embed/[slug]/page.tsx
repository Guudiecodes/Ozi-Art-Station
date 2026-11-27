import { notFound } from "next/navigation";
import AssetViewer from "@/components/AssetViewer";
import { ViewPing } from "@/components/AssetBits";
import { publicAsset, ready } from "@/lib/db";
export const dynamic = "force-dynamic";
// Bare viewer for iframes. Header, footer and the side panel are hidden by the .embed styles.
export default async function Embed({ params }: { params: Promise<{ slug: string }> }) { await ready();
  const a = publicAsset((await params).slug); if (!a) notFound();
  return <div className="embed"><ViewPing id={a.id} /><AssetViewer asset={a} canEdit={false} /></div>;
}
