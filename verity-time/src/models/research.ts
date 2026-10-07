import * as THREE from 'three';
import type { Materials } from '../assets/Materials';
import { box, cyl, ModelBuilder, rbox, sphere, tube } from '../world/geom';
import { canvas, clockFace, drawVerity, sign } from '../assets/Signage';
import { Rng } from '../assets/noise';

const MONO = "'IBM Plex Mono', monospace";
const HAND = "'Caveat', cursive";

/** 19" server cabinet with blinking units and a maintenance tag on the door. */
export function serverRack(m: Materials, tag: string, seed = 1, dead = false): THREE.Group {
  const b = new ModelBuilder();
  const body = m.painted('#2a2e31', 0.5);
  const r = new Rng(seed);
  b.add(rbox(0.62, 2.0, 0.9, 0.01), body, 0, 1.0, 0);
  // recessed front with units
  b.add(box(0.5, 1.8, 0.02), m.flat('#0b0c0d', 0.9, 0), 0, 1.0, 0.451);
  const leds = [
    new THREE.MeshStandardMaterial({ color: 0x0a1a0a, emissive: 0x3aff7a, emissiveIntensity: dead ? 0 : 2.2 }),
    new THREE.MeshStandardMaterial({ color: 0x1a120a, emissive: 0xffa020, emissiveIntensity: dead ? 0 : 2.2 }),
    new THREE.MeshStandardMaterial({ color: 0x1a0a0a, emissive: 0xff3020, emissiveIntensity: dead ? 0 : 1.8 }),
  ];
  const unit = m.painted('#3b4044', 0.4);
  let y = 0.2;
  while (y < 1.85) {
    const hU = r.pick([0.045, 0.09, 0.09, 0.135, 0.18]);
    b.add(box(0.48, hU - 0.006, 0.05), unit, 0, y + hU / 2, 0.47);
    const n = r.int(1, 5);
    for (let i = 0; i < n; i++) b.add(box(0.01, 0.01, 0.01), leds[r.int(0, 2)], -0.2 + i * 0.022, y + hU / 2, 0.497);
    if (hU > 0.1) b.add(box(0.2, hU * 0.5, 0.004), m.flat('#15181a', 0.6, 0), 0.08, y + hU / 2, 0.497);
    y += hU;
  }
  // door frame + smoked glass
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x111418, transparent: true, opacity: 0.35, roughness: 0.08, metalness: 0, clearcoat: 1 });
  b.add(box(0.56, 1.9, 0.01), glass, 0, 1.0, 0.505);
  b.add(box(0.03, 0.3, 0.03), m.steel('#9aa0a6', 0.3), 0.25, 1.1, 0.52);
  // maintenance tag
  const [c, g] = canvas(256, 160);
  g.fillStyle = '#f4ecd0';
  g.fillRect(0, 0, 256, 160);
  g.strokeStyle = '#c0392b';
  g.lineWidth = 6;
  g.strokeRect(4, 4, 248, 152);
  g.fillStyle = '#222';
  g.font = `600 22px ${MONO}`;
  g.textAlign = 'center';
  const lines = tag.split('\n');
  lines.forEach((l, i) => g.fillText(l, 128, 44 + i * 34));
  const tagMat = m.canvasMaterial(c, { rough: 0.85 });
  b.add(new THREE.PlaneGeometry(0.2, 0.125), tagMat, 0, 1.55, 0.512);
  // cable bundle out of the top
  b.add(tube([new THREE.Vector3(0.15, 2.0, -0.2), new THREE.Vector3(0.15, 2.3, -0.3), new THREE.Vector3(0.1, 2.6, -0.4)], 0.04, 10, 6), m.rubber('#1a1a1a'));
  b.group.userData.colliders = [[0, 1.0, 0, 0.31, 1.0, 0.46]];
  return b.group;
}

/** 16mm projector on a rolling stand. reels spin while running. */
export function projector(m: Materials): { group: THREE.Group; reels: THREE.Object3D[]; lens: THREE.Vector3 } {
  const b = new ModelBuilder();
  const dark = m.painted('#2c2f33', 0.45);
  const steel = m.steel('#8a8e91', 0.35);
  // stand
  b.add(box(0.6, 0.04, 0.5), dark, 0, 0.9, 0);
  for (const [x, z] of [
    [-0.26, -0.2],
    [0.26, -0.2],
    [-0.26, 0.2],
    [0.26, 0.2],
  ])
    b.add(cyl(0.015, 0.015, 0.88, 6), steel, x, 0.45, z);
  for (const [x, z] of [
    [-0.26, -0.2],
    [0.26, -0.2],
    [-0.26, 0.2],
    [0.26, 0.2],
  ])
    b.add(sphere(0.03, 8, 6), m.rubber(), x, 0.03, z);
  // body
  b.add(rbox(0.22, 0.26, 0.42, 0.03), m.painted('#4a5052', 0.5), 0, 1.06, 0);
  b.add(cyl(0.045, 0.05, 0.16, 16), steel, 0, 1.08, -0.28, Math.PI / 2);
  b.add(cyl(0.04, 0.04, 0.005, 16), new THREE.MeshPhysicalMaterial({ color: 0x223344, roughness: 0.02, clearcoat: 1, metalness: 0.2 }), 0, 1.08, -0.362, Math.PI / 2);
  // reel arms
  b.add(box(0.02, 0.28, 0.03), steel, 0.04, 1.3, -0.14, 0.5);
  b.add(box(0.02, 0.28, 0.03), steel, 0.04, 1.3, 0.16, -0.5);
  const reels: THREE.Object3D[] = [];
  for (const [z, r] of [
    [-0.22, 0.17],
    [0.25, 0.14],
  ] as const) {
    const rg = new THREE.Group();
    const disc = new THREE.Mesh(cyl(r, r, 0.012, 24), steel);
    disc.rotation.z = Math.PI / 2;
    rg.add(disc);
    const film = new THREE.Mesh(cyl(r * 0.7, r * 0.7, 0.014, 24), m.flat('#2a1f18', 0.5, 0));
    film.rotation.z = Math.PI / 2;
    rg.add(film);
    for (let i = 0; i < 3; i++) {
      const hole = new THREE.Mesh(cyl(r * 0.18, r * 0.18, 0.016, 10), m.flat('#0a0a0a', 1, 0));
      hole.rotation.z = Math.PI / 2;
      const a = (i / 3) * Math.PI * 2;
      hole.position.set(0, Math.sin(a) * r * 0.45, Math.cos(a) * r * 0.45);
      rg.add(hole);
    }
    rg.position.set(0.05, 1.4 + r * 0.5, z);
    b.group.add(rg);
    reels.push(rg);
  }
  b.add(tube([new THREE.Vector3(0.05, 1.55, -0.1), new THREE.Vector3(0.05, 1.2, 0), new THREE.Vector3(0.05, 1.5, 0.15)], 0.004, 12, 3), m.flat('#2a1f18', 0.5, 0));
  b.group.userData.colliders = [[0, 0.6, 0, 0.32, 0.6, 0.27]];
  b.group.userData.dynamic = true;
  return { group: b.group, reels, lens: new THREE.Vector3(0, 1.08, -0.37) };
}

/** Long archive shelving with rows of film canisters; year plate at +x end. */
export function archiveRack(m: Materials, len: number, label: string, seed = 1, gap = -1): THREE.Group {
  const b = new ModelBuilder();
  const frame = m.painted('#5c6b73', 0.5);
  const shelf = m.painted('#6f7d84', 0.5);
  const tins = [m.steel('#9aa0a6', 0.5), m.steel('#7f8a8f', 0.6), m.painted('#7b3a33', 0.6), m.painted('#2f5d62', 0.6)];
  const r = new Rng(seed);
  const H = 2.3;
  const D = 0.9;
  for (let x = 0; x <= len + 0.01; x += len / Math.ceil(len / 1.2))
    for (const z of [-D / 2, D / 2]) b.add(box(0.04, H, 0.04), frame, x - len / 2, H / 2, z);
  const levels = [0.12, 0.62, 1.12, 1.62, 2.12];
  for (const y of levels) b.add(box(len, 0.025, D), shelf, 0, y, 0);
  for (let li = 0; li < levels.length - 1; li++) {
    const y = levels[li] + 0.0125;
    for (const side of [-1, 1]) {
      let x = -len / 2 + 0.12;
      let k = 0;
      while (x < len / 2 - 0.12) {
        k++;
        if (gap === k && li === 1 && side === 1) {
          x += 0.3;
          continue;
        }
        if (r.next() < 0.08) {
          x += 0.3;
          continue;
        }
        const stack = r.int(1, 3);
        const rr = r.range(0.12, 0.14);
        for (let s = 0; s < stack; s++) b.add(cyl(rr, rr, 0.04, 12), tins[r.int(0, 3)], x, y + 0.02 + s * 0.042, side * 0.22, 0, r.range(0, 1), 0);
        x += rr * 2 + 0.03;
      }
    }
  }
  // year plate on both ends
  const [c, g] = canvas(256, 128);
  g.fillStyle = '#e8e2d0';
  g.fillRect(0, 0, 256, 128);
  g.fillStyle = '#22313a';
  g.font = `700 76px ${MONO}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(label, 128, 68);
  const pm = m.canvasMaterial(c, { rough: 0.7 });
  b.add(new THREE.PlaneGeometry(0.5, 0.25), pm, len / 2 + 0.03, 1.9, 0, 0, Math.PI / 2, 0);
  b.add(new THREE.PlaneGeometry(0.5, 0.25), pm, -len / 2 - 0.03, 1.9, 0, 0, -Math.PI / 2, 0);
  b.group.userData.colliders = [[0, H / 2, 0, len / 2 + 0.03, H / 2, D / 2 + 0.02]];
  return b.group;
}

/** Wall safe with a hinged door; open with keypad. */
export function wallSafe(m: Materials): { group: THREE.Group; door: THREE.Group } {
  const b = new ModelBuilder();
  const body = m.painted('#3d4245', 0.5);
  b.add(box(0.5, 0.45, 0.06), body, 0, 0, -0.03);
  b.add(box(0.46, 0.41, 0.3), m.flat('#141618', 0.9, 0), 0, 0, -0.18);
  const door = new THREE.Group();
  door.position.set(-0.22, 0, 0.0);
  const leaf = new THREE.Group();
  leaf.position.set(0.22, 0, 0.03);
  const dm = m.painted('#4a5054', 0.4);
  const d1 = new THREE.Mesh(rbox(0.44, 0.4, 0.05, 0.01), dm);
  leaf.add(d1);
  const dial = new THREE.Mesh(cyl(0.05, 0.05, 0.03, 20), m.steel('#c0c4c8', 0.2));
  dial.rotation.x = Math.PI / 2;
  dial.position.set(0.05, 0.03, 0.035);
  leaf.add(dial);
  const kp = new THREE.Mesh(box(0.1, 0.13, 0.015), m.plastic('#1c1c1e', 0.4));
  kp.position.set(-0.12, 0.0, 0.03);
  leaf.add(kp);
  const handle = new THREE.Mesh(box(0.02, 0.1, 0.03), m.steel('#9aa0a6', 0.3));
  handle.position.set(0.15, -0.06, 0.04);
  leaf.add(handle);
  door.add(leaf);
  b.group.add(door);
  b.group.userData.dynamic = true;
  return { group: b.group, door };
}

/** Wind-up metronome; arm swings. */
export function metronome(m: Materials): { group: THREE.Group; arm: THREE.Group } {
  const b = new ModelBuilder();
  const geo = new THREE.CylinderGeometry(0.03, 0.08, 0.24, 4, 1);
  geo.rotateY(Math.PI / 4);
  b.add(geo, m.woodProp('#4a2c18', 0.3), 0, 0.12, 0);
  b.add(box(0.13, 0.015, 0.13), m.woodProp('#3a2212', 0.3), 0, 0.0075, 0);
  const arm = new THREE.Group();
  arm.position.set(0, 0.04, 0.045);
  const rod = new THREE.Mesh(cyl(0.003, 0.003, 0.2, 5), m.steel('#c9b37a', 0.2));
  rod.position.y = 0.1;
  const wgt = new THREE.Mesh(box(0.022, 0.02, 0.012), m.steel('#c9b37a', 0.2));
  wgt.position.y = 0.14;
  arm.add(rod, wgt);
  b.group.add(arm);
  b.group.userData.dynamic = true;
  return { group: b.group, arm };
}

/** Men's wristwatch lying on a desk, hands stopped. */
export function wristwatch(m: Materials, hh: number, mm: number): THREE.Group {
  const b = new ModelBuilder();
  b.add(cyl(0.02, 0.02, 0.008, 20), m.steel('#c9b37a', 0.2), 0, 0.004, 0);
  const [c, g] = canvas(128, 128);
  g.fillStyle = '#efe6cf';
  g.fillRect(0, 0, 128, 128);
  clockFace(g, 64, 64, 60, hh, mm, false);
  b.add(new THREE.CircleGeometry(0.017, 20), m.canvasMaterial(c, { rough: 0.2 }), 0, 0.0085, 0, -Math.PI / 2);
  const strap = m.cloth('#3a2618', 0.5);
  b.add(box(0.018, 0.003, 0.09), strap, 0, 0.0015, 0.06);
  b.add(box(0.018, 0.003, 0.07), strap, 0, 0.0015, -0.05);
  return b.group;
}

/** Green banker's desk lamp; bulb material for the light link. */
export function deskLamp(m: Materials): { group: THREE.Group; bulb: THREE.MeshStandardMaterial } {
  const b = new ModelBuilder();
  const brass = m.steel('#b8964a', 0.3);
  b.add(cyl(0.08, 0.09, 0.02, 20), brass, 0, 0.01, 0);
  b.add(cyl(0.008, 0.008, 0.3, 8), brass, 0, 0.16, 0);
  const shade = new THREE.CylinderGeometry(0.03, 0.12, 0.08, 20, 1, true, 0, Math.PI);
  shade.rotateZ(Math.PI / 2);
  shade.rotateY(Math.PI / 2);
  const sm = new THREE.MeshStandardMaterial({ color: 0x1f5c3a, roughness: 0.25, metalness: 0.1, side: THREE.DoubleSide });
  b.add(shade, sm, 0, 0.32, 0.03);
  const bulb = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xffd59a, emissiveIntensity: 2 });
  b.add(cyl(0.015, 0.015, 0.16, 8), bulb, 0, 0.3, 0.03, 0, 0, Math.PI / 2);
  return { group: b.group, bulb };
}

/** Long observation console with CRT monitors and switches. */
export function observationConsole(m: Materials, len: number, screens: HTMLCanvasElement[] = []): THREE.Group {
  const b = new ModelBuilder();
  const body = m.painted('#c9c2ad', 0.5);
  const top = m.painted('#5f6a6c', 0.4);
  b.add(box(len, 0.75, 0.7), body, 0, 0.375, 0);
  const slope = new THREE.Mesh(box(len, 0.04, 0.45), top);
  slope.rotation.x = 0.35;
  slope.position.set(0, 0.84, -0.1);
  b.group.add(slope);
  b.add(box(len, 0.03, 0.25), top, 0, 0.76, 0.24);
  const r = new Rng(len * 7);
  const btn = [m.plastic('#c0392b', 0.3), m.plastic('#f1c40f', 0.3), m.plastic('#27ae60', 0.3), m.plastic('#eaeaea', 0.3)];
  for (let x = -len / 2 + 0.12; x < len / 2 - 0.1; x += 0.09) {
    const k = r.int(0, 3);
    const s = new THREE.Mesh(box(0.035, 0.02, 0.035), btn[k]);
    s.position.set(x, 0.87, -0.1 + r.range(-0.1, 0.1));
    s.rotation.x = 0.35;
    b.group.add(s);
  }
  screens.forEach((sc, i) => {
    const x = -len / 2 + (len / (screens.length + 1)) * (i + 1);
    b.add(rbox(0.42, 0.36, 0.38, 0.03), m.plastic('#d9cfb6', 0.6), x, 1.12, -0.18);
    b.add(new THREE.PlaneGeometry(0.33, 0.25), m.canvasMaterial(sc, { emissive: 0.9, rough: 0.12 }), x, 1.13, 0.012);
  });
  b.group.userData.colliders = [[0, 0.45, 0, len / 2, 0.45, 0.36]];
  return b.group;
}

/** Desk microphone on a gooseneck. */
export function microphone(m: Materials): THREE.Group {
  const b = new ModelBuilder();
  b.add(cyl(0.06, 0.07, 0.025, 16), m.painted('#2c2f33', 0.4), 0, 0.0125, 0);
  b.add(tube([new THREE.Vector3(0, 0.02, 0), new THREE.Vector3(0, 0.18, 0.02), new THREE.Vector3(0, 0.3, 0.1)], 0.006, 12, 6), m.steel('#9aa0a6', 0.4));
  b.add(cyl(0.018, 0.022, 0.07, 12), m.steel('#5a5e61', 0.3), 0, 0.32, 0.13, 1.1);
  b.add(box(0.025, 0.012, 0.02), m.plastic('#c0392b', 0.3), 0.04, 0.03, 0.03);
  return b.group;
}

export function copier(m: Materials): THREE.Group {
  const b = new ModelBuilder();
  const body = m.plastic('#d8d2c2', 0.6);
  b.add(rbox(1.0, 0.85, 0.65, 0.03), body, 0, 0.425, 0);
  b.add(box(0.8, 0.04, 0.5), m.plastic('#4a4a4a', 0.4), -0.05, 0.87, 0);
  b.add(box(0.4, 0.03, 0.3), m.plastic('#c9c2b0', 0.5), 0.6, 0.6, 0);
  b.add(box(0.36, 0.008, 0.28), m.flat('#f2eee2', 1, 0), 0.62, 0.62, 0);
  b.add(box(0.22, 0.1, 0.04), m.plastic('#3a3a3a', 0.3), 0.28, 0.83, 0.3);
  b.add(box(0.03, 0.015, 0.005), new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff3020, emissiveIntensity: 1.5 }), 0.32, 0.84, 0.322);
  return b.group;
}

export function shredder(m: Materials): THREE.Group {
  const b = new ModelBuilder();
  b.add(rbox(0.42, 0.62, 0.32, 0.02), m.plastic('#3a3f42', 0.5), 0, 0.31, 0);
  b.add(box(0.44, 0.1, 0.34), m.plastic('#2a2e31', 0.5), 0, 0.67, 0);
  // a half-shredded sheet sticking out
  b.add(box(0.21, 0.14, 0.002), m.flat('#efe9d8', 1, 0), 0, 0.78, 0);
  for (let i = 0; i < 9; i++) b.add(box(0.012, 0.25, 0.002), m.flat('#efe9d8', 1, 0), -0.1 + i * 0.025, 0.08 + (i % 3) * 0.03, 0.12, 0.4, 0, (i - 4) * 0.1);
  return b.group;
}

/** Ceiling/wall loudspeaker grille. */
export function wallSpeaker(m: Materials): THREE.Group {
  const b = new ModelBuilder();
  b.add(rbox(0.32, 0.22, 0.1, 0.02), m.painted('#d8d6cf', 0.5), 0, 0, 0.05);
  b.add(cyl(0.085, 0.085, 0.01, 20), m.flat('#2a2a2a', 0.9, 0), 0, 0, 0.1, Math.PI / 2);
  for (let i = -3; i <= 3; i++) b.add(box(0.17, 0.006, 0.006), m.steel('#9aa0a6', 0.3), 0, i * 0.022, 0.108);
  return b.group;
}

/** Wall counter display of a waiting chamber. Redraw through draw(). */
export function waitCounter(m: Materials, title = 'ОЖИДАНИЕ'): { group: THREE.Group; draw: (text: string, lit?: boolean) => void } {
  const b = new ModelBuilder();
  b.add(rbox(0.9, 0.32, 0.08, 0.015), m.painted('#2a2e31', 0.4), 0, 0, 0.04);
  const [c, g] = canvas(512, 160);
  const mat = m.canvasMaterial(c, { emissive: 1.4, rough: 0.2 });
  const tex = mat.map as THREE.CanvasTexture;
  b.add(new THREE.PlaneGeometry(0.82, 0.26), mat, 0, 0, 0.082);
  const draw = (text: string, lit = true) => {
    g.fillStyle = '#060303';
    g.fillRect(0, 0, 512, 160);
    g.fillStyle = lit ? 'rgba(255,60,30,0.85)' : 'rgba(80,20,10,0.6)';
    g.font = `600 26px ${MONO}`;
    g.fillText(title, 18, 34);
    let size = 70;
    g.font = `700 ${size}px ${MONO}`;
    const w = g.measureText(text).width;
    if (w > 476) {
      size = Math.floor((size * 476) / w);
      g.font = `700 ${size}px ${MONO}`;
    }
    g.fillStyle = lit ? '#ff4a2a' : '#401008';
    g.fillText(text, 18, 120);
    g.fillStyle = 'rgba(0,0,0,0.3)';
    for (let y = 0; y < 160; y += 3) g.fillRect(0, y, 512, 1);
    tex.needsUpdate = true;
  };
  draw('00:00:00', false);
  b.group.userData.dynamic = true;
  return { group: b.group, draw };
}

/** The cradle Verity sat in during sessions: padded bowl on a pedestal with a cable. */
export function cradle(m: Materials): THREE.Group {
  const b = new ModelBuilder();
  b.add(cyl(0.22, 0.3, 0.5, 20), m.painted('#d8d2c4', 0.5), 0, 0.25, 0);
  const bowl = new THREE.SphereGeometry(0.34, 24, 12, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45);
  b.add(bowl, m.cloth('#7fb2b0', 0.6), 0, 0.82, 0);
  b.add(cyl(0.3, 0.3, 0.04, 24), m.cloth('#6a9c9a', 0.6), 0, 0.56, 0);
  b.add(tube([new THREE.Vector3(0, 0.2, -0.28), new THREE.Vector3(0, 0.05, -0.6), new THREE.Vector3(0.3, 0.02, -1.2), new THREE.Vector3(0.4, 0.02, -2.0)], 0.025, 20, 6), m.rubber('#1a1a1a'));
  return b.group;
}

/** Plain freestanding wardrobe that can be a hide spot (doors via userData.door). */
export function wardrobe(m: Materials, color = '#6e4527'): THREE.Group {
  const b = new ModelBuilder();
  const wood = m.woodProp(color, 0.4);
  b.add(box(1.0, 2.0, 0.6), wood, 0, 1.0, 0);
  const door = new THREE.Group();
  door.position.set(-0.48, 0, 0.3);
  const leaf = new THREE.Mesh(box(0.96, 1.9, 0.03), m.woodProp('#5d3a20', 0.4));
  leaf.position.set(0.48, 1.0, 0.015);
  door.add(leaf);
  const knob = new THREE.Mesh(sphere(0.02, 8, 6), m.steel('#b8964a', 0.3));
  knob.position.set(0.88, 1.0, 0.045);
  door.add(knob);
  b.group.add(door);
  b.group.userData.door = door;
  b.group.userData.colliders = [[0, 1.0, 0, 0.5, 1.0, 0.3]];
  return b.group;
}

// =================================================================== canvases

export function calendarCanvas(): HTMLCanvasElement {
  const [c, g] = canvas(384, 512);
  g.fillStyle = '#f2ecdc';
  g.fillRect(0, 0, 384, 512);
  // picture
  g.fillStyle = '#2fa79b';
  g.fillRect(16, 16, 352, 190);
  drawVerity(g, 192, 116, 64, { mood: 'happy' });
  g.fillStyle = '#fff';
  g.font = `700 22px ${MONO}`;
  g.fillText('ПЕЛЛ И ЛАМБЕРТ', 24, 196);
  g.fillStyle = '#c0392b';
  g.font = `700 36px ${MONO}`;
  g.textAlign = 'center';
  g.fillText('АПРЕЛЬ 1994', 192, 252);
  g.font = `500 22px ${MONO}`;
  g.fillStyle = '#333';
  const days = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'];
  days.forEach((d, i) => g.fillText(d, 36 + i * 52, 284));
  // April 1994 starts on Friday
  let col = 4;
  let row = 0;
  for (let d = 1; d <= 30; d++) {
    const x = 36 + col * 52;
    const y = 318 + row * 36;
    g.fillStyle = col >= 5 ? '#c0392b' : '#222';
    g.fillText(String(d), x, y);
    if (d === 12) {
      g.strokeStyle = '#c0392b';
      g.lineWidth = 3;
      g.beginPath();
      g.ellipse(x, y - 8, 22, 17, -0.1, 0, Math.PI * 2);
      g.stroke();
      g.beginPath();
      g.ellipse(x + 1, y - 7, 25, 19, 0.1, 0, Math.PI * 2);
      g.stroke();
    }
    if (d === 13) {
      g.strokeStyle = '#222';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(x - 14, y - 18);
      g.lineTo(x + 14, y + 4);
      g.moveTo(x + 14, y - 18);
      g.lineTo(x - 14, y + 4);
      g.stroke();
    }
    col++;
    if (col > 6) {
      col = 0;
      row++;
    }
  }
  g.fillStyle = '#c0392b';
  g.font = `700 30px ${HAND}`;
  g.save();
  g.translate(250, 335);
  g.rotate(-0.12);
  g.fillText('КР-07 — прорыв!', 0, 0);
  g.restore();
  return c;
}

export function directoryCanvas(): HTMLCanvasElement {
  const [c, g] = canvas(768, 512);
  g.fillStyle = '#22313a';
  g.fillRect(0, 0, 768, 512);
  g.fillStyle = '#e8e2d0';
  g.font = `700 40px ${MONO}`;
  g.fillText('ОТДЕЛ ГАРМОНИИ', 36, 62);
  g.font = `400 20px ${MONO}`;
  g.fillStyle = '#9fb3b5';
  g.fillText('«Счастье ребёнка — это наука»', 36, 94);
  g.fillStyle = '#e8e2d0';
  g.font = `500 24px ${MONO}`;
  const rows = [
    ['КОМНАТА ДРУЖБЫ', 'А-1'],
    ['БУДКА НАБЛЮДЕНИЯ', 'А-2'],
    ['КАМЕРЫ ОЖИДАНИЯ 1–3', 'А-3'],
    ['ПУЛЬТОВАЯ КАМЕР', 'Е-1'],
    ['КАБИНЕТ Д-РА ХЕЙЛА', 'Е-2'],
    ['СЕРВЕРНАЯ / ТЕРМИНАЛ', 'Е-3'],
    ['АРХИВ ПЛЁНОК', 'Е-4'],
    ['ПРОЕКЦИОННАЯ', 'Д-1'],
    ['КОМНАТА ОТДЫХА', 'Д-2'],
    ['ПЕРЕХОД → ИГРОВАЯ', 'Б-СЕВ'],
  ];
  rows.forEach(([a, b2], i) => {
    g.fillText(a, 36, 150 + i * 34);
    g.fillText(b2, 640, 150 + i * 34);
  });
  // tape-over on the playland line
  g.fillStyle = 'rgba(240,230,200,0.9)';
  g.save();
  g.translate(30, 444);
  g.rotate(0.02);
  g.fillRect(0, 0, 420, 24);
  g.fillStyle = '#c0392b';
  g.font = `700 22px ${HAND}`;
  g.fillText('ЗАКРЫТО. НЕ ХОДИТЬ.', 10, 19);
  g.restore();
  return c;
}

/** Tally marks in groups of five covering a wall at child height. */
export function tallyCanvas(seed = 3): HTMLCanvasElement {
  const [c, g] = canvas(1024, 512);
  g.clearRect(0, 0, 1024, 512);
  const r = new Rng(seed);
  g.strokeStyle = 'rgba(40,30,25,0.75)';
  g.lineCap = 'round';
  for (let y = 12; y < 500; y += 22) {
    for (let x = 8; x < 1000; x += 34) {
      if (y > 380 && r.next() < (y - 380) / 140) continue;
      g.lineWidth = r.range(1.2, 2.2);
      for (let k = 0; k < 4; k++) {
        g.beginPath();
        g.moveTo(x + k * 6 + r.range(-1, 1), y);
        g.lineTo(x + k * 6 + r.range(-1, 1), y + 16);
        g.stroke();
      }
      g.beginPath();
      g.moveTo(x - 3, y + 12);
      g.lineTo(x + 24, y + 3);
      g.stroke();
    }
  }
  return c;
}

/** Child's drawing of a blue dog (KR-07). */
export function blueDogDrawing(seed = 1, signed = true): HTMLCanvasElement {
  const [c, g] = canvas(512, 384);
  const r = new Rng(seed);
  g.fillStyle = '#f7f2e6';
  g.fillRect(0, 0, 512, 384);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const wob = (x: number, y: number) => [x + r.range(-3, 3), y + r.range(-3, 3)] as const;
  g.strokeStyle = '#2b5fd9';
  g.fillStyle = 'rgba(43,95,217,0.55)';
  g.lineWidth = 7;
  g.beginPath();
  g.ellipse(250, 220, 120, 62, 0, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.beginPath();
  g.ellipse(380, 160, 56, 48, 0.2, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  for (const lx of [170, 210, 290, 330]) {
    g.beginPath();
    g.moveTo(...wob(lx, 270));
    g.lineTo(...wob(lx + 4, 330));
    g.stroke();
  }
  g.beginPath();
  g.moveTo(...wob(130, 200));
  g.quadraticCurveTo(90, 150, 110, 120);
  g.stroke();
  g.fillStyle = '#111';
  g.beginPath();
  g.arc(395, 150, 6, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#2b5fd9';
  g.beginPath();
  g.moveTo(360, 120);
  g.lineTo(350, 84);
  g.lineTo(378, 112);
  g.stroke();
  // yellow ball friend next to it
  drawVerity(g, 100, 300, 34, { mood: 'happy', wobble: 3, flat: true });
  g.fillStyle = '#e67e22';
  g.font = `700 34px ${HAND}`;
  if (signed) g.fillText('ДЛЯ ВЕРИТИ ОТ №12', 150, 60);
  return c;
}

export function mirrorWriting(): HTMLCanvasElement {
  const [c, g] = canvas(1024, 256);
  g.clearRect(0, 0, 1024, 256);
  g.strokeStyle = 'rgba(230,236,240,0.75)';
  g.fillStyle = 'rgba(230,236,240,0.7)';
  g.font = `700 120px ${HAND}`;
  g.textAlign = 'center';
  g.save();
  g.translate(512, 170);
  g.rotate(-0.04);
  g.fillText('Я ЗНАЮ, ЧТО ВЫ ТАМ', 0, 0);
  g.restore();
  // smears
  const r = new Rng(9);
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 40; i++) {
    g.fillStyle = `rgba(0,0,0,${r.range(0.1, 0.5)})`;
    g.fillRect(r.range(0, 1024), r.range(0, 256), r.range(10, 60), r.range(2, 8));
  }
  g.globalCompositeOperation = 'source-over';
  return c;
}

export function nameplate(text: string): HTMLCanvasElement {
  return sign(text, { bg: '#c9b37a', fg: '#2a1f12', font: 'ui', w: 512, h: 112, border: '#8a7440' });
}

/** Standing lamp with a fabric shade. */
export function floorLamp(m: Materials, shade = '#d8c8a0'): { group: THREE.Group; bulb: THREE.MeshStandardMaterial } {
  const b = new ModelBuilder();
  const brass = m.steel('#8a7440', 0.35);
  b.add(cyl(0.16, 0.18, 0.03, 20), brass, 0, 0.015, 0);
  b.add(cyl(0.012, 0.012, 1.5, 8), brass, 0, 0.78, 0);
  const sm = new THREE.MeshStandardMaterial({ color: new THREE.Color(shade), roughness: 0.9, side: THREE.DoubleSide, emissive: new THREE.Color(shade), emissiveIntensity: 0.25 });
  b.add(new THREE.CylinderGeometry(0.16, 0.24, 0.28, 24, 1, true), sm, 0, 1.55, 0);
  const bulb = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xffd59a, emissiveIntensity: 2 });
  b.add(sphere(0.045, 10, 8), bulb, 0, 1.5, 0);
  b.group.userData.colliders = [[0, 0.8, 0, 0.18, 0.8, 0.18]];
  return { group: b.group, bulb };
}

/** Squashed bean bag. */
export function beanBag(m: Materials, color: string, seed = 1): THREE.Group {
  const b = new ModelBuilder();
  const g = new THREE.SphereGeometry(0.42, 20, 14);
  const r = new Rng(seed);
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const k = 1 + r.range(-0.04, 0.04);
    pos.setXYZ(i, pos.getX(i) * k * (y < 0 ? 1.15 : 1), Math.max(-0.3, y * 0.62), pos.getZ(i) * k * (y < 0 ? 1.15 : 1));
  }
  g.computeVertexNormals();
  b.add(g, m.cloth(color, 0.6), 0, 0.3, 0);
  // dent where someone sat
  b.add(new THREE.SphereGeometry(0.2, 12, 8), m.cloth(color, 0.7), 0.05, 0.47, 0.05, 0, 0, 0, 1, 0.25, 1);
  return b.group;
}

/** Wooden toy chest, lid ajar with toys spilling out. */
export function toyChest(m: Materials): THREE.Group {
  const b = new ModelBuilder();
  const wood = m.woodProp('#b5793f', 0.5);
  b.add(box(1.0, 0.5, 0.55), wood, 0, 0.25, 0);
  b.add(box(1.02, 0.05, 0.57), m.woodProp('#8a5a32', 0.5), 0, 0.53, -0.18, -0.9, 0, 0);
  for (const x of [-0.35, 0.35]) b.add(box(0.12, 0.08, 0.02), m.painted('#c0392b', 0.4), x, 0.38, 0.28);
  b.add(sphere(0.09, 12, 8), m.plastic('#2980b9', 0.4), -0.2, 0.55, 0.05);
  b.add(box(0.12, 0.12, 0.12), m.plastic('#f1c40f', 0.4), 0.15, 0.52, 0.02, 0, 0.5, 0);
  b.add(box(0.12, 0.12, 0.12), m.plastic('#27ae60', 0.4), 0.5, 0.06, 0.45, 0, 0.3, 0);
  return b.group;
}

/** Children's play tent (tipi) with a fabric door. */
export function playTent(m: Materials): THREE.Group {
  const b = new ModelBuilder();
  const cloth = m.cloth('#e8d5b0', 0.5);
  const g = new THREE.ConeGeometry(0.85, 1.7, 6, 1, true);
  b.add(g, new THREE.MeshStandardMaterial({ color: 0xe8d5b0, roughness: 0.9, side: THREE.DoubleSide }), 0, 0.85, 0);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    b.add(cyl(0.015, 0.015, 2.1, 5), m.woodProp('#8a5a32', 0.4), Math.cos(a) * 0.42, 1.0, Math.sin(a) * 0.42, Math.sin(a) * 0.45, 0, -Math.cos(a) * 0.45);
  }
  // bunting
  const cols = ['#ef8a7e', '#7fb2b0', '#f4d35e'];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const t = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.1, 3), m.cloth(cols[i % 3], 0.4));
    t.position.set(Math.cos(a) * 0.5, 1.0, Math.sin(a) * 0.5);
    t.rotation.x = Math.PI;
    b.group.add(t);
  }
  void cloth;
  b.group.userData.colliders = [[0, 0.8, 0, 0.6, 0.8, 0.6]];
  return b.group;
}
