import * as THREE from 'three';

export type FlickerMode = 'none' | 'buzz' | 'dying' | 'pulse' | 'strobe' | 'candle';

/**
 * A "virtual" light authored in a level. Only the most relevant ones are
 * assigned to real THREE lights from a fixed-size pool every frame, so the
 * shader light count never changes (no recompiles) while levels can contain
 * hundreds of lamps.
 */
export class VLight {
  readonly position = new THREE.Vector3();
  readonly color = new THREE.Color(1, 1, 1);
  intensity = 1;
  distance = 8;
  decay = 2;
  enabled = true;
  flicker: FlickerMode = 'none';
  flickerSeed = Math.random() * 1000;
  /** Emissive materials (lamp bulbs) driven by this light's brightness. */
  emissives: THREE.MeshStandardMaterial[] = [];
  emissiveBase = 2;
  /** Cell id for visibility culling, '' = always considered. */
  cell = '';
  /** Higher keeps the light assigned even when far away. */
  priority = 1;
  /** Current animated multiplier 0..1 (computed by the manager). */
  level = 1;
  /** Fade towards target state when toggled. */
  private target = 1;
  fadeSpeed = 8;
  // spot settings
  spot = false;
  readonly targetPos = new THREE.Vector3();
  angle = 0.6;
  penumbra = 0.5;
  // runtime
  weight = 0;
  slot: PoolSlot | null = null;

  setOn(on: boolean, instant = false): void {
    this.enabled = on;
    this.target = on ? 1 : 0;
    if (instant) this.level = this.target;
  }

  get on(): boolean {
    return this.enabled;
  }

  /** Returns the brightness multiplier for this frame. */
  sample(t: number, dt: number): number {
    const k = Math.min(1, dt * this.fadeSpeed);
    this.level += (this.target - this.level) * k;
    let f = 1;
    const s = this.flickerSeed;
    switch (this.flicker) {
      case 'buzz': {
        const n = Math.sin(t * 61 + s) * Math.sin(t * 13.7 + s * 2);
        f = n > 0.97 ? 0.35 : 0.96 + Math.sin(t * 120 + s) * 0.04;
        break;
      }
      case 'dying': {
        const n = hashNoise(Math.floor(t * 12 + s));
        const n2 = hashNoise(Math.floor(t * 1.3 + s * 3));
        f = n2 > 0.55 ? (n > 0.5 ? 1 : 0.08) : 0.9 + n * 0.1;
        break;
      }
      case 'pulse':
        f = 0.55 + 0.45 * Math.sin(t * 2.4 + s);
        break;
      case 'strobe':
        f = Math.sin(t * 18 + s) > 0 ? 1 : 0;
        break;
      case 'candle':
        f = 0.82 + 0.18 * (Math.sin(t * 7.1 + s) * 0.5 + Math.sin(t * 13.3 + s * 1.7) * 0.5);
        break;
    }
    return this.level * f;
  }
}

function hashNoise(n: number): number {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

interface PoolSlot {
  light: THREE.PointLight | THREE.SpotLight;
  owner: VLight | null;
}

export class LightManager {
  readonly lights: VLight[] = [];
  private pointPool: PoolSlot[] = [];
  private spotPool: PoolSlot[] = [];
  private time = 0;
  private group = new THREE.Group();
  visibleCells: Set<string> | null = null;
  /** Global multiplier (power outages, scripted blackouts). */
  master = 1;
  private frustum = new THREE.Frustum();
  private projScreen = new THREE.Matrix4();
  private sphere = new THREE.Sphere();

  constructor(scene: THREE.Scene) {
    this.group.name = 'LightPool';
    scene.add(this.group);
  }

  /** (Re)creates the real light pool. Called on quality change. */
  configure(points: number, spots: number): void {
    for (const s of [...this.pointPool, ...this.spotPool]) {
      this.group.remove(s.light);
      if (s.light instanceof THREE.SpotLight) this.group.remove(s.light.target);
      s.light.dispose();
    }
    for (const l of this.lights) {
      l.slot = null;
      l.weight = 0;
    }
    this.pointPool = [];
    this.spotPool = [];
    for (let i = 0; i < points; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 8, 2);
      l.castShadow = false;
      this.group.add(l);
      this.pointPool.push({ light: l, owner: null });
    }
    for (let i = 0; i < spots; i++) {
      const l = new THREE.SpotLight(0xffffff, 0, 12, 0.6, 0.5, 2);
      l.castShadow = false;
      this.group.add(l, l.target);
      this.spotPool.push({ light: l, owner: null });
    }
  }

  add(v: VLight): VLight {
    this.lights.push(v);
    return v;
  }

  remove(v: VLight): void {
    const i = this.lights.indexOf(v);
    if (i >= 0) this.lights.splice(i, 1);
    if (v.slot) {
      v.slot.owner = null;
      v.slot.light.intensity = 0;
      v.slot = null;
    }
  }

  clear(): void {
    for (const v of [...this.lights]) this.remove(v);
  }

  update(dt: number, camera: THREE.Camera): void {
    this.time += dt;
    const t = this.time;
    this.projScreen.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.projScreen);
    const camPos = camera.getWorldPosition(_v);

    // 1. animate every light + emissive bulbs, score candidates
    const candP: Array<[VLight, number]> = [];
    const candS: Array<[VLight, number]> = [];
    for (const v of this.lights) {
      const lvl = v.sample(t, dt) * this.master;
      (v as any)._lvl = lvl;
      for (const m of v.emissives) m.emissiveIntensity = v.emissiveBase * Math.max(0.03, lvl);
      if (lvl <= 0.01 || v.intensity <= 0) continue;
      if (this.visibleCells && v.cell && !this.visibleCells.has(v.cell)) continue;
      this.sphere.set(v.position, v.distance);
      if (!this.frustum.intersectsSphere(this.sphere)) {
        // keep lights that might light what we see from behind only if very close
        if (v.position.distanceToSquared(camPos) > v.distance * v.distance) continue;
      }
      const d = Math.max(1, v.position.distanceTo(camPos));
      const score = (v.intensity * lvl * v.priority * v.distance) / (d * d);
      (v.spot ? candS : candP).push([v, score]);
    }
    this.assign(candP, this.pointPool, dt);
    this.assign(candS, this.spotPool, dt);
  }

  private assign(cands: Array<[VLight, number]>, pool: PoolSlot[], dt: number): void {
    cands.sort((a, b) => b[1] - a[1]);
    const desired = new Set(cands.slice(0, pool.length).map((c) => c[0]));
    const fade = Math.min(1, dt * 5);
    // fade out unwanted owners
    for (const slot of pool) {
      const o = slot.owner;
      if (!o) continue;
      if (!desired.has(o)) {
        o.weight -= fade;
        if (o.weight <= 0) {
          o.weight = 0;
          o.slot = null;
          slot.owner = null;
          slot.light.intensity = 0;
        }
      } else o.weight = Math.min(1, o.weight + fade);
    }
    // place newly desired
    for (const v of desired) {
      if (v.slot) continue;
      const free = pool.find((s) => !s.owner);
      if (!free) break;
      free.owner = v;
      v.slot = free;
      v.weight = 0;
    }
    // write uniforms
    for (const slot of pool) {
      const o = slot.owner;
      if (!o) continue;
      const l = slot.light;
      l.position.copy(o.position);
      l.color.copy(o.color);
      l.distance = o.distance;
      l.decay = o.decay;
      l.intensity = o.intensity * ((o as any)._lvl ?? 1) * o.weight;
      if (l instanceof THREE.SpotLight) {
        l.target.position.copy(o.targetPos);
        l.angle = o.angle;
        l.penumbra = o.penumbra;
      }
    }
  }

  /** Lights within radius of a point (for scripted blackouts, AI sabotage). */
  near(p: THREE.Vector3, radius: number): VLight[] {
    return this.lights.filter((l) => l.position.distanceTo(p) <= radius);
  }
}

const _v = new THREE.Vector3();
