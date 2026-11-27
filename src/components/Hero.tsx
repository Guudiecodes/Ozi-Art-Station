"use client";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, useAnimations, useGLTF, useProgress } from "@react-three/drei";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { facing, pick, retarget } from "@/lib/retarget";
import { Puppet } from "@/lib/puppet";
import { useDark } from "@/lib/useDark";
import Light from "./Light";
import Safe from "./Safe";

type Ch = { id: string; name: string; file: string; scale: number; y: number; note?: string };
type Ptr = { x: number; y: number; t: number };
const PACK = "/characters/Soldier.glb"; // shared idle / walk / run clips for rigs that have none of their own
const HEIGHT = 2.65, GROUND = -1.5;

export type Mode = "pose" | "move" | "turn";
type Motion = "auto" | "idle" | "walk" | "run";
type Gest = "wave" | "cheer" | "stretch";
// Shared between the toolbar and the character; read every frame, so changing it never re-renders the 3D scene.
type Ctl = { mode: Mode; motion: Motion; size: number; offX: number; offZ: number; yaw: number; reset: number; gesture: { name: Gest; n: number } | null; holding: boolean };
const damp = THREE.MathUtils.damp, clamp = THREE.MathUtils.clamp;

// A person who is always alive and can be played with. The idle loop runs with or without the cursor, the head follows the cursor, and it waves, stretches and cheers by itself.
// Pose mode: grab a hand or foot, rub the belly, tap the head (lib/puppet.ts). Move mode: drag the character across the floor, and it walks or runs as it goes.
// Turn mode: drag sideways to face any direction. Pinch or Ctrl+scroll resizes. The toolbar adds motions and Reset.
function Human({ ch, ptr, busy, ctl, onReady, onTouch }: { ch: Ch; ptr: React.MutableRefObject<Ptr>; busy: React.MutableRefObject<number>; ctl: React.MutableRefObject<Ctl>; onReady: () => void; onTouch: () => void }) {
  const { scene, animations } = useGLTF(ch.file);
  const pack = useGLTF(PACK);
  const { viewport, size, camera, gl } = useThree();
  const outer = useRef<THREE.Group>(null!), inner = useRef<THREE.Group>(null!), vw = useRef(viewport.width);
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
  const st = useRef({ cur: "", since: 0, v: 0, vx: 0, vz: 0, px: 0, py: 0, face: 0, look: 0, hy: 0, hp: 0, born: -1, gn: 0, rs: 0 });

  useEffect(() => {
    model.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.frustumCulled = false; } });
    if (actions.Idle) { actions.Idle.reset().play(); st.current.cur = "Idle"; }
    onReady();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, actions]);

  // Pointer play. Hit areas are capsules along the bones, so they do not depend on the mesh.
  useEffect(() => {
    const dom = gl.domElement, rc = new THREE.Raycaster(), v2 = new THREE.Vector2(), dir = new THREE.Vector3();
    const pts = new Map<number, { x: number; y: number }>(); let pinch0 = 0, size0 = 1, raf = 0;
    let body: { kind: "move" | "turn"; x0: number; y0: number; offX: number; offZ: number; yaw: number } | null = null;
    const rayAt = (cx: number, cy: number) => { const r = dom.getBoundingClientRect(); v2.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1); rc.setFromCamera(v2, camera); return rc.ray; };
    const cursorFor = (h: ReturnType<Puppet["hit"]>) => (!h ? "" : ctl.current.mode === "pose" ? (h.kind === "belly" ? "pointer" : "grab") : ctl.current.mode === "move" ? "move" : "ew-resize");
    const down = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (e.pointerType === "touch") {
        pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); size0 = ctl.current.size; puppet.up(); body = null; ctl.current.holding = false; e.preventDefault(); return; }
      }
      const m = ctl.current.mode, ray = rayAt(e.clientX, e.clientY), h = puppet.hit(ray, m === "pose" ? 1 : 2); if (!h) return;
      busy.current = performance.now(); onTouch(); e.preventDefault();
      try { dom.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
      dom.style.cursor = "grabbing";
      if (m === "pose") puppet.down(h, ray, camera.getWorldDirection(dir), e.clientX, e.clientY);
      else { body = { kind: m, x0: e.clientX, y0: e.clientY, offX: ctl.current.offX, offZ: ctl.current.offZ, yaw: ctl.current.yaw }; ctl.current.holding = true; }
    };
    const move = (e: PointerEvent) => {
      if (pts.has(e.pointerId)) pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2 && pinch0) { const [a, b] = [...pts.values()]; ctl.current.size = clamp((size0 * Math.hypot(a.x - b.x, a.y - b.y)) / pinch0, 0.5, 1.8); return; }
      busy.current = body || puppet.dragging ? performance.now() : busy.current;
      if (body) {
        if (body.kind === "move") { const upp = (2 * Math.max(2, camera.position.length()) * Math.tan((((camera as THREE.PerspectiveCamera).fov || 40) * Math.PI) / 360)) / Math.max(1, dom.clientHeight); ctl.current.offX = clamp(body.offX + (e.clientX - body.x0) * upp, -vw.current, vw.current); ctl.current.offZ = clamp(body.offZ + (e.clientY - body.y0) * upp * 1.3, -4, 3.2); }
        else ctl.current.yaw = body.yaw + (e.clientX - body.x0) * 0.012;
        return;
      }
      if (puppet.dragging) { puppet.move(rayAt(e.clientX, e.clientY), e.clientX, e.clientY); return; }
      if (e.pointerType !== "mouse" || raf) return;
      raf = requestAnimationFrame(() => { raf = 0; dom.style.cursor = cursorFor(puppet.hit(rayAt(e.clientX, e.clientY), ctl.current.mode === "pose" ? 1 : 2)); });
    };
    const up = (e: PointerEvent) => {
      pts.delete(e.pointerId); if (pts.size < 2) pinch0 = 0;
      if (!body && !puppet.dragging) return;
      if (body) { body = null; ctl.current.holding = false; } else puppet.up();
      dom.style.cursor = ""; busy.current = performance.now(); try { dom.releasePointerCapture(e.pointerId); } catch { /* already released */ }
    };
    const touch = (e: TouchEvent) => { const t = e.touches[0]; if (t && (e.touches.length > 1 || puppet.hit(rayAt(t.clientX, t.clientY), ctl.current.mode === "pose" ? 1 : 2))) e.preventDefault(); }; // grabbing the character must not scroll the page
    const wheel = (e: WheelEvent) => { if (!e.ctrlKey && !e.shiftKey) return; if (!puppet.hit(rayAt(e.clientX, e.clientY), 2)) return; e.preventDefault(); ctl.current.size = clamp(ctl.current.size * Math.exp(-e.deltaY * 0.0025), 0.5, 1.8); };
    dom.addEventListener("pointerdown", down); dom.addEventListener("pointermove", move); dom.addEventListener("pointerup", up); dom.addEventListener("pointercancel", up); dom.addEventListener("touchstart", touch, { passive: false }); dom.addEventListener("wheel", wheel, { passive: false });
    return () => { cancelAnimationFrame(raf); dom.style.cursor = ""; ctl.current.holding = false; dom.removeEventListener("pointerdown", down); dom.removeEventListener("pointermove", move); dom.removeEventListener("pointerup", up); dom.removeEventListener("pointercancel", up); dom.removeEventListener("touchstart", touch); dom.removeEventListener("wheel", wheel); };
  }, [puppet, camera, gl, busy, ctl, onTouch]);
  (typeof window !== "undefined") && ((window as unknown as { __puppet?: Puppet }).__puppet = puppet, (window as unknown as { __cam?: THREE.Camera; __ctl?: Ctl }).__cam = camera, (window as unknown as { __ctl?: Ctl }).__ctl = ctl.current); // handles for automated tests

  useFrame((s, dt) => {
    const k = st.current, c = ctl.current, p = ptr.current, t = s.clock.elapsedTime, held = puppet.dragging || c.holding; vw.current = viewport.width;
    if (k.born < 0) k.born = t;
    if (c.reset !== k.rs) { k.rs = c.reset; puppet.reset(); }
    if (c.gesture && c.gesture.n !== k.gn) { k.gn = c.gesture.n; puppet.play(c.gesture.name, t); }
    const live = actions[k.cur || "Idle"]; if (live && !live.isRunning()) { live.reset().play(); k.cur = k.cur || "Idle"; } // keeps the loop alive if the mixer was reset
    const g = Math.min(1, (t - k.born) / 0.7), z = (0.9 + 0.1 * (1 - Math.pow(1 - g, 3))) * c.size;
    outer.current.scale.setScalar(z); outer.current.position.y = GROUND * (1 - z); puppet.H = HEIGHT * ch.scale * c.size; // scaled about the feet
    const auto = c.motion === "auto", follow = auto && c.mode === "pose", idle = performance.now() - p.t > 4000; // no cursor for 4 seconds: wander on our own
    const tx = held ? k.px : idle ? Math.sin(t * 0.4) * 0.5 : p.x, ty = held ? k.py : idle ? Math.sin(t * 0.6 + 1) * 0.1 : p.y; k.px = tx; k.py = ty;
    const base = size.width > 900 ? viewport.width * 0.2 : 0, stroll = follow && !held ? tx * viewport.width * 0.14 : 0, lim = viewport.width * 0.46;
    const x0 = outer.current.position.x, z0 = outer.current.position.z;
    const x1 = damp(x0, clamp(base + stroll + c.offX, -lim, lim), c.holding ? 14 : 3, dt), z1 = damp(z0, c.offZ, c.holding ? 14 : 5, dt);
    outer.current.position.x = x1; outer.current.position.z = z1;      // strolls toward the cursor, or follows the hand that is dragging it
    const f = Math.max(dt, 1e-3); k.vx = THREE.MathUtils.lerp(k.vx, (x1 - x0) / f, 0.15); k.vz = THREE.MathUtils.lerp(k.vz, (z1 - z0) / f, 0.15); k.v = Math.hypot(k.vx, k.vz);
    const walking = k.v > 0.3 && !puppet.dragging;
    const want = c.motion === "idle" ? "Idle" : c.motion === "walk" ? "Walk" : c.motion === "run" ? "Run" : walking ? (k.v > 2.4 ? "Run" : "Walk") : "Idle";
    if (want !== k.cur && t - k.since > 0.5 && actions[want]) { actions[k.cur]?.fadeOut(0.35); actions[want]!.reset().fadeIn(0.35).play(); k.cur = want; k.since = t; }
    if (actions.Walk) actions.Walk.timeScale = walking ? clamp(k.v * 0.8, 0.6, 1.5) : 1;
    if (actions.Run) actions.Run.timeScale = walking ? clamp(k.v * 0.45, 0.8, 1.4) : 1;
    // Facing: the direction chosen with Turn, a little toward the cursor, and toward the direction of travel while it moves.
    const look = clamp(Math.atan2(tx * viewport.width * 0.5 - x1, 3.2), -1, 1); k.look = damp(k.look, look, 4, dt);
    const travel = Math.atan2(k.vx, k.vz), target = walking ? (c.holding ? travel : travel * 0.5) : c.yaw + (follow ? k.look * 0.6 : 0);
    k.face += Math.atan2(Math.sin(target - k.face), Math.cos(target - k.face)) * (1 - Math.exp(-(c.holding ? 9 : 5) * dt)); outer.current.rotation.y = k.face;
    const L = puppet.headLook;
    k.hy = damp(k.hy, L.on ? L.yaw : follow ? clamp(look - k.look * 0.6, -0.8, 0.8) : 0, 6, dt);
    k.hp = damp(k.hp, L.on ? L.pitch : follow ? -ty * 0.3 : 0, 6, dt);
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

const HINT: Record<Mode, string> = { pose: "Grab a hand or foot. Rub the belly. Tap the head.", move: "Drag the character around the floor.", turn: "Drag sideways to turn the character." };
const MOTIONS: [Motion, string][] = [["auto", "Auto"], ["idle", "Idle"], ["walk", "Walk"], ["run", "Run"]];
const GESTS: [Gest, string][] = [["wave", "Wave"], ["cheer", "Cheer"], ["stretch", "Stretch"]];

export default function Hero({ characters, initial, showSwitcher, showTools = true, autoSwitch = true, switchSeconds = 9 }: { characters: Ch[]; initial: string; showSwitcher: boolean; showTools?: boolean; autoSwitch?: boolean; switchSeconds?: number }) {
  const [active, setActive] = useState(initial), [failed, setFailed] = useState(false), [vis, setVis] = useState(true), [touched, setTouched] = useState(false);
  const [auto, setAuto] = useState(autoSwitch && characters.length > 1), [tick, setTick] = useState(0);
  const [mode, setModeS] = useState<Mode>("pose"), [motion, setMotionS] = useState<Motion>("auto"), [more, setMore] = useState(false);
  const dark = useDark();
  const box = useRef<HTMLDivElement>(null), ptr = useRef<Ptr>({ x: 0, y: 0, t: 0 }), busy = useRef(0);
  const ctl = useRef<Ctl>({ mode: "pose", motion: "auto", size: 1, offX: 0, offZ: 0, yaw: 0, reset: 0, gesture: null, holding: false });
  const setMode = (m: Mode) => { ctl.current.mode = m; setModeS(m); };
  const setMotion = (m: Motion) => { ctl.current.motion = m; setMotionS(m); };
  const zoom = (f: number) => { ctl.current.size = clamp(ctl.current.size * f, 0.5, 1.8); busy.current = performance.now(); };
  const gesture = (name: Gest) => { ctl.current.gesture = { name, n: (ctl.current.gesture?.n ?? 0) + 1 }; busy.current = performance.now(); setTouched(true); };
  const resetAll = () => { const c = ctl.current; c.offX = 0; c.offZ = 0; c.yaw = 0; c.size = 1; c.gesture = null; c.reset++; setMode("pose"); setMotion("auto"); };
  // A visitor who picked a character by hand last time keeps it, and auto-switching stays off for them.
  useEffect(() => { try { const s = localStorage.getItem("az_char"); if (s && characters.some((c) => c.id === s)) { setActive(s); setAuto(false); } } catch { /* storage blocked */ } }, [characters]);
  useEffect(() => {
    const el = box.current!, io = new IntersectionObserver(([e]) => setVis(e.isIntersecting)); io.observe(el);
    const mv = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      ptr.current.x = clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1);
      ptr.current.y = clamp(-(((e.clientY - r.top) / r.height) * 2 - 1), -1, 1); ptr.current.t = performance.now();
    };
    window.addEventListener("pointermove", mv, { passive: true });
    return () => { io.disconnect(); window.removeEventListener("pointermove", mv); };
  }, []);
  // Auto-switch: every few seconds, unless the tab is hidden or someone is playing with the character.
  useEffect(() => {
    if (!auto || !vis || characters.length < 2) return;
    const i = characters.findIndex((c) => c.id === active), nxt = characters[(i + 1) % characters.length], ms = Math.max(4, switchSeconds) * 1000;
    const pre = setTimeout(() => useGLTF.preload(nxt.file), Math.max(0, ms - 4000));
    const id = setTimeout(() => { if (document.hidden || performance.now() - busy.current < 5000) { setTick((n) => n + 1); return; } setFailed(false); setActive(nxt.id); }, ms);
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
          <Light name="studio" intensity={dark ? 0.8 : 1} />
          <directionalLight position={[3, 5, 4]} intensity={dark ? 1.1 : 1.3} castShadow shadow-mapSize={[1024, 1024]} />
          <directionalLight position={[-4, 3, -3]} intensity={dark ? 1.3 : 0.35} color="#a9bcff" />
          <Safe key={ch.id} fallback={null} onError={() => setFailed(true)}><Suspense fallback={null}><Human ch={ch} ptr={ptr} busy={busy} ctl={ctl} onReady={() => setFailed(false)} onTouch={onTouch} /></Suspense></Safe>
          <ContactShadows position={[0, GROUND, 0]} opacity={dark ? 0.6 : 0.35} scale={12} blur={2.4} far={3} />
        </Canvas>
      </Safe>
      <Loading />
      {failed && <p className="heroErr">This character could not load. Choose another one.</p>}
      <div className="heroBar">
        {!touched && <p className="heroHint">{HINT[mode]}</p>}
        {showTools && (
          <div className="tools" role="toolbar" aria-label="Character controls">
            <div className="seg" role="group" aria-label="What dragging does">
              {(["pose", "move", "turn"] as Mode[]).map((m) => <button key={m} aria-pressed={mode === m} className={mode === m ? "cur" : ""} onClick={() => setMode(m)} title={HINT[m]}>{m === "pose" ? "Pose" : m === "move" ? "Move" : "Turn"}</button>)}
            </div>
            <div className="seg" role="group" aria-label="Size and reset">
              <button onClick={() => zoom(1 / 1.15)} aria-label="Smaller" title="Smaller">{"−"}</button><button onClick={() => zoom(1.15)} aria-label="Larger" title="Larger">+</button><button onClick={resetAll} title="Back to the start">Reset</button>
            </div>
            <button className={`seg more ${more ? "cur" : ""}`} aria-expanded={more} onClick={() => setMore(!more)}>Motions</button>
            {more && (<>
              <div className="seg" role="group" aria-label="Movement">{MOTIONS.map(([m, l]) => <button key={m} aria-pressed={motion === m} className={motion === m ? "cur" : ""} onClick={() => setMotion(m)}>{l}</button>)}</div>
              <div className="seg" role="group" aria-label="Moves">{GESTS.map(([g, l]) => <button key={g} onClick={() => gesture(g)}>{l}</button>)}</div>
            </>)}
          </div>
        )}
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
