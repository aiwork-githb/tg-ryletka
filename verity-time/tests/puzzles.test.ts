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

import { conveyorRoute } from '@/puzzles/conveyor';
import { isTarget, mixColor, colorDistance, TARGET_COLOR, MAX_UNITS, type Pigment } from '@/puzzles/paint';
import { relayInit, relayInput, RELAY_ORDER } from '@/puzzles/relay';

describe('P3 conveyor', () => {
  it('has exactly one route to the QA tray', () => {
    let qa = 0;
    for (let i = 0; i < 8; i++) {
      const d: [boolean, boolean, boolean] = [!!(i & 1), !!(i & 2), !!(i & 4)];
      if (conveyorRoute(d).outlet === 'qa') qa++;
    }
    expect(qa).toBe(1);
  });
  it('the correct setting is D1 straight, D2 straight, D3 turn', () => {
    expect(conveyorRoute([false, false, true]).outlet).toBe('qa');
  });
});

describe('P4 paint', () => {
  it('only the exact recipe matches and it is the closest colour', () => {
    let best = Infinity;
    let bestRecipe = '';
    let matches = 0;
    for (let y = 0; y <= MAX_UNITS; y++)
      for (let m = 0; m <= MAX_UNITS; m++)
        for (let c = 0; c <= MAX_UNITS; c++)
          for (let w = 0; w <= MAX_UNITS; w++) {
            const u: Record<Pigment, number> = { Y: y, M: m, C: c, W: w };
            if (isTarget(u)) matches++;
            const d = colorDistance(mixColor(u), TARGET_COLOR);
            if (d < best && !isTarget(u)) best = d;
            if (d === 0 && !isTarget(u)) bestRecipe = `${y}${m}${c}${w}`;
          }
    expect(matches).toBe(1);
    expect(bestRecipe).toBe('');
    expect(best).toBeGreaterThan(0.005);
  });
});

describe('P5 relay', () => {
  it('accepts the demonstrated order and resets on mistakes', () => {
    const s = relayInit();
    expect(relayInput(s, RELAY_ORDER[0])).toBe('ok');
    expect(relayInput(s, 'blue')).toBe('fail');
    expect(s.progress).toBe(0);
    for (let i = 0; i < 3; i++) expect(relayInput(s, RELAY_ORDER[i])).toBe('ok');
    expect(relayInput(s, RELAY_ORDER[3])).toBe('done');
  });
});
