import * as THREE from 'three';
import type { Game } from '../Game';
import { VerityRig, type Expression, type Gesture } from '../models/VerityModel';
import type { NavPoint } from './NavGrid';

export type VState = 'off' | 'scripted' | 'watch' | 'guide' | 'stalk' | 'hunt' | 'chase' | 'search';
export type Mood = 'happy' | 'curious' | 'sad' | 'angry' | 'scared' | 'lonely' | 'off';

const MOODS: Record<Mood, number> = {
  happy: 0xffc93a,
  curious: 0x5fe0cf,
  sad: 0x5f8fff,
  angry: 0xff2a1a,
  scared: 0xb47cff,
  lonely: 0x8aa0b8,
  off: 0x000000,
};

export interface DoorLike {
  pos: THREE.Vector3;
  isOpen: boolean;
  locked: boolean;
  /** AI is allowed to force it open. */
  aiPassable: boolean;
  open(byAI?: boolean): void;
  /** Bolted from the inside: Verity has to break it. */
  bolted?: boolean;
  shake?(): void;
  bash?(from: THREE.Vector3): void;
}

export interface HideLike {
  id: string;
  pos: THREE.Vector3;
  occupied: boolean;
}

/**
 * Verity as an actor: model, locomotion on the nav grid, perception
 * (sight, hearing, FriendLink bracelet) and behaviour states.
 *
 * Signature mechanic: the ball form hops when it walks and ROLLS when it
 * chases — fast on straights, clumsy at doors and corners. The tall last
 * form runs instead, and breaks doors with its arms.
 */
export class Verity {
  readonly rig: VerityRig;
  state: VState = 'off';
  readonly pos = new THREE.Vector3();
  private yaw = 0;
  speed = 0;
  private desiredSpeed = 0;
  private path: NavPoint[] = [];
  private pathIdx = 0;
  private repath = 0;
  private goal: THREE.Vector3 | null = null;
  private arrived = true;
  threat = 0;
  lookAtPlayer = false;
  rolling = false;
  private rollAngle = 0;
  private tuck = 0;
  // perception
  lastSeen = new THREE.Vector3();
  timeSinceSeen = 999;
  private sawHideId: string | null = null;
  private noiseTarget: THREE.Vector3 | null = null;
  private braceletPing = 0;
  // config
  chaseSpeed = 4.3;
  huntSpeed = 2.0;
  walkSpeed = 1.25;
  catchDist = 1.0;
  catchLine = 'Нашёл!';
  onCatch: (() => void) | null = null;
  onLost: (() => void) | null = null;
  /** Doors and hide spots in the current zone. */
  doors: DoorLike[] = [];
  hides: HideLike[] = [];
  // watch / guide parameters
  private watchOpts: { vanishDist: number; maxTime: number; onVanish?: (reason: 'near' | 'unseen' | 'time') => void; seen: boolean; unseenFor: number; t: number; unseenVanish: boolean } | null = null;
  private guidePoints: Array<{ p: THREE.Vector3; wait?: number; say?: string; gesture?: Gesture; until?: () => boolean }> = [];
  private guideIdx = 0;
  private guideWait = 0;
  private searchT = 0;
  private searchPoints: THREE.Vector3[] = [];
  private doorWait = 0;
  private bashDoor: DoorLike | null = null;
  private bashT = 0;
  private stalkFreeze = 0;
  private rollSound: import('../audio/AudioEngine').Sound | null = null;
  private stuckT = 0;
  private lastProgress = new THREE.Vector3();
  debugPath: NavPoint[] = [];

  constructor(private g: Game) {
    this.rig = new VerityRig(g.mats);
    this.rig.root.visible = false;
    g.renderer.scene.add(this.rig.root);
    g.bus.on('noise', (n) => this.hearNoise(n.x, n.y, n.z, n.radius));
  }

  get stage(): number {
    return this.rig.stage;
  }
  set stage(s: number) {
    this.rig.setStage(s);
  }

  get visible(): boolean {
    return this.rig.root.visible;
  }

  reset(): void {
    this.hide();
    this.doors = [];
    this.hides = [];
    this.onCatch = null;
    this.onLost = null;
    this.catchLine = 'Нашёл!';
  }

  // =================================================================== API

  spawn(p: THREE.Vector3 | { x: number; y: number; z: number }, yaw = 0, state: VState = 'scripted'): void {
    this.pos.set(p.x, p.y, p.z);
    this.yaw = yaw;
    this.rig.root.rotation.y = yaw;
    this.rig.root.position.copy(this.pos);
    this.rig.root.visible = true;
    this.state = state;
    this.speed = 0;
    this.desiredSpeed = 0;
    this.path = [];
    this.goal = null;
    this.arrived = true;
    this.rolling = false;
    this.tuck = 0;
    this.rig.setGesture('none');
    this.timeSinceSeen = 999;
  }

  hide(): void {
    this.rig.root.visible = false;
    this.state = 'off';
    this.threat = 0;
    this.rolling = false;
    this.rollSound?.stop(0.3);
    this.rollSound = null;
    this.watchOpts = null;
    this.guidePoints = [];
  }

  setMood(m: Mood): void {
    this.rig.moodColor.set(MOODS[m]);
  }

  expression(e: Expression): void {
    this.rig.setExpression(e);
  }

  gesture(gs: Gesture, target?: THREE.Vector3): void {
    this.rig.pointTarget = target ?? null;
    this.rig.setGesture(gs);
  }

  /** Speaks a line from his position. Returns duration. */
  say(text: string, opts: { degrade?: number } = {}): number {
    const d = this.g.say('verity', text, { pos: this.visible ? this.rig.worldEye : undefined, degrade: opts.degrade });
    this.rig.talking = d;
    return d;
  }

  *talk(text: string, opts: { degrade?: number } = {}): Generator<number> {
    yield this.say(text, opts);
  }

  /** Walks to a point (scripted). Returns a predicate for coroutines. */
  moveTo(p: THREE.Vector3 | { x: number; y: number; z: number }, speed = this.walkSpeed): () => boolean {
    this.goal = new THREE.Vector3(p.x, p.y, p.z);
    this.desiredSpeed = speed;
    this.arrived = false;
    this.computePath();
    return () => this.arrived;
  }

  stop(): void {
    this.goal = null;
    this.desiredSpeed = 0;
    this.arrived = true;
    this.path = [];
  }

  teleport(p: THREE.Vector3 | { x: number; y: number; z: number }, yaw?: number): void {
    this.pos.set(p.x, p.y, p.z);
    if (yaw !== undefined) {
      this.yaw = yaw;
      this.rig.root.rotation.y = yaw;
    }
    this.rig.root.position.copy(this.pos);
  }

  faceTo(p: THREE.Vector3): void {
    this.yaw = Math.atan2(p.x - this.pos.x, p.z - this.pos.z);
  }

  /** Stands and watches; vanishes if approached or after losing sight. */
  watch(p: THREE.Vector3, opts: { vanishDist?: number; maxTime?: number; onVanish?: (reason: 'near' | 'unseen' | 'time') => void; yaw?: number; unseenVanish?: boolean } = {}): void {
    this.spawn(p, opts.yaw ?? 0, 'watch');
    this.lookAtPlayer = true;
    this.watchOpts = { vanishDist: opts.vanishDist ?? 7, maxTime: opts.maxTime ?? 60, onVanish: opts.onVanish, seen: false, unseenFor: 0, t: 0, unseenVanish: opts.unseenVanish ?? true };
  }

  guide(points: Array<{ p: THREE.Vector3; wait?: number; say?: string; gesture?: Gesture; until?: () => boolean }>): void {
    this.state = 'guide';
    this.guidePoints = points;
    this.guideIdx = 0;
    this.guideWait = 0;
    this.lookAtPlayer = true;
    if (points[0]) this.moveTo(points[0].p, 1.7);
  }

  startChase(opts: { speed?: number; line?: string; roll?: boolean } = {}): void {
    if (!this.visible) return;
    this.state = 'chase';
    this.chaseSpeed = opts.speed ?? this.chaseSpeed;
    if (opts.line) this.catchLine = opts.line;
    // only the ball can roll; the tall form runs
    this.rolling = (opts.roll ?? true) && this.rig.canRoll;
    this.lookAtPlayer = true;
    this.lastSeen.copy(this.g.player.pos);
    this.timeSinceSeen = 0;
    this.repath = 0;
    this.setMood('angry');
  }

  startHunt(): void {
    this.state = 'hunt';
    this.rolling = false;
    this.lookAtPlayer = false;
    this.setMood('curious');
  }

  startStalk(): void {
    this.state = 'stalk';
    this.rolling = false;
    this.lookAtPlayer = true;
  }

  // =========================================================== perception

  /** Is Verity on screen and not occluded? */
  isSeenByPlayer(): boolean {
    if (!this.visible) return false;
    const cam = this.g.renderer.camera;
    const c = this.pos.clone().setY(this.pos.y + 0.75);
    const toV = c.clone().sub(cam.position);
    const dist = toV.length();
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    const ang = toV.normalize().dot(fwd);
    const halfFov = THREE.MathUtils.degToRad(cam.fov * 0.5 * cam.aspect * 0.9);
    if (ang < Math.cos(Math.min(1.4, halfFov))) return false;
    if (dist > 40) return false;
    return this.g.world.lineOfSight(cam.position, c, (col) => col.tag === 'door' && false);
  }

  /** Can Verity see the player? */
  canSeePlayer(): boolean {
    const pl = this.g.player;
    if (pl.hidden) return false;
    const eye = this.pos.clone().setY(this.pos.y + 0.85);
    const target = this.g.renderer.camera.position.clone();
    const to = target.clone().sub(eye);
    const dist = to.length();
    const lit = this.g.flashlight.on;
    const range = lit ? 26 : pl.crouched ? 7 : 11;
    if (dist > range) return false;
    const facing = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const cos = to.clone().setY(0).normalize().dot(facing);
    const fov = this.state === 'chase' ? -0.2 : 0.35; // chase: almost all-round awareness
    if (cos < fov && dist > 2.2) return false;
    return this.g.world.lineOfSight(eye, target);
  }

  hearNoise(x: number, y: number, z: number, radius: number): void {
    if (this.state !== 'hunt' && this.state !== 'search' && this.state !== 'stalk') return;
    const d = this.pos.distanceTo(new THREE.Vector3(x, y, z));
    if (d > radius) return;
    this.noiseTarget = new THREE.Vector3(x, y, z);
    if (this.state === 'stalk') this.state = 'hunt';
  }

  // ================================================================ update

  update(dt: number): void {
    if (this.state === 'off') {
      this.threat = Math.max(0, this.threat - dt);
      return;
    }
    const pl = this.g.player;
    const seen = this.canSeePlayer();
    if (seen) {
      this.lastSeen.copy(pl.pos);
      this.timeSinceSeen = 0;
    } else this.timeSinceSeen += dt;

    switch (this.state) {
      case 'watch':
        this.updateWatch(dt);
        break;
      case 'guide':
        this.updateGuide(dt);
        break;
      case 'stalk':
        this.updateStalk(dt, seen);
        break;
      case 'hunt':
        this.updateHunt(dt, seen);
        break;
      case 'chase':
        this.updateChase(dt, seen);
        break;
      case 'search':
        this.updateSearch(dt, seen);
        break;
    }
    this.locomotion(dt);
    this.animate(dt);
    this.updateThreat(dt);
  }

  private updateWatch(dt: number): void {
    const w = this.watchOpts;
    if (!w) return;
    w.t += dt;
    const seenNow = this.isSeenByPlayer();
    if (seenNow) {
      w.seen = true;
      w.unseenFor = 0;
    } else if (w.seen) w.unseenFor += dt;
    const d = this.pos.distanceTo(this.g.player.pos);
    const reason = d < w.vanishDist ? 'near' : w.unseenVanish && w.seen && w.unseenFor > 1.0 ? 'unseen' : w.t > w.maxTime ? 'time' : null;
    if (reason) {
      const cb = w.onVanish;
      this.hide();
      cb?.(reason);
    }
  }

  private updateGuide(dt: number): void {
    const gp = this.guidePoints[this.guideIdx];
    if (!gp) return;
    if (!this.arrived) return;
    // arrived at a guide point: wait for the player
    const d = this.pos.distanceTo(this.g.player.pos);
    if (gp.gesture) this.gesture(gp.gesture, this.g.player.pos.clone().setY(this.g.player.pos.y + 1));
    this.guideWait += dt;
    const waitOk = this.guideWait >= (gp.wait ?? 0) && (!gp.until || gp.until()) && d < 7;
    if (gp.say && this.guideWait > 0.2 && !(gp as any)._said) {
      (gp as any)._said = true;
      this.say(gp.say);
    }
    if (waitOk) {
      this.guideIdx++;
      this.guideWait = 0;
      this.gesture('none');
      const next = this.guidePoints[this.guideIdx];
      if (next) this.moveTo(next.p, 1.7);
      else this.state = 'scripted';
    }
  }

  private updateStalk(dt: number, seen: boolean): void {
    const pl = this.g.player;
    const looked = this.isSeenByPlayer();
    if (looked) {
      // freeze while observed — he "plays statues"
      this.stalkFreeze = 1.2 + Math.random();
      this.stop();
      this.lookAtPlayer = true;
      return;
    }
    if (this.stalkFreeze > 0) {
      this.stalkFreeze -= dt;
      return;
    }
    this.repath -= dt;
    if (this.repath <= 0) {
      this.repath = 1.2;
      const fwd = pl.forward(new THREE.Vector3()).setY(0).normalize();
      const behind = pl.pos.clone().addScaledVector(fwd, -8);
      this.moveTo(behind, 1.6);
    }
    if (seen && this.pos.distanceTo(pl.pos) < 3) this.startHunt();
  }

  private updateHunt(dt: number, seen: boolean): void {
    const pl = this.g.player;
    if (seen && this.pos.distanceTo(pl.pos) < 14) {
      this.startChase({ roll: true });
      this.g.music.sting('danger');
      return;
    }
    this.braceletPing -= dt;
    if (this.g.state.is('bracelet.on') && this.braceletPing <= 0) {
      this.braceletPing = 4;
      this.noiseTarget = pl.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 6, 0, (Math.random() - 0.5) * 6));
      this.g.audio.play('scan_ping', { volume: 0.4, bus: 'sfx' });
    }
    if (this.noiseTarget) {
      this.moveTo(this.noiseTarget, this.huntSpeed);
      this.noiseTarget = null;
    } else if (this.arrived) {
      this.repath -= dt;
      if (this.repath <= 0) {
        this.repath = 2 + Math.random() * 2;
        const nav = this.g.zone?.nav;
        const p = nav?.randomNear(this.pos.x, this.pos.z, 10);
        if (p) this.moveTo(new THREE.Vector3(p.x, p.y, p.z), this.huntSpeed * 0.75);
      }
    }
  }

  private updateChase(dt: number, seen: boolean): void {
    const pl = this.g.player;
    // track which hide spot the player entered in front of Verity
    if (pl.hidden && this.timeSinceSeen < 1.2 && !this.sawHideId) this.sawHideId = pl.hidden.id;
    if (!pl.hidden) this.sawHideId = null;
    this.repath -= dt;
    if (this.repath <= 0) {
      this.repath = 0.35;
      const target = seen || this.timeSinceSeen < 2 ? pl.pos : this.lastSeen;
      this.moveTo(target, this.chaseSpeed);
    }
    const ramp = Math.min(1, 0.5 + this.chaseT * 0.25);
    this.chaseT += dt;
    this.desiredSpeed = this.chaseSpeed * ramp * (this.doorWait > 0 ? 0 : 1);
    const d = this.pos.distanceTo(pl.pos);
    if (pl.hidden && this.sawHideId === pl.hidden.id && d < 1.6) {
      this.catchPlayer();
      return;
    }
    if (!pl.hidden && d < this.catchDist && Math.abs(this.pos.y - pl.pos.y) < 1.4) {
      this.catchPlayer();
      return;
    }
    if (this.timeSinceSeen > 7 || (pl.hidden && this.sawHideId !== pl.hidden.id && this.arrived)) {
      this.state = 'search';
      this.rolling = false;
      this.searchT = 12;
      this.searchPoints = this.hides
        .filter((h) => h.pos.distanceTo(this.lastSeen) < 14)
        .sort(() => Math.random() - 0.5)
        .slice(0, 2)
        .map((h) => h.pos.clone());
      this.setMood('curious');
      this.onLost?.();
    }
  }
  private chaseT = 0;

  private updateSearch(dt: number, seen: boolean): void {
    if (seen) {
      this.chaseT = 0;
      this.startChase({ roll: true });
      return;
    }
    this.searchT -= dt;
    if (this.arrived) {
      const next = this.searchPoints.shift();
      if (next) {
        this.moveTo(next, this.huntSpeed);
        // stand in front of a hiding place for a moment
        this.stop();
        this.moveTo(next, this.huntSpeed);
      } else {
        const nav = this.g.zone?.nav;
        const p = nav?.randomNear(this.lastSeen.x, this.lastSeen.z, 8);
        if (p) this.moveTo(new THREE.Vector3(p.x, p.y, p.z), this.huntSpeed * 0.8);
      }
    }
    if (this.searchT <= 0) this.startHunt();
  }

  private catchPlayer(): void {
    if (this.g.player.god) return;
    this.stop();
    this.rolling = false;
    if (this.onCatch) {
      this.onCatch();
      return;
    }
    // final lunge: face the camera
    const cam = this.g.renderer.camera;
    this.faceTo(cam.position);
    this.rig.setExpression(this.stage >= 3 ? 'grin' : 'open');
    this.g.player.lookAt(this.pos.clone().setY(this.pos.y + this.rig.headHeight * 0.95), 20);
    this.g.music.motif({ variant: 'distorted', volume: 0.8 });
    this.g.caught('verity', this.catchLine);
  }

  // ============================================================ locomotion

  private computePath(): void {
    if (!this.goal) return;
    const nav = this.g.zone?.nav;
    if (!nav) {
      this.path = [{ x: this.goal.x, y: this.goal.y, z: this.goal.z }];
      this.pathIdx = 0;
      return;
    }
    const p = nav.path(this.pos, this.goal);
    if (!p) {
      this.path = [{ x: this.goal.x, y: this.goal.y, z: this.goal.z }];
    } else {
      this.path = p;
      // replace the final cell centre with the exact goal if walkable
      if (nav.walkable(this.goal.x, this.goal.z)) this.path[this.path.length - 1] = { x: this.goal.x, y: this.path[this.path.length - 1].y, z: this.goal.z };
    }
    this.pathIdx = 0;
    // skip the first waypoint if we're already past it
    if (this.path.length > 1) this.pathIdx = 1;
    this.debugPath = this.path;
  }

  private locomotion(dt: number): void {
    if (this.doorWait > 0) {
      this.doorWait -= dt;
      this.speed = 0;
      const bd = this.bashDoor;
      if (bd) {
        this.bashT -= dt;
        if (this.bashT <= 0 && this.doorWait > 0.3) {
          this.bashT = 1.05;
          this.rig.strike();
          bd.shake?.();
          this.g.audio.play('impact_metal', { pos: bd.pos.clone().setY(1.1), volume: 0.9, rate: 0.6 + Math.random() * 0.1, ref: 4 });
          this.g.audio.play('door_close', { pos: bd.pos.clone().setY(1.1), volume: 0.6, rate: 0.7 });
          const d = bd.pos.distanceTo(this.g.player.pos);
          this.g.player.addTrauma(Math.max(0, 0.35 - d * 0.02));
        }
        if (this.doorWait <= 0) {
          bd.bash?.(this.pos);
          this.bashDoor = null;
        }
      }
      return;
    }
    let target: NavPoint | null = this.path[this.pathIdx] ?? null;
    if (!this.arrived && target) {
      const dx = target.x - this.pos.x;
      const dz = target.z - this.pos.z;
      const dist = Math.hypot(dx, dz);
      const last = this.pathIdx >= this.path.length - 1;
      if (dist < (last ? 0.25 : 0.45)) {
        if (last) {
          this.arrived = true;
          this.desiredSpeed = this.state === 'chase' ? this.desiredSpeed : 0;
        } else this.pathIdx++;
        target = this.path[this.pathIdx] ?? null;
      }
    }
    // doors in the way: bolted ones have to be broken
    for (const d of this.doors) {
      if (d.isOpen || !d.bolted) continue;
      if (d.pos.distanceTo(this.pos) < 1.45 && this.desiredSpeed > 0.1) {
        this.bashDoor = d;
        this.bashT = 0.2;
        this.doorWait = this.state === 'chase' ? 3.6 : 5;
        this.speed = 0;
        return;
      }
    }
    for (const d of this.doors) {
      if (d.isOpen || d.locked || !d.aiPassable) continue;
      if (d.pos.distanceTo(this.pos) < 1.3 && this.speed > 0.1) {
        d.open(true);
        this.doorWait = this.rolling ? 1.0 : 0.6;
        if (this.rolling) this.g.player.addTrauma(0.1);
      }
    }
    const want = this.arrived ? 0 : this.desiredSpeed;
    this.speed += (want - this.speed) * Math.min(1, dt * (want > this.speed ? 2.5 : 6));
    if (target && !this.arrived && this.speed > 0.01) {
      const dx = target.x - this.pos.x;
      const dz = target.z - this.pos.z;
      const desiredYaw = Math.atan2(dx, dz);
      let dy = desiredYaw - this.yaw;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      this.yaw += dy * Math.min(1, dt * (this.rolling ? 5 : 8));
      // slow down at sharp turns
      const turnK = Math.max(0.35, Math.cos(Math.min(Math.abs(dy), Math.PI / 2)));
      const step = this.speed * turnK * dt;
      const p = { x: this.pos.x, y: this.pos.y, z: this.pos.z };
      const len = Math.hypot(dx, dz) || 1;
      this.g.world.slide(p, (dx / len) * step, (dz / len) * step, 0.32, 1.2, 0.4, 'ai');
      const gh = this.g.world.groundHeight(p.x, p.z, 0.3, p.y + 0.5, 'ai');
      if (gh > -Infinity) p.y += (gh - p.y) * Math.min(1, dt * 12);
      this.pos.set(p.x, p.y, p.z);
      // unstick
      if (this.pos.distanceTo(this.lastProgress) > 0.3) {
        this.lastProgress.copy(this.pos);
        this.stuckT = 0;
      } else {
        this.stuckT += dt;
        if (this.stuckT > 1.5) {
          this.stuckT = 0;
          this.computePath();
        }
      }
    }
    if (this.lookAtPlayer && (this.arrived || this.speed < 0.2) && this.state !== 'chase') {
      const pl = this.g.player.pos;
      this.yaw = lerpAngle(this.yaw, Math.atan2(pl.x - this.pos.x, pl.z - this.pos.z), Math.min(1, dt * 3));
    }
    this.rig.root.position.copy(this.pos);
  }

  private animate(dt: number): void {
    const rig = this.rig;
    rig.lookTarget = this.lookAtPlayer ? this.g.renderer.camera.position.clone() : null;
    // tuck limbs when rolling
    const wantTuck = this.rolling && this.speed > 1 ? 1 : 0;
    this.tuck += (wantTuck - this.tuck) * Math.min(1, dt * 6);
    rig.root.rotation.y = this.yaw;
    if (this.tuck > 0.02) {
      this.rollAngle += (this.speed / 0.42) * dt;
      rig.body.rotation.x = this.rollAngle * this.tuck;
      rig.scaleMul = 1;
      if (!this.rollSound && this.tuck > 0.5) this.rollSound = this.g.audio.play('roll_loop', { loop: true, pos: this.pos, volume: 0.7, ref: 2 });
    } else {
      // when unrolling, settle face upright slowly (unsettling)
      const k = Math.min(1, dt * 1.5);
      const target = Math.round(rig.body.rotation.x / (Math.PI * 2)) * Math.PI * 2;
      rig.body.rotation.x += (target - rig.body.rotation.x) * k;
      this.rollAngle = rig.body.rotation.x;
      if (this.rollSound) {
        this.rollSound.stop(0.3);
        this.rollSound = null;
      }
    }
    this.rollSound?.setPos(this.pos);
    this.rollSound?.setRate(0.6 + this.speed * 0.15);
    rig.tuck = this.tuck;
    rig.update(dt, { speed: this.tuck > 0.5 ? 0 : this.speed, time: this.g.time });
    // footsteps / hop landings come from the rig's own gait
    if (rig.consumeStep() && this.visible) {
      if (rig.tallShowing) {
        this.g.audio.play('step_flesh', { pos: this.pos, volume: 0.35 + this.speed * 0.12, rateJitter: 0.1, ref: 2 });
        if (this.speed > 2.5) this.g.player.addTrauma(Math.max(0, 0.06 - this.pos.distanceTo(this.g.player.pos) * 0.006));
      } else {
        this.g.audio.play('bounce_rubber', { pos: this.pos, volume: 0.25 + this.speed * 0.1, rateJitter: 0.12, ref: 1.5 });
        if (Math.random() < 0.3) this.g.audio.play('shoe_squeak', { pos: this.pos, volume: 0.12, rateJitter: 0.2, ref: 1.5 });
      }
    }
    // the tall form stoops under low ceilings
    if (rig.stage >= 4) {
      const c = this.g.world.ceilingHeight(this.pos.x, this.pos.z, 0.3, this.pos.y + 0.6, 'ai');
      rig.headroom = Number.isFinite(c) ? c - this.pos.y : 10;
    }
    if (rig.talking > 0 && this.visible) rig.lookTarget = this.g.renderer.camera.position.clone();
  }

  private updateThreat(dt: number): void {
    const d = this.pos.distanceTo(this.g.player.pos);
    let t = 0;
    if (this.state === 'chase') t = 1;
    else if (this.state === 'search' || this.state === 'hunt') t = Math.max(0.25, 1 - d / 20);
    else if (this.state === 'stalk') t = Math.max(0, 0.6 - d / 30);
    else if (this.state === 'watch') t = this.isSeenByPlayer() ? 0.35 : 0.1;
    else if (this.visible && this.stage >= 3) t = Math.max(0, 0.5 - d / 20);
    this.threat += (t - this.threat) * Math.min(1, dt * 2);
  }
}

function lerpAngle(a: number, b: number, k: number): number {
  let d = b - a;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  return a + d * k;
}
