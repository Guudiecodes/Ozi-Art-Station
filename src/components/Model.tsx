"use client";
import { Canvas } from "@react-three/fiber";
import { Environment, OrbitControls } from "@react-three/drei";
import { useState } from "react";
import type { Asset, Kind } from "@/data/assets";

export function Shape({ kind }: { kind: Kind }) {
  switch (kind) {
    case "knot": return <torusKnotGeometry args={[0.7, 0.22, 220, 32]} />;
    case "crystal": return <icosahedronGeometry args={[1, 0]} />;
    case "orb": return <sphereGeometry args={[1, 64, 64]} />;
    case "ring": return <torusGeometry args={[0.9, 0.12, 32, 96]} />;
    case "cube": return <boxGeometry args={[1.4, 1.4, 1.4]} />;
    default: return <cylinderGeometry args={[0.35, 0.6, 2.2, 4]} />;
  }
}
// Card preview: spins only while hovered, so a page of cards stays cheap.
export function Thumb({ asset }: { asset: Asset }) {
  const [hot, setHot] = useState(false);
  return (
    <div className="thumb" onPointerEnter={() => setHot(true)} onPointerLeave={() => setHot(false)}>
      <Canvas camera={{ position: [0, 0, 3.6], fov: 40 }} dpr={1} frameloop={hot ? "always" : "demand"}>
        <Environment preset="studio" />
        <OrbitControls enableZoom={false} enablePan={false} autoRotate={hot} autoRotateSpeed={6} />
        <mesh><Shape kind={asset.kind} /><meshStandardMaterial color={asset.color} metalness={0.5} roughness={0.3} /></mesh>
      </Canvas>
    </div>
  );
}
