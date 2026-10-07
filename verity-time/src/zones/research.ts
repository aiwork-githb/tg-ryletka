import * as THREE from 'three';
import type { ZoneDef } from './types';
import type { Game } from '../Game';
import type { LevelBuilder } from '../world/LevelBuilder';
import type { CoGen } from '../core/Coroutines';
import type { VLight } from '../render/LightManager';
import { Door, lamp, documentProp, tapePlayer, inspect, hideLocker, hideSpot } from '../world/entities';
import * as F from '../models/furniture';
import * as FX from '../models/fixtures';
import * as R from '../models/research';
import * as I from '../models/industry';
import { theaterSeat, stroller, balloon } from '../models/lobby';
import { memoryModule, filmReel, plushVerity, photoProp } from '../models/items';
import { canvas, childDrawing, photo, poster, scrawl, screenCanvas, sign, stain } from '../assets/Signage';
import { TerminalScreen, type TerminalApi, type TerminalProgram } from '../ui/screens/Terminal';
import { KeypadScreen } from '../ui/screens/Keypad';
import { ChoiceScreen } from '../ui/screens/Choice';
import { playFilm, kr07Shots } from '../world/film';
import { DOCS } from '../narrative/registry';
import { dust, lightCone } from '../world/vfx';
import { box, cyl, ModelBuilder } from '../world/geom';
import { Rng } from '../assets/noise';

interface Refs {
  haleDoor: Door;
  archiveDoor: Door;
  bridgeDoor: Door;
  screen: { canvas: HTMLCanvasElement; tex: THREE.CanvasTexture; pos: THREE.Vector3; mat: THREE.MeshStandardMaterial };
  reels: THREE.Object3D[];
  beam: VLight;
  beamCone: THREE.Mesh;
  projRunning: boolean;
  plush: THREE.Object3D;
  memObj: THREE.Object3D;
  memSmiley: THREE.MeshStandardMaterial;
  ch2Counter: (text: string, lit?: boolean) => void;
}


export const research: ZoneDef = {
  id: 'research',
  name: 'Отдел Гармонии',
  chapter: 'Акт III. Отдел Гармонии',
  materials: [
    'linoleum_green', 'linoleum_beige', 'wall_plaster_lab', 'wall_plaster_mint', 'wall_plaster_dark', 'ceiling_tiles', 'ceiling_tiles_clean', 'rubber',
    'padded_cream', 'padded_blue', 'playmat', 'wall_wallpaper_kids', 'wood_panel', 'wood_floor', 'wood_dark', 'floor_carpet_blue', 'tile_floor_dark', 'metal_white',
    'metal_dark', 'diamond_plate', 'grate', 'concrete', 'concrete_dark', 'floor_checker', 'glass_dirty', 'tile_white', 'fabric_red',
  ],
  nav: { minX: -21, minZ: -55, maxX: 21, maxZ: 12, probeY: 2.2 },
  build(g, b) {
    const env = b.zone.env;
    env.fogColor.set(0x0b0d0e);
    env.fogDensity = 0.05;
    env.ambient.set(0x506068);
    env.ambientIntensity = 0.06;
    env.hemiSky.set(0x8a9aa0);
    env.hemiGround.set(0x1a1814);
    env.hemiIntensity = 0.12;
    env.reverb = 'room';
    env.ambience = ['hum_loop', 'vent_loop'];
    env.envMap = 'clinical';
    env.envIntensity = 0.3;

    rooms(b);
    const refs = {} as Refs;
    (b.zone as any).refs = refs;
    corridors(g, b);
    liftLobby(g, b);
    friendship(g, b, refs);
    booth(g, b, refs);
    chambers(g, b, refs);
    control(g, b, refs);
    copyRoom(g, b);
    haleOffice(g, b, refs);
    serverRoom(g, b, refs);
    archive(g, b, refs);
    projection(g, b, refs);
    lounge(g, b);
    bridge(g, b, refs);
    directorEvents(g);

    dust(g, b, new THREE.Vector3(-20, 0.3, -44), new THREE.Vector3(20, 3, 0), 900, 0xeef4ff, 0.018);
    dust(g, b, new THREE.Vector3(6, 0.3, -40), new THREE.Vector3(16, 3.2, -22), 300, 0xfff2dc, 0.022);

    b.spawn('start', 0, 0, 9.8, 0);
    b.spawn('lobby', 0, 0, 3, 0);
    b.spawn('archive', 11, 0, -20, 0);
    b.spawn('projection', 1, 0, -42, Math.PI);
    b.spawn('bridge', -18, 0, -46, 0);
    (b.zone as any).safe = new THREE.Vector3(0, 0, 3);
  },
  onEnter(g, spawn, restored) {
    if (restored) return;
    if (spawn === 'start' && !g.state.is('research.entered')) {
      g.state.set('research.entered');
      g.co.start(arrival(g), 'zone');
    }
  },
};

// =====================================================================
// layout
// =====================================================================

const LAB = { floor: 'linoleum_green', wall: 'wall_plaster_lab', ceil: 'ceiling_tiles', baseboard: 'rubber' };
const COR = { floor: 'linoleum_beige', wall: 'wall_plaster_lab', ceil: 'ceiling_tiles', baseboard: 'rubber', wainscot: { mat: 'wall_plaster_mint', height: 1.1 } };
const CHW = 10 / 3;

function rooms(b: LevelBuilder): void {
  b.room('liftcar', { x: -1.8, z: 8, w: 3.6, d: 3.6, h: 3.1, floor: 'diamond_plate', wall: 'metal_dark', ceil: 'metal_dark', baseboard: null });
  b.room('liftlobby', { x: -4, z: 0, w: 8, d: 8, h: 3.2, ...COR });
  b.connect('liftlobby', 'liftcar', 0, 3.2, 2.8);
  b.room('corA', { x: -20, z: -4, w: 40, d: 4, h: 3, ...COR });
  b.connect('liftlobby', 'corA', 0, 2.4, 2.6);
  b.room('corB', { x: -20, z: -44, w: 4, d: 40, h: 3, ...COR });
  b.room('corC', { x: 16, z: -44, w: 4, d: 40, h: 3, ...COR });
  b.room('corD', { x: -16, z: -44, w: 32, d: 4, h: 3, ...COR });
  b.room('corE', { x: -16, z: -22, w: 32, d: 4, h: 3, ...COR });
  b.connect('corB', 'corA', -18, 3.8, 3);
  b.connect('corC', 'corA', 18, 3.8, 3);
  b.connect('corB', 'corD', -42, 3.8, 3);
  b.connect('corD', 'corC', -42, 3.8, 3);
  b.connect('corB', 'corE', -20, 3.8, 3);
  b.connect('corE', 'corC', -20, 3.8, 3);

  b.room('friend', { x: -16, z: -18, w: 14, d: 14, h: 3.2, floor: 'playmat', wall: 'wall_wallpaper_kids', ceil: 'ceiling_tiles_clean', baseboard: 'wood_dark' });
  b.connect('friend', 'corA', -9, 1.1, 2.2);
  b.room('booth', { x: -2, z: -12, w: 8, d: 8, h: 3, floor: 'floor_carpet_blue', wall: 'wall_plaster_dark', ceil: 'ceiling_tiles', baseboard: 'rubber' });
  b.connect('booth', 'corA', 2, 1.1, 2.2);
  b.connect('friend', 'booth', -8, 3, 1.2, 1.0); // one-way mirror
  b.room('copy', { x: -2, z: -18, w: 8, d: 6, h: 3, ...LAB, floor: 'linoleum_beige' });
  b.connect('copy', 'corE', 2, 1.1, 2.2);
  for (let i = 0; i < 3; i++) {
    b.room('ch' + i, { x: 6 + i * CHW, z: -10, w: CHW, d: 6, h: 2.8, floor: 'linoleum_green', wall: 'padded_cream', ceil: 'ceiling_tiles_clean', baseboard: null });
    b.connect('ch' + i, 'corA', 6 + (i + 0.5) * CHW, 1.0, 2.2);
  }
  b.room('control', { x: 6, z: -18, w: 10, d: 8, h: 3, ...LAB });
  for (let i = 0; i < 3; i++) b.connect('ch' + i, 'control', 6 + (i + 0.5) * CHW, 1.2, 0.5, 1.4);
  b.connect('control', 'corE', 9, 1.1, 2.2);

  b.room('hale', { x: -16, z: -34, w: 12, d: 12, h: 3.2, floor: 'wood_floor', wall: 'wood_panel', ceil: 'ceiling_tiles', baseboard: 'wood_dark' });
  b.connect('hale', 'corE', -10, 1.1, 2.2);
  b.room('server', { x: -4, z: -34, w: 10, d: 12, h: 3, floor: 'tile_floor_dark', wall: 'metal_white', ceil: 'ceiling_tiles_clean', baseboard: 'rubber' });
  b.connect('server', 'corE', 1, 1.1, 2.2);
  b.room('archive', { x: 6, z: -40, w: 10, d: 18, h: 3.4, floor: 'concrete', wall: 'wall_plaster_dark', ceil: 'concrete_dark', baseboard: null });
  b.connect('archive', 'corE', 11, 1.5, 2.3);
  b.room('lounge', { x: -16, z: -40, w: 12, d: 6, h: 3, ...LAB, floor: 'linoleum_beige', wall: 'wall_plaster_mint' });
  b.connect('lounge', 'corD', -10, 1.1, 2.2);
  b.room('projection', { x: -4, z: -40, w: 10, d: 6, h: 3.2, floor: 'floor_carpet_blue', wall: 'wall_plaster_dark', ceil: 'wall_plaster_dark', baseboard: 'wood_dark', wainscot: { mat: 'fabric_red', height: 1.2, rail: 'wood_dark' } });
  b.connect('projection', 'corD', 4.5, 1.1, 2.2);
  b.room('bridge', { x: -20, z: -54, w: 4, d: 10, h: 3, floor: 'floor_checker', wall: 'wall_wallpaper_kids', ceil: 'ceiling_tiles', baseboard: 'wood_dark' });
  b.connect('bridge', 'corB', -18, 1.5, 2.3);
}

// =====================================================================
// corridors
// =====================================================================

function corridors(g: Game, b: LevelBuilder): void {
  const m = g.mats;
  // fluorescent tubes: a third dead, a few dying
  const tubes: Array<[number, number, 'none' | 'buzz' | 'dying' | 'off']> = [
    [-16, -2, 'buzz'],
    [-8, -2, 'off'],
    [0, -2, 'none'],
    [8, -2, 'dying'],
    [16, -2, 'none'],
    [-18, -11, 'none'],
    [-18, -27, 'off'],
    [-18, -35, 'dying'],
    [18, -11, 'off'],
    [18, -27, 'buzz'],
    [18, -35, 'none'],
    [-10, -42, 'none'],
    [-1, -42, 'off'],
    [8, -42, 'buzz'],
    [-11, -20, 'dying'],
    [-2, -20, 'none'],
    [8, -20, 'off'],
  ];
  for (const [x, z, f] of tubes) {
    const along = Math.abs(x) >= 17 ? 0 : Math.PI / 2;
    lamp(g, b, 'troffer', x, 3, z, { ry: along === 0 ? Math.PI / 2 : 0, intensity: 9, distance: 7.5, color: '#e6f0ff', flicker: f === 'off' ? undefined : f, on: f !== 'off' });
  }
  lamp(g, b, 'exit', 0, 2.55, -0.12, { ry: Math.PI });
  lamp(g, b, 'emergency', -19.88, 2.5, -42, { ry: Math.PI / 2, intensity: 3, distance: 5 });
  lamp(g, b, 'emergency', 19.88, 2.5, -42, { ry: -Math.PI / 2, intensity: 3, distance: 5 });

  // floor guide lines for children: yellow to the Friendship room, blue to the chambers
  const yl = new THREE.MeshStandardMaterial({ color: 0xe0b23a, roughness: 0.6, transparent: true, opacity: 0.7, polygonOffset: true, polygonOffsetFactor: -2 });
  const bl = new THREE.MeshStandardMaterial({ color: 0x3a6fd0, roughness: 0.6, transparent: true, opacity: 0.6, polygonOffset: true, polygonOffsetFactor: -2 });
  b.decal(yl, -4.5, 0.004, -2.4, 9, 0.12, 'up');
  b.decal(yl, -9, 0.004, -3.2, 0.12, 1.6, 'up');
  b.decal(bl, 6, 0.004, -1.6, 12, 0.12, 'up');
  b.decal(bl, 11, 0.004, -2.8, 0.12, 2.4, 'up');
  // footprints of small shoes along the yellow line (old, ground into the lino)
  const fp = m.canvasMaterial(stain('footprints', 41), { transparent: true, rough: 0.5 });
  b.decal(fp, -5, 0.005, -2.2, 3, 0.6, 'up', { rot: 0 });
  for (let i = 0; i < 12; i++) {
    const r = new Rng(500 + i);
    const x = r.range(-19, 19);
    const z = r.next() < 0.5 ? r.range(-3.6, -0.4) : r.range(-21.6, -18.4);
    b.decal(m.canvasMaterial(stain(i % 3 ? 'water' : 'scuff', 500 + i), { transparent: true, rough: 0.3 }), x, 0.004, z, r.range(0.8, 2), r.range(0.6, 1.6), 'up', { rot: r.range(0, 6) });
  }
  // posters & drawings
  const pos: Array<[Parameters<typeof poster>[0], number, number, number, number]> = [
    ['harmony', -14, 1.7, -0.12, Math.PI],
    ['quiet', 12, 1.7, -0.12, Math.PI],
    ['staff', -19.88, 1.7, -30, Math.PI / 2],
    ['truth', 19.88, 1.7, -30, -Math.PI / 2],
    ['smile', -6, 1.7, -21.88, 0],
    ['friend', 6, 1.7, -40.12, Math.PI],
  ];
  pos.forEach(([k, x, y, z, ry], i) => b.prop(FX.paperOnWall(m, poster(k, 512, 724, 0.6, 140 + i), 0.75), x, y, z, ry, { collide: false }));
  const kids: Array<[Parameters<typeof childDrawing>[0], number, number, number, number]> = [
    ['many_friends', -12.2, 1.25, -3.88, 0],
    ['verity_me', -10.8, 1.1, -3.88, 0],
    ['house', -7.2, 1.2, -3.88, 0],
    ['clock', 4.4, 1.15, -3.88, 0],
  ];
  kids.forEach(([k, x, y, z, ry], i) => b.prop(FX.paperOnWall(m, childDrawing(k, 70 + i), 0.5, true, 0.1), x, y, z, ry, { collide: false }));
  b.prop(FX.paperOnWall(m, R.blueDogDrawing(3, false), 0.5, true, 0.15), -6, 1.2, -3.88, 0, { collide: false });

  // dressing
  for (const [x, z, ry] of [
    [-12, -0.45, Math.PI],
    [10, -0.45, Math.PI],
    [-19.5, -16, Math.PI / 2],
    [19.5, -31, -Math.PI / 2],
  ] as const)
    b.prop(F.bench(m, 1.6, '#4e6b6f'), x, 0, z, ry);
  b.prop(F.waterCooler(m), 19.6, 0, -14, -Math.PI / 2);
  b.prop(FX.fireCabinet(m), -19.88, 1.2, -24, Math.PI / 2, { collide: false });
  b.prop(FX.fireCabinet(m), 15.88, 1.2, -42.6, -Math.PI / 2, { collide: false });
  for (const [x, z] of [
    [-12, -0.15],
    [4, -0.15],
    [14, -0.15],
  ])
    b.prop(FX.radiator(m, 1.0), x, 0.25, z + 0.0, Math.PI, { collide: false });
  for (const [x, y, z, ry] of [
    [-19.7, 2.7, -3.7, Math.PI * 0.75],
    [19.7, 2.7, -3.7, -Math.PI * 0.75],
    [-15.7, 2.7, -43.7, -Math.PI * 0.25],
    [15.7, 2.7, -21.7, Math.PI * 0.25],
  ])
    b.prop(FX.cctv(m), x, y, z, ry, { collide: false });
  b.prop(stroller(m), -19.2, 0, -37, 0.5);
  b.prop(plushVerity(m, 0.5, '#f4d35e', 0.6), -19.3, 0.38, -37.1, 0.4, { collide: false });
  b.prop(FX.cableBundle(m, [new THREE.Vector3(-19.8, 2.85, -1), new THREE.Vector3(-19.8, 2.85, -43)], 3), 0, 0, 0, 0, { collide: false });
  b.prop(FX.cableBundle(m, [new THREE.Vector3(-19, 2.85, -0.2), new THREE.Vector3(19, 2.85, -0.2)], 2), 0, 0, 0, 0, { collide: false });
  // room signs at the corridor junctions
  b.prop(FX.signPanel(m, '← КОМНАТА ДРУЖБЫ · КАМЕРЫ →', { bg: '#22313a', fg: '#e8e2d0', w: 1024, h: 96, width: 2.4 }), 0, 2.55, -3.88, 0, { collide: false });
  b.prop(FX.signPanel(m, 'АРХИВ · СЕРВЕРНАЯ · КАБИНЕТЫ', { bg: '#22313a', fg: '#e8e2d0', w: 1024, h: 96, width: 2.0 }), -17.6, 2.55, -18.1, 0, { collide: false });
  b.prop(FX.signPanel(m, 'ПРОЕКЦИОННАЯ · КОМНАТА ОТДЫХА', { bg: '#22313a', fg: '#e8e2d0', w: 1024, h: 96, width: 2.0 }), 17.6, 2.55, -39.9, 0, { collide: false });
  b.sound('buzz_loop', 8, 2.8, -2, 0.12);
  b.sound('buzz_loop', -18, 2.8, -35, 0.12);
  b.sound('vent_loop', 0, 2.9, -42, 0.18);
}

// =====================================================================
// lift lobby: arrival
// =====================================================================

function liftLobby(g: Game, b: LevelBuilder): void {
  const m = g.mats;
  const lift = I.freightLift(m);
  lift.gate.position.y = 2.6;
  b.prop(lift.group, 0, -0.11, 9.8, Math.PI, { collide: false });
  lamp(g, b, 'cage', 0, 3.05, 9.8, { intensity: 4, distance: 5, flicker: 'buzz' });
  lamp(g, b, 'troffer', 0, 3.2, 4, { intensity: 9, distance: 8, flicker: 'buzz', color: '#e6f0ff' });
  b.prop(FX.framedPicture(m, R.directoryCanvas(), 1.5, '#2a2e31'), -3.88, 1.6, 4, Math.PI / 2, { collide: false });
  b.prop(FX.signPanel(m, 'ОТДЕЛ ГАРМОНИИ', { bg: '#2f5d62', fg: '#f6e7c1', w: 1024, h: 128, width: 2.6, font: 'brand' }), 0, 2.85, 0.12, 0, { collide: false });
  b.prop(FX.wallClock(m, 19, 0), 3.88, 2.4, 4, -Math.PI / 2, { collide: false });
  b.prop(F.bench(m, 1.8, '#4e6b6f'), 3.45, 0, 2.2, -Math.PI / 2);
  b.prop(F.plantPot(m, true), -3.4, 0, 0.6, 0);
  b.prop(F.trashBin(m), 3.5, 0, 6.5, 0);
  b.prop(FX.paperOnWall(m, poster('harmony', 512, 724, 0.4, 7), 0.7), 3.88, 1.5, 6.4, -Math.PI / 2, { collide: false });
  inspect(g, b, null, -3.7, 1.6, 4, 'Указатель отдела. Строчку «Переход → Игровая» заклеили бумагой: «ЗАКРЫТО. НЕ ХОДИТЬ.»', { size: 1.2 });
  // the lift panel is dead now
  inspect(g, b, null, 1.75, 1.3, 8.6, 'Кнопка вызова не горит. Обратно наверх лифт уже не поедет.', { prompt: 'Вызвать лифт' });
}

function* arrival(g: Game): CoGen {
  yield 1.2;
  g.ui.hud.chapterCard('Акт III', 'Отдел Гармонии', 6);
  yield 5;
  g.audio.play('static_burst', { volume: 0.35 });
  yield 0.6;
  yield g.say('verity', 'Здесь все были очень заняты. Они всё время что-то записывали.', { degrade: 1 });
  yield g.say('verity', 'Про меня.', { degrade: 1 });
  yield 1.5;
  g.objective('Осмотреть Отдел Гармонии');
}

// =====================================================================
// Friendship room + one-way mirror
// =====================================================================

function friendship(g: Game, b: LevelBuilder, refs: Refs): void {
  const m = g.mats;
  new Door(g, b, { id: 'r_friend', x: -9, z: -4, axis: 'x', style: 'kids', color: '#7fb2b0', label: 'КОМНАТА ДРУЖБЫ' });
  b.trigger('friend_in', -15.5, 0, -17.5, -2.5, 2, -5, { onEnter: () => g.state.set('research.friendVisited') });
  // table, chairs, Verity's cradle
  b.prop(F.kidTable(m, 1.2, 0.8, '#f4d35e'), -9, 0, -11, 0);
  b.prop(F.kidChair(m, '#ef8a7e'), -9, 0, -10.1, Math.PI);
  b.prop(F.kidChair(m, '#7fb2b0'), -10.1, 0, -11.2, Math.PI / 2 + 0.3);
  b.prop(R.cradle(m), -7.6, 0, -11, -Math.PI / 2);
  // a worn plush Verity sits on the table, facing the cradle; later it faces the mirror
  const plush = plushVerity(m, 0.55, '#f4d35e', 0.5);
  b.prop(plush, -9.2, 0.55, -11.1, -Math.PI / 2, { collide: false, static: false });
  refs.plush = plush;
  if (g.state.is('research.plushTurned')) plush.rotation.y = Math.PI / 2;
  // crayons & paper on the table
  const crayons = new ModelBuilder();
  ['#2b5fd9', '#2b5fd9', '#e67e22', '#27ae60', '#c0392b'].forEach((c, i) => crayons.add(cyl(0.006, 0.006, 0.09, 6), m.plastic(c, 0.4), -0.1 + i * 0.03, 0.006, (i % 2) * 0.03, 0, 0.4 * i, Math.PI / 2));
  crayons.add(box(0.3, 0.002, 0.21), m.flat('#f7f2e6', 1, 0), 0.12, 0.001, 0.05, 0, 0.2, 0);
  b.prop(crayons.group, -9.1, 0.53, -11.4, 0, { collide: false });
  inspect(g, b, null, -9.0, 0.6, -11.3, 'Восковые мелки. Синий стёрт почти до конца. Остальные — как новые.', { size: 0.4 });
  // toy shelves along the west wall
  for (const z of [-15.5, -12.5]) {
    b.prop(F.shelf(m, 2.2, 1.6, 0.45, 3, '#e8d5b0'), -15.6, 0, z, Math.PI / 2);
  }
  const r = new Rng(77);
  for (let i = 0; i < 10; i++) {
    const z = -16.4 + i * 0.6;
    const y = [0.02, 0.55, 1.08][i % 3];
    if (i % 4 === 1) b.prop(plushVerity(m, 0.35, r.pick(['#f4d35e', '#ef8a7e', '#7fb2b0']), 0.6), -15.6, y + 0.12, z, Math.PI / 2, { collide: false });
    else {
      const bl = new ModelBuilder();
      for (let k = 0; k < 3; k++) bl.add(box(0.12, 0.12, 0.12), m.plastic(r.pick(['#c0392b', '#2980b9', '#f1c40f', '#27ae60']), 0.4), r.range(-0.1, 0.1), 0.06 + k * 0.12, r.range(-0.05, 0.05), 0, r.range(0, 1), 0);
      b.prop(bl.group, -15.6, y, z, 0, { collide: false });
    }
  }
  // the rest of the playroom: bean bags, a tent, a chest; a rug under the table
  const rug = m.canvasMaterial(roundRug(), { transparent: true, rough: 0.95 });
  b.decal(rug, -9, 0.008, -11, 3.6, 3.6, 'up');
  b.prop(R.beanBag(m, '#ef8a7e', 1), -13.6, 0, -6.4, 0);
  b.prop(R.beanBag(m, '#7fb2b0', 2), -12.4, 0, -5.6, 0.6);
  b.prop(R.beanBag(m, '#f4d35e', 3), -4.2, 0, -15.6, 0);
  b.prop(R.playTent(m), -13.4, 0, -16.2, 0.3);
  b.prop(R.toyChest(m), -6.0, 0, -17.4, 0);
  b.prop(balloon(m, '#ef8a7e', 1.0, true), -9.6, 0, -10.4, 0, { collide: false });
  b.prop(balloon(m, '#7fb2b0', 0.8, true), -8.4, 0, -10.2, 0, { collide: false });
  b.prop(FX.wallClock(m, 19, 0), -15.88, 2.4, -11, Math.PI / 2, { collide: false, scale: 1.4 });
  // drawings
  b.prop(FX.framedPicture(m, R.blueDogDrawing(1), 0.7, '#f4d35e'), -4.4, 1.5, -17.88, 0, { collide: false });
  inspect(g, b, null, -4.4, 1.5, -17.8, 'Синяя собака. «Для Верити от №12». Детский почерк, буква «Р» развёрнута не в ту сторону.', { size: 0.6, once: () => g.state.set('research.dog') });
  b.prop(FX.paperOnWall(m, childDrawing('many_friends', 12), 0.6, true, 0.1), -13, 1.4, -17.88, 0, { collide: false });
  b.prop(FX.paperOnWall(m, childDrawing('verity_me', 14), 0.6, true, 0.1), -11.6, 1.3, -17.88, 0, { collide: false });
  b.prop(FX.paperOnWall(m, scrawl('ВЕРИТИ НИКОГДА НЕ ВРЁТ', { w: 1024, h: 160, color: '#2fa79b', font: 'brand', size: 70 }), 2.6, false), -9, 2.6, -17.88, 0, { collide: false });
  b.prop(R.wallSpeaker(m), -15.88, 2.7, -5, Math.PI / 2, { collide: false });
  b.prop(FX.cctv(m), -15.7, 2.8, -17.7, Math.PI * 0.25 + Math.PI / 2, { collide: false });
  // lights: one warm pendant still works, the other died
  lamp(g, b, 'pendant', -9, 3.2, -11, { drop: 0.7, intensity: 10, distance: 8, color: '#ffd9a0', flicker: 'buzz' });
  lamp(g, b, 'pendant', -12.5, 3.2, -7.5, { drop: 0.7, on: false });
  lamp(g, b, 'pendant', -5.5, 3.2, -15, { drop: 0.7, intensity: 6, distance: 6, color: '#ffd9a0', flicker: 'dying' });

  // ---- the one-way mirror on x = -2 (z -9.5 … -6.5, y 1.0 … 2.2)
  const mirror = new THREE.MeshStandardMaterial({ color: 0x2a2e33, metalness: 1, roughness: 0.06, envMapIntensity: 1.2 });
  const mm = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.2), mirror);
  mm.rotation.y = -Math.PI / 2;
  mm.position.set(-2.02, 1.6, -8);
  b.addDynamic(mm);
  const tint = new THREE.MeshPhysicalMaterial({ color: 0x0a0c0e, transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0, clearcoat: 1 });
  const tm = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.2), tint);
  tm.rotation.y = Math.PI / 2;
  tm.position.set(-1.98, 1.6, -8);
  b.addDynamic(tm);
  b.collider(-2.08, 1.0, -9.5, -1.92, 2.2, -6.5, { opaque: true });
  // finger-writing, only visible in the flashlight beam
  const wc = R.mirrorWriting();
  const writing = m.canvasMaterial(wc, { transparent: true, rough: 0.4 });
  writing.opacity = 0;
  writing.depthWrite = false;
  const wm = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.65), writing);
  wm.rotation.y = -Math.PI / 2;
  wm.position.set(-2.035, 1.75, -8);
  b.addDynamic(wm);
  // from the booth it reads backwards
  const [fc, fg] = canvas(wc.width, wc.height);
  fg.translate(wc.width, 0);
  fg.scale(-1, 1);
  fg.drawImage(wc, 0, 0);
  const writing2 = m.canvasMaterial(fc, { transparent: true, rough: 0.4 });
  writing2.opacity = 0;
  writing2.depthWrite = false;
  const wm2 = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.65), writing2);
  wm2.rotation.y = Math.PI / 2;
  wm2.position.set(-1.965, 1.75, -8);
  b.addDynamic(wm2);
  const centre = new THREE.Vector3(-2, 1.75, -8);
  const lit = { v: 0 };
  b.update((dt) => {
    const cam = g.renderer.camera;
    let target = 0;
    if (g.flashlight.on && g.flashlight.suppressed <= 0) {
      const to = centre.clone().sub(cam.position);
      const d = to.length();
      const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
      const facing = to.normalize().dot(fwd);
      if (d < 7 && facing > 0.8) target = Math.min(1, (facing - 0.8) * 8) * Math.min(1, (7 - d) / 2);
    }
    lit.v += (target - lit.v) * Math.min(1, dt * 3);
    const onFriendSide = cam.position.x < -2;
    writing.opacity = onFriendSide ? lit.v * 0.85 : 0;
    writing2.opacity = onFriendSide ? 0 : lit.v * 0.6;
  });
  g.interact.add({
    id: 'mirror',
    object: mm,
    kind: 'look',
    prompt: () => 'Осмотреть зеркало',
    onUse: () => {
      if (lit.v > 0.4) {
        g.ui.hud.subtitle('В луче фонаря на стекле — надпись пальцем: «Я ЗНАЮ, ЧТО ВЫ ТАМ». Изнутри. На высоте, до которой ребёнку не дотянуться.', 7);
        g.secret('sec_mirror');
      } else g.ui.hud.subtitle('Зеркало во всю стену. Слишком тёмное и холодное для зеркала. Будто за ним кто-то стоит. Может, посветить?', 6);
    },
  });
}

// =====================================================================
// observation booth
// =====================================================================

function booth(g: Game, b: LevelBuilder, refs: Refs): void {
  const m = g.mats;
  new Door(g, b, { id: 'r_booth', x: 2, z: -4, axis: 'x', style: 'office', label: 'НАБЛЮДЕНИЕ' });
  b.prop(R.observationConsole(m, 2.8), -1.1, 0, -8, Math.PI / 2);
  b.prop(R.observationConsole(m, 3.6, [screenCanvas(['КАМЕРА 1', '', 'НЕТ СИГНАЛА'], { color: '#9fb3b5' }), screenCanvas(['КАМЕРА 2', '', 'ЗАПИСЬ ●', 'КР-07'], { color: '#ff6a5a' })]), 2.2, 0, -11.35, 0);
  b.prop(F.officeChair(m, '#2e3a4a'), -0.1, 0, -8.6, Math.PI / 2 + 0.3);
  b.prop(F.officeChair(m, '#2e3a4a', true), 0.6, 0, -6.4, 1.2);
  b.prop(F.mug(m, '#c3b1e1'), -1.0, 0.86, -7.0, 0, { collide: false });
  b.prop(F.mug(m, '#f2eadb'), -1.15, 0.86, -9.2, 0, { collide: false });
  b.prop(R.microphone(m), -1.0, 0.86, -8.3, Math.PI / 2, { collide: false });
  tapePlayer(g, b, 'irina_kr07', -1.05, 0.86, -7.6, Math.PI / 2);
  documentProp(g, b, 'session_kr03', -1.1, 0.86, -8.9, Math.PI / 2 + 0.2, 'clipboard');
  b.prop(F.filingCabinet(m, 4, '#6c7a7b', 1), 5.4, 0, -5, -Math.PI / 2);
  b.prop(F.paperStack(m, 8, 3), 3.4, 0.86, -11.3, 0.3, { collide: false });
  lamp(g, b, 'bare', 2.5, 3, -7.5, { drop: 0.5, intensity: 2.2, distance: 5, color: '#ff9a7a' });
  b.sound('tape_hiss_loop', -1, 1, -8, 0.06);
  // the plush has turned to look at the glass
  b.trigger('booth_in', -1.8, 0, -11.8, 5.8, 2, -4.2, {
    when: () => g.state.is('research.friendVisited') && !g.state.is('research.plushTurned'),
    onEnter: () => {
      g.state.set('research.plushTurned');
      g.co.start(
        (function* (): CoGen {
          yield 2.5;
          refs.plush.rotation.y = Math.PI / 2;
          g.audio.play('squeak', { pos: new THREE.Vector3(-9.2, 0.7, -11.1), volume: 0.18 });
        })(),
        'zone',
      );
    },
  });
}

// =====================================================================
// waiting chambers + control room
// =====================================================================

function elapsedSince(start: Date): string {
  const now = new Date();
  let ms = Math.max(0, now.getTime() - start.getTime());
  const sec = Math.floor(ms / 1000);
  const days = Math.floor(sec / 86400);
  const years = Math.floor(days / 365.2425);
  const d = Math.floor(days - years * 365.2425);
  const hh = Math.floor((sec % 86400) / 3600);
  const mm = Math.floor((sec % 3600) / 60);
  const ss = sec % 60;
  ms = 0;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${years}г ${d}д ${p(hh)}:${p(mm)}:${p(ss)}`;
}

function chambers(g: Game, b: LevelBuilder, refs: Refs): void {
  const m = g.mats;
  for (let i = 0; i < 3; i++) {
    const cx = 6 + (i + 0.5) * CHW;
    new Door(g, b, { id: 'r_ch' + i, x: cx, z: -4, axis: 'x', width: 0.9, style: 'metal', color: '#d8d2c4', label: `КАМЕРА ${i + 1}` });
    // observation slit glass
    b.prop(new THREE.Mesh(box(1.2, 0.5, 0.02), m.get('glass_dirty')), cx, 1.65, -10, 0, { collide: false });
    b.collider(cx - 0.6, 1.4, -10.05, cx + 0.6, 1.9, -9.95, { opaque: false });
    const pedestal = new ModelBuilder();
    pedestal.add(cyl(0.25, 0.3, 0.45, 18), m.painted('#d8d2c4', 0.5), 0, 0.225, 0);
    pedestal.add(cyl(0.27, 0.27, 0.04, 18), m.cloth('#8aa0b8', 0.6), 0, 0.47, 0);
    b.prop(pedestal.group, cx, 0, -7.4, 0);
    b.prop(R.wallSpeaker(m), cx + 1.3, 2.5, -9.88, 0, { collide: false });
    const counter = R.waitCounter(m);
    b.prop(counter.group, cx, 2.25, -9.9, 0, { collide: false, static: false });
    if (i === 0) counter.draw('00:00:00', false);
    if (i === 2) counter.draw('--:--:--', false);
    if (i === 1) {
      refs.ch2Counter = counter.draw;
      const start = new Date(1994, 3, 12, 10, 14, 0);
      let t = 0;
      b.update((dt) => {
        t -= dt;
        if (t > 0) return;
        t = 1;
        if (g.player.pos.distanceTo(new THREE.Vector3(cx, 0, -7)) < 14) counter.draw(elapsedSince(start), true);
      });
      counter.draw(elapsedSince(start), true);
      inspect(g, b, null, cx, 2.25, -9.8, 'Камера №2. Счётчик ожидания до сих пор идёт — с 12 апреля 1994 года, 10:14. Никто не сказал ему, что можно перестать считать.', { size: 0.6 });
      lamp(g, b, 'cage', cx, 2.75, -5.5, { intensity: 2.5, distance: 5, color: '#ff8a6a', flicker: 'pulse' });
    } else lamp(g, b, 'cage', cx, 2.75, -5.5, { intensity: 3, distance: 5, flicker: i === 0 ? 'dying' : undefined, on: i === 0 });
  }
  // chamber 3: tally marks at a child's height
  const tm = m.canvasMaterial(R.tallyCanvas(5), { transparent: true, rough: 0.9 });
  b.decal(tm, 15.88, 0.75, -7, 5.4, 1.1, 'e');
  b.decal(tm, 12.79, 0.75, -7, 5.4, 1.1, 'w');
  inspect(g, b, null, 15.6, 0.8, -7, 'Насечки по пять. Вся стена, от пола до моего пояса. Я начал считать и бросил на третьей тысяче. Здесь их десятки тысяч.', { size: 1.4, secret: 'sec_tally' });
  // broken counter glass in 3
  b.decal(m.canvasMaterial(stain('scuff', 81), { transparent: true }), 14.33, 0.004, -8.6, 1.2, 1.0, 'up');
}

function control(g: Game, b: LevelBuilder, refs: Refs): void {
  const m = g.mats;
  new Door(g, b, { id: 'r_control', x: 9, z: -18, axis: 'x', style: 'office', label: 'ПУЛЬТОВАЯ' });
  b.prop(R.observationConsole(m, 9.2), 11, 0, -10.75, Math.PI);
  b.prop(R.observationConsole(m, 2.6, [screenCanvas(['ПРОТОКОЛ КР', 'СТАТУС: ОЖИДАНИЕ', 'КАМЕРА 2: АКТИВНА'], { color: '#ffb36a' })]), 15.25, 0, -14.5, -Math.PI / 2);
  for (const x of [8, 11, 14]) b.prop(F.officeChair(m, '#3a3f42'), x, 0, -11.8, (x - 11) * 0.1);
  documentProp(g, b, 'separation_protocol', 9.6, 0.86, -10.6, 0.1, 'clipboard');
  b.prop(F.whiteboard(m, 2.2, 1.1, scrawl('КР-01 … КР-40\nРЕЗУЛЬТАТЫ:\nожид. 24ч → стереть\nКР-07 — 13.04 10:00 СТЕРЕТЬ!!', { w: 1024, h: 512, color: '#2a3a8a', size: 54 })), 6.12, 1.5, -14, Math.PI / 2, { collide: false });
  b.prop(F.filingCabinet(m, 4, '#6c7a7b'), 15.4, 0, -17.3, -Math.PI / 2);
  lamp(g, b, 'troffer', 11, 3, -14, { intensity: 8, distance: 7, flicker: 'buzz', color: '#e6f0ff' });
  // the talk-back mic: press it once and something answers from chamber 2
  const mic = R.microphone(m);
  b.prop(mic, 11.0, 0.86, -10.6, 0, { collide: false, static: false });
  g.interact.add({
    id: 'kr_mic',
    object: mic,
    kind: 'use',
    prompt: () => (g.state.is('research.mic') ? null : 'Нажать кнопку связи с камерами'),
    onUse: () => {
      g.state.set('research.mic');
      g.co.start(
        (function* (): CoGen {
          const sp = new THREE.Vector3(6 + 1.5 * CHW + 1.3, 2.5, -9.9);
          g.audio.play('switch', { pos: mic.position, volume: 0.5 });
          g.audio.play('static_burst', { pos: sp, volume: 0.4, ref: 3 });
          yield 1.6;
          g.ui.hud.subtitle('Я молчу. Тишина в динамике тоже шипит.', 3);
          yield 3;
          refs.ch2Counter('00:00:00', true);
          g.audio.play('keypad_beep', { pos: sp, volume: 0.5, rate: 0.7 });
          yield 0.8;
          yield g.say('verity', 'Это ты?', { pos: sp, degrade: 1 });
          yield g.say('verity', 'Сколько… ещё… надо ждать?', { pos: sp, degrade: 2 });
          g.addFear(0.3);
          g.audio.play('static_burst', { pos: sp, volume: 0.5, ref: 3 });
          yield 2;
          g.ui.hud.subtitle('Счётчик в камере №2 обнулился. А потом пошёл снова, с прежнего места.', 5);
        })(),
        'zone',
      );
    },
  });
}

function copyRoom(g: Game, b: LevelBuilder): void {
  const m = g.mats;
  new Door(g, b, { id: 'r_copy', x: 2, z: -18, axis: 'x', style: 'office', label: 'КОПИРОВАЛЬНАЯ' });
  b.prop(R.copier(m), 4.6, 0, -15, -Math.PI / 2);
  b.prop(R.shredder(m), 4.9, 0, -13.0, -Math.PI / 2);
  inspect(g, b, null, 4.9, 0.75, -13.0, 'В шредере застрял лист. Уцелело: «…субъект №12 … глубокий слой НЕ стирается … рекомендую изолировать субъекта от Ядра навсегда…» Дальше — лапша.', { size: 0.5 });
  b.prop(F.table(m, 1.6, 0.7, 0.75, '#c9c2b0'), -0.4, 0, -17.2, 0);
  b.prop(F.paperStack(m, 10, 8), -0.7, 0.75, -17.2, 0.2, { collide: false });
  b.prop(F.paperStack(m, 6, 9), 0.1, 0.75, -17.1, -0.3, { collide: false });
  for (let i = 0; i < 4; i++) b.prop(F.cardboardBox(m, 0.45, 0.32, 0.35, i === 2), -1.2 + (i % 2) * 0.5, Math.floor(i / 2) * 0.32, -12.5, i * 0.3);
  hideLocker(g, b, 'copy_locker1', -1.45, 0, -14.6, Math.PI / 2, '#7d8a8c');
  hideLocker(g, b, 'copy_locker2', -1.45, 0, -15.4, Math.PI / 2, '#7d8a8c');
  lamp(g, b, 'troffer', 2, 3, -15, { intensity: 7, distance: 6, flicker: 'dying', color: '#e6f0ff' });
}

// =====================================================================
// Dr Hale's office
// =====================================================================

function haleOffice(g: Game, b: LevelBuilder, refs: Refs): void {
  const m = g.mats;
  refs.haleDoor = new Door(g, b, {
    id: 'r_hale',
    x: -10,
    z: -22,
    axis: 'x',
    style: 'wood',
    color: '#4a2c18',
    label: 'Д-Р С. ХЕЙЛ',
    lock: () => (g.state.is('research.haleOpen') ? null : 'Заперто. Табличка: «Д-р С. Хейл. Без стука не входить»'),
  });
  // rug
  const rug = new THREE.MeshStandardMaterial({ color: 0x5a2a2a, roughness: 0.95 });
  b.decal(rug, -10, 0.006, -28.5, 5, 3.4, 'up');
  // desk facing the door: Hale sat with his back to the north wall
  b.prop(F.desk(m, 1.9, 0.85, '#4a2c18'), -10, 0, -30.5, Math.PI);
  b.prop(F.officeChair(m, '#3a2618'), -10, 0, -31.5, Math.PI);
  b.prop(F.chair(m, '#5a2a2a', '#4a2c18'), -10.6, 0, -29.2, 0.2);
  b.prop(F.computerMonitor(m, [], false), -10.65, 0.76, -30.3, Math.PI);
  b.prop(FX.paperOnWall(m, scrawl('пароль —\nлучший день', { w: 256, h: 256, color: '#333', size: 46 }), 0.09, false), -10.5, 1.03, -30.53, Math.PI, { collide: false });
  inspect(g, b, null, -10.5, 1.03, -30.58, 'Жёлтый стикер на мониторе: «пароль — лучший день». Аккуратный почерк человека, который никогда ничего не забывает.', {
    size: 0.15,
    once: () => g.state.set('research.sticky'),
  });
  const dl = R.deskLamp(m);
  b.prop(dl.group, -9.2, 0.76, -30.8, -0.4, { collide: false });
  b.light(-9.2, 1.1, -30.6, { color: '#ffd59a', intensity: 7, distance: 7, emissives: [dl.bulb], emissiveBase: 2, priority: 1.2 });
  const fl = R.floorLamp(m);
  b.prop(fl.group, -15.3, 0, -23.0, 0);
  b.light(-15.3, 1.5, -23.0, { color: '#ffc98a', intensity: 4, distance: 6, emissives: [fl.bulb], emissiveBase: 2, flicker: 'dying' });
  b.prop(F.mug(m, '#2a2e31'), -9.7, 0.76, -30.3, 0, { collide: false });
  b.prop(F.paperStack(m, 4, 31), -10.3, 0.76, -30.2, 0.1, { collide: false });
  documentProp(g, b, 'hale_last_note', -9.9, 0.765, -30.1, 0.15, 'sheet');
  tapePlayer(g, b, 'hale_log', -10.9, 0.76, -30.25, 0.3);
  const watch = R.wristwatch(m, 8, 15);
  inspect(g, b, watch, -9.5, 0.765, -30.15, 'Наручные часы Хейла. Стоят на 8:15. Ремешок застёгнут — будто их сняли, не расстёгивая. Будто рука просто… исчезла.', { size: 0.12, once: () => g.state.set('research.watch') });
  // metronome ticking by itself
  const met = R.metronome(m);
  b.prop(met.group, -11.2, 0.76, -30.6, 0.3, { collide: false, static: false });
  let mt = 0;
  let side = 1;
  b.update((dt) => {
    mt += dt;
    met.arm.rotation.z = Math.sin(mt * Math.PI) * 0.45;
    const s = Math.sign(Math.cos(mt * Math.PI));
    if (s !== side) {
      side = s;
      if (g.player.pos.distanceTo(met.group.position) < 7) g.audio.play('switch', { pos: met.group.position, volume: 0.06, rate: 2.2 });
    }
  });
  // calendar
  b.prop(FX.paperOnWall(m, R.calendarCanvas(), 0.5, true), -13.6, 1.6, -33.88, 0, { collide: false });
  inspect(g, b, null, -13.6, 1.6, -33.8, 'Календарь «Пелл и Ламберт», апрель 1994. Двенадцатое обведено дважды: «КР-07 — прорыв!». Тринадцатое зачёркнуто.', { size: 0.6, once: () => g.state.set('research.calendar') });
  // bookshelves, filing, sofa, coat
  b.prop(F.shelf(m, 2.0, 2.2, 0.4, 5, '#4a2c18'), -6.2, 0, -33.6, 0);
  b.prop(F.shelf(m, 2.0, 2.2, 0.4, 5, '#4a2c18'), -8.4, 0, -33.6, 0);
  b.prop(F.filingCabinet(m, 4, '#5a4a3a', 3), -4.5, 0, -27, -Math.PI / 2);
  b.prop(F.sofa(m, 1.9, '#3d2a2a'), -15.4, 0, -25, Math.PI / 2);
  b.prop(FX.framedPicture(m, photo('team', 22, 320, 240), 0.6, '#2a1f12'), -4.12, 1.6, -30, -Math.PI / 2, { collide: false });
  inspect(g, b, null, -4.2, 1.6, -30, 'Отдел Гармонии, 1993. Хейл в центре, рядом женщина в вязаной кофте — наверное, Ирина. Все улыбаются в камеру. Шар в колыбели у их ног тоже улыбается.', { size: 0.5 });
  b.prop(FX.framedPicture(m, sign('ДОКТОР ПСИХОЛОГИИ\nС. ХЕЙЛ\n1979', { bg: '#efe6cf', fg: '#2a1f12', w: 512, h: 384 }), 0.45, '#2a1f12'), -4.12, 1.7, -24.5, -Math.PI / 2, { collide: false });
  // wardrobe: a place to hide
  const wr = R.wardrobe(m, '#4a2c18');
  b.prop(wr, -15.3, 0, -32.5, Math.PI / 2, { static: false });
  hideSpot(g, b, wr, { id: 'hale_wardrobe', eye: new THREE.Vector3(-15.25, 1.55, -32.5), yaw: -Math.PI / 2, yawRange: 0.3, pitchRange: 0.25, exit: new THREE.Vector3(-14.3, 0, -32.5) }, wr.userData.door);
  // once you know whose password you need, the door opens for you. From inside.
  let inCorridor = 0;
  b.update((dt) => {
    if (g.state.is('research.haleOpen') || !g.state.is('research.hint')) return;
    const p = g.player.pos;
    const ok = p.z < -18.2 && p.z > -21.8 && Math.abs(p.x + 10) > 4 && Math.abs(p.x + 10) < 16;
    inCorridor = ok ? inCorridor + dt : 0;
    if (inCorridor < 1.2) return;
    g.state.set('research.haleOpen');
    refs.haleDoor.refreshLock();
    g.audio.play('lock_open', { pos: refs.haleDoor.pos.clone().setY(1.1), volume: 0.8, ref: 6 });
    setTimeout(() => {
      refs.haleDoor.setOpen(true);
      g.audio.play('door_creak', { pos: refs.haleDoor.pos.clone().setY(1.1), volume: 0.7, ref: 6 });
    }, 900);
    setTimeout(() => g.ui.hud.subtitle('Дверь кабинета Хейла открылась сама. Изнутри. Там никого нет.', 5), 2200);
  });
  // wall safe behind the portrait
  safe(g, b);
  lamp(g, b, 'pendant', -10, 3.2, -26, { drop: 0.6, on: false });
}

function safe(g: Game, b: LevelBuilder): void {
  const m = g.mats;
  const s = R.wallSafe(m);
  b.prop(s.group, -15.88, 1.45, -28.5, Math.PI / 2, { collide: false, static: false });
  const open = () => (s.door.rotation.y = -1.6);
  const ph = photoProp(m, 'lumen');
  ph.visible = false;
  b.prop(ph, -15.75, 1.3, -28.5, Math.PI / 2, { collide: false, static: false });
  if (g.state.is('research.safe')) {
    open();
    ph.visible = !g.state.is('research.photo');
  }
  g.interact.add({
    id: 'hale_safe',
    object: s.group,
    kind: 'use',
    prompt: () => (g.state.is('research.safe') ? null : 'Сейф с кодовым замком'),
    onUse: () =>
      g.openScreen(
        new KeypadScreen(g, {
          title: 'СЕЙФ · 4 ЦИФРЫ',
          length: 4,
          check: (c) => c === '0815',
          onFail: (c) => {
            if (c === '1904' || c === '1900') g.ui.hud.subtitle('Нет. 19:00 — это его время, а не Хейла.', 4);
            else if (c === '1204' || c === '0412') g.ui.hud.subtitle('День КР-07? Нет. Хейл не стал бы прятать то, чем гордится.', 4);
          },
          onSuccess: () => {
            g.state.set('research.safe');
            g.audio.play('lock_open', { pos: s.group.position, volume: 0.7 });
            open();
            ph.visible = true;
          },
        }),
      ),
  });
  g.interact.add({
    id: 'hale_photo',
    object: ph,
    kind: 'look',
    prompt: () => (g.state.is('research.safe') && !g.state.is('research.photo') ? 'Взять фотографию' : null),
    onUse: () => {
      g.state.set('research.photo');
      ph.visible = false;
      g.audio.play('paper', { volume: 0.6 });
      g.ui.hud.subtitle('Хейл рядом с высокой фигурой. Вместо головы у неё — фонарь. На обороте: «Нортфилд. Проект "Люмен". Второе Ядро. Без ошибок первого».', 8);
      g.secret('sec_safe');
    },
  });
}

// =====================================================================
// server room: P6 terminal
// =====================================================================

const TAGS: Array<[string, string, string]> = [
  ['2B11-04', 'ЖУРНАЛЫ СЕССИЙ', 'Бирка: «ТОМ 2B11-04 — ЖУРНАЛЫ СЕССИЙ. Проверено 02.11.97»'],
  ['7F3A-12', 'ИНДЕКС АРХИВА', 'Бирка: «ТОМ 7F3A-12 — ИНДЕКС АРХИВА. Проверено 02.11.97». Ниже маркером: «если замок архива встал — RESTORE с терминала»'],
  ['0C9D-77', 'ТЕЛЕМЕТРИЯ ЯДРА', 'Бирка: «ТОМ 0C9D-77 — ТЕЛЕМЕТРИЯ ЯДРА». Кто-то зачеркнул «ЯДРА» и написал сверху: «ЕГО»'],
];

function serverRoom(g: Game, b: LevelBuilder, refs: Refs): void {
  const m = g.mats;
  new Door(g, b, { id: 'r_server', x: 1, z: -22, axis: 'x', style: 'metal', color: '#9aa0a6', label: 'СЕРВЕРНАЯ' });
  // two rows of racks
  let k = 0;
  for (const x of [-1.6, 3.6]) {
    for (let i = 0; i < 5; i++) {
      const z = -32.6 + i * 0.64;
      const tag = (x < 0 && i === 1) || (x > 0 && i === 3) || (x < 0 && i === 4) ? TAGS[k++] : null;
      const rack = R.serverRack(m, tag ? `ТОМ ${tag[0]}\n${tag[1]}` : 'РЕЗЕРВ\n—', 30 + i + (x > 0 ? 10 : 0), !tag && i % 2 === 0);
      b.prop(rack, x, 0, z, x < 0 ? Math.PI / 2 : -Math.PI / 2);
      if (tag) {
        const tx = x < 0 ? x + 0.52 : x - 0.52;
        inspect(g, b, null, tx, 1.55, z, tag[2], { size: 0.3, once: () => g.state.set('research.tag.' + tag[0]) });
      }
    }
  }
  b.prop(FX.cableBundle(m, [new THREE.Vector3(-1.6, 2.85, -33.5), new THREE.Vector3(-1.6, 2.85, -23), new THREE.Vector3(3.6, 2.85, -23), new THREE.Vector3(3.6, 2.85, -33.5)], 4), 0, 0, 0, 0, { collide: false });
  b.prop(FX.electricalBox(m, 0.6, 0.8), 5.88, 1.4, -29, -Math.PI / 2, { collide: false });
  b.sound('hum_loop', 1, 1.2, -29, 0.25);
  b.sound('vent_loop', 1, 2.8, -33, 0.2);
  for (const z of [-25, -31]) lamp(g, b, 'troffer', 1, 3, z, { intensity: 8, distance: 7, color: '#cfe4ff', flicker: z === -31 ? 'dying' : undefined });

  // the terminal desk by the door
  b.prop(F.desk(m, 1.4, 0.7, '#8a8e91'), 5.45, 0, -24.6, -Math.PI / 2);
  b.prop(F.officeChair(m, '#2e3a4a'), 4.5, 0, -24.6, Math.PI / 2);
  const term = F.terminal(m, ['ГАРМОНИЯ ОС 2.3', '', 'ОЗУ: НЕ ОБНАРУЖЕНО', 'СИСТЕМА ОСТАНОВЛЕНА', '', '> _'], true);
  b.prop(term, 5.5, 0.76, -24.6, -Math.PI / 2, { collide: false, static: false });
  const scrMat = term.userData.screenMat as THREE.MeshStandardMaterial;
  const setScreen = (lines: string[]) => {
    const c = screenCanvas(lines);
    (scrMat.map as THREE.CanvasTexture).image = c;
    (scrMat.map as THREE.CanvasTexture).needsUpdate = true;
  };
  if (g.state.is('research.memIn')) setScreen(['ГАРМОНИЯ ОС 2.3', '', 'ОЗУ: 4096 КБ — ОК', '', 'ПОЛЬЗОВАТЕЛЬ: _']);
  b.prop(FX.paperOnWall(m, sign('ТЕРМИНАЛ ГАРМОНИИ\nтолько для д-ра Хейла', { bg: '#efe6cf', fg: '#22313a', w: 512, h: 192 }), 0.45, true), 5.88, 1.65, -24.6, -Math.PI / 2, { collide: false });
  g.interact.add({
    id: 'harmony_terminal',
    object: term,
    kind: 'use',
    prompt: () => {
      if (g.state.is('research.memIn')) return 'Терминал Гармонии';
      if (g.state.has('memory')) return 'Вставить модуль памяти';
      return 'Терминал Гармонии';
    },
    onUse: () => {
      if (!g.state.is('research.memIn')) {
        if (g.state.has('memory')) {
          g.state.removeItem('memory');
          g.state.set('research.memIn');
          g.audio.play('switch', { pos: term.position, volume: 0.6 });
          g.audio.play('crt_on', { pos: term.position, volume: 0.6 });
          setScreen(['ГАРМОНИЯ ОС 2.3', '', 'ОЗУ: 4096 КБ — ОК', '', 'ПОЛЬЗОВАТЕЛЬ: _']);
          g.objective('Войти в терминал Гармонии');
          g.checkpoint('research.mem', { silent: true });
          return;
        }
        g.audio.play('keypad_err', { pos: term.position, volume: 0.4 });
        g.ui.hud.subtitle('На экране: «ОЗУ НЕ ОБНАРУЖЕНО». Сбоку на корпусе — пустой слот, из которого кто-то вынул плату.', 5);
        if (!g.state.is('research.memSeen')) {
          g.state.set('research.memSeen');
          g.objective('Найти модуль памяти для терминала');
        }
        return;
      }
      g.openScreen(new TerminalScreen(g, harmonyProgram(g, refs, setScreen)));
    },
  });

  // the memory module: someone leaves it at the door while you're away
  const mem = memoryModule(m);
  b.prop(mem, 0.35, 0.02, -21.2, 0.6, { collide: false, static: false });
  const smileyMat = m.canvasMaterial(scrawl(':)', { w: 256, h: 256, color: '#f2f2ea', size: 170, rot: 1.5708 }), { transparent: true, rough: 0.9 });
  const sm = b.decal(smileyMat, -0.25, 0.006, -21.1, 0.45, 0.45, 'up');
  refs.memObj = mem;
  refs.memSmiley = smileyMat;
  const memVisible = () => g.state.is('research.memPlaced') && !g.state.has('memory') && !g.state.is('research.memIn');
  mem.visible = memVisible();
  sm.visible = g.state.is('research.memPlaced');
  const it = g.interact.add({
    id: 'pickup:memory',
    object: mem,
    kind: 'pickup',
    prompt: () => (memVisible() ? 'Взять: Модуль памяти' : null),
    onUse: () => {
      g.giveItem('memory');
      mem.visible = false;
      g.ui.hud.subtitle('Модуль памяти. Рядом на полу нарисован смайлик. Мелом. На высоте пола — тот, кто рисовал, был совсем невысоким.', 6);
      g.objective('Вставить модуль памяти в терминал Гармонии');
    },
  });
  void it;
  b.update(() => {
    if (!g.state.is('research.memSeen') || g.state.is('research.memPlaced')) return;
    const d = g.player.pos.distanceTo(new THREE.Vector3(1, 0, -22));
    if (d < 14) return;
    // you've walked away: he rolls by and leaves it at the door
    g.state.set('research.memPlaced');
    mem.visible = true;
    sm.visible = true;
    g.audio.play('roll_loop', { pos: new THREE.Vector3(1, 0.3, -21), volume: 0.5, ref: 4 })?.stop(1.6);
    setTimeout(() => g.audio.play('squeak', { pos: new THREE.Vector3(0, 0.4, -21), volume: 0.35, ref: 4 }), 1500);
  });
}

function normPass(s: string): string {
  return s.toLowerCase().replace(/[\s.\-_/]/g, '').replace(/к/g, 'k').replace(/р/g, 'r');
}

function harmonyProgram(g: Game, refs: Refs, setScreen: (l: string[]) => void): TerminalProgram {
  let stage: 'user' | 'pass' | 'cmd' = g.state.is('research.login') ? 'cmd' : 'user';
  let fails = 0;
  const help = (t: TerminalApi) => {
    t.print('КОМАНДЫ:');
    t.print('  LIST            — список файлов', 0);
    t.print('  READ <ФАЙЛ>     — открыть файл', 0);
    t.print('  DIAG            — диагностика системы', 0);
    t.print('  RESTORE <ТОМ>   — восстановить том', 0);
    t.print('  EXIT            — выход', 0);
  };
  const readDoc = (id: string, t: TerminalApi) => {
    const d = DOCS[id];
    t.print('');
    t.print(d.body, 0.003);
    if (g.state.readDoc(id)) g.notify('Журнал: ' + d.title, 'info');
  };
  return {
    prompt: stage === 'cmd' ? 'HALE>' : 'ИМЯ>',
    boot(t) {
      t.print('ГАРМОНИЯ ОС 2.3   (c) Пелл и Ламберт, 1993');
      t.print('ОЗУ: 4096 КБ … ОК');
      if (stage === 'cmd') {
        t.print('');
        t.print('СЕАНС ВОССТАНОВЛЕН. ПОЛЬЗОВАТЕЛЬ: HALE');
        t.print('HELP — список команд.');
        return;
      }
      t.print('ПОСЛЕДНИЙ ВХОД: HALE   11.02.1999   08:15');
      t.print('');
      t.print('ВВЕДИТЕ ИМЯ ПОЛЬЗОВАТЕЛЯ.');
    },
    command(line, t) {
      const raw = line.trim();
      const lc = raw.toLowerCase();
      if (!raw) return;
      if (stage === 'user') {
        if (['hale', 'хейл', 'хэйл', 'shale', 'simon', 'саймон', 'дрхейл', 'сhale'].includes(lc.replace(/[\s.\-]/g, ''))) {
          stage = 'pass';
          t.setPrompt('ПАРОЛЬ>');
          t.setMasked(true);
          t.print('ПОЛЬЗОВАТЕЛЬ HALE. ВВЕДИТЕ ПАРОЛЬ.');
          t.print('ПОДСКАЗКА К ПАРОЛЮ: «лучший день»');
          if (!g.state.is('research.hint')) {
            g.state.set('research.hint');
            g.objective('Узнать пароль Хейла: «лучший день»');
          }
        } else t.print('ПОЛЬЗОВАТЕЛЬ НЕ НАЙДЕН.');
        return;
      }
      if (stage === 'pass') {
        const p = normPass(raw);
        const ok = ['kr07', 'kr7', '120494', '12041994', '1204', '12апреля1994', '12апреля'].includes(p);
        if (ok) {
          stage = 'cmd';
          t.setMasked(false);
          t.setPrompt('HALE>');
          t.print('ДОСТУП РАЗРЕШЁН. ДОБРО ПОЖАЛОВАТЬ, САЙМОН.');
          t.print('');
          t.print('ВНИМАНИЕ: 1 ОШИБКА ЦЕЛОСТНОСТИ. ВЫПОЛНИТЕ DIAG.');
          t.print('HELP — список команд.');
          g.state.set('research.login');
          setScreen(['ГАРМОНИЯ ОС 2.3', '', 'ПОЛЬЗОВАТЕЛЬ: HALE', 'ОШИБКА ЦЕЛОСТНОСТИ: 1', '', 'HALE> _']);
          g.objective('Разобраться с ошибкой терминала (DIAG)');
        } else {
          fails++;
          g.audio.play('keypad_err', { bus: 'ui', volume: 0.4 });
          t.print('НЕВЕРНЫЙ ПАРОЛЬ.');
          if (fails % 3 === 0) t.print('ПОДСКАЗКА К ПАРОЛЮ: «лучший день». ДД.ММ.ГГ ИЛИ НАЗВАНИЕ.');
        }
        return;
      }
      // logged in
      const [cmd0, ...args] = raw.split(/\s+/);
      const cmd = cmd0.toLowerCase();
      const arg = args.join(' ');
      if (['help', 'помощь', '?'].includes(cmd)) help(t);
      else if (['list', 'ls', 'dir', 'список'].includes(cmd)) {
        t.print('ФАЙЛЫ:');
        t.print('  ДРУЗЬЯ.ТХТ        2 КБ', 0);
        t.print('  УТРО.ЛОГ        418 КБ', 0);
        t.print('  ИНДЕКС.ДБ        ?? КБ   [ПОВРЕЖДЁН]', 0);
      } else if (['read', 'open', 'cat', 'читать', 'открыть'].includes(cmd)) {
        const a = arg.toLowerCase();
        if (/друз|drz|friend|1/.test(a)) readDoc('friends_list', t);
        else if (/утр|utr|morn|log|2/.test(a)) {
          readDoc('morning_log', t);
          if (!g.state.is('research.morning')) {
            g.state.set('research.morning');
            setTimeout(() => g.audio.play('static_burst', { volume: 0.2 }), 2500);
          }
        } else if (/индекс|index|дб|db|3/.test(a)) t.print('ОШИБКА ЧТЕНИЯ: ФАЙЛ ПОВРЕЖДЁН. ВЫПОЛНИТЕ DIAG.');
        else t.print('ФАЙЛ НЕ НАЙДЕН. LIST — список файлов.');
      } else if (['diag', 'диаг', 'диагностика'].includes(cmd)) {
        t.print('ДИАГНОСТИКА…', 0.02);
        t.print('  ЯДРО «ОЧАГ» ............ ИЗОЛИРОВАНО (с 03.11.1997 19:00:00)');
        t.print('  КАНАЛ ВЕРИТИ→ОПЕРАТОР .. АКТИВЕН. ОПЕРАТОР НЕ ОТВЕЧАЕТ');
        t.print('  ИНДЕКС АРХИВА .......... ПОВРЕЖДЁН (CRC)');
        t.print('  ЗАМОК АРХИВА ........... ЗАБЛОКИРОВАН ДО ВОССТАНОВЛЕНИЯ ИНДЕКСА');
        t.print('');
        t.print('ДЛЯ ВОССТАНОВЛЕНИЯ: RESTORE <НОМЕР ТОМА>.');
        t.print('НОМЕР ТОМА УКАЗАН НА БИРКЕ СТОЙКИ ХРАНЕНИЯ.');
        if (!g.state.is('research.diag')) {
          g.state.set('research.diag');
          g.objective('Найти номер тома индекса на стойках серверной');
        }
      } else if (['restore', 'восст', 'восстановить'].includes(cmd)) {
        const v = arg.toUpperCase().replace(/[^0-9A-ZА-Я]/g, '').replace(/А/g, 'A').replace(/В/g, 'B').replace(/С/g, 'C').replace(/Е/g, 'E');
        if (!v) t.print('УКАЖИТЕ НОМЕР ТОМА: RESTORE XXXX-XX');
        else if (v === '7F3A12') {
          if (g.state.is('research.archiveOpen')) {
            t.print('ИНДЕКС В ПОРЯДКЕ. ВОССТАНОВЛЕНИЕ НЕ ТРЕБУЕТСЯ.');
            return;
          }
          t.print('ВОССТАНОВЛЕНИЕ ТОМА 7F3A-12 …', 0.02);
          t.print('[##########----------]  48%', 0.05);
          t.print('[####################] 100%', 0.05);
          t.print('ИНДЕКС АРХИВА ВОССТАНОВЛЕН. 1 120 ЗАПИСЕЙ.', 0.02);
          t.print('ЗАМОК АРХИВА: ОТКРЫТ.', 0.02);
          g.state.set('research.archiveOpen');
          g.state.markSolved('p6');
          refs.archiveDoor.refreshLock();
          g.audio.play('lock_open', { pos: refs.archiveDoor.pos, volume: 0.8, ref: 6 });
          setScreen(['ГАРМОНИЯ ОС 2.3', '', 'ИНДЕКС АРХИВА: ОК', 'ЗАМОК АРХИВА: ОТКРЫТ', '', 'HALE> _']);
          g.objective('Найти в архиве плёнку сессии КР-07');
          g.checkpoint('research.p6');
        } else if (v === '2B1104') t.print('ТОМ 2B11-04 (ЖУРНАЛЫ): ЦЕЛОСТНОСТЬ В НОРМЕ. ВОССТАНОВЛЕНИЕ НЕ ТРЕБУЕТСЯ.');
        else if (v === '0C9D77') {
          t.print('ТОМ 0C9D-77 (ТЕЛЕМЕТРИЯ): ДОСТУП ЗАПРЕЩЁН.');
          t.print('', 0.3);
          t.print('ВЕРИТИ> НЕ НАДО ТУДА СМОТРЕТЬ. ТАМ НЕКРАСИВО.', 0.06);
          g.addFear(0.15);
        } else t.print('ТОМ НЕ НАЙДЕН.');
      } else if (['exit', 'quit', 'logout', 'выход'].includes(cmd)) t.close();
      else if (['hello', 'hi', 'привет', 'здравствуй', 'verity', 'верити'].includes(cmd)) {
        t.print('', 0.4);
        t.print('ВЕРИТИ> ПРИВЕТ.', 0.07);
        t.print('ВЕРИТИ> ТЫ ПИШЕШЬ ПОД ИМЕНЕМ САЙМОНА. НО ТЫ НЕ САЙМОН. САЙМОН ПЕЧАТАЛ ДВУМЯ ПАЛЬЦАМИ.', 0.05);
        t.print('ВЕРИТИ> Я НЕ СЕРЖУСЬ. Я РАД, ЧТО ТЫ ПИШЕШЬ.', 0.05);
        g.state.set('research.typedHello');
      } else if (['who', 'whoami', 'кто'].includes(cmd)) t.print('ПОЛЬЗОВАТЕЛЬ: HALE (ПО ДАННЫМ СИСТЕМЫ).  ПО ДАННЫМ ЯДРА: №12.');
      else t.print('НЕИЗВЕСТНАЯ КОМАНДА. HELP — СПИСОК КОМАНД.');
    },
  };
}

// =====================================================================
// archive: P7 racks
// =====================================================================

const MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];

function archive(g: Game, b: LevelBuilder, refs: Refs): void {
  const m = g.mats;
  refs.archiveDoor = new Door(g, b, {
    id: 'r_archive',
    x: 11,
    z: -22,
    axis: 'x',
    width: 1.4,
    height: 2.2,
    style: 'security',
    label: 'АРХИВ',
    lock: () => (g.state.is('research.archiveOpen') ? null : 'Заблокировано. Табло: «ИНДЕКС ПОВРЕЖДЁН — ОБРАТИТЕСЬ К ТЕРМИНАЛУ»'),
  });
  // card reader with a red LED
  const rd = new ModelBuilder();
  rd.add(box(0.12, 0.18, 0.04), m.plastic('#2a2e31', 0.4), 0, 0, 0.02);
  const led = new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff2010, emissiveIntensity: 2 });
  rd.add(box(0.03, 0.015, 0.01), led, 0, 0.06, 0.045);
  b.prop(rd.group, 12.1, 1.3, -21.88, 0, { collide: false, static: false });
  b.update(() => {
    const ok = g.state.is('research.archiveOpen');
    led.emissive.setHex(ok ? 0x30ff60 : 0xff2010);
  });
  // catalogue rule at the entrance
  documentProp(g, b, 'archive_cards', 7.0, 1.55, -22.12, Math.PI, 'none', FX.paperOnWall(m, sign('АРХИВ ПЛЁНОК\nСТЕЛЛАЖ — ГОД\nПОЛКА — МЕСЯЦ\nЯЧЕЙКА — № СУБЪЕКТА', { bg: '#efe6cf', fg: '#22313a', w: 512, h: 384, font: 'mono' }), 0.55, true));
  // seven racks, one per year
  const years = [91, 92, 93, 94, 95, 96, 97];
  years.forEach((yy, i) => {
    const z = -25.3 - i * 2.15;
    b.prop(R.archiveRack(m, 6.4, String(yy), 200 + yy, yy === 94 ? 4 : -1), 12.4, 0, z, 0);
    const hit = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.2, 0.8), new THREE.MeshBasicMaterial({ visible: false }));
    hit.userData.noBatch = true;
    b.prop(hit, 9.15, 1.2, z, 0, { collide: false, static: false });
    g.interact.add({
      id: 'rack' + yy,
      object: hit,
      kind: 'use',
      prompt: () => `Стеллаж 19${yy}`,
      onUse: () => openRack(g, yy),
    });
  });
  // reading table with the deep-layer folder
  b.prop(F.table(m, 1.6, 0.8, 0.75, '#5c4a3a'), 7.2, 0, -39, Math.PI / 2);
  b.prop(F.chair(m, '#3a3f42', '#3a3f42'), 8.1, 0, -39, -Math.PI / 2);
  documentProp(g, b, 'hale_on_lying', 7.1, 0.76, -38.6, 0.3, 'sheet');
  documentProp(g, b, 'quiet_night_order', 7.2, 0.76, -39.5, -0.2, 'clipboard');
  const dl = R.deskLamp(m);
  b.prop(dl.group, 7.0, 0.75, -38.0, Math.PI / 2, { collide: false });
  b.light(7.0, 1.1, -38.3, { color: '#ffd59a', intensity: 3.5, distance: 5, emissives: [dl.bulb], emissiveBase: 2, flicker: 'buzz' });
  b.prop(F.cardboardBox(m, 0.5, 0.35, 0.4, true), 6.6, 0, -36.6, 0.3);
  b.prop(filmReel(m), 7.3, 0.77, -39.3, 0.4, { collide: false });
  lamp(g, b, 'cage', 7.2, 3.3, -24, { intensity: 5, distance: 7, flicker: 'buzz' });
  lamp(g, b, 'cage', 7.2, 3.3, -31, { intensity: 4, distance: 6, on: false });
  lamp(g, b, 'cage', 7.2, 3.3, -36.5, { intensity: 3.5, distance: 6, flicker: 'dying' });
  b.sound('drip', 15, 2, -39, 0.2);
}

function openRack(g: Game, yy: number): void {
  const fields = [
    { label: 'Полка (месяц)', options: MONTHS.map((n, i) => [String(i + 1), n] as [string, string]) },
    { label: 'Ячейка (№ субъекта)', options: Array.from({ length: 40 }, (_, i) => [String(i + 1), '№' + String(i + 1).padStart(2, '0')] as [string, string]) },
  ];
  const text =
    yy === 91
      ? 'Почти пусто. На полках — наклейки «ЗАПУСК ЯДРА 14.03.91» и коробки с надписью «ПЕРВЫЕ СЛОВА».'
      : yy === 97
        ? 'Стеллаж пуст. Только одна коробка без номера.'
        : `Стеллаж 19${yy}. Плёнки в жестяных коробках, на каждой — номер полки и ячейки.`;
  g.openScreen(
    new ChoiceScreen(g, `Стеллаж 19${yy}`, text, fields, 'Достать плёнку', ([mo, slot]) => {
      const month = Number(mo);
      const n = Number(slot);
      g.audio.play('impact_metal', { volume: 0.3, rate: 1.6 });
      if (yy === 97) return 'Коробка «03.11.97 — НЕ ПРОСМАТРИВАТЬ». Внутри — пепел и оплавленная катушка.';
      if (yy === 91) return n <= 3 ? 'Коробка «ПЕРВЫЕ СЛОВА». Пусто. Только бирка: «"Привет" — 14.03.91, 8:15».' : 'Пустая ячейка.';
      if (yy === 94 && month === 4 && n === 12) {
        if (g.state.has('reel') || g.state.solved('p7')) return 'Ячейка пуста. Плёнка КР-07 уже у меня.';
        g.state.markSolved('p7');
        g.giveItem('reel');
        g.co.start(hideAndSeek(g), 'zone');
        return null;
      }
      if (yy === 94 && month === 4 && n === 3) return 'Коробка КР-03. Пустая — плёнку уже доставали. На крышке карандашом: «стереть в 10:14».';
      if (yy === 94 && month === 4) return `Апрель 94, №${String(n).padStart(2, '0')}. Обычная сессия дружбы, не КР. Не то.`;
      if (yy === 94 && n === 12) return `Сессии №12 за ${MONTHS[month - 1]}: смех, рисунки, песенка. Обычная дружба. КР-07 была в другом месяце.`;
      if (month === 4 && n === 12) return `В апреле 19${yy} года №12 сюда ещё не приходил — или уже не приходил.`;
      return n % 7 === 0 ? 'Пустая ячейка. Внутри только этикетка: «ИЗЪЯТО Т.Л.»' : `Плёнка «Сессия дружбы, субъект №${String(n).padStart(2, '0')}». Не та.`;
    }),
  );
}

// =====================================================================
// hide-and-seek (non-lethal stealth)
// =====================================================================

const SEEK_SPAWNS = [
  new THREE.Vector3(0, 0, 3),
  new THREE.Vector3(-18, 0, -42),
  new THREE.Vector3(18, 0, -42),
  new THREE.Vector3(-18, 0, -2),
  new THREE.Vector3(18, 0, -2),
  new THREE.Vector3(-10, 0, -20),
];
const COUNT = ['Раз…', 'Два…', 'Три…', 'Четыре…', 'Пять…', 'Шесть…', 'Семь…', 'Восемь…', 'Девять…'];

function* hideAndSeek(g: Game): CoGen {
  g.canSave = false;
  g.director.bump();
  yield 1.2;
  g.audio.play('static_burst', { volume: 0.4 });
  yield 0.5;
  yield g.say('verity', 'Ой! Ты нашёл кино!', { degrade: 1 });
  yield g.say('verity', 'Тогда давай сначала поиграем. В прятки! Как раньше. Я вожу!', { degrade: 1 });
  g.objective('Спрятаться');
  if (g.state.is('bracelet.on')) g.ui.hud.subtitle('Браслет. Он всегда знает, где браслет. [B] — выключить.', 5);
  g.music.play('anxious', { fade: 3, volume: 0.35 });
  for (let i = 0; i < COUNT.length; i++) {
    g.say('verity', COUNT[i], { degrade: i > 6 ? 2 : 1 });
    g.lights.master = 1 - (i + 1) * 0.055;
    yield 1.6;
  }
  yield g.say('verity', 'Десять. Кто не спрятался — я не виноват!', { degrade: 2 });
  // he appears as far from you as possible
  const pl = g.player.pos;
  const at = SEEK_SPAWNS.slice().sort((a, b2) => b2.distanceTo(pl) - a.distanceTo(pl))[0];
  const v = g.verity;
  v.stage = 2;
  v.spawn(at, 0, 'scripted');
  v.huntSpeed = 1.75;
  v.chaseSpeed = 3.9;
  v.catchLine = 'Нашёл!';
  let caught = false;
  v.onCatch = () => {
    caught = true;
  };
  v.startHunt();
  v.setMood('happy');
  g.audio.play('boing', { pos: at, volume: 0.6, ref: 5 });
  const taunts = ['Где ты? Я слышу, как ты дышишь.', 'Тепло… Холодно… Тепло!', 'Ты раньше всегда прятался за шторой. Тут нет штор.', 'Не уходи далеко. Мне нельзя за тобой далеко.'];
  let t = 0;
  let next = 12;
  let ti = 0;
  while (!caught && (t < 70 || (v.state === 'chase' && t < 95))) {
    const dt = 0.1;
    t += dt;
    if (t > next && v.visible && v.state !== 'chase') {
      next = t + 13 + Math.random() * 5;
      v.say(taunts[ti++ % taunts.length], { degrade: 2 });
    }
    yield dt;
  }
  v.onCatch = null;
  if (caught) {
    g.player.movementLocked = true;
    g.player.lookAt(v.pos.clone().setY(v.pos.y + 0.8), 6);
    v.stop();
    v.expression('open');
    v.setMood('happy');
    g.music.stop(0.5);
    yield v.say('Нашёл! Нашёл-нашёл-нашёл!', { degrade: 1 });
    v.expression('smile');
    yield v.say('Теперь ты водишь…', { degrade: 2 });
    yield 0.4;
    v.expression('flat');
    yield v.say('Нет. Не води. Просто постой так. Ещё секундочку.', { degrade: 2 });
    g.state.set('research.seekCaught');
  } else {
    v.stop();
    v.setMood('sad');
    g.music.stop(2);
    yield v.say('Ты так хорошо прячешься…', { degrade: 2 });
    yield v.say('Как тогда. Тогда тебя тоже не нашли.', { degrade: 2 });
  }
  // lights out, he is gone
  g.lights.master = 0;
  g.flashlight.suppressed = 1;
  g.audio.play('roll_loop', { pos: v.pos, volume: 0.4 })?.stop(1.2);
  yield 1.2;
  v.hide();
  v.stage = 1;
  g.lights.master = 1;
  g.flashlight.suppressed = 0;
  g.player.movementLocked = false;
  g.state.set('research.seek');
  g.canSave = true;
  yield 1;
  g.objective('Посмотреть плёнку КР-07 — проекционная, коридор Д');
  g.checkpoint('research.seek');
}

// =====================================================================
// projection room: the KR-07 film
// =====================================================================

function projection(g: Game, b: LevelBuilder, refs: Refs): void {
  const m = g.mats;
  new Door(g, b, { id: 'r_proj', x: 4.5, z: -40, axis: 'x', style: 'office', label: 'ПРОЕКЦИОННАЯ' });
  // screen on the west wall
  const sc = document.createElement('canvas');
  sc.width = 512;
  sc.height = 320;
  const sg = sc.getContext('2d', { willReadFrequently: true })!;
  sg.fillStyle = '#d8d4c8';
  sg.fillRect(0, 0, 512, 320);
  const smat = m.canvasMaterial(sc, { emissive: 0.06, rough: 0.95 });
  const sm = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.0), smat);
  sm.rotation.y = Math.PI / 2;
  sm.position.set(-3.86, 1.65, -37);
  b.addDynamic(sm);
  const frame = new ModelBuilder();
  const fm = m.painted('#111', 0.6);
  frame.add(box(0.04, 0.08, 3.3), fm, 0, 1.04, 0);
  frame.add(box(0.04, 0.08, 3.3), fm, 0, -1.04, 0);
  frame.add(box(0.04, 2.16, 0.08), fm, 0, 0, 1.64);
  frame.add(box(0.04, 2.16, 0.08), fm, 0, 0, -1.64);
  b.prop(frame.group, -3.87, 1.65, -37, 0, { collide: false });
  refs.screen = { canvas: sc, tex: smat.map as THREE.CanvasTexture, pos: new THREE.Vector3(-3.8, 1.65, -37), mat: smat };
  // seats
  for (const x of [-0.6, 1.0])
    for (let i = 0; i < 4; i++) b.prop(theaterSeat(m, i === 3 && x > 0, '#5a2a2a'), x, 0, -38.6 + i * 0.6 + (i > 1 ? 0.4 : 0), -Math.PI / 2);
  // projector on its stand, aimed at the screen
  const pj = R.projector(m);
  b.prop(pj.group, 3.4, 0, -37, Math.PI / 2, { static: false });
  refs.reels = pj.reels;
  const lens = new THREE.Vector3(3.4 - 0.37, 1.08, -37);
  refs.beam = b.spot(lens.x, lens.y, lens.z, -3.8, 1.65, -37, { color: '#fff4e0', intensity: 30, distance: 9, angle: 0.24, penumbra: 0.3, on: false, priority: 3 });
  refs.beamCone = lightCone(g, b, lens, new THREE.Vector3(-3.8, 1.65, -37), 1.1, 0xfff4e0, 0.07, refs.beam);
  refs.projRunning = false;
  b.update((dt) => {
    if (!refs.projRunning) return;
    for (const r of refs.reels) r.rotation.x -= dt * 4;
  });
  g.interact.add({
    id: 'projector',
    object: pj.group,
    kind: 'use',
    prompt: () => {
      if (refs.projRunning) return null;
      if (g.state.is('research.film')) return 'Осмотреть проектор';
      return g.state.has('reel') ? 'Зарядить плёнку КР-07' : 'Кинопроектор 16 мм';
    },
    onUse: () => {
      if (g.state.is('research.film')) {
        g.ui.hud.subtitle('Плёнка сгорела прямо в кадре. В воздухе ещё пахнет жжёным целлулоидом.', 4);
        return;
      }
      if (!g.state.has('reel')) {
        g.ui.hud.subtitle('Проектор исправен, лампа цела. Не хватает только плёнки.', 4);
        if (!g.state.is('research.archiveOpen')) g.objective('Найти, что здесь показывали');
        return;
      }
      g.co.start(filmScene(g, refs), 'zone');
    },
  });
  lamp(g, b, 'sconce', -3.88, 1.9, -34.8, { ry: Math.PI / 2, intensity: 2, distance: 4 });
  lamp(g, b, 'sconce', -3.88, 1.9, -39.2, { ry: Math.PI / 2, intensity: 2, distance: 4, flicker: 'dying' });
  lamp(g, b, 'sconce', 5.88, 1.9, -36, { ry: -Math.PI / 2, intensity: 2, distance: 4 });
  b.prop(FX.paperOnWall(m, poster('show', 512, 724, 0.5, 33), 0.6), 5.88, 1.6, -38.6, -Math.PI / 2, { collide: false });
}

function* filmScene(g: Game, refs: Refs): CoGen {
  g.canSave = false;
  g.state.removeItem('reel');
  g.audio.play('tape_click', { pos: new THREE.Vector3(3.4, 1.2, -37), volume: 0.7, rate: 0.7 });
  yield 0.8;
  g.audio.play('switch', { pos: new THREE.Vector3(3.4, 1.2, -37), volume: 0.6 });
  refs.projRunning = true;
  refs.beam.setOn(true);
  g.player.lookAt(refs.screen.pos, 2.5);
  g.music.stop(1);
  // house lights down
  for (let i = 0; i < 20; i++) {
    g.lights.master = 1 - i * 0.04;
    yield 0.05;
  }
  g.player.movementLocked = true;
  refs.screen.mat.emissiveIntensity = 0.9;
  yield* playFilm(g, refs.screen.canvas, refs.screen.tex, kr07Shots(), refs.screen.pos);
  // white-out, then nothing
  const ctx = refs.screen.canvas.getContext('2d')!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, refs.screen.canvas.width, refs.screen.canvas.height);
  refs.screen.tex.needsUpdate = true;
  refs.screen.mat.emissiveIntensity = 0.06;
  refs.projRunning = false;
  refs.beam.setOn(false, true);
  g.lights.master = 0;
  g.flashlight.suppressed = 1;
  g.audio.play('static_burst', { volume: 0.5 });
  g.state.set('research.film');
  yield 1.6;
  yield g.say('verity', 'Ты помнишь?', { degrade: 2 });
  yield 0.6;
  yield g.say('verity', 'Я — помню. Я помню всё, что меня просили забыть.', { degrade: 2 });
  yield 1.2;
  g.ui.hud.subtitle('Синяя собака. Оранжевая куртка. «Я вернусь».', 4);
  yield 4;
  g.ui.hud.subtitle('Это был я. Двенадцатый — это я.', 4.5);
  g.music.sting('reveal');
  yield 4.5;
  g.player.movementLocked = false;
  // flashlight sputters back; he is at the door
  g.flashlight.suppressed = 0;
  g.flashlight.flicker(1.2, 0.8);
  g.lights.master = 0.35;
  const door = new THREE.Vector3(4.5, 0, -39.3);
  g.audio.play('door_creak', { pos: door.clone().setY(1.2), volume: 0.6 });
  g.verity.stage = 2;
  g.verity.watch(door, { vanishDist: 1.6, maxTime: 9, yaw: 0 });
  g.verity.setMood('lonely');
  g.verity.expression('sad');
  g.addFear(0.35);
  yield 1.4;
  if (g.verity.state === 'watch') g.verity.say('Ты же не уйдёшь снова?', { degrade: 2 });
  while (g.verity.state === 'watch') yield 0.1;
  g.lights.master = 1;
  yield 1.2;
  // far away, a lock clicks
  g.state.set('research.bridgeOpen');
  refs.bridgeDoor.refreshLock();
  refs.bridgeDoor.setOpen(true);
  g.audio.play('lock_open', { pos: refs.bridgeDoor.pos.clone().setY(1.2), volume: 1, ref: 12 });
  g.audio.play('door_creak', { pos: refs.bridgeDoor.pos.clone().setY(1.2), volume: 0.8, ref: 12 });
  yield 1;
  g.ui.hud.subtitle('Где-то в конце коридора Б щёлкнул замок. Дверь с надписью «ИГРОВАЯ».', 5);
  g.canSave = true;
  g.objective('Идти в Игровую — дверь в конце коридора Б');
  g.checkpoint('research.film');
}

// =====================================================================
// staff lounge
// =====================================================================

function lounge(g: Game, b: LevelBuilder): void {
  const m = g.mats;
  new Door(g, b, { id: 'r_lounge', x: -10, z: -40, axis: 'x', style: 'office', label: 'КОМНАТА ОТДЫХА' });
  b.prop(F.sofa(m, 2.0, '#4e6b6f'), -13.5, 0, -35.6, Math.PI);
  b.prop(F.table(m, 1.0, 0.6, 0.45, '#8a6a4a'), -13.5, 0, -37, 0);
  documentProp(g, b, 'irina_resignation', -13.4, 0.46, -37, 0.4, 'sheet');
  b.prop(F.mug(m, '#c3b1e1'), -13.0, 0.45, -37.1, 0, { collide: false });
  b.prop(F.crtTV(m, false), -15.5, 0, -37, Math.PI / 2);
  b.prop(F.table(m, 1.8, 0.6, 0.9, '#d8d2c4'), -6.0, 0, -35.0, Math.PI);
  b.prop(F.mug(m, '#f2eadb'), -6.3, 0.9, -35.0, 0, { collide: false });
  b.prop(F.mug(m, '#c0392b'), -5.8, 0.9, -34.9, 0, { collide: false });
  b.prop(F.vendingMachine(m, '#2f5d62', 'КОФЕ'), -4.55, 0, -38.2, -Math.PI / 2);
  for (let i = 0; i < 3; i++) hideLocker(g, b, 'lounge_locker' + i, -9.6 + i * 0.6, 0, -34.45, Math.PI, '#7d8a8c');
  b.prop(FX.paperOnWall(m, scrawl('НОЯБРЬ 1997\n3 — вечерняя песня в 19:00\n(последняя)', { w: 512, h: 384, color: '#222', size: 44 }), 0.45, true), -7.5, 1.6, -34.12, Math.PI, { collide: false });
  lamp(g, b, 'troffer', -10, 3, -37, { intensity: 7, distance: 7, flicker: 'buzz', color: '#f2f0e6' });
}

// =====================================================================
// bridge to the playland
// =====================================================================

function bridge(g: Game, b: LevelBuilder, refs: Refs): void {
  const m = g.mats;
  refs.bridgeDoor = new Door(g, b, {
    id: 'r_bridge',
    x: -18,
    z: -44,
    axis: 'x',
    width: 1.4,
    height: 2.2,
    style: 'kids',
    color: '#ef8a7e',
    label: 'ИГРОВАЯ',
    aiPassable: false,
    lock: () => (g.state.is('research.bridgeOpen') ? null : 'Заперто. Над дверью — потухшая надпись «ИГРОВАЯ»'),
  });
  // string lights that still blink
  const bulbs: THREE.MeshStandardMaterial[] = [];
  const sl = new ModelBuilder();
  const cols = ['#f4d35e', '#ef8a7e', '#7fb2b0', '#8fb8ff'];
  for (let i = 0; i < 16; i++) {
    const z = -44.6 - i * 0.58;
    const x = i % 2 ? -19.8 : -16.2;
    const bm = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: new THREE.Color(cols[i % 4]), emissiveIntensity: 1.5 });
    bulbs.push(bm);
    sl.add(cyl(0.03, 0.03, 0.06, 8), bm, x, 2.6 - Math.sin((i % 2 ? 0.5 : 0) + i * 0.4) * 0.1, z);
  }
  b.prop(sl.group, 0, 0, 0, 0, { collide: false, static: false });
  let bt = 0;
  b.update((dt) => {
    bt += dt;
    bulbs.forEach((bm, i) => (bm.emissiveIntensity = 0.3 + Math.max(0, Math.sin(bt * 2 + i * 0.9)) * 1.8));
  });
  b.light(-18, 2.4, -49, { color: '#ffb36a', intensity: 4, distance: 7, flicker: 'pulse' });
  b.prop(FX.paperOnWall(m, poster('friend', 512, 724, 0.7, 51), 0.7), -16.12, 1.5, -48, -Math.PI / 2, { collide: false });
  b.prop(FX.paperOnWall(m, childDrawing('goodbye', 53), 0.5, true, 0.1), -19.88, 1.3, -50.5, Math.PI / 2, { collide: false });
  b.prop(FX.signPanel(m, 'ИГРОВАЯ «ВРЕМЯ ВЕРИТИ»', { bg: '#2fa79b', fg: '#fff6d8', w: 1024, h: 128, width: 2.4, font: 'brand' }), -18, 2.6, -53.88, 0, { collide: false });
  b.trigger('to_playland', -20, 0, -54, -16, 2.5, -52.2, {
    when: () => g.state.is('research.bridgeOpen'),
    onEnter: () => {
      g.state.set('research.done');
      g.loadZone('playland', 'start').catch(() => g.notify('Продолжение следует…'));
    },
  });
}

// =====================================================================
// director
// =====================================================================

function directorEvents(g: Game): void {
  g.director.add({
    id: 'res_far_door',
    gap: 80,
    when: () => g.player.pos.z > -6 && !g.state.is('research.seek'),
    run: () => g.audio.play('door_close', { pos: new THREE.Vector3(18, 1.2, -40), volume: 0.6, ref: 8 }),
  });
  g.director.add({
    id: 'res_ceiling_roll',
    gap: 90,
    once: true,
    when: () => g.state.is('research.login') && !g.state.is('research.seek'),
    run: () => {
      const p = g.player.pos.clone().add(new THREE.Vector3(0, 3.2, 0));
      g.audio.play('roll_loop', { pos: p.clone().add(new THREE.Vector3(-3, 0, 0)), volume: 0.35, ref: 3 })?.stop(2.5);
      setTimeout(() => g.ui.hud.subtitle('Над потолком что-то прокатилось. Что-то круглое.', 4), 2600);
    },
  });
  g.director.add({
    id: 'res_counter_beep',
    gap: 60,
    when: () => Math.abs(g.player.pos.z + 2) < 3 && g.player.pos.x > 0,
    run: () => g.audio.play('keypad_beep', { pos: new THREE.Vector3(11, 2.2, -9.8), volume: 0.4, rate: 0.6 }),
  });
}

function roundRug(): HTMLCanvasElement {
  const [c, g] = canvas(512, 512);
  g.clearRect(0, 0, 512, 512);
  const cols = ['#2fa79b', '#f4d35e', '#ef8a7e', '#f7f2e6', '#2fa79b'];
  cols.forEach((col, i) => {
    g.fillStyle = col;
    g.beginPath();
    g.arc(256, 256, 250 - i * 46, 0, Math.PI * 2);
    g.fill();
  });
  const r = new Rng(12);
  g.fillStyle = 'rgba(40,30,20,0.18)';
  for (let i = 0; i < 400; i++) g.fillRect(r.range(30, 480), r.range(30, 480), r.range(1, 6), r.range(1, 6));
  g.globalCompositeOperation = 'destination-in';
  g.beginPath();
  g.arc(256, 256, 250, 0, Math.PI * 2);
  g.fill();
  g.globalCompositeOperation = 'source-over';
  return c;
}
