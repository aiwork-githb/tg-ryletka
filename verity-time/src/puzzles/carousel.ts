/**
 * P8 — carousel bells. Six coloured bells on the carousel control booth;
 * playing Verity's four-note signature (heard every time he appears, and
 * drawn in colour on Theo's "song sheet") starts the carousel.
 */
export type Bell = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple';
export const BELLS: Bell[] = ['red', 'orange', 'yellow', 'green', 'blue', 'purple'];
/** MIDI note of each bell: C5 D5 E5 G5 B5 C6. */
export const BELL_NOTE: Record<Bell, number> = { red: 72, orange: 74, yellow: 76, green: 79, blue: 83, purple: 84 };
export const BELL_COLOR: Record<Bell, string> = { red: '#d9443a', orange: '#e8892f', yellow: '#f4d35e', green: '#3fae5a', blue: '#3a78d9', purple: '#9b59b6' };
export const BELL_NAME: Record<Bell, string> = { red: 'красный', orange: 'оранжевый', yellow: 'жёлтый', green: 'зелёный', blue: 'синий', purple: 'фиолетовый' };
/** Verity's signature E-G-C-B. */
export const SONG: Bell[] = ['yellow', 'green', 'purple', 'blue'];

export interface CarouselState {
  powered: boolean;
  heard: Bell[];
  presses: number;
  done: boolean;
}

export function carouselInit(): CarouselState {
  return { powered: false, heard: [], presses: 0, done: false };
}

/** Feeds one bell; returns 'done' when the last four notes are the song. */
export function carouselPress(s: CarouselState, b: Bell): 'note' | 'done' {
  if (s.done) return 'done';
  s.presses++;
  s.heard.push(b);
  if (s.heard.length > SONG.length) s.heard.shift();
  if (s.heard.length === SONG.length && s.heard.every((x, i) => x === SONG[i])) {
    s.done = true;
    return 'done';
  }
  return 'note';
}

/** How many leading notes of the song the current tail matches (for the lamp feedback). */
export function carouselProgress(s: CarouselState): number {
  for (let n = Math.min(s.heard.length, SONG.length); n > 0; n--) {
    const tail = s.heard.slice(s.heard.length - n);
    if (tail.every((x, i) => x === SONG[i])) return n;
  }
  return 0;
}
