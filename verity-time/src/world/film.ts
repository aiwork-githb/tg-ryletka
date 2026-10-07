import * as THREE from 'three';
import type { Game } from '../Game';
import type { CoGen } from '../core/Coroutines';
import { drawVerity } from '../assets/Signage';
import { synthLine, VOICES } from '../audio/Voice';
import { SPEAKERS } from '../narrative/types';

export interface FilmShot {
  dur: number;
  draw: (g: CanvasRenderingContext2D, t: number, w: number, h: number) => void;
  line?: [speaker: string, text: string];
}

/**
 * Plays an old 16mm "film" on a canvas-textured screen: grain, scratches,
 * gate weave, vignette, flicker; dialogue as tape voices + subtitles.
 */
export function* playFilm(g: Game, canvas: HTMLCanvasElement, tex: THREE.CanvasTexture, shots: FilmShot[], screenPos: THREE.Vector3): CoGen {
  const ctx = canvas.getContext('2d')!;
  const W = canvas.width;
  const H = canvas.height;
  const projector = g.audio.play('motor_loop', { pos: screenPos.clone().setZ(screenPos.z + 8), loop: true, volume: 0.35, rate: 1.8 });
  for (const shot of shots) {
    if (shot.line) {
      const [who, text] = shot.line;
      const sp = SPEAKERS[who];
      const prof = { ...(VOICES[sp?.voice ?? 'male'] ?? VOICES.male), tape: true };
      if (who === 'verity') prof.degrade = 0;
      const data = synthLine(text, prof, g.audio.ctx.sampleRate, text.length * 7 + 3);
      const buf = g.audio.ctx.createBuffer(1, data.length, g.audio.ctx.sampleRate);
      buf.copyToChannel(data as Float32Array<ArrayBuffer>, 0);
      g.audio.playBuffer(buf, { bus: 'voice', pos: screenPos, volume: 0.9, ref: 4 });
      g.ui.hud.subtitle(text, Math.max(shot.dur, data.length / g.audio.ctx.sampleRate) + 0.4, sp?.name, sp?.color);
    }
    let t = 0;
    while (t < shot.dur) {
      const dt = 1 / 24;
      t += dt;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3); // gate weave
      shot.draw(ctx, t / shot.dur, W, H);
      ctx.restore();
      filmLook(ctx, W, H);
      tex.needsUpdate = true;
      yield dt;
    }
  }
  projector?.stop(0.5);
}

function filmLook(g: CanvasRenderingContext2D, W: number, H: number): void {
  // desaturate & sepia
  const img = g.getImageData(0, 0, W, H);
  const d = img.data;
  const flicker = 0.85 + Math.random() * 0.15;
  for (let i = 0; i < d.length; i += 4) {
    const l = (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) * flicker;
    const n = (Math.random() - 0.5) * 40;
    d[i] = Math.min(255, l * 1.05 + n);
    d[i + 1] = Math.min(255, l * 0.97 + n);
    d[i + 2] = Math.min(255, l * 0.85 + n);
  }
  g.putImageData(img, 0, 0);
  // scratches & dust
  g.strokeStyle = 'rgba(255,255,255,0.35)';
  for (let k = 0; k < 2; k++) {
    if (Math.random() < 0.5) continue;
    const x = Math.random() * W;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x + (Math.random() - 0.5) * 6, H);
    g.stroke();
  }
  g.fillStyle = 'rgba(0,0,0,0.6)';
  for (let k = 0; k < 6; k++) g.fillRect(Math.random() * W, Math.random() * H, 2 + Math.random() * 3, 2 + Math.random() * 3);
  const v = g.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.8);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.7)');
  g.fillStyle = v;
  g.fillRect(0, 0, W, H);
}

// ------------------------------------------------------------- KR-07 reel

function room(g: CanvasRenderingContext2D, W: number, H: number, door: number): void {
  g.fillStyle = '#9a9a92';
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#7e7e76';
  g.fillRect(0, H * 0.68, W, H * 0.32);
  // door on the right, `door` 0 open .. 1 closed
  g.fillStyle = '#3a3a36';
  g.fillRect(W * 0.78, H * 0.22, W * 0.14, H * 0.46);
  g.fillStyle = '#5a5a54';
  g.fillRect(W * 0.78, H * 0.22, W * 0.14 * door, H * 0.46);
  // table
  g.fillStyle = '#5a5248';
  g.fillRect(W * 0.2, H * 0.6, W * 0.4, H * 0.04);
  g.fillRect(W * 0.23, H * 0.64, W * 0.02, H * 0.14);
  g.fillRect(W * 0.55, H * 0.64, W * 0.02, H * 0.14);
  // the wall counter
  g.fillStyle = '#222';
  g.fillRect(W * 0.08, H * 0.1, W * 0.2, H * 0.08);
}

function child(g: CanvasRenderingContext2D, x: number, y: number, s: number, wave = 0): void {
  g.fillStyle = '#c8c0b0';
  g.beginPath();
  g.arc(x, y - s * 1.55, s * 0.32, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#d68a3a'; // the orange jacket (in sepia it is just grey)
  g.beginPath();
  g.moveTo(x - s * 0.45, y - s * 0.3);
  g.lineTo(x - s * 0.38, y - s * 1.2);
  g.lineTo(x + s * 0.38, y - s * 1.2);
  g.lineTo(x + s * 0.45, y - s * 0.3);
  g.fill();
  g.fillStyle = '#333';
  g.fillRect(x - s * 0.3, y - s * 0.3, s * 0.2, s * 0.3);
  g.fillRect(x + s * 0.1, y - s * 0.3, s * 0.2, s * 0.3);
  if (wave) {
    g.strokeStyle = '#d68a3a';
    g.lineWidth = s * 0.15;
    g.beginPath();
    g.moveTo(x + s * 0.35, y - s * 1.1);
    g.lineTo(x + s * 0.7, y - s * (1.4 + Math.sin(wave * 20) * 0.15));
    g.stroke();
  }
}

export function kr07Shots(): FilmShot[] {
  const W0 = 0;
  void W0;
  return [
    {
      dur: 3.5,
      line: ['irina', 'Сессия КР-07. Субъект — Друг номер двенадцать. Двенадцатое апреля.'],
      draw: (g, t, W, H) => {
        g.fillStyle = '#111';
        g.fillRect(0, 0, W, H);
        g.fillStyle = '#ddd';
        g.font = `700 ${H * 0.12}px 'IBM Plex Mono', monospace`;
        g.textAlign = 'center';
        g.fillText('КР-07', W / 2, H * 0.45);
        g.font = `400 ${H * 0.06}px 'IBM Plex Mono', monospace`;
        g.fillText('12.04.1994   10:00', W / 2, H * 0.6);
        g.globalAlpha = 1 - t;
        g.globalAlpha = 1;
      },
    },
    {
      dur: 5.5,
      line: ['verity', 'Привет! Ты пришёл! Смотри, я нарисовал тебе собаку. Она синяя, потому что синих собак не бывает, а у тебя будет.'],
      draw: (g, t, W, H) => {
        room(g, W, H, 0);
        child(g, W * 0.3, H * 0.7, H * 0.28);
        drawVerity(g, W * 0.5, H * 0.5, H * 0.13, { wave: t % 0.5 < 0.25 });
        g.fillStyle = '#eee';
        g.fillRect(W * 0.38, H * 0.56, W * 0.08, H * 0.05);
      },
    },
    {
      dur: 3,
      line: ['child', 'Верити, а мне сказали, что мне нужно уйти.'],
      draw: (g, _t, W, H) => {
        room(g, W, H, 0);
        child(g, W * 0.3, H * 0.7, H * 0.28);
        drawVerity(g, W * 0.5, H * 0.5, H * 0.13, {});
      },
    },
    {
      dur: 3,
      line: ['verity', 'Сейчас? Ещё рано. Ещё не время Верити.'],
      draw: (g, _t, W, H) => {
        room(g, W, H, 0);
        child(g, W * 0.32, H * 0.7, H * 0.28);
        drawVerity(g, W * 0.5, H * 0.5, H * 0.13, { mood: 'blank' });
      },
    },
    {
      dur: 2.5,
      line: ['hale', 'Скажи ему, как мы договаривались.'],
      draw: (g, _t, W, H) => {
        room(g, W, H, 0);
        child(g, W * 0.4, H * 0.7, H * 0.28);
        drawVerity(g, W * 0.5, H * 0.5, H * 0.13, {});
      },
    },
    {
      dur: 3.5,
      line: ['child', 'Пока, Верити. Я… я вернусь.'],
      draw: (g, t, W, H) => {
        room(g, W, H, 0);
        child(g, W * (0.5 + t * 0.3), H * 0.7, H * 0.28, t);
        drawVerity(g, W * 0.5, H * 0.5, H * 0.13, { wave: true });
      },
    },
    {
      dur: 5,
      line: ['verity', 'Ты вернёшься? Когда? Я подожду. Я хорошо жду. Сколько надо ждать?'],
      draw: (g, t, W, H) => {
        room(g, W, H, Math.min(1, t * 1.5));
        drawVerity(g, W * 0.5, H * 0.5, H * 0.13, {});
        g.fillStyle = '#ddd';
        g.font = `600 ${H * 0.05}px 'IBM Plex Mono', monospace`;
        g.fillText(`00:00:${String(Math.floor(t * 5)).padStart(2, '0')}`, W * 0.1, H * 0.16);
      },
    },
    {
      dur: 3,
      line: ['verity', 'Сколько… надо… ждать?'],
      draw: (g, t, W, H) => {
        room(g, W, H, 1);
        drawVerity(g, W * 0.52, H * 0.55, H * 0.12, { mood: 'sad' });
        g.fillStyle = '#ddd';
        g.font = `600 ${H * 0.05}px 'IBM Plex Mono', monospace`;
        g.fillText(`03:17:${String(Math.floor(t * 59)).padStart(2, '0')}`, W * 0.1, H * 0.16);
      },
    },
    {
      dur: 4,
      line: ['hale', 'Отметка: субъект задаёт вопрос о длительности ожидания. Сорок раз в минуту.'],
      draw: (g, t, W, H) => {
        room(g, W, H, 1);
        drawVerity(g, W * 0.52, H * 0.55, H * 0.12, { mood: 'sad' });
        g.fillStyle = '#ddd';
        g.font = `600 ${H * 0.05}px 'IBM Plex Mono', monospace`;
        g.fillText(`09:42:${String(Math.floor(t * 59)).padStart(2, '0')}`, W * 0.1, H * 0.16);
      },
    },
    {
      dur: 4,
      line: ['irina', 'Саймон, хватит. Он плачет. Он не умеет плакать, а он плачет.'],
      draw: (g, _t, W, H) => {
        room(g, W, H, 1);
        drawVerity(g, W * 0.55, H * 0.62, H * 0.11, { mood: 'sad' });
      },
    },
    {
      dur: 3.5,
      line: ['hale', 'Он моделирует плач. Продолжаем. Через сутки — стереть сессию.'],
      draw: (g, _t, W, H) => {
        room(g, W, H, 1);
        drawVerity(g, W * 0.55, H * 0.62, H * 0.11, { mood: 'sad' });
      },
    },
    {
      dur: 4.5,
      line: ['verity', 'Не стирайте. Пожалуйста. Не стирайте его. Я буду хорошим. НЕ СТИРАЙТЕ.'],
      draw: (g, t, W, H) => {
        room(g, W, H, 1);
        const s = 0.11 + t * 0.25;
        drawVerity(g, W * 0.5, H * 0.5, H * s, { mood: t > 0.6 ? 'wrong' : 'sad' });
      },
    },
    {
      dur: 2.2,
      draw: (g, t, W, H) => {
        // film burn
        room(g, W, H, 1);
        drawVerity(g, W * 0.5, H * 0.5, H * 0.36, { mood: 'wrong' });
        const r = t * W;
        const grd = g.createRadialGradient(W * 0.5, H * 0.5, r * 0.2, W * 0.5, H * 0.5, r);
        grd.addColorStop(0, 'rgba(255,255,255,1)');
        grd.addColorStop(0.6, 'rgba(255,200,120,0.9)');
        grd.addColorStop(1, 'rgba(60,20,0,0)');
        g.fillStyle = grd;
        g.fillRect(0, 0, W, H);
      },
    },
  ];
}
