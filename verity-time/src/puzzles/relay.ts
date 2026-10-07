/**
 * P5 — FriendLink relay. Four star receivers must be signalled in the order
 * Verity demonstrates. Wrong input resets progress.
 */
export type StarColor = 'red' | 'blue' | 'yellow' | 'green';
export const RELAY_ORDER: StarColor[] = ['yellow', 'red', 'green', 'blue'];

export interface RelayState {
  progress: number;
  failures: number;
  done: boolean;
}

export function relayInit(): RelayState {
  return { progress: 0, failures: 0, done: false };
}

/** Returns 'ok' (correct step), 'done' (sequence complete) or 'fail'. */
export function relayInput(s: RelayState, c: StarColor): 'ok' | 'done' | 'fail' {
  if (s.done) return 'done';
  if (RELAY_ORDER[s.progress] === c) {
    s.progress++;
    if (s.progress >= RELAY_ORDER.length) {
      s.done = true;
      return 'done';
    }
    return 'ok';
  }
  s.progress = c === RELAY_ORDER[0] ? 1 : 0;
  s.failures++;
  return 'fail';
}
