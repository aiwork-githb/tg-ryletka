import type { Game } from '../../Game';
import type { Screen } from '../UI';
import { h, formatTime } from '../dom';
import { SettingsScreen } from './Settings';
import { SaveLoadScreen } from './SaveLoad';
import { ConfirmScreen } from './Confirm';

export class PauseMenu implements Screen {
  el: HTMLElement;
  pauses = true;
  id = 'pause';

  constructor(private g: Game) {
    g.audio.setMuffle(true, 1200);
    const resume = () => g.closeScreen(this);
    const canSave = g.canSave && g.mode === 'play' && g.scripted === 0;
    this.el = h(
      'div',
      { class: 'dim' },
      h(
        'div',
        { class: 'panel interactive', style: { minWidth: '360px' } },
        h('h2', {}, 'Пауза'),
        h('div', { style: { color: 'var(--ink-dim)', fontSize: '13px', marginBottom: '16px' } }, `${g.state.data.chapter} · ${g.zone?.name ?? ''} · ${formatTime(g.state.data.playTime)}`),
        h(
          'div',
          { class: 'menu-list' },
          h('button', { class: 'btn primary', onclick: resume }, 'Продолжить'),
          h('button', { class: 'btn', disabled: !canSave, title: canSave ? '' : 'Сейчас сохраняться нельзя', onclick: () => g.ui.open(new SaveLoadScreen(g, 'save')) }, 'Сохранить'),
          h('button', { class: 'btn', onclick: () => g.ui.open(new SaveLoadScreen(g, 'load')) }, 'Загрузить'),
          h('button', { class: 'btn', onclick: () => { g.ui.close(this); g.openJournal(); } }, 'Журнал'),
          h('button', { class: 'btn', onclick: () => g.ui.open(new SettingsScreen(g)) }, 'Настройки'),
          h(
            'button',
            {
              class: 'btn',
              onclick: () => g.ui.open(new ConfirmScreen(g, 'Выйти в главное меню?', 'Несохранённый прогресс после последней контрольной точки будет потерян.', () => g.toMenu())),
            },
            'Главное меню',
          ),
        ),
        h('div', { class: 'hint' }, canSave ? '' : 'Сохранение недоступно во время погони или сцены.'),
      ),
    );
  }

  onClose(): void {
    this.g.audio.setMuffle(false);
  }
}
