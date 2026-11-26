import "./globals.css";
import { currentUser, toMe } from "@/lib/auth";
import { publicSettings } from "@/lib/db";
import { Footer, Header } from "@/components/Chrome";
import Smooth from "@/components/Smooth";

export const dynamic = "force-dynamic";
export function generateMetadata() { const s = publicSettings(); return { title: { default: s.siteName, template: `%s | ${s.siteName}` }, description: `${s.tagline}. Preview 3D models, HDRIs and textures in your browser, then download or buy them.`, metadataBase: new URL(s.siteUrl || "http://localhost:3000"), openGraph: { siteName: s.siteName, type: "website" } }; }
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const me = toMe(await currentUser()), s = publicSettings();
  return (
    <html lang="en"><head>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;600;800&family=Newsreader:ital,wght@0,400;1,400&display=swap" rel="stylesheet" />
    </head><body>
      <Smooth /><Header me={me} siteName={s.siteName} />{children}<Footer siteName={s.siteName} note={s.footerNote} email={s.supportEmail} owner={!!me} />
    </body></html>
  );
}
