import * as THREE from 'three';
import { Materials } from '../assets/Materials';
import { VerityRig } from '../models/VerityModel';
import * as F from '../models/furniture';
import * as FX from '../models/fixtures';
import * as I from '../models/items';
import * as IND from '../models/industry';
import * as KID from '../models/kids';

type Factory = (m: Materials) => THREE.Object3D;

/** Named model factories available to ?modelview=name[,stage] */
function factories(): Record<string, Factory> {
  return {
    verity: (m) => new VerityRig(m).root,
    desk: (m) => F.desk(m),
    chair: (m) => F.officeChair(m),
    locker: (m) => F.locker(m),
    vending: (m) => F.vendingMachine(m),
    arcade: (m) => F.arcadeCabinet(m),
    booth: (m) => F.ticketBooth(m),
    turnstile: (m) => F.turnstile(m),
    terminal: (m) => F.terminal(m, ['HELLO']),
    tv: (m) => F.crtTV(m, true),
    shelf: (m) => F.shelf(m),
    troffer: (m) => FX.troffer(m).group,
    pendant: (m) => FX.pendant(m).group,
    cage: (m) => FX.cageLamp(m).group,
    plush: (m) => I.plushVerity(m, 2),
    bracelet: (m) => I.bracelet(m),
    ...IND.VIEW,
    ...KID.VIEW,
  };
}

export function modelView(spec: string): void {
  const [name, stageS, angleS] = spec.split(',');
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  r.setSize(innerWidth, innerHeight);
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.shadowMap.enabled = true;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x3a3d42);
  const m = new Materials();
  const f = factories()[name];
  if (!f) throw new Error('unknown model ' + name + ' — known: ' + Object.keys(factories()).join(', '));
  const views: THREE.Object3D[] = [];
  const angles = angleS ? [Number(angleS)] : [0, Math.PI / 2, Math.PI, -Math.PI / 4];
  const group = new THREE.Group();
  scene.add(group);
  let size = 1;
  angles.forEach((a, i) => {
    const o = f(m);
    if (name === 'verity' && stageS) {
      // find the rig through a back-reference
    }
    o.rotation.y += a;
    const bb = new THREE.Box3().setFromObject(o);
    size = Math.max(size * 0, bb.getSize(new THREE.Vector3()).length());
    o.position.x = (i - (angles.length - 1) / 2) * size * 0.9;
    group.add(o);
    views.push(o);
  });
  if (name === 'verity') {
    group.clear();
    angles.forEach((a, i) => {
      const rig = new VerityRig(m);
      rig.setStage(Number(stageS ?? 0));
      rig.root.rotation.y = a;
      rig.root.position.x = (i - (angles.length - 1) / 2) * 1.3;
      rig.lookTarget = new THREE.Vector3(0, 1.0, 4);
      rig.update(0.016, { speed: 0, time: 0 });
      group.add(rig.root);
    });
    size = 1.6;
  }
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: 0x55585c, roughness: 0.9 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const key = new THREE.DirectionalLight(0xfff2e0, 2.2);
  key.position.set(3, 5, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = key.shadow.camera.bottom = -6;
  key.shadow.camera.right = key.shadow.camera.top = 6;
  const fill = new THREE.DirectionalLight(0x9fc8ff, 0.7);
  fill.position.set(-4, 2, 2);
  scene.add(key, fill, new THREE.HemisphereLight(0xdfe8ff, 0x302820, 0.6));
  group.traverse((o) => {
    const mm = o as THREE.Mesh;
    if (mm.isMesh) mm.castShadow = mm.receiveShadow = true;
  });
  const bb = new THREE.Box3().setFromObject(group);
  const c = bb.getCenter(new THREE.Vector3());
  const s = bb.getSize(new THREE.Vector3());
  const cam = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.01, 100);
  const dist = Math.max(s.x / (2 * Math.tan((35 * Math.PI) / 360) * cam.aspect), s.y / (2 * Math.tan((35 * Math.PI) / 360))) * 1.15;
  cam.position.set(c.x, c.y + s.y * 0.15, c.z + dist + s.z / 2);
  cam.lookAt(c);
  r.render(scene, cam);
  (window as any).__VT_READY = true;
  void views;
  void size;
}
