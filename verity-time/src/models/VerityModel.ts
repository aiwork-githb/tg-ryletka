import * as THREE from 'three';
import type { Materials } from '../assets/Materials';
import { BallForm, R as BALL_R } from './verity/BallForm';
import { TallForm, loadTallMeshes } from './verity/TallForm';

/**
 * VERITY. Everyone first meets a glossy yellow smiley ball: two black oval
 * eyes and a thin smile (stages 0-1). As the game goes on the smile opens
 * into a grin full of teeth (2), then the ball gets dented and dirty, the
 * eyes sink into bruised sockets and the grin turns ragged (3). His last
 * form (4) is not a ball at all: a very tall, starved yellow figure with a
 * tiny head and the same grin.
 *
 * This class keeps one API for the AI and the scripts and drives whichever
 * form is showing.
 */
export type Expression = 'smile' | 'open' | 'sad' | 'flat' | 'grin';
export type Gesture = 'none' | 'wave' | 'point' | 'beckon' | 'cover' | 'hug' | 'shrug';

export class VerityRig {
  readonly root = new THREE.Group();
  private ball = new BallForm();
  private tall = new TallForm();
  private tallLoading: Promise<void> | null = null;
  stage = 0;
  // animation state shared by the forms
  private t = 0;
  private stutterHold = 0;
  private gestureT = 0;
  expression: Expression = 'smile';
  gesture: Gesture = 'none';
  /** World point the face tracks. */
  lookTarget: THREE.Vector3 | null = null;
  /** 0..1 how "wrong" movement looks. */
  wrongness = 0;
  /** Cute tilt / impossible tilt. */
  tilt = 0;
  /** Face yaw relative to the body (the face can turn backwards). */
  twist = 0;
  /** Seconds of speech left (moves the mouth). */
  talking = 0;
  moodColor = new THREE.Color(0xffd45a);
  /** Glitchy flicker of the eyes' glow (0..1). */
  starFlicker = 0;
  pointTarget: THREE.Vector3 | null = null;
  scaleMul = 1;
  /** 0..1 rolling-ball mode (the ball stops hopping). */
  tuck = 0;
  /** Free height above his feet (the tall form stoops under low ceilings). */
  headroom = 10;
  /** True once per footstep / landing (the AI plays the sound). */
  private stepFlag = false;

  constructor(_m?: Materials) {
    this.root.add(this.ball.group, this.tall.group);
    this.tall.group.visible = false;
    this.setStage(0);
  }

  /** The rolling body (the AI spins it when he rolls). */
  get body(): THREE.Group {
    return this.ball.body;
  }

  get radius(): number {
    return BALL_R;
  }

  /** Only the ball can roll. */
  get canRoll(): boolean {
    return !this.tallShowing;
  }

  get tallShowing(): boolean {
    return this.stage >= 4 && this.tall.ready;
  }

  /** Height of his eyes above his feet. */
  get headHeight(): number {
    return this.tallShowing ? 1.95 : BALL_R * 1.25;
  }

  /** Starts building a form's meshes; resolves when it can be shown. */
  prepare(stage = 4): Promise<void> {
    if (stage < 4) return Promise.resolve();
    if (!this.tallLoading)
      this.tallLoading = loadTallMeshes().then((m) => {
        this.tall.attach(m);
        this.applyForm();
      });
    return this.tallLoading;
  }

  setStage(s: number): void {
    this.stage = Math.max(0, Math.min(4, Math.round(s)));
    this.ball.setStage(Math.min(3, this.stage));
    if (this.stage >= 4) void this.prepare(4);
    this.applyForm();
  }

  private applyForm(): void {
    const tall = this.tallShowing;
    this.tall.group.visible = tall;
    this.ball.group.visible = !tall;
  }

  setExpression(e: Expression): void {
    this.expression = e;
  }

  setGesture(g: Gesture): void {
    if (g !== this.gesture) this.gestureT = 0;
    this.gesture = g;
  }

  /** Swing at a door he is breaking. */
  strike(): void {
    if (this.tallShowing) this.tall.strike();
  }

  /** True once after each footstep or hop landing. */
  consumeStep(): boolean {
    const s = this.stepFlag;
    this.stepFlag = false;
    return s;
  }

  get worldEye(): THREE.Vector3 {
    if (this.tallShowing) {
      this.root.updateMatrixWorld();
      return this.root.localToWorld(this.tall.eyeLocal.clone());
    }
    return this.ball.eyeWorld;
  }

  /** Main procedural animation. */
  update(dt: number, opts: { speed: number; time: number }): void {
    this.t += dt;
    this.gestureT += dt;
    const w = this.wrongness;
    // stutter: hold the previous pose then snap (wrong-frame look)
    if (w > 0.3) {
      if (this.stutterHold > 0) {
        this.stutterHold -= dt;
        return;
      }
      if (Math.random() < dt * w * 1.8) this.stutterHold = 0.05 + Math.random() * 0.2 * w;
    }
    const talking = this.talking > 0;
    if (this.talking > 0) this.talking -= dt;
    this.updateEyesGlow();
    if (this.tallShowing) {
      this.root.updateMatrixWorld();
      const toLocal = (p: THREE.Vector3 | null) => (p ? this.root.worldToLocal(p.clone()) : null);
      this.tall.update(dt, {
        speed: opts.speed,
        look: toLocal(this.lookTarget),
        point: toLocal(this.pointTarget),
        tilt: this.tilt,
        twist: this.twist,
        wrongness: w,
        talking,
        gesture: this.gesture,
        gestureT: this.gestureT,
        headroom: this.headroom,
        expression: this.expression,
      });
      if (this.tall.stepped) {
        this.tall.stepped = false;
        this.stepFlag = true;
      }
      return;
    }
    this.ball.update(dt, {
      speed: opts.speed,
      rolling: this.tuck > 0.5,
      look: this.lookTarget,
      point: this.pointTarget,
      tilt: this.tilt,
      twist: this.twist,
      wrongness: w,
      talking,
      expression: this.expression,
      gesture: this.gesture,
      gestureT: this.gestureT,
      scale: this.scaleMul,
    });
    if (this.ball.landed) {
      this.ball.landed = false;
      this.stepFlag = true;
    }
  }

  /** The eyes glow faintly red when he is angry; glitches make them flicker. */
  private updateEyesGlow(): void {
    const c = this.moodColor;
    const angry = c.r > 0.8 && c.g < 0.3 && c.b < 0.3 ? 1 : 0;
    let glow = angry * (0.5 + Math.sin(this.t * 3) * 0.15) * (this.stage >= 2 ? 1 : 0.4);
    if (this.starFlicker > 0 && Math.random() < this.starFlicker * 0.3) glow = 1.2;
    for (const mat of [this.ball.eyeMat, this.tall.eyes]) {
      mat.emissive.setRGB(0.9, 0.05, 0.02);
      mat.emissiveIntensity = glow;
    }
  }

  /** Turns the root to face a yaw smoothly. Returns remaining angle. */
  faceYaw(target: number, dt: number, speed = 6): number {
    let d = target - this.root.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.root.rotation.y += d * Math.min(1, dt * speed);
    return d;
  }
}
