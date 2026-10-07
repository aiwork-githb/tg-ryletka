import * as THREE from 'three';
import type { Materials } from '../assets/Materials';
import { box, cyl, extrude, ModelBuilder, rbox, sphere, tube } from '../world/geom';
import { canvas, drawVerity, sign } from '../assets/Signage';
import { Rng } from '../assets/noise';

/** Small hatchback; returns headlight materials in userData. */
export function car(m: Materials, color = '#5a6a78'): THREE.Group {
  const b = new ModelBuilder();
  const paint = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(color), roughness: 0.35, metalness: 0.5, clearcoat: 1, clearcoatRoughness: 0.15 });
  // side profile extruded across the width
  const s = new THREE.Shape();
  s.moveTo(-2.0, 0.32);
  s.lineTo(-2.05, 0.75);
  s.quadraticCurveTo(-1.95, 0.9, -1.5, 0.92);
  s.lineTo(-0.85, 0.98);
  s.quadraticCurveTo(-0.4, 1.45, 0.2, 1.45);
  s.lineTo(1.25, 1.42);
  s.quadraticCurveTo(1.7, 1.38, 1.95, 0.95);
  s.lineTo(2.02, 0.4);
  s.lineTo(1.75, 0.32);
  s.lineTo(-2.0, 0.32);
  const bodyGeo = new THREE.ExtrudeGeometry(s, { depth: 1.66, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 3, curveSegments: 10 });
  bodyGeo.translate(0, 0, -0.83);
  b.add(bodyGeo, paint);
  // windows (dark glass slabs slightly outside the body)
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x0a0c10, roughness: 0.05, metalness: 0.2, clearcoat: 1 });
  const w = new THREE.Shape();
  w.moveTo(-0.75, 1.0);
  w.quadraticCurveTo(-0.35, 1.38, 0.2, 1.38);
  w.lineTo(1.2, 1.36);
  w.quadraticCurveTo(1.55, 1.3, 1.75, 1.0);
  w.lineTo(-0.75, 1.0);
  const wg = new THREE.ExtrudeGeometry(w, { depth: 1.74, bevelEnabled: false });
  wg.translate(0, 0, -0.87);
  b.add(wg, glass);
  // wheels
  const tyre = m.rubber('#151515');
  const rim = m.steel('#9aa0a6', 0.3);
  for (const x of [-1.3, 1.3])
    for (const z of [-0.82, 0.82]) {
      b.add(cyl(0.33, 0.33, 0.24, 20), tyre, x, 0.33, z, Math.PI / 2);
      b.add(cyl(0.2, 0.2, 0.25, 12), rim, x, 0.33, z, Math.PI / 2);
    }
  // lights
  const head = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xfff3d0, emissiveIntensity: 4 });
  const tail = new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff1a0a, emissiveIntensity: 2 });
  for (const z of [-0.6, 0.6]) {
    b.add(rbox(0.06, 0.14, 0.32, 0.02), head, 2.03, 0.72, z);
    b.add(rbox(0.06, 0.12, 0.26, 0.02), tail, -2.06, 0.78, z);
  }
  b.add(box(0.05, 0.12, 1.2), m.steel('#2a2a2a', 0.5), 2.03, 0.5, 0);
  b.add(box(0.12, 0.08, 0.5), m.flat('#e8e2d0', 0.6, 0), -2.07, 0.55, 0);
  b.group.userData.head = head;
  b.group.userData.colliders = [[0, 0.75, 0, 2.05, 0.75, 0.9]];
  return b.group;
}

export function streetLamp(m: Materials, h = 6): { group: THREE.Group; bulb: THREE.MeshStandardMaterial } {
  const b = new ModelBuilder();
  const pole = m.painted('#3d4648', 0.7);
  b.add(cyl(0.07, 0.1, h, 12), pole, 0, h / 2, 0);
  b.add(cyl(0.16, 0.18, 0.4, 12), pole, 0, 0.2, 0);
  b.add(tube([new THREE.Vector3(0, h - 0.2, 0), new THREE.Vector3(0.3, h + 0.15, 0), new THREE.Vector3(1.1, h + 0.2, 0)], 0.045, 16, 8), pole);
  b.add(rbox(0.7, 0.14, 0.32, 0.05), pole, 1.25, h + 0.16, 0);
  const bulb = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xff9a3c, emissiveIntensity: 3 });
  b.add(box(0.55, 0.03, 0.24), bulb, 1.25, h + 0.075, 0).castShadow = false;
  b.group.userData.colliders = [[0, h / 2, 0, 0.12, h / 2, 0.12]];
  return { group: b.group, bulb };
}

export function bareTree(m: Materials, seed = 1, h = 6): THREE.Group {
  const b = new ModelBuilder();
  const bark = m.woodProp('#3a3128', 0.9);
  const rng = new Rng(seed);
  const branch = (start: THREE.Vector3, dir: THREE.Vector3, len: number, r: number, depth: number) => {
    const pts = [start.clone()];
    let p = start.clone();
    const d = dir.clone();
    for (let i = 0; i < 3; i++) {
      d.add(new THREE.Vector3(rng.range(-0.3, 0.3), rng.range(-0.05, 0.2), rng.range(-0.3, 0.3))).normalize();
      p = p.clone().addScaledVector(d, len / 3);
      pts.push(p);
    }
    b.add(tube(pts, r, 8, 6, 0.6), bark);
    if (depth <= 0 || r < 0.02) return;
    const n = depth > 2 ? 3 : 2;
    for (let k = 0; k < n; k++) {
      const t = 0.45 + k * 0.25;
      const at = pts[0].clone().lerp(pts[pts.length - 1], t);
      const nd = d.clone().add(new THREE.Vector3(rng.range(-1, 1), rng.range(0.1, 0.6), rng.range(-1, 1))).normalize();
      branch(at, nd, len * rng.range(0.5, 0.7), r * 0.55, depth - 1);
    }
  };
  branch(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0), h * 0.55, 0.16, 3);
  b.group.userData.colliders = [[0, 1.5, 0, 0.2, 1.5, 0.2]];
  return b.group;
}

/** Chain-link fence panel between two posts (origin = start, runs along +x). */
export function fence(m: Materials, len: number, h = 2.2): THREE.Group {
  const b = new ModelBuilder();
  const post = m.steel('#6a6f72', 0.7);
  const posts = Math.max(1, Math.round(len / 2.5));
  for (let i = 0; i <= posts; i++) b.add(cyl(0.035, 0.035, h, 8), post, (i * len) / posts, h / 2, 0);
  b.add(cyl(0.025, 0.025, len, 8), post, len / 2, h - 0.05, 0, 0, 0, Math.PI / 2);
  const mesh = m.get('grate') as THREE.MeshStandardMaterial;
  const g = new THREE.PlaneGeometry(len, h - 0.1);
  const uv = g.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * len * 3, uv.getY(i) * (h - 0.1) * 3);
  b.add(g, mesh, len / 2, (h - 0.1) / 2, 0);
  // barbed wire
  const wire = m.steel('#4a4e50', 0.8);
  for (let k = 0; k < 2; k++) {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= len * 4; i++) pts.push(new THREE.Vector3(i / 4, h + 0.08 + k * 0.12 + Math.sin(i * 2.3) * 0.02, Math.cos(i * 2.3) * 0.02));
    b.add(tube(pts, 0.006, Math.max(8, len * 8), 4), wire);
  }
  b.group.userData.colliders = [[len / 2, h / 2, 0, len / 2, h / 2, 0.06]];
  return b.group;
}

export function guardBooth(m: Materials): THREE.Group {
  const b = new ModelBuilder();
  const wall = m.get('wall_plaster');
  const trim = m.painted('#2f6f6a', 0.5);
  const W = 2.6;
  const D = 2.4;
  const H = 2.6;
  // back and side walls (front has door + big window)
  b.add(box(W, H, 0.1), wall, 0, H / 2, -D / 2);
  b.add(box(0.1, H, D), wall, -W / 2, H / 2, 0);
  b.add(box(0.1, H, D), wall, W / 2, H / 2, 0);
  b.add(box(W - 1.0, 0.9, 0.1), wall, -0.5, 0.45, D / 2);
  b.add(box(W - 1.0, 0.3, 0.1), wall, -0.5, H - 0.15, D / 2);
  b.add(box(0.1, H, 0.1), wall, 0.0 + 0.05, H / 2, D / 2);
  b.add(box(0.1, 0.4, 0.1), wall, W / 2 - 0.05, H - 0.2, D / 2);
  b.add(box(1.0, 0.4, 0.1), wall, 0.75, H - 0.2, D / 2);
  const glass = m.get('glass_dirty');
  b.add(box(W - 1.0, H - 1.2, 0.02), glass, -0.5, 0.9 + (H - 1.2) / 2, D / 2);
  // roof
  b.add(box(W + 0.5, 0.18, D + 0.5), trim, 0, H + 0.09, 0);
  b.add(box(W + 0.2, 0.06, 0.06), trim, 0, 0.92, D / 2 + 0.03);
  // floor inside
  b.add(box(W, 0.06, D), m.painted('#5a5f5c', 0.7), 0, 0.03, 0);
  b.group.userData.colliders = [
    [0, H / 2, -D / 2, W / 2, H / 2, 0.06],
    [-W / 2, H / 2, 0, 0.06, H / 2, D / 2],
    [W / 2, H / 2, 0, 0.06, H / 2, D / 2],
    [-0.5, H / 2, D / 2, (W - 1.0) / 2, H / 2, 0.06],
  ];
  return b.group;
}

/** Entrance arch over the path with the park name. */
export function ticketArch(m: Materials, w = 7): THREE.Group {
  const b = new ModelBuilder();
  const teal = m.painted('#2f6f6a', 0.6);
  const cream = m.painted('#efe3c8', 0.6);
  for (const x of [-w / 2, w / 2]) {
    b.add(rbox(0.5, 4.6, 0.5, 0.04), teal, x, 2.3, 0);
    b.add(sphere(0.38, 16, 12), m.painted('#f4d35e', 0.6), x, 4.95, 0);
  }
  const [c, g] = canvas(1024, 256);
  g.fillStyle = '#efe3c8';
  g.fillRect(0, 0, 1024, 256);
  g.fillStyle = '#d94f45';
  g.fillRect(0, 0, 1024, 26);
  g.fillRect(0, 230, 1024, 26);
  g.fillStyle = '#3b2c63';
  g.font = "700 120px 'Comfortaa', sans-serif";
  g.textAlign = 'center';
  g.fillText('ВРЕМЯ ВЕРИТИ', 560, 170);
  drawVerity(g, 110, 130, 62, { wave: true });
  g.globalCompositeOperation = 'source-atop';
  const rng = new Rng(3);
  for (let i = 0; i < 40; i++) {
    g.fillStyle = `rgba(60,40,20,${rng.range(0.05, 0.25)})`;
    g.beginPath();
    g.arc(rng.range(0, 1024), rng.range(0, 256), rng.range(10, 90), 0, Math.PI * 2);
    g.fill();
  }
  const board = new THREE.Mesh(new THREE.BoxGeometry(w - 0.3, 1.5, 0.15), [cream, cream, cream, cream, m.canvasMaterial(c, { rough: 0.7 }), m.canvasMaterial(c, { rough: 0.7 })]);
  board.position.y = 4.1;
  board.castShadow = true;
  b.group.add(board);
  b.group.userData.colliders = [
    [-w / 2, 2.3, 0, 0.26, 2.3, 0.26],
    [w / 2, 2.3, 0, 0.26, 2.3, 0.26],
  ];
  return b.group;
}

export function billboard(m: Materials, art: HTMLCanvasElement, w = 6, h = 3): THREE.Group {
  const b = new ModelBuilder();
  const steel = m.steel('#5a5f62', 0.8);
  for (const x of [-w * 0.3, w * 0.3]) b.add(cyl(0.12, 0.14, 5, 10), steel, x, 2.5, 0);
  b.add(box(w + 0.2, h + 0.2, 0.15), m.painted('#2a2d2f', 0.7), 0, 5 + h / 2 - 0.4, -0.05);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m.canvasMaterial(art, { rough: 0.8 }));
  face.position.set(0, 5 + h / 2 - 0.4, 0.04);
  b.group.add(face);
  for (const x of [-w * 0.35, 0, w * 0.35]) {
    b.add(cyl(0.02, 0.02, 0.6, 6), steel, x, 5 + h + 0.0, 0.3, 0.6);
    b.add(cyl(0.08, 0.06, 0.15, 10), steel, x, 5 + h + 0.25, 0.55, 0.9);
  }
  b.group.userData.colliders = [
    [-w * 0.3, 2.5, 0, 0.15, 2.5, 0.15],
    [w * 0.3, 2.5, 0, 0.15, 2.5, 0.15],
  ];
  return b.group;
}

/** Concrete parking bumper / jersey barrier. */
export function barrier(m: Materials, len = 2): THREE.Group {
  const b = new ModelBuilder();
  const s = new THREE.Shape();
  s.moveTo(-0.3, 0);
  s.lineTo(0.3, 0);
  s.lineTo(0.12, 0.25);
  s.lineTo(0.08, 0.8);
  s.lineTo(-0.08, 0.8);
  s.lineTo(-0.12, 0.25);
  s.lineTo(-0.3, 0);
  const g = extrude(s, len, 0.01, 1);
  g.rotateY(Math.PI / 2);
  b.add(g, m.get('concrete') as THREE.Material);
  return b.group;
}

export function doorMat(m: Materials): THREE.Group {
  const b = new ModelBuilder();
  b.add(rbox(0.9, 0.02, 0.55, 0.01), m.rubber('#2a2622'), 0, 0.01, 0);
  b.add(box(0.8, 0.005, 0.45), m.cloth('#5a3a2a', 0.9), 0, 0.022, 0);
  return b.group;
}

export function facadeSign(m: Materials, text: string, glow = 0): { group: THREE.Group; mat: THREE.MeshStandardMaterial } {
  const c = sign(text, { bg: '#1a1a1e', fg: '#ff7ab8', font: 'brand', w: 1024, h: 200 });
  const mat = m.canvasMaterial(c, { emissive: glow, rough: 0.5 });
  const g = new THREE.Group();
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.75), mat);
  g.add(panel);
  return { group: g, mat };
}
