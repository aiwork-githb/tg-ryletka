import * as THREE from 'three';
import type { ZoneDef } from './types';
import type { CoGen } from '../core/Coroutines';
import { Door, lamp, documentProp, tapePlayer, inspect } from '../world/entities';
import * as O from '../models/outdoor';
import * as F from '../models/furniture';
import * as FX from '../models/fixtures';
import { poster, screenCanvas, photo } from '../assets/Signage';
import { skyDome, rain, lightning } from '../world/weather';

const inRect = (p: THREE.Vector3, x0: number, z0: number, x1: number, z1: number) => p.x > x0 && p.x < x1 && p.z > z0 && p.z < z1;

export const outside: ZoneDef = {
  id: 'outside',
  name: 'Ворота',
  chapter: 'Пролог. Письмо',
  materials: ['asphalt', 'dead_grass', 'brick_painted', 'concrete', 'concrete_dark', 'grate', 'glass_dirty', 'wall_plaster', 'floor_terrazzo', 'ceiling_tiles', 'wood_dark', 'metal_dark'],
  build(g, b) {
    const m = g.mats;
    const env = b.zone.env;
    env.fogColor.set(0x0a0c10);
    env.fogDensity = 0.035;
    env.ambient.set(0x506070);
    env.ambientIntensity = 0.12;
    env.hemiSky.set(0x3a4658);
    env.hemiGround.set(0x15130f);
    env.hemiIntensity = 0.22;
    env.reverb = 'outside';
    env.ambience = ['rain_loop', 'wind_loop'];
    env.envMap = 'night';
    env.envIntensity = 0.6;

    // ---------------------------------------------------------------- ground
    // asphalt lot inside the fence + road outside
    b.solid('asphalt', 0, -0.2, -11, 60, 0.2, 38, { collide: true, opaque: false, ao: false, tag: 'surf:concrete' });
    b.solid('asphalt', 0, -0.2, 15, 60, 0.2, 14, { collide: true, opaque: false, ao: false, tag: 'surf:concrete' });
    b.solid('dead_grass', -24, -0.15, -11, 12, 0.2, 38, { collide: false, ao: false });
    b.solid('dead_grass', 24, -0.15, -11, 12, 0.2, 38, { collide: false, ao: false });
    // curbs
    b.solid('concrete', -18, 0, -11, 0.3, 0.15, 38, { collide: true, opaque: false });
    b.solid('concrete', 18, 0, -11, 0.3, 0.15, 38, { collide: true, opaque: false });
    // parking lines
    const lineMat = new THREE.MeshStandardMaterial({ color: 0xd8d2b8, roughness: 0.8, transparent: true, opacity: 0.55, polygonOffset: true, polygonOffsetFactor: -2 });
    for (let i = 0; i < 6; i++) {
      for (const sx of [-1, 1]) {
        const x = sx * (8 + i * 2.6);
        if (Math.abs(x) > 17) continue;
        b.decal(lineMat, x, 0.002, -4, 0.12, 5, 'up');
      }
    }

    // ---------------------------------------------------------------- building facade
    const FZ = -30;
    b.solid('brick_painted', -17, 0, FZ - 0.3, 26, 14, 0.6);
    b.solid('brick_painted', 17, 0, FZ - 0.3, 26, 14, 0.6);
    b.solid('brick_painted', 0, 3.4, FZ - 0.3, 8, 10.6, 0.6);
    b.solid('concrete_dark', 0, 14, FZ - 0.3, 60, 0.6, 1.2, { collide: false });
    // dark windows
    const winMat = new THREE.MeshStandardMaterial({ color: 0x07090c, roughness: 0.15, metalness: 0.4 });
    const frameMat = m.painted('#c9c2b0', 0.6);
    for (const y of [5.5, 9.5])
      for (let x = -27; x <= 27; x += 4.5) {
        if (Math.abs(x) < 6) continue;
        b.decal(winMat, x, y, FZ + 0.01, 2.4, 2.2, 'n', { offset: 0.012 });
        b.solid('concrete', x, y - 1.25, FZ + 0.05, 2.8, 0.12, 0.25, { collide: false });
        void frameMat;
      }
    // canopy + columns
    b.solid('concrete', 0, 3.9, FZ + 2.3, 9, 0.35, 4.6, { opaque: true });
    for (const x of [-3.8, 3.8]) b.solid('brick_painted', x, 0, FZ + 4.1, 0.5, 3.9, 0.5);
    // giant clock, stopped at 19:00
    const clock = FX.wallClock(m, 19, 0, 0.17);
    b.prop(clock, 0, 9.4, FZ + 0.02, 0, { collide: false, scale: 9 });
    // neon roof sign (dead, flickers once)
    const neon = O.facadeSign(m, 'ВРЕМЯ ВЕРИТИ', 0);
    neon.group.position.set(0, 12.9, FZ + 0.4);
    b.addDynamic(neon.group);
    // posters by the door
    b.prop(FX.paperOnWall(m, poster('friend', 512, 724, 0.8, 2), 1.1, false), -2.6, 1.7, FZ + 0.01, 0, { collide: false });
    b.prop(FX.paperOnWall(m, poster('time7', 512, 724, 0.85, 3), 1.1, false), 2.6, 1.7, FZ + 0.01, 0, { collide: false });

    // vestibule behind the glass door (dark interior visible through the glass)
    b.room('vestibule', { x: -3.5, z: FZ - 7, w: 7, d: 7, h: 3.4, floor: 'floor_terrazzo', wall: 'wall_plaster', ceil: 'ceiling_tiles', walls: { s: null }, baseboard: 'wood_dark' });
    new Door(g, b, {
      id: 'main_entrance',
      x: 0,
      z: FZ - 0.3,
      axis: 'x',
      width: 1.6,
      height: 2.5,
      style: 'glass',
      key: 'main_key',
      label: 'ВХОД',
      frameColor: '#7d8488',
      onOpen: () => g.objective('Войти в комплекс'),
    });
    // fill the facade around the door inside the brick gap
    b.solid('brick_painted', -2.4, 0, FZ - 0.3, 3.2 - 0.0, 3.4, 0.6);
    b.solid('brick_painted', 2.4, 0, FZ - 0.3, 3.2, 3.4, 0.6);
    lamp(g, b, 'emergency', 0, 2.9, FZ - 6.9, { intensity: 2.5, distance: 6 });
    // a single surviving wall-pack light under the canopy
    lamp(g, b, 'cage', 3.2, 3.2, FZ + 0.05, { intensity: 45, distance: 14, color: '#ffd9a0', flicker: 'buzz' });
    b.sound('buzz_loop', 3.2, 3.2, FZ + 0.2, 0.12);
    b.trigger('enter_lobby', -3, 0, FZ - 6.5, 3, 3, FZ - 1.2, {
      onEnter: () => {
        g.state.set('outside.done');
        g.loadZone('lobby', 'entrance');
      },
    });

    // ---------------------------------------------------------------- fence & gate
    const GZ = 8;
    b.prop(O.fence(m, 27), -30, 0, GZ, 0);
    b.prop(O.fence(m, 27), 3, 0, GZ, 0);
    b.prop(O.fence(m, 38), -30, 0, -30, -Math.PI / 2);
    b.prop(O.fence(m, 38), 30, 0, GZ, Math.PI / 2);
    // gate leaves: one closed, one swung open
    const gateL = O.fence(m, 3, 2.2);
    b.prop(gateL, -3, 0, GZ, -0.2);
    const gateR = O.fence(m, 3, 2.2);
    b.prop(gateR, 3, 0, GZ, Math.PI + 1.25);
    documentProp(g, b, 'demolition_notice', -1.6, 1.3, GZ + 0.25 - 0.05, 0, 'none', FX.signPanel(m, 'ВНИМАНИЕ: СНОС', { bg: '#c0392b', fg: '#fff', w: 512, h: 200, width: 0.8 }));

    // ---------------------------------------------------------------- guard booth
    const BX = -7;
    const BZ = 4;
    b.prop(O.guardBooth(m), BX, 0, BZ, 0);
    new Door(g, b, { id: 'booth', x: BX + 0.75, z: BZ + 1.2, axis: 'x', width: 0.95, height: 2.1, style: 'office', color: '#2f6f6a' });
    b.prop(F.desk(m, 1.6, 0.6), BX - 0.4, 0.06, BZ - 0.85, 0);
    b.prop(F.officeChair(m, '#4a3a2a'), BX - 0.4, 0.06, BZ - 0.1, Math.PI + 0.4);
    const cam = screenCanvas(['КАМ-07  ЗАЛ ПРИВЕТСТВИЯ', '', '', '', '   [ сигнал слабый ]', '', '', '02.10.2026  18:42'], { color: '#c8d8c8' });
    b.prop(F.crtTV(m, true, cam), BX - 0.9, 0.82, BZ - 0.9, 0.2, { collide: false });
    documentProp(g, b, 'nadia_logbook', BX - 0.15, 0.82, BZ - 0.8, 0.2);
    tapePlayer(g, b, 'intercom_1', BX + 0.3, 0.82, BZ - 0.9, -0.3);
    b.prop(F.mug(m, '#c0392b'), BX - 0.55, 0.82, BZ - 0.7, 0, { collide: false });
    b.prop(FX.radiator(m, 0.6), BX + 1.2 - 0.05, 0.06, BZ - 0.3, -Math.PI / 2, { collide: false });
    inspect(g, b, FX.framedPicture(m, photoCat(), 0.22, '#3a2a1a'), BX - 1.24, 1.6, BZ - 0.4, 'Рыжий кот на подоконнике. Подпись: «Бублик. Ждёт дома». Она собиралась вернуться.', { prompt: 'Посмотреть фото', secret: 'sec_cat', ry: Math.PI / 2 });
    lamp(g, b, 'bare', BX, 2.55, BZ, { intensity: 2.2, distance: 5, flicker: 'buzz', drop: 0.4 });
    // note taped to the window outside
    documentProp(g, b, 'booth_note', BX - 0.6, 1.5, BZ + 1.27, 0, 'none', FX.paperOnWall(m, noteCanvas(), 0.25, true));
    // the mat with the key
    const mat = O.doorMat(m);
    b.prop(mat, BX + 0.75, 0, BZ + 1.75, 0.1, { collide: false, static: false });
    let lifted = g.state.has('main_key');
    g.interact.add({
      id: 'doormat',
      object: mat,
      kind: 'use',
      prompt: () => (lifted ? null : 'Приподнять коврик'),
      onUse: () => {
        lifted = true;
        mat.rotation.z = 0.25;
        mat.position.y = 0.05;
        g.giveItem('main_key');
        g.objective('Открыть главный вход ключом из-под коврика');
      },
    });

    // ---------------------------------------------------------------- dressing
    b.prop(O.ticketArch(m, 7), 0, 0, -16, 0);
    b.prop(O.billboard(m, poster('friend', 1024, 512, 0.95, 9), 7, 3.5), 21, 0, -6, -Math.PI / 2 + 0.3);
    for (const [x, z, s] of [
      [-22, -20, 1],
      [-25, -2, 2],
      [23, -24, 3],
      [26, 4, 4],
      [-14, 18, 5],
      [16, 19, 6],
      [-28, 12, 7],
    ])
      b.prop(O.bareTree(m, s, 6 + (s % 3)), x, 0, z, s);
    for (const [x, z] of [
      [-10, -27],
      [10, -27],
    ])
      b.prop(F.trashBin(m), x, 0, z, 0.3);
    b.prop(O.barrier(m, 2), -12, 0, -12, 0);
    b.prop(O.barrier(m, 2), 12, 0, -20, 0.1);
    b.prop(F.cardboardBox(m, 0.6, 0.4, 0.5, true), 6, 0, -27.5, 0.6);
    // the player's car outside the gate, headlights on
    const carModel = O.car(m, '#4f6170');
    b.prop(carModel, 2.5, 0, 15, Math.PI / 2, { static: false });
    b.spot(2.5, 0.75, 12.9, 2.5, 0.2, 2, { color: 0xfff3d0, intensity: 600, distance: 34, angle: 0.42, penumbra: 0.4, priority: 3 });
    b.spot(2.5, 0.75, 12.9, 0.5, 0.2, 2, { color: 0xfff3d0, intensity: 250, distance: 28, angle: 0.5, penumbra: 0.6, priority: 2 });
    inspect(g, b, null, 2.5, 1, 15, 'Не сейчас. Не для того столько ехать.', { prompt: 'Машина', size: 1.6 });
    b.sound('motor_loop', 2.5, 0.5, 16.5, 0.06, { rate: 0.5 });
    // street lamps
    const lampSpots: Array<[number, number, number, 'none' | 'dying' | 'off']> = [
      [-5, 2, Math.PI, 'none'],
      [5, -10, 0, 'dying'],
      [-5, -22, Math.PI, 'off'],
      [8, 12, 0, 'none'],
    ];
    for (const [x, z, ry, mode] of lampSpots) {
      const sl = O.streetLamp(m, 6);
      b.prop(sl.group, x, 0, z, ry, { static: false });
      const lx = x + Math.cos(-ry) * 1.25;
      const lz = z + Math.sin(-ry) * 1.25;
      if (mode === 'off') {
        sl.bulb.emissiveIntensity = 0.02;
        continue;
      }
      b.light(lx, 5.9, lz, { color: 0xff9a3c, intensity: 260, distance: 24, emissives: [sl.bulb], emissiveBase: 3, flicker: mode === 'dying' ? 'dying' : 'none', priority: 2 });
      b.sound('buzz_loop', lx, 5.8, lz, 0.08);
    }
    // invisible boundaries
    b.collider(-30, 0, 22, 30, 4, 23, { opaque: false });
    b.collider(-31, 0, -31, -30, 4, 23, { opaque: false });
    b.collider(30, 0, -31, 31, 4, 23, { opaque: false });

    // ---------------------------------------------------------------- weather
    const moon = new THREE.DirectionalLight(0x8fa6c8, 0.3);
    moon.position.set(-20, 40, 10);
    b.addDynamic(moon);
    const sky = skyDome(g, b);
    rain(g, b, 2600, (p) => !inRect(p, BX - 1.3, BZ - 1.2, BX + 1.3, BZ + 1.2) && !inRect(p, -4.5, -30, 4.5, -25.5) && p.z > -30);
    const bolt = lightning(g, b, sky, moon);

    // the neon sign comes alive for a moment when you pass under the arch
    b.trigger('neon', -4, 0, -17, 4, 4, -15, {
      onEnter: () => {
        g.co.start(
          (function* (): CoGen {
            g.audio.play('breaker_trip', { pos: new THREE.Vector3(0, 12.9, FZ + 0.5), volume: 0.7, ref: 8 });
            for (let i = 0; i < 9; i++) {
              neon.mat.emissiveIntensity = i % 2 ? 0 : 2.2;
              yield 0.05 + Math.random() * 0.12;
            }
            neon.mat.emissiveIntensity = 2.2;
            yield 1.4;
            neon.mat.emissiveIntensity = 0;
            bolt.strike();
            g.ui.hud.subtitle('Часы над входом стоят. Семь часов ровно.', 4);
          })(),
          'zone',
        );
      },
    });

    b.spawn('start', 4.1, 0, 14.2, 0.15);
  },
  onEnter(g, _spawn, restored) {
    if (restored) return;
    if (!g.state.is('outside.intro')) {
      g.state.set('outside.intro');
      g.giveItem('friend_card', true);
      g.state.readDoc('letter');
      g.co.start(
        (function* (): CoGen {
          g.player.movementLocked = true;
          yield 1.5;
          g.ui.hud.chapterCard('Пролог', 'Письмо', 6);
          yield 3;
          g.ui.hud.subtitle('Обратного адреса не было. Только «Другу №12» и звёздочка вместо марки.', 5);
          yield 2;
          g.player.movementLocked = false;
          g.objective('Найти вход в комплекс');
          yield 4;
          g.ui.hud.notify('J — журнал: письмо там. F — фонарик.', 'info');
        })(),
        'zone',
      );
    }
  },
};

function noteCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 340;
  const x = c.getContext('2d')!;
  x.fillStyle = '#f4efe1';
  x.fillRect(0, 0, 256, 340);
  x.fillStyle = '#1e2b55';
  x.font = "700 30px 'Caveat', cursive";
  const lines = ['Если ты это', 'читаешь —', 'ты приехал.', '', 'Ключ — под', 'ковриком.', '', '— Н.'];
  lines.forEach((l, i) => x.fillText(l, 18, 40 + i * 36));
  return c;
}

function photoCat(): HTMLCanvasElement {
  const c = photo('empty', 11);
  const x = c.getContext('2d')!;
  x.fillStyle = '#d9822b';
  x.beginPath();
  x.ellipse(160, 150, 70, 42, 0, 0, Math.PI * 2);
  x.fill();
  x.beginPath();
  x.arc(105, 112, 32, 0, Math.PI * 2);
  x.fill();
  x.beginPath();
  x.moveTo(82, 92);
  x.lineTo(90, 64);
  x.lineTo(104, 86);
  x.moveTo(110, 84);
  x.lineTo(124, 64);
  x.lineTo(130, 92);
  x.fill();
  x.fillStyle = '#222';
  x.font = "16px 'Caveat', cursive";
  x.fillText('Бублик. Ждёт дома', 12, 228);
  return c;
}
