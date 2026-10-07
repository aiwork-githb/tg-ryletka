import * as THREE from 'three';
import type { Game } from '../Game';
import type { LevelBuilder } from '../world/LevelBuilder';
import { wardenModel } from '../models/industry';
import { VLight } from '../render/LightManager';
import type { Sound } from '../audio/AudioEngine';

export type WardenState = 'patrol' | 'investigate' | 'alert' | 'off';

/**
 * WARDEN-7: a security unit hanging from a ceiling rail. Blind except for its
 * searchlight: stay out of the beam. It hears noise and turns towards it.
 * Suspicion builds while you are in the beam; at 100% it raises the alarm.
 */
export class Warden {
  readonly group: THREE.Group;
  private head: THREE.Group;
  private lens: THREE.MeshStandardMaterial;
  private eye: THREE.MeshStandardMaterial;
  readonly light: VLight;
  private cone: THREE.Mesh;
  private coneMat: THREE.ShaderMaterial;
  private lengths: number[] = [];
  private total = 0;
  private s = 0;
  private dir = 1;
  speed = 1.3;
  state: WardenState = 'patrol';
  suspicion = 0;
  private sweepT = Math.random() * 10;
  private investigateT = 0;
  private investigatePos = new THREE.Vector3();
  private targetS = 0;
  private servo: Sound | null = null;
  private pingT = 2;
  private aim = new THREE.Vector3();
  onAlert: (() => void) | null = null;
  /** Detection cone half-angle and range. */
  coneAngle = 0.38;
  range = 13;
  readonly pos = new THREE.Vector3();

  constructor(
    private g: Game,
    b: LevelBuilder,
    private path: THREE.Vector3[],
    opts: { start?: number; speed?: number; closed?: boolean } = {},
  ) {
    const w = wardenModel(g.mats);
    this.group = w.group;
    this.head = w.head;
    this.lens = w.lens;
    this.eye = w.eye;
    b.addDynamic(this.group);
    for (let i = 0; i < path.length; i++) {
      const l = path[i].distanceTo(path[(i + 1) % path.length]);
      this.lengths.push(l);
      this.total += l;
    }
    this.s = (opts.start ?? 0) * this.total;
    this.speed = opts.speed ?? this.speed;
    this.light = new VLight();
    this.light.spot = true;
    this.light.color.set(0xfff0d0);
    this.light.intensity = 220;
    this.light.distance = 16;
    this.light.angle = this.coneAngle + 0.08;
    this.light.penumbra = 0.35;
    this.light.priority = 6;
    this.light.setOn(true, true);
    g.lights.add(this.light);
    b.zone.disposers.push(() => g.lights.remove(this.light));
    // visible beam
    const len = 9;
    const geo = new THREE.CylinderGeometry(0.08, Math.tan(this.coneAngle) * len, len, 24, 1, true);
    geo.translate(0, -len / 2, 0);
    this.coneMat = new THREE.ShaderMaterial({
      uniforms: { uInt: { value: 0.07 }, uColor: { value: new THREE.Color(0xfff0d0) } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      vertexShader: `varying float vY; varying vec3 vN; varying vec3 vV;
        void main(){ vY = -position.y / ${len.toFixed(1)}; vec4 mv = modelViewMatrix*vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `uniform float uInt; uniform vec3 uColor; varying float vY; varying vec3 vN; varying vec3 vV;
        void main(){ float e = pow(abs(dot(vN,vV)),1.5); gl_FragColor = vec4(uColor*uInt*e*(1.0-vY), 1.0); }`,
    });
    this.cone = new THREE.Mesh(geo, this.coneMat);
    this.cone.renderOrder = 5;
    b.addDynamic(this.cone);
    b.update((dt) => this.update(dt));
    g.bus.on('noise', (n) => this.hear(new THREE.Vector3(n.x, n.y, n.z), n.radius, n.source));
    b.zone.disposers.push(() => this.servo?.stop(0.2));
    this.place();
  }

  private pointAt(s: number, out = new THREE.Vector3()): THREE.Vector3 {
    let d = ((s % this.total) + this.total) % this.total;
    for (let i = 0; i < this.path.length; i++) {
      if (d <= this.lengths[i]) return out.copy(this.path[i]).lerp(this.path[(i + 1) % this.path.length], d / this.lengths[i]);
      d -= this.lengths[i];
    }
    return out.copy(this.path[0]);
  }

  private nearestS(p: THREE.Vector3): number {
    let best = 0;
    let bestD = Infinity;
    for (let s = 0; s < this.total; s += 0.5) {
      const q = this.pointAt(s);
      const d = (q.x - p.x) ** 2 + (q.z - p.z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    return best;
  }

  disable(): void {
    this.state = 'off';
    this.light.setOn(false);
    this.lens.emissiveIntensity = 0;
    this.eye.emissiveIntensity = 0;
    this.servo?.stop(0.5);
    this.servo = null;
    this.g.audio.play('servo', { pos: this.pos, volume: 0.5, rate: 0.5 });
    this.suspicion = 0;
  }

  hear(p: THREE.Vector3, radius: number, source: string): void {
    if (this.state === 'off' || this.state === 'alert') return;
    if (source === 'player' && radius < 5) return; // footsteps only matter when running
    if (p.distanceTo(this.pos) > radius + 8) return;
    this.state = 'investigate';
    this.investigateT = 5;
    this.investigatePos.copy(p);
    this.targetS = this.nearestS(p);
    this.g.audio.play('scan_ping', { pos: this.pos, volume: 0.5 });
  }

  private place(): void {
    this.pointAt(this.s, this.pos);
    this.group.position.copy(this.pos);
  }

  update(dt: number): void {
    const g = this.g;
    if (this.state === 'off') {
      this.head.rotation.x += (1.2 - this.head.rotation.x) * Math.min(1, dt * 2);
      this.cone.visible = false;
      return;
    }
    // movement along the rail
    let moving = true;
    if (this.state === 'patrol') {
      this.s += this.dir * this.speed * dt;
    } else if (this.state === 'investigate') {
      let d = this.targetS - this.s;
      if (Math.abs(d) > this.total / 2) d -= Math.sign(d) * this.total;
      if (Math.abs(d) > 0.2) this.s += Math.sign(d) * Math.min(Math.abs(d), this.speed * 1.6 * dt);
      else moving = false;
      this.investigateT -= dt;
      if (this.investigateT <= 0) this.state = 'patrol';
    } else moving = false;
    const prev = this.pos.clone();
    this.place();
    const vel = this.pos.clone().sub(prev);
    if (vel.lengthSq() > 1e-6) this.group.rotation.y = Math.atan2(vel.x, vel.z);
    // aim the head
    this.sweepT += dt;
    const fwd = new THREE.Vector3(Math.sin(this.group.rotation.y), 0, Math.cos(this.group.rotation.y));
    const side = new THREE.Vector3(fwd.z, 0, -fwd.x);
    let aimTarget: THREE.Vector3;
    if (this.state === 'investigate') aimTarget = this.investigatePos.clone();
    else if (this.state === 'alert') aimTarget = g.player.pos.clone().setY(g.player.pos.y + 1);
    else aimTarget = this.pos.clone().addScaledVector(fwd, 4).addScaledVector(side, Math.sin(this.sweepT * 0.7) * 3.5).setY(this.pos.y - 7);
    this.aim.lerp(aimTarget, Math.min(1, dt * (this.state === 'patrol' ? 2 : 4)));
    const headPos = this.head.getWorldPosition(new THREE.Vector3());
    this.head.lookAt(this.aim);
    // keep the head's local orientation sane (lookAt in world space on a rotated parent)
    const dirW = this.aim.clone().sub(headPos).normalize();
    this.light.position.copy(headPos);
    this.light.targetPos.copy(this.aim);
    this.cone.position.copy(headPos);
    this.cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dirW);
    this.cone.visible = true;
    // detection
    const pl = g.player;
    const chest = pl.pos.clone().setY(pl.pos.y + (pl.crouched ? 0.7 : 1.2));
    const to = chest.clone().sub(headPos);
    const dist = to.length();
    let inBeam = false;
    if (!pl.hidden && dist < this.range && to.normalize().dot(dirW) > Math.cos(this.coneAngle)) {
      inBeam = g.world.lineOfSight(headPos, chest);
    }
    if (inBeam && !pl.god && !pl.noclip) {
      const rate = (g.flashlight.on ? 1.3 : 0.9) * (pl.crouched ? 0.65 : 1) * (1.2 - dist / this.range);
      this.suspicion = Math.min(1, this.suspicion + dt * rate * 1.1);
      if (this.state === 'patrol') {
        this.state = 'investigate';
        this.investigatePos.copy(pl.pos);
        this.targetS = this.nearestS(pl.pos);
        this.investigateT = 3;
      }
      this.investigatePos.lerp(pl.pos, Math.min(1, dt * 3));
    } else this.suspicion = Math.max(0, this.suspicion - dt * 0.35);
    this.eye.emissiveIntensity = this.suspicion * 4;
    this.coneMat.uniforms.uInt.value = 0.06 + this.suspicion * 0.12;
    (this.coneMat.uniforms.uColor.value as THREE.Color).setRGB(1, 0.94 - this.suspicion * 0.6, 0.82 - this.suspicion * 0.7);
    this.light.color.setRGB(1, 0.94 - this.suspicion * 0.5, 0.82 - this.suspicion * 0.6);
    g.renderer.fx.danger = Math.max(g.renderer.fx.danger * 0.95, this.suspicion * 0.6);
    if (this.suspicion >= 1 && this.state !== 'alert') {
      this.state = 'alert';
      g.audio.play('alarm_loop', { pos: this.pos, volume: 0.8 })?.stop(3);
      g.say('pa', 'ПОСТОРОННИЙ В ЦЕХЕ. ОСТАВАЙТЕСЬ НА МЕСТЕ.', { pos: this.pos });
      this.onAlert?.();
    }
    // sounds
    if (moving && !this.servo) this.servo = g.audio.play('motor_loop', { pos: this.pos, loop: true, volume: 0.25, rate: 1.4 });
    if (!moving && this.servo) {
      this.servo.stop(0.3);
      this.servo = null;
    }
    this.servo?.setPos(this.pos);
    this.pingT -= dt;
    if (this.pingT <= 0) {
      this.pingT = 3.5;
      g.audio.play('scan_ping', { pos: this.pos, volume: 0.25, rate: 0.9 + this.suspicion * 0.4 });
    }
  }

  reset(): void {
    this.suspicion = 0;
    if (this.state !== 'off') this.state = 'patrol';
  }
}
