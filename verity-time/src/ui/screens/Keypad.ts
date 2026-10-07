import type { Game } from '../../Game';
import type { Screen } from '../UI';
import { h } from '../dom';

export interface KeypadOpts {
  title: string;
  length: number;
  /** Return true when the code is correct. */
  check: (code: string) => boolean;
  onSuccess: () => void;
  onFail?: (code: string) => void;
}

export class KeypadScreen implements Screen {
  el: HTMLElement;
  pauses = true;
  id = 'keypad';
  private code = '';
  private display: HTMLElement;
  private locked = false;
  private keyHandler: (e: KeyboardEvent) => void;

  constructor(
    private g: Game,
    private o: KeypadOpts,
  ) {
    this.display = h('div', { class: 'display' }, '');
    const pad = h('div', { class: 'keypad interactive' }, this.display);
    for (const k of ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'OK']) {
      pad.append(h('button', { onclick: () => this.press(k) }, k));
    }
    pad.append(h('div', { class: 'label' }, o.title));
    this.el = h('div', { class: 'dim' }, pad, h('div', { class: 'overlay-hint' }, 'Цифры — клавиатура · Enter — ввод · Backspace — стереть · Esc — отойти'));
    this.keyHandler = (e) => {
      if (/^Digit\d$|^Numpad\d$/.test(e.code)) this.press(e.code.slice(-1));
      else if (e.code === 'Backspace') this.press('C');
      else if (e.code === 'Enter' || e.code === 'NumpadEnter') this.press('OK');
    };
    window.addEventListener('keydown', this.keyHandler);
    this.render();
  }

  onClose(): void {
    window.removeEventListener('keydown', this.keyHandler);
  }

  private render(): void {
    this.display.textContent = this.code.padEnd(this.o.length, '·');
  }

  private press(k: string): void {
    if (this.locked) return;
    const a = this.g.audio;
    if (k === 'C') {
      this.code = this.code.slice(0, -1);
      a.play('keypad_beep', { bus: 'ui', rate: 0.8 });
    } else if (k === 'OK') {
      this.submit();
      return;
    } else if (this.code.length < this.o.length) {
      this.code += k;
      a.play('keypad_beep', { bus: 'ui', rate: 0.9 + Number(k) * 0.03 });
      if (this.code.length === this.o.length) setTimeout(() => this.submit(), 250);
    }
    this.render();
  }

  private submit(): void {
    if (this.locked || this.code.length < this.o.length) return;
    this.locked = true;
    if (this.o.check(this.code)) {
      this.display.textContent = 'OK';
      this.g.audio.play('keypad_ok', { bus: 'ui' });
      setTimeout(() => {
        this.g.closeScreen(this);
        this.o.onSuccess();
      }, 600);
    } else {
      this.display.textContent = 'ОШИБКА';
      this.display.classList.add('err');
      this.g.audio.play('keypad_err', { bus: 'ui' });
      this.o.onFail?.(this.code);
      setTimeout(() => {
        this.code = '';
        this.display.classList.remove('err');
        this.locked = false;
        this.render();
      }, 900);
    }
  }
}
