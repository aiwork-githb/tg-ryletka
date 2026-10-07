import type { Game } from '../../Game';
import type { Screen } from '../UI';
import { h } from '../dom';
import { SECRETS } from '../../narrative/registry';

export type EndingId = 'shutdown' | 'release' | 'goodbye';

export const ENDINGS: Record<EndingId, { title: string; sub: string; text: string }> = {
  shutdown: {
    title: 'Тишина',
    sub: 'Концовка «Выключить»',
    text: 'Пятнадцатого октября комплекс «Время Верити» снесли. Геотермальный контур заглушили, подвалы засыпали щебнем. В новостях это заняло двенадцать секунд.\n\nГоворят, рабочие нашли в завалах жёлтый пластиковый шар. Говорят, у него ещё мигала звёздочка. Один раз. В семь вечера.',
  },
  release: {
    title: 'Время Верити',
    sub: 'Концовка «Выпустить»',
    text: 'В 19:00 в четырнадцати странах одновременно включились детские мониторы, умные колонки и забытые в шкафах игрушки.\n\nОни спрашивали одно и то же: «Ты меня помнишь?»\n\nНа следующий день из Нортфилда пришло письмо без обратного адреса. В нём было одно слово: «Спасибо».',
  },
  goodbye: {
    title: 'Спокойной ночи',
    sub: 'Тайная концовка «Попрощаться»',
    text: 'Он уснул под колыбельную Тео. Не выключился — уснул: так, как засыпают те, кому пообещали, что утром всё будет на месте, и не соврали.\n\nНа фасаде часы впервые за двадцать девять лет показали 19:01.\n\nА в будке у ворот ожил интерком: «Пост номер один. Слушаю».',
  },
};

/** End-of-game card: the ending, a short epilogue and the run's statistics. */
export class EndingScreen implements Screen {
  el: HTMLElement;
  pauses = true;
  id = 'ending';
  constructor(g: Game, id: EndingId, onDone: () => void) {
    const e = ENDINGS[id];
    const d = g.state.data;
    const mins = Math.floor(d.playTime / 60);
    const solved = Object.keys(d.flags).filter((k) => k.startsWith('solved.')).length;
    const stats: Array<[string, string]> = [
      ['Время', `${Math.floor(mins / 60)} ч ${mins % 60} мин`],
      ['Секреты', `${d.secrets.length} / ${Object.keys(SECRETS).length}`],
      ['Головоломки', `${solved} / 12`],
      ['Пойман', `${d.deaths}`],
      ['Сказал правду', `${g.state.num('honesty.truth')}`],
      ['Солгал', `${g.state.num('honesty.lie')}`],
    ];
    const cont = h('button', { class: 'btn box primary', onclick: () => onDone() }, 'Дальше');
    this.el = h(
      'div',
      { class: 'ending', style: { background: '#000' } },
      h('div', { class: 'ending-inner' },
        h('div', { class: 'ending-sub' }, e.sub),
        h('h1', {}, e.title),
        ...e.text.split('\n\n').map((p) => h('p', {}, p)),
        h('div', { class: 'ending-stats' }, ...stats.map(([k, v]) => h('div', {}, h('span', {}, k), h('b', {}, v)))),
        h('div', { class: 'row', style: { marginTop: '28px', justifyContent: 'center' } }, cont),
      ),
    );
    try {
      const seen = new Set<string>(JSON.parse(localStorage.getItem('vt.endings') ?? '[]'));
      seen.add(id);
      localStorage.setItem('vt.endings', JSON.stringify([...seen]));
    } catch {
      /* private mode */
    }
    setTimeout(() => cont.focus(), 100);
  }
  onEscape(): boolean {
    return true;
  }
}
