import { UploadForm } from "@/components/AdminForms";
import { getSettings, ready } from "@/lib/db";
export const dynamic = "force-dynamic";
export default async function Upload() { await ready(); return (<><h1 className="ah">Upload</h1><UploadForm currency={getSettings().currency} /></>); }
