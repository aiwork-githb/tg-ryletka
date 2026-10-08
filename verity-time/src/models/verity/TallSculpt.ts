import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { SdfModel, type V3 } from '../sdf/Sdf';

/**
 * Verity's last form: a very tall, starved, mustard-yellow figure with a
 * tiny bald head and a grin far too wide for it. Sculpted with the SDF
 * modeller (body, head and hands at different resolutions), skinned to a
 * 25-bone skeleton. Rest pose: arms hanging in a slight A, legs straight,
 * facing +z, feet on y = 0. Character left is +x.
 */

export const SKIN = '#d6b43c';
const SKIN_DARK = '#b8952c';
const LIP = '#b98d2e';
const CAVITY = '#2a0707';
const SOCKET = '#2b1d08';

export interface BoneDef {
  name: string;
  parent: number;
  head: V3;
  tail: V3;
  /** Half-length of the weight blend across this bone's head joint. */
  blend: number;
}

// joint positions (rest pose)
const J = {
  hips: [0, 1.06, -0.005] as V3,
  spine: [0, 1.2, -0.02] as V3,
  chest: [0, 1.38, -0.015] as V3,
  neck: [0, 1.625, -0.012] as V3,
  head: [0, 1.86, 0.02] as V3,
  headTop: [0, 2.14, 0.0] as V3,
  jaw: [0, 1.958, -0.012] as V3,
  chin: [0, 1.86, 0.07] as V3,
};
const side = (s: number) => ({
  cla: [s * 0.025, 1.6, 0.035] as V3,
  shoulder: [s * 0.182, 1.585, -0.012] as V3,
  elbow: [s * 0.222, 1.17, -0.03] as V3,
  wrist: [s * 0.252, 0.765, -0.006] as V3,
  knuckle: [s * 0.259, 0.655, 0.0] as V3,
  tip: [s * 0.262, 0.53, 0.01] as V3,
  hip: [s * 0.088, 1.065, 0.0] as V3,
  knee: [s * 0.088, 0.595, 0.0] as V3,
  ankle: [s * 0.088, 0.075, 0.0] as V3,
  ball: [s * 0.092, 0.018, 0.135] as V3,
  toe: [s * 0.094, 0.012, 0.2] as V3,
});
const L = side(1);
const R = side(-1);

export const B = {
  root: 0, hips: 1, spine: 2, chest: 3, neck: 4, head: 5, jaw: 6,
  claL: 7, upperArmL: 8, foreArmL: 9, handL: 10, fingersL: 11,
  claR: 12, upperArmR: 13, foreArmR: 14, handR: 15, fingersR: 16,
  thighL: 17, shinL: 18, footL: 19, toesL: 20,
  thighR: 21, shinR: 22, footR: 23, toesR: 24,
} as const;

export const BONES: BoneDef[] = [
  { name: 'root', parent: -1, head: [0, 0, 0], tail: J.hips, blend: 0.01 },
  { name: 'hips', parent: 0, head: J.hips, tail: J.spine, blend: 0.01 },
  { name: 'spine', parent: 1, head: J.spine, tail: J.chest, blend: 0.07 },
  { name: 'chest', parent: 2, head: J.chest, tail: J.neck, blend: 0.08 },
  { name: 'neck', parent: 3, head: J.neck, tail: J.head, blend: 0.05 },
  { name: 'head', parent: 4, head: J.head, tail: J.headTop, blend: 0.035 },
  { name: 'jaw', parent: 5, head: J.jaw, tail: J.chin, blend: 0.01 },
  ...(['L', 'R'] as const).flatMap((sd) => {
    const P = sd === 'L' ? L : R;
    const o = sd === 'L' ? 0 : 5;
    return [
      { name: 'cla' + sd, parent: 3, head: P.cla, tail: P.shoulder, blend: 0.05 },
      { name: 'upperArm' + sd, parent: 7 + o, head: P.shoulder, tail: P.elbow, blend: 0.05 },
      { name: 'foreArm' + sd, parent: 8 + o, head: P.elbow, tail: P.wrist, blend: 0.04 },
      { name: 'hand' + sd, parent: 9 + o, head: P.wrist, tail: P.knuckle, blend: 0.022 },
      { name: 'fingers' + sd, parent: 10 + o, head: P.knuckle, tail: P.tip, blend: 0.016 },
    ] as BoneDef[];
  }),
  ...(['L', 'R'] as const).flatMap((sd) => {
    const P = sd === 'L' ? L : R;
    const o = sd === 'L' ? 0 : 4;
    return [
      { name: 'thigh' + sd, parent: 1, head: P.hip, tail: P.knee, blend: 0.06 },
      { name: 'shin' + sd, parent: 17 + o, head: P.knee, tail: P.ankle, blend: 0.045 },
      { name: 'foot' + sd, parent: 18 + o, head: P.ankle, tail: P.ball, blend: 0.03 },
      { name: 'toes' + sd, parent: 19 + o, head: P.ball, tail: P.toe, blend: 0.014 },
    ] as BoneDef[];
  }),
];

const lerp3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const add3 = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

// ===================================================================== body

function sculptBody(): SdfModel {
  const m = new SdfModel().color(SKIN);
  // pelvis and hips
  m.ellipsoid([0, 1.1, -0.012], [0.098, 0.078, 0.068], { bone: B.hips });
  for (const s of [1, -1]) {
    m.ellipsoid([s * 0.046, 1.062, -0.04], [0.043, 0.052, 0.038], { k: 0.045, bone: B.hips });
  }
  // a narrow, sunken waist
  m.ellipsoid([0, 1.255, -0.014], [0.076, 0.11, 0.05], { k: 0.09, bone: B.spine });
  // ribcage
  const RC: V3 = [0, 1.47, -0.002];
  const RR: V3 = [0.124, 0.15, 0.088];
  m.ellipsoid(RC, RR, { k: 0.07, bone: B.chest });
  m.ellipsoid([0, 1.578, -0.012], [0.144, 0.046, 0.064], { k: 0.05, bone: B.chest });
  // back muscles beside the spine
  for (const s of [1, -1]) {
    m.cone([s * 0.03, 1.13, -0.046], [s * 0.032, 1.33, -0.06], 0.016, 0.016, { k: 0.035, bone: B.spine });
    m.cone([s * 0.032, 1.33, -0.06], [s * 0.034, 1.52, -0.07], 0.016, 0.014, { k: 0.035, bone: B.chest });
  }
  // shoulder blades
  for (const s of [1, -1]) m.ellipsoid([s * 0.072, 1.5, -0.068], [0.048, 0.064, 0.016], { k: 0.03, rot: [0.1, 0, s * 0.22], bone: B.chest });
  // trapezius
  for (const s of [1, -1]) m.cone([s * 0.022, 1.7, -0.028], [s * 0.148, 1.612, -0.018], 0.02, 0.015, { k: 0.045, bone: B.chest });
  // ribs: broad ridges under the skin, sloping toward the front
  for (let i = 0; i < 8; i++) {
    const yb = 1.585 - i * 0.033;
    const drop = 0.045 + i * 0.012;
    for (const s of [1, -1]) {
      const pts: V3[] = [];
      const rad: number[] = [];
      const end = 1.3 - i * 0.075;
      for (let j = 0; j <= 9; j++) {
        const f = j / 9;
        const ph = -0.7 + f * (end + 0.7);
        const y = yb - drop * f;
        const c = Math.sqrt(Math.max(0, 1 - ((y - RC[1]) / RR[1]) ** 2));
        const sink = 0.0075;
        const ax = RR[0] * c - sink;
        const az = RR[2] * c - sink;
        pts.push([s * ax * Math.cos(ph), y, az * Math.sin(ph) + RC[2]]);
        rad.push(0.0108 * (1 - 0.3 * Math.abs(f - 0.45)));
      }
      m.chain(pts, rad, { k: 0.016, bone: B.chest });
    }
  }
  // sternum, collarbones, the hollows above them
  m.cone([0, 1.6, 0.062], [0, 1.42, 0.07], 0.008, 0.007, { k: 0.025, bone: B.chest });
  for (const s of [1, -1]) {
    m.cone([s * 0.018, 1.617, 0.062], [s * 0.164, 1.607, 0.006], 0.0095, 0.0085, { k: 0.014, bone: B.chest });
    m.sphere([s * 0.088, 1.636, 0.046], 0.016, { op: 'sub', k: 0.02, bone: B.chest });
  }
  m.sphere([0, 1.218, 0.036], 0.0055, { op: 'sub', k: 0.004, color: SKIN_DARK });
  // neck (body part stops under the jaw; the head mesh overlaps it)
  m.cone(J.neck, [0, 1.835, 0.012], 0.033, 0.029, { k: 0.03, bone: B.neck });
  for (const s of [1, -1]) m.cone([s * 0.034, 1.85, 0.002], [s * 0.012, 1.638, 0.056], 0.0068, 0.0088, { k: 0.018, bone: B.neck });
  m.ellipsoid([0, 1.735, 0.032], [0.009, 0.014, 0.008], { k: 0.01, bone: B.neck });
  // upper arms and thighs; the rest of each limb is a finer mesh that takes
  // over inside a tapered overlap (see sculptArm / sculptLeg)
  for (const [P, s] of [[L, 1], [R, -1]] as const) {
    const o = s > 0 ? 0 : 5;
    m.ellipsoid(add3(P.shoulder, [s * 0.004, -0.022, 0]), [0.033, 0.056, 0.037], { k: 0.035, bone: B.upperArmL + o });
    m.cone(P.shoulder, lerp3(P.shoulder, P.elbow, ARM_CUT), upperR(0), upperR(ARM_CUT), { k: 0.03, bone: B.upperArmL + o });
  }
  for (const [P, s] of [[L, 1], [R, -1]] as const) {
    const o = s > 0 ? 0 : 4;
    m.cone(P.hip, P.knee, 0.05, 0.035, { k: 0.045, bone: B.thighL + o });
    m.ellipsoid(add3(lerp3(P.hip, P.knee, 0.45), [s * 0.004, 0, 0.012]), [0.04, 0.15, 0.038], { k: 0.03, bone: B.thighL + o });
    m.sphere(add3(P.knee, [0, 0.004, 0.006]), 0.033, { k: 0.026, bone: B.shinL + o });
    m.ellipsoid(add3(P.knee, [0, 0.014, 0.034]), [0.021, 0.026, 0.012], { k: 0.012, bone: B.shinL + o });
    m.cone(P.knee, lerp3(P.knee, P.ankle, LEG_CUT), shinR(0), shinR(LEG_CUT), { k: 0.02, bone: B.shinL + o });
    m.ellipsoid(add3(lerp3(P.knee, P.ankle, 0.3), [s * 0.002, 0, -0.022]), [0.029, 0.1, 0.03], { k: 0.03, bone: B.shinL + o });
  }
  return m;
}

// limb radii along the bone (t = 0 at the upper joint)
const upperR = (t: number) => 0.026 + (0.021 - 0.026) * t;
const shinR = (t: number) => 0.031 + (0.019 - 0.031) * t;
const ARM_CUT = 0.55;
const LEG_CUT = 0.45;

/** Lower arm and hand at a finer resolution. */
function sculptArm(P: ReturnType<typeof side>, s: number): SdfModel {
  const m = new SdfModel().color(SKIN);
  const o = s > 0 ? 0 : 5;
  const ub = B.upperArmL + o;
  const fb = B.foreArmL + o;
  const hb = B.handL + o;
  const fgb = B.fingersL + o;
  const U = (t: number) => lerp3(P.shoulder, P.elbow, t);
  // starts thinner inside the coarse upper arm, ends a hair thicker: the seam
  // is a shallow crossing instead of a step
  m.cone(U(0.4), U(0.5), upperR(0.4) - 0.0014, upperR(0.5) + 0.0006, { bone: ub });
  m.cone(U(0.5), P.elbow, upperR(0.5) + 0.0006, upperR(1), { k: 0.004, bone: ub });
  m.sphere(add3(P.elbow, [0, 0, -0.01]), 0.021, { k: 0.02, bone: fb });
  m.cone(P.elbow, P.wrist, 0.025, 0.0155, { k: 0.015, bone: fb });
  m.ellipsoid(lerp3(P.elbow, P.wrist, 0.25), [0.026, 0.09, 0.023], { k: 0.02, bone: fb });
  // wrist bones
  m.sphere(add3(P.wrist, [s * 0.006, 0.006, -0.004]), 0.011, { k: 0.01, bone: fb });
  m.sphere(add3(P.wrist, [-s * 0.004, 0.004, 0.008]), 0.01, { k: 0.01, bone: fb });
  // palm: thin and long, tendons on the back
  const palmC = lerp3(P.wrist, P.knuckle, 0.5);
  m.ellipsoid(palmC, [0.0118, 0.058, 0.03], { k: 0.016, rot: [0, 0, s * 0.05], bone: hb });
  m.ellipsoid(add3(P.wrist, [-s * 0.003, -0.034, 0.016]), [0.012, 0.03, 0.016], { k: 0.012, bone: hb });
  const fingers: Array<[number, number, number]> = [
    [0.021, 0.112, 0.0074], [0.007, 0.126, 0.0076], [-0.008, 0.12, 0.0072], [-0.022, 0.098, 0.0064],
  ];
  for (const [dz] of fingers) {
    m.cone(add3(P.wrist, [s * 0.008, -0.02, dz * 0.4]), [P.knuckle[0] + s * 0.007, P.knuckle[1] + 0.012, P.knuckle[2] + dz], 0.0032, 0.0048, { k: 0.008, bone: hb });
  }
  // four long fingers fanned along z (palm faces the thigh), curling toward the palm
  for (const [dz, len, r] of fingers) {
    const a: V3 = [P.knuckle[0], P.knuckle[1] + 0.006, P.knuckle[2] + dz];
    m.sphere(a, r * 1.3, { k: 0.008, bone: fgb });
    const pts: V3[] = [a];
    let p = a;
    const segs = [0.42, 0.33, 0.25];
    let curl = 0.12;
    for (const f of segs) {
      const dy = -len * f * Math.cos(curl);
      const dx = -s * len * f * Math.sin(curl);
      p = [p[0] + dx, p[1] + dy, p[2] + dz * 0.08];
      pts.push(p);
      curl += 0.2;
    }
    m.chain(pts, [r, r * 0.86, r * 0.72, r * 0.3], { k: 0.005, bone: fgb });
    // knuckle bumps on the joints
    m.sphere(pts[1], r * 0.98, { k: 0.006, bone: fgb });
    m.sphere(pts[2], r * 0.84, { k: 0.006, bone: fgb });
    // dark, pointed nails
    m.sphere(lerp3(pts[2], pts[3], 0.75), r * 0.55, { op: 'paint', soft: 0.003, color: '#6e5820' });
  }
  // thumb
  const t0 = add3(P.wrist, [-s * 0.006, -0.03, 0.026]);
  const t1 = add3(t0, [-s * 0.012, -0.034, 0.016]);
  const t2 = add3(t1, [-s * 0.012, -0.03, 0.004]);
  const t3 = add3(t2, [-s * 0.008, -0.022, -0.004]);
  m.chain([t0, t1, t2, t3], [0.0098, 0.0082, 0.0068, 0.003], { k: 0.01, bone: hb });
  m.sphere(lerp3(t2, t3, 0.7), 0.004, { op: 'paint', soft: 0.003, color: '#6e5820' });
  return m;
}

/** Lower leg and foot at a finer resolution. */
function sculptLeg(P: ReturnType<typeof side>, s: number): SdfModel {
  const m = new SdfModel().color(SKIN);
  const o = s > 0 ? 0 : 4;
  const sb = B.shinL + o;
  const fb = B.footL + o;
  const tb = B.toesL + o;
  const S = (t: number) => lerp3(P.knee, P.ankle, t);
  m.cone(S(0.33), S(0.42), shinR(0.33) - 0.0016, shinR(0.42) + 0.0006, { bone: sb });
  m.cone(S(0.42), P.ankle, shinR(0.42) + 0.0006, shinR(1), { k: 0.004, bone: sb });
  m.cone(S(0.5), add3(P.ankle, [0, 0.08, 0.014]), 0.006, 0.005, { k: 0.014, bone: sb });
  // ankle bones
  m.sphere(add3(P.ankle, [s * 0.017, 0.006, -0.002]), 0.011, { k: 0.01, bone: sb });
  m.sphere(add3(P.ankle, [-s * 0.015, 0.01, 0.0]), 0.012, { k: 0.01, bone: sb });
  // achilles
  m.cone(add3(P.ankle, [0, 0.1, -0.016]), add3(P.ankle, [0, -0.03, -0.034]), 0.007, 0.009, { k: 0.012, bone: fb });
  // heel and a long, bony foot
  m.sphere(add3(P.ankle, [0, -0.043, -0.026]), 0.026, { k: 0.02, bone: fb });
  m.ellipsoid(add3(P.ankle, [s * 0.003, -0.048, 0.06]), [0.03, 0.022, 0.085], { k: 0.026, rot: [0.08, 0, 0], bone: fb });
  // metatarsal ridges on the top
  for (let i = 0; i < 4; i++) {
    const dx = (-0.018 + i * 0.012) * s;
    m.cone(add3(P.ankle, [dx * 0.5, -0.02, 0.02]), [P.ball[0] + dx, P.ball[1] + 0.012, P.ball[2] - 0.012], 0.004, 0.006, { k: 0.01, bone: fb });
  }
  // toes, big toe on the inside
  const toes: Array<[number, number, number]> = [
    [-0.021, 0.0105, 0.068], [-0.005, 0.0082, 0.062], [0.007, 0.0076, 0.055], [0.018, 0.007, 0.047], [0.027, 0.0063, 0.039],
  ];
  for (const [dx, r, len] of toes) {
    const a: V3 = [P.ball[0] + s * dx, P.ball[1] + 0.003, P.ball[2] - 0.006];
    const pts: V3[] = [a, [a[0], a[1] + 0.001, a[2] + len * 0.45], [a[0] + s * 0.0008, a[1] - 0.002, a[2] + len * 0.8], [a[0] + s * 0.001, a[1] - 0.004, a[2] + len]];
    m.chain(pts, [r, r * 0.92, r * 0.85, r * 0.7], { k: 0.005, bone: tb });
    m.sphere(lerp3(pts[2], pts[3], 0.8), r * 0.7, { op: 'paint', soft: 0.003, color: '#9a7d2a' });
  }
  return m;
}

// ===================================================================== head

export interface MouthCurve {
  /** Meeting line of the teeth at s in [-1, 1]. */
  mid: (s: number) => V3;
  upper: (s: number) => V3;
  lower: (s: number) => V3;
  width: number;
}

const MOUTH_W = 0.064;
const mouthY = (s: number) => 1.906 + 0.03 * s * s;
const mouthGap = (s: number) => 0.034 * Math.pow(Math.max(0, 1 - s * s), 0.55) + 0.003;

function sculptHeadBase(): SdfModel {
  const m = new SdfModel().color(SKIN);
  m.ellipsoid([0, 2.02, -0.006], [0.082, 0.111, 0.097], { bone: B.head });
  m.ellipsoid([0, 1.946, 0.028], [0.069, 0.085, 0.078], { k: 0.045, bone: B.head });
  m.ellipsoid([0, 1.888, 0.052], [0.04, 0.034, 0.038], { k: 0.035, bone: B.head });
  for (const s of [1, -1]) {
    m.sphere([s * 0.051, 1.985, 0.066], 0.023, { k: 0.03, bone: B.head });
    m.sphere([s * 0.084, 2.02, 0.036], 0.019, { op: 'sub', k: 0.02 });
    // ears: small and flat
    m.ellipsoid([s * 0.081, 1.99, -0.006], [0.009, 0.025, 0.017], { k: 0.01, bone: B.head });
    m.sphere([s * 0.087, 1.99, -0.004], 0.006, { op: 'sub', k: 0.005, color: SKIN_DARK });
  }
  m.ellipsoid([0, 2.034, 0.08], [0.066, 0.017, 0.022], { k: 0.03, bone: B.head });
  // neck stub reaching down into the body's neck (slightly thicker: it wins the overlap)
  m.cone([0, 1.76, 0.005], [0, 1.81, 0.012], 0.0272, 0.0303, { bone: B.neck });
  m.cone([0, 1.81, 0.012], [0, 1.9, 0.022], 0.0303, 0.03, { k: 0.004, bone: B.neck });
  for (const s of [1, -1]) m.cone([s * 0.034, 1.85, 0.002], [s * 0.026, 1.77, 0.029], 0.0071, 0.0081, { k: 0.018, bone: B.neck });
  return m;
}

function sculptHead(): { model: SdfModel; mouth: MouthCurve } {
  const m = sculptHeadBase();
  const base = sculptHeadBase();
  // features are placed on the surface of the base head
  const front = (x: number, y: number) => base.frontZ(x, y, 0.3);
  // nose: barely there
  m.ellipsoid([0, 1.97, front(0, 1.97) - 0.004], [0.011, 0.022, 0.013], { k: 0.016, bone: B.head });
  for (const s of [1, -1]) m.sphere([s * 0.0065, 1.954, front(s * 0.0065, 1.954) + 0.008], 0.0042, { op: 'sub', k: 0.003, color: SOCKET });
  // deep eye sockets
  for (const s of [1, -1]) m.sphere([s * 0.031, 2.004, front(s * 0.031, 2.004) + 0.006], 0.019, { op: 'sub', k: 0.012, color: SOCKET });
  // the grin: lifted cheeks, folds, lips, then the cut
  for (const s of [1, -1]) {
    m.sphere([s * 0.057, 1.95, front(s * 0.057, 1.95) - 0.013], 0.019, { k: 0.03, bone: B.head });
  }
  const N = 14;
  const curve = (f: (s: number) => number, dz: number): V3[] => {
    const out: V3[] = [];
    for (let i = 0; i <= N; i++) {
      const s = -1 + (2 * i) / N;
      const x = s * MOUTH_W;
      const y = f(s);
      out.push([x, y, front(x, y) + dz]);
    }
    return out;
  };
  const up = curve((s) => mouthY(s) + mouthGap(s) / 2 + 0.002, 0.001);
  const lo = curve((s) => mouthY(s) - mouthGap(s) / 2 - 0.002, 0.001);
  m.chain(up, up.map((_, i) => 0.0032 + 0.0012 * Math.sin((i / N) * Math.PI)), { k: 0.006, color: LIP, bone: B.head });
  m.chain(lo, lo.map((_, i) => 0.0036 + 0.0014 * Math.sin((i / N) * Math.PI)), { k: 0.006, color: LIP, bone: B.jaw });
  const cut = curve(mouthY, -0.004);
  m.chain(cut, cut.map((_, i) => mouthGap(-1 + (2 * i) / N) / 2 + 0.0022), { op: 'sub', k: 0.003, color: CAVITY });
  // the mouth curve for teeth, measured on the final surface
  const mid = (s: number): V3 => {
    const x = s * MOUTH_W * 0.97;
    const y = mouthY(s);
    return [x, y, front(x, y) - 0.0045];
  };
  const upper = (s: number): V3 => {
    const p = mid(s);
    return [p[0], p[1] + mouthGap(s) / 2, p[2]];
  };
  const lower = (s: number): V3 => {
    const p = mid(s);
    return [p[0], p[1] - mouthGap(s) / 2, p[2]];
  };
  return { model: m, mouth: { mid, upper, lower, width: MOUTH_W } };
}

// ===================================================================== skin

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

const children: number[][] = BONES.map(() => []);
BONES.forEach((b, i) => {
  if (b.parent >= 0) children[b.parent].push(i);
});

function segDist(p: V3, a: V3, b: V3): number {
  const abx = b[0] - a[0], aby = b[1] - a[1], abz = b[2] - a[2];
  const apx = p[0] - a[0], apy = p[1] - a[1], apz = p[2] - a[2];
  const t = Math.max(0, Math.min(1, (apx * abx + apy * aby + apz * abz) / (abx * abx + aby * aby + abz * abz || 1)));
  return Math.hypot(apx - abx * t, apy - aby * t, apz - abz * t);
}

function jointT(p: V3, bone: number): number {
  const b = BONES[bone];
  const ax = b.tail[0] - b.head[0], ay = b.tail[1] - b.head[1], az = b.tail[2] - b.head[2];
  const l = Math.hypot(ax, ay, az) || 1;
  const s = ((p[0] - b.head[0]) * ax + (p[1] - b.head[1]) * ay + (p[2] - b.head[2]) * az) / l;
  return smoothstep(-b.blend, b.blend, s);
}

/** Smooth skin weights from the region (nearest part) of each vertex. */
function skin(geo: THREE.BufferGeometry, region: Uint8Array, jaw?: (p: V3) => number): void {
  const pos = geo.getAttribute('position');
  const n = pos.count;
  const si = new Uint16Array(n * 4);
  const sw = new Float32Array(n * 4);
  const w = new Map<number, number>();
  for (let v = 0; v < n; v++) {
    const p: V3 = [pos.getX(v), pos.getY(v), pos.getZ(v)];
    const bn = region[v];
    w.clear();
    const par = BONES[bn].parent;
    let wb = 1;
    if (par > 0) {
      wb = jointT(p, bn);
      w.set(par, 1 - wb);
    }
    const ch = children[bn];
    if (ch.length) {
      let best = ch[0];
      let bd = Infinity;
      for (const c of ch) {
        if (c === B.jaw) continue;
        const d = segDist(p, BONES[c].head, BONES[c].tail);
        if (d < bd) {
          bd = d;
          best = c;
        }
      }
      if (best !== B.jaw) {
        const wc = jointT(p, best);
        w.set(best, wb * wc);
        wb *= 1 - wc;
      }
    }
    w.set(bn, (w.get(bn) ?? 0) + wb);
    if (jaw) {
      const hw = w.get(B.head) ?? 0;
      if (hw > 0) {
        const jw = jaw(p) * hw;
        w.set(B.head, hw - jw);
        w.set(B.jaw, (w.get(B.jaw) ?? 0) + jw);
      }
    }
    const list = [...w.entries()].filter(([, x]) => x > 1e-4).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const tot = list.reduce((a, [, x]) => a + x, 0) || 1;
    list.forEach(([b, x], i) => {
      si[v * 4 + i] = b;
      sw[v * 4 + i] = x / tot;
    });
  }
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
}

/** Rigid skin (everything on one bone). */
function rigid(geo: THREE.BufferGeometry, bone: number): THREE.BufferGeometry {
  const n = geo.getAttribute('position').count;
  const si = new Uint16Array(n * 4);
  const sw = new Float32Array(n * 4);
  for (let v = 0; v < n; v++) {
    si[v * 4] = bone;
    sw[v * 4] = 1;
  }
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  return geo;
}

/** Subtle mottling so the skin is not a flat paint job. */
function mottle(geo: THREE.BufferGeometry, amt = 0.07): void {
  const pos = geo.getAttribute('position');
  const col = geo.getAttribute('color');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const n = Math.sin(x * 61 + y * 13) * Math.sin(y * 47 - z * 29) * 0.5 + Math.sin(x * 157 + z * 171 + y * 23) * 0.5;
    const f = 1 + n * amt;
    col.setXYZ(i, col.getX(i) * f, col.getY(i) * (1 + n * amt * 0.8), col.getZ(i) * (1 + n * amt * 0.5));
  }
}

// ===================================================================== teeth / eyes

function teethRow(mouth: MouthCurve, upper: boolean): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const n = 16;
  const enamel = new THREE.Color('#f1e9d2');
  const stain = new THREE.Color('#c9b27e');
  for (let i = 0; i < n; i++) {
    const s0 = -1 + (2 * (i + 0.02)) / n;
    const s1 = -1 + (2 * (i + 0.98)) / n;
    const sc = (s0 + s1) / 2;
    const a = mouth.mid(s0);
    const b = mouth.mid(s1);
    const c = mouth.mid(sc);
    const edge = upper ? mouth.upper(sc) : mouth.lower(sc);
    const w = Math.hypot(b[0] - a[0], b[2] - a[2]) * (1 - Math.abs(sc) * 0.12);
    // from the bite line to under the lip
    const h = Math.abs(edge[1] - c[1]) + 0.0045;
    // canines are narrower and longer, the rest vary a little
    const canine = Math.abs(Math.abs(sc) - 0.62) < 0.07;
    const ww = w * (canine ? 0.92 : 1.0 + ((i * 37) % 7) * 0.008);
    const hh = h + (canine ? 0.0022 : ((i * 53) % 5) * 0.0004);
    const g = new RoundedBoxGeometry(ww, hh, 0.0058, 2, 0.0011);
    g.deleteAttribute('uv');
    const h2 = hh;
    const p = g.getAttribute('position');
    for (let v = 0; v < p.count; v++) {
      let x = p.getX(v);
      const y = p.getY(v);
      let z = p.getZ(v);
      // 0 at the biting edge, 1 at the root
      const ty = upper ? y / h2 + 0.5 : 0.5 - y / h2;
      x *= 1 - 0.18 * ty;
      if (canine && ty < 0.3) x *= 0.55 + ty * 1.5;
      if (z > 0) z += 0.0012 * Math.max(0, 1 - ((2 * x) / ww) ** 2);
      p.setXYZ(v, x, y, z);
    }
    g.computeVertexNormals();
    const col = new Float32Array(p.count * 3);
    for (let v = 0; v < p.count; v++) {
      const ty = upper ? p.getY(v) / h2 + 0.5 : 0.5 - p.getY(v) / h2;
      const k = Math.min(1, ty * 0.8 + (i % 5 === 2 ? 0.25 : 0) + (i % 7 === 4 ? 0.15 : 0));
      const cc = enamel.clone().lerp(stain, k * 0.6);
      col[v * 3] = cc.r;
      col[v * 3 + 1] = cc.g;
      col[v * 3 + 2] = cc.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    // follow the arch: face outwards
    const yaw = Math.atan2(b[2] - a[2], b[0] - a[0]);
    g.rotateY(-yaw);
    const bite = c[1] + (upper ? 0.0007 : -0.0007);
    g.translate(c[0], bite + (upper ? h2 / 2 : -h2 / 2), c[2]);
    parts.push(g.index ? g.toNonIndexed() : g);
  }
  // gum strip behind the roots
  const gum = new THREE.BufferGeometry();
  const gp: number[] = [];
  const gc: number[] = [];
  const red = new THREE.Color('#7e2c38');
  for (let i = 0; i < 24; i++) {
    const s0 = -1 + (2 * i) / 24;
    const s1 = -1 + (2 * (i + 1)) / 24;
    const m0 = mouth.mid(s0);
    const m1 = mouth.mid(s1);
    const e0 = upper ? mouth.upper(s0) : mouth.lower(s0);
    const e1 = upper ? mouth.upper(s1) : mouth.lower(s1);
    const o = upper ? 0.006 : -0.006;
    const quad: V3[] = [
      [m0[0], m0[1], m0[2] - 0.004], [m1[0], m1[1], m1[2] - 0.004],
      [e1[0], e1[1] + o, e1[2] - 0.004], [e0[0], e0[1] + o, e0[2] - 0.004],
    ];
    const tri = upper ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
    for (const t of tri) {
      gp.push(...quad[t]);
      gc.push(red.r, red.g, red.b);
    }
  }
  gum.setAttribute('position', new THREE.Float32BufferAttribute(gp, 3));
  gum.setAttribute('color', new THREE.Float32BufferAttribute(gc, 3));
  gum.computeVertexNormals();
  parts.push(gum);
  return mergeGeometries(parts)!;
}

// ===================================================================== build

export interface TallGeometry {
  skin: THREE.BufferGeometry;
  teeth: THREE.BufferGeometry;
  eyes: Array<{ pos: V3; r: number }>;
  mouth: MouthCurve;
}

let cache: TallGeometry | null = null;

export function tallGeometry(quality = 1): TallGeometry {
  if (cache) return cache;
  const body = sculptBody();
  const bodyMesh = body.mesh({ cell: 0.0072 / quality, ao: 0.6, aoDist: 0.03 });
  skin(bodyMesh.geometry, bodyMesh.bones);
  mottle(bodyMesh.geometry);
  const { model: head, mouth } = sculptHead();
  const headMesh = head.mesh({ cell: 0.003 / quality, ao: 0.85, aoDist: 0.016 });
  const jawW = (p: V3) => {
    const s = Math.max(-1, Math.min(1, p[0] / MOUTH_W));
    const below = smoothstep(mouthY(s) + 0.002, mouthY(s) - 0.008, p[1]);
    const front = smoothstep(-0.03, 0.01, p[2]);
    const notNeck = smoothstep(1.83, 1.855, p[1]);
    return below * front * notNeck;
  };
  skin(headMesh.geometry, headMesh.bones, jawW);
  mottle(headMesh.geometry, 0.05);
  const limbs = [
    ...[sculptArm(L, 1), sculptArm(R, -1)].map((h) => h.mesh({ cell: 0.0032 / quality, ao: 0.7, aoDist: 0.012 })),
    ...[sculptLeg(L, 1), sculptLeg(R, -1)].map((h) => h.mesh({ cell: 0.0042 / quality, ao: 0.7, aoDist: 0.016 })),
  ].map((r) => {
    skin(r.geometry, r.bones);
    mottle(r.geometry, 0.05);
    return r.geometry;
  });
  const all = [bodyMesh.geometry, headMesh.geometry, ...limbs];
  const merged = mergeGeometries(all.map((g) => {
    // uniform index type for merging
    const idx = g.getIndex()!;
    if (!(idx.array instanceof Uint32Array)) g.setIndex(new THREE.Uint32BufferAttribute(Array.from(idx.array), 1));
    return g;
  }))!;
  const upperTeeth = rigid(teethRow(mouth, true), B.head);
  const lowerTeeth = rigid(teethRow(mouth, false), B.jaw);
  const teeth = mergeGeometries([upperTeeth, lowerTeeth])!;
  teeth.computeVertexNormals();
  const eyes = [1, -1].map((s) => {
    const x = s * 0.031;
    const y = 2.003;
    return { pos: [x, y, head.frontZ(x, y, 0.3) - 0.008] as V3, r: 0.0105 };
  });
  cache = { skin: merged, teeth, eyes, mouth };
  return cache;
}
