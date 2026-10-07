import * as THREE from 'three';
import type { Game } from '../Game';
import { ITEMS } from '../narrative/registry';

/**
 * Renders item models to small images with the main WebGL renderer
 * (inventory icons and the rotating preview).
 */
export class IconRenderer {
  private scene = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(30, 1, 0.01, 20);
  private rt: THREE.WebGLRenderTarget;
  private cache = new Map<string, string>();
  private models = new Map<string, THREE.Object3D>();
  private buf: Uint8Array;
  private canvas = document.createElement('canvas');

  constructor(
    private g: Game,
    private size = 192,
  ) {
    this.rt = new THREE.WebGLRenderTarget(size, size, { samples: 4 });
    this.rt.texture.colorSpace = THREE.SRGBColorSpace;
    this.buf = new Uint8Array(size * size * 4);
    this.canvas.width = this.canvas.height = size;
    const key = new THREE.DirectionalLight(0xfff2e0, 2.6);
    key.position.set(2, 3, 2);
    const rim = new THREE.DirectionalLight(0x9fc8ff, 1.4);
    rim.position.set(-2, 1, -2);
    this.scene.add(key, rim, new THREE.AmbientLight(0xffffff, 0.6));
  }

  private model(id: string): THREE.Object3D | null {
    let m = this.models.get(id);
    if (!m) {
      const def = ITEMS[id];
      if (!def) return null;
      m = def.model(this.g.mats);
      // centre & normalise size
      const bb = new THREE.Box3().setFromObject(m);
      const c = bb.getCenter(new THREE.Vector3());
      const s = bb.getSize(new THREE.Vector3()).length();
      const holder = new THREE.Group();
      m.position.sub(c);
      holder.add(m);
      holder.scale.setScalar(1 / Math.max(0.001, s));
      m = holder;
      this.models.set(id, m);
    }
    return m;
  }

  private draw(id: string, angle: number): HTMLCanvasElement | null {
    const m = this.model(id);
    if (!m) return null;
    const gl = this.g.renderer.gl;
    this.scene.add(m);
    m.rotation.set(0.35, angle, 0);
    this.cam.position.set(0, 0.15, 2.0);
    this.cam.lookAt(0, 0, 0);
    const prevTarget = gl.getRenderTarget();
    const prevClear = gl.getClearAlpha();
    const prevColor = gl.getClearColor(new THREE.Color());
    const prevTone = gl.toneMapping;
    gl.setRenderTarget(this.rt);
    gl.setClearColor(0x000000, 0);
    gl.clear();
    gl.render(this.scene, this.cam);
    gl.readRenderTargetPixels(this.rt, 0, 0, this.size, this.size, this.buf);
    gl.setRenderTarget(prevTarget);
    gl.setClearColor(prevColor, prevClear);
    gl.toneMapping = prevTone;
    this.scene.remove(m);
    const ctx = this.canvas.getContext('2d')!;
    const img = ctx.createImageData(this.size, this.size);
    const N = this.size;
    for (let y = 0; y < N; y++) img.data.set(this.buf.subarray((N - 1 - y) * N * 4, (N - y) * N * 4), y * N * 4);
    ctx.putImageData(img, 0, 0);
    return this.canvas;
  }

  icon(id: string): string {
    const hit = this.cache.get(id);
    if (hit) return hit;
    const c = this.draw(id, 0.7);
    const url = c ? c.toDataURL() : '';
    this.cache.set(id, url);
    return url;
  }

  /** Draws a rotating preview into a target 2D canvas. */
  preview(id: string, angle: number, target: HTMLCanvasElement): void {
    const c = this.draw(id, angle);
    if (!c) return;
    const ctx = target.getContext('2d')!;
    ctx.clearRect(0, 0, target.width, target.height);
    ctx.drawImage(c, 0, 0, target.width, target.height);
  }
}
