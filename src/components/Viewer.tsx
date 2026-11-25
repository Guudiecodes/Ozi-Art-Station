"use client";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, Environment, Html, OrbitControls } from "@react-three/drei";
import { useRef, useState } from "react";
import { environments, materials, type Asset } from "@/data/assets";
import { Shape } from "./Model";

const pins: { p: [number, number, number]; t: string }[] = [{ p: [0.9, 0.6, 0.6], t: "Edge highlight check" }, { p: [-0.8, -0.2, 0.8], t: "Surface curvature" }];

export default function Viewer({ asset }: { asset: Asset }) {
  const [env, setEnv] = useState<(typeof environments)[number]>("city");
  const [mat, setMat] = useState("base");
  const [wire, setWire] = useState(false);
  const [spin, setSpin] = useState(true);
  const [note, setNote] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const m = materials.find((x) => x.id === mat)!;
  const shot = () => {
    const c = box.current?.querySelector("canvas");
    if (!c) return;
    const a = document.createElement("a"); a.href = c.toDataURL("image/png"); a.download = `${asset.slug}.png`; a.click();
  };
  return (
    <div className="viewer">
      <div ref={box} className="stage">
        <Canvas camera={{ position: [3, 2, 4], fov: 40 }} gl={{ preserveDrawingBuffer: true }} dpr={[1, 2]}>
          <Environment preset={env} background blur={0.6} />
          <mesh>
            <Shape kind={asset.kind} />
            <meshPhysicalMaterial color={asset.color} metalness={m.metalness} roughness={m.roughness} transmission={m.transmission} thickness={1} wireframe={wire} />
            {pins.map((n, i) => (
              <Html key={i} position={n.p} center distanceFactor={8}>
                <button className="pin" aria-label={n.t} onClick={() => setNote(note === i ? null : i)}>{i + 1}</button>
                {note === i && <div className="note">{n.t}</div>}
              </Html>
            ))}
          </mesh>
          <ContactShadows position={[0, -1.3, 0]} opacity={0.5} blur={2.5} />
          <OrbitControls makeDefault autoRotate={spin} autoRotateSpeed={1.5} enableDamping />
        </Canvas>
      </div>
      <aside className="panel">
        <h3>Material</h3>
        <div className="chips">{materials.map((x) => <button key={x.id} className={x.id === mat ? "on" : ""} onClick={() => setMat(x.id)}>{x.label}</button>)}</div>
        <h3>Lighting</h3>
        <div className="chips">{environments.map((x) => <button key={x} className={x === env ? "on" : ""} onClick={() => setEnv(x)}>{x}</button>)}</div>
        <h3>View</h3>
        <div className="chips">
          <button className={wire ? "on" : ""} onClick={() => setWire(!wire)}>Wireframe</button>
          <button className={spin ? "on" : ""} onClick={() => setSpin(!spin)}>Auto-rotate</button>
          <button onClick={shot}>Save image</button>
        </div>
      </aside>
    </div>
  );
}
