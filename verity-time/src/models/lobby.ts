import * as THREE from 'three';
import type { Materials } from '../assets/Materials';
import { box, cyl, ModelBuilder, rbox, sphere, tube } from '../world/geom';
import { canvas, drawVerity } from '../assets/Signage';
import { Rng } from '../assets/noise';
import { star } from '../assets/recipes';

export function theaterSeat(m: Materials, folded = false, color = '#7a1f2b'): THREE.Group {
  const b = new ModelBuilder();
  const cloth = m.cloth(color, 0.55);
  const frame = m.painted('#2a2420', 0.5);
  b.add(rbox(0.5, 0.75, 0.08, 0.04, 3), cloth, 0, 0.75, -0.18, -0.12);
  b.add(rbox(0.48, 0.1, 0.45, 0.04, 3), cloth, 0, folded ? 0.62 : 0.45, folded ? -0.05 : 0.02, folded ? -1.35 : 0);
  for (const x of [-0.28, 0.28]) {
    b.add(box(0.06, 0.66, 0.5), frame, x, 0.33, -0.02);
    b.add(rbox(0.07, 0.05, 0.42, 0.02), m.woodProp('#5a3a22', 0.4), x, 0.66, 0.0);
  }
  return b.group;
}

/** A curtain half as a folded cloth panel. Scale X to "open" it. */
export function curtain(m: Materials, w: number, h: number, color = '#7a1426', folds = 10): THREE.Mesh {
  const g = new THREE.PlaneGeometry(w, h, folds * 6, 8);
  const pos = g.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const t = (x / w + 0.5) * folds * Math.PI * 2;
    pos.setZ(i, Math.sin(t) * 0.09 + Math.sin(t * 0.5 + y) * 0.02);
  }
  g.computeVertexNormals();
  g.translate(w / 2, h / 2, 0); // origin at the outer (left) bottom edge
  const mat = m.cloth(color, 0.45).clone();
  mat.side = THREE.DoubleSide;
  const mesh = new THREE.Mesh(g, mat);
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

export function fountain(m: Materials, r = 3): { group: THREE.Group; water: THREE.Mesh } {
  const b = new ModelBuilder();
  const stone = m.get('floor_terrazzo') as THREE.Material;
  const rim = new THREE.LatheGeometry(
    [
      [r - 0.25, 0],
      [r, 0],
      [r + 0.05, 0.45],
      [r - 0.05, 0.55],
      [r - 0.3, 0.52],
      [r - 0.3, 0.1],
    ].map(([x, y]) => new THREE.Vector2(x, y)),
    48,
  );
  b.add(rim, stone);
  b.add(cyl(r - 0.28, r - 0.28, 0.1, 48), m.get('tile_blue') as THREE.Material, 0, 0.05, 0);
  // pedestal
  b.add(cyl(0.9, 1.1, 1.3, 24), stone, 0, 0.65, 0);
  b.add(cyl(1.15, 1.15, 0.12, 24), m.steel('#b08d57', 0.5), 0, 1.3, 0);
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(r - 0.3, 48),
    new THREE.MeshPhysicalMaterial({ color: 0x1f3a3a, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.75, transmission: 0 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.12;
  b.group.add(water);
  // dead leaves and coins in the basin
  const rng = new Rng(4);
  const leaf = m.cloth('#5a4022', 0.9);
  const coin = m.steel('#b8964f', 0.4);
  for (let i = 0; i < 40; i++) {
    const a = rng.next() * Math.PI * 2;
    const d = 1.2 + rng.next() * (r - 1.6);
    b.add(box(0.06, 0.004, 0.04), i % 3 ? leaf : coin, Math.cos(a) * d, 0.105, Math.sin(a) * d, 0, rng.next() * 6, 0);
  }
  b.group.userData.colliders = [[0, 0.3, 0, r, 0.3, r]];
  return { group: b.group, water };
}

export function receptionDesk(m: Materials, len = 3.2, color = '#2f6f6a'): THREE.Group {
  const b = new ModelBuilder();
  const front = m.painted(color, 0.5);
  b.add(box(len, 1.05, 0.08), front, 0, 0.525, 0.32);
  b.add(box(0.08, 1.05, 0.7), front, -len / 2 + 0.04, 0.525, 0);
  b.add(box(0.08, 1.05, 0.7), front, len / 2 - 0.04, 0.525, 0);
  b.add(rbox(len + 0.1, 0.05, 0.42, 0.01), m.woodProp('#8a5a32', 0.4), 0, 1.08, 0.24);
  b.add(rbox(len - 0.1, 0.04, 0.6, 0.01), m.woodProp('#7a4e2d', 0.5), 0, 0.75, -0.02);
  // star decorations along the front
  const [c, g] = canvas(1024, 128);
  g.fillStyle = color;
  g.fillRect(0, 0, 1024, 128);
  g.fillStyle = '#f4d35e';
  for (let i = 0; i < 9; i++) star(g, 60 + i * 113, 64, 34, 14, 5);
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(len - 0.1, (len - 0.1) / 8), m.canvasMaterial(c, { rough: 0.6 }));
  strip.position.set(0, 0.62, 0.362);
  b.group.add(strip);
  return b.group;
}

export function stanchion(m: Materials): THREE.Group {
  const b = new ModelBuilder();
  const brass = m.steel('#b08d57', 0.45);
  b.add(cyl(0.16, 0.18, 0.04, 20), brass, 0, 0.02, 0);
  b.add(cyl(0.025, 0.025, 0.95, 10), brass, 0, 0.5, 0);
  b.add(sphere(0.045, 12, 8), brass, 0, 0.98, 0);
  return b.group;
}

export function rope(m: Materials, a: THREE.Vector3, c: THREE.Vector3): THREE.Group {
  const b = new ModelBuilder();
  const mid = a.clone().lerp(c, 0.5);
  mid.y -= 0.18;
  b.add(tube([a, mid, c], 0.02, 16, 6), m.cloth('#8a1c2b', 0.4));
  return b.group;
}

export function mailbox(m: Materials): THREE.Group {
  const b = new ModelBuilder();
  const red = m.painted('#c0392b', 0.45);
  b.add(cyl(0.07, 0.07, 1.0, 12), m.painted('#2f6f6a', 0.5), 0, 0.5, 0);
  b.add(rbox(0.5, 0.5, 0.4, 0.06, 3), red, 0, 1.25, 0);
  b.add(new THREE.CylinderGeometry(0.2, 0.2, 0.5, 20, 1, false, 0, Math.PI), red, 0, 1.5, 0, 0, 0, Math.PI / 2).scale.set(1, 1, 1);
  b.add(box(0.3, 0.03, 0.02), new THREE.MeshStandardMaterial({ color: 0x080808 }), 0, 1.35, 0.205);
  const [c, g] = canvas(512, 256);
  g.fillStyle = '#f7f3ea';
  g.fillRect(0, 0, 512, 256);
  drawVerity(g, 90, 128, 60, { wave: true });
  g.fillStyle = '#c0392b';
  g.font = "700 64px 'Comfortaa', sans-serif";
  g.fillText('ПОЧТА', 190, 110);
  g.fillText('ВЕРИТИ', 190, 190);
  const lab = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.2), m.canvasMaterial(c, { rough: 0.6 }));
  lab.position.set(0, 1.18, 0.205);
  b.group.add(lab);
  return b.group;
}

export function stroller(m: Materials): THREE.Group {
  const b = new ModelBuilder();
  const cloth = m.cloth('#3b4f7a', 0.7);
  const frame = m.steel('#9aa0a6', 0.5);
  b.add(rbox(0.75, 0.35, 0.45, 0.08, 3), cloth, 0, 0.55, 0);
  b.add(new THREE.SphereGeometry(0.33, 16, 8, 0, Math.PI, 0, Math.PI / 2), cloth, -0.22, 0.7, 0, 0, Math.PI / 2, 0).scale.set(1, 0.9, 1.3);
  for (const x of [-0.3, 0.3])
    for (const z of [-0.24, 0.24]) {
      b.add(new THREE.TorusGeometry(0.12, 0.02, 8, 18), m.rubber('#1d1d1d'), x, 0.13, z);
      b.add(cyl(0.012, 0.012, 0.4, 6), frame, x * 0.8, 0.3, z, 0, 0, x > 0 ? 0.3 : -0.3);
    }
  b.add(tube([new THREE.Vector3(0.35, 0.65, -0.2), new THREE.Vector3(0.6, 0.95, -0.2), new THREE.Vector3(0.6, 0.95, 0.2), new THREE.Vector3(0.35, 0.65, 0.2)], 0.015, 20, 6), frame);
  return b.group;
}

export function balloon(m: Materials, color: string, h = 1.6, deflated = false): THREE.Group {
  const b = new ModelBuilder();
  const mat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(color), roughness: 0.25, clearcoat: 0.8, sheen: 0.3 });
  if (deflated) {
    const g = sphere(0.14, 14, 10);
    g.scale(1.2, 0.35, 1);
    b.add(g, mat, 0, 0.04, 0);
    b.add(tube([new THREE.Vector3(0.1, 0.01, 0), new THREE.Vector3(0.4, 0.005, 0.2), new THREE.Vector3(0.7, 0.005, 0.1)], 0.003, 10, 3), m.flat('#dddddd', 0.8, 0));
  } else {
    b.add(sphere(0.16, 18, 14), mat, 0, h, 0).scale.set(1, 1.18, 1);
    b.add(cyl(0.012, 0.03, 0.04, 8), mat, 0, h - 0.2, 0);
    b.add(tube([new THREE.Vector3(0, h - 0.21, 0), new THREE.Vector3(0.05, h * 0.5, 0.03), new THREE.Vector3(0, 0, 0)], 0.003, 16, 3), m.flat('#dddddd', 0.8, 0));
  }
  return b.group;
}

export function cake(m: Materials, candles = 1): THREE.Group {
  const b = new ModelBuilder();
  b.add(cyl(0.22, 0.22, 0.02, 24), m.plastic('#f2f2f2', 0.4), 0, 0.01, 0);
  b.add(cyl(0.17, 0.17, 0.12, 24), m.plastic('#f6d7e0', 0.4), 0, 0.08, 0);
  b.add(cyl(0.12, 0.12, 0.09, 24), m.plastic('#f4d35e', 0.4), 0, 0.185, 0);
  for (let i = 0; i < candles; i++) {
    const a = (i / candles) * Math.PI * 2;
    const r = candles > 1 ? 0.06 : 0;
    b.add(cyl(0.008, 0.008, 0.08, 6), m.plastic('#5fb7ad', 0.3), Math.cos(a) * r, 0.27, Math.sin(a) * r);
  }
  return b.group;
}

/** Simple drawn child portrait for the Alley of Friends. */
export function kidPortrait(n: number, empty = false): HTMLCanvasElement {
  const [c, g] = canvas(256, 320);
  g.fillStyle = '#efe6cf';
  g.fillRect(0, 0, 256, 320);
  const rng = new Rng(n * 7 + 3);
  if (empty) {
    g.fillStyle = '#d8ccb0';
    g.fillRect(16, 16, 224, 240);
    g.fillStyle = '#c0392b';
    g.font = "700 40px 'Caveat', cursive";
    g.textAlign = 'center';
    g.save();
    g.translate(128, 140);
    g.rotate(-0.12);
    g.fillText('ПРИХОДИ', 0, -10);
    g.fillText('ЕЩЁ', 0, 34);
    g.restore();
  } else {
    const bg = ['#a8d8d0', '#f6d7a8', '#c9b8e8', '#f4b8b0', '#b8d8a8'][n % 5];
    g.fillStyle = bg;
    g.fillRect(16, 16, 224, 240);
    const skin = rng.pick(['#f1c9a5', '#e0ac87', '#c68c62', '#f6d8bd']);
    const hair = rng.pick(['#3b2a1e', '#7a4a2a', '#d9b26b', '#1d1d1d', '#a0522d']);
    const shirt = rng.pick(['#e74c3c', '#3498db', '#f1c40f', '#2ecc71', '#9b59b6', '#e67e22']);
    g.fillStyle = shirt;
    g.beginPath();
    g.ellipse(128, 270, 90, 70, 0, Math.PI, 0);
    g.fill();
    g.fillStyle = skin;
    g.fillRect(112, 180, 32, 30);
    g.beginPath();
    g.ellipse(128, 140, 52, 60, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = hair;
    g.beginPath();
    g.ellipse(128, 105, 58, 40, 0, Math.PI, 0);
    g.fill();
    if (rng.next() < 0.5) {
      g.fillRect(70, 100, 18, 70);
      g.fillRect(168, 100, 18, 70);
    }
    g.fillStyle = '#222';
    g.beginPath();
    g.arc(108, 140, 5, 0, Math.PI * 2);
    g.arc(148, 140, 5, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#7a2a2a';
    g.lineWidth = 3;
    g.beginPath();
    g.arc(128, 160, 16, 0.15 * Math.PI, 0.85 * Math.PI);
    g.stroke();
    // tiny Verity sticker in the corner
    drawVerity(g, 210, 46, 16, { flat: true });
  }
  g.fillStyle = '#2b2b2b';
  g.font = "600 26px 'IBM Plex Sans', sans-serif";
  g.textAlign = 'center';
  g.fillText(`ДРУГ №${n}`, 128, 296);
  // fade
  g.fillStyle = 'rgba(255,230,180,0.15)';
  g.fillRect(0, 0, 256, 320);
  return c;
}

/** Birthday photo with N candles and a date caption. */
export function birthdayPhoto(year: number, candles: number, caption: string): HTMLCanvasElement {
  const [c, g] = canvas(320, 260);
  g.fillStyle = '#fff';
  g.fillRect(0, 0, 320, 260);
  g.fillStyle = '#5a4532';
  g.fillRect(12, 12, 296, 196);
  // table + cake
  g.fillStyle = '#7a5a3a';
  g.fillRect(12, 160, 296, 48);
  g.fillStyle = '#f6d7e0';
  g.fillRect(120, 120, 80, 42);
  g.fillStyle = '#f4d35e';
  g.fillRect(132, 98, 56, 24);
  for (let i = 0; i < candles; i++) {
    const x = 160 + (i - (candles - 1) / 2) * 16;
    g.fillStyle = '#5fb7ad';
    g.fillRect(x - 3, 74, 6, 24);
    g.fillStyle = '#ffd36a';
    g.beginPath();
    g.ellipse(x, 68, 4, 8, 0, 0, Math.PI * 2);
    g.fill();
  }
  drawVerity(g, 250, 120, 34, { wave: true });
  g.fillStyle = 'rgba(255,220,150,0.2)';
  g.fillRect(12, 12, 296, 196);
  g.fillStyle = '#333';
  g.font = "700 26px 'Caveat', cursive";
  g.fillText(caption, 16, 244);
  void year;
  return c;
}

/** Big Verity mascot costume head (hollow). */
export function costumeHead(m: Materials): THREE.Group {
  const b = new ModelBuilder();
  const fur = m.cloth('#e8c75a', 0.7);
  const shell = new THREE.SphereGeometry(0.42, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.82);
  b.add(shell, fur, 0, 0.42, 0).material = fur;
  (b.group.children[0] as THREE.Mesh).material = fur.clone();
  ((b.group.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
  const white = m.cloth('#f7f3ea', 0.5);
  const black = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.3 });
  for (const sx of [-1, 1]) {
    b.add(sphere(0.11, 16, 12), white, sx * 0.15, 0.52, 0.34).scale.set(1, 1.15, 0.5);
    b.add(sphere(0.05, 12, 8), black, sx * 0.15, 0.5, 0.39);
  }
  b.add(new THREE.TorusGeometry(0.11, 0.015, 6, 16, Math.PI), black, 0, 0.35, 0.39, 0, 0, Math.PI);
  b.add(cyl(0.01, 0.01, 0.2, 6), m.steel('#999', 0.4), 0, 0.9, 0);
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 0.04 : 0.09;
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  s.closePath();
  b.add(new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: false }), m.cloth('#f4d35e', 0.6), 0, 1.03, -0.015);
  return b.group;
}

export function clothesRack(m: Materials, w = 1.6): THREE.Group {
  const b = new ModelBuilder();
  const steel = m.steel('#9aa0a6', 0.5);
  for (const x of [-w / 2, w / 2]) {
    b.add(cyl(0.02, 0.02, 1.7, 8), steel, x, 0.85, 0);
    b.add(box(0.05, 0.03, 0.5), steel, x, 0.02, 0);
  }
  b.add(cyl(0.018, 0.018, w, 8), steel, 0, 1.68, 0, 0, 0, Math.PI / 2);
  const rng = new Rng(9);
  for (let i = 0; i < 6; i++) {
    const x = -w / 2 + 0.2 + i * ((w - 0.4) / 5);
    const col = rng.pick(['#e8c75a', '#ef8a7e', '#2fa79b', '#7a1f2b', '#3b2c63']);
    b.add(rbox(0.42, 0.75, 0.12, 0.05, 2), m.cloth(col, 0.6), x, 1.25, 0, 0, Math.PI / 2 + rng.range(-0.2, 0.2), 0);
  }
  return b.group;
}

export function cashRegister(m: Materials): THREE.Group {
  const b = new ModelBuilder();
  const body = m.plastic('#d9cfb6', 0.6);
  b.add(rbox(0.4, 0.12, 0.42, 0.01), body, 0, 0.06, 0);
  b.add(rbox(0.36, 0.14, 0.2, 0.02), body, 0, 0.17, -0.07, -0.3);
  b.add(rbox(0.18, 0.08, 0.04, 0.01), new THREE.MeshStandardMaterial({ color: 0x0a1a0a }), 0, 0.3, -0.12, -0.2);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) b.add(box(0.04, 0.015, 0.035), m.plastic('#efe8d6', 0.4), -0.08 + c * 0.05, 0.13, 0.05 + r * 0.045);
  return b.group;
}

export function breakerPanelBody(m: Materials): THREE.Group {
  const b = new ModelBuilder();
  const grey = m.painted('#7b8a8b', 0.55);
  b.add(rbox(1.2, 1.4, 0.22, 0.015), grey, 0, 0, 0.11);
  b.add(box(1.1, 1.3, 0.02), m.painted('#6c7a7b', 0.4), 0, 0, 0.21);
  // open door hanging to the side
  b.add(box(1.1, 1.3, 0.025), grey, -1.15, 0, 0.55, 0, -1.9, 0);
  return b.group;
}

export function keypadUnit(m: Materials): { group: THREE.Group; screen: THREE.MeshStandardMaterial } {
  const b = new ModelBuilder();
  b.add(rbox(0.16, 0.24, 0.05, 0.01), m.painted('#2a2c2e', 0.4), 0, 0, 0.025);
  const screen = new THREE.MeshStandardMaterial({ color: 0x0a120a, emissive: 0x2a7a3a, emissiveIntensity: 0 });
  b.add(box(0.12, 0.04, 0.01), screen, 0, 0.08, 0.052);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) b.add(rbox(0.032, 0.028, 0.012, 0.004), m.plastic('#bbbbbb', 0.4), -0.04 + c * 0.04, 0.03 - r * 0.035, 0.055);
  return { group: b.group, screen };
}

export function bannerCloth(m: Materials, art: HTMLCanvasElement, w: number, h: number): THREE.Mesh {
  const g = new THREE.PlaneGeometry(w, h, 12, 6);
  const pos = g.getAttribute('position');
  for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin((pos.getX(i) / w) * Math.PI * 3) * 0.05 + Math.sin(pos.getY(i) * 2) * 0.03);
  g.computeVertexNormals();
  const mat = m.canvasMaterial(art, { rough: 0.85 });
  mat.side = THREE.DoubleSide;
  return new THREE.Mesh(g, mat);
}

export function lostItems(m: Materials, seed = 1): THREE.Group {
  const b = new ModelBuilder();
  const rng = new Rng(seed);
  for (let i = 0; i < 9; i++) {
    const x = rng.range(-0.5, 0.5);
    const z = rng.range(-0.18, 0.18);
    const k = rng.int(0, 3);
    if (k === 0) b.add(rbox(0.12, 0.05, 0.16, 0.02), m.cloth(rng.pick(['#c0392b', '#2980b9', '#27ae60', '#f1c40f']), 0.6), x, 0.025, z, 0, rng.range(0, 3), 0);
    else if (k === 1) b.add(cyl(0.02, 0.02, 0.6, 8), m.cloth('#2c3e50', 0.5), x, 0.02, z, 0, 0, Math.PI / 2);
    else if (k === 2) b.add(sphere(0.06, 12, 8), m.plastic(rng.pick(['#e74c3c', '#3498db', '#f4d35e']), 0.4), x, 0.06, z);
    else b.add(rbox(0.1, 0.03, 0.06, 0.01), m.plastic('#333', 0.5), x, 0.015, z, 0, rng.range(0, 3), 0);
  }
  return b.group;
}
