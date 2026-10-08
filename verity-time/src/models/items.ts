import * as THREE from 'three';
import type { Materials } from '../assets/Materials';
import { box, cyl, extrude, ModelBuilder, rbox, roundedRectShape, sphere, tube } from '../world/geom';
import { canvas, drawVerity, photo } from '../assets/Signage';
import { star as starPath } from '../assets/recipes';

function cardCanvas(title: string, sub: string, color: string, verity = true): HTMLCanvasElement {
  const [c, g] = canvas(512, 320);
  g.fillStyle = color;
  g.fillRect(0, 0, 512, 320);
  g.fillStyle = 'rgba(255,255,255,0.85)';
  g.fillRect(0, 230, 512, 90);
  if (verity) drawVerity(g, 400, 120, 60, { wave: true });
  g.fillStyle = '#fff';
  g.font = "700 46px 'Comfortaa', sans-serif";
  g.fillText(title, 28, 70);
  g.fillStyle = '#222';
  g.font = "600 34px 'IBM Plex Mono', monospace";
  g.fillText(sub, 28, 288);
  // magnetic stripe hint
  g.fillStyle = 'rgba(0,0,0,0.6)';
  g.fillRect(28, 100, 120, 80);
  g.fillStyle = '#d4af37';
  g.fillRect(40, 112, 60, 48);
  return c;
}

export function keycard(m: Materials, title: string, sub: string, color: string): THREE.Group {
  const b = new ModelBuilder();
  const shape = roundedRectShape(0.086, 0.054, 0.004);
  b.add(extrude(shape, 0.002, 0.0006), m.plastic('#f2f2f2', 0.2), 0, 0, 0, -Math.PI / 2);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.084, 0.052), m.canvasMaterial(cardCanvas(title, sub, color), { rough: 0.4 }));
  face.rotation.x = -Math.PI / 2;
  face.position.y = 0.0016;
  b.group.add(face);
  b.group.scale.setScalar(1.6);
  return b.group;
}

export function fuse(m: Materials): THREE.Group {
  const b = new ModelBuilder();
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xe8f0f0, transparent: true, opacity: 0.45, roughness: 0.05, clearcoat: 1 });
  b.add(cyl(0.014, 0.014, 0.07, 16), glass, 0, 0, 0, 0, 0, Math.PI / 2);
  for (const x of [-0.042, 0.042]) b.add(cyl(0.016, 0.016, 0.02, 16), m.steel('#c9b37a', 0.3), x, 0, 0, 0, 0, Math.PI / 2);
  b.add(cyl(0.002, 0.002, 0.07, 6), m.steel('#ccc', 0.2), 0, 0, 0, 0, 0, Math.PI / 2);
  b.add(box(0.03, 0.001, 0.012), m.flat('#c0392b', 0.6, 0), 0, 0.0145, 0);
  b.group.scale.setScalar(2);
  return b.group;
}

export function brassKey(m: Materials, tagColor = '#c0392b', tagText = ''): THREE.Group {
  const b = new ModelBuilder();
  const brass = m.steel('#b8964f', 0.35);
  b.add(new THREE.TorusGeometry(0.018, 0.005, 8, 20), brass, 0, 0, 0, Math.PI / 2);
  b.add(box(0.06, 0.004, 0.008), brass, 0.045, 0, 0);
  b.add(box(0.008, 0.004, 0.012), brass, 0.065, 0, 0.008);
  b.add(box(0.008, 0.004, 0.01), brass, 0.052, 0, 0.007);
  b.add(new THREE.TorusGeometry(0.01, 0.002, 6, 12), m.steel('#999', 0.3), -0.025, 0, 0, Math.PI / 2);
  b.add(rbox(0.04, 0.003, 0.025, 0.003), m.plastic(tagColor, 0.4), -0.055, 0, 0);
  void tagText;
  b.group.scale.setScalar(2);
  return b.group;
}

export function bracelet(m: Materials): THREE.Group {
  const b = new ModelBuilder();
  b.add(new THREE.TorusGeometry(0.045, 0.012, 12, 32), m.plastic('#2fa79b', 0.25), 0, 0, 0, Math.PI / 2);
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 0.012 : 0.028;
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  s.closePath();
  b.add(extrude(s, 0.01, 0.003), new THREE.MeshStandardMaterial({ color: 0xffe9a0, emissive: 0xffc93a, emissiveIntensity: 0.8 }), 0, 0.003, 0.05, -0.2);
  b.add(rbox(0.03, 0.008, 0.02, 0.004), m.plastic('#f4d35e', 0.3), 0, 0, -0.054);
  b.group.scale.setScalar(1.5);
  return b.group;
}

export function swatchCard(m: Materials): THREE.Group {
  const [c, g] = canvas(256, 384);
  g.fillStyle = '#f7f3ea';
  g.fillRect(0, 0, 256, 384);
  g.fillStyle = '#f4d35e';
  g.fillRect(20, 20, 216, 180);
  g.fillStyle = '#222';
  g.font = "600 22px 'IBM Plex Sans', sans-serif";
  g.fillText('«Верити-жёлтый»', 24, 236);
  g.font = "400 18px 'IBM Plex Mono', monospace";
  g.fillText('ОБРАЗЕЦ ПОКРЫТИЯ', 24, 266);
  g.fillText('партия 92-03', 24, 292);
  // burn mark
  const grd = g.createRadialGradient(200, 340, 5, 200, 340, 90);
  grd.addColorStop(0, 'rgba(20,10,0,1)');
  grd.addColorStop(0.5, 'rgba(60,30,0,0.8)');
  grd.addColorStop(1, 'rgba(60,30,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 250, 256, 134);
  const b = new ModelBuilder();
  b.add(box(0.09, 0.001, 0.135), m.canvasMaterial(c, { rough: 0.7 }), 0, 0, 0);
  b.group.scale.setScalar(1.8);
  return b.group;
}

export function memoryModule(m: Materials): THREE.Group {
  const b = new ModelBuilder();
  b.add(box(0.12, 0.004, 0.035), m.flat('#1f6b3a', 0.5, 0), 0, 0, 0);
  for (let i = 0; i < 8; i++) b.add(box(0.011, 0.004, 0.018), m.flat('#111', 0.3, 0.2), -0.05 + i * 0.0145, 0.004, 0.002);
  for (let i = 0; i < 20; i++) b.add(box(0.003, 0.0045, 0.004), m.steel('#d4af37', 0.2), -0.057 + i * 0.006, 0, 0.0165);
  b.group.scale.setScalar(2);
  return b.group;
}

export function filmReel(m: Materials): THREE.Group {
  const b = new ModelBuilder();
  const steel = m.steel('#9aa0a6', 0.4);
  b.add(cyl(0.1, 0.1, 0.004, 32), steel, 0, 0.012, 0);
  b.add(cyl(0.1, 0.1, 0.004, 32), steel, 0, -0.012, 0);
  b.add(cyl(0.075, 0.075, 0.022, 32), m.flat('#3a2a1a', 0.5, 0.1), 0, 0, 0);
  b.add(cyl(0.015, 0.015, 0.03, 12), steel, 0, 0, 0);
  const lab = canvas(256, 64);
  lab[1].fillStyle = '#efe6cf';
  lab[1].fillRect(0, 0, 256, 64);
  lab[1].fillStyle = '#222';
  lab[1].font = "600 26px 'IBM Plex Mono', monospace";
  lab[1].fillText('КР-07  12/14', 12, 42);
  const lm = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.02), m.canvasMaterial(lab[0]));
  lm.rotation.x = -Math.PI / 2;
  lm.position.y = 0.0145;
  b.group.add(lm);
  return b.group;
}

export function toneModule(m: Materials): THREE.Group {
  const b = new ModelBuilder();
  b.add(rbox(0.06, 0.02, 0.04, 0.006), m.plastic('#3b2c63', 0.3), 0, 0, 0);
  b.add(cyl(0.008, 0.008, 0.012, 10), m.plastic('#f4d35e', 0.3), -0.015, 0.014, 0);
  b.add(cyl(0.008, 0.008, 0.012, 10), m.plastic('#2fa79b', 0.3), 0.015, 0.014, 0);
  b.add(box(0.03, 0.002, 0.01), m.emissive('#7dfcae', 1.5), 0, 0.011, 0.012);
  b.group.scale.setScalar(2);
  return b.group;
}

export function valveWheel(m: Materials): THREE.Group {
  const b = new ModelBuilder();
  const red = m.painted('#a52a22', 0.6);
  b.add(new THREE.TorusGeometry(0.12, 0.014, 8, 28), red, 0, 0, 0, Math.PI / 2);
  for (let i = 0; i < 4; i++) b.add(cyl(0.008, 0.008, 0.24, 6), red, 0, 0, 0, Math.PI / 2, (i / 4) * Math.PI);
  b.add(cyl(0.025, 0.025, 0.03, 10), m.steel('#777', 0.5), 0, 0, 0);
  return b.group;
}

export function musicCylinder(m: Materials): THREE.Group {
  const b = new ModelBuilder();
  const brass = m.steel('#b8964f', 0.3);
  b.add(cyl(0.025, 0.025, 0.1, 20), brass, 0, 0, 0, 0, 0, Math.PI / 2);
  for (let i = 0; i < 40; i++) {
    const a = Math.random() * Math.PI * 2;
    b.add(cyl(0.002, 0.002, 0.006, 4), brass, -0.045 + Math.random() * 0.09, Math.cos(a) * 0.027, Math.sin(a) * 0.027, a, 0, 0);
  }
  b.add(cyl(0.004, 0.004, 0.14, 6), m.steel('#999', 0.3), 0, 0, 0, 0, 0, Math.PI / 2);
  b.group.scale.setScalar(1.6);
  return b.group;
}

export function cassette(m: Materials, label = 'ТЕО'): THREE.Group {
  const b = new ModelBuilder();
  b.add(rbox(0.1, 0.012, 0.064, 0.003), m.plastic('#2d2d30', 0.4), 0, 0, 0);
  const [c, g] = canvas(256, 128);
  g.fillStyle = '#f2ead3';
  g.fillRect(0, 0, 256, 128);
  g.fillStyle = '#1e2b55';
  g.font = "700 40px 'Caveat', cursive";
  g.fillText(label, 16, 56);
  g.fillStyle = '#333';
  g.fillRect(70, 70, 116, 40);
  const lm = new THREE.Mesh(new THREE.PlaneGeometry(0.085, 0.042), m.canvasMaterial(c));
  lm.rotation.x = -Math.PI / 2;
  lm.position.set(0, 0.0065, -0.004);
  b.group.add(lm);
  b.group.scale.setScalar(1.8);
  return b.group;
}

export function badge(m: Materials, name: string, color = '#1f3a5f'): THREE.Group {
  const b = new ModelBuilder();
  const [c, g] = canvas(256, 384);
  g.fillStyle = '#fff';
  g.fillRect(0, 0, 256, 384);
  g.fillStyle = color;
  g.fillRect(0, 0, 256, 80);
  g.fillStyle = '#fff';
  g.font = "700 30px 'IBM Plex Sans', sans-serif";
  g.fillText('ОХРАНА', 20, 52);
  g.drawImage(photo('nadia', 3, 160, 120), 48, 100, 160, 120);
  g.fillStyle = '#111';
  g.font = "600 28px 'IBM Plex Sans', sans-serif";
  g.fillText(name, 20, 280);
  g.font = "400 20px 'IBM Plex Mono', monospace";
  g.fillText('ООО «Ликвидком»', 20, 320);
  b.add(box(0.055, 0.002, 0.085), m.canvasMaterial(c, { rough: 0.3 }), 0, 0, 0);
  b.add(box(0.012, 0.003, 0.004), m.steel('#aaa', 0.3), 0, 0.001, -0.046);
  b.group.scale.setScalar(1.7);
  return b.group;
}

export function photoProp(m: Materials, kind: Parameters<typeof photo>[0]): THREE.Group {
  const b = new ModelBuilder();
  b.add(box(0.1, 0.001, 0.075), m.canvasMaterial(photo(kind, 5), { rough: 0.4 }), 0, 0, 0);
  b.group.scale.setScalar(1.6);
  return b.group;
}

export function powerCell(m: Materials): THREE.Group {
  const b = new ModelBuilder();
  b.add(rbox(0.16, 0.26, 0.16, 0.02), m.painted('#d4a32a', 0.5), 0, 0.13, 0);
  b.add(cyl(0.03, 0.03, 0.03, 12), m.steel('#999', 0.3), -0.04, 0.27, 0);
  b.add(cyl(0.03, 0.03, 0.03, 12), m.steel('#c0392b', 0.3), 0.04, 0.27, 0);
  b.add(box(0.1, 0.02, 0.005), m.emissive('#7dfcae', 1.5), 0, 0.2, 0.081);
  b.add(tube([new THREE.Vector3(-0.07, 0.26, 0), new THREE.Vector3(0, 0.33, 0), new THREE.Vector3(0.07, 0.26, 0)], 0.008, 12, 6), m.rubber('#222'));
  return b.group;
}

export function plushVerity(m: Materials, s = 1, color = '#f4d35e', worn = 0.3): THREE.Group {
  // a soft yellow smiley ball with embroidered eyes and smile
  const b = new ModelBuilder();
  const r = 0.11 * s;
  const ball = new THREE.SphereGeometry(r, 24, 18);
  // slightly squashed and lumpy, like stuffing
  const p = ball.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 1 + Math.sin(x * 61 + z * 37) * 0.012 + Math.sin(y * 43) * 0.01;
    p.setXYZ(i, x * k * 1.04, y * 0.92 * k, z * k * 1.04);
  }
  ball.computeVertexNormals();
  b.add(ball, m.cloth(color, worn), 0, r * 0.92, 0);
  // the seam where the front and back halves are stitched
  b.add(new THREE.TorusGeometry(r * 1.035, r * 0.012, 4, 40), m.cloth('#c9a63a', worn), 0, r * 0.92, 0).scale.y = 0.89;
  const thread = new THREE.MeshStandardMaterial({ color: 0x0c0a08, roughness: 0.85 });
  for (const sx of [-1, 1]) {
    const eye = b.add(sphere(r * 0.16, 12, 10), thread, sx * r * 0.22, r * 1.1, r * 0.94);
    eye.scale.set(0.62, 1.05, 0.35);
  }
  // embroidered smile: a curved thread line with little ticks at the ends
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 12; i++) {
    const t = -1 + i / 6;
    const x = t * r * 0.55;
    const y = r * 0.78 - (1 - t * t) * r * 0.26;
    const z = Math.sqrt(Math.max(0, (r * 1.04) ** 2 - x * x - (y - r * 0.92) ** 2 / 0.85)) + r * 0.01;
    pts.push(new THREE.Vector3(x, y, z));
  }
  b.add(tube(pts, r * 0.028, 24, 6), thread);
  return b.group;
}


export function envelope(m: Materials): THREE.Group {
  const [c, g] = canvas(512, 320);
  g.fillStyle = '#e9dcc0';
  g.fillRect(0, 0, 512, 320);
  g.fillStyle = '#1e2b55';
  g.font = "700 40px 'Caveat', cursive";
  g.fillText('Другу №12', 180, 180);
  g.fillStyle = '#f4d35e';
  starPath(g, 440, 60, 28, 12, 5);
  const b = new ModelBuilder();
  b.add(box(0.22, 0.003, 0.14), m.canvasMaterial(c, { rough: 0.8 }), 0, 0, 0);
  return b.group;
}
