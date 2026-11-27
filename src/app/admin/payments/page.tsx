import { PaymentsForm } from "@/components/AdminForms";
import { adminSettings, ready } from "@/lib/db";
export const dynamic = "force-dynamic";
export default async function Payments() { await ready();
  const s = adminSettings();
  return (<><h1 className="ah">Payments</h1><p className="mutedp">Paste your keys once and save. They are stored encrypted and never shown again. Use test keys first, then switch to live keys.</p><PaymentsForm p={s.payments} /></>);
}
