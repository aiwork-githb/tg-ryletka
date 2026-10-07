import * as THREE from 'three';
import type { Game } from '../Game';

/**
 * Horror director: schedules authored ambient scares according to pacing
 * rules (setup → tension → payoff), never random jump scares.
 *
 * Zones register candidate events with conditions and a minimum spacing.
 * The director tracks tension (time since last event, recent fear) and picks
 * one candidate when the player has been "safe" long enough.
 */
export interface ScareEvent {
  id: string;
  /** Can this run now? (player location, story flags…) */
  when: () => boolean;
  run: () => void;
  /** Minimum seconds since any previous scare. */
  gap?: number;
  once?: boolean;
  weight?: number;
}

export class Director {
  private events: ScareEvent[] = [];
  private used = new Set<string>();
  private sinceLast = 0;
  private check = 0;
  /** Global intensity multiplier per zone/act. */
  intensity = 1;
  enabled = true;
  private ambientTimer = 20;

  constructor(private g: Game) {}

  reset(): void {
    this.events = [];
    this.sinceLast = 0;
    this.ambientTimer = 20;
  }

  add(e: ScareEvent): void {
    this.events.push(e);
  }

  /** Marks that something scary just happened (resets pacing). */
  bump(): void {
    this.sinceLast = 0;
  }

  update(dt: number): void {
    if (!this.enabled || this.g.mode !== 'play') return;
    this.sinceLast += dt;
    this.check -= dt;
    if (this.check <= 0) {
      this.check = 1.5;
      const ready = this.events.filter((e) => !(e.once !== false && this.used.has(e.id)) && this.sinceLast >= (e.gap ?? 60) / this.intensity && safe(() => e.when()));
      if (ready.length) {
        const total = ready.reduce((s, e) => s + (e.weight ?? 1), 0);
        let r = Math.random() * total;
        let pick = ready[0];
        for (const e of ready) {
          r -= e.weight ?? 1;
          if (r <= 0) {
            pick = e;
            break;
          }
        }
        this.used.add(pick.id);
        this.sinceLast = 0;
        try {
          pick.run();
        } catch (err) {
          console.error('[director]', err);
        }
      }
    }
    // background "life" of the building: distant sounds, never at the player
    this.ambientTimer -= dt;
    if (this.ambientTimer <= 0) {
      this.ambientTimer = 18 + Math.random() * 30;
      this.distantSound();
    }
  }

  /** A sound somewhere in the building, far from the player. */
  distantSound(name?: string): void {
    const p = this.g.player.pos;
    const a = Math.random() * Math.PI * 2;
    const d = 14 + Math.random() * 12;
    const pos = new THREE.Vector3(p.x + Math.cos(a) * d, p.y + 1 + Math.random() * 3, p.z + Math.sin(a) * d);
    const pick = name ?? ['distant_bang', 'metal_groan', 'drip', 'metal_groan', 'distant_bang'][Math.floor(Math.random() * 5)];
    this.g.audio.play(pick, { pos, volume: pick === 'drip' ? 0.5 : 0.45, ref: 4, reverb: 0.9, noOcclusion: true, rate: 0.85 + Math.random() * 0.3 });
  }
}

function safe(f: () => boolean): boolean {
  try {
    return f();
  } catch {
    return false;
  }
}
