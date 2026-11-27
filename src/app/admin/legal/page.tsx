import { LegalForm } from "@/components/AdminForms";
import { getSettings, ready } from "@/lib/db";
import { LEGAL_DEFAULT, LEGAL_TITLES } from "@/lib/legal";
export const dynamic = "force-dynamic";
export default async function Legal() { await ready();
  const s = getSettings().legal as Record<string, string>;
  return (<><h1 className="ah">Legal pages</h1><p className="mutedp">Payment providers ask for terms, privacy and refund pages before they approve a live account. These start with plain text you can edit. Have it checked for your country. Use {"{site}"} and {"{email}"} to fill in your name and support email, and a line starting with # for a heading.</p>
    <LegalForm v={Object.fromEntries(Object.keys(LEGAL_TITLES).map((k) => [k, s[k] || LEGAL_DEFAULT[k]]))} titles={LEGAL_TITLES} /></>);
}
