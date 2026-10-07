/**
 * P11 — the great music box ("Шкатулка") that Theo turned into the lock of
 * the lift to the Core. Four giant tines must sound the first bar of his
 * lullaby. Tuning works only through the tone module on a live bracelet —
 * and a live bracelet is something Verity can always find.
 */
export const TINE_NOTES = [72, 74, 76, 77, 79, 81, 83, 84]; // C D E F G A B C
export const NOTE_NAME = ['до', 'ре', 'ми', 'фа', 'соль', 'ля', 'си', 'до²'];
/** Colours shared with the carousel bells (C red, D orange, E yellow, G green, B blue, C² purple). */
export const NOTE_COLOR = ['#d9443a', '#e8892f', '#f4d35e', '#ef8ab8', '#3fae5a', '#7fd0c8', '#3a78d9', '#9b59b6'];
/** Theo's lullaby, first bar: соль — ми — ре — до. */
export const LULLABY = [4, 2, 1, 0];

export interface MusicBoxState {
  tines: number[];
  plays: number;
  done: boolean;
}

export function musicInit(): MusicBoxState {
  return { tines: [2, 5, 0, 7], plays: 0, done: false };
}

export function musicTune(s: MusicBoxState, i: number, dir = 1): number {
  if (s.done) return s.tines[i];
  s.tines[i] = (s.tines[i] + dir + TINE_NOTES.length) % TINE_NOTES.length;
  return s.tines[i];
}

/** Plays the box; returns the notes and whether the lock released. */
export function musicPlay(s: MusicBoxState): { notes: number[]; open: boolean } {
  s.plays++;
  const notes = s.tines.map((t) => TINE_NOTES[t]);
  s.done = s.done || s.tines.every((t, i) => t === LULLABY[i]);
  return { notes, open: s.done };
}

/** How many tines already sound right (lamp feedback on the case). */
export function musicCorrect(s: MusicBoxState): number {
  return s.tines.filter((t, i) => t === LULLABY[i]).length;
}
