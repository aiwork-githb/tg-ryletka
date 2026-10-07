import * as THREE from 'three';
import type { Game } from '../Game';
import type { LevelBuilder } from './LevelBuilder';
import type { Interactable } from '../interaction/Interaction';
import type { Collider } from '../physics/CollisionWorld';
import type { DoorLike, HideLike } from '../ai/Verity';
import type { HideSpot } from '../player/Player';
import { box, cyl, extrude, ModelBuilder, rbox, roundedRectShape, sphere } from './geom';
import * as FX from '../models/fixtures';
import { ITEMS } from '../narrative/registry';
import type { FlickerMode, VLight } from '../render/LightManager';
import { looseSheet, clipboard, locker } from '../models/furniture';

// ============================================================== doors

export type DoorStyle = 'wood' | 'metal' | 'glass' | 'security' | 'kids' | 'office' | 'service';

export interface DoorOpts {
  id: string;
  x: number;
  y?: number;
  z: number;
  /** Axis the doorway wall runs along. 'x' → door faces ±z. */
  axis: 'x' | 'z';
  width?: number;
  height?: number;
  style?: DoorStyle;
  /** Returns a reason string if locked, null if usable. */
  lock?: () => string | null;
  /** Item that unlocks it (consumed=false). */
  key?: string;
  open?: boolean;
  aiPassable?: boolean;
  swing?: 1 | -1;
  hingeLeft?: boolean;
  onOpen?: () => void;
  /** Player can't close it again (keeps flow simple). */
  stayOpen?: boolean;
  frameColor?: string;
  color?: string;
  label?: string;
}

export class Door implements DoorLike {
  readonly pos: THREE.Vector3;
  isOpen = false;
  locked = false;
  aiPassable: boolean;
  readonly group = new THREE.Group();
  private leaf = new THREE.Group();
  private angle = 0;
  private target = 0;
  private collider: Collider;
  interactable: Interactable;
  private slide: boolean;

  constructor(
    private g: Game,
    b: LevelBuilder,
    readonly o: DoorOpts,
  ) {
    const w = o.width ?? 1.0;
    const h = o.height ?? 2.15;
    const y = o.y ?? 0;
    this.pos = new THREE.Vector3(o.x, y, o.z);
    this.aiPassable = o.aiPassable ?? true;
    this.slide = o.style === 'security';
    const m = g.mats;
    const style = o.style ?? 'wood';
    // frame
    const fb = new ModelBuilder();
    const frameMat = style === 'wood' || style === 'kids' ? m.woodProp(o.frameColor ?? '#5a3a22', 0.5) : m.painted(o.frameColor ?? '#4a5254', 0.5);
    const ft = 0.07;
    const fd = 0.26;
    fb.add(box(ft, h + ft, fd), frameMat, -w / 2 - ft / 2, h / 2 + ft / 2, 0);
    fb.add(box(ft, h + ft, fd), frameMat, w / 2 + ft / 2, h / 2 + ft / 2, 0);
    fb.add(box(w + ft * 2, ft, fd), frameMat, 0, h + ft / 2, 0);
    if (o.label) {
      const lab = FX.signPanel(m, o.label, { w: 512, h: 112, bg: style === 'kids' ? '#2fa79b' : '#22313a', font: style === 'kids' ? 'brand' : 'ui', width: Math.min(0.9, w) });
      lab.position.set(0, h + 0.25, fd / 2);
      fb.group.add(lab);
      const lab2 = lab.clone();
      lab2.position.z = -fd / 2;
      lab2.rotation.y = Math.PI;
      fb.group.add(lab2);
    }
    this.group.add(fb.group);
    // leaf
    this.group.add(this.leaf);
    const leafMesh = this.buildLeaf(style, w - 0.02, h - 0.02);
    if (this.slide) {
      leafMesh.position.set(0, (h - 0.02) / 2, 0);
    } else {
      const hingeX = o.hingeLeft === false ? w / 2 : -w / 2;
      this.leaf.position.set(hingeX, 0, 0);
      leafMesh.position.set(-hingeX, (h - 0.02) / 2, 0);
    }
    this.leaf.add(leafMesh);
    this.group.position.set(o.x, y, o.z);
    if (o.axis === 'z') this.group.rotation.y = Math.PI / 2;
    b.addDynamic(this.group);
    // collider across the doorway
    const hx = o.axis === 'x' ? w / 2 : 0.07;
    const hz = o.axis === 'x' ? 0.07 : w / 2;
    this.collider = b.collider(o.x - hx, y, o.z - hz, o.x + hx, y + h, o.z + hz, { tag: 'door', opaque: true });
    // interaction
    this.interactable = g.interact.add({
      id: 'door:' + o.id,
      object: leafMesh,
      kind: 'door',
      prompt: () => {
        if (this.isOpen && o.stayOpen) return null;
        const reason = this.lockReason();
        if (reason) return reason;
        return this.isOpen ? 'Закрыть' : 'Открыть';
      },
      onUse: () => this.use(),
    });
    // initial state
    const open = o.open || g.state.is('door.' + o.id);
    if (open) this.setOpen(true, true);
    this.refreshLock();
    g.verity.doors.push(this);
    b.update((dt) => this.update(dt));
  }

  private buildLeaf(style: DoorStyle, w: number, h: number): THREE.Object3D {
    const m = this.g.mats;
    const b = new ModelBuilder();
    const t = 0.05;
    switch (style) {
      case 'wood': {
        const wood = m.woodProp(this.o.color ?? '#6e4527', 0.5);
        b.add(box(w, h, t), wood);
        for (const [py, ph] of [
          [h * 0.22, h * 0.32],
          [-h * 0.2, h * 0.42],
        ]) {
          b.add(rbox(w * 0.7, ph, 0.012, 0.004), m.woodProp('#5d3a20', 0.5), 0, py, t / 2 + 0.004);
          b.add(rbox(w * 0.7, ph, 0.012, 0.004), m.woodProp('#5d3a20', 0.5), 0, py, -t / 2 - 0.004);
        }
        this.handles(b, w, t, '#b08d57');
        break;
      }
      case 'office':
      case 'metal':
      case 'service': {
        const mat = m.painted(this.o.color ?? (style === 'service' ? '#6c7a6e' : '#4f6d7a'), style === 'service' ? 0.7 : 0.45);
        b.add(box(w, h, t), mat);
        if (style !== 'service') {
          b.add(box(0.28, 0.5, t + 0.01), new THREE.MeshPhysicalMaterial({ color: 0x9db3b8, transparent: true, opacity: 0.35, roughness: 0.2 }), 0, h * 0.18, 0);
          b.add(box(0.32, 0.54, t + 0.004), m.steel('#8a8f92', 0.4), 0, h * 0.18, 0).scale.set(1, 1, 0.5);
        }
        // push bar
        b.add(cyl(0.018, 0.018, w * 0.7, 8), m.steel('#b5b9bc', 0.3), 0, -0.05, t / 2 + 0.05, 0, 0, Math.PI / 2);
        for (const x of [-w * 0.35, w * 0.35]) b.add(box(0.04, 0.06, 0.06), m.steel('#9a9ea1', 0.3), x, -0.05, t / 2 + 0.03);
        b.add(box(0.03, 0.15, 0.03), m.steel('#b5b9bc', 0.3), w / 2 - 0.08, 0, -t / 2 - 0.02);
        b.add(box(w, 0.12, t + 0.004), m.steel('#8d9194', 0.6), 0, -h / 2 + 0.06, 0);
        break;
      }
      case 'glass': {
        const al = m.steel('#9ea4a8', 0.3);
        b.add(box(w, 0.1, t), al, 0, h / 2 - 0.05, 0);
        b.add(box(w, 0.2, t), al, 0, -h / 2 + 0.1, 0);
        b.add(box(0.08, h, t), al, -w / 2 + 0.04, 0, 0);
        b.add(box(0.08, h, t), al, w / 2 - 0.04, 0, 0);
        b.add(box(w - 0.16, h - 0.3, 0.012), m.get('glass_dirty'), 0, 0.05, 0);
        b.add(cyl(0.015, 0.015, 0.6, 8), m.steel('#c9cdd1', 0.2), w / 2 - 0.15, 0, t / 2 + 0.05);
        b.add(cyl(0.015, 0.015, 0.6, 8), m.steel('#c9cdd1', 0.2), w / 2 - 0.15, 0, -t / 2 - 0.05);
        break;
      }
      case 'security': {
        const mat = m.painted(this.o.color ?? '#5a6064', 0.55);
        b.add(box(w, h, 0.12), mat);
        // hazard stripes band
        const c = document.createElement('canvas');
        c.width = 512;
        c.height = 64;
        const gx = c.getContext('2d')!;
        gx.fillStyle = '#f1c40f';
        gx.fillRect(0, 0, 512, 64);
        gx.fillStyle = '#111';
        for (let i = -2; i < 20; i++) {
          gx.beginPath();
          gx.moveTo(i * 32, 64);
          gx.lineTo(i * 32 + 16, 64);
          gx.lineTo(i * 32 + 48, 0);
          gx.lineTo(i * 32 + 32, 0);
          gx.fill();
        }
        const stripe = m.canvasMaterial(c, { rough: 0.6 });
        for (const z of [0.061, -0.061]) {
          const s = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.18), stripe);
          s.position.set(0, -h / 2 + 0.25, z);
          if (z < 0) s.rotation.y = Math.PI;
          b.group.add(s);
        }
        for (let i = 0; i < 4; i++) b.add(box(w * 0.9, 0.03, 0.13), m.steel('#7a7f82', 0.6), 0, -h / 2 + 0.6 + i * 0.4, 0);
        break;
      }
      case 'kids': {
        const shape = roundedRectShape(w, h, w * 0.45);
        const hole = new THREE.Path();
        hole.absarc(0, h * 0.18, w * 0.16, 0, Math.PI * 2, true);
        shape.holes.push(hole);
        b.add(extrude(shape, t, 0.01, 0.5), m.plastic(this.o.color ?? '#5fb7ad', 0.5));
        b.add(new THREE.CircleGeometry(w * 0.16, 24), new THREE.MeshPhysicalMaterial({ color: 0xfff1b8, transparent: true, opacity: 0.4, roughness: 0.1 }), 0, h * 0.18, 0);
        this.handles(b, w, t, '#f4d35e');
        break;
      }
    }
    return b.group;
  }

  private handles(b: ModelBuilder, w: number, t: number, color: string): void {
    const brass = this.g.mats.steel(color, 0.4);
    for (const z of [t / 2 + 0.04, -t / 2 - 0.04]) {
      b.add(sphere(0.03, 10, 8), brass, w / 2 - 0.09, -0.05, z);
      b.add(cyl(0.008, 0.008, 0.05, 6), brass, w / 2 - 0.09, -0.05, z * 0.7, Math.PI / 2);
    }
  }

  lockReason(): string | null {
    if (this.o.key && !this.g.state.has(this.o.key) && !this.g.state.is('unlocked.' + this.o.id)) return 'Заперто';
    const r = this.o.lock?.() ?? null;
    return r;
  }

  refreshLock(): void {
    const wasLocked = this.locked;
    this.locked = !this.isOpen && this.lockReason() !== null;
    this.updateCollider();
    if (wasLocked !== this.locked) this.refreshNav();
  }

  private refreshNav(): void {
    const nav = this.g.zone?.nav;
    if (nav) nav.refresh({ minX: this.pos.x - 1.5, minZ: this.pos.z - 1.5, maxX: this.pos.x + 1.5, maxZ: this.pos.z + 1.5 });
  }

  private updateCollider(): void {
    this.collider.enabled = !this.isOpen;
    this.collider.blocks = this.locked || !this.aiPassable ? 'all' : 'player';
  }

  use(): void {
    const reason = this.lockReason();
    if (reason) {
      this.g.audio.play('door_open', { pos: this.pos, volume: 0.4, rate: 1.4 });
      this.g.notify(reason);
      return;
    }
    if (this.o.key && !this.g.state.is('unlocked.' + this.o.id)) {
      this.g.state.set('unlocked.' + this.o.id);
      this.g.audio.play('lock_open', { pos: this.pos });
    }
    this.setOpen(!this.isOpen);
  }

  open(byAI = false): void {
    if (this.isOpen) return;
    this.setOpen(true);
    if (byAI) {
      this.g.audio.play(this.o.style === 'wood' || this.o.style === 'kids' ? 'door_close' : 'metal_slam', { pos: this.pos, volume: 0.9 });
      this.g.player.addTrauma(0.15);
    }
  }

  close(): void {
    if (!this.isOpen) return;
    this.setOpen(false);
  }

  setOpen(open: boolean, instant = false): void {
    this.isOpen = open;
    this.g.state.set('door.' + this.o.id, open);
    // swing away from the player
    let swing = this.o.swing ?? 1;
    if (!this.o.swing && !instant) {
      const local = this.group.worldToLocal(this.g.player.pos.clone());
      swing = local.z > 0 ? -1 : 1;
    }
    this.target = open ? (this.slide ? 1 : swing * 1.65) : 0;
    if (instant) this.angle = this.target;
    this.updateCollider();
    this.refreshNav();
    if (!instant) {
      const st = this.o.style ?? 'wood';
      if (st === 'security') this.g.audio.play('shutter', { pos: this.pos, volume: 0.8 });
      else if (st === 'metal' || st === 'service' || st === 'office') this.g.audio.play(open ? 'metal_door_open' : 'door_close', { pos: this.pos, volume: 0.7 });
      else {
        this.g.audio.play(open ? 'door_open' : 'door_close', { pos: this.pos, volume: 0.7 });
        if (open && Math.random() < 0.6) this.g.audio.play('door_creak', { pos: this.pos, volume: 0.45, rateJitter: 0.1 });
      }
      if (open) this.o.onOpen?.();
    }
    this.locked = !open && this.lockReason() !== null;
  }

  update(dt: number): void {
    const k = Math.min(1, dt * (this.slide ? 1.2 : 3.2));
    this.angle += (this.target - this.angle) * k;
    if (this.slide) this.leaf.position.x = this.angle * ((this.o.width ?? 1) * 0.98);
    else this.leaf.rotation.y = this.angle;
  }
}

// ============================================================== lamps

export type LampKind = 'troffer' | 'pendant' | 'cage' | 'emergency' | 'sconce' | 'stage' | 'exit' | 'bare';

export function lamp(
  g: Game,
  b: LevelBuilder,
  kind: LampKind,
  x: number,
  y: number,
  z: number,
  opts: { ry?: number; color?: string; intensity?: number; distance?: number; flicker?: FlickerMode; on?: boolean; drop?: number; cell?: string; priority?: number } = {},
): VLight {
  const m = g.mats;
  let model: FX.LampModel;
  const color = opts.color;
  switch (kind) {
    case 'troffer':
      model = FX.troffer(m, 1.2, color ?? '#eef4ff');
      break;
    case 'pendant':
      model = FX.pendant(m, opts.drop ?? 1, color ?? '#ffd9a0');
      break;
    case 'cage':
      model = FX.cageLamp(m, color ?? '#ffcf8a');
      break;
    case 'emergency':
      model = FX.emergencyLight(m);
      break;
    case 'sconce':
      model = FX.sconce(m, color ?? '#ffd8a0');
      break;
    case 'stage':
      model = FX.stageSpot(m, color ?? '#fff2d0');
      break;
    case 'exit':
      model = FX.exitSign(m);
      break;
    default: {
      const mb = new ModelBuilder();
      const bulb = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: new THREE.Color(color ?? '#ffd59a'), emissiveIntensity: 3 });
      mb.add(cyl(0.004, 0.004, opts.drop ?? 0.6, 4), m.rubber('#111'), 0, -(opts.drop ?? 0.6) / 2, 0);
      mb.add(sphere(0.045, 12, 10), bulb, 0, -(opts.drop ?? 0.6) - 0.05, 0);
      model = { group: mb.group, bulb, lightOffset: new THREE.Vector3(0, -(opts.drop ?? 0.6) - 0.15, 0) };
    }
  }
  model.group.rotation.y = opts.ry ?? 0;
  b.prop(model.group, x, y, z, opts.ry ?? 0, { collide: false, static: false, cell: opts.cell });
  model.group.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh && mesh.material === model.bulb) mesh.castShadow = false;
  });
  const lp = model.lightOffset.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), opts.ry ?? 0).add(new THREE.Vector3(x, y, z));
  const defaults: Record<LampKind, [string, number, number]> = {
    troffer: ['#e6eeff', 5, 8],
    pendant: ['#ffd9a0', 7, 9],
    cage: ['#ffcf8a', 3.5, 6],
    emergency: ['#ff2a1a', 4, 7],
    sconce: ['#ffcf9a', 3, 5],
    stage: ['#fff2d0', 12, 12],
    exit: ['#3aff7a', 0.8, 2.5],
    bare: ['#ffd59a', 3, 6],
  };
  const [dc, di, dd] = defaults[kind];
  return b.light(lp.x, lp.y, lp.z, {
    color: color ?? dc,
    intensity: opts.intensity ?? di,
    distance: opts.distance ?? dd,
    flicker: opts.flicker,
    emissives: [model.bulb],
    emissiveBase: model.bulb.emissiveIntensity,
    on: opts.on,
    cell: opts.cell,
    priority: opts.priority,
  });
}

// ========================================================== interactables

export function usable(
  g: Game,
  b: LevelBuilder,
  obj: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  ry: number,
  i: Omit<Interactable, 'object'>,
  opts: { collide?: boolean; static?: boolean } = {},
): Interactable {
  b.prop(obj, x, y, z, ry, { collide: opts.collide ?? false, static: false });
  return g.interact.add({ ...i, object: obj });
}

/** Item pickup (disappears once taken). */
export function pickup(g: Game, b: LevelBuilder, item: string, x: number, y: number, z: number, ry = 0, onTake?: () => void): void {
  if (g.state.has(item) || g.state.is('picked.' + item)) return;
  const def = ITEMS[item];
  if (!def) throw new Error('no item ' + item);
  const obj = def.model(g.mats);
  b.prop(obj, x, y, z, ry, { collide: false, static: false });
  const it = g.interact.add({
    id: 'pickup:' + item,
    object: obj,
    kind: 'pickup',
    prompt: () => `Взять: ${def.name}`,
    onUse: () => {
      g.giveItem(item);
      g.state.set('picked.' + item);
      obj.visible = false;
      it.enabled = false;
      onTake?.();
    },
  });
}

/** A readable document lying somewhere. */
export function documentProp(g: Game, b: LevelBuilder, doc: string, x: number, y: number, z: number, ry = 0, kind: 'sheet' | 'clipboard' | 'none' = 'sheet', obj?: THREE.Object3D): Interactable {
  const model = obj ?? (kind === 'clipboard' ? clipboard(g.mats) : kind === 'sheet' ? looseSheet(g.mats, doc.length) : new THREE.Group());
  b.prop(model, x, y, z, ry, { collide: false, static: false });
  // make sure there is something to hit
  if (kind === 'none' && !obj) {
    const hit = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.3), new THREE.MeshBasicMaterial({ visible: false }));
    model.add(hit);
  }
  const read = () => g.state.data.docs.includes(doc);
  return g.interact.add({
    id: 'doc:' + doc,
    object: model,
    kind: 'read',
    prompt: () => (read() ? 'Перечитать' : 'Читать'),
    onUse: () => g.readDoc(doc),
  });
}

/** Portable cassette recorder that plays an audio log. */
export function tapePlayer(g: Game, b: LevelBuilder, log: string, x: number, y: number, z: number, ry = 0): Interactable {
  const mb = new ModelBuilder();
  const m = g.mats;
  mb.add(rbox(0.28, 0.08, 0.16, 0.012), m.plastic('#2d2d30', 0.5), 0, 0.04, 0);
  mb.add(box(0.12, 0.035, 0.07), new THREE.MeshPhysicalMaterial({ color: 0x334, transparent: true, opacity: 0.5, roughness: 0.1 }), -0.05, 0.08, 0.02);
  mb.add(box(0.1, 0.002, 0.06), m.flat('#f1e7c8', 1, 0), -0.05, 0.068, 0.02);
  for (let i = 0; i < 5; i++) mb.add(box(0.022, 0.015, 0.03), m.plastic(i === 1 ? '#c0392b' : '#bbbbbb', 0.4), 0.05 + i * 0.022, 0.085, -0.04);
  const grille = mb.add(cyl(0.035, 0.035, 0.005, 16), m.steel('#777', 0.4), 0.07, 0.06, 0.081, Math.PI / 2);
  void grille;
  const led = new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff2010, emissiveIntensity: 1.5 });
  mb.add(sphere(0.006, 6, 4), led, 0.12, 0.085, 0.05);
  b.prop(mb.group, x, y, z, ry, { collide: false, static: false });
  const heard = () => g.state.data.logs.includes(log);
  return g.interact.add({
    id: 'log:' + log,
    object: mb.group,
    kind: 'listen',
    prompt: () => (heard() ? 'Прослушать снова' : 'Прослушать запись'),
    onUse: () => g.playLog(log),
  });
}

/** Look at something: a thought appears as a subtitle. Optional secret. */
export function inspect(g: Game, b: LevelBuilder, obj: THREE.Object3D | null, x: number, y: number, z: number, thought: string | (() => string), opts: { prompt?: string; secret?: string; size?: number; once?: () => void; ry?: number } = {}): Interactable {
  let o = obj;
  if (!o) {
    const s = opts.size ?? 0.4;
    o = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), new THREE.MeshBasicMaterial({ visible: false }));
    (o as THREE.Mesh).userData.noBatch = true;
  }
  b.prop(o, x, y, z, opts.ry ?? 0, { collide: false, static: false });
  let first = true;
  return g.interact.add({
    id: 'inspect:' + x.toFixed(1) + ',' + z.toFixed(1),
    object: o,
    kind: 'look',
    prompt: () => opts.prompt ?? 'Осмотреть',
    onUse: () => {
      const t = typeof thought === 'function' ? thought() : thought;
      g.ui.hud.subtitle(t, Math.max(3, t.length / 14));
      if (opts.secret) g.secret(opts.secret);
      if (first) {
        first = false;
        opts.once?.();
      }
    },
  });
}

/** Hide spot: locker. Player enters and peeks through the vents. */
export function hideLocker(g: Game, b: LevelBuilder, id: string, x: number, y: number, z: number, ry: number, color = '#5f7a80'): HideLike {
  const model = locker(g.mats, color, true);
  b.prop(model, x, y, z, ry, { static: false });
  const doorPivot = model.userData.door as THREE.Object3D;
  const fwd = new THREE.Vector3(Math.sin(ry), 0, Math.cos(ry));
  const spot: HideSpot = {
    id,
    eye: new THREE.Vector3(x, y + 1.58, z).addScaledVector(fwd, 0.05),
    yaw: ry + Math.PI, // camera looks out of the locker (towards +fwd)
    yawRange: 0.35,
    pitchRange: 0.25,
    exit: new THREE.Vector3(x, y, z).addScaledVector(fwd, 0.75),
  };
  // camera yaw convention: forward = (-sin(yaw), -cos(yaw)); we need forward = fwd
  spot.yaw = Math.atan2(-fwd.x, -fwd.z);
  return hideSpot(g, b, model, spot, doorPivot);
}

export function hideSpot(g: Game, _b: LevelBuilder, obj: THREE.Object3D, spot: HideSpot, doorPivot?: THREE.Object3D): HideLike {
  const hl: HideLike = { id: spot.id, pos: spot.exit.clone(), occupied: false };
  let anim = 0;
  let target = 0;
  g.interact.add({
    id: 'hide:' + spot.id,
    object: obj,
    kind: 'hide',
    prompt: () => (g.player.hidden ? null : 'Спрятаться'),
    onUse: () => {
      if (g.player.hidden) return;
      g.carry.drop(true);
      target = 1;
      g.audio.play('metal_door_open', { pos: spot.exit, volume: 0.35, rate: 1.4 });
      setTimeout(() => {
        g.player.enterHide(spot);
        hl.occupied = true;
        g.audio.setMuffle(true, 2500);
        target = 0;
        g.audio.play('door_close', { pos: spot.exit, volume: 0.3, rate: 1.3 });
      }, 220);
    },
  });
  g.verity.hides.push(hl);
  _b.update((dt) => {
    anim += (target - anim) * Math.min(1, dt * 10);
    if (doorPivot) doorPivot.rotation.y = -anim * 1.4;
    if (hl.occupied && g.player.hidden?.id === spot.id && g.input.pressed('interact')) {
      target = 1;
      g.audio.play('metal_door_open', { pos: spot.exit, volume: 0.35, rate: 1.4 });
      g.player.exitHide();
      hl.occupied = false;
      g.audio.setMuffle(false);
      setTimeout(() => (target = 0), 400);
    }
  });
  return hl;
}

/** Physical object the player can pick up and throw (noise distraction). */
export function throwable(g: Game, b: LevelBuilder, obj: THREE.Object3D, name: string, x: number, y: number, z: number, impact = 'impact_soft', noise = 14): void {
  b.prop(obj, x, y, z, Math.random() * 6, { collide: false, static: false });
  const c = { obj, name, kind: 'throwable', impact, noise, radius: 0.08 } as import('../player/Carry').Carriable;
  c.interactable = g.interact.add({
    id: 'throw:' + name + x.toFixed(1),
    object: obj,
    kind: 'pickup',
    prompt: () => (g.carry.holding ? null : `Взять: ${name}`),
    onUse: () => g.carry.pick(c),
  });
}

/** FriendLink star receiver – reacts to the bracelet signal. */
export function starReceiver(g: Game, b: LevelBuilder, x: number, y: number, z: number, ry: number, onSignal: () => void, opts: { id: string; active?: () => boolean } ): { mat: THREE.MeshStandardMaterial; group: THREE.Group } {
  const mb = new ModelBuilder();
  const m = g.mats;
  mb.add(cyl(0.16, 0.18, 0.06, 24), m.plastic('#2fa79b', 0.4), 0, 0, 0.03, Math.PI / 2);
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 0.05 : 0.12;
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  s.closePath();
  const mat = new THREE.MeshStandardMaterial({ color: 0xffe9a0, emissive: 0xffc93a, emissiveIntensity: 0.15, roughness: 0.3 });
  mb.add(extrude(s, 0.03, 0.006), mat, 0, 0, 0.075);
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.15, roughness: 0.05, clearcoat: 1 });
  mb.add(sphere(0.15, 20, 10), glass, 0, 0, 0.04).scale.set(1, 1, 0.4);
  b.prop(mb.group, x, y, z, ry, { collide: false, static: false });
  g.interact.add({
    id: 'star:' + opts.id,
    object: mb.group,
    kind: 'signal',
    signal: true,
    prompt: () => (opts.active && !opts.active() ? null : 'Подать сигнал браслетом'),
    onUse: () => {
      g.audio.play('keypad_ok', { pos: mb.group.position, volume: 0.6, rate: 0.8 });
      g.music.motif({ pos: mb.group.position, volume: 0.25 });
      mat.emissiveIntensity = 2.5;
      setTimeout(() => (mat.emissiveIntensity = 0.6), 700);
      onSignal();
    },
  });
  return { mat, group: mb.group };
}

/** Wall-mounted lever / switch with on/off state. */
export function lever(
  g: Game,
  b: LevelBuilder,
  x: number,
  y: number,
  z: number,
  ry: number,
  o: { id: string; prompt: (on: boolean) => string | null; get: () => boolean; set: (on: boolean) => void; style?: 'lever' | 'switch' | 'button'; color?: string; hold?: number },
): { handle: THREE.Object3D } {
  const m = g.mats;
  const mb = new ModelBuilder();
  const style = o.style ?? 'lever';
  const handle = new THREE.Group();
  if (style === 'lever') {
    mb.add(rbox(0.16, 0.3, 0.06, 0.01), m.painted('#3a3f42', 0.6), 0, 0, 0.03);
    handle.position.set(0, 0, 0.07);
    const arm = new THREE.Mesh(cyl(0.012, 0.012, 0.22, 8), m.steel('#9a9ea1', 0.4));
    arm.position.y = 0.11;
    const knob = new THREE.Mesh(sphere(0.03, 10, 8), m.plastic(o.color ?? '#c0392b', 0.3));
    knob.position.y = 0.22;
    handle.add(arm, knob);
  } else if (style === 'switch') {
    mb.add(rbox(0.09, 0.13, 0.025, 0.006), m.plastic('#e8e2d2', 0.5), 0, 0, 0.012);
    handle.position.set(0, 0, 0.03);
    const t = new THREE.Mesh(rbox(0.025, 0.05, 0.02, 0.004), m.plastic('#f2eadb', 0.4));
    handle.add(t);
  } else {
    mb.add(cyl(0.06, 0.06, 0.04, 16), m.painted('#3a3f42', 0.5), 0, 0, 0.02, Math.PI / 2);
    handle.position.set(0, 0, 0.045);
    const t = new THREE.Mesh(cyl(0.04, 0.04, 0.03, 16), m.plastic(o.color ?? '#c0392b', 0.3));
    t.rotation.x = Math.PI / 2;
    handle.add(t);
  }
  mb.group.add(handle);
  b.prop(mb.group, x, y, z, ry, { collide: false, static: false });
  const apply = (on: boolean) => {
    if (style === 'lever') handle.rotation.x = on ? -0.9 : 0.9;
    else if (style === 'switch') handle.rotation.x = on ? -0.35 : 0.35;
    else handle.position.z = on ? 0.035 : 0.045;
  };
  apply(o.get());
  g.interact.add({
    id: 'lever:' + o.id,
    object: mb.group,
    kind: 'use',
    hold: o.hold,
    prompt: () => o.prompt(o.get()),
    onUse: () => {
      const on = !o.get();
      g.audio.play(style === 'lever' ? 'breaker_on' : 'switch', { pos: mb.group.position, volume: style === 'lever' ? 0.6 : 0.5 });
      o.set(on);
      apply(o.get());
    },
  });
  b.update(() => apply(o.get()));
  return { handle };
}

export function noop(): void {}
