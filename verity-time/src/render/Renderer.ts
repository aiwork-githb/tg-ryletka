import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import type { Settings } from '../core/Settings';
import { FinalShader } from './FinalShader';

/** Post-processing parameters animated by gameplay (fear, glitches, fades). */
export interface FxState {
  fade: number;
  fadeColor: THREE.Color;
  grain: number;
  vignette: number;
  aberration: number;
  glitch: number;
  saturation: number;
  danger: number;
  blur: number;
}

export class Renderer {
  readonly gl: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  composer!: EffectComposer;
  private renderPass!: RenderPass;
  private bloom: UnrealBloomPass | null = null;
  private gtao: GTAOPass | null = null;
  private final!: ShaderPass;
  private settings!: Settings;
  fx: FxState = {
    fade: 1,
    fadeColor: new THREE.Color(0, 0, 0),
    grain: 0.06,
    vignette: 0.45,
    aberration: 0.0015,
    glitch: 0,
    saturation: 1,
    danger: 0,
    blur: 0,
  };
  reduceFlashing = false;
  private time = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
    this.gl.outputColorSpace = THREE.SRGBColorSpace;
    this.gl.toneMapping = THREE.ACESFilmicToneMapping;
    this.gl.toneMappingExposure = 1;
    this.gl.shadowMap.enabled = true;
    this.gl.shadowMap.type = THREE.PCFShadowMap;
    this.camera = new THREE.PerspectiveCamera(75, 16 / 9, 0.04, 140);
    this.scene.add(this.camera);
  }

  get maxAnisotropy(): number {
    return this.gl.capabilities.getMaxAnisotropy();
  }

  apply(settings: Settings): void {
    this.settings = settings;
    this.reduceFlashing = settings.reduceFlashing;
    this.gl.shadowMap.enabled = settings.shadows !== 'off';
    this.gl.toneMappingExposure = 1.15 * settings.brightness;
    this.camera.fov = settings.fov;
    this.buildComposer();
    this.resize();
  }

  private buildComposer(): void {
    const s = this.settings;
    this.composer?.dispose();
    const size = this.gl.getDrawingBufferSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(Math.max(1, size.x), Math.max(1, size.y), {
      type: THREE.HalfFloatType,
      samples: s.effects === 'low' ? 0 : 4,
    });
    this.composer = new EffectComposer(this.gl, rt);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);
    this.gtao = null;
    if (s.ssao) {
      this.gtao = new GTAOPass(this.scene, this.camera, size.x, size.y);
      this.gtao.output = GTAOPass.OUTPUT.Default;
      this.gtao.blendIntensity = 0.85;
      this.gtao.updateGtaoMaterial({ radius: 0.6, distanceFallOff: 1, thickness: 1 });
      this.composer.addPass(this.gtao);
    }
    this.bloom = null;
    if (s.effects !== 'low') {
      this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), s.effects === 'high' ? 0.35 : 0.25, 0.55, 0.92);
      this.composer.addPass(this.bloom);
    }
    this.composer.addPass(new OutputPass());
    this.final = new ShaderPass(FinalShader);
    this.composer.addPass(this.final);
  }

  resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const scale = (this.settings?.renderScale ?? 1) * Math.min(window.devicePixelRatio || 1, 1.5);
    this.gl.setPixelRatio(scale);
    this.gl.setSize(w, h, false);
    this.gl.domElement.style.width = w + 'px';
    this.gl.domElement.style.height = h + 'px';
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.composer) {
      this.composer.setPixelRatio(scale);
      this.composer.setSize(w, h);
    }
  }

  render(dt: number): void {
    this.time += dt;
    const u = this.final.uniforms;
    const f = this.fx;
    const calm = this.reduceFlashing ? 0.25 : 1;
    u.uTime.value = this.time;
    u.uFade.value = f.fade;
    (u.uFadeColor.value as THREE.Color).copy(f.fadeColor);
    u.uGrain.value = f.grain;
    u.uVignette.value = f.vignette;
    u.uAberration.value = f.aberration * calm;
    u.uGlitch.value = f.glitch * calm;
    u.uSaturation.value = f.saturation;
    u.uDanger.value = f.danger * calm;
    u.uBlur.value = f.blur;
    (u.uResolution.value as THREE.Vector2).set(this.gl.domElement.width, this.gl.domElement.height);
    this.composer.render(dt);
  }

  /** Compiles all materials in the scene up-front to avoid hitches. */
  precompile(): void {
    try {
      this.gl.compile(this.scene, this.camera);
    } catch (e) {
      console.warn('precompile failed', e);
    }
  }

  snapshot(width = 192, height = 108): string | undefined {
    try {
      const src = this.gl.domElement;
      const c = document.createElement('canvas');
      c.width = width;
      c.height = height;
      c.getContext('2d')!.drawImage(src, 0, 0, width, height);
      return c.toDataURL('image/jpeg', 0.7);
    } catch {
      return undefined;
    }
  }
}
