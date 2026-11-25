"use client";
import { Canvas } from "@react-three/fiber";
import { Environment, OrbitControls } from "@react-three/drei";
import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { PublicAsset } from "@/lib/db";
import type { Me } from "@/lib/auth";
import Glb from "./Glb";

const Ready = ({ on }: { on: () => void }) => { useEffect(on, [on]); return null; };
const LABEL = { model: "Model", hdri: "HDRI", texture: "Texture" };

// WebGL canvases mount only while near the viewport (browsers cap live contexts), show a shimmer while the file loads,
// then the model drops in and can be dragged like in Sketchfab.
export default function Card({ a, me }: { a: PublicAsset; me: Me }) {
  const r = useRouter(), box = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false), [ready, setReady] = useState(false), [hover, setHover] = useState(false);
  const [likes, setLikes] = useState(a.likes), [liked, setLiked] = useState(a.liked);
  useEffect(() => {
    if (a.type === "texture") return;
    const io = new IntersectionObserver(([e]) => { setNear(e.isIntersecting); if (!e.isIntersecting) setReady(false); }, { rootMargin: "300px" });
    io.observe(box.current!); return () => io.disconnect();
  }, [a.type]);
  const like = async () => {
    if (!me) return r.push("/login");
    const res = await fetch(`/api/assets/${a.id}/like`, { method: "POST" });
    if (res.ok) { const j = await res.json(); setLikes(j.likes); setLiked(j.liked); }
  };
  const done = () => setReady(true);
  return (
    <article className="card">
      <div ref={box} className="thumb" onPointerEnter={() => setHover(true)} onPointerLeave={() => setHover(false)}>
        {a.type === "texture" ? <img src={a.file} alt={a.title} loading="lazy" /> : (<>
          {!ready && <div className="shimmer" aria-hidden />}
          {near && a.type === "model" && (
            <Canvas camera={{ position: [0, 0.4, 3.6], fov: 38 }} dpr={[1, 1.5]}>
              <Environment preset="studio" />
              <Suspense fallback={null}><Glb url={a.file} onReady={done} /></Suspense>
              <OrbitControls enableZoom={false} enablePan={false} enableDamping dampingFactor={0.06} autoRotate={!hover} autoRotateSpeed={1.2} />
            </Canvas>
          )}
          {near && a.type === "hdri" && (
            <Canvas camera={{ position: [0, 0, 3.2], fov: 38 }} dpr={[1, 1.5]}>
              <Suspense fallback={null}><Environment files={a.file} /><mesh><sphereGeometry args={[1, 64, 64]} /><meshStandardMaterial color="#fff" metalness={1} roughness={0.03} /></mesh><Ready on={done} /></Suspense>
              <OrbitControls enableZoom={false} enablePan={false} enableDamping autoRotate={!hover} autoRotateSpeed={2} />
            </Canvas>
          )}
          {ready && <span className="hint">Drag to rotate</span>}
        </>)}
        <span className="tag">{LABEL[a.type]}</span>
        <Link href={`/a/${a.slug}`} className="open" aria-label={`Open ${a.title}`}>Open</Link>
      </div>
      <div className="meta">
        <Link href={`/a/${a.slug}`}><strong>{a.title}</strong><small>by {a.owner} · {a.views} views</small></Link>
        <button className={`like ${liked ? "on" : ""}`} onClick={like} aria-pressed={liked} aria-label={`Like ${a.title}`}>♥ {likes}</button>
      </div>
    </article>
  );
}
