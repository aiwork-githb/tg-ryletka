import * as THREE from 'three';
import type { ZoneDef } from './types';
import { lamp } from '../world/entities';
import * as L from '../models/lobby';
import { VerityRig } from '../models/VerityModel';
import { dust, lightCone } from '../world/vfx';
import { canvas } from '../assets/Signage';

/** Background diorama for the main menu: an empty theatre, one spotlight. */
export const menu: ZoneDef = {
  id: 'menu',
  name: 'menu',
  materials: ['floor_carpet_theater', 'wall_plaster_dark', 'wood_floor', 'fabric_red', 'wood_dark'],
  build(g, b) {
    const m = g.mats;
    b.zone.env.fogColor.set(0x050405);
    b.zone.env.fogDensity = 0.05;
    b.zone.env.hemiIntensity = 0.05;
    b.zone.env.ambientIntensity = 0.03;
    b.zone.env.ambience = ['room_loop'];
    b.zone.env.envMap = 'dark';
    b.zone.env.envIntensity = 0.15;
    b.room('t', { x: -8, z: -16, w: 16, d: 18, h: 7, floor: 'floor_carpet_theater', wall: 'wall_plaster_dark', ceil: 'wall_plaster_dark', wainscot: { mat: 'fabric_red', height: 2.2, rail: 'wood_dark' } });
    b.solid('wood_floor', 0, 0, -13.5, 16, 1.0, 5);
    b.solid('wall_plaster_dark', -6.5, 1, -11.2, 3, 6, 0.4);
    b.solid('wall_plaster_dark', 6.5, 1, -11.2, 3, 6, 0.4);
    const cl = L.curtain(m, 5.2, 4.8);
    cl.position.set(-5.2, 1, -11.5);
    cl.scale.x = 0.55;
    b.addDynamic(cl);
    const cr = L.curtain(m, 5.2, 4.8);
    cr.position.set(5.2, 1, -11.5);
    cr.scale.x = -0.55;
    b.addDynamic(cr);
    const [bd, g2] = canvas(512, 256);
    g2.fillStyle = '#1b2840';
    g2.fillRect(0, 0, 512, 256);
    for (let i = 0; i < 40; i++) {
      g2.fillStyle = `rgba(255,240,200,${Math.random() * 0.7})`;
      g2.fillRect(Math.random() * 512, Math.random() * 200, 2, 2);
    }
    const back = new THREE.Mesh(new THREE.PlaneGeometry(10, 5), m.canvasMaterial(bd, { rough: 0.9 }));
    back.position.set(0, 3.5, -15.8);
    b.addDynamic(back);
    for (let r = 0; r < 4; r++)
      for (let k = -6; k <= 6; k++) {
        if (k === 0) continue;
        b.prop(L.theaterSeat(m, (k + r) % 5 === 0), k * 0.62, 0, -3 + r * 1.05, Math.PI);
      }
    const rig = new VerityRig(m);
    rig.setStage(1);
    rig.scaleMul = 1.6;
    rig.root.position.set(0, 1, -13.2);
    b.addDynamic(rig.root);
    const spot = b.spot(0, 6.6, -7, 0, 1.6, -13.2, { color: 0xfff0d0, intensity: 480, distance: 16, angle: 0.24, penumbra: 0.5, priority: 5 });
    // a faint warm fill from the footlights so the face reads
    b.light(0, 1.6, -11.2, { color: '#ffcf9a', intensity: 1.5, distance: 4, priority: 4 });
    lightCone(g, b, new THREE.Vector3(0, 6.6, -7), new THREE.Vector3(0, 1, -13.2), 1.4, 0xfff0d0, 0.09, spot);
    lamp(g, b, 'exit', -7.9, 2.6, -1, { ry: Math.PI / 2 });
    dust(g, b, new THREE.Vector3(-3, 1, -14), new THREE.Vector3(3, 6.5, -6), 260, 0xfff2dc, 0.03);
    let t = 0;
    let blink = 0;
    b.update((dt) => {
      t += dt;
      const cam = g.renderer.camera;
      cam.position.set(-1.8 + Math.sin(t * 0.05) * 0.8, 1.55 + Math.sin(t * 0.13) * 0.05, -1.5 - Math.sin(t * 0.03) * 0.8);
      cam.lookAt(-1.2, 1.85, -13.2);
      if (cam.fov !== 34) {
        cam.fov = 34;
        cam.updateProjectionMatrix();
      }
      rig.lookTarget = cam.position.clone();
      blink += dt;
      rig.tilt = Math.sin(t * 0.21) * 0.12 + (Math.sin(t * 0.05) > 0.97 ? 0.5 : 0);
      rig.update(dt, { speed: 0, time: t });
      rig.scaleMul = 1.6;
    });
    b.spawn('start', 0, 0, 1.6, 0);
  },
};
