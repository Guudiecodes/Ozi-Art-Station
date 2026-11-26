import Link from "next/link";
export default function NotFound() {
  return (<main className="wrap narrow authbox"><h1 className="title">Page not found</h1><p className="lead">That link may be old, or the asset is no longer for sale.</p><div className="row"><Link className="btn" href="/explore">Browse the library</Link><Link className="btnline lg" href="/">Home</Link></div></main>);
}
