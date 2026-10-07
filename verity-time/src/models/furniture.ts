import * as THREE from 'three';
import type { Materials } from '../assets/Materials';
import { box, cyl, ModelBuilder, rbox, sphere, tube } from '../world/geom';
import { screenCanvas } from '../assets/Signage';
import { Rng } from '../assets/noise';

export function desk(m: Materials, w = 1.4, d = 0.7, wood = '#7a5232'): THREE.Group {
  const b = new ModelBuilder();
  const top = m.woodProp(wood, 0.5);
  const metal = m.painted('#5b5f60', 0.5);
  b.add(rbox(w, 0.04, d, 0.008), top, 0, 0.74, 0);
  // drawer pedestal
  b.add(rbox(0.42, 0.7, d - 0.06, 0.01), metal, w / 2 - 0.24, 0.37, 0);
  for (let i = 0; i < 3; i++) {
    b.add(box(0.38, 0.2, 0.01), m.painted('#6b6f70', 0.5), w / 2 - 0.24, 0.15 + i * 0.22, d / 2 - 0.025);
    b.add(box(0.12, 0.015, 0.02), m.steel('#b0b0b0', 0.3), w / 2 - 0.24, 0.2 + i * 0.22, d / 2 - 0.01);
  }
  for (const x of [-w / 2 + 0.04]) {
    b.add(box(0.04, 0.72, 0.04), metal, x, 0.36, d / 2 - 0.05);
    b.add(box(0.04, 0.72, 0.04), metal, x, 0.36, -d / 2 + 0.05);
  }
  b.add(box(w - 0.5, 0.3, 0.015), metal, -0.2, 0.5, -d / 2 + 0.04);
  return b.group;
}

export function officeChair(m: Materials, color = '#2e3a4a', tipped = false): THREE.Group {
  const b = new ModelBuilder();
  const fab = m.cloth(color, 0.6);
  const blk = m.painted('#1d1d1d', 0.4);
  b.add(rbox(0.46, 0.08, 0.46, 0.03, 2), fab, 0, 0.47, 0);
  b.add(rbox(0.44, 0.5, 0.07, 0.03, 2), fab, 0, 0.78, -0.21, -0.12);
  b.add(cyl(0.025, 0.025, 0.3, 8), blk, 0, 0.3, 0);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    b.add(box(0.3, 0.03, 0.04), blk, Math.cos(a) * 0.15, 0.08, Math.sin(a) * 0.15, 0, -a);
    b.add(sphere(0.03, 8, 6), blk, Math.cos(a) * 0.29, 0.03, Math.sin(a) * 0.29);
  }
  for (const x of [-0.25, 0.25]) b.add(box(0.04, 0.03, 0.3), blk, x, 0.64, 0);
  if (tipped) b.group.rotation.z = Math.PI / 2;
  return b.group;
}

export function chair(m: Materials, color = '#c0392b', woodC = '#8a5a32'): THREE.Group {
  const b = new ModelBuilder();
  const seat = m.plastic(color, 0.5);
  const leg = m.steel('#8a8d90', 0.5);
  b.add(rbox(0.42, 0.04, 0.42, 0.015), seat, 0, 0.45, 0);
  b.add(rbox(0.42, 0.32, 0.04, 0.015), seat, 0, 0.7, -0.2, -0.08);
  for (const [x, z] of [
    [-0.18, -0.18],
    [0.18, -0.18],
    [-0.18, 0.18],
    [0.18, 0.18],
  ])
    b.add(cyl(0.012, 0.012, 0.45, 6), leg, x, 0.225, z);
  void woodC;
  return b.group;
}

export function kidChair(m: Materials, color = '#f4d35e'): THREE.Group {
  const b = new ModelBuilder();
  const p = m.plastic(color, 0.4);
  b.add(rbox(0.3, 0.035, 0.3, 0.015), p, 0, 0.3, 0);
  b.add(rbox(0.3, 0.22, 0.035, 0.015), p, 0, 0.44, -0.135);
  for (const [x, z] of [
    [-0.12, -0.12],
    [0.12, -0.12],
    [-0.12, 0.12],
    [0.12, 0.12],
  ])
    b.add(cyl(0.018, 0.018, 0.3, 8), p, x, 0.15, z);
  return b.group;
}

export function kidTable(m: Materials, w = 1.0, d = 0.6, color = '#2fa79b'): THREE.Group {
  const b = new ModelBuilder();
  b.add(rbox(w, 0.04, d, 0.02), m.plastic('#f2eadb', 0.5), 0, 0.5, 0);
  for (const [x, z] of [
    [-w / 2 + 0.06, -d / 2 + 0.06],
    [w / 2 - 0.06, -d / 2 + 0.06],
    [-w / 2 + 0.06, d / 2 - 0.06],
    [w / 2 - 0.06, d / 2 - 0.06],
  ])
    b.add(cyl(0.03, 0.03, 0.5, 10), m.plastic(color, 0.5), x, 0.25, z);
  return b.group;
}

export function table(m: Materials, w = 1.2, d = 0.8, h = 0.75, top = '#d8d2c4'): THREE.Group {
  const b = new ModelBuilder();
  b.add(rbox(w, 0.035, d, 0.01), m.plastic(top, 0.5), 0, h, 0);
  const leg = m.steel('#7d8084', 0.5);
  for (const [x, z] of [
    [-w / 2 + 0.05, -d / 2 + 0.05],
    [w / 2 - 0.05, -d / 2 + 0.05],
    [-w / 2 + 0.05, d / 2 - 0.05],
    [w / 2 - 0.05, d / 2 - 0.05],
  ])
    b.add(cyl(0.02, 0.02, h, 8), leg, x, h / 2, z);
  return b.group;
}

export function filingCabinet(m: Materials, drawers = 4, color = '#7d8a8c', ajar = -1): THREE.Group {
  const b = new ModelBuilder();
  const mat = m.painted(color, 0.5);
  const h = drawers * 0.33 + 0.04;
  b.add(rbox(0.46, h, 0.62, 0.01), mat, 0, h / 2, 0);
  for (let i = 0; i < drawers; i++) {
    const out = i === ajar ? 0.25 : 0;
    b.add(box(0.42, 0.3, 0.02), m.painted(color, 0.4), 0, 0.2 + i * 0.33, 0.31 + out);
    b.add(box(0.14, 0.02, 0.03), m.steel('#c0c0c0', 0.3), 0, 0.28 + i * 0.33, 0.33 + out);
    b.add(box(0.08, 0.04, 0.005), m.flat('#f2eadb'), 0, 0.22 + i * 0.33, 0.322 + out);
    if (out) b.add(box(0.4, 0.26, 0.24), m.cloth('#c8b98f', 0.5), 0, 0.2 + i * 0.33, 0.2 + out / 2);
  }
  b.group.userData.colliders = [[0, h / 2, 0, 0.23, h / 2, 0.31]];
  return b.group;
}

/** Locker; door is a separate pivot returned in userData.door for hide spots. */
export function locker(m: Materials, color = '#5f7a80', vents = true, open = 0): THREE.Group {
  const b = new ModelBuilder();
  const mat = m.painted(color, 0.5);
  const w = 0.5;
  const h = 1.85;
  const d = 0.5;
  b.add(box(w, h, 0.02), mat, 0, h / 2, -d / 2 + 0.01);
  b.add(box(0.02, h, d), mat, -w / 2 + 0.01, h / 2, 0);
  b.add(box(0.02, h, d), mat, w / 2 - 0.01, h / 2, 0);
  b.add(box(w, 0.02, d), mat, 0, h - 0.01, 0);
  b.add(box(w, 0.08, d), mat, 0, 0.04, 0);
  b.add(box(w - 0.04, 0.02, d - 0.04), mat, 0, 1.55, 0);
  const pivot = new THREE.Group();
  pivot.position.set(-w / 2 + 0.01, 0, d / 2);
  b.group.add(pivot);
  const door = new THREE.Mesh(box(w - 0.02, h - 0.1, 0.02), m.painted(color, 0.45));
  door.position.set(w / 2 - 0.01, h / 2 + 0.03, 0);
  door.castShadow = door.receiveShadow = true;
  pivot.add(door);
  if (vents) {
    const dark = new THREE.MeshStandardMaterial({ color: 0x0a0a0a });
    for (let i = 0; i < 6; i++) {
      const v = new THREE.Mesh(box(0.28, 0.012, 0.005), dark);
      v.position.set(w / 2 - 0.01, 1.55 + i * 0.03, 0.012);
      pivot.add(v);
    }
  }
  const handle = new THREE.Mesh(box(0.03, 0.12, 0.03), m.steel('#a0a0a0', 0.4));
  handle.position.set(w - 0.08, 1.0, 0.025);
  pivot.add(handle);
  pivot.rotation.y = -open;
  b.group.userData.door = pivot;
  b.group.userData.colliders = [[0, h / 2, -0.02, w / 2, h / 2, d / 2 - 0.02]];
  return b.group;
}

export function shelf(m: Materials, w = 1.8, h = 2.0, d = 0.5, levels = 4, color = '#5c6b73'): THREE.Group {
  const b = new ModelBuilder();
  const mat = m.painted(color, 0.6);
  for (const x of [-w / 2 + 0.03, w / 2 - 0.03])
    for (const z of [-d / 2 + 0.03, d / 2 - 0.03]) b.add(box(0.04, h, 0.04), mat, x, h / 2, z);
  for (let i = 0; i < levels; i++) {
    const y = 0.1 + (i * (h - 0.15)) / (levels - 1);
    b.add(box(w, 0.025, d), m.painted(color, 0.5), 0, y, 0);
    b.add(box(w, 0.06, 0.015), mat, 0, y + 0.02, d / 2 - 0.01);
  }
  b.group.userData.levels = Array.from({ length: levels }, (_, i) => 0.1 + (i * (h - 0.15)) / (levels - 1) + 0.0125);
  b.group.userData.colliders = [[0, h / 2, 0, w / 2, h / 2, d / 2]];
  return b.group;
}

export function bench(m: Materials, w = 1.6, color = '#7a4e2d'): THREE.Group {
  const b = new ModelBuilder();
  const wood = m.woodProp(color, 0.5);
  for (let i = 0; i < 3; i++) b.add(rbox(w, 0.03, 0.11, 0.008), wood, 0, 0.44, -0.13 + i * 0.13);
  for (let i = 0; i < 2; i++) b.add(rbox(w, 0.1, 0.03, 0.008), wood, 0, 0.62 + i * 0.13, -0.2, -0.15);
  const iron = m.painted('#2a2a2a', 0.5);
  for (const x of [-w / 2 + 0.1, w / 2 - 0.1]) {
    b.add(box(0.04, 0.44, 0.4), iron, x, 0.22, 0);
    b.add(box(0.04, 0.4, 0.04), iron, x, 0.66, -0.2, -0.15);
  }
  return b.group;
}

export function sofa(m: Materials, w = 1.9, color = '#6b3d3a'): THREE.Group {
  const b = new ModelBuilder();
  const f = m.cloth(color, 0.7);
  b.add(rbox(w, 0.25, 0.8, 0.06, 3), f, 0, 0.25, 0);
  b.add(rbox(w, 0.5, 0.2, 0.06, 3), f, 0, 0.6, -0.3);
  b.add(rbox(0.2, 0.42, 0.8, 0.06, 3), f, -w / 2 + 0.1, 0.4, 0);
  b.add(rbox(0.2, 0.42, 0.8, 0.06, 3), f, w / 2 - 0.1, 0.4, 0);
  for (let i = 0; i < 2; i++) b.add(rbox(w / 2 - 0.22, 0.14, 0.62, 0.06, 3), f, (i - 0.5) * (w / 2 - 0.2), 0.43, 0.06);
  return b.group;
}

export function crtTV(m: Materials, on = false, screen?: HTMLCanvasElement): THREE.Group {
  const b = new ModelBuilder();
  const body = m.plastic('#2b2a28', 0.5);
  b.add(rbox(0.62, 0.48, 0.48, 0.03), body, 0, 0.24, 0);
  b.add(rbox(0.4, 0.34, 0.2, 0.05), body, 0, 0.24, -0.3);
  const scrMat = screen
    ? m.canvasMaterial(screen, { emissive: on ? 1.2 : 0, rough: 0.15 })
    : new THREE.MeshStandardMaterial({ color: 0x0b0f0c, roughness: 0.08, metalness: 0.2, emissive: on ? 0x3a6a5a : 0x000000, emissiveIntensity: 0.5 });
  const scr = b.add(new THREE.PlaneGeometry(0.48, 0.36, 8, 8), scrMat, -0.02, 0.26, 0.242);
  bulge(scr.geometry as THREE.BufferGeometry, 0.02);
  b.add(cyl(0.012, 0.012, 0.01, 8), m.steel('#999', 0.3), 0.26, 0.12, 0.242, Math.PI / 2);
  b.add(cyl(0.012, 0.012, 0.01, 8), m.steel('#999', 0.3), 0.26, 0.18, 0.242, Math.PI / 2);
  b.group.userData.screen = scr;
  return b.group;
}

function bulge(g: THREE.BufferGeometry, amt: number): void {
  const p = g.getAttribute('position');
  const bb = new THREE.Box3().setFromBufferAttribute(p as THREE.BufferAttribute);
  const sx = (bb.max.x - bb.min.x) / 2;
  const sy = (bb.max.y - bb.min.y) / 2;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) / sx;
    const y = p.getY(i) / sy;
    p.setZ(i, amt * (1 - (x * x + y * y) / 2));
  }
  g.computeVertexNormals();
}

/** 90s beige computer terminal; screen material in userData.screen */
export function terminal(m: Materials, lines: string[] = [], on = true): THREE.Group {
  const b = new ModelBuilder();
  const beige = m.plastic('#d9cfb6', 0.6);
  b.add(rbox(0.42, 0.1, 0.4, 0.01), beige, 0, 0.05, 0);
  b.add(rbox(0.42, 0.36, 0.38, 0.03), beige, 0, 0.29, -0.02);
  b.add(rbox(0.3, 0.26, 0.2, 0.04), beige, 0, 0.28, -0.25);
  const scr = screenCanvas(lines.length ? lines : ['ГАРМОНИЯ ОС 2.3', '', '> _']);
  const mat = m.canvasMaterial(scr, { emissive: on ? 1.3 : 0.0, rough: 0.12 });
  const sc = b.add(new THREE.PlaneGeometry(0.33, 0.25, 6, 6), mat, 0, 0.3, 0.172);
  bulge(sc.geometry as THREE.BufferGeometry, 0.012);
  // keyboard
  b.add(rbox(0.44, 0.03, 0.16, 0.008), beige, 0, 0.015, 0.33, 0.06);
  const keys = m.plastic('#efe8d6', 0.5);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 12; c++) b.add(box(0.026, 0.012, 0.026), keys, -0.165 + c * 0.03, 0.035 + r * 0.004, 0.28 + r * 0.03);
  b.group.userData.screen = sc;
  b.group.userData.screenMat = mat;
  return b.group;
}

export function computerMonitor(m: Materials, lines: string[] = [], on = false): THREE.Group {
  return terminal(m, lines, on);
}

export function phone(m: Materials, color = '#c94b3b'): THREE.Group {
  const b = new ModelBuilder();
  const p = m.plastic(color, 0.5);
  b.add(rbox(0.2, 0.06, 0.22, 0.02), p, 0, 0.03, 0);
  b.add(rbox(0.22, 0.04, 0.06, 0.02), p, 0, 0.08, -0.03);
  b.add(cyl(0.05, 0.05, 0.01, 16), m.plastic('#f2eadb', 0.4), 0, 0.065, 0.04);
  b.add(tube([new THREE.Vector3(0.1, 0.03, -0.05), new THREE.Vector3(0.18, 0.0, 0.0), new THREE.Vector3(0.25, 0.0, 0.1)], 0.006, 12, 4), m.rubber('#333'));
  return b.group;
}

export function mug(m: Materials, color = '#f2eadb'): THREE.Group {
  const b = new ModelBuilder();
  const mat = m.plastic(color, 0.6);
  const prof = new THREE.LatheGeometry([new THREE.Vector2(0, 0), new THREE.Vector2(0.04, 0), new THREE.Vector2(0.042, 0.1), new THREE.Vector2(0.037, 0.1), new THREE.Vector2(0.035, 0.01), new THREE.Vector2(0, 0.01)], 18);
  b.add(prof, mat);
  b.add(new THREE.TorusGeometry(0.025, 0.007, 6, 12, Math.PI), mat, 0.042, 0.05, 0, 0, 0, -Math.PI / 2);
  b.add(new THREE.CircleGeometry(0.035, 16), new THREE.MeshStandardMaterial({ color: 0x1b0f08, roughness: 0.2 }), 0, 0.07, 0, -Math.PI / 2);
  return b.group;
}

export function paperStack(m: Materials, n = 6, seed = 1): THREE.Group {
  const b = new ModelBuilder();
  const rng = new Rng(seed);
  const paper = m.flat('#ece6d6', 1, 0);
  for (let i = 0; i < n; i++) {
    const sheet = b.add(box(0.21, 0.002, 0.297), paper, rng.range(-0.02, 0.02), 0.001 + i * 0.0025, rng.range(-0.02, 0.02), 0, rng.range(-0.25, 0.25));
    sheet.castShadow = false;
  }
  return b.group;
}

export function looseSheet(m: Materials, seed = 1): THREE.Group {
  const b = new ModelBuilder();
  const rng = new Rng(seed);
  b.add(box(0.21, 0.001, 0.297), m.flat(rng.pick(['#ece6d6', '#e8e2c8', '#f2efe6']), 1, 0), 0, 0.001, 0, 0, rng.range(0, 6)).castShadow = false;
  return b.group;
}

export function clipboard(m: Materials): THREE.Group {
  const b = new ModelBuilder();
  b.add(rbox(0.23, 0.008, 0.32, 0.005), m.woodProp('#8a6a45', 0.4), 0, 0.004, 0);
  b.add(box(0.21, 0.002, 0.28), m.flat('#efe9da', 1, 0), 0, 0.009, 0.01);
  b.add(rbox(0.1, 0.012, 0.04, 0.004), m.steel('#c0c0c0', 0.3), 0, 0.012, -0.14);
  return b.group;
}

export function cardboardBox(m: Materials, w = 0.5, h = 0.4, d = 0.4, open = false): THREE.Group {
  const b = new ModelBuilder();
  const card = m.get('cardboard') as THREE.MeshStandardMaterial;
  b.add(box(w, h, d, 1), card, 0, h / 2, 0);
  if (open) {
    b.add(box(w, 0.005, d / 2), card, 0, h + 0.05, -d / 2 - 0.05, -1.2);
    b.add(box(w, 0.005, d / 2), card, 0, h + 0.05, d / 2 + 0.05, 1.2);
  }
  return b.group;
}

export function crate(m: Materials, s = 0.8): THREE.Group {
  const b = new ModelBuilder();
  const wood = m.woodProp('#9a7a4f', 0.6);
  b.add(box(s - 0.04, s - 0.04, s - 0.04), m.woodProp('#86683f', 0.7), 0, s / 2, 0);
  for (const y of [0.03, s - 0.03]) {
    b.add(box(s, 0.06, 0.08), wood, 0, y, s / 2 - 0.04);
    b.add(box(s, 0.06, 0.08), wood, 0, y, -s / 2 + 0.04);
    b.add(box(0.08, 0.06, s), wood, s / 2 - 0.04, y, 0);
    b.add(box(0.08, 0.06, s), wood, -s / 2 + 0.04, y, 0);
  }
  b.add(box(s * 1.3, 0.07, 0.02), wood, 0, s / 2, s / 2, 0, 0, Math.PI / 4);
  return b.group;
}

export function pallet(m: Materials): THREE.Group {
  const b = new ModelBuilder();
  const wood = m.woodProp('#a88a5c', 0.7);
  for (let i = 0; i < 5; i++) b.add(box(1.2, 0.02, 0.1), wood, 0, 0.13, -0.4 + i * 0.2);
  for (const z of [-0.4, 0, 0.4]) b.add(box(1.2, 0.1, 0.1), wood, 0, 0.06, z);
  return b.group;
}

export function barrel(m: Materials, color = '#2f5d8a'): THREE.Group {
  const b = new ModelBuilder();
  const mat = m.painted(color, 0.7);
  b.add(cyl(0.29, 0.29, 0.88, 20), mat, 0, 0.44, 0);
  for (const y of [0.15, 0.44, 0.73]) b.add(new THREE.TorusGeometry(0.295, 0.012, 6, 24), mat, 0, y, 0, Math.PI / 2);
  return b.group;
}

export function trashBin(m: Materials, color = '#3d5a4a'): THREE.Group {
  const b = new ModelBuilder();
  b.add(cyl(0.18, 0.15, 0.55, 16, 0.5, true), m.painted(color, 0.6), 0, 0.275, 0);
  b.add(new THREE.CircleGeometry(0.15, 16), m.painted(color, 0.6), 0, 0.01, 0, -Math.PI / 2);
  b.add(cyl(0.13, 0.13, 0.04, 12), m.flat('#3a3328', 1, 0), 0, 0.42, 0);
  return b.group;
}

export function plantPot(m: Materials, dead = true): THREE.Group {
  const b = new ModelBuilder();
  b.add(cyl(0.22, 0.16, 0.42, 16), m.plastic('#b5654a', 0.6), 0, 0.21, 0);
  b.add(cyl(0.2, 0.2, 0.02, 16), m.flat('#3a2a1e', 1, 0), 0, 0.4, 0);
  const leaf = m.cloth(dead ? '#6b5a35' : '#3e6b3a', 0.7);
  const rng = new Rng(7);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const len = rng.range(0.3, 0.7);
    const droop = dead ? rng.range(0.3, 0.8) : 0.1;
    const pts = [new THREE.Vector3(0, 0.4, 0), new THREE.Vector3(Math.cos(a) * 0.1, 0.4 + len * 0.6, Math.sin(a) * 0.1), new THREE.Vector3(Math.cos(a) * 0.25, 0.4 + len * (1 - droop), Math.sin(a) * 0.25)];
    b.add(tube(pts, 0.012, 8, 4), leaf);
  }
  return b.group;
}

export function waterCooler(m: Materials): THREE.Group {
  const b = new ModelBuilder();
  b.add(rbox(0.32, 0.95, 0.32, 0.02), m.plastic('#e5e1d6', 0.5), 0, 0.475, 0);
  const bottle = new THREE.MeshPhysicalMaterial({ color: 0x9fc6dc, transparent: true, opacity: 0.45, roughness: 0.1 });
  b.add(cyl(0.13, 0.13, 0.35, 18), bottle, 0, 1.13, 0);
  b.add(cyl(0.04, 0.13, 0.08, 18), bottle, 0, 0.92, 0);
  b.add(box(0.05, 0.04, 0.04), m.plastic('#3a6ea5', 0.3), -0.06, 0.8, 0.17);
  b.add(box(0.05, 0.04, 0.04), m.plastic('#c0392b', 0.3), 0.06, 0.8, 0.17);
  return b.group;
}

export function bulletinBoard(m: Materials, w = 1.2, h = 0.8): THREE.Group {
  const b = new ModelBuilder();
  b.add(box(w + 0.06, h + 0.06, 0.03), m.woodProp('#6e4a2b', 0.4), 0, 0, 0.015);
  b.add(box(w, h, 0.01), m.cloth('#a8835a', 0.5), 0, 0, 0.032);
  return b.group;
}

export function whiteboard(m: Materials, w = 1.6, h = 1.0, scrawlCanvas?: HTMLCanvasElement): THREE.Group {
  const b = new ModelBuilder();
  b.add(box(w + 0.04, h + 0.04, 0.03), m.steel('#b0b0b0', 0.3), 0, 0, 0.015);
  const face = scrawlCanvas ? m.canvasMaterial(scrawlCanvas, { rough: 0.2 }) : m.plastic('#f4f4f0', 0.3);
  b.add(box(w, h, 0.01), face, 0, 0, 0.032);
  b.add(box(w * 0.6, 0.03, 0.06), m.steel('#b0b0b0', 0.3), 0, -h / 2 - 0.02, 0.05);
  return b.group;
}

export function vendingMachine(m: Materials, body = '#b8322a', label = 'ВЕРИТИ-СОДА'): THREE.Group {
  const b = new ModelBuilder();
  const mat = m.painted(body, 0.4);
  b.add(rbox(0.9, 1.85, 0.8, 0.02), mat, 0, 0.925, 0);
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x223, transparent: true, opacity: 0.35, roughness: 0.05 });
  b.add(box(0.56, 1.2, 0.01), new THREE.MeshStandardMaterial({ color: 0x0d0d10, roughness: 0.6 }), -0.12, 1.1, 0.39);
  // product rows (little cans)
  const cans = ['#e74c3c', '#f1c40f', '#2ecc71', '#3498db', '#9b59b6'];
  for (let r = 0; r < 5; r++)
    for (let c = 0; c < 5; c++) {
      if ((r * 5 + c) % 7 === 3) continue;
      b.add(cyl(0.035, 0.035, 0.12, 8), m.plastic(cans[(r + c) % cans.length], 0.3), -0.36 + c * 0.11, 0.6 + r * 0.22, 0.32);
    }
  b.add(box(0.56, 1.2, 0.01), glass, -0.12, 1.1, 0.4);
  b.add(box(0.22, 0.5, 0.02), m.painted('#2a2a2a', 0.4), 0.3, 1.2, 0.4);
  const lab = screenCanvas([label], { w: 512, h: 96, color: '#fff3c0', bg: '#7a1d17' });
  const lm = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.15), m.canvasMaterial(lab, { emissive: 0.6 }));
  lm.position.set(0, 1.76, 0.405);
  b.group.add(lm);
  b.add(box(0.5, 0.12, 0.05), m.painted('#1d1d1d', 0.4), -0.12, 0.3, 0.38);
  return b.group;
}

export function arcadeCabinet(m: Materials, color = '#3b2c63', screen?: HTMLCanvasElement): THREE.Group {
  const b = new ModelBuilder();
  const mat = m.painted(color, 0.5);
  b.add(box(0.7, 1.0, 0.75), mat, 0, 0.5, 0);
  b.add(box(0.7, 0.75, 0.5), mat, 0, 1.38, -0.12);
  b.add(box(0.7, 0.2, 0.6), mat, 0, 1.85, -0.05);
  b.add(box(0.7, 0.08, 0.35), m.painted('#1d1d1d', 0.3), 0, 1.04, 0.22, -0.25);
  const scr = screen ? m.canvasMaterial(screen, { emissive: 0.9 }) : new THREE.MeshStandardMaterial({ color: 0x050805, roughness: 0.05 });
  b.add(new THREE.PlaneGeometry(0.55, 0.45), scr, 0, 1.4, 0.135, -0.2);
  b.add(cyl(0.012, 0.012, 0.08, 6), m.steel('#999', 0.3), -0.15, 1.12, 0.24);
  b.add(sphere(0.03, 10, 8), m.plastic('#e74c3c', 0.3), -0.15, 1.17, 0.24);
  for (let i = 0; i < 3; i++) b.add(cyl(0.025, 0.025, 0.02, 12), m.plastic(['#f1c40f', '#3498db', '#2ecc71'][i], 0.3), 0.05 + i * 0.08, 1.1, 0.24);
  return b.group;
}

export function ticketBooth(m: Materials): THREE.Group {
  const b = new ModelBuilder();
  const teal = m.painted('#2f6f6a', 0.5);
  const cream = m.painted('#efe3c8', 0.5);
  b.add(box(1.6, 1.0, 1.4), teal, 0, 0.5, 0);
  b.add(box(0.06, 1.3, 1.4), cream, -0.77, 1.65, 0);
  b.add(box(0.06, 1.3, 1.4), cream, 0.77, 1.65, 0);
  b.add(box(1.6, 1.3, 0.06), cream, 0, 1.65, -0.67);
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xbcd8e0, transparent: true, opacity: 0.22, roughness: 0.15 });
  b.add(box(1.5, 1.0, 0.02), glass, 0, 1.55, 0.68);
  b.add(box(0.4, 0.04, 0.5), cream, 0, 1.02, 0.85);
  // roof with scallops
  b.add(box(1.9, 0.12, 1.7), m.painted('#d94f45', 0.4), 0, 2.36, 0);
  for (let i = 0; i < 8; i++) b.add(cyl(0.12, 0.12, 0.04, 12, 0.5), m.painted(i % 2 ? '#d94f45' : '#f2e3c2', 0.4), -0.84 + i * 0.24, 2.28, 0.86, Math.PI / 2);
  b.group.userData.colliders = [[0, 1.2, 0, 0.82, 1.2, 0.72]];
  return b.group;
}

export function turnstile(m: Materials): THREE.Group {
  const b = new ModelBuilder();
  const steel = m.steel('#a8acb0', 0.4);
  b.add(rbox(0.25, 1.0, 0.7, 0.02), m.painted('#3a3d40', 0.4), 0, 0.5, 0);
  b.add(cyl(0.03, 0.03, 0.2, 8), steel, 0.15, 0.95, 0, 0, 0, Math.PI / 2);
  const arms = new THREE.Group();
  arms.position.set(0.25, 0.95, 0);
  for (let i = 0; i < 3; i++) {
    const a = new THREE.Mesh(cyl(0.02, 0.02, 0.5, 8), steel);
    a.rotation.x = (i / 3) * Math.PI * 2;
    a.position.set(0, Math.cos((i / 3) * Math.PI * 2) * 0.25, Math.sin((i / 3) * Math.PI * 2) * 0.25);
    a.rotation.set((i / 3) * Math.PI * 2, 0, 0);
    a.position.applyAxisAngle(new THREE.Vector3(1, 0, 0), 0);
    arms.add(a);
  }
  b.group.add(arms);
  b.add(box(0.1, 0.06, 0.02), m.emissive('#ff3020', 1.5), 0, 1.02, 0.36);
  b.group.userData.arms = arms;
  return b.group;
}
