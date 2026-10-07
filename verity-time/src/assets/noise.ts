/**
 * Tileable procedural noise primitives operating on Float32Array images.
 * All generators wrap seamlessly so textures can repeat without seams.
 */
export class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = (seed >>> 0) || 0x9e3779b9;
  }
  next(): number {
    // mulberry32
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a: number, b: number): number {
    return a + (b - a) * this.next();
  }
  int(a: number, b: number): number {
    return Math.floor(this.range(a, b + 1));
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
}

export function hash2(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export type Img = Float32Array;

export function img(w: number, h: number, fill = 0): Img {
  const a = new Float32Array(w * h);
  if (fill) a.fill(fill);
  return a;
}

/** Tileable value noise with integer `period` lattice cells across the image. */
export function valueNoise(w: number, h: number, period: number, seed: number, out?: Img): Img {
  const o = out ?? img(w, h);
  const px = Math.max(1, Math.round(period));
  const py = Math.max(1, Math.round((period * h) / w));
  const lattice = new Float32Array(px * py);
  for (let j = 0; j < py; j++) for (let i = 0; i < px; i++) lattice[j * px + i] = hash2(i, j, seed);
  for (let y = 0; y < h; y++) {
    const fy = (y / h) * py;
    const iy = Math.floor(fy);
    let ty = fy - iy;
    ty = ty * ty * (3 - 2 * ty);
    const y0 = iy % py;
    const y1 = (iy + 1) % py;
    for (let x = 0; x < w; x++) {
      const fx = (x / w) * px;
      const ix = Math.floor(fx);
      let tx = fx - ix;
      tx = tx * tx * (3 - 2 * tx);
      const x0 = ix % px;
      const x1 = (ix + 1) % px;
      const a = lattice[y0 * px + x0];
      const b = lattice[y0 * px + x1];
      const c = lattice[y1 * px + x0];
      const d = lattice[y1 * px + x1];
      o[y * w + x] = a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
    }
  }
  return o;
}

/** Fractal value noise normalised to ~[0,1]. */
export function fbm(w: number, h: number, period: number, octaves: number, seed: number, gain = 0.5): Img {
  const o = img(w, h);
  const tmp = img(w, h);
  let amp = 1;
  let total = 0;
  let p = period;
  for (let k = 0; k < octaves; k++) {
    valueNoise(w, h, p, seed + k * 101, tmp);
    for (let i = 0; i < o.length; i++) o[i] += tmp[i] * amp;
    total += amp;
    amp *= gain;
    p *= 2;
  }
  for (let i = 0; i < o.length; i++) o[i] /= total;
  return normalize(o);
}

/** Tileable Worley noise: returns F1 distance (normalised) and cell id. */
export function worley(w: number, h: number, cells: number, seed: number): { f1: Img; f2: Img; id: Img } {
  const cx = Math.max(1, Math.round(cells));
  const cy = Math.max(1, Math.round((cells * h) / w));
  const ptsX = new Float32Array(cx * cy);
  const ptsY = new Float32Array(cx * cy);
  for (let j = 0; j < cy; j++)
    for (let i = 0; i < cx; i++) {
      ptsX[j * cx + i] = i + hash2(i, j, seed);
      ptsY[j * cx + i] = j + hash2(i, j, seed + 7);
    }
  const f1 = img(w, h);
  const f2 = img(w, h);
  const id = img(w, h);
  for (let y = 0; y < h; y++) {
    const fy = (y / h) * cy;
    const iy = Math.floor(fy);
    for (let x = 0; x < w; x++) {
      const fx = (x / w) * cx;
      const ix = Math.floor(fx);
      let d1 = 1e9;
      let d2 = 1e9;
      let best = 0;
      for (let oy = -1; oy <= 1; oy++)
        for (let ox = -1; ox <= 1; ox++) {
          const gx = ix + ox;
          const gy = iy + oy;
          const wx = ((gx % cx) + cx) % cx;
          const wy = ((gy % cy) + cy) % cy;
          const k = wy * cx + wx;
          const px = ptsX[k] - wx + gx;
          const py = ptsY[k] - wy + gy;
          const dx = px - fx;
          const dy = py - fy;
          const d = dx * dx + dy * dy;
          if (d < d1) {
            d2 = d1;
            d1 = d;
            best = k;
          } else if (d < d2) d2 = d;
        }
      const i = y * w + x;
      f1[i] = Math.sqrt(d1);
      f2[i] = Math.sqrt(d2);
      id[i] = hash2(best, best * 3, seed + 13);
    }
  }
  return { f1, f2, id };
}

export function normalize(a: Img): Img {
  let mn = Infinity;
  let mx = -Infinity;
  for (let i = 0; i < a.length; i++) {
    const v = a[i];
    if (v < mn) mn = v;
    if (v > mx) mx = v;
  }
  const r = mx - mn || 1;
  for (let i = 0; i < a.length; i++) a[i] = (a[i] - mn) / r;
  return a;
}

export function smoothstep(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Box blur with wrap-around (tileable), separable, `r` passes radius. */
export function blur(a: Img, w: number, h: number, r: number): Img {
  if (r < 1) return a;
  const tmp = img(w, h);
  const n = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    let s = 0;
    for (let k = -r; k <= r; k++) s += a[y * w + ((k + w) % w)];
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = s / n;
      s += a[y * w + ((x + r + 1) % w)] - a[y * w + ((x - r + w) % w)];
    }
  }
  for (let x = 0; x < w; x++) {
    let s = 0;
    for (let k = -r; k <= r; k++) s += tmp[((k + h) % h) * w + x];
    for (let y = 0; y < h; y++) {
      a[y * w + x] = s / n;
      s += tmp[((y + r + 1) % h) * w + x] - tmp[((y - r + h) % h) * w + x];
    }
  }
  return a;
}

/** Converts a height image into a tangent-space normal map (RGBA bytes). */
export function heightToNormal(hgt: Img, w: number, h: number, strength: number): Uint8Array {
  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    const ym = ((y - 1 + h) % h) * w;
    const yp = ((y + 1) % h) * w;
    const yc = y * w;
    for (let x = 0; x < w; x++) {
      const xm = (x - 1 + w) % w;
      const xp = (x + 1) % w;
      // Sobel
      const tl = hgt[ym + xm];
      const t = hgt[ym + x];
      const tr = hgt[ym + xp];
      const l = hgt[yc + xm];
      const r = hgt[yc + xp];
      const bl = hgt[yp + xm];
      const b = hgt[yp + x];
      const br = hgt[yp + xp];
      const dx = (tr + 2 * r + br - (tl + 2 * l + bl)) * strength;
      const dy = (bl + 2 * b + br - (tl + 2 * t + tr)) * strength;
      let nx = -dx;
      let ny = dy; // canvas y goes down; three expects +y up (OpenGL convention)
      let nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len;
      ny /= len;
      nz /= len;
      const i = (yc + x) * 4;
      out[i] = (nx * 0.5 + 0.5) * 255;
      out[i + 1] = (ny * 0.5 + 0.5) * 255;
      out[i + 2] = (nz * 0.5 + 0.5) * 255;
      out[i + 3] = 255;
    }
  }
  return out;
}
