import type { Game } from '../../Game';
import type { Screen } from '../UI';
import { h } from '../dom';

export class ConfirmScreen implements Screen {
  el: HTMLElement;
  pauses = true;
  constructor(g: Game, title: string, text: string, onYes: () => void, yes = 'Да', no = 'Отмена') {
    this.el = h(
      'div',
      { class: 'dim' },
      h(
        'div',
        { class: 'panel interactive', style: { maxWidth: '520px' } },
        h('h2', {}, title),
        h('p', { style: { color: 'var(--ink-dim)', lineHeight: '1.6' } }, text),
        h(
          'div',
          { class: 'row', style: { marginTop: '18px' } },
          h('div', { class: 'spacer' }),
          h('button', { class: 'btn box', onclick: () => g.ui.close(this) }, no),
          h(
            'button',
            {
              class: 'btn box primary',
              onclick: () => {
                g.ui.close(this);
                onYes();
              },
            },
            yes,
          ),
        ),
      ),
    );
  }
}
