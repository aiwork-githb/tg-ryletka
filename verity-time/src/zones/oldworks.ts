import * as THREE from 'three';
import type { ZoneDef } from './types';
import type { Game } from '../Game';
import type { LevelBuilder } from '../world/LevelBuilder';
import type { CoGen } from '../core/Coroutines';
import type { VLight } from '../render/LightManager';
import type { Collider } from '../physics/CollisionWorld';
import { Door, lamp, documentProp, tapePlayer, inspect, hideLocker, lever, throwable, pickup } from '../world/entities';
import * as F from '../models/furniture';
import * as FX from '../models/fixtures';
import * as O from '../models/oldworks';
import * as I from '../models/industry';
import { cot } from '../models/kids';
import { plushVerity, photoProp } from '../models/items';
import { canvas, childDrawing, scrawl, sign, stain } from '../assets/Signage';
import { steamInit, steamToggle, steamCheck, liftPressure, steamFlow, type SteamState } from '../puzzles/steam';
import { musicInit, musicTune, musicPlay, musicCorrect, NOTE_COLOR, NOTE_NAME, TINE_NOTES, type MusicBoxState } from '../puzzles/musicbox';
import { dust, sparks } from '../world/vfx';
import { box, cyl, ModelBuilder } from '../world/geom';
import { Rng } from '../assets/noise';

interface Cam {
  id: string;
  pos: THREE.Vector3;
  baseYaw: number;
  sweep: number;
  head: THREE.Group;
  led: THREE.MeshStandardMaterial;
  cut: boolean;
  seen: number;
  phase: number;
}

interface Refs {
  workLights: VLight[];
  cams: Cam[];
  steam: SteamState;
  boilerFire: THREE.MeshStandardMaterial;
  rubble: { obj: THREE.Object3D; col: Collider };
  monitors: () => void;
  liftGate: { gate: THREE.Group; col: Collider };
}

const refsOf = (g: Game): Refs => (g.zone as any).refs as Refs;

export const oldworks: ZoneDef = {
  id: 'oldworks',
  name: 'Старые цеха',
  chapter: 'Акт V. Старые цеха',
  materials: [
    'brick_old', 'brick_painted', 'concrete', 'concrete_dark', 'stone_old', 'metal_rust', 'metal_rust_paint', 'metal_dark', 'metal_white', 'grate', 'diamond_plate',
    'wood_floor', 'wood_dark', 'wall_wallpaper_kids', 'floor_carpet_blue', 'wall_plaster_dark', 'linoleum_beige', 'ceiling_tiles', 'tile_white',
  ],
  nav: { minX: -25, minZ: -71, maxX: 31, maxZ: 9, probeY: 2.4 },
  build(g, b) {
    // his last form is sculpted in the background, long before it is needed
    void g.verity.rig.prepare(4);
    const env = b.zone.env;
    env.fogColor.set(0x08090a);
    env.fogDensity = 0.04;
    env.ambient.set(0x3a3a40);
    env.ambientIntensity = 0.1;
    env.hemiSky.set(0x5a5a60);
    env.hemiGround.set(0x14100c);
    env.hemiIntensity = 0.16;
    env.reverb = 'industrial';
    env.ambience = ['drone_loop', 'vent_loop'];
    env.envMap = 'dark';
    env.envIntensity = 0.25;

    rooms(b);
    const refs = {} as Refs;
    (b.zone as any).refs = refs;
    refs.workLights = [];
    refs.cams = [];
    landing(g, b);
    gallery(g, b, refs);
    nadiaPost(g, b, refs);
    coldStorage(g, b);
    foreverRoom(g, b);
    boilerHall(g, b, refs);
    musicBoxAlcove(g, b, refs);
    workshop(g, b, refs);
    eastCorridor(g, b, refs);
    cameras(g, b, refs);
    directorEvents(g);
    // Nadia hung battery lanterns to find her way in the dark
    for (const [x, y, z] of [
      [1.2, 2.2, -2.5],
      [7.6, 1.9, -12],
      [-3.4, 1.9, -22],
      [6.5, 2.1, -31],
      [-5.6, 2.0, -38],
      [-10.4, 2.0, -45],
      [-15.5, 2.2, -52],
      [12, 2.0, -44],
      [21, 2.1, -48],
      [24, 2.0, -24],
    ])
      lantern(g, b, x, y, z);

    dust(g, b, new THREE.Vector3(-6, 0.3, -34), new THREE.Vector3(10, 5, 0), 500, 0xffe8c8, 0.02);
    dust(g, b, new THREE.Vector3(-14, 0.3, -64), new THREE.Vector3(18, 10, -36), 800, 0xffe8c8, 0.02);
    b.spawn('start', 1, 0, 5.5, 0);
    b.spawn('gallery', 2, 0, -16, 0);
    b.spawn('boiler', 15, 0, -38.5, Math.PI);
    b.spawn('lift', 2, 0, -60, 0);
    (b.zone as any).safe = new THREE.Vector3(2, 0, -16);
  },
  onEnter(g, spawn, restored) {
    if (restored) {
      // a restore inside the hunt brings him back
      if (g.state.is('oldworks.hunt') && !g.state.is('oldworks.done')) g.co.start(huntBegins(g, true), 'zone');
      return;
    }
    if (spawn === 'start' && !g.state.is('oldworks.entered')) {
      g.state.set('oldworks.entered');
      g.co.start(arrival(g), 'zone');
    }
  },
};

// =====================================================================
// layout
// =====================================================================

function rooms(b: LevelBuilder): void {
  const OLD = { floor: 'stone_old', wall: 'brick_old', ceil: 'concrete_dark', baseboard: null };
  b.room('landing', { x: -2, z: 0, w: 6, d: 8, h: 4, ...OLD, floor: 'concrete' });
  b.room('gallery', { x: -6, z: -34, w: 16, d: 34, h: 6, ...OLD });
  b.connect('gallery', 'landing', 1, 2.4, 3);
  b.room('post', { x: 10, z: -12, w: 12, d: 8, h: 3.2, floor: 'linoleum_beige', wall: 'brick_painted', ceil: 'ceiling_tiles', baseboard: 'wood_dark' });
  b.connect('gallery', 'post', -8, 1.1, 2.2);
  b.room('east', { x: 22, z: -40, w: 4, d: 30, h: 3.5, ...OLD, floor: 'concrete' });
  b.connect('post', 'east', -11, 1.1, 2.2);
  b.room('workshop', { x: 18, z: -60, w: 12, d: 20, h: 5, ...OLD, floor: 'wood_floor' });
  b.connect('workshop', 'east', 24, 1.4, 2.4);
  b.room('boiler', { x: -14, z: -64, w: 32, d: 28, h: 12, ...OLD, floor: 'concrete' });
  b.connect('boiler', 'workshop', -46, 2.4, 3);
  b.room('gate', { x: -1, z: -36, w: 4, d: 2, h: 3.5, ...OLD });
  b.connect('gate', 'gallery', 1, 3.6, 3.2);
  b.connect('boiler', 'gate', 1, 3.6, 3.2);
  b.room('cold', { x: -18, z: -26, w: 12, d: 14, h: 4, floor: 'concrete', wall: 'metal_white', ceil: 'metal_white', baseboard: null });
  b.connect('cold', 'gallery', -19, 1.3, 2.3);
  b.room('forever', { x: 10, z: -26, w: 7, d: 8, h: 3, floor: 'floor_carpet_blue', wall: 'wall_wallpaper_kids', ceil: 'ceiling_tiles', baseboard: 'wood_dark' });
  b.connect('gallery', 'forever', -22, 1.1, 2.2);
  b.room('vent', { x: 14.4, z: -36, w: 1.2, d: 10, h: 1.15, floor: 'metal_dark', wall: 'metal_dark', ceil: 'metal_dark', baseboard: null });
  b.connect('vent', 'forever', 15, 1.0, 1.1);
  b.connect('boiler', 'vent', 15, 1.0, 1.1);
  b.room('mbox', { x: -24, z: -56, w: 10, d: 12, h: 6, ...OLD, floor: 'wood_floor' });
  b.connect('mbox', 'boiler', -50, 3, 4);
  b.room('lift', { x: 0, z: -70, w: 4, d: 6, h: 4, floor: 'diamond_plate', wall: 'metal_dark', ceil: 'metal_dark', baseboard: null });
  b.connect('lift', 'boiler', 2, 3.2, 3);
}

// =====================================================================
// arrival: the silence below
// =====================================================================

function landing(g: Game, b: LevelBuilder): void {
  const m = g.mats;
  new Door(g, b, { id: 'ow_back', x: 1, z: 8, axis: 'x', style: 'metal', color: '#4a5254', lock: () => 'Дверь захлопнулась. С этой стороны нет ручки.' });
  b.opening('landing', { side: 's', at: 1, width: 1.2, height: 2.2 });
  lamp(g, b, 'emergency', 3.88, 2.6, 4, { ry: -Math.PI / 2, intensity: 3, distance: 6 });
  b.prop(FX.signPanel(m, 'СТАРЫЕ ЦЕХА · 1962', { bg: '#2a2622', fg: '#c9a34a', w: 768, h: 128, width: 2.2 }), 1, 3.2, 0.12, 0, { collide: false });
}

function* arrival(g: Game): CoGen {
  yield 1.0;
  g.ui.hud.chapterCard('Акт V', 'Старые цеха', 6);
  yield 5;
  g.ui.hud.subtitle('Тихо. По-настоящему тихо. Ни динамиков, ни камер, ни музыки.', 5);
  yield 5;
  g.ui.hud.subtitle('Здесь он меня не видит.', 3);
  yield 3;
  g.objective('Осмотреть Старые цеха. Найти Надю');
}

// =====================================================================
// gallery: the 1962 workshop floor
// =====================================================================

function gallery(g: Game, b: LevelBuilder, refs: Refs): void {
  const m = g.mats;
  b.prop(O.lineShaft(m, 30, 5.4, 6), 4, 0, -17, 0, { collide: false });
  const r = new Rng(62);
  for (let i = 0; i < 6; i++) {
    const z = -4 - i * 5;
    b.prop(I.workbench(m, 2.4), -3.6, 0, z, Math.PI / 2);
    for (let k = 0; k < 3; k++) b.prop(O.tinToy(m, r.pick(['robot', 'car', 'bear'] as const), i * 7 + k), -3.5 + r.range(-0.2, 0.2), 0.92, z - 0.8 + k * 0.8, r.range(0, 6), { collide: false });
  }
  for (let i = 0; i < 4; i++) b.prop(I.workbench(m, 2.0), 7.6, 0, -6 - i * 6, -Math.PI / 2);
  documentProp(g, b, 'oldworks_plaque', 9.88, 1.6, -2.5, -Math.PI / 2, 'none', FX.paperOnWall(m, sign('МАСТЕРСКАЯ\n«ПЕЛЛ И ЛАМБЕРТ»\n1962', { bg: '#c9a34a', fg: '#2a1f12', w: 512, h: 384, border: '#5a4a2a' }), 0.7, false));
  for (const [x, z] of [
    [-4.8, -31],
    [8.6, -31.5],
    [8.4, -14],
  ])
    b.prop(F.crate(m, 0.9), x, 0, z, r.range(0, 1));
  for (let i = 0; i < 3; i++) b.prop(F.barrel(m, '#5a4a3a'), -5 + i * 0.7, 0, -33.2, i);
  throwable(g, b, wrench(m), 'гаечный ключ', 7.4, 0.93, -12.2, 'impact_metal', 16);
  throwable(g, b, wrench(m), 'гаечный ключ', -3.4, 0.93, -19.5, 'impact_metal', 16);
  // a few battery lights still alive; the rest wait for the dynamo
  lamp(g, b, 'emergency', -5.88, 3, -10, { ry: Math.PI / 2, intensity: 3, distance: 7 });
  lamp(g, b, 'emergency', 9.88, 3, -26, { ry: -Math.PI / 2, intensity: 3, distance: 7 });
  for (const z of [-6, -16, -26]) refs.workLights.push(lamp(g, b, 'cage', 2, 5.9, z, { intensity: 9, distance: 10, color: '#ffcf8a', on: false }));
  for (let i = 0; i < 6; i++) {
    const rr = new Rng(700 + i);
    b.decal(m.canvasMaterial(stain(i % 2 ? 'oil' : 'dirt', 700 + i), { transparent: true, rough: 0.4 }), rr.range(-4, 8), 0.004, rr.range(-32, -2), rr.range(1, 3), rr.range(1, 3), 'up', { rot: rr.range(0, 6) });
  }
  // rubble blocking the way north (he will break through it)
  const rub = O.rubble(m, 3.8, 5);
  b.prop(rub, 1, 0, -35, 0, { collide: false, static: false });
  const col = b.collider(-1, 0, -36, 3, 3.5, -34, { opaque: true });
  refs.rubble = { obj: rub, col };
  if (g.state.is('oldworks.hunt')) {
    rub.visible = false;
    col.enabled = false;
  }
  inspect(g, b, null, 1, 1.2, -33.6, 'Проход в котельную завален. Кирпич, балки. Тут не пройти — разве что снести стену.', { size: 1.4 });
  b.sound('drip', -2, 5, -20, 0.2);
  b.sound('metal_groan', 8, 4, -30, 0.06);
}

function wrench(m: import('../assets/Materials').Materials): THREE.Group {
  const mb = new ModelBuilder();
  mb.add(box(0.3, 0.02, 0.035), m.steel('#8a8e91', 0.4), 0, 0.01, 0);
  mb.add(cyl(0.035, 0.035, 0.02, 10), m.steel('#8a8e91', 0.4), 0.16, 0.01, 0);
  return mb.group;
}

// =====================================================================
// Nadia's camp in the old foreman's office
// =====================================================================

function nadiaPost(g: Game, b: LevelBuilder, refs: Refs): void {
  const m = g.mats;
  new Door(g, b, { id: 'ow_post', x: 10, z: -8, axis: 'z', style: 'office', label: 'КОНТОРА' });
  const cp = O.camp(m);
  b.prop(cp.group, 13, 0, -9.2, Math.PI / 2, { collide: false });
  b.light(13.5, 0.4, -8.5, { color: '#ffc070', intensity: 3.5, distance: 6, emissives: [cp.bulb], emissiveBase: 2, flicker: 'candle', priority: 1.3 });
  b.prop(F.desk(m, 1.6, 0.8, '#5a4a3a'), 18.5, 0, -11.4, 0);
  documentProp(g, b, 'nadia_camp_note', 18.2, 0.76, -11.3, 0.2, 'clipboard');
  const ph = photoProp(m, 'party');
  inspect(g, b, ph, 18.9, 0.765, -11.2, 'Фотография, вложенная в тетрадь: девочка в праздничном колпаке. «Лиза, 6 лет, 03.11.1997, зал «Звёздочка»». На обороте: «Я сказала тебе, что он уснул. Прости».', { secret: 'sec_nadia', size: 0.15, ry: 0.4 });
  b.prop(F.mug(m, '#ef8a7e'), 17.8, 0.76, -11.0, 0, { collide: false });
  b.prop(F.chair(m, '#5a4a3a', '#3a2a1c'), 18.5, 0, -10.5, Math.PI);
  // CCTV desk with four monitors (dead until the dynamo runs)
  const [mc, mg] = canvas(512, 384);
  const monMat = m.canvasMaterial(mc, { emissive: 0.0, rough: 0.2 });
  const tex = monMat.map as THREE.CanvasTexture;
  const mon = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.9), monMat);
  mon.position.set(21.88, 1.6, -7);
  mon.rotation.y = -Math.PI / 2;
  b.addDynamic(mon);
  b.prop(F.table(m, 1.6, 0.7, 0.75, '#5a5e61'), 21.3, 0, -7, Math.PI / 2);
  refs.monitors = () => {
    const on = g.state.is('oldworks.power');
    monMat.emissiveIntensity = on ? 1.1 : 0;
    mg.fillStyle = on ? '#020604' : '#050505';
    mg.fillRect(0, 0, 512, 384);
    if (on) {
      refs.cams.forEach((c, i) => {
        const x = (i % 3) * 170 + 6;
        const y = Math.floor(i / 3) * 190 + 6;
        mg.fillStyle = c.cut ? '#0a0a0a' : '#0c1a12';
        mg.fillRect(x, y, 160, 180);
        mg.fillStyle = c.cut ? '#666' : '#79f2a8';
        mg.font = "600 18px 'IBM Plex Mono', monospace";
        mg.fillText('КАМ ' + (i + 1), x + 10, y + 26);
        mg.font = "500 14px 'IBM Plex Mono', monospace";
        mg.fillText(c.cut ? 'НЕТ СИГНАЛА' : c.id.toUpperCase(), x + 10, y + 50);
        if (!c.cut) {
          mg.fillStyle = c.seen > 0.5 ? '#ff3020' : '#2a6a3a';
          mg.beginPath();
          mg.arc(x + 140, y + 20, 7, 0, Math.PI * 2);
          mg.fill();
        }
      });
    }
    tex.needsUpdate = true;
  };
  refs.monitors();
  let mt = 0;
  b.update((dt) => {
    mt -= dt;
    if (mt > 0 || !g.state.is('oldworks.power')) return;
    mt = 0.5;
    refs.monitors();
  });
  // Ликвидком cabinet: opens with Nadia's pass
  const cab = F.locker(m, '#4a5a4a', false);
  b.prop(cab, 15, 0, -11.55, 0, { static: false });
  const door = cab.userData.door as THREE.Object3D | undefined;
  const rd = new ModelBuilder();
  rd.add(box(0.1, 0.14, 0.03), m.plastic('#1c1c1e', 0.4), 0, 0, 0);
  const led = new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff2010, emissiveIntensity: 1.5 });
  rd.add(box(0.05, 0.02, 0.01), led, 0, 0.04, 0.016);
  b.prop(rd.group, 15.42, 1.25, -11.2, 0, { collide: false, static: false });
  const open = () => {
    led.emissive.setHex(0x30ff60);
    if (door) door.rotation.y = -1.6;
  };
  if (g.state.is('oldworks.cabinet')) open();
  g.interact.add({
    id: 'ow_cabinet',
    object: rd.group,
    kind: 'use',
    prompt: () => (g.state.is('oldworks.cabinet') ? null : g.state.has('nadia_badge') ? 'Приложить пропуск Нади' : 'Шкаф «Ликвидкома»'),
    onUse: () => {
      if (!g.state.has('nadia_badge')) {
        g.audio.play('keypad_err', { pos: rd.group.position, volume: 0.4 });
        g.ui.hud.subtitle('Электронный замок «Ликвидкома». Нужен пропуск охраны. В тетради Надя писала — пропуск в холодильнике.', 5);
        return;
      }
      g.state.set('oldworks.cabinet');
      g.audio.play('keypad_ok', { pos: rd.group.position, volume: 0.6 });
      g.audio.play('metal_door_open', { pos: rd.group.position, volume: 0.6 });
      open();
      g.giveItem('valve_wheel');
      g.ui.hud.subtitle('Внутри — красный маховик от вентиля и фонарь без батареек. На маховике мелом: «котельная».', 5);
      g.objective('Найти путь в котельную');
      g.checkpoint('oldworks.wheel');
    },
  });
  lamp(g, b, 'troffer', 16, 3.2, -8, { intensity: 6, distance: 7, on: false });
}

// =====================================================================
// cold storage: the toys that went quiet
// =====================================================================

function coldStorage(g: Game, b: LevelBuilder): void {
  const m = g.mats;
  new Door(g, b, { id: 'ow_cold', x: -6, z: -19, axis: 'z', width: 1.2, style: 'metal', color: '#c9cccf', label: 'ХОЛОДИЛЬНИК' });
  for (let i = 0; i < 4; i++) b.prop(O.silentShelf(m, 9, 10 + i), -12.5, 0, -24.8 + i * 2.6 - (i > 1 ? 0 : 0), 0);
  // the chair in the middle, facing them
  b.prop(F.chair(m, '#3a5a7a', '#5a4a3a'), -12, 0, -14.2, Math.PI);
  b.prop(cot(m), -16.6, 0, -15.2, Math.PI / 2);
  const thermos = new ModelBuilder();
  thermos.add(cyl(0.045, 0.045, 0.3, 12), m.steel('#5a7a6a', 0.4), 0, 0.15, 0);
  b.prop(thermos.group, -11.4, 0, -14.4, 0, { collide: false });
  tapePlayer(g, b, 'nadia_tape', -12.6, 0.47, -14.0, 0.3);
  // the badge lies on the chair seat
  pickup(g, b, 'nadia_badge', -12, 0.47, -14.2, 0.3, () => {
    g.ui.hud.subtitle('Пропуск Нади Керр. На обороте выцарапано: «19:00 — не отвечай».', 5);
    g.objective('Открыть шкаф «Ликвидкома» в конторе');
  });
  b.light(-12, 3.6, -19, { color: '#bfe0ff', intensity: 5, distance: 10, flicker: 'dying' });
  b.light(-12, 3.6, -13.5, { color: '#cfe8ff', intensity: 3, distance: 6 });
  for (let i = 0; i < 6; i++) {
    const rr = new Rng(810 + i);
    b.decal(m.canvasMaterial(stain('water', 810 + i), { transparent: true, rough: 0.1 }), rr.range(-17, -7), 0.004, rr.range(-25, -13), rr.range(1, 2.5), rr.range(1, 2.5), 'up', { rot: rr.range(0, 6) });
  }
  b.sound('hum_loop', -12, 3.5, -19, 0.18);
  b.trigger('cold_in', -17.5, 0, -25.5, -6.5, 3, -12.5, {
    onEnter: () => {
      if (g.state.is('oldworks.coldSeen')) return;
      g.state.set('oldworks.coldSeen');
      g.ui.hud.subtitle('Сотни игрушек. Все повёрнуты лицом к двери. Как будто ждут, кто войдёт.', 5);
    },
  });
}


// =====================================================================
// The Forever Room: a trap made of love
// =====================================================================

function foreverRoom(g: Game, b: LevelBuilder): void {
  const m = g.mats;
  const door = new Door(g, b, {
    id: 'ow_forever',
    x: 10,
    z: -22,
    axis: 'z',
    style: 'kids',
    color: '#3a6fd0',
    label: '№12',
    lock: () => (g.state.is('oldworks.trapped') && !g.state.is('oldworks.escaped') ? 'Заперто. Снаружи.' : null),
  });
  b.prop(O.kidsBed(m), 15.6, 0, -23.6, -Math.PI / 2);
  inspect(g, b, null, 15.6, 0.15, -23.6, 'Под кроватью — пачка рисунков. Мальчик в оранжевой куртке, подписи по годам: 1995, 2000, 2005… 2026. Он рисовал, как я расту. Последний — сегодняшний. Похоже.', {
    prompt: 'Заглянуть под кровать',
    secret: 'sec_forever',
    size: 0.5,
  });
  b.prop(F.kidTable(m, 0.9, 0.6, '#f4d35e'), 12.2, 0, -19.4, 0);
  b.prop(F.kidChair(m, '#ef8a7e'), 12.2, 0, -20.2, 0);
  documentProp(g, b, 'forever_note', 12.2, 0.53, -19.4, 0.2, 'sheet');
  b.prop(plushVerity(m, 1.6, '#f4d35e', 0.2), 16.2, 0.62, -22.5, -Math.PI / 2, { collide: false });
  b.prop(FX.framedPicture(m, childDrawing('verity_me', 77), 0.6, '#f4d35e'), 16.88, 1.6, -20, -Math.PI / 2, { collide: false });
  b.prop(FX.paperOnWall(m, childDrawing('many_friends', 78), 0.5, true, 0.1), 10.12, 1.5, -24.5, Math.PI / 2, { collide: false });
  b.prop(FX.paperOnWall(m, scrawl('ВСЕГДА', { w: 512, h: 160, color: '#3a6fd0', font: 'brand', size: 90 }), 1.2, false), 13.5, 2.3, -25.88, 0, { collide: false });
  b.prop(FX.wallClock(m, 19, 0), 13.5, 1.7, -25.88, 0, { collide: false });
  const nightBulb = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xffd08a, emissiveIntensity: 0 });
  const nl = new ModelBuilder();
  nl.add(cyl(0.05, 0.07, 0.05, 12), m.plastic('#f4d35e', 0.3), 0, 0.025, 0);
  nl.add(new THREE.SphereGeometry(0.1, 16, 12), nightBulb, 0, 0.14, 0);
  b.prop(nl.group, 16.4, 0.0, -25.4, 0, { collide: false, static: false });
  const night = b.light(16.4, 0.5, -25.2, { color: '#ffd08a', intensity: 3, distance: 6, on: g.state.is('oldworks.trapped'), emissives: [nightBulb], emissiveBase: 2 });
  // vent grate low on the north wall (x 14.5..15.5)
  const grate = new THREE.Mesh(box(1.0, 1.0, 0.04), m.get('grate'));
  grate.position.set(15, 0.55, -25.92);
  b.addDynamic(grate);
  const gcol = b.collider(14.4, 0, -26.05, 15.6, 1.15, -25.85, { opaque: false });
  let hits = 0;
  const knocked = () => g.state.is('oldworks.vent');
  if (knocked()) {
    grate.position.set(15, 0.03, -26.6);
    grate.rotation.x = -Math.PI / 2;
    gcol.enabled = false;
  }
  g.interact.add({
    id: 'ow_vent',
    object: grate,
    kind: 'use',
    prompt: () => (knocked() ? null : g.state.is('oldworks.trapped') ? 'Выбить решётку вентиляции' : 'Решётка вентиляции'),
    onUse: () => {
      if (!g.state.is('oldworks.trapped')) {
        g.ui.hud.subtitle('Вентиляционная решётка. За ней — темнота и сквозняк. Тёплый. Пахнет котельной.', 4);
        return;
      }
      hits++;
      g.audio.play('impact_metal', { pos: grate.position, volume: 0.8, rate: 0.8 + hits * 0.1 });
      g.player.addTrauma(0.15);
      grate.rotation.x = -0.12 * hits;
      if (hits >= 3) {
        g.state.set('oldworks.vent');
        grate.position.set(15, 0.03, -26.6);
        grate.rotation.x = -Math.PI / 2;
        gcol.enabled = false;
        g.audio.play('metal_slam', { pos: grate.position, volume: 0.7 });
        g.objective('Пролезть через вентиляцию (пригнуться)');
      }
    },
  });
  b.trigger('forever_in', 11, 0, -25.5, 16.5, 2.5, -18.5, {
    when: () => !g.state.is('oldworks.trapped'),
    onEnter: () => {
      g.state.set('oldworks.trapped');
      g.co.start(trapped(g, door, night), 'zone');
    },
  });
  // crawl space exit into the boiler hall
  b.trigger('vent_out', 14.4, 0, -37, 15.6, 2, -35.6, {
    when: () => g.state.is('oldworks.vent') && !g.state.is('oldworks.escaped'),
    onEnter: () => {
      g.state.set('oldworks.escaped');
      g.objective('Растопить котёл. Пустить пар к подъёмнику');
      g.checkpoint('oldworks.boilerHall');
    },
  });
  lamp(g, b, 'bare', 15, 1.05, -31, { drop: 0.05, intensity: 0.8, distance: 3, color: '#ff8a5a', flicker: 'dying' });
}

function* trapped(g: Game, door: Door, night: VLight): CoGen {
  yield 1.5;
  door.setOpen(false);
  door.refreshLock();
  g.audio.play('metal_slam', { pos: door.pos.clone().setY(1.2), volume: 0.9 });
  g.player.addTrauma(0.3);
  yield 1.2;
  night.setOn(true);
  g.audio.play('switch', { pos: night.position, volume: 0.5 });
  yield 0.8;
  g.ui.hud.subtitle('Ночник. Кровать. Синяя собака на стене. Это моя комната. Моя детская.', 5);
  yield 3;
  g.audio.play('tape_click', { pos: new THREE.Vector3(12.2, 0.6, -19.4), volume: 0.6 });
  g.playLog('verity_story');
  yield 6;
  g.objective('Выбраться из «Комнаты навсегда»');
}

// =====================================================================
// boiler hall: P10
// =====================================================================

function boilerHall(g: Game, b: LevelBuilder, refs: Refs): void {
  const m = g.mats;
  const st = g.state.puzzle<SteamState>('p10', steamInit);
  refs.steam = st;
  // the boiler
  const bo = O.boiler(m, 6, 1.6);
  b.prop(bo.group, -2, 0, -52, 0, { static: false });
  refs.boilerFire = bo.fire;
  bo.fire.emissiveIntensity = st.lit ? 2.5 : 0;
  const fireLight = b.light(1.3, 1.6, -52, { color: '#ff7a30', intensity: 8, distance: 9, on: st.lit, flicker: 'candle', priority: 1.5 });
  b.prop(O.boiler(m, 5, 1.3).group, -2, 0, -58.5, 0);
  // pilot flame: a small blue landmark in the dark hall
  b.light(1.4, 1.2, -52, { color: '#6a9aff', intensity: 2.2, distance: 5, flicker: 'candle', priority: 1.2 });
  // gas valve + igniter on the boiler front
  lever(g, b, 1.45, 1.1, -50.6, Math.PI / 2, {
    id: 'ow_gas',
    style: 'lever',
    color: '#f1c40f',
    hold: 1.2,
    prompt: (on) => (on ? null : 'Газ к котлу: открыть'),
    get: () => st.lit,
    set: (on) => {
      if (!on || st.lit) return;
      g.co.start(lightBoiler(g, refs, fireLight), 'zone');
    },
  });
  b.prop(FX.signPanel(m, 'КОТЁЛ №1', { bg: '#2a2622', fg: '#c9a34a', w: 384, h: 96, width: 1.0 }), 1.3, 3.6, -52, Math.PI / 2, { collide: false });
  b.update((dt) => {
    if (st.lit && st.pressure < 1) {
      st.pressure = Math.min(1, st.pressure + dt / 12);
      if (st.pressure >= 1) steamCheck(st);
    }
    bo.gaugeNeedle.rotation.x = Math.PI * 0.75 - st.pressure * Math.PI * 1.5;
  });
  // the valve board on the south wall, facing north
  const vb = O.valveBoard(m);
  b.prop(vb.group, -6, 0, -36.3, Math.PI, { static: false });
  documentProp(g, b, 'steam_board', -9.2, 1.5, -36.15, Math.PI, 'none', FX.paperOnWall(m, sign('РАЗВОДКА ПАРА\nсм. памятку', { bg: '#efe6cf', fg: '#22313a', w: 384, h: 256 }), 0.45, true));
  const sync = () => {
    vb.wheels.forEach((w) => (w.visible = st.wheel));
    vb.stems.forEach((s, i) => (s.rotation.z = st.open[i] ? 0 : Math.PI / 2));
    vb.lamps.forEach((l, i) => (l.emissiveIntensity = st.lit && st.open[i] ? 2 : 0));
    vb.needle.rotation.z = Math.PI * 0.75 - Math.min(1, liftPressure(st)) * Math.PI * 1.25;
  };
  sync();
  b.update(sync);
  const boardHit = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.3), new THREE.MeshBasicMaterial({ visible: false }));
  b.prop(boardHit, -6, 1.5, -36.6, 0, { collide: false, static: false });
  g.interact.add({
    id: 'ow_board_wheel',
    object: boardHit,
    kind: 'use',
    prompt: () => (st.wheel ? null : g.state.has('valve_wheel') ? 'Надеть маховик на вентиль' : 'Вентили без маховиков'),
    onUse: () => {
      if (!g.state.has('valve_wheel')) {
        g.ui.hud.subtitle('Шесть квадратных штоков. Без маховика их не повернуть — разве что пальцами, а пальцев жалко.', 4);
        return;
      }
      st.wheel = true;
      g.state.removeItem('valve_wheel');
      g.audio.play('impact_metal', { pos: boardHit.position, volume: 0.5, rate: 1.3 });
    },
  });
  vb.stems.forEach((stem, i) => {
    g.interact.add({
      id: 'ow_valve_' + (i + 1),
      object: stem,
      kind: 'use',
      hold: 0.5,
      prompt: () => (st.wheel && !st.done ? `Вентиль В${i + 1}: ${st.open[i] ? 'закрыть' : 'открыть'}` : null),
      onUse: () => {
        g.audio.play('valve', { pos: stem.getWorldPosition(new THREE.Vector3()), volume: 0.7 });
        const solved = steamToggle(st, i);
        if (solved) g.co.start(liftReady(g), 'zone');
      },
    });
  });
  // pipes: header → whistle (roof), → cold-room heating (west wall), → lift pistons (north)
  const rust = '#6a4a3a';
  const pipe = (pts: number[][], r = 0.09, col = rust) => b.prop(FX.pipeRun(m, pts.map(([x, y, z]) => new THREE.Vector3(x, y, z)), r, col, 0.8), 0, 0, 0, 0, { collide: false });
  pipe([[-6, 2.6, -36.8], [-6, 3.2, -40], [-2, 3.2, -48.5]], 0.14); // boiler → header
  pipe([[-7.9, 3.0, -36.5], [-7.9, 11, -36.5], [-7.9, 11.8, -40]], 0.08, '#7a3a2a'); // whistle line
  pipe([[-7.14, 3.0, -36.5], [-13.8, 3.0, -36.5], [-13.8, 3.0, -30]], 0.08, '#3a5a7a'); // cold heating line
  pipe([[-5.62, 3.0, -36.5], [-5.62, 5.5, -36.5], [1.3, 5.5, -50], [1.3, 5.5, -63.4], [1.3, 0.5, -63.4]], 0.08, '#4a6a4a'); // lift A
  pipe([[-3.34, 3.0, -36.5], [-3.34, 6.2, -36.5], [2.7, 6.2, -50], [2.7, 6.2, -63.4], [2.7, 0.5, -63.4]], 0.08, '#4a6a4a'); // lift B
  b.prop(FX.signPanel(m, 'СВИСТОК', { bg: '#7a3a2a', fg: '#fff', w: 256, h: 64, width: 0.6 }), -7.9, 6, -36.25, Math.PI, { collide: false });
  b.prop(FX.signPanel(m, 'ХОЛОДИЛЬНИК', { bg: '#3a5a7a', fg: '#fff', w: 384, h: 64, width: 0.8 }), -12.5, 3.5, -36.25, Math.PI, { collide: false });
  b.prop(FX.signPanel(m, 'ПОДЪЁМНИК ←', { bg: '#4a6a4a', fg: '#fff', w: 384, h: 64, width: 0.8 }), -4.5, 6.6, -36.25, Math.PI, { collide: false });
  // whistle noise when its line is open under pressure
  let whistleT = 0;
  b.update((dt) => {
    const f = steamFlow(st);
    if (f.whistle > 0.15) {
      whistleT -= dt;
      if (whistleT <= 0) {
        whistleT = 2.2;
        g.audio.play('steam_burst', { pos: new THREE.Vector3(-7.9, 11, -40), volume: 0.9, rate: 1.6, ref: 12 });
        g.bus.emit('noise', { x: -7.9, y: 0, z: -40, radius: 60, source: 'whistle' });
      }
    }
  });
  b.sound('steam_loop', -2, 3, -52, 0.3, { when: () => st.lit });
  b.sound('machine_loop', 2, 1, -63, 0.3, { when: () => st.done });
  // catwalk on the west side (grates are loud)
  b.solid('grate', -12.4, 3.8, -50, 2.8, 0.1, 22, { tag: 'surf:grate', opaque: false });
  b.stairs('grate', -12.4, -38.6, 0, 3.9, 5, 1.4, 'n');
  b.railing([[-11.0, -39], [-11.0, -61]], 3.9, 1.0, 'metal_rust');
  b.update(gratesNoise(g));
  // the crate for Northfield
  b.prop(F.crate(m, 1.2), 14.5, 0, -61.5, 0.2);
  inspect(g, b, null, 14.5, 1.0, -61.5, 'Опечатанный ящик: «Нортфилд. Проект «Люмен». Детали Ядра №1 — для калибровки второго. 1999». Ящик пуст. Доски выломаны — изнутри.', { secret: 'sec_crate', size: 1.0 });
  // lights: the dynamo feeds work lights once the boiler is lit
  for (const [x, z] of [
    [-6, -42],
    [8, -42],
    [-6, -58],
    [8, -58],
    [2, -50],
  ])
    refs.workLights.push(lamp(g, b, 'pendant', x, 12, z, { drop: 4, intensity: 26, distance: 14, color: '#ffcf8a', on: g.state.is('oldworks.power') }));
  lamp(g, b, 'emergency', 17.88, 3, -40, { ry: -Math.PI / 2, intensity: 3, distance: 7 });
  lamp(g, b, 'emergency', -13.88, 3, -60, { ry: Math.PI / 2, intensity: 3, distance: 7 });
  // the lift to the Core
  const lift = I.freightLift(m);
  b.prop(lift.group, 2, -0.11, -67, 0, { collide: false, static: false });
  const gcol = b.collider(0.3, 0, -64.2, 3.7, 3, -63.9, { opaque: false });
  refs.liftGate = { gate: lift.gate, col: gcol };
  if (g.state.is('oldworks.liftOpen')) {
    lift.gate.position.y = 2.6;
    gcol.enabled = false;
  }
  b.prop(FX.signPanel(m, 'ПОДЪЁМНИК · СЕРДЦЕВИНА ↓', { bg: '#2a2622', fg: '#c9a34a', w: 768, h: 96, width: 2.4 }), 2, 3.4, -63.88, 0, { collide: false });
  const down = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.3, 0.12), new THREE.MeshBasicMaterial({ visible: false }));
  b.prop(down, 3.55, 1.3, -67, -Math.PI / 2, { collide: false, static: false });
  b.prop(FX.electricalBox(m, 0.3, 0.4), 3.85, 1.3, -67, -Math.PI / 2, { collide: false });
  g.interact.add({
    id: 'ow_lift_down',
    object: down,
    kind: 'use',
    prompt: () => (g.state.is('oldworks.liftOpen') ? 'Вниз: «Сердцевина»' : null),
    onUse: () => g.co.start(liftRide(g), 'zone'),
  });
}

function gratesNoise(g: Game): (dt: number) => void {
  let t = 0;
  const last = new THREE.Vector3();
  return (dt) => {
    t -= dt;
    const p = g.player.pos;
    const onGrate = p.y > 0.4 && p.x < -10.8 && p.x > -14 && p.z < -38 && p.z > -62;
    const moved = last.distanceTo(p) > 0.03;
    last.copy(p);
    if (!onGrate || !moved || g.player.crouched || t > 0) return;
    t = 0.7;
    g.bus.emit('noise', { x: p.x, y: p.y, z: p.z, radius: 14, source: 'grate' });
  };
}

function* lightBoiler(g: Game, refs: Refs, fireLight: VLight): CoGen {
  const st = refs.steam;
  g.audio.play('valve', { pos: new THREE.Vector3(1.4, 1.1, -50.6), volume: 0.8 });
  yield 0.8;
  g.audio.play('spark', { pos: new THREE.Vector3(1.4, 1.5, -52), volume: 0.8 });
  st.lit = true;
  refs.boilerFire.emissiveIntensity = 2.5;
  fireLight.setOn(true);
  g.audio.play('whoosh', { pos: new THREE.Vector3(1.4, 1.5, -52), volume: 0.9, rate: 0.6 });
  g.ui.hud.subtitle('Котёл ожил. Стрелка давления медленно ползёт вверх.', 4);
  yield 6;
  // the dynamo picks up: lights, monitors... and cameras
  g.state.set('oldworks.power');
  g.audio.play('machine_loop', { pos: new THREE.Vector3(10, 2, -60), volume: 0.6 })?.stop(3);
  for (const l of refs.workLights) {
    l.setOn(true);
    g.audio.play('breaker_on', { pos: l.position, volume: 0.4, ref: 8 });
    yield 0.3;
  }
  refs.monitors();
  yield 1.5;
  g.co.start(huntBegins(g, false), 'zone');
}

function* liftReady(g: Game): CoGen {
  g.state.markSolved('p10');
  g.audio.play('machine_loop', { pos: new THREE.Vector3(2, 1, -64), volume: 0.6 })?.stop(4);
  g.audio.play('steam_burst', { pos: new THREE.Vector3(2, 0.5, -63.4), volume: 0.8 });
  yield 1.0;
  g.ui.hud.subtitle('Поршни подъёмника под давлением. Но ворота держит что-то ещё — тросы уходят в нишу со Шкатулкой.', 5);
  g.objective('Открыть замок подъёмника — Шкатулка в западной нише');
  g.checkpoint('oldworks.p10', { silent: true });
}

function* liftRide(g: Game): CoGen {
  if (Math.abs(g.player.pos.z + 67) > 2 || Math.abs(g.player.pos.x - 2) > 1.8) {
    g.ui.hud.subtitle('Сначала нужно зайти в кабину.', 3);
    return;
  }
  const refs = refsOf(g);
  g.canSave = false;
  const v = g.verity;
  v.onCatch = () => {};
  refs.liftGate.col.enabled = true;
  for (let t = 1; t >= 0; t -= 0.05) {
    refs.liftGate.gate.position.y = t * 2.6;
    yield 0.03;
  }
  g.audio.play('metal_slam', { volume: 0.7 });
  const motor = g.audio.play('motor_loop', { loop: true, volume: 0.7, rate: 0.7 });
  g.player.addTrauma(0.4);
  g.music.stop(2);
  if (v.visible) {
    v.stop();
    v.state = 'scripted';
    v.rolling = false;
    v.teleport(new THREE.Vector3(2, 0, -61.5), Math.PI);
    v.lookAtPlayer = true;
    v.setMood('scared');
    v.expression('open');
  }
  yield g.say('verity', 'Нет-нет-нет, не туда! Там же Сердцевина. Там же — я.', { degrade: 3, pos: new THREE.Vector3(2, 1, -61.5) });
  yield g.say('verity', 'Туда нельзя смотреть. Там некрасиво. Пожалуйста.', { degrade: 3, pos: new THREE.Vector3(2, 1, -61.5) });
  yield 1;
  v.hide();
  v.onCatch = null;
  g.state.set('oldworks.done');
  yield g.fadeOut(2);
  motor?.stop(0.5);
  g.canSave = true;
  yield g.loadZone('core', 'start').catch(() => g.notify('Продолжение следует…'));
}

// =====================================================================
// P11: the great music box
// =====================================================================

function musicBoxAlcove(g: Game, b: LevelBuilder, refs: Refs): void {
  const m = g.mats;
  const st = g.state.puzzle<MusicBoxState>('p11', musicInit);
  const mb = O.musicBoxMachine(m);
  b.prop(mb.group, -21.5, 0, -50, Math.PI / 2, { static: false });
  if (st.done) mb.drawer.position.z += 0.5;
  const syncLamps = () => mb.tineLamps.forEach((l, i) => l.emissive.set(NOTE_COLOR[st.tines[i]]));
  syncLamps();
  b.prop(FX.signPanel(m, 'ШКАТУЛКА', { bg: '#5a3a22', fg: '#f4d35e', w: 512, h: 96, width: 1.4, font: 'brand' }), -23.85, 3.4, -50, Math.PI / 2, { collide: false });
  // cables from the box to the lift
  b.prop(FX.cableBundle(m, [new THREE.Vector3(-23.6, 3, -48.5), new THREE.Vector3(-14, 5, -48), new THREE.Vector3(0.5, 5, -63.6)], 2), 0, 0, 0, 0, { collide: false });
  refs.workLights.push(lamp(g, b, 'cage', -19, 5.9, -50, { intensity: 6, distance: 8, color: '#ffcf8a', on: g.state.is('oldworks.power') }));
  mb.tines.forEach((t, i) => {
    g.interact.add({
      id: 'ow_tine_' + i,
      object: t,
      kind: 'signal',
      signal: true,
      prompt: () => {
        if (st.done) return null;
        if (!g.state.has('tone_module')) return null;
        return `Зубец ${i + 1}: ${NOTE_NAME[st.tines[i]]} — настроить`;
      },
      onUse: () => {
        if (!g.state.is('bracelet.on')) {
          g.ui.hud.subtitle('Модуль тона молчит. Он работает только через включённый браслет. [B]', 4);
          return;
        }
        musicTune(st, i);
        syncLamps();
        const wp = t.getWorldPosition(new THREE.Vector3());
        g.music.note(TINE_NOTES[st.tines[i]], { pos: wp, volume: 0.8 });
        g.audio.play('keypad_beep', { pos: wp, volume: 0.3, rate: 0.6 });
      },
    });
  });
  // the crank plays the box
  g.interact.add({
    id: 'ow_crank',
    object: mb.crank,
    kind: 'use',
    hold: 0.6,
    prompt: () => (st.done ? null : 'Повернуть рукоять'),
    onUse: () => g.co.start(playBox(g, st, mb), 'zone'),
  });
  g.interact.add({
    id: 'ow_box_drawer',
    object: mb.drawer,
    kind: 'pickup',
    prompt: () => (st.done && !g.state.has('theo_tape') && !g.state.is('picked.theo_tape') ? 'Взять: Кассета «Колыбельная»' : null),
    onUse: () => {
      g.giveItem('theo_tape');
      g.state.set('picked.theo_tape');
      g.ui.hud.subtitle('Кассета. Рукой Тео: «Для него. Когда будет можно». Колыбельная.', 5);
    },
  });
  inspect(g, b, null, -14.6, 1.5, -44.6, 'Нотный лист на гвозде. Тео писал цветными мелками, как для малышей.', { size: 0.5, prompt: 'Осмотреть ноты' });
  documentProp(g, b, 'lullaby_score', -14.6, 1.5, -44.4, Math.PI, 'none', FX.paperOnWall(m, lullabySheet(), 0.6, true, 0.05));
}

function* playBox(g: Game, st: MusicBoxState, mb: O.MusicBoxModel): CoGen {
  g.audio.play('servo', { pos: mb.group.position, volume: 0.5, rate: 0.6 });
  const res = musicPlay(st);
  for (let k = 0; k < res.notes.length; k++) {
    mb.cylinder.rotation.x += 0.4;
    mb.crank.rotation.x += Math.PI / 2;
    const wp = mb.tines[k].getWorldPosition(new THREE.Vector3());
    g.music.note(res.notes[k], { pos: wp, volume: 0.9, broken: !res.open && musicCorrect(st) < 2 });
    mb.tines[k].rotation.x = -0.08;
    yield 0.45;
    mb.tines[k].rotation.x = 0;
  }
  g.bus.emit('noise', { x: mb.group.position.x, y: 0, z: mb.group.position.z, radius: 22, source: 'musicbox' });
  if (!res.open) {
    yield 0.4;
    if (musicCorrect(st) >= 3) g.ui.hud.subtitle('Почти. Одна нота фальшивит.', 3);
    else if (!g.state.is('bracelet.on')) g.ui.hud.subtitle('Не похоже на колыбельную. Зубцы светятся разными цветами — их можно подстроить. Модуль тона работает через браслет. [B]', 6);
    else g.ui.hud.subtitle('Не похоже на колыбельную. Скорее на скрип.', 3);
    return;
  }
  g.state.markSolved('p11');
  yield 0.5;
  g.audio.play('lock_open', { pos: mb.group.position, volume: 0.8 });
  for (let t = 0; t < 1; t += 0.05) {
    mb.drawer.position.z += 0.025;
    yield 0.03;
  }
  g.ui.hud.subtitle('Шкатулка доиграла колыбельную. Выдвинулся ящик. Где-то за стеной щёлкнули тросы подъёмника.', 5);
  const refs = refsOf(g);
  g.audio.play('metal_groan', { pos: new THREE.Vector3(2, 2, -64), volume: 0.8, ref: 12 });
  if (refs.steam.done) openLift(g, refs);
  else g.objective('Пустить пар к подъёмнику (вентили в котельной)');
}

function openLift(g: Game, refs: Refs): void {
  if (g.state.is('oldworks.liftOpen')) return;
  g.state.set('oldworks.liftOpen');
  g.co.start(
    (function* (): CoGen {
      g.audio.play('elevator_ding', { pos: new THREE.Vector3(2, 2, -64), volume: 0.7 });
      for (let t = 0; t <= 1; t += 0.04) {
        refs.liftGate.gate.position.y = t * 2.6;
        yield 0.03;
      }
      refs.liftGate.col.enabled = false;
      g.objective('Спуститься на подъёмнике в Сердцевину');
    })(),
    'zone',
  );
}

function lullabySheet(): HTMLCanvasElement {
  const [c, g] = canvas(512, 384);
  g.fillStyle = '#f7f2e6';
  g.fillRect(0, 0, 512, 384);
  g.fillStyle = '#2a3a8a';
  g.font = "700 40px 'Caveat', cursive";
  g.fillText('Колыбельная — для Шкатулки', 40, 60);
  g.strokeStyle = 'rgba(40,40,40,0.5)';
  g.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    g.beginPath();
    g.moveTo(30, 140 + i * 22);
    g.lineTo(482, 140 + i * 22);
    g.stroke();
  }
  const notes = [4, 2, 1, 0];
  notes.forEach((n, i) => {
    const x = 110 + i * 95;
    const y = 240 - n * 18;
    g.fillStyle = NOTE_COLOR[n];
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
  g.font = "700 30px 'Caveat', cursive";
  g.fillText('соль · ми · ре · до', 140, 320);
  g.font = "500 22px 'Caveat', cursive";
  g.fillText('браслет — ВКЛЮЧИТЬ. Быстро. — Т.', 140, 356);
  return c;
}

// =====================================================================
// workshop + east corridor: the loop back to the gallery
// =====================================================================

function workshop(g: Game, b: LevelBuilder, refs: Refs): void {
  const m = g.mats;
  for (let i = 0; i < 3; i++) b.prop(I.workbench(m, 2.4), 20.2, 0, -44 - i * 5, Math.PI / 2);
  for (let i = 0; i < 2; i++) b.prop(I.workbench(m, 2.0), 27.6, 0, -46 - i * 7, -Math.PI / 2);
  const r = new Rng(90);
  for (let i = 0; i < 9; i++) b.prop(O.tinToy(m, r.pick(['robot', 'car', 'bear'] as const), 90 + i), 20.2 + r.range(-0.2, 0.2), 0.92, -44 - Math.floor(i / 3) * 5 + (i % 3) * 0.6 - 0.6, r.range(0, 6), { collide: false });
  b.prop(O.lineShaft(m, 18, 4.5, 4), 24, 0, -50, 0, { collide: false });
  hideLocker(g, b, 'ws_locker1', 29.55, 0, -42, -Math.PI / 2, '#5a6a5a');
  hideLocker(g, b, 'ws_locker2', 29.55, 0, -58, -Math.PI / 2, '#5a6a5a');
  throwable(g, b, wrench(m), 'гаечный ключ', 27.6, 0.93, -45.5, 'impact_metal', 16);
  for (let i = 0; i < 3; i++) {
    const bottle = new ModelBuilder();
    bottle.add(cyl(0.035, 0.04, 0.22, 10), new THREE.MeshPhysicalMaterial({ color: 0x3a6a3a, transparent: true, opacity: 0.6, roughness: 0.1 }), 0, 0.11, 0);
    throwable(g, b, bottle.group, 'бутылка', 27.4, 0.93, -52.8 - i * 0.3, 'impact_glass', 20);
  }
  refs.workLights.push(lamp(g, b, 'cage', 24, 4.9, -46, { intensity: 7, distance: 9, color: '#ffcf8a', on: g.state.is('oldworks.power') }));
  refs.workLights.push(lamp(g, b, 'cage', 24, 4.9, -55, { intensity: 7, distance: 9, color: '#ffcf8a', on: g.state.is('oldworks.power'), flicker: 'buzz' }));
  lamp(g, b, 'emergency', 29.88, 3, -50, { ry: -Math.PI / 2, intensity: 2.5, distance: 6 });
}

function eastCorridor(g: Game, b: LevelBuilder, refs: Refs): void {
  const m = g.mats;
  // the door into Nadia's office is latched from the corridor side
  new Door(g, b, {
    id: 'ow_east',
    x: 22,
    z: -11,
    axis: 'z',
    style: 'metal',
    color: '#4a5a4a',
    lock: () => (g.state.is('door.ow_east') || g.player.pos.x > 22 ? null : 'Заперто на щеколду с той стороны'),
  });
  for (const z of [-20, -32]) refs.workLights.push(lamp(g, b, 'cage', 24, 3.4, z, { intensity: 5, distance: 7, color: '#ffcf8a', on: g.state.is('oldworks.power') }));
  lamp(g, b, 'emergency', 25.88, 2.6, -26, { ry: -Math.PI / 2, intensity: 2.5, distance: 6 });
  for (let i = 0; i < 4; i++) b.prop(F.barrel(m, '#4a3a2a'), 25.4, 0, -14 - i * 5.5, i);
  hideLocker(g, b, 'east_locker', 25.55, 0, -27, -Math.PI / 2, '#5a6a5a');
}

// =====================================================================
// Nadia's cameras: his new windows
// =====================================================================

const CAMS: Array<[string, number, number, number, number, number]> = [
  // id, x, y, z, yaw (facing), sweep
  ['котельная-юг', 17.6, 4.5, -36.6, Math.PI * 1.25, 0.6],
  ['котельная-север', -13.6, 4.5, -63.4, Math.PI * 0.25, 0.6],
  ['мастерская', 29.6, 3.6, -40.6, Math.PI * 1.25, 0.5],
  ['коридор', 25.6, 3.0, -10.6, Math.PI, 0.3],
  ['галерея', 9.6, 4.5, -33.4, Math.PI * 1.75, 0.6],
];

function cameras(g: Game, b: LevelBuilder, refs: Refs): void {
  const m = g.mats;
  CAMS.forEach(([id, x, y, z, yaw, sweep], i) => {
    const c = O.securityCam(m);
    b.prop(c.group, x, y, z, yaw + Math.PI, { collide: false, static: false });
    const cam: Cam = { id, pos: new THREE.Vector3(x, y, z), baseYaw: yaw, sweep, head: c.head, led: c.led, cut: g.state.is('oldworks.cut.' + i), seen: 0, phase: i * 1.7 };
    refs.cams.push(cam);
    // the junction box with the cable you can tear out
    const jb = FX.electricalBox(m, 0.25, 0.3);
    const jx = x - Math.sin(yaw) * 0.0;
    b.prop(jb, jx, 1.3, z, yaw + Math.PI, { collide: false, static: false });
    b.prop(FX.cableBundle(m, [new THREE.Vector3(x, y - 0.1, z), new THREE.Vector3(x, 1.5, z)], 1), 0, 0, 0, 0, { collide: false });
    g.interact.add({
      id: 'ow_cam_cut_' + i,
      object: jb,
      kind: 'use',
      hold: 1.0,
      prompt: () => (cam.cut ? null : g.state.is('oldworks.power') ? 'Вырвать кабель камеры' : 'Распаечная коробка камеры'),
      onUse: () => {
        if (!g.state.is('oldworks.power')) {
          g.ui.hud.subtitle('Кабель от камеры Нади. Без питания она слепая.', 3);
          return;
        }
        cam.cut = true;
        g.state.set('oldworks.cut.' + i);
        cam.led.emissiveIntensity = 0;
        g.audio.play('spark', { pos: jb.position, volume: 0.8 });
        sparks(g, jb.position.clone(), 20);
        g.bus.emit('noise', { x: jb.position.x, y: 0, z: jb.position.z, radius: 10, source: 'cut' });
        refs.monitors();
      },
    });
  });
  let say = 0;
  b.update((dt) => {
    say -= dt;
    const power = g.state.is('oldworks.power');
    const t = g.time;
    const eye = g.renderer.camera.position;
    for (const c of refs.cams) {
      if (c.cut || !power) {
        c.led.emissiveIntensity = 0;
        c.seen = 0;
        continue;
      }
      const yaw = c.baseYaw + Math.sin(t * 0.4 + c.phase) * c.sweep;
      c.head.rotation.y = yaw - c.baseYaw;
      const to = eye.clone().sub(c.pos);
      const d = to.length();
      const fwd = new THREE.Vector3(Math.sin(yaw), -0.25, Math.cos(yaw)).normalize();
      const inView = !g.player.hidden && d < 16 && to.normalize().dot(fwd) > 0.78 && g.world.lineOfSight(c.pos, eye);
      c.seen = THREE.MathUtils.clamp(c.seen + (inView ? dt / 0.9 : -dt / 1.5), 0, 1);
      c.led.emissiveIntensity = c.seen >= 1 ? 3 : 0.6 + Math.max(0, Math.sin(t * 6)) * 0.8;
      if (c.seen >= 1 && g.state.is('oldworks.hunt')) {
        const p = g.player.pos;
        g.verity.lastSeen.copy(p);
        g.bus.emit('noise', { x: p.x, y: p.y, z: p.z, radius: 999, source: 'camera' });
        if (say <= 0) {
          say = 9;
          const lines = ['Вижу тебя!', 'Ты в окошке!', 'Нашёл окошко. Иду!', 'Не прячься от камер. Надя их для меня поставила.'];
          g.say('verity', lines[Math.floor(Math.random() * lines.length)], { degrade: 3, pos: c.pos });
        }
      }
    }
  });
}

// =====================================================================
// the hunt
// =====================================================================

function* huntBegins(g: Game, restored: boolean): CoGen {
  const refs = refsOf(g);
  const v = g.verity;
  if (!restored) {
    yield 1.0;
    g.audio.play('static_burst', { volume: 0.5 });
    yield 0.5;
    yield g.say('verity', 'Ой. Я тебя вижу. Тут тоже есть окошки. Надины.', { degrade: 3, pos: new THREE.Vector3(17.6, 4.5, -36.6) });
    yield g.say('verity', 'Спасибо, что включил свет. Я сейчас приду.', { degrade: 3, pos: new THREE.Vector3(17.6, 4.5, -36.6) });
    yield 2.5;
  }
  g.state.set('oldworks.hunt');
  g.checkpoint('oldworks.hunt', { silent: true });
  // he breaks through the rubble from the gallery side
  g.audio.play('distant_bang', { pos: new THREE.Vector3(1, 1.5, -35), volume: 1, ref: 10 });
  g.player.addTrauma(0.4);
  yield 0.8;
  g.audio.play('impact_metal', { pos: new THREE.Vector3(1, 1.5, -35), volume: 1, rate: 0.5, ref: 10 });
  refs.rubble.obj.visible = false;
  refs.rubble.col.enabled = false;
  g.zone?.nav?.refresh({ minX: -2, minZ: -37, maxX: 4, maxZ: -33 });
  sparks(g, new THREE.Vector3(1, 1.5, -35), 30);
  v.stage = 3;
  v.spawn(new THREE.Vector3(1, 0, -33), Math.PI, 'scripted');
  v.setMood('angry');
  v.expression('grin');
  v.huntSpeed = 2.1;
  v.chaseSpeed = 4.2;
  v.catchLine = 'Нашёл. Здесь тоже можно остаться.';
  v.startHunt();
  g.music.play('anxious', { fade: 2, volume: 0.35 });
  g.objective('Пустить пар к подъёмнику и открыть Шкатулку. Он тебя ищет');
  if (!restored) g.ui.hud.subtitle('Камеры Нади видят меня. Кабели можно вырвать — коробки у каждой камеры.', 6);
}

// =====================================================================
// director
// =====================================================================

function directorEvents(g: Game): void {
  g.director.add({
    id: 'ow_tin_bear',
    gap: 60,
    once: true,
    when: () => g.state.is('oldworks.entered') && !g.state.is('oldworks.power') && g.player.pos.z < -10 && g.player.pos.z > -30,
    run: () => {
      g.music.note(76, { pos: new THREE.Vector3(-3.5, 1, -14), volume: 0.4, broken: true });
      setTimeout(() => g.music.note(79, { pos: new THREE.Vector3(-3.5, 1, -14), volume: 0.35, broken: true }), 400);
      setTimeout(() => g.ui.hud.subtitle('Жестяной медвежонок на верстаке дёрнул лапой. Сам.', 4), 900);
    },
  });
  g.director.add({
    id: 'ow_cold_whisper',
    gap: 80,
    once: true,
    when: () => g.state.is('oldworks.coldSeen') && !g.state.is('oldworks.power') && g.player.pos.x < -6,
    run: () => g.audio.play('squeak', { pos: new THREE.Vector3(-15, 1.4, -24), volume: 0.3 }),
  });
}


/** A battery camping lantern hanging on a wire (Nadia's way markers). */
function lantern(g: Game, b: LevelBuilder, x: number, y: number, z: number): void {
  const m = g.mats;
  const mb = new ModelBuilder();
  const bulb = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xffc070, emissiveIntensity: 2 });
  mb.add(cyl(0.002, 0.002, 1.2, 4), m.flat('#222222', 0.8, 0), 0, 0.75, 0);
  mb.add(cyl(0.05, 0.06, 0.03, 10), m.painted('#2a2e31', 0.4), 0, 0.14, 0);
  mb.add(cyl(0.045, 0.045, 0.12, 10, 0.5, true), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.25, roughness: 0.1 }), 0, 0.07, 0);
  mb.add(new THREE.SphereGeometry(0.025, 8, 6), bulb, 0, 0.07, 0);
  mb.add(cyl(0.05, 0.05, 0.03, 10), m.painted('#2a2e31', 0.4), 0, 0.0, 0);
  b.prop(mb.group, x, y, z, 0, { collide: false });
  b.light(x, y + 0.05, z, { color: '#ffb868', intensity: 4.5, distance: 10, emissives: [bulb], emissiveBase: 2, flicker: 'candle', priority: 0.9 });
}
