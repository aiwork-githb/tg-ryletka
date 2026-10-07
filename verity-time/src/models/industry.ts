import * as THREE from 'three';
import type { Materials } from '../assets/Materials';
import { box, cyl, extrude, ModelBuilder, rbox, sphere, tube } from '../world/geom';
import { canvas, sign } from '../assets/Signage';
import { Rng } from '../assets/noise';
import { star } from '../assets/recipes';

/** Belt conveyor along +x from 0 to len. The belt material scrolls. */
export function conveyor(m: Materials, len: number, width = 0.8, h = 0.85, rail = '#d4a32a'): { group: THREE.Group; belt: THREE.MeshStandardMaterial } {
  const b = new ModelBuilder();
  const railM = m.painted(rail, 0.6);
  const legM = m.painted('#3a3f42', 0.6);
  const beltBase = m.rubber('#1e1e20');
  const belt = beltBase.clone();
  belt.map = beltBase.map!.clone();
  belt.map.needsUpdate = true;
  belt.map.wrapS = belt.map.wrapT = THREE.RepeatWrapping;
  const bg = new THREE.BoxGeometry(len, 0.04, width);
  const uv = bg.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * len * 1.5, uv.getY(i) * width * 1.5);
  b.add(bg, belt, len / 2, h, 0);
  for (const z of [-width / 2 - 0.04, width / 2 + 0.04]) b.add(box(len, 0.16, 0.06), railM, len / 2, h - 0.02, z);
  for (let x = 0.3; x < len; x += 1.6)
    for (const z of [-width / 2, width / 2]) b.add(box(0.06, h - 0.06, 0.06), legM, x, (h - 0.06) / 2, z);
  for (const x of [0.05, len - 0.05]) b.add(cyl(0.07, 0.07, width + 0.05, 12), m.steel('#8a8e91', 0.4), x, h - 0.03, 0, Math.PI / 2);
  b.group.userData.colliders = [[len / 2, h / 2, 0, len / 2, h / 2, width / 2 + 0.08]];
  return { group: b.group, belt };
}

export function moldingMachine(m: Materials): THREE.Group {
  const b = new ModelBuilder();
  const body = m.painted('#4e6b6f', 0.55);
  const yellow = m.painted('#d4a32a', 0.6);
  b.add(rbox(2.6, 1.6, 1.4, 0.04), body, 0, 0.8, 0);
  b.add(rbox(1.2, 0.9, 1.2, 0.03), body, -0.4, 2.05, 0);
  // hopper funnel
  const hop = new THREE.CylinderGeometry(0.45, 0.12, 0.9, 16, 1, true);
  b.add(hop, m.painted('#8a8e91', 0.5), -0.4, 2.95, 0).material = m.painted('#8a8e91', 0.5);
  // press with mold halves
  b.add(box(0.7, 0.9, 0.9), yellow, 0.9, 1.45, 0);
  b.add(cyl(0.08, 0.08, 1.2, 10), m.steel('#c0c4c8', 0.2), 0.9, 2.3, 0);
  b.add(box(0.5, 0.06, 0.5), m.steel('#9aa0a6', 0.3), 0.9, 1.92, 0);
  // control box
  b.add(rbox(0.5, 0.7, 0.3, 0.02), m.painted('#d8d6cf', 0.5), 1.1, 0.9, 0.78);
  for (let i = 0; i < 3; i++) b.add(cyl(0.025, 0.025, 0.02, 10), m.plastic(['#c0392b', '#27ae60', '#f1c40f'][i], 0.3), 1.0 + i * 0.1, 1.05, 0.94, Math.PI / 2);
  b.add(tube([new THREE.Vector3(-1.2, 1.4, 0.6), new THREE.Vector3(-1.5, 1.8, 0.7), new THREE.Vector3(-1.4, 3.0, 0.5)], 0.05, 16, 8), m.rubber('#222'));
  // warning stripe
  const st = stripes();
  const sm = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.15), m.canvasMaterial(st));
  sm.position.set(0, 0.12, 0.705);
  b.group.add(sm);
  b.group.userData.colliders = [[0, 1.2, 0, 1.3, 1.2, 0.72]];
  return b.group;
}

let stripesC: HTMLCanvasElement | null = null;
export function stripes(): HTMLCanvasElement {
  if (stripesC) return stripesC;
  const [c, g] = canvas(512, 32);
  g.fillStyle = '#f1c40f';
  g.fillRect(0, 0, 512, 32);
  g.fillStyle = '#111';
  for (let i = -2; i < 40; i++) {
    g.beginPath();
    g.moveTo(i * 24, 32);
    g.lineTo(i * 24 + 12, 32);
    g.lineTo(i * 24 + 36, 0);
    g.lineTo(i * 24 + 24, 0);
    g.fill();
  }
  stripesC = c;
  return c;
}

export function robotArm(m: Materials, pose = 0): THREE.Group {
  const b = new ModelBuilder();
  const orange = m.painted('#d9772b', 0.45);
  const dark = m.painted('#2a2c2e', 0.4);
  b.add(cyl(0.35, 0.42, 0.3, 20), dark, 0, 0.15, 0);
  const base = new THREE.Group();
  base.position.y = 0.3;
  base.rotation.y = pose;
  b.group.add(base);
  const m1 = new THREE.Mesh(cyl(0.25, 0.3, 0.4, 16), orange);
  m1.position.y = 0.2;
  base.add(m1);
  const shoulder = new THREE.Group();
  shoulder.position.y = 0.45;
  shoulder.rotation.z = -0.6;
  base.add(shoulder);
  const a1 = new THREE.Mesh(rbox(0.22, 1.1, 0.22, 0.05), orange);
  a1.position.y = 0.55;
  shoulder.add(a1);
  const elbow = new THREE.Group();
  elbow.position.y = 1.1;
  elbow.rotation.z = 1.5;
  shoulder.add(elbow);
  elbow.add(new THREE.Mesh(cyl(0.15, 0.15, 0.3, 14), dark).rotateX(Math.PI / 2));
  const a2 = new THREE.Mesh(rbox(0.16, 0.9, 0.16, 0.04), orange);
  a2.position.y = 0.45;
  elbow.add(a2);
  const wrist = new THREE.Group();
  wrist.position.y = 0.9;
  elbow.add(wrist);
  wrist.add(new THREE.Mesh(cyl(0.08, 0.08, 0.15, 10), dark));
  for (const x of [-0.06, 0.06]) {
    const f = new THREE.Mesh(box(0.03, 0.16, 0.06), m.steel('#9aa0a6', 0.3));
    f.position.set(x, 0.14, 0);
    wrist.add(f);
  }
  b.group.traverse((o) => ((o as THREE.Mesh).castShadow = true));
  b.group.userData.colliders = [[0, 0.5, 0, 0.42, 0.5, 0.42]];
  return b.group;
}

/** Flipper that diverts boxes; returns the pivot so it can be animated. */
export function diverter(m: Materials, len = 0.9): { group: THREE.Group; pivot: THREE.Group } {
  const b = new ModelBuilder();
  b.add(cyl(0.06, 0.06, 0.5, 10), m.painted('#3a3f42', 0.5), 0, 1.05, 0);
  const pivot = new THREE.Group();
  pivot.position.y = 1.0;
  b.group.add(pivot);
  const arm = new THREE.Mesh(rbox(len, 0.18, 0.05, 0.02), m.painted('#c0392b', 0.45));
  arm.position.x = len / 2;
  arm.castShadow = true;
  pivot.add(arm);
  return { group: b.group, pivot };
}

export function controlConsole(m: Materials, w = 1.4): THREE.Group {
  const b = new ModelBuilder();
  const body = m.painted('#5a6a6c', 0.5);
  b.add(box(w, 0.9, 0.6), body, 0, 0.45, 0);
  b.add(box(w, 0.08, 0.7), body, 0, 0.95, -0.05, -0.35);
  b.add(box(w - 0.1, 0.02, 0.6), m.painted('#d8d6cf', 0.4), 0, 0.99, -0.05, -0.35);
  return b.group;
}

export function gauge(m: Materials, label = 'бар', max = 10, redFrom = 8): { group: THREE.Group; needle: THREE.Object3D } {
  const b = new ModelBuilder();
  b.add(cyl(0.11, 0.11, 0.05, 24), m.steel('#9aa0a6', 0.4), 0, 0, 0.025, Math.PI / 2);
  const [c, g] = canvas(256, 256);
  g.fillStyle = '#f2efe6';
  g.beginPath();
  g.arc(128, 128, 124, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#222';
  g.lineWidth = 3;
  g.textAlign = 'center';
  for (let v = 0; v <= max; v++) {
    const a = -Math.PI * 0.75 + (v / max) * Math.PI * 1.5 - Math.PI / 2;
    g.beginPath();
    g.moveTo(128 + Math.cos(a) * 92, 128 + Math.sin(a) * 92);
    g.lineTo(128 + Math.cos(a) * 112, 128 + Math.sin(a) * 112);
    g.stroke();
    g.fillStyle = v >= redFrom ? '#c0392b' : '#222';
    g.font = "600 20px 'IBM Plex Mono', monospace";
    g.fillText(String(v), 128 + Math.cos(a) * 72, 134 + Math.sin(a) * 72);
  }
  g.font = "600 20px 'IBM Plex Sans', sans-serif";
  g.fillStyle = '#222';
  g.fillText(label, 128, 200);
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.1, 24), m.canvasMaterial(c, { rough: 0.3 }));
  face.position.z = 0.052;
  b.group.add(face);
  const needle = new THREE.Group();
  needle.position.z = 0.056;
  const n = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.08, 0.003), new THREE.MeshStandardMaterial({ color: 0xaa1111 }));
  n.position.y = 0.04;
  needle.add(n);
  b.group.add(needle);
  return { group: b.group, needle };
}

export function paintTank(m: Materials, color: string, label: string): { group: THREE.Group; wheel: THREE.Group } {
  const b = new ModelBuilder();
  const steel = m.steel('#9aa0a6', 0.5);
  b.add(cyl(0.45, 0.45, 1.6, 24), m.painted('#d8d6cf', 0.6), 0, 1.1, 0);
  b.add(new THREE.SphereGeometry(0.45, 24, 8, 0, Math.PI * 2, 0, Math.PI / 2), m.painted('#d8d6cf', 0.6), 0, 1.9, 0);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.3;
    b.add(cyl(0.04, 0.04, 0.5, 8), steel, Math.cos(a) * 0.38, 0.25, Math.sin(a) * 0.38);
  }
  // colour band and label
  b.add(cyl(0.455, 0.455, 0.25, 24, 0.5, true), m.painted(color, 0.4), 0, 1.4, 0);
  const lab = sign(label, { bg: '#f2efe6', fg: '#111', w: 384, h: 96 });
  const lm = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.125), m.canvasMaterial(lab));
  lm.position.set(0, 1.05, 0.455);
  b.group.add(lm);
  // outlet pipe + valve
  b.add(cyl(0.05, 0.05, 0.6, 10), steel, 0, 0.55, 0.55, Math.PI / 2);
  const wheel = new THREE.Group();
  wheel.position.set(0, 0.55, 0.9);
  const w = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.015, 8, 24), m.painted('#a52a22', 0.5));
  wheel.add(w);
  for (let i = 0; i < 3; i++) {
    const sp = new THREE.Mesh(cyl(0.008, 0.008, 0.24, 6), m.painted('#a52a22', 0.5));
    sp.rotation.z = (i / 3) * Math.PI;
    wheel.add(sp);
  }
  b.group.add(wheel);
  b.group.userData.colliders = [[0, 1.2, 0, 0.46, 1.2, 0.46]];
  return { group: b.group, wheel };
}

export function paintVat(m: Materials): { group: THREE.Group; liquid: THREE.MeshStandardMaterial } {
  const b = new ModelBuilder();
  const prof = new THREE.LatheGeometry(
    [
      [0.7, 0],
      [0.75, 0.05],
      [0.8, 1.0],
      [0.85, 1.05],
      [0.82, 1.08],
      [0.74, 1.04],
      [0.7, 0.1],
    ].map(([x, y]) => new THREE.Vector2(x, y)),
    32,
  );
  b.add(prof, m.steel('#a7a9ab', 0.6));
  const liquid = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.15, metalness: 0 });
  b.add(new THREE.CircleGeometry(0.76, 32), liquid, 0, 0.85, 0, -Math.PI / 2);
  // mixer paddle
  b.add(cyl(0.03, 0.03, 1.6, 8), m.steel('#c0c4c8', 0.3), 0, 1.4, 0);
  b.add(rbox(0.5, 0.25, 0.25, 0.04), m.painted('#3a3f42', 0.5), 0, 2.2, 0);
  b.group.userData.colliders = [[0, 0.55, 0, 0.82, 0.55, 0.82]];
  return { group: b.group, liquid };
}

export function palletRack(m: Materials, w = 2.8, h = 4.5, d = 1.1, levels = 3, seed = 1): THREE.Group {
  const b = new ModelBuilder();
  const blue = m.painted('#2f5d8a', 0.6);
  const orange = m.painted('#d9772b', 0.5);
  for (const x of [-w / 2, w / 2])
    for (const z of [-d / 2, d / 2]) b.add(box(0.08, h, 0.08), blue, x, h / 2, z);
  const rng = new Rng(seed);
  for (let i = 0; i < levels; i++) {
    const y = 0.15 + (i * (h - 0.3)) / levels;
    for (const z of [-d / 2, d / 2]) b.add(box(w, 0.1, 0.06), orange, 0, y, z);
    // pallet with boxes
    if (rng.next() < 0.85) {
      b.add(box(w * 0.85, 0.12, d * 0.9), m.woodProp('#a88a5c', 0.7), 0, y + 0.11, 0);
      const n = rng.int(2, 6);
      for (let k = 0; k < n; k++) {
        const bw = rng.range(0.4, 0.7);
        const bh = rng.range(0.3, 0.6);
        b.add(box(bw, bh, rng.range(0.4, 0.8), 1), m.get('cardboard') as THREE.Material, -w * 0.35 + (k % 3) * (w * 0.33) + rng.range(-0.05, 0.05), y + 0.17 + bh / 2 + Math.floor(k / 3) * 0.6, rng.range(-0.15, 0.15), 0, rng.range(-0.15, 0.15), 0);
      }
    }
  }
  b.group.userData.colliders = [[0, h / 2, 0, w / 2 + 0.04, h / 2, d / 2 + 0.04]];
  return b.group;
}

export function forklift(m: Materials): THREE.Group {
  const b = new ModelBuilder();
  const y = m.painted('#e0a92a', 0.6);
  const dark = m.painted('#2a2c2e', 0.5);
  b.add(rbox(1.2, 0.9, 2.0, 0.08), y, 0, 0.75, 0);
  b.add(rbox(1.1, 0.4, 0.6, 0.06), dark, 0, 1.3, 0.5);
  for (const x of [-0.5, 0.5]) for (const z of [-0.65, 0.65]) b.add(cyl(0.3, 0.3, 0.25, 16), m.rubber('#151515'), x * 1.25, 0.3, z, 0, 0, Math.PI / 2);
  for (const x of [-0.45, 0.45]) {
    b.add(box(0.06, 2.6, 0.08), dark, x, 1.5, -1.1);
    b.add(box(0.12, 0.05, 1.0), dark, x * 0.7, 0.12, -1.6);
  }
  for (const x of [-0.5, 0.5]) for (const z of [-0.35, 0.65]) b.add(cyl(0.025, 0.025, 1.0, 6), dark, x, 1.95, z);
  b.add(box(1.1, 0.05, 1.2), dark, 0, 2.45, 0.15);
  b.group.userData.colliders = [[0, 0.8, -0.2, 0.65, 0.8, 1.4]];
  return b.group;
}

export function toyBin(m: Materials, kind: 'heads' | 'eyes' | 'shells' = 'heads', seed = 1): THREE.Group {
  const b = new ModelBuilder();
  b.add(rbox(1.2, 0.7, 0.9, 0.03), m.painted('#5a6a6c', 0.6), 0, 0.35, 0);
  b.add(box(1.1, 0.02, 0.8), m.painted('#2a2c2e', 0.5), 0, 0.69, 0);
  const rng = new Rng(seed);
  const white = new THREE.MeshPhysicalMaterial({ color: 0xfbfaf6, roughness: 0.15, clearcoat: 1 });
  const iris = new THREE.MeshStandardMaterial({ color: 0x1f6f9f, roughness: 0.2 });
  for (let i = 0; i < 22; i++) {
    const x = rng.range(-0.48, 0.48);
    const z = rng.range(-0.33, 0.33);
    const yy = 0.72 + rng.range(0, 0.12);
    if (kind === 'eyes') {
      const e = b.add(sphere(0.06, 14, 10), white, x, yy, z);
      e.rotation.set(rng.range(0, 6), rng.range(0, 6), 0);
      const ir = new THREE.Mesh(new THREE.CircleGeometry(0.035, 16), iris);
      ir.position.z = 0.058;
      e.add(ir);
    } else if (kind === 'shells') {
      b.add(new THREE.SphereGeometry(0.16, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), m.plastic(rng.next() < 0.5 ? '#f4d35e' : '#f59a86', 0.4), x, yy, z, rng.range(0, 3), rng.range(0, 3), 0);
    } else {
      b.add(sphere(0.12, 14, 10), m.plastic('#f4d35e', 0.5), x, yy + 0.05, z);
    }
  }
  b.group.userData.colliders = [[0, 0.4, 0, 0.62, 0.4, 0.47]];
  return b.group;
}

/** Ceiling I-beam rail along a closed polyline. */
export function rail(m: Materials, pts: THREE.Vector3[], closed = true): THREE.Group {
  const b = new ModelBuilder();
  const mat = m.painted('#3a3f42', 0.6);
  const n = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const c = pts[(i + 1) % pts.length];
    const len = a.distanceTo(c);
    const ang = Math.atan2(c.z - a.z, c.x - a.x);
    const mid = a.clone().add(c).multiplyScalar(0.5);
    for (const [hy, hh] of [
      [0.12, 0.03],
      [0, 0.18],
      [-0.12, 0.03],
    ]) {
      const g = new THREE.BoxGeometry(len + 0.1, hh, hy === 0 ? 0.03 : 0.16);
      const mesh = b.add(g, mat);
      mesh.position.set(mid.x, mid.y + hy, mid.z);
      mesh.rotation.y = -ang;
    }
    // hangers
    for (let k = 0; k <= Math.floor(len / 3); k++) {
      const p = a.clone().lerp(c, k / Math.max(1, Math.floor(len / 3)));
      b.add(cyl(0.02, 0.02, 1.2, 6), m.steel('#5a5f62', 0.6), p.x, p.y + 0.75, p.z);
    }
  }
  return b.group;
}

/** The WARDEN: rail-hung security unit with a searchlight head. */
export function wardenModel(m: Materials): { group: THREE.Group; head: THREE.Group; lens: THREE.MeshStandardMaterial; eye: THREE.MeshStandardMaterial } {
  const b = new ModelBuilder();
  const white = m.painted('#d8d6cf', 0.45);
  const dark = m.painted('#2a2c2e', 0.4);
  // trolley on the rail
  b.add(rbox(0.6, 0.25, 0.35, 0.04), dark, 0, 0, 0);
  for (const x of [-0.2, 0.2]) b.add(cyl(0.06, 0.06, 0.4, 12), m.steel('#9aa0a6', 0.3), x, 0.1, 0, Math.PI / 2);
  // telescopic neck
  b.add(cyl(0.05, 0.06, 0.6, 12), m.steel('#9aa0a6', 0.4), 0, -0.4, 0);
  b.add(cyl(0.07, 0.07, 0.12, 12), dark, 0, -0.7, 0);
  // body: rounded capsule with a ticket-slot "mouth" and a badge
  b.add(rbox(0.5, 0.55, 0.42, 0.14, 4), white, 0, -1.05, 0);
  b.add(box(0.3, 0.03, 0.02), new THREE.MeshStandardMaterial({ color: 0x050505 }), 0, -1.15, 0.212);
  const [bc, bg] = canvas(128, 128);
  bg.fillStyle = '#c0392b';
  bg.beginPath();
  bg.arc(64, 64, 60, 0, Math.PI * 2);
  bg.fill();
  bg.fillStyle = '#fff';
  bg.font = "700 34px 'IBM Plex Sans', sans-serif";
  bg.textAlign = 'center';
  bg.fillText('С-7', 64, 76);
  const badge = new THREE.Mesh(new THREE.CircleGeometry(0.06, 20), m.canvasMaterial(bc));
  badge.position.set(0.15, -0.92, 0.212);
  b.group.add(badge);
  // arms folded
  for (const x of [-0.29, 0.29]) {
    b.add(cyl(0.035, 0.035, 0.45, 8), dark, x, -1.15, 0.05, 0.4);
    b.add(rbox(0.08, 0.1, 0.12, 0.03), white, x, -1.38, 0.15);
  }
  // searchlight head (aimable)
  const head = new THREE.Group();
  head.position.set(0, -1.42, 0);
  b.group.add(head);
  const hm = new THREE.Mesh(cyl(0.16, 0.12, 0.3, 20), dark);
  hm.rotation.x = Math.PI / 2;
  head.add(hm);
  const lens = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xfff0d0, emissiveIntensity: 3 });
  const lm = new THREE.Mesh(new THREE.CircleGeometry(0.14, 20), lens);
  lm.position.z = 0.152;
  head.add(lm);
  const eye = new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff2010, emissiveIntensity: 0 });
  const em = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), eye);
  em.position.set(0, 0.12, 0.1);
  head.add(em);
  b.group.traverse((o) => ((o as THREE.Mesh).castShadow = true));
  return { group: b.group, head, lens, eye };
}

export function freightLift(m: Materials): { group: THREE.Group; gate: THREE.Group } {
  const b = new ModelBuilder();
  const cage = m.painted('#4a5254', 0.6);
  const floor = m.get('diamond_plate') as THREE.Material;
  b.add(box(3.2, 0.12, 3.2), floor, 0, 0.06, 0);
  for (const x of [-1.6, 1.6]) b.add(box(0.08, 3, 0.08), cage, x, 1.5, 1.6);
  for (const x of [-1.6, 1.6]) b.add(box(0.08, 3, 0.08), cage, x, 1.5, -1.6);
  b.add(box(3.2, 0.08, 3.2), cage, 0, 3.0, 0);
  const grate = m.get('grate') as THREE.Material;
  b.add(new THREE.PlaneGeometry(3.2, 2.9), grate, 0, 1.5, -1.6);
  b.add(new THREE.PlaneGeometry(3.2, 2.9), grate, -1.6, 1.5, 0, 0, Math.PI / 2, 0);
  b.add(new THREE.PlaneGeometry(3.2, 2.9), grate, 1.6, 1.5, 0, 0, Math.PI / 2, 0);
  const gate = new THREE.Group();
  gate.position.set(0, 0, 1.6);
  const gm = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 2.6), grate);
  gm.position.y = 1.4;
  gate.add(gm);
  for (let i = 0; i < 6; i++) {
    const bar = new THREE.Mesh(box(0.03, 2.6, 0.03), cage);
    bar.position.set(-1.5 + i * 0.6, 1.4, 0);
    gate.add(bar);
  }
  b.group.add(gate);
  // call panel
  b.add(rbox(0.2, 0.35, 0.08, 0.01), m.painted('#d8d6cf', 0.5), 1.9, 1.3, 1.7);
  return { group: b.group, gate };
}

/** Big rolling gate with the star lock in the middle. */
export function starGate(m: Materials, w = 5, h = 4): { group: THREE.Group; shutter: THREE.Group; starMat: THREE.MeshStandardMaterial } {
  const b = new ModelBuilder();
  const frame = m.painted('#3a3f42', 0.6);
  b.add(box(0.3, h + 0.6, 0.4), frame, -w / 2 - 0.15, (h + 0.6) / 2, 0);
  b.add(box(0.3, h + 0.6, 0.4), frame, w / 2 + 0.15, (h + 0.6) / 2, 0);
  b.add(box(w + 0.6, 0.6, 0.5), frame, 0, h + 0.3, 0);
  const shutter = new THREE.Group();
  b.group.add(shutter);
  const sh = new THREE.BoxGeometry(w, h, 0.08, 1, Math.round(h / 0.15), 1);
  const pos = sh.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (Math.abs(pos.getZ(i)) > 0.01) pos.setZ(i, pos.getZ(i) + Math.sin(y * Math.PI * 2 / 0.15) * 0.015);
  }
  sh.computeVertexNormals();
  const shm = new THREE.Mesh(sh, m.get('metal_teal'));
  shm.position.y = h / 2;
  shm.castShadow = shm.receiveShadow = true;
  shutter.add(shm);
  // the star lock emblem
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 0.28 : 0.65;
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  s.closePath();
  const starMat = new THREE.MeshStandardMaterial({ color: 0xfff1b8, emissive: 0xffc93a, emissiveIntensity: 0.15, roughness: 0.3 });
  const st = new THREE.Mesh(extrude(s, 0.08, 0.02), starMat);
  st.position.set(0, h / 2, 0.12);
  shutter.add(st);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.06, 10, 40), m.painted('#d4a32a', 0.4));
  ring.position.set(0, h / 2, 0.08);
  shutter.add(ring);
  return { group: b.group, shutter, starMat };
}

export function workbench(m: Materials, w = 2): THREE.Group {
  const b = new ModelBuilder();
  b.add(rbox(w, 0.06, 0.8, 0.01), m.woodProp('#8a6a45', 0.7), 0, 0.9, 0);
  for (const x of [-w / 2 + 0.06, w / 2 - 0.06]) for (const z of [-0.34, 0.34]) b.add(box(0.06, 0.9, 0.06), m.painted('#3a3f42', 0.6), x, 0.45, z);
  b.add(box(w - 0.1, 0.03, 0.7), m.painted('#3a3f42', 0.6), 0, 0.3, 0);
  // pegboard with tools
  b.add(box(w, 1.0, 0.03), m.painted('#b8b1a1', 0.5), 0, 1.5, -0.39);
  const rng = new Rng(w * 10);
  for (let i = 0; i < 8; i++) {
    const x = -w / 2 + 0.2 + rng.next() * (w - 0.4);
    const y = 1.2 + rng.next() * 0.6;
    if (i % 2) b.add(box(0.03, 0.25, 0.02), m.steel('#9aa0a6', 0.4), x, y, -0.36, 0, 0, rng.range(-0.3, 0.3));
    else b.add(rbox(0.1, 0.06, 0.03, 0.01), m.plastic(rng.pick(['#c0392b', '#2980b9', '#f1c40f']), 0.4), x, y, -0.36);
  }
  // vice
  b.add(rbox(0.15, 0.12, 0.2, 0.02), m.painted('#2f5d8a', 0.5), w / 2 - 0.25, 1.0, 0.2);
  return b.group;
}

export function microwave(m: Materials): THREE.Group {
  const b = new ModelBuilder();
  b.add(rbox(0.5, 0.3, 0.38, 0.02), m.painted('#e8e2d2', 0.6), 0, 0.15, 0);
  b.add(box(0.32, 0.22, 0.01), new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.1 }), -0.06, 0.15, 0.191);
  b.add(box(0.1, 0.22, 0.01), m.painted('#bbb', 0.4), 0.18, 0.15, 0.191);
  return b.group;
}

export function starSticker(m: Materials, color = '#f4d35e'): THREE.Mesh {
  const [c, g] = canvas(128, 128);
  g.clearRect(0, 0, 128, 128);
  g.fillStyle = color;
  star(g, 64, 64, 56, 24, 5);
  return new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), m.canvasMaterial(c, { transparent: true }));
}

export function boxOnBelt(m: Materials): THREE.Group {
  const b = new ModelBuilder();
  b.add(box(0.45, 0.32, 0.4, 1), m.get('cardboard') as THREE.Material, 0, 0.16, 0);
  const tag = sign('БРАК', { bg: '#c0392b', fg: '#fff', w: 256, h: 96 });
  const t = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.075), m.canvasMaterial(tag));
  t.position.set(0, 0.2, 0.201);
  b.group.add(t);
  return b.group;
}

export function toyHeadOnBelt(m: Materials): THREE.Group {
  const b = new ModelBuilder();
  b.add(sphere(0.13, 14, 10), m.plastic('#f4d35e', 0.4), 0, 0.13, 0);
  const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
  for (const x of [-0.045, 0.045]) b.add(sphere(0.03, 8, 6), white, x, 0.16, 0.11);
  return b.group;
}

export const VIEW: Record<string, (m: Materials) => THREE.Object3D> = {
  conveyor: (m) => conveyor(m, 4).group,
  molding: (m) => moldingMachine(m),
  robot: (m) => robotArm(m),
  tank: (m) => paintTank(m, '#f1c40f', 'ЖЁЛТЫЙ').group,
  vat: (m) => paintVat(m).group,
  rack: (m) => palletRack(m),
  forklift: (m) => forklift(m),
  warden: (m) => wardenModel(m).group,
  lift: (m) => freightLift(m).group,
  gate: (m) => starGate(m).group,
  bench: (m) => workbench(m),
  bin: (m) => toyBin(m, 'eyes'),
};
