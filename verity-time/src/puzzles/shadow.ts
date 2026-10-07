/**
 * P9 — shadow theatre. Three cut-out puppets ride on rails behind the
 * screen; each has five slots and can be turned to face left or right.
 * The poster in the foyer shows the picture Theo set as the lock:
 * the child and Verity face each other hand in hand, the blue dog runs to them.
 */
export type PuppetId = 'child' | 'verity' | 'dog';
export const PUPPETS: PuppetId[] = ['child', 'verity', 'dog'];
export const SLOTS = 5;

export interface Puppet {
  slot: number;
  /** true = faces left. */
  flip: boolean;
}

export interface ShadowState {
  p: Record<PuppetId, Puppet>;
  done: boolean;
}

export const SHADOW_TARGET: Record<PuppetId, Puppet> = {
  child: { slot: 1, flip: false },
  verity: { slot: 2, flip: true },
  dog: { slot: 4, flip: true },
};

export function shadowInit(): ShadowState {
  return {
    p: {
      child: { slot: 4, flip: true },
      verity: { slot: 0, flip: false },
      dog: { slot: 2, flip: false },
    },
    done: false,
  };
}

export function shadowMove(s: ShadowState, id: PuppetId): boolean {
  if (s.done) return true;
  s.p[id].slot = (s.p[id].slot + 1) % SLOTS;
  return shadowCheck(s);
}

export function shadowFlip(s: ShadowState, id: PuppetId): boolean {
  if (s.done) return true;
  s.p[id].flip = !s.p[id].flip;
  return shadowCheck(s);
}

export function shadowCheck(s: ShadowState): boolean {
  s.done = PUPPETS.every((id) => s.p[id].slot === SHADOW_TARGET[id].slot && s.p[id].flip === SHADOW_TARGET[id].flip);
  return s.done;
}
