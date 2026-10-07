import * as THREE from 'three';
import type { ZoneDef } from './types';
import type { Game } from '../Game';
import type { LevelBuilder } from '../world/LevelBuilder';
import type { CoGen } from '../core/Coroutines';
import type { VLight } from '../render/LightManager';
import type { Collider } from '../physics/CollisionWorld';
import { Door, lamp, documentProp, tapePlayer, inspect, pickup, hideLocker, hideSpot, lever } from '../world/entities';
import * as F from '../models/furniture';
import * as FX from '../models/fixtures';
import * as K from '../models/kids';
import * as I from '../models/industry';
import { curtain, cake, balloon } from '../models/lobby';
import { plushVerity } from '../models/items';
import { canvas, childDrawing, drawVerity, photo, poster, scrawl, sign, stain } from '../assets/Signage';
import { DialogueScreen } from '../ui/screens/Dialogue';
import { carouselInit, carouselPress, carouselProgress, BELLS, BELL_COLOR, BELL_NAME, BELL_NOTE, type Bell, type CarouselState } from '../puzzles/carousel';
import { shadowInit, shadowMove, shadowFlip, PUPPETS, SHADOW_TARGET, SLOTS, type PuppetId, type ShadowState } from '../puzzles/shadow';
import { dust, lightCone } from '../world/vfx';
import { box, cyl, ModelBuilder, rbox } from '../world/geom';
import { Rng } from '../assets/noise';

interface Refs {
  hallLights: VLight[];
  stageSpot: VLight;
  curtainL: THREE.Mesh;
  curtainR: THREE.Mesh;
  curtainOpen: number;
  carousel: K.CarouselModel;
  carouselSpeed: number;
  carouselLight: VLight;
  foyerShutter: Door;
  staffDoor: Door;
  dockShutter: { mesh: THREE.Mesh; col: Collider; t: number; target: number };
  kitchenLights: VLight[];
  chair: THREE.Object3D;
}

const PA = new THREE.Vector3(0, 8, -20);
const STAGE = new THREE.Vector3(0, 1.0, -38.6);

export const playland: ZoneDef = {
  id: 'playland',
  name: 'Игровая',
  chapter: 'Акт IV. Друг',
  materials: [
    'floor_checker', 'floor_terrazzo', 'wall_wallpaper_kids', 'tile_pastel', 'ceiling_tiles', 'concrete_dark', 'concrete', 'wood_dark', 'wood_floor', 'wall_plaster_dark',
    'brick_old', 'tile_white', 'tile_floor_dark', 'metal_dark', 'metal_white', 'linoleum_beige', 'playmat', 'grate', 'diamond_plate', 'fabric_red', 'wall_plaster_peach', 'rubber',
  ],
  nav: { minX: -43, minZ: -47, maxX: 41, maxZ: 8, probeY: 2.4 },
  build(g, b) {
    const env = b.zone.env;
    env.fogColor.set(0x0c0a0d);
    env.fogDensity = 0.032;
    env.ambient.set(0x5a4a60);
    env.ambientIntensity = 0.07;
    env.hemiSky.set(0x8a7aa0);
    env.hemiGround.set(0x201814);
    env.hemiIntensity = 0.12;
    env.reverb = 'hall';
    env.ambience = ['room_loop', 'hum_loop'];
    env.envMap = 'kids';
    env.envIntensity = 0.35;

    rooms(b);
    const refs = {} as Refs;
    (b.zone as any).refs = refs;
    foyer(g, b, refs);
    hall(g, b, refs);
    carouselArea(g, b, refs);
    stage(g, b, refs);
    shadowTheatre(g, b);
    theoRoom(g, b);
    partyRooms(g, b);
    kitchen(g, b, refs);
    dock(g, b);
    directorEvents(g);

    dust(g, b, new THREE.Vector3(-24, 0.3, -42), new THREE.Vector3(24, 9, 0), 1100, 0xffe8d0, 0.02);
    b.spawn('start', 0, 0, 7.6, 0);
    b.spawn('hall', 0, 0, -4, 0);
    b.spawn('carousel', 6, 0, -11, 0.8);
    b.spawn('stage', 0, 0, -30, 0);
    b.spawn('theo', -38, 0, -21, Math.PI / 2);
    b.spawn('kitchen', 28, 0, -8, 0);
    (b.zone as any).safe = new THREE.Vector3(0, 0, -4);
  },
  onEnter(g, spawn, restored) {
    if (restored) return;
    if (spawn === 'start' && !g.state.is('playland.entered')) {
      g.state.set('playland.entered');
      g.co.start(arrival(g), 'zone');
    }
  },
};

// =====================================================================
// layout
// =====================================================================

const KIDS = { floor: 'floor_checker', wall: 'wall_wallpaper_kids', ceil: 'ceiling_tiles', baseboard: 'wood_dark', wainscot: { mat: 'tile_pastel', height: 1.1 } };
const PARTY = { floor: 'linoleum_beige', wall: 'wall_plaster_peach', ceil: 'ceiling_tiles', baseboard: 'wood_dark', wainscot: { mat: 'tile_pastel', height: 1.0 } };

function rooms(b: LevelBuilder): void {
  b.room('foyer', { x: -5, z: 0, w: 10, d: 9, h: 3.4, ...KIDS });
  b.room('hall', { x: -24, z: -42, w: 48, d: 42, h: 10, floor: 'floor_terrazzo', wall: 'wall_wallpaper_kids', ceil: 'concrete_dark', baseboard: 'wood_dark', wainscot: { mat: 'tile_pastel', height: 1.2, rail: 'wood_dark' } });
  b.connect('hall', 'foyer', 0, 4, 3);
  b.opening('foyer', { side: 's', at: 0, width: 1.2, height: 2.2 });
  // west wing: shadow theatre + Theo's room behind it
  b.room('shadow', { x: -34, z: -26, w: 10, d: 10, h: 3.4, floor: 'wood_floor', wall: 'wall_plaster_dark', ceil: 'wall_plaster_dark', baseboard: 'wood_dark' });
  b.connect('shadow', 'hall', -21, 1.1, 2.2);
  b.room('theo', { x: -42, z: -25, w: 8, d: 8, h: 2.8, floor: 'wood_floor', wall: 'brick_old', ceil: 'concrete_dark', baseboard: null });
  b.connect('theo', 'shadow', -21, 1.1, 2.1);
  // back of house (the chase): corridor F → party rooms → kitchen → power → dock → stairs
  b.room('corF', { x: 10, z: -46, w: 22, d: 4, h: 3, floor: 'concrete', wall: 'wall_plaster_dark', ceil: 'concrete_dark', baseboard: null });
  b.connect('hall', 'corF', 13, 1.1, 2.2);
  b.room('p1', { x: 24, z: -42, w: 8, d: 10, h: 3, ...PARTY });
  b.room('p2', { x: 24, z: -32, w: 8, d: 10, h: 3, ...PARTY, wall: 'wall_wallpaper_kids' });
  b.room('p3', { x: 24, z: -22, w: 8, d: 10, h: 3, ...PARTY });
  b.connect('p1', 'corF', 28, 1.1, 2.2);
  b.connect('p1', 'p2', 28, 1.1, 2.2);
  b.connect('p2', 'p3', 28, 1.1, 2.2);
  for (const [id, z] of [['p1', -37], ['p2', -27], ['p3', -17]] as const) b.connect('hall', id, z, 1.1, 2.2);
  b.room('kitchen', { x: 24, z: -12, w: 10, d: 10, h: 3, floor: 'tile_floor_dark', wall: 'tile_white', ceil: 'ceiling_tiles', baseboard: null });
  b.connect('p3', 'kitchen', 28, 1.1, 2.2);
  b.connect('hall', 'kitchen', -6, 1.1, 2.2);
  b.room('power', { x: 34, z: -12, w: 6, d: 5, h: 3, floor: 'concrete', wall: 'metal_dark', ceil: 'concrete_dark', baseboard: null });
  b.connect('kitchen', 'power', -9.5, 1.1, 2.2);
  b.room('cold', { x: 34, z: -7, w: 4, d: 5, h: 2.8, floor: 'diamond_plate', wall: 'metal_white', ceil: 'metal_white', baseboard: null });
  b.connect('kitchen', 'cold', -4.5, 1.1, 2.2);
  b.room('dock', { x: 24, z: -2, w: 12, d: 10, h: 4.5, floor: 'concrete', wall: 'brick_old', ceil: 'concrete_dark', baseboard: null });
  b.connect('kitchen', 'dock', 30, 2.6, 2.7);
  b.room('stairs', { x: 30.6, z: 8, w: 3.2, d: 9, y: -3.6, h: 8.1, floor: 'concrete', wall: 'concrete_dark', ceil: 'concrete_dark', baseboard: null });
  b.opening('dock', { side: 's', at: 32.2, width: 2.6, height: 2.8, jambs: true });
  b.opening('stairs', { side: 'n', at: 32.2, width: 2.6, height: 2.8, sill: 3.6, jambs: false });
}

// =====================================================================
// foyer: turnstiles that still recognise friend #12
// =====================================================================

function foyer(g: Game, b: LevelBuilder, refs: Refs): void {
  const m = g.mats;
  new Door(g, b, { id: 'pl_back', x: 0, z: 9, axis: 'x', style: 'service', color: '#6c7a6e', label: 'ОТДЕЛ ГАРМОНИИ', lock: () => 'Захлопнулась. Обратно в Гармонию дороги нет.' });
  refs.foyerShutter = new Door(g, b, {
    id: 'pl_foyer_shutter',
    x: 0,
    z: 0,
    axis: 'x',
    width: 4,
    height: 3,
    style: 'security',
    open: true,
    aiPassable: false,
    lock: () => (g.state.is('playland.q3') ? 'Аварийная штора. Не поднять.' : null),
  });
  b.prop(F.ticketBooth(m), -3.6, 0, 6.6, Math.PI / 2);
  documentProp(g, b, 'party_booking', -3.0, 1.03, 6.2, Math.PI / 2, 'clipboard');
  b.prop(K.shoeCubbies(m, 4), 4.8, 0, 5.6, -Math.PI / 2);
  b.prop(K.shoeCubbies(m, 7), 4.8, 0, 3.6, -Math.PI / 2);
  documentProp(g, b, 'playland_rules', 4.88, 1.6, 7.6, -Math.PI / 2, 'none', FX.paperOnWall(m, poster('friend', 512, 724, 0.45, 61), 0.7));
  b.prop(FX.signPanel(m, 'ИГРОВАЯ «ВРЕМЯ ВЕРИТИ»', { bg: '#2fa79b', fg: '#fff6d8', w: 1024, h: 128, width: 3.6, font: 'brand' }), 0, 3.05, 0.12, 0, { collide: false });
  lamp(g, b, 'troffer', 0, 3.4, 5, { intensity: 6, distance: 7, flicker: 'buzz', color: '#ffe8c8' });
  lamp(g, b, 'exit', 0, 2.5, 8.88, { ry: Math.PI });
  // turnstiles across z = 3
  const arms: THREE.Object3D[] = [];
  for (const x of [-2.6, -0.75, 1.1]) {
    const t = F.turnstile(m);
    b.prop(t, x, 0, 3, 0, { static: false });
    arms.push(t.userData.arms as THREE.Object3D);
  }
  const gate = b.collider(-4.9, 0, 2.85, 4.9, 1.2, 3.15, { opaque: false });
  gate.enabled = !g.state.is('playland.turnstile');
  let spin = 0;
  b.update((dt) => {
    if (spin > 0) {
      spin -= dt;
      for (const a of arms) a.rotation.x += dt * 2.4;
    }
  });
  const reader = new ModelBuilder();
  reader.add(rbox(0.16, 0.2, 0.06, 0.01), m.plastic('#2a2e31', 0.4), 0, 0, 0);
  const led = new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff3020, emissiveIntensity: 2 });
  reader.add(box(0.1, 0.03, 0.01), led, 0, 0.06, 0.031);
  b.prop(reader.group, -0.75, 1.15, 3.36, 0, { collide: false, static: false });
  if (g.state.is('playland.turnstile')) led.emissive.setHex(0x30ff60);
  g.interact.add({
    id: 'pl_turnstile',
    object: reader.group,
    kind: 'use',
    prompt: () => (g.state.is('playland.turnstile') ? null : g.state.has('friend_card') ? 'Приложить карту друга №12' : 'Турникет'),
    onUse: () => {
      if (g.state.is('playland.turnstile')) return;
      g.state.set('playland.turnstile');
      g.audio.play('keypad_ok', { pos: reader.group.position, volume: 0.6 });
      led.emissive.setHex(0x30ff60);
      gate.enabled = false;
      spin = 1.2;
      g.co.start(
        (function* (): CoGen {
          yield 0.8;
          if (g.state.has('friend_card')) {
            yield g.say('pa', 'Друг номер двенадцать. Вход без очереди.', { pos: new THREE.Vector3(0, 3, 3) });
            yield 0.4;
            yield g.say('verity', 'Номер двенадцать… Это правда ты.', { degrade: 2, pos: new THREE.Vector3(0, 3, 3) });
          } else yield g.say('verity', 'Без карты? Ничего. Я тебя и так узнал.', { degrade: 2 });
        })(),
        'zone',
      );
    },
  });
}

function* arrival(g: Game): CoGen {
  yield 1.2;
  g.ui.hud.chapterCard('Акт IV', 'Друг', 6);
  yield 4;
  g.audio.play('static_burst', { volume: 0.35, pos: PA });
  yield 0.5;
  yield g.say('verity', 'Ты пришёл! Ты правда пришёл!', { degrade: 2, pos: PA });
  yield g.say('verity', 'Подожди-подожди, я включу свет. Тут было так красиво. Сейчас.', { degrade: 2, pos: PA });
  yield 0.6;
  const refs = (g.zone as any).refs as Refs;
  for (const l of refs.hallLights) {
    l.setOn(true);
    g.audio.play('breaker_on', { pos: l.position, volume: 0.5, ref: 8 });
    yield 0.45;
  }
  g.state.set('playland.lights');
  g.music.play('kind', { fade: 3, volume: 0.22 });
  yield 2;
  g.objective('Пройти в Игровую');
}

// =====================================================================
// main hall
// =====================================================================

function hall(g: Game, b: LevelBuilder, refs: Refs): void {
  const m = g.mats;
  refs.hallLights = [];
  for (const [x, z] of [
    [-14, -8],
    [14, -8],
    [-14, -30],
    [14, -30],
    [-6, -20],
    [6, -20],
    [0, -6],
  ]) {
    refs.hallLights.push(lamp(g, b, 'pendant', x, 10, z, { drop: 3.2, intensity: 34, distance: 15, color: '#ffe2b8', on: g.state.is('playland.lights'), flicker: x === 14 && z === -30 ? 'dying' : undefined }));
  }
  // coloured accents: the playland was never meant to be lit white
  b.light(-20, 2.5, -30, { color: '#ff7aa8', intensity: 5, distance: 9 });
  b.light(14, 4, -31, { color: '#5fe0cf', intensity: 6, distance: 10 });
  b.light(-6, 6, -40, { color: '#c3b1e1', intensity: 5, distance: 12, flicker: 'pulse' });
  b.prop(FX.signPanel(m, '★ ДРУЖБА НАВСЕГДА ★', { bg: '#1a1030', fg: '#ff9ad0', w: 1024, h: 128, width: 6, font: 'brand', emissive: 1.4 }), -23.85, 6.2, -20, Math.PI / 2, { collide: false });
  lamp(g, b, 'emergency', -23.88, 3, -6, { ry: Math.PI / 2, intensity: 4, distance: 7 });
  lamp(g, b, 'emergency', 23.88, 3, -34, { ry: -Math.PI / 2, intensity: 4, distance: 7 });
  lamp(g, b, 'exit', 13, 2.6, -41.88, { ry: 0 });
  // ceiling decorations
  const r = new Rng(404);
  for (let i = 0; i < 22; i++) {
    const kind = r.pick(['star', 'star', 'planet', 'moon'] as const);
    const col = r.pick(['#f4d35e', '#ef8a7e', '#7fb2b0', '#8fb8ff', '#c3b1e1']);
    b.prop(K.hangingDecor(m, kind, r.range(0.25, 0.55), col, r.range(1.2, 3.6)), r.range(-21, 21), 10, r.range(-39, -3), r.range(0, 6), { collide: false });
  }
  b.prop(K.bunting(m, [new THREE.Vector3(-23.8, 6.5, -4), new THREE.Vector3(-8, 5.2, -12), new THREE.Vector3(8, 5.2, -12), new THREE.Vector3(23.8, 6.5, -4)]), 0, 0, 0, 0, { collide: false });
  b.prop(K.bunting(m, [new THREE.Vector3(-23.8, 6.8, -30), new THREE.Vector3(-8, 5.6, -26), new THREE.Vector3(8, 5.6, -26), new THREE.Vector3(23.8, 6.8, -30)]), 0, 0, 0, 0, { collide: false });

  // ball pit (hide spot + a secret on the bottom)
  const pit = K.ballPit(m, 8, 6, 9);
  b.prop(pit.group, -15, 0, -10, 0);
  pit.balls.position.set(-15, 0, -10);
  b.addDynamic(pit.balls);
  const pitHit = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.3, 5.4), new THREE.MeshBasicMaterial({ visible: false }));
  b.prop(pitHit, -15, 0.45, -10, 0, { collide: false, static: false });
  hideSpot(g, b, pitHit, { id: 'ballpit', eye: new THREE.Vector3(-15, 0.52, -10), yaw: 0, yawRange: 1.2, pitchRange: 0.3, exit: new THREE.Vector3(-15, 0, -6.5) });
  inspect(g, b, null, -11.4, 0.6, -10, 'Я зарылся рукой в шарики до самого дна. Детский браслет «Друг» №27 и одна сандалия. Индикатор на браслете ещё мигает: «ПОИСК».', {
    prompt: 'Пошарить в шариках',
    secret: 'sec_ballpit',
    size: 0.6,
  });
  b.light(-15, 3.2, -10, { color: '#ffd0e8', intensity: 6, distance: 8 });

  // climbing frame
  b.prop(K.climbingFrame(m), 14, 0, -31, 0);
  // arcade row: one machine is still on
  const hs = arcadeScores();
  const cols = ['#3b2c63', '#2f5d8a', '#7a1f2b', '#2f6f6a', '#5a3a6a'];
  cols.forEach((c, i) => b.prop(F.arcadeCabinet(m, c, i === 2 ? hs : undefined), 23.35, 0, -5 - i * 1.4, -Math.PI / 2));
  b.light(22.4, 1.5, -7.8, { color: '#9a7aff', intensity: 3, distance: 5, flicker: 'pulse' });
  inspect(g, b, null, 23.0, 1.4, -7.8, 'Автомат «Верити-бег» включён. Таблица рекордов: десять раз «ВЕР». Последний рекорд поставлен сегодня в 03:12 ночи. Он играет сам с собой.', { secret: 'sec_arcade', size: 0.6 });
  b.sound('buzz_loop', 23, 1.4, -8, 0.1);
  // prize counter
  b.prop(K.prizeCounter(m, 5), -21.4, 0, -30, Math.PI / 2);
  b.prop(FX.signPanel(m, 'ПРИЗЫ', { bg: '#f4d35e', fg: '#7a1f2b', w: 512, h: 128, width: 1.6, font: 'brand' }), -23.85, 3.2, -30, Math.PI / 2, { collide: false });
  const tag = FX.paperOnWall(m, sign('1 000 000 БИЛЕТИКОВ\nОБНЯТЬ ВЕРИТИ\nПО-НАСТОЯЩЕМУ', { bg: '#fff6d8', fg: '#7a1f2b', w: 512, h: 320, font: 'brand' }), 0.35, false);
  b.prop(tag, -21.1, 1.15, -30.6, Math.PI / 2, { collide: false });
  inspect(g, b, null, -21.0, 1.15, -30.6, 'Главный приз: «1 000 000 билетиков — обнять Верити по-настоящему». Ниже, детской рукой: «я накоплю. №12».', { secret: 'sec_ticket', size: 0.4 });
  // cafe corner + the party video on a TV
  for (const [x, z] of [
    [12, -5],
    [16, -4.2],
    [19.5, -6],
  ]) {
    b.prop(F.kidTable(m, 1.0, 0.7, '#ef8a7e'), x, 0, z, 0.2);
    b.prop(F.kidChair(m, '#7fb2b0'), x - 0.7, 0, z, Math.PI / 2);
    b.prop(F.kidChair(m, '#f4d35e'), x + 0.7, 0, z + 0.1, -Math.PI / 2);
  }
  b.prop(K.counterUnit(m, 4), 18, 0, -0.45, Math.PI);
  const tv = F.crtTV(m, true, vhsScreen());
  b.prop(tv, 17, 0.9, -0.5, Math.PI, { collide: false, static: false });
  g.interact.add({
    id: 'pl_party_tv',
    object: tv,
    kind: 'listen',
    prompt: () => (g.state.data.logs.includes('party_tape') ? 'Пересмотреть кассету' : 'Видеокассета «Праздник Лизы»'),
    onUse: () => g.playLog('party_tape'),
  });
  b.prop(FX.signPanel(m, 'КАФЕ «ПОЛДНИК»', { bg: '#ef8a7e', fg: '#fff6d8', w: 512, h: 128, width: 1.8, font: 'brand' }), 18, 2.8, -0.12, Math.PI, { collide: false });
  // posters and children's drawings
  const pos: Array<[Parameters<typeof poster>[0], number, number, number, number]> = [
    ['time7', -23.88, 2.2, -16, Math.PI / 2],
    ['birthday', 23.88, 2.2, -22, -Math.PI / 2],
    ['smile', -10, 2.2, -0.12, Math.PI],
    ['show', 8, 2.2, -0.12, Math.PI],
  ];
  pos.forEach(([k, x, y, z, ry], i) => b.prop(FX.paperOnWall(m, poster(k, 512, 724, 0.55, 300 + i), 1.0), x, y, z, ry, { collide: false }));
  for (let i = 0; i < 6; i++) {
    const kinds = ['many_friends', 'verity_me', 'family', 'house', 'twelve', 'clock'] as const;
    b.prop(FX.paperOnWall(m, childDrawing(kinds[i], 400 + i), 0.55, true, 0.1), -23.88, 1.5 + (i % 2) * 0.5, -36 + i * 1.1, Math.PI / 2, { collide: false });
  }
  // locked doors of the party rooms and kitchen (from the hall side)
  for (const [id, z, label] of [
    ['pl_hp1', -37, '«ЗВЁЗДОЧКА»'],
    ['pl_hp2', -27, '«СИНЯЯ СОБАКА»'],
    ['pl_hp3', -17, '«КАРУСЕЛЬ»'],
  ] as const)
    new Door(g, b, { id, x: 24, z, axis: 'z', style: 'kids', color: '#ef8a7e', label, lock: () => 'Заперто. Табличка: «Идёт праздник! Не входить!»' });
  new Door(g, b, { id: 'pl_hk', x: 24, z: -6, axis: 'z', style: 'service', label: 'КУХНЯ', lock: () => 'Кухня. Заперто изнутри.' });
  for (let i = 0; i < 8; i++) {
    const rr = new Rng(900 + i);
    b.decal(m.canvasMaterial(stain(i % 2 ? 'scuff' : 'dirt', 900 + i), { transparent: true, rough: 0.4 }), rr.range(-20, 20), 0.004, rr.range(-38, -4), rr.range(1, 3), rr.range(1, 3), 'up', { rot: rr.range(0, 6) });
  }
  b.sound('room_loop', 0, 3, -20, 0.2);
}

function arcadeScores(): HTMLCanvasElement {
  const [c, g] = canvas(256, 208);
  g.fillStyle = '#05030a';
  g.fillRect(0, 0, 256, 208);
  g.fillStyle = '#f4d35e';
  g.font = "700 18px 'IBM Plex Mono', monospace";
  g.fillText('ВЕРИТИ-БЕГ', 70, 24);
  g.fillStyle = '#ef8a7e';
  g.font = "500 14px 'IBM Plex Mono', monospace";
  g.fillText('ЛУЧШИЕ ДРУЗЬЯ', 72, 44);
  g.fillStyle = '#9fe0ff';
  for (let i = 0; i < 10; i++) g.fillText(`${String(i + 1).padStart(2, ' ')}. ВЕР  ${String(999990 - i * 7).padStart(6, '0')}`, 40, 64 + i * 14);
  drawVerity(g, 226, 182, 14, { mood: 'happy', flat: true });
  return c;
}

function vhsScreen(): HTMLCanvasElement {
  const [c, g] = canvas(256, 192);
  g.fillStyle = '#1a2a6a';
  g.fillRect(0, 0, 256, 192);
  g.fillStyle = '#ffffff';
  g.font = "700 22px 'IBM Plex Mono', monospace";
  g.fillText('PLAY ▶', 20, 40);
  g.font = "500 16px 'IBM Plex Mono', monospace";
  g.fillText('03.11.97  18:58', 20, 170);
  return c;
}

// =====================================================================
// P8 — the carousel
// =====================================================================

function carouselArea(g: Game, b: LevelBuilder, refs: Refs): void {
  const m = g.mats;
  const st = g.state.puzzle<CarouselState>('p8', carouselInit);
  const car = K.carousel(m);
  b.prop(car.group, 0, 0, -20, 0, { static: false });
  refs.carousel = car;
  refs.carouselSpeed = st.done ? 0.35 : 0;
  refs.carouselLight = b.light(0, 3.2, -20, { color: '#ffd58a', intensity: 10, distance: 10, on: st.done, flicker: 'pulse' });
  car.bulbs.emissiveIntensity = st.done ? 2.2 : st.powered ? 0.4 : 0;
  let t = 0;
  b.update((dt) => {
    t += dt;
    const sp = refs.carouselSpeed;
    if (sp <= 0) return;
    car.rotor.rotation.y += dt * sp;
    car.mounts.forEach((mt, i) => (mt.position.y = 1.05 + Math.sin(t * 2.2 + i * 1.3) * 0.16));
    car.bulbs.emissiveIntensity = 1.6 + Math.sin(t * 6) * 0.6;
  });
  b.sound('motor_loop', 0, 0.5, -20, 0.25, { rate: 0.6, when: () => refs.carouselSpeed > 0 });

  // operator booth with the bell panel, facing the carousel
  const bx = 6.6;
  const bz = -13.8;
  const face = Math.atan2(bx - 0, bz - -20); // panel front (+z) points away from the carousel; operator looks at it
  const panel = K.bellPanel(m, BELLS.map((c) => BELL_COLOR[c]));
  b.prop(panel.group, bx, 0, bz, face);
  const canopy = new ModelBuilder();
  for (const [x, z] of [
    [-0.9, -0.6],
    [0.9, -0.6],
    [-0.9, 0.9],
    [0.9, 0.9],
  ])
    canopy.add(cyl(0.035, 0.035, 2.4, 8), m.steel('#c9a34a', 0.35), x, 1.2, z);
  const roofC = new THREE.CylinderGeometry(0.2, 1.5, 0.6, 4, 1);
  roofC.rotateY(Math.PI / 4);
  canopy.add(roofC, m.painted('#c0392b', 0.4), 0, 2.7, 0.15);
  b.prop(canopy.group, bx, 0, bz, face, { collide: false });
  b.prop(FX.signPanel(m, 'ЗВЁЗДНЫЙ КРУГ', { bg: '#7a1f2b', fg: '#f4d35e', w: 512, h: 96, width: 1.4, font: 'brand' }), bx, 2.25, bz, face, { collide: false });
  const toWorld = (lx: number, ly: number, lz: number) => new THREE.Vector3(lx, ly, lz).applyAxisAngle(new THREE.Vector3(0, 1, 0), face).add(new THREE.Vector3(bx, 0, bz));
  const manual = toWorld(0.55, 1.05, -0.2);
  documentProp(g, b, 'carousel_manual', manual.x, manual.y, manual.z, face + 0.3, 'sheet');
  // key switch
  const ks = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), new THREE.MeshBasicMaterial({ visible: false }));
  const kp = toWorld(-0.62, 1.1, 0.12);
  b.prop(ks, kp.x, kp.y, kp.z, face, { collide: false, static: false });
  const kh = new ModelBuilder();
  kh.add(cyl(0.035, 0.035, 0.03, 16), m.steel('#c9a34a', 0.3), 0, 0, 0, Math.PI / 2);
  const keyMesh = kh.add(box(0.012, 0.05, 0.06), m.steel('#e0c070', 0.2), 0, 0, 0.04);
  keyMesh.visible = st.powered;
  b.prop(kh.group, kp.x, kp.y, kp.z, face, { collide: false, static: false });
  g.interact.add({
    id: 'pl_carousel_key',
    object: ks,
    kind: 'use',
    prompt: () => (st.powered ? null : g.state.has('carousel_key') ? 'Вставить ключ карусели' : 'Замок питания карусели'),
    onUse: () => {
      if (!g.state.has('carousel_key')) {
        g.ui.hud.subtitle('Замочная скважина в форме звёздочки. Без ключа карусель не включить.', 4);
        if (!g.state.is('playland.needKey')) {
          g.state.set('playland.needKey');
          g.objective('Найти ключ от карусели');
        }
        return;
      }
      st.powered = true;
      keyMesh.visible = true;
      g.audio.play('lock_open', { pos: kp, volume: 0.6 });
      g.audio.play('breaker_on', { pos: kp, volume: 0.5 });
      car.bulbs.emissiveIntensity = 0.4;
      g.objective('Сыграть на колокольчиках позывной Верити');
      g.checkpoint('playland.key');
    },
  });
  // bells
  let wrongSince = 0;
  panel.bells.forEach((bell, i) => {
    const bc = BELLS[i] as Bell;
    g.interact.add({
      id: 'pl_bell_' + bc,
      object: bell,
      kind: 'use',
      prompt: () => (st.powered && !st.done ? `Колокольчик: ${BELL_NAME[bc]}` : null),
      onUse: () => {
        const wp = bell.getWorldPosition(new THREE.Vector3());
        g.music.note(BELL_NOTE[bc], { pos: wp, volume: 0.7, bell: true });
        bell.position.y -= 0.01;
        setTimeout(() => (bell.position.y += 0.01), 120);
        const res = carouselPress(st, bc);
        const prog = carouselProgress(st);
        panel.lamps.forEach((l, k) => (l.emissiveIntensity = k < prog ? 2.5 : 0));
        if (res === 'done') {
          g.state.markSolved('p8');
          g.co.start(carouselRuns(g, refs), 'zone');
          return;
        }
        wrongSince = prog === 0 ? wrongSince + 1 : wrongSince;
        if (wrongSince >= 10) {
          wrongSince = 0;
          g.co.start(
            (function* (): CoGen {
              yield 0.8;
              g.say('verity', 'Вре-мя Ве-ри-ти! Ну же, ты знаешь!', { degrade: 2, pos: new THREE.Vector3(0, 3, -20) });
              yield 0.6;
              g.music.motif({ pos: new THREE.Vector3(0, 3, -20), volume: 0.6 });
            })(),
            'zone',
          );
        }
      },
    });
  });
  panel.lamps.forEach((l, k) => (l.emissiveIntensity = st.done || k < carouselProgress(st) ? 2.5 : 0));

  // first meeting at the carousel
  b.trigger('pl_meet', -10, 0, -14, 10, 3, -3, {
    when: () => g.state.is('playland.turnstile') && !g.state.is('playland.met'),
    onEnter: () => {
      g.state.set('playland.met');
      g.co.start(firstMeeting(g), 'zone');
    },
  });
}

function honest(g: Game, truth: boolean | null): void {
  if (truth === null) g.state.inc('honesty.silent');
  else g.state.inc(truth ? 'honesty.truth' : 'honesty.lie');
}

/** Asks a question and waits; sets holder.v to the answer index (-1 = silence). */
function* ask(g: Game, q: string, options: string[], holder: { v: number }, timeout?: number, degrade = 2): CoGen {
  yield g.say('verity', q, { degrade, pos: g.verity.visible ? g.verity.pos.clone().setY(g.verity.pos.y + 0.9) : undefined });
  holder.v = -2;
  g.openScreen(new DialogueScreen(g, 'verity', q, options, (i) => (holder.v = i), { timeout, onTimeout: () => (holder.v = -1) }));
  yield () => holder.v !== -2;
}

function* firstMeeting(g: Game): CoGen {
  const v = g.verity;
  const at = new THREE.Vector3(0, 0, -14.6);
  v.stage = 2;
  v.spawn(at, 0, 'scripted');
  v.faceTo(g.player.pos);
  v.lookAtPlayer = true;
  v.setMood('happy');
  v.expression('smile');
  g.audio.play('boing', { pos: at, volume: 0.5 });
  g.music.motif({ pos: at.clone().setY(1), volume: 0.4 });
  g.addFear(0.2);
  yield 1.2;
  v.gesture('wave');
  yield v.say('Привет. Привет-привет-привет!', { degrade: 2 });
  v.gesture('none');
  yield v.say('Смотри, всё как было. Карусель, шарики, призы. Я всё сберёг.', { degrade: 2 });
  const a = { v: -2 };
  yield* ask(g, 'Ты меня помнишь?', ['Помню. Немного.', 'Конечно, помню!', 'Нет.'], a);
  if (a.v === 0) {
    honest(g, true);
    v.setMood('happy');
    yield v.say('Немного — это тоже много. Я помню за нас двоих.', { degrade: 2 });
  } else if (a.v === 1) {
    honest(g, false);
    v.setMood('sad');
    v.expression('flat');
    yield 1.2;
    yield v.say('…Ты говоришь, как они. Они тоже всегда говорили «конечно».', { degrade: 2 });
    v.expression('smile');
  } else {
    honest(g, false);
    v.setMood('curious');
    yield v.say('Неправда. Ты остановился у синей собаки. Я видел. Я всё вижу.', { degrade: 2 });
  }
  yield 0.4;
  yield v.say('Хочешь покататься? Карусель сломалась. Ключ был у Тео.', { degrade: 2 });
  v.gesture('point', new THREE.Vector3(-24, 1.5, -21));
  yield v.say('Тео всегда прятался за театром теней. Думал, я не знаю.', { degrade: 2 });
  v.gesture('none');
  yield 0.5;
  v.say('Я подожду тебя тут! Я хорошо жду!', { degrade: 2 });
  v.rolling = true;
  const done = v.moveTo(new THREE.Vector3(0, 0, -28), 3.2);
  yield () => done() || !v.visible;
  v.hide();
  v.rolling = false;
  g.objective('Найти ключ от карусели — театр теней, западное крыло');
  g.checkpoint('playland.met');
}

function* carouselRuns(g: Game, refs: Refs): CoGen {
  g.canSave = false;
  const car = refs.carousel;
  g.audio.play('breaker_on', { pos: new THREE.Vector3(0, 1, -20), volume: 0.8 });
  refs.carouselLight.setOn(true);
  g.music.stop(0.5);
  for (let i = 0; i <= 30; i++) {
    refs.carouselSpeed = (i / 30) * 0.35;
    yield 0.05;
  }
  g.music.play('kind', { fade: 1.5, volume: 0.5 });
  car.bulbs.emissiveIntensity = 2.2;
  yield 2.5;
  // he is riding the carousel
  const v = g.verity;
  v.stage = 2;
  v.spawn(new THREE.Vector3(0, 0, -20), 0, 'scripted');
  v.setMood('happy');
  v.expression('open');
  const mount = car.mounts[0];
  let riding = true;
  g.co.start(
    (function* (): CoGen {
      while (riding) {
        const p = mount.getWorldPosition(new THREE.Vector3());
        v.teleport(new THREE.Vector3(p.x, p.y - 0.1, p.z), car.rotor.rotation.y + Math.PI);
        yield null;
      }
    })(),
    'zone',
  );
  yield v.say('Ты помнишь песенку! Ты помнишь!', { degrade: 1 });
  yield 3;
  const a = { v: -2 };
  yield* ask(g, 'Ты пришёл ко мне? Или просто так?', ['Мне пришло письмо. Я не знал, куда еду.', 'Я пришёл за тобой.', 'Не знаю.'], a);
  if (a.v === 1) {
    honest(g, false);
    yield v.say('За мной… Мне бы хотелось, чтобы это была правда. Очень хотелось бы.', { degrade: 2 });
  } else {
    honest(g, true);
    yield v.say(a.v === 0 ? 'Письмо… Значит, кто-то ещё помнит. Хорошо. Хорошо, что ты сказал правду.' : '«Не знаю» — это честно. Тео тоже так говорил.', { degrade: 2 });
  }
  yield 0.6;
  yield v.say('А теперь — Время Верити! Как тогда! Иди к сцене!', { degrade: 2 });
  riding = false;
  yield null;
  v.hide();
  // curtains open, spotlight on the stage chair
  g.audio.play('motor_loop', { pos: STAGE.clone().setY(4), volume: 0.5, rate: 0.6 })?.stop(4);
  refs.curtainOpen = 1;
  refs.stageSpot.setOn(true);
  g.state.set('playland.carousel');
  g.canSave = true;
  g.objective('Подойти к сцене');
  g.checkpoint('playland.carousel');
}

// =====================================================================
// stage: the third question and the chase
// =====================================================================

function stage(g: Game, b: LevelBuilder, refs: Refs): void {
  const m = g.mats;
  b.solid('wood_floor', 0, 0, -38.5, 18, 1.0, 7, { tag: 'surf:wood' });
  b.solid('fabric_red', 0, 0, -34.96, 18, 0.95, 0.08, { collide: false });
  for (const x of [-7.6, 7.6]) b.stairs('wood_floor', x, -33, 0, 1.0, 2, 1.6, 'n');
  b.prop(FX.signPanel(m, 'ВРЕМЯ ВЕРИТИ', { bg: '#2fa79b', fg: '#f4d35e', w: 1024, h: 192, width: 8, font: 'brand' }), 0, 7.5, -41.85, 0, { collide: false });
  b.prop(FX.wallClock(m, 19, 0), 0, 5.2, -41.85, 0, { collide: false, scale: 6 });
  // the chair at centre stage
  const ch = new ModelBuilder();
  ch.add(rbox(1.2, 0.5, 1.0, 0.05), m.cloth('#7a1f2b', 0.4), 0, 0.45, 0);
  ch.add(rbox(1.2, 1.6, 0.25, 0.05), m.cloth('#7a1f2b', 0.4), 0, 1.0, -0.42);
  for (const sx of [-0.62, 0.62]) ch.add(rbox(0.2, 0.7, 1.0, 0.04), m.steel('#c9a34a', 0.3), sx, 0.6, 0);
  ch.add(cyl(0.2, 0.2, 0.08, 16), m.plastic('#f4d35e', 0.3), 0, 1.92, -0.42, Math.PI / 2);
  refs.chair = b.prop(ch.group, 0, 1.0, -39.6, 0);
  // curtains
  refs.curtainL = curtain(m, 9.2, 6.6);
  refs.curtainR = curtain(m, 9.2, 6.6);
  refs.curtainL.position.set(-9, 1.0, -35.3);
  refs.curtainR.position.set(9, 1.0, -35.3);
  refs.curtainR.rotation.y = Math.PI;
  b.addDynamic(refs.curtainL);
  b.addDynamic(refs.curtainR);
  refs.curtainOpen = g.state.is('playland.carousel') ? 1 : 0;
  let cur = refs.curtainOpen;
  const curCol = b.collider(-9, 1.0, -35.4, 9, 7.6, -35.2, { opaque: true, blocks: 'player' });
  b.update((dt) => {
    cur += (refs.curtainOpen - cur) * Math.min(1, dt * 0.8);
    const s = 1 - cur * 0.82;
    refs.curtainL.scale.x = s;
    refs.curtainR.scale.x = s;
    curCol.enabled = cur < 0.5;
  });
  b.solid('wall_plaster_dark', 0, 7.6, -35.3, 18.4, 0.6, 0.3, { collide: false });
  refs.stageSpot = b.spot(0, 9.5, -28, 0, 1.0, -39.4, { color: '#fff2d0', intensity: 120, distance: 18, angle: 0.22, penumbra: 0.5, on: g.state.is('playland.carousel') && !g.state.is('playland.q3'), priority: 3 });
  lightCone(g, b, new THREE.Vector3(0, 9.5, -28), new THREE.Vector3(0, 1.0, -39.4), 1.6, 0xfff2d0, 0.05, refs.stageSpot);
  for (const x of [-6, -2, 2, 6]) lamp(g, b, 'stage', x, 9.7, -32, { intensity: 0, on: false });
  // the staff door to the right of the stage
  refs.staffDoor = new Door(g, b, {
    id: 'pl_staff',
    x: 13,
    z: -42,
    axis: 'x',
    style: 'service',
    color: '#6c7a6e',
    label: 'ТОЛЬКО ДЛЯ ПЕРСОНАЛА',
    lock: () => (g.state.is('playland.q3') ? null : 'Заперто. Табличка: «Только для персонала»'),
  });
  // decorations: balloons tied along the stage front
  for (let i = 0; i < 7; i++) b.prop(balloon(m, ['#ef8a7e', '#f4d35e', '#7fb2b0', '#8fb8ff'][i % 4], 2.0 + (i % 3) * 0.3, i % 3 === 2), -8 + i * 2.6, 1.0, -35.6, 0, { collide: false });
  b.trigger('pl_stage', -8, 0, -34, 8, 3, -26, {
    when: () => g.state.is('playland.carousel') && !g.state.is('playland.q3'),
    once: false,
    onEnter: () => {
      const z = g.zone as any;
      if (z.stageRunning) return;
      z.stageRunning = true;
      g.checkpoint('playland.stage', { silent: true });
      g.co.start(stageScene(g, refs), 'zone');
    },
  });
}

function* stageScene(g: Game, refs: Refs): CoGen {
  g.canSave = false;
  const v = g.verity;
  v.stage = 2;
  v.spawn(STAGE.clone().setZ(-39.0), 0, 'scripted');
  v.lookAtPlayer = true;
  v.setMood('lonely');
  v.expression('smile');
  g.music.stop(1.5);
  yield 1.0;
  yield v.say('Все ушли в семь вечера. Все сразу. На середине песенки.', { degrade: 2 });
  yield v.say('А ты ушёл раньше. В десять четырнадцать. Я считал.', { degrade: 2 });
  yield 0.6;
  const a = { v: -2 };
  yield* ask(g, 'Ты останешься? Насовсем?', ['Нет. Я не могу остаться.', 'Да. Останусь.', 'Я не знаю.'], a, 12, 3);
  g.state.set('playland.q3');
  if (a.v === 0) {
    honest(g, true);
    yield v.say('Спасибо, что не соврал. Тогда я сделаю так, чтобы ты не смог уйти.', { degrade: 3 });
  } else if (a.v === 1) {
    honest(g, false);
    yield v.say('Ты врёшь. Я слышу, когда врут. Меня этому научили.', { degrade: 3 });
  } else if (a.v === 2) {
    honest(g, true);
    yield v.say('Не знаешь? Тогда я решу за тебя.', { degrade: 3 });
  } else {
    honest(g, null);
    yield v.say('Молчишь. Все молчали. Все одиннадцать тысяч.', { degrade: 3 });
  }
  // he comes apart
  v.stage = 3;
  v.setMood('angry');
  v.expression('grin');
  g.renderer.fx.glitch = 0.8;
  g.audio.play('glitch', { volume: 0.8 });
  g.music.sting('danger');
  refs.stageSpot.color.set('#ff2a1a');
  for (const l of refs.hallLights) l.flicker = 'strobe';
  refs.foyerShutter.setOpen(false);
  refs.foyerShutter.refreshLock();
  g.audio.play('metal_slam', { pos: new THREE.Vector3(0, 1.5, 0), volume: 1, ref: 10 });
  yield 0.5;
  g.renderer.fx.glitch = 0;
  refs.staffDoor.refreshLock();
  refs.staffDoor.setOpen(true);
  g.audio.play('metal_slam', { pos: refs.staffDoor.pos.clone().setY(1.2), volume: 1, ref: 8 });
  g.objective('БЕГИ. Дверь для персонала справа от сцены');
  g.ui.hud.subtitle('Штора над выходом рухнула. Открыта только служебная дверь.', 3);
  for (const l of refs.hallLights) l.flicker = 'dying';
  yield 1.4;
  g.music.play('chase', { fade: 0.3, volume: 0.6 });
  v.catchLine = 'Нашёл. Теперь ты останешься.';
  v.chaseSpeed = 4.05;
  v.startChase({ speed: 4.05, roll: true, line: 'Нашёл. Теперь ты останешься.' });
  g.state.set('playland.chase');
}

// =====================================================================
// P9 — shadow theatre
// =====================================================================

const SCREEN_X = -29;
const SCREEN_Z0 = -19.4; // audience-left (south) edge
const SCREEN_W = 3.2;
const slotZ = (slot: number) => SCREEN_Z0 - ((slot + 0.5) / SLOTS) * SCREEN_W;

function drawShadows(g2: CanvasRenderingContext2D, W: number, H: number, p: Record<PuppetId, { slot: number; flip: boolean }>, lit: boolean): void {
  const grd = g2.createRadialGradient(W * 0.5, H * 0.55, H * 0.1, W * 0.5, H * 0.5, W * 0.6);
  grd.addColorStop(0, lit ? '#fff1cf' : '#3a3228');
  grd.addColorStop(1, lit ? '#b98a4e' : '#14100c');
  g2.fillStyle = grd;
  g2.fillRect(0, 0, W, H);
  g2.fillStyle = 'rgba(25,18,12,0.92)';
  for (const id of PUPPETS) {
    const s = p[id];
    const ppm = id === 'verity' ? 230 : 250;
    K.drawPuppetShadow(g2, id, ((s.slot + 0.5) / SLOTS) * W, H * 0.93, ppm, s.flip, 1.5);
  }
}

function shadowTheatre(g: Game, b: LevelBuilder): void {
  const m = g.mats;
  const st = g.state.puzzle<ShadowState>('p9', shadowInit);
  new Door(g, b, { id: 'pl_shadow', x: -24, z: -21, axis: 'z', style: 'kids', color: '#3a6fd0', label: 'ТЕАТР ТЕНЕЙ' });
  // partition with the screen opening and a side passage backstage
  const wm = 'wall_plaster_dark';
  b.wall(wm, SCREEN_X, -26, SCREEN_X, -22.6, 0, 3.4, 0.2);
  b.wall(wm, SCREEN_X, -22.6, SCREEN_X, -19.4, 0, 0.9, 0.2);
  b.wall(wm, SCREEN_X, -22.6, SCREEN_X, -19.4, 2.9, 0.5, 0.2);
  b.wall(wm, SCREEN_X, -19.4, SCREEN_X, -18.2, 0, 3.4, 0.2);
  b.wall(wm, SCREEN_X, -18.2, SCREEN_X, -17.2, 2.2, 1.2, 0.2);
  b.wall(wm, SCREEN_X, -17.2, SCREEN_X, -16, 0, 3.4, 0.2);
  // the screen (seen from both sides, mirrored from the back)
  const [sc, sg] = canvas(512, 320);
  const smat = m.canvasMaterial(sc, { emissive: 0.9, rough: 0.95 });
  smat.side = THREE.DoubleSide;
  const tex = smat.map as THREE.CanvasTexture;
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(SCREEN_W, 2.0), smat);
  scr.rotation.y = Math.PI / 2;
  scr.position.set(SCREEN_X, 1.9, SCREEN_Z0 - SCREEN_W / 2);
  b.addDynamic(scr);
  b.collider(SCREEN_X - 0.05, 0.9, -22.6, SCREEN_X + 0.05, 2.9, -19.4, { opaque: true });
  const redraw = () => {
    drawShadows(sg, 512, 320, st.p, true);
    tex.needsUpdate = true;
  };
  redraw();
  // red velvet frame
  const fr = new ModelBuilder();
  const red = m.cloth('#7a1f2b', 0.4);
  fr.add(box(0.12, 0.25, 3.7), red, 0, 1.15, 0);
  fr.add(box(0.12, 2.3, 0.25), red, 0, 0, 1.72);
  fr.add(box(0.12, 2.3, 0.25), red, 0, 0, -1.72);
  b.prop(fr.group, SCREEN_X + 0.12, 1.9, SCREEN_Z0 - SCREEN_W / 2, 0, { collide: false });
  // audience benches + poster with the "lock picture"
  for (const x of [-27.4, -25.6]) b.prop(F.bench(m, 2.4, '#7a4e2d'), x, 0, -21, Math.PI / 2);
  const [pc, pg] = canvas(512, 420);
  pg.fillStyle = '#2a1f2f';
  pg.fillRect(0, 0, 512, 420);
  pg.fillStyle = '#f4d35e';
  pg.font = "700 34px 'Comfortaa', sans-serif";
  pg.textAlign = 'center';
  pg.fillText('ТЕАТР ТЕНЕЙ ТЕО', 256, 46);
  pg.font = "400 22px 'Comfortaa', sans-serif";
  pg.fillText('спектакль «Друзья встречаются»', 256, 78);
  const inner = document.createElement('canvas');
  inner.width = 420;
  inner.height = 262;
  drawShadows(inner.getContext('2d')!, 420, 262, SHADOW_TARGET, true);
  pg.drawImage(inner, 46, 100);
  pg.fillStyle = '#ef8a7e';
  pg.font = "400 20px 'Caveat', cursive";
  pg.fillText('«Покажи им эту картинку — и дверь откроется». Т.', 256, 398);
  const posterObj = FX.paperOnWall(m, pc, 1.1, true);
  b.prop(posterObj, -26.5, 1.7, -16.12, Math.PI, { collide: false });
  inspect(g, b, null, -26.5, 1.7, -16.2, 'Афиша спектакля «Друзья встречаются»: малыш и Верити держатся за руки, к ним бежит синяя собака. Подпись Тео: «Покажи им эту картинку — и дверь откроется».', { size: 0.8 });
  lamp(g, b, 'sconce', -24.12, 2.1, -18, { ry: -Math.PI / 2, intensity: 1.5, distance: 4, color: '#ffc98a' });
  // backstage: the lamp, the rails, the puppets, the control board
  const sl = FX.stageSpot(m, '#fff2d0');
  b.prop(sl.group, -33.4, 1.9, -21, -Math.PI / 2, { collide: false });
  b.spot(-33.2, 1.9, -21, SCREEN_X, 1.9, -21, { color: '#ffe8c0', intensity: 22, distance: 7, angle: 0.55, penumbra: 0.6, priority: 1.5 });
  b.prop(I.rail(m, [new THREE.Vector3(SCREEN_X - 0.6, 0.2, -22.6), new THREE.Vector3(SCREEN_X - 0.6, 0.2, -19.4)]), 0, 0, 0, 0, { collide: false });
  const puppets = {} as Record<PuppetId, THREE.Group>;
  for (const id of PUPPETS) {
    const p = K.puppetModel(m, id);
    b.prop(p, SCREEN_X - 0.6, 0.2, slotZ(st.p[id].slot), Math.PI / 2, { collide: false, static: false });
    p.scale.x = st.p[id].flip ? -1 : 1;
    puppets[id] = p;
  }
  b.update((dt) => {
    for (const id of PUPPETS) {
      const p = puppets[id];
      p.position.z += (slotZ(st.p[id].slot) - p.position.z) * Math.min(1, dt * 5);
      const sx = st.p[id].flip ? -1 : 1;
      p.scale.x += (sx - p.scale.x) * Math.min(1, dt * 8);
    }
  });
  // control board on the backstage north wall
  const board = new ModelBuilder();
  board.add(rbox(2.2, 0.8, 0.06, 0.02), m.woodProp('#5a3a22', 0.4), 0, 0, 0.03);
  b.prop(board.group, -31.5, 1.3, -25.88, 0, { collide: false });
  const names: Record<PuppetId, string> = { child: 'МАЛЫШ', verity: 'ВЕРИТИ', dog: 'СОБАКА' };
  PUPPETS.forEach((id, i) => {
    const x = -32.2 + i * 0.7;
    b.prop(FX.signPanel(m, names[id], { bg: '#2a1f12', fg: '#f4d35e', w: 256, h: 64, width: 0.5 }), x, 1.6, -25.8, 0, { collide: false });
    for (const [k, y, col, label] of [
      [0, 1.32, '#3a6fd0', 'сдвинуть'],
      [1, 1.08, '#c0392b', 'повернуть'],
    ] as const) {
      const btn = new ModelBuilder();
      btn.add(cyl(0.05, 0.05, 0.04, 16), m.plastic(col, 0.3), 0, 0, 0.02, Math.PI / 2);
      b.prop(btn.group, x, y, -25.82, 0, { collide: false, static: false });
      g.interact.add({
        id: `pl_puppet_${id}_${k}`,
        object: btn.group,
        kind: 'use',
        prompt: () => (st.done ? null : `${names[id]}: ${label}`),
        onUse: () => {
          g.audio.play('switch', { pos: btn.group.position, volume: 0.5 });
          if (k === 0) g.audio.play('servo', { pos: puppets[id].position, volume: 0.3, rate: 1.4 });
          const solved = k === 0 ? shadowMove(st, id) : shadowFlip(st, id);
          redraw();
          if (solved) {
            g.state.markSolved('p9');
            g.co.start(theatreOpens(g), 'zone');
          }
        },
      });
    }
  });
  // painted backdrop hiding the door to Theo's room
  const [bc, bg2] = canvas(512, 448);
  bg2.fillStyle = '#16203a';
  bg2.fillRect(0, 0, 512, 448);
  const rr = new Rng(77);
  for (let i = 0; i < 120; i++) {
    bg2.fillStyle = `rgba(255,240,200,${rr.range(0.3, 0.9)})`;
    bg2.beginPath();
    bg2.arc(rr.range(0, 512), rr.range(0, 448), rr.range(1, 3), 0, Math.PI * 2);
    bg2.fill();
  }
  bg2.fillStyle = '#f4e6b0';
  bg2.beginPath();
  bg2.arc(380, 110, 46, 0, Math.PI * 2);
  bg2.fill();
  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.8), m.canvasMaterial(bc, { rough: 0.9 }));
  backdrop.rotation.y = Math.PI / 2;
  backdrop.position.set(-33.88, 1.4, -21);
  b.addDynamic(backdrop);
  const bdCol = b.collider(-34.1, 0, -21.6, -33.85, 2.3, -20.4, { opaque: true });
  const opened = () => g.state.is('playland.theoDoor');
  if (opened()) {
    backdrop.position.y = 4.0;
    bdCol.enabled = false;
  }
  (b.zone as any).backdrop = { backdrop, bdCol };
  b.sound('buzz_loop', -33, 1.9, -21, 0.06);
}

function* theatreOpens(g: Game): CoGen {
  g.music.motif({ pos: new THREE.Vector3(SCREEN_X, 2, -21), volume: 0.5 });
  yield 1.5;
  g.ui.hud.subtitle('Тени на экране взялись за руки. Где-то за декорацией щёлкнула защёлка.', 4);
  g.audio.play('lock_open', { pos: new THREE.Vector3(-34, 1.2, -21), volume: 0.8 });
  const { backdrop, bdCol } = (g.zone as any).backdrop as { backdrop: THREE.Mesh; bdCol: Collider };
  g.audio.play('motor_loop', { pos: new THREE.Vector3(-34, 2.5, -21), volume: 0.5, rate: 0.8 })?.stop(2.4);
  for (let t = 0; t <= 1; t += 0.02) {
    backdrop.position.y = 1.4 + t * 2.6;
    yield 0.05;
  }
  bdCol.enabled = false;
  g.state.set('playland.theoDoor');
  g.objective('Осмотреть комнату за декорацией');
  g.checkpoint('playland.p9');
}

// =====================================================================
// Theo's hidden room
// =====================================================================

function theoRoom(g: Game, b: LevelBuilder): void {
  const m = g.mats;
  b.prop(K.cot(m), -41.2, 0, -21.5, 0);
  b.prop(F.desk(m, 1.6, 0.75, '#5a3a22'), -38, 0, -24.5, 0);
  b.prop(F.chair(m, '#5a3a22', '#4a2c18'), -38, 0, -23.6, Math.PI + 0.3);
  documentProp(g, b, 'theo_diary', -38.4, 0.76, -24.45, 0.2, 'clipboard');
  documentProp(g, b, 'theo_letter', -37.6, 0.76, -24.35, -0.2, 'sheet');
  tapePlayer(g, b, 'theo_log', -38.9, 0.76, -24.6, 0.3);
  const dl = new ModelBuilder();
  const bulb = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xffd59a, emissiveIntensity: 2 });
  dl.add(cyl(0.07, 0.08, 0.02, 16), m.steel('#3a3f42', 0.4), 0, 0.01, 0);
  dl.add(cyl(0.008, 0.008, 0.35, 6), m.steel('#3a3f42', 0.4), 0, 0.18, 0);
  dl.add(new THREE.ConeGeometry(0.1, 0.12, 16, 1, true), m.painted('#2f5d62', 0.4), 0.05, 0.36, 0.02, 0.4, 0, -0.6);
  dl.add(new THREE.SphereGeometry(0.03, 8, 6), bulb, 0.06, 0.33, 0.03);
  b.prop(dl.group, -37.2, 0.76, -24.7, 0, { collide: false });
  b.light(-37.1, 1.05, -24.5, { color: '#ffd59a', intensity: 4, distance: 5, emissives: [bulb], emissiveBase: 2, priority: 1.2 });
  documentProp(g, b, 'song_sheet', -38, 1.6, -24.88, 0, 'none', FX.paperOnWall(m, songSheet(), 0.6, true, 0.05));
  // workbench: half-built music box, the tone module, the carousel key on a nail
  b.prop(I.workbench(m, 2.0), -38, 0, -17.6, Math.PI);
  pickup(g, b, 'tone_module', -38.5, 0.92, -17.7, 0.4, () => g.ui.hud.subtitle('Модуль тона. На корпусе: «к браслету — настраивать механизмы. Для внизу». Тео готовился.', 5));
  const mbx = new ModelBuilder();
  mbx.add(box(0.3, 0.14, 0.2), m.woodProp('#8a5a32', 0.4), 0, 0.07, 0);
  mbx.add(cyl(0.03, 0.03, 0.22, 12), m.steel('#c9a34a', 0.3), 0, 0.17, 0, 0, 0, Math.PI / 2);
  b.prop(mbx.group, -37.4, 0.92, -17.7, 0.2, { collide: false });
  inspect(g, b, null, -37.4, 1.0, -17.7, 'Недоделанная музыкальная шкатулка. На валике выбиты не все зубчики — только начало колыбельной.', { size: 0.35 });
  pickup(g, b, 'carousel_key', -36.6, 1.5, -17.15, 0, () => {
    g.ui.hud.subtitle('Ключ с брелоком-лошадкой. Висел на гвозде над верстаком, как будто его ждали.', 4.5);
    g.objective('Запустить карусель');
  });
  b.prop(FX.paperOnWall(m, childDrawing('goodbye', 501), 0.5, true, 0.1), -41.88, 1.5, -19, Math.PI / 2, { collide: false });
  b.prop(FX.framedPicture(m, photo('founders', 19), 0.45, '#2a1f12'), -41.88, 1.6, -23.6, Math.PI / 2, { collide: false });
  inspect(g, b, null, -41.8, 1.6, -23.6, 'Пелл и Ламберт, 1989. Тео смеётся, Пелл смотрит в камеру. Внизу подпись Тео: «Мы хотели сделать друга. Мы сделали ребёнка».', { size: 0.5 });
  b.prop(plushVerity(m, 1.4, '#f4d35e', 0.8), -41.1, 0.58, -22.6, 0.4, { collide: false });
  b.prop(F.cardboardBox(m, 0.5, 0.4, 0.4, true), -35, 0, -24.4, 0.3);
  b.prop(F.paperStack(m, 8, 51), -37.5, 0.76, -24.2, 0.1, { collide: false });
  b.prop(F.mug(m, '#2f5d62'), -38.7, 0.76, -24.2, 0, { collide: false });
  lamp(g, b, 'bare', -39.5, 2.8, -21, { drop: 0.5, intensity: 3, distance: 6, flicker: 'buzz' });
  b.sound('drip', -41, 2.6, -24.5, 0.12);
  b.trigger('theo_in', -41.8, 0, -24.8, -34.2, 2.5, -17.2, {
    onEnter: () => {
      if (g.state.is('playland.theoIn')) return;
      g.state.set('playland.theoIn');
      g.ui.hud.subtitle('Здесь кто-то жил. Долго. Постель заправлена, кружка вымыта.', 4);
    },
  });
}

function songSheet(): HTMLCanvasElement {
  const [c, g] = canvas(512, 384);
  g.fillStyle = '#f7f2e6';
  g.fillRect(0, 0, 512, 384);
  g.strokeStyle = 'rgba(40,40,40,0.5)';
  g.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    g.beginPath();
    g.moveTo(30, 150 + i * 22);
    g.lineTo(482, 150 + i * 22);
    g.stroke();
  }
  const notes: Array<[Bell, number]> = [
    ['yellow', 0],
    ['green', 1],
    ['purple', 3],
    ['blue', 2.5],
  ];
  notes.forEach(([bc, h], i) => {
    const x = 110 + i * 95;
    const y = 238 - h * 30;
    g.fillStyle = BELL_COLOR[bc];
    g.beginPath();
    g.ellipse(x, y, 22, 17, -0.3, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#222';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(x + 20, y);
    g.lineTo(x + 20, y - 70);
    g.stroke();
  });
  g.fillStyle = '#2a3a8a';
  g.font = "700 38px 'Caveat', cursive";
  g.fillText('Песенка Верити', 140, 60);
  g.font = "700 30px 'Caveat', cursive";
  g.fillText('Вре - мя  Ве - ри - ти!', 110, 330);
  return c;
}

// =====================================================================
// chase route: party rooms, kitchen, power room, dock
// =====================================================================

function partyRooms(g: Game, b: LevelBuilder): void {
  const m = g.mats;
  new Door(g, b, { id: 'pl_dF1', x: 28, z: -42, axis: 'x', style: 'kids', color: '#f4d35e', label: '«ЗВЁЗДОЧКА»' });
  new Door(g, b, { id: 'pl_d12', x: 28, z: -32, axis: 'x', style: 'office', color: '#8a6a4a', bolt: true, label: '«СИНЯЯ СОБАКА»' });
  new Door(g, b, { id: 'pl_d23', x: 28, z: -22, axis: 'x', style: 'kids', color: '#7fb2b0', label: '«КАРУСЕЛЬ»' });
  new Door(g, b, { id: 'pl_d3k', x: 28, z: -12, axis: 'x', style: 'service', label: 'КУХНЯ', bolt: true });
  // corridor F
  lamp(g, b, 'cage', 14, 2.9, -44, { intensity: 4, distance: 6, flicker: 'buzz' });
  lamp(g, b, 'cage', 24, 2.9, -44, { intensity: 4, distance: 6 });
  lamp(g, b, 'emergency', 31.88, 2.4, -44, { ry: -Math.PI / 2, intensity: 4, distance: 6 });
  for (let i = 0; i < 5; i++) b.prop(F.cardboardBox(m, 0.6, 0.45, 0.45, i % 2 === 0), 17 + i * 1.6, 0, -45.4, i * 0.4);
  b.prop(K.counterUnit(m, 1.6), 20, 0, -45.6, 0);
  b.prop(FX.signPanel(m, '← ЗАЛЫ ПРАЗДНИКОВ', { bg: '#22313a', fg: '#e8e2d0', w: 512, h: 96, width: 1.4 }), 22, 2.2, -42.12, Math.PI, { collide: false });
  // three abandoned birthdays, each frozen at 19:00
  const parties: Array<[number, string, number]> = [
    [-37, '#f4d35e', 6],
    [-27, '#3a6fd0', 7],
    [-17, '#ef8a7e', 5],
  ];
  parties.forEach(([zc, col, candles], i) => {
    b.prop(K.partyTable(m, 3.6, 70 + i, candles), 28, 0, zc, 0);
    for (let k = 0; k < 4; k++) b.prop(F.kidChair(m, col), 26.6 + k * 0.95, 0, zc + 0.85, Math.PI + (k % 2) * 0.3);
    b.prop(F.kidChair(m, col), 27.1, 0, zc - 0.9, 0.2);
    b.prop(K.bunting(m, [new THREE.Vector3(24.2, 2.6, zc - 4.5), new THREE.Vector3(28, 2.2, zc), new THREE.Vector3(31.8, 2.6, zc + 4.5)], [col, '#f7f2e6']), 0, 0, 0, 0, { collide: false });
    b.prop(FX.wallClock(m, 19, 0), 31.88, 2.3, zc, -Math.PI / 2, { collide: false });
    b.prop(balloon(m, col, 2.4, false), 25.2, 0, zc - 3.6, 0, { collide: false });
    b.prop(balloon(m, '#f7f2e6', 0.9, true), 30.6, 0, zc + 3.2, 0, { collide: false });
    lamp(g, b, 'pendant', 28, 3, zc, { drop: 0.5, intensity: i === 1 ? 0 : 6, distance: 7, color: '#ffd9a0', flicker: i === 0 ? 'buzz' : 'dying', on: i !== 1 });
    if (i === 1) {
      b.light(28, 1.0, zc, { color: '#ffb36a', intensity: 1.6, distance: 3, flicker: 'candle' });
      b.prop(cake(m, 1), 29.2, 0.62, zc + 0.3, 0, { collide: false });
    }
  });
  b.prop(FX.paperOnWall(m, scrawl('С ДНЁМ РОЖДЕНИЯ, МИША!', { w: 1024, h: 160, color: '#3a6fd0', font: 'brand', size: 80 }), 2.6, false), 28, 2.3, -22.12, Math.PI, { collide: false });
  hideLocker(g, b, 'p2_locker', 31.55, 0, -24, -Math.PI / 2, '#8aa0b8');
  hideLocker(g, b, 'p3_locker', 31.55, 0, -14, -Math.PI / 2, '#8aa0b8');
}

function kitchen(g: Game, b: LevelBuilder, refs: Refs): void {
  const m = g.mats;
  refs.kitchenLights = [
    lamp(g, b, 'troffer', 27, 3, -9, { intensity: 5, distance: 7, color: '#eef4ff', flicker: 'buzz' }),
    lamp(g, b, 'troffer', 31, 3, -5, { intensity: 5, distance: 7, color: '#eef4ff' }),
  ];
  b.prop(K.stove(m), 25.2, 0, -10.5, Math.PI / 2);
  b.prop(K.counterUnit(m, 3, true), 25.0, 0, -6.5, Math.PI / 2);
  b.prop(K.counterUnit(m, 3), 29.3, 0, -7.2, 0); // central island
  b.prop(K.counterUnit(m, 3), 29.3, 0, -7.85, Math.PI);
  b.prop(K.fridge(m), 33.4, 0, -11.4, -Math.PI / 2);
  for (let i = 0; i < 4; i++) b.prop(F.mug(m, '#f2eadb'), 28.6 + i * 0.3, 0.9, -7.5, 0, { collide: false });
  b.prop(cake(m, 0), 30.4, 0.9, -7.6, 0, { collide: false });
  inspect(g, b, null, 30.4, 1.0, -7.6, 'Запасной торт. Без свечей. На коробке: «на случай, если Время Верити затянется».', { size: 0.4 });
  hideLocker(g, b, 'k_locker1', 33.55, 0, -2.6, -Math.PI / 2, '#5f7a80');
  // cold room: hide behind the crates
  new Door(g, b, { id: 'pl_cold', x: 34, z: -4.5, axis: 'z', style: 'metal', color: '#c9cccf', label: 'ХОЛОДИЛЬНАЯ' });
  const crates = new ModelBuilder();
  for (let i = 0; i < 5; i++) crates.add(box(0.7, 0.55, 0.6), m.woodProp('#8a6a4a', 0.5), (i % 2) * 0.72, 0.28 + Math.floor(i / 2) * 0.56, 0);
  b.prop(crates.group, 36.4, 0, -6.2, 0);
  const hideObj = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.2, 0.3), new THREE.MeshBasicMaterial({ visible: false }));
  b.prop(hideObj, 36.7, 0.6, -5.7, 0, { collide: false, static: false });
  hideSpot(g, b, hideObj, { id: 'cold_crates', eye: new THREE.Vector3(37.4, 0.95, -6.6), yaw: Math.atan2(-(34 - 37.4), -(-4.5 + 6.6)), yawRange: 0.5, pitchRange: 0.3, exit: new THREE.Vector3(36.6, 0, -4.5) });
  lamp(g, b, 'cage', 36, 2.7, -4.5, { intensity: 2.5, distance: 4, color: '#cfe4ff', flicker: 'dying' });
  b.sound('hum_loop', 36, 2, -4.5, 0.15);
  // power room: dock gate breaker + kitchen lights
  lamp(g, b, 'cage', 37, 2.9, -9.5, { intensity: 4, distance: 5, color: '#ffcf8a', flicker: 'buzz' });
  b.prop(FX.electricalBox(m, 0.9, 1.2), 39.88, 1.4, -9.5, -Math.PI / 2, { collide: false });
  b.prop(FX.signPanel(m, 'ЩИТ ХОЗБЛОКА', { bg: '#22313a', fg: '#e8e2d0', w: 512, h: 96, width: 1.0 }), 39.88, 2.3, -9.5, -Math.PI / 2, { collide: false });
  lever(g, b, 39.82, 1.25, -9.1, -Math.PI / 2, {
    id: 'pl_dock_power',
    style: 'lever',
    color: '#f1c40f',
    hold: 1.0,
    prompt: (on) => (on ? null : 'Ворота погрузки: подать питание'),
    get: () => g.state.is('playland.dockPower'),
    set: (on) => {
      if (!on) return;
      g.state.set('playland.dockPower');
      refs.dockShutter.target = 1;
      g.audio.play('alarm_loop', { pos: new THREE.Vector3(30, 2.5, -2), volume: 0.6, ref: 6 })?.stop(7);
      g.ui.hud.subtitle('Где-то загудели ворота. Медленно. Слишком медленно.', 3);
    },
  });
  lever(g, b, 39.82, 1.25, -9.9, -Math.PI / 2, {
    id: 'pl_kitchen_light',
    style: 'switch',
    prompt: (on) => (on ? 'Свет кухни: включить' : 'Свет кухни: выключить'),
    get: () => g.state.is('playland.kitchenDark'),
    set: (on) => {
      g.state.set('playland.kitchenDark', on);
      for (const l of refs.kitchenLights) l.setOn(!on);
    },
  });
  // the dock shutter: slow, noisy, needs power
  const sm = new THREE.Mesh(box(2.6, 2.7, 0.08), m.get('grate'));
  sm.position.set(30, 1.35, -2);
  b.addDynamic(sm);
  const sh = { mesh: sm, col: b.collider(28.7, 0, -2.1, 31.3, 2.7, -1.9, { opaque: false }), t: 0, target: 0 };
  refs.dockShutter = sh;
  if (g.state.is('playland.dockPower')) {
    sh.t = sh.target = 1;
    sm.position.y = 1.35 + 2.5;
    sh.col.enabled = false;
  }
  b.update((dt) => {
    if (sh.t === sh.target) return;
    sh.t = Math.min(sh.target, sh.t + dt / 7);
    sm.position.y = 1.35 + sh.t * 2.5;
    sh.col.enabled = sh.t < 0.62;
    if (sh.t >= 1) g.audio.play('metal_slam', { pos: new THREE.Vector3(30, 2.6, -2), volume: 0.7 });
  });
  b.sound('motor_loop', 30, 2.5, -2, 0.5, { rate: 0.5, when: () => sh.t > 0 && sh.t < 1 });
  b.prop(FX.signPanel(m, 'ПОГРУЗКА', { bg: '#f1c40f', fg: '#111', w: 384, h: 96, width: 1.0 }), 30, 3.0, -2.12, Math.PI, { collide: false });
}

function dock(g: Game, b: LevelBuilder): void {
  const m = g.mats;
  lamp(g, b, 'cage', 28, 4.3, 2, { intensity: 5, distance: 8, flicker: 'buzz' });
  lamp(g, b, 'emergency', 32.2, 3.2, 7.88, { ry: Math.PI, intensity: 4, distance: 6 });
  for (let i = 0; i < 6; i++) b.prop(F.crate(m, 0.9), 25.2 + (i % 3) * 1.0, Math.floor(i / 3) * 0.9, 6.8, i * 0.3);
  b.prop(F.pallet(m), 26, 0, 1, 0.3);
  b.prop(I.forklift(m), 34, 0, 2, -0.6);
  b.prop(FX.signPanel(m, 'СЛУЖЕБНАЯ ЛЕСТНИЦА ↓ СТАРЫЕ ЦЕХА', { bg: '#22313a', fg: '#f1c40f', w: 1024, h: 96, width: 2.4 }), 32.2, 3.0, 7.88, Math.PI, { collide: false });
  b.stairs('concrete', 32.2, 16.6, -3.6, 0, 8.4, 2.6, 'n');
  lamp(g, b, 'bare', 32.2, 4.0, 12, { drop: 0.6, intensity: 2, distance: 5, flicker: 'dying' });
  b.trigger('pl_exit', 30.6, -4, 12, 33.8, 2, 17, {
    when: () => !g.state.is('playland.done'),
    onEnter: () => {
      g.state.set('playland.done');
      g.co.start(chaseEnds(g), 'zone');
    },
  });
}

function* chaseEnds(g: Game): CoGen {
  const v = g.verity;
  g.canSave = false;
  g.music.stop(2);
  v.onCatch = () => {};
  if (v.visible) {
    v.stop();
    v.state = 'scripted';
    v.rolling = false;
    v.teleport(new THREE.Vector3(32.2, 0, 6.6), Math.PI);
    v.lookAtPlayer = true;
    v.setMood('lonely');
    v.expression('sad');
  }
  yield 1.2;
  yield g.say('verity', 'Туда нельзя. Там нет окошек. Там я тебя не вижу.', { degrade: 3, pos: new THREE.Vector3(32.2, 1, 7) });
  yield g.say('verity', 'Вернись. Пожалуйста. Я больше не буду. Вернись.', { degrade: 3, pos: new THREE.Vector3(32.2, 1, 7) });
  yield 1.5;
  v.hide();
  v.onCatch = null;
  g.state.set('act4.done');
  yield g.fadeOut(2);
  yield g.loadZone('oldworks', 'start').catch(() => g.notify('Продолжение следует…'));
}

// =====================================================================
// director
// =====================================================================

function directorEvents(g: Game): void {
  g.director.add({
    id: 'pl_ball_roll',
    gap: 70,
    once: true,
    when: () => g.state.is('playland.met') && !g.state.is('playland.q3') && g.player.pos.distanceTo(new THREE.Vector3(-15, 0, -10)) > 8,
    run: () => {
      g.audio.play('impact_soft', { pos: new THREE.Vector3(-12, 0.2, -6), volume: 0.4, rate: 1.6 });
      setTimeout(() => g.audio.play('impact_soft', { pos: new THREE.Vector3(-10, 0.1, -5), volume: 0.3, rate: 1.8 }), 450);
    },
  });
  g.director.add({
    id: 'pl_arcade_jingle',
    gap: 60,
    once: true,
    when: () => g.state.is('playland.lights') && !g.state.is('playland.q3') && g.player.pos.x < 0,
    run: () => {
      g.music.motif({ pos: new THREE.Vector3(23, 1.4, -8), volume: 0.3, variant: 'anxious' });
      g.ui.hud.subtitle('В углу сам собой запиликал игровой автомат.', 3);
    },
  });
  g.director.add({
    id: 'pl_whisper_theatre',
    gap: 50,
    once: true,
    when: () => g.state.is('playland.met') && g.player.pos.x < -24 && !g.state.solved('p9'),
    run: () => g.say('verity', 'Тео ставил тут спектакли. Только для меня.', { degrade: 2, pos: new THREE.Vector3(-29, 2.5, -24) }),
  });
}
