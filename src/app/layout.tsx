import "./globals.css";
import { currentUser, toMe } from "@/lib/auth";
import { Footer, Header } from "@/components/Chrome";
import Smooth from "@/components/Smooth";
export const metadata = { title: "ModelHub: 3D models, HDRIs and textures", description: "Upload, inspect in the browser and share 3D assets." };
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const me = toMe(await currentUser());
  return (
    <html lang="en"><head>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;600;800&family=Newsreader:ital,wght@0,400;1,400&display=swap" rel="stylesheet" />
    </head><body>
      <Smooth /><Header me={me} />{children}<Footer />
    </body></html>
  );
}
