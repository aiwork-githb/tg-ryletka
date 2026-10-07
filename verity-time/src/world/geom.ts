import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Re-projects UVs from object-space positions using the dominant normal axis
 * so a material's texel density stays constant (metres / tile) on any shape.
 */
export function projectUV(g: THREE.BufferGeometry, tile = 1, ox = 0, oy = 0, oz = 0): THREE.BufferGeometry {
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  let nrm = g.getAttribute('normal') as THREE.BufferAttribute | undefined;
  if (!nrm) {
    g.computeVertexNormals();
    nrm = g.getAttribute('normal') as THREE.BufferAttribute;
  }
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + ox;
    const y = pos.getY(i) + oy;
    const z = pos.getZ(i) + oz;
    const nx = Math.abs(nrm.getX(i));
    const ny = Math.abs(nrm.getY(i));
    const nz = Math.abs(nrm.getZ(i));
    let u: number, v: number;
    if (ny >= nx && ny >= nz) {
      u = x;
      v = z;
    } else if (nx >= nz) {
      u = z * Math.sign(nrm.getX(i) || 1);
      v = y;
    } else {
      u = -x * Math.sign(nrm.getZ(i) || 1);
      v = y;
    }
    uv[i * 2] = u / tile;
    uv[i * 2 + 1] = v / tile;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

/** Adds a constant (or function-driven) vertex colour attribute. */
export function vcolor(g: THREE.BufferGeometry, f: number | ((x: number, y: number, z: number) => number) = 1): THREE.BufferGeometry {
  const pos = g.getAttribute('position');
  const c = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const v = typeof f === 'number' ? f : f(pos.getX(i), pos.getY(i), pos.getZ(i));
    c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = v;
  }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}

export function box(w: number, h: number, d: number, tile = 0.5): THREE.BufferGeometry {
  return projectUV(new THREE.BoxGeometry(w, h, d), tile);
}

export function rbox(w: number, h: number, d: number, r = 0.02, seg = 2, tile = 0.5): THREE.BufferGeometry {
  const rr = Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3);
  return projectUV(new RoundedBoxGeometry(w, h, d, seg, Math.max(0.001, rr)), tile);
}

export function cyl(rt: number, rb: number, h: number, seg = 16, tile = 0.5, open = false): THREE.BufferGeometry {
  return projectUV(new THREE.CylinderGeometry(rt, rb, h, seg, 1, open), tile);
}

export function sphere(r: number, ws = 24, hs = 16, tile = 0.5): THREE.BufferGeometry {
  return projectUV(new THREE.SphereGeometry(r, ws, hs), tile);
}

export function torus(r: number, tube: number, rs = 12, ts = 32, arc = Math.PI * 2): THREE.BufferGeometry {
  return new THREE.TorusGeometry(r, tube, rs, ts, arc);
}

export function tube(points: THREE.Vector3[], r: number, seg = 32, rs = 8, tile = 0.5): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  return projectUV(new THREE.TubeGeometry(curve, seg, r, rs, false), tile);
}

export function lathe(profile: Array<[number, number]>, seg = 24): THREE.BufferGeometry {
  return new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(r, y)),
    seg,
  );
}

/** Extrudes a 2D shape (XY plane) along Z with an optional bevel. */
export function extrude(shape: THREE.Shape, depth: number, bevel = 0.005, tile = 0.5): THREE.BufferGeometry {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelSize: bevel,
    bevelThickness: bevel,
    bevelSegments: 2,
    curveSegments: 12,
  });
  g.translate(0, 0, -depth / 2);
  return projectUV(g, tile);
}

export function roundedRectShape(w: number, h: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/**
 * Convenience to build multi-material models:
 *   const m = new ModelBuilder(); m.add(geo, mat, x,y,z, rx,ry,rz); m.group
 */
export class ModelBuilder {
  readonly group = new THREE.Group();
  add(
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    x = 0,
    y = 0,
    z = 0,
    rx = 0,
    ry = 0,
    rz = 0,
    sx = 1,
    sy = 1,
    sz = 1,
  ): THREE.Mesh {
    // registry materials carry their own texel density: re-project to match
    const t = (mat as THREE.Material).userData?.tile as number | undefined;
    if (t && t !== 0.5 && geo.getAttribute('uv') && !geo.userData.uvFixed) {
      projectUV(geo, t);
      geo.userData.uvFixed = true;
    }
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    m.scale.set(sx, sy, sz);
    m.castShadow = true;
    m.receiveShadow = true;
    this.group.add(m);
    return m;
  }
  /** Adds a child group at a transform (sub-assemblies). */
  sub(child: THREE.Object3D, x = 0, y = 0, z = 0, ry = 0): THREE.Object3D {
    child.position.set(x, y, z);
    child.rotation.y = ry;
    this.group.add(child);
    return child;
  }
}

/**
 * Bakes a hierarchy into world-space geometries grouped by material.
 * Used for static batching.
 */
export function bakeByMaterial(root: THREE.Object3D, into: Map<THREE.Material, THREE.BufferGeometry[]>): void {
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.visible || mesh.userData.noBatch) return;
    const mat = mesh.material as THREE.Material;
    if (Array.isArray(mesh.material)) return;
    let g = mesh.geometry.clone();
    g.applyMatrix4(mesh.matrixWorld);
    g = normalizeAttributes(g, (mat as THREE.MeshStandardMaterial).vertexColors === true);
    let list = into.get(mat);
    if (!list) into.set(mat, (list = []));
    list.push(g);
  });
}

/** Reduces a geometry to position/normal/uv(/color), non-indexed, for merging. */
export function normalizeAttributes(g: THREE.BufferGeometry, needColor: boolean): THREE.BufferGeometry {
  let out = g.index ? g.toNonIndexed() : g;
  if (!out.getAttribute('normal')) out.computeVertexNormals();
  if (!out.getAttribute('uv')) {
    out.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(out.getAttribute('position').count * 2), 2));
  }
  for (const name of Object.keys(out.attributes)) {
    if (name === 'position' || name === 'normal' || name === 'uv') continue;
    if (name === 'color' && needColor) continue;
    out.deleteAttribute(name);
  }
  if (needColor && !out.getAttribute('color')) vcolor(out, 1);
  // colour attributes must be 3-component float everywhere
  const c = out.getAttribute('color');
  if (c && c.itemSize !== 3) {
    const n = c.count;
    const a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      a[i * 3] = c.getX(i);
      a[i * 3 + 1] = c.getY(i);
      a[i * 3 + 2] = c.getZ(i);
    }
    out.setAttribute('color', new THREE.BufferAttribute(a, 3));
  }
  out.morphAttributes = {};
  out.clearGroups();
  if (out !== g) g.dispose();
  return out;
}

export function merge(list: THREE.BufferGeometry[]): THREE.BufferGeometry | null {
  if (!list.length) return null;
  if (list.length === 1) return list[0];
  const m = mergeGeometries(list, false);
  for (const g of list) g.dispose();
  return m;
}
