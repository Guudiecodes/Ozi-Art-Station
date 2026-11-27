"use client";
import { useEffect, useState } from "react";
// True while the site is in dark mode. 3D scenes use it to pick lighting and shadows that read well on the current background.
export function useDark() {
  const [d, setD] = useState(false);
  useEffect(() => {
    const el = document.documentElement, f = () => setD(el.dataset.theme === "dark"); f();
    const mo = new MutationObserver(f); mo.observe(el, { attributes: true, attributeFilter: ["data-theme"] }); return () => mo.disconnect();
  }, []);
  return d;
}
