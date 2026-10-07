import type { EventBus, GameEvents } from './EventBus';

export type FlagValue = boolean | number | string;

export interface PlayerSnapshot {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  crouched: boolean;
  flashlight: boolean;
}

/** Everything that defines progress. Fully JSON-serialisable. */
export interface GameStateData {
  version: number;
  zone: string;
  checkpoint: string;
  player: PlayerSnapshot | null;
  flags: Record<string, FlagValue>;
  inventory: string[];
  docs: string[];
  logs: string[];
  secrets: string[];
  puzzles: Record<string, unknown>;
  objective: string;
  chapter: string;
  playTime: number;
  deaths: number;
}

export const STATE_VERSION = 1;

export function freshState(): GameStateData {
  return {
    version: STATE_VERSION,
    zone: 'lobby',
    checkpoint: 'start',
    player: null,
    flags: {},
    inventory: [],
    docs: [],
    logs: [],
    secrets: [],
    puzzles: {},
    objective: '',
    chapter: 'Акт I. Добро пожаловать',
    playTime: 0,
    deaths: 0,
  };
}

/** Thin wrapper around the data with change notifications. */
export class GameState {
  data: GameStateData = freshState();
  constructor(private bus: EventBus<GameEvents>) {}

  reset(): void {
    this.data = freshState();
  }

  load(d: GameStateData): void {
    this.data = migrate(structuredClone(d));
  }

  snapshot(): GameStateData {
    return structuredClone(this.data);
  }

  // ---- flags --------------------------------------------------------------
  get(key: string): FlagValue | undefined {
    return this.data.flags[key];
  }
  is(key: string): boolean {
    return !!this.data.flags[key];
  }
  num(key: string): number {
    const v = this.data.flags[key];
    return typeof v === 'number' ? v : 0;
  }
  set(key: string, value: FlagValue = true): void {
    if (this.data.flags[key] === value) return;
    this.data.flags[key] = value;
    this.bus.emit('flag', { key, value });
  }
  inc(key: string, by = 1): number {
    const v = this.num(key) + by;
    this.set(key, v);
    return v;
  }

  // ---- inventory ----------------------------------------------------------
  has(item: string): boolean {
    return this.data.inventory.includes(item);
  }
  addItem(item: string): void {
    if (this.has(item)) return;
    this.data.inventory.push(item);
    this.bus.emit('item:add', { id: item });
  }
  removeItem(item: string): void {
    const i = this.data.inventory.indexOf(item);
    if (i < 0) return;
    this.data.inventory.splice(i, 1);
    this.bus.emit('item:remove', { id: item });
  }

  // ---- collectables -------------------------------------------------------
  readDoc(id: string): boolean {
    if (this.data.docs.includes(id)) return false;
    this.data.docs.push(id);
    this.bus.emit('doc:read', { id });
    return true;
  }
  hearLog(id: string): boolean {
    if (this.data.logs.includes(id)) return false;
    this.data.logs.push(id);
    this.bus.emit('log:play', { id });
    return true;
  }
  findSecret(id: string): boolean {
    if (this.data.secrets.includes(id)) return false;
    this.data.secrets.push(id);
    this.bus.emit('secret', { id });
    return true;
  }

  // ---- puzzles ------------------------------------------------------------
  puzzle<T>(id: string, init: () => T): T {
    if (!(id in this.data.puzzles)) this.data.puzzles[id] = init();
    return this.data.puzzles[id] as T;
  }
  solved(id: string): boolean {
    return this.is('solved.' + id);
  }
  markSolved(id: string): void {
    if (this.solved(id)) return;
    this.set('solved.' + id, true);
    this.bus.emit('puzzle:solved', { id });
  }

  setObjective(text: string): void {
    if (this.data.objective === text) return;
    this.data.objective = text;
    this.bus.emit('objective', { text });
  }
}

export function migrate(d: GameStateData): GameStateData {
  const f = freshState();
  const out = { ...f, ...d };
  out.flags ??= {};
  out.puzzles ??= {};
  out.version = STATE_VERSION;
  return out;
}
