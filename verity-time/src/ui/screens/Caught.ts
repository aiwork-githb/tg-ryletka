import type { Game } from '../../Game';
import type { Screen } from '../UI';
import { h } from '../dom';

export class CaughtScreen implements Screen {
  el: HTMLElement;
  pauses = true;
  id = 'caught';
  constructor(g: Game, line: string) {
    const retry = h('button', { class: 'btn box primary', onclick: () => g.retry() }, 'Вернуться к контрольной точке');
    this.el = h(
      'div',
      { class: 'caught' },
      h('div', { class: 'msg' }, `«${line}»`),
      h('div', { style: { color: 'var(--ink-dim)', fontSize: '13px', letterSpacing: '0.2em' } }, 'ВЕРИТИ НАШЁЛ ВАС'),
      h('div', { class: 'menu-list', style: { marginTop: '20px' } }, retry, h('button', { class: 'btn box', onclick: () => g.toMenu() }, 'Главное меню')),
    );
    setTimeout(() => retry.focus(), 50);
  }
  onEscape(): boolean {
    return true;
  }
}
