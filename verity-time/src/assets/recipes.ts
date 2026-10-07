/**
 * Procedural PBR material recipes. Each recipe paints a Surface (albedo,
 * height, roughness, metalness, AO). Recipes are deterministic per seed so the
 * same material always looks identical across sessions.
 */
import { blur, clamp01, img, Rng, smoothstep } from './noise';
import { canvasMask, canvasPaint, hex, mixRGB, Surface, wrapDraw, type RGB } from './Surface';

export interface RecipeParams {
  color?: string;
  color2?: string;
  color3?: string;
  wear?: number; // 0..1 how worn / dirty
  tiles?: number;
}

export type Recipe = (s: Surface, p: RecipeParams) => void;

const N_ = (s: Surface) => s.size;

// ---------------------------------------------------------------------------

/** Polished terrazzo with coloured chips and brass divider strips. */
const terrazzo: Recipe = (s, p) => {
  const base = hex(p.color ?? '#dcd2bf');
  s.fill(base, 0.22, 0);
  s.vary(s.noise(6, 5, 1), 0.12);
  const palette: RGB[] = [hex('#7a2a24'), hex('#2f6f6a'), hex('#1d1b1a'), hex('#f2efe6'), hex('#b98a3c'), hex('#6c6a65')];
  for (const [cells, thr, op] of [
    [60, 0.28, 1],
    [140, 0.24, 0.9],
    [26, 0.22, 1],
  ] as const) {
    const w = s.worley(cells, cells);
    const m = img(s.size, s.size);
    const col = img(s.size, s.size);
    for (let i = 0; i < s.n; i++) {
      m[i] = w.id[i] < 0.55 ? smoothstep(thr, thr - 0.06, w.f1[i]) : 0;
      col[i] = w.id[i];
    }
    for (let i = 0; i < s.n; i++) {
      if (m[i] <= 0) continue;
      const c = palette[Math.floor(col[i] * 1.8 * palette.length) % palette.length];
      const t = m[i] * op;
      s.r[i] += (c[0] - s.r[i]) * t;
      s.g[i] += (c[1] - s.g[i]) * t;
      s.b[i] += (c[2] - s.b[i]) * t;
    }
  }
  // brass divider strips on texture border (one slab per texture)
  const N = N_(s);
  const strip = Math.max(2, Math.round(N / 220));
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      if (x < strip || y < strip) {
        const i = y * N + x;
        s.r[i] = 0.62;
        s.g[i] = 0.48;
        s.b[i] = 0.25;
        s.metal[i] = 0.9;
        s.rough[i] = 0.35;
        s.height[i] = 0.55;
      }
    }
  const wear = p.wear ?? 0.5;
  s.roughVary(s.noise(3, 4, 9), 0.25 * wear + 0.05);
  s.scratches(160 * wear, 0.25, [0.95, 0.93, 0.9], -0.04);
  s.grime(0.8 * wear, 3);
  s.waterStains(Math.round(3 * wear), 0.25);
};

/** Worn vinyl checkerboard tiles. */
const checker: Recipe = (s, p) => {
  const c1 = hex(p.color ?? '#e8e2d2');
  const c2 = hex(p.color2 ?? '#1f1d22');
  const tiles = p.tiles ?? 4;
  const N = N_(s);
  const ts = N / tiles;
  const groove = Math.max(1, N / 512);
  const var1 = s.noise(tiles * 3, 3, 4);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const tx = Math.floor(x / ts);
      const ty = Math.floor(y / ts);
      const i = y * N + x;
      const c = (tx + ty) % 2 === 0 ? c1 : c2;
      const tv = (new Rng(tx * 31 + ty * 7 + s.seed).next() - 0.5) * 0.08;
      s.r[i] = c[0] + tv;
      s.g[i] = c[1] + tv;
      s.b[i] = c[2] + tv;
      s.rough[i] = 0.38 + var1[i] * 0.1;
      const lx = x - tx * ts;
      const ly = y - ty * ts;
      if (lx < groove || ly < groove) {
        s.height[i] = 0.35;
        s.ao[i] = 0.6;
        s.r[i] *= 0.5;
        s.g[i] *= 0.5;
        s.b[i] *= 0.5;
      }
    }
  const wear = p.wear ?? 0.5;
  s.vary(s.noise(16, 4, 2), 0.08);
  s.scratches(220 * wear, 0.35, [0.6, 0.58, 0.55], -0.05);
  s.grime(wear, 2.5);
  s.cavityDirt(0.5);
};

/** Theatre / playroom carpet with a star and dot motif. */
const carpet: Recipe = (s, p) => {
  const base = p.color ?? '#3b2c63';
  const a1 = p.color2 ?? '#e7b54a';
  const a2 = p.color3 ?? '#3fb3a6';
  s.fill(hex(base), 0.95, 0);
  canvasPaint(s, (ctx, N) => {
    const cells = 4;
    const cs = N / cells;
    for (let j = 0; j < cells; j++)
      for (let i = 0; i < cells; i++) {
        const cx = i * cs + cs / 2;
        const cy = j * cs + cs / 2;
        if ((i + j) % 2 === 0) {
          ctx.fillStyle = a1;
          star(ctx, cx, cy, cs * 0.22, cs * 0.1, 5);
        } else {
          ctx.fillStyle = a2;
          ctx.beginPath();
          ctx.arc(cx, cy, cs * 0.13, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = a1;
          ctx.lineWidth = cs * 0.03;
          ctx.beginPath();
          ctx.arc(cx, cy, cs * 0.24, 0, Math.PI * 2);
          ctx.stroke();
        }
        // tiny dots grid
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        for (let k = 0; k < 4; k++) {
          ctx.beginPath();
          ctx.arc(i * cs + ((k % 2) + 0.0) * cs, j * cs + Math.floor(k / 2) * cs, cs * 0.04, 0, Math.PI * 2);
          ctx.fill();
        }
      }
  });
  const fibers = s.noise(s.size / 4, 2, 5);
  const fibers2 = s.noise(s.size / 8, 2, 6);
  for (let i = 0; i < s.n; i++) {
    const f = fibers[i] * 0.6 + fibers2[i] * 0.4;
    s.height[i] = 0.5 + (f - 0.5) * 0.6;
    const k = 0.85 + f * 0.3;
    s.r[i] *= k;
    s.g[i] *= k;
    s.b[i] *= k;
  }
  // matted walkway wear + stains
  s.vary(s.noise(3, 4, 7), 0.25);
  const wear = p.wear ?? 0.5;
  s.grime(wear * 0.9, 3, [0.16, 0.12, 0.1]);
  s.waterStains(Math.round(2 + 3 * wear), 0.3);
};

/** Brand wallpaper: pastel stripes + stars, peeling to plaster. */
const wallpaper: Recipe = (s, p) => {
  const base = p.color ?? '#efe3c8';
  const stripe = p.color2 ?? '#f2c6b5';
  const accent = p.color3 ?? '#5fb7ad';
  s.fill(hex(base), 0.75, 0);
  canvasPaint(s, (ctx, N) => {
    const cols = 6;
    const w = N / cols;
    for (let i = 0; i < cols; i++) {
      ctx.fillStyle = stripe;
      ctx.globalAlpha = 0.55;
      ctx.fillRect(i * w + w * 0.38, 0, w * 0.24, N);
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = accent;
      ctx.fillRect(i * w + w * 0.36, 0, w * 0.02, N);
      ctx.fillRect(i * w + w * 0.62, 0, w * 0.02, N);
    }
    ctx.globalAlpha = 0.9;
    for (let j = 0; j < 6; j++)
      for (let i = 0; i < cols; i++) {
        const cx = i * w + ((j % 2) * w) / 2 + w * 0.0;
        const cy = j * (N / 6) + N / 12;
        ctx.fillStyle = j % 2 ? accent : '#e9b64e';
        star(ctx, cx, cy, w * 0.17, w * 0.075, 5);
      }
    ctx.globalAlpha = 1;
  });
  const paper = s.noise(s.size / 3, 2, 3);
  s.vary(paper, 0.06);
  s.vary(s.noise(4, 4, 8), 0.12);
  s.addHeight(paper, 0.1);
  const wear = p.wear ?? 0.5;
  // vertical seams every 2 strips
  const N = N_(s);
  for (let y = 0; y < N; y++)
    for (const sx of [0, N / 2]) {
      const i = y * N + Math.floor(sx);
      s.height[i] -= 0.15;
      s.ao[i] = 0.7;
    }
  // peeling: reveal plaster
  if (wear > 0.2) {
    const w = s.worley(3, 41);
    const n = s.noise(10, 5, 42);
    const peel = img(N, N);
    for (let i = 0; i < s.n; i++) peel[i] = smoothstep(0.74 - wear * 0.07, 0.77 - wear * 0.07, n[i] * 0.75 + (1 - w.f1[i]) * 0.3);
    s.paint(peel, [0.78, 0.76, 0.7], 1, 0.9);
    s.vary(s.noise(30, 3, 43), 0.05);
    for (let i = 0; i < s.n; i++) s.height[i] -= peel[i] * 0.2;
    const edge = Float32Array.from(peel);
    blur(edge, N, N, 2);
    for (let i = 0; i < s.n; i++) {
      const e = clamp01((edge[i] - peel[i]) * 4);
      s.height[i] += e * 0.25;
      s.r[i] *= 1 - e * 0.25;
      s.g[i] *= 1 - e * 0.25;
      s.b[i] *= 1 - e * 0.3;
    }
  }
  s.streaks(wear, [0.42, 0.34, 0.2], 10);
  s.waterStains(Math.round(1 + 3 * wear), 0.35);
  s.grime(wear * 0.6, 2);
};

/** Painted plaster / drywall. */
const plaster: Recipe = (s, p) => {
  s.fill(hex(p.color ?? '#d9d4c8'), 0.85, 0);
  const n = s.noise(12, 5, 1);
  s.vary(n, 0.08);
  s.addHeight(s.noise(40, 3, 2), 0.15);
  s.vary(s.noise(3, 4, 3), 0.1);
  const wear = p.wear ?? 0.5;
  // hairline cracks via worley edges
  if (wear > 0.25) {
    const w = s.worley(5, 77);
    const n2 = s.noise(6, 4, 78);
    const crack = img(s.size, s.size);
    for (let i = 0; i < s.n; i++) {
      const e = w.f2[i] - w.f1[i];
      crack[i] = smoothstep(0.018, 0.0, e) * smoothstep(0.66, 0.82, n2[i]);
    }
    s.paint(crack, [0.32, 0.3, 0.27], 0.55);
    for (let i = 0; i < s.n; i++) s.height[i] -= crack[i] * 0.25;
  }
  s.chips(0.86 - wear * 0.06, [0.6, 0.58, 0.55], 0.95, 0, 501, 18);
  s.streaks(wear * 0.8, [0.38, 0.32, 0.22], 8);
  s.grime(wear * 0.7, 2.5);
  s.waterStains(Math.round(wear * 3), 0.3);
};

/** Raw cast concrete. */
const concrete: Recipe = (s, p) => {
  s.fill(hex(p.color ?? '#8d8a84'), 0.9, 0);
  s.vary(s.noise(4, 6, 1), 0.16);
  s.vary(s.noise(24, 4, 2), 0.12);
  s.tint(s.noise(3, 3, 3), [0.06, 0.04, 0.0], 1);
  const pores = s.worley(90, 5);
  const pm = img(s.size, s.size);
  for (let i = 0; i < s.n; i++) pm[i] = pores.id[i] > 0.7 ? smoothstep(0.18, 0.05, pores.f1[i]) : 0;
  s.paint(pm, [0.2, 0.19, 0.18], 0.7);
  for (let i = 0; i < s.n; i++) s.height[i] -= pm[i] * 0.3;
  s.addHeight(s.noise(30, 4, 6), 0.3);
  s.roughVary(s.noise(8, 3, 7), 0.15);
  const wear = p.wear ?? 0.5;
  s.grime(wear * 0.55, 2.5, [0.12, 0.11, 0.1]);
  s.waterStains(Math.round(wear * 3), 0.3);
  s.streaks(wear * 0.6, [0.25, 0.22, 0.18], 9);
};

/** Industrial painted floor over concrete, worn through on paths. */
const paintedFloor: Recipe = (s, p) => {
  concrete(s, { wear: 0.3 });
  const paint = hex(p.color ?? '#5e6b5c');
  const wear = p.wear ?? 0.5;
  const n = s.noise(5, 6, 11);
  const n2 = s.noise(40, 3, 12);
  const m = img(s.size, s.size);
  for (let i = 0; i < s.n; i++) m[i] = smoothstep(0.24 + wear * 0.22, 0.2 + wear * 0.22, n[i] * 0.8 + n2[i] * 0.2);
  // paint layer sits slightly above concrete
  for (let i = 0; i < s.n; i++) {
    const t = 1 - m[i];
    s.r[i] += (paint[0] - s.r[i]) * t;
    s.g[i] += (paint[1] - s.g[i]) * t;
    s.b[i] += (paint[2] - s.b[i]) * t;
    s.rough[i] += (0.5 - s.rough[i]) * t;
    s.height[i] = s.height[i] * 0.3 + 0.55 * t + 0.35 * (1 - t);
  }
  s.vary(s.noise(8, 3, 13), 0.08);
  s.scratches(260 * wear + 40, 0.3, [0.55, 0.55, 0.52], -0.06);
  s.grime(wear * 0.8, 3, [0.1, 0.09, 0.07]);
  // oil spots
  const oil = canvasMask(s.size, (ctx, N) => {
    const r = new Rng(s.seed + 99);
    for (let k = 0; k < Math.round(4 * wear); k++) {
      const x = r.range(0, N);
      const y = r.range(0, N);
      const rad = r.range(N * 0.03, N * 0.1);
      wrapDraw(N, x, y, rad, (ox, oy) => {
        const g = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rad);
        g.addColorStop(0, 'rgba(255,255,255,0.9)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(x + ox, y + oy, rad, rad * r.range(0.5, 1), r.range(0, 3), 0, Math.PI * 2);
        ctx.fill();
      });
    }
  });
  s.paint(oil, [0.05, 0.05, 0.05], 0.7, 0.2);
};

/** Mineral-fibre drop-ceiling tiles in a T-bar grid. */
const ceilingTile: Recipe = (s, p) => {
  const N = N_(s);
  s.fill(hex(p.color ?? '#d8d4c9'), 0.95, 0);
  const tiles = p.tiles ?? 2;
  const ts = N / tiles;
  const fis = s.worley(N / 10, 3);
  const fn = s.noise(N / 16, 2, 4);
  for (let i = 0; i < s.n; i++) {
    const hole = smoothstep(0.12, 0.04, fis.f1[i]) * (fis.id[i] > 0.6 ? 1 : 0);
    s.height[i] = 0.55 - hole * 0.35 + (fn[i] - 0.5) * 0.08;
    const k = 1 - hole * 0.35;
    s.r[i] *= k;
    s.g[i] *= k;
    s.b[i] *= k;
  }
  const bar = Math.max(3, Math.round(N / 90));
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const lx = x % ts;
      const ly = y % ts;
      const i = y * N + x;
      if (lx < bar || ly < bar) {
        s.r[i] = 0.82;
        s.g[i] = 0.82;
        s.b[i] = 0.8;
        s.rough[i] = 0.4;
        s.metal[i] = 0.6;
        s.height[i] = 0.8;
      } else if (lx < bar * 2 || ly < bar * 2) {
        s.ao[i] = 0.7;
      } else {
        // per-tile tint & sag
        const tx = Math.floor(x / ts);
        const ty = Math.floor(y / ts);
        const rr = new Rng(tx * 13 + ty * 71 + s.seed).next();
        const k = 0.94 + rr * 0.08;
        s.r[i] *= k;
        s.g[i] *= k;
        s.b[i] *= k * 0.99;
      }
    }
  const wear = p.wear ?? 0.5;
  s.waterStains(Math.round(1 + 4 * wear), 0.55);
  s.grime(wear * 0.4, 2);
};

/** Painted steel (doors, lockers, cabinets) with chipped edges and rust. */
const paintedMetal: Recipe = (s, p) => {
  s.fill(hex(p.color ?? '#4f6d7a'), 0.42, 0);
  s.vary(s.noise(4, 4, 1), 0.1);
  s.addHeight(s.noise(60, 2, 2), 0.06);
  s.roughVary(s.noise(10, 4, 3), 0.12);
  const wear = p.wear ?? 0.5;
  s.chips(0.86 - wear * 0.06, [0.36, 0.22, 0.14], 0.85, 0.2, 520, 26);
  s.chips(0.88 - wear * 0.05, [0.62, 0.62, 0.62], 0.35, 0.9, 530, 44);
  s.streaks(wear, [0.36, 0.2, 0.1], 12);
  s.scratches(120 * wear, 0.4, [0.7, 0.7, 0.68], -0.05);
  s.grime(wear * 0.5, 3);
};

/** Brushed stainless steel. */
const brushedMetal: Recipe = (s, p) => {
  const N = N_(s);
  s.fill(hex(p.color ?? '#a7a9ab'), 0.3, 1);
  const n = img(N, N);
  const rng = new Rng(s.seed);
  for (let y = 0; y < N; y++) {
    let v = rng.next();
    for (let x = 0; x < N; x++) {
      v = v * 0.97 + rng.next() * 0.03;
      n[y * N + x] = v;
    }
  }
  blur(n, N, N, 1);
  s.vary(n, 0.25);
  s.roughVary(n, 0.25);
  s.vary(s.noise(3, 4, 5), 0.15);
  const wear = p.wear ?? 0.4;
  s.scratches(200 * wear, 0.3, [0.85, 0.85, 0.85], -0.03);
  s.grime(wear * 0.5, 3, [0.2, 0.18, 0.15]);
  for (let i = 0; i < s.n; i++) s.metal[i] = Math.min(s.metal[i], 1 - (s.rough[i] > 0.85 ? 0.6 : 0));
};

/** Heavy rust on iron. */
const rust: Recipe = (s, p) => {
  s.fill(hex(p.color ?? '#7a3f1d'), 0.85, 0.15);
  const n = s.noise(6, 6, 1);
  const n2 = s.noise(30, 4, 2);
  const dark: RGB = [0.22, 0.12, 0.07];
  const orange: RGB = [0.66, 0.33, 0.12];
  for (let i = 0; i < s.n; i++) {
    const t = n[i] * 0.7 + n2[i] * 0.3;
    const c = mixRGB(dark, orange, smoothstep(0.25, 0.8, t));
    s.r[i] = c[0];
    s.g[i] = c[1];
    s.b[i] = c[2];
    s.height[i] = t;
    s.rough[i] = 0.75 + (1 - t) * 0.2;
  }
  const pits = s.worley(40, 9);
  for (let i = 0; i < s.n; i++) {
    const pit = smoothstep(0.2, 0.05, pits.f1[i]) * (pits.id[i] > 0.5 ? 1 : 0);
    s.height[i] -= pit * 0.3;
  }
  s.cavityDirt(0.4, [0.12, 0.06, 0.03]);
  // remnants of paint
  if (p.color2) {
    const m = s.noise(5, 5, 12);
    const mask = img(s.size, s.size);
    for (let i = 0; i < s.n; i++) mask[i] = smoothstep(0.55, 0.6, m[i]);
    s.paint(mask, hex(p.color2), 0.95, 0.5, 0);
    for (let i = 0; i < s.n; i++) s.height[i] += mask[i] * 0.15;
  }
};

/** Diamond tread plate. */
const diamondPlate: Recipe = (s, p) => {
  brushedMetal(s, { wear: 0.2, color: p.color ?? '#8d9194' });
  const m = canvasMask(s.size, (ctx, N) => {
    const cells = 8;
    const cs = N / cells;
    for (let j = 0; j <= cells; j++)
      for (let i = 0; i <= cells; i++) {
        const cx = i * cs + ((j % 2) * cs) / 2;
        const cy = j * cs;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(j % 2 ? 0.8 : -0.8);
        const g = ctx.createLinearGradient(-cs * 0.32, 0, cs * 0.32, 0);
        g.addColorStop(0, 'rgba(255,255,255,0.4)');
        g.addColorStop(0.5, 'rgba(255,255,255,1)');
        g.addColorStop(1, 'rgba(255,255,255,0.4)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(0, 0, cs * 0.34, cs * 0.07, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
  });
  s.setHeightWhere(m, 0.95);
  s.cavityDirt(0.6);
  s.grime((p.wear ?? 0.5) * 0.8, 3, [0.14, 0.11, 0.08]);
  const rustMask = s.noise(4, 5, 77);
  for (let i = 0; i < s.n; i++) rustMask[i] = smoothstep(0.7 - (p.wear ?? 0.5) * 0.2, 0.85, rustMask[i]) * (1 - m[i] * 0.5);
  s.paint(rustMask, [0.45, 0.22, 0.1], 0.8, 0.85, 0.2);
};

/** Wood veneer panels / planks with grain. */
const wood: Recipe = (s, p) => {
  const N = N_(s);
  const base = hex(p.color ?? '#7a4e2d');
  const planks = p.tiles ?? 4;
  const ph = N / planks;
  const grainN = s.noise(6, 4, 3);
  for (let y = 0; y < N; y++) {
    const pi = Math.floor(y / ph);
    const r = new Rng(pi * 97 + s.seed);
    const tone = r.range(0.85, 1.12);
    const off = r.range(0, 1000);
    const freq = r.range(18, 34);
    for (let x = 0; x < N; x++) {
      const i = y * N + x;
      const gy = (y - pi * ph) / ph;
      const g = grainN[i];
      const rings = Math.sin((gy * freq + g * 6 + Math.sin((x + off) / N * Math.PI * 2 * 2) * 0.8) * Math.PI);
      const fine = (Math.sin(x * 0.9 + g * 40 + off) * 0.5 + 0.5) * 0.15;
      const t = rings * 0.5 + 0.5;
      const k = tone * (0.78 + t * 0.22 - fine * 0.3);
      s.r[i] = base[0] * k;
      s.g[i] = base[1] * k;
      s.b[i] = base[2] * k;
      s.height[i] = 0.5 + t * 0.06;
      s.rough[i] = 0.45 + (1 - t) * 0.12;
      if (y - pi * ph < Math.max(1, N / 400)) {
        s.height[i] = 0.2;
        s.ao[i] = 0.55;
        s.r[i] *= 0.45;
        s.g[i] *= 0.45;
        s.b[i] *= 0.45;
      }
    }
  }
  const wear = p.wear ?? 0.4;
  s.scratches(140 * wear, 0.35, [0.85, 0.7, 0.5], -0.05);
  s.grime(wear * 0.6, 3, [0.15, 0.1, 0.06]);
  s.waterStains(Math.round(wear * 2), 0.25);
};

/** Ceramic tiles with grout. color2 = alternate (random) tile colour list via color3 */
const ceramic: Recipe = (s, p) => {
  const N = N_(s);
  const tiles = p.tiles ?? 8;
  const ts = N / tiles;
  const grout = Math.max(2, Math.round(N / 256));
  const base = hex(p.color ?? '#e9e8e1');
  const alts = [p.color2, p.color3].filter(Boolean).map((c) => hex(c!));
  const n = s.noise(tiles * 2, 3, 5);
  const wear = p.wear ?? 0.5;
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const tx = Math.floor(x / ts);
      const ty = Math.floor(y / ts);
      const lx = x - tx * ts;
      const ly = y - ty * ts;
      const i = y * N + x;
      const rr = new Rng(tx * 7919 + ty * 104729 + s.seed);
      const pickAlt = alts.length && rr.next() < 0.5;
      const c = pickAlt ? alts[Math.floor(rr.next() * alts.length)] : base;
      const tv = rr.range(-0.04, 0.04);
      if (lx < grout || ly < grout) {
        s.r[i] = 0.55 - wear * 0.25;
        s.g[i] = 0.53 - wear * 0.25;
        s.b[i] = 0.48 - wear * 0.25;
        s.rough[i] = 0.92;
        s.height[i] = 0.25;
        s.ao[i] = 0.7;
      } else {
        // bevelled tile edge
        const e = Math.min(lx - grout, ly - grout, ts - lx, ts - ly);
        const bev = smoothstep(0, ts * 0.06, e);
        s.r[i] = c[0] + tv;
        s.g[i] = c[1] + tv;
        s.b[i] = c[2] + tv;
        s.rough[i] = 0.12 + n[i] * 0.12;
        s.height[i] = 0.45 + bev * 0.3;
      }
    }
  // cracked tiles
  const crack = canvasMask(N, (ctx) => {
    const r = new Rng(s.seed + 5);
    ctx.lineWidth = Math.max(1, N / 700);
    for (let k = 0; k < Math.round(wear * 5); k++) {
      let x = r.range(0, N);
      let y = r.range(0, N);
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let j = 0; j < 6; j++) {
        x += r.range(-N * 0.04, N * 0.04);
        y += r.range(-N * 0.04, N * 0.04);
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  });
  s.paint(crack, [0.2, 0.19, 0.17], 0.8, 0.9);
  for (let i = 0; i < s.n; i++) s.height[i] -= crack[i] * 0.2;
  s.grime(wear * 0.32, 3);
  s.streaks(wear * 0.5, [0.4, 0.33, 0.2], 6);
};

/** Interlocking foam / rubber play mats in bright colours. */
const playMat: Recipe = (s, p) => {
  const N = N_(s);
  const pal = [p.color ?? '#e05d5d', p.color2 ?? '#4fb3d9', p.color3 ?? '#f2c14e', '#7dcf6f'].map(hex);
  const tiles = p.tiles ?? 2;
  const ts = N / tiles;
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const tx = Math.floor(x / ts);
      const ty = Math.floor(y / ts);
      const i = y * N + x;
      // jigsaw teeth along edges
      const lx = x - tx * ts;
      const ly = y - ty * ts;
      const tooth = ts / 6;
      let ox = tx;
      let oy = ty;
      if (lx < tooth * 0.5 && Math.floor(ly / tooth) % 2 === 0) ox = tx - 1;
      if (ly < tooth * 0.5 && Math.floor(lx / tooth) % 2 === 1) oy = ty - 1;
      const c = pal[(((ox + oy * 3) % pal.length) + pal.length) % pal.length];
      s.r[i] = c[0];
      s.g[i] = c[1];
      s.b[i] = c[2];
      s.rough[i] = 0.82;
      const seam = lx < 1.5 || ly < 1.5;
      s.height[i] = seam ? 0.3 : 0.55;
      if (seam) s.ao[i] = 0.6;
    }
  const bumps = s.worley(N / 12, 3);
  for (let i = 0; i < s.n; i++) s.height[i] += smoothstep(0.35, 0.15, bumps.f1[i]) * 0.06;
  s.vary(s.noise(6, 4, 4), 0.12);
  const wear = p.wear ?? 0.5;
  s.grime(wear * 0.8, 3);
  s.scratches(60 * wear, 0.2, [0.9, 0.9, 0.9], -0.08);
};

/** Glossy moulded toy plastic. */
const plastic: Recipe = (s, p) => {
  s.fill(hex(p.color ?? '#f2c94c'), 0.32, 0);
  s.vary(s.noise(3, 4, 1), 0.06);
  s.addHeight(s.noise(80, 2, 2), 0.04);
  const wear = p.wear ?? 0.3;
  s.scratches(80 * wear, 0.25, [1, 1, 1], -0.03);
  s.grime(wear * 0.6, 2.5, [0.2, 0.17, 0.13]);
};

/** Velvet / heavy fabric. */
const fabric: Recipe = (s, p) => {
  const N = N_(s);
  s.fill(hex(p.color ?? '#7a1f2b'), 1, 0);
  const weaveX = img(N, N);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const a = Math.sin((x / N) * Math.PI * 2 * (N / 4));
      const b = Math.sin((y / N) * Math.PI * 2 * (N / 4));
      weaveX[y * N + x] = (a * b) * 0.5 + 0.5;
    }
  s.addHeight(weaveX, 0.1);
  s.vary(s.noise(16, 4, 3), 0.18);
  s.vary(s.noise(3, 3, 4), 0.2);
  s.grime((p.wear ?? 0.5) * 0.5, 2, [0.15, 0.1, 0.08]);
};

/** Old brick with mortar, soot and efflorescence. */
const brick: Recipe = (s, p) => {
  const N = N_(s);
  const rows = p.tiles ?? 8;
  const bh = N / rows;
  const bw = bh * 2.1;
  const mortar = Math.max(2, Math.round(N / 160));
  const base = hex(p.color ?? '#8a4b36');
  const n = s.noise(N / 16, 3, 3);
  for (let y = 0; y < N; y++) {
    const row = Math.floor(y / bh);
    const off = (row % 2) * bw * 0.5;
    for (let x = 0; x < N; x++) {
      const col = Math.floor((x + off) / bw);
      const lx = (x + off) % bw;
      const ly = y - row * bh;
      const i = y * N + x;
      const rr = new Rng(row * 977 + ((col % 64) + 64) * 13 + s.seed);
      const tone = rr.range(0.75, 1.15);
      if (lx < mortar || ly < mortar) {
        s.r[i] = 0.55;
        s.g[i] = 0.52;
        s.b[i] = 0.47;
        s.height[i] = 0.25 + n[i] * 0.1;
        s.rough[i] = 0.95;
      } else {
        const e = Math.min(lx - mortar, ly - mortar, bw - lx, bh - ly);
        s.r[i] = base[0] * tone;
        s.g[i] = base[1] * tone;
        s.b[i] = base[2] * tone;
        s.height[i] = 0.5 + smoothstep(0, bh * 0.15, e) * 0.2 + (n[i] - 0.5) * 0.15;
        s.rough[i] = 0.85;
      }
    }
  }
  s.vary(s.noise(20, 4, 5), 0.2);
  const wear = p.wear ?? 0.6;
  s.cavityDirt(0.5);
  // soot from the top, efflorescence from the bottom
  const salt = s.noise(6, 5, 9);
  const m = img(N, N);
  for (let i = 0; i < s.n; i++) m[i] = smoothstep(0.6, 0.85, salt[i]) * wear;
  s.paint(m, [0.85, 0.84, 0.8], 0.6, 0.95);
  s.grime(wear, 2, [0.07, 0.06, 0.05]);
  s.streaks(wear, [0.15, 0.12, 0.1], 10);
};

/** Speckled hospital linoleum in sheets. */
const linoleum: Recipe = (s, p) => {
  const N = N_(s);
  s.fill(hex(p.color ?? '#9fb3a2'), 0.35, 0);
  const sp = s.worley(N / 5, 3);
  for (let i = 0; i < s.n; i++) {
    const d = smoothstep(0.25, 0.1, sp.f1[i]);
    const c = sp.id[i] > 0.5 ? 0.75 : 1.2;
    const k = 1 + (c - 1) * d * 0.5;
    s.r[i] *= k;
    s.g[i] *= k;
    s.b[i] *= k;
  }
  s.vary(s.noise(5, 5, 4), 0.12);
  for (let y = 0; y < N; y++) {
    const i = y * N;
    s.height[i] = 0.2;
    s.ao[i] = 0.6;
  }
  const wear = p.wear ?? 0.5;
  s.roughVary(s.noise(4, 4, 6), 0.3 * wear);
  s.scratches(180 * wear, 0.25, [0.4, 0.4, 0.38], -0.04);
  s.grime(wear * 0.7, 3);
};

/** Quilted padded wall. */
const padded: Recipe = (s, p) => {
  const N = N_(s);
  s.fill(hex(p.color ?? '#e6dcc9'), 0.75, 0);
  const cells = p.tiles ?? 4;
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const u = (x / N) * cells;
      const v = (y / N) * cells;
      const a = u + v;
      const b = u - v;
      const fa = Math.abs(a - Math.round(a));
      const fb = Math.abs(b - Math.round(b));
      const e = Math.min(fa, fb);
      const pillow = smoothstep(0, 0.35, e);
      const i = y * N + x;
      s.height[i] = 0.2 + pillow * 0.75;
      s.ao[i] = 0.55 + pillow * 0.45;
      // buttons at intersections
      const bu = Math.hypot(fa, fb);
      if (bu < 0.06) {
        s.height[i] = 0.35;
        s.r[i] *= 0.6;
        s.g[i] *= 0.6;
        s.b[i] *= 0.6;
      }
    }
  s.vary(s.noise(30, 3, 3), 0.06);
  s.addHeight(s.noise(60, 2, 4), 0.05);
  const wear = p.wear ?? 0.5;
  s.grime(wear, 2.5, [0.3, 0.25, 0.17]);
  s.waterStains(Math.round(wear * 3), 0.4);
};

/** Corrugated cardboard. */
const cardboard: Recipe = (s, p) => {
  const N = N_(s);
  s.fill(hex(p.color ?? '#b08a5a'), 0.9, 0);
  s.vary(s.noise(N / 6, 2, 2), 0.1);
  s.vary(s.noise(4, 4, 3), 0.12);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const i = y * N + x;
      s.height[i] = 0.5 + Math.sin((x / N) * Math.PI * 2 * 48) * 0.04;
    }
  // packing tape band
  canvasPaint(s, (ctx, Nn) => {
    ctx.fillStyle = 'rgba(205,170,110,0.75)';
    ctx.fillRect(0, Nn * 0.44, Nn, Nn * 0.12);
  });
  s.grime((p.wear ?? 0.5) * 0.7, 3);
  s.waterStains(2, 0.35);
};

/** Metal grating with real alpha cut-outs. */
const grate: Recipe = (s, p) => {
  const N = N_(s);
  brushedMetal(s, { color: p.color ?? '#5c6064', wear: 0.6 });
  const holes = p.tiles ?? 16;
  const hs = N / holes;
  const bar = hs * 0.22;
  s.alpha = img(N, N, 1);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const lx = x % hs;
      const ly = y % hs;
      const i = y * N + x;
      const solid = lx < bar || ly < bar;
      s.alpha[i] = solid ? 1 : 0;
      if (solid) s.height[i] = 0.5 + Math.min(lx, ly) / bar * 0.2;
    }
  const r = s.noise(4, 5, 66);
  for (let i = 0; i < s.n; i++) r[i] = smoothstep(0.55, 0.8, r[i]);
  s.paint(r, [0.42, 0.22, 0.1], 0.8, 0.85, 0.2);
};

/** Rough hewn stone blocks (old works). */
const stone: Recipe = (s, p) => {
  const N = N_(s);
  s.fill(hex(p.color ?? '#6d6a62'), 0.9, 0);
  const w = s.worley(p.tiles ?? 5, 1);
  const n = s.noise(10, 5, 2);
  for (let i = 0; i < s.n; i++) {
    const e = w.f2[i] - w.f1[i];
    const joint = smoothstep(0.08, 0.02, e);
    s.height[i] = 0.6 - joint * 0.5 + (n[i] - 0.5) * 0.3;
    const tone = 0.8 + w.id[i] * 0.35;
    s.r[i] *= tone * (1 - joint * 0.5);
    s.g[i] *= tone * (1 - joint * 0.5);
    s.b[i] *= tone * (1 - joint * 0.45);
  }
  s.vary(s.noise(30, 3, 4), 0.15);
  s.cavityDirt(0.5);
  const wear = p.wear ?? 0.7;
  // green-black damp
  s.grime(wear, 2, [0.08, 0.1, 0.07]);
  s.streaks(wear, [0.12, 0.13, 0.1], 12);
  void N;
};

/** Blank coloured surface with subtle noise – used for screens, labels, paint. */
const flat: Recipe = (s, p) => {
  s.fill(hex(p.color ?? '#888888'), 0.6, 0);
  s.vary(s.noise(6, 4, 1), 0.04);
  s.addHeight(s.noise(40, 2, 2), 0.03);
  if (p.wear) s.grime(p.wear * 0.5, 3);
};

/** Rubber (tyres, conveyor belts, gaskets). */
const rubber: Recipe = (s, p) => {
  const N = N_(s);
  s.fill(hex(p.color ?? '#1c1c1e'), 0.85, 0);
  s.vary(s.noise(N / 8, 2, 1), 0.15);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const i = y * N + x;
      const rib = Math.sin((y / N) * Math.PI * 2 * 24);
      s.height[i] = 0.5 + rib * 0.15;
    }
  s.grime((p.wear ?? 0.5) * 0.5, 3, [0.3, 0.28, 0.25]);
};

/** Glass: base tint only, transparency handled by the material. */
const glass: Recipe = (s, p) => {
  s.fill(hex(p.color ?? '#9fb8bd'), 0.06, 0);
  const wear = p.wear ?? 0.5;
  const smudge = s.noise(5, 5, 1);
  for (let i = 0; i < s.n; i++) s.rough[i] = 0.05 + smoothstep(0.5, 0.9, smudge[i]) * 0.5 * wear;
  s.grime(wear * 0.5, 3, [0.4, 0.38, 0.33]);
  s.scratches(60 * wear, 0.1, [1, 1, 1], -0.01);
};

export const RECIPES: Record<string, Recipe> = {
  terrazzo,
  checker,
  carpet,
  wallpaper,
  plaster,
  concrete,
  paintedFloor,
  ceilingTile,
  paintedMetal,
  brushedMetal,
  rust,
  diamondPlate,
  wood,
  ceramic,
  playMat,
  plastic,
  fabric,
  brick,
  linoleum,
  padded,
  cardboard,
  grate,
  stone,
  flat,
  rubber,
  glass,
};

// ---------------------------------------------------------------------------

export function star(ctx: CanvasRenderingContext2D, cx: number, cy: number, r1: number, r2: number, n: number): void {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? r2 : r1;
    const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}
