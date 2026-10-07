/**
 * P4 — Paint mixing. Four pigment tanks (units 0..4) mix in the vat.
 * Subtractive-ish model in linear RGB; the target is "Verity Yellow".
 */
export type Pigment = 'Y' | 'M' | 'C' | 'W';
export const PIGMENTS: Pigment[] = ['Y', 'M', 'C', 'W'];
export const PIGMENT_NAMES: Record<Pigment, string> = { Y: 'Жёлтый', M: 'Пурпурный', C: 'Голубой', W: 'Белила' };
export const TARGET: Record<Pigment, number> = { Y: 3, M: 1, C: 0, W: 1 };
export const MAX_UNITS = 4;

// absorption of R,G,B per unit (0 = reflects fully)
const ABS: Record<Exclude<Pigment, 'W'>, [number, number, number]> = {
  Y: [0.02, 0.08, 0.85],
  M: [0.05, 0.75, 0.25],
  C: [0.8, 0.12, 0.05],
};

/** Colour (0..1 sRGB-ish) of a mix. Empty vat returns a dark grey. */
export function mixColor(u: Record<Pigment, number>): [number, number, number] {
  const total = u.Y + u.M + u.C + u.W;
  if (total === 0) return [0.12, 0.12, 0.12];
  const coloured = u.Y + u.M + u.C;
  let r = 1;
  let g = 1;
  let b = 1;
  if (coloured > 0) {
    // weighted average absorption, scaled by concentration
    const conc = coloured / total;
    let ar = 0;
    let ag = 0;
    let ab = 0;
    for (const p of ['Y', 'M', 'C'] as const) {
      const w = u[p] / coloured;
      ar += ABS[p][0] * w;
      ag += ABS[p][1] * w;
      ab += ABS[p][2] * w;
    }
    const k = 0.35 + conc * 0.65;
    r = 1 - ar * k;
    g = 1 - ag * k;
    b = 1 - ab * k;
  }
  // white brightens but the vat is never pure white
  const bright = 0.82 + (u.W / total) * 0.15;
  return [r * bright, g * bright, b * bright];
}

export function colorDistance(a: [number, number, number], b: [number, number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

export function isTarget(u: Record<Pigment, number>): boolean {
  return PIGMENTS.every((p) => u[p] === TARGET[p]);
}

export const TARGET_COLOR = mixColor(TARGET);
