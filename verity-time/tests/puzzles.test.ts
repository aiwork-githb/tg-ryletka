import { describe, expect, it } from 'vitest';
import { breakerInit, breakerToggle, breakerLoad, breakerPowered, BREAKER_CAP } from '@/puzzles/breaker';

describe('P1 breaker panel', () => {
  it('needs the fuse before anything is powered', () => {
    const s = breakerInit();
    breakerToggle(s, 1);
    expect(breakerPowered(s, 1)).toBe(false);
    s.fuse = true;
    expect(breakerPowered(s, 1)).toBe(true);
  });
  it('trips when exceeding capacity and turns everything off', () => {
    const s = breakerInit();
    s.fuse = true;
    breakerToggle(s, 0); // 20
    breakerToggle(s, 1); // 35
    breakerToggle(s, 5); // 70 -> trip
    expect(s.trips).toBe(1);
    expect(s.on.every((x) => !x)).toBe(true);
  });
  it('the intended solution (turnstiles + TV + stage) fits exactly', () => {
    const s = breakerInit();
    s.fuse = true;
    for (const i of [1, 4, 5]) expect(breakerToggle(s, i)).toBe(false);
    expect(breakerLoad(s)).toBe(BREAKER_CAP);
  });
  it('lights + turnstiles + stage cannot run together', () => {
    const s = breakerInit();
    s.fuse = true;
    breakerToggle(s, 0);
    breakerToggle(s, 1);
    expect(breakerToggle(s, 5)).toBe(true);
  });
});
