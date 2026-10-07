import type { Game } from '../../Game';
import type { Screen } from '../UI';
import { h } from '../dom';

export class CreditsScreen implements Screen {
  el: HTMLElement;
  pauses = true;
  id = 'credits';
  constructor(g: Game, onDone?: () => void) {
    const roll = h('div', {
      class: 'roll',
      html: `
      <h1>VERITY TIME</h1>
      <p>психологический хоррор от первого лица</p>
      <h4>Игра, сценарий, код</h4><p>Claude Code</p>
      <h4>Технологии</h4><p>Three.js · WebAudio · TypeScript · Vite · Electron</p>
      <h4>Модели, текстуры и звук</h4><p>Процедурная генерация во время выполнения<br/>Ни одного стороннего ассета</p>
      <h4>Шрифты</h4><p>Comfortaa · IBM Plex Sans · IBM Plex Mono · Caveat (SIL OFL)</p>
      <h4>В ролях</h4><p>Верити — Верити<br/>Друг №12 — Вы</p>
      <h4>Благодарности</h4><p>Всем, кто когда-то разговаривал со своими игрушками<br/>и всем игрушкам, которые слушали</p>
      <p style="margin-top:80px">«Если оно помнит, боится и ждёт — <br/>то кто сказал, что оно не настоящее?»</p>
      <p style="margin-top:60px;color:var(--verity)">Спасибо, что вернулись.</p>`,
    });
    this.el = h('div', { class: 'credits', style: { background: '#000', alignItems: 'flex-start' } }, roll);
    const close = () => {
      g.ui.close(this);
      onDone?.();
    };
    roll.addEventListener('animationend', close);
    this.el.addEventListener('click', close);
  }
}
