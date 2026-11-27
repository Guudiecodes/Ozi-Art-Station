import { OrdersTable } from "@/components/AdminForms";
import { listAssets, listOrders, ready } from "@/lib/db";
export const dynamic = "force-dynamic";
export default async function Orders() { await ready();
  const rows = [...listOrders()].sort((a, b) => b.createdAt - a.createdAt);
  return (<><h1 className="ah">Orders</h1><OrdersTable rows={rows} assets={listAssets(undefined, true).filter((a) => a.price > 0).map((a) => ({ id: a.id, title: a.title }))} /></>);
}
