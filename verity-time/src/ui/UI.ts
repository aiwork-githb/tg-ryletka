import { HUD } from './HUD';
import { h } from './dom';

export interface Screen {
  el: HTMLElement;
  /** Pauses gameplay while open. */
  pauses: boolean;
  /** Return true if Escape was consumed (otherwise the screen closes). */
  onEscape?: () => boolean;
  onClose?: () => void;
  update?: (dt: number) => void;
  /** Called when the screen becomes top-most again. */
  onFocus?: () => void;
  /** Identifier to avoid duplicates. */
  id?: string;
}

export class UI {
  readonly root: HTMLElement;
  readonly hud: HUD;
  readonly stack: Screen[] = [];
  private layer: HTMLElement;
  private resumeOverlay: HTMLElement;
  onStackChange: (() => void) | null = null;
  playUi: ((name: string) => void) | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
    this.hud = new HUD(root);
    this.layer = h('div', { class: 'screens' });
    this.resumeOverlay = h('div', { class: 'screen clear interactive', style: { display: 'none', cursor: 'pointer' } }, h('div', { class: 'overlay-hint' }, 'Щёлкните, чтобы продолжить'));
    root.append(this.layer, this.resumeOverlay);
    // UI sounds for every button
    root.addEventListener('mouseover', (e) => {
      const t = e.target as HTMLElement;
      if (t.closest('.btn, .tab, .slot, .entry, .inv-cell')) this.playUi?.('ui_hover');
    });
    root.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (t.closest('.btn, .tab, .slot, .entry, .inv-cell, .keypad button')) this.playUi?.('ui_click');
    });
  }

  open(s: Screen): Screen {
    if (s.id && this.stack.some((x) => x.id === s.id)) return s;
    s.el.classList.add('screen');
    this.layer.append(s.el);
    this.stack.push(s);
    this.onStackChange?.();
    return s;
  }

  close(s?: Screen): void {
    const target = s ?? this.stack[this.stack.length - 1];
    if (!target) return;
    const i = this.stack.indexOf(target);
    if (i < 0) return;
    this.stack.splice(i, 1);
    target.el.remove();
    target.onClose?.();
    this.top?.onFocus?.();
    this.onStackChange?.();
  }

  closeAll(): void {
    while (this.stack.length) this.close();
  }

  get top(): Screen | undefined {
    return this.stack[this.stack.length - 1];
  }

  get pausing(): boolean {
    return this.stack.some((s) => s.pauses);
  }

  get open_(): boolean {
    return this.stack.length > 0;
  }

  /** Escape handling: returns true if a screen handled it. */
  escape(): boolean {
    const t = this.top;
    if (!t) return false;
    if (t.onEscape && t.onEscape()) return true;
    this.close(t);
    return true;
  }

  showResume(show: boolean, onClick?: () => void): void {
    this.resumeOverlay.style.display = show ? 'flex' : 'none';
    this.resumeOverlay.onclick = show && onClick ? () => onClick() : null;
  }

  update(dt: number): void {
    this.hud.update(dt);
    for (const s of this.stack) s.update?.(dt);
  }
}
