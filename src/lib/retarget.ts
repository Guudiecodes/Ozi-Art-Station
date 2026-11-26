import * as THREE from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";

// Mixamo rigs name bones "mixamorigHips" (three.js drops the colon). Ready Player Me and Avaturn use "Hips".
// Both share the same bone order, so one set of idle/walk/run clips can drive any of them.
// Rigs rest in different local axes, so the motion is carried over in world space: how far each bone turned
// from its rest pose in the source, applied on top of the same bone's rest pose in the target.
const hips = (root: THREE.Object3D) => { let h: THREE.Object3D | undefined; root.traverse((o) => { if (!h && /Hips$/.test(o.name)) h = o; }); return h; };
const bonesOf = (root: THREE.Object3D) => { const m = new Map<string, THREE.Object3D>(); root.traverse((o) => { if ((o as THREE.Bone).isBone) m.set(o.name, o); }); return m; };
const wq = (o: THREE.Object3D) => o.getWorldQuaternion(new THREE.Quaternion());

// A copy of the rig held in its T-pose (from the file's own "TPose" clip when it has one), used as the shared reference for both rigs.
function posed(root: THREE.Object3D, clip?: THREE.AnimationClip) {
  const c = clone(root) as THREE.Object3D;
  if (clip) for (const t of clip.tracks) if (t.name.endsWith(".quaternion")) c.getObjectByName(t.name.slice(0, -11))?.quaternion.fromArray(t.values as unknown as number[], 0);
  c.updateMatrixWorld(true); return c;
}
// +1 if the rig stands facing +Z (its left arm is on the +X side), -1 if it faces the other way.
export function facing(root: THREE.Object3D) {
  root.updateMatrixWorld(true); const b = bonesOf(root); let l: THREE.Object3D | undefined, r: THREE.Object3D | undefined;
  for (const [n, o] of b) { if (/LeftArm$/.test(n)) l = o; if (/RightArm$/.test(n)) r = o; }
  return l && r && l.getWorldPosition(new THREE.Vector3()).x < r.getWorldPosition(new THREE.Vector3()).x ? -1 : 1;
}
export function retarget(clips: THREE.AnimationClip[], srcRoot: THREE.Object3D, dst: THREE.Object3D, srcT?: THREE.AnimationClip, dstT?: THREE.AnimationClip) {
  const sh = hips(srcRoot), dh = hips(dst); if (!sh || !dh) return [] as THREE.AnimationClip[];
  const sp = sh.name.slice(0, -4), dp = dh.name.slice(0, -4);
  const src = clone(srcRoot) as THREE.Object3D; src.updateMatrixWorld(true); dst.updateMatrixWorld(true);
  const sb = bonesOf(src), db = bonesOf(dst), rs = bonesOf(posed(srcRoot, srcT)), rd = bonesOf(posed(dst, dstT));
  const pairs: { s: THREE.Object3D; d: THREE.Object3D; sname: string; restS: THREE.Quaternion; restD: THREE.Quaternion }[] = [];
  dst.traverse((d) => { // parent-first order
    if (!db.has(d.name) || !d.name.startsWith(dp)) return;
    const sname = sp + d.name.slice(dp.length), s = sb.get(sname); if (!s) return;
    pairs.push({ s, d, sname, restS: wq(rs.get(sname)!), restD: wq(rd.get(d.name)!) });
  });
  const byD = new Map(pairs.map((p) => [p.d, p]));
  const turn = facing(srcRoot) !== facing(dst), F = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI, 0)), Fi = F.clone().invert();
  const tmp = new THREE.Quaternion(), delta = new THREE.Quaternion(), tgt = new THREE.Quaternion();
  return clips.map((clip) => {
    const tr = new Map<string, THREE.Interpolant>();
    for (const t of clip.tracks) if (t.name.endsWith(".quaternion")) tr.set(t.name.slice(0, -11), t.createInterpolant());
    const hipTrack = clip.tracks.find((t) => t.name === `${sh.name}.quaternion`);
    if (!hipTrack) return new THREE.AnimationClip(clip.name, clip.duration, []);
    const times = Array.from(hipTrack.times), out = new Map<THREE.Object3D, number[]>(pairs.map((p) => [p.d, []]));
    for (const time of times) {
      for (const p of pairs) { const it = tr.get(p.sname); if (it) { const r = it.evaluate(time); p.s.quaternion.set(r[0], r[1], r[2], r[3]); } }
      src.updateMatrixWorld(true);
      const world = new Map<THREE.Object3D, THREE.Quaternion>();
      for (const p of pairs) {
        delta.copy(wq(p.s)).multiply(tmp.copy(p.restS).invert());            // world-space turn away from the source rest pose
        if (turn) delta.premultiply(F).multiply(Fi);                          // the rigs face opposite ways: mirror the turn around the vertical axis
        tgt.copy(delta).multiply(p.restD); world.set(p.d, tgt.clone());        // the same turn on top of the target rest pose
        const parent = p.d.parent, pw = parent && byD.has(parent) ? world.get(parent)! : parent ? wq(parent) : new THREE.Quaternion();
        const local = pw.clone().invert().multiply(tgt); out.get(p.d)!.push(local.x, local.y, local.z, local.w);
      }
    }
    return new THREE.AnimationClip(clip.name, clip.duration, pairs.map((p) => new THREE.QuaternionKeyframeTrack(`${p.d.name}.quaternion`, times, out.get(p.d)!)));
  });
}
export const pick = (clips: THREE.AnimationClip[], re: RegExp) => clips.find((c) => re.test(c.name));
