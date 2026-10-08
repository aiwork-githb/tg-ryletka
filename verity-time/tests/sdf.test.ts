import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { SdfModel } from '../src/models/sdf/Sdf';

describe('SDF modeller', () => {
  it('meshes a sphere on its surface with outward normals and winding', () => {
    const m = new SdfModel().color('#ff0000').sphere([0, 0, 0], 0.5);
    const { geometry } = m.mesh({ cell: 0.05 });
    const pos = geometry.getAttribute('position');
    const nrm = geometry.getAttribute('normal');
    expect(pos.count).toBeGreaterThan(300);
    let maxErr = 0;
    for (let i = 0; i < pos.count; i++) {
      const p = new THREE.Vector3().fromBufferAttribute(pos, i);
      maxErr = Math.max(maxErr, Math.abs(p.length() - 0.5));
      expect(new THREE.Vector3().fromBufferAttribute(nrm, i).dot(p.normalize())).toBeGreaterThan(0.95);
    }
    expect(maxErr).toBeLessThan(0.005);
    // triangles face outwards
    const idx = geometry.getIndex()!;
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    a.fromBufferAttribute(pos, idx.getX(0));
    b.fromBufferAttribute(pos, idx.getX(1));
    c.fromBufferAttribute(pos, idx.getX(2));
    const n = b.clone().sub(a).cross(c.clone().sub(a));
    expect(n.dot(a)).toBeGreaterThan(0);
  });

  it('carves with smooth subtraction and colours the cavity', () => {
    const m = new SdfModel().color('#ffff00').sphere([0, 0, 0], 0.5).sphere([0, 0, 0.5], 0.2, { op: 'sub', k: 0.02, color: '#000000' });
    const s = { d: 0, r: 0, g: 0, b: 0, bone: 0 };
    expect(m.distance(0, 0, 0.45)).toBeGreaterThan(0);
    m.sample(0, 0, 0.3, s);
    expect(s.r).toBeLessThan(0.2);
    m.sample(0, 0.49, 0, s);
    expect(s.r).toBeGreaterThan(0.8);
  });

  it('labels vertices with the bone of the nearest part', () => {
    const m = new SdfModel().cone([0, 0, 0], [0, 1, 0], 0.1, 0.1, { bone: 1 }).cone([0, 1, 0], [1, 1, 0], 0.1, 0.1, { bone: 2, k: 0.05 });
    const { geometry, bones } = m.mesh({ cell: 0.04 });
    const pos = geometry.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      if (pos.getY(i) < 0.6) expect(bones[i]).toBe(1);
      if (pos.getX(i) > 0.4) expect(bones[i]).toBe(2);
    }
  });
});
