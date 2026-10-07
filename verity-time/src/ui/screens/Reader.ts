import type { Game } from '../../Game';
import type { Screen } from '../UI';
import type { DocDef } from '../../narrative/types';
import { h, escapeHtmlText } from '../dom';

/** Converts the tiny document markup into HTML. */
export function docHtml(d: DocDef): string {
  let s = escapeHtmlText(d.body.trim());
  s = s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  s = s.replace(/\[\[(.+?)\]\]/g, '<span class="redact">$1</span>');
  s = s.replace(/__(.+?)__/g, '<u>$1</u>');
  s = s.replace(/~~(.+?)~~/g, '<s>$1</s>');
  const stamp = d.stamp ? `<div class="stamp">${escapeHtmlText(d.stamp)}</div>` : '';
  return `${stamp}<span class="title">${escapeHtmlText(d.title)}</span>${s}`;
}

export function paperClass(d: DocDef): string {
  return 'paper ' + (d.style === 'typed' ? '' : d.style);
}

export class ReaderScreen implements Screen {
  el: HTMLElement;
  pauses = true;
  id = 'reader';
  constructor(g: Game, d: DocDef) {
    const paper = h('div', { class: paperClass(d), html: docHtml(d) });
    this.el = h(
      'div',
      { class: 'dim interactive', onclick: (e: Event) => e.target === this.el && g.closeScreen(this) },
      h('div', { class: 'reader' }, paper),
      h('div', { class: 'overlay-hint' }, 'Esc / ЛКМ вне листа — закрыть · документ сохранён в журнале (J)'),
    );
  }
}
