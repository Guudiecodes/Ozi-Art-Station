import Link from "next/link";
import { notFound } from "next/navigation";
import { AssetEditor } from "@/components/AdminForms";
import { getAsset } from "@/lib/db";
export const dynamic = "force-dynamic";
export default async function Edit({ params }: { params: Promise<{ id: string }> }) {
  const a = getAsset((await params).id); if (!a) notFound();
  return (<><Link href="/admin/assets" className="back">All assets</Link><h1 className="ah">{a.title}</h1>
    <AssetEditor a={{ id: a.id, slug: a.slug, type: a.type, title: a.title, blurb: a.blurb, category: a.category, license: a.license, tags: a.tags.join(", "), price: a.price, currency: a.currency, status: a.status, featured: a.featured, protectedPreview: a.protectedPreview, pins: a.annotations.map((p) => ({ id: p.id, text: p.text })) }} /></>);
}
