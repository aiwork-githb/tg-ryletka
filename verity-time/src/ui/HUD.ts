import { h } from './dom';

export class HUD {
  readonly el: HTMLElement;
  private cross: HTMLElement;
  private prompt: HTMLElement;
  private ring: SVGCircleElement;
  private ringWrap: HTMLElement;
  private notes: HTMLElement;
  private subs: HTMLElement;
  private stamina: HTMLElement;
  private staminaFill: HTMLElement;
  private bracelet: HTMLElement;
  private objective: HTMLElement;
  private objectiveText: HTMLElement;
  private fps: HTMLElement;
  private chapter: HTMLElement;
  private objectiveTimer = 0;
  private lastPrompt = '';
  subtitleSettings = { enabled: true, size: 'medium', bg: true };

  constructor(root: HTMLElement) {
    this.el = h('div', { class: 'hud' });
    this.cross = h('div', { class: 'crosshair' });
    this.prompt = h('div', { class: 'prompt' });
    this.ringWrap = h('div', { class: 'hold-ring' });
    this.ringWrap.innerHTML =
      '<svg viewBox="0 0 34 34" width="34" height="34"><circle cx="17" cy="17" r="14" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="3"/><circle class="p" cx="17" cy="17" r="14" fill="none" stroke="#f2c94c" stroke-width="3" stroke-dasharray="88" stroke-dashoffset="88" transform="rotate(-90 17 17)"/></svg>';
    this.ring = this.ringWrap.querySelector('circle.p') as SVGCircleElement;
    this.ringWrap.style.display = 'none';
    this.notes = h('div', { class: 'notifications' });
    this.subs = h('div', { class: 'subtitles medium' });
    this.stamina = h('div', { class: 'stamina' }, (this.staminaFill = h('div')));
    this.bracelet = h('div', { class: 'bracelet' }, h('span', {}, 'Браслет'), h('div', { class: 'gem' }));
    this.objectiveText = h('span');
    this.objective = h('div', { class: 'objective' }, h('small', {}, 'Цель'), this.objectiveText);
    this.fps = h('div', { class: 'fps' });
    this.fps.style.display = 'none';
    this.chapter = h('div', { class: 'chapter-card' });
    this.el.append(this.cross, this.ringWrap, this.prompt, this.notes, this.subs, this.stamina, this.bracelet, this.objective, this.fps, this.chapter);
    root.append(this.el);
  }

  setVisible(v: boolean): void {
    this.el.classList.toggle('hidden', !v);
  }

  setPrompt(text: string | null, opts: { key?: string; signal?: boolean; hold?: number } = {}): void {
    const show = !!text;
    this.cross.classList.toggle('active', show);
    this.cross.classList.toggle('signal', !!opts.signal && show);
    const html = show ? `<span class="key">${opts.key ?? 'E'}</span>${escapeHtml(text!)}` : this.lastPrompt;
    if (html !== this.lastPrompt) {
      this.prompt.innerHTML = html;
      this.lastPrompt = html;
    }
    this.prompt.classList.toggle('show', show);
    const hold = opts.hold ?? 0;
    this.ringWrap.style.display = show && hold > 0 ? 'block' : 'none';
    if (hold > 0) this.ring.setAttribute('stroke-dashoffset', String(88 * (1 - hold)));
  }

  notify(text: string, kind: 'item' | 'objective' | 'info' | 'secret' | 'save' = 'info', label?: string): void {
    const n = h('div', { class: 'note ' + kind });
    if (label) n.append(h('small', {}, label));
    n.append(document.createTextNode(text));
    this.notes.append(n);
    setTimeout(() => n.remove(), 5000);
    while (this.notes.children.length > 4) this.notes.firstChild?.remove();
  }

  subtitle(text: string, duration: number, speaker?: string, color?: string): void {
    if (!this.subtitleSettings.enabled) return;
    this.subs.className = 'subtitles ' + this.subtitleSettings.size;
    const line = h('div', { class: 'sub' + (this.subtitleSettings.bg ? ' bg' : '') });
    if (speaker) {
      const b = h('b', {}, speaker + ':');
      if (color) b.style.color = color;
      line.append(b);
    }
    line.append(document.createTextNode(text));
    const wrap = h('div', {}, line);
    this.subs.append(wrap);
    while (this.subs.children.length > 3) this.subs.firstChild?.remove();
    setTimeout(() => wrap.remove(), duration * 1000);
  }

  clearSubtitles(): void {
    this.subs.innerHTML = '';
  }

  setObjective(text: string): void {
    this.objectiveText.textContent = text;
    this.objective.classList.toggle('show', !!text);
    this.objectiveTimer = 9;
  }

  /** Re-shows the objective briefly (e.g. on journal key). */
  flashObjective(): void {
    if (this.objectiveText.textContent) {
      this.objective.classList.add('show');
      this.objectiveTimer = 5;
    }
  }

  setStamina(v: number, exhausted: boolean): void {
    this.stamina.classList.toggle('show', v < 0.98);
    this.stamina.classList.toggle('tired', exhausted);
    this.staminaFill.style.width = (v * 100).toFixed(1) + '%';
  }

  setBracelet(owned: boolean, on: boolean): void {
    this.bracelet.classList.toggle('owned', owned);
    this.bracelet.classList.toggle('on', on);
  }

  setFps(show: boolean, fps: number, extra = ''): void {
    this.fps.style.display = show ? 'block' : 'none';
    if (show) this.fps.textContent = `${fps.toFixed(0)} FPS ${extra}`;
  }

  chapterCard(act: string, title: string, seconds = 5): void {
    this.chapter.innerHTML = `<div class="act">${escapeHtml(act)}</div><div class="title">${escapeHtml(title)}</div>`;
    this.chapter.classList.add('show');
    setTimeout(() => this.chapter.classList.remove('show'), seconds * 1000);
  }

  update(dt: number): void {
    if (this.objectiveTimer > 0) {
      this.objectiveTimer -= dt;
      if (this.objectiveTimer <= 0) this.objective.classList.remove('show');
    }
  }
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
