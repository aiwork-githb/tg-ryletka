import type * as THREE from 'three';
import type { Materials } from '../assets/Materials';

/** Industrial props (factory, lower levels). Filled in with the Toy Works zone. */
export const VIEW: Record<string, (m: Materials) => THREE.Object3D> = {};
