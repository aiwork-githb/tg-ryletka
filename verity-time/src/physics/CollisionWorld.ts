/**
 * Lightweight collision world built from axis-aligned boxes (and ramps).
 * The level builder emits one box per wall segment / prop, which is both
 * cheap and robust for a first-person adventure.
 */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Ramp {
  /** Axis along which height rises from min.y to max.y. */
  axis: 'x' | 'z';
  /** +1: rises towards +axis, -1: rises towards -axis. */
  dir: 1 | -1;
}

export interface Collider {
  id: number;
  min: Vec3;
  max: Vec3;
  /** Blocks movement. */
  solid: boolean;
  /** Blocks line of sight (AI vision, interaction). */
  opaque: boolean;
  enabled: boolean;
  ramp?: Ramp;
  tag?: string;
  /** Which agents it blocks: player, ai, or both. */
  blocks: 'all' | 'player' | 'ai';
  _cells?: number[];
  _stamp?: number;
}

export interface RayHit {
  dist: number;
  collider: Collider;
  normal: Vec3;
  point: Vec3;
}

const CELL = 4;

export class CollisionWorld {
  readonly colliders: Collider[] = [];
  private grid = new Map<number, Collider[]>();
  private nextId = 1;
  private stamp = 1;

  private key(ix: number, iz: number): number {
    return ((ix + 4096) << 13) | (iz + 4096);
  }

  add(min: Vec3, max: Vec3, opts: Partial<Omit<Collider, 'id' | 'min' | 'max'>> = {}): Collider {
    const c: Collider = {
      id: this.nextId++,
      min: { x: Math.min(min.x, max.x), y: Math.min(min.y, max.y), z: Math.min(min.z, max.z) },
      max: { x: Math.max(min.x, max.x), y: Math.max(min.y, max.y), z: Math.max(min.z, max.z) },
      solid: opts.solid ?? true,
      opaque: opts.opaque ?? true,
      enabled: opts.enabled ?? true,
      ramp: opts.ramp,
      tag: opts.tag,
      blocks: opts.blocks ?? 'all',
    };
    this.colliders.push(c);
    this.insert(c);
    return c;
  }

  /** Adds a box from centre + half extents. */
  addBox(cx: number, cy: number, cz: number, hx: number, hy: number, hz: number, opts: Partial<Omit<Collider, 'id' | 'min' | 'max'>> = {}): Collider {
    return this.add({ x: cx - hx, y: cy - hy, z: cz - hz }, { x: cx + hx, y: cy + hy, z: cz + hz }, opts);
  }

  remove(c: Collider): void {
    this.unlink(c);
    const i = this.colliders.indexOf(c);
    if (i >= 0) this.colliders.splice(i, 1);
  }

  /** Re-indexes a collider after its bounds changed. */
  update(c: Collider): void {
    this.unlink(c);
    this.insert(c);
  }

  clear(): void {
    this.colliders.length = 0;
    this.grid.clear();
  }

  private insert(c: Collider): void {
    const x0 = Math.floor(c.min.x / CELL);
    const x1 = Math.floor(c.max.x / CELL);
    const z0 = Math.floor(c.min.z / CELL);
    const z1 = Math.floor(c.max.z / CELL);
    c._cells = [];
    for (let ix = x0; ix <= x1; ix++)
      for (let iz = z0; iz <= z1; iz++) {
        const k = this.key(ix, iz);
        let list = this.grid.get(k);
        if (!list) this.grid.set(k, (list = []));
        list.push(c);
        c._cells.push(k);
      }
  }

  private unlink(c: Collider): void {
    if (!c._cells) return;
    for (const k of c._cells) {
      const list = this.grid.get(k);
      if (!list) continue;
      const i = list.indexOf(c);
      if (i >= 0) list.splice(i, 1);
    }
    c._cells = [];
  }

  /** All enabled colliders overlapping an XZ rectangle. */
  query(minX: number, minZ: number, maxX: number, maxZ: number, out: Collider[] = []): Collider[] {
    out.length = 0;
    const s = ++this.stamp;
    const x0 = Math.floor(minX / CELL);
    const x1 = Math.floor(maxX / CELL);
    const z0 = Math.floor(minZ / CELL);
    const z1 = Math.floor(maxZ / CELL);
    for (let ix = x0; ix <= x1; ix++)
      for (let iz = z0; iz <= z1; iz++) {
        const list = this.grid.get(this.key(ix, iz));
        if (!list) continue;
        for (const c of list) {
          if (c._stamp === s || !c.enabled) continue;
          c._stamp = s;
          if (c.max.x < minX || c.min.x > maxX || c.max.z < minZ || c.min.z > maxZ) continue;
          out.push(c);
        }
      }
    return out;
  }

  /** Surface height of a collider at (x,z) (handles ramps). */
  topAt(c: Collider, x: number, z: number): number {
    if (!c.ramp) return c.max.y;
    const { axis, dir } = c.ramp;
    const lo = axis === 'x' ? c.min.x : c.min.z;
    const hi = axis === 'x' ? c.max.x : c.max.z;
    const p = axis === 'x' ? x : z;
    let t = (p - lo) / (hi - lo || 1);
    t = Math.max(0, Math.min(1, t));
    if (dir < 0) t = 1 - t;
    return c.min.y + (c.max.y - c.min.y) * t;
  }

  private tmp: Collider[] = [];
  /** Collider that produced the last groundHeight() result. */
  lastGround: Collider | null = null;

  /**
   * Highest walkable surface below `maxY` under a circle at (x,z).
   * Returns -Infinity if there is none.
   */
  groundHeight(x: number, z: number, radius: number, maxY: number, agent: 'player' | 'ai' = 'player'): number {
    const list = this.query(x - radius, z - radius, x + radius, z + radius, this.tmp);
    let best = -Infinity;
    this.lastGround = null;
    const r = radius * 0.7; // feet are a bit narrower than the body
    for (const c of list) {
      if (!c.solid || !blocksAgent(c, agent)) continue;
      if (x + r < c.min.x || x - r > c.max.x || z + r < c.min.z || z - r > c.max.z) continue;
      const cx = Math.max(c.min.x, Math.min(x, c.max.x));
      const cz = Math.max(c.min.z, Math.min(z, c.max.z));
      const top = this.topAt(c, cx, cz);
      if (top <= maxY && top > best) {
        best = top;
        this.lastGround = c;
      }
    }
    return best;
  }

  /**
   * Moves a vertical cylinder (feet position) horizontally with sliding.
   * Boxes whose top is within `step` of the feet are treated as walkable.
   */
  slide(pos: Vec3, dx: number, dz: number, radius: number, height: number, step: number, agent: 'player' | 'ai' = 'player'): { hitWall: boolean } {
    const dist = Math.hypot(dx, dz);
    const steps = Math.max(1, Math.ceil(dist / (radius * 0.45)));
    let hitWall = false;
    for (let s = 0; s < steps; s++) {
      pos.x += dx / steps;
      pos.z += dz / steps;
      for (let iter = 0; iter < 4; iter++) {
        const list = this.query(pos.x - radius, pos.z - radius, pos.x + radius, pos.z + radius, this.tmp);
        let moved = false;
        for (const c of list) {
          if (!c.solid || !blocksAgent(c, agent)) continue;
          // vertical overlap with the body above the step height
          const top = c.ramp ? this.topAt(c, pos.x, pos.z) : c.max.y;
          if (top <= pos.y + step) continue;
          if (c.min.y >= pos.y + height) continue;
          if (c.ramp && top - (pos.y) < step * 1.2) continue;
          const px = Math.max(c.min.x, Math.min(pos.x, c.max.x));
          const pz = Math.max(c.min.z, Math.min(pos.z, c.max.z));
          let ox = pos.x - px;
          let oz = pos.z - pz;
          const d2 = ox * ox + oz * oz;
          if (d2 >= radius * radius) continue;
          if (d2 > 1e-10) {
            const d = Math.sqrt(d2);
            const push = radius - d;
            pos.x += (ox / d) * push;
            pos.z += (oz / d) * push;
          } else {
            // centre inside the box: exit along the shallowest axis
            const l = pos.x - c.min.x;
            const r = c.max.x - pos.x;
            const b = pos.z - c.min.z;
            const f = c.max.z - pos.z;
            const m = Math.min(l, r, b, f);
            if (m === l) pos.x = c.min.x - radius;
            else if (m === r) pos.x = c.max.x + radius;
            else if (m === b) pos.z = c.min.z - radius;
            else pos.z = c.max.z + radius;
            ox = oz = 0;
          }
          moved = true;
          hitWall = true;
        }
        if (!moved) break;
      }
    }
    return { hitWall };
  }

  /** Lowest ceiling above `fromY` (for head bumps / crouch checks). */
  ceilingHeight(x: number, z: number, radius: number, fromY: number, agent: 'player' | 'ai' = 'player'): number {
    const list = this.query(x - radius, z - radius, x + radius, z + radius, this.tmp);
    let best = Infinity;
    for (const c of list) {
      if (!c.solid || !blocksAgent(c, agent) || c.ramp) continue;
      if (x + radius * 0.7 < c.min.x || x - radius * 0.7 > c.max.x || z + radius * 0.7 < c.min.z || z - radius * 0.7 > c.max.z) continue;
      if (c.min.y >= fromY && c.min.y < best) best = c.min.y;
    }
    return best;
  }

  /** Ray vs boxes. `filter` decides which colliders count. */
  raycast(o: Vec3, d: Vec3, maxDist: number, filter: (c: Collider) => boolean = (c) => c.opaque): RayHit | null {
    const ex = o.x + d.x * maxDist;
    const ez = o.z + d.z * maxDist;
    const list = this.query(Math.min(o.x, ex), Math.min(o.z, ez), Math.max(o.x, ex), Math.max(o.z, ez), this.tmp);
    let best: RayHit | null = null;
    for (const c of list) {
      if (!filter(c)) continue;
      const h = rayBox(o, d, c, maxDist);
      if (h && (!best || h.dist < best.dist)) best = h;
    }
    return best;
  }

  /** True if nothing opaque lies between a and b. */
  lineOfSight(a: Vec3, b: Vec3, ignore?: (c: Collider) => boolean): boolean {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-4) return true;
    const d = { x: dx / len, y: dy / len, z: dz / len };
    const hit = this.raycast(a, d, len - 0.05, (c) => c.opaque && !(ignore && ignore(c)));
    return !hit;
  }
}

export function blocksAgent(c: Collider, agent: 'player' | 'ai'): boolean {
  return c.blocks === 'all' || c.blocks === agent;
}

function rayBox(o: Vec3, d: Vec3, c: Collider, maxDist: number): RayHit | null {
  let tmin = 0;
  let tmax = maxDist;
  let nAxis = -1;
  let nSign = 0;
  const axes: Array<'x' | 'y' | 'z'> = ['x', 'y', 'z'];
  for (let a = 0; a < 3; a++) {
    const k = axes[a];
    const od = d[k];
    const oo = o[k];
    const mn = c.min[k];
    const mx = c.max[k];
    if (Math.abs(od) < 1e-9) {
      if (oo < mn || oo > mx) return null;
      continue;
    }
    let t1 = (mn - oo) / od;
    let t2 = (mx - oo) / od;
    let sign = -1;
    if (t1 > t2) {
      const t = t1;
      t1 = t2;
      t2 = t;
      sign = 1;
    }
    if (t1 > tmin) {
      tmin = t1;
      nAxis = a;
      nSign = sign;
    }
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return null;
  }
  if (nAxis < 0) {
    // origin inside the box
    return { dist: 0, collider: c, normal: { x: -d.x, y: -d.y, z: -d.z }, point: { ...o } };
  }
  const normal = { x: 0, y: 0, z: 0 };
  normal[axes[nAxis]] = nSign;
  return { dist: tmin, collider: c, normal, point: { x: o.x + d.x * tmin, y: o.y + d.y * tmin, z: o.z + d.z * tmin } };
}
