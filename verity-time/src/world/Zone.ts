import * as THREE from 'three';
import type { Sound } from '../audio/AudioEngine';
import type { NavGrid } from '../ai/NavGrid';

export interface Cell {
  id: string;
  min: THREE.Vector3;
  max: THREE.Vector3;
  /** Cells visible from inside this one (always includes itself). */
  pvs: Set<string>;
  objects: THREE.Object3D[];
}

export interface Trigger {
  id: string;
  min: THREE.Vector3;
  max: THREE.Vector3;
  once: boolean;
  fired: boolean;
  inside: boolean;
  enabled: boolean;
  onEnter?: () => void;
  onExit?: () => void;
  onStay?: (dt: number) => void;
  /** Only fires while this returns true. */
  when?: () => boolean;
}

export interface Spawn {
  pos: THREE.Vector3;
  yaw: number;
}

export interface EmitterDef {
  name: string;
  pos: THREE.Vector3;
  volume: number;
  ref?: number;
  rate?: number;
  /** Optional predicate re-evaluated each second to start/stop. */
  when?: () => boolean;
  sound?: Sound | null;
}

export interface ZoneEnv {
  fogColor: THREE.Color;
  fogDensity: number;
  ambient: THREE.Color;
  ambientIntensity: number;
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  hemiIntensity: number;
  reverb: string;
  ambience: string[];
  /** Image-based lighting preset (render/EnvMap.ts) and strength. */
  envMap: string;
  envIntensity: number;
}

/** Runtime representation of a built zone. */
export class Zone {
  readonly root = new THREE.Group();
  readonly cells: Cell[] = [];
  readonly triggers: Trigger[] = [];
  readonly spawns: Record<string, Spawn> = {};
  readonly updaters: Array<(dt: number) => void> = [];
  readonly emitters: EmitterDef[] = [];
  readonly disposers: Array<() => void> = [];
  readonly named = new Map<string, THREE.Object3D>();
  nav: NavGrid | null = null;
  env: ZoneEnv = {
    fogColor: new THREE.Color(0x050505),
    fogDensity: 0.04,
    ambient: new THREE.Color(0x404850),
    ambientIntensity: 0.25,
    hemiSky: new THREE.Color(0x6a7080),
    hemiGround: new THREE.Color(0x201a14),
    hemiIntensity: 0.25,
    reverb: 'room',
    ambience: ['room_loop'],
    envMap: 'hall',
    envIntensity: 0.35,
  };
  private currentCell: Cell | null = null;
  bounds = new THREE.Box3();
  /** Footstep surface for a collider tag. */
  surfaceOf(tag: string | undefined): string {
    if (!tag) return 'concrete';
    return tag.startsWith('surf:') ? tag.slice(5) : 'concrete';
  }

  constructor(
    public id: string,
    public name: string,
  ) {
    this.root.name = 'zone:' + id;
  }

  cellAt(p: THREE.Vector3): Cell | null {
    for (const c of this.cells) {
      if (p.x >= c.min.x && p.x <= c.max.x && p.z >= c.min.z && p.z <= c.max.z && p.y >= c.min.y && p.y <= c.max.y) return c;
    }
    return null;
  }

  /** Occlusion culling by cells/PVS. Returns the visible cell set or null (all). */
  updateCells(camPos: THREE.Vector3): Set<string> | null {
    if (!this.cells.length) return null;
    const c = this.cellAt(camPos) ?? this.currentCell;
    if (c === this.currentCell && c) return c.pvs;
    this.currentCell = c;
    for (const cell of this.cells) {
      const vis = !c || c.pvs.has(cell.id);
      for (const o of cell.objects) o.visible = vis;
    }
    return c ? c.pvs : null;
  }

  forceAllVisible(): void {
    this.currentCell = null;
    for (const cell of this.cells) for (const o of cell.objects) o.visible = true;
  }

  updateTriggers(p: THREE.Vector3, dt: number): void {
    for (const t of this.triggers) {
      if (!t.enabled || (t.once && t.fired)) continue;
      const inside = p.x >= t.min.x && p.x <= t.max.x && p.y >= t.min.y - 0.1 && p.y <= t.max.y && p.z >= t.min.z && p.z <= t.max.z;
      if (inside && !t.inside) {
        if (t.when && !t.when()) continue;
        t.inside = true;
        t.fired = true;
        t.onEnter?.();
      } else if (!inside && t.inside) {
        t.inside = false;
        t.onExit?.();
      } else if (inside && t.onStay) t.onStay(dt);
    }
  }

  trigger(id: string): Trigger | undefined {
    return this.triggers.find((t) => t.id === id);
  }

  dispose(): void {
    for (const d of this.disposers) {
      try {
        d();
      } catch (e) {
        console.warn(e);
      }
    }
    this.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.geometry && !m.geometry.userData.shared) m.geometry.dispose();
    });
    this.root.removeFromParent();
  }
}
