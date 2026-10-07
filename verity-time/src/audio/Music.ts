import * as THREE from 'three';
import type { AudioEngine } from './AudioEngine';

/**
 * Verity's theme ("Время Верити") and its four emotional states, played by a
 * look-ahead WebAudio sequencer with synthesized instruments.
 *
 *   kind      – music box + celesta, C major, the jingle children knew
 *   anxious   – harmonic minor, slower, detuned, notes go missing
 *   distorted – broken tines, tape wow, stutters, the theme falling apart
 *   final     – slow piano and strings, ends unresolved
 *   ad        – the upbeat TV commercial version
 *   chase     – driving ostinato with theme fragments
 */
export type Variant = 'kind' | 'anxious' | 'distorted' | 'final' | 'ad' | 'chase' | 'lullaby';

type Note = [beat: number, midi: number, dur: number];

// 3/4 time, 16 bars (48 beats)
const THEME: Note[] = [
  [0, 76, 1], [1, 79, 1], [2, 84, 1], [3, 83, 3],
  [6, 81, 1], [7, 79, 1], [8, 76, 1], [9, 79, 3],
  [12, 77, 1], [13, 76, 1], [14, 74, 1], [15, 76, 1], [16, 72, 1], [17, 69, 1],
  [18, 74, 1], [19, 67, 1], [20, 71, 1], [21, 72, 3],
  [24, 81, 1], [25, 79, 1], [26, 77, 1], [27, 76, 2], [29, 79, 1],
  [30, 77, 1], [31, 76, 1], [32, 74, 1], [33, 72, 2], [35, 76, 1],
  [36, 74, 1], [37, 76, 1], [38, 77, 1], [39, 79, 1], [40, 81, 1], [41, 83, 1],
  [42, 84, 1], [43, 83, 1], [44, 79, 1], [45, 84, 3],
];

// chord roots per bar (midi) + quality
const CHORDS: Array<[number, 'M' | 'm']> = [
  [48, 'M'], [43, 'M'], [45, 'm'], [40, 'm'], [41, 'M'], [45, 'm'], [43, 'M'], [48, 'M'],
  [41, 'M'], [48, 'M'], [50, 'm'], [48, 'M'], [50, 'm'], [43, 'M'], [48, 'M'], [48, 'M'],
];

export const MOTIF = [76, 79, 84, 83];

function mtof(m: number): number {
  return 440 * Math.pow(2, (m - 69) / 12);
}

/** Harmonic-minor transform used by the darker variants. */
function minorize(m: number): number {
  const pc = ((m % 12) + 12) % 12;
  if (pc === 4) return m - 1; // E -> Eb
  if (pc === 9) return m - 1; // A -> Ab
  return m;
}

export class Music {
  private out: GainNode;
  private wow: DelayNode;
  private wowLfo: OscillatorNode;
  private wowDepth: GainNode;
  private shaper: WaveShaperNode;
  private dry: GainNode;
  private wet: GainNode;
  variant: Variant | null = null;
  private nextBeatTime = 0;
  private beat = 0;
  private bpm = 96;
  private loop = true;
  private playing = false;
  private rnd = Math.random;
  private ctx: AudioContext;
  private stopTimer: number | null = null;
  volume = 1;

  constructor(private audio: AudioEngine) {
    const ctx = (this.ctx = audio.ctx);
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    // tape wow: modulated delay
    this.wow = ctx.createDelay(0.1);
    this.wow.delayTime.value = 0.02;
    this.wowLfo = ctx.createOscillator();
    this.wowLfo.frequency.value = 0.6;
    this.wowDepth = ctx.createGain();
    this.wowDepth.gain.value = 0;
    this.wowLfo.connect(this.wowDepth).connect(this.wow.delayTime);
    this.wowLfo.start();
    this.shaper = ctx.createWaveShaper();
    this.shaper.curve = makeCurve(3);
    this.dry = ctx.createGain();
    this.wet = ctx.createGain();
    this.wet.gain.value = 0;
    this.out.connect(this.wow);
    this.wow.connect(this.dry).connect(audio.buses.music);
    this.wow.connect(this.shaper).connect(this.wet).connect(audio.buses.music);
  }

  play(variant: Variant, opts: { loop?: boolean; fade?: number; volume?: number } = {}): void {
    if (this.stopTimer !== null) {
      clearTimeout(this.stopTimer);
      this.stopTimer = null;
    }
    const ctx = this.ctx;
    const t = ctx.currentTime;
    this.variant = variant;
    this.loop = opts.loop ?? true;
    this.volume = opts.volume ?? 1;
    this.bpm = { kind: 96, anxious: 72, distorted: 66, final: 54, ad: 138, chase: 150, lullaby: 80 }[variant];
    this.beat = 0;
    this.nextBeatTime = t + 0.1;
    this.playing = true;
    const fade = opts.fade ?? 2;
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setValueAtTime(this.out.gain.value, t);
    this.out.gain.linearRampToValueAtTime(this.volume * 0.5, t + fade);
    this.wowDepth.gain.setTargetAtTime(variant === 'distorted' ? 0.006 : variant === 'anxious' ? 0.0015 : 0.0003, t, 0.5);
    this.wowLfo.frequency.setTargetAtTime(variant === 'distorted' ? 0.9 : 0.5, t, 0.5);
    this.wet.gain.setTargetAtTime(variant === 'distorted' ? 0.35 : 0, t, 0.5);
    this.dry.gain.setTargetAtTime(variant === 'distorted' ? 0.7 : 1, t, 0.5);
  }

  stop(fade = 2): void {
    if (!this.playing) return;
    const t = this.ctx.currentTime;
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setValueAtTime(this.out.gain.value, t);
    this.out.gain.linearRampToValueAtTime(0, t + fade);
    this.stopTimer = window.setTimeout(() => {
      this.playing = false;
      this.variant = null;
      this.stopTimer = null;
    }, fade * 1000);
  }

  get isPlaying(): boolean {
    return this.playing;
  }

  /** Look-ahead scheduler, called every frame. */
  update(): void {
    if (!this.playing || !this.variant) return;
    const ahead = this.ctx.currentTime + 0.25;
    const spb = 60 / this.bpm;
    const total = this.variant === 'chase' ? 16 : 48;
    while (this.nextBeatTime < ahead) {
      this.scheduleBeat(this.beat % total, this.nextBeatTime, spb, Math.floor(this.beat / total));
      this.beat++;
      this.nextBeatTime += spb * (this.variant === 'distorted' ? 0.92 + this.rnd() * 0.2 : 1);
      if (!this.loop && this.beat >= total) {
        this.stop(3);
        break;
      }
    }
  }

  private scheduleBeat(b: number, time: number, spb: number, cycle: number): void {
    const v = this.variant!;
    const out = this.out;
    if (v === 'chase') return this.chaseBeat(b, time, spb);
    const notes = THEME.filter((n) => n[0] === b);
    const bar = Math.floor(b / 3);
    const isBar = b % 3 === 0;
    for (const [, m0, dur] of notes) {
      let m = m0;
      if (v === 'anxious' || v === 'distorted') m = minorize(m);
      // the final version never resolves
      if (v === 'final' && b === 45) m = 83;
      const len = dur * spb;
      switch (v) {
        case 'kind':
        case 'lullaby':
          musicBox(this.ctx, out, mtof(m), time, 0.35, 0);
          break;
        case 'ad':
          toyPiano(this.ctx, out, mtof(m), time, 0.3, len * 0.8);
          break;
        case 'anxious':
          if (this.rnd() < 0.14) break; // missing tines
          musicBox(this.ctx, out, mtof(m), time + this.rnd() * 0.04, 0.33, (this.rnd() - 0.5) * 50);
          break;
        case 'distorted': {
          if (this.rnd() < 0.22) break;
          const det = (this.rnd() - 0.5) * 140 + (cycle % 2 ? -100 : 0);
          musicBox(this.ctx, out, mtof(m), time + this.rnd() * 0.08, 0.35, det, true);
          if (this.rnd() < 0.12) for (let k = 1; k <= 3; k++) musicBox(this.ctx, out, mtof(m), time + k * 0.07, 0.2 / k, det, true);
          if (this.rnd() < 0.08) swell(this.ctx, out, mtof(m - 12), time, len * 2);
          break;
        }
        case 'final':
          piano(this.ctx, out, mtof(m - 12), time, 0.3, len);
          break;
      }
    }
    if (isBar) {
      const [root, q] = CHORDS[bar % CHORDS.length];
      let r = root;
      let qual = q;
      if (v === 'anxious' || v === 'distorted') {
        r = minorize(r);
        if (r % 12 === 0 || r % 12 === 7) qual = r % 12 === 0 ? 'm' : 'M';
      }
      const third = qual === 'M' ? 4 : 3;
      const chord = [r, r + third, r + 7].map((x) => x + 12);
      const barLen = spb * 3;
      switch (v) {
        case 'kind':
        case 'lullaby':
          pad(this.ctx, out, chord.map(mtof), time, barLen, 0.05);
          celesta(this.ctx, out, mtof(r + 12), time, 0.12);
          break;
        case 'ad':
          bass(this.ctx, out, mtof(r), time, spb * 0.9, 0.35);
          bass(this.ctx, out, mtof(r + 7), time + spb, spb * 0.5, 0.2);
          bass(this.ctx, out, mtof(r + 12), time + spb * 2, spb * 0.5, 0.2);
          clap(this.ctx, out, time + spb);
          clap(this.ctx, out, time + spb * 2);
          for (const c of chord) toyPiano(this.ctx, out, mtof(c + 12), time + spb, 0.06, spb * 0.3);
          break;
        case 'anxious':
          pad(this.ctx, out, chord.map((x) => mtof(x) * (1 + (this.rnd() - 0.5) * 0.01)), time, barLen, 0.05);
          if (bar % 2 === 0) drone(this.ctx, out, mtof(r - 12), time, barLen * 2, 0.12);
          break;
        case 'distorted':
          drone(this.ctx, out, mtof(r - 24), time, barLen, 0.18);
          if (this.rnd() < 0.5) pad(this.ctx, out, chord.map((x) => mtof(x) * (1 + (this.rnd() - 0.5) * 0.03)), time, barLen, 0.04);
          break;
        case 'final':
          strings(this.ctx, out, chord.map(mtof), time, barLen * 1.05, 0.06);
          piano(this.ctx, out, mtof(r - 12), time, 0.2, barLen);
          break;
      }
    }
  }

  private chaseBeat(b: number, time: number, spb: number): void {
    const out = this.out;
    const root = [48, 48, 44, 43][Math.floor(b / 4) % 4];
    bass(this.ctx, out, mtof(root - 12), time, spb * 0.45, 0.45);
    hat(this.ctx, out, time + spb * 0.5, 0.08);
    hat(this.ctx, out, time, 0.05);
    if (b % 4 === 0) drum(this.ctx, out, time, 0.5);
    if (b % 4 === 2) stab(this.ctx, out, [root + 12, root + 15, root + 19].map(mtof), time, spb * 0.4, 0.06);
    if (b % 8 === 6) {
      const m = minorize(MOTIF[(b / 2) % 4 | 0]);
      musicBox(this.ctx, out, mtof(m), time, 0.25, (this.rnd() - 0.5) * 80, true);
    }
  }

  /** Verity's 4-note signature, optionally positional. */
  motif(opts: { pos?: THREE.Vector3; variant?: 'kind' | 'anxious' | 'distorted'; volume?: number } = {}): void {
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.value = opts.volume ?? 0.6;
    let dest: AudioNode = g;
    if (opts.pos) {
      const p = ctx.createPanner();
      p.panningModel = 'HRTF';
      p.refDistance = 1.5;
      p.rolloffFactor = 1;
      p.positionX.value = opts.pos.x;
      p.positionY.value = opts.pos.y;
      p.positionZ.value = opts.pos.z;
      g.connect(p).connect(this.audio.buses.sfx);
      dest = g;
    } else g.connect(this.audio.buses.sfx);
    const v = opts.variant ?? 'kind';
    const t = ctx.currentTime + 0.02;
    const spb = v === 'kind' ? 0.24 : v === 'anxious' ? 0.34 : 0.42;
    MOTIF.forEach((m0, i) => {
      const m = v === 'kind' ? m0 : minorize(m0);
      const det = v === 'distorted' ? (Math.random() - 0.5) * 120 - i * 25 : v === 'anxious' ? (Math.random() - 0.5) * 30 : 0;
      musicBox(ctx, dest, mtof(m), t + i * spb + (v === 'distorted' ? Math.random() * 0.1 : 0), 0.5, det, v === 'distorted');
    });
  }

  /** One-shot dramatic cue. */
  sting(kind: 'reveal' | 'danger' | 'sad' | 'soft'): void {
    const ctx = this.ctx;
    const t = ctx.currentTime + 0.02;
    const g = ctx.createGain();
    g.connect(this.audio.buses.music);
    g.gain.value = 0.7;
    if (kind === 'reveal') {
      // dissonant cluster swelling then cut
      for (const m of [48, 49, 55, 61, 66]) swell(ctx, g, mtof(m), t, 2.6, 0.12);
      drum(ctx, g, t + 2.55, 0.9);
    } else if (kind === 'danger') {
      drum(ctx, g, t, 1);
      for (const m of [36, 37, 43]) drone(ctx, g, mtof(m), t, 2.5, 0.25);
      for (const m of [84, 85, 90]) swell(ctx, g, mtof(m), t, 1.6, 0.05);
    } else if (kind === 'sad') {
      for (const [i, m] of [72, 76, 79, 83].entries()) piano(ctx, g, mtof(m - 12), t + i * 0.5, 0.25, 3);
    } else {
      musicBox(ctx, g, mtof(84), t, 0.3, 0);
      musicBox(ctx, g, mtof(83), t + 0.5, 0.25, 0);
    }
  }
}

// ---------------------------------------------------------------- instruments

function envGain(ctx: BaseAudioContext, dest: AudioNode, time: number, peak: number, attack: number, decay: number, hold = 0): GainNode {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, time);
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), time + attack);
  if (hold) g.gain.setValueAtTime(peak, time + attack + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, time + attack + hold + decay);
  g.connect(dest);
  return g;
}

/** FM tine with an inharmonic partial: the music box. */
export function musicBox(ctx: BaseAudioContext, dest: AudioNode, f: number, time: number, vel: number, cents: number, broken = false): void {
  const len = broken ? 1.6 : 1.9;
  const g = envGain(ctx, dest, time, vel, 0.003, len);
  const car = ctx.createOscillator();
  car.frequency.value = f;
  car.detune.value = cents;
  const mod = ctx.createOscillator();
  mod.frequency.value = f * (broken ? 3.5 + Math.random() * 0.6 : 3.5);
  mod.detune.value = cents;
  const mg = ctx.createGain();
  mg.gain.setValueAtTime(f * (broken ? 2.2 : 1.4), time);
  mg.gain.exponentialRampToValueAtTime(f * 0.05, time + 0.25);
  mod.connect(mg).connect(car.frequency);
  car.connect(g);
  const p2 = ctx.createOscillator();
  p2.frequency.value = f * 4.07;
  p2.detune.value = cents;
  const g2 = envGain(ctx, dest, time, vel * 0.12, 0.002, 0.25);
  p2.connect(g2);
  for (const o of [car, mod, p2]) {
    o.start(time);
    o.stop(time + len + 0.1);
  }
}

function celesta(ctx: BaseAudioContext, dest: AudioNode, f: number, time: number, vel: number): void {
  const g = envGain(ctx, dest, time, vel, 0.004, 1.2);
  const o = ctx.createOscillator();
  o.type = 'triangle';
  o.frequency.value = f;
  o.connect(g);
  o.start(time);
  o.stop(time + 1.4);
}

function toyPiano(ctx: BaseAudioContext, dest: AudioNode, f: number, time: number, vel: number, len: number): void {
  const g = envGain(ctx, dest, time, vel, 0.002, Math.min(0.9, len + 0.3));
  for (const [r, a, type] of [
    [1, 1, 'triangle'],
    [2.01, 0.3, 'sine'],
    [3.98, 0.15, 'sine'],
  ] as const) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = f * r;
    const og = ctx.createGain();
    og.gain.value = a;
    o.connect(og).connect(g);
    o.start(time);
    o.stop(time + len + 0.5);
  }
}

function piano(ctx: BaseAudioContext, dest: AudioNode, f: number, time: number, vel: number, len: number): void {
  const decay = Math.min(4, 1.2 + len);
  const g = envGain(ctx, dest, time, vel, 0.006, decay);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(f * 8, time);
  lp.frequency.exponentialRampToValueAtTime(f * 2, time + decay);
  lp.connect(g);
  for (let k = 1; k <= 6; k++) {
    const o = ctx.createOscillator();
    o.frequency.value = f * k * (1 + k * k * 0.0004);
    const og = ctx.createGain();
    og.gain.value = 0.6 / k;
    o.connect(og).connect(lp);
    o.start(time);
    o.stop(time + decay + 0.1);
  }
}

function pad(ctx: BaseAudioContext, dest: AudioNode, freqs: number[], time: number, len: number, vel: number): void {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, time);
  g.gain.linearRampToValueAtTime(vel, time + len * 0.35);
  g.gain.linearRampToValueAtTime(0, time + len * 1.1);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1200;
  lp.connect(g).connect(dest);
  for (const f of freqs)
    for (const d of [-6, 6]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.detune.value = d;
      o.connect(lp);
      o.start(time);
      o.stop(time + len * 1.15);
    }
}

function strings(ctx: BaseAudioContext, dest: AudioNode, freqs: number[], time: number, len: number, vel: number): void {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, time);
  g.gain.linearRampToValueAtTime(vel, time + len * 0.5);
  g.gain.linearRampToValueAtTime(0, time + len * 1.2);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1800;
  lp.Q.value = 0.5;
  lp.connect(g).connect(dest);
  const vib = ctx.createOscillator();
  vib.frequency.value = 5;
  const vg = ctx.createGain();
  vg.gain.value = 6;
  vib.connect(vg);
  vib.start(time);
  vib.stop(time + len * 1.3);
  for (const f of freqs)
    for (const d of [-9, 0, 9]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.detune.value = d;
      vg.connect(o.detune);
      o.connect(lp);
      o.start(time);
      o.stop(time + len * 1.3);
    }
}

function drone(ctx: BaseAudioContext, dest: AudioNode, f: number, time: number, len: number, vel: number): void {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, time);
  g.gain.linearRampToValueAtTime(vel, time + len * 0.3);
  g.gain.linearRampToValueAtTime(0, time + len);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 400;
  lp.connect(g).connect(dest);
  for (const d of [-12, 0, 7]) {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = f;
    o.detune.value = d;
    o.connect(lp);
    o.start(time);
    o.stop(time + len + 0.1);
  }
}

function swell(ctx: BaseAudioContext, dest: AudioNode, f: number, time: number, len: number, vel = 0.1): void {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, time);
  g.gain.exponentialRampToValueAtTime(vel, time + len * 0.95);
  g.gain.linearRampToValueAtTime(0, time + len);
  g.connect(dest);
  const o = ctx.createOscillator();
  o.type = 'triangle';
  o.frequency.value = f;
  o.connect(g);
  o.start(time);
  o.stop(time + len + 0.05);
}

function bass(ctx: BaseAudioContext, dest: AudioNode, f: number, time: number, len: number, vel: number): void {
  const g = envGain(ctx, dest, time, vel, 0.005, len);
  const o = ctx.createOscillator();
  o.type = 'triangle';
  o.frequency.value = f;
  o.connect(g);
  o.start(time);
  o.stop(time + len + 0.1);
}

let noiseBuf: AudioBuffer | null = null;
function noise(ctx: BaseAudioContext): AudioBuffer {
  if (noiseBuf && noiseBuf.sampleRate === ctx.sampleRate) return noiseBuf;
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}

function hat(ctx: BaseAudioContext, dest: AudioNode, time: number, vel: number): void {
  const s = ctx.createBufferSource();
  s.buffer = noise(ctx);
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 7000;
  const g = envGain(ctx, dest, time, vel, 0.001, 0.05);
  s.connect(hp).connect(g);
  s.start(time);
  s.stop(time + 0.1);
}

function clap(ctx: BaseAudioContext, dest: AudioNode, time: number): void {
  const s = ctx.createBufferSource();
  s.buffer = noise(ctx);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1500;
  const g = envGain(ctx, dest, time, 0.08, 0.002, 0.08);
  s.connect(bp).connect(g);
  s.start(time);
  s.stop(time + 0.15);
}

function drum(ctx: BaseAudioContext, dest: AudioNode, time: number, vel: number): void {
  const o = ctx.createOscillator();
  o.frequency.setValueAtTime(110, time);
  o.frequency.exponentialRampToValueAtTime(38, time + 0.3);
  const g = envGain(ctx, dest, time, vel, 0.002, 0.45);
  o.connect(g);
  o.start(time);
  o.stop(time + 0.6);
}

function stab(ctx: BaseAudioContext, dest: AudioNode, freqs: number[], time: number, len: number, vel: number): void {
  const g = envGain(ctx, dest, time, vel, 0.004, len);
  const bp = ctx.createBiquadFilter();
  bp.type = 'lowpass';
  bp.frequency.value = 2400;
  bp.connect(g);
  for (const f of freqs) {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = f;
    o.connect(bp);
    o.start(time);
    o.stop(time + len + 0.1);
  }
}

function makeCurve(k: number): Float32Array<ArrayBuffer> {
  const n = 1024;
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / n) * 2 - 1;
    c[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
  }
  return c;
}
