"use client";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, useAnimations, useGLTF } from "@react-three/drei";
import { Suspense, useEffect, useRef } from "react";
import * as THREE from "three";

// A rigged human that reacts to the cursor: it turns to face it, its head follows, and the animation blends
// between idle, walk and run depending on how fast the cursor is moving.
function Human() {
  const group = useRef<THREE.Group>(null!);
  const { scene, animations } = useGLTF("/models/Soldier.glb");
  const { actions } = useAnimations(animations, group);
  const { viewport, size } = useThree();
  const state = useRef({ cur: "Idle", since: 0, v: 0, last: new THREE.Vector2(), yaw: 0, hy: 0, hp: 0 });
  const head = useRef<THREE.Object3D | null>(null);
  useEffect(() => {
    scene.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.castShadow = true; if ((o as THREE.Bone).isBone && /Head$/.test(o.name)) head.current = o; });
    actions.Idle?.reset().play();
  }, [scene, actions]);
  useFrame((s, dt) => {
    const st = state.current, p = s.pointer, t = s.clock.elapsedTime;
    const x = size.width > 900 ? viewport.width * 0.2 : 0;
    group.current.position.x = x;
    st.v = THREE.MathUtils.lerp(st.v, p.distanceTo(st.last) / Math.max(dt, 1e-3), 0.15); st.last.copy(p);
    const want = st.v > 2.2 ? "Run" : st.v > 0.5 ? "Walk" : "Idle";
    if (want !== st.cur && t - st.since > 0.45 && actions[want]) {
      actions[st.cur]?.fadeOut(0.35); actions[want]!.reset().fadeIn(0.35).play(); st.cur = want; st.since = t;
    }
    const dx = p.x * viewport.width * 0.5 - x;
    const yaw = THREE.MathUtils.clamp(Math.atan2(dx, 3.2), -1.1, 1.1);
    st.yaw = THREE.MathUtils.damp(st.yaw, yaw, 4, dt); group.current.rotation.y = st.yaw * 0.7;
    st.hy = THREE.MathUtils.damp(st.hy, THREE.MathUtils.clamp(yaw - st.yaw * 0.7, -0.7, 0.7), 6, dt);
    st.hp = THREE.MathUtils.damp(st.hp, -p.y * 0.35, 6, dt);
  });
  // runs after the mixer has written this frame's pose, so the head offset sits on top of the animation
  useFrame(() => { if (head.current) { head.current.rotateY(state.current.hy); head.current.rotateX(state.current.hp); } });
  return <group ref={group} position={[0, -1.55, 0]} scale={1.55}><primitive object={scene} /></group>;
}
export default function Hero() {
  return (
    <Canvas camera={{ position: [0, 0.3, 6.4], fov: 30 }} dpr={[1, 2]} shadows>
      <Environment preset="studio" />
      <directionalLight position={[3, 5, 4]} intensity={1.4} castShadow />
      <Suspense fallback={null}><Human /></Suspense>
      <ContactShadows position={[0, -1.55, 0]} opacity={0.35} scale={9} blur={2.4} far={3} />
    </Canvas>
  );
}
