import { migrate, type GameStateData } from './GameState';
import { safeStorage } from './Settings';

export type SlotId = 'auto' | 'slot1' | 'slot2' | 'slot3';
export const SLOTS: SlotId[] = ['auto', 'slot1', 'slot2', 'slot3'];

export interface SaveMeta {
  slot: SlotId;
  time: number;
  zoneName: string;
  chapter: string;
  playTime: number;
  thumb?: string;
}

export interface SaveFile {
  meta: SaveMeta;
  state: GameStateData;
}

const PREFIX = 'verity-time.save.';

/**
 * Saves are JSON in localStorage (Electron persists it under the user's
 * AppData). Each write goes to a temp key first so a crash mid-write cannot
 * corrupt an existing save.
 */
export class SaveSystem {
  constructor(private storage: Storage | null = safeStorage()) {}

  write(slot: SlotId, state: GameStateData, meta: Omit<SaveMeta, 'slot' | 'time'>): boolean {
    if (!this.storage) return false;
    const file: SaveFile = { meta: { ...meta, slot, time: Date.now() }, state };
    const json = JSON.stringify(file);
    try {
      this.storage.setItem(PREFIX + slot + '.tmp', json);
      this.storage.setItem(PREFIX + slot, json);
      this.storage.removeItem(PREFIX + slot + '.tmp');
      return true;
    } catch (e) {
      // quota: retry without thumbnail
      if (meta.thumb) return this.write(slot, state, { ...meta, thumb: undefined });
      console.error('[save] failed', e);
      return false;
    }
  }

  read(slot: SlotId): SaveFile | null {
    if (!this.storage) return null;
    const raw = this.storage.getItem(PREFIX + slot) ?? this.storage.getItem(PREFIX + slot + '.tmp');
    if (!raw) return null;
    try {
      const f = JSON.parse(raw) as SaveFile;
      if (!f?.state || !f.meta) return null;
      f.state = migrate(f.state);
      return f;
    } catch {
      return null;
    }
  }

  list(): Array<SaveMeta | null> {
    return SLOTS.map((s) => this.read(s)?.meta ?? null);
  }

  latest(): SaveFile | null {
    let best: SaveFile | null = null;
    for (const s of SLOTS) {
      const f = this.read(s);
      if (f && (!best || f.meta.time > best.meta.time)) best = f;
    }
    return best;
  }

  remove(slot: SlotId): void {
    this.storage?.removeItem(PREFIX + slot);
  }
}
