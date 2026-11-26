"use client";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, useAnimations, useGLTF, useProgress } from "@react-three/drei";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { facing, pick, retarget } from "@/lib/retarget";
import { Puppet } from "@/lib/puppet";
import Light from "./Light";
import Safe from "./Safe";

type Ch = { id: string; name: string; file: string; scale: number; y: number; note?: string };
type Ptr = { x: number; y: number; t: number };
const PACK = "/characters/Soldier.glb"; // shared idle / walk / run clips for rigs that have none of their own
const HEIGHT = 2.65, GROUND = -1.5;

// A person who is always alive and can be played with. The idle loop runs with or without the cursor; the head and body follow the cursor;
// the character strolls toward it when it moves; and it waves, stretches and cheers on its own. Grab a hand or foot, rub the belly, tap the head (see lib/puppet.ts).
function Human({ ch, ptr, busy, onReady, onTouch }: { ch: Ch; ptr: React.MutableRefObject<Ptr>; busy: React.MutableRefObject<number>; onReady: () => void; onTouch: () => void }) {
  const { scene, animations } = useGLTF(ch.file);
  const pack = useGLTF(PACK);
  const { viewport, size, camera, gl } = useThree();
  const outer = useRef<THREE.Group>(null!), inner = useRef<THREE.Group>(null!);
  const model = useMemo(() => clone(scene) as THREE.Group, [scene]);
  const fit = useMemo(() => {
    // Skinned meshes report a misleading bounding box, so measure the skeleton instead: top of the head to the tips of the feet.
    model.updateWorldMatrix(true, true);
    let lo = Infinity, hi = -Infinity; const v = new THREE.Vector3();
    model.traverse((o) => { if ((o as THREE.Bone).isBone) { v.setFromMatrixPosition(o.matrixWorld); lo = Math.min(lo, v.y); hi = Math.max(hi, v.y); } });
    if (!isFinite(lo) || hi - lo < 1e-6) { const b = new THREE.Box3().setFromObject(model, true); lo = b.min.y; hi = b.max.y; }
    const h = (hi - lo) * 1.03 || 1, k = (HEIGHT / h) * ch.scale;
    return { k, y: GROUND - lo * k + ch.y };
  }, [model, ch.scale, ch.y]);
  const turned = useMemo(() => facing(model) < 0, [model]); // a rig exported facing backwards is turned round so it always faces the viewer
  const clips = useMemo(() => {
    const own = [pick(animations, /^idle$/i), pick(animations, /^walk$/i), pick(animations, /^run$/i)];
    const base = own.every(Boolean) ? (own as THREE.AnimationClip[]) : retarget([pick(pack.animations, /^idle$/i)!, pick(pack.animations, /^walk$/i)!, pick(pack.animations, /^run$/i)!], pack.scene, model, pick(pack.animations, /t-?pose/i), pick(animations, /t-?pose/i));
    return base.map((c, i) => { const n = c.clone(); n.name = ["Idle", "Walk", "Run"][i]; return n; });
  }, [animations, pack, model]);
  const { actions } = useAnimations(clips, inner);
  const puppet = useMemo(() => { const p = new Puppet(model); p.H = HEIGHT * ch.scale; return p; }, [model, ch.scale]);
  const bones = useMemo(() => {
    const f = (re: RegExp) => { let r: THREE.Object3D | null = null; model.traverse((o) => { if (!r && (o as THREE.Bone).isBone && re.test(o.name)) r = o; }); return r as THREE.Object3D | null; };
    return { head: f(/Head$/), neck: f(/Neck$/), spine: f(/Spine2$/) };
  }, [model]);
  const st = useRef({ cur: "", since: 0, v: 0, px: 0, py: 0, yaw: 0, hy: 0, hp: 0, born: -1 });

  useEffect(() => {
    model.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.frustumCulled = false; } });
    if (actions.Idle) { actions.Idle.reset().play(); st.current.cur = "Idle"; }
    onReady();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, actions]);

  // Pointer play: grab hands and feet, rub the belly, tap the head. Hit areas are capsules along the bones.
  useEffect(() => {
    const dom = gl.domElement, rc = new THREE.Raycaster(), v2 = new THREE.Vector2(), dir = new THREE.Vector3(); let raf = 0;
    const rayAt = (cx: number, cy: number) => { const r = dom.getBoundingClientRect(); v2.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1); rc.setFromCamera(v2, camera); return rc.ray; };
    const down = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      const h = puppet.hit(rayAt(e.clientX, e.clientY)); if (!h) return;
      puppet.down(h, rc.ray, camera.getWorldDirection(dir), e.clientX, e.clientY);
      try { dom.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
      dom.style.cursor = "grabbing"; busy.current = performance.now(); onTouch(); e.preventDefault();
    };
    const move = (e: PointerEvent) => {
      if (puppet.dragging) { puppet.move(rayAt(e.clientX, e.clientY), e.clientX, e.clientY); busy.current = performance.now(); return; }
      if (e.pointerType !== "mouse" || raf) return;
      raf = requestAnimationFrame(() => { raf = 0; const h = puppet.hit(rayAt(e.clientX, e.clientY)); dom.style.cursor = h ? (h.kind === "belly" ? "pointer" : "grab") : ""; });
    };
    const up = (e: PointerEvent) => { if (!puppet.dragging) return; puppet.up(); dom.style.cursor = ""; busy.current = performance.now(); try { dom.releasePointerCapture(e.pointerId); } catch { /* already released */ } };
    const touch = (e: TouchEvent) => { const t = e.touches[0]; if (t && puppet.hit(rayAt(t.clientX, t.clientY))) e.preventDefault(); }; // grabbing the character must not scroll the page
    dom.addEventListener("pointerdown", down); dom.addEventListener("pointermove", move); dom.addEventListener("pointerup", up); dom.addEventListener("pointercancel", up); dom.addEventListener("touchstart", touch, { passive: false });
    return () => { cancelAnimationFrame(raf); dom.style.cursor = ""; dom.removeEventListener("pointerdown", down); dom.removeEventListener("pointermove", move); dom.removeEventListener("pointerup", up); dom.removeEventListener("pointercancel", up); dom.removeEventListener("touchstart", touch); };
  }, [puppet, camera, gl, busy, onTouch]);
  (typeof window !== "undefined") && ((window as unknown as { __puppet?: Puppet; __cam?: THREE.Camera }).__puppet = puppet, (window as unknown as { __cam?: THREE.Camera }).__cam = camera); // handles for automated tests

  useFrame((s, dt) => {
    const k = st.current, p = ptr.current, t = s.clock.elapsedTime, held = puppet.dragging;
    if (k.born < 0) k.born = t;
    const live = actions[k.cur || "Idle"]; if (live && !live.isRunning()) { live.reset().play(); k.cur = k.cur || "Idle"; } // keeps the loop alive if the mixer was reset
    const g = Math.min(1, (t - k.born) / 0.7); outer.current.scale.setScalar(0.9 + 0.1 * (1 - Math.pow(1 - g, 3)));
    const idle = performance.now() - p.t > 4000;                       // no cursor for 4 seconds: wander on our own
    const tx = held ? k.px : idle ? Math.sin(t * 0.4) * 0.5 : p.x, ty = held ? k.py : idle ? Math.sin(t * 0.6 + 1) * 0.1 : p.y; k.px = tx; k.py = ty;
    const base = size.width > 900 ? viewport.width * 0.2 : 0, x0 = outer.current.position.x, x1 = held ? x0 : THREE.MathUtils.damp(x0, base + tx * viewport.width * 0.1, 2.2, dt);
    outer.current.position.x = x1;                                      // strolls toward the cursor, walking while it travels
    k.v = THREE.MathUtils.lerp(k.v, Math.abs(x1 - x0) / Math.max(dt, 1e-3), 0.15);
    const want = !held && k.v > 0.3 ? "Walk" : "Idle";
    if (want !== k.cur && t - k.since > 0.5 && actions[want]) { actions[k.cur]?.fadeOut(0.35); actions[want]!.reset().fadeIn(0.35).play(); k.cur = want; k.since = t; }
    if (actions.Walk) actions.Walk.timeScale = THREE.MathUtils.clamp(k.v * 0.8, 0.6, 1.4);
    const dx = tx * viewport.width * 0.5 - x1, yaw = THREE.MathUtils.clamp(Math.atan2(dx, 3.2), -1, 1); // never past 57 degrees, so the character never turns its back
    k.yaw = THREE.MathUtils.damp(k.yaw, yaw, 4, dt); outer.current.rotation.y = k.yaw * 0.6;
    const L = puppet.headLook;
    k.hy = THREE.MathUtils.damp(k.hy, L.on ? L.yaw : THREE.MathUtils.clamp(yaw - k.yaw * 0.6, -0.8, 0.8), 6, dt);
    k.hp = THREE.MathUtils.damp(k.hp, L.on ? L.pitch : -ty * 0.3, 6, dt);
  });
  // Runs after the mixer has written this frame's pose, so play and the look-at offset sit on top of the animation.
  useFrame((s, dt) => {
    puppet.update(s.clock.elapsedTime, dt);
    const k = st.current, { head, neck, spine } = bones;
    spine?.rotateY(k.hy * 0.2); neck?.rotateY(k.hy * 0.3); neck?.rotateX(k.hp * 0.3); head?.rotateY(k.hy * 0.5 + puppet.headY); head?.rotateX(k.hp * 0.7 + puppet.headX);
  });
  return <group ref={outer}><group ref={inner} position={[0, fit.y, 0]} scale={fit.k} rotation={[0, turned ? Math.PI : 0, 0]}><primitive object={model} /></group></group>;
}

function Loading() { const { progress, active } = useProgress(); return active ? <div className="heroLoad" aria-label="Loading character"><div className="loader"><i style={{ width: `${progress}%` }} /></div></div> : null; }

export default function Hero({ characters, initial, showSwitcher, autoSwitch = true, switchSeconds = 9 }: { characters: Ch[]; initial: string; showSwitcher: boolean; autoSwitch?: boolean; switchSeconds?: number }) {
  const [active, setActive] = useState(initial), [failed, setFailed] = useState(false), [vis, setVis] = useState(true), [touched, setTouched] = useState(false);
  const [auto, setAuto] = useState(autoSwitch && characters.length > 1), [tick, setTick] = useState(0);
  const box = useRef<HTMLDivElement>(null), ptr = useRef<Ptr>({ x: 0, y: 0, t: 0 }), busy = useRef(0);
  // A visitor who picked a character by hand last time keeps it, and auto-switching stays off for them.
  useEffect(() => { try { const s = localStorage.getItem("az_char"); if (s && characters.some((c) => c.id === s)) { setActive(s); setAuto(false); } } catch { /* storage blocked */ } }, [characters]);
  useEffect(() => {
    const el = box.current!, io = new IntersectionObserver(([e]) => setVis(e.isIntersecting)); io.observe(el);
    const mv = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      ptr.current.x = THREE.MathUtils.clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1);
      ptr.current.y = THREE.MathUtils.clamp(-(((e.clientY - r.top) / r.height) * 2 - 1), -1, 1); ptr.current.t = performance.now();
    };
    window.addEventListener("pointermove", mv, { passive: true });
    return () => { io.disconnect(); window.removeEventListener("pointermove", mv); };
  }, []);
  // Auto-switch: every few seconds, unless the tab is hidden or someone is playing with the character.
  useEffect(() => {
    if (!auto || !vis || characters.length < 2) return;
    const i = characters.findIndex((c) => c.id === active), nxt = characters[(i + 1) % characters.length], ms = Math.max(4, switchSeconds) * 1000;
    const pre = setTimeout(() => useGLTF.preload(nxt.file), Math.max(0, ms - 4000));
    const id = setTimeout(() => { if (document.hidden || performance.now() - busy.current < 5000) { setActive((a) => a); setTick((n) => n + 1); return; } setFailed(false); setActive(nxt.id); }, ms);
    return () => { clearTimeout(pre); clearTimeout(id); };
  }, [auto, vis, active, characters, switchSeconds, tick]);
  const ch = characters.find((c) => c.id === active) ?? characters[0];
  const choose = (id: string) => { setFailed(false); setActive(id); setAuto(false); try { localStorage.setItem("az_char", id); } catch { /* storage blocked */ } };
  const toggleAuto = () => { const on = !auto; setAuto(on); try { if (on) localStorage.removeItem("az_char"); } catch { /* storage blocked */ } };
  const onTouch = useCallback(() => setTouched(true), []);
  return (
    <div ref={box} className="heroStage">
      <Safe fallback={<p className="mutedp pad">3D is not available in this browser.</p>}>
        <Canvas camera={{ position: [0, 0.3, 6.4], fov: 30 }} dpr={[1, 1.75]} shadows frameloop={vis ? "always" : "never"} gl={{ antialias: true, powerPreference: "high-performance" }}>
          <Light name="studio" />
          <directionalLight position={[3, 5, 4]} intensity={1.3} castShadow shadow-mapSize={[1024, 1024]} />
          <Safe key={ch.id} fallback={null} onError={() => setFailed(true)}><Suspense fallback={null}><Human ch={ch} ptr={ptr} busy={busy} onReady={() => setFailed(false)} onTouch={onTouch} /></Suspense></Safe>
          <ContactShadows position={[0, GROUND, 0]} opacity={0.35} scale={9} blur={2.4} far={3} />
        </Canvas>
      </Safe>
      <Loading />
      {failed && <p className="heroErr">This character could not load. Choose another one.</p>}
      <div className="heroBar">
        {!touched && <p className="heroHint">Grab a hand or foot. Rub the belly. Tap the head.</p>}
        {showSwitcher && characters.length > 1 && (
          <div className="switcher" role="group" aria-label="Choose a character">
            <button className={`auto ${auto ? "on" : ""}`} aria-pressed={auto} onClick={toggleAuto} title="Switch characters automatically">Auto{auto && <i key={`${ch.id}-${tick}`} style={{ animationDuration: `${Math.max(4, switchSeconds)}s` }} />}</button>
            {characters.map((c) => <button key={c.id} aria-pressed={c.id === ch.id} className={c.id === ch.id ? "cur" : ""} onClick={() => choose(c.id)} onPointerEnter={() => useGLTF.preload(c.file)}>{c.name}</button>)}
          </div>
        )}
      </div>
    </div>
  );
}
