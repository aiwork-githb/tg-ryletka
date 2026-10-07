/**
 * P10 — steam distribution board in the Old Works boiler hall. Six valves
 * route the boiler's steam to four outlets; the old freight lift needs both
 * of its pistons fed and nothing else open. The pipes are physically traced
 * in the hall: up to the whistle on the roof, into the wall marked
 * "ХОЛОДИЛЬНИК", and down to the two lift pistons.
 */
export type Outlet = 'liftA' | 'liftB' | 'whistle' | 'cold';
export const VALVES = 6;

/** Every outlet with the valves its steam passes through. */
export const STEAM_NET: Array<{ valves: number[]; to: Outlet }> = [
  { valves: [0, 1], to: 'liftA' },
  { valves: [0, 2], to: 'whistle' },
  { valves: [3, 4], to: 'cold' },
  { valves: [3, 5], to: 'liftB' },
];

export interface SteamState {
  lit: boolean;
  /** Boiler pressure 0..1 (builds up after lighting). */
  pressure: number;
  open: boolean[];
  wheel: boolean;
  done: boolean;
}

export function steamInit(): SteamState {
  return { lit: false, pressure: 0, open: [true, false, true, true, true, false], wheel: false, done: false };
}

/** Pressure share arriving at each outlet. */
export function steamFlow(s: SteamState): Record<Outlet, number> {
  const out: Record<Outlet, number> = { liftA: 0, liftB: 0, whistle: 0, cold: 0 };
  const reached = STEAM_NET.filter((r) => r.valves.every((v) => s.open[v]));
  if (!reached.length) return out;
  const share = s.pressure / reached.length;
  for (const r of reached) out[r.to] = share;
  return out;
}

/** Lift pressure as a fraction of what the pistons need (1 = enough). */
export function liftPressure(s: SteamState): number {
  const f = steamFlow(s);
  if (f.liftA <= 0 || f.liftB <= 0) return Math.min(f.liftA, f.liftB) * 2;
  return f.liftA + f.liftB;
}

export function steamToggle(s: SteamState, v: number): boolean {
  if (!s.wheel || s.done) return s.done;
  s.open[v] = !s.open[v];
  return steamCheck(s);
}

export function steamCheck(s: SteamState): boolean {
  s.done = s.lit && s.pressure >= 0.99 && liftPressure(s) >= 0.99;
  return s.done;
}
