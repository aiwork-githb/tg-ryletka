/**
 * P3 — Line B sorting conveyor. A returned box travels through three
 * two-way diverters; only one route ends at the QA pickup tray.
 *
 *   START ─ D1 ─┬─ straight ─ D2 ─┬─ straight ─ D3 ─┬─ straight → PACKING (sealed crate)
 *               │                 │                 └─ turn → QA_TRAY  ✔
 *               │                 └─ turn → PAINT (lost into the paint chute)
 *               └─ turn → RECYCLE (shredder)
 */
export type Outlet = 'recycle' | 'paint' | 'packing' | 'qa';

export interface ConveyorState {
  /** false = straight, true = turn */
  d: [boolean, boolean, boolean];
  powered: boolean;
  delivered: boolean;
  runs: number;
}

export function conveyorInit(): ConveyorState {
  return { d: [true, false, false], powered: false, delivered: false, runs: 0 };
}

export function conveyorRoute(d: [boolean, boolean, boolean]): { outlet: Outlet; path: string[] } {
  if (d[0]) return { outlet: 'recycle', path: ['start', 'd1', 'recycle'] };
  if (d[1]) return { outlet: 'paint', path: ['start', 'd1', 'd2', 'paint'] };
  if (d[2]) return { outlet: 'qa', path: ['start', 'd1', 'd2', 'd3', 'qa'] };
  return { outlet: 'packing', path: ['start', 'd1', 'd2', 'd3', 'packing'] };
}

export const OUTLET_TEXT: Record<Outlet, string> = {
  recycle: 'Коробка ушла в измельчитель вторсырья. Через минуту линия вернёт «брак» в начало.',
  paint: 'Коробка уехала в жёлоб покрасочного цеха. Линия вернёт её в начало.',
  packing: 'Коробку запечатали в ящик на упаковке. Линия вернёт её как брак.',
  qa: 'Коробка упала в лоток выдачи ОТК.',
};
