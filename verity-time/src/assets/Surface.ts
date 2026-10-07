import { blur, clamp01, fbm, img, Rng, smoothstep, worley, type Img } from './noise';

export type RGB = [number, number, number];

export function hex(c: string): RGB {
  const n = parseInt(c.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function mixRGB(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/**
 * A layered PBR surface being authored in memory. Every channel is a
 * Float32Array in [0,1]. Albedo is sRGB, the rest are linear.
 */
export class Surface {
  readonly n: number;
  r: Img;
  g: Img;
  b: Img;
  height: Img;
  rough: Img;
  metal: Img;
  ao: Img;
  alpha: Img | null = null;
  emissive: Img | null = null;
  rng: Rng;

  constructor(
    public size: number,
    public seed: number,
  ) {
    const n = size * size;
    this.n = n;
    this.r = img(size, size);
    this.g = img(size, size);
    this.b = img(size, size);
    this.height = img(size, size, 0.5);
    this.rough = img(size, size, 0.8);
    this.metal = img(size, size, 0);
    this.ao = img(size, size, 1);
    this.rng = new Rng(seed);
  }

  /** Noise helper sized to this surface. `period` is in cells across the texture. */
  noise(period: number, octaves = 4, seedOff = 0, gain = 0.5): Img {
    return fbm(this.size, this.size, period, octaves, this.seed * 31 + seedOff, gain);
  }

  worley(cells: number, seedOff = 0) {
    return worley(this.size, this.size, cells, this.seed * 17 + seedOff);
  }

  fill(c: RGB, rough?: number, metal?: number): this {
    this.r.fill(c[0]);
    this.g.fill(c[1]);
    this.b.fill(c[2]);
    if (rough !== undefined) this.rough.fill(rough);
    if (metal !== undefined) this.metal.fill(metal);
    return this;
  }

  /** Lerp albedo towards colour where mask>0 (mask*opacity). */
  paint(mask: Img | null, c: RGB, opacity = 1, rough?: number, metal?: number): this {
    for (let i = 0; i < this.n; i++) {
      const t = (mask ? mask[i] : 1) * opacity;
      if (t <= 0) continue;
      this.r[i] += (c[0] - this.r[i]) * t;
      this.g[i] += (c[1] - this.g[i]) * t;
      this.b[i] += (c[2] - this.b[i]) * t;
      if (rough !== undefined) this.rough[i] += (rough - this.rough[i]) * t;
      if (metal !== undefined) this.metal[i] += (metal - this.metal[i]) * t;
    }
    return this;
  }

  /** Multiplies albedo brightness by (1 + (noise-0.5)*amount). */
  vary(noise: Img, amount: number): this {
    for (let i = 0; i < this.n; i++) {
      const k = 1 + (noise[i] - 0.5) * amount;
      this.r[i] *= k;
      this.g[i] *= k;
      this.b[i] *= k;
    }
    return this;
  }

  /** Hue-ish variation: shifts each channel by a separate noise. */
  tint(noise: Img, c: RGB, amount: number): this {
    for (let i = 0; i < this.n; i++) {
      const t = (noise[i] - 0.5) * amount;
      this.r[i] += c[0] * t;
      this.g[i] += c[1] * t;
      this.b[i] += c[2] * t;
    }
    return this;
  }

  multiply(mask: Img, strength: number): this {
    for (let i = 0; i < this.n; i++) {
      const k = 1 - (1 - mask[i]) * strength;
      this.r[i] *= k;
      this.g[i] *= k;
      this.b[i] *= k;
    }
    return this;
  }

  addHeight(mask: Img, amount: number): this {
    for (let i = 0; i < this.n; i++) this.height[i] += (mask[i] - 0.5) * amount;
    return this;
  }

  setHeightWhere(mask: Img, value: number): this {
    for (let i = 0; i < this.n; i++) this.height[i] += (value - this.height[i]) * mask[i];
    return this;
  }

  roughVary(noise: Img, amount: number): this {
    for (let i = 0; i < this.n; i++) this.rough[i] = clamp01(this.rough[i] + (noise[i] - 0.5) * amount);
    return this;
  }

  aoFrom(mask: Img, strength: number): this {
    for (let i = 0; i < this.n; i++) this.ao[i] *= 1 - (1 - mask[i]) * strength;
    return this;
  }

  // -------------------------------------------------------------------------
  // Common weathering layers. These are what make surfaces feel "lived in".
  // -------------------------------------------------------------------------

  /** Organic dirt patches: darken + roughen. */
  grime(amount: number, scale = 4, color: RGB = [0.18, 0.15, 0.11], seedOff = 900): this {
    const n1 = this.noise(scale, 5, seedOff);
    const n2 = this.noise(scale * 4, 3, seedOff + 1);
    const mask = img(this.size, this.size);
    for (let i = 0; i < this.n; i++) mask[i] = smoothstep(0.45, 0.85, n1[i] * 0.75 + n2[i] * 0.25) * amount;
    this.paint(mask, color, 0.75, 0.95);
    return this;
  }

  /** Vertical streaks (water / rust run-off) originating at the top. */
  streaks(amount: number, color: RGB = [0.3, 0.24, 0.16], count = 14, seedOff = 300): this {
    const N = this.size;
    const mask = img(N, N);
    const rng = new Rng(this.seed * 7 + seedOff);
    const vn = this.noise(N / 8, 3, seedOff + 5);
    for (let k = 0; k < count; k++) {
      const x0 = rng.int(0, N - 1);
      const wdt = rng.range(N * 0.004, N * 0.03);
      const len = rng.range(N * 0.2, N * 0.95);
      const y0 = rng.range(-N * 0.1, N * 0.4);
      const strength = rng.range(0.3, 1);
      for (let y = Math.max(0, Math.floor(y0)); y < Math.min(N, y0 + len); y++) {
        const fall = 1 - (y - y0) / len;
        const wob = (vn[y * N + (x0 % N)] - 0.5) * wdt * 2;
        for (let dx = -Math.ceil(wdt); dx <= Math.ceil(wdt); dx++) {
          const x = (((x0 + dx + Math.round(wob)) % N) + N) % N;
          const f = 1 - Math.abs(dx) / (wdt + 1);
          const i = y * N + x;
          mask[i] = Math.max(mask[i], f * fall * strength);
        }
      }
    }
    blur(mask, N, N, Math.max(1, Math.round(N / 512)));
    this.paint(mask, color, amount * 0.6, 0.85);
    return this;
  }

  /** Fine scratches. depth<0 carves them into the height map. */
  scratches(count: number, opacity: number, color: RGB = [0.9, 0.88, 0.84], depth = -0.15, seedOff = 400): this {
    const N = this.size;
    const mask = canvasMask(N, (ctx) => {
      const rng = new Rng(this.seed * 13 + seedOff);
      ctx.lineCap = 'round';
      for (let k = 0; k < count; k++) {
        const x = rng.range(0, N);
        const y = rng.range(0, N);
        const a = rng.range(0, Math.PI * 2);
        const len = rng.range(N * 0.02, N * 0.18);
        ctx.globalAlpha = rng.range(0.2, 1);
        ctx.lineWidth = rng.range(0.5, 1.6) * (N / 1024) * 1.5;
        ctx.beginPath();
        wrapPath(ctx, N, x, y, len, (c, ox, oy) => {
          c.moveTo(x + ox, y + oy);
          const cx = x + ox + Math.cos(a) * len * 0.5 + rng.range(-4, 4);
          const cy = y + oy + Math.sin(a) * len * 0.5 + rng.range(-4, 4);
          c.quadraticCurveTo(cx, cy, x + ox + Math.cos(a) * len, y + oy + Math.sin(a) * len);
        });
        ctx.stroke();
      }
    });
    this.paint(mask, color, opacity);
    for (let i = 0; i < this.n; i++) this.height[i] += mask[i] * depth;
    return this;
  }

  /** Small chips / dents revealing an under-layer colour. */
  chips(threshold: number, under: RGB, underRough: number, underMetal = 0, seedOff = 500, scale = 10): this {
    const w = this.worley(scale, seedOff);
    const n = this.noise(scale / 2, 4, seedOff + 3);
    const mask = img(this.size, this.size);
    for (let i = 0; i < this.n; i++) {
      const v = n[i] * 0.7 + (1 - w.f1[i]) * 0.3;
      mask[i] = smoothstep(threshold, threshold + 0.04, v);
    }
    this.paint(mask, under, 1, underRough, underMetal);
    this.addHeight(mask, -0.25);
    // dark rim around chips
    const rim = Float32Array.from(mask);
    blur(rim, this.size, this.size, Math.max(1, Math.round(this.size / 400)));
    for (let i = 0; i < this.n; i++) rim[i] = clamp01((rim[i] - mask[i]) * 3);
    this.paint(rim, [0.12, 0.1, 0.08], 0.35);
    return this;
  }

  /** Damp / water stains: irregular blots with a darker tide line. */
  waterStains(count: number, opacity = 0.4, seedOff = 700): this {
    const N = this.size;
    const mask = img(N, N);
    const rng = new Rng(this.seed * 19 + seedOff);
    const warp = this.noise(10, 4, seedOff + 1);
    const warp2 = this.noise(24, 3, seedOff + 2);
    for (let k = 0; k < count; k++) {
      const cx = rng.range(0, N);
      const cy = rng.range(0, N);
      const r = rng.range(N * 0.05, N * 0.2);
      const sq = rng.range(0.6, 1.3);
      const strength = rng.range(0.5, 1);
      const R = Math.ceil(r * 1.6);
      for (let dy = -R; dy <= R; dy++)
        for (let dx = -R; dx <= R; dx++) {
          const x = (((Math.floor(cx) + dx) % N) + N) % N;
          const y = (((Math.floor(cy) + dy) % N) + N) % N;
          const i = y * N + x;
          const d = Math.hypot(dx, dy * sq) / r + (warp[i] - 0.5) * 0.9 + (warp2[i] - 0.5) * 0.25;
          if (d >= 1.05) continue;
          const fill = d < 1 ? 0.22 : 0;
          const tide = smoothstep(0.8, 0.98, d) * (1 - smoothstep(0.98, 1.05, d));
          mask[i] = Math.max(mask[i], (fill + tide * 0.7) * strength);
        }
    }
    blur(mask, N, N, Math.max(1, Math.round(N / 600)));
    this.paint(mask, [0.45, 0.36, 0.22], opacity, 0.9);
    return this;
  }

  /** Cavity dirt: accumulate darkness where height is low. */
  cavityDirt(amount: number, color: RGB = [0.1, 0.09, 0.07]): this {
    const blurred = Float32Array.from(this.height);
    blur(blurred, this.size, this.size, Math.max(2, Math.round(this.size / 128)));
    const mask = img(this.size, this.size);
    for (let i = 0; i < this.n; i++) mask[i] = clamp01((blurred[i] - this.height[i]) * 6);
    this.paint(mask, color, amount, 0.95);
    for (let i = 0; i < this.n; i++) this.ao[i] *= 1 - mask[i] * 0.5;
    return this;
  }

  clampAll(): this {
    for (let i = 0; i < this.n; i++) {
      this.r[i] = clamp01(this.r[i]);
      this.g[i] = clamp01(this.g[i]);
      this.b[i] = clamp01(this.b[i]);
      this.height[i] = clamp01(this.height[i]);
      this.rough[i] = clamp01(this.rough[i]);
      this.metal[i] = clamp01(this.metal[i]);
      this.ao[i] = clamp01(this.ao[i]);
    }
    return this;
  }
}

// ---------------------------------------------------------------------------
// Canvas helpers (browser only)
// ---------------------------------------------------------------------------

let scratchCanvas: HTMLCanvasElement | null = null;

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function ctxFor(N: number): CanvasRenderingContext2D {
  if (!scratchCanvas) scratchCanvas = makeCanvas(N, N);
  if (scratchCanvas.width !== N) scratchCanvas.width = scratchCanvas.height = N;
  const ctx = scratchCanvas.getContext('2d', { willReadFrequently: true })!;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.filter = 'none';
  return ctx;
}

/** Draws white-on-black into a canvas and returns the red channel as a mask. */
export function canvasMask(N: number, draw: (ctx: CanvasRenderingContext2D, N: number) => void): Img {
  const ctx = ctxFor(N);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, N, N);
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#fff';
  draw(ctx, N);
  const d = ctx.getImageData(0, 0, N, N).data;
  const o = img(N, N);
  for (let i = 0; i < o.length; i++) o[i] = d[i * 4] / 255;
  return o;
}

/** Draws a colour pattern and writes it into the surface albedo (with alpha blend). */
export function canvasPaint(s: Surface, draw: (ctx: CanvasRenderingContext2D, N: number) => void, opacity = 1): Img {
  const N = s.size;
  const ctx = ctxFor(N);
  ctx.clearRect(0, 0, N, N);
  draw(ctx, N);
  const d = ctx.getImageData(0, 0, N, N).data;
  const cov = img(N, N);
  for (let i = 0; i < s.n; i++) {
    const a = (d[i * 4 + 3] / 255) * opacity;
    cov[i] = a;
    if (a <= 0) continue;
    s.r[i] += (d[i * 4] / 255 - s.r[i]) * a;
    s.g[i] += (d[i * 4 + 1] / 255 - s.g[i]) * a;
    s.b[i] += (d[i * 4 + 2] / 255 - s.b[i]) * a;
  }
  return cov;
}

/** Calls fn for every wrapped copy needed so a shape of radius r tiles seamlessly. */
export function wrapDraw(N: number, x: number, y: number, r: number, fn: (ox: number, oy: number) => void): void {
  for (let oy = -1; oy <= 1; oy++)
    for (let ox = -1; ox <= 1; ox++) {
      const cx = x + ox * N;
      const cy = y + oy * N;
      if (cx + r < 0 || cx - r > N || cy + r < 0 || cy - r > N) continue;
      fn(ox * N, oy * N);
    }
}

function wrapPath(
  ctx: CanvasRenderingContext2D,
  N: number,
  x: number,
  y: number,
  r: number,
  fn: (c: CanvasRenderingContext2D, ox: number, oy: number) => void,
): void {
  wrapDraw(N, x, y, r, (ox, oy) => fn(ctx, ox, oy));
}
