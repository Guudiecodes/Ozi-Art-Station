"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIES, LICENSES } from "@/lib/lists";
const OK = /\.(glb|hdr|jpe?g|png|webp)$/i;
export default function Upload() {
  const r = useRouter(), form = useRef<HTMLFormElement>(null);
  const [file, setFile] = useState<File | null>(null), [pct, setPct] = useState(0), [err, setErr] = useState(""), [busy, setBusy] = useState(false), [drag, setDrag] = useState(false);
  const pick = (f?: File) => { if (!f) return; if (!OK.test(f.name)) return setErr("Choose a .glb, .hdr, .jpg, .png or .webp file."); setErr(""); setFile(f); const t = form.current?.elements.namedItem("title") as HTMLInputElement; if (t && !t.value) t.value = f.name.replace(/\.[^.]+$/, ""); };
  const submit = (e: React.FormEvent) => {
    e.preventDefault(); if (!file) return setErr("Choose a file first.");
    const fd = new FormData(form.current!); fd.set("file", file);
    const x = new XMLHttpRequest(); x.open("POST", "/api/assets"); setBusy(true);
    x.upload.onprogress = (ev) => setPct(Math.round((ev.loaded / ev.total) * 100));
    x.onload = () => { setBusy(false); const j = JSON.parse(x.responseText || "{}"); if (x.status === 201) { r.push(`/a/${j.slug}`); r.refresh(); } else if (x.status === 401) r.push("/login?next=/upload"); else setErr(j.error || "Upload failed."); };
    x.onerror = () => { setBusy(false); setErr("Network error. Try again."); }; x.send(fd);
  };
  return (
    <main className="wrap narrow pagetop">
      <h1 className="title">Upload</h1><p className="lead">Models (.glb), HDRIs (.hdr) and textures (.jpg, .png, .webp). The type is detected from the file.</p>
      <form ref={form} onSubmit={submit} className="form">
        <div className={`drop ${drag ? "on" : ""}`} onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files[0]); }}>
          <p>{file ? `${file.name} (${(file.size / 1048576).toFixed(1)} MB)` : "Drop a file here"}</p>
          <label className="btnline">Choose file<input type="file" accept=".glb,.hdr,.jpg,.jpeg,.png,.webp" hidden onChange={(e) => pick(e.target.files?.[0])} /></label>
        </div>
        <input name="title" placeholder="Title" required />
        <textarea name="blurb" placeholder="Description" rows={3} />
        <select name="category" defaultValue="Props">{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
        <select name="license" defaultValue="CC0">{LICENSES.map((c) => <option key={c}>{c}</option>)}</select>
        <input name="tags" placeholder="Tags, separated by commas" />
        {busy && <div className="loader wide"><i style={{ width: `${pct}%` }} /></div>}
        {err && <p className="err">{err}</p>}
        <button className="btn" disabled={busy}>{busy ? `Uploading ${pct}%` : "Publish"}</button>
      </form>
    </main>
  );
}
