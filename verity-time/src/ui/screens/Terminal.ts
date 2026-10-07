import type { Game } from '../../Game';
import type { Screen } from '../UI';
import { h } from '../dom';

export interface TerminalApi {
  print(text: string, delay?: number): void;
  clear(): void;
  close(): void;
  setPrompt(p: string): void;
  /** Masks input (passwords). */
  setMasked(m: boolean): void;
}

export interface TerminalProgram {
  boot(t: TerminalApi): void;
  command(line: string, t: TerminalApi): void;
  prompt?: string;
}

/** Retro CRT command-line terminal. */
export class TerminalScreen implements Screen {
  el: HTMLElement;
  pauses = true;
  id = 'terminal';
  private out: HTMLElement;
  private input: HTMLInputElement;
  private promptEl: HTMLElement;
  private queue: Array<[string, number]> = [];
  private printing = false;
  private history: string[] = [];
  private hIndex = 0;
  private masked = false;

  constructor(
    private g: Game,
    private prog: TerminalProgram,
  ) {
    this.out = h('div', { class: 'out' });
    this.promptEl = h('span', {}, prog.prompt ?? '>');
    this.input = h('input', { spellcheck: 'false', autocomplete: 'off' }) as HTMLInputElement;
    const term = h('div', { class: 'terminal interactive' }, this.out, h('div', { class: 'in' }, this.promptEl, this.input));
    this.el = h('div', { class: 'dim' }, term, h('div', { class: 'overlay-hint' }, 'Введите HELP для списка команд · Esc — отойти от терминала'));
    term.addEventListener('click', () => this.input.focus());
    this.input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.code === 'Enter') {
        const line = this.input.value;
        this.input.value = '';
        if (this.printing) return;
        this.echo(line);
        if (line.trim()) {
          this.history.push(line);
          this.hIndex = this.history.length;
        }
        this.g.audio.play('keypad_beep', { bus: 'ui', volume: 0.3, rate: 0.6 });
        this.prog.command(line.trim(), this.api);
      } else if (e.code === 'ArrowUp') {
        this.hIndex = Math.max(0, this.hIndex - 1);
        this.input.value = this.history[this.hIndex] ?? '';
      } else if (e.code === 'ArrowDown') {
        this.hIndex = Math.min(this.history.length, this.hIndex + 1);
        this.input.value = this.history[this.hIndex] ?? '';
      } else if (e.code === 'Escape') {
        g.closeScreen(this);
      } else if (e.key.length === 1) {
        this.g.audio.play('keypad_beep', { bus: 'ui', volume: 0.08, rate: 0.5 + Math.random() * 0.1 });
      }
    });
    this.g.audio.play('crt_on', { bus: 'ui', volume: 0.6 });
    setTimeout(() => this.input.focus(), 50);
    prog.boot(this.api);
  }

  private echo(line: string): void {
    const shown = this.masked ? '*'.repeat(line.length) : line;
    this.out.append(document.createTextNode(`${this.promptEl.textContent} ${shown}\n`));
    this.out.scrollTop = this.out.scrollHeight;
  }

  readonly api: TerminalApi = {
    print: (text, delay = 0.012) => {
      this.queue.push([text + '\n', delay]);
      if (!this.printing) this.flush();
    },
    clear: () => {
      this.out.textContent = '';
    },
    close: () => this.g.closeScreen(this),
    setPrompt: (p) => (this.promptEl.textContent = p),
    setMasked: (m) => {
      this.masked = m;
      this.input.type = m ? 'password' : 'text';
    },
  };

  private flush(): void {
    const next = this.queue.shift();
    if (!next) {
      this.printing = false;
      return;
    }
    this.printing = true;
    const [text, delay] = next;
    if (delay <= 0) {
      this.out.append(document.createTextNode(text));
      this.out.scrollTop = this.out.scrollHeight;
      this.flush();
      return;
    }
    let i = 0;
    const node = document.createTextNode('');
    this.out.append(node);
    const step = () => {
      const n = Math.max(1, Math.round(0.016 / delay));
      node.textContent += text.slice(i, i + n);
      i += n;
      this.out.scrollTop = this.out.scrollHeight;
      if (i < text.length) setTimeout(step, delay * 1000);
      else this.flush();
    };
    step();
  }
}
