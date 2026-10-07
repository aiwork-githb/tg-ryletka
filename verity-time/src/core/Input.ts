/**
 * Keyboard + mouse input with remappable actions.
 * Bindings are KeyboardEvent.code strings, or "Mouse0".."Mouse4" for buttons.
 */
export type Action =
  | 'forward'
  | 'back'
  | 'left'
  | 'right'
  | 'sprint'
  | 'crouch'
  | 'jump'
  | 'interact'
  | 'flashlight'
  | 'throw'
  | 'bracelet'
  | 'inventory'
  | 'journal'
  | 'pause';

export const ACTION_LABELS: Record<Action, string> = {
  forward: 'Вперёд',
  back: 'Назад',
  left: 'Влево',
  right: 'Вправо',
  sprint: 'Бег',
  crouch: 'Присесть',
  jump: 'Прыжок',
  interact: 'Взаимодействие',
  flashlight: 'Фонарик',
  throw: 'Бросить предмет',
  bracelet: 'Браслет «Друг»',
  inventory: 'Инвентарь',
  journal: 'Журнал',
  pause: 'Пауза',
};

export const DEFAULT_BINDINGS: Record<Action, string[]> = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  sprint: ['ShiftLeft'],
  crouch: ['KeyC', 'ControlLeft'],
  jump: ['Space'],
  interact: ['KeyE', 'Mouse0'],
  flashlight: ['KeyF'],
  throw: ['Mouse2', 'KeyG'],
  bracelet: ['KeyB'],
  inventory: ['Tab', 'KeyI'],
  journal: ['KeyJ'],
  pause: ['Escape', 'KeyP'],
};

export function keyLabel(code: string): string {
  if (!code) return '—';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  const map: Record<string, string> = {
    Mouse0: 'ЛКМ',
    Mouse1: 'СКМ',
    Mouse2: 'ПКМ',
    Mouse3: 'Мышь 4',
    Mouse4: 'Мышь 5',
    ShiftLeft: 'L-Shift',
    ShiftRight: 'R-Shift',
    ControlLeft: 'L-Ctrl',
    ControlRight: 'R-Ctrl',
    AltLeft: 'L-Alt',
    Space: 'Пробел',
    Escape: 'Esc',
    Tab: 'Tab',
    Enter: 'Enter',
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
    Backspace: 'Backspace',
  };
  return map[code] ?? code;
}

export class Input {
  private down = new Set<string>();
  private pressedFrame = new Set<string>();
  private releasedFrame = new Set<string>();
  bindings: Record<Action, string[]>;
  mouseDX = 0;
  mouseDY = 0;
  wheel = 0;
  locked = false;
  /** When false, gameplay input is ignored (menus open). */
  enabled = true;
  /** Callback used by the key-rebinding UI to capture the next key. */
  captureNext: ((code: string) => void) | null = null;
  onLockChange: ((locked: boolean) => void) | null = null;

  constructor(private canvas: HTMLCanvasElement, bindings: Record<Action, string[]>) {
    this.bindings = bindings;
    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
    window.addEventListener('mousedown', (e) => this.onMouse(e, true));
    window.addEventListener('mouseup', (e) => this.onMouse(e, false));
    window.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
    });
    window.addEventListener('wheel', (e) => (this.wheel += Math.sign(e.deltaY)), { passive: true });
    window.addEventListener('blur', () => this.down.clear());
    window.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
      if (!this.locked) this.down.clear();
      this.onLockChange?.(this.locked);
    });
  }

  requestLock(): void {
    if (document.pointerLockElement === this.canvas) return;
    try {
      const r = this.canvas.requestPointerLock() as unknown as Promise<void> | undefined;
      if (r && typeof r.catch === 'function') r.catch(() => undefined);
    } catch {
      /* not allowed without a gesture */
    }
  }

  exitLock(): void {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  private onKey(e: KeyboardEvent, isDown: boolean): void {
    if (isDown && this.captureNext) {
      e.preventDefault();
      const cb = this.captureNext;
      this.captureNext = null;
      cb(e.code);
      return;
    }
    // Prevent browser defaults for game keys (Tab focus, Space scroll...)
    if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'F1', 'F3'].includes(e.code)) e.preventDefault();
    if (e.ctrlKey && e.code === 'KeyW') e.preventDefault();
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) {
      // typing into a text field (terminal / keypad): only Escape passes through
      if (e.code !== 'Escape') return;
    }
    this.setKey(e.code, isDown);
  }

  private onMouse(e: MouseEvent, isDown: boolean): void {
    const code = 'Mouse' + e.button;
    if (isDown && this.captureNext) {
      const cb = this.captureNext;
      this.captureNext = null;
      cb(code);
      return;
    }
    if (!this.locked) return; // clicks on UI do not count as game input
    this.setKey(code, isDown);
  }

  private setKey(code: string, isDown: boolean): void {
    if (isDown) {
      if (!this.down.has(code)) this.pressedFrame.add(code);
      this.down.add(code);
    } else {
      if (this.down.has(code)) this.releasedFrame.add(code);
      this.down.delete(code);
    }
  }

  isDown(a: Action): boolean {
    if (!this.enabled && a !== 'pause') return false;
    return this.bindings[a].some((c) => this.down.has(c));
  }

  pressed(a: Action): boolean {
    if (!this.enabled && a !== 'pause' && a !== 'inventory' && a !== 'journal') return false;
    return this.bindings[a].some((c) => this.pressedFrame.has(c));
  }

  released(a: Action): boolean {
    return this.bindings[a].some((c) => this.releasedFrame.has(c));
  }

  rawPressed(code: string): boolean {
    return this.pressedFrame.has(code);
  }

  consumeMouse(): [number, number] {
    const r: [number, number] = [this.mouseDX, this.mouseDY];
    this.mouseDX = this.mouseDY = 0;
    return r;
  }

  /** Must be called once at the end of every frame. */
  endFrame(): void {
    this.pressedFrame.clear();
    this.releasedFrame.clear();
    this.wheel = 0;
  }

  /** Test/automation hook: simulate a key state. */
  simulate(code: string, isDown: boolean): void {
    this.setKey(code, isDown);
  }

  resetAll(): void {
    this.down.clear();
    this.pressedFrame.clear();
    this.releasedFrame.clear();
    this.mouseDX = this.mouseDY = 0;
  }
}
