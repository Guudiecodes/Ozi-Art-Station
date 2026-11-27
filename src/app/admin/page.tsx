import Link from "next/link";
import { adminStats, getSettings, listOrders, recentEvents, ready } from "@/lib/db";
import { money } from "@/lib/lists";
export const dynamic = "force-dynamic";
export default async function Overview() { await ready();
  const s = adminStats(), set = getSettings(), orders = [...listOrders()].sort((a, b) => b.createdAt - a.createdAt).slice(0, 6), ev = recentEvents(12);
  const max = Math.max(1, ...s.days.map((d) => d.views)), rev = Object.entries(s.revenue);
  const gw = (["paystack", "flutterwave"] as const).some((g) => set.payments[g].enabled && set.payments[g].secretKey);
  const todo = [[s.assets > 0, "Upload your first asset", "/admin/upload"], [gw, "Connect Paystack or Flutterwave", "/admin/payments"], [!!set.siteUrl, "Set your public site address", "/admin/settings"], [!!set.supportEmail, "Add a support email", "/admin/settings"]] as const;
  return (<>
    <h1 className="ah">Overview</h1>
    <div className="kpis">
      <div><b>{rev.length ? rev.map(([c, n]) => money(n, c)).join(" + ") : money(0, set.currency)}</b><span>Revenue</span></div>
      <div><b>{s.paid}</b><span>Paid orders{s.pending ? `, ${s.pending} waiting` : ""}</span></div>
      <div><b>{s.views.toLocaleString()}</b><span>Views</span></div>
      <div><b>{s.downloads.toLocaleString()}</b><span>Downloads</span></div>
      <div><b>{s.assets}</b><span>Assets{s.drafts ? `, ${s.drafts} draft` : ""}</span></div>
    </div>
    {todo.some((t) => !t[0]) && <div className="card2"><h3>Finish setting up</h3>{todo.filter((t) => !t[0]).map((t) => <p key={t[1]}><Link href={t[2]}>{t[1]}</Link></p>)}</div>}
    <div className="card2"><h3>Views, last 14 days</h3><div className="bars" role="img" aria-label="Daily views">{s.days.map((d) => <div key={d.date} title={`${d.date}: ${d.views} views, ${d.orders} orders`}><i style={{ height: `${Math.max(3, (d.views / max) * 100)}%` }} /><small>{d.date.slice(8)}</small></div>)}</div></div>
    <div className="two2">
      <div className="card2"><h3>Latest orders</h3>{!orders.length ? <p className="mutedp">No orders yet.</p> : orders.map((o) => <p key={o.id} className="line"><span>{o.assetTitle}<br /><small className="mutedp">{o.email}</small></span><span>{money(o.amount, o.currency)}<br /><small className={`st ${o.status}`}>{o.status}</small></span></p>)}<Link href="/admin/orders">All orders</Link></div>
      <div className="card2"><h3>Activity</h3>{!ev.length ? <p className="mutedp">Nothing yet.</p> : ev.map((e, i) => <p key={i} className="line"><span>{e.text}</span><small className="mutedp">{new Date(e.t).toLocaleString("en", { dateStyle: "short", timeStyle: "short" })}</small></p>)}</div>
    </div>
  </>);
}
