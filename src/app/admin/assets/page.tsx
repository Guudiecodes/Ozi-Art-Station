import Link from "next/link";
import { AssetRows } from "@/components/AdminForms";
import { listAssets, ready } from "@/lib/db";
export const dynamic = "force-dynamic";
export default async function Assets() { await ready();
  const rows = listAssets(undefined, true).map((a) => ({ id: a.id, slug: a.slug, title: a.title, type: a.type, price: a.price, currency: a.currency, status: a.status, featured: a.featured, sales: a.sales, views: a.views }));
  return (<><div className="ahrow"><h1 className="ah">Assets</h1><Link className="btn sm" href="/admin/upload">Upload</Link></div><AssetRows rows={rows} /></>);
}
