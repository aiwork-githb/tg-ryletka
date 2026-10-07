import * as THREE from 'three';
import type { Game } from '../Game';
import type { LevelBuilder } from './LevelBuilder';

/** Night sky dome with slowly drifting clouds and lightning flashes. */
export function skyDome(g: Game, b: LevelBuilder): { flash: (k: number) => void } {
  const uniforms = {
    uTime: g.mats.shared.uTime,
    uNoise: { value: g.mats.macroNoise },
    uFlash: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uNoise; uniform float uTime; uniform float uFlash;
      varying vec3 vDir;
      void main(){
        float h = clamp(vDir.y, -0.2, 1.0);
        vec3 horizon = vec3(0.03, 0.03, 0.034);
        vec3 zenith = vec3(0.006, 0.008, 0.014);
        vec3 col = mix(horizon, zenith, smoothstep(0.0, 0.6, h));
        vec2 uv = vDir.xz / max(0.15, vDir.y + 0.25) * 0.18;
        float n = texture2D(uNoise, uv + vec2(uTime*0.004, uTime*0.002)).r;
        float n2 = texture2D(uNoise, uv*2.3 - vec2(uTime*0.006, 0.0)).g;
        float clouds = smoothstep(0.35, 0.85, n*0.7 + n2*0.4);
        col = mix(col, vec3(0.045, 0.043, 0.047), clouds * smoothstep(-0.05, 0.3, h));
        // city glow on the horizon
        col += vec3(0.05, 0.028, 0.012) * (1.0 - smoothstep(0.0, 0.25, h)) * 0.6;
        col += vec3(0.55, 0.6, 0.75) * uFlash * (0.4 + clouds) * smoothstep(-0.1, 0.4, h);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(110, 32, 16), mat);
  dome.renderOrder = -10;
  dome.frustumCulled = false;
  b.addDynamic(dome);
  b.update(() => dome.position.copy(g.renderer.camera.position));
  return {
    flash: (k: number) => (uniforms.uFlash.value = k),
  };
}

/** GPU rain streaks that wrap around the camera forever. */
export function rain(g: Game, b: LevelBuilder, count = 4000, isOutside: (p: THREE.Vector3) => boolean = () => true): void {
  const size = new THREE.Vector3(26, 14, 26);
  const pos = new Float32Array(count * 2 * 3);
  const end = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const x = Math.random() * size.x;
    const y = Math.random() * size.y;
    const z = Math.random() * size.z;
    for (let k = 0; k < 2; k++) {
      pos[(i * 2 + k) * 3] = x;
      pos[(i * 2 + k) * 3 + 1] = y;
      pos[(i * 2 + k) * 3 + 2] = z;
      end[i * 2 + k] = k;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
  const uniforms = { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uSize: { value: size }, uAlpha: { value: 1 } };
  const mat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, uniforms]),
    transparent: true,
    depthWrite: false,
    fog: true,
    vertexShader: /* glsl */ `
      #include <common>
      #include <fog_pars_vertex>
      attribute float aEnd; uniform float uTime; uniform vec3 uCam; uniform vec3 uSize;
      varying float vA;
      void main(){
        vec3 p = position;
        p.y -= uTime * 11.0 + position.x * 3.1;
        p.x += uTime * 1.2;
        vec3 base = uCam - uSize * 0.5;
        p = mod(p - base, uSize) + base;
        p += vec3(0.08, 0.45, 0.0) * aEnd;
        vA = 0.25 + 0.5 * aEnd;
        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <common>
      #include <fog_pars_fragment>
      uniform float uAlpha; varying float vA;
      void main(){
        gl_FragColor = vec4(0.62, 0.66, 0.72, vA * 0.16 * uAlpha);
        #include <fog_fragment>
      }`,
  });
  const lines = new THREE.LineSegments(geo, mat);
  lines.frustumCulled = false;
  b.addDynamic(lines);
  const u = mat.uniforms as unknown as typeof uniforms;
  b.update((dt) => {
    u.uTime.value += dt;
    u.uCam.value.copy(g.renderer.camera.position);
    const target = isOutside(g.player.pos) ? 1 : 0;
    u.uAlpha.value += (target - u.uAlpha.value) * Math.min(1, dt * 3);
  });
}

/** Periodic lightning: sky flash + directional light pulse + delayed thunder. */
export function lightning(g: Game, b: LevelBuilder, sky: { flash: (k: number) => void }, light: THREE.DirectionalLight): { strike: () => void } {
  let timer = 12 + Math.random() * 10;
  let t = -1;
  const strike = () => {
    t = 0;
    const delay = 0.6 + Math.random() * 2.2;
    setTimeout(() => {
      g.audio.play('distant_bang', { volume: 0.9, rate: 0.55 + Math.random() * 0.15, reverb: 1, bus: 'ambience' });
    }, delay * 1000);
  };
  b.update((dt) => {
    timer -= dt;
    if (timer <= 0) {
      timer = 18 + Math.random() * 30;
      strike();
    }
    if (t >= 0) {
      t += dt;
      const calm = g.settings.reduceFlashing ? 0.3 : 1;
      const k = (t < 0.08 ? 1 : t < 0.16 ? 0.2 : t < 0.26 ? 0.8 : Math.max(0, 1 - (t - 0.26) * 3)) * calm;
      sky.flash(k);
      light.intensity = 0.3 + k * 2.5;
      if (t > 0.7) {
        t = -1;
        sky.flash(0);
        light.intensity = 0.3;
      }
    }
  });
  return { strike };
}
