import * as THREE from 'three';
import { Materials } from '../assets/Materials';
import { VerityRig } from '../models/VerityModel';
import { tallGeometry } from '../models/verity/TallSculpt';
import { TallForm, loadTallMeshes } from '../models/verity/TallForm';
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
    tallraw: () => {
      const t0 = performance.now();
      const tg = tallGeometry();
      console.log('tall built in', Math.round(performance.now() - t0), 'ms, verts', tg.skin.getAttribute('position').count, 'tris', tg.skin.getIndex()!.count / 3);
      const g = new THREE.Group();
      g.add(new THREE.Mesh(tg.skin, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 })));
      g.add(new THREE.Mesh(tg.teeth, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.25 })));
      for (const e of tg.eyes) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(e.r, 16, 12), new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.1 }));
        s.position.set(...e.pos);
        g.add(s);
      }
      return g;
    },
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

export async function modelView(spec: string): Promise<void> {
  const [name, stageS, angleS, focusS, distS] = spec.split(',');
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  r.setSize(innerWidth, innerHeight);
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.shadowMap.enabled = true;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x3a3d42);
  const m = new Materials();
  const f = name === 'tall' ? () => new THREE.Group() : factories()[name];
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
  if (name === 'tall') {
    // ?modelview=tall,<speed>,<angle>[,focusY,dist][&t=seconds&gesture=wave&headroom=2.3&look=x:y:z]
    group.clear();
    const qs = new URLSearchParams(location.search);
    const meshes = await loadTallMeshes();
    const tf = new TallForm();
    tf.attach(meshes);
    tf.group.rotation.y = Number(angleS ?? 0);
    group.add(tf.group);
    const look = qs.get('look')?.split(':').map(Number);
    const sim = Number(qs.get('t') ?? 2);
    for (let i = 0; i < sim * 60; i++)
      tf.update(1 / 60, {
        speed: Number(stageS ?? 0),
        look: look ? new THREE.Vector3(look[0], look[1], look[2]) : new THREE.Vector3(0, 1.7, 3),
        point: new THREE.Vector3(-1, 1.2, 2),
        tilt: Number(qs.get('tilt') ?? 0),
        twist: 0,
        wrongness: 0,
        talking: qs.has('talk'),
        gesture: (qs.get('gesture') ?? 'none') as any,
        gestureT: i / 60,
        headroom: Number(qs.get('headroom') ?? 3),
        expression: 'grin',
      });
    size = 2.4;
  }
  if (name === 'verity') {
    group.clear();
    angles.forEach((a, i) => {
      const rig = new VerityRig(m);
      rig.setStage(Number(stageS ?? 0));
      rig.root.rotation.y = a;
      rig.root.position.x = (i - (angles.length - 1) / 2) * 1.3;
      rig.lookTarget = new THREE.Vector3(0, 1.0, 4);
      const qs = new URLSearchParams(location.search);
      if (qs.get('expr')) rig.setExpression(qs.get('expr') as any);
      if (qs.has('talk')) rig.talking = 10;
      for (let k = 0; k < 90; k++) rig.update(1 / 60, { speed: Number(qs.get('speed') ?? 0), time: k / 60 });
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
  if (focusS) {
    // close-up: focus height and distance
    const fy = Number(focusS);
    const fd = Number(distS ?? 1);
    cam.position.set(0, fy + fd * 0.08, fd);
    cam.lookAt(0, fy, 0);
  }
  r.render(scene, cam);
  (window as any).__VT_READY = true;
  void views;
  void size;
}
