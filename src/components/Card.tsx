"use client";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { PublicAsset } from "@/lib/db";
import { money } from "@/lib/lists";
import Glb from "./Glb";
import Light from "./Light";
import Safe from "./Safe";
import { Environment } from "@react-three/drei";

const Ready = ({ on }: { on: () => void }) => { useEffect(on, [on]); return null; };
const LABEL = { model: "Model", hdri: "HDRI", texture: "Texture" };

// WebGL canvases mount only while near the viewport (browsers cap live contexts), show a shimmer while the file loads,
// then the model drops in and can be dragged like in Sketchfab.
export default function Card({ a }: { a: PublicAsset }) {
  const box = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false), [ready, setReady] = useState(false), [hover, setHover] = useState(false);
  const [likes, setLikes] = useState(a.likes), [liked, setLiked] = useState(a.liked);
  useEffect(() => {
    if (a.type === "texture") return;
    const io = new IntersectionObserver(([e]) => { setNear(e.isIntersecting); if (!e.isIntersecting) setReady(false); }, { rootMargin: "300px" });
    io.observe(box.current!); return () => io.disconnect();
  }, [a.type]);
  const like = async () => {
    const res = await fetch(`/api/assets/${a.id}/like`, { method: "POST" });
    if (res.ok) { const j = await res.json(); setLikes(j.likes); setLiked(j.liked); }
  };
  const done = () => setReady(true);
  return (
    <article className="card">
      <div ref={box} className="thumb" data-lenis-prevent-wheel onPointerEnter={() => setHover(true)} onPointerLeave={() => setHover(false)}>
        {a.type === "texture" ? <img src={a.preview} alt={a.title} loading="lazy" /> : (<>
          {!ready && <div className="shimmer" aria-hidden />}
          {near && a.type === "model" && (
            <Safe fallback={null}><Canvas camera={{ position: [0, 0.4, 3.6], fov: 38 }} dpr={[1, 1.5]}>
              <Light name="studio" />
              <Suspense fallback={null}><Glb url={a.preview} onReady={done} /></Suspense>
              <OrbitControls enableZoom={false} enablePan={false} enableDamping dampingFactor={0.06} autoRotate={!hover} autoRotateSpeed={1.2} />
            </Canvas></Safe>
          )}
          {near && a.type === "hdri" && (
            <Safe fallback={null}><Canvas camera={{ position: [0, 0, 3.2], fov: 38 }} dpr={[1, 1.5]}>
              <Suspense fallback={null}><Environment files={a.preview} /><mesh><sphereGeometry args={[1, 64, 64]} /><meshStandardMaterial color="#fff" metalness={1} roughness={0.03} /></mesh><Ready on={done} /></Suspense>
              <OrbitControls enableZoom={false} enablePan={false} enableDamping autoRotate={!hover} autoRotateSpeed={2} />
            </Canvas></Safe>
          )}
          {ready && <span className="hint">Drag to rotate</span>}
        </>)}
        <span className="badges"><span className="tag">{LABEL[a.type]}</span><span className={`tag ${a.free ? "free" : "paid"}`}>{a.free ? "Free" : money(a.price, a.currency)}</span></span>
        <Link href={`/a/${a.slug}`} className="open" aria-label={`Open ${a.title}`}>Open</Link>
      </div>
      <div className="meta">
        <Link href={`/a/${a.slug}`}><strong>{a.title}</strong><small>{a.category} · {a.views} views</small></Link>
        <button className={`like ${liked ? "on" : ""}`} onClick={like} aria-pressed={liked} aria-label={`Like ${a.title}`}>{"♥"} {likes}</button>
      </div>
    </article>
  );
}
