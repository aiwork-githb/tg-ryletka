import * as THREE from 'three';

/**
 * Final display-space pass: film grain, vignette, chromatic aberration,
 * VHS-style glitch (used for Verity's presence), danger tint and fades.
 */
export const FinalShader = {
  name: 'VTFinal',
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uFade: { value: 1 },
    uFadeColor: { value: new THREE.Color(0, 0, 0) },
    uGrain: { value: 0.05 },
    uVignette: { value: 0.4 },
    uAberration: { value: 0.0015 },
    uGlitch: { value: 0 },
    uSaturation: { value: 1 },
    uDanger: { value: 0 },
    uBlur: { value: 0 },
    uResolution: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime, uFade, uGrain, uVignette, uAberration, uGlitch, uSaturation, uDanger, uBlur;
    uniform vec3 uFadeColor;
    uniform vec2 uResolution;
    varying vec2 vUv;

    float hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }

    vec3 sampleCA(vec2 uv, float amt){
      vec2 d = (uv - 0.5) * amt;
      float r = texture2D(tDiffuse, uv + d).r;
      float g = texture2D(tDiffuse, uv).g;
      float b = texture2D(tDiffuse, uv - d).b;
      return vec3(r,g,b);
    }

    void main(){
      vec2 uv = vUv;
      // glitch: horizontal tearing bands
      if (uGlitch > 0.001) {
        float band = floor(uv.y * 48.0 + floor(uTime*24.0)*3.0);
        float n = hash(vec2(band, floor(uTime*30.0)));
        float tear = step(1.0 - uGlitch*0.35, n) * (hash(vec2(band, 2.0)) - 0.5) * 0.08 * uGlitch;
        uv.x += tear;
        uv.y += (hash(vec2(floor(uTime*20.0), 9.0)) - 0.5) * 0.004 * uGlitch;
      }
      float ca = uAberration + uGlitch * 0.012 + uDanger * 0.004;
      vec3 col = sampleCA(uv, ca * 10.0);
      if (uBlur > 0.001) {
        vec2 px = 1.0 / uResolution * (1.0 + uBlur*6.0);
        vec3 acc = col;
        acc += texture2D(tDiffuse, uv + vec2(px.x, 0.0)).rgb;
        acc += texture2D(tDiffuse, uv - vec2(px.x, 0.0)).rgb;
        acc += texture2D(tDiffuse, uv + vec2(0.0, px.y)).rgb;
        acc += texture2D(tDiffuse, uv - vec2(0.0, px.y)).rgb;
        col = mix(col, acc / 5.0, clamp(uBlur, 0.0, 1.0));
      }
      // saturation
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(vec3(l), col, uSaturation);
      // glitch colour bleed
      if (uGlitch > 0.001) {
        float line = step(0.5, fract(uv.y * uResolution.y * 0.5));
        col *= 1.0 - line * 0.12 * uGlitch;
        col.r += hash(uv*uTime) * 0.08 * uGlitch;
      }
      // danger: red edges pulse
      vec2 c = uv - 0.5;
      float r2 = dot(c, c);
      float pulse = 0.6 + 0.4 * sin(uTime * 6.0);
      col = mix(col, col * vec3(1.25, 0.55, 0.5), uDanger * smoothstep(0.05, 0.35, r2) * pulse);
      // vignette
      col *= 1.0 - uVignette * smoothstep(0.08, 0.55, r2);
      // grain (luma dependent, stronger in darks)
      float g = hash(uv * uResolution + fract(uTime * 7.13) * 100.0) - 0.5;
      col += g * uGrain * (1.2 - l);
      col = mix(col, uFadeColor, clamp(uFade, 0.0, 1.0));
      gl_FragColor = vec4(max(col, 0.0), 1.0);
    }
  `,
};
