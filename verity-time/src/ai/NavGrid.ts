import type { CollisionWorld, Collider } from '../physics/CollisionWorld';

export interface NavPoint {
  x: number;
  y: number;
  z: number;
}

/**
 * 2.5D navigation grid rasterised from the collision world. Each cell stores
 * the walkable ground height; A* with octile heuristic + string pulling.
 * Doors toggle cells dynamically through `refresh(rect)`.
 */
export class NavGrid {
  readonly cols: number;
  readonly rows: number;
  readonly walk: Uint8Array;
  readonly height: Float32Array;
  private gScore: Float32Array;
  private came: Int32Array;
  private closed: Uint8Array;
  private stamp: Uint16Array;
  private curStamp = 0;

  constructor(
    private world: CollisionWorld,
    readonly minX: number,
    readonly minZ: number,
    readonly maxX: number,
    readonly maxZ: number,
    readonly cell = 0.4,
    readonly probeY = 2.2,
    readonly radius = 0.38,
    readonly agentH = 1.3,
  ) {
    this.cols = Math.ceil((maxX - minX) / cell);
    this.rows = Math.ceil((maxZ - minZ) / cell);
    const n = this.cols * this.rows;
    this.walk = new Uint8Array(n);
    this.height = new Float32Array(n);
    this.gScore = new Float32Array(n);
    this.came = new Int32Array(n);
    this.closed = new Uint8Array(n);
    this.stamp = new Uint16Array(n);
    this.refresh();
  }

  /** Re-rasterises all cells, or those within a rectangle. */
  refresh(rect?: { minX: number; minZ: number; maxX: number; maxZ: number }): void {
    const c0 = rect ? Math.max(0, Math.floor((rect.minX - this.minX) / this.cell) - 2) : 0;
    const c1 = rect ? Math.min(this.cols - 1, Math.ceil((rect.maxX - this.minX) / this.cell) + 2) : this.cols - 1;
    const r0 = rect ? Math.max(0, Math.floor((rect.minZ - this.minZ) / this.cell) - 2) : 0;
    const r1 = rect ? Math.min(this.rows - 1, Math.ceil((rect.maxZ - this.minZ) / this.cell) + 2) : this.rows - 1;
    const list: Collider[] = [];
    for (let r = r0; r <= r1; r++)
      for (let c = c0; c <= c1; c++) {
        const i = r * this.cols + c;
        const x = this.minX + (c + 0.5) * this.cell;
        const z = this.minZ + (r + 0.5) * this.cell;
        const g = this.world.groundHeight(x, z, 0.1, this.probeY, 'ai');
        if (g === -Infinity) {
          this.walk[i] = 0;
          continue;
        }
        this.height[i] = g;
        // obstacles within the agent radius between knee and head height
        const R = this.radius;
        this.world.query(x - R, z - R, x + R, z + R, list);
        let blocked = false;
        for (const col of list) {
          if (!col.solid || col.blocks === 'player') continue;
          const top = this.world.topAt(col, x, z);
          if (top <= g + 0.35 || col.min.y >= g + this.agentH) continue;
          if (col.ramp) continue;
          const px = Math.max(col.min.x, Math.min(x, col.max.x));
          const pz = Math.max(col.min.z, Math.min(z, col.max.z));
          if ((x - px) ** 2 + (z - pz) ** 2 < R * R) {
            blocked = true;
            break;
          }
        }
        this.walk[i] = blocked ? 0 : 1;
      }
  }

  idx(x: number, z: number): number {
    const c = Math.floor((x - this.minX) / this.cell);
    const r = Math.floor((z - this.minZ) / this.cell);
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return -1;
    return r * this.cols + c;
  }

  center(i: number): NavPoint {
    const c = i % this.cols;
    const r = (i / this.cols) | 0;
    return { x: this.minX + (c + 0.5) * this.cell, y: this.height[i], z: this.minZ + (r + 0.5) * this.cell };
  }

  walkable(x: number, z: number): boolean {
    const i = this.idx(x, z);
    return i >= 0 && this.walk[i] === 1;
  }

  /** Nearest walkable cell to a point (spiral search). */
  nearest(x: number, z: number, maxRing = 8): number {
    const i0 = this.idx(x, z);
    if (i0 >= 0 && this.walk[i0]) return i0;
    const c0 = Math.floor((x - this.minX) / this.cell);
    const r0 = Math.floor((z - this.minZ) / this.cell);
    for (let ring = 1; ring <= maxRing; ring++)
      for (let dr = -ring; dr <= ring; dr++)
        for (let dc = -ring; dc <= ring; dc++) {
          if (Math.abs(dr) !== ring && Math.abs(dc) !== ring) continue;
          const c = c0 + dc;
          const r = r0 + dr;
          if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) continue;
          const i = r * this.cols + c;
          if (this.walk[i]) return i;
        }
    return -1;
  }

  /** A* path between world points; returns smoothed waypoints or null. */
  path(from: NavPoint, to: NavPoint, maxIter = 20000): NavPoint[] | null {
    const s = this.nearest(from.x, from.z);
    const t = this.nearest(to.x, to.z);
    if (s < 0 || t < 0) return null;
    if (s === t) return [this.center(t)];
    this.curStamp = (this.curStamp + 1) & 0xffff;
    if (this.curStamp === 0) {
      this.stamp.fill(0);
      this.curStamp = 1;
    }
    const st = this.curStamp;
    const cols = this.cols;
    const tc = t % cols;
    const tr = (t / cols) | 0;
    const h = (i: number) => {
      const dx = Math.abs((i % cols) - tc);
      const dz = Math.abs(((i / cols) | 0) - tr);
      return Math.max(dx, dz) + 0.4142 * Math.min(dx, dz);
    };
    const open = new MinHeap();
    this.stamp[s] = st;
    this.gScore[s] = 0;
    this.closed[s] = 0;
    this.came[s] = -1;
    open.push(s, h(s));
    let iter = 0;
    while (open.size && iter++ < maxIter) {
      const cur = open.pop();
      if (cur === t) return this.smooth(this.reconstruct(t));
      if (this.closed[cur] && this.stamp[cur] === st) continue;
      this.closed[cur] = 1;
      const cc = cur % cols;
      const cr = (cur / cols) | 0;
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          const nc = cc + dc;
          const nr = cr + dr;
          if (nc < 0 || nr < 0 || nc >= cols || nr >= this.rows) continue;
          const ni = nr * cols + nc;
          if (!this.walk[ni]) continue;
          // no corner cutting
          if (dr && dc && (!this.walk[cr * cols + nc] || !this.walk[nr * cols + cc])) continue;
          // no cliffs
          if (Math.abs(this.height[ni] - this.height[cur]) > 0.45) continue;
          const cost = this.gScore[cur] + (dr && dc ? 1.4142 : 1);
          if (this.stamp[ni] !== st) {
            this.stamp[ni] = st;
            this.closed[ni] = 0;
            this.gScore[ni] = Infinity;
          }
          if (this.closed[ni]) continue;
          if (cost < this.gScore[ni]) {
            this.gScore[ni] = cost;
            this.came[ni] = cur;
            open.push(ni, cost + h(ni));
          }
        }
    }
    return null;
  }

  private reconstruct(t: number): number[] {
    const out: number[] = [];
    let c = t;
    let guard = 0;
    while (c >= 0 && guard++ < 100000) {
      out.push(c);
      c = this.came[c];
    }
    return out.reverse();
  }

  /** Grid line-walk visibility used for string pulling. */
  clearLine(a: number, b: number): boolean {
    const pa = this.center(a);
    const pb = this.center(b);
    const dist = Math.hypot(pb.x - pa.x, pb.z - pa.z);
    const steps = Math.ceil(dist / (this.cell * 0.5));
    let prevH = pa.y;
    for (let k = 1; k <= steps; k++) {
      const t = k / steps;
      const x = pa.x + (pb.x - pa.x) * t;
      const z = pa.z + (pb.z - pa.z) * t;
      const i = this.idx(x, z);
      if (i < 0 || !this.walk[i]) return false;
      if (Math.abs(this.height[i] - prevH) > 0.45) return false;
      prevH = this.height[i];
      // inflate: also test perpendicular neighbours for clearance
    }
    return true;
  }

  private smooth(cells: number[]): NavPoint[] {
    if (cells.length <= 2) return cells.map((c) => this.center(c));
    const out: number[] = [cells[0]];
    let anchor = 0;
    for (let i = 2; i < cells.length; i++) {
      if (!this.clearLine(cells[anchor], cells[i])) {
        out.push(cells[i - 1]);
        anchor = i - 1;
      }
    }
    out.push(cells[cells.length - 1]);
    return out.map((c) => this.center(c));
  }

  /** Random walkable point within radius (for wandering/search). */
  randomNear(x: number, z: number, radius: number, rnd = Math.random): NavPoint | null {
    for (let k = 0; k < 30; k++) {
      const a = rnd() * Math.PI * 2;
      const r = Math.sqrt(rnd()) * radius;
      const i = this.idx(x + Math.cos(a) * r, z + Math.sin(a) * r);
      if (i >= 0 && this.walk[i]) return this.center(i);
    }
    return null;
  }
}

class MinHeap {
  private ids: number[] = [];
  private keys: number[] = [];
  get size(): number {
    return this.ids.length;
  }
  push(id: number, key: number): void {
    const ids = this.ids;
    const keys = this.keys;
    ids.push(id);
    keys.push(key);
    let i = ids.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (keys[p] <= keys[i]) break;
      [ids[p], ids[i]] = [ids[i], ids[p]];
      [keys[p], keys[i]] = [keys[i], keys[p]];
      i = p;
    }
  }
  pop(): number {
    const ids = this.ids;
    const keys = this.keys;
    const top = ids[0];
    const lid = ids.pop()!;
    const lk = keys.pop()!;
    if (ids.length) {
      ids[0] = lid;
      keys[0] = lk;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < ids.length && keys[l] < keys[m]) m = l;
        if (r < ids.length && keys[r] < keys[m]) m = r;
        if (m === i) break;
        [ids[m], ids[i]] = [ids[i], ids[m]];
        [keys[m], keys[i]] = [keys[i], keys[m]];
        i = m;
      }
    }
    return top;
  }
}
