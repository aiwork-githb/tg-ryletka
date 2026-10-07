import * as THREE from 'three';
import type { Materials } from '../assets/Materials';
import { box, cyl, ModelBuilder, rbox, sphere, torus, tube } from '../world/geom';
import { canvas, clockFace, sign } from '../assets/Signage';
import { Rng } from '../assets/noise';

/** The Core ("Очаг"): a glowing heart caged in brass rings, cables like roots. */
export function heartCore(m: Materials, r = 3): { group: THREE.Group; glow: THREE.MeshStandardMaterial; rings: THREE.Object3D[]; inner: THREE.Mesh } {
  const b = new ModelBuilder();
  const glow = new THREE.MeshStandardMaterial({ color: 0x2a1400, emissive: 0xffa040, emissiveIntensity: 2.2, roughness: 0.4 });
  const inner = b.add(sphere(r * 0.72, 48, 32), glow, 0, 0, 0);
  // shell of plates with gaps, like a ball toy seen from inside
  const plate = m.painted('#c9a34a', 0.35);
  const rr = new Rng(3);
  for (let i = 0; i < 110; i++) {
    const u = rr.next();
    const v = rr.next();
    const th = u * Math.PI * 2;
    const ph = Math.acos(2 * v - 1);
    const n = new THREE.Vector3(Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th));
    const p = new THREE.Mesh(rbox(r * 0.34, r * 0.34, 0.06, 0.02), rr.next() < 0.15 ? m.painted('#7a1f2b', 0.5) : plate);
    p.position.copy(n.clone().multiplyScalar(r * 0.9));
    p.lookAt(n.clone().multiplyScalar(r * 2));
    b.group.add(p);
  }
  const rings: THREE.Object3D[] = [];
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(torus(r * (1.15 + i * 0.12), 0.07, 8, 96), m.steel('#c9a34a', 0.25));
    ring.rotation.set(i * 0.9, i * 0.5, i * 0.3);
    b.group.add(ring);
    rings.push(ring);
  }
  // star on top, the same as on every toy
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 ? 0.35 : 0.8;
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    if (i === 0) s.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
    else s.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
  }
  s.closePath();
  const starGlow = new THREE.MeshStandardMaterial({ color: 0x332200, emissive: 0xffd84a, emissiveIntensity: 1.6 });
  b.add(new THREE.ExtrudeGeometry(s, { depth: 0.15, bevelEnabled: false }), starGlow, 0, r * 1.6, -0.07);
  b.add(cyl(0.05, 0.05, r * 0.5, 8), m.steel('#c9a34a', 0.3), 0, r * 1.2, 0);
  // cables: roots to the floor and the walls
  const cable = m.rubber('#1a1612');
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + rr.range(-0.1, 0.1);
    const start = new THREE.Vector3(Math.cos(a) * r * 0.6, -r * 0.6, Math.sin(a) * r * 0.6);
    const mid = new THREE.Vector3(Math.cos(a) * r * 1.6, -r * 1.6, Math.sin(a) * r * 1.6);
    const end = new THREE.Vector3(Math.cos(a) * r * 3.8, -r * 2.65, Math.sin(a) * r * 3.8);
    b.add(tube([start, mid, end], rr.range(0.06, 0.14), 24, 6), cable);
  }
  return { group: b.group, glow, rings, inner };
}

/** Pedestal with a sloped top and a question plate. */
export function pedestal(m: Materials, question: string): THREE.Group {
  const b = new ModelBuilder();
  b.add(cyl(0.45, 0.55, 1.0, 24), m.painted('#2a2622', 0.5), 0, 0.5, 0);
  b.add(cyl(0.5, 0.5, 0.08, 24), m.steel('#c9a34a', 0.3), 0, 1.04, 0);
  const plate = m.canvasMaterial(sign(question, { bg: '#1a120a', fg: '#f4d35e', w: 512, h: 96, font: 'ui' }), { emissive: 0.6 });
  b.add(new THREE.PlaneGeometry(0.8, 0.15), plate, 0, 0.75, 0.51);
  b.group.userData.colliders = [[0, 0.55, 0, 0.5, 0.55, 0.5]];
  return b.group;
}

/** A glowing hand outline (palm reader screen). */
export function palmPlate(m: Materials): { mesh: THREE.Mesh; mat: THREE.MeshStandardMaterial } {
  const [c, g] = canvas(256, 256);
  g.fillStyle = '#08100c';
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = '#79f2a8';
  g.lineWidth = 6;
  g.lineJoin = 'round';
  g.beginPath();
  g.moveTo(80, 230);
  g.lineTo(70, 140);
  g.lineTo(40, 100);
  g.lineTo(55, 90);
  g.lineTo(85, 120);
  for (const [x, top] of [[90, 40], [125, 28], [158, 38], [188, 64]] as const) {
    g.lineTo(x, top + 70);
    g.lineTo(x + 2, top);
    g.lineTo(x + 22, top);
    g.lineTo(x + 24, top + 70);
  }
  g.lineTo(200, 160);
  g.lineTo(180, 230);
  g.stroke();
  const mat = m.canvasMaterial(c, { emissive: 1.2, rough: 0.2 });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.45), mat);
  return { mesh, mat };
}

/** Clock face for the time pedestal; redraw(hh, mm) moves the hands. */
export function dialPlate(m: Materials): { mesh: THREE.Mesh; redraw: (hh: number, mm: number, ok?: boolean) => void } {
  const [c, g] = canvas(256, 256);
  const mat = m.canvasMaterial(c, { emissive: 0.8, rough: 0.3 });
  const tex = mat.map as THREE.CanvasTexture;
  const redraw = (hh: number, mm: number, ok = false) => {
    g.fillStyle = ok ? '#1a2a12' : '#120c08';
    g.fillRect(0, 0, 256, 256);
    g.fillStyle = '#efe6cf';
    g.beginPath();
    g.arc(128, 128, 110, 0, Math.PI * 2);
    g.fill();
    clockFace(g, 128, 128, 104, hh, mm, false);
    tex.needsUpdate = true;
  };
  redraw(10, 14);
  return { mesh: new THREE.Mesh(new THREE.CircleGeometry(0.24, 32), mat), redraw };
}

/** The final console: two heavy switches and a cassette deck. */
export function finalConsole(m: Materials): { group: THREE.Group; offLever: THREE.Group; relLever: THREE.Group; deck: THREE.Group; deckLed: THREE.MeshStandardMaterial } {
  const b = new ModelBuilder();
  b.add(rbox(2.6, 1.0, 0.9, 0.04), m.painted('#2a2622', 0.5), 0, 0.5, 0);
  const top = new THREE.Mesh(box(2.6, 0.05, 0.7), m.steel('#c9a34a', 0.3));
  top.position.set(0, 1.05, -0.05);
  top.rotation.x = 0.3;
  b.group.add(top);
  const mk = (x: number, label: string, color: string) => {
    const lg = new THREE.Group();
    lg.position.set(x, 1.15, 0.05);
    const arm = new THREE.Mesh(cyl(0.025, 0.025, 0.4, 10), m.steel('#9aa0a6', 0.3));
    arm.position.y = 0.2;
    lg.add(arm);
    const knob = new THREE.Mesh(sphere(0.06, 14, 10), m.plastic(color, 0.3));
    knob.position.y = 0.42;
    lg.add(knob);
    lg.rotation.x = 0.6;
    b.group.add(lg);
    const plate = m.canvasMaterial(sign(label, { bg: color, fg: '#fff', w: 512, h: 128, font: 'ui' }), { emissive: 0.5 });
    b.add(new THREE.PlaneGeometry(0.55, 0.14), plate, x, 0.8, 0.46);
    return lg;
  };
  const offLever = mk(-0.85, 'ВЫКЛЮЧИТЬ', '#7a1f2b');
  const relLever = mk(0.85, 'ВЫПУСТИТЬ', '#2f5d8a');
  const deck = new THREE.Group();
  deck.position.set(0, 1.12, 0.05);
  const body = new THREE.Mesh(rbox(0.42, 0.1, 0.26, 0.02), m.plastic('#2d2d30', 0.4));
  deck.add(body);
  const slot = new THREE.Mesh(box(0.2, 0.02, 0.12), m.flat('#050505', 0.8, 0));
  slot.position.y = 0.05;
  deck.add(slot);
  const deckLed = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xffc94a, emissiveIntensity: 0 });
  const led = new THREE.Mesh(sphere(0.012, 8, 6), deckLed);
  led.position.set(0.16, 0.06, 0.1);
  deck.add(led);
  b.group.add(deck);
  b.add(new THREE.PlaneGeometry(0.5, 0.12), m.canvasMaterial(sign('КОЛЫБЕЛЬНАЯ', { bg: '#5a3a22', fg: '#f4d35e', w: 512, h: 128, font: 'brand' }), { emissive: 0.4 }), 0, 0.8, 0.46);
  b.group.userData.colliders = [[0, 0.55, 0, 1.3, 0.55, 0.45]];
  b.group.userData.dynamic = true;
  return { group: b.group, offLever, relLever, deck, deckLed };
}

/** An armchair with a blanket over someone small and still. */
export function blanketChair(m: Materials): THREE.Group {
  const b = new ModelBuilder();
  const cloth = m.cloth('#5a3a4a', 0.5);
  b.add(rbox(0.9, 0.45, 0.85, 0.08), cloth, 0, 0.32, 0);
  b.add(rbox(0.9, 0.8, 0.2, 0.08), cloth, 0, 0.8, -0.35);
  for (const sx of [-0.4, 0.4]) b.add(rbox(0.16, 0.35, 0.8, 0.06), cloth, sx, 0.6, 0);
  const blanket = m.cloth('#3a6fd0', 0.55);
  const shape = new THREE.SphereGeometry(0.42, 20, 14);
  const pos = shape.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    pos.setXYZ(i, pos.getX(i) * (1 + Math.max(0, -y) * 0.4), y * 1.3, pos.getZ(i) * 0.9);
  }
  shape.computeVertexNormals();
  b.add(shape, blanket, 0, 0.98, -0.05);
  b.add(rbox(0.85, 0.05, 0.9, 0.03), blanket, 0, 0.58, 0.2, 0.15);
  b.add(rbox(0.8, 0.5, 0.04, 0.02), blanket, 0, 0.35, 0.65, -0.05);
  b.add(tube([new THREE.Vector3(0.2, 0.62, 0.55), new THREE.Vector3(0.3, 0.45, 0.62), new THREE.Vector3(0.28, 0.3, 0.66)], 0.05, 10, 6), blanket);
  return b.group;
}

/** Dark hanging strips across a vestibule (the seams of the shifting corridor). */
export function stripCurtain(w: number, h: number): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 1, side: THREE.DoubleSide });
  const n = Math.ceil(w / 0.12);
  for (let i = 0; i < n; i++) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(0.11, h), mat);
    s.position.set(-w / 2 + 0.06 + i * 0.12, h / 2, (i % 2) * 0.03);
    g.add(s);
  }
  return g;
}
