import * as THREE from 'three';

/**
 * Hand-held flashlight. Lags slightly behind the view for a physical feel,
 * casts the only high-quality shadow in the game, and can be made to
 * flicker / die by horror events.
 */
export class Flashlight {
  readonly light: THREE.SpotLight;
  readonly bounce: THREE.PointLight;
  on = true;
  private dir = new THREE.Vector3(0, 0, -1);
  private flickerT = 0;
  private flickerStrength = 0;
  private level = 1;
  baseIntensity = 70;
  /** Forced off by scripts (e.g. power drain near Verity). */
  suppressed = 0;

  constructor(scene: THREE.Scene) {
    this.light = new THREE.SpotLight(0xfff0d8, this.baseIntensity, 30, 0.5, 0.55, 1.6);
    this.light.name = 'Flashlight';
    this.light.shadow.bias = -0.0004;
    this.light.shadow.normalBias = 0.02;
    this.light.shadow.camera.near = 0.15;
    this.light.shadow.camera.far = 26;
    this.light.map = makeCookie();
    // faint spill so walls right next to the player are readable
    this.bounce = new THREE.PointLight(0xffe6c8, 0.0, 4, 2);
    scene.add(this.light, this.light.target, this.bounce);
  }

  configure(shadows: 'off' | 'low' | 'high'): void {
    this.light.castShadow = shadows !== 'off';
    const size = shadows === 'high' ? 1024 : 512;
    if (this.light.shadow.mapSize.x !== size) {
      this.light.shadow.mapSize.set(size, size);
      this.light.shadow.map?.dispose();
      (this.light.shadow as any).map = null;
    }
  }

  toggle(): boolean {
    this.on = !this.on;
    return this.on;
  }

  flicker(duration: number, strength = 1): void {
    this.flickerT = Math.max(this.flickerT, duration);
    this.flickerStrength = Math.max(this.flickerStrength, strength);
  }

  update(dt: number, camera: THREE.Camera, time: number): void {
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const k = 1 - Math.exp(-dt * 16);
    this.dir.lerp(fwd, k).normalize();
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    const down = new THREE.Vector3(0, -1, 0).applyQuaternion(camera.quaternion);
    this.light.position.copy(camera.position).addScaledVector(right, 0.18).addScaledVector(down, 0.16);
    this.light.target.position.copy(this.light.position).addScaledVector(this.dir, 5);
    this.light.target.updateMatrixWorld();
    let f = 1;
    if (this.flickerT > 0) {
      this.flickerT -= dt;
      const n = Math.sin(time * 53) * Math.sin(time * 17.3) + Math.sin(time * 91);
      f = n > 0.4 ? 1 : 1 - this.flickerStrength * (0.6 + 0.4 * Math.random());
      if (this.flickerT <= 0) this.flickerStrength = 0;
    }
    const target = this.on && this.suppressed <= 0 ? 1 : 0;
    this.level += (target - this.level) * Math.min(1, dt * 25);
    this.light.intensity = this.baseIntensity * this.level * f;
    this.light.visible = this.light.intensity > 0.01;
    this.bounce.position.copy(camera.position).addScaledVector(fwd, 0.6);
    this.bounce.intensity = 0.6 * this.level * f;
  }
}

/** Light cookie: hot centre, soft ring and lens imperfections. */
function makeCookie(): THREE.Texture {
  const N = 256;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d')!;
  g.fillStyle = '#000';
  g.fillRect(0, 0, N, N);
  const grd = g.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.18, 'rgba(255,250,240,0.95)');
  grd.addColorStop(0.32, 'rgba(210,205,195,0.55)');
  grd.addColorStop(0.42, 'rgba(255,248,235,0.75)');
  grd.addColorStop(0.5, 'rgba(160,150,140,0.35)');
  grd.addColorStop(0.85, 'rgba(70,65,60,0.18)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, N, N);
  // lens smudges
  for (let i = 0; i < 30; i++) {
    g.fillStyle = `rgba(0,0,0,${0.03 + Math.random() * 0.05})`;
    g.beginPath();
    g.arc(N / 2 + (Math.random() - 0.5) * N * 0.6, N / 2 + (Math.random() - 0.5) * N * 0.6, 4 + Math.random() * 20, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
