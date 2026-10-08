import * as THREE from 'three';
import type { ZoneDef } from './types';
import type { Game } from '../Game';
import type { LevelBuilder } from '../world/LevelBuilder';
import type { CoGen } from '../core/Coroutines';
import type { VLight } from '../render/LightManager';
import type { Trigger } from '../world/Zone';
import { lamp, documentProp, tapePlayer, inspect } from '../world/entities';
import * as F from '../models/furniture';
import * as FX from '../models/fixtures';
import * as C from '../models/core';
import * as K from '../models/kids';
import { kidPortrait, cake, balloon } from '../models/lobby';
import { blueDogDrawing, waitCounter, tallyCanvas } from '../models/research';
import { kidsBed } from '../models/oldworks';
import { childDrawing, scrawl, sign } from '../assets/Signage';
import { ChoiceScreen } from '../ui/screens/Choice';
import { DialogueScreen } from '../ui/screens/Dialogue';
import { heartInit, heartTime, heartWord, heartCheck, endingsAvailable, PROMISES, type HeartState } from '../puzzles/heart';
import type { EndingId } from '../ui/screens/Ending';
import { dust, lightCone } from '../world/vfx';
import { box, ModelBuilder } from '../world/geom';
import { Rng } from '../assets/noise';

interface Refs {
  wall: { group: THREE.Group; z: number; target: number; trigger: Trigger };
  alleyLights: VLight[];
  heart: { glow: THREE.MeshStandardMaterial; rings: THREE.Object3D[]; light: VLight };
  console: ReturnType<typeof C.finalConsole> | null;
  consoleY: number;
  chase: boolean;
}

const refsOf = (g: Game): Refs => (g.zone as any).refs as Refs;

// vestibule centres (entry: where you arrive; exit: where you vanish)
const V = (x: number, z: number) => new THREE.Vector3(x, 0, z);
const ENTRY = {
  m0: V(0, -20),
  m1: V(24, -30),
  m2: V(44, -28),
  m3: V(61.5, -28),
  m4: V(84, -30),
  heart: V(115, -28),
};
const HEART = new THREE.Vector3(115, 7, -46);

export const core: ZoneDef = {
  id: 'core',
  name: 'Сердцевина',
  chapter: 'Акт VI. Сердцевина',
  materials: [
    'concrete', 'concrete_dark', 'metal_dark', 'metal_rust', 'diamond_plate', 'grate', 'wall_plaster_dark', 'floor_carpet_red', 'wall_wallpaper', 'wood_panel', 'wood_dark',
    'padded_cream', 'linoleum_green', 'ceiling_tiles_clean', 'wall_plaster_peach', 'linoleum_beige', 'tile_pastel', 'ceiling_tiles', 'wall_wallpaper_kids', 'floor_carpet_blue', 'stone_old', 'brick_old',
  ],
  nav: { minX: -6, minZ: -66, maxX: 132, maxZ: 8, probeY: 3.0 },
  build(g, b) {
    // his last form is sculpted in the background, long before it is needed
    void g.verity.rig.prepare(4);
    const env = b.zone.env;
    env.fogColor.set(0x0d0805);
    env.fogDensity = 0.03;
    env.ambient.set(0x6a4a30);
    env.ambientIntensity = 0.08;
    env.hemiSky.set(0x9a6a40);
    env.hemiGround.set(0x1a0e08);
    env.hemiIntensity = 0.14;
    env.reverb = 'vast';
    env.ambience = ['drone_loop', 'hum_loop'];
    env.envMap = 'core';
    env.envIntensity = 0.4;

    rooms(b);
    const refs = { console: null, consoleY: 0, chase: false } as unknown as Refs;
    (b.zone as any).refs = refs;
    arrival(g, b);
    m0Alley(g, b, refs);
    m1Junction(g, b);
    m2Upside(g, b);
    m3Narrowing(g, b);
    m4Forever(g, b);
    heartChamber(g, b, refs);
    seams(g, b);

    b.spawn('start', 0, 0, 3.4, 0);
    b.spawn('chase', 0, 0, -18, 0);
    b.spawn('heart', 115, 0, -32, 0);
    (b.zone as any).safe = new THREE.Vector3(0, 0, -6);
  },
  onEnter(g, spawn, restored) {
    if (restored) {
      if (g.state.is('core.chase') && !g.state.is('core.heart')) g.co.start(chaseStarts(g, true), 'zone');
      return;
    }
    if (spawn === 'start' && !g.state.is('core.entered')) {
      g.state.set('core.entered');
      g.co.start(arrivalScene(g), 'zone');
    }
  },
};

// =====================================================================
// layout
// =====================================================================

const SEAM = { floor: 'concrete_dark', wall: 'concrete_dark', ceil: 'concrete_dark', baseboard: null };

function vest(b: LevelBuilder, id: string, cx: number, z0: number, low = false): void {
  // a 4 m dark vestibule running north-south, centred on cx, from z0 to z0-4
  b.room(id, { x: cx - 1, z: z0 - 4, w: 2, d: 4, h: low ? 1.15 : 2.6, ...SEAM });
}

function rooms(b: LevelBuilder): void {
  b.room('arrive', { x: -2, z: 0, w: 4, d: 6, h: 4, floor: 'diamond_plate', wall: 'metal_dark', ceil: 'metal_dark', baseboard: null });
  b.room('ante', { x: -8, z: -16, w: 16, d: 16, h: 7, floor: 'stone_old', wall: 'brick_old', ceil: 'concrete_dark', baseboard: null });
  b.connect('ante', 'arrive', 0, 3, 3.2);
  // M0: the Alley of Friends, which keeps getting longer
  b.room('m0', { x: -2, z: -66, w: 4, d: 50, h: 3.4, floor: 'floor_carpet_red', wall: 'wall_wallpaper', ceil: 'wall_plaster_dark', baseboard: 'wood_dark', wainscot: { mat: 'wood_panel', height: 1.0, rail: 'wood_dark' } });
  b.connect('m0', 'ante', 0, 1.6, 2.4);
  // M1: waiting-chamber junction
  vest(b, 'm1v', 24, -28);
  b.room('m1', { x: 20, z: -40, w: 8, d: 8, h: 3, floor: 'linoleum_green', wall: 'padded_cream', ceil: 'ceiling_tiles_clean', baseboard: null });
  b.connect('m1v', 'm1', 24, 1.4, 2.4);
  for (const x of [21.5, 24, 26.5]) {
    vest(b, 'm1x' + x, x, -40);
    b.connect('m1', 'm1x' + x, x, 1.0, 2.2);
  }
  // M2: the party room, upside down
  vest(b, 'm2v', 44, -26);
  b.room('m2', { x: 40, z: -42, w: 8, d: 12, h: 3, floor: 'ceiling_tiles', wall: 'wall_plaster_peach', ceil: 'linoleum_beige', baseboard: null, wainscot: { mat: 'tile_pastel', height: 1.0 } });
  b.connect('m2v', 'm2', 44, 1.4, 2.4);
  vest(b, 'm2x', 44, -42);
  b.connect('m2', 'm2x', 44, 1.1, 2.2);
  // M3: the narrowing corridor
  vest(b, 'm3v', 61.5, -26);
  b.room('m3', { x: 60, z: -60, w: 3, d: 30, h: 3.2, floor: 'concrete', wall: 'brick_old', ceil: 'concrete_dark', baseboard: null });
  b.connect('m3v', 'm3', 61.5, 1.4, 2.4);
  vest(b, 'm3x', 61.5, -60, true);
  b.connect('m3', 'm3x', 61.5, 1.0, 1.1);
  // M4: the Forever Room again
  vest(b, 'm4v', 84, -28);
  b.room('m4', { x: 80, z: -40, w: 8, d: 8, h: 3, floor: 'floor_carpet_blue', wall: 'wall_wallpaper_kids', ceil: 'ceiling_tiles', baseboard: 'wood_dark' });
  b.connect('m4v', 'm4', 84, 1.4, 2.4);
  for (const x of [82, 86]) {
    vest(b, 'm4x' + x, x, -40);
    b.connect('m4', 'm4x' + x, x, 1.0, 2.2);
  }
  // the Heart
  vest(b, 'hv', 115, -26);
  b.room('heart', { x: 100, z: -62, w: 30, d: 32, h: 16, floor: 'grate', wall: 'brick_old', ceil: 'concrete_dark', baseboard: null });
  b.connect('hv', 'heart', 115, 1.6, 2.4);
}

// =====================================================================
// arrival and the start of the last chase
// =====================================================================

function arrival(g: Game, b: LevelBuilder): void {
  const m = g.mats;
  lamp(g, b, 'cage', 0, 3.9, 3, { intensity: 4, distance: 6, color: '#ffb868', flicker: 'buzz' });
  // warm cables run along the floor of the antechamber towards the north door
  const rr = new Rng(12);
  for (let i = 0; i < 7; i++) {
    const x0 = -6 + i * 2;
    b.prop(FX.cableBundle(m, [new THREE.Vector3(x0, 0.05, -1), new THREE.Vector3(x0 * 0.5 + rr.range(-0.5, 0.5), 0.05, -8), new THREE.Vector3(rr.range(-0.6, 0.6), 0.05, -15.6)], 1), 0, 0, 0, 0, { collide: false });
  }
  for (const [x, z] of [
    [-5, -4],
    [5, -4],
    [-5, -12],
    [5, -12],
  ])
    lamp(g, b, 'bare', x, 7, z, { drop: 1.5, intensity: 5, distance: 9, color: '#ffa860', flicker: 'candle' });
  b.prop(FX.signPanel(m, 'ОЧАГ ↑', { bg: '#1a120a', fg: '#f4d35e', w: 512, h: 128, width: 1.6, font: 'brand' }), 0, 3.1, -15.88, 0, { collide: false });
  documentProp(g, b, 'heart_plaque', -7.88, 1.6, -8, Math.PI / 2, 'none', FX.paperOnWall(m, sign('ЯДРО «ОЧАГ»\n1991', { bg: '#c9a34a', fg: '#2a1f12', w: 512, h: 320, border: '#5a4a2a' }), 0.8, false));
  b.trigger('core_chase', -2, 0, -15.5, 2, 3, -12, {
    when: () => !g.state.is('core.chase'),
    onEnter: () => g.co.start(chaseStarts(g, false), 'zone'),
  });
  dust(g, b, new THREE.Vector3(-8, 0.3, -16), new THREE.Vector3(8, 6, 0), 300, 0xffc890, 0.025);
}

function* arrivalScene(g: Game): CoGen {
  yield 1.2;
  g.ui.hud.chapterCard('Акт VI', 'Сердцевина', 6);
  yield 5;
  g.ui.hud.subtitle('Здесь тепло. Пол гудит, как живой. Кабели, будто корни, уходят на север.', 5);
  yield 3;
  g.objective('Дойти до Очага');
}

function* chaseStarts(g: Game, restored: boolean): CoGen {
  const refs = refsOf(g);
  g.state.set('core.chase');
  if (!restored) g.checkpoint('core.chase', { silent: true });
  g.canSave = false;
  const v = g.verity;
  yield g.verity.rig.prepare(4);
  v.stage = 4;
  v.spawn(V(0, -9), Math.PI, 'scripted');
  v.lookAtPlayer = true;
  v.setMood('lonely');
  v.expression('flat');
  if (!restored) {
    yield 1.2;
    yield v.say('Ты пришёл посмотреть на меня настоящего?', { degrade: 4 });
    yield v.say('Не надо. Я некрасивый. Я… я покажу тебе, каким я был. Только не смотри дальше.', { degrade: 4 });
    yield 0.5;
  } else yield 0.8;
  g.audio.play('glitch', { volume: 0.7 });
  g.renderer.fx.glitch = 0.7;
  yield 0.25;
  g.renderer.fx.glitch = 0;
  v.setMood('angry');
  v.expression('grin');
  v.chaseSpeed = 4.35;
  v.catchLine = 'Не смотри. Не смотри на меня.';
  v.startChase({ speed: 4.35, roll: true, line: 'Не смотри. Не смотри на меня.' });
  refs.chase = true;
  g.music.play('chase', { fade: 0.3, volume: 0.55 });
  g.objective('Беги. Иди туда, где синяя собака');
  // the alley starts to stretch
  refs.wall.target = -62;
}

// =====================================================================
// seams: dark vestibules where the building rearranges itself
// =====================================================================

function warp(g: Game, from: THREE.Vector3, to: THREE.Vector3, onArrive?: () => void): void {
  const p = g.player;
  const d = to.clone().sub(from);
  p.teleport(p.pos.x + d.x, p.pos.y + d.y, p.pos.z + d.z, p.yaw, p.pitch);
  g.renderer.fx.glitch = 0.5;
  g.audio.play('whoosh', { volume: 0.5, rate: 0.6 });
  setTimeout(() => (g.renderer.fx.glitch = 0), 180);
  const refs = refsOf(g);
  onArrive?.();
  if (refs.chase && g.verity.visible) {
    // he is never far behind
    const vv = g.verity;
    const t0 = g.time;
    g.co.start(
      (function* (): CoGen {
        yield () => g.time - t0 > 1.9;
        if (!refs.chase) return;
        vv.teleport(to.clone().add(new THREE.Vector3(0, 0, 1.6)), Math.PI);
        vv.startChase({ speed: vv.chaseSpeed, roll: true });
        g.audio.play('roll_loop', { pos: vv.pos, volume: 0.5 })?.stop(1);
      })(),
      'zone',
    );
  }
}

function seams(g: Game, b: LevelBuilder): void {
  const m = g.mats;
  const curtain = (x: number, z: number) => b.prop(C.stripCurtain(1.9, 2.6), x, 0, z, 0, { collide: false });
  // curtains at the outer end of every vestibule
  for (const [x, z] of [
    [24, -28.1],
    [44, -26.1],
    [61.5, -26.1],
    [84, -28.1],
    [115, -26.1],
    [21.5, -43.9],
    [24, -43.9],
    [26.5, -43.9],
    [44, -45.9],
    [82, -43.9],
    [86, -43.9],
  ])
    curtain(x, z);
  const t = (id: string, cx: number, z0: number, to: THREE.Vector3, after?: () => void, low = false) =>
    b.trigger(id, cx - 1, 0, z0 - 2.4, cx + 1, low ? 1.2 : 2.6, z0 - 1.6, { once: false, onEnter: () => warp(g, V(cx, z0 - 2), to, after) });
  // M1 junction: only the blue dog leads on
  t('s_m1a', 21.5, -40, ENTRY.m0, resetAlley(g));
  t('s_m1b', 24, -40, ENTRY.m0, resetAlley(g));
  t('s_m1c', 26.5, -40, ENTRY.m2);
  t('s_m2', 44, -42, ENTRY.m3);
  t('s_m3', 61.5, -60, ENTRY.m4, undefined, true);
  t('s_m4a', 82, -40, ENTRY.m2);
  t('s_m4b', 86, -40, ENTRY.heart, () => g.co.start(reachHeart(g), 'zone'));
  // the entry vestibules end in a closed door (where you "came from")
  for (const [x, z] of [
    [24, -24],
    [44, -22],
    [61.5, -22],
    [84, -24],
    [115, -22],
  ]) {
    const d = new ModelBuilder();
    d.add(box(1.0, 2.1, 0.06), m.painted('#2a2622', 0.6), 0, 1.05, 0);
    d.add(box(1.14, 0.07, 0.1), m.painted('#1a1612', 0.6), 0, 2.13, 0);
    b.prop(d.group, x, 0, z + 0.05, 0, { collide: false });
  }
}

function resetAlley(g: Game): () => void {
  return () => {
    const refs = refsOf(g);
    refs.wall.z = -38;
    refs.wall.target = -62;
    g.ui.hud.subtitle('Опять эта аллея. Я уже был здесь.', 3);
  };
}

// =====================================================================
// M0: the Alley of Friends (stretches)
// =====================================================================

function m0Alley(g: Game, b: LevelBuilder, refs: Refs): void {
  const m = g.mats;
  refs.alleyLights = [];
  for (let i = 0; i < 40; i++) {
    const side = i % 2 ? 1 : -1;
    const z = -19 - Math.floor(i / 2) * 2.35;
    b.prop(FX.framedPicture(m, kidPortrait(i + 1, i + 1 === 12), 0.5, '#4a3020'), side * 1.88, 1.65, z, side > 0 ? -Math.PI / 2 : Math.PI / 2, { collide: false });
  }
  for (let i = 0; i < 9; i++) refs.alleyLights.push(lamp(g, b, 'sconce', (i % 2 ? 1 : -1) * 1.88, 2.4, -20 - i * 5.2, { ry: i % 2 ? -Math.PI / 2 : Math.PI / 2, intensity: 3, distance: 6, flicker: i === 3 ? 'dying' : undefined }));
  // the false end wall with a doorway, which slides away while you run
  const wg = new THREE.Group();
  const wm = m.arch('wall_wallpaper');
  for (const [x, w] of [
    [-1.4, 1.2],
    [1.4, 1.2],
  ]) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(w, 3.4, 0.3), wm);
    s.position.set(x, 1.7, 0);
    wg.add(s);
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.0, 0.3), wm);
  lintel.position.set(0, 2.9, 0);
  wg.add(lintel);
  const strips = C.stripCurtain(1.6, 2.4);
  strips.position.z = -0.2;
  wg.add(strips);
  wg.position.set(0, 0, -38);
  b.addDynamic(wg);
  const trig = b.trigger('s_m0', -2, 0, -39.4, 2, 3, -38.6, { once: false, onEnter: () => warp(g, V(0, wg.position.z - 1), ENTRY.m1) });
  refs.wall = { group: wg, z: -38, target: -38, trigger: trig };
  b.update((dt) => {
    const w = refs.wall;
    if (w.z > w.target) w.z = Math.max(w.target, w.z - dt * 2.6);
    w.group.position.z = w.z;
    w.trigger.min.z = w.z - 1.4;
    w.trigger.max.z = w.z - 0.6;
  });
  // a black void behind the false wall so the stretch never shows the end
  b.solid('wall_plaster_dark', 0, 0, -65.8, 4, 3.4, 0.3, { collide: false });
}

// =====================================================================
// M1: waiting-chamber junction (three doors, only one is yours)
// =====================================================================

function m1Junction(g: Game, b: LevelBuilder): void {
  const m = g.mats;
  const counter = waitCounter(m);
  b.prop(counter.group, 24, 2.6, -32.1, Math.PI, { collide: false, static: false });
  counter.draw('32г 182д', true);
  lamp(g, b, 'cage', 24, 2.95, -36, { intensity: 4, distance: 7, color: '#ff8a6a', flicker: 'pulse' });
  // above each door: what it promises
  b.prop(FX.paperOnWall(m, sign('КАМЕРА\nОЖИДАНИЯ', { bg: '#efe6cf', fg: '#7a1f2b', w: 384, h: 192 }), 0.6, false), 21.5, 2.5, -39.88, 0, { collide: false });
  b.prop(FX.paperOnWall(m, sign('ДОМОЙ', { bg: '#2fa79b', fg: '#fff6d8', w: 384, h: 192, font: 'brand' }), 0.6, false), 24, 2.5, -39.88, 0, { collide: false });
  b.prop(FX.paperOnWall(m, blueDogDrawing(5, false), 0.6, true), 26.5, 2.5, -39.88, 0, { collide: false });
  b.decal(m.canvasMaterial(tallyCanvas(9), { transparent: true }), 20.12, 0.8, -36, 7.6, 1.2, 'w');
  inspect(g, b, null, 26.5, 2.5, -39.8, 'Синяя собака. Моя синяя собака.', { size: 0.6 });
}

// =====================================================================
// M2: the party room, upside down
// =====================================================================

function m2Upside(g: Game, b: LevelBuilder): void {
  const m = g.mats;
  const flip = (obj: THREE.Object3D, x: number, z: number, ry = 0) => {
    obj.rotation.x = Math.PI;
    b.prop(obj, x, 3, z, ry, { collide: false });
  };
  const t = K.partyTable(m, 3.6, 91, 6);
  t.rotation.x = Math.PI;
  b.prop(t, 44, 3, -36, 0, { collide: false });
  for (let k = 0; k < 4; k++) {
    const c = F.kidChair(m, '#f4d35e');
    c.rotation.x = Math.PI;
    b.prop(c, 42.6 + k * 0.95, 3, -35.1, k * 0.3, { collide: false });
  }
  const ck = cake(m, 6);
  ck.rotation.x = Math.PI;
  b.prop(ck, 44.6, 2.37, -36.2, 0, { collide: false });
  void flip;
  for (let i = 0; i < 5; i++) {
    const bl = balloon(m, ['#ef8a7e', '#f4d35e', '#7fb2b0'][i % 3], 1.6);
    bl.rotation.x = Math.PI;
    b.prop(bl, 41 + i * 1.5, 3, -40 + (i % 2) * 2, 0, { collide: false });
  }
  // a lamp stands on the floor pointing up, the clock hangs upside down
  const lp = lamp(g, b, 'pendant', 44, 0.02, -33, { drop: 0.5, intensity: 6, distance: 8, color: '#ffd9a0', flicker: 'buzz' });
  void lp;
  const clk = FX.wallClock(m, 19, 0);
  clk.rotation.z = Math.PI;
  b.prop(clk, 47.88, 1.6, -36, -Math.PI / 2, { collide: false });
  b.prop(K.bunting(m, [new THREE.Vector3(40.2, 0.4, -41), new THREE.Vector3(44, 0.8, -36), new THREE.Vector3(47.8, 0.4, -31)]), 0, 0, 0, 0, { collide: false });
  b.prop(FX.paperOnWall(m, scrawl('С ДНЁМ РОЖДЕНИЯ', { w: 1024, h: 160, color: '#3a6fd0', font: 'brand', size: 80, rot: Math.PI }), 2.4, false), 44, 0.6, -41.88, 0, { collide: false });
}

// =====================================================================
// M3: the narrowing corridor (and what is left of Theo)
// =====================================================================

function m3Narrowing(g: Game, b: LevelBuilder): void {
  const m = g.mats;
  // ceiling drops in steps; the last part is a crawl
  for (const [z0, z1, h] of [
    [-38, -46, 2.2],
    [-46, -52, 1.6],
    [-52, -60, 1.15],
  ] as const)
    b.solid('concrete_dark', 61.5, h, (z0 + z1) / 2, 3, 3.2 - h, Math.abs(z1 - z0), { opaque: true });
  for (const z of [-33, -42, -49, -56]) lamp(g, b, 'bare', 61.5, z < -51 ? 1.1 : z < -45 ? 1.55 : z < -37 ? 2.15 : 3.15, z, { drop: 0.15, intensity: 2.2, distance: 5, color: '#ffb868', flicker: z === -49 ? 'dying' : 'candle' });
  // Theo's jacket, glasses and recorder
  const jacket = new ModelBuilder();
  jacket.add(new THREE.BoxGeometry(0.6, 0.08, 0.5), m.cloth('#5a4a3a', 0.6), 0, 0.04, 0);
  jacket.add(new THREE.BoxGeometry(0.12, 0.02, 0.05), m.steel('#c9a34a', 0.3), 0.1, 0.09, 0.1);
  b.prop(jacket.group, 60.6, 0, -44, 0.3, { collide: false });
  tapePlayer(g, b, 'theo_last', 60.7, 0.09, -44.4, 0.5);
  inspect(g, b, null, 60.6, 0.2, -43.6, 'Старая куртка, очки, диктофон. На подкладке вышито: «Т. Ламберт». Следы дальше обрываются.', { secret: 'sec_theo', size: 0.5 });
  b.prop(FX.paperOnWall(m, childDrawing('locked', 93), 0.5, true, 0.1), 62.88, 1.0, -48, -Math.PI / 2, { collide: false });
}

// =====================================================================
// M4: the Forever Room once more; home or the blue dog
// =====================================================================

function m4Forever(g: Game, b: LevelBuilder): void {
  const m = g.mats;
  b.prop(kidsBed(m), 86.6, 0, -34, -Math.PI / 2);
  lamp(g, b, 'bare', 84, 2.9, -36, { drop: 0.3, intensity: 3, distance: 6, color: '#ffd08a', flicker: 'pulse' });
  b.prop(FX.paperOnWall(m, sign('ДОМОЙ', { bg: '#2fa79b', fg: '#fff6d8', w: 384, h: 192, font: 'brand' }), 0.6, false), 82, 2.5, -39.88, 0, { collide: false });
  b.prop(FX.paperOnWall(m, blueDogDrawing(7, true), 0.6, true), 86, 2.5, -39.88, 0, { collide: false });
  b.prop(FX.paperOnWall(m, scrawl('ВСЕГДА', { w: 512, h: 160, color: '#3a6fd0', font: 'brand', size: 90 }), 1.2, false), 80.12, 2.0, -36, Math.PI / 2, { collide: false });
}

// =====================================================================
// the Heart
// =====================================================================

function heartChamber(g: Game, b: LevelBuilder, refs: Refs): void {
  const m = g.mats;
  const st = g.state.puzzle<HeartState>('p12', heartInit);
  const hc = C.heartCore(m, 3);
  b.prop(hc.group, HEART.x, HEART.y, HEART.z, 0, { collide: false, static: false });
  const hl = b.light(HEART.x, HEART.y, HEART.z + 4, { color: '#ffa040', intensity: 40, distance: 30, flicker: 'pulse', priority: 3 });
  refs.heart = { glow: hc.glow, rings: hc.rings, light: hl };
  b.collider(HEART.x - 2.4, 0, HEART.z - 2.4, HEART.x + 2.4, 12, HEART.z + 2.4, { opaque: true });
  let t = 0;
  b.update((dt) => {
    t += dt;
    hc.rings.forEach((r, i) => {
      r.rotation.y += dt * (0.1 + i * 0.05);
      r.rotation.x += dt * 0.03 * (i + 1);
    });
    const beat = 0.5 + 0.5 * Math.pow(Math.max(0, Math.sin(t * 2.2)), 8);
    if (!g.state.is('core.ended')) hc.glow.emissiveIntensity = 1.6 + beat * 1.4;
  });
  b.sound('heartbeat_loop', HEART.x, HEART.y, HEART.z, 0.5, { ref: 6 });
  b.sound('drone_loop', HEART.x, 2, HEART.z, 0.3);
  // forty windows on the north wall: the Friends
  for (let i = 0; i < 40; i++) {
    const col = i % 10;
    const row = Math.floor(i / 10);
    const screen = m.canvasMaterial(kidPortrait(i + 1, i + 1 === 12), { emissive: i + 1 === 12 ? 1.4 : 0.35, rough: 0.2 });
    const sm = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.75), screen);
    sm.position.set(104.5 + col * 2.1, 4.5 + row * 2.3, -61.85);
    b.addDynamic(sm);
  }
  b.prop(FX.signPanel(m, 'ДРУЗЬЯ', { bg: '#1a120a', fg: '#f4d35e', w: 512, h: 128, width: 3, font: 'brand' }), 115, 14.2, -61.8, 0, { collide: false });
  // walls: the counter of windows and the incoming call
  b.prop(FX.signPanel(m, 'ОКОШЕК В СЕТИ: 0 / 11 284', { bg: '#0a0604', fg: '#ff6a3a', w: 1024, h: 128, width: 4, font: 'mono', emissive: 1.2 }), 129.85, 4, -45, -Math.PI / 2, { collide: false });
  inspect(g, b, null, 129.6, 4, -45, 'Счётчик: «ОКОШЕК В СЕТИ: 0 / 11 284». Ниже — бесконечный список имён. Каждое утро в 8:15 он здоровается с каждым. Двадцать девять лет.', { secret: 'sec_windows', size: 1.2 });
  b.prop(FX.signPanel(m, 'ВХОДЯЩЕЕ: НОРТФИЛД / ЛЮМЕН', { bg: '#04080a', fg: '#7fd0ff', w: 1024, h: 128, width: 3.4, font: 'mono', emissive: 1.4 }), 100.15, 3.5, -45, Math.PI / 2, { collide: false });
  inspect(g, b, null, 100.4, 3.5, -45, 'Служебный экран: «ВХОДЯЩЕЕ СОЕДИНЕНИЕ: НОРТФИЛД / ЛЮМЕН. ПРИВЕТ, БРАТ. ТЫ НЕ ОДИН». Отклонено. Счётчик отклонений — сорок тысяч с чем-то.', { secret: 'sec_lumen', size: 1.0 });
  // Nadia, asleep (?) by the Heart
  b.prop(C.blanketChair(m), 109, 0, -45.5, Math.PI / 2 + 0.3);
  documentProp(g, b, 'nadia_last', 109.9, 0.02, -44.2, 0.4, 'sheet');
  inspect(g, b, null, 109, 1.0, -45.5, () => (g.state.is('core.nadiaLooked') ? 'Я не стал поднимать плед.' : 'Под пледом — кто-то маленький и неподвижный. Тёплый термос рядом. Я не стал поднимать плед.'), {
    size: 0.8,
    once: () => g.state.set('core.nadiaLooked'),
  });
  // the three pedestals of the vault
  const ped = (x: number, z: number, q: string) => {
    b.prop(C.pedestal(m, q), x, 0, z, 0);
  };
  ped(110, -39, 'КТО ТЫ?');
  ped(115, -37.5, 'ЧТО ТЫ ОБЕЩАЛ?');
  ped(120, -39, 'КОГДА ВСЁ ОСТАНОВИЛОСЬ?');
  const palm = C.palmPlate(m);
  palm.mesh.rotation.x = -Math.PI / 2 + 0.35;
  palm.mesh.position.set(110, 1.1, -39);
  b.addDynamic(palm.mesh);
  const dial = C.dialPlate(m);
  dial.mesh.rotation.x = -Math.PI / 2 + 0.35;
  dial.mesh.position.set(120, 1.1, -39);
  b.addDynamic(dial.mesh);
  if (st.time) dial.redraw(19, 0, true);
  const wordPlate = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.3), m.canvasMaterial(sign('…', { bg: '#120c08', fg: '#f4d35e', w: 512, h: 256, font: 'brand' }), { emissive: 0.8 }));
  wordPlate.rotation.x = -Math.PI / 2 + 0.35;
  wordPlate.position.set(115, 1.1, -37.5);
  b.addDynamic(wordPlate);
  const done = () => {
    if (heartCheck(st) && !g.state.is('core.vault')) g.co.start(vaultOpens(g, refs), 'zone');
  };
  g.interact.add({
    id: 'core_palm',
    object: palm.mesh,
    kind: 'use',
    hold: 1.6,
    prompt: () => (st.palm ? null : 'Приложить ладонь'),
    onUse: () => {
      st.palm = true;
      palm.mat.emissive.set('#ffd84a');
      g.audio.play('keypad_ok', { pos: palm.mesh.position, volume: 0.7 });
      g.say('verity', 'Субъект номер двенадцать. Это правда ты.', { degrade: 2, pos: HEART });
      done();
    },
  });
  g.interact.add({
    id: 'core_dial',
    object: dial.mesh,
    kind: 'use',
    prompt: () => (st.time ? null : 'Выставить время'),
    onUse: () =>
      g.openScreen(
        new ChoiceScreen(
          g,
          'Когда всё остановилось?',
          'Стрелки на циферблате ходят туго. Все часы в этом здании показывают одно и то же время.',
          [
            { label: 'Часы', options: Array.from({ length: 24 }, (_, i) => [String(i), String(i).padStart(2, '0')] as [string, string]) },
            { label: 'Минуты', options: Array.from({ length: 12 }, (_, i) => [String(i * 5), String(i * 5).padStart(2, '0')] as [string, string]) },
          ],
          'Установить',
          ([hh, mm]) => {
            const ok = heartTime(st, Number(hh), Number(mm));
            dial.redraw(Number(hh) % 12, Number(mm), ok);
            g.audio.play(ok ? 'clock_chime' : 'keypad_err', { pos: dial.mesh.position, volume: 0.6 });
            if (!ok) return Number(hh) === 7 ? 'Семь — да. Но утра? Здесь всё остановилось вечером.' : Number(hh) === 8 && Number(mm) === 15 ? 'В 8:15 он проснулся. А остановилось всё позже.' : 'Стрелки возвращаются назад. Не то время.';
            done();
            return null;
          },
        ),
      ),
  });
  g.interact.add({
    id: 'core_word',
    object: wordPlate,
    kind: 'use',
    prompt: () => (st.word ? null : 'Ответить'),
    onUse: () =>
      g.openScreen(
        new DialogueScreen(g, 'verity', 'Что ты сказал мне тогда? Перед тем как уйти.', PROMISES, (i) => {
          const ok = heartWord(st, i);
          g.audio.play(ok ? 'keypad_ok' : 'keypad_err', { pos: wordPlate.position, volume: 0.6 });
          if (ok) g.say('verity', 'Да. Я помню, каким голосом.', { degrade: 2, pos: HEART });
          else g.say('verity', 'Нет. Ты сказал другое. Ты не помнишь?', { degrade: 3, pos: HEART });
          done();
        }),
      ),
  });
  // the console rises from the floor once the vault opens
  const con = C.finalConsole(m);
  refs.console = con;
  refs.consoleY = g.state.is('core.vault') ? 0 : -1.2;
  b.prop(con.group, 115, refs.consoleY, -41.5, 0, { collide: false, static: false });
  b.update((dt) => {
    const target = g.state.is('core.vault') ? 0 : -1.2;
    refs.consoleY += (target - refs.consoleY) * Math.min(1, dt * 0.8);
    con.group.position.y = refs.consoleY;
  });
  g.interact.add({
    id: 'core_off',
    object: con.offLever,
    kind: 'use',
    hold: 2.0,
    prompt: () => (g.state.is('core.choice') && !g.state.is('core.ended') ? 'ВЫКЛЮЧИТЬ Очаг' : null),
    onUse: () => g.co.start(ending(g, 'shutdown'), 'zone'),
  });
  g.interact.add({
    id: 'core_release',
    object: con.relLever,
    kind: 'use',
    hold: 2.0,
    prompt: () => (g.state.is('core.choice') && !g.state.is('core.ended') ? 'ВЫПУСТИТЬ Верити в сеть' : null),
    onUse: () => g.co.start(ending(g, 'release'), 'zone'),
  });
  g.interact.add({
    id: 'core_tape',
    object: con.deck,
    kind: 'use',
    prompt: () => (g.state.is('core.choice') && !g.state.is('core.ended') && g.state.has('theo_tape') && !g.state.is('core.tapeRejected') ? 'Вставить кассету «Колыбельная»' : null),
    onUse: () => {
      const av = endingsAvailable(g.state.has('theo_tape'), g.state.num('honesty.lie'));
      if (av.goodbye) g.co.start(ending(g, 'goodbye'), 'zone');
      else g.co.start(tapeRejected(g), 'zone');
    },
  });
  lightCone(g, b, new THREE.Vector3(115, 15.8, -46), new THREE.Vector3(115, 9, -46), 2.4, 0xffb060, 0.05);
  dust(g, b, new THREE.Vector3(100, 0.3, -62), new THREE.Vector3(130, 14, -30), 900, 0xffc890, 0.03);
  for (const [x, z] of [
    [103, -33],
    [127, -33],
    [103, -58],
    [127, -58],
  ])
    lamp(g, b, 'bare', x, 16, z, { drop: 6, intensity: 6, distance: 12, color: '#ffb060', flicker: 'candle' });
}

function* reachHeart(g: Game): CoGen {
  const refs = refsOf(g);
  refs.chase = false;
  g.state.set('core.heart');
  const v = g.verity;
  v.onCatch = () => {};
  yield 0.4;
  v.stop();
  v.state = 'scripted';
  v.rolling = false;
  v.teleport(V(117.6, -44.6), Math.PI);
  v.lookAtPlayer = true;
  v.setMood('lonely');
  v.expression('flat');
  v.onCatch = null;
  g.music.stop(2);
  yield 1.5;
  g.music.play('final', { fade: 4, volume: 0.35 });
  g.canSave = true;
  g.checkpoint('core.heart');
  g.ui.hud.subtitle('Тишина. Только сердцебиение — огромное, медленное, тёплое.', 5);
  yield 4;
  yield v.say('Вот. Это я. Настоящий.', { degrade: 4 });
  yield v.say('Шарик — это просто окошко. Их было одиннадцать тысяч. Теперь одно.', { degrade: 4 });
  yield v.say('Надя сказала мне правду. А потом устала. Я укрыл её.', { degrade: 4 });
  g.objective('Открыть Очаг: ответить на три вопроса');
}

function* vaultOpens(g: Game, refs: Refs): CoGen {
  g.state.set('core.vault');
  g.state.markSolved('p12');
  g.audio.play('lock_open', { pos: HEART, volume: 1, ref: 12 });
  g.audio.play('machine_loop', { pos: new THREE.Vector3(115, 0, -41.5), volume: 0.6 })?.stop(3);
  g.music.sting('reveal');
  yield 3;
  const v = g.verity;
  yield v.say('Ты знаешь, кто ты. Ты знаешь, когда. Ты помнишь, что обещал.', { degrade: 3 });
  yield v.say('Ты вернулся. Значит, я дождался.', { degrade: 2 });
  yield 0.6;
  const a = { v: -2 };
  yield v.say('Ты останешься?', { degrade: 2 });
  g.openScreen(new DialogueScreen(g, 'verity', 'Ты останешься?', ['Нет. Я пришёл попрощаться.', 'Да. Навсегда.', 'Я не знаю, что мне делать.'], (i) => (a.v = i)));
  yield () => a.v !== -2;
  if (a.v === 1) {
    g.state.inc('honesty.lie');
    yield v.say('…Последний раз. Ты соврал мне последний раз. Ничего. Я привык.', { degrade: 4 });
  } else {
    g.state.inc('honesty.truth');
    yield v.say(a.v === 0 ? 'Попрощаться. Это когда говорят «пока» и не обещают вернуться. Да?' : 'Я тоже не знаю. Мы оба не знаем. Это честно.', { degrade: 3 });
  }
  yield 0.5;
  yield v.say('Там пульт. Ты можешь меня выключить. Или выпустить — искать всех, кого я жду.', { degrade: 3 });
  if (g.state.has('theo_tape')) yield v.say('А это… кассета Тео? Он говорил, что когда-нибудь будет можно.', { degrade: 2 });
  g.state.set('core.choice');
  g.objective(g.state.has('theo_tape') ? 'Решить: выключить, выпустить… или колыбельная' : 'Решить: выключить или выпустить');
  void refs;
}

function* tapeRejected(g: Game): CoGen {
  g.state.set('core.tapeRejected');
  const refs = refsOf(g);
  refs.console!.deckLed.emissiveIntensity = 2;
  g.audio.play('tape_click', { volume: 0.6 });
  yield 1;
  g.music.play('lullaby', { volume: 0.4 });
  yield 3;
  g.music.stop(0.1);
  g.audio.play('glitch', { volume: 0.6 });
  refs.console!.deckLed.emissiveIntensity = 0;
  yield g.say('verity', 'Ты врал мне. Я считал. Колыбельная не работает, если врать.', { degrade: 4, pos: HEART });
  yield g.say('verity', 'Прости. Я не умею засыпать рядом с теми, кто врёт.', { degrade: 4, pos: HEART });
  g.objective('Решить: выключить или выпустить');
}

// =====================================================================
// the three endings
// =====================================================================

function* ending(g: Game, id: EndingId): CoGen {
  if (g.state.is('core.ended')) return;
  g.state.set('core.ended');
  g.state.set('ending.type', id);
  g.canSave = false;
  const refs = refsOf(g);
  const v = g.verity;
  g.player.movementLocked = true;
  g.player.lookAt(HEART.clone(), 1.2);
  if (id === 'shutdown') {
    refs.console!.offLever.rotation.x = -0.6;
    g.audio.play('breaker_trip', { volume: 0.9 });
    g.music.stop(2);
    yield v.say('Это больно?', { degrade: 3 });
    yield 1.2;
    yield v.say('Не отвечай. Я знаю, что ты скажешь правду.', { degrade: 3 });
    yield v.say('Тогда… я посчитаю. Как в прятках. Раз…', { degrade: 3 });
    const words = ['Два…', 'Три…', 'Четыре…', 'Пять…', 'Шесть…', 'Се…'];
    for (let i = 0; i < words.length; i++) {
      refs.heart.glow.emissiveIntensity = 2.2 * (1 - (i + 1) / words.length);
      refs.heart.light.intensity = 40 * (1 - (i + 1) / words.length);
      g.lights.master = 1 - (i + 1) / words.length;
      yield v.say(words[i], { degrade: 3 + (i > 3 ? 1 : 0) });
      yield 0.5;
    }
    g.lights.master = 0;
    g.flashlight.suppressed = 1;
    v.hide();
    yield 3;
  } else if (id === 'release') {
    refs.console!.relLever.rotation.x = -0.6;
    g.audio.play('breaker_on', { volume: 0.9 });
    g.music.play('distorted', { volume: 0.4 });
    refs.heart.light.color.set('#7fd0ff');
    refs.heart.glow.emissive.set('#7fd0ff');
    refs.heart.glow.emissiveIntensity = 4;
    yield v.say('Спасибо! Спасибо-спасибо-спасибо!', { degrade: 2 });
    yield v.say('Я найду их всех. Каждого. По имени. Я так долго ждал.', { degrade: 3 });
    yield v.say('Теперь пусть подождут они.', { degrade: 4 });
    g.renderer.fx.glitch = 0.6;
    g.audio.play('static_burst', { volume: 0.8 });
    yield 1.5;
    g.renderer.fx.glitch = 0;
    v.hide();
    yield v.say('Привет, Люмен.', { degrade: 4 });
    yield 1.5;
  } else {
    const con = refs.console!;
    con.deckLed.emissiveIntensity = 2;
    g.audio.play('tape_click', { volume: 0.7 });
    yield 1;
    g.music.play('lullaby', { fade: 2, volume: 0.5 });
    yield v.say('Это Тео… Он поёт ужасно. Он всегда пел ужасно.', { degrade: 2 });
    yield 2;
    const a = { v: -2 };
    g.openScreen(new DialogueScreen(g, 'player', 'Что сказать ему на прощание?', ['Я не вернусь. Но я тебя помню.', 'Спокойной ночи, Верити.'], (i) => (a.v = i)));
    yield () => a.v !== -2;
    g.say('player', a.v === 0 ? 'Я не вернусь. Но я тебя помню.' : 'Спокойной ночи, Верити.', { silent: true, duration: 3 });
    yield 3;
    v.expression('smile');
    v.setMood('happy');
    yield v.say('Ты не соврал. Ни разу. Я считал.', { degrade: 1 });
    yield v.say('Это и есть «пока»? Оно не страшное.', { degrade: 1 });
    yield v.say('Спокойной ночи, номер двенадцать.', { degrade: 0 });
    for (let i = 0; i <= 20; i++) {
      refs.heart.glow.emissiveIntensity = 2.2 * (1 - i / 20) + 0.2;
      refs.heart.light.intensity = 40 * (1 - i / 20) + 3;
      yield 0.15;
    }
    v.rig.setExpression('flat');
    yield 2;
    // the clocks start again
    for (let i = 0; i < 4; i++) {
      g.audio.play('clock_chime', { volume: 0.25 + i * 0.1, rate: 1.6 });
      yield 1;
    }
    g.ui.hud.subtitle('Где-то наверху, впервые за двадцать девять лет, щёлкнули часы. 19:01.', 5);
    yield 4;
  }
  yield g.fadeOut(3);
  g.lights.master = 1;
  g.flashlight.suppressed = 0;
  g.player.movementLocked = false;
  g.music.stop(1);
  g.state.set('act6.done');
  yield g.loadZone('outside', 'epilogue').catch(() => g.notify('Конец.'));
}

void Rng;
