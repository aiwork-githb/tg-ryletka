import type { Game } from '../../Game';
import type { Screen } from '../UI';
import { h, formatTime } from '../dom';
import { SettingsScreen } from './Settings';
import { SaveLoadScreen } from './SaveLoad';
import { CreditsScreen } from './Credits';
import { ConfirmScreen } from './Confirm';

export class MainMenu implements Screen {
  el: HTMLElement;
  pauses = false;
  id = 'mainmenu';

  constructor(private g: Game) {
    this.el = h('div', { class: 'main-menu' });
    this.render();
  }

  onFocus(): void {
    this.render();
  }

  onEscape(): boolean {
    return true;
  }

  private render(): void {
    const g = this.g;
    const latest = g.saves.latest();
    this.el.innerHTML = '';
    const list = h('div', { class: 'menu-list interactive' });
    if (latest) {
      list.append(
        h(
          'button',
          { class: 'btn primary', onclick: () => g.continueGame() },
          'Продолжить',
          h('span', { style: { display: 'block', fontSize: '12px', color: 'var(--ink-dim)', marginTop: '2px' } }, `${latest.meta.chapter} · ${latest.meta.zoneName} · ${formatTime(latest.meta.playTime)}`),
        ),
      );
    }
    list.append(
      h(
        'button',
        {
          class: 'btn' + (latest ? '' : ' primary'),
          onclick: () => {
            if (latest)
              g.ui.open(
                new ConfirmScreen(g, 'Начать новую игру?', 'Автосохранение будет перезаписано. Ручные сохранения останутся.', () => g.newGame()),
              );
            else g.newGame();
          },
        },
        'Новая игра',
      ),
      h('button', { class: 'btn', onclick: () => g.ui.open(new SaveLoadScreen(g, 'load')) }, 'Загрузить'),
      h('button', { class: 'btn', onclick: () => g.ui.open(new SettingsScreen(g)) }, 'Настройки'),
      h('button', { class: 'btn', onclick: () => g.ui.open(new CreditsScreen(g)) }, 'Авторы'),
    );
    if (window.native) list.append(h('button', { class: 'btn', onclick: () => g.quit() }, 'Выход'));
    this.el.append(
      h(
        'div',
        {},
        h('div', { class: 'logo', html: 'VERITY <span class="t">TIME</span>' }),
        h('div', { class: 'tagline' }, 'твой друг навсегда'),
        list,
      ),
      h('div', { class: 'menu-foot' }, 'v0.9 · Клавиатура и мышь · Наушники рекомендуются'),
    );
  }
}
