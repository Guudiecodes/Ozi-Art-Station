import { UploadForm } from "@/components/AdminForms";
import { getSettings } from "@/lib/db";
export const dynamic = "force-dynamic";
export default function Upload() { return (<><h1 className="ah">Upload</h1><UploadForm currency={getSettings().currency} /></>); }
