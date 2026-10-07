import * as THREE from 'three';
import type { CollisionWorld } from '../physics/CollisionWorld';

export type InteractKind = 'use' | 'pickup' | 'read' | 'door' | 'hide' | 'signal' | 'listen' | 'look';

export interface Interactable {
  id: string;
  /** Object(s) tested by the view ray. */
  object: THREE.Object3D;
  /** Prompt text, or null when not currently usable. */
  prompt: () => string | null;
  onUse: () => void;
  kind?: InteractKind;
  range?: number;
  /** Seconds the key must be held (valves, heavy levers). */
  hold?: number;
  enabled?: boolean;
  /** Only reacts to the FriendLink bracelet signal. */
  signal?: boolean;
  /** Optional: called every frame while targeted. */
  onFocus?: (focused: boolean) => void;
}

/**
 * Finds what the player is looking at and drives prompts / activation.
 */
export class InteractionSystem {
  readonly list: Interactable[] = [];
  focused: Interactable | null = null;
  holdProgress = 0;
  private ray = new THREE.Raycaster();
  private tmp = new THREE.Vector3();
  private center = new THREE.Vector2(0, 0);
  braceletOn = false;

  constructor(private world: CollisionWorld) {
    this.ray.near = 0.05;
  }

  add(i: Interactable): Interactable {
    i.enabled ??= true;
    this.list.push(i);
    i.object.traverse((o) => (o.userData.interactable = i));
    return i;
  }

  remove(i: Interactable): void {
    const k = this.list.indexOf(i);
    if (k >= 0) this.list.splice(k, 1);
    if (this.focused === i) this.focused = null;
  }

  clear(): void {
    this.list.length = 0;
    this.focused = null;
  }

  get(id: string): Interactable | undefined {
    return this.list.find((i) => i.id === id);
  }

  /**
   * @param useDown whether the interact key is held this frame
   * @param usePressed whether it was pressed this frame
   */
  update(camera: THREE.Camera, dt: number, usePressed: boolean, useDown: boolean, blocked: boolean): void {
    const prev = this.focused;
    this.focused = blocked ? null : this.pick(camera);
    if (prev !== this.focused) {
      prev?.onFocus?.(false);
      this.focused?.onFocus?.(true);
      this.holdProgress = 0;
    }
    const f = this.focused;
    if (!f) return;
    if (f.hold) {
      if (useDown) {
        this.holdProgress += dt / f.hold;
        if (this.holdProgress >= 1) {
          this.holdProgress = 0;
          f.onUse();
        }
      } else this.holdProgress = Math.max(0, this.holdProgress - dt * 2);
    } else if (usePressed) {
      f.onUse();
    }
  }

  private pick(camera: THREE.Camera): Interactable | null {
    const origin = camera.getWorldPosition(new THREE.Vector3());
    const dir = camera.getWorldDirection(new THREE.Vector3());
    this.ray.setFromCamera(this.center, camera);
    const cands: THREE.Object3D[] = [];
    for (const i of this.list) {
      if (!i.enabled) continue;
      if (i.signal && !this.braceletOn) continue;
      const range = i.range ?? (i.signal ? 9 : 2.3);
      i.object.getWorldPosition(this.tmp);
      if (this.tmp.distanceTo(origin) > range + 2.5) continue;
      cands.push(i.object);
    }
    if (!cands.length) return null;
    this.ray.far = 10;
    const hits = this.ray.intersectObjects(cands, true);
    for (const h of hits) {
      let o: THREE.Object3D | null = h.object;
      let it: Interactable | undefined;
      while (o && !(it = o.userData.interactable)) o = o.parent;
      if (!it || !it.enabled) continue;
      const range = it.range ?? (it.signal ? 9 : 2.3);
      if (h.distance > range) return null;
      if (!o!.visible) continue;
      // walls between the eye and the target block interaction
      const wall = this.world.raycast(origin, dir, h.distance, (c) => c.opaque && c.solid && c.tag !== 'door' && c.tag !== 'nointeractblock');
      if (wall && wall.dist < h.distance - 0.12) return null;
      if (it.prompt() === null) return null;
      return it;
    }
    return null;
  }
}
