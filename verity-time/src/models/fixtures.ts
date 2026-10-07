import * as THREE from 'three';
import type { Materials } from '../assets/Materials';
import { box, cyl, extrude, ModelBuilder, rbox, roundedRectShape, sphere, tube } from '../world/geom';
import { clockCanvas, sign as signCanvas, type SignOpts } from '../assets/Signage';

/** Every lamp returns its emissive material so a VLight can drive it. */
export interface LampModel {
  group: THREE.Group;
  bulb: THREE.MeshStandardMaterial;
  /** Light position relative to the model origin. */
  lightOffset: THREE.Vector3;
}

function bulbMat(color: string, intensity = 3): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: 0x111111, emissive: new THREE.Color(color), emissiveIntensity: intensity, roughness: 0.3 });
}

/** Recessed fluorescent troffer (origin at ceiling, hangs down). */
export function troffer(m: Materials, len = 1.2, color = '#eef4ff'): LampModel {
  const b = new ModelBuilder();
  const frame = m.painted('#d8d8d2', 0.3);
  b.add(rbox(len + 0.06, 0.06, 0.62, 0.008, 1, 0.5), frame, 0, -0.03, 0);
  const bulb = bulbMat(color, 2.5);
  const diffuser = b.add(box(len - 0.04, 0.012, 0.54), bulb, 0, -0.062, 0);
  diffuser.castShadow = false;
  // louvre grid
  const lou = m.steel('#cfd2d4', 0.3);
  for (let i = 1; i < 6; i++) b.add(box(0.008, 0.02, 0.54), lou, -len / 2 + (i * len) / 6, -0.07, 0);
  b.add(box(len - 0.04, 0.02, 0.008), lou, 0, -0.07, 0);
  return { group: b.group, bulb, lightOffset: new THREE.Vector3(0, -0.25, 0) };
}

/** Industrial dome pendant (origin at ceiling). */
export function pendant(m: Materials, drop = 1.2, color = '#ffd9a0', shade = '#2f4a45'): LampModel {
  const b = new ModelBuilder();
  const steel = m.steel('#4a4d50', 0.6);
  b.add(cyl(0.006, 0.006, drop, 6), steel, 0, -drop / 2, 0);
  b.add(cyl(0.05, 0.05, 0.03, 12), steel, 0, -0.015, 0);
  const prof = new THREE.LatheGeometry(
    [
      [0.03, 0],
      [0.05, -0.02],
      [0.12, -0.08],
      [0.22, -0.18],
      [0.25, -0.21],
      [0.245, -0.215],
      [0.2, -0.18],
      [0.04, -0.03],
    ].map(([r, y]) => new THREE.Vector2(r, y)),
    24,
  );
  const shadeM = m.painted(shade, 0.5);
  (shadeM as any).side = THREE.DoubleSide;
  b.add(prof, shadeM, 0, -drop, 0);
  const bulb = bulbMat(color, 3);
  b.add(sphere(0.06, 12, 10), bulb, 0, -drop - 0.14, 0).castShadow = false;
  return { group: b.group, bulb, lightOffset: new THREE.Vector3(0, -drop - 0.3, 0) };
}

/** Caged bulkhead light for walls (origin on wall, facing +z). */
export function cageLamp(m: Materials, color = '#ffcf8a'): LampModel {
  const b = new ModelBuilder();
  const base = m.painted('#3b3f3a', 0.6);
  b.add(cyl(0.09, 0.1, 0.05, 16), base, 0, 0, 0.025, Math.PI / 2);
  const bulb = bulbMat(color, 3);
  b.add(sphere(0.07, 14, 10), bulb, 0, 0, 0.1).castShadow = false;
  const wire = m.steel('#2a2a2a', 0.5);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const pts = [new THREE.Vector3(Math.cos(a) * 0.09, Math.sin(a) * 0.09, 0.04), new THREE.Vector3(Math.cos(a) * 0.1, Math.sin(a) * 0.1, 0.12), new THREE.Vector3(0, 0, 0.19)];
    b.add(tube(pts, 0.005, 8, 4), wire);
  }
  b.add(new THREE.TorusGeometry(0.1, 0.006, 6, 20), wire, 0, 0, 0.11);
  return { group: b.group, bulb, lightOffset: new THREE.Vector3(0, 0, 0.35) };
}

/** Red emergency light box (origin on wall facing +z). */
export function emergencyLight(m: Materials): LampModel {
  const b = new ModelBuilder();
  b.add(rbox(0.3, 0.12, 0.08, 0.015), m.plastic('#d8d4c8', 0.6), 0, 0, 0.04);
  const bulb = bulbMat('#ff2a1a', 3);
  b.add(rbox(0.12, 0.08, 0.04, 0.01), bulb, -0.07, 0, 0.09).castShadow = false;
  b.add(rbox(0.12, 0.08, 0.04, 0.01), bulb, 0.07, 0, 0.09).castShadow = false;
  return { group: b.group, bulb, lightOffset: new THREE.Vector3(0, -0.1, 0.4) };
}

/** Warm wall sconce with fabric shade. */
export function sconce(m: Materials, color = '#ffd8a0'): LampModel {
  const b = new ModelBuilder();
  const brass = m.steel('#b08d57', 0.4);
  b.add(cyl(0.05, 0.05, 0.02, 16), brass, 0, 0, 0.01, Math.PI / 2);
  b.add(cyl(0.012, 0.012, 0.15, 8), brass, 0, 0, 0.08, Math.PI / 2);
  const shade = new THREE.CylinderGeometry(0.07, 0.11, 0.16, 20, 1, true);
  const bulb = bulbMat(color, 2);
  bulb.side = THREE.DoubleSide;
  b.add(shade, bulb, 0, 0.04, 0.16).castShadow = false;
  return { group: b.group, bulb, lightOffset: new THREE.Vector3(0, 0.05, 0.4) };
}

/** Stage / theatre spotlight can (origin at mount). */
export function stageSpot(m: Materials, color = '#fff2d0'): LampModel {
  const b = new ModelBuilder();
  const black = m.painted('#1d1d1f', 0.4);
  b.add(cyl(0.11, 0.13, 0.36, 16), black, 0, -0.15, 0, Math.PI / 2 - 0.5);
  b.add(box(0.3, 0.02, 0.04), black, 0, 0, 0);
  const bulb = bulbMat(color, 3);
  const lens = b.add(new THREE.CircleGeometry(0.1, 16), bulb, 0, -0.25, 0.16, -0.5 - Math.PI / 2 + Math.PI);
  lens.castShadow = false;
  return { group: b.group, bulb, lightOffset: new THREE.Vector3(0, -0.4, 0.3) };
}

// ---------------------------------------------------------------- signs

export function signPanel(m: Materials, text: string, o: SignOpts & { emissive?: number; width?: number } = {}): THREE.Group {
  const c = signCanvas(text, o);
  const w = o.width ?? 1;
  const h = (w * c.height) / c.width;
  const b = new ModelBuilder();
  b.add(rbox(w + 0.04, h + 0.04, 0.03, 0.01), m.painted('#2a2a2a', 0.4), 0, 0, 0.015);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m.canvasMaterial(c, { emissive: o.emissive, rough: 0.6 }));
  face.position.z = 0.032;
  b.group.add(face);
  return b.group;
}

export function exitSign(m: Materials, text = 'ВЫХОД'): LampModel {
  const b = new ModelBuilder();
  b.add(rbox(0.46, 0.18, 0.06, 0.01), m.plastic('#e7e4dc', 0.5), 0, 0, 0.03);
  const c = signCanvas(text, { bg: '#0d7a3a', fg: '#e8ffe8', icon: 'exit', w: 512, h: 192 });
  const mat = m.canvasMaterial(c, { emissive: 1.6 });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.155), mat);
  face.position.z = 0.062;
  b.group.add(face);
  return { group: b.group, bulb: mat, lightOffset: new THREE.Vector3(0, -0.2, 0.3) };
}

/** Wall clock — stopped at 19:00 (or given time). */
export function wallClock(m: Materials, hh = 19, mm = 0, r = 0.17): THREE.Group {
  const b = new ModelBuilder();
  b.add(new THREE.CylinderGeometry(r * 1.08, r * 1.08, 0.05, 32), m.painted('#2b2b2b', 0.3), 0, 0, 0.025, Math.PI / 2);
  const face = new THREE.Mesh(new THREE.CircleGeometry(r, 32), m.canvasMaterial(clockCanvas(hh, mm), { rough: 0.4 }));
  face.position.z = 0.052;
  b.group.add(face);
  const glass = new THREE.Mesh(new THREE.CircleGeometry(r, 32), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, roughness: 0.05, clearcoat: 1 }));
  glass.position.z = 0.056;
  b.group.add(glass);
  return b.group;
}

export function cctv(m: Materials): THREE.Group {
  const b = new ModelBuilder();
  const white = m.plastic('#dcdad2', 0.5);
  b.add(box(0.08, 0.12, 0.04), white, 0, 0, 0.02);
  b.add(cyl(0.015, 0.015, 0.16, 8), white, 0, -0.02, 0.1, Math.PI / 2);
  const body = b.add(rbox(0.12, 0.1, 0.26, 0.02), white, 0, -0.07, 0.2, 0.35);
  void body;
  b.add(cyl(0.035, 0.035, 0.02, 16), new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.1 }), 0, -0.12, 0.33, Math.PI / 2 + 0.35);
  const led = new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff0000, emissiveIntensity: 0 });
  b.add(sphere(0.008, 6, 4), led, 0.04, -0.04, 0.3);
  b.group.userData.led = led;
  return b.group;
}

export function ventGrille(m: Materials, w = 0.6, h = 0.4): THREE.Group {
  const b = new ModelBuilder();
  const mat = m.painted('#c9c7bf', 0.6);
  b.add(box(w, h, 0.03), mat, 0, 0, 0.015);
  const dark = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 1 });
  b.add(box(w - 0.06, h - 0.06, 0.01), dark, 0, 0, 0.026);
  const n = Math.floor(h / 0.04);
  for (let i = 0; i < n; i++) b.add(box(w - 0.06, 0.012, 0.03), mat, 0, -h / 2 + 0.05 + i * ((h - 0.1) / (n - 1)), 0.035, -0.6);
  return b.group;
}

/** Pipe along a polyline with flanges at joints. */
export function pipeRun(m: Materials, pts: THREE.Vector3[], r = 0.06, color = '#5e6b5c', rust = 0.5): THREE.Group {
  const b = new ModelBuilder();
  const mat = m.painted(color, rust);
  const flange = m.steel('#6f6a62', 0.7);
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const c = pts[i + 1];
    const len = a.distanceTo(c);
    const g = cyl(r, r, len, 12, 0.4, true);
    const mesh = b.add(g, mat);
    mesh.position.copy(a).add(c).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), c.clone().sub(a).normalize());
    for (const p of [a, c]) {
      const fl = b.add(cyl(r * 1.35, r * 1.35, 0.04, 12), flange);
      fl.position.copy(p);
      fl.quaternion.copy(mesh.quaternion);
    }
  }
  for (let i = 1; i < pts.length - 1; i++) b.add(sphere(r * 1.02, 12, 8), mat, pts[i].x, pts[i].y, pts[i].z);
  return b.group;
}

export function fireCabinet(m: Materials): THREE.Group {
  const b = new ModelBuilder();
  const red = m.painted('#a52a22', 0.45);
  b.add(rbox(0.5, 0.8, 0.2, 0.01), red, 0, 0.4, 0.1);
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xaaccdd, transparent: true, opacity: 0.25, roughness: 0.1 });
  b.add(box(0.4, 0.6, 0.01), glass, 0, 0.42, 0.205);
  b.add(cyl(0.07, 0.07, 0.45, 14), red, 0, 0.36, 0.1);
  b.add(cyl(0.03, 0.03, 0.1, 8), m.painted('#111', 0.3), 0, 0.64, 0.1);
  const c = signCanvas('ОГНЕТУШИТЕЛЬ', { bg: '#a52a22', fg: '#fff', w: 512, h: 96 });
  const label = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.075), m.canvasMaterial(c));
  label.position.set(0, 0.06, 0.206);
  b.group.add(label);
  return b.group;
}

export function radiator(m: Materials, w = 0.9): THREE.Group {
  const b = new ModelBuilder();
  const mat = m.painted('#d8d4c8', 0.6);
  const n = Math.floor(w / 0.07);
  for (let i = 0; i < n; i++) b.add(rbox(0.05, 0.6, 0.1, 0.02), mat, -w / 2 + i * 0.07 + 0.035, 0.4, 0.07);
  b.add(cyl(0.02, 0.02, w, 8), mat, 0, 0.14, 0.07, 0, 0, Math.PI / 2);
  b.add(cyl(0.02, 0.02, w, 8), mat, 0, 0.66, 0.07, 0, 0, Math.PI / 2);
  return b.group;
}

export function cableBundle(m: Materials, pts: THREE.Vector3[], count = 3): THREE.Group {
  const b = new ModelBuilder();
  const cols = ['#1a1a1a', '#3a3a3a', '#5a1a1a', '#1a2a4a'];
  for (let i = 0; i < count; i++) {
    const off = new THREE.Vector3((i - count / 2) * 0.03, (i % 2) * 0.02, 0);
    b.add(tube(pts.map((p) => p.clone().add(off)), 0.012, 40, 6), m.rubber(cols[i % cols.length]));
  }
  return b.group;
}

/** Junction / breaker box closed (decor). */
export function electricalBox(m: Materials, w = 0.4, h = 0.5): THREE.Group {
  const b = new ModelBuilder();
  b.add(rbox(w, h, 0.15, 0.01), m.painted('#7b8a8b', 0.6), 0, 0, 0.075);
  b.add(box(w * 0.9, h * 0.9, 0.01), m.painted('#8c9a9b', 0.5), 0, 0, 0.152);
  const warn = signCanvas('⚡ 380 В', { bg: '#f1c40f', fg: '#111', w: 256, h: 96 });
  const lab = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.5, w * 0.19), m.canvasMaterial(warn));
  lab.position.set(0, h * 0.25, 0.158);
  b.group.add(lab);
  return b.group;
}

export function framedPicture(m: Materials, canvas: HTMLCanvasElement, w = 0.5, frameColor = '#4a3020'): THREE.Group {
  const h = (w * canvas.height) / canvas.width;
  const b = new ModelBuilder();
  const shape = roundedRectShape(w + 0.06, h + 0.06, 0.005);
  const hole = new THREE.Path();
  hole.moveTo(-w / 2, -h / 2);
  hole.lineTo(w / 2, -h / 2);
  hole.lineTo(w / 2, h / 2);
  hole.lineTo(-w / 2, h / 2);
  hole.lineTo(-w / 2, -h / 2);
  shape.holes.push(hole);
  b.add(extrude(shape, 0.025, 0.004, 0.3), m.woodProp(frameColor, 0.4), 0, 0, 0.0125);
  const pic = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m.canvasMaterial(canvas, { rough: 0.5 }));
  pic.position.z = 0.012;
  b.group.add(pic);
  return b.group;
}

/** Flat poster/drawing taped to a wall (origin = centre, facing +z). */
export function paperOnWall(m: Materials, canvas: HTMLCanvasElement, w = 0.6, tape = true, curl = 0): THREE.Group {
  const h = (w * canvas.height) / canvas.width;
  const g = new THREE.Group();
  const geo = new THREE.PlaneGeometry(w, h, 4, 4);
  if (curl) {
    const pos = geo.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const x = pos.getX(i);
      if (y < -h * 0.2) pos.setZ(i, ((-y - h * 0.2) / h) * curl * (1 + x * 0.5));
    }
    geo.computeVertexNormals();
  }
  const mat = m.canvasMaterial(canvas, { rough: 0.85, alphaTest: 0.5 });
  mat.side = THREE.DoubleSide;
  const p = new THREE.Mesh(geo, mat);
  p.position.z = 0.004;
  p.receiveShadow = true;
  g.add(p);
  if (tape) {
    const tm = new THREE.MeshStandardMaterial({ color: 0xe8dfb8, roughness: 0.6, transparent: true, opacity: 0.8 });
    for (const [x, y, r] of [
      [-w / 2 + 0.02, h / 2 - 0.02, 0.6],
      [w / 2 - 0.02, h / 2 - 0.02, -0.6],
    ]) {
      const t = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.025), tm);
      t.position.set(x, y, 0.006);
      t.rotation.z = r;
      g.add(t);
    }
  }
  return g;
}
