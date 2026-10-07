import * as THREE from 'three';
import type { CollisionWorld, Collider } from '../physics/CollisionWorld';
import type { Input } from '../core/Input';
import type { Settings } from '../core/Settings';

export interface HideSpot {
  /** Camera position while hidden. */
  eye: THREE.Vector3;
  /** Facing (yaw) while hidden. */
  yaw: number;
  /** Allowed yaw/pitch deviation in radians. */
  yawRange: number;
  pitchRange: number;
  /** Where the player is placed on exit. */
  exit: THREE.Vector3;
  /** Optional fx when inside (e.g. vignette through locker slats). */
  peek?: number;
  id: string;
}

export type FootstepCb = (surface: string, intensity: number) => void;

const STAND_H = 1.72;
const CROUCH_H = 1.05;
const STAND_EYE = 1.6;
const CROUCH_EYE = 0.92;
const RADIUS = 0.28;
const STEP = 0.36;

export class Player {
  readonly pos = new THREE.Vector3();
  readonly vel = new THREE.Vector3();
  yaw = 0;
  pitch = 0;
  grounded = false;
  crouched = false;
  sprinting = false;
  stamina = 1;
  private staminaDelay = 0;
  exhausted = false;
  private eyeH = STAND_EYE;
  private bobPhase = 0;
  private bobAmt = 0;
  private lastStepSign = 1;
  private landTimer = 0;
  private fallSpeed = 0;
  /** Smoothed step-up offset so stairs don't jolt the camera. */
  private stepSmooth = 0;
  // shake (trauma model)
  trauma = 0;
  private shakeT = 0;
  // states
  noclip = false;
  god = false;
  movementLocked = false;
  lookLocked = false;
  hidden: HideSpot | null = null;
  private hideYaw = 0;
  private hidePitch = 0;
  /** Scripted look-at (cinematic camera nudge). */
  private lookTarget: THREE.Vector3 | null = null;
  private lookSpeed = 3;
  speedMul = 1;
  onFootstep: FootstepCb | null = null;
  onLand: ((speed: number) => void) | null = null;
  /** Emits noise radius for AI hearing. */
  onNoise: ((radius: number) => void) | null = null;
  surfaceAt: ((c: Collider | null) => string) | null = null;
  groundCollider: Collider | null = null;
  distanceWalked = 0;

  constructor(
    private world: CollisionWorld,
    private input: Input,
    private camera: THREE.PerspectiveCamera,
    private settings: Settings,
  ) {}

  setSettings(s: Settings): void {
    this.settings = s;
  }

  teleport(x: number, y: number, z: number, yaw?: number, pitch = 0): void {
    this.pos.set(x, y, z);
    this.vel.set(0, 0, 0);
    if (yaw !== undefined) this.yaw = yaw;
    this.pitch = pitch;
    this.stepSmooth = 0;
    this.lookTarget = null;
    this.hidden = null;
    this.updateCamera(0);
  }

  get eyePosition(): THREE.Vector3 {
    return this.camera.position;
  }

  get height(): number {
    return this.crouched ? CROUCH_H : STAND_H;
  }

  forward(out = new THREE.Vector3()): THREE.Vector3 {
    return out.set(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
  }

  /** Smoothly turns the view towards a world point (cinematics). */
  lookAt(target: THREE.Vector3 | null, speed = 3): void {
    this.lookTarget = target ? target.clone() : null;
    this.lookSpeed = speed;
  }

  addTrauma(t: number): void {
    this.trauma = Math.min(1, this.trauma + t);
  }

  enterHide(spot: HideSpot): void {
    this.hidden = spot;
    this.hideYaw = 0;
    this.hidePitch = 0;
    this.vel.set(0, 0, 0);
  }

  exitHide(): void {
    if (!this.hidden) return;
    const h = this.hidden;
    this.hidden = null;
    this.pos.copy(h.exit);
    this.yaw = h.yaw + this.hideYaw;
    this.pitch = 0;
  }

  update(dt: number): void {
    this.look(dt);
    if (this.hidden) {
      this.updateCamera(dt);
      return;
    }
    if (this.noclip) this.flyMove(dt);
    else this.walkMove(dt);
    this.updateCamera(dt);
  }

  private look(dt: number): void {
    const [mx, my] = this.input.consumeMouse();
    const sens = 0.0022 * this.settings.sensitivity;
    const inv = this.settings.invertY ? -1 : 1;
    if (this.lookTarget) {
      const eye = this.camera.position;
      const d = this.lookTarget.clone().sub(eye);
      const ty = Math.atan2(-d.x, -d.z);
      const tp = Math.atan2(d.y, Math.hypot(d.x, d.z));
      let dy = ty - this.yaw;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      const k = 1 - Math.exp(-dt * this.lookSpeed);
      this.yaw += dy * k;
      this.pitch += (tp - this.pitch) * k;
      return;
    }
    if (this.lookLocked) return;
    if (this.hidden) {
      this.hideYaw = clamp(this.hideYaw - mx * sens, -this.hidden.yawRange, this.hidden.yawRange);
      this.hidePitch = clamp(this.hidePitch - my * sens * inv, -this.hidden.pitchRange, this.hidden.pitchRange);
      return;
    }
    this.yaw -= mx * sens;
    this.pitch = clamp(this.pitch - my * sens * inv, -1.5, 1.5);
  }

  private flyMove(dt: number): void {
    const f = this.forward(new THREE.Vector3());
    const r = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const sp = (this.input.isDown('sprint') ? 14 : 5) * dt;
    if (this.input.isDown('forward')) this.pos.addScaledVector(f, sp);
    if (this.input.isDown('back')) this.pos.addScaledVector(f, -sp);
    if (this.input.isDown('right')) this.pos.addScaledVector(r, sp);
    if (this.input.isDown('left')) this.pos.addScaledVector(r, -sp);
    if (this.input.isDown('jump')) this.pos.y += sp;
    if (this.input.isDown('crouch')) this.pos.y -= sp;
    this.vel.set(0, 0, 0);
  }

  private walkMove(dt: number): void {
    const inp = this.input;
    let mx = 0;
    let mz = 0;
    if (!this.movementLocked) {
      if (inp.isDown('forward')) mz -= 1;
      if (inp.isDown('back')) mz += 1;
      if (inp.isDown('left')) mx -= 1;
      if (inp.isDown('right')) mx += 1;
      // crouch
      if (this.settings.crouchToggle) {
        if (inp.pressed('crouch')) this.tryCrouch(!this.crouched);
      } else this.tryCrouch(inp.isDown('crouch'));
    }
    const moving = mx !== 0 || mz !== 0;
    // sprint & stamina
    const wantSprint = moving && mz < 0 && inp.isDown('sprint') && !this.crouched && !this.movementLocked;
    if (wantSprint && !this.exhausted && this.stamina > 0) {
      this.sprinting = true;
      this.stamina = Math.max(0, this.stamina - dt * 0.13);
      this.staminaDelay = 1.2;
      if (this.stamina <= 0) this.exhausted = true;
    } else {
      this.sprinting = false;
      this.staminaDelay -= dt;
      if (this.staminaDelay <= 0) this.stamina = Math.min(1, this.stamina + dt * (moving ? 0.1 : 0.18));
      if (this.exhausted && this.stamina > 0.35) this.exhausted = false;
    }
    let speed = this.crouched ? 1.35 : this.sprinting ? 4.7 : 2.55;
    if (this.exhausted) speed = Math.min(speed, 1.9);
    speed *= this.speedMul;
    // desired horizontal velocity in world space
    const len = Math.hypot(mx, mz) || 1;
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    const wx = ((mx * cos + mz * sin) / len) * speed;
    const wz = ((-mx * sin + mz * cos) / len) * speed;
    const accel = this.grounded ? 12 : 2.5;
    const k = 1 - Math.exp(-accel * dt);
    this.vel.x += (wx - this.vel.x) * k;
    this.vel.z += (wz - this.vel.z) * k;
    // jump
    if (this.grounded && !this.movementLocked && inp.pressed('jump') && !this.crouched) {
      this.vel.y = 3.9;
      this.grounded = false;
    }
    // gravity
    this.vel.y -= 17 * dt;
    if (this.vel.y < -30) this.vel.y = -30;
    // horizontal collision
    const before = this.pos.clone();
    this.world.slide(this.pos, this.vel.x * dt, this.vel.z * dt, RADIUS, this.height, STEP);
    // vertical
    const ground = this.world.groundHeight(this.pos.x, this.pos.z, RADIUS, this.pos.y + STEP);
    const groundCol = this.world.lastGround;
    const newY = this.pos.y + this.vel.y * dt;
    const wasGrounded = this.grounded;
    if (ground > -Infinity && newY <= ground + 0.001 && this.vel.y <= 0.01) {
      const up = ground - this.pos.y;
      if (up > 0.02 && wasGrounded) this.stepSmooth -= up; // camera eases into the step
      if (!wasGrounded && this.fallSpeed > 4) this.onLand?.(this.fallSpeed);
      this.pos.y = ground;
      this.vel.y = 0;
      this.grounded = true;
      this.fallSpeed = 0;
    } else if (wasGrounded && ground > -Infinity && this.pos.y - ground < STEP && this.vel.y <= 0) {
      // stick to descending stairs / ramps
      this.pos.y = ground;
      this.vel.y = 0;
      this.grounded = true;
    } else {
      this.pos.y = newY;
      this.grounded = false;
      this.fallSpeed = Math.max(this.fallSpeed, -this.vel.y);
    }
    // ceiling
    const ceil = this.world.ceilingHeight(this.pos.x, this.pos.z, RADIUS, this.pos.y + 0.5);
    if (this.pos.y + this.height > ceil) {
      this.pos.y = Math.max(ground > -Infinity ? ground : this.pos.y, ceil - this.height);
      if (this.vel.y > 0) this.vel.y = 0;
    }
    if (this.pos.y < -60) this.pos.copy(before).setY(before.y + 1); // safety net
    // ground surface for footsteps
    this.groundCollider = groundCol;
    // walked distance → footsteps
    const hd = Math.hypot(this.pos.x - before.x, this.pos.z - before.z);
    this.distanceWalked += hd;
    const hs = hd / Math.max(dt, 1e-4);
    if (this.grounded && hs > 0.3) {
      const stride = this.crouched ? 0.55 : this.sprinting ? 0.95 : 0.75;
      this.bobPhase += (hd / stride) * Math.PI;
      this.bobAmt += (Math.min(1, hs / 3) - this.bobAmt) * Math.min(1, dt * 8);
      const s = Math.sign(Math.sin(this.bobPhase));
      if (s !== this.lastStepSign) {
        this.lastStepSign = s;
        const intensity = this.crouched ? 0.35 : this.sprinting ? 1 : 0.65;
        this.onFootstep?.(this.surface(), intensity);
        this.onNoise?.(this.crouched ? 1.2 : this.sprinting ? 9 : 4);
      }
    } else {
      this.bobAmt += (0 - this.bobAmt) * Math.min(1, dt * 6);
    }
    this.landTimer = Math.max(0, this.landTimer - dt);
  }

  private surface(): string {
    return this.surfaceAt?.(this.groundCollider) ?? 'concrete';
  }

  private tryCrouch(want: boolean): void {
    if (want === this.crouched) return;
    if (!want) {
      // need head room to stand
      const ceil = this.world.ceilingHeight(this.pos.x, this.pos.z, RADIUS, this.pos.y + CROUCH_H - 0.05);
      if (this.pos.y + STAND_H > ceil) return;
    }
    this.crouched = want;
  }

  private updateCamera(dt: number): void {
    const cam = this.camera;
    if (this.hidden) {
      const h = this.hidden;
      cam.position.copy(h.eye);
      const yaw = h.yaw + this.hideYaw;
      const pitch = this.hidePitch;
      cam.rotation.set(pitch, yaw, 0, 'YXZ');
      // breathing sway
      this.shakeT += dt;
      cam.position.y += Math.sin(this.shakeT * 1.6) * 0.004;
      return;
    }
    const targetEye = this.crouched ? CROUCH_EYE : STAND_EYE;
    this.eyeH += (targetEye - this.eyeH) * Math.min(1, dt * 10);
    this.stepSmooth += (0 - this.stepSmooth) * Math.min(1, dt * 12);
    let bobY = 0;
    let bobX = 0;
    let roll = 0;
    if (this.settings.headBob && !this.noclip) {
      const a = this.bobAmt * (this.sprinting ? 1.6 : 1);
      bobY = Math.abs(Math.sin(this.bobPhase)) * 0.045 * a - 0.02 * a;
      bobX = Math.cos(this.bobPhase) * 0.025 * a;
      roll = Math.cos(this.bobPhase) * 0.006 * a;
    }
    // trauma shake
    this.trauma = Math.max(0, this.trauma - dt * 0.8);
    this.shakeT += dt;
    const sh = this.trauma * this.trauma;
    const n = (o: number) => Math.sin(this.shakeT * 37 + o) * Math.sin(this.shakeT * 13.3 + o * 2);
    const sx = sh * 0.05 * n(1);
    const sy = sh * 0.05 * n(2);
    const sr = sh * 0.04 * n(3);
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    cam.position.set(this.pos.x, this.pos.y + this.eyeH + bobY + this.stepSmooth, this.pos.z).addScaledVector(right, bobX);
    cam.rotation.set(this.pitch + sy, this.yaw + sx, roll + sr, 'YXZ');
  }
}

function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}

export const PLAYER_RADIUS = RADIUS;
