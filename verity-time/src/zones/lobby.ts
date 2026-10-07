import * as THREE from 'three';
import type { ZoneDef } from './types';
import type { Game } from '../Game';
import type { LevelBuilder } from '../world/LevelBuilder';
import type { CoGen } from '../core/Coroutines';
import type { VLight } from '../render/LightManager';
import { Door, lamp, documentProp, tapePlayer, inspect, pickup, hideLocker } from '../world/entities';
import * as F from '../models/furniture';
import * as FX from '../models/fixtures';
import * as L from '../models/lobby';
import { plushVerity } from '../models/items';
import { VerityRig } from '../models/VerityModel';
import { canvas, childDrawing, drawVerity, poster, screenCanvas, stain, sign } from '../assets/Signage';
import { breakerInit, breakerLoad, breakerPowered, breakerToggle, BREAKER_CAP, BREAKER_LABEL_VISIBLE, BREAKER_LINES, BREAKER_LOADS, type BreakerState } from '../puzzles/breaker';
import { KeypadScreen } from '../ui/screens/Keypad';
import { box, cyl, ModelBuilder, rbox } from '../world/geom';
import { Rng } from '../assets/noise';

const THEATER_CODE = '140391';

interface LobbyRefs {
  line: VLight[][];
  emergency: VLight[];
  vendingMats: THREE.MeshStandardMaterial[];
  tvMat: THREE.MeshStandardMaterial | null;
  keypadScreen: THREE.MeshStandardMaterial | null;
  turnstileBlocks: import('../physics/CollisionWorld').Collider[];
  turnstileLeds: THREE.MeshStandardMaterial[];
  water: THREE.Mesh | null;
  pumpOn: boolean;
  needle: THREE.Object3D | null;
  inputLamp: THREE.MeshStandardMaterial | null;
  curtainL: THREE.Mesh | null;
  curtainR: THREE.Mesh | null;
  curtainOpen: number;
  curtainTarget: number;
  stageLights: VLight[];
  houseLights: VLight[];
  neonFacade: THREE.MeshStandardMaterial | null;
}

export const lobby: ZoneDef = {
  id: 'lobby',
  name: 'Зал приветствия',
  chapter: 'Акт I. Добро пожаловать',
  materials: [
    'floor_terrazzo', 'wall_wallpaper', 'wall_wallpaper_teal', 'wall_wallpaper_kids', 'wall_plaster', 'wall_plaster_mint', 'wall_plaster_peach', 'wall_plaster_dark',
    'ceiling_tiles', 'wood_panel', 'wood_dark', 'wood_floor', 'linoleum_beige', 'floor_checker', 'floor_painted_grey', 'playmat', 'floor_carpet_red', 'floor_carpet_theater',
    'concrete', 'concrete_dark', 'tile_blue', 'metal_yellow', 'metal_dark', 'cardboard', 'glass_dirty', 'fabric_red',
  ],
  build(g, b) {
    const m = g.mats;
    const env = b.zone.env;
    env.fogColor.set(0x0b0a09);
    env.fogDensity = 0.022;
    env.ambient.set(0x4a4038);
    env.ambientIntensity = 0.1;
    env.hemiSky.set(0x5a5048);
    env.hemiGround.set(0x1a1410);
    env.hemiIntensity = 0.16;
    env.reverb = 'hall';
    env.ambience = ['room_loop', 'vent_loop'];
    env.envMap = 'hall';
    env.envIntensity = 0.3;

    const refs: LobbyRefs = {
      line: [[], [], [], [], [], []],
      emergency: [],
      vendingMats: [],
      tvMat: null,
      keypadScreen: null,
      turnstileBlocks: [],
      turnstileLeds: [],
      water: null,
      pumpOn: false,
      needle: null,
      inputLamp: null,
      curtainL: null,
      curtainR: null,
      curtainOpen: 0,
      curtainTarget: 0,
      stageLights: [],
      houseLights: [],
      neonFacade: null,
    };
    const p1 = g.state.puzzle<BreakerState>('p1', breakerInit);

    buildRooms(g, b);
    buildAtrium(g, b, refs);
    buildSecurity(g, b, refs);
    buildShop(g, b, refs);
    buildStock(g, b, refs, p1);
    buildParty(g, b, refs);
    buildLostFound(g, b, refs);
    buildAlley(g, b, refs, p1);
    buildTheater(g, b, refs);

    // -------------------------------------------------------------- power
    let lastLoad = -1;
    const applyPower = (instant = false) => {
      for (let i = 0; i < 6; i++) for (const l of refs.line[i]) l.setOn(breakerPowered(p1, i), instant);
      const lit = breakerPowered(p1, 0);
      for (const e of refs.emergency) e.setOn(!lit, instant);
      g.renderer.scene.environmentIntensity = lit ? 0.32 : 0.14;
      const ts = breakerPowered(p1, 1);
      for (const c of refs.turnstileBlocks) c.enabled = !ts;
      for (const led of refs.turnstileLeds) led.emissive.set(ts ? 0x22ff55 : 0xff2a1a);
      const vend = breakerPowered(p1, 4);
      for (const v of refs.vendingMats) v.emissiveIntensity = vend ? 0.9 : 0;
      if (refs.tvMat) refs.tvMat.emissiveIntensity = vend ? 1.3 : 0;
      if (refs.keypadScreen) refs.keypadScreen.emissiveIntensity = breakerPowered(p1, 5) ? 1.6 : 0;
      refs.pumpOn = breakerPowered(p1, 2);
      if (refs.neonFacade) refs.neonFacade.emissiveIntensity = breakerPowered(p1, 3) ? 2 : 0;
      if (refs.inputLamp) refs.inputLamp.emissive.set(p1.fuse ? 0x22ff55 : 0x331111);
      const ld = breakerLoad(p1);
      if (ld !== lastLoad) lastLoad = ld;
    };
    (b.zone as any).applyPower = applyPower;
    applyPower(true);
    // needle & fountain animation
    let needleAngle = 0;
    let waterT = 0;
    b.update((dt) => {
      const target = -1.2 + (breakerLoad(p1) / 80) * 2.4;
      needleAngle += (target - needleAngle) * Math.min(1, dt * 5);
      if (refs.needle) refs.needle.rotation.z = -needleAngle;
      if (refs.water) {
        waterT += dt;
        refs.water.position.y = 0.12 + (refs.pumpOn ? 0.18 + Math.sin(waterT * 3) * 0.005 : 0);
      }
      // curtains
      refs.curtainOpen += (refs.curtainTarget - refs.curtainOpen) * Math.min(1, dt * 0.6);
      const sx = 1 - refs.curtainOpen * 0.82;
      if (refs.curtainL) refs.curtainL.scale.x = sx;
      if (refs.curtainR) refs.curtainR.scale.x = -sx;
    });
    b.sound('water_loop', 0, 0.5, -18, 0.35, { when: () => refs.pumpOn });
    b.sound('hum_loop', 18.5, 1.4, -15.6, 0.25, { when: () => p1.fuse });
    b.sound('buzz_loop', 0, 6, -12, 0.12, { when: () => breakerPowered(p1, 0) });
    b.sound('rain_loop', 0, 1.5, 5.8, 0.25, { ref: 3 });

    // ------------------------------------------------------- panel callbacks
    (b.zone as any).onBreaker = (i: number) => {
      const wasLit = breakerPowered(p1, 0);
      const tripped = breakerToggle(p1, i);
      if (tripped) {
        g.audio.play('breaker_trip', { pos: new THREE.Vector3(18.5, 1.4, -15.7), volume: 1 });
        g.player.addTrauma(0.35);
        g.notify(`ПЕРЕГРУЗКА: больше ${BREAKER_CAP} А. Автомат ввода отключил все линии.`);
        g.co.start(tripScare(g), 'zone');
      } else {
        g.audio.play('breaker_on', { pos: new THREE.Vector3(18.5, 1.4, -15.7), volume: 0.6 });
      }
      applyPower();
      // first time the hall lights come on: the closing announcement
      if (!wasLit && breakerPowered(p1, 0) && !g.state.is('lobby.announce')) {
        g.state.set('lobby.announce');
        g.co.start(announcement(g), 'zone');
      }
      if (breakerPowered(p1, 1) && !g.state.is('lobby.turnstiles')) {
        g.state.set('lobby.turnstiles');
        g.objective('Пройти через турникеты в парковую часть зала');
        g.checkpoint('lobby.p1a', { silent: true });
      }
      if (breakerPowered(p1, 1) && breakerPowered(p1, 5) && !g.state.solved('p1')) {
        g.state.markSolved('p1');
        g.objective('Ввести код на двери театра');
        g.checkpoint('lobby.p1');
      }
    };

    // -------------------------------------------------------------- triggers
    b.trigger('north_half', -14, 0, -24, 14, 5, -11.6, {
      onEnter: () => {
        if (!g.state.is('lobby.north')) {
          g.state.set('lobby.north');
          g.ui.hud.subtitle('За турникетами пахнет иначе. Пылью и сладкой ватой. Как это может пахнуть через тридцать лет?', 6);
          if (!g.state.solved('p1')) g.objective('Найти, как открыть театр');
        }
      },
      once: false,
    });

    // the plush on the turnstile moves while you're not looking
    const plush = plushVerity(m, 1.3, '#f4d35e', 0.5);
    b.prop(plush, 0.7, 1.0, -11, 0, { collide: false, static: false });
    let plushMoved = g.state.is('lobby.plushMoved');
    if (plushMoved) {
      plush.position.set(8, 1.1, -2.1);
      plush.rotation.y = Math.PI;
    }
    b.update(() => {
      if (plushMoved || !g.state.is('lobby.north')) return;
      if (g.player.pos.z > -10.5) {
        // back in the south half: was it out of view?
        const cam = g.renderer.camera;
        const toP = new THREE.Vector3(8, 1.2, -2.1).sub(cam.position).normalize();
        const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
        if (toP.dot(fwd) < 0.2) {
          plushMoved = true;
          g.state.set('lobby.plushMoved');
          plush.position.set(8, 1.1, -2.1);
          plush.rotation.y = Math.PI - 0.4;
          g.audio.play('squeak', { pos: new THREE.Vector3(8, 1.1, -2), volume: 0.35 });
        }
      }
    });

    // director: subtle presence
    g.director.add({
      id: 'mezz_steps',
      gap: 70,
      when: () => g.state.is('lobby.north') && Math.abs(g.player.pos.z + 18) < 6 && !g.state.is('act1.sighting'),
      run: () => {
        g.co.start(
          (function* (): CoGen {
            for (let i = 0; i < 6; i++) {
              g.audio.play('shoe_squeak', { pos: new THREE.Vector3(-8 + i * 2.2, 4.8, -22.6), volume: 0.5, ref: 3 });
              g.audio.play('step_wood', { pos: new THREE.Vector3(-8 + i * 2.2, 4.8, -22.6), volume: 0.35, rate: 1.3, ref: 3 });
              yield 0.42;
            }
          })(),
          'zone',
        );
      },
    });
    g.director.add({
      id: 'far_squeak',
      gap: 90,
      when: () => !breakerPowered(p1, 0) && g.state.is('lobby.north'),
      run: () => g.audio.play('squeak', { pos: new THREE.Vector3(-10, 1, -20), volume: 0.5, ref: 4 }),
    });

    b.spawn('entrance', 0, 0, 4.5, 0);
    b.spawn('start', 0, 0, 4.5, 0);
    b.spawn('north', 0, 0, -14, 0);
    b.spawn('theater', 0, 0, -42, 0);
    b.spawn('backstage', 0, 1.1, -64, 0);
  },
  onEnter(g, spawn, restored) {
    if (restored) return;
    if (spawn === 'entrance' && !g.state.is('lobby.entered')) {
      g.state.set('lobby.entered');
      g.co.start(
        (function* (): CoGen {
          yield 1.2;
          g.audio.play('metal_slam', { pos: new THREE.Vector3(0, 1.4, 6), volume: 0.9 });
          g.player.addTrauma(0.25);
          yield 0.8;
          g.ui.hud.subtitle('Дверь захлопнуло сквозняком. Ключ больше не проворачивается.', 4.5);
          yield 5;
          g.ui.hud.chapterCard('Акт I', 'Добро пожаловать', 6);
          g.objective('Найти, как включить свет');
        })(),
        'zone',
      );
    }
  },
};

// =====================================================================
// rooms
// =====================================================================

function buildRooms(g: Game, b: LevelBuilder): void {
  void g;
  b.room('vest', { x: -4, z: 0, w: 8, d: 6, h: 3.4, floor: 'floor_terrazzo', wall: 'wall_plaster_peach', ceil: 'ceiling_tiles', baseboard: 'wood_dark' });
  b.room('atrium', {
    x: -14,
    z: -24,
    w: 28,
    d: 24,
    h: 9,
    floor: 'floor_terrazzo',
    wall: 'wall_wallpaper',
    ceil: 'wall_plaster',
    baseboard: 'wood_dark',
    wainscot: { mat: 'wood_panel', height: 1.2, rail: 'wood_dark' },
  });
  b.connect('vest', 'atrium', 0, 3.2, 3.0);
  b.room('sec', { x: -22, z: -10, w: 8, d: 8, h: 3.2, floor: 'linoleum_beige', wall: 'wall_plaster_mint', ceil: 'ceiling_tiles', baseboard: 'wood_dark' });
  b.connect('atrium', 'sec', -6, 1.1, 2.2);
  b.room('shop', { x: 14, z: -10, w: 9, d: 9, h: 3.6, floor: 'floor_checker', wall: 'wall_wallpaper_kids', ceil: 'ceiling_tiles', baseboard: 'wood_dark' });
  b.connect('atrium', 'shop', -5.5, 2.6, 2.8);
  b.room('stock', { x: 14, z: -16, w: 9, d: 6, h: 3.2, floor: 'floor_painted_grey', wall: 'concrete', ceil: 'concrete_dark' });
  b.connect('shop', 'stock', 21, 1.1, 2.2);
  b.room('party', { x: -22, z: -22, w: 8, d: 9, h: 3.2, floor: 'playmat', wall: 'wall_wallpaper_teal', ceil: 'ceiling_tiles', baseboard: 'wood_dark' });
  b.connect('atrium', 'party', -17.5, 1.2, 2.2);
  b.room('lost', { x: 14, z: -22, w: 6, d: 6, h: 3.2, floor: 'linoleum_beige', wall: 'wall_plaster', ceil: 'ceiling_tiles', baseboard: 'wood_dark' });
  b.connect('atrium', 'lost', -19, 1.1, 2.2);
  b.room('alley', { x: -2, z: -40, w: 4, d: 16, h: 3.4, floor: 'floor_carpet_red', wall: 'wall_wallpaper', ceil: 'ceiling_tiles', baseboard: 'wood_dark', wainscot: { mat: 'wood_panel', height: 1.0, rail: 'wood_dark' } });
  b.connect('atrium', 'alley', 0, 2.4, 2.8);
  b.room('theater', { x: -9, z: -60, w: 18, d: 20, h: 8, floor: 'floor_carpet_theater', wall: 'wall_plaster_dark', ceil: 'wall_plaster_dark', baseboard: 'wood_dark', wainscot: { mat: 'fabric_red', height: 2.4, rail: 'wood_dark' } });
  b.connect('alley', 'theater', 0, 1.8, 2.4);
  b.room('backstage', { x: -9, z: -68, w: 18, d: 8, y: 1.1, h: 4.4, floor: 'wood_floor', wall: 'concrete', ceil: 'concrete_dark' });
  // wings: openings from the stage (y=1.1) into the backstage
  for (const x of [-7.6, 7.6]) {
    b.opening('theater', { side: 'n', at: x, width: 2.2, height: 2.6, sill: 1.1 });
    b.opening('backstage', { side: 's', at: x, width: 2.2, height: 2.6, jambs: false });
  }
  b.room('service', { x: 9, z: -66, w: 14, d: 4, y: 1.1, h: 3, floor: 'concrete', wall: 'concrete', ceil: 'concrete_dark' });
  b.connect('backstage', 'service', -64, 1.1, 2.2);
}

// =====================================================================
// atrium
// =====================================================================

function buildAtrium(g: Game, b: LevelBuilder, refs: LobbyRefs): void {
  const m = g.mats;
  // vestibule: the outer doors behind you (jammed)
  const outer = new Door(g, b, { id: 'lobby_outer', x: 0, z: 5.95, axis: 'x', width: 1.6, height: 2.5, style: 'glass', lock: () => 'Заело. Снаружи ветер держит створки.', frameColor: '#7d8488' });
  void outer;
  lamp(g, b, 'emergency', -3.9 + 0.01, 2.6, 2, { ry: Math.PI / 2, intensity: 5, distance: 7 });
  b.prop(FX.paperOnWall(m, poster('lost', 512, 724, 0.6, 21), 0.6), 3.89, 1.6, 3, -Math.PI / 2, { collide: false });
  b.prop(F.plantPot(m, true), -3.3, 0, 0.8, 0);
  b.prop(F.plantPot(m, true), 3.3, 0, 0.8, 1);

  // turnstile line with rails dividing the hall
  const tz = -11;
  for (const x of [-2.1, -0.7, 0.7, 2.1]) {
    const t = F.turnstile(m);
    b.prop(t, x, 0, tz, 0, { static: false });
    t.traverse((o) => {
      const mm = o as THREE.Mesh;
      if (mm.isMesh && (mm.material as THREE.MeshStandardMaterial).emissive && (mm.material as THREE.MeshStandardMaterial).emissiveIntensity === 1.5) {
        const led = (mm.material as THREE.MeshStandardMaterial).clone();
        mm.material = led;
        refs.turnstileLeds.push(led);
      }
    });
  }
  for (const x of [-1.4, 0, 1.4]) refs.turnstileBlocks.push(b.collider(x - 0.45, 0, tz - 0.3, x + 0.45, 2.4, tz + 0.3, { opaque: false }));
  b.railing(
    [
      [-13.9, tz],
      [-2.3, tz],
    ],
    0,
    1.1,
    'metal_yellow',
  );
  b.railing(
    [
      [2.3, tz],
      [13.9, tz],
    ],
    0,
    1.1,
    'metal_yellow',
  );
  b.collider(-14, 0, tz - 0.1, -2.3, 2.6, tz + 0.1, { opaque: false });
  b.collider(2.3, 0, tz - 0.1, 14, 2.6, tz + 0.1, { opaque: false });
  for (const x of [-6, 6]) {
    b.prop(F.ticketBooth(m), x, 0, tz + 1.1, 0);
  }
  // secret photo in the right booth drawer
  inspect(g, b, null, 6, 1.0, tz + 1.95, 'В ящике кассы — выцветший снимок. Ребёнок в оранжевой куртке и Верити машут в камеру. На обороте: «Друг №12 и В.». Эту куртку я помню.', {
    prompt: 'Открыть ящик кассы',
    secret: 'sec_photo12',
    size: 0.5,
  });
  inspect(g, b, null, -6, 1.0, tz + 1.95, 'Касса пустая. Под стеклом — рулон билетов «ВРЕМЯ ВЕРИТИ · ВЗРОСЛЫЙ · ДЕТСКИЙ · ДРУГ».', { prompt: 'Осмотреть кассу', size: 0.5 });
  // banner above the turnstiles
  const [bc, bg] = canvas(1024, 256);
  bg.fillStyle = '#2f6f6a';
  bg.fillRect(0, 0, 1024, 256);
  bg.fillStyle = '#f6e7c1';
  bg.font = "700 88px 'Comfortaa', sans-serif";
  bg.textAlign = 'center';
  bg.fillText('ВРЕМЯ ВЕРИТИ', 600, 160);
  drawVerity(bg, 90, 128, 60, { wave: true });
  const banner = L.bannerCloth(m, bc, 9, 2.25);
  banner.position.set(0, 6.6, tz);
  b.addDynamic(banner);
  for (const x of [-4.5, 4.5]) b.prop(new THREE.Mesh(cyl(0.006, 0.006, 2.4, 4), m.steel('#777', 0.5)), x, 7.8, tz, 0, { collide: false });

  // fountain with the statue
  const fz = -18;
  const fnt = L.fountain(m, 3);
  fnt.group.remove(fnt.water);
  b.prop(fnt.group, 0, 0, fz, 0);
  fnt.water.position.set(0, 0.12, fz);
  b.addDynamic(fnt.water);
  refs.water = fnt.water;
  const statue = new VerityRig(m);
  statue.setStage(1);
  statue.setGesture('wave');
  statue.lookTarget = new THREE.Vector3(0, 1.5, 0);
  for (let i = 0; i < 40; i++) statue.update(0.05, { speed: 0, time: i * 0.05 });
  statue.root.scale.setScalar(2.4);
  b.prop(statue.root, 0, 1.36, fz, 0, { collide: false });
  b.collider(-1.2, 0, fz - 1.2, 1.2, 5, fz + 1.2, { opaque: false });
  inspect(g, b, null, 0, 1.0, fz + 3.2, 'Табличка: «Мы построили место, где ни один ребёнок не будет одинок. — А. Пелл, 1992». Кто-то приписал маркером: «А он?»', { prompt: 'Прочитать табличку', size: 0.6 });

  // mezzanine balcony along the north wall
  b.solid('wood_dark', 0, 4.4, -22.75, 28, 0.3, 2.5, { collide: false });
  b.railing(
    [
      [-13.9, -21.5],
      [-1.4, -21.5],
    ],
    4.7,
    1.0,
    'metal_dark',
    false,
  );
  b.railing(
    [
      [1.4, -21.5],
      [13.9, -21.5],
    ],
    4.7,
    1.0,
    'metal_dark',
    false,
  );
  // giant clock above the alley
  b.prop(FX.wallClock(m, 19, 0, 0.17), 0, 6.8, -23.88, 0, { collide: false, scale: 5 });
  b.prop(FX.signPanel(m, 'АЛЛЕЯ ДРУЗЕЙ · ТЕАТР', { bg: '#3b2c63', fg: '#f6e7c1', font: 'brand', w: 768, h: 128, width: 2.6 }), 0, 3.25, -23.9, 0, { collide: false });

  // reception / info desk
  b.prop(L.receptionDesk(m, 3.4), 8, 0, -2.6, Math.PI);
  b.prop(F.terminal(m, ['ИНФОРМАЦИЯ', '', 'Добро пожаловать!', 'Сегодня: Шоу Верити', '11:00 14:00 17:00'], false), 8.6, 1.08, -2.35, Math.PI, { collide: false });
  b.prop(F.phone(m), 7.2, 1.08, -2.3, Math.PI + 0.3, { collide: false });
  b.prop(F.paperStack(m, 5, 3), 7.8, 1.08, -2.2, 0.3, { collide: false });
  b.prop(FX.signPanel(m, 'ИНФОРМАЦИЯ', { bg: '#2f6f6a', fg: '#f6e7c1', icon: 'star', w: 512, h: 128, width: 1.4 }), 8, 2.6, -1.3, Math.PI, { collide: false });
  b.prop(new THREE.Mesh(cyl(0.006, 0.006, 6.0, 4), m.steel('#777', 0.5)), 8, 5.9, -1.3, 0, { collide: false });

  // mailbox with letters
  const mb = L.mailbox(m);
  b.prop(mb, -3.4, 0, -2.2, 0.3);
  documentProp(g, b, 'kids_letters', -3.4, 1.0, -1.95, 0.3, 'none');

  // vending machines (line 5)
  for (const [z, label] of [
    [-1.6, 'ВЕРИТИ-СОДА'],
    [-3.0, 'СЛАДКАЯ ВАТА'],
  ] as const) {
    const v = F.vendingMachine(m, z < -2 ? '#2f6f6a' : '#b8322a', label);
    v.traverse((o) => {
      const mm = o as THREE.Mesh;
      if (mm.isMesh && (mm.material as THREE.MeshStandardMaterial).emissiveMap) {
        const mat = (mm.material as THREE.MeshStandardMaterial).clone();
        mm.material = mat;
        refs.vendingMats.push(mat);
      }
    });
    b.prop(v, -13.45, 0, z, Math.PI / 2, { static: false });
  }
  // CRT on a wall bracket (line 5) plays the old commercial
  const tvScreen = screenCanvas(['', '   ПРИВЕТ, ДРУГ!', '', '   ВЕРИТИ', '   ТВОЙ ДРУГ НАВСЕГДА', '', '   ▶ 19:00'], { color: '#ffe9a0', bg: '#1a2a4a' });
  const tv = F.crtTV(m, true, tvScreen);
  const scr = tv.userData.screen as THREE.Mesh;
  refs.tvMat = scr.material as THREE.MeshStandardMaterial;
  b.prop(tv, -13.5, 2.0, -13.5, Math.PI / 2, { collide: false, static: false });
  b.solid('metal_dark', -13.75, 1.9, -13.5, 0.5, 0.1, 0.6, { collide: false });
  g.interact.add({
    id: 'tv_ad',
    object: tv,
    kind: 'listen',
    range: 3,
    prompt: () => (refs.tvMat && refs.tvMat.emissiveIntensity > 0.1 ? 'Смотреть рекламу' : null),
    onUse: () => g.playLog('ad_commercial'),
  });

  // arcade corner
  for (const [z, col] of [
    [-13.2, '#3b2c63'],
    [-14.4, '#7a1f2b'],
  ] as const)
    b.prop(F.arcadeCabinet(m, col, screenCanvas(['VERITY BOUNCE', '', 'INSERT COIN'], { color: '#ffd84a', bg: '#100820' })), 13.4, 0, z, -Math.PI / 2);

  // benches, plants, bins, stroller, lost balloons
  for (const [x, z, ry] of [
    [-9, -4, 0],
    [-9, -8.5, Math.PI],
    [10, -15, Math.PI / 2],
    [-10, -15, -Math.PI / 2],
  ] as const)
    b.prop(F.bench(m, 1.8), x, 0, z, ry);
  for (const [x, z] of [
    [-13, -10.2],
    [13, -10.2],
    [-13, -23],
    [13, -23],
  ])
    b.prop(F.plantPot(m, true), x, 0, z, x);
  for (const [x, z] of [
    [-5, -1],
    [5, -9.8],
    [-7, -21.5],
  ])
    b.prop(F.trashBin(m, '#2f6f6a'), x, 0, z, 0.5);
  b.prop(L.stroller(m), 11.5, 0, -19.5, 0.8);
  b.prop(L.balloon(m, '#ef8a7e', 0, true), -4, 0, -6, 1, { collide: false });
  b.prop(L.balloon(m, '#5fb7ad', 0, true), 3, 0, -15.5, 2, { collide: false });
  b.prop(L.balloon(m, '#f4d35e', 8.4), -6, 0, -20, 0, { collide: false });
  b.prop(L.balloon(m, '#ef8a7e', 8.5), -6.3, 0, -19.8, 0, { collide: false });
  // stanchions with velvet ropes in front of the theatre corridor
  for (const x of [-3, -1.6, 1.6, 3]) b.prop(L.stanchion(m), x, 0, -22.2, 0, { collide: false });
  b.prop(L.rope(m, new THREE.Vector3(-3, 0.95, -22.2), new THREE.Vector3(-1.6, 0.95, -22.2)), 0, 0, 0, 0, { collide: false });
  b.prop(L.rope(m, new THREE.Vector3(1.6, 0.95, -22.2), new THREE.Vector3(3, 0.95, -22.2)), 0, 0, 0, 0, { collide: false });
  // posters
  const posters: Array<[Parameters<typeof poster>[0], number, number, number, number]> = [
    ['friend', -13.88, 2.6, -6.5, Math.PI / 2],
    ['time7', 13.88, 2.6, -14, -Math.PI / 2],
    ['truth', -13.88, 2.6, -20.5, Math.PI / 2],
    ['smile', 13.88, 2.6, -2, -Math.PI / 2],
    ['show', -4, 2.4, -23.88, 0],
    ['helper', 4, 2.4, -23.88, 0],
  ];
  posters.forEach(([k, x, y, z, ry], i) => b.prop(FX.framedPicture(m, poster(k, 512, 724, 0.45, 30 + i), 1.1, '#2a2420'), x, y, z, ry, { collide: false }));
  // stains & clutter
  for (let i = 0; i < 8; i++) {
    const r = new Rng(100 + i);
    const st = m.canvasMaterial(stain(i % 3 === 0 ? 'water' : 'dirt', i), { transparent: true, rough: 0.9 });
    b.decal(st, r.range(-12, 12), 0.003, r.range(-22, -1), r.range(1.5, 3.5), r.range(1.5, 3.5), 'up', { rot: r.range(0, 6) });
  }
  const prints = m.canvasMaterial(stain('footprints', 2), { transparent: true });
  b.decal(prints, 1.2, 0.004, -13.5, 0.7, 2.6, 'up', { rot: 0.1 });
  for (let i = 0; i < 6; i++) b.prop(F.looseSheet(m, i), -6 + i * 2.3, 0, -4 - (i % 3) * 5, 0, { collide: false });

  // lighting: hall pendants & sconces (line 1), emergency (battery)
  for (const x of [-8, 0, 8])
    for (const z of [-5, -17]) refs.line[0].push(lamp(g, b, 'pendant', x, 9, z, { drop: 2.6, intensity: 55, distance: 15, color: '#ffdcae' }));
  for (const z of [-4, -16]) {
    refs.line[0].push(lamp(g, b, 'sconce', -13.9, 2.8, z, { ry: Math.PI / 2, intensity: 10, distance: 6 }));
    refs.line[0].push(lamp(g, b, 'sconce', 13.9, 2.8, z - 3, { ry: -Math.PI / 2, intensity: 10, distance: 6 }));
  }
  refs.emergency.push(lamp(g, b, 'emergency', 0, 3.3, -0.12 - 0.0, { ry: Math.PI, intensity: 7, distance: 9 }));
  refs.emergency.push(lamp(g, b, 'emergency', 0, 3.2, -23.9, { intensity: 7, distance: 9 }));
  refs.emergency.push(lamp(g, b, 'emergency', -13.9, 3.0, -12, { ry: Math.PI / 2, intensity: 6, distance: 8 }));
  refs.emergency.push(lamp(g, b, 'emergency', 13.9, 3.0, -9.5, { ry: -Math.PI / 2, intensity: 6, distance: 8 }));
  lamp(g, b, 'exit', 0, 3.2, 0.1, { ry: Math.PI });
  // a ceiling light that died long ago dangles on its wire
  const dead = FX.troffer(m);
  dead.bulb.emissiveIntensity = 0.02;
  dead.group.rotation.z = 0.6;
  b.prop(dead.group, -10.5, 6.3, -9, 0.4, { collide: false });
}

// =====================================================================
// security office
// =====================================================================

function buildSecurity(g: Game, b: LevelBuilder, refs: LobbyRefs): void {
  const m = g.mats;
  new Door(g, b, { id: 'sec_door', x: -14, z: -6, axis: 'z', style: 'office', color: '#5f7a80', label: 'ОХРАНА' });
  // monitor wall
  b.prop(F.desk(m, 2.4, 0.8), -20.6, 0, -8.8, 0);
  b.prop(F.officeChair(m, '#2e3a4a'), -20.6, 0, -7.9, Math.PI + 0.3);
  for (let i = 0; i < 3; i++) b.prop(F.crtTV(m, false), -21.6 + i * 1.0, 0.78, -9.35, 0, { collide: false });
  for (let i = 0; i < 3; i++) b.prop(F.crtTV(m, false), -21.6 + i * 1.0, 1.28, -9.45, 0, { collide: false });
  documentProp(g, b, 'guard_log_1998', -20.0, 0.78, -8.6, 0.2);
  documentProp(g, b, 'staff_code_memo', -21.2, 0.78, -8.55, -0.3, 'clipboard');
  tapePlayer(g, b, 'eva_log', -19.5, 0.78, -8.9, 0.4);
  b.prop(F.mug(m, '#2f6f6a'), -20.4, 0.78, -8.4, 0, { collide: false });
  // the load diagram pinned to the wall
  const diag = loadDiagram();
  documentProp(g, b, 'circuit_table', -17.5, 1.6, -9.88, 0, 'none', FX.paperOnWall(m, diag, 0.8));
  // key cabinet with the spare fuse
  const kc = new ModelBuilder();
  kc.add(rbox(0.6, 0.7, 0.12, 0.01), m.painted('#7a1f1f', 0.5), 0, 0, 0.06);
  kc.add(box(0.5, 0.6, 0.01), m.get('glass_dirty'), 0, 0, 0.125);
  b.prop(kc.group, -14.12 - 0.0, 1.6, -3.4, -Math.PI / 2, { collide: false });
  pickup(g, b, 'fuse', -14.25, 1.45, -3.4, Math.PI / 2, () => {
    g.objective('Вставить предохранитель в щиток (электрощитовая за сувенирной лавкой)');
    g.ui.hud.subtitle('«ЩИТ ЗАЛА — ВВОД». Запасной. Значит, основной кто-то вынул.', 4.5);
  });
  b.prop(F.filingCabinet(m, 4, '#6c7a7b', 1), -21.5, 0, -3, Math.PI / 2);
  hideLocker(g, b, 'sec_locker1', -21.6, 0, -5.2, Math.PI / 2);
  hideLocker(g, b, 'sec_locker2', -21.6, 0, -5.75, Math.PI / 2);
  b.prop(F.waterCooler(m), -15, 0, -9.4, 0);
  b.prop(FX.framedPicture(m, poster('staff', 512, 724, 0.3, 77), 0.6), -14.12, 1.7, -8.4, -Math.PI / 2, { collide: false });
  b.prop(FX.wallClock(m), -18, 2.5, -2.12, Math.PI, { collide: false });
  refs.line[0].push(lamp(g, b, 'troffer', -18, 3.2, -6, { intensity: 14, distance: 8, flicker: 'buzz' }));
  refs.emergency.push(lamp(g, b, 'emergency', -18, 2.7, -9.88, { intensity: 4, distance: 6 }));
}

function loadDiagram(): HTMLCanvasElement {
  const [c, g] = canvas(512, 640);
  g.fillStyle = '#f2f0e6';
  g.fillRect(0, 0, 512, 640);
  g.fillStyle = '#1a2a3a';
  g.font = "700 30px 'IBM Plex Sans', sans-serif";
  g.fillText('ЩИТ ЗАЛА  ЩЗ-1', 30, 52);
  g.font = "500 22px 'IBM Plex Mono', monospace";
  BREAKER_LINES.forEach((n, i) => {
    g.fillText(`${i + 1}. ${n}`, 30, 110 + i * 56);
    g.fillText(`${BREAKER_LOADS[i]} А`, 400, 110 + i * 56);
    g.fillRect(30, 122 + i * 56, 450, 1);
  });
  g.fillStyle = '#b02a2a';
  g.font = "700 26px 'IBM Plex Sans', sans-serif";
  g.fillText('ВВОД: НЕ БОЛЕЕ 60 А', 30, 480);
  g.fillStyle = '#1e2b55';
  g.font = "700 30px 'Caveat', cursive";
  g.fillText('свет всё равно никто не включает — Е.К.', 30, 560);
  return c;
}

// =====================================================================
// gift shop + stock room with the P1 panel
// =====================================================================

function buildShop(g: Game, b: LevelBuilder, refs: LobbyRefs): void {
  const m = g.mats;
  b.prop(FX.signPanel(m, 'СУВЕНИРЫ', { bg: '#ef8a7e', fg: '#fff', font: 'brand', icon: 'star', w: 768, h: 160, width: 2.4 }), 13.9, 3.2, -5.5, -Math.PI / 2, { collide: false });
  // shelves full of plush Veritys
  for (const [x, z, ry] of [
    [16, -9.5, 0],
    [19, -9.5, 0],
    [22.5, -6, -Math.PI / 2],
    [22.5, -3, -Math.PI / 2],
  ] as const) {
    const sh = F.shelf(m, 2.4, 1.9, 0.45, 4, '#e9e3d4');
    b.prop(sh, x, 0, z, ry);
    const levels = sh.userData.levels as number[];
    levels.forEach((ly, li) => {
      for (let k = 0; k < 5; k++) {
        const plush = plushVerity(m, 0.8 + (li % 2) * 0.2, li === 2 ? '#7fd3c7' : '#f4d35e', 0.4);
        const lx = -0.9 + k * 0.45;
        const off = new THREE.Vector3(lx, ly, 0.05).applyAxisAngle(new THREE.Vector3(0, 1, 0), ry);
        b.prop(plush, x + off.x, off.y, z + off.z, ry + (k % 2 ? 0.2 : -0.2), { collide: false });
      }
    });
  }
  // counter + register
  b.prop(L.receptionDesk(m, 2.4, '#ef8a7e'), 17.5, 0, -2.6, Math.PI);
  b.prop(L.cashRegister(m), 17.0, 1.08, -2.4, Math.PI, { collide: false });
  // glass display with the 1989 prototype
  const dc = new ModelBuilder();
  dc.add(box(0.8, 0.9, 0.6), m.woodProp('#5a3a22', 0.4), 0, 0.45, 0);
  dc.add(box(0.76, 0.6, 0.56), m.get('glass_dirty'), 0, 1.2, 0);
  b.prop(dc.group, 21.6, 0, -1.6, Math.PI);
  const proto = plushVerity(m, 1.2, '#e8d9a0', 0.8);
  b.prop(proto, 21.6, 0.92, -1.6, Math.PI + 0.3, { collide: false });
  inspect(g, b, null, 21.6, 1.2, -1.95, 'Прототип 1989 года, мягкий, без антенны. На бирке напечатано «ВЕРА». Кто-то зачеркнул и вывел ручкой: «ВЕРИТИ — потому что правда».', {
    prompt: 'Рассмотреть витрину',
    secret: 'sec_vera',
    size: 0.6,
  });
  // toppled shelf and scattered toys
  const fallen = F.shelf(m, 1.8, 1.6, 0.45, 3, '#e9e3d4');
  fallen.rotation.z = Math.PI / 2;
  b.prop(fallen, 16, 0.25, -6.4, 0.3, { collide: true });
  for (let i = 0; i < 7; i++) b.prop(plushVerity(m, 0.8, i % 2 ? '#f4d35e' : '#7fd3c7', 0.7), 15 + i * 0.5, 0, -5.4 + (i % 3) * 0.4, i, { collide: false });
  b.prop(FX.framedPicture(m, poster('friend', 512, 724, 0.4, 51), 0.9), 14.12, 2.0, -8.5, Math.PI / 2, { collide: false });
  for (const x of [16, 20]) refs.line[0].push(lamp(g, b, 'troffer', x, 3.6, -5.5, { intensity: 14, distance: 8 }));
  refs.emergency.push(lamp(g, b, 'emergency', 22.9, 2.9, -8, { ry: -Math.PI / 2, intensity: 3, distance: 6 }));
}

function buildStock(g: Game, b: LevelBuilder, refs: LobbyRefs, p1: BreakerState): void {
  const m = g.mats;
  new Door(g, b, { id: 'stock_door', x: 21, z: -10, axis: 'x', style: 'metal', color: '#6c7a6e', label: 'ЭЛЕКТРОЩИТОВАЯ' });
  // recalled boxes
  const rng = new Rng(5);
  const label = m.canvasMaterial(sign('ОТОЗВАНО', { bg: '#c0392b', fg: '#fff', w: 256, h: 96 }), { rough: 0.7 });
  for (let i = 0; i < 14; i++) {
    const x = 15 + (i % 5) * 0.75 + rng.range(-0.05, 0.05);
    const z = -11.2 - Math.floor(i / 5) * 0.65;
    const y = (i % 2) * 0.45;
    b.prop(F.cardboardBox(m, 0.6, 0.45, 0.5), x, y, z, rng.range(-0.2, 0.2));
    if (i % 3 === 0) b.decal(label, x, y + 0.25, z + 0.255, 0.3, 0.11, 'n');
  }
  documentProp(g, b, 'recall_notice', 15.8, 0.92, -11.3, 0.2);
  b.prop(F.shelf(m, 2.0, 2.2, 0.5, 4, '#5c6b73'), 22.4, 0, -13, -Math.PI / 2);
  // ---------------------------------------------------- P1 breaker panel
  const PX = 18.5;
  const PY = 1.4;
  const PZ = -15.9;
  b.prop(L.breakerPanelBody(m), PX, PY, PZ, 0, { collide: false });
  // labels plate
  const [lc, lg] = canvas(1024, 160);
  lg.fillStyle = '#e8e2d0';
  lg.fillRect(0, 0, 1024, 160);
  lg.fillStyle = '#222';
  lg.font = "600 22px 'IBM Plex Sans', sans-serif";
  lg.textAlign = 'center';
  for (let i = 0; i < 6; i++) {
    const x = 85 + i * 160;
    lg.fillText(`ЛИНИЯ ${i + 1}`, x, 40);
    if (BREAKER_LABEL_VISIBLE[i]) {
      lg.font = "400 18px 'IBM Plex Sans', sans-serif";
      lg.fillText(BREAKER_LINES[i], x, 80);
      lg.font = "600 26px 'IBM Plex Mono', monospace";
      lg.fillText(`${BREAKER_LOADS[i]} А`, x, 122);
      lg.font = "600 22px 'IBM Plex Sans', sans-serif";
    } else {
      lg.fillStyle = 'rgba(120,100,70,0.6)';
      lg.fillRect(x - 70, 56, 140, 80);
      lg.fillStyle = '#222';
    }
  }
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.156), m.canvasMaterial(lc, { rough: 0.6 }));
  plate.position.set(PX, PY + 0.32, PZ + 0.225);
  b.addDynamic(plate);
  for (let i = 0; i < 6; i++) {
    const x = PX - 0.42 + i * 0.168;
    // big toggle lever
    const mb = new ModelBuilder();
    mb.add(rbox(0.09, 0.16, 0.04, 0.01), m.painted('#2a2c2e', 0.4), 0, 0, 0.02);
    const handle = new THREE.Group();
    handle.position.z = 0.04;
    const knob = new THREE.Mesh(rbox(0.04, 0.09, 0.04, 0.01), m.plastic('#d8d2c4', 0.4));
    knob.position.y = 0.04;
    handle.add(knob);
    mb.group.add(handle);
    const lamp1 = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x22ff55, emissiveIntensity: 0 });
    mb.add(new THREE.SphereGeometry(0.012, 8, 6), lamp1, 0, 0.11, 0.03);
    b.prop(mb.group, x, PY + 0.08, PZ + 0.22, 0, { collide: false, static: false });
    g.interact.add({
      id: 'breaker:' + i,
      object: mb.group,
      kind: 'use',
      prompt: () => `Линия ${i + 1}: ${p1.on[i] ? 'выключить' : 'включить'}`,
      onUse: () => (b.zone as any).onBreaker(i),
    });
    b.update(() => {
      handle.rotation.x = p1.on[i] ? -0.5 : 0.5;
      lamp1.emissiveIntensity = breakerPowered(p1, i) ? 2 : 0;
    });
  }
  // ammeter dial
  const [ac, ag] = canvas(256, 256);
  ag.fillStyle = '#f2efe6';
  ag.beginPath();
  ag.arc(128, 128, 124, 0, Math.PI * 2);
  ag.fill();
  ag.strokeStyle = '#222';
  ag.lineWidth = 3;
  for (let a = 0; a <= 80; a += 10) {
    const ang = -Math.PI / 2 - 1.2 + (a / 80) * 2.4;
    ag.beginPath();
    ag.moveTo(128 + Math.cos(ang) * 92, 150 + Math.sin(ang) * 92);
    ag.lineTo(128 + Math.cos(ang) * 110, 150 + Math.sin(ang) * 110);
    ag.stroke();
    ag.fillStyle = a > 60 ? '#c0392b' : '#222';
    ag.font = "600 18px 'IBM Plex Mono', monospace";
    ag.textAlign = 'center';
    ag.fillText(String(a), 128 + Math.cos(ang) * 74, 156 + Math.sin(ang) * 74);
  }
  ag.strokeStyle = '#c0392b';
  ag.lineWidth = 10;
  ag.beginPath();
  ag.arc(128, 150, 104, -Math.PI / 2 - 1.2 + (60 / 80) * 2.4, -Math.PI / 2 + 1.2);
  ag.stroke();
  ag.fillStyle = '#222';
  ag.font = "700 22px 'IBM Plex Sans', sans-serif";
  ag.fillText('А', 128, 210);
  const dial = new THREE.Mesh(new THREE.CircleGeometry(0.13, 32), m.canvasMaterial(ac, { rough: 0.4 }));
  dial.position.set(PX + 0.38, PY + 0.52, PZ + 0.23);
  b.addDynamic(dial);
  const needle = new THREE.Group();
  needle.position.set(PX + 0.38, PY + 0.52 - 0.0255, PZ + 0.235);
  const nm = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.1, 0.003), new THREE.MeshStandardMaterial({ color: 0xaa1111 }));
  nm.position.y = 0.05;
  needle.add(nm);
  b.addDynamic(needle);
  refs.needle = needle;
  // main input with the fuse socket
  const fz = new ModelBuilder();
  fz.add(rbox(0.22, 0.14, 0.05, 0.01), m.painted('#2a2c2e', 0.4), 0, 0, 0.025);
  const fuseVis = new THREE.Group();
  const glass = new THREE.Mesh(cyl(0.014, 0.014, 0.07, 12), new THREE.MeshPhysicalMaterial({ color: 0xe8f0f0, transparent: true, opacity: 0.5 }));
  glass.rotation.z = Math.PI / 2;
  fuseVis.add(glass);
  fuseVis.position.z = 0.06;
  fuseVis.visible = p1.fuse;
  fz.group.add(fuseVis);
  const inLamp = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x331111, emissiveIntensity: 2 });
  fz.add(new THREE.SphereGeometry(0.015, 8, 6), inLamp, 0.08, 0.05, 0.05);
  refs.inputLamp = inLamp;
  b.prop(fz.group, PX - 0.35, PY + 0.52, PZ + 0.22, 0, { collide: false, static: false });
  g.interact.add({
    id: 'fuse_socket',
    object: fz.group,
    kind: 'use',
    prompt: () => (p1.fuse ? null : g.state.has('fuse') ? 'Вставить предохранитель' : 'Гнездо ввода пустое'),
    onUse: () => {
      if (!g.state.has('fuse')) {
        g.ui.hud.subtitle('Гнездо главного предохранителя пустое. Без него щит мёртвый.', 4);
        if (!g.state.is('lobby.needfuse')) {
          g.state.set('lobby.needfuse');
          g.objective('Найти предохранитель для щита');
        }
        return;
      }
      p1.fuse = true;
      g.state.removeItem('fuse');
      fuseVis.visible = true;
      g.audio.play('lock_open', { pos: fz.group.position, volume: 0.8 });
      g.audio.play('breaker_on', { pos: fz.group.position, volume: 0.5, rate: 0.8 });
      (b.zone as any).applyPower();
      g.objective('Включить нужные линии. Ввод — не более 60 А');
      g.ui.hud.subtitle('Ожил. Стрелка амперметра дрогнула. Шесть линий, а генератор тянет только шестьдесят ампер.', 6);
    },
  });
  b.prop(FX.signPanel(m, 'ЩЗ-1 · НЕ БОЛЕЕ 60 А', { bg: '#f1c40f', fg: '#111', w: 512, h: 96, width: 0.9 }), PX, PY + 0.95, PZ + 0.03, 0, { collide: false });
  refs.line[0].push(lamp(g, b, 'cage', 18.5, 2.9, -10.12, { ry: Math.PI, intensity: 9, distance: 7 }));
  refs.emergency.push(lamp(g, b, 'emergency', 15.0, 2.6, -15.88, { intensity: 4, distance: 6 }));
}

// =====================================================================
// party room (code clue), lost & found
// =====================================================================

function buildParty(g: Game, b: LevelBuilder, refs: LobbyRefs): void {
  const m = g.mats;
  new Door(g, b, { id: 'party_door', x: -14, z: -17.5, axis: 'z', style: 'kids', color: '#ef8a7e', label: 'ПРАЗДНИКИ' });
  for (const [x, z] of [
    [-19.5, -15.5],
    [-16.5, -15.5],
    [-18, -19.5],
  ]) {
    b.prop(F.kidTable(m, 1.4, 0.8, '#ef8a7e'), x, 0, z, 0);
    for (const [dx, dz, ry] of [
      [-0.4, -0.7, 0],
      [0.4, -0.7, 0.2],
      [-0.4, 0.7, Math.PI],
      [0.4, 0.7, Math.PI - 0.3],
    ] as const)
      b.prop(F.kidChair(m, ['#f4d35e', '#5fb7ad', '#ef8a7e'][Math.abs(Math.round(dx * 10)) % 3]), x + dx, 0, z + dz, ry);
  }
  b.prop(L.cake(m, 3), -18, 0.52, -19.5, 0, { collide: false });
  b.prop(F.paperStack(m, 4, 8), -19.4, 0.52, -15.3, 0.3, { collide: false });
  // the photo wall: three birthdays (the code clue)
  const photos: Array<[number, number, string]> = [
    [1992, 1, '14.03.1992 — первый праздник! 1 годик'],
    [1993, 2, '14.03.1993 — Верити 2 года'],
    [1994, 3, '14.03.1994 — 3 года, уже большой'],
  ];
  photos.forEach(([y, n, cap], i) => {
    b.prop(FX.framedPicture(m, L.birthdayPhoto(y, n, cap), 0.62, '#f4d35e'), -21.88, 1.75, -20.5 + i * 1.05, Math.PI / 2, { collide: false });
  });
  inspect(g, b, null, -21.6, 1.75, -19.45, 'Три праздника, три торта. На первом снимке — одна свечка, 1992 год. Значит, родился он годом раньше.', { prompt: 'Рассмотреть фотографии', size: 1.0, ry: Math.PI / 2 });
  b.prop(FX.paperOnWall(m, poster('birthday', 512, 724, 0.4, 61), 1.0), -18, 1.9, -21.88, 0, { collide: false });
  b.prop(FX.paperOnWall(m, childDrawing('verity_me', 3), 0.6, true, 0.04), -15.5, 1.5, -21.88, 0.05, { collide: false });
  b.prop(FX.paperOnWall(m, childDrawing('many_friends', 4), 0.6, true, 0.03), -20.5, 1.45, -13.12, Math.PI, { collide: false });
  // piñata hanging from the ceiling
  const pin = new ModelBuilder();
  pin.add(new THREE.SphereGeometry(0.3, 16, 12), m.cloth('#f4d35e', 0.7), 0, 0, 0);
  pin.add(new THREE.SphereGeometry(0.3, 16, 6, 0, Math.PI * 2, Math.PI * 0.6, Math.PI * 0.4), m.cloth('#ef8a7e', 0.7), 0, 0.001, 0);
  pin.add(cyl(0.004, 0.004, 0.9, 4), m.flat('#ddd', 0.9, 0), 0, 0.75, 0);
  // the piñata has been opened with care, like a door
  pin.add(new THREE.CircleGeometry(0.12, 12), new THREE.MeshStandardMaterial({ color: 0x050505, side: THREE.DoubleSide }), 0, -0.05, 0.29);
  b.prop(pin.group, -17, 2.0, -17.5, 0.6, { collide: false, static: false });
  for (const [x, z, c] of [
    [-21, -14, '#ef8a7e'],
    [-15, -21, '#5fb7ad'],
    [-20, -21.2, '#f4d35e'],
  ] as const)
    b.prop(L.balloon(m, c, 2.85), x, 0, z, 0, { collide: false });
  b.prop(L.balloon(m, '#7b6cf6', 0, true), -16.2, 0, -14.2, 1, { collide: false });
  refs.line[0].push(lamp(g, b, 'troffer', -18, 3.2, -17.5, { intensity: 12, distance: 8 }));
  refs.emergency.push(lamp(g, b, 'emergency', -14.12, 2.8, -20, { ry: -Math.PI / 2, intensity: 3, distance: 6 }));
}

function buildLostFound(g: Game, b: LevelBuilder, refs: LobbyRefs): void {
  const m = g.mats;
  new Door(g, b, { id: 'lost_door', x: 14, z: -19, axis: 'z', style: 'wood', label: 'БЮРО НАХОДОК' });
  b.prop(L.receptionDesk(m, 2.2, '#5f7a80'), 16.2, 0, -19, -Math.PI / 2);
  for (const [z, s] of [
    [-21.4, 1],
    [-16.6, 2],
  ]) {
    const sh = F.shelf(m, 2.6, 2.0, 0.45, 4, '#5c6b73');
    b.prop(sh, 18.2, 0, z, z < -19 ? 0 : Math.PI);
    for (const ly of sh.userData.levels as number[]) b.prop(L.lostItems(m, s * 10 + ly * 100), 18.2, ly, z, 0, { collide: false });
  }
  inspect(g, b, null, 18.2, 1.0, -20.9, 'Варежки разложены по парам. Шапки — по цветам. Кто-то годами наводил здесь порядок, как будто хозяева вот-вот вернутся.', { prompt: 'Осмотреть полки', size: 0.9 });
  refs.line[0].push(lamp(g, b, 'troffer', 17, 3.2, -19, { intensity: 10, distance: 7, flicker: 'dying' }));
}

// =====================================================================
// alley of friends + theatre door (P2)
// =====================================================================

function buildAlley(g: Game, b: LevelBuilder, refs: LobbyRefs, p1: BreakerState): void {
  const m = g.mats;
  for (let i = 0; i < 20; i++) {
    const z = -25.3 - i * 0.72;
    for (const side of [-1, 1]) {
      const n = side < 0 ? i * 2 + 1 : i * 2 + 2;
      const empty = n === 12;
      const pic = FX.framedPicture(m, L.kidPortrait(n, empty), 0.42, '#3a2a1a');
      b.prop(pic, side * 1.89, 1.65 + (i % 2) * 0.12, z, side < 0 ? Math.PI / 2 : -Math.PI / 2, { collide: false });
      if (empty)
        inspect(g, b, null, side * 1.75, 1.7, z, 'Двенадцатая рамка пустая. Фотографию вынули, а на картоне написали мелом: «ПРИХОДИ ЕЩЁ».', {
          prompt: 'Друг №12',
          size: 0.45,
          once: () => g.music.motif({ variant: 'kind', volume: 0.25, pos: new THREE.Vector3(0, 1.5, -40) }),
        });
    }
  }
  documentProp(g, b, 'friends_alley', -1.88, 1.4, -24.6, Math.PI / 2, 'none', FX.framedPicture(m, sign('АЛЛЕЯ ДРУЗЕЙ', { bg: '#f6e7c1', fg: '#3b2c63', font: 'brand', w: 512, h: 256, sub: 'сорок первых друзей' }), 0.5, '#b08d57'));
  for (let i = 0; i < 4; i++) refs.line[0].push(lamp(g, b, 'sconce', i % 2 ? 1.9 : -1.9, 2.5, -27 - i * 3.6, { ry: i % 2 ? -Math.PI / 2 : Math.PI / 2, intensity: 6, distance: 5 }));
  refs.emergency.push(lamp(g, b, 'emergency', 0, 3.0, -39.88, { intensity: 4, distance: 7 }));
  // theatre door with keypad (line 6)
  const door = new Door(g, b, {
    id: 'theater_door',
    x: 0,
    z: -40,
    axis: 'x',
    width: 1.8,
    height: 2.4,
    style: 'wood',
    color: '#7a1f2b',
    label: 'ТЕАТР',
    lock: () => (g.state.is('lobby.code') ? null : 'Заперто: кодовый замок'),
  });
  const kp = L.keypadUnit(m);
  refs.keypadScreen = kp.screen;
  b.prop(kp.group, 1.35, 1.35, -39.88, 0, { collide: false, static: false });
  b.prop(FX.signPanel(m, 'ПИТАНИЕ: ЛИНИЯ 6', { bg: '#22313a', fg: '#e8e2d0', font: 'mono', w: 384, h: 64, width: 0.26 }), 1.35, 1.58, -39.88, 0, { collide: false });
  g.interact.add({
    id: 'theater_keypad',
    object: kp.group,
    kind: 'use',
    prompt: () => (g.state.is('lobby.code') ? null : 'Кодовый замок'),
    onUse: () => {
      if (!breakerPowered(p1, 5)) {
        g.audio.play('switch', { volume: 0.4 });
        g.ui.hud.subtitle('Экран замка мёртвый. На табличке: «ПИТАНИЕ: ЛИНИЯ 6».', 4);
        if (!g.state.is('lobby.needline6')) {
          g.state.set('lobby.needline6');
          g.objective('Подать питание на линию 6 (сцена) — щит в электрощитовой');
        }
        return;
      }
      g.openScreen(
        new KeypadScreen(g, {
          title: 'ТЕАТР · СЛУЖЕБНЫЙ ВХОД · ДДММГГ',
          length: 6,
          check: (c) => c === THEATER_CODE,
          onFail: (c) => {
            if (c === '140392') g.ui.hud.subtitle('Нет. Это первый праздник, а не день рождения.', 4);
            else if (c.startsWith('1403')) g.ui.hud.subtitle('День и месяц, кажется, верные. Год — нет.', 4);
          },
          onSuccess: () => {
            g.state.set('lobby.code');
            g.state.markSolved('p2');
            door.refreshLock();
            door.setOpen(true);
            g.objective('Войти в театр');
            g.checkpoint('lobby.p2');
          },
        }),
      );
    },
  });
  // a wrong code chalked on the wall (Gosha did write it down after all)
  const ch = m.canvasMaterial(scrawlChalk('1 4 0 3 9 ?'), { transparent: true });
  b.decal(ch, -1.2, 0.9, -39.88, 0.6, 0.15, 'n');
}

function scrawlChalk(t: string): HTMLCanvasElement {
  const [c, g] = canvas(512, 128);
  g.clearRect(0, 0, 512, 128);
  g.fillStyle = 'rgba(240,240,230,0.75)';
  g.font = "700 72px 'Caveat', cursive";
  g.fillText(t, 20, 90);
  return c;
}

// =====================================================================
// theatre, stage, backstage, service corridor (Verity's first appearance)
// =====================================================================

function buildTheater(g: Game, b: LevelBuilder, refs: LobbyRefs): void {
  const m = g.mats;
  // seating
  for (let r = 0; r < 6; r++) {
    const z = -43.5 - r * 1.05;
    for (const side of [-1, 1])
      for (let k = 0; k < 11; k++) {
        const x = side * (1.1 + k * 0.62);
        if (Math.abs(x) > 8.4) continue;
        b.prop(L.theaterSeat(m, (k * 7 + r * 3) % 9 === 0), x, 0, z, Math.PI);
      }
  }
  // stage platform + steps
  b.solid('wood_floor', 0, 0, -55.5, 18, 1.1, 9, { tag: 'surf:wood' });
  b.stairs('wood_floor', -5.4, -49.5, 0, 1.1, 1.5, 1.2, 'n');
  b.stairs('wood_floor', 5.4, -49.5, 0, 1.1, 1.5, 1.2, 'n');
  b.solid('fabric_red', 0, 0, -50.9, 12, 1.1, 0.2, { collide: false });
  // proscenium arch
  b.solid('wall_plaster_dark', -7.75, 1.1, -51.2, 2.5, 6.9, 0.5);
  b.solid('wall_plaster_dark', 7.75, 1.1, -51.2, 2.5, 6.9, 0.5);
  b.solid('wall_plaster_dark', 0, 6.4, -51.2, 13, 1.6, 0.5);
  b.prop(FX.signPanel(m, 'ШОУ ВЕРИТИ', { bg: '#6b1f28', fg: '#ffd84a', font: 'brand', icon: 'star', w: 1024, h: 192, width: 5 }), 0, 7.0, -50.9, 0, { collide: false });
  // curtains (two halves)
  const cl = L.curtain(m, 6.2, 5.1);
  cl.position.set(-6.2, 1.1, -51.6);
  b.addDynamic(cl);
  const cr = L.curtain(m, 6.2, 5.1);
  cr.position.set(6.2, 1.1, -51.6);
  cr.scale.x = -1;
  b.addDynamic(cr);
  refs.curtainL = cl;
  refs.curtainR = cr;
  if (g.state.is('act1.sighting')) refs.curtainOpen = refs.curtainTarget = 1;
  // stage dressing: a backdrop with a painted sky and a cardboard sun
  const [bd, bdg] = canvas(1024, 512);
  const grd = bdg.createLinearGradient(0, 0, 0, 512);
  grd.addColorStop(0, '#6fb7d8');
  grd.addColorStop(1, '#f6e3b0');
  bdg.fillStyle = grd;
  bdg.fillRect(0, 0, 1024, 512);
  bdg.fillStyle = '#f4d35e';
  bdg.beginPath();
  bdg.arc(820, 120, 70, 0, Math.PI * 2);
  bdg.fill();
  for (let i = 0; i < 5; i++) {
    bdg.fillStyle = 'rgba(255,255,255,0.85)';
    bdg.beginPath();
    bdg.ellipse(150 + i * 170, 90 + (i % 2) * 40, 70, 28, 0, 0, Math.PI * 2);
    bdg.fill();
  }
  bdg.fillStyle = '#7dcf6f';
  bdg.fillRect(0, 420, 1024, 92);
  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(13, 6.5), m.canvasMaterial(bd, { rough: 0.9 }));
  backdrop.position.set(0, 4.35, -59.85);
  b.addDynamic(backdrop);
  b.prop(F.crate(m, 0.7), -4.5, 1.1, -57.5, 0.3);
  b.prop(F.crate(m, 0.6), 5, 1.1, -58, -0.2);
  b.prop(F.kidChair(m, '#f4d35e'), 3.2, 1.1, -54, 0.6);
  // house lights (line 1) and stage spots (line 6)
  for (const x of [-8.85, 8.85]) for (const z of [-44, -48]) refs.line[0].push(lamp(g, b, 'sconce', x, 3.2, z, { ry: x < 0 ? Math.PI / 2 : -Math.PI / 2, intensity: 8, distance: 7 }));
  for (const x of [-3, 3]) {
    const v = b.spot(x, 7.4, -46, 0, 1.2, -55, { color: 0xfff0d0, intensity: 260, distance: 18, angle: 0.28, penumbra: 0.45, priority: 4 });
    refs.line[5].push(v);
    refs.stageLights.push(v);
    b.prop(FX.stageSpot(m).group, x, 7.6, -46, 0, { collide: false });
  }
  const glow = lamp(g, b, 'bare', 0, 6.2, -55, { intensity: 14, distance: 9, color: '#ffe6b0', drop: 0.1 });
  refs.line[5].push(glow);
  refs.emergency.push(lamp(g, b, 'exit', 0, 2.9, -40.12, { ry: Math.PI }));
  refs.emergency.push(lamp(g, b, 'emergency', -8.85, 3.0, -52, { ry: Math.PI / 2, intensity: 4, distance: 7 }));

  // ------------------------------------------------ the first sighting
  b.trigger('sighting', -9, 0, -47.5, 9, 4, -44, {
    when: () => !g.state.is('act1.sighting') && (refs.line[5][0]?.on ?? false),
    onEnter: () => g.co.start(sighting(g, refs), 'zone'),
  });

  // ------------------------------------------------ backstage
  b.prop(L.clothesRack(m, 2.0), -6, 1.1, -66.5, 0);
  const head = L.costumeHead(m);
  b.prop(head, -3.6, 1.1 + 0.75, -67.3, 0.4, { collide: false, static: false });
  b.prop(F.table(m, 1.4, 0.6, 0.75, '#d8d2c4'), -3.6, 1.1, -67.3, 0);
  inspect(g, b, null, -3.6, 1.1 + 1.1, -67.3, 'Голова маскарадного костюма. Изнутри, на подкладке, нацарапано: «ОН ЗНАЕТ, ЧТО ЭТО НЕ ОН».', { prompt: 'Заглянуть внутрь головы', secret: 'sec_costume', size: 0.7 });
  documentProp(g, b, 'costume_note', -6.8, 1.1 + 0.76, -67.4, 0.2, 'sheet');
  b.prop(F.table(m, 1.2, 0.6, 0.75, '#d8d2c4'), -6.8, 1.1, -67.4, 0);
  // dressing table with bulbs around the mirror
  const dt = new ModelBuilder();
  dt.add(rbox(1.4, 0.05, 0.5, 0.01), m.woodProp('#5a3a22', 0.5), 0, 0.75, 0);
  dt.add(box(1.2, 0.9, 0.02), new THREE.MeshPhysicalMaterial({ color: 0x8a9092, metalness: 1, roughness: 0.12 }), 0, 1.35, -0.23);
  const bulbM = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xffd9a0, emissiveIntensity: 0 });
  for (let i = 0; i < 7; i++) dt.add(new THREE.SphereGeometry(0.03, 8, 6), bulbM, -0.6 + i * 0.2, 1.85, -0.2);
  for (const x of [-0.65, 0.65]) dt.add(box(0.04, 0.75, 0.04), m.woodProp('#5a3a22', 0.5), x, 0.375, 0);
  b.prop(dt.group, 2.5, 1.1, -67.6, 0);
  documentProp(g, b, 'show_script', 2.2, 1.1 + 0.78, -67.5, 0.1, 'clipboard');
  tapePlayer(g, b, 'theo_rehearsal', 2.9, 1.1 + 0.78, -67.45, -0.3);
  for (const x of [5.5, 6.2]) b.prop(F.crate(m, 0.65), x, 1.1, -66.6, x);
  const bs1 = lamp(g, b, 'cage', 0, 1.1 + 3.6, -67.88, { intensity: 10, distance: 8, flicker: 'buzz' });
  refs.line[5].push(bs1);
  refs.emergency.push(lamp(g, b, 'emergency', 8.88, 1.1 + 3.0, -64, { ry: -Math.PI / 2, intensity: 4, distance: 6 }));
  b.update(() => (bulbM.emissiveIntensity = bs1.on ? 1.2 : 0));

  // service door → workshops
  new Door(g, b, {
    id: 'service_door',
    x: 9,
    y: 1.1,
    z: -64,
    axis: 'z',
    style: 'service',
    label: 'МАСТЕРСКИЕ',
    lock: () => (g.state.is('act1.sighting') ? null : 'Заперто изнутри'),
  });
  // service corridor dressing
  b.prop(FX.pipeRun(m, [new THREE.Vector3(9.2, 3.7, -62.3), new THREE.Vector3(22.8, 3.7, -62.3)], 0.08, '#5e6b5c'), 0, 0, 0, 0, { collide: false });
  b.prop(FX.pipeRun(m, [new THREE.Vector3(9.2, 3.5, -62.6), new THREE.Vector3(22.8, 3.5, -62.6)], 0.05, '#7b3a33'), 0, 0, 0, 0, { collide: false });
  lamp(g, b, 'cage', 15, 1.1 + 2.7, -65.88, { intensity: 8, distance: 7, flicker: 'dying' });
  lamp(g, b, 'emergency', 21, 1.1 + 2.5, -65.88, { intensity: 4, distance: 6 });
  b.prop(FX.signPanel(m, 'МАСТЕРСКИЕ →', { bg: '#22313a', fg: '#f1c40f', font: 'ui', w: 512, h: 128, width: 1.2 }), 17, 1.1 + 1.8, -65.88, 0, { collide: false });
  b.trigger('to_factory', 21.5, 1.0, -66, 23, 4, -62, {
    onEnter: () => {
      if (g.state.is('act1.sighting')) {
        g.state.set('act1.done');
        g.loadZone('factory', 'start').catch(() => g.notify('Продолжение следует…'));
      }
    },
  });
}

function* sighting(g: Game, refs: LobbyRefs): CoGen {
  const stage = new THREE.Vector3(0, 1.1, -55.6);
  g.canSave = false;
  g.director.bump();
  g.music.motif({ variant: 'kind', pos: stage.clone().setY(2), volume: 0.5 });
  yield 1.8;
  // house lights dim, stage lights pulse
  for (const l of refs.line[0]) l.setOn(false);
  g.audio.play('motor_loop', { pos: stage, volume: 0.4, rate: 0.6 })?.stop(4.5);
  refs.curtainTarget = 1;
  yield 2.2;
  g.verity.stage = 0;
  g.verity.watch(stage, {
    vanishDist: 5.5,
    maxTime: 16,
    yaw: 0,
    onVanish: (reason) => g.co.start(afterSighting(g, refs, reason), 'zone'),
  });
  g.verity.setMood('happy');
  g.verity.expression('smile');
  g.addFear(0.25);
  yield 2.5;
  if (g.verity.state === 'watch') {
    g.verity.gesture('wave');
    yield 2.2;
    g.verity.gesture('none');
    g.verity.rig.tilt = 0.28;
  }
}

function* afterSighting(g: Game, refs: LobbyRefs, reason: 'near' | 'unseen' | 'time'): CoGen {
  g.verity.rig.tilt = 0;
  if (reason !== 'unseen') {
    // blackout
    g.lights.master = 0;
    g.flashlight.suppressed = 1;
    g.audio.play('boing', { pos: new THREE.Vector3(0, 1.6, -55.6), volume: 0.6 });
    yield 1.4;
    g.lights.master = 1;
    g.flashlight.suppressed = 0;
  } else {
    g.audio.play('boing', { pos: new THREE.Vector3(0, 1.6, -55.6), volume: 0.25 });
  }
  g.state.set('act1.sighting');
  void refs;
  yield 0.8;
  g.audio.play('door_creak', { pos: new THREE.Vector3(9, 2.2, -64), volume: 0.8 });
  g.audio.play('lock_open', { pos: new THREE.Vector3(9, 2.2, -64), volume: 0.7 });
  yield 1.5;
  g.ui.hud.subtitle('Он просто смотрел. Будто ждал, что я помашу в ответ.', 5);
  g.canSave = true;
  g.objective('Пройти за кулисы к служебному выходу');
  g.checkpoint('lobby.sighting');
}

function* tripScare(g: Game): CoGen {
  g.flashlight.flicker(1.5, 0.9);
  yield 1.2;
  g.audio.play('squeak', { pos: g.player.pos.clone().add(new THREE.Vector3(3, 0.5, -4)), volume: 0.25 });
  yield 0.5;
  g.audio.play('shoe_squeak', { pos: g.player.pos.clone().add(new THREE.Vector3(4, 0, -5)), volume: 0.3 });
}

function* announcement(g: Game): CoGen {
  const pa = new THREE.Vector3(0, 7, -12);
  yield 1.5;
  g.audio.play('static_burst', { pos: pa, volume: 0.6, ref: 6, noOcclusion: true });
  yield 0.5;
  yield g.say('pa', 'Дорогие друзья! Комплекс «Время Верити» закрывается.', { pos: pa });
  yield g.say('pa', 'Просим всех гостей пройти к выходу. Верити будет скучать!', { pos: pa });
  yield 1.0;
  g.music.play('ad', { fade: 0.3, volume: 0.55, loop: false });
  yield 13.5;
  g.music.stop(0.04);
  g.audio.play('glitch', { pos: pa, volume: 0.5, ref: 6 });
  yield 2.2;
  g.say('verity', '…не уходи…', { pos: pa, degrade: 1 });
  yield 3;
  g.ui.hud.subtitle('Песенка оборвалась на середине. Как будто кто-то выдернул шнур.', 5);
}
