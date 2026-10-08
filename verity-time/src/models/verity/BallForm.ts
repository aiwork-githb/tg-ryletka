import * as THREE from 'three';
import { Rng } from '../../assets/noise';
import type { Expression, Gesture } from '../VerityModel';

/**
 * Verity as everyone first meets him: a glossy yellow smiley ball. Two black
 * oval eyes and a mouth that is real geometry laid on the sphere: a thin
 * black smile at first (stages 0-1), a wide grin full of teeth (2), and at
 * stage 3 a smeared, ragged grin under bruised, sunken eyes.
 *
 * Face coordinates are angles on the sphere (radians = arc length / R):
 * lon to the right, lat up, (0, 0) in the middle of the face (+z).
 */

export const R = 0.42;
const YELLOW = '#f6d21e';

/** Mouth shape: half width, corner height, centre of the upper edge,
 * lower edge and bite line (where the teeth meet), edge exponents, outline. */
interface MouthP {
  W: number;
  yc: number;
  yu: number;
  yl: number;
  yb: number;
  pu: number;
  pl: number;
  band: number;
  teeth: number;
  tongue: number;
}

interface StageLook {
  eyeX: number;
  eyeY: number;
  eyeRX: number;
  eyeRY: number;
  /** How deep the eyes sit (stage 3: sockets). */
  socket: number;
  mouth: Record<Expression, MouthP>;
  rough: number;
  coat: number;
  upperTeeth: number;
  lowerTeeth: number;
  fangs: boolean;
  jag: number;
}

const M = (W: number, yc: number, yu: number, yl: number, yb: number, pu: number, pl: number, band: number, teeth = 0, tongue = 0): MouthP => ({ W, yc, yu, yl, yb, pu, pl, band, teeth, tongue });

const CUTE: Record<Expression, MouthP> = {
  smile: M(0.62, -0.06, -0.37, -0.37, -0.37, 1, 1, 0.02),
  open: M(0.22, -0.26, -0.18, -0.46, -0.32, 0.5, 0.5, 0.022, 0, 1),
  sad: M(0.42, -0.44, -0.33, -0.33, -0.33, 1, 1, 0.02),
  flat: M(0.32, -0.33, -0.33, -0.33, -0.33, 1, 1, 0.019),
  grin: M(0.68, -0.02, -0.26, -0.56, -0.4, 1.1, 0.75, 0.022, 0, 1),
};
const TOOTHY: Record<Expression, MouthP> = {
  smile: M(0.66, 0.08, -0.12, -0.49, -0.28, 1.05, 0.78, 0.026, 1),
  open: M(0.56, 0.0, -0.06, -0.58, -0.3, 0.8, 0.6, 0.026, 1, 0.6),
  sad: M(0.6, -0.3, -0.16, -0.46, -0.31, 0.9, 0.8, 0.026, 1),
  flat: M(0.6, -0.17, -0.17, -0.42, -0.3, 0.7, 0.7, 0.026, 1),
  grin: M(0.7, 0.13, -0.11, -0.52, -0.29, 1.1, 0.75, 0.027, 1),
};
const EVIL: Record<Expression, MouthP> = {
  smile: M(0.6, 0.3, -0.04, -0.62, -0.32, 1.5, 0.62, 0.04, 1),
  open: M(0.58, 0.24, 0.0, -0.7, -0.34, 1.2, 0.55, 0.042, 1, 0.4),
  sad: M(0.6, 0.05, -0.06, -0.6, -0.33, 1.2, 0.6, 0.04, 1),
  flat: M(0.6, 0.1, -0.06, -0.55, -0.31, 1.2, 0.6, 0.04, 1),
  grin: M(0.62, 0.34, -0.03, -0.66, -0.33, 1.6, 0.6, 0.042, 1),
};

const STAGES: StageLook[] = [
  { eyeX: 0.215, eyeY: 0.2, eyeRX: 0.07, eyeRY: 0.112, socket: 0, mouth: CUTE, rough: 0.28, coat: 0.85, upperTeeth: 0, lowerTeeth: 0, fangs: false, jag: 0 },
  { eyeX: 0.215, eyeY: 0.2, eyeRX: 0.07, eyeRY: 0.112, socket: 0, mouth: CUTE, rough: 0.36, coat: 0.6, upperTeeth: 0, lowerTeeth: 0, fangs: false, jag: 0 },
  { eyeX: 0.22, eyeY: 0.22, eyeRX: 0.08, eyeRY: 0.138, socket: 0, mouth: TOOTHY, rough: 0.45, coat: 0.35, upperTeeth: 10, lowerTeeth: 10, fangs: false, jag: 0 },
  { eyeX: 0.19, eyeY: 0.19, eyeRX: 0.05, eyeRY: 0.16, socket: 1, mouth: EVIL, rough: 0.6, coat: 0.12, upperTeeth: 11, lowerTeeth: 10, fangs: true, jag: 1 },
];

function lerpM(a: MouthP, b: MouthP, k: number): void {
  for (const key of Object.keys(a) as (keyof MouthP)[]) a[key] += (b[key] - a[key]) * k;
}

const dirOf = (lon: number, lat: number, out = new THREE.Vector3()) => out.set(Math.sin(lon) * Math.cos(lat), Math.sin(lat), Math.cos(lon) * Math.cos(lat));

// ------------------------------------------------------------------ surface

/** Sphere radius in a direction (stage 3 is dented, with eye sockets). */
function surfaceR(st: StageLook, seed: number, d: THREE.Vector3): number {
  if (!st.socket) return R;
  let r = R;
  // eye sockets
  for (const sx of [-1, 1]) {
    const e = dirOf(sx * st.eyeX, st.eyeY, _sv);
    const a = Math.acos(Math.min(1, d.dot(e)));
    r -= 0.016 * Math.exp(-(a * a) / (2 * 0.09 * 0.09));
  }
  // dents and lumps
  const n = Math.sin(d.x * 7.1 + seed) * Math.sin(d.y * 6.3 - seed * 0.5) * Math.sin(d.z * 5.7 + 1.3) + 0.5 * Math.sin(d.x * 13 + d.z * 11 + seed);
  r += n * 0.004;
  // a flattened patch where it hit the floor too many times
  const flat = Math.max(0, d.dot(_flatDir) - 0.93) * 0.09;
  return r - flat;
}
const _sv = new THREE.Vector3();
const _flatDir = new THREE.Vector3(0.5, -0.6, -0.62).normalize();

function ballGeometry(st: StageLook): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, 128, 96, -Math.PI / 2);
  const p = g.getAttribute('position');
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    p.setXYZ(i, v.x * surfaceR(st, 3, v), v.y * surfaceR(st, 3, v), v.z * surfaceR(st, 3, v));
  }
  g.computeVertexNormals();
  return g;
}

// ------------------------------------------------------------------ textures

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

/** Equirectangular body paint (face centred at u = 0.5). */
function bodyTexture(stage: number): THREE.CanvasTexture {
  const W = 1024;
  const H = 512;
  const [c, g] = canvas(W, H);
  const rng = new Rng(11 + stage * 7);
  g.fillStyle = stage >= 3 ? '#d9b52a' : stage >= 2 ? '#ecc825' : YELLOW;
  g.fillRect(0, 0, W, H);
  // soft tonal variation
  for (let i = 0; i < 260; i++) {
    const x = rng.next() * W;
    const y = rng.next() * H;
    const r = 20 + rng.next() * 90;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    const light = rng.next() < 0.5;
    grd.addColorStop(0, light ? 'rgba(255,240,150,0.06)' : 'rgba(150,110,20,0.05)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  if (stage >= 1) {
    // grime collects underneath
    const grd = g.createLinearGradient(0, H * 0.55, 0, H);
    grd.addColorStop(0, 'rgba(70,50,20,0)');
    grd.addColorStop(1, `rgba(70,50,20,${0.2 + stage * 0.15})`);
    g.fillStyle = grd;
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 30 * stage; i++) {
      const x = rng.next() * W;
      const y = H * (0.3 + rng.next() * 0.7);
      const r = 6 + rng.next() * 30 * stage;
      const gg = g.createRadialGradient(x, y, 0, x, y, r);
      gg.addColorStop(0, `rgba(60,42,18,${0.08 + stage * 0.06})`);
      gg.addColorStop(1, 'rgba(60,42,18,0)');
      g.fillStyle = gg;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }
  if (stage >= 2) {
    // scratches
    g.lineCap = 'round';
    for (let i = 0; i < 40 * (stage - 1); i++) {
      const x = rng.next() * W;
      const y = rng.next() * H;
      const a = rng.next() * Math.PI;
      const l = 8 + rng.next() * 40;
      g.strokeStyle = rng.next() < 0.5 ? 'rgba(255,250,220,0.35)' : 'rgba(80,55,20,0.35)';
      g.lineWidth = 0.6 + rng.next() * 1.2;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      g.stroke();
    }
  }
  if (stage >= 3) {
    // cracks
    g.strokeStyle = 'rgba(40,22,8,0.85)';
    for (let i = 0; i < 7; i++) {
      let x = rng.next() * W;
      let y = rng.next() * H * 0.8;
      if (Math.abs(x - W / 2) < 150 && Math.abs(y - H / 2) < 110) x += 260;
      g.lineWidth = 1.6;
      g.beginPath();
      g.moveTo(x, y);
      for (let k = 0; k < 9; k++) {
        x += (rng.next() - 0.5) * 30;
        y += 6 + rng.next() * 14;
        g.lineTo(x, y);
        g.lineWidth *= 0.92;
      }
      g.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// the face decal covers lon [-FX, FX], lat [-FY, FY]
const FX = 1.05;
const FY = 0.95;

/** High-resolution paint for the face only (bruises, smears, stains). */
function faceTexture(stage: number, st: StageLook): THREE.CanvasTexture | null {
  if (stage < 2) return null;
  const N = 1024;
  const [c, g] = canvas(N, N);
  const rng = new Rng(97 + stage);
  const px = (lon: number) => ((lon + FX) / (2 * FX)) * N;
  const py = (lat: number) => ((FY - lat) / (2 * FY)) * N;
  const sx = N / (2 * FX);
  g.clearRect(0, 0, N, N);
  // stains
  for (let i = 0; i < 14 * stage; i++) {
    const x = rng.next() * N;
    const y = rng.next() * N;
    const r = 8 + rng.next() * 40;
    const gg = g.createRadialGradient(x, y, 0, x, y, r);
    gg.addColorStop(0, `rgba(70,45,15,${0.1 + stage * 0.05})`);
    gg.addColorStop(1, 'rgba(70,45,15,0)');
    g.fillStyle = gg;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  if (stage >= 3) {
    // bruised, sunken eyes
    for (const s of [-1, 1]) {
      const x = px(s * st.eyeX);
      const y = py(st.eyeY);
      for (const [rr, col] of [
        [0.3, 'rgba(110,40,20,0.55)'],
        [0.21, 'rgba(120,20,15,0.7)'],
        [0.13, 'rgba(50,5,5,0.85)'],
      ] as const) {
        const r = rr * sx;
        g.save();
        g.translate(x, y);
        g.scale(0.8, 1.15);
        const gg = g.createRadialGradient(0, 0, r * 0.2, 0, 0, r);
        gg.addColorStop(0, col);
        gg.addColorStop(1, 'rgba(60,10,5,0)');
        g.fillStyle = gg;
        g.beginPath();
        g.arc(0, 0, r, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }
      // something ran down from the eyes and dried
      g.strokeStyle = 'rgba(60,8,6,0.55)';
      g.lineCap = 'round';
      for (let k = 0; k < 2; k++) {
        const x0 = x + (rng.next() - 0.5) * 30;
        g.lineWidth = 3 + rng.next() * 4;
        g.beginPath();
        g.moveTo(x0, y + 0.12 * sx);
        g.bezierCurveTo(x0 + 4, y + 0.25 * sx, x0 - 6, y + 0.35 * sx, x0 + (rng.next() - 0.5) * 10, y + (0.4 + rng.next() * 0.25) * sx);
        g.stroke();
      }
    }
    // black smears around the grin
    const m = st.mouth.smile;
    const edge = (s: number, lower: boolean) => {
      const e = lower ? m.yl : m.yu;
      const p = lower ? m.pl : m.pu;
      return m.yc + (e - m.yc) * Math.pow(Math.max(0, 1 - s * s), p);
    };
    g.lineJoin = 'round';
    g.lineCap = 'round';
    for (const lower of [false, true]) {
      for (let pass = 0; pass < 3; pass++) {
        g.strokeStyle = `rgba(8,4,4,${0.6 - pass * 0.17})`;
        g.lineWidth = (0.035 + pass * 0.022) * sx;
        g.beginPath();
        for (let i = 0; i <= 60; i++) {
          const s = -1 + (2 * i) / 60;
          const j = (rng.next() - 0.5) * 0.014 * (pass + 1);
          const lat = edge(s, lower) + (lower ? -1 : 1) * (0.03 + pass * 0.012) + j;
          const x = px(s * (m.W + 0.03));
          const y = py(lat);
          if (i === 0) g.moveTo(x, y);
          else g.lineTo(x, y);
        }
        g.stroke();
      }
    }
    // ragged strokes flaring out of the corners
    for (const s of [-1, 1]) {
      for (let k = 0; k < 5; k++) {
        const x0 = px(s * m.W);
        const y0 = py(m.yc);
        const a = (s > 0 ? 0 : Math.PI) + (rng.next() - 0.6) * 1.3 * s;
        const l = (0.05 + rng.next() * 0.12) * sx;
        g.strokeStyle = 'rgba(10,5,5,0.8)';
        g.lineWidth = 2 + rng.next() * 6;
        g.beginPath();
        g.moveTo(x0, y0);
        g.lineTo(x0 + Math.cos(a) * l, y0 - Math.sin(a) * l * 0.7);
        g.stroke();
      }
    }
    // spatter
    for (let i = 0; i < 60; i++) {
      const x = px((rng.next() - 0.5) * 1.4);
      const y = py(-0.2 - rng.next() * 0.6);
      g.fillStyle = `rgba(20,6,4,${0.3 + rng.next() * 0.5})`;
      g.beginPath();
      g.arc(x, y, 1 + rng.next() * 4, 0, Math.PI * 2);
      g.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function facePatch(st: StageLook): THREE.BufferGeometry {
  const NX = 64;
  const NY = 56;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const d = new THREE.Vector3();
  for (let j = 0; j <= NY; j++)
    for (let i = 0; i <= NX; i++) {
      const lon = -FX + (2 * FX * i) / NX;
      const lat = FY - (2 * FY * j) / NY;
      dirOf(lon, lat, d);
      const r = surfaceR(st, 3, d) + 0.0008;
      pos.push(d.x * r, d.y * r, d.z * r);
      uv.push(i / NX, 1 - j / NY);
    }
  for (let j = 0; j < NY; j++)
    for (let i = 0; i < NX; i++) {
      const a = j * (NX + 1) + i;
      idx.push(a, a + NX + 1, a + 1, a + 1, a + NX + 1, a + NX + 2);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// ------------------------------------------------------------------ the form

const NS = 48; // mouth columns
const ROWS = 8; // outer-up, up-edge, 4 inside, low-edge, outer-low

export class BallForm {
  readonly group = new THREE.Group();
  /** Squash / lean / hop pivot at the bottom of the ball. */
  readonly pivot = new THREE.Group();
  /** Rolls (the AI drives rotation.x when he rolls). */
  readonly body = new THREE.Group();
  /** Turns the face toward what he looks at. */
  readonly look = new THREE.Group();
  stage = 0;
  private st = STAGES[0];
  private ball: THREE.Mesh;
  private ballMat: THREE.MeshPhysicalMaterial;
  private decal: THREE.Mesh;
  private decalMat: THREE.MeshStandardMaterial;
  private eyes: THREE.Mesh[] = [];
  readonly eyeMat: THREE.MeshPhysicalMaterial;
  private mouthGeo: THREE.BufferGeometry;
  private mouthMesh: THREE.Mesh;
  private teethGeo: THREE.BufferGeometry;
  private teethMesh: THREE.Mesh;
  private ticks: THREE.Mesh;
  private cur: MouthP = { ...CUTE.smile };
  private jaw = 0;
  private dirty = true;
  private geoCache = new Map<number, THREE.BufferGeometry>();
  private texCache = new Map<number, [THREE.CanvasTexture, THREE.CanvasTexture | null]>();
  // animation
  private t = 0;
  private hop = 0;
  private blinkT = 2.5;
  private blink = 0;
  private gyaw = 0;
  private gpitch = 0;
  private hopAmp = 0;
  /** Set when a hop lands (the AI plays a sound). */
  landed = false;

  constructor() {
    this.group.add(this.pivot);
    this.pivot.add(this.body);
    this.body.position.y = R;
    this.body.add(this.look);
    this.ballMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.12 });
    this.ball = new THREE.Mesh(new THREE.BufferGeometry(), this.ballMat);
    this.decalMat = new THREE.MeshStandardMaterial({ transparent: true, depthWrite: false, roughness: 0.65, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    this.decal = new THREE.Mesh(new THREE.BufferGeometry(), this.decalMat);
    this.eyeMat = new THREE.MeshPhysicalMaterial({ color: 0x050505, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.04, emissive: 0x000000 });
    for (let i = 0; i < 2; i++) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 28), this.eyeMat);
      this.eyes.push(e);
      this.look.add(e);
    }
    // mouth: outline band + inside, rebuilt in place
    this.mouthGeo = new THREE.BufferGeometry();
    const nv = (NS + 1) * ROWS;
    this.mouthGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nv * 3), 3));
    this.mouthGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(nv * 3), 3));
    const idx: number[] = [];
    for (let r = 0; r < ROWS - 1; r++)
      for (let i = 0; i < NS; i++) {
        const a = r * (NS + 1) + i;
        idx.push(a, a + NS + 1, a + 1, a + 1, a + NS + 1, a + NS + 2);
      }
    this.mouthGeo.setIndex(idx);
    this.mouthMesh = new THREE.Mesh(
      this.mouthGeo,
      new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.2, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }),
    );
    this.teethGeo = new THREE.BufferGeometry();
    this.teethMesh = new THREE.Mesh(this.teethGeo, new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.22, clearcoat: 0.5, clearcoatRoughness: 0.15, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
    // the little dimple strokes at the corners of a smiley's mouth
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(2 * 4 * 3), 3));
    tg.setIndex([0, 2, 1, 1, 2, 3, 4, 6, 5, 5, 6, 7]);
    this.ticks = new THREE.Mesh(tg, new THREE.MeshPhysicalMaterial({ color: 0x0a0806, roughness: 0.3, clearcoat: 0.6, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
    this.look.add(this.ball, this.decal, this.mouthMesh, this.teethMesh, this.ticks);
    for (const m of [this.ball, ...this.eyes, this.mouthMesh, this.teethMesh]) m.castShadow = true;
    this.setStage(0);
  }

  setStage(stage: number): void {
    this.stage = Math.max(0, Math.min(3, stage));
    this.st = STAGES[this.stage];
    let geo = this.geoCache.get(this.stage);
    if (!geo) {
      geo = ballGeometry(this.st);
      this.geoCache.set(this.stage, geo);
    }
    this.ball.geometry = geo;
    let tex = this.texCache.get(this.stage);
    if (!tex) {
      tex = [bodyTexture(this.stage), faceTexture(this.stage, this.st)];
      this.texCache.set(this.stage, tex);
    }
    this.ballMat.map = tex[0];
    this.ballMat.roughness = this.st.rough;
    this.ballMat.clearcoat = this.st.coat;
    this.ballMat.needsUpdate = true;
    this.decal.visible = !!tex[1];
    if (tex[1]) {
      this.decal.geometry = facePatch(this.st);
      this.decalMat.map = tex[1];
      this.decalMat.needsUpdate = true;
    }
    // eyes sit in the surface (deeper in stage 3's sockets)
    this.eyes.forEach((e, i) => {
      const sx = i === 0 ? -1 : 1;
      const d = dirOf(sx * this.st.eyeX, this.st.eyeY);
      const r = surfaceR(this.st, 3, d);
      e.position.copy(d).multiplyScalar(r - 0.0125 - this.st.socket * 0.004);
      e.lookAt(d.clone().multiplyScalar(2));
      e.scale.set(this.st.eyeRX * R, this.st.eyeRY * R, 0.018);
      e.userData.base = e.scale.clone();
    });
    this.buildTeeth();
    // a new stage starts with its own mouth (no morph across stages)
    Object.assign(this.cur, this.st.mouth.smile);
    this.updateMouth();
    this.dirty = true;
  }

  get eyeWorld(): THREE.Vector3 {
    return this.look.localToWorld(new THREE.Vector3(0, R * 0.2, R * 0.95));
  }

  // ---------------------------------------------------------------- mouth

  private edge(s: number, which: 'u' | 'l' | 'b', m = this.cur): number {
    const e = which === 'u' ? m.yu : which === 'l' ? m.yl : m.yb;
    const p = which === 'u' ? m.pu : which === 'l' ? m.pl : (m.pu + m.pl) / 2;
    return m.yc + (e - m.yc) * Math.pow(Math.max(0, 1 - s * s), p);
  }

  /** Point on the face surface (lon, lat) lifted by `lift` metres. */
  private sp(lon: number, lat: number, lift: number, out: THREE.Vector3): THREE.Vector3 {
    dirOf(lon, lat, out);
    return out.multiplyScalar(surfaceR(this.st, 3, out) + lift);
  }

  private updateMouth(): void {
    const m = this.cur;
    const pos = this.mouthGeo.getAttribute('position') as THREE.BufferAttribute;
    const col = this.mouthGeo.getAttribute('color') as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    const black = new THREE.Color(0x060404);
    const inner = new THREE.Color(this.stage >= 3 ? 0x1a0303 : 0x3a0a0e);
    const deep = new THREE.Color(0x0c0204);
    const tongue = new THREE.Color(0xc85a6a);
    const c = new THREE.Color();
    const jag = this.st.jag;
    const rng = new Rng(5);
    for (let i = 0; i <= NS; i++) {
      const s = -1 + (2 * i) / NS;
      const lon = s * m.W;
      const yu = this.edge(s, 'u');
      const yl = this.edge(s, 'l') - this.jaw * Math.pow(Math.max(0, 1 - s * s), 0.6);
      const jj = jag ? (rng.next() - 0.5) * 0.02 * jag : 0;
      // the band is thinner toward the corners only a little
      const band = m.band * (0.75 + 0.25 * Math.sqrt(Math.max(0, 1 - s * s))) + Math.abs(jj);
      const lats = [yu + band, yu];
      for (let r = 1; r <= 4; r++) lats.push(yu + ((yl - yu) * r) / 5);
      lats.push(yl, yl - band);
      const wide = s * (m.W + band * 0.9);
      for (let r = 0; r < ROWS; r++) {
        const outer = r === 0 || r === ROWS - 1;
        this.sp(outer ? wide : lon, lats[r], 0.0012, v);
        const k = i + r * (NS + 1);
        pos.setXYZ(k, v.x, v.y, v.z);
        if (r <= 1 || r >= ROWS - 2) c.copy(black);
        else {
          const f = (r - 1) / 5;
          c.copy(inner).lerp(deep, Math.sin(f * Math.PI) * 0.7);
          if (m.tongue > 0 && r >= 4) c.lerp(tongue, m.tongue * Math.max(0, 1 - Math.abs(s) * 1.6) * (r - 3) * 0.4);
        }
        col.setXYZ(k, c.r, c.g, c.b);
      }
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
    this.mouthGeo.computeVertexNormals();
    this.mouthGeo.computeBoundingSphere();
    // corner dimples (cute stages)
    const tp = this.ticks.geometry.getAttribute('position') as THREE.BufferAttribute;
    const showTicks = this.stage < 3 && m.teeth < 0.5 ? 1 : this.stage === 2 ? 1 : 0;
    this.ticks.visible = showTicks > 0;
    [-1, 1].forEach((sx, k) => {
      const lon = sx * (m.W + m.band * 0.5);
      const lat = m.yc + m.band * 0.2;
      // perpendicular to the end of the curve
      const slope = (this.edge(sx * 0.96, 'u') - m.yc) / (0.04 * m.W);
      const nx = -slope;
      const ny = 1;
      const nl = Math.hypot(nx, ny);
      const L = 0.075;
      const w = m.band * 0.55;
      const ax = lon + (sx * nx * L) / nl / 2;
      const ay = lat + (ny * L) / nl / 2;
      const bx = lon - (sx * nx * L) / nl / 2;
      const by = lat - (ny * L) / nl / 2;
      const quad = [
        [ax - w * sx, ay],
        [ax + w * sx, ay],
        [bx - w * sx, by],
        [bx + w * sx, by],
      ];
      quad.forEach(([qx, qy], j) => {
        this.sp(qx, qy, 0.0013, v);
        tp.setXYZ(k * 4 + j, v.x, v.y, v.z);
      });
    });
    tp.needsUpdate = true;
    this.ticks.geometry.computeBoundingSphere();
    this.updateTeeth();
  }

  private toothLayout: Array<{ upper: boolean; s0: number; s1: number; h: number; fang: boolean; tint: number }> = [];

  private buildTeeth(): void {
    const st = this.st;
    const rng = new Rng(21 + this.stage);
    this.toothLayout = [];
    for (const [upper, n] of [
      [true, st.upperTeeth],
      [false, st.lowerTeeth],
    ] as const) {
      // widths vary a little; front teeth bigger
      const ws: number[] = [];
      for (let i = 0; i < n; i++) ws.push((1 - 0.35 * Math.abs((i + 0.5) / n - 0.5) * 2) * (st.jag ? 0.8 + rng.next() * 0.4 : 1));
      const tot = ws.reduce((a, b) => a + b, 0);
      let acc = -1;
      for (let i = 0; i < n; i++) {
        const w = (ws[i] / tot) * 2 * 0.94;
        const s0 = acc + 0.03 / n;
        acc += w + 0.06 / n;
        this.toothLayout.push({ upper, s0, s1: acc - 0.03 / n, h: st.jag ? 0.85 + rng.next() * 0.3 : 1, fang: st.fangs && (rng.next() < 0.35 || i === 2 || i === n - 3), tint: st.jag ? rng.next() : rng.next() * 0.3 });
      }
    }
    const per = 7 * 9;
    const n = this.toothLayout.length;
    this.teethGeo.dispose();
    this.teethGeo = new THREE.BufferGeometry();
    this.teethGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(Math.max(1, n * per) * 3), 3));
    this.teethGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(Math.max(1, n * per) * 3), 3));
    const idx: number[] = [];
    for (let t = 0; t < n; t++)
      for (let j = 0; j < 8; j++)
        for (let i = 0; i < 6; i++) {
          const a = t * per + j * 7 + i;
          idx.push(a, a + 7, a + 1, a + 1, a + 7, a + 8);
        }
    this.teethGeo.setIndex(idx);
    this.teethMesh.geometry = this.teethGeo;
    this.teethMesh.visible = n > 0;
  }

  private updateTeeth(): void {
    const m = this.cur;
    const n = this.toothLayout.length;
    if (!n) return;
    this.teethMesh.visible = m.teeth > 0.05;
    const pos = this.teethGeo.getAttribute('position') as THREE.BufferAttribute;
    const col = this.teethGeo.getAttribute('color') as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    const enamel = new THREE.Color(0xf4efe2);
    const shade = new THREE.Color(0xb9ad94);
    const rot = new THREE.Color(this.stage >= 3 ? 0x8a6a3a : 0xd8c9a0);
    const c = new THREE.Color();
    const lowerShift = this.jaw;
    this.toothLayout.forEach((tl, t) => {
      for (let j = 0; j < 9; j++) {
        const v01 = j / 8; // 0 at the root, 1 at the tip
        for (let i = 0; i < 7; i++) {
          // lower teeth run the other way so their faces point out too
          let u = tl.upper ? -1 + (2 * i) / 6 : 1 - (2 * i) / 6;
          if (tl.fang) u *= 1 - 0.75 * v01 * v01;
          else u *= 1 - 0.12 * v01 * v01;
          const s = tl.s0 + ((u + 1) / 2) * (tl.s1 - tl.s0);
          const lon = s * m.W;
          let root: number;
          let tip: number;
          if (tl.upper) {
            root = this.edge(s, 'u') + 0.004;
            tip = this.edge(s, 'b') + 0.003 + (1 - tl.h) * 0.06;
          } else {
            const sh = lowerShift * Math.pow(Math.max(0, 1 - s * s), 0.6);
            root = this.edge(s, 'l') - 0.004 - sh;
            tip = this.edge(s, 'b') - 0.003 - (1 - tl.h) * 0.06 - sh;
          }
          // keep teeth inside the opening at the corners
          if (tl.upper ? tip > root : tip < root) tip = root;
          const lat = root + (tip - root) * v01;
          const bulge = Math.sqrt(Math.max(0, 1 - Math.abs(-1 + (2 * i) / 6) ** 3)) * Math.sqrt(Math.max(0, 1 - Math.pow(2 * v01 - 1, 6)));
          this.sp(lon, lat, 0.0016 + 0.0055 * bulge * m.teeth, v);
          const k = t * 63 + j * 7 + i;
          pos.setXYZ(k, v.x, v.y, v.z);
          c.copy(enamel).lerp(shade, 1 - bulge).lerp(rot, (1 - v01) * 0.5 * tl.tint + (this.stage >= 3 ? 0.15 : 0));
          col.setXYZ(k, c.r, c.g, c.b);
        }
      }
    });
    pos.needsUpdate = true;
    col.needsUpdate = true;
    this.teethGeo.computeVertexNormals();
    this.teethGeo.computeBoundingSphere();
  }

  // ---------------------------------------------------------------- update

  update(
    dt: number,
    o: {
      speed: number;
      rolling: boolean;
      look: THREE.Vector3 | null;
      point: THREE.Vector3 | null;
      tilt: number;
      twist: number;
      wrongness: number;
      talking: boolean;
      expression: Expression;
      gesture: Gesture;
      gestureT: number;
      scale: number;
    },
  ): void {
    this.t += dt;
    const t = this.t;
    // mouth shape follows the expression smoothly
    const target = this.st.mouth[o.expression] ?? this.st.mouth.smile;
    const before = this.cur.W + this.cur.yc + this.cur.yl + this.cur.yu;
    lerpM(this.cur, target, Math.min(1, dt * 9));
    const jawT = o.talking ? 0.035 + Math.abs(Math.sin(t * 13)) * 0.07 + Math.max(0, Math.sin(t * 7.7)) * 0.03 : 0;
    const prevJaw = this.jaw;
    this.jaw += (jawT - this.jaw) * Math.min(1, dt * 18);
    if (this.dirty || Math.abs(before - (this.cur.W + this.cur.yc + this.cur.yl + this.cur.yu)) > 1e-5 || Math.abs(prevJaw - this.jaw) > 1e-5) {
      this.dirty = false;
      this.updateMouth();
    }
    // blink: the ovals squash shut
    const canBlink = this.stage < 3 || Math.random() < 0.0005;
    this.blinkT -= dt;
    if (this.blinkT <= 0 && canBlink) {
      this.blink = 1;
      this.blinkT = 2.4 + Math.random() * 3.5 + o.wrongness * 5;
    }
    this.blink = Math.max(0, this.blink - dt * 7);
    const b = Math.sin(this.blink * Math.PI);
    const squint = o.expression === 'flat' ? 0.45 : o.expression === 'sad' ? 0.2 : 0;
    const wide = o.expression === 'open' ? 1.12 : 1;
    this.eyes.forEach((e, i) => {
      const base = e.userData.base as THREE.Vector3;
      e.scale.set(base.x * wide, base.y * wide * Math.max(0.06, 1 - Math.max(b, squint)), base.z);
      // sad eyes tilt down at the outside
      e.rotation.z = o.expression === 'sad' ? (i === 0 ? 0.25 : -0.25) : 0;
    });
    // ------------------------------------------------ locomotion: hop
    const moving = o.speed > 0.05 && !o.rolling;
    this.hopAmp += ((moving ? Math.min(1, o.speed / 1.2) : 0) - this.hopAmp) * Math.min(1, dt * 6);
    const hopLen = this.stage >= 2 ? 0.75 : 0.55;
    const prevHop = this.hop;
    if (moving) this.hop += (o.speed / hopLen) * dt;
    else if (this.hopAmp < 0.05) this.hop = Math.round(this.hop);
    const f = this.hop - Math.floor(this.hop);
    if (Math.floor(this.hop) !== Math.floor(prevHop) && this.hopAmp > 0.2) this.landed = true;
    const air = Math.sin(Math.PI * f);
    const lift = Math.pow(air, 0.8) * (0.07 + 0.05 * this.hopAmp) * this.hopAmp;
    // squash at the ground, stretch in the air
    const contact = Math.pow(1 - air, 6) * this.hopAmp;
    const breathe = Math.sin(t * 1.6) * 0.012 * (1 - this.hopAmp);
    let sy = 1 - contact * 0.12 + air * 0.04 * this.hopAmp + breathe;
    if (o.rolling) sy = 1;
    const sxz = 1 / Math.sqrt(sy);
    const sc = o.scale;
    this.pivot.scale.set(sxz * sc, sy * sc, sxz * sc);
    this.pivot.position.y = o.rolling ? 0 : lift;
    let lean = moving ? 0.12 * this.hopAmp : 0;
    let tilt = o.tilt;
    // ------------------------------------------------ gaze and gestures
    let yawT = 0;
    let pitchT = 0;
    if (o.look) {
      const lp = this.body.worldToLocal(o.look.clone());
      yawT = Math.max(-0.75, Math.min(0.75, Math.atan2(lp.x, lp.z)));
      pitchT = Math.max(-0.35, Math.min(0.4, Math.atan2(lp.y - R * 0.2, Math.hypot(lp.x, lp.z))));
    }
    const gt = o.gestureT;
    switch (o.gesture) {
      case 'wave':
        tilt += Math.sin(gt * 7) * 0.22;
        this.pivot.position.y += Math.abs(Math.sin(gt * 7)) * 0.03;
        break;
      case 'point':
      case 'beckon':
        if (o.point) {
          const lp = this.body.worldToLocal(o.point.clone());
          yawT = Math.max(-1.0, Math.min(1.0, Math.atan2(lp.x, lp.z)));
          pitchT = Math.max(-0.4, Math.min(0.4, Math.atan2(lp.y, Math.hypot(lp.x, lp.z))));
        }
        lean += o.gesture === 'beckon' ? Math.max(0, Math.sin(gt * 5)) * 0.18 : 0.1;
        break;
      case 'cover':
        pitchT = -0.55;
        yawT = 0.5;
        this.pivot.scale.y *= 0.93;
        break;
      case 'hug':
        lean += 0.2;
        this.pivot.scale.y *= 1 + Math.sin(gt * 3) * 0.03;
        break;
      case 'shrug':
        tilt += Math.sin(gt * 4) > 0 ? 0.18 : -0.18;
        this.pivot.scale.y *= 1 + Math.max(0, Math.sin(gt * 8)) * 0.05;
        break;
    }
    if (o.wrongness > 0) {
      tilt += (Math.random() - 0.5) * 0.05 * o.wrongness + Math.sin(t * 0.7) * 0.25 * o.wrongness * o.wrongness;
      yawT += (Math.random() - 0.5) * 0.08 * o.wrongness;
    }
    const k = Math.min(1, dt * 6);
    this.gyaw += (yawT - this.gyaw) * k;
    this.gpitch += (pitchT - this.gpitch) * k;
    this.look.rotation.set(-this.gpitch, this.gyaw + o.twist, 0, 'YXZ');
    this.pivot.rotation.set(lean, 0, tilt);
  }
}
