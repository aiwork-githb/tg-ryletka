import type { Game } from '../../Game';
import type { Screen } from '../UI';
import { h } from '../dom';
import { SPEAKERS } from '../../narrative/types';

export interface DialogueOpts {
  /** Seconds to answer; silence is an answer too. */
  timeout?: number;
  onTimeout?: () => void;
}

/**
 * A question someone asks the player, with 2–3 answers (1/2/3 or click).
 * The world is held still while the player decides; an optional timer
 * keeps the pressure on.
 */
export class DialogueScreen implements Screen {
  el: HTMLElement;
  pauses = true;
  id = 'dialogue';
  private picked = false;
  private keyHandler: (e: KeyboardEvent) => void;
  private bar: HTMLElement | null = null;
  private t = 0;

  constructor(
    private g: Game,
    speaker: string,
    question: string,
    options: string[],
    private onPick: (i: number) => void,
    private o: DialogueOpts = {},
  ) {
    const sp = SPEAKERS[speaker] ?? { name: speaker, color: '#fff' };
    const list = h('div', { class: 'dlg-options' });
    options.forEach((txt, i) => list.append(h('button', { class: 'dlg-option', onclick: () => this.pick(i) }, h('span', { class: 'key' }, String(i + 1)), txt)));
    if (o.timeout) this.bar = h('div', { class: 'dlg-timer' }, h('div'));
    this.el = h(
      'div',
      { class: 'clear' },
      h('div', { class: 'dialogue interactive' }, h('div', { class: 'dlg-q' }, h('b', { style: { color: sp.color } }, sp.name + ':'), ' ' + question), list, this.bar),
    );
    this.keyHandler = (e) => {
      const n = Number(e.key);
      if (n >= 1 && n <= options.length) {
        e.stopPropagation();
        this.pick(n - 1);
      }
    };
    window.addEventListener('keydown', this.keyHandler, true);
    g.audio.play('ui_hover', { bus: 'ui', volume: 0.4 });
  }

  onEscape = (): boolean => true;

  onClose = (): void => {
    window.removeEventListener('keydown', this.keyHandler, true);
  };

  update(dt: number): void {
    if (!this.o.timeout || this.picked) return;
    this.t += dt;
    const k = Math.max(0, 1 - this.t / this.o.timeout);
    if (this.bar) (this.bar.firstChild as HTMLElement).style.width = `${k * 100}%`;
    if (this.t >= this.o.timeout) {
      this.picked = true;
      this.g.closeScreen(this);
      this.o.onTimeout?.();
    }
  }

  private pick(i: number): void {
    if (this.picked) return;
    this.picked = true;
    this.g.audio.play('ui_click', { bus: 'ui', volume: 0.5 });
    this.g.closeScreen(this);
    this.onPick(i);
  }
}
