import { SettingsForm } from "@/components/AdminForms";
import { adminSettings } from "@/lib/db";
export const dynamic = "force-dynamic";
export default function Settings() { const s = adminSettings(); return (<><h1 className="ah">Settings</h1><SettingsForm s={s} /></>); }
