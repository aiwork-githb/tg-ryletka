import type { Game } from '../../Game';
import type { Screen } from '../UI';
import { h } from '../dom';

const TIPS = [
  'Верити всегда говорит правду. Так было написано на коробке.',
  'Если слышите музыкальную шкатулку — остановитесь и прислушайтесь, откуда она звучит.',
  'Бег слышно издалека. Присев, вы двигаетесь почти бесшумно.',
  'Шкафчики и игровые туннели — хорошие укрытия. Но не тогда, когда вас видели входящим.',
  'Брошенный предмет отвлекает тех, кто ориентируется на звук.',
  'Все часы в комплексе остановились в 19:00.',
  'Журнал (J) хранит найденные документы и записи.',
  'Браслет «Друг» открывает игрушечные механизмы. И сообщает, где вы.',
  'Цвет звёздочки на антенне Верити — это его настроение.',
];

export class LoadingScreen implements Screen {
  el: HTMLElement;
  pauses = true;
  id = 'loading';
  private bar: HTMLElement;
  constructor(_g: Game, zoneName: string) {
    this.bar = h('div', { style: { width: '0%' } });
    this.el = h(
      'div',
      { class: 'loading' },
      h('div', { class: 'ball' }),
      h('div', { style: { fontFamily: 'var(--brand)', fontSize: '22px', letterSpacing: '0.08em' } }, zoneName),
      h('div', { class: 'bar' }, this.bar),
      h('div', { class: 'tip' }, TIPS[Math.floor(Math.random() * TIPS.length)]),
    );
  }
  progress(p: number): void {
    this.bar.style.width = Math.round(p * 100) + '%';
  }
  onEscape(): boolean {
    return true;
  }
}
