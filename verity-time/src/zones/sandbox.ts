import * as THREE from 'three';
import type { ZoneDef } from './types';
import { Door, lamp, documentProp, tapePlayer, hideLocker, throwable, pickup } from '../world/entities';
import * as F from '../models/furniture';
import * as FX from '../models/fixtures';
import { poster } from '../assets/Signage';
import { plushVerity } from '../models/items';

/** Developer test zone. */
export const sandbox: ZoneDef = {
  id: 'sandbox',
  name: 'Песочница',
  materials: ['floor_terrazzo', 'wall_wallpaper', 'ceiling_tiles', 'wood_dark', 'concrete', 'wall_plaster', 'floor_checker'],
  nav: { minX: -2, minZ: -22, maxX: 22, maxZ: 2 },
  build(g, b) {
    const m = g.mats;
    b.room('hall', { x: 0, z: -12, w: 12, d: 12, h: 4, floor: 'floor_terrazzo', wall: 'wall_wallpaper', ceil: 'ceiling_tiles', baseboard: 'wood_dark' });
    b.room('side', { x: 12, z: -12, w: 8, d: 12, h: 3.2, floor: 'floor_checker', wall: 'wall_plaster', ceil: 'ceiling_tiles', baseboard: 'wood_dark' });
    b.room('back', { x: 0, z: -20, w: 12, d: 8, h: 3.2, floor: 'concrete', wall: 'wall_plaster', ceil: 'ceiling_tiles' });
    b.connect('hall', 'side', -6, 1.1, 2.2);
    b.connect('hall', 'back', 6, 1.1, 2.2);
    new Door(g, b, { id: 'sb1', x: 12, z: -6, axis: 'z', style: 'wood' });
    new Door(g, b, { id: 'sb2', x: 6, z: -12, axis: 'x', style: 'metal' });
    for (const [x, z] of [[3, -3], [9, -3], [3, -9], [9, -9]]) lamp(g, b, 'troffer', x, 4, z, { flicker: x === 9 && z === -9 ? 'dying' : 'none' });
    lamp(g, b, 'pendant', 16, 3.2, -6, {});
    lamp(g, b, 'emergency', 6, 2.6, -19.9 + 0.1, { ry: 0 });
    b.prop(F.desk(m), 15, 0, -9, 0);
    b.prop(F.officeChair(m), 15, 0, -8.2, Math.PI);
    b.prop(F.crtTV(m, true), 2, 0.75, -11, 0, { collide: false });
    b.prop(F.table(m), 2, 0, -11, 0);
    b.prop(F.vendingMachine(m), 17, 0, -11.4, 0);
    b.prop(F.shelf(m), 4, 0, -19.5, 0);
    b.prop(FX.wallClock(m), 6, 2.8, -11.9 + 0.0, 0, { collide: false });
    const p = FX.paperOnWall(m, poster('friend'), 0.7);
    b.prop(p, 3, 1.6, -11.9 + 0.0, 0, { collide: false, static: false });
    documentProp(g, b, 'circuit_table', 15, 0.76, -9, 0.3);
    tapePlayer(g, b, 'theo_rehearsal', 14.4, 0.76, -9.1, -0.2);
    hideLocker(g, b, 'l1', 19.5, 0, -2, -Math.PI / 2);
    throwable(g, b, plushVerity(m, 1), 'игрушка', 5, 0.0, -5);
    pickup(g, b, 'fuse', 2.2, 0.76, -10.7);
    b.spawn('start', 6, 0, -2, 0);
    b.zone.env.fogDensity = 0.03;
    b.zone.env.ambience = ['room_loop', 'hum_loop'];
    b.sound('buzz_loop', 9, 3.8, -9, 0.3);
  },
  onEnter(g) {
    g.verity.spawn(new THREE.Vector3(6, 0, -16), 0, 'scripted');
    g.verity.lookAtPlayer = true;
  },
};
