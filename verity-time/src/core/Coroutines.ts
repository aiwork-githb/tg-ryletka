/**
 * Frame-driven coroutine runner. Scripted events, cinematics and puzzle
 * sequences are written as generator functions that yield:
 *   - a number        → wait that many (game) seconds
 *   - a function      → wait until it returns true
 *   - a CoHandle      → wait until that coroutine finishes
 *   - a Promise       → wait until it settles
 *   - null/undefined  → wait one frame
 * Coroutines respect pause (they only advance from Game.update).
 */
export type Yieldable = number | (() => boolean) | CoHandle | Promise<unknown> | null | undefined | void;
export type CoGen = Generator<Yieldable, void, unknown>;

export class CoHandle {
  done = false;
  cancelled = false;
  waitTime = 0;
  waitFn: (() => boolean) | null = null;
  waitChild: CoHandle | null = null;
  waitPromise = false;
  constructor(public gen: CoGen, public tag: string) {}
  cancel(): void {
    if (this.done) return;
    this.cancelled = true;
    this.done = true;
    try {
      this.gen.return();
    } catch {
      /* ignore */
    }
  }
}

export class Coroutines {
  private list: CoHandle[] = [];

  start(gen: CoGen, tag = ''): CoHandle {
    const h = new CoHandle(gen, tag);
    this.list.push(h);
    this.step(h); // run synchronously until the first yield
    return h;
  }

  /** Cancels all coroutines, or only those with the given tag. */
  stop(tag?: string): void {
    for (const h of this.list) if (tag === undefined || h.tag === tag) h.cancel();
    this.list = this.list.filter((h) => !h.done);
  }

  isRunning(tag: string): boolean {
    return this.list.some((h) => !h.done && h.tag === tag);
  }

  update(dt: number): void {
    // iterate over a snapshot: coroutines may start others
    const snapshot = this.list.slice();
    for (const h of snapshot) {
      if (h.done) continue;
      if (h.waitTime > 0) {
        h.waitTime -= dt;
        if (h.waitTime > 0) continue;
      }
      if (h.waitFn) {
        let ok = false;
        try {
          ok = h.waitFn();
        } catch (e) {
          console.error('[co] wait predicate threw', e);
          ok = true;
        }
        if (!ok) continue;
        h.waitFn = null;
      }
      if (h.waitChild) {
        if (!h.waitChild.done) continue;
        h.waitChild = null;
      }
      if (h.waitPromise) continue;
      this.step(h);
    }
    if (this.list.some((h) => h.done)) this.list = this.list.filter((h) => !h.done);
  }

  private step(h: CoHandle): void {
    let r: IteratorResult<Yieldable, void>;
    try {
      r = h.gen.next();
    } catch (e) {
      console.error(`[co] coroutine "${h.tag}" threw`, e);
      h.done = true;
      return;
    }
    if (r.done) {
      h.done = true;
      return;
    }
    const v = r.value;
    if (typeof v === 'number') h.waitTime = v;
    else if (typeof v === 'function') h.waitFn = v as () => boolean;
    else if (v instanceof CoHandle) h.waitChild = v;
    else if (v && typeof (v as Promise<unknown>).then === 'function') {
      h.waitPromise = true;
      (v as Promise<unknown>).finally(() => (h.waitPromise = false));
    }
  }
}
