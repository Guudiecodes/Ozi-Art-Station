// Paystack and Flutterwave. Keys are read from the admin settings at call time, so changing them in the admin panel takes effect immediately.
// A payment only counts after we ask the gateway about it ourselves (verify), never because a browser or webhook said so.
import { getSettings, markPaid, setOrder, getAsset, type Gateway, type Order } from "./db";

const T = () => AbortSignal.timeout(20000);
const json = async (r: Response) => { try { return await r.json(); } catch { return {}; } };

export function baseUrl(req: Request) {
  const s = getSettings().siteUrl || process.env.SITE_URL;
  if (s) return s.replace(/\/$/, "");
  const h = req.headers, host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  return `${h.get("x-forwarded-proto") || (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https")}://${host}`;
}

export async function initCheckout(gateway: Gateway, o: Order, base: string): Promise<string> {
  const s = getSettings(), cb = `${base}/api/pay/callback/${gateway}`;
  if (gateway === "paystack") {
    const k = s.payments.paystack.secretKey; if (!k) throw new Error("Paystack is not set up.");
    const r = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST", signal: T(), headers: { Authorization: `Bearer ${k}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email: o.email, amount: Math.round(o.amount * 100), currency: o.currency, reference: o.reference, callback_url: cb, metadata: { orderId: o.id, asset: o.assetTitle } }),
    });
    const j = await json(r); if (!j.status || !j.data?.authorization_url) throw new Error(j.message || "Paystack could not start the payment.");
    return j.data.authorization_url;
  }
  const k = s.payments.flutterwave.secretKey; if (!k) throw new Error("Flutterwave is not set up.");
  const r = await fetch("https://api.flutterwave.com/v3/payments", {
    method: "POST", signal: T(), headers: { Authorization: `Bearer ${k}`, "Content-Type": "application/json" },
    body: JSON.stringify({ tx_ref: o.reference, amount: o.amount, currency: o.currency, redirect_url: cb, customer: { email: o.email }, customizations: { title: s.siteName, description: o.assetTitle }, meta: { orderId: o.id } }),
  });
  const j = await json(r); if (j.status !== "success" || !j.data?.link) throw new Error(j.message || "Flutterwave could not start the payment.");
  return j.data.link;
}

type Verdict = { state: "paid" | "pending" | "failed"; why?: string };
async function verify(o: Order): Promise<Verdict> {
  const s = getSettings();
  if (o.gateway === "paystack") {
    const k = s.payments.paystack.secretKey; if (!k) return { state: "pending", why: "Paystack key missing" };
    const j = await json(await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(o.reference)}`, { headers: { Authorization: `Bearer ${k}` }, signal: T() }));
    if (!j.status || !j.data) return { state: "pending" };
    const d = j.data;
    if (d.status === "success") return d.amount >= Math.round(o.amount * 100) && d.currency === o.currency ? { state: "paid" } : { state: "failed", why: "Amount or currency did not match" };
    return ["failed", "reversed"].includes(d.status) ? { state: "failed", why: d.gateway_response } : { state: "pending" };
  }
  if (o.gateway === "flutterwave") {
    const k = s.payments.flutterwave.secretKey; if (!k) return { state: "pending", why: "Flutterwave key missing" };
    const j = await json(await fetch(`https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(o.reference)}`, { headers: { Authorization: `Bearer ${k}` }, signal: T() }));
    if (j.status !== "success" || !j.data) return { state: "pending" };
    const d = j.data;
    if (d.status === "successful") return d.amount >= o.amount && d.currency === o.currency ? { state: "paid" } : { state: "failed", why: "Amount or currency did not match" };
    return d.status === "failed" ? { state: "failed", why: d.processor_response } : { state: "pending" };
  }
  return { state: "pending" };
}

// Ask the gateway, then update the order. Safe to call many times (callback, webhook and the "check again" button).
export async function settle(o: Order, base?: string): Promise<Order["status"]> {
  if (o.status === "paid" || o.status === "refunded" || o.gateway === "manual") return o.status;
  let v: Verdict; try { v = await verify(o); } catch { return o.status; }
  if (v.state === "paid") { const first = markPaid(o); if (first) void emailLink(o, base); }
  else if (v.state === "failed") setOrder(o.id, { status: "failed", note: v.why });
  return o.status;
}

export async function testGateway(g: Gateway) {
  const s = getSettings();
  try {
    if (g === "paystack") {
      const k = s.payments.paystack.secretKey; if (!k) return { ok: false, message: "Save a secret key first." };
      const j = await json(await fetch("https://api.paystack.co/balance", { headers: { Authorization: `Bearer ${k}` }, signal: T() }));
      return j.status ? { ok: true, message: `Connected (${k.startsWith("sk_live") ? "live" : "test"} mode).` } : { ok: false, message: j.message || "Paystack rejected this key." };
    }
    const k = s.payments.flutterwave.secretKey; if (!k) return { ok: false, message: "Save a secret key first." };
    const j = await json(await fetch("https://api.flutterwave.com/v3/balances", { headers: { Authorization: `Bearer ${k}` }, signal: T() }));
    return j.status === "success" ? { ok: true, message: `Connected (${/TEST/.test(k) ? "test" : "live"} mode).` } : { ok: false, message: j.message || "Flutterwave rejected this key." };
  } catch { return { ok: false, message: "Could not reach the gateway. Check your internet connection." }; }
}

export async function sendMail(to: string, subject: string, html: string) {
  const { email } = getSettings(); if (!email.resendKey || !email.from) return false;
  try {
    const r = await fetch("https://api.resend.com/emails", { method: "POST", signal: T(), headers: { Authorization: `Bearer ${email.resendKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: email.from, to: [to], subject, html }) });
    return r.ok;
  } catch { return false; }
}
export async function emailLink(o: Order, base?: string) {
  const s = getSettings(), root = (base || s.siteUrl || "").replace(/\/$/, ""); if (!root) return false;
  const a = getAsset(o.assetId);
  return sendMail(o.email, `Your download: ${o.assetTitle}`, `<p>Thanks for your purchase from ${s.siteName}.</p><p><a href="${root}/order/${o.token}">Download ${a?.title ?? o.assetTitle}</a></p><p>Keep this email. The link works for ${s.maxDownloads} downloads.</p>`);
}
