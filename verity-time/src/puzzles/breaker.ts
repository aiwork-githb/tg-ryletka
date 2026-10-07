/**
 * P1 — Breaker panel with limited generator capacity.
 * Six lines with different loads; the input breaker trips (turning every
 * line off) when the total exceeds the capacity.
 */
export const BREAKER_LINES = ['Освещение зала', 'Турникеты', 'Фонтан', 'Неон фасада', 'Автоматы и ТВ', 'Сцена театра'];
export const BREAKER_LOADS = [20, 15, 25, 30, 10, 35];
export const BREAKER_CAP = 60;
/** Labels legible on the panel itself (others are worn off). */
export const BREAKER_LABEL_VISIBLE = [true, false, true, false, false, true];

export interface BreakerState {
  fuse: boolean;
  on: boolean[];
  trips: number;
}

export function breakerInit(): BreakerState {
  return { fuse: false, on: [false, false, false, false, false, false], trips: 0 };
}

export function breakerLoad(s: BreakerState): number {
  if (!s.fuse) return 0;
  return s.on.reduce((sum, on, i) => sum + (on ? BREAKER_LOADS[i] : 0), 0);
}

/** Toggles a line; returns true if the input breaker tripped. */
export function breakerToggle(s: BreakerState, i: number): boolean {
  s.on[i] = !s.on[i];
  if (s.fuse && breakerLoad(s) > BREAKER_CAP) {
    s.on = s.on.map(() => false);
    s.trips++;
    return true;
  }
  return false;
}

/** Is a given line actually powered right now? */
export function breakerPowered(s: BreakerState, i: number): boolean {
  return s.fuse && s.on[i];
}
