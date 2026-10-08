/**
 * Procedural sound effect synthesis. Every SFX in the game is generated here
 * from oscillators, filtered noise and envelopes — no sample files.
 * Generators write mono/stereo Float32Arrays which are wrapped as AudioBuffers.
 */
import { Rng } from '../assets/noise';

export type Gen = (sr: number, rng: Rng) => Float32Array | [Float32Array, Float32Array];

const TAU = Math.PI * 2;

// ---------------------------------------------------------------- primitives

class OnePole {
  private z = 0;
  constructor(private a: number) {}
  static lp(cut: number, sr: number): OnePole {
    return new OnePole(Math.exp((-TAU * cut) / sr));
  }
  set(cut: number, sr: number): void {
    this.a = Math.exp((-TAU * cut) / sr);
  }
  lp(x: number): number {
    this.z = x * (1 - this.a) + this.z * this.a;
    return this.z;
  }
  hp(x: number): number {
    return x - this.lp(x);
  }
}

/** RBJ biquad, enough for band-pass resonances and formants. */
export class Biquad {
  b0 = 1;
  b1 = 0;
  b2 = 0;
  a1 = 0;
  a2 = 0;
  private x1 = 0;
  private x2 = 0;
  private y1 = 0;
  private y2 = 0;
  constructor(
    public type: 'bp' | 'lp' | 'hp' | 'peak',
    freq: number,
    q: number,
    public sr: number,
    gain = 0,
  ) {
    this.set(freq, q, gain);
  }
  set(freq: number, q: number, gainDb = 0): void {
    const w = (TAU * Math.min(freq, this.sr * 0.45)) / this.sr;
    const cs = Math.cos(w);
    const sn = Math.sin(w);
    const alpha = sn / (2 * q);
    let b0: number, b1: number, b2: number, a0: number, a1: number, a2: number;
    if (this.type === 'bp') {
      b0 = alpha;
      b1 = 0;
      b2 = -alpha;
      a0 = 1 + alpha;
      a1 = -2 * cs;
      a2 = 1 - alpha;
    } else if (this.type === 'lp') {
      b0 = (1 - cs) / 2;
      b1 = 1 - cs;
      b2 = (1 - cs) / 2;
      a0 = 1 + alpha;
      a1 = -2 * cs;
      a2 = 1 - alpha;
    } else if (this.type === 'hp') {
      b0 = (1 + cs) / 2;
      b1 = -(1 + cs);
      b2 = (1 + cs) / 2;
      a0 = 1 + alpha;
      a1 = -2 * cs;
      a2 = 1 - alpha;
    } else {
      const A = Math.pow(10, gainDb / 40);
      b0 = 1 + alpha * A;
      b1 = -2 * cs;
      b2 = 1 - alpha * A;
      a0 = 1 + alpha / A;
      a1 = -2 * cs;
      a2 = 1 - alpha / A;
    }
    this.b0 = b0 / a0;
    this.b1 = b1 / a0;
    this.b2 = b2 / a0;
    this.a1 = a1 / a0;
    this.a2 = a2 / a0;
  }
  run(x: number): number {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1;
    this.x1 = x;
    this.y2 = this.y1;
    this.y1 = y;
    return y;
  }
}

function buf(sr: number, sec: number): Float32Array {
  return new Float32Array(Math.max(1, Math.floor(sr * sec)));
}

function env(t: number, a: number, d: number): number {
  if (t < 0) return 0;
  if (t < a) return t / a;
  return Math.exp(-(t - a) / d);
}

function normalize(b: Float32Array, peak = 0.9): Float32Array {
  let m = 0;
  for (let i = 0; i < b.length; i++) m = Math.max(m, Math.abs(b[i]));
  if (m > 0) {
    const k = peak / m;
    for (let i = 0; i < b.length; i++) b[i] *= k;
  }
  return b;
}

/** Short fades at both ends to avoid clicks (and make loops seamless-ish). */
function edgeFade(b: Float32Array, sr: number, ms = 4): Float32Array {
  const n = Math.min(b.length >> 1, Math.floor((sr * ms) / 1000));
  for (let i = 0; i < n; i++) {
    const k = i / n;
    b[i] *= k;
    b[b.length - 1 - i] *= k;
  }
  return b;
}

/** Makes a loop seamless by crossfading the tail into the head. */
function loopify(b: Float32Array, sr: number, fadeSec = 0.25): Float32Array {
  const n = Math.floor(sr * fadeSec);
  const out = new Float32Array(b.length - n);
  for (let i = 0; i < out.length; i++) out[i] = b[i];
  for (let i = 0; i < n; i++) {
    const k = i / n;
    out[i] = b[i] * k + b[out.length + i] * (1 - k);
  }
  return out;
}

function noiseBurst(sr: number, rng: Rng, sec: number, cut: number, q: number, decay: number, attack = 0.002): Float32Array {
  const b = buf(sr, sec);
  const f = new Biquad('bp', cut, q, sr);
  for (let i = 0; i < b.length; i++) {
    const t = i / sr;
    b[i] = f.run(rng.next() * 2 - 1) * env(t, attack, decay);
  }
  return b;
}

function mixInto(dst: Float32Array, src: Float32Array, gain = 1, offset = 0): void {
  for (let i = 0; i < src.length && i + offset < dst.length; i++) dst[i + offset] += src[i] * gain;
}

function thump(sr: number, f0: number, f1: number, sec: number, decay: number): Float32Array {
  const b = buf(sr, sec);
  let ph = 0;
  for (let i = 0; i < b.length; i++) {
    const t = i / sr;
    const f = f1 + (f0 - f1) * Math.exp(-t * 30);
    ph += (TAU * f) / sr;
    b[i] = Math.sin(ph) * env(t, 0.002, decay);
  }
  return b;
}

/** Inharmonic metallic ring (modal synthesis). */
function metalRing(sr: number, rng: Rng, base: number, sec: number, decay: number, partials = 7): Float32Array {
  const b = buf(sr, sec);
  const ratios = [1, 2.32, 3.86, 5.1, 6.7, 8.9, 11.3, 13.7];
  for (let p = 0; p < partials; p++) {
    const f = base * ratios[p] * rng.range(0.97, 1.03);
    const amp = 1 / (p + 1);
    const d = decay / (1 + p * 0.35);
    const ph0 = rng.range(0, TAU);
    for (let i = 0; i < b.length; i++) {
      const t = i / sr;
      b[i] += Math.sin(ph0 + TAU * f * t) * amp * Math.exp(-t / d);
    }
  }
  return b;
}

function crackle(sr: number, rng: Rng, sec: number, density: number): Float32Array {
  const b = buf(sr, sec);
  for (let i = 0; i < b.length; i++) {
    if (rng.next() < density / sr) {
      const len = Math.floor(sr * rng.range(0.0005, 0.004));
      const a = rng.range(0.3, 1);
      for (let k = 0; k < len && i + k < b.length; k++) b[i + k] += (rng.next() * 2 - 1) * a * (1 - k / len);
    }
  }
  return b;
}

// ---------------------------------------------------------------- footsteps

function footstep(kind: string): Gen {
  return (sr, rng) => {
    const b = buf(sr, kind === 'metal' ? 0.45 : kind === 'water' ? 0.5 : 0.25);
    const heel = rng.range(0.85, 1.15);
    switch (kind) {
      case 'concrete':
        mixInto(b, thump(sr, 120 * heel, 55, 0.1, 0.025), 0.6);
        mixInto(b, noiseBurst(sr, rng, 0.12, 1700 * heel, 0.9, 0.022), 0.9);
        mixInto(b, noiseBurst(sr, rng, 0.08, 4200, 1.5, 0.01), 0.25, Math.floor(sr * 0.035));
        break;
      case 'tile':
        mixInto(b, thump(sr, 160 * heel, 70, 0.08, 0.02), 0.5);
        mixInto(b, noiseBurst(sr, rng, 0.08, 3200 * heel, 2.5, 0.012), 1);
        mixInto(b, metalRing(sr, rng, 1900 * heel, 0.1, 0.012, 3), 0.15);
        break;
      case 'carpet':
        mixInto(b, thump(sr, 90 * heel, 45, 0.12, 0.03), 0.8);
        mixInto(b, noiseBurst(sr, rng, 0.15, 500 * heel, 0.7, 0.04, 0.01), 0.7);
        break;
      case 'wood':
        mixInto(b, thump(sr, 180 * heel, 95, 0.15, 0.04), 0.7);
        mixInto(b, noiseBurst(sr, rng, 0.1, 900 * heel, 1.2, 0.02), 0.6);
        mixInto(b, noiseBurst(sr, rng, 0.2, 320, 6, 0.06), 0.4);
        break;
      case 'metal':
        mixInto(b, thump(sr, 140 * heel, 60, 0.1, 0.02), 0.6);
        mixInto(b, noiseBurst(sr, rng, 0.06, 2500, 1, 0.01), 0.5);
        mixInto(b, metalRing(sr, rng, 310 * heel, 0.45, 0.12, 6), 0.35);
        break;
      case 'water': {
        mixInto(b, thump(sr, 90, 50, 0.1, 0.03), 0.4);
        const lp = new Biquad('lp', 2000, 0.7, sr);
        for (let i = 0; i < b.length; i++) {
          const t = i / sr;
          lp.set(400 + 3000 * Math.exp(-t * 12), 0.8);
          b[i] += lp.run(rng.next() * 2 - 1) * env(t, 0.01, 0.09) * 0.9;
        }
        for (let k = 0; k < 3; k++) mixInto(b, dropChirp(sr, rng.range(600, 1400), 0.05), 0.2, Math.floor(sr * rng.range(0.05, 0.25)));
        break;
      }
      case 'plastic':
        mixInto(b, thump(sr, 110 * heel, 60, 0.1, 0.025), 0.7);
        mixInto(b, noiseBurst(sr, rng, 0.1, 1200 * heel, 1.6, 0.018), 0.6);
        mixInto(b, noiseBurst(sr, rng, 0.06, 2600, 5, 0.012), 0.25);
        break;
      case 'grate':
        mixInto(b, thump(sr, 130 * heel, 60, 0.1, 0.02), 0.5);
        mixInto(b, metalRing(sr, rng, 520 * heel, 0.3, 0.06, 5), 0.3);
        mixInto(b, crackle(sr, rng, 0.15, 300), 0.15);
        break;
      default:
        mixInto(b, noiseBurst(sr, rng, 0.1, 1500, 1, 0.02), 1);
    }
    return edgeFade(normalize(b, 0.8), sr);
  };
}

function dropChirp(sr: number, f: number, sec: number): Float32Array {
  const b = buf(sr, sec);
  let ph = 0;
  for (let i = 0; i < b.length; i++) {
    const t = i / sr;
    ph += (TAU * f * (1 + t * 14)) / sr;
    b[i] = Math.sin(ph) * env(t, 0.001, sec / 4);
  }
  return b;
}

// ---------------------------------------------------------------- library

export const SFX: Record<string, Gen> = {
  step_concrete: footstep('concrete'),
  step_tile: footstep('tile'),
  step_carpet: footstep('carpet'),
  step_wood: footstep('wood'),
  step_metal: footstep('metal'),
  step_water: footstep('water'),
  step_plastic: footstep('plastic'),
  step_grate: footstep('grate'),

  // bare, heavy feet: a low thud and a wet slap
  step_flesh: (sr, rng) => {
    const b = buf(sr, 0.32);
    const k = rng.range(0.85, 1.15);
    mixInto(b, thump(sr, 85 * k, 38, 0.16, 0.05), 1);
    mixInto(b, noiseBurst(sr, rng, 0.07, 1100 * k, 1.4, 0.012), 0.75);
    mixInto(b, noiseBurst(sr, rng, 0.05, 2600, 2.2, 0.006), 0.3, Math.floor(sr * 0.012));
    return edgeFade(normalize(b, 0.85), sr);
  },
  // a rubber ball landing
  bounce_rubber: (sr, rng) => {
    const b = buf(sr, 0.22);
    const k = rng.range(0.9, 1.1);
    mixInto(b, thump(sr, 150 * k, 70, 0.12, 0.035), 1);
    mixInto(b, noiseBurst(sr, rng, 0.05, 700 * k, 1.1, 0.01), 0.35);
    return edgeFade(normalize(b, 0.8), sr);
  },

  land: (sr, rng) => {
    const b = buf(sr, 0.4);
    mixInto(b, thump(sr, 90, 40, 0.3, 0.08), 1);
    mixInto(b, noiseBurst(sr, rng, 0.2, 900, 0.8, 0.05), 0.6);
    return normalize(b, 0.9);
  },

  door_creak: (sr, rng) => {
    const b = buf(sr, 1.4);
    const f1 = new Biquad('bp', 900, 6, sr);
    const f2 = new Biquad('bp', 2100, 8, sr);
    let ph = 0;
    for (let i = 0; i < b.length; i++) {
      const t = i / sr;
      const f = 180 + 140 * Math.sin(t * 2.3) + 60 * Math.sin(t * 7.1 + 1) + rng.range(-8, 8);
      ph += (TAU * f) / sr;
      // stick-slip pulses
      const saw = (ph / TAU) % 1;
      const x = (saw < 0.08 ? 1 : 0) - 0.08;
      const a = Math.sin((Math.PI * t) / 1.4) ** 0.7;
      b[i] = (f1.run(x) + f2.run(x) * 0.6) * a;
    }
    mixInto(b, noiseBurst(sr, rng, 0.05, 3000, 3, 0.006), 0.4);
    return edgeFade(normalize(b, 0.7), sr, 20);
  },

  door_open: (sr, rng) => {
    const b = buf(sr, 0.6);
    mixInto(b, noiseBurst(sr, rng, 0.04, 2800, 4, 0.005), 0.8); // latch
    mixInto(b, noiseBurst(sr, rng, 0.05, 1800, 4, 0.006), 0.6, Math.floor(sr * 0.06));
    const w = noiseBurst(sr, rng, 0.5, 400, 0.6, 0.18, 0.08);
    mixInto(b, w, 0.35, Math.floor(sr * 0.08));
    return normalize(b, 0.7);
  },

  door_close: (sr, rng) => {
    const b = buf(sr, 0.6);
    mixInto(b, thump(sr, 110, 50, 0.4, 0.07), 0.9);
    mixInto(b, noiseBurst(sr, rng, 0.2, 700, 0.8, 0.04), 0.6);
    mixInto(b, noiseBurst(sr, rng, 0.05, 2600, 4, 0.006), 0.6, Math.floor(sr * 0.04));
    return normalize(b, 0.85);
  },

  metal_door_open: (sr, rng) => {
    const b = buf(sr, 1.6);
    mixInto(b, noiseBurst(sr, rng, 0.06, 2000, 3, 0.01), 0.7);
    // grinding hinge
    const f = new Biquad('bp', 600, 4, sr);
    for (let i = 0; i < b.length; i++) {
      const t = i / sr;
      const g = (rng.next() * 2 - 1) * (0.6 + 0.4 * Math.sin(t * 40));
      b[i] += f.run(g) * env(t - 0.1, 0.2, 0.6) * 0.8;
    }
    mixInto(b, metalRing(sr, rng, 180, 1.2, 0.4, 6), 0.25, Math.floor(sr * 0.05));
    return normalize(b, 0.75);
  },

  metal_slam: (sr, rng) => {
    const b = buf(sr, 2.2);
    mixInto(b, thump(sr, 80, 35, 0.8, 0.18), 1);
    mixInto(b, noiseBurst(sr, rng, 0.4, 900, 0.6, 0.08), 0.7);
    mixInto(b, metalRing(sr, rng, 95, 2.2, 0.7, 8), 0.5);
    return normalize(b, 0.95);
  },

  shutter: (sr, rng) => {
    const b = buf(sr, 2.6);
    for (let i = 0; i < b.length; i++) {
      const t = i / sr;
      const rat = Math.sin(t * TAU * 22) > 0.85 ? 1 : 0.15;
      b[i] = (rng.next() * 2 - 1) * rat * env(t, 0.1, 1.6) * 0.5;
    }
    mixInto(b, metalRing(sr, rng, 140, 2.6, 0.6, 5), 0.25);
    mixInto(b, thump(sr, 90, 40, 0.5, 0.1), 0.8, Math.floor(sr * 2.0));
    return normalize(b, 0.8);
  },

  switch: (sr, rng) => {
    const b = buf(sr, 0.12);
    mixInto(b, noiseBurst(sr, rng, 0.03, 3500, 3, 0.003), 1);
    mixInto(b, noiseBurst(sr, rng, 0.03, 1800, 3, 0.004), 0.7, Math.floor(sr * 0.012));
    return normalize(b, 0.6);
  },

  breaker_on: (sr, rng) => {
    const b = buf(sr, 1.4);
    mixInto(b, thump(sr, 150, 60, 0.2, 0.04), 0.9);
    mixInto(b, noiseBurst(sr, rng, 0.08, 2200, 2, 0.01), 0.9);
    // power-up hum swell
    for (let i = 0; i < b.length; i++) {
      const t = i / sr;
      const a = env(t - 0.1, 0.25, 0.8) * 0.25;
      b[i] += (Math.sin(TAU * 100 * t) + 0.5 * Math.sin(TAU * 200 * t) + 0.25 * Math.sin(TAU * 300 * t)) * a;
    }
    return normalize(b, 0.85);
  },

  breaker_trip: (sr, rng) => {
    const b = buf(sr, 1.2);
    mixInto(b, crackle(sr, rng, 0.7, 900), 0.8);
    mixInto(b, noiseBurst(sr, rng, 0.3, 4000, 0.7, 0.05), 0.6);
    mixInto(b, thump(sr, 160, 50, 0.3, 0.05), 0.8, Math.floor(sr * 0.55));
    for (let i = 0; i < b.length; i++) {
      const t = i / sr;
      b[i] += Math.sin(TAU * 100 * t) * Math.exp(-t * 4) * 0.2 * (t < 0.5 ? 1 : 0);
    }
    return normalize(b, 0.9);
  },

  spark: (sr, rng) => normalize(edgeFade(crackle(sr, rng, 0.5, 1400), sr), 0.7),

  pickup: (sr, rng) => {
    const b = buf(sr, 0.5);
    mixInto(b, noiseBurst(sr, rng, 0.15, 1400, 0.8, 0.04, 0.01), 0.5);
    for (const [f, d] of [
      [1318, 0],
      [1976, 0.06],
    ] as const) {
      const s = buf(sr, 0.4);
      for (let i = 0; i < s.length; i++) {
        const t = i / sr;
        s[i] = (Math.sin(TAU * f * t) + 0.3 * Math.sin(TAU * f * 2.01 * t)) * env(t, 0.003, 0.12);
      }
      mixInto(b, s, 0.25, Math.floor(sr * d));
    }
    return normalize(b, 0.6);
  },

  paper: (sr, rng) => {
    const b = buf(sr, 0.7);
    const f = new Biquad('hp', 1500, 0.7, sr);
    for (let i = 0; i < b.length; i++) {
      const t = i / sr;
      const a = Math.max(0, Math.sin(t * 30 + rng.next() * 0.5)) * env(t, 0.03, 0.25);
      b[i] = f.run(rng.next() * 2 - 1) * a * (rng.next() < 0.3 ? 1.6 : 0.6);
    }
    return normalize(edgeFade(b, sr), 0.5);
  },

  tape_click: (sr, rng) => {
    const b = buf(sr, 0.5);
    mixInto(b, noiseBurst(sr, rng, 0.03, 2500, 3, 0.004), 1);
    mixInto(b, noiseBurst(sr, rng, 0.03, 1200, 3, 0.006), 0.8, Math.floor(sr * 0.09));
    mixInto(b, thump(sr, 200, 80, 0.1, 0.02), 0.3, Math.floor(sr * 0.09));
    return normalize(b, 0.6);
  },

  keypad_beep: (sr) => {
    const b = buf(sr, 0.09);
    for (let i = 0; i < b.length; i++) b[i] = Math.sign(Math.sin((TAU * 1760 * i) / sr)) * 0.3 * env(i / sr, 0.002, 0.04);
    return edgeFade(b, sr, 3);
  },
  keypad_ok: (sr) => {
    const b = buf(sr, 0.4);
    for (let i = 0; i < b.length; i++) {
      const t = i / sr;
      const f = t < 0.12 ? 1320 : 1980;
      b[i] = Math.sign(Math.sin(TAU * f * t)) * 0.25 * env(t, 0.002, 0.15);
    }
    return edgeFade(b, sr, 3);
  },
  keypad_err: (sr) => {
    const b = buf(sr, 0.5);
    for (let i = 0; i < b.length; i++) {
      const t = i / sr;
      b[i] = Math.sign(Math.sin(TAU * 220 * t)) * 0.25 * (t < 0.18 || (t > 0.24 && t < 0.42) ? 1 : 0);
    }
    return edgeFade(b, sr, 3);
  },

  ui_hover: (sr) => {
    const b = buf(sr, 0.05);
    for (let i = 0; i < b.length; i++) b[i] = Math.sin((TAU * 2200 * i) / sr) * env(i / sr, 0.001, 0.012) * 0.2;
    return b;
  },
  ui_click: (sr, rng) => {
    const b = buf(sr, 0.12);
    mixInto(b, noiseBurst(sr, rng, 0.05, 2500, 2, 0.006), 0.6);
    for (let i = 0; i < b.length; i++) b[i] += Math.sin((TAU * 880 * i) / sr) * env(i / sr, 0.001, 0.03) * 0.25;
    return normalize(b, 0.5);
  },

  heartbeat: (sr) => {
    const b = buf(sr, 0.9);
    mixInto(b, thump(sr, 70, 38, 0.25, 0.06), 1);
    mixInto(b, thump(sr, 60, 35, 0.25, 0.07), 0.7, Math.floor(sr * 0.28));
    return normalize(b, 0.9);
  },

  breath_in: (sr, rng) => breath(sr, rng, true),
  breath_out: (sr, rng) => breath(sr, rng, false),

  squeak: (sr, rng) => {
    // rubber toy squeak: fast pitch sweep through a formant
    const b = buf(sr, 0.35);
    const f = new Biquad('bp', 1800, 3, sr);
    let ph = 0;
    const up = rng.next() < 0.5;
    for (let i = 0; i < b.length; i++) {
      const t = i / sr;
      const fr = up ? 900 + 1400 * Math.min(1, t / 0.25) : 2100 - 900 * Math.min(1, t / 0.25);
      ph += (TAU * fr) / sr;
      const x = Math.sin(ph) + 0.4 * Math.sin(ph * 2) + (rng.next() - 0.5) * 0.4;
      b[i] = f.run(x) * 0.6 + x * 0.25;
      b[i] *= Math.sin((Math.PI * t) / 0.35);
    }
    return normalize(b, 0.6);
  },

  shoe_squeak: (sr, rng) => {
    const b = buf(sr, 0.18);
    const f = new Biquad('bp', 2400, 5, sr);
    let ph = 0;
    for (let i = 0; i < b.length; i++) {
      const t = i / sr;
      ph += (TAU * (1600 + 900 * Math.sin(t * 40) + rng.range(-30, 30))) / sr;
      b[i] = f.run(Math.sin(ph) + (rng.next() - 0.5) * 0.6) * Math.sin((Math.PI * t) / 0.18);
    }
    return normalize(b, 0.4);
  },

  boing: (sr) => {
    // antenna spring
    const b = buf(sr, 0.8);
    let ph = 0;
    for (let i = 0; i < b.length; i++) {
      const t = i / sr;
      const f = 220 + 140 * Math.exp(-t * 6) * Math.sin(t * 60);
      ph += (TAU * f) / sr;
      b[i] = (Math.sin(ph) + 0.3 * Math.sin(ph * 3.1)) * env(t, 0.003, 0.25);
    }
    return normalize(b, 0.5);
  },

  roll_loop: (sr, rng) => {
    const b = buf(sr, 2.25);
    const lp = new Biquad('lp', 220, 0.9, sr);
    for (let i = 0; i < b.length; i++) {
      const t = i / sr;
      const bump = Math.max(0, Math.sin(t * TAU * 2.67)) ** 8;
      b[i] = lp.run(rng.next() * 2 - 1) * (0.6 + bump * 0.8);
    }
    return normalize(loopify(b, sr, 0.25), 0.7);
  },

  distant_bang: (sr, rng) => {
    const b = buf(sr, 3.5);
    const lp = new Biquad('lp', 500, 0.7, sr);
    const imp = buf(sr, 3.5);
    mixInto(imp, thump(sr, 70, 30, 1.0, 0.25), 1);
    mixInto(imp, metalRing(sr, rng, 70, 3.5, 1.1, 6), 0.6);
    mixInto(imp, noiseBurst(sr, rng, 1.5, 300, 0.5, 0.4), 0.5);
    for (let i = 0; i < b.length; i++) b[i] = lp.run(imp[i]);
    return normalize(b, 0.9);
  },

  metal_groan: (sr, rng) => {
    const b = buf(sr, 4);
    const f1 = new Biquad('bp', 180, 12, sr);
    const f2 = new Biquad('bp', 420, 14, sr);
    const f3 = new Biquad('bp', 760, 16, sr);
    let ph = 0;
    for (let i = 0; i < b.length; i++) {
      const t = i / sr;
      const fr = 38 + 10 * Math.sin(t * 0.9) + 4 * Math.sin(t * 3.7);
      ph += (TAU * fr) / sr;
      const saw = ((ph / TAU) % 1) * 2 - 1 + (rng.next() - 0.5) * 0.3;
      const a = Math.sin((Math.PI * t) / 4) ** 1.5;
      b[i] = (f1.run(saw) + f2.run(saw) * 0.8 + f3.run(saw) * 0.5) * a;
    }
    return normalize(edgeFade(b, sr, 50), 0.8);
  },

  drip: (sr, rng) => {
    const b = buf(sr, 0.4);
    mixInto(b, dropChirp(sr, rng.range(900, 1700), 0.12), 1);
    mixInto(b, noiseBurst(sr, rng, 0.03, 3000, 2, 0.005), 0.15);
    return normalize(b, 0.5);
  },

  glitch: (sr, rng) => {
    const b = buf(sr, 0.6);
    let hold = 0;
    let v = 0;
    for (let i = 0; i < b.length; i++) {
      if (hold-- <= 0) {
        hold = Math.floor(rng.range(20, 900));
        v = rng.next() < 0.35 ? 0 : rng.range(-1, 1);
      }
      const t = i / sr;
      b[i] = (v + Math.sign(Math.sin(TAU * rng.pick([440, 880, 1760, 3520]) * t)) * 0.2) * (rng.next() < 0.002 ? 0 : 1);
    }
    return normalize(edgeFade(b, sr, 5), 0.5);
  },

  static_burst: (sr, rng) => {
    const b = buf(sr, 0.8);
    const f = new Biquad('bp', 2500, 0.6, sr);
    for (let i = 0; i < b.length; i++) b[i] = f.run(rng.next() * 2 - 1) * env(i / sr, 0.02, 0.3);
    return normalize(b, 0.6);
  },

  crt_on: (sr, rng) => {
    const b = buf(sr, 1.2);
    mixInto(b, thump(sr, 90, 50, 0.2, 0.04), 0.7);
    mixInto(b, crackle(sr, rng, 0.3, 500), 0.4);
    for (let i = 0; i < b.length; i++) {
      const t = i / sr;
      b[i] += Math.sin(TAU * 15734 * t) * 0.04 * Math.min(1, t * 4);
    }
    return normalize(b, 0.6);
  },

  elevator_ding: (sr) => bell(sr, [1318.5, 1046.5], 0.4, 1.4),
  clock_chime: (sr) => bell(sr, [523.25], 0, 3.5, 2.4),

  alarm_loop: (sr) => {
    const b = buf(sr, 1.6);
    let ph = 0;
    for (let i = 0; i < b.length; i++) {
      const t = i / sr;
      const f = t % 0.8 < 0.4 ? 740 : 580;
      ph += (TAU * f) / sr;
      b[i] = (Math.sign(Math.sin(ph)) * 0.6 + Math.sin(ph * 2) * 0.2) * 0.5;
    }
    return edgeFade(b, sr, 2);
  },

  servo: (sr, rng) => {
    const b = buf(sr, 0.9);
    let ph = 0;
    for (let i = 0; i < b.length; i++) {
      const t = i / sr;
      const f = 520 + 380 * Math.sin((Math.PI * t) / 0.9);
      ph += (TAU * f) / sr;
      b[i] = (((ph / TAU) % 1) * 2 - 1) * 0.3 * Math.sin((Math.PI * t) / 0.9) + (rng.next() - 0.5) * 0.05;
    }
    const lp = new Biquad('lp', 2200, 0.7, sr);
    for (let i = 0; i < b.length; i++) b[i] = lp.run(b[i]);
    return normalize(edgeFade(b, sr, 10), 0.4);
  },

  scan_ping: (sr) => {
    const b = buf(sr, 1.2);
    for (let i = 0; i < b.length; i++) {
      const t = i / sr;
      b[i] = Math.sin(TAU * 1200 * t * (1 - t * 0.1)) * env(t, 0.005, 0.25) * 0.5;
    }
    return b;
  },

  valve: (sr, rng) => {
    const b = buf(sr, 0.9);
    const f = new Biquad('bp', 1400, 10, sr);
    for (let i = 0; i < b.length; i++) {
      const t = i / sr;
      const x = (rng.next() * 2 - 1) * (Math.sin(t * 90) > 0 ? 1 : 0.2);
      b[i] = f.run(x) * Math.sin((Math.PI * t) / 0.9);
    }
    mixInto(b, metalRing(sr, rng, 260, 0.9, 0.2, 5), 0.2);
    return normalize(b, 0.6);
  },

  steam_burst: (sr, rng) => {
    const b = buf(sr, 2);
    const hp = new Biquad('hp', 2500, 0.7, sr);
    for (let i = 0; i < b.length; i++) b[i] = hp.run(rng.next() * 2 - 1) * env(i / sr, 0.03, 0.7);
    return normalize(b, 0.7);
  },

  whoosh: (sr, rng) => {
    const b = buf(sr, 0.9);
    const f = new Biquad('bp', 600, 1.2, sr);
    for (let i = 0; i < b.length; i++) {
      const t = i / sr;
      f.set(300 + 2000 * Math.sin((Math.PI * t) / 0.9), 1.4);
      b[i] = f.run(rng.next() * 2 - 1) * Math.sin((Math.PI * t) / 0.9) ** 2;
    }
    return normalize(b, 0.6);
  },

  impact_soft: (sr, rng) => {
    const b = buf(sr, 0.4);
    mixInto(b, thump(sr, 160, 70, 0.2, 0.03), 0.8);
    mixInto(b, noiseBurst(sr, rng, 0.15, 900, 1, 0.025), 0.7);
    return normalize(b, 0.8);
  },
  impact_metal: (sr, rng) => {
    const b = buf(sr, 1.2);
    mixInto(b, noiseBurst(sr, rng, 0.05, 3000, 2, 0.008), 0.6);
    mixInto(b, metalRing(sr, rng, rng.range(400, 700), 1.2, 0.3, 7), 0.6);
    return normalize(b, 0.8);
  },
  impact_glass: (sr, rng) => {
    const b = buf(sr, 1.5);
    for (let k = 0; k < 18; k++) mixInto(b, metalRing(sr, rng, rng.range(2000, 6000), 0.4, 0.05, 3), 0.25, Math.floor(sr * rng.range(0, 0.4)));
    mixInto(b, noiseBurst(sr, rng, 0.3, 5000, 0.8, 0.06), 0.6);
    return normalize(b, 0.8);
  },

  lock_open: (sr, rng) => {
    const b = buf(sr, 0.5);
    mixInto(b, noiseBurst(sr, rng, 0.03, 2600, 4, 0.004), 1);
    mixInto(b, noiseBurst(sr, rng, 0.03, 1700, 4, 0.006), 0.8, Math.floor(sr * 0.08));
    mixInto(b, metalRing(sr, rng, 1200, 0.3, 0.05, 3), 0.2, Math.floor(sr * 0.08));
    return normalize(b, 0.6);
  },

  // ------------------------------------------------- loops (ambience beds)
  hum_loop: (sr, rng) => {
    const b = buf(sr, 4);
    for (let i = 0; i < b.length; i++) {
      const t = i / sr;
      b[i] = Math.sin(TAU * 50 * t) * 0.5 + Math.sin(TAU * 100 * t) * 0.3 + Math.sin(TAU * 150 * t) * 0.12 + (rng.next() - 0.5) * 0.02;
    }
    return normalize(b, 0.5);
  },
  buzz_loop: (sr, rng) => {
    const b = buf(sr, 3);
    const f = new Biquad('bp', 3000, 1, sr);
    for (let i = 0; i < b.length; i++) {
      const t = i / sr;
      const base = Math.sin(TAU * 100 * t) * 0.3 + Math.sin(TAU * 200 * t) * 0.15;
      const zz = f.run(rng.next() * 2 - 1) * (0.5 + 0.5 * Math.sin(TAU * 100 * t)) * 0.4;
      b[i] = base + zz;
    }
    return normalize(b, 0.5);
  },
  vent_loop: (sr, rng) => {
    const b = buf(sr, 6.25);
    const lp = new Biquad('lp', 500, 0.6, sr);
    const bp = new Biquad('bp', 180, 3, sr);
    for (let i = 0; i < b.length; i++) {
      const t = i / sr;
      const n = rng.next() * 2 - 1;
      b[i] = lp.run(n) * (0.8 + 0.2 * Math.sin(t * 1.3)) + bp.run(n) * 0.6;
    }
    return normalize(loopify(b, sr, 0.25), 0.6);
  },
  room_loop: (sr, rng) => {
    const b = buf(sr, 8.25);
    let br = 0;
    const lp = new Biquad('lp', 300, 0.5, sr);
    for (let i = 0; i < b.length; i++) {
      br = (br + (rng.next() * 2 - 1) * 0.02) * 0.998;
      b[i] = lp.run(br * 8);
    }
    return normalize(loopify(b, sr, 0.25), 0.5);
  },
  machine_loop: (sr, rng) => {
    const b = buf(sr, 2.0);
    for (let i = 0; i < b.length; i++) {
      const t = i / sr;
      b[i] = Math.sin(TAU * 55 * t) * 0.2 + Math.sin(TAU * 110 * t + Math.sin(TAU * 2 * t)) * 0.1 + (rng.next() - 0.5) * 0.08;
    }
    for (const at of [0, 0.5, 1.0, 1.5]) {
      mixInto(b, noiseBurst(sr, rng, 0.08, 2000, 2, 0.01), 0.5, Math.floor(sr * at));
      mixInto(b, metalRing(sr, rng, 380, 0.3, 0.05, 4), 0.15, Math.floor(sr * (at + 0.25)));
    }
    return normalize(b, 0.6);
  },
  steam_loop: (sr, rng) => {
    const b = buf(sr, 4.25);
    const hp = new Biquad('hp', 1800, 0.7, sr);
    for (let i = 0; i < b.length; i++) {
      const t = i / sr;
      b[i] = hp.run(rng.next() * 2 - 1) * (0.8 + 0.2 * Math.sin(t * 7));
    }
    return normalize(loopify(b, sr, 0.25), 0.5);
  },
  water_loop: (sr, rng) => {
    const b = buf(sr, 5.25);
    const lp = new Biquad('lp', 1200, 0.5, sr);
    for (let i = 0; i < b.length; i++) b[i] = lp.run(rng.next() * 2 - 1);
    for (let k = 0; k < 40; k++) mixInto(b, dropChirp(sr, rng.range(400, 1200), 0.04), 0.15, Math.floor(rng.range(0, b.length - sr * 0.1)));
    return normalize(loopify(b, sr, 0.25), 0.5);
  },
  rain_loop: (sr, rng) => {
    const b = buf(sr, 6.25);
    const lp = new Biquad('lp', 3500, 0.5, sr);
    const lp2 = new Biquad('lp', 400, 0.5, sr);
    for (let i = 0; i < b.length; i++) {
      const n = rng.next() * 2 - 1;
      b[i] = lp.run(n) * 0.5 + lp2.run(n) * 1.2;
      if (rng.next() < 0.004) b[i] += (rng.next() - 0.5) * 1.5;
    }
    return normalize(loopify(b, sr, 0.25), 0.55);
  },
  wind_loop: (sr, rng) => {
    const b = buf(sr, 8.25);
    const f = new Biquad('bp', 400, 2, sr);
    for (let i = 0; i < b.length; i++) {
      const t = i / sr;
      f.set(300 + 250 * Math.sin(t * 0.7) + 120 * Math.sin(t * 1.9), 2.5);
      b[i] = f.run(rng.next() * 2 - 1) * (0.6 + 0.4 * Math.sin(t * 0.45));
    }
    return normalize(loopify(b, sr, 0.25), 0.55);
  },
  tape_hiss_loop: (sr, rng) => {
    const b = buf(sr, 3.25);
    const hp = new Biquad('hp', 3000, 0.7, sr);
    for (let i = 0; i < b.length; i++) b[i] = hp.run(rng.next() * 2 - 1) * 0.6 + (rng.next() < 0.0005 ? 0.6 : 0);
    return normalize(loopify(b, sr, 0.25), 0.3);
  },
  radio_loop: (sr, rng) => {
    const b = buf(sr, 4.25);
    const f = new Biquad('bp', 1800, 0.8, sr);
    for (let i = 0; i < b.length; i++) {
      const t = i / sr;
      b[i] = f.run(rng.next() * 2 - 1) * (0.7 + 0.3 * Math.sin(t * 3.1)) + Math.sin(TAU * 1000 * t) * 0.03 * (Math.sin(t * 0.5) > 0.6 ? 1 : 0);
    }
    return normalize(loopify(b, sr, 0.25), 0.5);
  },
  conveyor_loop: (sr, rng) => {
    const b = buf(sr, 1.5);
    const lp = new Biquad('lp', 600, 0.8, sr);
    for (let i = 0; i < b.length; i++) {
      const t = i / sr;
      b[i] = lp.run(rng.next() * 2 - 1) * 0.5 + Math.sin(TAU * 73 * t) * 0.2;
    }
    for (const at of [0, 0.375, 0.75, 1.125]) mixInto(b, noiseBurst(sr, rng, 0.05, 1500, 3, 0.008), 0.35, Math.floor(sr * at));
    return normalize(b, 0.6);
  },
  motor_loop: (sr, rng) => {
    const b = buf(sr, 2);
    for (let i = 0; i < b.length; i++) {
      const t = i / sr;
      b[i] = (((t * 120) % 1) * 2 - 1) * 0.15 + Math.sin(TAU * 60 * t) * 0.3 + (rng.next() - 0.5) * 0.06;
    }
    const lp = new Biquad('lp', 900, 0.7, sr);
    for (let i = 0; i < b.length; i++) b[i] = lp.run(b[i]);
    return normalize(b, 0.55);
  },
  heartbeat_loop: (sr) => {
    const b = buf(sr, 0.85);
    mixInto(b, thump(sr, 70, 38, 0.25, 0.06), 1);
    mixInto(b, thump(sr, 60, 35, 0.25, 0.07), 0.7, Math.floor(sr * 0.26));
    return normalize(b, 0.9);
  },
  drone_loop: (sr, rng) => {
    const b = buf(sr, 8.25);
    const freqs = [55, 82.4, 110.7, 164.2];
    for (let i = 0; i < b.length; i++) {
      const t = i / sr;
      let v = 0;
      for (let k = 0; k < freqs.length; k++) v += Math.sin(TAU * freqs[k] * t + Math.sin(t * (0.2 + k * 0.07)) * 2) / (k + 1);
      b[i] = v * 0.3 + (rng.next() - 0.5) * 0.01;
    }
    return normalize(loopify(b, sr, 0.25), 0.5);
  },
};

function breath(sr: number, rng: Rng, inhale: boolean): Float32Array {
  const b = buf(sr, inhale ? 0.9 : 1.1);
  const f1 = new Biquad('bp', inhale ? 1400 : 900, 1.2, sr);
  const f2 = new Biquad('bp', 2600, 2, sr);
  for (let i = 0; i < b.length; i++) {
    const t = i / sr;
    const d = b.length / sr;
    const a = Math.sin((Math.PI * t) / d) ** (inhale ? 1.5 : 2.2);
    const n = rng.next() * 2 - 1;
    b[i] = (f1.run(n) + f2.run(n) * 0.4) * a;
  }
  return normalize(b, 0.4);
}

function bell(sr: number, notes: number[], gap: number, len: number, decay = 0.6): Float32Array {
  const b = buf(sr, gap * notes.length + len);
  notes.forEach((f, k) => {
    const off = Math.floor(sr * gap * k);
    for (let i = 0; i + off < b.length; i++) {
      const t = i / sr;
      const v =
        Math.sin(TAU * f * t) * 0.6 +
        Math.sin(TAU * f * 2.76 * t) * 0.25 * Math.exp(-t * 3) +
        Math.sin(TAU * f * 5.4 * t) * 0.12 * Math.exp(-t * 6) +
        Math.sin(TAU * f * 0.5 * t) * 0.2;
      b[i + off] += v * env(t, 0.002, decay);
    }
  });
  return normalize(b, 0.6);
}

export function toAudioBuffer(ctx: BaseAudioContext, data: Float32Array | [Float32Array, Float32Array]): AudioBuffer {
  if (Array.isArray(data)) {
    const ab = ctx.createBuffer(2, data[0].length, ctx.sampleRate);
    ab.copyToChannel(data[0] as Float32Array<ArrayBuffer>, 0);
    ab.copyToChannel(data[1] as Float32Array<ArrayBuffer>, 1);
    return ab;
  }
  const ab = ctx.createBuffer(1, data.length, ctx.sampleRate);
  ab.copyToChannel(data as Float32Array<ArrayBuffer>, 0);
  return ab;
}

/** Stereo reverb impulse response. */
export function impulse(sr: number, seconds: number, decay: number, brightness: number, seed = 7): [Float32Array, Float32Array] {
  const rng = new Rng(seed);
  const n = Math.floor(sr * seconds);
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  const lpL = OnePole.lp(brightness, sr);
  const lpR = OnePole.lp(brightness, sr);
  const pre = Math.floor(sr * 0.012);
  for (let i = pre; i < n; i++) {
    const t = (i - pre) / sr;
    const e = Math.pow(1 - t / seconds, decay) * Math.exp(-t * 1.5);
    // brightness falls off over time
    lpL.set(brightness * Math.exp(-t * 1.2) + 300, sr);
    lpR.set(brightness * Math.exp(-t * 1.2) + 300, sr);
    L[i] = lpL.lp(rng.next() * 2 - 1) * e;
    R[i] = lpR.lp(rng.next() * 2 - 1) * e;
  }
  // a few discrete early reflections
  for (let k = 0; k < 8; k++) {
    const at = pre + Math.floor(sr * rng.range(0.005, 0.07));
    const a = rng.range(0.2, 0.6);
    if (at < n) {
      L[at] += a * (rng.next() < 0.5 ? -1 : 1);
      R[Math.min(n - 1, at + Math.floor(sr * 0.003))] += a * (rng.next() < 0.5 ? -1 : 1);
    }
  }
  normalize(L, 0.6);
  normalize(R, 0.6);
  return [L, R];
}
