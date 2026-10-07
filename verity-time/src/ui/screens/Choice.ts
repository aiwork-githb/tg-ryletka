import type { Game } from '../../Game';
import type { Screen } from '../UI';
import { h } from '../dom';

export interface ChoiceField {
  label: string;
  options: Array<[string, string]>;
}

/** Small form screen: a few selectors and a confirm button (archive racks etc.). */
export class ChoiceScreen implements Screen {
  el: HTMLElement;
  pauses = true;
  id = 'choice';
  constructor(g: Game, title: string, text: string, fields: ChoiceField[], confirm: string, onConfirm: (values: string[]) => string | null) {
    const sels = fields.map((f) => {
      const s = h('select', {});
      for (const [v, l] of f.options) s.append(h('option', { value: v }, l));
      return s;
    });
    const msg = h('div', { style: { color: 'var(--ink-dim)', minHeight: '22px', marginTop: '10px', lineHeight: '1.5' } });
    this.el = h(
      'div',
      { class: 'dim' },
      h(
        'div',
        { class: 'panel interactive', style: { maxWidth: '560px' } },
        h('h2', {}, title),
        h('p', { style: { color: 'var(--ink-dim)', lineHeight: '1.6' } }, text),
        ...fields.map((f, i) => h('div', { class: 'setting', style: { gridTemplateColumns: '180px 1fr 0px' } }, h('div', {}, f.label), sels[i], h('div'))),
        msg,
        h(
          'div',
          { class: 'row', style: { marginTop: '14px' } },
          h('div', { class: 'spacer' }),
          h('button', { class: 'btn box', onclick: () => g.closeScreen(this) }, 'Отойти'),
          h(
            'button',
            {
              class: 'btn box primary',
              onclick: () => {
                const r = onConfirm(sels.map((s) => s.value));
                if (r === null) g.closeScreen(this);
                else msg.textContent = r;
              },
            },
            confirm,
          ),
        ),
      ),
    );
  }
}
