import * as THREE from 'three';

export interface EnvSpec {
  /** Colour at the top / horizon / bottom of the surrounding space. */
  top: string;
  mid: string;
  bottom: string;
  /** Bright panels (lamps, windows) as [dirX, dirY, dirZ, size, color, intensity]. */
  lights: Array<[number, number, number, number, string, number]>;
}

export const ENV_PRESETS: Record<string, EnvSpec> = {
  night: {
    top: '#1a1d24',
    mid: '#221c16',
    bottom: '#0c0b0a',
    lights: [
      [0.6, 0.15, -0.8, 0.12, '#ff9a3c', 6],
      [-0.7, 0.2, 0.3, 0.1, '#ff9a3c', 5],
      [0.1, 0.05, 1, 0.08, '#fff2d0', 8],
      [0, 0.6, -0.4, 0.4, '#2a2c34', 1],
    ],
  },
  hall: {
    top: '#1c1a17',
    mid: '#2a2520',
    bottom: '#120f0c',
    lights: [
      [0, 1, 0, 0.18, '#fff1dc', 5],
      [0.7, 0.7, 0.1, 0.12, '#fff1dc', 3],
      [-0.6, 0.7, -0.3, 0.12, '#ffd9a0', 3],
      [0.2, 0.1, -1, 0.2, '#ff3020', 0.8],
    ],
  },
  industrial: {
    top: '#14171a',
    mid: '#22262a',
    bottom: '#0d0e0f',
    lights: [
      [0, 1, 0, 0.12, '#e6eeff', 5],
      [0.8, 0.6, 0, 0.1, '#ffcf8a', 4],
      [-0.8, 0.6, 0.2, 0.1, '#e6eeff', 3],
    ],
  },
  clinical: {
    top: '#20262a',
    mid: '#2b3134',
    bottom: '#121415',
    lights: [
      [0, 1, 0, 0.25, '#eef4ff', 4],
      [0.6, 0.8, 0.4, 0.15, '#eef4ff', 3],
    ],
  },
  kids: {
    top: '#241d22',
    mid: '#2d2420',
    bottom: '#151012',
    lights: [
      [0, 1, 0, 0.2, '#fff0d0', 4],
      [0.7, 0.4, 0.2, 0.15, '#ffb070', 2],
      [-0.6, 0.5, -0.5, 0.15, '#7fe0d4', 1.5],
    ],
  },
  dark: {
    top: '#0b0c0d',
    mid: '#141313',
    bottom: '#070707',
    lights: [
      [0, 1, 0, 0.1, '#ffcf8a', 3],
      [0.5, 0.3, -0.7, 0.1, '#ff3020', 1.5],
    ],
  },
  core: {
    top: '#140b08',
    mid: '#1e120c',
    bottom: '#080404',
    lights: [
      [0, -0.4, -1, 0.35, '#ffb04a', 3],
      [0, 1, 0, 0.1, '#ff3a20', 2],
    ],
  },
};

/** Builds a prefiltered environment map from a tiny procedural "room". */
export function buildEnvMap(renderer: THREE.WebGLRenderer, spec: EnvSpec): THREE.Texture {
  const scene = new THREE.Scene();
  const geo = new THREE.SphereGeometry(10, 32, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { uTop: { value: new THREE.Color(spec.top) }, uMid: { value: new THREE.Color(spec.mid) }, uBot: { value: new THREE.Color(spec.bottom) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 uTop, uMid, uBot; varying vec3 vP;
      void main(){ float h = vP.y; vec3 c = h > 0.0 ? mix(uMid, uTop, smoothstep(0.0, 0.7, h)) : mix(uMid, uBot, smoothstep(0.0, 0.5, -h)); gl_FragColor = vec4(c, 1.0); }`,
  });
  scene.add(new THREE.Mesh(geo, mat));
  for (const [x, y, z, size, color, intensity] of spec.lights) {
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity) });
    const q = new THREE.Mesh(new THREE.PlaneGeometry(size * 10, size * 6), m);
    const d = new THREE.Vector3(x, y, z).normalize().multiplyScalar(9);
    q.position.copy(d);
    q.lookAt(0, 0, 0);
    scene.add(q);
  }
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(scene, 0.02);
  pmrem.dispose();
  geo.dispose();
  mat.dispose();
  return rt.texture;
}
