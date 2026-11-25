"use client";
import Lenis from "lenis";
import { useEffect } from "react";
// Momentum scrolling for the whole site.
export default function Smooth() {
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const l = new Lenis({ lerp: 0.085, wheelMultiplier: 0.9 });
    let id = requestAnimationFrame(function raf(t) { l.raf(t); id = requestAnimationFrame(raf); });
    return () => { cancelAnimationFrame(id); l.destroy(); };
  }, []);
  return null;
}
