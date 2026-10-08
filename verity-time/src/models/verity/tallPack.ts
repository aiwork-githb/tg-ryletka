import * as THREE from 'three';
import type { V3 } from '../sdf/Sdf';
import type { TallGeometry } from './TallSculpt';

/** Transferable form of the tall geometry (worker -> main thread). */
export interface PackedGeo {
  attrs: Record<string, { array: ArrayLike<number> & ArrayBufferView; itemSize: number }>;
  index: (ArrayLike<number> & ArrayBufferView) | null;
}

export interface PackedTall {
  skin: PackedGeo;
  teeth: PackedGeo;
  eyes: Array<{ pos: V3; r: number }>;
}

export interface TallMeshes {
  skin: THREE.BufferGeometry;
  teeth: THREE.BufferGeometry;
  eyes: Array<{ pos: V3; r: number }>;
}

function pack(g: THREE.BufferGeometry, transfer: ArrayBuffer[]): PackedGeo {
  const attrs: PackedGeo['attrs'] = {};
  for (const [name, a] of Object.entries(g.attributes)) {
    const arr = (a as THREE.BufferAttribute).array as unknown as ArrayLike<number> & ArrayBufferView;
    attrs[name] = { array: arr, itemSize: a.itemSize };
    transfer.push(arr.buffer as ArrayBuffer);
  }
  const idx = g.getIndex();
  if (idx) transfer.push((idx.array as unknown as ArrayBufferView).buffer as ArrayBuffer);
  return { attrs, index: idx ? (idx.array as unknown as ArrayLike<number> & ArrayBufferView) : null };
}

function unpack(p: PackedGeo): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  for (const [name, a] of Object.entries(p.attrs)) {
    const arr = a.array as unknown as THREE.TypedArray;
    g.setAttribute(name, new THREE.BufferAttribute(arr, a.itemSize));
  }
  if (p.index) g.setIndex(new THREE.BufferAttribute(p.index as unknown as THREE.TypedArray, 1));
  g.computeBoundingSphere();
  return g;
}

export function packTall(t: TallGeometry): { data: PackedTall; transfer: ArrayBuffer[] } {
  const transfer: ArrayBuffer[] = [];
  // clone so the worker's cache stays usable after the buffers are transferred
  const data: PackedTall = { skin: pack(t.skin.clone(), transfer), teeth: pack(t.teeth.clone(), transfer), eyes: t.eyes };
  return { data, transfer };
}

export function unpackTall(p: PackedTall): TallMeshes {
  return { skin: unpack(p.skin), teeth: unpack(p.teeth), eyes: p.eyes };
}
