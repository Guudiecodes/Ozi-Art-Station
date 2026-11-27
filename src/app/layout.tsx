import "./globals.css";
import { cookies } from "next/headers";
import { currentUser, toMe } from "@/lib/auth";
import { publicSettings, ready } from "@/lib/db";
import { Footer, Header } from "@/components/Chrome";
import Smooth from "@/components/Smooth";

export const dynamic = "force-dynamic";
export async function generateMetadata() { await ready(); const s = publicSettings(); return { title: { default: s.siteName, template: `%s | ${s.siteName}` }, description: `${s.tagline}. Preview 3D models, HDRIs and textures in your browser, then download or buy them.`, metadataBase: new URL(s.siteUrl || "http://localhost:3000"), openGraph: { siteName: s.siteName, type: "website" } }; }
export default async function RootLayout({ children }: { children: React.ReactNode }) { await ready();
  const me = toMe(await currentUser()), s = publicSettings(), c = (await cookies()).get("az_theme")?.value;
  const pref = c === "light" || c === "dark" || c === "system" ? c : s.defaultTheme;
  // Runs before the first paint: resolves "match device" so there is no white flash in dark mode.
  const boot = `try{var p=${JSON.stringify(pref)};var d=document.documentElement;d.dataset.pref=p;d.dataset.theme=p==="system"?(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):p}catch(e){}`;
  return (
    <html lang="en" data-theme={pref === "dark" ? "dark" : "light"} data-pref={pref} suppressHydrationWarning><head>
      <script dangerouslySetInnerHTML={{ __html: boot }} />
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;600;800&family=Newsreader:ital,wght@0,400;1,400&display=swap" rel="stylesheet" />
    </head><body>
      <Smooth /><Header me={me} siteName={s.siteName} />{children}<Footer siteName={s.siteName} note={s.footerNote} email={s.supportEmail} owner={!!me} />
    </body></html>
  );
}
