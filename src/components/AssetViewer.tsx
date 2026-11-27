"use client";
import { Canvas, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Html, OrbitControls, useProgress, useTexture } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { Annotation } from "@/lib/db";
import type { PublicAsset } from "@/lib/db";
import { LIGHTS } from "@/lib/lists";
import Glb, { type Mode } from "./Glb";
import Light from "./Light";
import Safe from "./Safe";

function Progress() {
  const { progress, active } = useProgress();
  return active ? <div className="stageLoad"><div className="loader"><i style={{ width: `${progress}%` }} /></div><p className="pct">Loading {Math.round(progress)}%</p></div> : null;
}
function Shot({ reg }: { reg: (fn: () => void) => void }) {
  const { gl, scene, camera } = useThree();
  useEffect(() => reg(() => { gl.render(scene, camera); const a = document.createElement("a"); a.download = "screenshot.png"; a.href = gl.domElement.toDataURL("image/png"); a.click(); }), [gl, scene, camera, reg]);
  return null;
}
// Backdrop behind the 3D view. "Match site" follows light and dark mode; the others let you check an asset against any background, since a white model vanishes on white.
const BACKS: [string, string][] = [["auto", "Match site"], ["light", "Light"], ["grey", "Grey"], ["dark", "Dark"]];
function useBackdrop() {
  const [b, setB] = useState("auto");
  useEffect(() => { try { const v = localStorage.getItem("az_bg"); if (v && BACKS.some((x) => x[0] === v)) setB(v); } catch { /* storage blocked */ } }, []);
  return [b, (v: string) => { setB(v); try { localStorage.setItem("az_bg", v); } catch { /* storage blocked */ } }] as const;
}
const Chips = <T extends string>({ value, set, items }: { value: T; set: (v: T) => void; items: [T, string][] }) => (
  <div className="chips">{items.map(([k, l]) => <button key={k} className={value === k ? "on" : ""} aria-pressed={value === k} onClick={() => set(k)}>{l}</button>)}</div>
);
const Toggle = ({ on, set, label }: { on: boolean; set: (v: boolean) => void; label: string }) => <button className={`chip tg ${on ? "on" : ""}`} aria-pressed={on} onClick={() => set(!on)}>{label}</button>;
const bytes = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : n > 0 ? `${Math.round(n / 1024)} KB` : "Sample file");

function Tools({ stage, snap }: { stage: React.RefObject<HTMLDivElement | null>; snap: React.MutableRefObject<() => void> }) {
  return <div className="chips"><button onClick={() => snap.current()}>Save image</button><button onClick={() => stage.current?.requestFullscreen?.()}>Fullscreen</button></div>;
}

function ModelViewer({ a, canEdit }: { a: PublicAsset; canEdit: boolean }) {
  const [light, setLight] = useState("studio"), [mode, setMode] = useState<Mode>("original"), [wire, setWire] = useState(false), [spin, setSpin] = useState(true), [back, setBack] = useBackdrop();
  const [tris, setTris] = useState(0), [h, setH] = useState(1.8), [pins, setPins] = useState<Annotation[]>(a.annotations), [open, setOpen] = useState<string | null>(null);
  const stage = useRef<HTMLDivElement>(null), snap = useRef<() => void>(() => {});
  const addPin = async (v: THREE.Vector3) => {
    const text = window.prompt("What should this pin say?"); if (!text) return;
    const r = await fetch(`/api/assets/${a.id}/annotations`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pos: [v.x, v.y, v.z], text }) });
    if (r.ok) { const j = await r.json(); setPins((p) => [...p, j]); }
  };
  const rmPin = async (id: string) => { const r = await fetch(`/api/assets/${a.id}/annotations?n=${id}`, { method: "DELETE" }); if (r.ok) setPins((p) => p.filter((x) => x.id !== id)); };
  return (<>
    <div ref={stage} className="stage" data-bg={back} data-lenis-prevent>
      <Safe><Canvas shadows dpr={[1, 2]} camera={{ position: [0, 0.7, 3.4], fov: 35 }} gl={{ preserveDrawingBuffer: true, antialias: true }}>
        <Light name={light} />
        <Suspense fallback={null}><Glb url={a.preview} mode={mode} wire={wire} onFit={setH} onStats={(s) => setTris(s.tris)} onPoint={canEdit ? addPin : undefined} /></Suspense>
        {pins.map((p, i) => (
          <Html key={p.id} position={p.pos} center zIndexRange={[20, 0]}>
            <div style={{ position: "relative" }}>
              <button className="pin" onClick={() => setOpen(open === p.id ? null : p.id)} aria-label={`Pin ${i + 1}`}>{i + 1}</button>
              {open === p.id && <span className="note">{p.text}{canEdit && <button className="linkbtn inv" onClick={() => rmPin(p.id)}>Remove</button>}</span>}
            </div>
          </Html>
        ))}
        <ContactShadows position={[0, -h / 2 - 0.01, 0]} opacity={0.35} scale={6} blur={2.4} far={2} />
        <OrbitControls makeDefault enableDamping dampingFactor={0.06} autoRotate={spin} autoRotateSpeed={1.1} minDistance={1.2} maxDistance={9} />
        <Shot reg={(fn) => { snap.current = fn; }} />
      </Canvas></Safe>
      <Progress />
      {canEdit && <span className="banner">Double-click the model to add a pin</span>}
    </div>
    <aside className="panel">
      <h3>Material</h3><Chips value={mode} set={setMode} items={[["original", "Original"], ["clay", "Clay"], ["chrome", "Chrome"]]} />
      <h3>Lighting</h3><Chips value={light} set={setLight} items={Object.entries(LIGHTS).map(([k, v]) => [k, v.label] as [string, string])} />
      <h3>View</h3><div className="chips"><Toggle on={wire} set={setWire} label="Wireframe" /><Toggle on={spin} set={setSpin} label="Auto-rotate" /></div>
      <h3>Background</h3><Chips value={back} set={setBack} items={BACKS} />
      <h3>Capture</h3><Tools stage={stage} snap={snap} />
      <dl className="kv"><dt>Triangles</dt><dd>{tris ? tris.toLocaleString() : "..."}</dd><dt>Original file</dt><dd>{bytes(a.size)}</dd><dt>Pins</dt><dd>{pins.length}</dd></dl>
      {a.protectedPreview && <p className="mutedp small">This is a reduced preview. The purchased file has the full detail.</p>}
    </aside>
  </>);
}

function HdriViewer({ a }: { a: PublicAsset }) {
  const [exp, setExp] = useState(1), [blur, setBlur] = useState(0.2), [bg, setBg] = useState(true), [back, setBack] = useBackdrop();
  const stage = useRef<HTMLDivElement>(null), snap = useRef<() => void>(() => {});
  return (<>
    <div ref={stage} className="stage" data-bg={back} data-lenis-prevent>
      <Safe><Canvas dpr={[1, 2]} camera={{ position: [0, 0, 5.4], fov: 35 }} gl={{ preserveDrawingBuffer: true }}>
        <Suspense fallback={null}>
          <Environment files={a.preview} background={bg} backgroundBlurriness={blur} environmentIntensity={exp} backgroundIntensity={exp} />
          <mesh position={[-1.1, 0, 0]}><sphereGeometry args={[1, 96, 96]} /><meshStandardMaterial color="#ffffff" metalness={1} roughness={0.02} /></mesh>
          <mesh position={[1.1, 0, 0]}><sphereGeometry args={[1, 96, 96]} /><meshStandardMaterial color="#8a8a8a" metalness={0} roughness={0.9} /></mesh>
        </Suspense>
        <OrbitControls makeDefault enablePan={false} enableDamping minDistance={2.5} maxDistance={9} />
        <Shot reg={(fn) => { snap.current = fn; }} />
      </Canvas></Safe>
      <Progress />
    </div>
    <aside className="panel">
      <h3>Light check</h3><p className="mutedp small">The chrome ball shows the light itself. The grey ball shows how it falls on a matte surface.</p>
      <label className="range">Exposure {exp.toFixed(1)}<input type="range" min="0.2" max="3" step="0.1" value={exp} onChange={(e) => setExp(+e.target.value)} /></label>
      <label className="range">Background blur {blur.toFixed(2)}<input type="range" min="0" max="1" step="0.05" value={blur} onChange={(e) => setBlur(+e.target.value)} /></label>
      <div className="chips"><Toggle on={bg} set={setBg} label="Show sky" /></div>
      {!bg && <><h3>Background</h3><Chips value={back} set={setBack} items={BACKS} /></>}
      <h3>Capture</h3><Tools stage={stage} snap={snap} />
      <dl className="kv"><dt>Original file</dt><dd>{bytes(a.size)}</dd></dl>
      {a.protectedPreview && <p className="mutedp small">This is a reduced preview. The purchased file has the full resolution.</p>}
    </aside>
  </>);
}

function Surface({ url, shape, tile, rough }: { url: string; shape: string; tile: number; rough: number }) {
  const tex = useTexture(url);
  const t = useMemo(() => { const c = tex.clone(); c.wrapS = c.wrapT = THREE.RepeatWrapping; c.colorSpace = THREE.SRGBColorSpace; c.anisotropy = 8; c.needsUpdate = true; return c; }, [tex]);
  useEffect(() => { t.repeat.set(tile, tile); }, [t, tile]);
  const mat = <meshStandardMaterial map={t} roughness={rough} metalness={0} />;
  return shape === "sphere" ? <mesh castShadow><sphereGeometry args={[1.2, 96, 96]} />{mat}</mesh>
    : shape === "cube" ? <mesh rotation={[0.4, 0.6, 0]} castShadow><boxGeometry args={[1.8, 1.8, 1.8]} />{mat}</mesh>
    : <mesh rotation={[-0.35, 0, 0]}><planeGeometry args={[3.2, 3.2]} />{mat}</mesh>;
}
function TextureViewer({ a }: { a: PublicAsset }) {
  const [shape, setShape] = useState("sphere"), [tile, setTile] = useState(1), [rough, setRough] = useState(0.7), [light, setLight] = useState("studio"), [back, setBack] = useBackdrop();
  const stage = useRef<HTMLDivElement>(null), snap = useRef<() => void>(() => {});
  return (<>
    <div ref={stage} className="stage" data-bg={back} data-lenis-prevent>
      <Safe><Canvas dpr={[1, 2]} camera={{ position: [0, 0.4, 4], fov: 35 }} gl={{ preserveDrawingBuffer: true }}>
        <Light name={light} />
        <Suspense fallback={null}><Surface url={a.preview} shape={shape} tile={tile} rough={rough} /></Suspense>
        <OrbitControls makeDefault enablePan={false} enableDamping autoRotate autoRotateSpeed={0.8} minDistance={2} maxDistance={8} />
        <Shot reg={(fn) => { snap.current = fn; }} />
      </Canvas></Safe>
      <Progress />
    </div>
    <aside className="panel">
      <h3>Preview shape</h3><Chips value={shape} set={setShape} items={[["sphere", "Sphere"], ["cube", "Cube"], ["plane", "Plane"]]} />
      <h3>Lighting</h3><Chips value={light} set={setLight} items={Object.entries(LIGHTS).map(([k, v]) => [k, v.label] as [string, string])} />
      <h3>Background</h3><Chips value={back} set={setBack} items={BACKS} />
      <label className="range">Tiling {tile}x<input type="range" min="1" max="8" step="1" value={tile} onChange={(e) => setTile(+e.target.value)} /></label>
      <label className="range">Roughness {rough.toFixed(2)}<input type="range" min="0.05" max="1" step="0.05" value={rough} onChange={(e) => setRough(+e.target.value)} /></label>
      <h3>Capture</h3><Tools stage={stage} snap={snap} />
      <dl className="kv"><dt>Original file</dt><dd>{bytes(a.size)}</dd></dl>
      {a.protectedPreview && <p className="mutedp small">This is a reduced preview. The purchased file is full resolution.</p>}
    </aside>
  </>);
}

export default function AssetViewer({ asset, canEdit }: { asset: PublicAsset; canEdit: boolean }) {
  return <div className="viewer">{asset.type === "model" ? <ModelViewer a={asset} canEdit={canEdit} /> : asset.type === "hdri" ? <HdriViewer a={asset} /> : <TextureViewer a={asset} />}</div>;
}
