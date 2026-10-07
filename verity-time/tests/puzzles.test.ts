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

import { carouselInit, carouselPress, carouselProgress, SONG, BELL_NOTE } from '@/puzzles/carousel';
import { shadowInit, shadowMove, shadowFlip, SHADOW_TARGET, PUPPETS, SLOTS } from '@/puzzles/shadow';

describe('P8 carousel bells', () => {
  it('the song is Verity\'s motif E-G-C-B', () => {
    expect(SONG.map((b) => BELL_NOTE[b])).toEqual([76, 79, 84, 83]);
  });
  it('accepts the song after wrong notes (rolling window)', () => {
    const s = carouselInit();
    for (const b of ['red', 'yellow', 'green', 'red'] as const) expect(carouselPress(s, b)).toBe('note');
    expect(carouselProgress(s)).toBe(0);
    carouselPress(s, 'yellow');
    carouselPress(s, 'green');
    expect(carouselProgress(s)).toBe(2);
    carouselPress(s, 'purple');
    expect(carouselPress(s, 'blue')).toBe('done');
    expect(s.done).toBe(true);
  });
  it('the song in another order does not count', () => {
    const s = carouselInit();
    for (const b of ['yellow', 'green', 'blue', 'purple'] as const) carouselPress(s, b);
    expect(s.done).toBe(false);
  });
});

describe('P9 shadow theatre', () => {
  it('starts unsolved and is solvable with moves and flips', () => {
    const s = shadowInit();
    expect(s.done).toBe(false);
    for (const id of PUPPETS) {
      let guard = 0;
      while (s.p[id].slot !== SHADOW_TARGET[id].slot && guard++ < SLOTS) shadowMove(s, id);
      if (s.p[id].flip !== SHADOW_TARGET[id].flip) shadowFlip(s, id);
    }
    expect(s.done).toBe(true);
  });
  it('a wrong facing keeps it locked', () => {
    const s = shadowInit();
    s.p.child = { ...SHADOW_TARGET.child };
    s.p.verity = { ...SHADOW_TARGET.verity, flip: !SHADOW_TARGET.verity.flip };
    s.p.dog = { ...SHADOW_TARGET.dog };
    expect(shadowFlip(s, 'dog')).toBe(false);
    shadowFlip(s, 'dog');
    expect(shadowFlip(s, 'verity')).toBe(true);
  });
});
