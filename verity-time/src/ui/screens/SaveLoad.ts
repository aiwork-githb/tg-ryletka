import type { Game } from '../../Game';
import type { Screen } from '../UI';
import { h, formatTime } from '../dom';
import { SLOTS, type SlotId } from '../../core/SaveSystem';
import { ConfirmScreen } from './Confirm';

export class SaveLoadScreen implements Screen {
  el: HTMLElement;
  pauses = true;

  constructor(
    private g: Game,
    private mode: 'save' | 'load',
  ) {
    this.el = h('div', { class: 'dim' });
    this.render();
  }

  private render(): void {
    const g = this.g;
    this.el.innerHTML = '';
    const slots = h('div', { class: 'slots' });
    for (const slot of SLOTS) {
      const f = g.saves.read(slot);
      const name = slot === 'auto' ? 'Автосохранение' : `Ячейка ${slot.slice(4)}`;
      const disabled = (this.mode === 'save' && slot === 'auto') || (this.mode === 'load' && !f);
      const el = h(
        'div',
        { class: 'slot' + (disabled ? ' empty' : '') },
        f?.meta.thumb ? h('img', { src: f.meta.thumb }) : h('div', { class: 'thumb' }),
        h(
          'div',
          { class: 'meta' },
          h('b', {}, name),
          h('br'),
          f ? `${f.meta.chapter} · ${f.meta.zoneName}` : 'Пусто',
          h('br'),
          f ? `Время в игре: ${formatTime(f.meta.playTime)} · ${new Date(f.meta.time).toLocaleString('ru-RU')}` : '',
        ),
      );
      if (!disabled)
        el.addEventListener('click', () => {
          if (this.mode === 'save') {
            const doSave = () => {
              g.saveTo(slot as SlotId);
              this.render();
            };
            if (f) g.ui.open(new ConfirmScreen(g, 'Перезаписать сохранение?', `${name} будет заменена текущим прогрессом.`, doSave));
            else doSave();
          } else {
            const doLoad = () => g.loadSlot(slot as SlotId);
            if (g.mode === 'play') g.ui.open(new ConfirmScreen(g, 'Загрузить сохранение?', 'Несохранённый прогресс будет потерян.', doLoad));
            else doLoad();
          }
        });
      slots.append(el);
    }
    this.el.append(
      h(
        'div',
        { class: 'panel interactive' },
        h('div', { class: 'row' }, h('h2', {}, this.mode === 'save' ? 'Сохранить игру' : 'Загрузить игру'), h('div', { class: 'spacer' }), h('button', { class: 'btn small box', onclick: () => g.ui.close(this) }, 'Назад')),
        slots,
      ),
    );
  }
}
