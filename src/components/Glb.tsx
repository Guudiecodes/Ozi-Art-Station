"use client";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

export type Mode = "original" | "clay" | "chrome";
export type Stats = { tris: number; size: [number, number, number] };

// Loads a GLB, centres and normalises it to a 2-unit box, and drops it in with a bounce once it has finished loading.
export default function Glb({ url, mode = "original", wire = false, onReady, onStats, onPick }: {
  url: string; mode?: Mode; wire?: boolean; onReady?: () => void; onStats?: (s: Stats) => void; onPick?: (p: THREE.Vector3) => void;
}) {
  const { scene } = useGLTF(url);
  const obj = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.userData.orig = m.material; });
    return c;
  }, [scene]);
  const fit = useMemo(() => {
    const b = new THREE.Box3().setFromObject(obj), size = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
    const s = 2 / Math.max(size.x, size.y, size.z, 1e-6);
    return { s, off: c.multiplyScalar(-s).toArray() as [number, number, number], size: size.toArray() as [number, number, number] };
  }, [obj]);
  useEffect(() => {
    let tris = 0;
    obj.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) tris += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3; });
    onStats?.({ tris: Math.round(tris), size: fit.size }); onReady?.();
  }, [obj, fit, onStats, onReady]);
  useEffect(() => {
    const made: THREE.Material[] = [];
    obj.traverse((o) => {
      const m = o as THREE.Mesh; if (!m.isMesh) return;
      const orig = m.userData.orig as THREE.Material | THREE.Material[];
      const mk = (x: THREE.Material) => {
        let n: THREE.Material;
        if (mode === "clay") n = new THREE.MeshStandardMaterial({ color: "#e8e8e8", roughness: 0.85 });
        else if (mode === "chrome") n = new THREE.MeshStandardMaterial({ color: "#ffffff", metalness: 1, roughness: 0.04 });
        else n = x.clone();
        (n as THREE.MeshStandardMaterial).wireframe = wire; made.push(n); return n;
      };
      m.material = Array.isArray(orig) ? orig.map(mk) : mk(orig);
    });
    return () => made.forEach((x) => x.dispose());
  }, [obj, mode, wire]);
  const g = useRef<THREE.Group>(null!), t = useRef(0);
  useFrame((_, dt) => {
    t.current = Math.min(t.current + dt / 1.1, 1);
    const x = t.current - 1, e = 1 + 2.70158 * x ** 3 + 1.70158 * x ** 2; // easeOutBack
    g.current.position.y = (1 - e) * 3.2; g.current.scale.setScalar(0.55 + 0.45 * Math.min(e, 1.05));
  });
  return (
    <group ref={g}>
      <group position={fit.off} scale={fit.s}
        onDoubleClick={onPick ? (e) => { e.stopPropagation(); onPick(e.point.clone().sub(new THREE.Vector3(...fit.off)).divideScalar(fit.s)); } : undefined}>
        <primitive object={obj} />
      </group>
    </group>
  );
}
