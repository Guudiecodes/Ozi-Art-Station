import * as THREE from "three";

// Makes a rigged human playable. Works on any Mixamo-style skeleton (Mixamo, Ready Player Me, Avaturn) because it only needs bone names and world positions.
//  - Hands and feet: grab and drag. A two-bone solver bends the elbow or knee, so the limb follows the pointer and springs back on release.
//  - Belly: poke it (squash and wobble), rub it (giggle), pull it (stretch with an elastic rebound).
//  - Head: drag to make the character look where you point; tap to make it nod.
//  - Alone: it waves, stretches and cheers every few seconds so it never stands still.
// Everything runs after the animation mixer each frame, so it sits on top of the idle motion and fades out when you let go.
const V = THREE.Vector3, Q = THREE.Quaternion;
const clamp = THREE.MathUtils.clamp;
type Bone = THREE.Object3D;
type Spring = [number, number]; // [position, velocity]
const spring = (s: Spring, target: number, k: number, c: number, dt: number) => { s[1] += (k * (target - s[0]) - c * s[1]) * dt; s[0] += s[1] * dt; };

export type LimbKey = "lh" | "rh" | "lf" | "rf";
export type Limb = { key: LimbKey; arm: boolean; a: Bone; b: Bone; c: Bone; tip?: Bone; w: Spring; goal: THREE.Vector3; started: boolean };
export type Hit = { kind: "limb"; limb: Limb } | { kind: "head" } | { kind: "belly" };
type Drag =
  | { kind: "limb"; limb: Limb; plane: THREE.Plane; offset: THREE.Vector3; target: THREE.Vector3 }
  | { kind: "head"; x0: number; y0: number; moved: number }
  | { kind: "belly"; x0: number; y0: number; px: number; py: number; path: number; moved: number };

const find = (root: Bone, re: RegExp) => { let r: Bone | undefined; root.traverse((o) => { if (!r && (o as THREE.Bone).isBone && re.test(o.name)) r = o; }); return r; };
const q1 = new Q(), q2 = new Q(), q3 = new Q();
// Turn a bone by a world-space rotation, whatever its local axes are.
function rotWorld(bone: Bone, axis: THREE.Vector3, angle: number) {
  if (!bone.parent) return;
  bone.parent.getWorldQuaternion(q1); bone.getWorldQuaternion(q2);
  q2.premultiply(q3.setFromAxisAngle(axis, angle)); bone.quaternion.copy(q1.invert().multiply(q2)); bone.updateMatrixWorld(true);
}
// Turn a bone so the line from `origin` to `from` points at `to`.
function aim(bone: Bone, origin: THREE.Vector3, from: THREE.Vector3, to: THREE.Vector3) {
  const v1 = from.clone().sub(origin).normalize(), v2 = to.clone().sub(origin).normalize(); if (v1.lengthSq() < 1e-9 || v2.lengthSq() < 1e-9 || !bone.parent) return;
  bone.parent.getWorldQuaternion(q1); bone.getWorldQuaternion(q2);
  q2.premultiply(q3.setFromUnitVectors(v1, v2)); bone.quaternion.copy(q1.invert().multiply(q2)); bone.updateMatrixWorld(true);
}
// Shortest distance from a ray to a segment, with the position along each.
function raySeg(ray: THREE.Ray, p0: THREE.Vector3, p1: THREE.Vector3) {
  const d = ray.direction, e = p1.clone().sub(p0), w = p0.clone().sub(ray.origin), c = e.lengthSq(), b = d.dot(e), dw = d.dot(w), ew = e.dot(w), den = c - b * b;
  let s = den > 1e-9 ? (b * dw - ew) / den : 0; s = clamp(s, 0, 1);
  let t = dw + s * b; if (t < 0) { t = 0; s = c > 1e-9 ? clamp(-ew / c, 0, 1) : 0; }
  return { dist: w.clone().addScaledVector(e, s).addScaledVector(d, -t).length(), t };
}
const X = new V(1, 0, 0), Z = new V(0, 0, 1);

export class Puppet {
  limbs: Limb[] = [];
  H = 2.65; // character height in world units, used to size the grab areas
  headX = 0; headY = 0;                                  // extra head offsets for Human to apply
  headLook = { on: false, yaw: 0, pitch: 0 };
  drag: Drag | null = null; touched = false;
  private hips?: Bone; private belly?: Bone; private kid?: Bone; private chest?: Bone; private head?: Bone; private neck?: Bone;
  private restB = new V(1, 1, 1); private restK = new V(1, 1, 1);
  private s = { b: [0, 0] as Spring, st: [0, 0] as Spring, rx: [0, 0] as Spring, rz: [0, 0] as Spring, hx: [0, 0] as Spring, hy: [0, 0] as Spring };
  private tg = { b: 0, st: 0, rx: 0, rz: 0 };
  private giggle = 0; private next = 1.4; private gest: { name: "wave" | "stretch" | "cheer"; end: number; limbs: LimbKey[]; phase: number } | null = null;

  constructor(private model: Bone) {
    model.updateMatrixWorld(true);
    const mk = (key: LimbKey, arm: boolean, side: string) => {
      const a = find(model, new RegExp(`${side}${arm ? "Arm" : "UpLeg"}$`)), b = find(model, new RegExp(`${side}${arm ? "ForeArm" : "Leg"}$`)), c = find(model, new RegExp(`${side}${arm ? "Hand" : "Foot"}$`));
      if (a && b && c) this.limbs.push({ key, arm, a, b, c, tip: arm ? undefined : find(model, new RegExp(`${side}ToeBase$`)), w: [0, 0], goal: new V(), started: false });
    };
    mk("lh", true, "Left"); mk("rh", true, "Right"); mk("lf", false, "Left"); mk("rf", false, "Right");
    this.hips = find(model, /Hips$/); this.belly = find(model, /Spine$/); this.kid = find(model, /Spine1$/); this.chest = find(model, /Spine2$/) ?? this.kid;
    this.head = find(model, /Head$/); this.neck = find(model, /Neck$/);
    if (this.belly) this.restB.copy(this.belly.scale); if (this.kid) this.restK.copy(this.kid.scale);
  }
  get dragging() { return !!this.drag; }

  // ---- picking: the pointer ray against capsules drawn along the bones, so it does not depend on the mesh
  hit(ray: THREE.Ray): Hit | null {
    this.model.updateMatrixWorld(true);
    const H = this.H, p = (o: Bone) => o.getWorldPosition(new V());
    let best: Hit | null = null, bestR = 1;
    const test = (a: THREE.Vector3, b: THREE.Vector3, r: number, h: Hit) => { const { dist } = raySeg(ray, a, b), k = dist / (r * H); if (k < bestR) { bestR = k; best = h; } };
    for (const l of this.limbs) {
      const A = p(l.a), B = p(l.b), C = p(l.c), tip = l.tip ? p(l.tip) : C.clone().add(C.clone().sub(B).multiplyScalar(0.45));
      const r = l.arm ? 0.055 : 0.075, h: Hit = { kind: "limb", limb: l };
      test(A, B, r, h); test(B, C, r * 0.9, h); test(C, tip, r * 1.1, h);
    }
    if (this.head && this.neck) { const n = p(this.neck), h = p(this.head); test(n, h.clone().addScaledVector(h.clone().sub(n), 0.9), 0.09, { kind: "head" }); }
    if (this.hips && this.chest) test(p(this.hips), p(this.chest), 0.12, { kind: "belly" });
    return best;
  }

  down(hit: Hit, ray: THREE.Ray, camDir: THREE.Vector3, x: number, y: number) {
    this.touched = true;
    if (hit.kind === "limb") {
      const C = hit.limb.c.getWorldPosition(new V()), plane = new THREE.Plane().setFromNormalAndCoplanarPoint(camDir, C), at = ray.intersectPlane(plane, new V());
      this.drag = { kind: "limb", limb: hit.limb, plane, offset: at ? C.clone().sub(at) : new V(), target: C.clone() };
      hit.limb.goal.copy(C); hit.limb.started = true; this.gest = null; this.next = 6 + (this.lastT ?? 0);
    } else if (hit.kind === "head") {
      this.drag = { kind: "head", x0: x, y0: y, moved: 0 }; this.headLook.on = true; this.headLook.yaw = 0; this.headLook.pitch = 0;
    } else {
      this.drag = { kind: "belly", x0: x, y0: y, px: x, py: y, path: 0, moved: 0 };
      this.s.b[1] += 7; this.s.rx[1] -= 1.6; this.giggle = Math.max(this.giggle, 0.45); // poke
    }
  }
  move(ray: THREE.Ray, x: number, y: number) {
    const d = this.drag; if (!d) return;
    if (d.kind === "limb") { const at = ray.intersectPlane(d.plane, new V()); if (at) d.target.copy(at).add(d.offset); }
    else if (d.kind === "head") { d.moved = Math.max(d.moved, Math.hypot(x - d.x0, y - d.y0)); this.headLook.yaw = clamp((x - d.x0) * 0.008, -0.9, 0.9); this.headLook.pitch = clamp((y - d.y0) * 0.008, -0.6, 0.6); }
    else {
      d.path += Math.hypot(x - d.px, y - d.py); d.px = x; d.py = y; const dx = x - d.x0, dy = y - d.y0; d.moved = Math.max(d.moved, Math.hypot(dx, dy));
      this.tg.st = clamp(Math.hypot(dx, dy) / 110, 0, 1.4); this.tg.rz = clamp(-dx / 300, -0.3, 0.3); this.tg.rx = clamp(dy / 400, -0.2, 0.2);
      if (d.path > 140) this.giggle = 1; // rubbing the belly makes it laugh
    }
  }
  up() {
    const d = this.drag; this.drag = null; this.tg.st = 0; this.tg.rz = 0; this.tg.rx = 0; this.headLook.on = false;
    if (d?.kind === "head" && d.moved < 8) { this.s.hx[1] += 4; this.giggle = Math.max(this.giggle, 0.3); } // tap the head: nod
    if (d?.kind === "belly" && d.moved < 8) { this.s.b[1] += 9; this.giggle = 0.8; }
    if (d?.kind === "belly" && d.moved >= 8) this.s.st[1] += 2; // let go of the stretch: extra snap back
  }

  private lastT = 0;
  private startGesture(t: number) {
    const arms = this.limbs.filter((l) => l.arm).map((l) => l.key), n = Math.random(), phase = Math.random() * 6;
    if (!arms.length) { this.next = t + 8; return; }
    if (n < 0.45) this.gest = { name: "wave", end: t + 3, limbs: [arms[Math.random() < 0.5 ? 0 : arms.length - 1]], phase };
    else if (n < 0.75) this.gest = { name: "stretch", end: t + 2.6, limbs: arms, phase };
    else this.gest = { name: "cheer", end: t + 2.8, limbs: arms, phase };
  }
  private gestureGoal(l: Limb, t: number, A: THREE.Vector3, L: number, side: number) {
    const g = this.gest!, o = new V();
    if (g.name === "wave") o.set(side * (0.5 + Math.sin(t * 11) * 0.14) * L, 0.9 * L, 0.18 * L);
    else if (g.name === "stretch") o.set(side * 0.18 * L, 0.98 * L, -0.05 * L);
    else o.set(side * 0.42 * L, (0.8 + Math.sin(t * 8 + g.phase) * 0.14) * L, 0.12 * L);
    return A.clone().add(o);
  }

  // Call once per frame, after the animation mixer has posed the skeleton.
  update(t: number, dt: number) {
    dt = Math.min(dt, 1 / 30); this.lastT = t; const s = this.s, m = this.model;
    m.updateMatrixWorld(true);
    if (!this.drag && !this.gest && t > this.next) this.startGesture(t);
    if (this.gest && t > this.gest.end) { this.gest = null; this.next = t + 4 + Math.random() * 5; }
    if (this.drag?.kind !== "belly") this.tg.rx = this.gest?.name === "stretch" ? -0.18 : 0; // lean back while stretching

    // torso springs: belly squash, belly stretch, rocking, and the giggle that drives them
    if (this.giggle > 0) { s.b[1] += Math.sin(t * 32) * 55 * this.giggle * dt; s.hx[1] += Math.sin(t * 22) * 38 * this.giggle * dt; this.giggle = Math.max(0, this.giggle - dt / 1.3); }
    spring(s.b, 0, 140, 9, dt); spring(s.st, this.tg.st, 110, 6, dt); spring(s.rx, this.tg.rx, 70, 5, dt); spring(s.rz, this.tg.rz, 70, 5, dt); spring(s.hx, 0, 90, 6, dt); spring(s.hy, 0, 90, 6, dt);
    const b = clamp(s.b[0], -1.2, 1.4), st = clamp(s.st[0], -0.3, 1.6), sx = 1 + 0.14 * b + 0.6 * st, sz = 1 - 0.3 * b + 0.32 * st;
    if (this.belly && this.kid) { this.belly.scale.set(this.restB.x * sx, this.restB.y, this.restB.z * sz); this.kid.scale.set(this.restK.x / sx, this.restK.y, this.restK.z / sz); }
    if (this.chest) { if (Math.abs(s.rx[0]) > 1e-4) rotWorld(this.chest, X, s.rx[0]); if (Math.abs(s.rz[0]) > 1e-4) rotWorld(this.chest, Z, s.rz[0]); }
    m.updateMatrixWorld(true);

    // limbs
    const hipX = this.hips ? this.hips.getWorldPosition(new V()).x : 0;
    for (const l of this.limbs) {
      const d = this.drag?.kind === "limb" && this.drag.limb === l ? this.drag : null, A = l.a.getWorldPosition(new V()), B = l.b.getWorldPosition(new V()), C = l.c.getWorldPosition(new V());
      let want = 0;
      if (d) { want = 1; l.goal.lerp(d.target, 1 - Math.exp(-20 * dt)); }
      else if (this.gest && this.gest.limbs.includes(l.key)) {
        want = 1; const side = A.x >= hipX ? 1 : -1, g = this.gestureGoal(l, t, A, A.distanceTo(B) + B.distanceTo(C), side);
        if (!l.started || l.w[0] < 0.05) { l.goal.copy(C); l.started = true; } l.goal.lerp(g, 1 - Math.exp(-7 * dt));
      }
      spring(l.w, want, 120, want ? 16 : 10, dt); l.w[0] = clamp(l.w[0], -0.25, 1.05);
      if (!want && Math.abs(l.w[0]) < 0.003 && Math.abs(l.w[1]) < 0.01) { l.w[0] = 0; l.w[1] = 0; continue; }
      this.solve(l, A, B, C, C.clone().lerp(l.goal, l.w[0]));
    }
    // head: nod, look where you drag
    this.headX = s.hx[0] * 0.5; this.headY = s.hy[0];
  }

  private solve(l: Limb, A: THREE.Vector3, B: THREE.Vector3, C: THREE.Vector3, T: THREE.Vector3) {
    const l1 = A.distanceTo(B), l2 = B.distanceTo(C), to = T.clone().sub(A); let d = to.length(); if (d < 1e-5) return;
    const u = to.divideScalar(d); d = clamp(d, Math.abs(l1 - l2) + 1e-3, l1 + l2 - 1e-3);
    const ac = C.clone().sub(A).normalize(), pole = B.clone().sub(A); pole.addScaledVector(ac, -pole.dot(ac));
    if (pole.lengthSq() < 1e-8) pole.set(0, l.arm ? -0.3 : 0, l.arm ? -1 : 1); // straight limb: bend the elbow back, the knee forward
    pole.addScaledVector(u, -pole.dot(u)).normalize();
    const x = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
    const E = A.clone().addScaledVector(u, x).addScaledVector(pole, h), Tc = A.clone().addScaledVector(u, d);
    aim(l.a, A, B, E);
    const B2 = l.b.getWorldPosition(new V()), C2 = l.c.getWorldPosition(new V());
    aim(l.b, B2, C2, Tc);
  }
}
