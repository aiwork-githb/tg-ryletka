import * as THREE from 'three';
import type { Game } from '../Game';
import type { Interactable } from '../interaction/Interaction';

export interface Carriable {
  obj: THREE.Object3D;
  name: string;
  kind: string;
  impact: string;
  noise: number;
  interactable?: Interactable;
  /** Radius used for wall collision while flying. */
  radius?: number;
  onLand?: (p: THREE.Vector3) => void;
}

interface Projectile {
  c: Carriable;
  vel: THREE.Vector3;
  bounces: number;
  life: number;
}

/**
 * Holding, placing and throwing physical objects. Thrown objects make noise
 * that the AI can hear — the core distraction tool.
 */
export class Carry {
  holding: Carriable | null = null;
  private flying: Projectile[] = [];
  private holdOffset = new THREE.Vector3(0.28, -0.26, -0.55);

  constructor(private g: Game) {}

  pick(c: Carriable): void {
    if (this.holding) this.drop();
    this.holding = c;
    if (c.interactable) c.interactable.enabled = false;
    this.flying = this.flying.filter((p) => p.c !== c);
    this.g.audio.play('pickup', { volume: 0.4, rate: 1.2 });
  }

  prompt(): string {
    return this.holding ? `Бросить: ${this.holding.name}` : '';
  }

  /** Places the held object at a fixed transform (sockets, shelves). */
  place(pos: THREE.Vector3, rotY = 0): Carriable | null {
    const c = this.holding;
    if (!c) return null;
    this.holding = null;
    c.obj.position.copy(pos);
    c.obj.rotation.set(0, rotY, 0);
    return c;
  }

  drop(silent = false): void {
    const c = this.holding;
    if (!c) return;
    this.holding = null;
    if (silent) return;
    const fwd = this.g.player.forward(new THREE.Vector3());
    this.launch(c, fwd.multiplyScalar(1.2));
  }

  throwHeld(): void {
    const c = this.holding;
    if (!c) return;
    this.holding = null;
    const fwd = this.g.player.forward(new THREE.Vector3());
    fwd.y += 0.18;
    this.launch(c, fwd.normalize().multiplyScalar(9.5));
    this.g.audio.play('whoosh', { volume: 0.35, pos: c.obj.position, noOcclusion: true });
  }

  private launch(c: Carriable, vel: THREE.Vector3): void {
    this.flying.push({ c, vel: vel.clone(), bounces: 0, life: 8 });
  }

  update(dt: number): void {
    const cam = this.g.renderer.camera;
    if (this.holding) {
      const o = this.holding.obj;
      const target = this.holdOffset.clone().applyQuaternion(cam.quaternion).add(cam.position);
      o.position.lerp(target, Math.min(1, dt * 18));
      o.quaternion.slerp(cam.quaternion, Math.min(1, dt * 10));
    }
    const world = this.g.world;
    for (const p of this.flying) {
      p.life -= dt;
      const o = p.c.obj;
      p.vel.y -= 9.8 * dt;
      const step = p.vel.clone().multiplyScalar(dt);
      const len = step.length();
      if (len > 1e-5) {
        const dir = step.clone().divideScalar(len);
        const hit = world.raycast(o.position, dir, len + (p.c.radius ?? 0.08), (col) => col.solid && col.blocks !== 'ai');
        if (hit) {
          const n = new THREE.Vector3(hit.normal.x, hit.normal.y, hit.normal.z);
          o.position.set(hit.point.x, hit.point.y, hit.point.z).addScaledVector(n, (p.c.radius ?? 0.08) + 0.005);
          const speed = p.vel.length();
          const vn = p.vel.dot(n);
          p.vel.addScaledVector(n, -(1 + 0.35) * vn).multiplyScalar(0.6);
          p.bounces++;
          if (speed > 1.2) {
            this.g.audio.play(p.c.impact, { pos: o.position, volume: Math.min(1, speed / 8), rateJitter: 0.1 });
            this.g.bus.emit('noise', { x: o.position.x, y: o.position.y, z: o.position.z, radius: p.c.noise * Math.min(1, speed / 6), source: 'throw' });
          }
          if (n.y > 0.6 && p.vel.length() < 0.8) {
            p.life = 0;
            p.c.onLand?.(o.position.clone());
          }
        } else o.position.add(step);
        o.rotation.x += dt * p.vel.length() * 0.8;
        o.rotation.z += dt * p.vel.length() * 0.5;
      }
      if (o.position.y < -50) p.life = 0;
    }
    const done = this.flying.filter((p) => p.life <= 0);
    for (const p of done) {
      p.c.obj.rotation.x = 0;
      p.c.obj.rotation.z = 0;
      if (p.c.interactable) p.c.interactable.enabled = true;
    }
    this.flying = this.flying.filter((p) => p.life > 0);
  }
}
