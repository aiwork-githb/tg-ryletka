import * as THREE from 'three';
import type { Game } from '../Game';
import type { LevelBuilder } from './LevelBuilder';
import type { VLight } from '../render/LightManager';

let dotTex: THREE.Texture | null = null;
function dot(): THREE.Texture {
  if (dotTex) return dotTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.3, 'rgba(255,255,255,0.5)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  dotTex = new THREE.CanvasTexture(c);
  return dotTex;
}

/** Slowly drifting dust motes inside a box; brighter near the camera's light. */
export function dust(g: Game, b: LevelBuilder, min: THREE.Vector3, max: THREE.Vector3, count = 400, color = 0xfff2dc, size = 0.025): THREE.Points {
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = THREE.MathUtils.lerp(min.x, max.x, Math.random());
    pos[i * 3 + 1] = THREE.MathUtils.lerp(min.y, max.y, Math.random());
    pos[i * 3 + 2] = THREE.MathUtils.lerp(min.z, max.z, Math.random());
    seed[i] = Math.random() * 100;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const uniforms = {
    uTime: g.mats.shared.uTime,
    uMap: { value: dot() },
    uColor: { value: new THREE.Color(color) },
    uSize: { value: size * (g.settings.effects === 'low' ? 0 : 1) },
    uMin: { value: min.clone() },
    uMax: { value: max.clone() },
    uLight: { value: new THREE.Vector3() },
    uLightDir: { value: new THREE.Vector3(0, 0, -1) },
    uLightOn: { value: 1 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute float aSeed; uniform float uTime, uSize; uniform vec3 uMin, uMax, uLight, uLightDir; uniform float uLightOn;
      varying float vA;
      void main(){
        vec3 p = position;
        vec3 range = uMax - uMin;
        p.x += sin(uTime*0.13 + aSeed) * 0.4 + uTime * 0.02;
        p.y += sin(uTime*0.09 + aSeed*1.7) * 0.3 - uTime * 0.008;
        p.z += cos(uTime*0.11 + aSeed*0.7) * 0.4;
        p = mod(p - uMin, range) + uMin;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uSize * 900.0 / max(0.5, -mv.z);
        // visible mostly inside the flashlight cone
        vec3 toP = p - uLight;
        float d = length(toP);
        float cone = smoothstep(0.82, 0.96, dot(normalize(toP), uLightDir)) * uLightOn;
        float twinkle = 0.6 + 0.4 * sin(uTime * 2.0 + aSeed * 3.0);
        vA = (0.08 + cone * 0.9 * smoothstep(9.0, 1.0, d)) * twinkle * smoothstep(0.2, 0.6, d);
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap; uniform vec3 uColor; varying float vA;
      void main(){ vec4 t = texture2D(uMap, gl_PointCoord); gl_FragColor = vec4(uColor, t.a * vA); }`,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  b.addDynamic(pts);
  b.update(() => {
    const l = g.flashlight.light;
    uniforms.uLight.value.copy(l.position);
    uniforms.uLightDir.value.copy(l.target.position).sub(l.position).normalize();
    uniforms.uLightOn.value = l.intensity > 1 ? 1 : 0.15;
  });
  return pts;
}

/** Fake volumetric light shaft (additive cone with soft edges). */
export function lightCone(
  g: Game,
  b: LevelBuilder,
  from: THREE.Vector3,
  to: THREE.Vector3,
  radius: number,
  color = 0xffe8c0,
  intensity = 0.12,
  follow?: VLight,
): THREE.Mesh {
  const len = from.distanceTo(to);
  const geo = new THREE.CylinderGeometry(0.02, radius, len, 24, 1, true);
  geo.translate(0, -len / 2, 0);
  const uniforms = { uColor: { value: new THREE.Color(color) }, uInt: { value: intensity }, uLen: { value: len }, uTime: g.mats.shared.uTime };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      varying float vY; varying vec3 vN; varying vec3 vV;
      uniform float uLen;
      void main(){
        vY = -position.y / uLen;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uInt; uniform float uTime;
      varying float vY; varying vec3 vN; varying vec3 vV;
      void main(){
        float edge = pow(abs(dot(vN, vV)), 1.6);
        float fall = (1.0 - vY) * smoothstep(0.0, 0.08, vY);
        float flick = 0.92 + 0.08 * sin(uTime * 1.7);
        gl_FragColor = vec4(uColor * uInt * edge * fall * flick, 1.0);
      }`,
  });
  const cone = new THREE.Mesh(geo, mat);
  cone.position.copy(from);
  cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), to.clone().sub(from).normalize());
  cone.renderOrder = 5;
  b.addDynamic(cone);
  if (follow) {
    b.update(() => {
      const lvl = (follow as any)._lvl ?? (follow.on ? 1 : 0);
      uniforms.uInt.value = intensity * lvl;
      cone.visible = lvl > 0.02;
    });
  }
  cone.castShadow = false;
  cone.receiveShadow = false;
  return cone;
}

/** Spark burst (breaker trips, cut cables). */
export function sparks(g: Game, pos: THREE.Vector3, count = 40): void {
  const geo = new THREE.BufferGeometry();
  const p = new Float32Array(count * 3);
  const v: THREE.Vector3[] = [];
  for (let i = 0; i < count; i++) {
    p.set([pos.x, pos.y, pos.z], i * 3);
    v.push(new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 3, (Math.random() - 0.5) * 4));
  }
  geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
  const mat = new THREE.PointsMaterial({ color: 0xffc860, size: 0.05, map: dot(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const pts = new THREE.Points(geo, mat);
  g.renderer.scene.add(pts);
  let t = 0;
  const step = () => {
    t += 1 / 60;
    for (let i = 0; i < count; i++) {
      v[i].y -= 9.8 / 60;
      p[i * 3] += v[i].x / 60;
      p[i * 3 + 1] += v[i].y / 60;
      p[i * 3 + 2] += v[i].z / 60;
    }
    geo.attributes.position.needsUpdate = true;
    mat.opacity = Math.max(0, 1 - t * 1.4);
    if (t < 0.8) requestAnimationFrame(step);
    else {
      g.renderer.scene.remove(pts);
      geo.dispose();
      mat.dispose();
    }
  };
  step();
}
