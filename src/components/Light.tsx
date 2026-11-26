"use client";
import { Environment, Lightformer } from "@react-three/drei";
import { LIGHTS } from "@/lib/lists";

// "studio" is built from soft boxes in code (nothing to download). Every other setup is a local HDR in /public/env.
export default function Light({ name, background = false, blur = 0, intensity = 1 }: { name: string; background?: boolean; blur?: number; intensity?: number }) {
  const file = LIGHTS[name]?.file;
  if (file) return <Environment files={file} background={background} backgroundBlurriness={blur} environmentIntensity={intensity} />;
  return (
    <Environment resolution={256} frames={1} environmentIntensity={intensity}>
      <color attach="background" args={["#8c8c8c"]} />
      <Lightformer form="rect" intensity={4} position={[0, 5, -4]} scale={[12, 5, 1]} />
      <Lightformer form="rect" intensity={2.2} position={[-5, 1.5, 1]} scale={[8, 3, 1]} />
      <Lightformer form="rect" intensity={2.2} position={[5, 1.5, 1]} scale={[8, 3, 1]} />
      <Lightformer form="ring" intensity={1.4} position={[0, 0, 6]} scale={8} />
    </Environment>
  );
}
