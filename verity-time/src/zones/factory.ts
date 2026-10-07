import * as THREE from 'three';
import type { ZoneDef } from './types';
import type { Game } from '../Game';
import type { LevelBuilder } from '../world/LevelBuilder';
import type { CoGen } from '../core/Coroutines';
import type { VLight } from '../render/LightManager';
import { Door, lamp, documentProp, tapePlayer, inspect, pickup, hideLocker, starReceiver, throwable, lever } from '../world/entities';
import * as F from '../models/furniture';
import * as FX from '../models/fixtures';
import * as I from '../models/industry';
import { plushVerity, swatchCard } from '../models/items';
import { canvas, childDrawing, poster, sign, stain } from '../assets/Signage';
import { star } from '../assets/recipes';
import { conveyorInit, conveyorRoute, OUTLET_TEXT, type ConveyorState, type Outlet } from '../puzzles/conveyor';
import { isTarget, mixColor, colorDistance, TARGET_COLOR, PIGMENTS, PIGMENT_NAMES, MAX_UNITS, type Pigment } from '../puzzles/paint';
import { relayInit, relayInput, RELAY_ORDER, type RelayState, type StarColor } from '../puzzles/relay';
import { Warden } from '../ai/Warden';
import { dust, lightCone } from '../world/vfx';
import { box, cyl, ModelBuilder, rbox } from '../world/geom';
import { Rng } from '../assets/noise';

const Y4 = 4; // catwalk level

export const factory: ZoneDef = {
  id: 'factory',
  name: 'Мастерские',
  chapter: 'Акт II. Мастерские',
  materials: [
    'floor_painted', 'floor_painted_grey', 'brick_painted', 'brick_old', 'concrete', 'concrete_dark', 'diamond_plate', 'metal_yellow', 'metal_dark', 'metal_teal', 'metal_locker',
    'wall_plaster_mint', 'wall_plaster', 'linoleum_green', 'linoleum_beige', 'ceiling_tiles', 'tile_white', 'grate', 'cardboard', 'glass_dirty', 'wood_dark', 'rubber',
  ],
  nav: { minX: -24, minZ: -72, maxX: 24, maxZ: 0, probeY: 2.4 },
  build(g, b) {
    const env = b.zone.env;
    env.fogColor.set(0x0a0b0b);
    env.fogDensity = 0.03;
    env.ambient.set(0x404850);
    env.ambientIntensity = 0.08;
    env.hemiSky.set(0x50606a);
    env.hemiGround.set(0x18140f);
    env.hemiIntensity = 0.2;
    env.reverb = 'industrial';
    env.ambience = ['room_loop', 'vent_loop', 'drone_loop'];
    env.envMap = 'industrial';
    env.envIntensity = 0.3;
    const ctx = { g, b, lights: {} as Record<string, VLight[]> };

    rooms(b);
    const catwalkLights = hall(g, b);
    const lineB = buildLineB(g, b);
    foreman(g, b);
    breakRoom(g, b);
    qaLab(g, b);
    paintShop(g, b);
    const gate = starGateArea(g, b);
    warehouse(g, b);
    void ctx;
    void lineB;
    void gate;

    // hall warden (Verity switches it off once you have the bracelet)
    const hallWarden = new Warden(g, b, [new THREE.Vector3(-18, 7.6, -8), new THREE.Vector3(14, 7.6, -8), new THREE.Vector3(14, 7.6, -34), new THREE.Vector3(-18, 7.6, -34)], { start: 0.1, speed: 1.2 });
    b.prop(I.rail(g.mats, [new THREE.Vector3(-18, 7.75, -8), new THREE.Vector3(14, 7.75, -8), new THREE.Vector3(14, 7.75, -34), new THREE.Vector3(-18, 7.75, -34)]), 0, 0, 0, 0, { collide: false });
    if (g.state.is('factory.wardenOff')) hallWarden.disable();
    hallWarden.onAlert = () => g.co.start(escort(g, hallWarden), 'zone');
    (b.zone as any).hallWarden = hallWarden;

    // the catwalk lights come on one by one ahead of you (somebody is helping)
    for (let i = 0; i < catwalkLights.length; i++) {
      const l = catwalkLights[i];
      const x = -20 + i * 7;
      if (g.state.is('factory.lightsOn')) {
        l.setOn(true, true);
        continue;
      }
      b.trigger('cw' + i, x - 4, Y4 - 0.5, -3, x - 1, Y4 + 3, 0, {
        onEnter: () => {
          l.setOn(true);
          g.audio.play('breaker_on', { pos: l.position, volume: 0.45, rate: 1.2 });
          if (i === catwalkLights.length - 1) g.state.set('factory.lightsOn');
        },
      });
    }
    // line A starts by itself when you step out on the catwalk
    b.trigger('lineA', -20, Y4 - 0.5, -3, -16, Y4 + 3, 0, {
      when: () => !g.state.is('factory.lineA'),
      onEnter: () => {
        g.state.set('factory.lineA');
        (b.zone as any).lineA = 1;
        g.audio.play('breaker_on', { pos: new THREE.Vector3(-14, 1, -12), volume: 0.8 });
        g.co.start(
          (function* (): CoGen {
            yield 1.5;
            g.ui.hud.subtitle('Внизу сама собой пошла лента. На ней — головы игрушек. Глазами в мою сторону.', 5);
            yield 9;
            (b.zone as any).lineA = 0;
            g.audio.play('switch', { pos: new THREE.Vector3(-14, 1, -12), volume: 0.6, rate: 0.6 });
          })(),
          'zone',
        );
      },
    });
    // glimpse at the end of the catwalk
    b.trigger('glimpse', 8, Y4 - 0.5, -3, 12, Y4 + 3, 0, {
      when: () => !g.state.is('factory.glimpse'),
      onEnter: () => {
        g.state.set('factory.glimpse');
        g.verity.stage = 0;
        g.verity.watch(new THREE.Vector3(9, 0, -20), { vanishDist: 8, maxTime: 7, yaw: 0 });
        g.verity.setMood('curious');
        g.verity.gesture('wave');
        g.music.motif({ pos: new THREE.Vector3(9, 1, -20), volume: 0.35 });
      },
    });
    dust(g, b, new THREE.Vector3(-24, 0.3, -40), new THREE.Vector3(24, 9, 0), 1200, 0xfff2dc, 0.022);
    dust(g, b, new THREE.Vector3(-16, 0.3, -72), new THREE.Vector3(16, 8, -40), 700, 0xfff2dc, 0.022);

    b.spawn('start', -27, Y4, -1.5, -Math.PI / 2);
    b.spawn('floor', 18, 0, -12, Math.PI);
    b.spawn('gate', 0, 0, -34, 0);
    b.spawn('warehouse', 0, 0, -44, 0);
    (b.zone as any).safe = new THREE.Vector3(18, 0, -11);
  },
  onEnter(g, spawn, restored) {
    if (restored) return;
    if (spawn === 'start' && !g.state.is('factory.entered')) {
      g.state.set('factory.entered');
      g.co.start(
        (function* (): CoGen {
          yield 1;
          g.ui.hud.chapterCard('Акт II', 'Мастерские', 6);
          yield 2;
          g.objective('Осмотреть цех. Найти кабинет мастера');
        })(),
        'zone',
      );
    }
  },
};

// =====================================================================

function rooms(b: LevelBuilder): void {
  b.room('entry', { x: -32, z: -3, w: 8, d: 3, y: Y4, h: 3, floor: 'concrete', wall: 'concrete', ceil: 'concrete_dark' });
  b.room('hall', { x: -24, z: -40, w: 48, d: 40, h: 10, floor: 'floor_painted', wall: 'brick_painted', ceil: 'concrete_dark', baseboard: null });
  b.opening('hall', { side: 'w', at: -1.5, width: 1.6, height: 2.4, sill: Y4 });
  b.opening('entry', { side: 'e', at: -1.5, width: 1.6, height: 2.4, jambs: false });
  b.room('foreman', { x: 24, z: -12, w: 8, d: 8, h: 3.2, floor: 'linoleum_beige', wall: 'wall_plaster_mint', ceil: 'ceiling_tiles', baseboard: 'wood_dark' });
  b.connect('hall', 'foreman', -6, 1.1, 2.2);
  b.connect('hall', 'foreman', -10, 2.2, 1.1, 1.0); // window
  b.room('paint', { x: 24, z: -30, w: 12, d: 14, h: 4.5, floor: 'floor_painted_grey', wall: 'tile_white', ceil: 'concrete_dark' });
  b.connect('hall', 'paint', -21, 1.4, 2.4);
  b.room('dryer', { x: 36, z: -27, w: 4, d: 6, h: 3, floor: 'concrete', wall: 'metal_dark', ceil: 'metal_dark' });
  b.connect('paint', 'dryer', -24, 1.2, 2.2);
  b.room('qa', { x: -34, z: -26, w: 10, d: 12, h: 3.2, floor: 'linoleum_green', wall: 'wall_plaster', ceil: 'ceiling_tiles', baseboard: 'wood_dark' });
  b.connect('hall', 'qa', -20, 1.1, 2.2);
  b.connect('hall', 'qa', -16.5, 2.4, 1.1, 1.0); // window onto the hall
  b.room('break', { x: -34, z: -12, w: 10, d: 10, h: 3.2, floor: 'linoleum_beige', wall: 'wall_plaster_mint', ceil: 'ceiling_tiles', baseboard: 'wood_dark' });
  b.connect('hall', 'break', -8, 1.1, 2.2);
  b.room('nest', { x: -37, z: -9, w: 3, d: 3, h: 1.5, floor: 'concrete', wall: 'concrete_dark', ceil: 'concrete_dark' });
  b.connect('break', 'nest', -7.5, 0.9, 1.25);
  b.room('warehouse', { x: -16, z: -72, w: 32, d: 32, h: 9, floor: 'floor_painted_grey', wall: 'brick_old', ceil: 'concrete_dark' });
  b.connect('hall', 'warehouse', 0, 5, 4.2);
}

// =====================================================================
// main hall: catwalk, line A, dressing
// =====================================================================

function hall(g: Game, b: LevelBuilder): VLight[] {
  const m = g.mats;
  // catwalk along the south wall
  b.solid('diamond_plate', -2.5, Y4 - 0.2, -1.5, 43, 0.2, 3, { tag: 'surf:metal' });
  for (let x = -22; x <= 18; x += 4) b.solid('metal_dark', x, 0, -2.9, 0.2, Y4 - 0.2, 0.2, { opaque: false });
  b.railing(
    [
      [-24, -3],
      [17.1, -3],
    ],
    Y4,
    1.05,
    'metal_yellow',
  );
  b.stairs('diamond_plate', 18, -10, 0, Y4, 7, 1.6, 's');
  b.railing(
    [
      [17.1, -3.1],
      [17.1, -10],
    ],
    0,
    1.05,
    'metal_yellow',
  );
  b.railing(
    [
      [18.9, -3.1],
      [18.9, -10],
    ],
    0,
    1.05,
    'metal_yellow',
  );
  // pipes and cable trays along the walls
  b.prop(FX.pipeRun(m, [new THREE.Vector3(-23.7, 8.5, -1), new THREE.Vector3(-23.7, 8.5, -39), new THREE.Vector3(23.7, 8.5, -39), new THREE.Vector3(23.7, 8.5, -1)], 0.12, '#4e6b6f', 0.7), 0, 0, 0, 0, { collide: false });
  b.prop(FX.pipeRun(m, [new THREE.Vector3(-23.6, 7.9, -1), new THREE.Vector3(-23.6, 7.9, -39)], 0.06, '#7b3a33', 0.7), 0, 0, 0, 0, { collide: false });
  b.prop(FX.cableBundle(m, [new THREE.Vector3(23.8, 6.5, -2), new THREE.Vector3(23.8, 6.2, -20), new THREE.Vector3(23.8, 6.6, -38)], 4), 0, 0, 0, 0, { collide: false });

  // line A (decorative, jammed): molding machine + belt + heads
  b.prop(I.moldingMachine(m), -20.5, 0, -12, 0);
  const beltA = I.conveyor(m, 30, 0.8);
  b.prop(beltA.group, -19, 0, -12, 0);
  const heads: THREE.Object3D[] = [];
  for (let i = 0; i < 18; i++) {
    const hd = I.toyHeadOnBelt(m);
    hd.rotation.y = Math.PI / 2 + Math.PI; // eyes towards the catwalk (south)
    b.prop(hd, -18 + i * 1.6, 0.87, -12, Math.PI, { collide: false, static: false });
    heads.push(hd);
  }
  for (const x of [-10, 2]) b.prop(I.robotArm(m, x), x, 0, -13.6, 0);
  b.update((dt) => {
    const on = (b.zone as any).lineA ?? 0;
    if (!on) return;
    (beltA.belt.map as THREE.Texture).offset.x -= dt * 1.2;
    for (const h of heads) {
      h.position.x += dt * 0.8;
      if (h.position.x > 10.5) h.position.x -= 28.8;
    }
  });
  b.sound('conveyor_loop', -4, 1, -12, 0.5, { when: () => !!(b.zone as any).lineA });

  // dressing
  b.prop(I.forklift(m), 14, 0, -18, 0.6);
  for (const [x, z, k] of [
    [-6, -16, 'eyes'],
    [-3, -16, 'shells'],
    [8, -16, 'heads'],
  ] as const)
    b.prop(I.toyBin(m, k, x), x, 0, z, 0.1);
  for (const [x, z] of [
    [20, -30],
    [21, -36],
    [-21, -36],
    [-20, -31.5],
  ])
    b.prop(F.pallet(m), x, 0, z, x * 0.1);
  for (let i = 0; i < 6; i++) b.prop(F.crate(m, 0.8), 19.5 + (i % 2) * 0.9, (i > 3 ? 0.8 : 0), -32 - Math.floor(i / 2) * 0.9, i * 0.2);
  for (const [x, z] of [
    [-22, -38.5],
    [-21.2, -38.6],
    [22, -38],
  ])
    b.prop(F.barrel(m, x > 0 ? '#7b3a33' : '#2f5d8a'), x, 0, z, x);
  b.prop(I.workbench(m, 2.4), 10, 0, -38.4, 0);
  b.prop(I.workbench(m, 2.0), -12, 0, -38.4, 0);
  // posters
  const pos: Array<[Parameters<typeof poster>[0], number, number, number, number]> = [
    ['quality', -23.88, 2.4, -6, Math.PI / 2],
    ['nodays', 23.88, 2.4, -3, -Math.PI / 2],
    ['safety', -23.88, 2.4, -30, Math.PI / 2],
    ['helper', 23.88, 2.4, -36, -Math.PI / 2],
  ];
  pos.forEach(([k, x, y, z, ry], i) => b.prop(FX.paperOnWall(m, poster(k, 512, 724, 0.55, 80 + i), 1.0), x, y, z, ry, { collide: false }));
  b.prop(FX.wallClock(m, 19, 0), 0, 6.5, -0.12, Math.PI, { collide: false, scale: 3 });
  // floor markings and stains
  const yl = new THREE.MeshStandardMaterial({ color: 0xd4a32a, roughness: 0.7, transparent: true, opacity: 0.6, polygonOffset: true, polygonOffsetFactor: -2 });
  b.decal(yl, 0, 0.003, -5.2, 46, 0.12, 'up');
  b.decal(yl, 0, 0.003, -18.6, 46, 0.12, 'up');
  b.decal(yl, 0, 0.003, -36.5, 46, 0.12, 'up');
  b.decal(yl, -22.5, 0.003, -20, 0.12, 30, 'up');
  b.decal(yl, 22.5, 0.003, -20, 0.12, 30, 'up');
  for (let i = 0; i < 10; i++) {
    const r = new Rng(300 + i);
    b.decal(m.canvasMaterial(stain(i % 2 ? 'oil' : 'dirt', 300 + i), { transparent: true, rough: 0.3 }), r.range(-20, 20), 0.004, r.range(-36, -6), r.range(1, 3), r.range(1, 3), 'up', { rot: r.range(0, 6) });
  }
  b.prop(FX.signPanel(m, 'МАСТЕРСКИЕ «ПЕЛЛ И ЛАМБЕРТ»', { bg: '#2f5d62', fg: '#f6e7c1', w: 1024, h: 128, width: 6 }), 0, 7.8, -39.88, 0, { collide: false });
  // high bay lights: catwalk ones are switched on by "someone"
  const catwalkLights: VLight[] = [];
  for (let i = 0; i < 6; i++) {
    const l = lamp(g, b, 'pendant', -20 + i * 7, 10, -1.5, { drop: 4.5, intensity: 40, distance: 12, color: '#e6eeff', on: false });
    catwalkLights.push(l);
  }
  for (const [x, z, f] of [
    [-12, -20, 'none'],
    [4, -20, 'buzz'],
    [-4, -30, 'dying'],
    [12, -28, 'none'],
    [0, -12, 'none'],
  ] as const)
    lamp(g, b, 'pendant', x, 10, z, { drop: 3, intensity: 60, distance: 14, color: '#e6eeff', flicker: f });
  lamp(g, b, 'emergency', -23.88, 3, -20, { ry: Math.PI / 2, intensity: 5, distance: 8 });
  lamp(g, b, 'emergency', 23.88, 3, -24, { ry: -Math.PI / 2, intensity: 5, distance: 8 });
  lamp(g, b, 'cage', -27, Y4 + 2.7, -2.88, { intensity: 8, distance: 6, flicker: 'buzz' });
  lightCone(g, b, new THREE.Vector3(4, 7, -20), new THREE.Vector3(4, 0, -20), 2.2, 0xe6eeff, 0.05);
  // skylights: cold moonlight falling through dirty glass in the roof
  const [skc, skg] = canvas(256, 256);
  skg.fillStyle = '#6f84a0';
  skg.fillRect(0, 0, 256, 256);
  const sgr = skg.createRadialGradient(128, 128, 20, 128, 128, 180);
  sgr.addColorStop(0, 'rgba(0,0,0,0)');
  sgr.addColorStop(1, 'rgba(20,15,10,0.7)');
  skg.fillStyle = sgr;
  skg.fillRect(0, 0, 256, 256);
  skg.fillStyle = '#1a1c1f';
  for (let i = 0; i <= 4; i++) {
    skg.fillRect(i * 62, 0, 8, 256);
    skg.fillRect(0, i * 62, 256, 8);
  }
  const sky = m.canvasMaterial(skc, { emissive: 0.35 });
  for (const [x, z] of [
    [-10, -18],
    [10, -24],
    [-2, -32],
  ]) {
    b.decal(sky, x, 9.98, z, 3, 4, 'down');
    b.spot(x, 9.8, z, x + 1.5, 0, z + 1, { color: 0x8fa6c8, intensity: 140, distance: 16, angle: 0.4, penumbra: 0.8, priority: 1.5 });
    lightCone(g, b, new THREE.Vector3(x, 9.9, z), new THREE.Vector3(x + 1.5, 0, z + 1), 2.6, 0x8fa6c8, 0.045);
  }
  lightCone(g, b, new THREE.Vector3(12, 7, -28), new THREE.Vector3(12, 0, -28), 2.2, 0xe6eeff, 0.05);
  b.sound('machine_loop', 20, 2, -36, 0.25);
  b.sound('steam_loop', -23, 7.9, -25, 0.12);
  return catwalkLights;
}

// =====================================================================
// P3: line B sorting conveyor
// =====================================================================

function buildLineB(g: Game, b: LevelBuilder): ConveyorState {
  const m = g.mats;
  const st = g.state.puzzle<ConveyorState>('p3', conveyorInit);
  const Z = -26;
  const H = 0.85;
  const belts: THREE.MeshStandardMaterial[] = [];
  const seg = (x: number, z: number, len: number, ry: number) => {
    const c = I.conveyor(m, len, 0.8, H, '#c0392b');
    b.prop(c.group, x, 0, z, ry);
    belts.push(c.belt);
  };
  seg(-20, Z, 8, 0); // start → D1
  seg(-12, Z, 8, 0); // D1 → D2
  seg(-4, Z, 8, 0); // D2 → D3
  seg(4, Z, 8, 0); // D3 → packing
  seg(-12, Z, 7, Math.PI / 2); // D1 → recycle (north, -z)
  seg(-4, Z, 7, -Math.PI / 2); // D2 → paint chute (south)
  seg(4, Z, 7, Math.PI / 2); // D3 → QA (north)
  // outlets
  const shred = new ModelBuilder();
  shred.add(rbox(1.6, 1.4, 1.6, 0.04), m.painted('#5a6064', 0.6), 0, 0.7, 0);
  shred.add(box(1.0, 0.04, 1.0), new THREE.MeshStandardMaterial({ color: 0x050505 }), 0, 1.41, 0);
  for (let i = 0; i < 6; i++) shred.add(cyl(0.05, 0.05, 1.0, 6), m.steel('#9aa0a6', 0.4), -0.4 + i * 0.16, 1.38, 0, 0, 0, Math.PI / 2);
  b.prop(shred.group, -12, 0, Z - 7.9, 0);
  b.prop(FX.signPanel(m, 'ДРОБИЛКА', { bg: '#c0392b', fg: '#fff', w: 384, h: 96, width: 0.8 }), -12, 1.9, Z - 7.1, 0, { collide: false });
  const chute = new ModelBuilder();
  chute.add(box(1.2, 1.1, 1.2), m.painted('#d4a32a', 0.6), 0, 0.55, 0);
  chute.add(box(0.9, 0.04, 0.9), new THREE.MeshStandardMaterial({ color: 0x050505 }), 0, 1.11, 0);
  b.prop(chute.group, -4, 0, Z + 7.8, 0);
  b.prop(FX.signPanel(m, 'ЖЁЛОБ ПОКРАСКИ', { bg: '#d4a32a', fg: '#111', w: 384, h: 96, width: 0.9 }), -4, 1.7, Z + 7.15, Math.PI, { collide: false });
  const packer = new ModelBuilder();
  packer.add(rbox(2.0, 1.8, 1.6, 0.04), m.painted('#2f5d8a', 0.5), 0, 0.9, 0);
  packer.add(box(0.9, 0.6, 0.05), new THREE.MeshStandardMaterial({ color: 0x050505 }), -1.0, 1.1, 0);
  b.prop(packer.group, 13, 0, Z, 0);
  b.prop(FX.signPanel(m, 'УПАКОВКА', { bg: '#2f5d8a', fg: '#fff', w: 384, h: 96, width: 0.8 }), 13, 2.1, Z + 0.82, 0, { collide: false });
  const tray = new ModelBuilder();
  tray.add(box(1.4, 0.75, 1.4), m.steel('#a7a9ab', 0.5), 0, 0.375, 0);
  tray.add(box(1.2, 0.05, 1.2), m.steel('#8a8e91', 0.4), 0, 0.76, 0);
  b.prop(tray.group, 4, 0, Z - 7.9, 0);
  b.prop(FX.signPanel(m, 'ВЫДАЧА ОТК', { bg: '#27ae60', fg: '#fff', w: 384, h: 96, width: 0.8 }), 4, 1.5, Z - 7.1, 0, { collide: false });
  // start hopper
  const hop = new ModelBuilder();
  hop.add(box(1.2, 1.0, 1.2), m.painted('#5a6064', 0.6), 0, 0.5, 0);
  b.prop(hop.group, -21, 0, Z, 0);
  b.prop(FX.signPanel(m, 'ВОЗВРАТ БРАКА', { bg: '#22313a', fg: '#e8e2d0', w: 384, h: 96, width: 0.9 }), -21, 1.5, Z + 0.62, 0, { collide: false });

  // diverters with levers
  const div = [
    { x: -12, z: Z, turnRot: Math.PI / 2 },
    { x: -4, z: Z, turnRot: -Math.PI / 2 },
    { x: 4, z: Z, turnRot: Math.PI / 2 },
  ];
  const pivots: THREE.Group[] = [];
  div.forEach((d, i) => {
    const dv = I.diverter(m, 0.9);
    b.prop(dv.group, d.x - 0.45, 0, d.z, 0, { collide: false, static: false });
    pivots.push(dv.pivot);
    lever(g, b, d.x - 1.0, 1.1, d.z + 0.9, 0, {
      id: 'div' + i,
      prompt: (on) => `Отсекатель ${i + 1}: ${on ? 'ПОВОРОТ' : 'ПРЯМО'} — переключить`,
      get: () => st.d[i],
      set: (on) => {
        st.d[i] = on;
      },
      style: 'lever',
      color: '#c0392b',
    });
    // post for the lever
    b.solid('metal_dark', d.x - 1.0, 0, d.z + 0.98, 0.18, 1.0, 0.12, { opaque: false });
    b.prop(FX.signPanel(m, `О${i + 1}`, { bg: '#c0392b', fg: '#fff', w: 128, h: 96, width: 0.22 }), d.x - 1.0, 1.55, d.z + 1.05, 0, { collide: false });
  });
  b.update((dt) => {
    pivots.forEach((p, i) => {
      // straight: paddle along the belt; turn: paddle diagonally across the belt
      const target = st.d[i] ? (div[i].turnRot > 0 ? 0.75 : -0.75) : 0;
      p.rotation.y += (target - p.rotation.y) * Math.min(1, dt * 6);
    });
  });

  // console: power + start
  b.prop(I.controlConsole(m, 1.6), -16, 0, Z + 3.3, 0);
  b.prop(FX.signPanel(m, 'ЛИНИЯ Б · СОРТИРОВКА', { bg: '#22313a', fg: '#e8e2d0', w: 512, h: 96, width: 1.2 }), -16, 1.45, Z + 3.0, 0, { collide: false });
  lever(g, b, -16.5, 1.02, Z + 3.42, -0.35, {
    id: 'lineB_power',
    style: 'switch',
    prompt: (on) => (on ? 'Питание линии Б: выключить' : 'Питание линии Б: включить'),
    get: () => st.powered,
    set: (on) => (st.powered = on),
  });
  // the box that rides the line
  const boxObj = I.boxOnBelt(m);
  b.prop(boxObj, -20.3, H + 0.02, Z, 0, { collide: false, static: false });
  let running = false;
  let path: THREE.Vector3[] = [];
  let pathI = 0;
  let outlet: Outlet = 'packing';
  const pts: Record<string, THREE.Vector3> = {
    start: new THREE.Vector3(-20.3, H + 0.02, Z),
    d1: new THREE.Vector3(-12, H + 0.02, Z),
    d2: new THREE.Vector3(-4, H + 0.02, Z),
    d3: new THREE.Vector3(4, H + 0.02, Z),
    recycle: new THREE.Vector3(-12, H + 0.02, Z - 6.6),
    paint: new THREE.Vector3(-4, H + 0.02, Z + 6.6),
    packing: new THREE.Vector3(11.8, H + 0.02, Z),
    qa: new THREE.Vector3(4, H + 0.02, Z - 6.6),
  };
  if (st.delivered) boxObj.position.set(4, 0.8, Z - 7.9);
  g.interact.add({
    id: 'lineB_start',
    object: (() => {
      const btn = new ModelBuilder();
      btn.add(cyl(0.06, 0.06, 0.05, 16), m.plastic('#27ae60', 0.3), 0, 0, 0, Math.PI / 2);
      b.prop(btn.group, -15.5, 1.04, Z + 3.42, 0, { collide: false, static: false });
      return btn.group;
    })(),
    kind: 'use',
    prompt: () => (st.delivered ? null : running ? 'Линия работает…' : 'ПУСК линии Б'),
    onUse: () => {
      if (running || st.delivered) return;
      if (!st.powered) {
        g.audio.play('keypad_err', { volume: 0.5 });
        g.ui.hud.subtitle('Кнопка не реагирует. Нет питания линии.', 3);
        return;
      }
      const r = conveyorRoute(st.d);
      outlet = r.outlet;
      path = r.path.map((k) => pts[k]);
      pathI = 1;
      running = true;
      st.runs++;
      boxObj.position.copy(pts.start);
      g.audio.play('breaker_on', { pos: new THREE.Vector3(-16, 1, Z), volume: 0.6 });
    },
  });
  const beltSound = { s: null as import('../audio/AudioEngine').Sound | null };
  b.update((dt) => {
    for (const bt of belts) if (running) (bt.map as THREE.Texture).offset.x -= dt * 1.5;
    if (running && !beltSound.s) beltSound.s = g.audio.play('conveyor_loop', { pos: new THREE.Vector3(-4, 1, Z), loop: true, volume: 0.6 });
    if (!running && beltSound.s) {
      beltSound.s.stop(0.4);
      beltSound.s = null;
    }
    if (!running) return;
    const target = path[pathI];
    const dir = target.clone().sub(boxObj.position);
    const d = dir.length();
    const step = dt * 1.8;
    if (d <= step) {
      boxObj.position.copy(target);
      pathI++;
      if (pathI >= path.length) {
        running = false;
        finish();
      } else g.audio.play('impact_soft', { pos: boxObj.position, volume: 0.3, rate: 1.4 });
    } else {
      boxObj.position.addScaledVector(dir.normalize(), step);
      boxObj.rotation.y = Math.atan2(dir.x, dir.z);
    }
  });
  const finish = () => {
    if (outlet === 'qa') {
      boxObj.position.set(4, 0.8, Z - 7.9);
      g.audio.play('impact_soft', { pos: boxObj.position, volume: 0.8 });
      g.ui.hud.subtitle(OUTLET_TEXT.qa, 3.5);
      st.delivered = true;
      g.state.markSolved('p3');
      g.objective('Забрать ключ из лотка выдачи ОТК');
      return;
    }
    g.ui.hud.subtitle(OUTLET_TEXT[outlet], 5);
    if (outlet === 'recycle') {
      g.audio.play('glitch', { pos: pts.recycle, volume: 0.5, rate: 0.4 });
      g.audio.play('metal_groan', { pos: pts.recycle, volume: 0.6, rate: 2.2 });
    } else g.audio.play('impact_soft', { pos: boxObj.position, volume: 0.6 });
    boxObj.visible = false;
    g.co.start(
      (function* (): CoGen {
        yield 6;
        boxObj.position.copy(pts.start);
        boxObj.visible = true;
        g.audio.play('impact_soft', { pos: pts.start, volume: 0.8, rate: 0.8 });
      })(),
      'zone',
    );
  };
  // open the box in the tray
  g.interact.add({
    id: 'qa_box',
    object: boxObj,
    kind: 'pickup',
    prompt: () => (st.delivered && !g.state.has('qa_key') && !g.state.is('picked.qa_key') ? 'Открыть коробку' : null),
    onUse: () => {
      g.giveItem('qa_key');
      g.state.set('picked.qa_key');
      g.objective('Открыть ОТК (западная стена цеха)');
      g.checkpoint('factory.p3');
    },
  });
  return st;
}

// =====================================================================
// foreman office, break room (+ secret nest), QA lab (bracelet)
// =====================================================================

function foreman(g: Game, b: LevelBuilder): void {
  const m = g.mats;
  new Door(g, b, { id: 'foreman_door', x: 24, z: -6, axis: 'z', style: 'office', label: 'МАСТЕР' });
  b.prop(new THREE.Mesh(box(0.02, 1.1, 2.2), m.get('glass_dirty')), 24, 1.55, -10, 0, { collide: false });
  b.collider(23.9, 1.0, -11.1, 24.1, 2.1, -8.9, { opaque: false });
  b.prop(F.desk(m, 1.8, 0.8), 28, 0, -10.6, 0);
  b.prop(F.officeChair(m, '#4a3a2a'), 28, 0, -9.7, Math.PI + 0.2);
  b.prop(F.filingCabinet(m, 4, '#6c7a7b', 2), 31.4, 0, -6, -Math.PI / 2);
  documentProp(g, b, 'marc_qa_key', 27.5, 0.78, -10.5, 0.2, 'sheet');
  documentProp(g, b, 'conveyor_diagram', 30, 1.6, -11.88, 0, 'none', FX.paperOnWall(m, conveyorDiagramCanvas(), 1.0));
  documentProp(g, b, 'marc_shift_log', 28.6, 0.78, -10.4, -0.3, 'clipboard');
  tapePlayer(g, b, 'marc_night', 29.0, 0.78, -10.8, 0.3);
  pickup(g, b, 'swatch', 27.0, 0.78, -10.8, 0.2, () => g.ui.hud.subtitle('Эталон «Верити-жёлтого». Нижняя половина обгорела — рецепта не прочесть.', 4.5));
  b.prop(F.waterCooler(m), 31.5, 0, -11.4, -Math.PI / 2);
  b.prop(F.mug(m, '#f2eadb'), 28.5, 0.78, -10.9, 0, { collide: false });
  b.prop(FX.wallClock(m), 31.88, 2.4, -8, -Math.PI / 2, { collide: false });
  b.prop(F.bulletinBoard(m, 1.4, 0.9), 28, 1.7, -4.12, Math.PI, { collide: false });
  lamp(g, b, 'troffer', 28, 3.2, -8, { intensity: 12, distance: 8, flicker: 'buzz' });
}

function conveyorDiagramCanvas(): HTMLCanvasElement {
  const [c, g] = canvas(1024, 640);
  g.fillStyle = '#f2f0e6';
  g.fillRect(0, 0, 1024, 640);
  g.strokeStyle = '#1a2a3a';
  g.lineWidth = 14;
  g.lineCap = 'round';
  const Y = 330;
  const line = (x0: number, y0: number, x1: number, y1: number) => {
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
    g.stroke();
  };
  line(80, Y, 880, Y);
  line(330, Y, 330, 120);
  line(580, Y, 580, 540);
  line(830, Y, 830, 120);
  g.fillStyle = '#c0392b';
  for (const [x, l] of [
    [330, 'О1'],
    [580, 'О2'],
    [830, 'О3'],
  ] as const) {
    g.beginPath();
    g.arc(x, Y, 30, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#fff';
    g.font = "700 26px 'IBM Plex Sans', sans-serif";
    g.textAlign = 'center';
    g.fillText(l, x, Y + 9);
    g.fillStyle = '#c0392b';
  }
  g.fillStyle = '#1a2a3a';
  g.font = "600 26px 'IBM Plex Sans', sans-serif";
  g.textAlign = 'center';
  g.fillText('ПУСК', 80, Y - 30);
  g.fillText('ДРОБИЛКА', 330, 100);
  g.fillText('ПОКРАСКА', 580, 580);
  g.fillText('ОТК', 830, 100);
  g.fillText('УПАКОВКА', 930, Y - 30);
  g.font = "700 34px 'IBM Plex Sans', sans-serif";
  g.textAlign = 'left';
  g.fillText('ЛИНИЯ Б — СОРТИРОВКА ВОЗВРАТА', 40, 50);
  g.font = "italic 24px 'IBM Plex Sans', sans-serif";
  g.fillText('лопатка вдоль ленты — ПРЯМО, поперёк — ПОВОРОТ', 40, 620);
  return c;
}

function breakRoom(g: Game, b: LevelBuilder): void {
  const m = g.mats;
  new Door(g, b, { id: 'break_door', x: -24, z: -8, axis: 'z', style: 'office', label: 'КОМНАТА ОТДЫХА' });
  b.prop(F.table(m, 1.6, 0.9), -29, 0, -6, 0);
  b.prop(F.table(m, 1.6, 0.9), -29, 0, -9.5, 0);
  for (const [x, z, r] of [
    [-29.5, -5.3, 0],
    [-28.5, -6.7, Math.PI],
    [-29.5, -8.8, 0.3],
    [-28.6, -10.2, Math.PI],
  ] as const)
    b.prop(F.chair(m, '#5f7a80'), x, 0, z, r);
  b.prop(F.mug(m, '#c0392b'), -29.2, 0.77, -6.1, 0, { collide: false });
  b.prop(F.paperStack(m, 3, 4), -28.7, 0.77, -9.4, 0.4, { collide: false });
  // lockers: hide spots + Theo's locker (secret)
  for (let i = 0; i < 5; i++) hideLocker(g, b, 'break_locker' + i, -26 - i * 0.55, 0, -11.6, 0, '#71838a');
  inspect(g, b, null, -28.2, 1.3, -11.3, 'Шкафчик с табличкой «Т. Ламберт». Внутри — эскиз: Верити в виде будильника с лицом. Пометка: «Отказались — дети боятся часов. Сделал мячиком. Мячик никого не боится».', {
    prompt: 'Шкафчик Т. Ламберта',
    secret: 'sec_theo_locker',
    size: 0.5,
  });
  // microwave with the tape
  b.prop(F.table(m, 1.2, 0.6, 0.9, '#d8d2c4'), -26, 0, -2.6, Math.PI);
  b.prop(I.microwave(m), -26.3, 0.92, -2.6, Math.PI);
  g.interact.add({
    id: 'microwave',
    object: (() => {
      const o = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.4), new THREE.MeshBasicMaterial({ visible: false }));
      b.prop(o, -26.3, 1.07, -2.6, 0, { collide: false, static: false });
      return o;
    })(),
    kind: 'use',
    prompt: () => (g.state.is('factory.microwave') ? 'Прослушать кассету' : 'Открыть микроволновку'),
    onUse: () => {
      if (!g.state.is('factory.microwave')) {
        g.state.set('factory.microwave');
        g.secret('sec_microwave');
        g.ui.hud.subtitle('Внутри — кассета без подписи. Кто прячет кассеты в микроволновке?', 4);
      }
      g.playLog('song_1998');
    },
  });
  // vending machine that hides the crawlspace
  const vm = F.vendingMachine(m, '#2f6f6a', 'ВЕРИТИ-СОДА');
  const moved = g.state.is('factory.vmMoved');
  b.prop(vm, -33.45, 0, moved ? -5.9 : -7.5, Math.PI / 2, { static: false, collide: false });
  const vmCol = b.collider(-33.9, 0, (moved ? -5.9 : -7.5) - 0.45, -33.0, 1.85, (moved ? -5.9 : -7.5) + 0.45, { opaque: false });
  g.interact.add({
    id: 'vm_push',
    object: vm,
    kind: 'use',
    hold: 1.2,
    prompt: () => (g.state.is('factory.vmMoved') ? null : 'Отодвинуть автомат'),
    onUse: () => {
      g.state.set('factory.vmMoved');
      g.audio.play('metal_groan', { pos: vm.position, volume: 0.6, rate: 2.5 });
      g.co.start(
        (function* (): CoGen {
          for (let t = 0; t < 1; t += 0.05) {
            vm.position.z = -7.5 + 1.6 * t;
            yield 0.03;
          }
          vm.position.z = -5.9;
          vmCol.min.z = -5.9 - 0.45;
          vmCol.max.z = -5.9 + 0.45;
          g.world.update(vmCol);
          g.ui.hud.subtitle('За автоматом — лаз в стене. Оттуда пахнет восковыми мелками.', 4);
        })(),
        'zone',
      );
    },
  });
  // the nest
  for (let i = 0; i < 9; i++) {
    const kinds = ['verity_me', 'many_friends', 'twelve', 'house', 'clock', 'family', 'goodbye', 'verity_sad', 'eyes'] as const;
    b.prop(FX.paperOnWall(m, childDrawing(kinds[i], 200 + i), 0.45, true, 0.03), -36.88, 0.4 + (i % 3) * 0.35, -8.6 + Math.floor(i / 3) * 0.85, Math.PI / 2, { collide: false });
  }
  documentProp(g, b, 'verity_drawings', -35.5, 0.05, -7.5, 0.4, 'sheet');
  inspect(g, b, null, -36.5, 0.7, -7.5, 'Тайник. Сорок портретов, приклеенных лентой ровными рядами. Под двенадцатым — дыра от карандаша: его обводили, пока бумага не порвалась.', { prompt: 'Осмотреть рисунки', secret: 'sec_nest', size: 0.8 });
  lamp(g, b, 'bare', -35.5, 1.5, -7.5, { intensity: 1.5, distance: 3, color: '#ffcf8a', drop: 0.2, flicker: 'candle' });
  b.prop(FX.paperOnWall(m, poster('staff', 512, 724, 0.4, 88), 0.6), -24.12, 1.7, -4, -Math.PI / 2, { collide: false });
  lamp(g, b, 'troffer', -29, 3.2, -7, { intensity: 12, distance: 8, flicker: 'dying' });
}

function qaLab(g: Game, b: LevelBuilder): void {
  const m = g.mats;
  new Door(g, b, { id: 'qa_door', x: -24, z: -20, axis: 'z', style: 'office', key: 'qa_key', label: 'ОТК' });
  b.prop(new THREE.Mesh(box(0.02, 1.1, 2.4), m.get('glass_dirty')), -24, 1.55, -16.5, 0, { collide: false });
  b.collider(-24.1, 1.0, -17.7, -23.9, 2.1, -15.3, { opaque: false });
  // test benches with toy heads on stands
  for (const [x, z] of [
    [-30, -16],
    [-30, -19.5],
    [-27, -23.5],
  ]) {
    b.prop(I.workbench(m, 2.2), x, 0, z, z < -22 ? 0 : Math.PI / 2);
  }
  for (let i = 0; i < 4; i++) {
    const hd = I.toyHeadOnBelt(m);
    b.prop(hd, -30.3, 0.93, -15.3 + i * 0.4 - 0.2, -Math.PI / 2, { collide: false });
  }
  // sound booth
  b.wall('padded_cream', -33.9, -22.5, -31.0, -22.5, 0, 2.6);
  b.wall('padded_cream', -31.0, -22.5, -31.0, -25.9, 0, 2.6);
  b.prop(F.kidChair(m, '#5fb7ad'), -32.5, 0, -24.5, 0);
  documentProp(g, b, 'theo_principles', -26.6, 0.93, -23.4, 0.2, 'sheet');
  documentProp(g, b, 'hale_windows', -29.6, 0.93, -19.9, -0.4, 'clipboard');
  documentProp(g, b, 'bracelet_manual', -30.4, 0.93, -19.0, 0.6, 'sheet');
  tapePlayer(g, b, 'theo_bracelet', -27.6, 0.93, -23.6, -0.2);
  tapePlayer(g, b, 'irina_friends', -29.6, 0.93, -16.5, 0.3);
  // the bracelet in its calibration cradle
  const cradle = new ModelBuilder();
  cradle.add(rbox(0.3, 0.06, 0.2, 0.02), m.plastic('#3b2c63', 0.4), 0, 0.03, 0);
  b.prop(cradle.group, -26.2, 0.93, -23.5, 0, { collide: false });
  pickup(g, b, 'bracelet', -26.2, 1.0, -23.5, 0, () => {
    g.state.set('bracelet.owned');
    g.state.set('bracelet.on');
    g.co.start(braceletScene(g, b), 'zone');
  });
  b.prop(FX.paperOnWall(m, poster('harmony', 512, 724, 0.3, 91), 0.8), -33.88, 1.7, -17, Math.PI / 2, { collide: false });
  lamp(g, b, 'troffer', -29, 3.2, -18, { intensity: 14, distance: 8 });
  lamp(g, b, 'troffer', -29, 3.2, -23, { intensity: 10, distance: 7, flicker: 'buzz' });
}

function* braceletScene(g: Game, b: LevelBuilder): CoGen {
  g.audio.play('keypad_ok', { volume: 0.6 });
  g.ui.hud.subtitle('Браслет пискнул и засветился. Где-то в цехе ответила музыкальная шкатулка.', 5);
  yield 1.2;
  g.music.motif({ pos: new THREE.Vector3(-20, 1, -17), volume: 0.5 });
  yield 2.5;
  // he looks in through the window
  g.verity.watch(new THREE.Vector3(-21.5, 0, -16.5), { vanishDist: 3, maxTime: 6, yaw: -Math.PI / 2, unseenVanish: true });
  g.verity.setMood('happy');
  g.verity.gesture('wave');
  yield 3;
  yield g.say('verity', 'Ты нашёл браслет! Теперь я всегда буду знать, где ты.', { pos: new THREE.Vector3(-21.5, 1, -16.5) });
  yield g.say('verity', 'Это же хорошо, правда? Правда ведь?', { pos: new THREE.Vector3(-21.5, 1, -16.5) });
  yield 1;
  if (g.verity.state === 'watch') g.verity.hide();
  // he puts the hall warden to sleep
  const w = (b.zone as any).hallWarden as Warden | undefined;
  if (w && w.state !== 'off') {
    yield 1.5;
    w.disable();
    g.state.set('factory.wardenOff');
    yield g.say('verity', 'Я усыпил Стража. Он больше не будет на тебя светить. Он хороший, просто глупый.');
  }
  g.ui.hud.notify('B — включить / выключить браслет «Друг»', 'info');
  g.objective('Открыть ворота склада звёздным замком. Найти ключ грузового лифта');
  g.checkpoint('factory.bracelet');
}

// =====================================================================
// paint shop (P4) + dryer with the lift key
// =====================================================================

function paintShop(g: Game, b: LevelBuilder): void {
  const m = g.mats;
  const door = new Door(g, b, {
    id: 'paint_door',
    x: 24,
    z: -21,
    axis: 'z',
    width: 1.4,
    style: 'metal',
    label: 'ПОКРАСКА',
    lock: () => (g.state.is('factory.paintOpen') ? null : 'Дверь заклинило'),
  });
  // Verity opens it when you come close with the bracelet
  b.trigger('paint_help', 19, 0, -24, 23.5, 3, -18, {
    when: () => !g.state.is('factory.paintOpen') && g.state.is('bracelet.owned'),
    onEnter: () => {
      g.co.start(
        (function* (): CoGen {
          yield g.say('verity', 'Ой, заело! Сейчас-сейчас…', { pos: new THREE.Vector3(26, 1, -21) });
          g.audio.play('metal_slam', { pos: new THREE.Vector3(24, 1, -21), volume: 0.8 });
          g.player.addTrauma(0.2);
          g.state.set('factory.paintOpen');
          door.refreshLock();
          door.setOpen(true);
          yield 0.6;
          g.say('verity', 'Готово!', { pos: new THREE.Vector3(27, 1, -21) });
        })(),
        'zone',
      );
    },
  });
  const units = g.state.puzzle<Record<Pigment, number>>('p4', () => ({ Y: 0, M: 0, C: 0, W: 0 }));
  const vat = I.paintVat(m);
  b.prop(vat.group, 30, 0, -23, 0);
  const colors: Record<Pigment, string> = { Y: '#f1c40f', M: '#c0307a', C: '#2a9fd6', W: '#f2f2f2' };
  const pos: Record<Pigment, [number, number]> = { Y: [26.5, -27.5], M: [29, -28.3], C: [31.5, -28.3], W: [34, -27.5] };
  const wheels: Record<string, THREE.Group> = {};
  for (const p of PIGMENTS) {
    const t = I.paintTank(m, colors[p], PIGMENT_NAMES[p].toUpperCase());
    b.prop(t.group, pos[p][0], 0, pos[p][1], 0);
    wheels[p] = t.wheel;
    // unit counter
    const [cc, cg] = canvas(128, 64);
    const counter = m.canvasMaterial(cc, { emissive: 1 });
    const cm = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.12), counter);
    cm.position.set(pos[p][0], 1.6, pos[p][1] + 0.47);
    b.addDynamic(cm);
    const draw = () => {
      cg.fillStyle = '#0a120a';
      cg.fillRect(0, 0, 128, 64);
      cg.fillStyle = '#8dff8a';
      cg.font = "700 40px 'IBM Plex Mono', monospace";
      cg.textAlign = 'center';
      cg.fillText(`${p === 'Y' ? 'Ж' : p === 'M' ? 'П' : p === 'C' ? 'Г' : 'Б'}${units[p]}`, 64, 46);
      (counter.map as THREE.CanvasTexture).needsUpdate = true;
    };
    draw();
    g.interact.add({
      id: 'tank_' + p,
      object: t.group,
      kind: 'use',
      prompt: () => (g.state.solved('p4') ? null : `${PIGMENT_NAMES[p]}: ${units[p]} → ${(units[p] + 1) % (MAX_UNITS + 1)} (повернуть вентиль)`),
      onUse: () => {
        units[p] = (units[p] + 1) % (MAX_UNITS + 1);
        g.audio.play('valve', { pos: t.group.position, volume: 0.6 });
        wheels[p].rotation.z += Math.PI / 2;
        draw();
      },
    });
  }
  // mix button + colorimeter
  b.prop(I.controlConsole(m, 2.0), 30, 0, -21.4, 0);
  b.solid('metal_dark', 30, 1.0, -21.68, 2.0, 0.9, 0.06, { collide: false });
  const colorimeter = I.gauge(m, 'отклонение', 10, 8);
  b.prop(colorimeter.group, 30, 1.5, -21.64, 0, { collide: false, static: false });
  const setVat = () => {
    const c = mixColor(units);
    vat.liquid.color.setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace);
    const d = colorDistance(c, TARGET_COLOR);
    colorimeter.needle.rotation.z = Math.PI * 0.75 - Math.min(1, d / 0.6) * Math.PI * 1.5;
  };
  setVat();
  const mix = new ModelBuilder();
  mix.add(rbox(0.3, 0.4, 0.15, 0.02), m.painted('#3a3f42', 0.5), 0, 0, 0.075);
  mix.add(cyl(0.06, 0.06, 0.05, 16), m.plastic('#27ae60', 0.3), 0, 0, 0.17, Math.PI / 2);
  b.prop(mix.group, 30.8, 1.3, -21.64, 0, { collide: false, static: false });
  b.prop(FX.signPanel(m, 'ЗАМЕС', { bg: '#22313a', fg: '#e8e2d0', w: 256, h: 96, width: 0.3 }), 30.8, 1.62, -21.64, 0, { collide: false });
  g.interact.add({
    id: 'paint_mix',
    object: mix.group,
    kind: 'use',
    prompt: () => (g.state.solved('p4') ? null : 'Замес'),
    onUse: () => {
      g.audio.play('motor_loop', { pos: vat.group.position, volume: 0.6 })?.stop(2.5);
      setVat();
      if (isTarget(units)) {
        g.state.markSolved('p4');
        g.audio.play('keypad_ok', { pos: vat.group.position, volume: 0.7 });
        g.ui.hud.subtitle('Цвет совпал с эталоном. Где-то щёлкнул замок сушильной камеры.', 4.5);
        dryer.refreshLock();
        g.co.start(
          (function* (): CoGen {
            yield 2;
            g.audio.play('steam_burst', { pos: new THREE.Vector3(36, 1.2, -24), volume: 0.8 });
            dryer.setOpen(true);
          })(),
          'zone',
        );
        g.checkpoint('factory.p4');
      } else {
        const d = colorDistance(mixColor(units), TARGET_COLOR);
        g.ui.hud.subtitle(d < 0.1 ? 'Почти. Чуть-чуть не тот оттенок.' : 'Не тот цвет. Стрелка колориметра далеко от нуля.', 3.5);
      }
    },
  });
  documentProp(g, b, 'paint_chart', 25, 1.7, -16.12, Math.PI, 'none', FX.paperOnWall(m, paintChartCanvas(), 1.0));
  // reference swatch holder near the vat: shows the target colour if you carry the card
  const holder = new ModelBuilder();
  holder.add(box(0.3, 0.4, 0.02), m.painted('#d8d6cf', 0.5), 0, 0, 0.01);
  b.prop(holder.group, 29.2, 1.45, -21.64, 0, { collide: false, static: false });
  const placed = swatchCard(m);
  placed.visible = g.state.is('factory.swatchPlaced');
  b.prop(placed, 29.2, 1.45, -21.6, 0, { collide: false, static: false });
  placed.rotation.set(Math.PI / 2, 0, 0);
  g.interact.add({
    id: 'swatch_holder',
    object: holder.group,
    kind: 'use',
    prompt: () => (g.state.is('factory.swatchPlaced') ? 'Эталон «Верити-жёлтый»' : g.state.has('swatch') ? 'Закрепить эталон' : 'Держатель эталона (пусто)'),
    onUse: () => {
      if (!g.state.is('factory.swatchPlaced') && g.state.has('swatch')) {
        g.state.set('factory.swatchPlaced');
        g.state.removeItem('swatch');
        placed.visible = true;
      }
      g.ui.hud.subtitle('Эталон сливочно-жёлтый, тёплый. От рецепта уцелело: «Ж3 … Б1». Середина сгорела.', 5);
    },
  });
  // dressing: spray booth, drums
  for (let i = 0; i < 4; i++) b.prop(F.barrel(m, ['#f1c40f', '#c0307a', '#2a9fd6', '#d8d6cf'][i]), 25 + i * 0.7, 0, -16.8, i);
  b.prop(I.toyBin(m, 'shells', 4), 34.5, 0, -18, 0);
  const st = m.canvasMaterial(spatterCanvas(), { transparent: true });
  b.decal(st, 30, 0.004, -23, 4, 4, 'up');
  b.decal(st, 26, 0.004, -19, 2.5, 2.5, 'up', { rot: 1.2 });
  lamp(g, b, 'cage', 30, 4.3, -16.12, { ry: Math.PI, intensity: 18, distance: 10 });
  lamp(g, b, 'cage', 35.88, 3.2, -22, { ry: -Math.PI / 2, intensity: 10, distance: 7, flicker: 'buzz' });
  b.sound('vent_loop', 30, 4, -29.5, 0.3);
  // the dryer: security door that opens on a correct batch
  const dryer = new Door(g, b, {
    id: 'dryer_door',
    x: 36,
    z: -24,
    axis: 'z',
    width: 1.2,
    style: 'security',
    label: 'СУШКА',
    lock: () => (g.state.solved('p4') ? null : 'Сушильная камера: ждёт замес партии'),
  });
  documentProp(g, b, 'marc_dryer', 38.5, 1.0, -25.5, 0.4, 'sheet');
  const sh = new ModelBuilder();
  sh.add(box(1.0, 0.04, 0.4), m.steel('#9aa0a6', 0.5), 0, 0.98, 0);
  b.prop(sh.group, 38.5, 0, -25.5, 0, { collide: false });
  pickup(g, b, 'lift_key', 38.8, 1.0, -25.4, 0.2, () => g.objective(g.state.solved('p5') ? 'Спуститься на грузовом лифте склада' : 'Открыть ворота склада звёздным замком'));
  lamp(g, b, 'bare', 38, 2.8, -24, { intensity: 4, distance: 5, color: '#ffb070', drop: 0.2 });
}

function paintChartCanvas(): HTMLCanvasElement {
  const [c, g] = canvas(768, 900);
  g.fillStyle = '#f2f0e6';
  g.fillRect(0, 0, 768, 900);
  g.fillStyle = '#1a2a3a';
  g.font = "700 36px 'IBM Plex Sans', sans-serif";
  g.fillText('ТАБЛИЦА СМЕШИВАНИЯ', 40, 64);
  const rows: Array<[string, Record<Pigment, number>]> = [
    ['Ж4 «Лимон»', { Y: 4, M: 0, C: 0, W: 0 }],
    ['Ж3 П1 «Апельсин»', { Y: 3, M: 1, C: 0, W: 0 }],
    ['Ж3 Б1 «Сливочный»', { Y: 3, M: 0, C: 0, W: 1 }],
    ['Ж2 П1 Б1 «Персик»', { Y: 2, M: 1, C: 0, W: 1 }],
    ['Ж2 Г1 «Лайм»', { Y: 2, M: 0, C: 1, W: 0 }],
    ['Г1 Б2 «Бирюза»', { Y: 0, M: 0, C: 1, W: 2 }],
  ];
  rows.forEach(([label, u], i) => {
    const col = mixColor(u);
    g.fillStyle = `rgb(${col.map((v) => Math.round(v * 255)).join(',')})`;
    g.fillRect(40, 110 + i * 110, 120, 80);
    g.strokeStyle = '#333';
    g.strokeRect(40, 110 + i * 110, 120, 80);
    g.fillStyle = '#1a2a3a';
    g.font = "500 30px 'IBM Plex Mono', monospace";
    g.fillText(label, 190, 162 + i * 110);
  });
  g.fillStyle = '#b02a2a';
  g.font = "700 30px 'IBM Plex Sans', sans-serif";
  g.fillText('«ВЕРИТИ-ЖЁЛТЫЙ»: 5 долей, см. эталон', 40, 800);
  g.font = "italic 26px 'IBM Plex Sans', sans-serif";
  g.fillText('теплее «Сливочного», светлее «Апельсина»', 40, 850);
  return c;
}

function spatterCanvas(): HTMLCanvasElement {
  const [c, g] = canvas(512, 512);
  g.clearRect(0, 0, 512, 512);
  const rng = new Rng(9);
  for (let i = 0; i < 120; i++) {
    g.fillStyle = `rgba(${rng.pick(['244,211,94', '239,138,126', '47,167,155', '240,240,240'])},${rng.range(0.2, 0.7)})`;
    g.beginPath();
    g.arc(256 + rng.range(-1, 1) * 200 * rng.next(), 256 + rng.range(-1, 1) * 200 * rng.next(), rng.range(2, 30), 0, Math.PI * 2);
    g.fill();
  }
  return c;
}

// =====================================================================
// P5: the star gate (FriendLink relay demonstrated by Verity)
// =====================================================================

function starGateArea(g: Game, b: LevelBuilder): RelayState {
  const m = g.mats;
  const st = g.state.puzzle<RelayState>('p5', relayInit);
  const gate = I.starGate(m, 5, 4.2);
  b.prop(gate.group, 0, 0, -40, 0, { collide: false, static: false });
  const col = b.collider(-2.6, 0, -40.2, 2.6, 4.2, -39.8, { opaque: true });
  const setOpen = (open: boolean, instant = false) => {
    col.enabled = !open;
    gate.starMat.emissiveIntensity = open ? 2 : 0.15;
    if (instant) gate.shutter.position.y = open ? 4.0 : 0;
    g.zone?.nav?.refresh({ minX: -3, minZ: -41, maxX: 3, maxZ: -39 });
  };
  setOpen(st.done, true);
  let shutterTarget = st.done ? 4 : 0;
  b.update((dt) => {
    gate.shutter.position.y += (shutterTarget - gate.shutter.position.y) * Math.min(1, dt * 0.8);
  });
  const recv: Record<StarColor, { pos: THREE.Vector3; mat: THREE.MeshStandardMaterial }> = {} as any;
  const layout: Array<[StarColor, number, number, string]> = [
    ['red', -6, 2.2, '#e74c3c'],
    ['blue', -3.8, 5.4, '#3498db'],
    ['yellow', 3.8, 5.4, '#f1c40f'],
    ['green', 6, 2.2, '#2ecc71'],
  ];
  const signal = (c: StarColor) => {
    if (st.done) return;
    const r = relayInput(st, c);
    if (r === 'fail') {
      g.audio.play('keypad_err', { volume: 0.6 });
      for (const k of Object.keys(recv) as StarColor[]) recv[k].mat.emissiveIntensity = 0.1;
      if (!g.co.isRunning('demo')) g.co.start(demo(g, recv, true), 'demo');
    } else if (r === 'done') {
      g.state.markSolved('p5');
      shutterTarget = 4;
      setOpen(true);
      g.audio.play('shutter', { pos: new THREE.Vector3(0, 2, -40), volume: 1 });
      g.music.motif({ volume: 0.5, pos: new THREE.Vector3(0, 3, -40) });
      g.co.start(
        (function* (): CoGen {
          yield 1;
          if (g.verity.visible) {
            g.verity.gesture('wave');
            yield g.say('verity', 'Ура! У нас получилось! У нас! Вместе!', { pos: g.verity.rig.worldEye });
            g.verity.moveTo(new THREE.Vector3(0, 0, -50), 2.2);
            yield 3;
            g.verity.hide();
          }
          g.objective(g.state.has('lift_key') ? 'Спуститься на грузовом лифте склада' : 'Найти ключ грузового лифта (покрасочный цех)');
          g.checkpoint('factory.p5');
        })(),
        'zone',
      );
    }
  };
  for (const [c, x, y, rim] of layout) {
    const r = starReceiver(g, b, x, y, -39.8, 0, () => signal(c), { id: c, active: () => !st.done });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.03, 8, 28), m.plastic(rim, 0.3));
    ring.position.set(x, y, -39.72);
    b.addDynamic(ring);
    recv[c] = { pos: new THREE.Vector3(x, y, -39.7), mat: r.mat };
  }
  // backup clue: a child's drawing of four stars in order
  const [dc, dg] = canvas(512, 256);
  dg.fillStyle = '#fffdf4';
  dg.fillRect(0, 0, 512, 256);
  const cmap: Record<StarColor, string> = { red: '#e74c3c', blue: '#3498db', yellow: '#f1c40f', green: '#2ecc71' };
  RELAY_ORDER.forEach((c, i) => {
    dg.fillStyle = cmap[c];
    star(dg, 70 + i * 120, 120, 50, 22, 5);
    dg.fillStyle = '#333';
    dg.font = "700 30px 'Caveat', cursive";
    dg.fillText(String(i + 1), 62 + i * 120, 220);
  });
  b.prop(FX.paperOnWall(m, dc, 0.6, true, 0.03), 9.5, 1.5, -39.88, 0, { collide: false });
  // Verity shows you the order when you arrive with the bracelet
  b.trigger('gate_demo', -8, 0, -38, 8, 3, -30, {
    when: () => g.state.is('bracelet.owned') && !st.done && !g.co.isRunning('demo'),
    onEnter: () => g.co.start(demo(g, recv, false), 'demo'),
  });
  lamp(g, b, 'cage', 0, 6.2, -39.85, { intensity: 14, distance: 9 });
  return st;
}

function* demo(g: Game, recv: Record<StarColor, { pos: THREE.Vector3; mat: THREE.MeshStandardMaterial }>, again: boolean): CoGen {
  const v = g.verity;
  if (!v.visible) {
    v.spawn(new THREE.Vector3(-9, 0, -36), Math.PI / 2, 'scripted');
    v.setMood('happy');
    v.lookAtPlayer = true;
    g.music.motif({ pos: new THREE.Vector3(-9, 1, -36), volume: 0.3 });
  }
  yield 0.6;
  yield v.say(again ? 'Нет-нет! Не так. Смотри ещё раз!' : 'Смотри! Звёздочки надо будить по порядку. Я покажу!');
  for (const c of RELAY_ORDER) {
    const r = recv[c];
    v.moveTo(new THREE.Vector3(r.pos.x, 0, -38.6), 2.4);
    const t0 = g.time;
    yield () => v.pos.distanceTo(new THREE.Vector3(r.pos.x, 0, -38.6)) < 0.4 || v.state !== 'scripted' || g.time - t0 > 7;
    if (v.pos.distanceTo(new THREE.Vector3(r.pos.x, 0, -38.6)) > 1) v.teleport(new THREE.Vector3(r.pos.x, 0, -38.6));
    v.faceTo(new THREE.Vector3(r.pos.x, 0, -45));
    v.gesture('point', r.pos);
    yield 0.4;
    r.mat.emissiveIntensity = 2.5;
    g.audio.play('keypad_ok', { pos: r.pos, volume: 0.6, rate: 0.8 + RELAY_ORDER.indexOf(c) * 0.12 });
    yield 0.7;
    r.mat.emissiveIntensity = 0.1;
    v.gesture('none');
  }
  v.moveTo(new THREE.Vector3(-1.5, 0, -35), 2.0);
  yield 1.5;
  v.lookAtPlayer = true;
  yield v.say('Теперь ты! Направь браслет на звёздочку и нажми.');
}

// =====================================================================
// warehouse: second warden, the lift
// =====================================================================

function warehouse(g: Game, b: LevelBuilder): void {
  const m = g.mats;
  // racks in aisles
  for (const x of [-11, -5, 5, 11])
    for (let i = 0; i < 4; i++) {
      const z = -46 - i * 5.5;
      b.prop(I.palletRack(m, 2.8, 4.6, 1.2, 3, x * 7 + i), x, 0, z, Math.PI / 2);
    }
  b.prop(I.forklift(m), -13.5, 0, -64, 0.2);
  for (let i = 0; i < 5; i++) b.prop(F.crate(m, 0.9), 13.5, i > 2 ? 0.9 : 0, -46 - (i % 3) * 1.0, 0.1 * i);
  // throwables for distraction
  for (const [x, z] of [
    [-2, -44],
    [2.4, -52],
    [-1.5, -60],
  ])
    throwable(g, b, plushVerity(m, 1, '#f4d35e', 0.5), 'игрушка', x, 0, z);
  // lights
  for (const z of [-48, -58, -66]) lamp(g, b, 'pendant', 0, 9, z, { drop: 3.5, intensity: 35, distance: 12, color: '#e6eeff', flicker: z === -58 ? 'dying' : 'none' });
  lamp(g, b, 'emergency', -15.88, 3, -56, { ry: Math.PI / 2, intensity: 5, distance: 8 });
  // second warden patrols the aisles
  const path = [new THREE.Vector3(-8, 7.2, -44), new THREE.Vector3(-8, 7.2, -66), new THREE.Vector3(8, 7.2, -66), new THREE.Vector3(8, 7.2, -44)];
  const w = new Warden(g, b, path, { start: 0.3, speed: 1.1 });
  b.prop(I.rail(m, path.map((p) => p.clone().setY(7.35))), 0, 0, 0, 0, { collide: false });
  w.onAlert = () => g.co.start(escort(g, w, new THREE.Vector3(0, 0, -36)), 'zone');
  // Verity's distraction halfway through
  b.trigger('wh_help', -4, 0, -56, 4, 3, -52, {
    when: () => !g.state.is('factory.whHelp'),
    onEnter: () => {
      g.state.set('factory.whHelp');
      const p = new THREE.Vector3(12, 1, -68);
      g.audio.play('squeak', { pos: p, volume: 0.9 });
      g.bus.emit('noise', { x: p.x, y: p.y, z: p.z, radius: 30, source: 'verity' });
      g.say('verity', 'Эй, Страж! Я здесь! Догони!', { pos: p });
    },
  });
  // the freight lift
  const lift = I.freightLift(m);
  b.prop(lift.group, 0, 0, -69.5, 0, { static: false, collide: false });
  b.collider(-1.7, 0, -71.2, 1.7, 3.1, -71.0, { opaque: true });
  b.collider(-1.7, 0, -71.2, -1.5, 3.1, -67.9, { opaque: true });
  b.collider(1.5, 0, -71.2, 1.7, 3.1, -67.9, { opaque: true });
  b.solid('diamond_plate', 0, -0.05, -69.5, 3.2, 0.17, 3.2, { tag: 'surf:metal' });
  const gateCol = b.collider(-1.6, 0, -68.0, 1.6, 2.8, -67.8, { opaque: false });
  gateCol.enabled = !g.state.is('factory.liftOpen');
  if (g.state.is('factory.liftOpen')) lift.gate.position.y = 2.6;
  const panel = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.36, 0.1), new THREE.MeshBasicMaterial({ visible: false }));
  b.prop(panel, 1.9, 1.3, -67.75, 0, { collide: false, static: false });
  g.interact.add({
    id: 'lift_call',
    object: panel,
    kind: 'use',
    prompt: () => (g.state.is('factory.liftOpen') ? null : g.state.has('lift_key') ? 'Вставить ключ и вызвать лифт' : 'Пульт лифта: нужен ключ'),
    onUse: () => {
      if (!g.state.has('lift_key')) {
        g.ui.hud.subtitle('Замок под трёхгранный ключ. «ГРУЗ. ЛИФТ — ГАРМОНИЯ».', 4);
        return;
      }
      g.state.set('factory.liftOpen');
      g.audio.play('lock_open', { pos: panel.position });
      g.audio.play('elevator_ding', { pos: panel.position, volume: 0.6 });
      g.co.start(
        (function* (): CoGen {
          for (let t = 0; t <= 1; t += 0.04) {
            lift.gate.position.y = t * 2.6;
            yield 0.03;
          }
          gateCol.enabled = false;
        })(),
        'zone',
      );
    },
  });
  const down = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 0.1), new THREE.MeshBasicMaterial({ visible: false }));
  b.prop(down, 1.45, 1.3, -70.3, -Math.PI / 2, { collide: false, static: false });
  const btn = new ModelBuilder();
  btn.add(rbox(0.16, 0.28, 0.05, 0.01), m.painted('#d8d6cf', 0.5), 0, 0, 0.025);
  btn.add(cyl(0.035, 0.035, 0.03, 12), m.plastic('#c0392b', 0.3), 0, 0.05, 0.06, Math.PI / 2);
  btn.add(cyl(0.035, 0.035, 0.03, 12), m.plastic('#27ae60', 0.3), 0, -0.05, 0.06, Math.PI / 2);
  b.prop(btn.group, 1.52, 1.3, -70.3, -Math.PI / 2, { collide: false });
  g.interact.add({
    id: 'lift_down',
    object: down,
    kind: 'use',
    prompt: () => (g.state.is('factory.liftOpen') ? 'Вниз: «Гармония»' : null),
    onUse: () => g.co.start(liftRide(g, lift.gate, gateCol), 'zone'),
  });
  lamp(g, b, 'cage', 0, 2.95, -69.5, { intensity: 6, distance: 5, flicker: 'buzz' });
  b.prop(FX.signPanel(m, 'ГРУЗОВОЙ ЛИФТ · −1 ГАРМОНИЯ', { bg: '#22313a', fg: '#f1c40f', w: 768, h: 96, width: 2.4 }), 0, 3.4, -67.85, 0, { collide: false });
}

function* liftRide(g: Game, gate: THREE.Group, gateCol: import('../physics/CollisionWorld').Collider): CoGen {
  if (Math.abs(g.player.pos.z + 69.5) > 1.5 || Math.abs(g.player.pos.x) > 1.5) {
    g.ui.hud.subtitle('Сначала нужно зайти в кабину.', 3);
    return;
  }
  g.canSave = false;
  gateCol.enabled = true;
  for (let t = 1; t >= 0; t -= 0.05) {
    gate.position.y = t * 2.6;
    yield 0.03;
  }
  g.audio.play('metal_slam', { volume: 0.6 });
  const motor = g.audio.play('motor_loop', { loop: true, volume: 0.7 });
  g.player.addTrauma(0.3);
  if (g.verity.visible) g.verity.hide();
  yield g.say('verity', 'Внизу Гармония. Там… тихо. Мне там не нравится.', { degrade: 0 });
  yield g.say('verity', 'Но тебе нужно туда, да? Я буду рядом. Я всегда рядом.', { degrade: 0 });
  yield 1;
  yield g.fadeOut(1.5);
  motor?.stop(0.5);
  g.state.set('factory.done');
  g.canSave = true;
  yield g.loadZone('research', 'start').catch(() => g.notify('Продолжение следует…'));
}

function* escort(g: Game, w: Warden, to?: THREE.Vector3): CoGen {
  g.canSave = false;
  g.player.movementLocked = true;
  g.audio.play('alarm_loop', { volume: 0.6 })?.stop(2);
  yield 1.2;
  yield g.fadeOut(0.8);
  const safe = to ?? ((g.zone as any)?.safe as THREE.Vector3) ?? new THREE.Vector3(18, 0, -11);
  g.player.teleport(safe.x, safe.y, safe.z, Math.PI);
  w.reset();
  g.renderer.fx.danger = 0;
  yield 0.6;
  g.ui.hud.subtitle('«ПОСТОРОННИМ ВХОД ВОСПРЕЩЁН». Страж вывел меня обратно и уехал по своему рельсу.', 5);
  g.player.movementLocked = false;
  g.canSave = true;
  yield g.fadeIn(1);
}

void sign;
