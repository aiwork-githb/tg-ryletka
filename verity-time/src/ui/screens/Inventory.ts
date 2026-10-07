import type { Game } from '../../Game';
import type { Screen } from '../UI';
import { h } from '../dom';
import { ITEMS } from '../../narrative/registry';
import { IconRenderer } from '../icons';

let icons: IconRenderer | null = null;

export class InventoryScreen implements Screen {
  el: HTMLElement;
  pauses = true;
  id = 'inventory';
  private selected: string | null = null;
  private canvas: HTMLCanvasElement;
  private angle = 0;
  private info: HTMLElement;

  constructor(g: Game) {
    icons ??= new IconRenderer(g);
    this.canvas = h('canvas', { width: 280, height: 280 });
    this.info = h('div');
    const grid = h('div', { class: 'inv-grid' });
    const items = g.state.data.inventory;
    this.selected = items[0] ?? null;
    const cells: HTMLElement[] = [];
    for (const id of items) {
      const def = ITEMS[id];
      if (!def) continue;
      const cell = h(
        'div',
        {
          class: 'inv-cell' + (id === this.selected ? ' active' : ''),
          title: def.name,
          onclick: () => {
            this.selected = id;
            cells.forEach((c) => c.classList.toggle('active', c === cell));
            this.renderInfo();
          },
        },
        h('img', { src: icons.icon(id) }),
      );
      cells.push(cell);
      grid.append(cell);
    }
    if (!items.length) grid.append(h('div', { style: { color: 'var(--ink-dim)', gridColumn: '1 / 5' } }, 'Пока ничего нет.'));
    this.el = h(
      'div',
      { class: 'dim' },
      h(
        'div',
        { class: 'panel interactive' },
        h('div', { class: 'row' }, h('h2', {}, 'Инвентарь'), h('div', { class: 'spacer' }), h('button', { class: 'btn small box', onclick: () => g.closeScreen(this) }, 'Закрыть')),
        h('div', { class: 'journal', style: { height: 'auto', minHeight: '360px' } }, h('div', { class: 'list', style: { border: '0' } }, grid), h('div', { class: 'detail' }, h('div', { class: 'inv-preview' }, this.canvas), this.info)),
      ),
    );
    this.renderInfo();
  }

  private renderInfo(): void {
    const def = this.selected ? ITEMS[this.selected] : null;
    this.info.innerHTML = '';
    if (!def) return;
    this.info.append(h('h3', { style: { color: 'var(--ink)', fontSize: '16px', letterSpacing: '0.04em', textTransform: 'none' } }, def.name), h('p', { style: { color: 'var(--ink-dim)', lineHeight: '1.6' } }, def.desc));
  }

  update(dt: number): void {
    if (!this.selected || !icons) return;
    this.angle += dt * 0.8;
    icons.preview(this.selected, this.angle, this.canvas);
  }
}
