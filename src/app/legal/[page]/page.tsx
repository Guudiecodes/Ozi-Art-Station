import { notFound } from "next/navigation";
import { getSettings } from "@/lib/db";
import { LEGAL_DEFAULT, LEGAL_TITLES, fillLegal } from "@/lib/legal";
export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ page: string }> }) { const p = (await params).page; return { title: LEGAL_TITLES[p] ?? "Not found" }; }
export default async function Legal({ params }: { params: Promise<{ page: string }> }) {
  const p = (await params).page; if (!LEGAL_TITLES[p]) notFound();
  const s = getSettings(), raw = fillLegal((s.legal as Record<string, string>)[p] || LEGAL_DEFAULT[p], s.siteName, s.supportEmail);
  const blocks = raw.split(/\n{2,}|\n(?=# )/).map((b) => b.trim()).filter(Boolean);
  return (
    <main className="wrap narrow pagetop legal2">
      <h1 className="title">{LEGAL_TITLES[p]}</h1>
      {blocks.map((b, i) => b.startsWith("# ") ? <h2 key={i}>{b.slice(2)}</h2> : <p key={i} className="lead">{b}</p>)}
    </main>
  );
}
