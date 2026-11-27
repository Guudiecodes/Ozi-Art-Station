"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CATEGORIES, CURRENCIES, LICENSES, money } from "@/lib/lists";

async function api(url: string, method: string, body?: unknown) {
  const r = await fetch(url, { method, headers: body instanceof FormData || body === undefined ? undefined : { "Content-Type": "application/json" }, body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, j };
}
function useMsg() { const [m, setM] = useState<{ t: string; bad?: boolean } | null>(null); return { m, ok: (t: string) => setM({ t }), no: (t: string) => setM({ t, bad: true }), el: m && <p className={m.bad ? "err" : "okmsg"} role="status">{m.t}</p> }; }

// Large files go straight from the browser to Cloudflare R2 when it is connected (Vercel cannot take big request bodies). Returns null when the normal form post should be used.
async function directPut(file: File, kind: "original" | "preview" | "character"): Promise<{ ref: string } | { error: string } | null> {
  const ext = "." + (file.name.split(".").pop() || "").toLowerCase(), r = await api("/api/admin/upload/sign", "POST", { ext, kind });
  if (!r.ok) return { error: r.j.error || "Could not start the upload." };
  if (r.j.mode === "blob") {
    try { const { upload } = await import("@vercel/blob/client"); await upload(r.j.pathname, file, { access: "private", handleUploadUrl: "/api/admin/upload/blob", multipart: file.size > 8 * 1024 * 1024, contentType: r.j.type }); return { ref: r.j.ref }; }
    catch (e) { return { error: "The upload to file storage failed: " + ((e as Error).message || "unknown error") }; }
  }
  if (r.j.mode !== "direct") return null;
  const put = await fetch(r.j.url, { method: "PUT", headers: { "Content-Type": r.j.type }, body: file }).catch(() => null);
  if (!put || !put.ok) return { error: "The upload to file storage failed. Check the CORS setting on the R2 bucket (docs/VERCEL.md)." };
  return { ref: r.j.ref };
}
const NAV: [string, string][] = [["/admin", "Overview"], ["/admin/assets", "Assets"], ["/admin/upload", "Upload"], ["/admin/orders", "Orders"], ["/admin/payments", "Payments"], ["/admin/hero", "Home page"], ["/admin/legal", "Legal pages"], ["/admin/settings", "Settings"]];
export function AdminNav() {
  const p = usePathname();
  return <nav className="anav" aria-label="Admin">{NAV.map(([h, n]) => <Link key={h} href={h} className={(h === "/admin" ? p === h : p.startsWith(h)) ? "on" : ""}>{n}</Link>)}</nav>;
}

export function AssetRows({ rows }: { rows: { id: string; slug: string; title: string; type: string; price: number; currency: string; status: string; featured: boolean; sales: number; views: number }[] }) {
  const r = useRouter(), [busy, setBusy] = useState("");
  const patch = async (id: string, b: object) => { setBusy(id); await api(`/api/assets/${id}`, "PATCH", b); setBusy(""); r.refresh(); };
  const del = async (id: string, t: string) => { if (!confirm(`Delete "${t}" permanently? Past customers keep their order record but can no longer download.`)) return; await api(`/api/assets/${id}`, "DELETE"); r.refresh(); };
  if (!rows.length) return <p className="empty">No assets yet. <Link href="/admin/upload">Upload your first one</Link>.</p>;
  return (
    <div className="tablewrap"><table className="tbl"><thead><tr><th>Asset</th><th>Price</th><th>Status</th><th>Sales</th><th>Views</th><th></th></tr></thead><tbody>
      {rows.map((a) => (
        <tr key={a.id}>
          <td><Link href={`/admin/assets/${a.id}`}><strong>{a.title}</strong></Link><br /><span className="mutedp small">{a.type}</span></td>
          <td><form className="inl" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); void patch(a.id, { price: f.get("price"), currency: f.get("currency") }); }}>
            <input name="price" type="number" min="0" step="0.01" defaultValue={a.price} aria-label={`Price for ${a.title}`} style={{ width: 96 }} />
            <select name="currency" defaultValue={a.currency} aria-label="Currency">{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select>
            <button className="btnline sm" disabled={busy === a.id}>Save</button></form></td>
          <td><button className="btnline sm" onClick={() => patch(a.id, { status: a.status === "published" ? "draft" : "published" })}>{a.status === "published" ? "Published" : "Draft"}</button>{" "}
            <button className={`btnline sm ${a.featured ? "cur" : ""}`} onClick={() => patch(a.id, { featured: !a.featured })}>{a.featured ? "Featured" : "Feature"}</button></td>
          <td>{a.sales}</td><td>{a.views}</td>
          <td><Link className="btnline sm" href={`/a/${a.slug}`}>View</Link> <button className="btnline sm danger" onClick={() => del(a.id, a.title)}>Delete</button></td>
        </tr>))}
    </tbody></table></div>
  );
}

export function UploadForm({ currency }: { currency: string }) {
  const r = useRouter(), msg = useMsg(), [busy, setBusy] = useState(false);
  const go = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setBusy(true); msg.ok("Uploading. Large files can take a minute.");
    const fd = new FormData(e.currentTarget), file = fd.get("file") as File, pf = fd.get("preview") as File | null;
    const main = await directPut(file, "original");
    if (main && "error" in main) { msg.no(main.error); setBusy(false); return; }
    let out: { ok: boolean; j: { error?: string; warning?: string } };
    if (main) {
      let previewRef = "";
      if (pf && pf.size) { const p = await directPut(pf, "preview"); if (p && "error" in p) { msg.no(p.error); setBusy(false); return; } if (p) previewRef = p.ref; }
      const fields = Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string"));
      out = await api("/api/admin/upload", "POST", { ...fields, fileRef: main.ref, fileName: file.name, previewRef });
    } else out = await api("/api/admin/upload", "POST", fd);
    const { ok, j } = out;
    if (ok) { if (j.warning) alert(j.warning); r.push(`/admin/assets`); r.refresh(); } else { msg.no(j.error || "Upload failed."); setBusy(false); }
  };
  return (
    <form className="aform" onSubmit={go}>
      <label>File<input name="file" type="file" accept=".glb,.hdr,.jpg,.jpeg,.png,.webp" required /><span className="hint">.glb model, .hdr HDRI, or .jpg .png .webp texture. The original stays private until bought.</span></label>
      <label>Title<input name="title" maxLength={80} placeholder="Leave blank to use the file name" /></label>
      <div className="two"><label>Category<select name="category" defaultValue={CATEGORIES[1]}>{CATEGORIES.filter((c) => c !== "All").map((c) => <option key={c}>{c}</option>)}</select></label>
        <label>License<select name="license">{LICENSES.map((l) => <option key={l}>{l}</option>)}</select></label></div>
      <div className="two"><label>Price (0 = free)<input name="price" type="number" min="0" step="0.01" defaultValue="0" /></label>
        <label>Currency<select name="currency" defaultValue={currency}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></label></div>
      <label>Tags<input name="tags" placeholder="chair, leather, furniture" /></label>
      <label>Description<textarea name="blurb" rows={3} maxLength={600} /></label>
      <label>Public preview file (optional)<input name="preview" type="file" accept=".glb,.hdr,.jpg,.jpeg,.png,.webp" /><span className="hint">Upload a smaller version buyers can look at before paying.</span></label>
      <label className="check"><input name="lowres" type="checkbox" defaultChecked /> Build a low-resolution public preview automatically (models and textures)</label>
      <label>Visibility<select name="status"><option value="published">Published</option><option value="draft">Draft, only you can see it</option></select></label>
      {msg.el}<button className="btn" disabled={busy}>{busy ? "Uploading..." : "Upload"}</button>
    </form>
  );
}

export function AssetEditor({ a }: { a: { id: string; slug: string; type: string; title: string; blurb: string; category: string; license: string; tags: string; price: number; currency: string; status: string; featured: boolean; protectedPreview: boolean; pins: { id: string; text: string }[] } }) {
  const r = useRouter(), msg = useMsg();
  const save = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const f = Object.fromEntries(new FormData(e.currentTarget));
    const { ok, j } = await api(`/api/assets/${a.id}`, "PATCH", { ...f, featured: f.featured === "on" }); if (ok) { msg.ok("Saved."); r.refresh(); } else msg.no(j.error || "Could not save.");
  };
  const rebuild = async () => { msg.ok("Building..."); const { ok, j } = await api(`/api/assets/${a.id}/preview`, "POST"); ok ? (msg.ok("Preview rebuilt."), r.refresh()) : msg.no(j.error || "Failed."); };
  const rmPin = async (id: string) => { await api(`/api/assets/${a.id}/annotations?n=${id}`, "DELETE"); r.refresh(); };
  return (<>
    <form className="aform" onSubmit={save}>
      <label>Title<input name="title" defaultValue={a.title} maxLength={80} required /></label>
      <div className="two"><label>Price (0 = free)<input name="price" type="number" min="0" step="0.01" defaultValue={a.price} /></label>
        <label>Currency<select name="currency" defaultValue={a.currency}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></label></div>
      <div className="two"><label>Category<select name="category" defaultValue={a.category}>{CATEGORIES.filter((c) => c !== "All").map((c) => <option key={c}>{c}</option>)}</select></label>
        <label>License<select name="license" defaultValue={a.license}>{LICENSES.map((l) => <option key={l}>{l}</option>)}</select></label></div>
      <label>Tags<input name="tags" defaultValue={a.tags} /></label>
      <label>Description<textarea name="blurb" rows={4} maxLength={600} defaultValue={a.blurb} /></label>
      <label>Visibility<select name="status" defaultValue={a.status}><option value="published">Published</option><option value="draft">Draft</option></select></label>
      <label className="check"><input type="checkbox" name="featured" defaultChecked={a.featured} /> Show on the home page</label>
      {msg.el}<div className="row"><button className="btn">Save changes</button><Link className="btnline" href={`/a/${a.slug}`}>View page</Link><a className="btnline" href={`/api/assets/${a.id}/download`}>Download original</a></div>
    </form>
    <div className="card2"><h3>Public preview</h3>
      <p className="mutedp">{a.protectedPreview ? "Buyers see a reduced copy. The full file is only released after payment." : "Buyers currently see the full file. Build a reduced copy if this asset is paid."}</p>
      {a.type !== "hdri" && <button className="btnline" onClick={rebuild}>Rebuild low-res preview</button>}</div>
    {a.pins.length > 0 && <div className="card2"><h3>Pins</h3>{a.pins.map((p) => <p key={p.id} className="pinrow">{p.text} <button className="btnline sm danger" onClick={() => rmPin(p.id)}>Remove</button></p>)}</div>}
  </>);
}

type O = { id: string; token: string; assetTitle: string; email: string; amount: number; currency: string; gateway: string; reference: string; status: string; downloads: number; createdAt: number };
export function OrdersTable({ rows, assets }: { rows: O[]; assets: { id: string; title: string }[] }) {
  const r = useRouter(), [f, setF] = useState("all"), msg = useMsg();
  const act = async (id: string, action: string) => { await api("/api/admin/orders", "PATCH", { id, action }); r.refresh(); };
  const copy = async (t: string) => { const u = `${location.origin}/order/${t}`; try { await navigator.clipboard.writeText(u); msg.ok("Download link copied."); } catch { prompt("Copy this link:", u); } };
  const manual = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const { ok, j } = await api("/api/admin/orders", "POST", Object.fromEntries(new FormData(e.currentTarget)));
    if (ok) { await copy(j.token); r.refresh(); } else msg.no(j.error || "Failed.");
  };
  const shown = rows.filter((o) => f === "all" || o.status === f);
  return (<>
    <div className="chips">{["all", "paid", "pending", "failed", "refunded"].map((s) => <button key={s} className={f === s ? "on" : ""} onClick={() => setF(s)}>{s}</button>)}</div>
    {msg.el}
    {!shown.length ? <p className="empty">No orders here yet.</p> : <div className="tablewrap"><table className="tbl"><thead><tr><th>When</th><th>Item</th><th>Customer</th><th>Amount</th><th>Status</th><th>Downloads</th><th></th></tr></thead><tbody>
      {shown.map((o) => (<tr key={o.id}><td>{new Date(o.createdAt).toLocaleString("en", { dateStyle: "medium", timeStyle: "short" })}</td><td>{o.assetTitle}<br /><span className="mutedp small">{o.gateway} {o.reference}</span></td><td>{o.email}</td><td>{money(o.amount, o.currency)}</td><td><span className={`st ${o.status}`}>{o.status}</span></td><td>{o.downloads}</td>
        <td className="acts"><button className="btnline sm" onClick={() => copy(o.token)}>Copy link</button>
          {o.status !== "paid" && <button className="btnline sm" onClick={() => act(o.id, "markPaid")}>Mark paid</button>}
          {o.status === "paid" && <><button className="btnline sm" onClick={() => act(o.id, "resetDownloads")}>Reset downloads</button><button className="btnline sm danger" onClick={() => confirm("Revoke this order? The customer loses access.") && act(o.id, "refund")}>Refund or revoke</button></>}</td></tr>))}
    </tbody></table></div>}
    <div className="card2"><h3>Record a sale made outside the site</h3><p className="mutedp">For bank transfer or cash. You get a download link to send to the customer.</p>
      <form className="aform inline3" onSubmit={manual}><select name="assetId" required defaultValue="">{<option value="" disabled>Choose an asset</option>}{assets.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}</select>
        <input name="email" type="email" placeholder="Customer email" required /><input name="note" placeholder="Note (optional)" /><button className="btn sm">Create paid order</button></form></div>
  </>);
}

type Sec = { set: boolean; hint: string };
type PS = { default: string; paystack: { enabled: boolean; publicKey: string; secretKey: Sec; webhookSecret: Sec }; flutterwave: { enabled: boolean; publicKey: string; secretKey: Sec; secretHash: Sec } };
function Secret({ name, label, s, help }: { name: string; label: string; s: Sec; help?: string }) {
  return <label>{label}<input name={name} type="password" autoComplete="off" placeholder={s.set ? `Saved (${s.hint}). Type to replace.` : "Paste here"} />{help && <span className="hint">{help}</span>}</label>;
}
export function PaymentsForm({ p, origin }: { p: PS; origin?: string }) {
  const r = useRouter(), msg = useMsg(), [res, setRes] = useState<Record<string, string>>({});
  const [base, setBase] = useState(origin || ""); useEffect(() => setBase(location.origin), []);
  const save = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const f = new FormData(e.currentTarget), g = (k: string) => String(f.get(k) || "");
    const body = { payments: { default: g("default"),
      paystack: { enabled: f.get("ps_on") === "on", publicKey: g("ps_pub"), secretKey: g("ps_sec"), webhookSecret: g("ps_hook") },
      flutterwave: { enabled: f.get("fw_on") === "on", publicKey: g("fw_pub"), secretKey: g("fw_sec"), secretHash: g("fw_hash") } } };
    const { ok, j } = await api("/api/admin/settings", "PATCH", body); if (ok) { msg.ok("Saved. Keys are stored encrypted."); (e.target as HTMLFormElement).querySelectorAll<HTMLInputElement>("input[type=password]").forEach((i) => (i.value = "")); r.refresh(); } else msg.no(j.error || "Could not save.");
  };
  const test = async (g: string) => { setRes((x) => ({ ...x, [g]: "Testing..." })); const { j } = await api("/api/admin/payments/test", "POST", { gateway: g }); setRes((x) => ({ ...x, [g]: (j.ok ? "Connected. " : "Failed. ") + (j.message || j.error || "") })); };
  return (
    <form className="aform" onSubmit={save}>
      <div className="card2"><h3>Paystack</h3>
        <label className="check"><input type="checkbox" name="ps_on" defaultChecked={p.paystack.enabled} /> Accept payments with Paystack</label>
        <label>Public key<input name="ps_pub" defaultValue={p.paystack.publicKey} placeholder="pk_live_..." /></label>
        <Secret name="ps_sec" label="Secret key" s={p.paystack.secretKey} help="Starts with sk_live_ or sk_test_. Paystack dashboard, Settings, API Keys." />
        <p className="mutedp small">Webhook URL for Paystack (Settings, API Keys, Webhook URL):</p><code className="url">{base}/api/pay/webhook/paystack</code>
        <div className="row"><button type="button" className="btnline" onClick={() => test("paystack")}>Test connection</button><span className="mutedp small">{res.paystack}</span></div></div>
      <div className="card2"><h3>Flutterwave</h3>
        <label className="check"><input type="checkbox" name="fw_on" defaultChecked={p.flutterwave.enabled} /> Accept payments with Flutterwave</label>
        <label>Public key<input name="fw_pub" defaultValue={p.flutterwave.publicKey} placeholder="FLWPUBK-..." /></label>
        <Secret name="fw_sec" label="Secret key" s={p.flutterwave.secretKey} help="Starts with FLWSECK-. Flutterwave dashboard, Settings, API keys." />
        <Secret name="fw_hash" label="Secret hash" s={p.flutterwave.secretHash} help="You make this up (any long random text). Enter the same text in Flutterwave, Settings, Webhooks." />
        <p className="mutedp small">Webhook URL for Flutterwave:</p><code className="url">{base}/api/pay/webhook/flutterwave</code>
        <div className="row"><button type="button" className="btnline" onClick={() => test("flutterwave")}>Test connection</button><span className="mutedp small">{res.flutterwave}</span></div></div>
      <label>Gateway shown first<select name="default" defaultValue={p.default}><option value="paystack">Paystack</option><option value="flutterwave">Flutterwave</option></select></label>
      {msg.el}<button className="btn">Save payment settings</button>
    </form>
  );
}

type Ch = { id: string; name: string; file: string; scale: number; y: number; enabled: boolean; builtin?: boolean };
export function HeroForm({ s }: { s: { heroTitle: string; heroText: string; showSwitcher: boolean; showTools: boolean; autoSwitch: boolean; switchSeconds: number; heroCharacter: string; characters: Ch[] } }) {
  const r = useRouter(), msg = useMsg(), [chars, setChars] = useState(s.characters), [def, setDef] = useState(s.heroCharacter), [adding, setAdding] = useState(false);
  const set = (id: string, p: Partial<Ch>) => setChars((c) => c.map((x) => (x.id === id ? { ...x, ...p } : x)));
  const save = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const f = new FormData(e.currentTarget);
    const { ok, j } = await api("/api/admin/settings", "PATCH", { heroTitle: f.get("heroTitle"), heroText: f.get("heroText"), showSwitcher: f.get("sw") === "on", showTools: f.get("tools") === "on", autoSwitch: f.get("auto") === "on", switchSeconds: f.get("secs"), heroCharacter: def, characters: chars });
    ok ? (msg.ok("Saved."), r.refresh()) : msg.no(j.error || "Could not save.");
  };
  const add = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setAdding(true); const form = e.currentTarget, fd = new FormData(form), file = fd.get("file") as File, main = await directPut(file, "character");
    if (main && "error" in main) { setAdding(false); msg.no(main.error); return; }
    const { ok, j } = main ? await api("/api/admin/characters", "POST", { ref: main.ref, name: fd.get("name") }) : await api("/api/admin/characters", "POST", fd);
    setAdding(false); ok ? (r.refresh(), form.reset()) : msg.no(j.error || "Upload failed.");
  };
  const rm = async (id: string) => { if (!confirm("Remove this character?")) return; const { ok, j } = await api(`/api/admin/characters?id=${id}`, "DELETE"); ok ? (setChars((c) => c.filter((x) => x.id !== id)), r.refresh()) : msg.no(j.error || "Failed."); };
  return (<>
    <form className="aform" onSubmit={save}>
      <label>Headline<input name="heroTitle" defaultValue={s.heroTitle} maxLength={120} /></label>
      <label>Text under the headline<textarea name="heroText" rows={3} defaultValue={s.heroText} maxLength={300} /></label>
      <label className="check"><input type="checkbox" name="sw" defaultChecked={s.showSwitcher} /> Let visitors switch characters</label>
      <label className="check"><input type="checkbox" name="tools" defaultChecked={s.showTools} /> Show the character controls (move, turn, size, motions)</label>
      <div className="two"><label className="check"><input type="checkbox" name="auto" defaultChecked={s.autoSwitch} /> Switch characters automatically</label>
        <label>Seconds per character<input name="secs" type="number" min="4" max="60" defaultValue={s.switchSeconds} /></label></div>
      <p className="hint">When a visitor picks a character themselves, automatic switching stops for them. They can turn it back on with the Auto button.</p>
      <div className="card2"><h3>Characters</h3>
        {chars.map((c) => (
          <div className="chrow" key={c.id}>
            <label className="check"><input type="checkbox" checked={c.enabled} onChange={(e) => set(c.id, { enabled: e.target.checked })} /> On</label>
            <input value={c.name} onChange={(e) => set(c.id, { name: e.target.value })} aria-label="Name" />
            <label className="mini">Size<input type="number" step="0.05" min="0.3" max="3" value={c.scale} onChange={(e) => set(c.id, { scale: Number(e.target.value) })} /></label>
            <label className="mini">Height<input type="number" step="0.05" min="-1" max="1" value={c.y} onChange={(e) => set(c.id, { y: Number(e.target.value) })} /></label>
            <label className="check"><input type="radio" name="def" checked={def === c.id} onChange={() => setDef(c.id)} /> First shown</label>
            {!c.builtin && <button type="button" className="btnline sm danger" onClick={() => rm(c.id)}>Remove</button>}
          </div>))}
      </div>
      {msg.el}<button className="btn">Save home page</button>
    </form>
    <form className="card2 aform" onSubmit={add}><h3>Add a character</h3>
      <p className="mutedp">Upload a rigged human .glb that uses the Mixamo skeleton (a Mixamo or Avaturn export works). The site adds idle, walk and run motion itself.</p>
      <label>Name<input name="name" placeholder="Amara" maxLength={40} /></label><label>File<input name="file" type="file" accept=".glb" required /></label>
      <button className="btn" disabled={adding}>{adding ? "Uploading..." : "Add character"}</button></form>
  </>);
}

export function SettingsForm({ s }: { s: { defaultTheme: string; siteName: string; tagline: string; supportEmail: string; siteUrl: string; currency: string; maxDownloads: number; footerNote: string; email: { from: string; resendKey: Sec } } }) {
  const r = useRouter(), msg = useMsg(), pw = useMsg();
  const save = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const f = new FormData(e.currentTarget), g = (k: string) => String(f.get(k) || "");
    const { ok, j } = await api("/api/admin/settings", "PATCH", { defaultTheme: g("defaultTheme"), siteName: g("siteName"), tagline: g("tagline"), supportEmail: g("supportEmail"), siteUrl: g("siteUrl"), currency: g("currency"), maxDownloads: g("maxDownloads"), footerNote: g("footerNote"), email: { from: g("from"), resendKey: g("resendKey") } });
    ok ? (msg.ok("Saved."), r.refresh()) : msg.no(j.error || "Could not save.");
  };
  const change = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const f = new FormData(e.currentTarget); const { ok, j } = await api("/api/auth/password", "POST", { current: f.get("current"), next: f.get("next") });
    ok ? (pw.ok("Password changed."), (e.target as HTMLFormElement).reset()) : pw.no(j.error || "Could not change it.");
  };
  return (<>
    <form className="aform" onSubmit={save}>
      <label>Site name<input name="siteName" defaultValue={s.siteName} maxLength={60} required /></label>
      <label>Tagline<input name="tagline" defaultValue={s.tagline} maxLength={120} /></label>
      <label>Public site address<input name="siteUrl" defaultValue={s.siteUrl} placeholder="https://yourshop.com" /><span className="hint">Used in payment return links and emails. Required once the site is live.</span></label>
      <label>Support email<input name="supportEmail" type="email" defaultValue={s.supportEmail} /></label>
      <div className="two"><label>Default currency<select name="currency" defaultValue={s.currency}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></label>
        <label>Downloads allowed per purchase<input name="maxDownloads" type="number" min="1" max="1000" defaultValue={s.maxDownloads} /></label></div>
      <label>Default look for new visitors<select name="defaultTheme" defaultValue={s.defaultTheme}><option value="system">Match their device</option><option value="light">Light</option><option value="dark">Dark</option></select><span className="hint">Visitors can change it with the sun and moon button in the header.</span></label>
      <label>Footer note<input name="footerNote" defaultValue={s.footerNote} maxLength={200} /></label>
      <div className="card2"><h3>Purchase emails (optional)</h3><p className="mutedp">With a Resend key, buyers get their download link by email. Without one, they still get it on the order page.</p>
        <label>From address<input name="from" defaultValue={s.email.from} placeholder="Shop <orders@yourdomain.com>" /></label>
        <Secret name="resendKey" label="Resend API key" s={s.email.resendKey} /></div>
      {msg.el}<button className="btn">Save settings</button>
    </form>
    <form className="card2 aform" onSubmit={change}><h3>Change password</h3>
      <label>Current password<input name="current" type="password" autoComplete="current-password" required /></label>
      <label>New password (10+ characters)<input name="next" type="password" autoComplete="new-password" minLength={10} required /></label>{pw.el}<button className="btn">Change password</button></form>
  </>);
}

export function LegalForm({ v, titles }: { v: Record<string, string>; titles: Record<string, string> }) {
  const r = useRouter(), msg = useMsg();
  const save = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const f = new FormData(e.currentTarget);
    const { ok, j } = await api("/api/admin/settings", "PATCH", { legal: Object.fromEntries(Object.keys(titles).map((k) => [k, String(f.get(k) || "")])) });
    ok ? (msg.ok("Saved."), r.refresh()) : msg.no(j.error || "Could not save.");
  };
  return (
    <form className="aform" onSubmit={save} style={{ maxWidth: 820 }}>
      {Object.entries(titles).map(([k, t]) => <label key={k}>{t} <a className="hint" href={`/legal/${k}`} target="_blank">View page</a><textarea name={k} rows={12} defaultValue={v[k]} /></label>)}
      {msg.el}<button className="btn">Save legal pages</button>
    </form>
  );
}
