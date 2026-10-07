import * as THREE from 'three';
import type { Materials } from '../assets/Materials';
import { box, cyl, extrude, ModelBuilder, rbox, sphere, torus, tube } from '../world/geom';
import { canvas } from '../assets/Signage';
import { Rng } from '../assets/noise';

/** Old Works (1962 steam workshop) props. */

/** Riveted horizontal boiler on a brick plinth; firebox glow material returned. */
export function boiler(m: Materials, len = 5, r = 1.5): { group: THREE.Group; fire: THREE.MeshStandardMaterial; gaugeNeedle: THREE.Object3D } {
  const b = new ModelBuilder();
  const shell = m.get('metal_rust_paint') as THREE.Material;
  const iron = m.painted('#2a2622', 0.7);
  b.add(box(len + 0.6, 1.0, r * 1.6), m.get('brick_old') as THREE.Material, 0, 0.5, 0);
  b.add(cyl(r, r, len, 32), shell, 0, 1.0 + r, 0, 0, 0, Math.PI / 2);
  for (const x of [-len / 2, len / 2]) b.add(cyl(r * 0.98, r * 0.98, 0.12, 32), iron, x, 1.0 + r, 0, 0, 0, Math.PI / 2);
  // rivet bands
  for (let i = 0; i < 6; i++) b.add(torus(r + 0.01, 0.03, 6, 48), iron, -len / 2 + 0.3 + i * ((len - 0.6) / 5), 1.0 + r, 0, 0, Math.PI / 2, 0);
  // firebox door with a glowing grate
  const fire = new THREE.MeshStandardMaterial({ color: 0x110500, emissive: 0xff5a10, emissiveIntensity: 0 });
  b.add(box(0.06, 0.7, 0.9), iron, len / 2 + 0.07, 1.6, 0);
  b.add(box(0.02, 0.4, 0.6), fire, len / 2 + 0.11, 1.55, 0);
  for (let i = 0; i < 5; i++) b.add(box(0.03, 0.42, 0.03), iron, len / 2 + 0.12, 1.55, -0.24 + i * 0.12);
  // chimney + steam dome + safety valve
  b.add(cyl(0.35, 0.35, 0.6, 20), shell, -len / 2 + 1.0, 1.0 + r * 2 + 0.25, 0);
  b.add(sphere(0.38, 20, 12), shell, -len / 2 + 1.0, 1.0 + r * 2 + 0.55, 0);
  b.add(cyl(0.3, 0.3, 6, 16), iron, len / 2 - 0.8, 1.0 + r * 2 + 3, 0);
  // pressure gauge
  b.add(cyl(0.22, 0.22, 0.08, 24), m.steel('#c9a34a', 0.3), len / 2 + 0.05, 2.9, 0.6, 0, 0, Math.PI / 2);
  const [gc, gg] = canvas(128, 128);
  gg.fillStyle = '#efe6cf';
  gg.beginPath();
  gg.arc(64, 64, 62, 0, Math.PI * 2);
  gg.fill();
  gg.strokeStyle = '#222';
  gg.lineWidth = 3;
  for (let i = 0; i <= 10; i++) {
    const a = Math.PI * 0.75 + (i / 10) * Math.PI * 1.5;
    gg.beginPath();
    gg.moveTo(64 + Math.cos(a) * 50, 64 + Math.sin(a) * 50);
    gg.lineTo(64 + Math.cos(a) * 58, 64 + Math.sin(a) * 58);
    gg.stroke();
  }
  gg.fillStyle = '#c0392b';
  gg.beginPath();
  gg.arc(64, 64, 52, Math.PI * 0.05, Math.PI * 0.25);
  gg.lineTo(64, 64);
  gg.fill();
  b.add(new THREE.CircleGeometry(0.2, 24), m.canvasMaterial(gc, { rough: 0.3 }), len / 2 + 0.095, 2.9, 0.6, 0, Math.PI / 2, 0);
  const needle = new THREE.Group();
  const nm = new THREE.Mesh(box(0.006, 0.16, 0.01), m.painted('#111', 0.3));
  nm.position.y = 0.07;
  needle.add(nm);
  needle.position.set(len / 2 + 0.1, 2.9, 0.6);
  needle.rotation.x = Math.PI * 0.75;
  b.group.add(needle);
  b.group.userData.colliders = [[0, 1.0 + r, 0, len / 2 + 0.3, 1.0 + r, r * 0.95]];
  b.group.userData.dynamic = true;
  return { group: b.group, fire, gaugeNeedle: needle };
}

/** Distribution board: six valve stems with number plates and a lift gauge. */
export function valveBoard(m: Materials): { group: THREE.Group; stems: THREE.Group[]; wheels: THREE.Object3D[]; needle: THREE.Object3D; lamps: THREE.MeshStandardMaterial[] } {
  const b = new ModelBuilder();
  const iron = m.painted('#2f3436', 0.6);
  const brass = m.steel('#c9a34a', 0.3);
  b.add(box(4.6, 2.4, 0.2), m.painted('#3d4a3f', 0.6), 0, 1.6, -0.1);
  b.add(box(4.4, 0.2, 0.3), iron, 0, 2.9, 0.05);
  // header pipe from the boiler
  b.add(cyl(0.12, 0.12, 4.6, 16), m.get('metal_rust') as THREE.Material, 0, 2.6, 0.2, 0, 0, Math.PI / 2);
  const stems: THREE.Group[] = [];
  const wheels: THREE.Object3D[] = [];
  const lamps: THREE.MeshStandardMaterial[] = [];
  for (let i = 0; i < 6; i++) {
    const x = -1.9 + i * 0.76;
    b.add(cyl(0.07, 0.07, 1.0, 12), m.get('metal_rust') as THREE.Material, x, 2.1, 0.2);
    b.add(rbox(0.26, 0.26, 0.26, 0.04), iron, x, 1.5, 0.22);
    const stem = new THREE.Group();
    stem.position.set(x, 1.5, 0.42);
    const sq = new THREE.Mesh(box(0.05, 0.05, 0.14), brass);
    stem.add(sq);
    const wheel = new THREE.Group();
    const rim = new THREE.Mesh(torus(0.16, 0.02, 8, 24), m.painted('#c0392b', 0.35));
    wheel.add(rim);
    for (let k = 0; k < 3; k++) {
      const sp = new THREE.Mesh(box(0.3, 0.02, 0.02), m.painted('#c0392b', 0.35));
      sp.rotation.z = (k / 3) * Math.PI;
      wheel.add(sp);
    }
    wheel.position.z = 0.08;
    wheel.visible = false;
    stem.add(wheel);
    b.group.add(stem);
    stems.push(stem);
    wheels.push(wheel);
    // plate + open/closed lamp
    const [pc, pg] = canvas(128, 64);
    pg.fillStyle = '#efe6cf';
    pg.fillRect(0, 0, 128, 64);
    pg.fillStyle = '#222';
    pg.font = "700 40px 'IBM Plex Mono', monospace";
    pg.textAlign = 'center';
    pg.fillText('В' + (i + 1), 64, 48);
    b.add(new THREE.PlaneGeometry(0.22, 0.11), m.canvasMaterial(pc, { rough: 0.6 }), x, 1.15, 0.36);
    const lm = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x40ff60, emissiveIntensity: 0 });
    b.add(sphere(0.03, 10, 8), lm, x, 1.82, 0.32);
    lamps.push(lm);
  }
  // lift pressure gauge
  b.add(cyl(0.26, 0.26, 0.08, 24), brass, 2.0, 0.65, 0.05, Math.PI / 2);
  const [gc, gg] = canvas(128, 128);
  gg.fillStyle = '#efe6cf';
  gg.beginPath();
  gg.arc(64, 64, 62, 0, Math.PI * 2);
  gg.fill();
  gg.fillStyle = '#222';
  gg.font = "700 13px 'IBM Plex Mono', monospace";
  gg.textAlign = 'center';
  gg.fillText('ПОДЪЁМНИК', 64, 98);
  gg.fillStyle = '#3fae5a';
  gg.beginPath();
  gg.arc(64, 64, 54, -Math.PI * 0.5 + 0.9, Math.PI * 0.25);
  gg.lineTo(64, 64);
  gg.fill();
  b.add(new THREE.CircleGeometry(0.24, 24), m.canvasMaterial(gc, { rough: 0.3 }), 2.0, 0.65, 0.1);
  const needle = new THREE.Group();
  const nm = new THREE.Mesh(box(0.008, 0.2, 0.01), m.painted('#111', 0.3));
  nm.position.y = 0.09;
  needle.add(nm);
  needle.position.set(2.0, 0.65, 0.11);
  needle.rotation.z = Math.PI * 0.75;
  b.group.add(needle);
  b.group.userData.dynamic = true;
  b.group.userData.colliders = [[0, 1.6, -0.05, 2.3, 1.6, 0.3]];
  return { group: b.group, stems, wheels, needle, lamps };
}

export interface MusicBoxModel {
  group: THREE.Group;
  cylinder: THREE.Object3D;
  tines: THREE.Object3D[];
  tineLamps: THREE.MeshStandardMaterial[];
  drawer: THREE.Object3D;
  crank: THREE.Object3D;
}

/** The great music box: brass pin cylinder, four giant tines, crank and a drawer. */
export function musicBoxMachine(m: Materials): MusicBoxModel {
  const b = new ModelBuilder();
  const wood = m.woodProp('#5a3a22', 0.4);
  const brass = m.steel('#c9a34a', 0.3);
  b.add(rbox(3.4, 1.1, 1.8, 0.04), wood, 0, 0.55, 0);
  for (const x of [-1.62, 1.62]) b.add(box(0.16, 1.4, 1.8), wood, x, 1.75, 0);
  b.add(box(3.4, 0.12, 1.8), wood, 0, 2.5, 0);
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, roughness: 0.05, clearcoat: 1 });
  b.add(box(3.1, 0.02, 1.7), glass, 0, 2.44, 0);
  // brass pinned cylinder
  const cylinder = new THREE.Group();
  cylinder.position.set(0, 1.55, -0.2);
  const cyl0 = new THREE.Mesh(cyl(0.38, 0.38, 2.8, 32), brass);
  cyl0.rotation.z = Math.PI / 2;
  cylinder.add(cyl0);
  const r = new Rng(31);
  for (let i = 0; i < 90; i++) {
    const pin = new THREE.Mesh(cyl(0.012, 0.012, 0.05, 5), m.steel('#e0d0a0', 0.2));
    const a = r.range(0, Math.PI * 2);
    pin.position.set(r.range(-1.3, 1.3), Math.cos(a) * 0.4, Math.sin(a) * 0.4);
    pin.rotation.x = a;
    cylinder.add(pin);
  }
  b.group.add(cylinder);
  // comb with four giant tines
  b.add(box(2.8, 0.18, 0.3), m.steel('#9aa0a6', 0.3), 0, 1.25, 0.45);
  const tines: THREE.Object3D[] = [];
  const tineLamps: THREE.MeshStandardMaterial[] = [];
  for (let i = 0; i < 4; i++) {
    const x = -1.05 + i * 0.7;
    const t = new THREE.Group();
    t.position.set(x, 1.3, 0.4);
    const blade = new THREE.Mesh(box(0.22, 0.04, 0.9 - i * 0.1), m.steel('#c0c4c8', 0.15));
    blade.position.z = -(0.45 - i * 0.05);
    t.add(blade);
    b.group.add(t);
    tines.push(t);
    const lm = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xffffff, emissiveIntensity: 1.2 });
    b.add(sphere(0.05, 12, 8), lm, x, 1.15, 0.92);
    tineLamps.push(lm);
  }
  // crank on the right
  const crank = new THREE.Group();
  crank.position.set(1.72, 1.55, -0.2);
  const arm = new THREE.Mesh(box(0.06, 0.5, 0.06), brass);
  arm.position.y = -0.22;
  crank.add(arm);
  const hnd = new THREE.Mesh(cyl(0.04, 0.04, 0.2, 10), wood);
  hnd.rotation.z = Math.PI / 2;
  hnd.position.set(0.1, -0.45, 0);
  crank.add(hnd);
  b.group.add(crank);
  // drawer at the front
  const drawer = new THREE.Group();
  drawer.position.set(0, 0.45, 0.88);
  const dbox = new THREE.Mesh(box(1.0, 0.3, 0.6), m.woodProp('#6e4527', 0.4));
  dbox.position.z = -0.3;
  drawer.add(dbox);
  const knob = new THREE.Mesh(sphere(0.04, 10, 8), brass);
  knob.position.set(0, 0, 0.02);
  drawer.add(knob);
  b.group.add(drawer);
  b.group.userData.colliders = [[0, 1.3, 0, 1.75, 1.3, 0.92]];
  b.group.userData.dynamic = true;
  return { group: b.group, cylinder, tines, tineLamps, drawer, crank };
}

/** Wall-mounted CCTV camera (2009, Ликвидком) with a red LED and a pivoting head. */
export function securityCam(m: Materials): { group: THREE.Group; head: THREE.Group; led: THREE.MeshStandardMaterial } {
  const b = new ModelBuilder();
  b.add(box(0.12, 0.16, 0.06), m.painted('#d8d6cf', 0.5), 0, 0, 0.03);
  b.add(cyl(0.02, 0.02, 0.2, 8), m.painted('#d8d6cf', 0.5), 0, 0, 0.14, Math.PI / 2);
  const head = new THREE.Group();
  head.position.set(0, -0.04, 0.24);
  const body = new THREE.Mesh(rbox(0.12, 0.12, 0.3, 0.02), m.painted('#e8e6df', 0.4));
  body.position.z = 0.05;
  head.add(body);
  const lens = new THREE.Mesh(cyl(0.04, 0.04, 0.02, 16), new THREE.MeshPhysicalMaterial({ color: 0x111822, roughness: 0.05, clearcoat: 1 }));
  lens.rotation.x = Math.PI / 2;
  lens.position.z = 0.21;
  head.add(lens);
  const led = new THREE.MeshStandardMaterial({ color: 0x200000, emissive: 0xff2010, emissiveIntensity: 0 });
  const ledM = new THREE.Mesh(sphere(0.012, 8, 6), led);
  ledM.position.set(0.04, 0.05, 0.19);
  head.add(ledM);
  b.group.add(head);
  b.group.userData.dynamic = true;
  return { group: b.group, head, led };
}

/** Overhead line shaft with pulleys and leather belts running down to the benches. */
export function lineShaft(m: Materials, len: number, h: number, belts = 5): THREE.Group {
  const b = new ModelBuilder();
  const iron = m.painted('#2a2622', 0.6);
  b.add(cyl(0.05, 0.05, len, 12), m.steel('#6a6e70', 0.5), 0, h, 0, Math.PI / 2);
  for (let i = 0; i <= Math.floor(len / 4); i++) {
    const z = -len / 2 + i * 4;
    b.add(box(0.1, 0.8, 0.1), iron, 0, h + 0.4, z);
    b.add(box(0.3, 0.1, 0.2), iron, 0, h + 0.05, z);
  }
  const leather = m.cloth('#4a2c18', 0.6);
  for (let i = 0; i < belts; i++) {
    const z = -len / 2 + (i + 0.5) * (len / belts);
    b.add(cyl(0.22, 0.22, 0.14, 20), iron, 0, h, z, Math.PI / 2);
    b.add(box(0.1, h - 1.0, 0.012), leather, 0.0, (h + 1.0) / 2, z - 0.22, 0, 0, 0.12);
    b.add(box(0.1, h - 1.0, 0.012), leather, 0.0, (h + 1.0) / 2, z + 0.22, 0, 0, -0.12);
  }
  return b.group;
}

/** Shelving packed with silent Verity toys, all facing +z (the door). */
export function silentShelf(m: Materials, len: number, seed = 1): THREE.Group {
  const b = new ModelBuilder();
  const frame = m.painted('#7d8a8c', 0.55);
  const H = 2.4;
  for (let x = -len / 2; x <= len / 2 + 0.01; x += len / Math.ceil(len / 1.2)) b.add(box(0.04, H, 0.04), frame, x, H / 2, 0.25);
  for (let x = -len / 2; x <= len / 2 + 0.01; x += len / Math.ceil(len / 1.2)) b.add(box(0.04, H, 0.04), frame, x, H / 2, -0.25);
  const levels = [0.1, 0.7, 1.3, 1.9];
  for (const y of levels) b.add(box(len, 0.03, 0.55), frame, 0, y, 0);
  const r = new Rng(seed);
  // cheap silent toys (hundreds of them): low-poly ball, belt, dead eyes
  const bodies = ['#f4d35e', '#e8c65a', '#d9b84e', '#ef8a7e'].map((c) => m.plastic(c, 0.55));
  const belt = m.plastic('#2fa79b', 0.5);
  const eye = m.plastic('#f2efe6', 0.3);
  const pupil = m.flat('#111111', 0.4, 0);
  const ball = new THREE.SphereGeometry(0.1, 10, 8);
  const ring = new THREE.TorusGeometry(0.095, 0.012, 4, 14);
  const eyeG = new THREE.CircleGeometry(0.026, 8);
  const pupG = new THREE.CircleGeometry(0.011, 6);
  for (const y of levels) {
    let x = -len / 2 + 0.16;
    while (x < len / 2 - 0.12) {
      const s = r.range(0.9, 1.25);
      const tg = new THREE.Group();
      tg.add(new THREE.Mesh(ball, bodies[r.int(0, 3)]));
      const rg = new THREE.Mesh(ring, belt);
      rg.rotation.x = Math.PI / 2;
      rg.position.y = -0.03;
      tg.add(rg);
      for (const sx of [-0.035, 0.035]) {
        const e = new THREE.Mesh(eyeG, eye);
        e.position.set(sx, 0.025, 0.097);
        tg.add(e);
        const pp = new THREE.Mesh(pupG, pupil);
        pp.position.set(sx, 0.022, 0.099);
        tg.add(pp);
      }
      tg.scale.setScalar(s);
      tg.position.set(x, y + 0.015 + 0.1 * s, r.range(-0.06, 0.06));
      tg.rotation.y = r.range(-0.12, 0.12);
      if (r.next() < 0.08) tg.rotation.z = r.range(-0.6, 0.6);
      b.group.add(tg);
      x += 0.22 * s + 0.02;
    }
  }
  b.group.userData.colliders = [[0, H / 2, 0, len / 2 + 0.03, H / 2, 0.3]];
  return b.group;
}

/** Tin toys on a bench: robot, car, bear. */
export function tinToy(m: Materials, kind: 'robot' | 'car' | 'bear', seed = 1): THREE.Group {
  const b = new ModelBuilder();
  const r = new Rng(seed);
  const col = m.steel(['#b8322a', '#2f5d8a', '#c9a34a', '#3fae5a'][r.int(0, 3)], 0.5);
  if (kind === 'robot') {
    b.add(rbox(0.12, 0.16, 0.08, 0.01), col, 0, 0.14, 0);
    b.add(rbox(0.09, 0.08, 0.08, 0.01), col, 0, 0.27, 0);
    for (const sx of [-0.035, 0.035]) b.add(box(0.03, 0.06, 0.03), m.steel('#888', 0.4), sx, 0.03, 0);
    for (const sx of [-0.08, 0.08]) b.add(box(0.025, 0.1, 0.025), col, sx, 0.15, 0);
    for (const sx of [-0.02, 0.02]) b.add(sphere(0.01, 6, 4), m.emissive('#ffcc66', 0.6), sx, 0.28, 0.042);
  } else if (kind === 'car') {
    b.add(rbox(0.22, 0.06, 0.1, 0.02), col, 0, 0.05, 0);
    b.add(rbox(0.12, 0.05, 0.09, 0.02), col, -0.02, 0.1, 0);
    for (const [x, z] of [[-0.07, 0.05], [0.07, 0.05], [-0.07, -0.05], [0.07, -0.05]]) b.add(cyl(0.022, 0.022, 0.015, 10), m.rubber(), x, 0.022, z, Math.PI / 2);
  } else {
    b.add(sphere(0.07, 12, 10), col, 0, 0.09, 0).scale.set(1, 1.2, 0.8);
    b.add(sphere(0.05, 12, 10), col, 0, 0.2, 0);
    for (const sx of [-0.035, 0.035]) b.add(sphere(0.018, 8, 6), col, sx, 0.25, 0);
    b.add(box(0.015, 0.06, 0.015), m.steel('#c9a34a', 0.3), 0, 0.12, -0.07);
  }
  return b.group;
}

/** Pile of fallen bricks and beams blocking a passage. */
export function rubble(m: Materials, w: number, seed = 1): THREE.Group {
  const b = new ModelBuilder();
  const r = new Rng(seed);
  const brick = m.get('brick_old') as THREE.Material;
  for (let i = 0; i < 40; i++) {
    const s = r.range(0.2, 0.6);
    b.add(box(s, s * 0.6, s * 0.8), brick, r.range(-w / 2, w / 2), r.range(0, 1.6) * (1 - Math.abs(r.range(-1, 1)) * 0.5), r.range(-0.6, 0.6), r.range(0, 1), r.range(0, 3), r.range(0, 1));
  }
  for (let i = 0; i < 3; i++) b.add(box(w * 1.1, 0.2, 0.22), m.woodProp('#3a2a1c', 0.6), 0, 0.6 + i * 0.6, r.range(-0.3, 0.3), r.range(-0.2, 0.2), r.range(-0.3, 0.3), r.range(-0.4, 0.4));
  return b.group;
}

/** A child's bed with a star headboard. */
export function kidsBed(m: Materials): THREE.Group {
  const b = new ModelBuilder();
  const wood = m.woodProp('#c9a36a', 0.4);
  b.add(box(1.0, 0.3, 1.8), wood, 0, 0.25, 0);
  b.add(rbox(0.94, 0.14, 1.72, 0.04), m.cloth('#f7f2e6', 0.3), 0, 0.46, 0);
  b.add(rbox(0.96, 0.06, 1.2, 0.03), m.cloth('#3a6fd0', 0.4), 0, 0.55, 0.25);
  b.add(rbox(0.5, 0.1, 0.3, 0.04), m.cloth('#f7f2e6', 0.3), 0, 0.58, -0.65);
  b.add(box(1.0, 0.9, 0.06), wood, 0, 0.55, -0.9);
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? 0.08 : 0.18;
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    if (i === 0) s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    else s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  s.closePath();
  b.add(extrude(s, 0.04, 0.01), m.plastic('#f4d35e', 0.3), 0, 1.1, -0.9);
  b.add(tube([new THREE.Vector3(-0.4, 0.5, 0.9), new THREE.Vector3(-0.42, 0.25, 0.92), new THREE.Vector3(-0.38, 0.02, 0.95)], 0.012, 10, 4), m.cloth('#3a6fd0', 0.4));
  return b.group;
}

/** A camp: sleeping bag, lantern (bulb returned), thermos, gas stove. */
export function camp(m: Materials): { group: THREE.Group; bulb: THREE.MeshStandardMaterial } {
  const b = new ModelBuilder();
  b.add(rbox(0.8, 0.14, 1.9, 0.06), m.cloth('#3a5a4a', 0.5), 0, 0.07, 0);
  b.add(rbox(0.5, 0.12, 0.3, 0.05), m.cloth('#7a6a5a', 0.5), 0, 0.17, -0.75);
  const bulb = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xffc070, emissiveIntensity: 2 });
  b.add(cyl(0.07, 0.08, 0.04, 12), m.painted('#2a2e31', 0.4), 0.7, 0.02, -0.5);
  b.add(cyl(0.06, 0.06, 0.16, 12, 0.5, true), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.25, roughness: 0.1 }), 0.7, 0.12, -0.5);
  b.add(sphere(0.03, 8, 6), bulb, 0.7, 0.12, -0.5);
  b.add(cyl(0.07, 0.07, 0.03, 12), m.painted('#2a2e31', 0.4), 0.7, 0.215, -0.5);
  b.add(cyl(0.04, 0.04, 0.26, 12), m.steel('#5a7a6a', 0.4), 0.62, 0.13, 0.1);
  b.add(cyl(0.12, 0.13, 0.08, 16), m.painted('#3a3f42', 0.5), 0.7, 0.04, 0.5);
  b.add(cyl(0.1, 0.09, 0.08, 16), m.steel('#8a8e91', 0.4), 0.7, 0.12, 0.5);
  return { group: b.group, bulb };
}
