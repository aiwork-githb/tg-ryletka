import type { Game } from '../../Game';
import type { Screen } from '../UI';
import { h, formatTime } from '../dom';
import { DOCS, LOGS, SECRETS } from '../../narrative/registry';
import { docHtml, paperClass } from './Reader';

type Tab = 'goals' | 'docs' | 'logs' | 'secrets';

const ZONE_NAMES: Record<string, string> = {
  outside: 'Ворота',
  lobby: 'Зал приветствия',
  factory: 'Мастерские',
  research: 'Отдел Гармонии',
  playland: 'Страна Верити',
  lower: 'Старые цеха',
  core: 'Сердцевина',
};

export class JournalScreen implements Screen {
  el: HTMLElement;
  pauses = true;
  id = 'journal';
  private tab: Tab = 'goals';
  private body!: HTMLElement;
  private sel: string | null = null;

  constructor(private g: Game) {
    this.el = h('div', { class: 'dim' });
    this.render();
  }

  private render(): void {
    this.el.innerHTML = '';
    const tabs = h('div', { class: 'tabs' });
    const st = this.g.state.data;
    const names: Array<[Tab, string]> = [
      ['goals', 'Цели'],
      ['docs', `Документы (${st.docs.length})`],
      ['logs', `Записи (${st.logs.length})`],
      ['secrets', `Секреты (${st.secrets.length}/${Object.keys(SECRETS).length})`],
    ];
    for (const [id, label] of names)
      tabs.append(
        h(
          'div',
          {
            class: 'tab' + (this.tab === id ? ' active' : ''),
            onclick: () => {
              this.tab = id;
              this.sel = null;
              this.render();
            },
          },
          label,
        ),
      );
    this.body = h('div');
    this.el.append(
      h(
        'div',
        { class: 'panel interactive' },
        h('div', { class: 'row' }, h('h2', {}, 'Журнал'), h('div', { class: 'spacer' }), h('button', { class: 'btn small box', onclick: () => this.g.closeScreen(this) }, 'Закрыть')),
        tabs,
        this.body,
      ),
    );
    this.renderBody();
  }

  private renderBody(): void {
    const g = this.g;
    const st = g.state.data;
    const b = this.body;
    b.innerHTML = '';
    if (this.tab === 'goals') {
      b.append(
        h('div', { style: { width: 'min(760px, 80vw)', lineHeight: '1.7' } },
          h('h3', {}, 'Глава'),
          h('div', { style: { fontSize: '18px' } }, st.chapter),
          h('h3', {}, 'Текущая цель'),
          h('div', { style: { fontSize: '16px', color: 'var(--verity)' } }, st.objective || '—'),
          h('h3', {}, 'Статистика'),
          h('div', { style: { color: 'var(--ink-dim)' } },
            `Время в игре: ${formatTime(st.playTime)} · Документы: ${st.docs.length}/${Object.keys(DOCS).length} · Записи: ${st.logs.length}/${Object.keys(LOGS).length} · Секреты: ${st.secrets.length}/${Object.keys(SECRETS).length} · Поимок: ${st.deaths}`),
        ),
      );
      return;
    }
    const wrap = h('div', { class: 'journal' });
    const list = h('div', { class: 'list' });
    const detail = h('div', { class: 'detail' });
    wrap.append(list, detail);
    b.append(wrap);
    const ids = this.tab === 'docs' ? st.docs : this.tab === 'logs' ? st.logs : st.secrets;
    // group by zone
    const byZone = new Map<string, string[]>();
    for (const id of ids) {
      const zone = this.tab === 'docs' ? DOCS[id]?.zone : this.tab === 'logs' ? LOGS[id]?.zone : SECRETS[id]?.zone;
      if (!zone) continue;
      if (!byZone.has(zone)) byZone.set(zone, []);
      byZone.get(zone)!.push(id);
    }
    if (!ids.length) list.append(h('div', { style: { color: 'var(--ink-dim)', padding: '10px' } }, 'Пока пусто.'));
    this.sel ??= ids[ids.length - 1] ?? null;
    for (const [zone, zids] of byZone) {
      list.append(h('div', { class: 'group' }, ZONE_NAMES[zone] ?? zone));
      for (const id of zids) {
        const title = this.tab === 'docs' ? DOCS[id].title : this.tab === 'logs' ? LOGS[id].title : SECRETS[id].name;
        const sub = this.tab === 'docs' ? DOCS[id].from : this.tab === 'logs' ? LOGS[id].date : '';
        list.append(
          h(
            'div',
            {
              class: 'entry' + (this.sel === id ? ' active' : ''),
              onclick: () => {
                this.sel = id;
                this.renderBody();
              },
            },
            title,
            sub ? h('small', {}, sub) : null,
          ),
        );
      }
    }
    if (!this.sel) return;
    if (this.tab === 'docs') {
      const d = DOCS[this.sel];
      if (d) detail.append(h('div', { class: paperClass(d), style: { width: '100%', maxHeight: 'none', boxShadow: 'none' }, html: docHtml(d) }));
    } else if (this.tab === 'logs') {
      const l = LOGS[this.sel];
      if (l) {
        const id = this.sel;
        detail.append(
          h('h3', { style: { color: 'var(--ink)', textTransform: 'none', fontSize: '16px', letterSpacing: '0.02em' } }, l.title),
          h('div', { style: { color: 'var(--ink-dim)', marginBottom: '12px' } }, l.date ?? ''),
          h('button', { class: 'btn small box primary', onclick: () => { g.closeScreen(this); g.playLog(id); } }, '▶ Прослушать'),
          h('div', { class: 'paper memo', style: { marginTop: '16px', width: '100%', maxHeight: 'none', boxShadow: 'none', fontSize: '14px' } }, l.lines.map((x) => x.replace(/^@\w+:\s*/, '— ')).join('\n\n')),
        );
      }
    } else {
      const s = SECRETS[this.sel];
      if (s) detail.append(h('h3', { style: { color: 'var(--coral)', textTransform: 'none', fontSize: '18px', letterSpacing: '0.02em' } }, s.name), h('p', { style: { color: 'var(--ink-dim)', lineHeight: '1.7' } }, s.desc));
    }
  }
}
