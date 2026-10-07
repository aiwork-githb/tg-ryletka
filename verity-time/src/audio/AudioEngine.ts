import * as THREE from 'three';
import { Rng } from '../assets/noise';
import { impulse, SFX, toAudioBuffer } from './Synth';
import type { Settings } from '../core/Settings';
import type { CollisionWorld } from '../physics/CollisionWorld';

export type Bus = 'sfx' | 'music' | 'voice' | 'ambience' | 'ui';

export interface PlayOpts {
  pos?: THREE.Vector3 | { x: number; y: number; z: number };
  volume?: number;
  rate?: number;
  rateJitter?: number;
  bus?: Bus;
  loop?: boolean;
  /** Reverb send amount (0..1), default depends on bus. */
  reverb?: number;
  /** Positional rolloff reference distance. */
  ref?: number;
  maxDist?: number;
  /** Start offset in seconds. */
  offset?: number;
  /** Disable occlusion filtering for this emitter. */
  noOcclusion?: boolean;
  fadeIn?: number;
}

export class Sound {
  src: AudioBufferSourceNode;
  gain: GainNode;
  panner: PannerNode | null = null;
  filter: BiquadFilterNode | null = null;
  pos: THREE.Vector3 | null = null;
  baseVolume = 1;
  occlusion = 1;
  ended = false;
  occlude = true;
  constructor(src: AudioBufferSourceNode, gain: GainNode) {
    this.src = src;
    this.gain = gain;
    src.onended = () => (this.ended = true);
  }
  stop(fade = 0.05): void {
    if (this.ended) return;
    const ctx = this.gain.context;
    const t = ctx.currentTime;
    try {
      this.gain.gain.cancelScheduledValues(t);
      this.gain.gain.setValueAtTime(this.gain.gain.value, t);
      this.gain.gain.linearRampToValueAtTime(0, t + fade);
      this.src.stop(t + fade + 0.02);
    } catch {
      /* already stopped */
    }
    this.ended = true;
  }
  setVolume(v: number, time = 0.05): void {
    this.baseVolume = v;
    const ctx = this.gain.context;
    this.gain.gain.setTargetAtTime(v * this.occlusion, ctx.currentTime, time);
  }
  setRate(r: number): void {
    this.src.playbackRate.setTargetAtTime(r, this.gain.context.currentTime, 0.05);
  }
  setPos(p: { x: number; y: number; z: number }): void {
    if (!this.panner) return;
    this.pos?.set(p.x, p.y, p.z);
    const t = this.gain.context.currentTime;
    this.panner.positionX.setTargetAtTime(p.x, t, 0.02);
    this.panner.positionY.setTargetAtTime(p.y, t, 0.02);
    this.panner.positionZ.setTargetAtTime(p.z, t, 0.02);
  }
}

interface ReverbPreset {
  seconds: number;
  decay: number;
  bright: number;
  wet: number;
}

export const REVERBS: Record<string, ReverbPreset> = {
  room: { seconds: 0.9, decay: 3, bright: 5000, wet: 0.18 },
  hall: { seconds: 2.6, decay: 2.2, bright: 4500, wet: 0.3 },
  industrial: { seconds: 3.6, decay: 2, bright: 6000, wet: 0.34 },
  tunnel: { seconds: 2.2, decay: 2.5, bright: 3000, wet: 0.36 },
  vast: { seconds: 5.5, decay: 1.6, bright: 3500, wet: 0.42 },
  dead: { seconds: 0.4, decay: 4, bright: 3000, wet: 0.06 },
  outside: { seconds: 1.6, decay: 3, bright: 6000, wet: 0.12 },
};

/**
 * WebAudio engine: buses, HRTF positional sounds with wall occlusion,
 * convolution reverb, procedural buffer cache.
 */
export class AudioEngine {
  ctx: AudioContext;
  master: GainNode;
  buses: Record<Bus, GainNode>;
  private reverb: ConvolverNode;
  private reverbIn: GainNode;
  private reverbOut: GainNode;
  private cache = new Map<string, AudioBuffer[]>();
  private sounds: Sound[] = [];
  private rng = new Rng(42);
  private occlusionTimer = 0;
  world: CollisionWorld | null = null;
  readonly listenerPos = new THREE.Vector3();
  private compressor: DynamicsCompressorNode;
  private duckGain: GainNode;
  muffle: BiquadFilterNode;

  constructor() {
    this.ctx = new AudioContext({ latencyHint: 'interactive' });
    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -10;
    this.compressor.ratio.value = 4;
    this.master = this.ctx.createGain();
    // global muffle (used when hiding, stunned, underwater)
    this.muffle = this.ctx.createBiquadFilter();
    this.muffle.type = 'lowpass';
    this.muffle.frequency.value = 20000;
    this.duckGain = this.ctx.createGain();
    this.master.connect(this.muffle).connect(this.compressor).connect(this.ctx.destination);
    const mk = () => {
      const g = this.ctx.createGain();
      g.connect(this.master);
      return g;
    };
    this.buses = { sfx: mk(), music: mk(), voice: mk(), ambience: mk(), ui: mk() };
    // ambience + sfx get ducked when voice plays
    this.buses.ambience.disconnect();
    this.buses.ambience.connect(this.duckGain).connect(this.master);
    this.reverb = this.ctx.createConvolver();
    this.reverbIn = this.ctx.createGain();
    this.reverbOut = this.ctx.createGain();
    this.reverbIn.connect(this.reverb).connect(this.reverbOut).connect(this.master);
    this.setReverb('room');
  }

  resume(): void {
    if (this.ctx.state !== 'running') this.ctx.resume().catch(() => undefined);
  }

  applySettings(s: Settings): void {
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(s.masterVolume, t, 0.05);
    this.buses.music.gain.setTargetAtTime(s.musicVolume * 0.8, t, 0.05);
    this.buses.sfx.gain.setTargetAtTime(s.sfxVolume, t, 0.05);
    this.buses.ui.gain.setTargetAtTime(s.sfxVolume * 0.6, t, 0.05);
    this.buses.voice.gain.setTargetAtTime(s.voiceVolume, t, 0.05);
    this.buses.ambience.gain.setTargetAtTime(s.ambienceVolume * 0.9, t, 0.05);
  }

  setReverb(name: keyof typeof REVERBS | string): void {
    const p = REVERBS[name] ?? REVERBS.room;
    const ir = impulse(this.ctx.sampleRate, p.seconds, p.decay, p.bright, 11);
    this.reverb.buffer = toAudioBuffer(this.ctx, ir);
    this.reverbOut.gain.setTargetAtTime(p.wet * 2.2, this.ctx.currentTime, 0.3);
  }

  /** Returns a (cached) buffer; generators get N random variants. */
  buffer(name: string, variant?: number): AudioBuffer | null {
    let list = this.cache.get(name);
    if (!list) {
      const gen = SFX[name];
      if (!gen) {
        console.warn('[audio] unknown sfx', name);
        return null;
      }
      const variants = name.startsWith('step_') ? 6 : name.endsWith('_loop') ? 1 : 3;
      list = [];
      for (let i = 0; i < variants; i++) list.push(toAudioBuffer(this.ctx, gen(this.ctx.sampleRate, new Rng(hash(name) + i * 977))));
      this.cache.set(name, list);
    }
    return list[variant ?? Math.floor(this.rng.next() * list.length)];
  }

  /** Pre-generates buffers so the first play doesn't stall. */
  warm(names: string[]): void {
    for (const n of names) this.buffer(n, 0);
  }

  registerBuffer(name: string, b: AudioBuffer): void {
    this.cache.set(name, [b]);
  }

  play(name: string, o: PlayOpts = {}): Sound | null {
    const b = this.buffer(name);
    if (!b) return null;
    return this.playBuffer(b, o);
  }

  playBuffer(b: AudioBuffer, o: PlayOpts = {}): Sound {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = b;
    src.loop = !!o.loop;
    const rate = (o.rate ?? 1) * (1 + (o.rateJitter ?? 0) * (this.rng.next() * 2 - 1));
    src.playbackRate.value = rate;
    const gain = ctx.createGain();
    const vol = o.volume ?? 1;
    const s = new Sound(src, gain);
    s.baseVolume = vol;
    let node: AudioNode = src;
    if (o.pos) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 20000;
      const p = ctx.createPanner();
      p.panningModel = 'HRTF';
      p.distanceModel = 'inverse';
      p.refDistance = o.ref ?? 1.2;
      p.maxDistance = o.maxDist ?? 60;
      p.rolloffFactor = 1.1;
      p.positionX.value = o.pos.x;
      p.positionY.value = o.pos.y;
      p.positionZ.value = o.pos.z;
      node.connect(filter);
      filter.connect(p);
      node = p;
      s.panner = p;
      s.filter = filter;
      s.pos = new THREE.Vector3(o.pos.x, o.pos.y, o.pos.z);
      s.occlude = !o.noOcclusion;
    }
    node.connect(gain);
    const bus = this.buses[o.bus ?? 'sfx'];
    gain.connect(bus);
    const rv = o.reverb ?? (o.bus === 'music' || o.bus === 'ui' ? 0 : o.bus === 'voice' ? 0.15 : 0.5);
    if (rv > 0) {
      const send = ctx.createGain();
      send.gain.value = rv;
      gain.connect(send).connect(this.reverbIn);
    }
    if (o.fadeIn) {
      gain.gain.value = 0;
      gain.gain.setTargetAtTime(vol, ctx.currentTime, o.fadeIn / 3);
    } else gain.gain.value = vol;
    src.start(0, o.offset ?? 0);
    this.sounds.push(s);
    return s;
  }

  ui(name: string): void {
    this.play(name, { bus: 'ui', volume: 0.7 });
  }

  /** Brief ducking of the ambience bed (voice lines, stingers). */
  duck(amount = 0.5, seconds = 2): void {
    const t = this.ctx.currentTime;
    this.duckGain.gain.cancelScheduledValues(t);
    this.duckGain.gain.setTargetAtTime(1 - amount, t, 0.1);
    this.duckGain.gain.setTargetAtTime(1, t + seconds, 0.6);
  }

  setMuffle(on: boolean, freq = 900): void {
    this.muffle.frequency.setTargetAtTime(on ? freq : 20000, this.ctx.currentTime, 0.15);
  }

  update(dt: number, camera: THREE.Camera): void {
    const l = this.ctx.listener;
    camera.getWorldPosition(this.listenerPos);
    const f = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const u = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    const t = this.ctx.currentTime;
    if (l.positionX) {
      l.positionX.setTargetAtTime(this.listenerPos.x, t, 0.01);
      l.positionY.setTargetAtTime(this.listenerPos.y, t, 0.01);
      l.positionZ.setTargetAtTime(this.listenerPos.z, t, 0.01);
      l.forwardX.setTargetAtTime(f.x, t, 0.01);
      l.forwardY.setTargetAtTime(f.y, t, 0.01);
      l.forwardZ.setTargetAtTime(f.z, t, 0.01);
      l.upX.setTargetAtTime(u.x, t, 0.01);
      l.upY.setTargetAtTime(u.y, t, 0.01);
      l.upZ.setTargetAtTime(u.z, t, 0.01);
    } else {
      (l as any).setPosition(this.listenerPos.x, this.listenerPos.y, this.listenerPos.z);
      (l as any).setOrientation(f.x, f.y, f.z, u.x, u.y, u.z);
    }
    // occlusion: walls between listener and source muffle it
    this.occlusionTimer -= dt;
    const doOcc = this.occlusionTimer <= 0;
    if (doOcc) this.occlusionTimer = 0.12;
    this.sounds = this.sounds.filter((s) => !s.ended);
    if (doOcc && this.world) {
      for (const s of this.sounds) {
        if (!s.pos || !s.filter || !s.occlude) continue;
        const d = s.pos.distanceTo(this.listenerPos);
        if (d > 45) continue;
        const clear = this.world.lineOfSight(this.listenerPos, s.pos);
        const target = clear ? 1 : 0.55;
        s.occlusion = target;
        s.filter.frequency.setTargetAtTime(clear ? 20000 : 700, t, 0.15);
        s.gain.gain.setTargetAtTime(s.baseVolume * target, t, 0.15);
      }
    }
  }

  stopAll(includeMusic = false): void {
    for (const s of this.sounds) {
      if (!includeMusic && s.gain.numberOfOutputs && (s as any).bus === 'music') continue;
      s.stop(0.2);
    }
    this.sounds = [];
  }

  /** Stops every positional / looping sound (zone change). */
  stopWorld(): void {
    for (const s of this.sounds) if (s.pos || s.src.loop) s.stop(0.3);
  }
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
