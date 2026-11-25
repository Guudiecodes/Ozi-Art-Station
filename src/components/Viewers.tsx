"use client";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, Environment, Html, OrbitControls, useProgress, useTexture } from "@react-three/drei";
import { Suspense, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { PublicAsset } from "@/lib/db";
import Glb, { type Mode, type Stats } from "./Glb";

const ENVS = ["studio", "city", "sunset", "dawn", "forest", "warehouse"] as const;
function Loader() { const { progress } = useProgress(); return <Html center><div className="loader"><i style={{ width: `${progress}%` }} /></div><p className="pct">{Math.round(progress)}%</p></Html>; }
const Chip = ({ on, set, children }: { on: boolean; set: () => void; children: React.ReactNode }) => <button className={on ? "on" : ""} onClick={set}>{children}</button>;
const Range = ({ label, v, set, min, max, step = 0.05 }: { label: string; v: number; set: (n: number) => void; min: number; max: number; step?: number }) =>
  <label className="range"><span>{label}</span><input type="range" min={min} max={max} step={step} value={v} onChange={(e) => set(+e.target.value)} /></label>;
function useStage() {
  const box = useRef<HTMLDivElement>(null);
  const shot = (name: string) => { const c = box.current?.querySelector("canvas"); if (!c) return; const a = document.createElement("a"); a.href = c.toDataURL("image/png"); a.download = `${name}.png`; a.click(); };
  const full = () => (document.fullscreenElement ? document.exitFullscreen() : box.current?.requestFullscreen());
  return { box, shot, full };
}

function ModelViewer({ a, canPin }: { a: PublicAsset; canPin: boolean }) {
  const [env, setEnv] = useState<(typeof ENVS)[number]>("studio"), [mode, setMode] = useState<Mode>("original");
  const [wire, setWire] = useState(false), [spin, setSpin] = useState(true), [bg, setBg] = useState(false);
  const [pins, setPins] = useState(a.annotations), [open, setOpen] = useState<string | null>(null), [placing, setPlacing] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null), [err, setErr] = useState("");
  const { box, shot, full } = useStage();
  const add = async (p: { x: number; y: number; z: number }) => {
    if (!placing) return;
    const text = prompt("Annotation text"); setPlacing(false); if (!text) return;
    const r = await fetch(`/api/assets/${a.id}/annotations`, { method: "POST", body: JSON.stringify({ pos: [p.x, p.y, p.z], text }) });
    if (!r.ok) return setErr((await r.json()).error);
    const n = await r.json(); setErr(""); setPins((s) => [...s, n]);
  };
  return (
    <div className="viewer">
      <div ref={box} className={`stage ${placing ? "placing" : ""}`}>
        <Canvas camera={{ position: [2.6, 1.6, 3.4], fov: 38 }} gl={{ preserveDrawingBuffer: true }} dpr={[1, 2]}>
          <Environment preset={env} background={bg} blur={0.5} />
          <Suspense fallback={<Loader />}>
            <Glb url={a.file} mode={mode} wire={wire} onStats={setStats} onPick={add} />
            {pins.map((n, i) => (
              <Html key={n.id} position={n.pos} center distanceFactor={7} zIndexRange={[10, 0]}>
                <button className="pin" aria-label={n.text} onClick={() => setOpen(open === n.id ? null : n.id)}>{i + 1}</button>
                {open === n.id && <div className="note">{n.text}</div>}
              </Html>
            ))}
            <ContactShadows position={[0, -1.02, 0]} opacity={0.35} blur={2.6} scale={6} />
          </Suspense>
          <OrbitControls makeDefault enableDamping dampingFactor={0.07} autoRotate={spin} autoRotateSpeed={1} minDistance={1.5} maxDistance={9} />
        </Canvas>
        {placing && <div className="banner">Double-click the model to place a pin</div>}
      </div>
      <aside className="panel">
        <h3>Material</h3><div className="chips">{(["original", "clay", "chrome"] as Mode[]).map((x) => <Chip key={x} on={x === mode} set={() => setMode(x)}>{x}</Chip>)}</div>
        <h3>Lighting</h3><div className="chips">{ENVS.map((x) => <Chip key={x} on={x === env} set={() => setEnv(x)}>{x}</Chip>)}</div>
        <h3>View</h3><div className="chips"><Chip on={wire} set={() => setWire(!wire)}>Wireframe</Chip><Chip on={spin} set={() => setSpin(!spin)}>Auto-rotate</Chip><Chip on={bg} set={() => setBg(!bg)}>Background</Chip></div>
        <h3>Tools</h3><div className="chips">{canPin && <Chip on={placing} set={() => setPlacing(!placing)}>Add pin</Chip>}<button onClick={() => shot(a.slug)}>Save image</button><button onClick={full}>Fullscreen</button></div>
        {stats && <dl className="stats"><dt>Triangles</dt><dd>{stats.tris.toLocaleString()}</dd><dt>Size</dt><dd>{stats.size.map((n) => n.toFixed(2)).join(" × ")}</dd></dl>}
        {err && <p className="err">{err}</p>}
      </aside>
    </div>
  );
}

function HdriViewer({ a }: { a: PublicAsset }) {
  const [bg, setBg] = useState(true), [blur, setBlur] = useState(0), [gain, setGain] = useState(1), [spin, setSpin] = useState(false);
  const { box, shot, full } = useStage();
  return (
    <div className="viewer">
      <div ref={box} className="stage">
        <Canvas camera={{ position: [0, 0.4, 5], fov: 45 }} gl={{ preserveDrawingBuffer: true }} dpr={[1, 2]}>
          <Suspense fallback={<Loader />}>
            <Environment files={a.file} background={bg} backgroundBlurriness={blur} backgroundIntensity={gain} environmentIntensity={gain} />
            <mesh position={[-1.1, 0, 0]}><sphereGeometry args={[1, 64, 64]} /><meshStandardMaterial color="#fff" metalness={1} roughness={0.02} /></mesh>
            <mesh position={[1.1, 0, 0]}><sphereGeometry args={[1, 64, 64]} /><meshStandardMaterial color="#b9b9b9" metalness={0} roughness={0.6} /></mesh>
          </Suspense>
          <OrbitControls makeDefault enableDamping autoRotate={spin} autoRotateSpeed={0.6} minDistance={2.5} maxDistance={9} />
        </Canvas>
      </div>
      <aside className="panel">
        <h3>Reference spheres</h3><p className="mutedp">Left: chrome mirror ball. Right: matte grey ball.</p>
        <h3>Lighting</h3><Range label="Exposure" v={gain} set={setGain} min={0.2} max={3} /><Range label="Background blur" v={blur} set={setBlur} min={0} max={1} />
        <h3>View</h3><div className="chips"><Chip on={bg} set={() => setBg(!bg)}>Show sky</Chip><Chip on={spin} set={() => setSpin(!spin)}>Auto-rotate</Chip></div>
        <h3>Tools</h3><div className="chips"><button onClick={() => shot(a.slug)}>Save image</button><button onClick={full}>Fullscreen</button></div>
      </aside>
    </div>
  );
}

function Tex({ url, shape, repeat, rough }: { url: string; shape: string; repeat: number; rough: number }) {
  const t = useTexture(url);
  useEffect(() => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.repeat.set(repeat, repeat); t.needsUpdate = true; }, [t, repeat]);
  return (
    <mesh rotation={shape === "plane" ? [-0.35, 0, 0] : [0, 0, 0]}>
      {shape === "sphere" ? <sphereGeometry args={[1.2, 96, 96]} /> : shape === "cube" ? <boxGeometry args={[1.8, 1.8, 1.8]} /> : <planeGeometry args={[3, 3]} />}
      <meshStandardMaterial map={t} roughness={rough} side={THREE.DoubleSide} />
    </mesh>
  );
}
function TextureViewer({ a }: { a: PublicAsset }) {
  const [shape, setShape] = useState("sphere"), [rep, setRep] = useState(1), [rough, setRough] = useState(0.8), [env, setEnv] = useState<(typeof ENVS)[number]>("studio");
  const { box, shot, full } = useStage();
  return (
    <div className="viewer">
      <div ref={box} className="stage">
        <Canvas camera={{ position: [0, 0.6, 4.4], fov: 38 }} gl={{ preserveDrawingBuffer: true }} dpr={[1, 2]}>
          <Environment preset={env} />
          <Suspense fallback={<Loader />}><Tex url={a.file} shape={shape} repeat={rep} rough={rough} /></Suspense>
          <OrbitControls makeDefault enableDamping minDistance={2} maxDistance={8} />
        </Canvas>
      </div>
      <aside className="panel">
        <h3>Preview shape</h3><div className="chips">{["sphere", "cube", "plane"].map((s) => <Chip key={s} on={s === shape} set={() => setShape(s)}>{s}</Chip>)}</div>
        <h3>Surface</h3><Range label="Tiling" v={rep} set={setRep} min={1} max={8} step={1} /><Range label="Roughness" v={rough} set={setRough} min={0} max={1} />
        <h3>Lighting</h3><div className="chips">{ENVS.map((x) => <Chip key={x} on={x === env} set={() => setEnv(x)}>{x}</Chip>)}</div>
        <h3>Tools</h3><div className="chips"><button onClick={() => shot(a.slug)}>Save image</button><button onClick={full}>Fullscreen</button></div>
      </aside>
    </div>
  );
}
export default function AssetViewer({ a, canPin }: { a: PublicAsset; canPin: boolean }) {
  return a.type === "model" ? <ModelViewer a={a} canPin={canPin} /> : a.type === "hdri" ? <HdriViewer a={a} /> : <TextureViewer a={a} />;
}
