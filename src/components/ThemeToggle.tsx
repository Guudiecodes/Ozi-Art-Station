"use client";
import { useEffect, useState } from "react";

type Mode = "light" | "dark";
const dark = () => matchMedia("(prefers-color-scheme: dark)").matches;
function apply(m: Mode) {
  const d = document.documentElement; d.dataset.theme = m; d.dataset.pref = m;
  try { document.cookie = `az_theme=${m};path=/;max-age=31536000;samesite=lax`; } catch { /* cookies blocked */ }
}
const Icon = ({ m }: { m: Mode }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {m === "light" ? <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></> : <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" />}
  </svg>
);
// Light or dark. Until you press it the site follows your device (or the owner's default); after that your choice is remembered in a cookie, so the server renders it with no flash.
export default function ThemeToggle() {
  const [mode, setMode] = useState<Mode>("light");
  useEffect(() => {
    const el = document.documentElement; setMode(el.dataset.theme === "dark" ? "dark" : "light");
    const mo = new MutationObserver(() => setMode(el.dataset.theme === "dark" ? "dark" : "light")); mo.observe(el, { attributes: true, attributeFilter: ["data-theme"] });
    const mq = matchMedia("(prefers-color-scheme: dark)"), on = () => { if (el.dataset.pref === "system") el.dataset.theme = dark() ? "dark" : "light"; };
    mq.addEventListener("change", on); return () => { mo.disconnect(); mq.removeEventListener("change", on); };
  }, []);
  const go = () => apply(mode === "dark" ? "light" : "dark");
  return <button className="themebtn" onClick={go} aria-label={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"} title={mode === "dark" ? "Light mode" : "Dark mode"}><Icon m={mode} /></button>;
}
