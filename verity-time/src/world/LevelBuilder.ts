import * as THREE from 'three';
import type { Materials } from '../assets/Materials';
import type { CollisionWorld, Collider } from '../physics/CollisionWorld';
import { VLight, type LightManager, type FlickerMode } from '../render/LightManager';
import { bakeByMaterial, merge, normalizeAttributes, projectUV, vcolor } from './geom';
import { Zone, type Cell, type Trigger } from './Zone';

export type Side = 'n' | 's' | 'e' | 'w';

export interface Opening {
  side: Side;
  /** World coordinate of the opening centre along the wall axis. */
  at: number;
  width: number;
  height: number;
  sill?: number;
  /** Generate jamb reveal faces (only one of two connected rooms does). */
  jambs?: boolean;
  jambMat?: string;
}

export interface RoomOpts {
  x: number;
  z: number;
  w: number;
  d: number;
  y?: number;
  h: number;
  floor?: string | null;
  ceil?: string | null;
  wall?: string | null;
  walls?: Partial<Record<Side, string | null>>;
  /** Lower band material (e.g. tiles up to 1.2 m). */
  wainscot?: { mat: string; height: number; rail?: string };
  baseboard?: string | null;
  surface?: string;
  cell?: string;
  /** Ceiling has no collider (open shafts, atriums). */
  openTop?: boolean;
  noFloorCollider?: boolean;
}

export interface Room extends RoomOpts {
  id: string;
  openings: Opening[];
  y: number;
}

const T = 0.1; // half wall thickness

export interface BuildCtx {
  mats: Materials;
  world: CollisionWorld;
  lights: LightManager;
}

const SURFACE_OF: Array<[RegExp, string]> = [
  [/carpet/, 'carpet'],
  [/wood/, 'wood'],
  [/terrazzo|checker|tile|linoleum/, 'tile'],
  [/grate/, 'grate'],
  [/metal|diamond/, 'metal'],
  [/playmat|padded|rubber/, 'plastic'],
];

export function surfaceFor(mat: string | null | undefined): string {
  if (!mat) return 'concrete';
  for (const [re, s] of SURFACE_OF) if (re.test(mat)) return s;
  return 'concrete';
}

/**
 * Authoring API for zones: rooms with openings, solids, stairs, props,
 * lights, triggers and cells. `finish()` merges static geometry per
 * material per cell (static batching) and returns the Zone.
 */
export class LevelBuilder {
  readonly zone: Zone;
  readonly rooms = new Map<string, Room>();
  private batches = new Map<string, Map<THREE.Material, THREE.BufferGeometry[]>>();
  private cellDefs: Array<{ id: string; min: THREE.Vector3; max: THREE.Vector3; pvs: string[] }> = [];
  readonly colliders: Collider[] = [];
  currentCell = '';

  constructor(
    readonly ctx: BuildCtx,
    id: string,
    name: string,
  ) {
    this.zone = new Zone(id, name);
  }

  get mats(): Materials {
    return this.ctx.mats;
  }

  // ------------------------------------------------------------------ cells
  cell(id: string, x0: number, z0: number, x1: number, z1: number, pvs: string[] = [], y0 = -50, y1 = 50): this {
    this.cellDefs.push({ id, min: new THREE.Vector3(Math.min(x0, x1), y0, Math.min(z0, z1)), max: new THREE.Vector3(Math.max(x0, x1), y1, Math.max(z0, z1)), pvs: [id, ...pvs] });
    return this;
  }

  inCell<T>(id: string, fn: () => T): T {
    const prev = this.currentCell;
    this.currentCell = id;
    try {
      return fn();
    } finally {
      this.currentCell = prev;
    }
  }

  private batchFor(cell: string): Map<THREE.Material, THREE.BufferGeometry[]> {
    let b = this.batches.get(cell);
    if (!b) this.batches.set(cell, (b = new Map()));
    return b;
  }

  private pushGeo(mat: THREE.Material, g: THREE.BufferGeometry, cell = this.currentCell): void {
    const needColor = (mat as THREE.MeshStandardMaterial).vertexColors === true;
    const n = normalizeAttributes(g, needColor);
    const b = this.batchFor(cell);
    let list = b.get(mat);
    if (!list) b.set(mat, (list = []));
    list.push(n);
  }

  // ------------------------------------------------------------------ rooms
  room(id: string, o: RoomOpts): Room {
    const r: Room = { ...o, id, y: o.y ?? 0, openings: [], cell: o.cell ?? (this.currentCell || undefined) };
    this.rooms.set(id, r);
    return r;
  }

  opening(roomId: string, op: Opening): void {
    const r = this.rooms.get(roomId);
    if (!r) throw new Error('no room ' + roomId);
    r.openings.push({ jambs: true, ...op });
  }

  /**
   * Connects two rooms sharing a wall with an opening centred at `at`
   * (world coordinate along the shared wall).
   */
  connect(a: string, b: string, at: number, width = 1.2, height = 2.3, sill = 0): void {
    const A = this.rooms.get(a)!;
    const B = this.rooms.get(b)!;
    if (!A || !B) throw new Error(`connect: missing ${a} or ${b}`);
    const eps = 0.05;
    let sa: Side, sb: Side;
    if (Math.abs(A.x + A.w - B.x) < eps) [sa, sb] = ['e', 'w'];
    else if (Math.abs(B.x + B.w - A.x) < eps) [sa, sb] = ['w', 'e'];
    else if (Math.abs(A.z + A.d - B.z) < eps) [sa, sb] = ['s', 'n'];
    else if (Math.abs(B.z + B.d - A.z) < eps) [sa, sb] = ['n', 's'];
    else throw new Error(`connect: rooms ${a} and ${b} do not share a wall`);
    A.openings.push({ side: sa, at, width, height, sill, jambs: true });
    B.openings.push({ side: sb, at, width, height, sill, jambs: false });
  }

  private buildRoom(r: Room): void {
    const m = this.mats;
    const cell = r.cell ?? '';
    const y = r.y;
    const x0 = r.x + T;
    const x1 = r.x + r.w - T;
    const z0 = r.z + T;
    const z1 = r.z + r.d - T;
    const iw = x1 - x0;
    const id = z1 - z0;
    // ---- floor
    if (r.floor) {
      const mat = m.arch(r.floor);
      const g = new THREE.PlaneGeometry(r.w, r.d, Math.max(1, Math.ceil(r.w / 0.8)), Math.max(1, Math.ceil(r.d / 0.8)));
      g.rotateX(-Math.PI / 2);
      g.translate(r.x + r.w / 2, y, r.z + r.d / 2);
      projectUV(g, m.tileOf(r.floor));
      vcolor(g, (px, _py, pz) => {
        const d = Math.min(px - x0, x1 - px, pz - z0, z1 - pz);
        return clamp(1 - 0.42 * Math.exp(-Math.max(0, d) / 0.35), 0.4, 1);
      });
      this.pushGeo(mat, g, cell);
    }
    if (r.floor !== undefined && !r.noFloorCollider) {
      this.collider(r.x, y - 0.5, r.z, r.x + r.w, y, r.z + r.d, { tag: 'surf:' + (r.surface ?? surfaceFor(r.floor)) });
    }
    // ---- ceiling
    if (r.ceil) {
      const mat = m.arch(r.ceil);
      const g = new THREE.PlaneGeometry(r.w, r.d, Math.max(1, Math.ceil(r.w / 1.2)), Math.max(1, Math.ceil(r.d / 1.2)));
      g.rotateX(Math.PI / 2);
      g.translate(r.x + r.w / 2, y + r.h, r.z + r.d / 2);
      projectUV(g, m.tileOf(r.ceil));
      vcolor(g, (px, _py, pz) => {
        const d = Math.min(px - x0, x1 - px, pz - z0, z1 - pz);
        return clamp(1 - 0.35 * Math.exp(-Math.max(0, d) / 0.5), 0.45, 1);
      });
      this.pushGeo(mat, g, cell);
    }
    if (!r.openTop) this.collider(r.x, y + r.h, r.z, r.x + r.w, y + r.h + 0.4, r.z + r.d, { opaque: true });
    // ---- walls
    const sides: Array<[Side, number, number, number]> = [
      ['n', x0, x1, z0],
      ['s', x0, x1, z1],
      ['w', z0, z1, x0],
      ['e', z0, z1, x1],
    ];
    for (const [side, a, b, fixed] of sides) {
      const wm = r.walls?.[side] !== undefined ? r.walls[side] : r.wall;
      if (wm === null || wm === undefined) continue;
      const ops = r.openings.filter((o) => o.side === side).sort((p, q) => p.at - q.at);
      const rects: Array<[number, number, number, number]> = [];
      let cur = a;
      for (const o of ops) {
        const l = Math.max(a, o.at - o.width / 2);
        const rr = Math.min(b, o.at + o.width / 2);
        if (l > cur + 0.001) rects.push([cur, l, 0, r.h]);
        const top = (o.sill ?? 0) + o.height;
        if (top < r.h - 0.001) rects.push([l, rr, top, r.h]);
        if ((o.sill ?? 0) > 0.001) rects.push([l, rr, 0, o.sill!]);
        cur = Math.max(cur, rr);
      }
      if (cur < b - 0.001) rects.push([cur, b, 0, r.h]);
      for (const [u0, u1, v0, v1] of rects) {
        this.wallRect(side, fixed, u0, u1, y + v0, y + v1, y, r, wm, a, b, cell);
      }
      // jambs for openings this room owns
      for (const o of ops) {
        if (!o.jambs) continue;
        this.jambs(side, fixed, o, y, o.jambMat ?? wm, cell);
      }
      // baseboard
      if (r.baseboard) {
        for (const [u0, u1, v0] of rects) {
          if (v0 > 0.001) continue;
          this.baseboard(side, fixed, u0, u1, y, r.baseboard, cell);
        }
      }
    }
    void iw;
    void id;
  }

  private wallRect(side: Side, fixed: number, u0: number, u1: number, y0: number, y1: number, floorY: number, r: Room, matId: string, a: number, b: number, cell: string): void {
    const m = this.mats;
    const parts: Array<[number, number, string]> = [];
    const wc = r.wainscot;
    if (wc && y0 < floorY + wc.height && y1 > floorY + wc.height) {
      parts.push([y0, floorY + wc.height, wc.mat], [floorY + wc.height, y1, matId]);
    } else if (wc && y1 <= floorY + wc.height) parts.push([y0, y1, wc.mat]);
    else parts.push([y0, y1, matId]);
    const len = u1 - u0;
    for (const [p0, p1, mid] of parts) {
      const hgt = p1 - p0;
      if (hgt <= 0.001 || len <= 0.001) continue;
      const g = new THREE.PlaneGeometry(len, hgt, Math.max(1, Math.ceil(len / 0.6)), Math.max(1, Math.ceil(hgt / 0.5)));
      const cu = (u0 + u1) / 2;
      const cy = (p0 + p1) / 2;
      switch (side) {
        case 'n':
          g.translate(cu, cy, fixed);
          break;
        case 's':
          g.rotateY(Math.PI);
          g.translate(cu, cy, fixed);
          break;
        case 'w':
          g.rotateY(Math.PI / 2);
          g.translate(fixed, cy, cu);
          break;
        case 'e':
          g.rotateY(-Math.PI / 2);
          g.translate(fixed, cy, cu);
          break;
      }
      projectUV(g, m.tileOf(mid));
      const H = r.h;
      vcolor(g, (px, py, pz) => {
        const v = py - floorY;
        const u = side === 'n' || side === 's' ? px : pz;
        const corner = Math.min(u - a, b - u);
        let ao = 1 - 0.5 * Math.exp(-v / 0.3) - 0.28 * Math.exp(-(H - v) / 0.45) - 0.3 * Math.exp(-Math.max(0, corner) / 0.35);
        // slight vertical grime gradient
        ao *= 0.92 + 0.08 * Math.min(1, v / 2);
        return clamp(ao, 0.3, 1);
      });
      this.pushGeo(m.arch(mid), g, cell);
    }
    if (r.wainscot?.rail && y0 <= floorY + r.wainscot.height && y1 >= floorY + r.wainscot.height) {
      this.trimStrip(side, fixed, u0, u1, floorY + r.wainscot.height, 0.06, 0.03, r.wainscot.rail, cell);
    }
    // collider (full thickness around the boundary)
    const bnd = side === 'n' ? fixed - T : side === 's' ? fixed + T : side === 'w' ? fixed - T : fixed + T;
    if (side === 'n' || side === 's') this.collider(u0, y0, bnd - T, u1, y1, bnd + T, { opaque: true });
    else this.collider(bnd - T, y0, u0, bnd + T, y1, u1, { opaque: true });
  }

  private jambs(side: Side, fixed: number, o: Opening, floorY: number, matId: string, cell: string): void {
    const m = this.mats;
    const mat = m.arch(matId);
    const outer = side === 'n' ? fixed - 2 * T : side === 's' ? fixed + 2 * T : side === 'w' ? fixed - 2 * T : fixed + 2 * T;
    const lo = Math.min(fixed, outer);
    const thick = Math.abs(outer - fixed);
    const mid = (fixed + outer) / 2;
    const l = o.at - o.width / 2;
    const r = o.at + o.width / 2;
    const yb = floorY + (o.sill ?? 0);
    const yt = yb + o.height;
    const add = (g: THREE.BufferGeometry) => {
      projectUV(g, m.tileOf(matId));
      vcolor(g, 0.8);
      this.pushGeo(mat, g, cell);
    };
    const alongX = side === 'n' || side === 's';
    // side faces
    for (const [u, dir] of [
      [l, 1],
      [r, -1],
    ] as const) {
      const g = new THREE.PlaneGeometry(thick, o.height);
      if (alongX) {
        g.rotateY((dir * Math.PI) / 2);
        g.translate(u, (yb + yt) / 2, mid);
      } else {
        g.rotateY(dir > 0 ? Math.PI : 0);
        g.translate(mid, (yb + yt) / 2, u);
      }
      add(g);
    }
    // head
    const top = new THREE.PlaneGeometry(alongX ? o.width : thick, alongX ? thick : o.width);
    top.rotateX(Math.PI / 2);
    top.translate(alongX ? o.at : mid, yt, alongX ? mid : o.at);
    add(top);
    if ((o.sill ?? 0) > 0) {
      const sill = new THREE.PlaneGeometry(alongX ? o.width : thick, alongX ? thick : o.width);
      sill.rotateX(-Math.PI / 2);
      sill.translate(alongX ? o.at : mid, yb, alongX ? mid : o.at);
      add(sill);
    }
    void lo;
  }

  private baseboard(side: Side, fixed: number, u0: number, u1: number, y: number, mat: string, cell: string): void {
    this.trimStrip(side, fixed, u0, u1, y + 0.06, 0.12, 0.022, mat, cell);
  }

  private trimStrip(side: Side, fixed: number, u0: number, u1: number, cy: number, h: number, depth: number, mat: string, cell: string): void {
    const len = u1 - u0;
    if (len < 0.02) return;
    const g = new THREE.BoxGeometry(side === 'n' || side === 's' ? len : depth, h, side === 'n' || side === 's' ? depth : len);
    const off = depth / 2;
    const c = (u0 + u1) / 2;
    if (side === 'n') g.translate(c, cy, fixed + off);
    else if (side === 's') g.translate(c, cy, fixed - off);
    else if (side === 'w') g.translate(fixed + off, cy, c);
    else g.translate(fixed - off, cy, c);
    projectUV(g, 0.5);
    vcolor(g, 0.85);
    this.pushGeo(this.mats.arch(mat), g, cell);
  }

  // ------------------------------------------------------------- primitives

  collider(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, opts: Partial<Omit<Collider, 'id' | 'min' | 'max'>> = {}): Collider {
    const c = this.ctx.world.add({ x: x0, y: y0, z: z0 }, { x: x1, y: y1, z: z1 }, { opaque: false, ...opts });
    this.colliders.push(c);
    return c;
  }

  /** Solid box of architecture (column, platform, counter body). */
  solid(matId: string, x: number, y: number, z: number, w: number, h: number, d: number, opts: { collide?: boolean; opaque?: boolean; ao?: boolean; tag?: string; cell?: string } = {}): void {
    const g = new THREE.BoxGeometry(w, h, d, Math.max(1, Math.ceil(w / 1)), Math.max(1, Math.ceil(h / 0.6)), Math.max(1, Math.ceil(d / 1)));
    g.translate(x, y + h / 2, z);
    projectUV(g, this.mats.tileOf(matId));
    const floorY = y;
    vcolor(g, opts.ao === false ? 1 : (_px, py) => clamp(1 - 0.35 * Math.exp(-(py - floorY) / 0.25), 0.5, 1));
    this.pushGeo(this.mats.arch(matId), g, opts.cell ?? this.currentCell);
    if (opts.collide !== false) this.collider(x - w / 2, y, z - d / 2, x + w / 2, y + h, z + d / 2, { opaque: opts.opaque ?? true, tag: opts.tag });
  }

  /** Free-standing wall slab between two points (partitions, cubicles). */
  wall(matId: string, ax: number, az: number, bx: number, bz: number, y: number, h: number, thick = 0.15): void {
    const len = Math.hypot(bx - ax, bz - az);
    const ang = Math.atan2(bz - az, bx - ax);
    const g = new THREE.BoxGeometry(len, h, thick, Math.ceil(len / 0.6), Math.ceil(h / 0.5), 1);
    g.rotateY(-ang);
    g.translate((ax + bx) / 2, y + h / 2, (az + bz) / 2);
    projectUV(g, this.mats.tileOf(matId));
    vcolor(g, (_x, py) => clamp(1 - 0.45 * Math.exp(-(py - y) / 0.3), 0.4, 1));
    this.pushGeo(this.mats.arch(matId), g);
    const c = Math.abs(Math.cos(ang));
    const s = Math.abs(Math.sin(ang));
    const hx = (len / 2) * c + (thick / 2) * s;
    const hz = (len / 2) * s + (thick / 2) * c;
    this.collider((ax + bx) / 2 - hx, y, (az + bz) / 2 - hz, (ax + bx) / 2 + hx, y + h, (az + bz) / 2 + hz, { opaque: true });
  }

  /** Straight staircase; visual steps + a smooth ramp collider. */
  stairs(matId: string, x: number, z: number, y0: number, y1: number, len: number, width: number, dir: 'n' | 's' | 'e' | 'w'): void {
    const rise = y1 - y0;
    const steps = Math.max(2, Math.round(Math.abs(rise) / 0.18));
    const sh = rise / steps;
    const sd = len / steps;
    for (let i = 0; i < steps; i++) {
      const top = y0 + sh * (i + 1);
      const along = sd * (i + 0.5);
      const g = new THREE.BoxGeometry(dir === 'n' || dir === 's' ? width : sd, top - y0, dir === 'n' || dir === 's' ? sd : width);
      let cx = x;
      let cz = z;
      if (dir === 'n') cz = z - along;
      if (dir === 's') cz = z + along;
      if (dir === 'e') cx = x + along;
      if (dir === 'w') cx = x - along;
      g.translate(cx, y0 + (top - y0) / 2, cz);
      projectUV(g, this.mats.tileOf(matId));
      vcolor(g, (_px, py) => (py > top - 0.01 ? 1 : 0.7));
      this.pushGeo(this.mats.arch(matId), g);
    }
    // ramp collider
    const axis: 'x' | 'z' = dir === 'n' || dir === 's' ? 'z' : 'x';
    const rdir: 1 | -1 = dir === 's' || dir === 'e' ? 1 : -1;
    let minX: number, maxX: number, minZ: number, maxZ: number;
    if (axis === 'z') {
      minX = x - width / 2;
      maxX = x + width / 2;
      minZ = dir === 's' ? z : z - len;
      maxZ = dir === 's' ? z + len : z;
    } else {
      minZ = z - width / 2;
      maxZ = z + width / 2;
      minX = dir === 'e' ? x : x - len;
      maxX = dir === 'e' ? x + len : x;
    }
    this.collider(minX, y0, minZ, maxX, y1, maxZ, { ramp: { axis, dir: rdir }, tag: 'surf:' + surfaceFor(matId) });
  }

  /** Railing along a polyline. */
  railing(points: Array<[number, number]>, y: number, h = 1.0, mat = 'metal_yellow', collide = true): void {
    const mm = this.mats.arch(mat);
    for (let i = 0; i < points.length - 1; i++) {
      const [ax, az] = points[i];
      const [bx, bz] = points[i + 1];
      const len = Math.hypot(bx - ax, bz - az);
      const ang = Math.atan2(bz - az, bx - ax);
      for (const hh of [h, h * 0.5]) {
        const g = new THREE.CylinderGeometry(0.025, 0.025, len, 8);
        g.rotateZ(Math.PI / 2);
        g.rotateY(-ang);
        g.translate((ax + bx) / 2, y + hh, (az + bz) / 2);
        projectUV(g, 0.5);
        vcolor(g, 1);
        this.pushGeo(mm, g);
      }
      const posts = Math.max(1, Math.ceil(len / 1.5));
      for (let k = 0; k <= posts; k++) {
        const t = k / posts;
        const g = new THREE.CylinderGeometry(0.03, 0.03, h, 8);
        g.translate(ax + (bx - ax) * t, y + h / 2, az + (bz - az) * t);
        projectUV(g, 0.5);
        vcolor(g, 1);
        this.pushGeo(mm, g);
      }
      if (collide) {
        const hx = Math.max(0.05, Math.abs(bx - ax) / 2);
        const hz = Math.max(0.05, Math.abs(bz - az) / 2);
        this.collider((ax + bx) / 2 - hx, y, (az + bz) / 2 - hz, (ax + bx) / 2 + hx, y + h, (az + bz) / 2 + hz, { opaque: false });
      }
    }
  }

  // ----------------------------------------------------------------- props

  /**
   * Places a prop. Static props are baked into the batch (cheap); dynamic
   * props stay as live objects (returned). Collider defaults to the
   * world-space bounding box.
   */
  prop(
    obj: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    ry = 0,
    opts: { static?: boolean; collide?: boolean | 'tight'; opaque?: boolean; scale?: number; name?: string; blocks?: 'all' | 'player' | 'ai'; shrink?: number; cell?: string } = {},
  ): THREE.Object3D {
    obj.position.set(x, y, z);
    obj.rotation.y = ry;
    if (opts.scale) obj.scale.setScalar(opts.scale);
    obj.updateMatrixWorld(true);
    if (opts.collide !== false) {
      const custom = obj.userData.colliders as Array<[number, number, number, number, number, number]> | undefined;
      if (custom) {
        for (const [cx, cy, cz, hx, hy, hz] of custom) {
          const p = new THREE.Vector3(cx, cy, cz).applyMatrix4(obj.matrixWorld);
          const c = Math.abs(Math.cos(ry));
          const s = Math.abs(Math.sin(ry));
          const sc = opts.scale ?? 1;
          const ex = (hx * c + hz * s) * sc;
          const ez = (hx * s + hz * c) * sc;
          this.collider(p.x - ex, p.y - hy * sc, p.z - ez, p.x + ex, p.y + hy * sc, p.z + ez, { opaque: opts.opaque ?? false, blocks: opts.blocks });
        }
      } else {
        const bb = new THREE.Box3().setFromObject(obj);
        const sh = opts.shrink ?? 0.02;
        if (bb.max.x - bb.min.x > 0.05 && bb.max.z - bb.min.z > 0.05)
          this.collider(bb.min.x + sh, bb.min.y, bb.min.z + sh, bb.max.x - sh, bb.max.y, bb.max.z - sh, { opaque: opts.opaque ?? false, blocks: opts.blocks });
      }
    }
    if (opts.static !== false && !obj.userData.dynamic) {
      bakeByMaterial(obj, this.batchFor(opts.cell ?? this.currentCell));
      return obj;
    }
    if (opts.name) this.zone.named.set(opts.name, obj);
    this.addDynamic(obj, opts.cell);
    return obj;
  }

  /** Adds a live (non-batched) object to the zone scene graph. */
  addDynamic(obj: THREE.Object3D, cell = this.currentCell): THREE.Object3D {
    this.zone.root.add(obj);
    obj.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        if (m.castShadow === undefined) m.castShadow = true;
        m.receiveShadow = true;
      }
    });
    if (cell) this.dynamicByCell.push([cell, obj]);
    return obj;
  }

  private dynamicByCell: Array<[string, THREE.Object3D]> = [];

  /** Flat decal (poster, stain, sign) placed against a surface. */
  decal(mat: THREE.Material, x: number, y: number, z: number, w: number, h: number, normal: Side | 'up' | 'down', opts: { rot?: number; offset?: number } = {}): THREE.Mesh {
    const g = new THREE.PlaneGeometry(w, h);
    const mesh = new THREE.Mesh(g, mat);
    const off = opts.offset ?? 0.012;
    switch (normal) {
      case 'n':
        mesh.position.set(x, y, z + off);
        break;
      case 's':
        mesh.rotation.y = Math.PI;
        mesh.position.set(x, y, z - off);
        break;
      case 'w':
        mesh.rotation.y = Math.PI / 2;
        mesh.position.set(x + off, y, z);
        break;
      case 'e':
        mesh.rotation.y = -Math.PI / 2;
        mesh.position.set(x - off, y, z);
        break;
      case 'up':
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(x, y + off, z);
        break;
      case 'down':
        mesh.rotation.x = Math.PI / 2;
        mesh.position.set(x, y - off, z);
        break;
    }
    if (opts.rot) mesh.rotateZ(opts.rot);
    mesh.receiveShadow = true;
    mesh.renderOrder = 1;
    this.addDynamic(mesh);
    return mesh;
  }

  // ---------------------------------------------------------------- lights

  light(
    x: number,
    y: number,
    z: number,
    opts: { color?: number | string; intensity?: number; distance?: number; flicker?: FlickerMode; emissives?: THREE.MeshStandardMaterial[]; emissiveBase?: number; on?: boolean; priority?: number; cell?: string } = {},
  ): VLight {
    const v = new VLight();
    v.position.set(x, y, z);
    v.color.set(opts.color ?? 0xfff1dc);
    v.intensity = opts.intensity ?? 6;
    v.distance = opts.distance ?? 9;
    v.flicker = opts.flicker ?? 'none';
    v.emissives = opts.emissives ?? [];
    v.emissiveBase = opts.emissiveBase ?? 2;
    v.priority = opts.priority ?? 1;
    v.cell = opts.cell ?? this.currentCell;
    v.setOn(opts.on ?? true, true);
    this.ctx.lights.add(v);
    this.zone.disposers.push(() => this.ctx.lights.remove(v));
    return v;
  }

  spot(x: number, y: number, z: number, tx: number, ty: number, tz: number, opts: { color?: number | string; intensity?: number; distance?: number; angle?: number; penumbra?: number; flicker?: FlickerMode; on?: boolean; priority?: number } = {}): VLight {
    const v = this.light(x, y, z, opts);
    v.spot = true;
    v.targetPos.set(tx, ty, tz);
    v.angle = opts.angle ?? 0.5;
    v.penumbra = opts.penumbra ?? 0.5;
    return v;
  }

  // -------------------------------------------------------------- gameplay

  spawn(id: string, x: number, y: number, z: number, yaw = 0): void {
    this.zone.spawns[id] = { pos: new THREE.Vector3(x, y, z), yaw };
  }

  trigger(id: string, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, opts: Partial<Trigger> = {}): Trigger {
    const t: Trigger = {
      id,
      min: new THREE.Vector3(Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1)),
      max: new THREE.Vector3(Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1)),
      once: true,
      fired: false,
      inside: false,
      enabled: true,
      ...opts,
    };
    this.zone.triggers.push(t);
    return t;
  }

  sound(name: string, x: number, y: number, z: number, volume = 0.5, opts: { ref?: number; rate?: number; when?: () => boolean } = {}): void {
    this.zone.emitters.push({ name, pos: new THREE.Vector3(x, y, z), volume, ...opts });
  }

  update(fn: (dt: number) => void): void {
    this.zone.updaters.push(fn);
  }

  // ---------------------------------------------------------------- finish

  finish(): Zone {
    for (const r of this.rooms.values()) this.buildRoom(r);
    const z = this.zone;
    // merge static batches per cell
    const cellMeshes = new Map<string, THREE.Object3D[]>();
    for (const [cell, mats] of this.batches) {
      for (const [mat, list] of mats) {
        const g = merge(list);
        if (!g) continue;
        g.computeBoundingSphere();
        g.computeBoundingBox();
        const mesh = new THREE.Mesh(g, mat);
        mesh.receiveShadow = true;
        mesh.castShadow = !(mat as THREE.Material).transparent;
        mesh.matrixAutoUpdate = false;
        mesh.name = `batch:${cell}:${mat.name}`;
        z.root.add(mesh);
        if (cell) {
          let l = cellMeshes.get(cell);
          if (!l) cellMeshes.set(cell, (l = []));
          l.push(mesh);
        }
      }
    }
    for (const [cell, obj] of this.dynamicByCell) {
      let l = cellMeshes.get(cell);
      if (!l) cellMeshes.set(cell, (l = []));
      l.push(obj);
    }
    for (const d of this.cellDefs) {
      const c: Cell = { id: d.id, min: d.min, max: d.max, pvs: new Set(d.pvs), objects: cellMeshes.get(d.id) ?? [] };
      z.cells.push(c);
    }
    // pvs symmetric closure is left to the author; colliders are tracked for disposal
    const world = this.ctx.world;
    const cols = [...this.colliders];
    z.disposers.push(() => {
      for (const c of cols) world.remove(c);
    });
    z.bounds.makeEmpty();
    for (const c of cols) {
      z.bounds.expandByPoint(new THREE.Vector3(c.min.x, c.min.y, c.min.z));
      z.bounds.expandByPoint(new THREE.Vector3(c.max.x, c.max.y, c.max.z));
    }
    return z;
  }
}

function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}
