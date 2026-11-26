"use client";
import { useMemo, useState } from "react";
import type { PublicAsset } from "@/lib/db";
import Card from "./Card";

const TYPES = [["all", "All"], ["model", "Models"], ["hdri", "HDRIs"], ["texture", "Textures"]] as const;
const SORTS = { new: "Newest", liked: "Most liked", viewed: "Most viewed", downloaded: "Most downloaded", cheap: "Price: low to high", pricey: "Price: high to low" } as const;
export default function Gallery({ items, type = "all", q = "" }: { items: PublicAsset[]; type?: string; q?: string }) {
  const [t, setT] = useState(type), [query, setQ] = useState(q), [cat, setCat] = useState("All"), [price, setPrice] = useState("all"), [sort, setSort] = useState<keyof typeof SORTS>("new");
  const cats = useMemo(() => ["All", ...Array.from(new Set(items.filter((i) => t === "all" || i.type === t).map((i) => i.category)))], [items, t]);
  const list = useMemo(() => items
    .filter((a) => (t === "all" || a.type === t) && (cat === "All" || a.category === cat) && (price === "all" || (price === "free" ? a.free : !a.free)) && (a.title + a.tags.join(" ") + a.category).toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => sort === "liked" ? b.likes - a.likes : sort === "viewed" ? b.views - a.views : sort === "downloaded" ? b.downloads - a.downloads : sort === "cheap" ? a.price - b.price : sort === "pricey" ? b.price - a.price : b.createdAt - a.createdAt), [items, t, cat, price, query, sort]);
  return (
    <section className="wrap">
      <div className="tabs" role="tablist">{TYPES.map(([k, l]) => <button key={k} role="tab" aria-selected={t === k} className={t === k ? "on" : ""} onClick={() => { setT(k); setCat("All"); }}>{l}</button>)}</div>
      <div className="bar">
        <input aria-label="Filter results" placeholder="Search by name, tag or category" value={query} onChange={(e) => setQ(e.target.value)} />
        <select aria-label="Category" value={cat} onChange={(e) => setCat(e.target.value)}>{cats.map((c) => <option key={c}>{c}</option>)}</select>
        <select aria-label="Price" value={price} onChange={(e) => setPrice(e.target.value)}><option value="all">Free and paid</option><option value="free">Free only</option><option value="paid">Paid only</option></select>
        <select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as keyof typeof SORTS)}>{Object.entries(SORTS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <span className="count">{list.length} result{list.length === 1 ? "" : "s"}</span>
      </div>
      {list.length === 0 && <p className="empty">Nothing matches. Clear the search or choose another category.</p>}
      <div className="grid">{list.map((a) => <Card key={a.id} a={a} />)}</div>
    </section>
  );
}
