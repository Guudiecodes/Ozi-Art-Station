"use client";
import Lenis from "lenis";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
// Momentum scrolling on the public pages. Admin and embed pages keep native scrolling.
export default function Smooth() {
  const path = usePathname(), off = path.startsWith("/admin") || path.startsWith("/embed");
  useEffect(() => {
    if (off || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const l = new Lenis({ lerp: 0.1, wheelMultiplier: 0.9 });
    let id = requestAnimationFrame(function raf(t) { l.raf(t); id = requestAnimationFrame(raf); });
    return () => { cancelAnimationFrame(id); l.destroy(); };
  }, [off]);
  return null;
}
