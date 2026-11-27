import { SettingsForm } from "@/components/AdminForms";
import { adminSettings, ready } from "@/lib/db";
export const dynamic = "force-dynamic";
export default async function Settings() { await ready(); const s = adminSettings(); return (<><h1 className="ah">Settings</h1><SettingsForm s={s} /></>); }
