import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderLive } from "@/components/AssetBits";
import { getAsset, getSettings, orderByToken, ready } from "@/lib/db";
import { money } from "@/lib/lists";
export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false } };

export default async function OrderPage({ params }: { params: Promise<{ token: string }> }) { await ready();
  const o = orderByToken((await params).token); if (!o) notFound();
  const s = getSettings(), a = getAsset(o.assetId), left = Math.max(0, s.maxDownloads - o.downloads);
  return (
    <main className="wrap narrow pagetop">
      <h1 className="title">{o.status === "paid" ? "Your download is ready" : o.status === "pending" ? "Confirming your payment" : o.status === "refunded" ? "This order was refunded" : "Payment did not go through"}</h1>
      <dl className="facts order">
        <dt>Item</dt><dd>{o.assetTitle}</dd><dt>Amount</dt><dd>{money(o.amount, o.currency)}</dd><dt>Email</dt><dd>{o.email}</dd><dt>Order</dt><dd>{o.reference}</dd>
      </dl>
      {o.status === "paid" && (<>
        <div className="actions"><a className="btn" href={`/api/orders/${o.token}/download`}>Download {a?.title ?? o.assetTitle}</a><span className="mutedp small">{left} of {s.maxDownloads} downloads left</span></div>
        <p className="lead">Bookmark this page. It is your receipt and your download link{s.supportEmail ? <>, and <a href={`mailto:${s.supportEmail}`}>{s.supportEmail}</a> can help if anything goes wrong</> : ""}.</p>
        {a && <p className="mutedp">License: {a.license}</p>}
      </>)}
      {o.status === "pending" && (<><p className="lead">We are waiting for {o.gateway === "manual" ? "the seller" : o.gateway} to confirm the payment. This page checks automatically and usually takes a few seconds.</p><OrderLive token={o.token} pending /></>)}
      {o.status === "failed" && <><p className="lead">{o.note || "The gateway did not confirm a payment."} You have not been charged for a failed payment. If money left your account, contact the seller with the order reference above.</p>{a && <Link className="btn" href={`/a/${a.slug}?buy=1`}>Try again</Link>}</>}
      {o.status === "refunded" && <p className="lead">Downloads for this order are switched off. Contact the seller if you think this is a mistake.</p>}
    </main>
  );
}
