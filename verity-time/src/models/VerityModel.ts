import * as THREE from 'three';
import type { Materials } from '../assets/Materials';
import { cyl, lathe, sphere, tube } from '../world/geom';

/**
 * VERITY — the mascot. A round "ball friend": butter-yellow upper shell,
 * coral lower shell, teal belt with star rivets, huge glossy eyes, a spring
 * antenna with a star (its mood light), noodle arms with mitten hands and
 * oversized red sneakers. Fully procedural rig with procedural animation.
 *
 * Degradation stages 0..4 progressively break the design: grime, cracks,
 * a jammed eyelid, a bent antenna, a missing shell panel, crooked mouth,
 * pinpoint pupils, no blinking.
 */
export type Expression = 'smile' | 'open' | 'sad' | 'flat' | 'grin';
export type Gesture = 'none' | 'wave' | 'point' | 'beckon' | 'cover' | 'hug' | 'shrug';

const R = 0.42; // body radius
const LID_OPEN = -2.35; // eyelid retracted up into the shell
const LID_CLOSED = -0.05;
const BODY_Y = 0.74; // body centre height

export class VerityRig {
  readonly root = new THREE.Group();
  private hips = new THREE.Group();
  private legL = new THREE.Group();
  private legR = new THREE.Group();
  private bodyPivot = new THREE.Group();
  readonly body = new THREE.Group();
  private face = new THREE.Group();
  private eyeL: EyeParts;
  private eyeR: EyeParts;
  private mouths: Record<Expression, THREE.Object3D> = {} as any;
  private mouthGroup = new THREE.Group();
  private armL: ArmParts;
  private armR: ArmParts;
  private antennaBase = new THREE.Group();
  private starPivot = new THREE.Group();
  readonly star: THREE.Mesh;
  readonly starMat: THREE.MeshStandardMaterial;
  private upperMat: THREE.MeshStandardMaterial;
  private lowerMat: THREE.MeshStandardMaterial;
  private dirtyUpper: THREE.MeshStandardMaterial;
  private dirtyLower: THREE.MeshStandardMaterial;
  private upperMesh: THREE.Mesh;
  private lowerMesh: THREE.Mesh;
  private cracks = new THREE.Group();
  private bigCrack = new THREE.Group();
  private panelHole = new THREE.Group();
  private backOpen = new THREE.Group();
  private rivets: THREE.Mesh[] = [];
  private eyeShine: THREE.MeshStandardMaterial;
  stage = 0;
  // animation state
  private t = 0;
  private phase = 0;
  private blinkT = 3;
  private blinkAmt = 0;
  private starVel = new THREE.Vector2();
  private starOff = new THREE.Vector2();
  private lastPos = new THREE.Vector3();
  private lastVel = new THREE.Vector3();
  private stutterHold = 0;
  private gestureT = 0;
  expression: Expression = 'smile';
  gesture: Gesture = 'none';
  /** World point the eyes (and optionally body) track. */
  lookTarget: THREE.Vector3 | null = null;
  /** 0..1 how "wrong" movement looks. */
  wrongness = 0;
  /** Extra roll of the body (cute tilt / impossible tilt). */
  tilt = 0;
  /** Body yaw relative to the legs (face can turn backwards). */
  twist = 0;
  talking = 0;
  moodColor = new THREE.Color(0xffd45a);
  private moodCurrent = new THREE.Color(0xffd45a);
  starFlicker = 0;
  pointTarget: THREE.Vector3 | null = null;
  scaleMul = 1;
  /** 0..1 limbs tucked in (rolling ball mode). */
  tuck = 0;

  constructor(m: Materials) {
    this.upperMat = toyPlastic(m, '#f6d45c', 0.15);
    this.lowerMat = toyPlastic(m, '#f59a86', 0.15);
    this.dirtyUpper = toyPlastic(m, '#d8b552', 0.95, 0.55);
    this.dirtyLower = toyPlastic(m, '#cf8574', 0.95, 0.55);
    const teal = toyPlastic(m, '#2aa597', 0.3);
    const legMat = toyPlastic(m, '#23867b', 0.4);
    const white = m.plastic('#f7f3ea', 0.2);
    const red = m.plastic('#d7372f', 0.35);
    const dark = new THREE.MeshStandardMaterial({ color: 0x2a1720, roughness: 0.5 });
    const steel = m.steel('#9aa0a6', 0.4);

    // ---------------------------------------------------------------- legs
    this.root.add(this.hips);
    this.hips.position.y = 0.36;
    for (const [leg, sx] of [
      [this.legL, -1],
      [this.legR, 1],
    ] as const) {
      leg.position.set(sx * 0.15, 0, 0);
      this.hips.add(leg);
      const shin = new THREE.Mesh(cyl(0.065, 0.07, 0.26, 14, 0.3), legMat);
      const sock = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.016, 8, 20), white);
      sock.rotation.x = Math.PI / 2;
      sock.position.y = -0.25;
      leg.add(sock);
      shin.position.y = -0.13;
      leg.add(shin);
      const shoe = new THREE.Group();
      shoe.position.set(0, -0.3, 0.05);
      leg.add(shoe);
      const upper = new THREE.Mesh(sphere(0.1, 20, 14, 0.3), red);
      upper.scale.set(0.82, 0.6, 1.3);
      upper.position.y = 0.035;
      const sole = new THREE.Mesh(cyl(0.1, 0.1, 0.035, 20, 0.3), white);
      sole.scale.set(0.85, 1, 1.35);
      sole.position.y = -0.012;
      const toe = new THREE.Mesh(sphere(0.06, 14, 10, 0.3), white);
      toe.scale.set(1.2, 0.7, 0.9);
      toe.position.set(0, 0.02, 0.095);
      const lace = new THREE.Mesh(cyl(0.012, 0.012, 0.11, 6), white);
      lace.rotation.z = Math.PI / 2;
      lace.position.set(0, 0.085, 0.01);
      const lace2 = lace.clone();
      lace2.position.z = 0.045;
      shoe.add(upper, sole, toe, lace, lace2);
      for (const o of [shin, upper, sole, toe]) o.castShadow = true;
    }

    // ---------------------------------------------------------------- body
    this.root.add(this.bodyPivot);
    this.bodyPivot.position.y = BODY_Y - R; // pivot at bottom of the ball
    this.bodyPivot.add(this.body);
    this.body.position.y = R;
    const bandY = -0.17;
    const split = Math.acos(bandY / R); // polar angle of the belt
    this.upperMesh = new THREE.Mesh(new THREE.SphereGeometry(R, 48, 32, 0, Math.PI * 2, 0, split), this.upperMat);
    this.lowerMesh = new THREE.Mesh(new THREE.SphereGeometry(R, 48, 16, 0, Math.PI * 2, split, Math.PI - split), this.lowerMat);
    this.upperMesh.castShadow = this.lowerMesh.castShadow = true;
    this.body.add(this.upperMesh, this.lowerMesh);
    const bandR = Math.sqrt(R * R - bandY * bandY);
    const band = new THREE.Mesh(new THREE.TorusGeometry(bandR + 0.004, 0.032, 12, 64), teal);
    band.rotation.x = Math.PI / 2;
    band.position.y = bandY;
    band.castShadow = true;
    this.body.add(band);
    const starShape = starShapeGeo(0.028, 0.012, 0.012);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const rv = new THREE.Mesh(starShape, white);
      rv.position.set(Math.sin(a) * (bandR + 0.035), bandY, Math.cos(a) * (bandR + 0.035));
      rv.lookAt(rv.position.clone().multiplyScalar(2).setY(bandY));
      this.body.add(rv);
      this.rivets.push(rv);
    }
    // belly star emblem
    const belly = new THREE.Mesh(starShapeGeo(0.06, 0.026, 0.01), white);
    belly.position.set(0, -0.28, Math.sqrt(R * R - 0.28 * 0.28) - 0.005);
    belly.lookAt(belly.position.clone().multiplyScalar(2));
    this.body.add(belly);

    // ---------------------------------------------------------------- face
    this.body.add(this.face);
    this.eyeShine = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.6, roughness: 0.1 });
    this.eyeL = makeEye(-0.145, this.upperMat, this.eyeShine);
    this.eyeR = makeEye(0.145, this.upperMat, this.eyeShine);
    this.face.add(this.eyeL.root, this.eyeR.root);
    // cheeks
    const blush = new THREE.MeshStandardMaterial({ color: 0xf28b9a, roughness: 0.6, transparent: true, opacity: 0.75 });
    for (const sx of [-1, 1]) {
      const c = new THREE.Mesh(new THREE.CircleGeometry(0.045, 20), blush);
      const p = surfacePoint(sx * 0.27, -0.02);
      c.position.copy(p).multiplyScalar(1.004);
      c.lookAt(p.clone().multiplyScalar(2));
      c.scale.set(1.3, 0.8, 1);
      this.face.add(c);
    }
    // mouths
    this.mouthGroup.position.copy(surfacePoint(0, -0.07)).multiplyScalar(1.002);
    this.mouthGroup.lookAt(this.mouthGroup.position.clone().multiplyScalar(2));
    this.face.add(this.mouthGroup);
    const tongue = new THREE.MeshStandardMaterial({ color: 0xe46a7a, roughness: 0.45 });
    this.mouths.smile = mouthMesh(smileShape(0.15, 0.065), dark, tongue);
    this.mouths.grin = mouthMesh(smileShape(0.2, 0.09), dark, tongue);
    this.mouths.open = mouthMesh(ovalShape(0.045, 0.055), dark, tongue);
    this.mouths.sad = mouthMesh(smileShape(0.09, -0.03), dark, null);
    this.mouths.flat = mouthMesh(ovalShape(0.07, 0.008), dark, null);
    for (const k of Object.keys(this.mouths) as Expression[]) {
      this.mouthGroup.add(this.mouths[k]);
      this.mouths[k].visible = k === 'smile';
    }

    // ---------------------------------------------------------------- arms
    this.armL = makeArm(-1, this.upperMat, white);
    this.armR = makeArm(1, this.upperMat, white);
    this.body.add(this.armL.shoulder, this.armR.shoulder);

    // ---------------------------------------------------------------- antenna
    this.antennaBase.position.set(0, R - 0.01, 0);
    this.body.add(this.antennaBase);
    const cap = new THREE.Mesh(sphere(0.045, 16, 10), teal);
    cap.scale.y = 0.5;
    this.antennaBase.add(cap);
    const helix: THREE.Vector3[] = [];
    for (let i = 0; i <= 60; i++) {
      const tt = i / 60;
      helix.push(new THREE.Vector3(Math.cos(tt * Math.PI * 12) * 0.018, tt * 0.17, Math.sin(tt * Math.PI * 12) * 0.018));
    }
    const spring = new THREE.Mesh(tube(helix, 0.0055, 160, 6), steel);
    this.antennaBase.add(spring);
    this.starPivot.position.y = 0.17;
    this.antennaBase.add(this.starPivot);
    this.starMat = new THREE.MeshStandardMaterial({ color: 0xffe9a0, emissive: 0xffc93a, emissiveIntensity: 1.4, roughness: 0.35 });
    this.star = new THREE.Mesh(starShapeGeo(0.085, 0.038, 0.035), this.starMat);
    this.star.position.y = 0.075;
    this.starPivot.add(this.star);

    // ---------------------------------------------------------------- damage
    const crackMat = new THREE.MeshStandardMaterial({ color: 0x1a120c, roughness: 0.9 });
    this.cracks.add(crackLine([surfacePoint(0.32, 0.18), surfacePoint(0.26, 0.1), surfacePoint(0.3, 0.02), surfacePoint(0.22, -0.05)], crackMat));
    this.cracks.add(crackLine([surfacePoint(-0.05, 0.38), surfacePoint(-0.02, 0.3), surfacePoint(-0.08, 0.24)], crackMat));
    this.cracks.add(crackLine([surfacePoint(-0.33, -0.1, true), surfacePoint(-0.25, -0.02, true), surfacePoint(-0.3, 0.08, true)], crackMat));
    this.body.add(this.cracks);
    this.bigCrack.add(
      crackLine(
        [surfacePoint(-0.02, 0.4), surfacePoint(0.03, 0.3), surfacePoint(-0.01, 0.22), surfacePoint(0.06, 0.13), surfacePoint(0.02, 0.05), surfacePoint(0.09, -0.04), surfacePoint(0.05, -0.12)],
        crackMat,
        0.006,
      ),
    );
    this.body.add(this.bigCrack);
    // missing panel on the right side: dark cavity with wires and a red LED
    const holeMat = new THREE.MeshStandardMaterial({ color: 0x050405, roughness: 1, side: THREE.DoubleSide });
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.11, 24), holeMat);
    const hp = surfacePoint(R * 0.92, 0.08);
    hole.position.copy(hp).multiplyScalar(0.985);
    hole.lookAt(hp.clone().multiplyScalar(2));
    this.panelHole.add(hole);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.008, 6, 24), this.dirtyUpper);
    rim.position.copy(hole.position);
    rim.quaternion.copy(hole.quaternion);
    this.panelHole.add(rim);
    const wireMats = [0xc0392b, 0x2980b9, 0xf1c40f, 0x27ae60].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5 }));
    const n = hp.clone().normalize();
    for (let i = 0; i < 4; i++) {
      const a = hp.clone().multiplyScalar(0.8).add(new THREE.Vector3(0, (i - 1.5) * 0.03, 0));
      const b = hp.clone().multiplyScalar(1.02).add(new THREE.Vector3(0.02 * i, -0.06 + i * 0.02, 0.03 * (i - 2)));
      const c = hp.clone().multiplyScalar(1.12 + i * 0.03).add(new THREE.Vector3(0, -0.12 - i * 0.03, 0.02 * i));
      this.panelHole.add(new THREE.Mesh(tube([a, b, c], 0.006, 12, 5), wireMats[i]));
    }
    const led = new THREE.Mesh(sphere(0.012, 8, 6), new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff2010, emissiveIntensity: 3 }));
    led.position.copy(hp.clone().multiplyScalar(0.93)).addScaledVector(n, 0.0);
    this.panelHole.add(led);
    this.body.add(this.panelHole);
    // open back: exposed gearwork
    const back = surfacePoint(0, 0.05, true);
    const gearMat = m.steel('#8c7a5a', 0.7);
    for (let i = 0; i < 3; i++) {
      const gear = new THREE.Mesh(new THREE.CylinderGeometry(0.06 - i * 0.012, 0.06 - i * 0.012, 0.02, 12), gearMat);
      gear.rotation.x = Math.PI / 2;
      gear.position.copy(back).multiplyScalar(0.9).add(new THREE.Vector3((i - 1) * 0.08, (i % 2) * 0.06, 0));
      this.backOpen.add(gear);
    }
    const backHole = new THREE.Mesh(new THREE.CircleGeometry(0.17, 24), holeMat);
    backHole.position.copy(back).multiplyScalar(0.97);
    backHole.lookAt(back.clone().multiplyScalar(2));
    this.backOpen.add(backHole);
    this.body.add(this.backOpen);

    this.root.traverse((o) => {
      const mm = o as THREE.Mesh;
      if (mm.isMesh) {
        mm.castShadow = true;
        mm.receiveShadow = true;
      }
    });
    this.setStage(0);
  }

  setStage(s: number): void {
    this.stage = Math.max(0, Math.min(4, Math.round(s)));
    const st = this.stage;
    this.upperMesh.material = st >= 1 ? this.dirtyUpper : this.upperMat;
    this.lowerMesh.material = st >= 1 ? this.dirtyLower : this.lowerMat;
    this.eyeL.lid.material = this.eyeR.lid.material = st >= 1 ? this.dirtyUpper : this.upperMat;
    this.armL.upperMesh.material = this.armR.upperMesh.material = st >= 1 ? this.dirtyUpper : this.upperMat;
    this.cracks.visible = st >= 2;
    this.panelHole.visible = st >= 3;
    this.bigCrack.visible = st >= 4;
    this.backOpen.visible = st >= 4;
    this.rivets.forEach((r, i) => (r.visible = !(st >= 2 && i % 3 === 1)));
    this.antennaBase.rotation.z = st >= 2 ? 0.45 : 0;
    this.antennaBase.rotation.x = st >= 3 ? -0.25 : 0;
    // pupils
    const pupil = st >= 4 ? 0.35 : st >= 3 ? 0.6 : 1;
    this.eyeL.pupil.scale.setScalar(st >= 3 ? 1.35 : pupil);
    this.eyeR.pupil.scale.setScalar(pupil);
    this.eyeShine.emissiveIntensity = st >= 3 ? 0.6 : 1.6;
    this.mouthGroup.rotation.z = st >= 3 ? 0.18 : 0;
  }

  setExpression(e: Expression): void {
    this.expression = e;
    for (const k of Object.keys(this.mouths) as Expression[]) this.mouths[k].visible = k === e;
  }

  get worldEye(): THREE.Vector3 {
    return this.face.localToWorld(new THREE.Vector3(0, 0.1, 0.3));
  }

  /** Main procedural animation. `vel` is the world velocity of the root. */
  update(dt: number, opts: { speed: number; time: number }): void {
    this.t += dt;
    const w = this.wrongness;
    // stutter: hold the previous pose then snap (wrong-frame look)
    if (w > 0.3) {
      if (this.stutterHold > 0) {
        this.stutterHold -= dt;
        return;
      }
      if (Math.random() < dt * w * 1.8) this.stutterHold = 0.05 + Math.random() * 0.2 * w;
    }
    const speed = opts.speed;
    const moving = speed > 0.05;
    // walk cycle
    const stride = 0.55;
    this.phase += (speed / stride) * Math.PI * dt;
    const amp = Math.min(1, speed / 1.5);
    const swing = Math.sin(this.phase) * 0.75 * amp;
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;
    // foot lift
    this.legL.position.y = Math.max(0, -Math.cos(this.phase)) * 0.05 * amp;
    this.legR.position.y = Math.max(0, Math.cos(this.phase)) * 0.05 * amp;
    // bounce + squash
    const bounce = Math.abs(Math.sin(this.phase)) * 0.05 * amp;
    const breath = Math.sin(this.t * 1.7) * 0.012;
    const squash = 1 + (moving ? Math.cos(this.phase * 2) * 0.03 * amp : breath);
    this.bodyPivot.position.y = (BODY_Y - R + bounce) * (1 - this.tuck);
    const limb = Math.max(0.001, 1 - this.tuck);
    this.hips.scale.setScalar(limb);
    this.hips.visible = limb > 0.05;
    this.armL.shoulder.scale.setScalar(limb);
    this.armR.shoulder.scale.setScalar(limb);
    this.antennaBase.scale.setScalar(Math.max(0.001, 1 - this.tuck * 0.9));
    this.bodyPivot.scale.set((1 / Math.sqrt(squash)) * this.scaleMul, squash * this.scaleMul, (1 / Math.sqrt(squash)) * this.scaleMul);
    // lean forward with speed, roll with steps
    let lean = Math.min(0.28, speed * 0.06);
    let roll = Math.sin(this.phase) * 0.06 * amp + this.tilt;
    let yawTwist = this.twist;
    if (w > 0) {
      roll += (Math.random() - 0.5) * 0.06 * w + Math.sin(this.t * 0.7) * 0.3 * w * w;
      lean += Math.sin(this.t * 1.3) * 0.08 * w;
      yawTwist += (Math.random() - 0.5) * 0.05 * w;
    }
    this.bodyPivot.rotation.set(lean, yawTwist, roll, 'YXZ');
    // arms: swing opposite, idle sway, gestures
    this.animateArms(dt, swing, amp);
    // eyes
    this.animateEyes(dt);
    // antenna spring follows acceleration
    const pos = this.root.getWorldPosition(new THREE.Vector3());
    const vel = pos.clone().sub(this.lastPos).divideScalar(Math.max(dt, 1e-3));
    const acc = vel.clone().sub(this.lastVel);
    this.lastPos.copy(pos);
    this.lastVel.copy(vel);
    const inv = new THREE.Quaternion().copy(this.root.quaternion).invert();
    const la = acc.applyQuaternion(inv);
    this.starVel.x += (-la.x * 0.02 - this.starOff.x * 60) * dt;
    this.starVel.y += (-la.z * 0.02 - this.starOff.y * 60) * dt;
    this.starVel.multiplyScalar(Math.exp(-dt * 4));
    this.starOff.addScaledVector(this.starVel, dt * 10);
    this.starOff.clampScalar(-0.6, 0.6);
    this.starPivot.rotation.set(this.starOff.y + bounce * 2, this.t * 0.3, -this.starOff.x);
    this.star.rotation.y = Math.sin(this.t * 0.8) * 0.4;
    // mood light
    this.moodCurrent.lerp(this.moodColor, Math.min(1, dt * 2));
    let glow = 1.3 + Math.sin(this.t * 2) * 0.15;
    if (this.starFlicker > 0) glow *= Math.random() < this.starFlicker * 0.5 ? 0.1 : 1;
    this.starMat.emissive.copy(this.moodCurrent);
    this.starMat.emissiveIntensity = glow;
    // talking mouth
    if (this.talking > 0) {
      this.talking -= dt;
      const open = 0.6 + Math.abs(Math.sin(this.t * 16)) * 0.6;
      this.mouthGroup.scale.set(1, open, 1);
    } else this.mouthGroup.scale.set(1, 1, 1);
  }

  private animateArms(dt: number, swing: number, amp: number): void {
    const idle = Math.sin(this.t * 1.4) * 0.06;
    let lS = new THREE.Euler(swing * 0.6 - 0.15, 0, 0.62 + idle);
    let rS = new THREE.Euler(-swing * 0.6 - 0.15, 0, -0.62 - idle);
    let lE = 0.55;
    let rE = 0.55;
    this.gestureT += dt;
    const g = this.gesture;
    const gt = this.gestureT;
    if (g === 'wave') {
      rS = new THREE.Euler(0, 0, -2.5 + Math.sin(gt * 9) * 0.25);
      rE = 0.6 + Math.sin(gt * 9) * 0.4;
    } else if (g === 'point' || g === 'beckon') {
      let pitch = -1.45;
      let yaw = 0;
      if (this.pointTarget) {
        const local = this.body.worldToLocal(this.pointTarget.clone());
        yaw = Math.atan2(local.x, local.z) * 0.8;
        pitch = -Math.PI / 2 - Math.atan2(local.y, Math.hypot(local.x, local.z)) * 0.8;
      }
      rS = new THREE.Euler(pitch, yaw, -0.25);
      rE = g === 'beckon' ? 0.4 + Math.max(0, Math.sin(gt * 6)) * 1.4 : 0.05;
    } else if (g === 'cover') {
      lS = new THREE.Euler(-2.0, 0.5, 0.6);
      rS = new THREE.Euler(-2.0, -0.5, -0.6);
      lE = rE = 1.7;
    } else if (g === 'hug') {
      lS = new THREE.Euler(-1.35, -0.4, 0.2);
      rS = new THREE.Euler(-1.35, 0.4, -0.2);
      lE = rE = 0.7;
    } else if (g === 'shrug') {
      lS = new THREE.Euler(-0.3, 0, 1.2);
      rS = new THREE.Euler(-0.3, 0, -1.2);
      lE = rE = 1.2;
    }
    const k = Math.min(1, dt * 10);
    lerpEuler(this.armL.shoulder.rotation, lS, k);
    lerpEuler(this.armR.shoulder.rotation, rS, k);
    this.armL.elbow.rotation.x += (-lE - this.armL.elbow.rotation.x) * k;
    this.armR.elbow.rotation.x += (-rE - this.armR.elbow.rotation.x) * k;
    if (this.wrongness > 0.5) {
      // arms hang too long and limp
      this.armL.elbow.rotation.x *= 0.5;
      this.armR.elbow.rotation.x *= 0.5;
    }
    void amp;
  }

  setGesture(g: Gesture): void {
    if (g !== this.gesture) this.gestureT = 0;
    this.gesture = g;
  }

  private animateEyes(dt: number): void {
    // blink
    const canBlink = this.stage < 4;
    this.blinkT -= dt;
    if (this.blinkT <= 0 && canBlink) {
      this.blinkAmt = 1;
      this.blinkT = 2.2 + Math.random() * 3.5 + this.wrongness * 6;
    }
    this.blinkAmt = Math.max(0, this.blinkAmt - dt * 7);
    const blink = Math.sin(this.blinkAmt * Math.PI);
    const span = LID_CLOSED - LID_OPEN;
    const stuck = this.stage >= 2 ? 0.5 : 0; // left lid jammed half closed
    const sad = this.expression === 'sad' ? 0.3 : 0;
    this.eyeL.lidPivot.rotation.x = LID_OPEN + Math.max(blink, stuck, sad) * span;
    this.eyeR.lidPivot.rotation.x = LID_OPEN + Math.max(blink, sad) * span;
    // look
    for (const [e, lag] of [
      [this.eyeL, 1],
      [this.eyeR, this.stage >= 3 ? 0.35 : 1],
    ] as const) {
      let tx = 0;
      let ty = 0;
      if (this.lookTarget) {
        const local = e.root.worldToLocal(this.lookTarget.clone());
        const d = Math.max(0.001, local.length());
        tx = THREE.MathUtils.clamp(local.x / d, -0.6, 0.6);
        ty = THREE.MathUtils.clamp(local.y / d, -0.5, 0.5);
        if (this.stage >= 4) {
          tx = 0;
          ty = 0;
        }
      }
      const k = Math.min(1, dt * 12 * lag);
      e.iris.position.x += (tx * 0.05 - e.iris.position.x) * k;
      e.iris.position.y += (ty * 0.045 - e.iris.position.y) * k;
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

// ---------------------------------------------------------------- helpers

interface EyeParts {
  root: THREE.Group;
  iris: THREE.Group;
  pupil: THREE.Mesh;
  lid: THREE.Mesh;
  lidPivot: THREE.Group;
}

interface ArmParts {
  shoulder: THREE.Group;
  elbow: THREE.Group;
  upperMesh: THREE.Mesh;
}

function surfacePoint(x: number, y: number, back = false): THREE.Vector3 {
  const z = Math.sqrt(Math.max(0, R * R - x * x - y * y));
  return new THREE.Vector3(x, y, back ? -z : z);
}

let irisTex: THREE.CanvasTexture | null = null;
function irisTexture(): THREE.CanvasTexture {
  if (irisTex) return irisTex;
  const N = 256;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(N / 2, N / 2, N * 0.05, N / 2, N / 2, N / 2);
  grd.addColorStop(0, '#0b2a4a');
  grd.addColorStop(0.35, '#1f6f9f');
  grd.addColorStop(0.7, '#2fb0c0');
  grd.addColorStop(0.92, '#145a7a');
  grd.addColorStop(1, '#0a1e33');
  g.fillStyle = grd;
  g.fillRect(0, 0, N, N);
  g.strokeStyle = 'rgba(200,255,255,0.18)';
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2;
    g.beginPath();
    g.moveTo(N / 2 + Math.cos(a) * N * 0.12, N / 2 + Math.sin(a) * N * 0.12);
    g.lineTo(N / 2 + Math.cos(a) * N * 0.45, N / 2 + Math.sin(a) * N * 0.45);
    g.stroke();
  }
  irisTex = new THREE.CanvasTexture(c);
  irisTex.colorSpace = THREE.SRGBColorSpace;
  return irisTex;
}

function makeEye(x: number, lidMat: THREE.Material, shine: THREE.Material): EyeParts {
  const root = new THREE.Group();
  const p = surfacePoint(x, 0.09);
  root.position.copy(p).multiplyScalar(0.94);
  root.lookAt(p.clone().multiplyScalar(2));
  const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.118, 32, 24), new THREE.MeshPhysicalMaterial({ color: 0xfbfaf6, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 }));
  sclera.scale.set(0.95, 1.12, 0.62);
  root.add(sclera);
  const iris = new THREE.Group();
  iris.position.z = 0.07;
  root.add(iris);
  const irisMesh = new THREE.Mesh(new THREE.CircleGeometry(0.066, 32), new THREE.MeshStandardMaterial({ map: irisTexture(), roughness: 0.25 }));
  irisMesh.scale.y = 1.1;
  iris.add(irisMesh);
  const pupil = new THREE.Mesh(new THREE.CircleGeometry(0.035, 24), new THREE.MeshStandardMaterial({ color: 0x050608, roughness: 0.1 }));
  pupil.position.z = 0.001;
  iris.add(pupil);
  const hl = new THREE.Mesh(new THREE.CircleGeometry(0.017, 12), shine);
  hl.position.set(0.022, 0.028, 0.003);
  iris.add(hl);
  const hl2 = new THREE.Mesh(new THREE.CircleGeometry(0.007, 10), shine);
  hl2.position.set(-0.015, -0.018, 0.003);
  iris.add(hl2);
  // eyelid: a shell slightly bigger than the eye, rotating down to close
  const lidPivot = new THREE.Group();
  root.add(lidPivot);
  const lid = new THREE.Mesh(new THREE.SphereGeometry(0.126, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.55), lidMat);
  lid.scale.set(0.97, 1.14, 0.68);
  lid.rotation.x = Math.PI / 2;
  lidPivot.add(lid);
  lidPivot.rotation.x = LID_OPEN;
  return { root, iris, pupil, lid, lidPivot };
}

function makeArm(side: number, mat: THREE.Material, glove: THREE.Material): ArmParts {
  const shoulder = new THREE.Group();
  const sp = new THREE.Vector3(side * (R - 0.03), -0.02, 0.02);
  shoulder.position.copy(sp);
  const upper = new THREE.Mesh(cyl(0.05, 0.046, 0.2, 14, 0.3), mat);
  upper.position.y = -0.1;
  shoulder.add(upper);
  const elbow = new THREE.Group();
  elbow.position.y = -0.2;
  shoulder.add(elbow);
  const jointBall = new THREE.Mesh(sphere(0.048, 12, 8), mat);
  elbow.add(jointBall);
  const fore = new THREE.Mesh(cyl(0.046, 0.042, 0.17, 14, 0.3), mat);
  fore.position.y = -0.085;
  elbow.add(fore);
  const hand = new THREE.Mesh(sphere(0.078, 20, 14), glove);
  hand.scale.set(0.9, 1.05, 0.75);
  hand.position.y = -0.21;
  elbow.add(hand);
  const thumb = new THREE.Mesh(sphere(0.028, 10, 8), glove);
  thumb.position.set(-side * 0.05, -0.18, 0.03);
  elbow.add(thumb);
  const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.014, 8, 20), glove);
  cuff.rotation.x = Math.PI / 2;
  cuff.position.y = -0.15;
  elbow.add(cuff);
  return { shoulder, elbow, upperMesh: upper };
}

function starShapeGeo(r1: number, r2: number, depth: number): THREE.BufferGeometry {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? r2 : r1;
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelSize: depth * 0.35, bevelThickness: depth * 0.35, bevelSegments: 3 });
  g.translate(0, 0, -depth / 2);
  g.computeVertexNormals();
  return g;
}

function smileShape(w: number, h: number): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  s.quadraticCurveTo(0, -h * 2, w / 2, 0);
  s.quadraticCurveTo(0, -h * 0.6, -w / 2, 0);
  return s;
}

function ovalShape(rx: number, ry: number): THREE.Shape {
  const s = new THREE.Shape();
  s.absellipse(0, 0, rx, ry, 0, Math.PI * 2, false, 0);
  return s;
}

function mouthMesh(shape: THREE.Shape, dark: THREE.Material, tongue: THREE.Material | null): THREE.Object3D {
  const g = new THREE.Group();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.012, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 2, curveSegments: 16 });
  geo.translate(0, 0, -0.012);
  g.add(new THREE.Mesh(geo, dark));
  if (tongue) {
    const t = new THREE.Mesh(new THREE.CircleGeometry(0.018, 16), tongue);
    t.position.set(0.005, -0.03, 0.002);
    t.scale.set(1.3, 0.8, 1);
    g.add(t);
  }
  return g;
}

function crackLine(points: THREE.Vector3[], mat: THREE.Material, r = 0.004): THREE.Mesh {
  const pts = points.map((p) => p.clone().multiplyScalar(1.003));
  const m = new THREE.Mesh(tube(pts, r, 24, 4), mat);
  return m;
}

function lerpEuler(e: THREE.Euler, t: THREE.Euler, k: number): void {
  e.x += (t.x - e.x) * k;
  e.y += (t.y - e.y) * k;
  e.z += (t.z - e.z) * k;
}

/** Glossy clear-coated toy plastic built on the procedural plastic maps. */
function toyPlastic(m: Materials, color: string, wear: number, rough = 0.35): THREE.MeshPhysicalMaterial {
  const base = m.plastic(color, wear);
  const mat = new THREE.MeshPhysicalMaterial({
    map: base.map,
    normalMap: base.normalMap,
    normalScale: new THREE.Vector2(0.25, 0.25),
    roughness: rough,
    metalness: 0,
    clearcoat: wear > 0.5 ? 0.15 : 0.8,
    clearcoatRoughness: 0.2,
    sheen: 0,
  });
  return mat;
}

// silence unused helper warnings in some builds
void lathe;
