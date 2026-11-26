"use client";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";

export type Mode = "original" | "clay" | "chrome";
const bounce = (t: number) => { // ease-out bounce: the model drops in and settles
  const n = 7.5625, d = 2.75;
  if (t < 1 / d) return n * t * t; if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
  if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375; return n * (t -= 2.625 / d) * t + 0.984375;
};
const mats = (m: THREE.Material | THREE.Material[]) => (Array.isArray(m) ? m : [m]);

// Loads a GLB, centres it, scales it to a standard size, and (optionally) drops it in.
// Rendered inside <Suspense>, so it mounts only after the file has finished loading.
export default function Glb({ url, onReady, onFit, onStats, onPoint, mode = "original", wire = false, drop = true }: {
  url: string; onReady?: () => void; onFit?: (height: number) => void; onStats?: (s: { tris: number }) => void;
  onPoint?: (p: THREE.Vector3) => void; mode?: Mode; wire?: boolean; drop?: boolean;
}) {
  const { scene } = useGLTF(url);
  const group = useRef<THREE.Group>(null!), t0 = useRef<number | null>(null);
  const clay = useMemo(() => new THREE.MeshStandardMaterial({ color: "#d8d8d8", roughness: 0.85, metalness: 0 }), []);
  const chrome = useMemo(() => new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.04, metalness: 1 }), []);
  const m = useMemo(() => {
    const c = clone(scene) as THREE.Group; let tris = 0;
    c.traverse((o) => {
      const me = o as THREE.Mesh; if (!me.isMesh) return;
      me.material = Array.isArray(me.material) ? me.material.map((x) => x.clone()) : me.material.clone();
      me.userData.orig = me.material; me.castShadow = true;
      const g = me.geometry; tris += (g.index ? g.index.count : g.getAttribute("position").count) / 3;
    });
    c.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(c, true), size = box.getSize(new THREE.Vector3()), ctr = box.getCenter(new THREE.Vector3());
    const s = 1.8 / (Math.max(size.x, size.y, size.z) || 1);
    return { c, s, ctr, tris: Math.round(tris), h: size.y * s };
  }, [scene]);
  useLayoutEffect(() => {
    m.c.traverse((o) => {
      const me = o as THREE.Mesh; if (!me.isMesh) return;
      const orig = me.userData.orig as THREE.Material | THREE.Material[];
      me.material = mode === "clay" ? clay : mode === "chrome" ? chrome : orig;
      for (const x of [...mats(orig), clay, chrome]) (x as THREE.MeshStandardMaterial).wireframe = wire;
    });
  }, [m, mode, wire, clay, chrome]);
  useEffect(() => { onReady?.(); onFit?.(m.h); onStats?.({ tris: m.tris }); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [m]);
  useEffect(() => () => { m.c.traverse((o) => { const me = o as THREE.Mesh; if (me.isMesh) mats(me.userData.orig).forEach((x: THREE.Material) => x.dispose()); }); }, [m]);
  useFrame((s) => {
    if (!drop) return; if (t0.current === null) t0.current = s.clock.elapsedTime;
    const t = Math.min(1, (s.clock.elapsedTime - t0.current) / 0.9);
    group.current.position.y = (1 - bounce(t)) * 1.5;
  });
  return (
    <group ref={group} position={[0, drop ? 1.5 : 0, 0]}>
      <group scale={m.s}>
        <primitive object={m.c} position={[-m.ctr.x, -m.ctr.y, -m.ctr.z]} onDoubleClick={onPoint ? (e: { stopPropagation: () => void; point: THREE.Vector3 }) => { e.stopPropagation(); onPoint(e.point); } : undefined} />
      </group>
    </group>
  );
}
