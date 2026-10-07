import { describe, expect, it } from 'vitest';
import { CollisionWorld } from '@/physics/CollisionWorld';
import { Coroutines, type CoGen } from '@/core/Coroutines';
import { EventBus, type GameEvents } from '@/core/EventBus';
import { GameState } from '@/core/GameState';
import { SaveSystem } from '@/core/SaveSystem';
import { loadSettings, saveSettings, defaultSettings } from '@/core/Settings';

class MemStorage {
  m = new Map<string, string>();
  get length() { return this.m.size; }
  clear() { this.m.clear(); }
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
}

describe('CollisionWorld', () => {
  it('blocks movement through a wall and slides along it', () => {
    const w = new CollisionWorld();
    w.add({ x: 1, y: 0, z: -5 }, { x: 1.2, y: 3, z: 5 }); // wall at x=1
    const p = { x: 0, y: 0, z: 0 };
    w.slide(p, 2, 0.5, 0.3, 1.7, 0.35);
    expect(p.x).toBeLessThanOrEqual(1 - 0.3 + 1e-6);
    expect(p.z).toBeCloseTo(0.5, 3);
  });
  it('steps over low boxes and reports ground height', () => {
    const w = new CollisionWorld();
    w.add({ x: -10, y: -1, z: -10 }, { x: 10, y: 0, z: 10 }); // floor
    w.add({ x: 1, y: 0, z: -1 }, { x: 2, y: 0.25, z: 1 }); // step
    const p = { x: 0, y: 0, z: 0 };
    w.slide(p, 1.5, 0, 0.3, 1.7, 0.35);
    expect(p.x).toBeCloseTo(1.5, 3);
    expect(w.groundHeight(p.x, p.z, 0.3, p.y + 0.35)).toBeCloseTo(0.25, 3);
  });
  it('does not tunnel through thin walls at high speed', () => {
    const w = new CollisionWorld();
    w.add({ x: 1, y: 0, z: -5 }, { x: 1.05, y: 3, z: 5 });
    const p = { x: 0, y: 0, z: 0 };
    w.slide(p, 10, 0, 0.3, 1.7, 0.35);
    expect(p.x).toBeLessThan(1);
  });
  it('ramps give interpolated ground height', () => {
    const w = new CollisionWorld();
    w.add({ x: 0, y: 0, z: 0 }, { x: 4, y: 2, z: 2 }, { ramp: { axis: 'x', dir: 1 } });
    expect(w.groundHeight(2, 1, 0.3, 5)).toBeCloseTo(1, 3);
  });
  it('raycasts and line of sight', () => {
    const w = new CollisionWorld();
    w.add({ x: 4, y: 0, z: -1 }, { x: 5, y: 3, z: 1 });
    const h = w.raycast({ x: 0, y: 1, z: 0 }, { x: 1, y: 0, z: 0 }, 10);
    expect(h?.dist).toBeCloseTo(4, 5);
    expect(h?.normal.x).toBe(-1);
    expect(w.lineOfSight({ x: 0, y: 1, z: 0 }, { x: 8, y: 1, z: 0 })).toBe(false);
    expect(w.lineOfSight({ x: 0, y: 1, z: 3 }, { x: 8, y: 1, z: 3 })).toBe(true);
  });
});

describe('Coroutines', () => {
  it('waits on time, predicates and children', () => {
    const co = new Coroutines();
    const log: string[] = [];
    let gate = false;
    function* child(): CoGen { yield 0.5; log.push('child'); }
    function* main(): CoGen {
      log.push('a');
      yield 1;
      log.push('b');
      yield () => gate;
      log.push('c');
      yield co.start(child());
      log.push('d');
    }
    co.start(main());
    expect(log).toEqual(['a']);
    co.update(0.6); expect(log).toEqual(['a']);
    co.update(0.6); expect(log).toEqual(['a', 'b']);
    co.update(0.1); expect(log).toEqual(['a', 'b']);
    gate = true;
    co.update(0.1); expect(log).toEqual(['a', 'b', 'c']);
    co.update(0.6); co.update(0.01);
    expect(log).toEqual(['a', 'b', 'c', 'child', 'd']);
  });
  it('can be cancelled by tag', () => {
    const co = new Coroutines();
    let ran = false;
    co.start((function* (): CoGen { yield 1; ran = true; })(), 'x');
    co.stop('x');
    co.update(2);
    expect(ran).toBe(false);
  });
});

describe('Save system', () => {
  it('round-trips state through storage', () => {
    const st = new MemStorage() as unknown as Storage;
    const bus = new EventBus<GameEvents>();
    const gs = new GameState(bus);
    gs.set('door.a', true);
    gs.addItem('fuse');
    gs.puzzle('p1', () => ({ breakers: [1, 0, 1] }));
    gs.findSecret('s1');
    const sv = new SaveSystem(st);
    expect(sv.write('slot1', gs.snapshot(), { zoneName: 'Холл', chapter: 'I', playTime: 12 })).toBe(true);
    const f = sv.read('slot1')!;
    expect(f.state.flags['door.a']).toBe(true);
    expect(f.state.inventory).toEqual(['fuse']);
    expect((f.state.puzzles.p1 as any).breakers).toEqual([1, 0, 1]);
    expect(sv.latest()?.meta.slot).toBe('slot1');
  });
  it('returns null for corrupt saves', () => {
    const st = new MemStorage() as unknown as Storage;
    st.setItem('verity-time.save.slot2', '{broken');
    expect(new SaveSystem(st).read('slot2')).toBeNull();
  });
  it('settings persist and merge with defaults', () => {
    const st = new MemStorage() as unknown as Storage;
    const s = defaultSettings();
    s.fov = 90;
    s.bindings.jump = ['KeyX'];
    saveSettings(s, st);
    const l = loadSettings(st);
    expect(l.fov).toBe(90);
    expect(l.bindings.jump).toEqual(['KeyX']);
    expect(l.bindings.forward).toEqual(['KeyW', 'ArrowUp']);
  });
});
