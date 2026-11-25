import { notFound } from "next/navigation";
import Link from "next/link";
import Viewer from "@/components/Viewer";
import { assets } from "@/data/assets";
export function generateStaticParams() { return assets.map((a) => ({ slug: a.slug })); }
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = assets.find((x) => x.slug === slug);
  if (!a) notFound();
  return (
    <main className="wrap">
      <Link href="/" className="back">Back to library</Link>
      <h1 className="title">{a.title}</h1>
      <Viewer asset={a} />
      <p className="blurb">{a.blurb}</p>
      <dl className="facts"><dt>Author</dt><dd>{a.author}</dd><dt>License</dt><dd>{a.license}</dd><dt>Category</dt><dd>{a.category}</dd><dt>Tags</dt><dd>{a.tags.join(", ")}</dd></dl>
    </main>
  );
}
