import * as THREE from 'three';
import type { Materials } from '../assets/Materials';
import { box, cyl, extrude, ModelBuilder, rbox, sphere, tube } from '../world/geom';
import { canvas } from '../assets/Signage';
import { Rng } from '../assets/noise';
import { plushVerity } from './items';
import type { PuppetId } from '../puzzles/shadow';

/** Children's wing props (the playland «Время Верити»). */

function starShape(r1: number, r2: number, n = 5): THREE.Shape {
  const s = new THREE.Shape();
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? r2 : r1;
    const a = (i / (n * 2)) * Math.PI * 2 + Math.PI / 2;
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  s.closePath();
  return s;
}

function stripeCanvas(a: string, b: string, n = 16, w = 512, h = 128): HTMLCanvasElement {
  const [c, g] = canvas(w, h);
  for (let i = 0; i < n; i++) {
    g.fillStyle = i % 2 ? a : b;
    g.fillRect((i * w) / n, 0, w / n + 1, h);
  }
  // gold trim and a little grime
  g.fillStyle = '#c9a34a';
  g.fillRect(0, h - 10, w, 10);
  const r = new Rng(5);
  for (let i = 0; i < 300; i++) {
    g.fillStyle = `rgba(30,20,10,${r.range(0.02, 0.1)})`;
    g.fillRect(r.range(0, w), r.range(0, h), r.range(2, 12), r.range(2, 20));
  }
  return c;
}

export interface CarouselModel {
  group: THREE.Group;
  rotor: THREE.Group;
  mounts: THREE.Object3D[];
  bulbs: THREE.MeshStandardMaterial;
}

/** Carousel with Verity-themed mounts: ball seats, blue dogs and stars. */
export function carousel(m: Materials, R = 4.2): CarouselModel {
  const b = new ModelBuilder();
  const gold = m.steel('#c9a34a', 0.35);
  const red = m.painted('#8a2230', 0.5);
  // static base
  b.add(cyl(R + 0.1, R + 0.2, 0.3, 48), red, 0, 0.15, 0);
  b.add(new THREE.TorusGeometry(R + 0.12, 0.035, 8, 64), gold, 0, 0.3, 0, Math.PI / 2);
  for (let i = 0; i < 3; i++) b.add(box(0.9, 0.18, 0.5), m.painted('#5a1620', 0.5), 0, 0.09 + i * 0.0, R + 0.35, 0, 0, 0); // step
  const rotor = new THREE.Group();
  b.group.add(rotor);
  const rb = new ModelBuilder();
  rb.add(cyl(R, R, 0.05, 48), m.woodProp('#b88a52', 0.45), 0, 0.33, 0);
  // central column with mirror panels
  rb.add(cyl(0.95, 0.95, 3.4, 12), m.painted('#f2e6c8', 0.4), 0, 2.0, 0);
  const mirror = new THREE.MeshStandardMaterial({ color: 0x9aa4ad, metalness: 1, roughness: 0.12 });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 1.3), mirror);
    p.position.set(Math.sin(a) * 0.96, 2.2, Math.cos(a) * 0.96);
    p.rotation.y = a;
    rb.group.add(p);
  }
  rb.add(cyl(1.05, 1.05, 0.12, 24), gold, 0, 1.3, 0);
  rb.add(cyl(1.05, 1.05, 0.12, 24), gold, 0, 3.0, 0);
  // canopy
  const canopyMat = m.canvasMaterial(stripeCanvas('#c0392b', '#f2e6c8'), { rough: 0.7 });
  canopyMat.side = THREE.DoubleSide;
  const cone = new THREE.CylinderGeometry(0.5, R + 0.4, 1.1, 32, 1, true);
  rb.add(cone, canopyMat, 0, 4.25, 0);
  rb.add(cyl(R + 0.42, R + 0.42, 0.28, 32, 0.5, true), canopyMat, 0, 3.58, 0);
  const scallopA = new THREE.MeshStandardMaterial({ color: 0xf2e6c8, roughness: 0.6, side: THREE.DoubleSide });
  const scallopB = new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.6, side: THREE.DoubleSide });
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2;
    const sc = new THREE.Mesh(new THREE.CircleGeometry(0.22, 10, 0, Math.PI), i % 2 ? scallopA : scallopB);
    sc.position.set(Math.sin(a) * (R + 0.43), 3.44, Math.cos(a) * (R + 0.43));
    sc.rotation.set(Math.PI, a, 0);
    rb.group.add(sc);
  }
  const bulbs = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xffd58a, emissiveIntensity: 0.0 });
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    rb.add(sphere(0.045, 8, 6), bulbs, Math.sin(a) * (R + 0.44), 3.74, Math.cos(a) * (R + 0.44));
  }
  // finial: a star on top
  rb.add(sphere(0.25, 16, 12), gold, 0, 4.85, 0);
  rb.add(extrude(starShape(0.5, 0.22), 0.1, 0.02), m.plastic('#f4d35e', 0.3), 0, 5.4, -0.05);
  // poles + mounts
  const mounts: THREE.Object3D[] = [];
  const n = 10;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = i % 2 ? R - 0.9 : R - 1.9;
    const x = Math.sin(a) * rr;
    const z = Math.cos(a) * rr;
    rb.add(cyl(0.035, 0.035, 3.2, 10), gold, x, 1.95, z);
    const mount = mountModel(m, (['ball', 'dog', 'star'] as const)[i % 3], i);
    mount.position.set(x, 1.05, z);
    mount.rotation.y = a + Math.PI / 2;
    rb.group.add(mount);
    mounts.push(mount);
  }
  rotor.add(rb.group);
  b.group.userData.colliders = [
    [0, 1.2, 0, R + 0.2, 1.2, (R + 0.2) * 0.42],
    [0, 1.2, 0, (R + 0.2) * 0.42, 1.2, R + 0.2],
    [0, 1.2, 0, (R + 0.2) * 0.72, 1.2, (R + 0.2) * 0.72],
  ];
  b.group.userData.dynamic = true;
  return { group: b.group, rotor, mounts, bulbs };
}

function mountModel(m: Materials, kind: 'ball' | 'dog' | 'star', seed: number): THREE.Group {
  const b = new ModelBuilder();
  const saddle = m.plastic('#7a1f2b', 0.4);
  if (kind === 'ball') {
    b.add(sphere(0.38, 24, 16), m.plastic('#f4d35e', 0.45), 0, 0, 0);
    b.add(new THREE.TorusGeometry(0.36, 0.04, 8, 24), m.plastic('#2fa79b', 0.4), 0, -0.08, 0, Math.PI / 2);
    for (const sx of [-1, 1]) b.add(sphere(0.08, 10, 8), m.plastic('#f7f3ea', 0.2), 0.3, 0.1, sx * 0.13).scale.set(0.5, 1, 1);
    b.add(rbox(0.3, 0.06, 0.26, 0.02), saddle, 0, 0.38, 0);
  } else if (kind === 'dog') {
    const blue = m.plastic('#3a6fd0', 0.45);
    b.add(sphere(0.3, 18, 12), blue, 0, 0, 0).scale.set(1.6, 0.85, 0.9);
    b.add(sphere(0.2, 14, 10), blue, 0.5, 0.25, 0);
    b.add(sphere(0.08, 10, 8), m.plastic('#1a1a1a', 0.3), 0.68, 0.22, 0);
    for (const sz of [-1, 1]) b.add(sphere(0.09, 10, 8), m.plastic('#2a4f9a', 0.5), 0.45, 0.45, sz * 0.12).scale.set(0.6, 1.4, 0.4);
    for (const [x, z] of [[0.3, 0.15], [0.3, -0.15], [-0.3, 0.15], [-0.3, -0.15]]) b.add(cyl(0.05, 0.05, 0.4, 8), blue, x, -0.32, z, 0, 0, (x > 0 ? -1 : 1) * 0.5);
    b.add(cyl(0.03, 0.02, 0.3, 6), blue, -0.5, 0.15, 0, 0, 0, 0.9);
    b.add(rbox(0.32, 0.05, 0.26, 0.02), saddle, -0.02, 0.26, 0);
  } else {
    b.add(extrude(starShape(0.45, 0.2), 0.16, 0.03), m.plastic('#f4d35e', 0.4), 0, 0.1, -0.08, 0, Math.PI / 2, 0);
    b.add(rbox(0.3, 0.05, 0.24, 0.02), saddle, 0, 0.32, 0);
  }
  void seed;
  return b.group;
}

/** Six coloured bells on a booth panel + four progress lamps. */
export function bellPanel(m: Materials, colors: string[]): { group: THREE.Group; bells: THREE.Object3D[]; lamps: THREE.MeshStandardMaterial[] } {
  const b = new ModelBuilder();
  b.add(rbox(1.5, 1.0, 0.6, 0.03), m.painted('#7a1f2b', 0.5), 0, 0.5, 0);
  b.add(box(1.52, 0.05, 0.62), m.steel('#c9a34a', 0.35), 0, 1.02, 0);
  const slope = new THREE.Mesh(box(1.4, 0.04, 0.45), m.woodProp('#5a3a22', 0.4));
  slope.position.set(0, 1.08, 0.02);
  slope.rotation.x = 0.25;
  b.group.add(slope);
  const bells: THREE.Object3D[] = [];
  colors.forEach((c, i) => {
    const g = new THREE.Group();
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.09, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), m.steel(c, 0.15));
    g.add(dome);
    const knob = new THREE.Mesh(cyl(0.015, 0.015, 0.04, 8), m.steel('#c9a34a', 0.3));
    knob.position.y = 0.1;
    g.add(knob);
    g.position.set(-0.55 + i * 0.22, 1.12, 0.05);
    g.rotation.x = 0.25;
    b.group.add(g);
    bells.push(g);
  });
  const lamps: THREE.MeshStandardMaterial[] = [];
  for (let i = 0; i < 4; i++) {
    const lm = new THREE.MeshStandardMaterial({ color: 0x221a10, emissive: 0xffc94a, emissiveIntensity: 0 });
    b.add(sphere(0.03, 10, 8), lm, -0.24 + i * 0.16, 1.2, -0.17);
    lamps.push(lm);
  }
  b.group.userData.colliders = [[0, 0.55, 0, 0.76, 0.55, 0.31]];
  b.group.userData.dynamic = true;
  return { group: b.group, bells, lamps };
}

/** Ball pit: padded rim, nets on posts, instanced balls (returned separately). */
export function ballPit(m: Materials, w: number, d: number, seed = 1): { group: THREE.Group; balls: THREE.InstancedMesh; surface: number } {
  const b = new ModelBuilder();
  const rimA = m.cloth('#2fa79b', 0.5);
  const rimB = m.cloth('#f4d35e', 0.5);
  const H = 0.6;
  const T = 0.25;
  b.add(rbox(w, H, T, 0.06), rimA, 0, H / 2, -d / 2 + T / 2);
  b.add(rbox(w, H, T, 0.06), rimA, 0, H / 2, d / 2 - T / 2);
  b.add(rbox(T, H, d - T * 2, 0.06), rimB, -w / 2 + T / 2, H / 2, 0);
  b.add(rbox(T, H, d - T * 2, 0.06), rimB, w / 2 - T / 2, H / 2, 0);
  // net panels on posts
  const [nc, ng] = canvas(256, 256);
  ng.clearRect(0, 0, 256, 256);
  ng.strokeStyle = 'rgba(30,30,30,0.95)';
  ng.lineWidth = 3;
  for (let i = 0; i <= 256; i += 32) {
    ng.beginPath();
    ng.moveTo(i, 0);
    ng.lineTo(i, 256);
    ng.moveTo(0, i);
    ng.lineTo(256, i);
    ng.stroke();
  }
  const netMat = m.canvasMaterial(nc, { transparent: true, alphaTest: 0.3 });
  netMat.side = THREE.DoubleSide;
  (netMat.map as THREE.Texture).wrapS = (netMat.map as THREE.Texture).wrapT = THREE.RepeatWrapping;
  const post = m.painted('#c0392b', 0.4);
  for (const [x, z] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]]) b.add(cyl(0.06, 0.06, 2.4, 10), post, x, 1.2, z);
  for (const [x, z, len, ry] of [[0, -d / 2, w, 0], [-w / 2, 0, d, Math.PI / 2], [w / 2, 0, d, Math.PI / 2]] as const) {
    const g = new THREE.PlaneGeometry(len, 1.7);
    const uv = g.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * len * 3, uv.getY(i) * 1.7 * 3);
    b.add(g, netMat, x, H + 0.85, z, 0, ry, 0);
  }
  b.add(box(w, 0.04, 0.04), post, 0, 2.4, -d / 2);
  b.add(box(w, 0.04, 0.04), post, 0, 2.4, d / 2);
  // a coloured "under-layer" so gaps between balls read as more balls
  const [uc, ug] = canvas(256, 256);
  const cols = ['#d9443a', '#3a78d9', '#f4d35e', '#3fae5a', '#e8892f', '#9b59b6'];
  const r = new Rng(seed);
  ug.fillStyle = '#333';
  ug.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 260; i++) {
    ug.fillStyle = cols[r.int(0, 5)];
    ug.beginPath();
    ug.arc(r.range(0, 256), r.range(0, 256), r.range(6, 9), 0, Math.PI * 2);
    ug.fill();
  }
  const under = m.canvasMaterial(uc, { rough: 0.4 });
  (under.map as THREE.Texture).wrapS = (under.map as THREE.Texture).wrapT = THREE.RepeatWrapping;
  (under.map as THREE.Texture).repeat.set(w * 2, d * 2);
  const surface = 0.47;
  b.add(new THREE.PlaneGeometry(w - T * 2, d - T * 2), under, 0, surface - 0.05, 0, -Math.PI / 2);
  // instanced balls (two loose layers)
  const geo = new THREE.IcosahedronGeometry(0.075, 1);
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0 });
  const iw = w - T * 2 - 0.1;
  const id = d - T * 2 - 0.1;
  const count = Math.floor(iw * id * 38);
  const balls = new THREE.InstancedMesh(geo, mat, count);
  const mtx = new THREE.Matrix4();
  const col = new THREE.Color();
  for (let i = 0; i < count; i++) {
    mtx.makeTranslation(r.range(-iw / 2, iw / 2), surface - 0.07 + r.range(0, 0.1), r.range(-id / 2, id / 2));
    balls.setMatrixAt(i, mtx);
    col.set(cols[r.int(0, 5)]);
    balls.setColorAt(i, col);
  }
  balls.instanceMatrix.needsUpdate = true;
  balls.castShadow = false;
  balls.receiveShadow = true;
  b.group.userData.colliders = [[0, H / 2, 0, w / 2, H / 2, d / 2]];
  return { group: b.group, balls, surface };
}

/** Climbing frame with platforms, nets, a spiral tube slide and a straight slide. */
export function climbingFrame(m: Materials): THREE.Group {
  const b = new ModelBuilder();
  const cols = [m.painted('#c0392b', 0.4), m.painted('#2980b9', 0.4), m.painted('#f1c40f', 0.4), m.painted('#27ae60', 0.4)];
  const W = 6;
  const D = 4;
  const Hh = 3.2;
  let k = 0;
  for (const x of [-W / 2, 0, W / 2])
    for (const z of [-D / 2, D / 2]) b.add(cyl(0.07, 0.07, Hh, 10), cols[k++ % 4], x, Hh / 2, z);
  for (const y of [1.1, 2.2, Hh])
    for (const z of [-D / 2, D / 2]) b.add(cyl(0.05, 0.05, W, 8), cols[(k++ + 1) % 4], 0, y, z, 0, 0, Math.PI / 2);
  for (const y of [1.1, 2.2, Hh]) for (const x of [-W / 2, 0, W / 2]) b.add(cyl(0.05, 0.05, D, 8), cols[k++ % 4], x, y, 0, Math.PI / 2);
  // padded platforms
  b.add(rbox(W / 2 - 0.1, 0.12, D - 0.1, 0.04), m.cloth('#2fa79b', 0.5), -W / 4, 1.1, 0);
  b.add(rbox(W / 2 - 0.1, 0.12, D - 0.1, 0.04), m.cloth('#ef8a7e', 0.5), W / 4, 2.2, 0);
  // roof
  const roof = new THREE.ConeGeometry(2.4, 1.0, 4, 1);
  roof.rotateY(Math.PI / 4);
  b.add(roof, m.plastic('#c0392b', 0.4), -W / 4, Hh + 0.5, 0, 0, 0, 0, 1.15, 1, 0.85);
  b.add(roof.clone(), m.plastic('#2980b9', 0.4), W / 4, Hh + 0.5, 0, 0, 0, 0, 1.15, 1, 0.85);
  // spiral tube slide
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    const a = t * Math.PI * 3;
    pts.push(new THREE.Vector3(W / 2 + 1.1 + Math.cos(a) * 1.0, 2.2 - t * 2.0, Math.sin(a) * 1.0));
  }
  b.add(tube(pts, 0.38, 80, 14), m.plastic('#f1c40f', 0.35));
  // straight slide
  const sl = new THREE.Mesh(box(0.8, 0.05, 3.2), m.steel('#c0c4c8', 0.2));
  sl.position.set(-W / 4, 0.55, D / 2 + 1.4);
  sl.rotation.x = 0.36;
  b.group.add(sl);
  for (const sx of [-0.42, 0.42]) {
    const rail = new THREE.Mesh(box(0.05, 0.22, 3.2), m.plastic('#27ae60', 0.4));
    rail.position.set(-W / 4 + sx, 0.66, D / 2 + 1.4);
    rail.rotation.x = 0.36;
    b.group.add(rail);
  }
  // nets on the upper level
  const [nc, ng] = canvas(128, 128);
  ng.clearRect(0, 0, 128, 128);
  ng.strokeStyle = '#1a1a1a';
  ng.lineWidth = 3;
  for (let i = 0; i <= 128; i += 21) {
    ng.beginPath();
    ng.moveTo(i, 0);
    ng.lineTo(i, 128);
    ng.moveTo(0, i);
    ng.lineTo(128, i);
    ng.stroke();
  }
  const net = m.canvasMaterial(nc, { transparent: true, alphaTest: 0.3 });
  net.side = THREE.DoubleSide;
  (net.map as THREE.Texture).wrapS = (net.map as THREE.Texture).wrapT = THREE.RepeatWrapping;
  (net.map as THREE.Texture).repeat.set(8, 2);
  for (const z of [-D / 2, D / 2]) b.add(new THREE.PlaneGeometry(W, 1.0), net, 0, 2.7, z);
  b.group.userData.colliders = [[0, Hh / 2 + 0.3, 0, W / 2 + 0.1, Hh / 2 + 0.3, D / 2 + 0.1], [W / 2 + 1.1, 1.2, 0, 1.4, 1.2, 1.4], [-W / 4, 0.6, D / 2 + 1.4, 0.5, 0.6, 1.6]];
  return b.group;
}

/** Prize counter: glass counter and a wall of prizes. */
export function prizeCounter(m: Materials, seed = 3): THREE.Group {
  const b = new ModelBuilder();
  b.add(rbox(3.2, 0.95, 0.7, 0.02), m.painted('#2fa79b', 0.5), 0, 0.475, 0);
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, roughness: 0.05, clearcoat: 1 });
  b.add(box(3.1, 0.3, 0.6), glass, 0, 1.12, 0);
  b.add(box(3.2, 0.03, 0.7), m.steel('#c9a34a', 0.3), 0, 0.97, 0);
  b.add(box(3.2, 0.03, 0.7), m.steel('#c9a34a', 0.3), 0, 1.285, 0);
  const r = new Rng(seed);
  const colors = ['#f4d35e', '#ef8a7e', '#7fb2b0', '#3a6fd0', '#9b59b6'];
  for (let i = 0; i < 9; i++) b.add(sphere(0.05, 10, 8), m.plastic(colors[i % 5], 0.3), -1.3 + i * 0.32, 1.03, r.range(-0.15, 0.15));
  // prize wall behind
  for (let lv = 0; lv < 4; lv++) {
    b.add(box(3.4, 0.04, 0.4), m.painted('#f2e6c8', 0.4), 0, 0.6 + lv * 0.55, -1.1);
    for (let i = 0; i < 7; i++) {
      const x = -1.45 + i * 0.48;
      const y = 0.62 + lv * 0.55;
      const pick = r.int(0, 3);
      if (pick === 0) {
        const p = plushVerity(m, 0.9 + r.range(0, 0.4), colors[r.int(0, 4)], r.range(0.2, 0.6));
        p.position.set(x, y, -1.1);
        p.rotation.y = r.range(-0.3, 0.3);
        b.group.add(p);
      } else if (pick === 1) b.add(rbox(0.22, 0.28, 0.14, 0.02), m.painted(colors[r.int(0, 4)], 0.5), x, y + 0.14, -1.1);
      else if (pick === 2) b.add(sphere(0.12, 14, 10), m.plastic(colors[r.int(0, 4)], 0.3), x, y + 0.12, -1.1);
      else b.add(extrude(starShape(0.13, 0.06), 0.05, 0.01), m.plastic('#f4d35e', 0.3), x, y + 0.15, -1.12);
    }
  }
  b.add(box(3.5, 2.4, 0.05), m.painted('#7a1f2b', 0.5), 0, 1.4, -1.35);
  b.group.userData.colliders = [[0, 0.65, 0, 1.6, 0.65, 0.35], [0, 1.2, -1.15, 1.75, 1.2, 0.25]];
  return b.group;
}

/** Long party table with cloth, plates, cups, hats and a cake. */
export function partyTable(m: Materials, len: number, seed = 1, candles = 7): THREE.Group {
  const b = new ModelBuilder();
  const r = new Rng(seed);
  b.add(box(len, 0.04, 0.9), m.painted('#d8d2c4', 0.4), 0, 0.6, 0);
  for (const x of [-len / 2 + 0.1, len / 2 - 0.1]) for (const z of [-0.38, 0.38]) b.add(box(0.05, 0.6, 0.05), m.steel('#9aa0a6', 0.3), x, 0.3, z);
  b.add(box(len + 0.06, 0.25, 0.96), m.cloth('#ef8a7e', 0.5), 0, 0.5, 0);
  b.add(box(len + 0.04, 0.012, 0.94), m.cloth('#f7f2e6', 0.4), 0, 0.625, 0);
  const hatCols = ['#f4d35e', '#7fb2b0', '#ef8a7e', '#9b59b6'];
  const n = Math.floor(len / 0.6);
  for (let i = 0; i < n; i++) {
    const x = -len / 2 + 0.3 + i * 0.6;
    for (const z of [-0.3, 0.3]) {
      b.add(cyl(0.11, 0.09, 0.01, 18), m.plastic('#f2f2f2', 0.3), x, 0.635, z);
      if (r.next() < 0.7) b.add(cyl(0.035, 0.03, 0.09, 10), m.plastic(hatCols[r.int(0, 3)], 0.3), x + 0.14, 0.68, z * 0.75);
      if (r.next() < 0.5) {
        const hat = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.18, 12), m.plastic(hatCols[r.int(0, 3)], 0.3));
        hat.position.set(x - 0.1, 0.72, z);
        if (r.next() < 0.5) {
          hat.rotation.z = Math.PI / 2;
          hat.position.y = 0.67;
        }
        b.group.add(hat);
      }
    }
  }
  // cake in the middle: candles never lit
  b.add(cyl(0.22, 0.22, 0.02, 24), m.plastic('#f2f2f2', 0.4), 0, 0.64, 0);
  b.add(cyl(0.17, 0.17, 0.12, 24), m.plastic('#f6d7e0', 0.4), 0, 0.71, 0);
  b.add(cyl(0.12, 0.12, 0.09, 24), m.plastic('#f4d35e', 0.4), 0, 0.815, 0);
  for (let i = 0; i < candles; i++) {
    const a = (i / candles) * Math.PI * 2;
    b.add(cyl(0.008, 0.008, 0.08, 6), m.plastic('#5fb7ad', 0.3), Math.cos(a) * 0.08, 0.9, Math.sin(a) * 0.08);
  }
  b.group.userData.colliders = [[0, 0.4, 0, len / 2 + 0.03, 0.4, 0.48]];
  return b.group;
}

/** String of triangular pennants through the given points. */
export function bunting(m: Materials, pts: THREE.Vector3[], colors = ['#ef8a7e', '#f4d35e', '#7fb2b0', '#3a6fd0']): THREE.Group {
  const b = new ModelBuilder();
  const curve = new THREE.CatmullRomCurve3(pts);
  b.add(new THREE.TubeGeometry(curve, 40, 0.006, 4, false), m.flat('#dddddd', 0.8, 0));
  const len = curve.getLength();
  const n = Math.floor(len / 0.35);
  const mats = colors.map((c) => {
    const mm = m.cloth(c, 0.4).clone();
    mm.side = THREE.DoubleSide;
    return mm;
  });
  for (let i = 1; i < n; i++) {
    const p = curve.getPointAt(i / n);
    const t = curve.getTangentAt(i / n);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-0.12, 0, 0, 0.12, 0, 0, 0, -0.24, 0], 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 0.5, 0], 2));
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, mats[i % mats.length]);
    mesh.position.copy(p);
    mesh.rotation.y = Math.atan2(-t.z, t.x);
    b.group.add(mesh);
  }
  return b.group;
}

/** Hanging decoration: star or planet on a string. */
export function hangingDecor(m: Materials, kind: 'star' | 'planet' | 'moon', size: number, color: string, drop: number): THREE.Group {
  const b = new ModelBuilder();
  b.add(cyl(0.004, 0.004, drop, 4), m.flat('#cccccc', 0.8, 0), 0, -drop / 2, 0);
  if (kind === 'star') b.add(extrude(starShape(size, size * 0.45), size * 0.25, size * 0.05), m.plastic(color, 0.35), 0, -drop - size, -size * 0.12);
  else if (kind === 'planet') {
    b.add(sphere(size, 24, 16), m.plastic(color, 0.4), 0, -drop - size, 0);
    b.add(new THREE.TorusGeometry(size * 1.6, size * 0.12, 6, 40), m.plastic('#f2e6c8', 0.4), 0, -drop - size, 0, Math.PI / 2 + 0.3);
  } else {
    const s = new THREE.Shape();
    s.absarc(0, 0, size, Math.PI * 0.3, Math.PI * 1.7, false);
    s.absarc(size * 0.4, 0, size * 0.8, Math.PI * 1.55, Math.PI * 0.45, true);
    b.add(extrude(s, size * 0.25, size * 0.04), m.plastic(color, 0.35), 0, -drop - size, 0);
  }
  return b.group;
}

/** Kitchen stove with hood. */
export function stove(m: Materials): THREE.Group {
  const b = new ModelBuilder();
  const steel = m.steel('#b9bcbf', 0.45);
  b.add(box(1.2, 0.9, 0.7), steel, 0, 0.45, 0);
  for (const [x, z] of [[-0.3, -0.15], [0.3, -0.15], [-0.3, 0.15], [0.3, 0.15]]) b.add(cyl(0.12, 0.12, 0.02, 16), m.flat('#1a1a1a', 0.6, 0.2), x, 0.91, z);
  b.add(box(1.1, 0.4, 0.02), m.flat('#1a1a1a', 0.4, 0.2), 0, 0.45, 0.351);
  for (let i = 0; i < 4; i++) b.add(cyl(0.02, 0.02, 0.03, 10), m.plastic('#222', 0.3), -0.4 + i * 0.27, 0.8, 0.36, Math.PI / 2);
  b.add(box(1.3, 0.35, 0.8), steel, 0, 2.3, -0.05);
  b.add(cyl(0.3, 0.6, 0.3, 4), steel, 0, 2.6, -0.05);
  b.add(cyl(0.38, 0.38, 0.3, 20), steel, -0.25, 1.06, 0, 0, 0, 0);
  b.group.userData.colliders = [[0, 0.45, 0, 0.6, 0.45, 0.35]];
  return b.group;
}

/** Kitchen counter unit with a sink option. */
export function counterUnit(m: Materials, w: number, sink = false): THREE.Group {
  const b = new ModelBuilder();
  b.add(box(w, 0.86, 0.62), m.painted('#d8d6cf', 0.45), 0, 0.43, 0);
  b.add(box(w + 0.02, 0.04, 0.66), m.steel('#b9bcbf', 0.3), 0, 0.88, 0);
  for (let x = -w / 2 + 0.3; x < w / 2; x += 0.6) b.add(box(0.1, 0.015, 0.02), m.steel('#999', 0.3), x, 0.7, 0.32);
  if (sink) {
    b.add(box(0.5, 0.02, 0.4), m.flat('#555', 0.3, 0.6), 0, 0.89, 0);
    b.add(tube([new THREE.Vector3(0, 0.9, -0.25), new THREE.Vector3(0, 1.2, -0.25), new THREE.Vector3(0, 1.2, -0.08)], 0.015, 10, 6), m.steel('#c0c4c8', 0.2));
  }
  return b.group;
}

export function fridge(m: Materials): THREE.Group {
  const b = new ModelBuilder();
  b.add(rbox(0.8, 1.9, 0.7, 0.03), m.steel('#c9cccf', 0.4), 0, 0.95, 0);
  b.add(box(0.78, 0.01, 0.01), m.flat('#333', 0.5, 0), 0, 1.3, 0.351);
  b.add(box(0.03, 0.4, 0.04), m.steel('#888', 0.3), 0.32, 1.55, 0.37);
  b.add(box(0.03, 0.4, 0.04), m.steel('#888', 0.3), 0.32, 0.95, 0.37);
  return b.group;
}

/** Plain iron cot with a blanket. */
export function cot(m: Materials): THREE.Group {
  const b = new ModelBuilder();
  const iron = m.painted('#3a3f42', 0.5);
  b.add(box(0.9, 0.04, 1.95), iron, 0, 0.4, 0);
  for (const x of [-0.43, 0.43]) for (const z of [-0.95, 0.95]) b.add(cyl(0.02, 0.02, 0.4, 8), iron, x, 0.2, z);
  for (const z of [-0.97, 0.97]) b.add(box(0.9, 0.5, 0.03), iron, 0, 0.65, z);
  b.add(rbox(0.85, 0.12, 1.9, 0.04), m.cloth('#c9c2b0', 0.5), 0, 0.48, 0);
  b.add(rbox(0.88, 0.05, 1.3, 0.03), m.cloth('#3a5a7a', 0.6), 0, 0.56, 0.25);
  b.add(rbox(0.6, 0.1, 0.35, 0.04), m.cloth('#efe9d8', 0.4), 0, 0.6, -0.7);
  return b.group;
}

/** Wall of small cubbies with abandoned children's shoes. */
export function shoeCubbies(m: Materials, seed = 2): THREE.Group {
  const b = new ModelBuilder();
  const wood = m.woodProp('#c9a36a', 0.4);
  const cols = 6;
  const rows = 4;
  b.add(box(cols * 0.32, 0.02, 0.32), wood, 0, 0, 0);
  for (let r = 0; r <= rows; r++) b.add(box(cols * 0.32, 0.02, 0.32), wood, 0, r * 0.3, 0);
  for (let c = 0; c <= cols; c++) b.add(box(0.02, rows * 0.3, 0.32), wood, -cols * 0.16 + c * 0.32, rows * 0.15, 0);
  b.add(box(cols * 0.32, rows * 0.3, 0.01), wood, 0, rows * 0.15, -0.16);
  const r = new Rng(seed);
  const shoeCols = ['#c0392b', '#2980b9', '#f2f2f2', '#e67e22', '#8e44ad'];
  for (let c = 0; c < cols; c++)
    for (let rr = 0; rr < rows; rr++) {
      if (r.next() < 0.55) continue;
      const col = m.plastic(shoeCols[r.int(0, 4)], 0.5);
      for (const sx of [-0.05, 0.05]) b.add(rbox(0.07, 0.06, 0.17, 0.02), col, -cols * 0.16 + 0.16 + c * 0.32 + sx, rr * 0.3 + 0.04, 0.02);
    }
  return b.group;
}

// ============================================================ shadow puppets

/** Silhouette outline of a puppet (facing right), units ≈ metres. */
export function puppetShape(id: PuppetId): THREE.Shape {
  const s = new THREE.Shape();
  if (id === 'verity') {
    s.absarc(0, 0.32, 0.3, 0, Math.PI * 2, false);
    const ant = new THREE.Shape();
    void ant;
  } else if (id === 'child') {
    s.moveTo(-0.14, 0);
    s.lineTo(-0.1, 0.36);
    s.lineTo(-0.2, 0.5);
    s.lineTo(-0.16, 0.56);
    s.lineTo(-0.06, 0.44);
    s.lineTo(-0.08, 0.66);
    s.lineTo(0.1, 0.66);
    s.lineTo(0.3, 0.5); // arm reaching forward
    s.lineTo(0.28, 0.45);
    s.lineTo(0.1, 0.52);
    s.lineTo(0.1, 0.36);
    s.lineTo(0.14, 0);
    s.lineTo(0.04, 0);
    s.lineTo(0.0, 0.25);
    s.lineTo(-0.04, 0);
    s.closePath();
  } else {
    s.moveTo(-0.38, 0.22);
    s.lineTo(-0.5, 0.36); // tail
    s.lineTo(-0.46, 0.4);
    s.lineTo(-0.32, 0.3);
    s.lineTo(0.12, 0.3);
    s.lineTo(0.2, 0.42);
    s.lineTo(0.24, 0.5); // ear
    s.lineTo(0.3, 0.42);
    s.lineTo(0.42, 0.38); // snout
    s.lineTo(0.42, 0.3);
    s.lineTo(0.22, 0.24);
    s.lineTo(0.2, 0.0);
    s.lineTo(0.12, 0.0);
    s.lineTo(0.08, 0.14);
    s.lineTo(-0.22, 0.14);
    s.lineTo(-0.26, 0.0);
    s.lineTo(-0.34, 0.0);
    s.closePath();
  }
  return s;
}

/** Physical cut-out puppet on a stick (for behind the screen). */
export function puppetModel(m: Materials, id: PuppetId): THREE.Group {
  const b = new ModelBuilder();
  const card = m.painted('#2a2420', 0.6);
  b.add(extrude(puppetShape(id), 0.006, 0.0), card, 0, 0.75, 0);
  if (id === 'verity') {
    b.add(cyl(0.006, 0.006, 0.18, 4), card, 0, 1.43, 0.003);
    b.add(extrude(starShape(0.08, 0.035), 0.006, 0), card, 0, 1.55, 0);
    for (const sx of [-0.1, 0.1]) b.add(box(0.05, 0.12, 0.006), card, sx, 0.72, 0.003);
  }
  b.add(cyl(0.008, 0.008, 0.9, 6), m.woodProp('#8a5a32', 0.4), 0, 0.35, 0.01);
  b.add(box(0.12, 0.06, 0.12), m.steel('#5a5e61', 0.4), 0, 0.0, 0.01);
  return b.group;
}

/** Draws a puppet's shadow on the screen canvas (x,y = feet, px per metre). */
export function drawPuppetShadow(g: CanvasRenderingContext2D, id: PuppetId, x: number, y: number, ppm: number, flip: boolean, blur = 0): void {
  g.save();
  g.translate(x, y);
  g.scale(flip ? -ppm : ppm, -ppm);
  if (blur) g.filter = `blur(${blur}px)`;
  g.beginPath();
  const pts = puppetShape(id).getPoints(24);
  pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
  g.closePath();
  g.fill();
  if (id === 'verity') {
    g.fillRect(-0.006, 0.6, 0.012, 0.18);
    g.beginPath();
    const st = starShape(0.08, 0.035).getPoints(2);
    st.forEach((p, i) => (i ? g.lineTo(p.x, p.y + 0.8) : g.moveTo(p.x, p.y + 0.8)));
    g.closePath();
    g.fill();
    g.fillRect(-0.125, -0.03, 0.05, 0.12);
    g.fillRect(0.075, -0.03, 0.05, 0.12);
  }
  g.restore();
}

export const VIEW: Record<string, (m: Materials) => THREE.Object3D> = {
  carousel: (m) => carousel(m).group,
  ballpit: (m) => {
    const p = ballPit(m, 6, 4);
    p.group.add(p.balls);
    return p.group;
  },
  climbing: (m) => climbingFrame(m),
  prizes: (m) => prizeCounter(m),
  party: (m) => partyTable(m, 3.6),
  puppets: (m) => {
    const g = new THREE.Group();
    (['child', 'verity', 'dog'] as PuppetId[]).forEach((id, i) => {
      const p = puppetModel(m, id);
      p.position.x = -0.8 + i * 0.8;
      g.add(p);
    });
    return g;
  },
};
