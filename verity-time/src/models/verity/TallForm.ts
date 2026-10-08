import * as THREE from 'three';
import { B, BONES, tallGeometry } from './TallSculpt';
import { packTall, unpackTall, type PackedTall, type TallMeshes } from './tallPack';
import type { Expression, Gesture } from '../VerityModel';

/** What the rig tells the tall body each frame (all in character space). */
export interface TallDrive {
  speed: number;
  look: THREE.Vector3 | null;
  point: THREE.Vector3 | null;
  tilt: number;
  twist: number;
  wrongness: number;
  talking: boolean;
  gesture: Gesture;
  gestureT: number;
  /** Free height above the feet (low ceilings make him stoop). */
  headroom: number;
  expression: Expression;
}

const DOWN = new THREE.Vector3(0, -1, 0);
const FWD = new THREE.Vector3(0, 0, 1);
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _q1 = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _e = new THREE.Euler();

const LT = 0.47; // thigh
const LS = 0.52; // shin
const ANKLE_H = 0.075;

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** Critically damped follow (stable for any dt). */
class Damp {
  x = 0;
  v = 0;
  constructor(x = 0) {
    this.x = x;
  }
  to(target: number, time: number, dt: number): number {
    const omega = 2 / Math.max(1e-3, time);
    const k = omega * dt;
    const exp = 1 / (1 + k + 0.48 * k * k + 0.235 * k * k * k);
    const change = this.x - target;
    const temp = (this.v + omega * change) * dt;
    this.v = (this.v - omega * temp) * exp;
    this.x = target + (change + temp) * exp;
    return this.x;
  }
}

// ------------------------------------------------------------------ build

let pending: Promise<TallMeshes> | null = null;

/** Mesh density for the tall form (set from the texture quality; read once). */
export const tallOptions = { quality: 1 };

/** Builds (once) the tall form's meshes, in a worker when possible. */
export function loadTallMeshes(quality = tallOptions.quality): Promise<TallMeshes> {
  if (pending) return pending;
  const sync = async () => unpackTall(packTall(tallGeometry(quality)).data);
  pending = new Promise<TallMeshes>((resolve) => {
    let w: Worker | null = null;
    try {
      w = new Worker(new URL('./tall.worker.ts', import.meta.url), { type: 'module' });
    } catch {
      w = null;
    }
    if (!w) {
      void sync().then(resolve);
      return;
    }
    const worker = w;
    worker.onmessage = (e: MessageEvent<PackedTall>) => {
      resolve(unpackTall(e.data));
      worker.terminate();
    };
    worker.onerror = (err) => {
      console.warn('tall worker failed, building on the main thread', err.message);
      worker.terminate();
      void sync().then(resolve);
    };
    worker.postMessage({ quality });
  });
  return pending;
}

// ------------------------------------------------------------------ rig

export class TallForm {
  readonly group = new THREE.Group();
  ready = false;
  private bones: THREE.Bone[] = [];
  private rest: THREE.Vector3[] = [];
  private pc: THREE.Vector3[] = [];
  private qc: THREE.Quaternion[] = [];
  private skinMat: THREE.MeshStandardMaterial;
  private teethMat: THREE.MeshStandardMaterial;
  private eyeMat: THREE.MeshStandardMaterial;
  // animation state
  private t = 0;
  private phase = 0;
  private spd = new Damp();
  private crouch = new Damp();
  private lookYaw = new Damp();
  private lookPitch = new Damp();
  private swing = [new Damp(), new Damp()];
  private flex = [new Damp(0.15), new Damp(0.15)];
  private gw = new Damp();
  private jaw = new Damp();
  private twitch = 0;
  private twitchT = 1.5;
  private twitchHold = 0;
  private fingerT = [0, 0];
  private fingerCurl = [new Damp(0.35), new Damp(0.35)];
  private strikeT = -1;
  private prevF = [0, 0.5];
  /** Set when a foot lands (the AI plays a footstep). */
  stepped = false;
  /** World point of the eyes (updated each frame). */
  readonly eyeLocal = new THREE.Vector3(0, 2.0, 0.1);

  constructor() {
    this.skinMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0 });
    this.teethMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.28, metalness: 0 });
    this.eyeMat = new THREE.MeshStandardMaterial({ color: 0x030202, roughness: 0.08, emissive: 0x000000 });
    for (let i = 0; i < BONES.length; i++) {
      this.pc.push(new THREE.Vector3());
      this.qc.push(new THREE.Quaternion());
    }
  }

  /** Eye material, so the rig can tint it with the mood. */
  get eyes(): THREE.MeshStandardMaterial {
    return this.eyeMat;
  }

  attach(m: TallMeshes): void {
    if (this.ready) return;
    const bones: THREE.Bone[] = [];
    BONES.forEach((d, i) => {
      const b = new THREE.Bone();
      b.name = d.name;
      const ph = d.parent >= 0 ? BONES[d.parent].head : [0, 0, 0];
      const off = new THREE.Vector3(d.head[0] - ph[0], d.head[1] - ph[1], d.head[2] - ph[2]);
      b.position.copy(off);
      this.rest.push(off.clone());
      if (d.parent >= 0) bones[d.parent].add(b);
      bones.push(b);
      void i;
    });
    this.bones = bones;
    const skin = new THREE.SkinnedMesh(m.skin, this.skinMat);
    skin.add(bones[0]);
    skin.updateMatrixWorld(true);
    const skeleton = new THREE.Skeleton(bones);
    skin.bind(skeleton);
    const teeth = new THREE.SkinnedMesh(m.teeth, this.teethMat);
    teeth.bind(skeleton, skin.bindMatrix);
    for (const mesh of [skin, teeth]) {
      mesh.frustumCulled = false;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
    this.group.add(skin, teeth);
    const head = BONES[B.head].head;
    for (const e of m.eyes) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(e.r, 16, 12), this.eyeMat);
      eye.position.set(e.pos[0] - head[0], e.pos[1] - head[1], e.pos[2] - head[2]);
      bones[B.head].add(eye);
    }
    this.ready = true;
  }

  /** Swing an arm at whatever is in front (bashing a door). */
  strike(): void {
    this.strikeT = 0;
  }

  // forward kinematics in character space
  private fk(i: number): void {
    const p = BONES[i].parent;
    const b = this.bones[i];
    if (p < 0) {
      this.pc[i].copy(b.position);
      this.qc[i].copy(b.quaternion);
      return;
    }
    this.pc[i].copy(b.position).applyQuaternion(this.qc[p]).add(this.pc[p]);
    this.qc[i].copy(this.qc[p]).multiply(b.quaternion);
  }

  /** Sets a bone's local rotation from a desired character-space rotation. */
  private setWorldQ(i: number, q: THREE.Quaternion): void {
    const p = BONES[i].parent;
    this.bones[i].quaternion.copy(_q1.copy(this.qc[p]).invert().multiply(q));
    this.fk(i);
  }

  /** Points a bone (rest direction straight down) along a character-space direction. */
  private aim(i: number, dir: THREE.Vector3, restDir = DOWN): void {
    const p = BONES[i].parent;
    const local = _v3.copy(dir).normalize().applyQuaternion(_q1.copy(this.qc[p]).invert());
    this.bones[i].quaternion.setFromUnitVectors(restDir, local);
    this.fk(i);
  }

  private setEuler(i: number, x: number, y: number, z: number, order: THREE.EulerOrder = 'XYZ'): void {
    this.bones[i].quaternion.setFromEuler(_e.set(x, y, z, order));
    this.fk(i);
  }

  update(dt: number, d: TallDrive): void {
    if (!this.ready) return;
    this.t += dt;
    const t = this.t;
    const speed = this.spd.to(d.speed, 0.25, dt);
    const amp = smoothstep(0.05, 0.6, speed);
    const runK = smoothstep(1.8, 3.6, speed);
    const crouch = this.crouch.to(Math.max(0, Math.min(1, (2.22 - d.headroom) / 1.05)), 0.35, dt);
    // gait clock: one cycle = two steps
    const strideLen = 1.3 + (2.7 - 1.3) * runK;
    const stanceFrac = 0.56 + (0.36 - 0.56) * runK;
    this.phase = (this.phase + (speed * dt) / (strideLen * (1 - crouch * 0.4))) % 1;
    const ph = this.phase;
    const TAU = Math.PI * 2;
    // random twitches: the head snaps sideways and holds
    this.twitchT -= dt;
    if (this.twitchT <= 0) {
      this.twitchT = 1.2 + Math.random() * (4 - d.wrongness * 3);
      this.twitch = (Math.random() - 0.5) * (0.35 + d.wrongness * 0.6);
      this.twitchHold = 0.12 + Math.random() * 0.3;
    }
    this.twitchHold -= dt;
    if (this.twitchHold < 0) this.twitch *= Math.exp(-dt * 6);

    // ------------------------------------------------------------ pelvis
    const hipsB = this.bones[B.hips];
    const drop = 0.025 + amp * (0.04 + runK * 0.075) + crouch * 0.42;
    const bob = amp * (runK > 0.5 ? 0.035 * Math.sin(ph * TAU * 2) : -0.018 * Math.cos(ph * TAU * 2));
    const sway = (1 - amp) * Math.sin(t * 0.45) * 0.012 + amp * Math.sin(ph * TAU) * 0.018 * (1 - runK);
    hipsB.position.set(this.rest[B.hips].x + sway, this.rest[B.hips].y - drop + bob, this.rest[B.hips].z - crouch * 0.12);
    const pelvisYaw = amp * Math.sin(ph * TAU) * (0.1 + runK * 0.08);
    const pelvisRoll = amp * Math.sin(ph * TAU) * 0.04 * (1 - runK) + (1 - amp) * Math.sin(t * 0.45 + 1) * 0.02;
    this.fk(B.root);
    this.setEuler(B.hips, runK * 0.12 + crouch * 0.25, pelvisYaw, pelvisRoll, 'YXZ');

    // ------------------------------------------------------------ spine
    const breathe = Math.sin(t * 1.25) * 0.018;
    const lean = 0.06 + amp * 0.06 + runK * 0.42 + crouch * 0.55;
    this.setEuler(B.spine, lean * 0.45, -pelvisYaw * 0.5 + d.twist * 0.3, -pelvisRoll * 0.6, 'YXZ');
    this.setEuler(B.chest, lean * 0.55 + breathe, -pelvisYaw * 0.6 + d.twist * 0.7, -pelvisRoll * 0.4, 'YXZ');

    // ------------------------------------------------------------ head
    let yawT = 0;
    let pitchT = -lean * 0.4;
    if (d.look) {
      const eye = _v1.set(0, 0.14, 0.05).applyQuaternion(this.qc[B.chest]).add(this.pc[B.neck]);
      const dx = d.look.x - eye.x;
      const dy = d.look.y - eye.y - 0.2;
      const dz = d.look.z - eye.z;
      const lim = 1.15 + d.wrongness * 1.4;
      yawT = Math.max(-lim, Math.min(lim, Math.atan2(dx, dz)));
      pitchT = Math.max(-0.7, Math.min(0.75, Math.atan2(dy, Math.hypot(dx, dz))));
    }
    const yaw = this.lookYaw.to(yawT, 0.18 - d.wrongness * 0.1, dt);
    const pitch = this.lookPitch.to(pitchT, 0.2, dt);
    const roll = d.tilt + this.twitch + Math.sin(t * 0.7) * 0.03;
    const headQ = _q2.setFromEuler(_e.set(-pitch, yaw, roll, 'YXZ'));
    // the neck takes part of the turn, the head the rest
    const neckQ = new THREE.Quaternion().copy(this.qc[B.chest]).slerp(headQ, 0.45);
    this.setWorldQ(B.neck, neckQ);
    this.setWorldQ(B.head, headQ);
    const jawOpen = d.talking ? 0.05 + Math.max(0, Math.sin(t * 15)) * 0.12 + Math.max(0, Math.sin(t * 9.3)) * 0.05 : 0;
    const jaw = this.jaw.to(jawOpen + (d.expression === 'open' ? 0.18 : 0), 0.05, dt);
    this.setEuler(B.jaw, jaw, 0, 0);
    this.eyeLocal.set(0, 0.145, 0.09).applyQuaternion(this.qc[B.head]).add(this.pc[B.head]);

    // ------------------------------------------------------------ arms
    this.gw.to(d.gesture === 'none' ? 0 : 1, 0.2, dt);
    let strike = -1;
    if (this.strikeT >= 0) {
      this.strikeT += dt;
      strike = this.strikeT / 0.7;
      if (strike >= 1) {
        this.strikeT = -1;
        strike = -1;
      }
    }
    for (const s of [1, -1]) {
      const k = s > 0 ? 0 : 1;
      const o = s > 0 ? 0 : 5;
      const cla = B.claL + o;
      const up = B.upperArmL + o;
      const fo = B.foreArmL + o;
      const ha = B.handL + o;
      const fi = B.fingersL + o;
      // left arm swings with the right leg
      const legPh = ph + (s > 0 ? 0.5 : 0);
      const swingAmp = amp * (0.26 + runK * 0.75);
      const swingT = -Math.sin(legPh * TAU) * swingAmp + runK * 0.25 + crouch * 0.9;
      const sw = this.swing[k].to(swingT, 0.09 + runK * 0.06, dt);
      const flexT = 0.14 + amp * 0.08 + runK * (0.5 + 0.3 * Math.sin(legPh * TAU)) + crouch * 0.2;
      let flex = this.flex[k].to(flexT, 0.12, dt);
      const shrug = d.gesture === 'shrug' ? this.gw.x * 0.14 : 0;
      this.setEuler(cla, 0, 0, s * (shrug + Math.sin(legPh * TAU) * 0.02 * amp));
      // hang under gravity, swung about the shoulder
      const restDir = _v2.set(BONES[fo].head[0] - BONES[up].head[0], BONES[fo].head[1] - BONES[up].head[1], BONES[fo].head[2] - BONES[up].head[2]).normalize();
      const hang = new THREE.Vector3().copy(restDir).applyAxisAngle(new THREE.Vector3(1, 0, 0), -sw);
      hang.x += s * 0.04 * runK;
      let armDir = hang;
      let foreFlex = flex;
      // gestures and the door strike override the dangling arm
      const g = this.gw.x;
      const pose = this.gesturePose(d, s, t);
      if (pose && g > 0.001) {
        armDir = hang.clone().lerp(pose.dir, g).normalize();
        foreFlex = flex + (pose.flex - flex) * g;
      }
      if (strike >= 0 && s < 0) {
        const wind = smoothstep(0, 0.4, strike) * (1 - smoothstep(0.45, 0.7, strike));
        const slam = smoothstep(0.42, 0.62, strike) * (1 - smoothstep(0.8, 1, strike));
        const dir = new THREE.Vector3(-0.15, 0.95, -0.15).multiplyScalar(wind).add(new THREE.Vector3(-0.05, -0.2, 1).multiplyScalar(slam)).add(armDir.clone().multiplyScalar(1 - wind - slam));
        armDir = dir.normalize();
        foreFlex = 0.3 + wind * 1.1;
      }
      this.aim(up, armDir, restDir);
      this.setEuler(fo, -foreFlex, 0, 0);
      flex = foreFlex;
      this.setEuler(ha, -0.08 - runK * 0.15, 0, s * 0.05);
      // fingers: loosely curled, twitching now and then
      this.fingerT[k] -= dt;
      if (this.fingerT[k] <= 0) this.fingerT[k] = 0.4 + Math.random() * 2.5;
      const curlT = (pose?.curl ?? 0.32) + (this.fingerT[k] < 0.15 ? 0.45 : 0) + runK * 0.2;
      const curl = this.fingerCurl[k].to(curlT, 0.06, dt);
      this.setEuler(fi, 0, 0, -s * curl);
    }

    // ------------------------------------------------------------ legs
    for (const s of [1, -1]) {
      const o = s > 0 ? 0 : 4;
      const th = B.thighL + o;
      const sh = B.shinL + o;
      const ft = B.footL + o;
      const to = B.toesL + o;
      const f = (ph + (s > 0 ? 0 : 0.5)) % 1;
      const fk = s > 0 ? 0 : 1;
      if (f < this.prevF[fk] - 0.5 && amp > 0.25) this.stepped = true;
      this.prevF[fk] = f;
      const S = strideLen * stanceFrac * amp * (1 - crouch * 0.5);
      let fz: number;
      let fy: number;
      let pitchF: number;
      if (f < stanceFrac) {
        const u = f / stanceFrac;
        fz = S / 2 - u * S;
        fy = 0;
        pitchF = (-0.22 + u * 0.1 + smoothstep(0.7, 1, u) * 0.75) * amp;
      } else {
        const u = (f - stanceFrac) / (1 - stanceFrac);
        fz = -S / 2 + S * smoothstep(0, 1, u);
        fy = Math.sin(Math.PI * u) * (0.1 + runK * 0.2) * amp;
        pitchF = (0.6 * (1 - u) - 0.25 * u) * amp;
      }
      const footX = s * (0.088 - runK * 0.018 + crouch * 0.05);
      // ankle target in character space (heel lift raises it)
      const ankle = _v1.set(footX, ANKLE_H + fy + Math.max(0, pitchF) * 0.11 + Math.max(0, -pitchF) * 0.02, fz + this.rest[B.hips].z);
      this.bones[th].quaternion.identity();
      this.fk(th);
      const hip = this.pc[th].clone();
      const toA = _v2.copy(ankle).sub(hip);
      const D = Math.min(LT + LS - 1e-4, Math.max(0.12, toA.length()));
      const u = toA.normalize();
      // knee points forward (and a bit outward)
      const pole = new THREE.Vector3(s * 0.12, 0, 1).normalize();
      const w = pole.sub(u.clone().multiplyScalar(pole.dot(u))).normalize();
      const cosA = (LT * LT + D * D - LS * LS) / (2 * LT * D);
      const a = Math.acos(Math.max(-1, Math.min(1, cosA)));
      const knee = hip.clone().addScaledVector(u, LT * Math.cos(a)).addScaledVector(w, LT * Math.sin(a));
      const ankleP = hip.clone().addScaledVector(u, D);
      this.aim(th, knee.clone().sub(hip));
      this.aim(sh, ankleP.sub(knee));
      // keep the foot level with the ground, rolling heel to toe
      this.setWorldQ(ft, _q2.setFromEuler(_e.set(pitchF, 0, 0)));
      this.setEuler(to, -Math.max(0, pitchF) * 0.9, 0, 0);
    }
    void FWD;
  }

  /** Arm target for a gesture: character-space direction, elbow flex, finger curl. */
  private gesturePose(d: TallDrive, s: number, t: number): { dir: THREE.Vector3; flex: number; curl: number } | null {
    const g = d.gesture;
    const right = s < 0;
    switch (g) {
      case 'wave':
        if (!right) return null;
        return { dir: new THREE.Vector3(-0.55, 0.75, 0.25).normalize(), flex: 1.0 + Math.sin(t * 5) * 0.45, curl: 0.1 };
      case 'point':
      case 'beckon': {
        if (!right) return null;
        let dir = new THREE.Vector3(-0.1, 0, 1);
        if (d.point) dir = d.point.clone().sub(this.pc[B.upperArmR]);
        return { dir: dir.normalize(), flex: g === 'beckon' ? 0.3 + Math.max(0, Math.sin(t * 4)) * 0.6 : 0.05, curl: g === 'beckon' ? 0.3 + Math.max(0, Math.sin(t * 4)) * 0.9 : 0.6 };
      }
      case 'cover':
        return { dir: new THREE.Vector3(-s * 0.25, -0.35, 1).normalize(), flex: 2.3, curl: 0.15 };
      case 'hug':
        return { dir: new THREE.Vector3(s * 0.15, -0.2, 1).normalize(), flex: 0.6, curl: 0.5 };
      case 'shrug':
        return { dir: new THREE.Vector3(s * 0.6, -0.8, 0.2).normalize(), flex: 1.4, curl: 0.2 };
      default:
        return null;
    }
  }
}
