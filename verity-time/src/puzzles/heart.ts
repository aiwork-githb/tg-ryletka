/**
 * P12 — the Heart vault. Three pedestals around the Core ask the three
 * things the whole building has been telling you:
 *   КТО ТЫ?                 — a living Friend's palm (you are No. 12)
 *   КОГДА ВСЁ ОСТАНОВИЛОСЬ? — the hour every clock shows: 19:00
 *   ЧТО ТЫ ОБЕЩАЛ?          — the words from the KR-07 film: «Я вернусь»
 */
export const PROMISES = ['Пока, Верити.', 'Я вернусь.', 'Не плачь.', 'Прости меня.'];
export const PROMISE_ANSWER = 1;

export interface HeartState {
  palm: boolean;
  time: boolean;
  word: boolean;
  open: boolean;
  wrong: number;
}

export function heartInit(): HeartState {
  return { palm: false, time: false, word: false, open: false, wrong: 0 };
}

export function heartTime(s: HeartState, hours: number, minutes: number): boolean {
  const ok = hours === 19 && minutes === 0;
  if (ok) s.time = true;
  else s.wrong++;
  return heartCheck(s) || ok;
}

export function heartWord(s: HeartState, i: number): boolean {
  const ok = i === PROMISE_ANSWER;
  if (ok) s.word = true;
  else s.wrong++;
  return heartCheck(s) || ok;
}

export function heartCheck(s: HeartState): boolean {
  s.open = s.palm && s.time && s.word;
  return s.open;
}

/** Which endings the final console offers. */
export function endingsAvailable(hasTape: boolean, lies: number): { shutdown: true; release: true; goodbye: boolean; tapeRejected: boolean } {
  return { shutdown: true, release: true, goodbye: hasTape && lies === 0, tapeRejected: hasTape && lies > 0 };
}
