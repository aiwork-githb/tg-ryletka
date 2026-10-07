/**
 * Formant "toy voice" synthesizer. Verity speaks in a bubbly synthetic voice
 * that follows the syllables of the subtitle text; staff tapes use a muffled
 * human-like murmur. Degradation (0..4) progressively breaks Verity's voice.
 */
import { Rng } from '../assets/noise';
import { Biquad } from './Synth';

export interface VoiceProfile {
  pitch: number; // Hz
  syllable: number; // seconds
  bright: number; // 0..1 saw vs sine
  formantShift: number; // multiplier
  jitter: number; // pitch randomness (semitones)
  contour: number; // melodic movement (semitones)
  breath: number; // noise amount
  tape: boolean; // band-limit + wow
  degrade: number; // 0..4
  gain: number;
}

export const VOICES: Record<string, VoiceProfile> = {
  verity: { pitch: 360, syllable: 0.095, bright: 0.55, formantShift: 1.35, jitter: 0.4, contour: 4, breath: 0.05, tape: false, degrade: 0, gain: 0.8 },
  male: { pitch: 112, syllable: 0.15, bright: 0.8, formantShift: 1, jitter: 0.3, contour: 2.5, breath: 0.15, tape: true, degrade: 0, gain: 0.9 },
  female: { pitch: 205, syllable: 0.14, bright: 0.75, formantShift: 1.12, jitter: 0.3, contour: 3, breath: 0.15, tape: true, degrade: 0, gain: 0.9 },
  old: { pitch: 98, syllable: 0.17, bright: 0.85, formantShift: 0.95, jitter: 0.6, contour: 2, breath: 0.25, tape: true, degrade: 0, gain: 0.9 },
  pa: { pitch: 190, syllable: 0.13, bright: 0.7, formantShift: 1.1, jitter: 0.2, contour: 2.5, breath: 0.1, tape: true, degrade: 0, gain: 0.8 },
  child: { pitch: 290, syllable: 0.12, bright: 0.6, formantShift: 1.25, jitter: 0.5, contour: 4, breath: 0.12, tape: true, degrade: 0, gain: 0.8 },
};

// vowel formants (F1, F2, F3) for Russian vowels
const VOWELS: Record<string, [number, number, number]> = {
  а: [800, 1250, 2600],
  я: [750, 1700, 2600],
  о: [500, 900, 2500],
  ё: [500, 1400, 2500],
  у: [350, 750, 2400],
  ю: [350, 1500, 2400],
  ы: [400, 1500, 2500],
  и: [300, 2300, 3000],
  е: [450, 1950, 2700],
  э: [550, 1700, 2600],
  a: [800, 1250, 2600],
  o: [500, 900, 2500],
  u: [350, 750, 2400],
  i: [300, 2300, 3000],
  e: [450, 1950, 2700],
  y: [400, 1500, 2500],
};
const FRIC = new Set('сшщчфхзжцsfzhc'.split(''));
const PLOS = new Set('птксбдгptkbdg'.split(''));

interface Syl {
  vowel: [number, number, number];
  cons: 'fric' | 'plos' | 'voiced' | null;
  gapAfter: number;
  emph: number; // +1 question rise, -1 statement fall at phrase end
}

function parse(text: string): Syl[] {
  const out: Syl[] = [];
  const s = text.toLowerCase();
  let cons: Syl['cons'] = null;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (VOWELS[ch]) {
      out.push({ vowel: VOWELS[ch], cons, gapAfter: 0, emph: 0 });
      cons = null;
    } else if (FRIC.has(ch)) cons = 'fric';
    else if (PLOS.has(ch)) cons = cons ?? 'plos';
    else if (/[а-яa-z]/.test(ch)) cons = cons ?? 'voiced';
    else if (out.length) {
      const last = out[out.length - 1];
      if (ch === ' ') last.gapAfter = Math.max(last.gapAfter, 0.035);
      else if (ch === ',' || ch === ';' || ch === ':' || ch === '—') last.gapAfter = Math.max(last.gapAfter, 0.17);
      else if (ch === '.' || ch === '!') {
        last.gapAfter = Math.max(last.gapAfter, s[i + 1] === '.' ? 0.5 : 0.32);
        last.emph = -1;
      } else if (ch === '?') {
        last.gapAfter = Math.max(last.gapAfter, 0.34);
        last.emph = 1;
      } else if (ch === '…') last.gapAfter = Math.max(last.gapAfter, 0.6);
    }
  }
  return out;
}

/** Rough reading time for subtitles if no audio is generated. */
export function speechDuration(text: string, profile: VoiceProfile): number {
  const syl = parse(text);
  let t = 0.2;
  for (const s of syl) t += profile.syllable + s.gapAfter;
  return t;
}

export function synthLine(text: string, p: VoiceProfile, sr: number, seed = 1): Float32Array {
  const rng = new Rng(seed);
  const syl = parse(text);
  const deg = p.degrade;
  let total = 0.25;
  const sylLen = p.syllable * (1 + deg * 0.12);
  for (const s of syl) total += sylLen + s.gapAfter * (1 + deg * 0.2);
  const out = new Float32Array(Math.ceil(total * sr));
  const f1 = new Biquad('bp', 500, 6, sr);
  const f2 = new Biquad('bp', 1500, 8, sr);
  const f3 = new Biquad('bp', 2500, 10, sr);
  const nb = new Biquad('bp', 4000, 1.5, sr);
  let ph = 0;
  let pos = Math.floor(0.08 * sr);
  let prevF: [number, number, number] = syl[0]?.vowel ?? [500, 1500, 2500];
  const n = syl.length;
  for (let k = 0; k < n; k++) {
    const s = syl[k];
    const len = sylLen * (k === n - 1 || s.gapAfter > 0.1 ? 1.35 : 1) * rng.range(0.85, 1.15);
    const N = Math.floor(len * sr);
    // melodic contour: phrase arc + random
    const arc = Math.sin((k / Math.max(1, n - 1)) * Math.PI) * p.contour * 0.5;
    let semis = arc + rng.range(-p.jitter, p.jitter) * 2 + (k % 3 === 0 ? p.contour * 0.3 : 0);
    if (s.emph > 0) semis += p.contour * 0.8;
    if (s.emph < 0) semis -= p.contour * 0.5;
    if (deg >= 2) semis -= deg * 1.2;
    const f0 = p.pitch * Math.pow(2, semis / 12);
    const fm = p.formantShift * (deg >= 3 ? rng.range(0.85, 1.05) : 1);
    const dropout = deg >= 2 && rng.next() < 0.06 * deg;
    // consonant onset
    const cN = s.cons ? Math.floor((s.cons === 'fric' ? 0.05 : 0.018) * sr) : 0;
    for (let i = 0; i < cN && pos + i < out.length; i++) {
      const e = s.cons === 'plos' ? Math.exp(-i / (sr * 0.004)) : Math.sin((Math.PI * i) / cN);
      out[pos + i] += nb.run(rng.next() * 2 - 1) * e * (s.cons === 'fric' ? 0.25 : 0.4);
    }
    pos += Math.floor(cN * 0.6);
    for (let i = 0; i < N && pos + i < out.length; i++) {
      const t = i / N;
      // formant glide from previous vowel
      if ((i & 63) === 0) {
        const g = Math.min(1, t * 4);
        const F = [0, 1, 2].map((j) => (prevF[j] + (s.vowel[j] - prevF[j]) * g) * fm);
        f1.set(F[0], 5);
        f2.set(F[1], 7);
        f3.set(F[2], 9);
      }
      const vib = 1 + Math.sin((pos + i) / sr * 32) * 0.006;
      let f = f0 * vib * (1 + (s.emph > 0 ? t * 0.15 : s.emph < 0 ? -t * 0.08 : 0));
      if (deg >= 3) f *= 1 + (rng.next() - 0.5) * 0.05 * deg; // grinding
      ph += f / sr;
      const saw = (ph % 1) * 2 - 1;
      const sine = Math.sin(ph * Math.PI * 2);
      let src = saw * p.bright + sine * (1 - p.bright) + (rng.next() * 2 - 1) * p.breath;
      if (deg >= 4) src *= Math.sin(ph * Math.PI * 2 * 0.5 * 2.71); // ring mod
      const formant = f1.run(src) * 1.0 + f2.run(src) * 0.7 + f3.run(src) * 0.35;
      const envl = Math.min(1, t * 12) * Math.min(1, (1 - t) * 8);
      out[pos + i] += (formant * 2.2 + sine * 0.15) * envl * (dropout ? 0.05 : 1);
    }
    prevF = s.vowel;
    pos += N + Math.floor(s.gapAfter * (1 + deg * 0.2) * sr);
  }
  // tape: band limit + wow + hiss
  if (p.tape) {
    const hp = new Biquad('hp', 300, 0.7, sr);
    const lp = new Biquad('lp', 3000, 0.7, sr);
    for (let i = 0; i < out.length; i++) out[i] = lp.run(hp.run(out[i])) + (rng.next() * 2 - 1) * 0.012;
  }
  // stage 4: stutters (repeat short slices)
  if (deg >= 3) {
    const slice = Math.floor(sr * 0.06);
    for (let k = 0; k < deg * 2; k++) {
      const at = Math.floor(rng.range(0.1, 0.8) * (out.length - slice * 3));
      for (let i = 0; i < slice; i++) out[at + slice + i] = out[at + i];
    }
  }
  let m = 0;
  for (let i = 0; i < out.length; i++) m = Math.max(m, Math.abs(out[i]));
  const k = m > 0 ? (0.85 / m) * p.gain : 1;
  const fade = Math.floor(sr * 0.01);
  for (let i = 0; i < out.length; i++) {
    out[i] *= k;
    if (i < fade) out[i] *= i / fade;
    if (i > out.length - fade) out[i] *= (out.length - i) / fade;
  }
  return out;
}
