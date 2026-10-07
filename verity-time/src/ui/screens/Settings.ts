import type { Game } from '../../Game';
import type { Screen } from '../UI';
import { h } from '../dom';
import { ACTION_LABELS, DEFAULT_BINDINGS, keyLabel, type Action } from '../../core/Input';
import { applyPreset, type Settings, type Preset } from '../../core/Settings';

type Tab = 'graphics' | 'audio' | 'controls' | 'access';

export class SettingsScreen implements Screen {
  el: HTMLElement;
  pauses = true;
  id = 'settings';
  private tab: Tab = 'graphics';
  private body!: HTMLElement;
  private listening: { action: Action; slot: number } | null = null;

  constructor(private g: Game) {
    this.el = h('div', { class: 'dim' });
    this.render();
  }

  onEscape(): boolean {
    if (this.listening) {
      this.listening = null;
      this.g.input.captureNext = null;
      this.renderBody();
      return true;
    }
    return false;
  }

  onClose(): void {
    this.g.input.captureNext = null;
  }

  private get s(): Settings {
    return this.g.settings;
  }

  private changed(markCustom = false): void {
    if (markCustom) this.s.preset = 'custom';
    this.g.applySettings();
  }

  private render(): void {
    this.el.innerHTML = '';
    const tabs = h('div', { class: 'tabs' });
    const names: Array<[Tab, string]> = [
      ['graphics', 'Графика'],
      ['audio', 'Звук'],
      ['controls', 'Управление'],
      ['access', 'Доступность'],
    ];
    for (const [id, label] of names) {
      tabs.append(
        h(
          'div',
          {
            class: 'tab' + (this.tab === id ? ' active' : ''),
            onclick: () => {
              this.tab = id;
              this.render();
            },
          },
          label,
        ),
      );
    }
    this.body = h('div', { style: { minWidth: '640px' } });
    this.el.append(
      h(
        'div',
        { class: 'panel interactive' },
        h('div', { class: 'row' }, h('h2', {}, 'Настройки'), h('div', { class: 'spacer' }), h('button', { class: 'btn small box', onclick: () => this.g.ui.close(this) }, 'Готово')),
        tabs,
        this.body,
      ),
    );
    this.renderBody();
  }

  private renderBody(): void {
    const b = this.body;
    b.innerHTML = '';
    const s = this.s;
    if (this.tab === 'graphics') {
      b.append(
        this.select('Качество (пресет)', s.preset, [
          ['low', 'Низкое'],
          ['medium', 'Среднее'],
          ['high', 'Высокое'],
          ['ultra', 'Ультра'],
          ['custom', 'Своё'],
        ], (v) => {
          applyPreset(s, v as Preset);
          this.changed();
          this.renderBody();
        }),
        this.select('Режим окна', s.displayMode, [
          ['fullscreen', 'Полный экран'],
          ['borderless', 'Окно без рамки'],
          ['windowed', 'Оконный'],
        ], (v) => {
          s.displayMode = v as Settings['displayMode'];
          this.changed();
          if (!window.native) {
            if (v === 'fullscreen' || v === 'borderless') document.documentElement.requestFullscreen?.().catch(() => undefined);
            else if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
          }
        }),
        this.select('Разрешение', s.resolution, resolutions(), (v) => {
          s.resolution = v;
          this.changed();
        }),
        this.slider('Масштаб рендера', s.renderScale, 0.5, 1, 0.05, (v) => `${Math.round(v * 100)}%`, (v) => {
          s.renderScale = v;
          this.changed(true);
        }),
        this.check(window.native ? 'Вертикальная синхронизация (после перезапуска)' : 'Вертикальная синхронизация', s.vsync, (v) => {
          s.vsync = v;
          this.changed();
        }),
        this.select('Ограничение FPS', String(s.fpsLimit), [
          ['0', 'Без ограничения'],
          ['30', '30'],
          ['60', '60'],
          ['120', '120'],
          ['144', '144'],
        ], (v) => {
          s.fpsLimit = Number(v);
          this.changed();
        }),
        this.select('Тени', s.shadows, [
          ['off', 'Выкл.'],
          ['low', 'Низкие'],
          ['high', 'Высокие'],
        ], (v) => {
          s.shadows = v as Settings['shadows'];
          this.changed(true);
        }),
        this.select('Текстуры', s.textures, [
          ['low', 'Низкие (256)'],
          ['medium', 'Средние (512)'],
          ['high', 'Высокие (1024)'],
        ], (v) => {
          s.textures = v as Settings['textures'];
          this.changed(true);
        }),
        this.select('Эффекты', s.effects, [
          ['low', 'Низкие'],
          ['medium', 'Средние'],
          ['high', 'Высокие'],
        ], (v) => {
          s.effects = v as Settings['effects'];
          this.changed(true);
        }),
        this.check('Объёмное затенение (SSAO)', s.ssao, (v) => {
          s.ssao = v;
          this.changed(true);
        }),
        this.slider('Поле зрения (FOV)', s.fov, 60, 110, 1, (v) => `${v}°`, (v) => {
          s.fov = v;
          this.changed();
        }),
        this.slider('Яркость', s.brightness, 0.5, 1.6, 0.05, (v) => v.toFixed(2), (v) => {
          s.brightness = v;
          this.changed();
        }),
        h('div', { class: 'hint' }, 'Качество текстур применяется при следующей загрузке зоны.'),
      );
    } else if (this.tab === 'audio') {
      const vol = (label: string, key: 'masterVolume' | 'musicVolume' | 'sfxVolume' | 'voiceVolume' | 'ambienceVolume') =>
        this.slider(label, s[key], 0, 1, 0.01, (v) => `${Math.round(v * 100)}%`, (v) => {
          s[key] = v;
          this.changed();
        });
      b.append(
        vol('Общая громкость', 'masterVolume'),
        vol('Музыка', 'musicVolume'),
        vol('Эффекты', 'sfxVolume'),
        vol('Голоса', 'voiceVolume'),
        vol('Окружение', 'ambienceVolume'),
        this.check('Субтитры', s.subtitles, (v) => {
          s.subtitles = v;
          this.changed();
        }),
        this.select('Размер субтитров', s.subtitleSize, [
          ['small', 'Маленький'],
          ['medium', 'Средний'],
          ['large', 'Крупный'],
          ['xl', 'Очень крупный'],
        ], (v) => {
          s.subtitleSize = v as Settings['subtitleSize'];
          this.changed();
        }),
        this.check('Фон под субтитрами', s.subtitleBackground, (v) => {
          s.subtitleBackground = v;
          this.changed();
        }),
      );
    } else if (this.tab === 'controls') {
      b.append(
        this.slider('Чувствительность мыши', s.sensitivity, 0.1, 4, 0.05, (v) => v.toFixed(2), (v) => {
          s.sensitivity = v;
          this.changed();
        }),
        this.check('Инвертировать ось Y', s.invertY, (v) => {
          s.invertY = v;
          this.changed();
        }),
        this.check('Приседание переключением', s.crouchToggle, (v) => {
          s.crouchToggle = v;
          this.changed();
        }),
        h('h3', {}, 'Назначение клавиш'),
      );
      for (const a of Object.keys(ACTION_LABELS) as Action[]) {
        const slots = s.bindings[a];
        const btn = (slot: number) => {
          const listening = this.listening?.action === a && this.listening.slot === slot;
          return h(
            'button',
            {
              class: listening ? 'listening' : '',
              onclick: () => {
                this.listening = { action: a, slot };
                this.g.input.captureNext = (code) => {
                  if (code === 'Escape') {
                    this.listening = null;
                    this.renderBody();
                    return;
                  }
                  // remove the key from other actions to avoid conflicts
                  for (const other of Object.keys(s.bindings) as Action[]) s.bindings[other] = s.bindings[other].filter((c) => c !== code);
                  const list = [...s.bindings[a]];
                  list[slot] = code;
                  s.bindings[a] = list.filter(Boolean);
                  this.listening = null;
                  this.changed();
                  this.renderBody();
                };
                this.renderBody();
              },
            },
            listening ? 'Нажмите…' : keyLabel(slots[slot] ?? ''),
          );
        };
        b.append(h('div', { class: 'setting' }, h('div', {}, ACTION_LABELS[a]), h('div', { class: 'bind' }, btn(0), btn(1)), h('div')));
      }
      b.append(
        h(
          'div',
          { class: 'row', style: { marginTop: '12px' } },
          h(
            'button',
            {
              class: 'btn small box',
              onclick: () => {
                s.bindings = structuredClone(DEFAULT_BINDINGS);
                this.changed();
                this.renderBody();
              },
            },
            'Сбросить по умолчанию',
          ),
        ),
      );
    } else {
      b.append(
        this.check('Покачивание камеры при ходьбе', s.headBob, (v) => {
          s.headBob = v;
          this.changed();
        }),
        this.check('Уменьшить вспышки и мерцание', s.reduceFlashing, (v) => {
          s.reduceFlashing = v;
          this.changed();
        }),
        this.check('Показывать FPS', s.showFps, (v) => {
          s.showFps = v;
          this.changed();
        }),
        this.slider('Яркость', s.brightness, 0.5, 1.6, 0.05, (v) => v.toFixed(2), (v) => {
          s.brightness = v;
          this.changed();
        }),
        this.select('Размер субтитров', s.subtitleSize, [
          ['small', 'Маленький'],
          ['medium', 'Средний'],
          ['large', 'Крупный'],
          ['xl', 'Очень крупный'],
        ], (v) => {
          s.subtitleSize = v as Settings['subtitleSize'];
          this.changed();
        }),
        h('div', { class: 'hint' }, 'Подсказка: яркость стоит настроить так, чтобы в тёмной комнате едва различались очертания предметов.'),
      );
    }
  }

  private select(label: string, value: string, opts: Array<[string, string]>, on: (v: string) => void): HTMLElement {
    const sel = h('select', { onchange: (e: Event) => on((e.target as HTMLSelectElement).value) });
    for (const [v, l] of opts) sel.append(h('option', { value: v, selected: v === value }, l));
    return h('div', { class: 'setting' }, h('div', {}, label), sel, h('div'));
  }

  private slider(label: string, value: number, min: number, max: number, step: number, fmt: (v: number) => string, on: (v: number) => void): HTMLElement {
    const val = h('div', { class: 'val' }, fmt(value));
    const inp = h('input', {
      type: 'range',
      min,
      max,
      step,
      value,
      oninput: (e: Event) => {
        const v = Number((e.target as HTMLInputElement).value);
        val.textContent = fmt(v);
        on(v);
      },
    });
    return h('div', { class: 'setting' }, h('div', {}, label), inp, val);
  }

  private check(label: string, value: boolean, on: (v: boolean) => void): HTMLElement {
    const c = h('input', { type: 'checkbox', checked: value, onchange: (e: Event) => on((e.target as HTMLInputElement).checked) });
    return h('div', { class: 'setting' }, h('div', {}, label), h('div', {}, c), h('div'));
  }
}

function resolutions(): Array<[string, string]> {
  const list: Array<[string, string]> = [['native', 'Как у экрана']];
  for (const [w, hh] of [
    [1280, 720],
    [1366, 768],
    [1600, 900],
    [1920, 1080],
    [2560, 1440],
    [3840, 2160],
  ])
    list.push([`${w}x${hh}`, `${w} × ${hh}`]);
  return list;
}
