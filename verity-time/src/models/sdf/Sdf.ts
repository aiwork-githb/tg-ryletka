import * as THREE from 'three';
import { edgeTable, triTable } from 'three/examples/jsm/objects/MarchingCubes.js';

/**
 * A tiny signed-distance "clay" modeller. Shapes are described as an ordered
 * list of primitives combined with smooth unions / subtractions, then turned
 * into an indexed triangle mesh by a sparse marching-cubes pass. Vertex
 * normals come from the field gradient (smooth even on a coarse grid),
 * colours blend with the shapes and a cavity term darkens creases.
 *
 * Used for the organic characters, which cannot be built from boxes.
 */

export type V3 = readonly [number, number, number];
export type RGB = readonly [number, number, number];

export interface PrimOpts {
  /** Blend radius with what came before (metres). 0 = hard. */
  k?: number;
  /** 'add' (union), 'sub' (carve), 'paint' (only recolours inside, no shape). */
  op?: 'add' | 'sub' | 'paint';
  /** sRGB hex colour of this part (or of the carved cavity for 'sub'). */
  color?: string;
  /** Skeleton bone this part belongs to. */
  bone?: number;
  /** Paint falloff for 'paint' (metres). */
  soft?: number;
}

abstract class Prim {
  op: 'add' | 'sub' | 'paint' = 'add';
  k = 0;
  r = 0.8;
  g = 0.7;
  b = 0.2;
  bone = 0;
  soft = 0.01;
  min = [0, 0, 0];
  max = [0, 0, 0];
  abstract dist(x: number, y: number, z: number): number;
}

class Sphere extends Prim {
  constructor(private cx: number, private cy: number, private cz: number, private rad: number) {
    super();
  }
  dist(x: number, y: number, z: number): number {
    const dx = x - this.cx, dy = y - this.cy, dz = z - this.cz;
    return Math.sqrt(dx * dx + dy * dy + dz * dz) - this.rad;
  }
}

/** Capsule with different radii at its ends (exact, after Quilez). */
class RoundCone extends Prim {
  private bx: number; private by: number; private bz: number;
  private l2: number; private rr: number; private a2: number; private il2: number;
  constructor(private ax: number, private ay: number, private az: number, bx: number, by: number, bz: number, private r1: number, private r2: number) {
    super();
    this.bx = bx - ax; this.by = by - ay; this.bz = bz - az;
    this.l2 = Math.max(1e-10, this.bx * this.bx + this.by * this.by + this.bz * this.bz);
    this.rr = r1 - r2;
    this.a2 = this.l2 - this.rr * this.rr;
    this.il2 = 1 / this.l2;
  }
  dist(x: number, y: number, z: number): number {
    const px = x - this.ax, py = y - this.ay, pz = z - this.az;
    const { bx, by, bz, l2, rr, a2, il2 } = this;
    const yy = px * bx + py * by + pz * bz;
    const zz = yy - l2;
    const qx = px * l2 - bx * yy, qy = py * l2 - by * yy, qz = pz * l2 - bz * yy;
    const x2 = qx * qx + qy * qy + qz * qz;
    const y2 = yy * yy * l2;
    const z2 = zz * zz * l2;
    const k = Math.sign(rr) * rr * rr * x2;
    if (Math.sign(zz) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - this.r2;
    if (Math.sign(yy) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - this.r1;
    return (Math.sqrt(x2 * a2 * il2) + yy * rr) * il2 - this.r1;
  }
}

/** Rotated ellipsoid (bound approximation, good enough near the surface). */
class Ellipsoid extends Prim {
  // rows of the inverse rotation
  private m: number[];
  constructor(private cx: number, private cy: number, private cz: number, private rx: number, private ry: number, private rz: number, rot: THREE.Euler) {
    super();
    const q = new THREE.Matrix4().makeRotationFromEuler(rot).invert().elements;
    this.m = [q[0], q[4], q[8], q[1], q[5], q[9], q[2], q[6], q[10]];
  }
  dist(x: number, y: number, z: number): number {
    const dx = x - this.cx, dy = y - this.cy, dz = z - this.cz;
    const m = this.m;
    const lx = (m[0] * dx + m[1] * dy + m[2] * dz) / this.rx;
    const ly = (m[3] * dx + m[4] * dy + m[5] * dz) / this.ry;
    const lz = (m[6] * dx + m[7] * dy + m[8] * dz) / this.rz;
    const k0 = Math.sqrt(lx * lx + ly * ly + lz * lz);
    const k1 = Math.sqrt((lx * lx) / (this.rx * this.rx) + (ly * ly) / (this.ry * this.ry) + (lz * lz) / (this.rz * this.rz));
    return k1 < 1e-9 ? -Math.min(this.rx, this.ry, this.rz) : (k0 * (k0 - 1)) / k1;
  }
}

/** Rotated rounded box. */
class RoundBox extends Prim {
  private m: number[];
  constructor(private cx: number, private cy: number, private cz: number, private hx: number, private hy: number, private hz: number, private round: number, rot: THREE.Euler) {
    super();
    const q = new THREE.Matrix4().makeRotationFromEuler(rot).invert().elements;
    this.m = [q[0], q[4], q[8], q[1], q[5], q[9], q[2], q[6], q[10]];
  }
  dist(x: number, y: number, z: number): number {
    const dx = x - this.cx, dy = y - this.cy, dz = z - this.cz;
    const m = this.m;
    const lx = Math.abs(m[0] * dx + m[1] * dy + m[2] * dz) - this.hx + this.round;
    const ly = Math.abs(m[3] * dx + m[4] * dy + m[5] * dz) - this.hy + this.round;
    const lz = Math.abs(m[6] * dx + m[7] * dy + m[8] * dz) - this.hz + this.round;
    const ox = Math.max(lx, 0), oy = Math.max(ly, 0), oz = Math.max(lz, 0);
    return Math.sqrt(ox * ox + oy * oy + oz * oz) + Math.min(Math.max(lx, ly, lz), 0) - this.round;
  }
}

/** Torus lying in a rotated plane (for lips, rims). */
class Torus extends Prim {
  private m: number[];
  constructor(private cx: number, private cy: number, private cz: number, private R: number, private rad: number, rot: THREE.Euler) {
    super();
    const q = new THREE.Matrix4().makeRotationFromEuler(rot).invert().elements;
    this.m = [q[0], q[4], q[8], q[1], q[5], q[9], q[2], q[6], q[10]];
  }
  dist(x: number, y: number, z: number): number {
    const dx = x - this.cx, dy = y - this.cy, dz = z - this.cz;
    const m = this.m;
    const lx = m[0] * dx + m[1] * dy + m[2] * dz;
    const ly = m[3] * dx + m[4] * dy + m[5] * dz;
    const lz = m[6] * dx + m[7] * dy + m[8] * dz;
    const q = Math.sqrt(lx * lx + lz * lz) - this.R;
    return Math.sqrt(q * q + ly * ly) - this.rad;
  }
}

function hexLinear(hex: string): [number, number, number] {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
}

export interface MeshOpts {
  /** Grid cell size (metres). */
  cell: number;
  /** Cavity occlusion strength 0..1. */
  ao?: number;
  /** AO probe distance (metres). */
  aoDist?: number;
  /** Only mesh inside this box (for splitting a model into parts). */
  clipMin?: V3;
  clipMax?: V3;
  /** Newton projection steps onto the surface. */
  project?: number;
}

/** Result of a field evaluation with attributes. */
export interface Sample {
  d: number;
  r: number;
  g: number;
  b: number;
  bone: number;
}

export class SdfModel {
  readonly prims: Prim[] = [];
  private defColor: [number, number, number] = [0.8, 0.7, 0.2];

  color(hex: string): this {
    this.defColor = hexLinear(hex);
    return this;
  }

  private push(p: Prim, o: PrimOpts, bounds: [number, number, number, number, number, number]): Prim {
    p.op = o.op ?? 'add';
    p.k = o.k ?? 0;
    p.bone = o.bone ?? 0;
    p.soft = o.soft ?? 0.01;
    const [r, g, b] = o.color ? hexLinear(o.color) : this.defColor;
    p.r = r;
    p.g = g;
    p.b = b;
    const pad = p.k + (p.op === 'paint' ? p.soft : 0);
    p.min = [bounds[0] - pad, bounds[1] - pad, bounds[2] - pad];
    p.max = [bounds[3] + pad, bounds[4] + pad, bounds[5] + pad];
    this.prims.push(p);
    return p;
  }

  sphere(c: V3, r: number, o: PrimOpts = {}): this {
    this.push(new Sphere(c[0], c[1], c[2], r), o, [c[0] - r, c[1] - r, c[2] - r, c[0] + r, c[1] + r, c[2] + r]);
    return this;
  }

  /** A limb segment from a (radius ra) to b (radius rb). */
  cone(a: V3, b: V3, ra: number, rb = ra, o: PrimOpts = {}): this {
    const r = Math.max(ra, rb);
    this.push(new RoundCone(a[0], a[1], a[2], b[0], b[1], b[2], ra, rb), o, [
      Math.min(a[0], b[0]) - r, Math.min(a[1], b[1]) - r, Math.min(a[2], b[2]) - r,
      Math.max(a[0], b[0]) + r, Math.max(a[1], b[1]) + r, Math.max(a[2], b[2]) + r,
    ]);
    return this;
  }

  /** A smooth tube through points with per-point radii. */
  chain(pts: V3[], radii: number[], o: PrimOpts = {}): this {
    for (let i = 0; i < pts.length - 1; i++) this.cone(pts[i], pts[i + 1], radii[i], radii[i + 1], i === 0 ? o : { ...o, k: Math.max(o.k ?? 0, 0.004) });
    return this;
  }

  ellipsoid(c: V3, r: V3, o: PrimOpts & { rot?: [number, number, number] } = {}): this {
    const m = Math.max(r[0], r[1], r[2]);
    this.push(new Ellipsoid(c[0], c[1], c[2], r[0], r[1], r[2], new THREE.Euler(...(o.rot ?? [0, 0, 0]))), o, [c[0] - m, c[1] - m, c[2] - m, c[0] + m, c[1] + m, c[2] + m]);
    return this;
  }

  box(c: V3, half: V3, round: number, o: PrimOpts & { rot?: [number, number, number] } = {}): this {
    const m = Math.hypot(half[0], half[1], half[2]);
    this.push(new RoundBox(c[0], c[1], c[2], half[0], half[1], half[2], round, new THREE.Euler(...(o.rot ?? [0, 0, 0]))), o, [c[0] - m, c[1] - m, c[2] - m, c[0] + m, c[1] + m, c[2] + m]);
    return this;
  }

  torus(c: V3, R: number, r: number, o: PrimOpts & { rot?: [number, number, number] } = {}): this {
    const m = R + r;
    this.push(new Torus(c[0], c[1], c[2], R, r, new THREE.Euler(...(o.rot ?? [0, 0, 0]))), o, [c[0] - m, c[1] - m, c[2] - m, c[0] + m, c[1] + m, c[2] + m]);
    return this;
  }

  /** Field value only (fast path), over a subset of primitives. */
  distance(x: number, y: number, z: number, list: Prim[] = this.prims): number {
    let d = 10;
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      if (p.op === 'paint') continue;
      const e = p.dist(x, y, z);
      const k = p.k;
      if (p.op === 'add') {
        if (k <= 0) d = Math.min(d, e);
        else {
          const h = Math.max(0, Math.min(1, 0.5 + (0.5 * (e - d)) / k));
          d = e + (d - e) * h - k * h * (1 - h);
        }
      } else {
        if (k <= 0) d = Math.max(d, -e);
        else {
          const h = Math.max(0, Math.min(1, 0.5 - (0.5 * (d + e)) / k));
          d = d + (-e - d) * h + k * h * (1 - h);
        }
      }
    }
    return d;
  }

  /** Field value with blended colour and the dominant bone. */
  sample(x: number, y: number, z: number, out: Sample, list: Prim[] = this.prims): Sample {
    let d = 10;
    let r = this.defColor[0], g = this.defColor[1], b = this.defColor[2];
    let bone = 0;
    let boneD = Infinity;
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      const e = p.dist(x, y, z);
      const k = p.k;
      if (p.op === 'paint') {
        const w = Math.max(0, Math.min(1, 0.5 - e / (2 * p.soft)));
        r += (p.r - r) * w;
        g += (p.g - g) * w;
        b += (p.b - b) * w;
        continue;
      }
      if (p.op === 'add') {
        let h: number;
        if (k <= 0) h = e < d ? 0 : 1;
        else h = Math.max(0, Math.min(1, 0.5 + (0.5 * (e - d)) / k));
        const nd = k <= 0 ? Math.min(d, e) : e + (d - e) * h - k * h * (1 - h);
        // colour follows the blend (h = weight of what was there before)
        r = p.r + (r - p.r) * h;
        g = p.g + (g - p.g) * h;
        b = p.b + (b - p.b) * h;
        // the part a point belongs to is the nearest added primitive
        if (e < boneD) {
          boneD = e;
          bone = p.bone;
        }
        d = nd;
      } else {
        let h: number;
        if (k <= 0) h = -e > d ? 1 : 0;
        else h = Math.max(0, Math.min(1, 0.5 - (0.5 * (d + e)) / k));
        d = k <= 0 ? Math.max(d, -e) : d + (-e - d) * h + k * h * (1 - h);
        r += (p.r - r) * h;
        g += (p.g - g) * h;
        b += (p.b - b) * h;
      }
    }
    out.d = d;
    out.r = r;
    out.g = g;
    out.b = b;
    out.bone = bone;
    return out;
  }

  /** Sphere-traces a ray; returns the hit distance or -1. */
  raycast(o: V3, dir: V3, max = 1): number {
    const l = Math.hypot(dir[0], dir[1], dir[2]) || 1;
    const dx = dir[0] / l, dy = dir[1] / l, dz = dir[2] / l;
    let t = 0;
    for (let i = 0; i < 256 && t < max; i++) {
      const d = this.distance(o[0] + dx * t, o[1] + dy * t, o[2] + dz * t);
      if (d < 1e-4) return t;
      t += Math.max(d * 0.8, 2e-4);
    }
    return -1;
  }

  /** Front surface point (largest z) at (x, y), searching from zFrom downwards. */
  frontZ(x: number, y: number, zFrom = 1): number {
    const t = this.raycast([x, y, zFrom], [0, 0, -1], zFrom + 1);
    return t < 0 ? 0 : zFrom - t;
  }

  /** Back surface point (smallest z) at (x, y). */
  backZ(x: number, y: number, zFrom = -1): number {
    const t = this.raycast([x, y, zFrom], [0, 0, 1], 1 - zFrom);
    return t < 0 ? 0 : zFrom + t;
  }

  /** Primitives whose influence box overlaps the given box. */
  private cull(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, pad: number): Prim[] {
    const out: Prim[] = [];
    for (const p of this.prims) {
      if (p.max[0] + pad < x0 || p.min[0] - pad > x1) continue;
      if (p.max[1] + pad < y0 || p.min[1] - pad > y1) continue;
      if (p.max[2] + pad < z0 || p.min[2] - pad > z1) continue;
      out.push(p);
    }
    return out;
  }

  /** Bounds of everything that adds material. */
  bounds(): [number[], number[]] {
    const mn = [Infinity, Infinity, Infinity];
    const mx = [-Infinity, -Infinity, -Infinity];
    for (const p of this.prims) {
      if (p.op !== 'add') continue;
      for (let i = 0; i < 3; i++) {
        mn[i] = Math.min(mn[i], p.min[i]);
        mx[i] = Math.max(mx[i], p.max[i]);
      }
    }
    return [mn, mx];
  }

  /**
   * Sparse marching cubes. Returns an indexed geometry with position,
   * normal, color (linear, AO baked in) and a per-vertex `bone` id array.
   */
  mesh(o: MeshOpts): { geometry: THREE.BufferGeometry; bones: Uint8Array } {
    const h = o.cell;
    const B = 4; // cells per block edge
    let [mn, mx] = this.bounds();
    if (o.clipMin) mn = mn.map((v, i) => Math.max(v, o.clipMin![i]));
    if (o.clipMax) mx = mx.map((v, i) => Math.min(v, o.clipMax![i]));
    const ox = mn[0] - h * 2, oy = mn[1] - h * 2, oz = mn[2] - h * 2;
    const nx = Math.ceil((mx[0] - ox) / h) + 3;
    const ny = Math.ceil((mx[1] - oy) / h) + 3;
    const nz = Math.ceil((mx[2] - oz) / h) + 3;
    const bx = Math.ceil(nx / B), by = Math.ceil(ny / B), bz = Math.ceil(nz / B);
    const verts: number[] = [];
    const index: number[] = [];
    const aoD = o.aoDist ?? h * 4;
    // candidate primitives for each vertex's attribute pass (shared per block)
    const vLists: Prim[][] = [];
    const edgeMap = new Map<number, number>();
    const field = new Float32Array((B + 1) ** 3);
    const reach = h * B * 0.866 * 2 + h; // conservative "surface may pass" distance from block centre
    const cornerOff = [
      [0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0],
      [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1],
    ];
    // edge -> [dx, dy, dz, axis]
    const edgeDef = [
      [0, 0, 0, 0], [1, 0, 0, 1], [0, 1, 0, 0], [0, 0, 0, 1],
      [0, 0, 1, 0], [1, 0, 1, 1], [0, 1, 1, 0], [0, 0, 1, 1],
      [0, 0, 0, 2], [1, 0, 0, 2], [1, 1, 0, 2], [0, 1, 0, 2],
    ];
    const edgeCorners = [
      [0, 1], [1, 2], [3, 2], [0, 3],
      [4, 5], [5, 6], [7, 6], [4, 7],
      [0, 4], [1, 5], [2, 6], [3, 7],
    ];
    const cv = new Float64Array(8);
    const eIdx = new Int32Array(12);
    const S = B + 1;
    for (let kb = 0; kb < bz; kb++)
      for (let jb = 0; jb < by; jb++)
        for (let ib = 0; ib < bx; ib++) {
          const x0 = ox + ib * B * h, y0 = oy + jb * B * h, z0 = oz + kb * B * h;
          const x1 = x0 + B * h, y1 = y0 + B * h, z1 = z0 + B * h;
          const list = this.cull(x0, y0, z0, x1, y1, z1, h * 2);
          if (!list.some((p) => p.op === 'add')) continue;
          let wide: Prim[] | null = null;
          const dc = this.distance((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, list);
          if (Math.abs(dc) > reach) continue;
          for (let k = 0; k <= B; k++)
            for (let j = 0; j <= B; j++)
              for (let i = 0; i <= B; i++) field[(k * S + j) * S + i] = this.distance(x0 + i * h, y0 + j * h, z0 + k * h, list);
          for (let k = 0; k < B; k++)
            for (let j = 0; j < B; j++)
              for (let i = 0; i < B; i++) {
                let ci = 0;
                for (let c = 0; c < 8; c++) {
                  const [dx, dy, dz] = cornerOff[c];
                  const v = field[((k + dz) * S + (j + dy)) * S + (i + dx)];
                  cv[c] = v;
                  if (v > 0) ci |= 1 << c;
                }
                const bits = edgeTable[ci];
                if (!bits) continue;
                const gi = ib * B + i, gj = jb * B + j, gk = kb * B + k;
                for (let e = 0; e < 12; e++) {
                  if (!(bits & (1 << e))) continue;
                  const [dx, dy, dz, ax] = edgeDef[e];
                  const key = (((gk + dz) * ny + (gj + dy)) * nx + (gi + dx)) * 3 + ax;
                  let vi = edgeMap.get(key);
                  if (vi === undefined) {
                    const [c0, c1] = edgeCorners[e];
                    const v0 = cv[c0], v1 = cv[c1];
                    const t = Math.abs(v1 - v0) < 1e-12 ? 0.5 : v0 / (v0 - v1);
                    const p0 = cornerOff[c0], p1 = cornerOff[c1];
                    const px = x0 + (i + p0[0] + (p1[0] - p0[0]) * t) * h;
                    const py = y0 + (j + p0[1] + (p1[1] - p0[1]) * t) * h;
                    const pz = z0 + (k + p0[2] + (p1[2] - p0[2]) * t) * h;
                    vi = verts.length / 3;
                    verts.push(px, py, pz);
                    if (!wide) wide = this.cull(x0, y0, z0, x1, y1, z1, aoD + h * 2);
                    vLists.push(wide);
                    edgeMap.set(key, vi);
                  }
                  eIdx[e] = vi;
                }
                const base = ci << 4;
                for (let t = 0; triTable[base + t] !== -1; t += 3) {
                  index.push(eIdx[triTable[base + t]], eIdx[triTable[base + t + 1]], eIdx[triTable[base + t + 2]]);
                }
              }
        }
    // per-vertex attributes
    const n = verts.length / 3;
    const pos = new Float32Array(verts);
    const nrm = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const bones = new Uint8Array(n);
    const s: Sample = { d: 0, r: 0, g: 0, b: 0, bone: 0 };
    const eps = h * 0.35;
    const aoStr = o.ao ?? 0.6;
    const steps = o.project ?? 1;
    for (let v = 0; v < n; v++) {
      let x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
      const list = vLists[v];
      let gx = 0, gy = 0, gz = 0;
      for (let it = 0; it <= steps; it++) {
        gx = this.distance(x + eps, y, z, list) - this.distance(x - eps, y, z, list);
        gy = this.distance(x, y + eps, z, list) - this.distance(x, y - eps, z, list);
        gz = this.distance(x, y, z + eps, list) - this.distance(x, y, z - eps, list);
        const gl = Math.hypot(gx, gy, gz) || 1;
        gx /= gl;
        gy /= gl;
        gz /= gl;
        if (it < steps) {
          const d = this.distance(x, y, z, list);
          const step = Math.max(-h * 0.5, Math.min(h * 0.5, d));
          x -= gx * step;
          y -= gy * step;
          z -= gz * step;
        }
      }
      pos[v * 3] = x;
      pos[v * 3 + 1] = y;
      pos[v * 3 + 2] = z;
      nrm[v * 3] = gx;
      nrm[v * 3 + 1] = gy;
      nrm[v * 3 + 2] = gz;
      // cavity AO (Quilez): how much nearer than expected is the field outwards
      let occ = 0;
      let w = 1;
      for (let i2 = 1; i2 <= 5; i2++) {
        const dd = (aoD * i2) / 5;
        const f = this.distance(x + gx * dd, y + gy * dd, z + gz * dd, list);
        occ += (dd - f) * w;
        w *= 0.6;
      }
      const ao = Math.max(0, Math.min(1, 1 - (aoStr * occ) / aoD));
      this.sample(x, y, z, s, list);
      col[v * 3] = s.r * ao;
      col[v * 3 + 1] = s.g * ao;
      col[v * 3 + 2] = s.b * ao;
      bones[v] = s.bone;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    // make the winding agree with the field gradient
    if (index.length >= 3) {
      let agree = 0;
      const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
      for (let t = 0; t < Math.min(index.length, 3000); t += 3) {
        a.fromArray(pos, index[t] * 3);
        b.fromArray(pos, index[t + 1] * 3);
        c.fromArray(pos, index[t + 2] * 3);
        const fn = b.sub(a).cross(c.sub(a));
        const nn = new THREE.Vector3().fromArray(nrm, index[t] * 3);
        agree += fn.dot(nn) > 0 ? 1 : -1;
      }
      if (agree < 0) for (let t = 0; t < index.length; t += 3) [index[t + 1], index[t + 2]] = [index[t + 2], index[t + 1]];
    }
    geo.setIndex(n > 65535 ? new THREE.Uint32BufferAttribute(index, 1) : new THREE.Uint16BufferAttribute(index, 1));
    geo.computeBoundingSphere();
    geo.computeBoundingBox();
    return { geometry: geo, bones };
  }
}
