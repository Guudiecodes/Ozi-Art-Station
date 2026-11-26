import { OrdersTable } from "@/components/AdminForms";
import { listAssets, listOrders } from "@/lib/db";
export const dynamic = "force-dynamic";
export default function Orders() {
  const rows = [...listOrders()].sort((a, b) => b.createdAt - a.createdAt);
  return (<><h1 className="ah">Orders</h1><OrdersTable rows={rows} assets={listAssets(undefined, true).filter((a) => a.price > 0).map((a) => ({ id: a.id, title: a.title }))} /></>);
}
