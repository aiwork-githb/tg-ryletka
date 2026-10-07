/** Minimal typed event bus used for decoupled communication between systems. */
export type Handler<T = unknown> = (payload: T) => void;

export class EventBus<Events extends Record<string, unknown>> {
  private handlers = new Map<keyof Events, Set<Handler<any>>>();

  on<K extends keyof Events>(type: K, fn: Handler<Events[K]>): () => void {
    let set = this.handlers.get(type);
    if (!set) this.handlers.set(type, (set = new Set()));
    set.add(fn);
    return () => set!.delete(fn);
  }

  once<K extends keyof Events>(type: K, fn: Handler<Events[K]>): () => void {
    const off = this.on(type, (p) => {
      off();
      fn(p);
    });
    return off;
  }

  emit<K extends keyof Events>(type: K, payload: Events[K]): void {
    const set = this.handlers.get(type);
    if (!set) return;
    for (const fn of [...set]) fn(payload);
  }

  clear(): void {
    this.handlers.clear();
  }
}

export interface GameEvents extends Record<string, unknown> {
  'flag': { key: string; value: unknown };
  'item:add': { id: string };
  'item:remove': { id: string };
  'doc:read': { id: string };
  'log:play': { id: string };
  'secret': { id: string };
  'puzzle:solved': { id: string };
  'zone:enter': { id: string };
  'zone:leave': { id: string };
  'checkpoint': { id: string };
  'player:caught': { by: string };
  'noise': { x: number; y: number; z: number; radius: number; source: string };
  'notify': { text: string; kind?: 'item' | 'objective' | 'info' | 'secret' | 'save' };
  'objective': { text: string };
  'subtitle': { speaker?: string; text: string; duration: number; color?: string };
  'settings:changed': { key: string };
  'fear': { amount: number };
}
