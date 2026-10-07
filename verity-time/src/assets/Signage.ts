/**
 * Canvas painters for posters, signs, children's drawings, photos, clock
 * faces and screens. These are the environmental storytelling layer.
 */
import { Rng } from './noise';
import { star } from './recipes';

export function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

const BRAND = "'Comfortaa', 'IBM Plex Sans', sans-serif";
const UI = "'IBM Plex Sans', sans-serif";
const MONO = "'IBM Plex Mono', monospace";
const HAND = "'Caveat', cursive";

export interface VerityDrawOpts {
  mood?: 'happy' | 'sad' | 'wrong' | 'blank';
  wobble?: number; // child drawing jitter
  outline?: string;
  flat?: boolean;
  wave?: boolean;
}

/** 2D illustration of Verity used across posters, logos, drawings. */
export function drawVerity(g: CanvasRenderingContext2D, x: number, y: number, r: number, o: VerityDrawOpts = {}): void {
  const wob = o.wobble ?? 0;
  const rng = new Rng(Math.floor(x * 13 + y * 7 + r));
  const j = () => (rng.next() - 0.5) * wob * r;
  g.save();
  g.lineJoin = 'round';
  g.lineCap = 'round';
  const outline = o.outline ?? '#3b2c3f';
  // legs + shoes
  g.fillStyle = '#d7372f';
  for (const sx of [-1, 1]) {
    g.strokeStyle = '#ef8a7e';
    g.lineWidth = r * 0.14;
    g.beginPath();
    g.moveTo(x + sx * r * 0.35, y + r * 0.8);
    g.lineTo(x + sx * r * 0.36 + j(), y + r * 1.15);
    g.stroke();
    g.beginPath();
    g.ellipse(x + sx * r * 0.4 + j(), y + r * 1.22, r * 0.26, r * 0.13, 0, 0, Math.PI * 2);
    g.fill();
    g.lineWidth = r * 0.03;
    g.strokeStyle = outline;
    g.stroke();
  }
  // arms
  g.strokeStyle = '#f4d35e';
  g.lineWidth = r * 0.12;
  g.beginPath();
  g.moveTo(x - r * 0.95, y);
  g.quadraticCurveTo(x - r * 1.35, y + r * 0.25, x - r * 1.25 + j(), y + r * 0.55);
  g.stroke();
  g.beginPath();
  g.moveTo(x + r * 0.95, y);
  if (o.wave) g.quadraticCurveTo(x + r * 1.4, y - r * 0.3, x + r * 1.3 + j(), y - r * 0.75);
  else g.quadraticCurveTo(x + r * 1.35, y + r * 0.25, x + r * 1.25 + j(), y + r * 0.55);
  g.stroke();
  g.fillStyle = '#fbf6ea';
  for (const [hx, hy] of [
    [x - r * 1.25, y + r * 0.6],
    o.wave ? [x + r * 1.3, y - r * 0.8] : [x + r * 1.25, y + r * 0.6],
  ]) {
    g.beginPath();
    g.arc(hx + j(), hy + j(), r * 0.15, 0, Math.PI * 2);
    g.fill();
    g.lineWidth = r * 0.03;
    g.strokeStyle = outline;
    g.stroke();
  }
  // body: two tone
  g.save();
  g.beginPath();
  g.arc(x + j() * 0.3, y + j() * 0.3, r, 0, Math.PI * 2);
  g.clip();
  g.fillStyle = '#f4d35e';
  g.fillRect(x - r, y - r, r * 2, r * 2);
  g.fillStyle = '#ef8a7e';
  g.fillRect(x - r, y + r * 0.42, r * 2, r);
  if (!o.flat) {
    const sh = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r * 1.1);
    sh.addColorStop(0, 'rgba(255,255,255,0.45)');
    sh.addColorStop(0.5, 'rgba(255,255,255,0)');
    sh.addColorStop(1, 'rgba(80,40,20,0.35)');
    g.fillStyle = sh;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  g.fillStyle = '#2fa79b';
  g.fillRect(x - r, y + r * 0.36, r * 2, r * 0.13);
  g.restore();
  g.lineWidth = r * 0.045;
  g.strokeStyle = outline;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.stroke();
  // antenna
  g.strokeStyle = '#7a8088';
  g.lineWidth = r * 0.04;
  g.beginPath();
  g.moveTo(x, y - r);
  for (let i = 0; i < 6; i++) g.lineTo(x + (i % 2 ? r * 0.05 : -r * 0.05), y - r - (i + 1) * r * 0.05);
  g.stroke();
  g.fillStyle = '#ffd84a';
  star(g, x + j(), y - r * 1.48 + j(), r * 0.24, r * 0.1, 5);
  g.lineWidth = r * 0.025;
  g.strokeStyle = outline;
  g.stroke();
  // face
  const mood = o.mood ?? 'happy';
  for (const sx of [-1, 1]) {
    const ex = x + sx * r * 0.34 + j() * 0.3;
    const ey = y - r * 0.2;
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.ellipse(ex, ey, r * 0.24, r * 0.29, 0, 0, Math.PI * 2);
    g.fill();
    g.lineWidth = r * 0.03;
    g.strokeStyle = outline;
    g.stroke();
    if (mood !== 'blank') {
      g.fillStyle = mood === 'wrong' ? '#000' : '#1f6f9f';
      g.beginPath();
      g.arc(ex + r * 0.03, ey + r * 0.03, mood === 'wrong' ? r * 0.05 : r * 0.14, 0, Math.PI * 2);
      g.fill();
      if (mood !== 'wrong') {
        g.fillStyle = '#05060a';
        g.beginPath();
        g.arc(ex + r * 0.03, ey + r * 0.03, r * 0.07, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#fff';
        g.beginPath();
        g.arc(ex + r * 0.08, ey - r * 0.04, r * 0.04, 0, Math.PI * 2);
        g.fill();
      }
    }
    if (mood === 'sad') {
      g.fillStyle = '#9fd3ff';
      g.beginPath();
      g.ellipse(ex + r * 0.05, ey + r * 0.38, r * 0.05, r * 0.09, 0, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.fillStyle = 'rgba(242,139,154,0.7)';
  for (const sx of [-1, 1]) {
    g.beginPath();
    g.ellipse(x + sx * r * 0.62, y + r * 0.05, r * 0.11, r * 0.07, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.strokeStyle = '#2a1720';
  g.lineWidth = r * 0.06;
  g.beginPath();
  if (mood === 'happy') g.arc(x, y + r * 0.02, r * 0.26, 0.15 * Math.PI, 0.85 * Math.PI);
  else if (mood === 'sad') g.arc(x, y + r * 0.42, r * 0.2, 1.15 * Math.PI, 1.85 * Math.PI);
  else if (mood === 'wrong') {
    g.moveTo(x - r * 0.35, y + r * 0.15);
    g.quadraticCurveTo(x, y + r * 0.45, x + r * 0.42, y + r * 0.05);
  } else {
    g.moveTo(x - r * 0.15, y + r * 0.22);
    g.lineTo(x + r * 0.15, y + r * 0.22);
  }
  g.stroke();
  g.restore();
}

function paperBg(g: CanvasRenderingContext2D, w: number, h: number, color: string, age: number, seed = 1): void {
  g.fillStyle = color;
  g.fillRect(0, 0, w, h);
  const rng = new Rng(seed);
  // stains & fading
  for (let i = 0; i < 18 * age; i++) {
    const x = rng.next() * w;
    const y = rng.next() * h;
    const r = (0.05 + rng.next() * 0.25) * Math.max(w, h);
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, `rgba(120,90,40,${0.05 + rng.next() * 0.08 * age})`);
    grd.addColorStop(1, 'rgba(120,90,40,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
  }
  // edge darkening
  const e = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
  e.addColorStop(0, 'rgba(0,0,0,0)');
  e.addColorStop(1, `rgba(60,40,10,${0.25 * age})`);
  g.fillStyle = e;
  g.fillRect(0, 0, w, h);
}

function wear(g: CanvasRenderingContext2D, w: number, h: number, amount: number, seed = 2): void {
  const rng = new Rng(seed);
  // scratches and tears
  g.strokeStyle = 'rgba(255,255,255,0.35)';
  for (let i = 0; i < 40 * amount; i++) {
    g.lineWidth = 0.5 + rng.next();
    const x = rng.next() * w;
    const y = rng.next() * h;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (rng.next() - 0.5) * w * 0.2, y + (rng.next() - 0.5) * h * 0.05);
    g.stroke();
  }
  // torn corner
  if (amount > 0.4) {
    g.save();
    g.globalCompositeOperation = 'destination-out';
    g.beginPath();
    const cx = rng.next() < 0.5 ? 0 : w;
    const cy = rng.next() < 0.5 ? 0 : h;
    g.moveTo(cx, cy);
    g.lineTo(cx + (cx ? -1 : 1) * w * (0.1 + rng.next() * 0.15), cy);
    g.lineTo(cx + (cx ? -1 : 1) * w * 0.05, cy + (cy ? -1 : 1) * h * 0.04);
    g.lineTo(cx, cy + (cy ? -1 : 1) * h * (0.08 + rng.next() * 0.1));
    g.closePath();
    g.fill();
    g.restore();
  }
  // grime overlay
  for (let i = 0; i < 8 * amount; i++) {
    const x = rng.next() * w;
    const y = rng.next() * h;
    const r = rng.next() * w * 0.3;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, `rgba(40,30,20,${0.15 * amount})`);
    grd.addColorStop(1, 'rgba(40,30,20,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
  }
}

function wrapText(g: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number): number {
  const words = text.split(' ');
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (g.measureText(test).width > maxW && line) {
      g.fillText(line, x, y);
      line = w;
      y += lh;
    } else line = test;
  }
  if (line) g.fillText(line, x, y);
  return y + lh;
}

// ---------------------------------------------------------------- posters

export type PosterKind =
  | 'friend'
  | 'time7'
  | 'truth'
  | 'birthday'
  | 'safety'
  | 'quality'
  | 'nodays'
  | 'quiet'
  | 'smile'
  | 'lost'
  | 'harmony'
  | 'staff'
  | 'missing'
  | 'show'
  | 'helper';

export function poster(kind: PosterKind, w = 512, h = 724, worn = 0.5, seed = 1): HTMLCanvasElement {
  const [c, g] = canvas(w, h);
  g.textAlign = 'center';
  switch (kind) {
    case 'friend': {
      const grd = g.createLinearGradient(0, 0, 0, h);
      grd.addColorStop(0, '#7fd3c7');
      grd.addColorStop(1, '#f6e3b0');
      g.fillStyle = grd;
      g.fillRect(0, 0, w, h);
      sunburst(g, w / 2, h * 0.45, '#ffffff', 0.18);
      drawVerity(g, w / 2, h * 0.47, w * 0.22, { wave: true });
      g.fillStyle = '#3b2c63';
      g.font = `700 ${w * 0.15}px ${BRAND}`;
      g.fillText('VERITY', w / 2, h * 0.16);
      g.font = `700 ${w * 0.06}px ${BRAND}`;
      g.fillText('ТВОЙ ДРУГ НАВСЕГДА', w / 2, h * 0.84);
      g.font = `400 ${w * 0.032}px ${UI}`;
      g.fillText('Комплекс «Время Верити» · Парк · Мастерские · Школа дружбы', w / 2, h * 0.92);
      break;
    }
    case 'time7': {
      g.fillStyle = '#26214a';
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 60; i++) {
        g.fillStyle = `rgba(255,255,220,${Math.random() * 0.8})`;
        g.fillRect(Math.random() * w, Math.random() * h * 0.6, 2, 2);
      }
      // clock
      clockFace(g, w / 2, h * 0.38, w * 0.26, 19, 0, false);
      drawVerity(g, w * 0.75, h * 0.62, w * 0.12, { wave: true });
      g.fillStyle = '#ffd84a';
      g.font = `700 ${w * 0.09}px ${BRAND}`;
      g.fillText('ВРЕМЯ ВЕРИТИ!', w / 2, h * 0.8);
      g.fillStyle = '#fff';
      g.font = `400 ${w * 0.04}px ${BRAND}`;
      g.fillText('Каждый вечер в 19:00 — песенка', w / 2, h * 0.87);
      g.fillText('для всех друзей одновременно', w / 2, h * 0.92);
      break;
    }
    case 'truth': {
      g.fillStyle = '#f6efe0';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#ef8a7e';
      g.fillRect(0, h * 0.7, w, h * 0.3);
      drawVerity(g, w / 2, h * 0.4, w * 0.2);
      g.fillStyle = '#2b2b5c';
      g.font = `700 ${w * 0.07}px ${BRAND}`;
      g.fillText('ВЕРИТИ ВСЕГДА', w / 2, h * 0.79);
      g.fillText('ГОВОРИТ ПРАВДУ', w / 2, h * 0.87);
      g.font = `400 ${w * 0.03}px ${UI}`;
      g.fillText('Игрушка, которой можно доверить всё.', w / 2, h * 0.94);
      break;
    }
    case 'birthday': {
      g.fillStyle = '#fde2e4';
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 30; i++) {
        g.fillStyle = ['#f4d35e', '#2fa79b', '#ef8a7e', '#7b6cf6'][i % 4];
        g.save();
        g.translate(Math.random() * w, Math.random() * h);
        g.rotate(Math.random() * 3);
        g.fillRect(-6, -3, 12, 6);
        g.restore();
      }
      drawVerity(g, w / 2, h * 0.42, w * 0.2, { wave: true });
      // party hat
      g.fillStyle = '#7b6cf6';
      g.beginPath();
      g.moveTo(w / 2 - w * 0.1, h * 0.42 - w * 0.2 * 0.9);
      g.lineTo(w / 2 + w * 0.1, h * 0.42 - w * 0.2 * 0.9);
      g.lineTo(w / 2 + w * 0.03, h * 0.42 - w * 0.2 * 1.9);
      g.closePath();
      g.fill();
      g.fillStyle = '#c0392b';
      g.font = `700 ${w * 0.075}px ${BRAND}`;
      g.fillText('С ДНЁМ РОЖДЕНИЯ,', w / 2, h * 0.78);
      g.fillText('ВЕРИТИ!', w / 2, h * 0.86);
      g.fillStyle = '#3b2c63';
      g.font = `400 ${w * 0.04}px ${BRAND}`;
      g.fillText('Праздник для всех друзей — 14 марта', w / 2, h * 0.93);
      break;
    }
    case 'safety': {
      g.fillStyle = '#f1c40f';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#111';
      g.fillRect(w * 0.06, h * 0.05, w * 0.88, h * 0.9);
      g.fillStyle = '#f1c40f';
      g.font = `700 ${w * 0.1}px ${UI}`;
      g.fillText('ВНИМАНИЕ', w / 2, h * 0.17);
      g.fillStyle = '#fff';
      g.font = `600 ${w * 0.055}px ${UI}`;
      wrapText(g, 'НЕ ОСТАВЛЯЙТЕ ДЕТЕЙ НАЕДИНЕ С ПРОТОТИПАМИ', w / 2, h * 0.32, w * 0.75, w * 0.07);
      g.font = `400 ${w * 0.035}px ${UI}`;
      wrapText(g, 'Все сессии проводятся только в присутствии координатора. Отдел Гармонии.', w / 2, h * 0.7, w * 0.75, w * 0.05);
      break;
    }
    case 'quality': {
      g.fillStyle = '#2f5d62';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#f6e7c1';
      g.font = `700 ${w * 0.08}px ${UI}`;
      g.fillText('КАЧЕСТВО —', w / 2, h * 0.2);
      g.fillText('ЭТО ЛЮБОВЬ', w / 2, h * 0.3);
      drawVerity(g, w / 2, h * 0.58, w * 0.16, { flat: true });
      g.font = `400 ${w * 0.035}px ${UI}`;
      g.fillText('Каждый друг проверен вручную', w / 2, h * 0.85);
      g.fillText('Мастерские «Пелл и Ламберт»', w / 2, h * 0.9);
      break;
    }
    case 'nodays': {
      g.fillStyle = '#f7f3ea';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#27ae60';
      g.fillRect(0, 0, w, h * 0.22);
      g.fillStyle = '#fff';
      g.font = `700 ${w * 0.065}px ${UI}`;
      g.fillText('ДНЕЙ БЕЗ', w / 2, h * 0.1);
      g.fillText('ПРОИСШЕСТВИЙ', w / 2, h * 0.18);
      g.fillStyle = '#111';
      g.font = `700 ${w * 0.4}px ${MONO}`;
      g.fillText('0', w / 2, h * 0.68);
      g.font = `400 ${w * 0.04}px ${HAND}`;
      g.fillStyle = '#c0392b';
      g.fillText('и не будет', w / 2 + w * 0.15, h * 0.8);
      break;
    }
    case 'quiet': {
      g.fillStyle = '#e8ecef';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#c0392b';
      g.beginPath();
      g.arc(w / 2, h * 0.35, w * 0.25, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#fff';
      g.fillRect(w / 2 - w * 0.17, h * 0.33, w * 0.34, h * 0.04);
      g.fillStyle = '#222';
      g.font = `700 ${w * 0.08}px ${UI}`;
      g.fillText('ТИШИНА', w / 2, h * 0.72);
      g.font = `400 ${w * 0.045}px ${UI}`;
      g.fillText('ИДЁТ СЕССИЯ', w / 2, h * 0.8);
      g.font = `400 ${w * 0.03}px ${UI}`;
      g.fillText('Не входить. Не стучать. Не отвечать субъекту.', w / 2, h * 0.88);
      break;
    }
    case 'smile': {
      g.fillStyle = '#ffe9a8';
      g.fillRect(0, 0, w, h);
      drawVerity(g, w / 2, h * 0.4, w * 0.24, {});
      g.fillStyle = '#3b2c63';
      g.font = `700 ${w * 0.07}px ${BRAND}`;
      g.fillText('УЛЫБНИСЬ!', w / 2, h * 0.8);
      g.font = `400 ${w * 0.04}px ${BRAND}`;
      g.fillText('Верити видит, когда тебе грустно', w / 2, h * 0.88);
      break;
    }
    case 'lost': {
      g.fillStyle = '#fffaf0';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#2fa79b';
      g.font = `700 ${w * 0.07}px ${BRAND}`;
      g.fillText('ПОТЕРЯЛСЯ?', w / 2, h * 0.14);
      g.fillStyle = '#333';
      g.font = `400 ${w * 0.042}px ${UI}`;
      wrapText(g, 'Стой на месте и громко скажи «Верити!». Друг найдёт тебя и отведёт к взрослым.', w / 2, h * 0.25, w * 0.8, w * 0.055);
      drawVerity(g, w / 2, h * 0.65, w * 0.16, { wave: true });
      break;
    }
    case 'harmony': {
      g.fillStyle = '#dfe6e9';
      g.fillRect(0, 0, w, h);
      g.strokeStyle = '#2d3436';
      g.lineWidth = w * 0.01;
      for (let i = 0; i < 5; i++) {
        g.beginPath();
        g.arc(w / 2, h * 0.38, w * (0.08 + i * 0.05), 0, Math.PI * 2);
        g.stroke();
      }
      g.fillStyle = '#2d3436';
      g.font = `600 ${w * 0.065}px ${UI}`;
      g.fillText('ОТДЕЛ ГАРМОНИИ', w / 2, h * 0.75);
      g.font = `400 ${w * 0.035}px ${UI}`;
      g.fillText('Привязанность — это навык. Мы его измеряем.', w / 2, h * 0.83);
      break;
    }
    case 'staff': {
      g.fillStyle = '#ecf0f1';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#2c3e50';
      g.font = `700 ${w * 0.06}px ${UI}`;
      g.fillText('ПАМЯТКА СОТРУДНИКУ', w / 2, h * 0.1);
      g.textAlign = 'left';
      g.font = `400 ${w * 0.036}px ${UI}`;
      let y = h * 0.2;
      for (const l of [
        '1. Не обещайте Верити, что вернётесь.',
        '2. Не называйте субъекта по имени при детях.',
        '3. Уходя, говорите «до встречи», а не «пока».',
        '4. Если Верити спрашивает, сколько сейчас времени — не отвечайте.',
        '5. Все часы должны идти. Сообщайте об остановленных часах.',
      ])
        y = wrapText(g, l, w * 0.08, y, w * 0.84, w * 0.05) + w * 0.03;
      g.textAlign = 'center';
      break;
    }
    case 'missing': {
      g.fillStyle = '#fbf8f1';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#111';
      g.font = `700 ${w * 0.1}px ${UI}`;
      g.fillText('ПРОПАЛ', w / 2, h * 0.12);
      g.fillStyle = '#888';
      g.fillRect(w * 0.2, h * 0.17, w * 0.6, h * 0.36);
      g.fillStyle = '#555';
      g.beginPath();
      g.arc(w / 2, h * 0.3, w * 0.12, 0, Math.PI * 2);
      g.fill();
      g.fillRect(w * 0.32, h * 0.4, w * 0.36, h * 0.13);
      g.fillStyle = '#111';
      g.font = `600 ${w * 0.05}px ${UI}`;
      g.fillText('ТЕО ЛАМБЕРТ', w / 2, h * 0.61);
      g.font = `400 ${w * 0.035}px ${UI}`;
      wrapText(g, 'Последний раз видели на территории мастерских 3 ноября 1998 г. Любая информация — на проходную.', w / 2, h * 0.68, w * 0.8, w * 0.048);
      break;
    }
    case 'show': {
      const grd = g.createLinearGradient(0, 0, 0, h);
      grd.addColorStop(0, '#6b1f28');
      grd.addColorStop(1, '#2a0d12');
      g.fillStyle = grd;
      g.fillRect(0, 0, w, h);
      // curtains
      g.fillStyle = '#9b2335';
      for (let i = 0; i < 8; i++) g.fillRect((i * w) / 16, 0, w / 24, h * 0.7);
      for (let i = 0; i < 8; i++) g.fillRect(w - ((i + 1) * w) / 16, 0, w / 24, h * 0.7);
      drawVerity(g, w / 2, h * 0.45, w * 0.15, { wave: true });
      g.fillStyle = '#ffd84a';
      g.font = `700 ${w * 0.08}px ${BRAND}`;
      g.fillText('ШОУ ВЕРИТИ', w / 2, h * 0.8);
      g.fillStyle = '#fff';
      g.font = `400 ${w * 0.04}px ${BRAND}`;
      g.fillText('Сеансы: 11:00 · 14:00 · 17:00', w / 2, h * 0.88);
      break;
    }
    case 'helper': {
      g.fillStyle = '#d6f0ec';
      g.fillRect(0, 0, w, h);
      drawVerity(g, w * 0.3, h * 0.45, w * 0.14, { wave: true });
      drawVerity(g, w * 0.7, h * 0.45, w * 0.14, {});
      g.fillStyle = '#1e4f4a';
      g.font = `700 ${w * 0.06}px ${BRAND}`;
      g.fillText('ВЕРИТИ ПОМОГАЕТ', w / 2, h * 0.75);
      g.font = `400 ${w * 0.035}px ${BRAND}`;
      g.fillText('убирать игрушки, делать уроки, не бояться темноты', w / 2, h * 0.83);
      break;
    }
  }
  wear(g, w, h, worn, seed);
  return c;
}

function sunburst(g: CanvasRenderingContext2D, x: number, y: number, color: string, alpha: number): void {
  g.save();
  g.globalAlpha = alpha;
  g.fillStyle = color;
  for (let i = 0; i < 24; i += 2) {
    const a0 = (i / 24) * Math.PI * 2;
    const a1 = ((i + 1) / 24) * Math.PI * 2;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a0) * 2000, y + Math.sin(a0) * 2000);
    g.lineTo(x + Math.cos(a1) * 2000, y + Math.sin(a1) * 2000);
    g.closePath();
    g.fill();
  }
  g.restore();
}

/** Clock face (all facility clocks are stopped at 19:00). */
export function clockFace(g: CanvasRenderingContext2D, x: number, y: number, r: number, hh: number, mm: number, frame = true): void {
  g.save();
  if (frame) {
    g.fillStyle = '#2b2b2b';
    g.beginPath();
    g.arc(x, y, r * 1.08, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = '#f7f2e4';
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#222';
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2;
    const big = i % 5 === 0;
    g.save();
    g.translate(x + Math.sin(a) * r * 0.88, y - Math.cos(a) * r * 0.88);
    g.rotate(a);
    g.fillRect(-r * (big ? 0.015 : 0.006), -r * (big ? 0.07 : 0.03), r * (big ? 0.03 : 0.012), r * (big ? 0.14 : 0.06));
    g.restore();
  }
  g.font = `600 ${r * 0.2}px ${UI}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (let i = 1; i <= 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    g.fillText(String(i), x + Math.sin(a) * r * 0.68, y - Math.cos(a) * r * 0.68);
  }
  // small star logo
  g.fillStyle = '#f2b632';
  star(g, x, y + r * 0.35, r * 0.09, r * 0.04, 5);
  const ha = (((hh % 12) + mm / 60) / 12) * Math.PI * 2;
  const ma = (mm / 60) * Math.PI * 2;
  g.strokeStyle = '#111';
  g.lineCap = 'round';
  g.lineWidth = r * 0.06;
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x + Math.sin(ha) * r * 0.5, y - Math.cos(ha) * r * 0.5);
  g.stroke();
  g.lineWidth = r * 0.035;
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x + Math.sin(ma) * r * 0.78, y - Math.cos(ma) * r * 0.78);
  g.stroke();
  g.fillStyle = '#c0392b';
  g.beginPath();
  g.arc(x, y, r * 0.05, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

export function clockCanvas(hh = 19, mm = 0): HTMLCanvasElement {
  const [c, g] = canvas(256, 256);
  clockFace(g, 128, 128, 116, hh, mm, true);
  return c;
}

// ---------------------------------------------------------------- signs

export interface SignOpts {
  bg?: string;
  fg?: string;
  font?: 'ui' | 'brand' | 'mono';
  w?: number;
  h?: number;
  sub?: string;
  border?: string;
  worn?: number;
  icon?: 'arrow-left' | 'arrow-right' | 'arrow-up' | 'star' | 'exit' | 'warning' | 'none';
}

export function sign(text: string, o: SignOpts = {}): HTMLCanvasElement {
  const w = o.w ?? 512;
  const h = o.h ?? 160;
  const [c, g] = canvas(w, h);
  g.fillStyle = o.bg ?? '#1f4f5a';
  g.fillRect(0, 0, w, h);
  if (o.border) {
    g.strokeStyle = o.border;
    g.lineWidth = h * 0.05;
    g.strokeRect(h * 0.05, h * 0.05, w - h * 0.1, h - h * 0.1);
  }
  g.fillStyle = o.fg ?? '#f6efe0';
  const fam = o.font === 'brand' ? BRAND : o.font === 'mono' ? MONO : UI;
  let size = h * (o.sub ? 0.38 : 0.48);
  g.font = `700 ${size}px ${fam}`;
  while (g.measureText(text).width > w * 0.82 && size > 8) {
    size *= 0.92;
    g.font = `700 ${size}px ${fam}`;
  }
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  let tx = w / 2;
  if (o.icon && o.icon !== 'none') {
    const ix = o.icon === 'arrow-right' ? w - h * 0.6 : h * 0.6;
    g.save();
    g.translate(ix, h / 2);
    g.lineWidth = h * 0.09;
    g.strokeStyle = o.fg ?? '#fff';
    g.fillStyle = o.fg ?? '#fff';
    if (o.icon.startsWith('arrow')) {
      g.rotate(o.icon === 'arrow-left' ? Math.PI : o.icon === 'arrow-up' ? -Math.PI / 2 : 0);
      g.beginPath();
      g.moveTo(-h * 0.25, 0);
      g.lineTo(h * 0.2, 0);
      g.moveTo(h * 0.05, -h * 0.17);
      g.lineTo(h * 0.25, 0);
      g.lineTo(h * 0.05, h * 0.17);
      g.stroke();
    } else if (o.icon === 'star') star(g, 0, 0, h * 0.3, h * 0.13, 5);
    else if (o.icon === 'warning') {
      g.beginPath();
      g.moveTo(0, -h * 0.3);
      g.lineTo(h * 0.3, h * 0.25);
      g.lineTo(-h * 0.3, h * 0.25);
      g.closePath();
      g.stroke();
      g.fillRect(-h * 0.02, -h * 0.1, h * 0.04, h * 0.18);
    } else if (o.icon === 'exit') {
      g.fillRect(-h * 0.2, -h * 0.3, h * 0.3, h * 0.6);
      g.fillStyle = o.bg ?? '#000';
      g.beginPath();
      g.arc(0, -h * 0.12, h * 0.06, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
    tx = o.icon === 'arrow-right' ? (w - h) / 2 : (w + h) / 2;
  }
  g.fillText(text, tx, o.sub ? h * 0.4 : h / 2);
  if (o.sub) {
    g.font = `400 ${h * 0.2}px ${fam}`;
    g.globalAlpha = 0.8;
    g.fillText(o.sub, tx, h * 0.75);
    g.globalAlpha = 1;
  }
  if (o.worn) wear(g, w, h, o.worn, text.length);
  return c;
}

// ------------------------------------------------------- children drawings

export type DrawingKind = 'verity_me' | 'verity_sad' | 'house' | 'many_friends' | 'clock' | 'locked' | 'lie' | 'twelve' | 'eyes' | 'goodbye' | 'family' | 'shadow';

export function childDrawing(kind: DrawingKind, seed = 1, w = 512, h = 384): HTMLCanvasElement {
  const [c, g] = canvas(w, h);
  paperBg(g, w, h, '#fffdf4', 0.4, seed);
  const rng = new Rng(seed);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const crayon = (col: string, width = 6) => {
    g.strokeStyle = col;
    g.fillStyle = col;
    g.lineWidth = width;
  };
  const kid = (x: number, y: number, s: number, col: string) => {
    crayon(col, 5);
    g.beginPath();
    g.arc(x, y - s * 1.6, s * 0.4, 0, Math.PI * 2);
    g.stroke();
    g.beginPath();
    g.moveTo(x, y - s * 1.2);
    g.lineTo(x, y - s * 0.4);
    g.lineTo(x - s * 0.4, y);
    g.moveTo(x, y - s * 0.4);
    g.lineTo(x + s * 0.4, y);
    g.moveTo(x - s * 0.5, y - s * 0.9);
    g.lineTo(x + s * 0.5, y - s * 0.9);
    g.stroke();
  };
  const text = (t: string, x: number, y: number, size = 34, col = '#c0392b') => {
    g.fillStyle = col;
    g.font = `700 ${size}px ${HAND}`;
    g.textAlign = 'center';
    g.fillText(t, x, y);
  };
  // sun & grass for most
  if (!['locked', 'eyes', 'shadow'].includes(kind)) {
    crayon('#f1c40f', 5);
    g.beginPath();
    g.arc(w * 0.88, h * 0.14, 26, 0, Math.PI * 2);
    g.stroke();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.beginPath();
      g.moveTo(w * 0.88 + Math.cos(a) * 34, h * 0.14 + Math.sin(a) * 34);
      g.lineTo(w * 0.88 + Math.cos(a) * 48, h * 0.14 + Math.sin(a) * 48);
      g.stroke();
    }
    crayon('#27ae60', 4);
    for (let x = 10; x < w; x += 14) {
      g.beginPath();
      g.moveTo(x, h * 0.95);
      g.lineTo(x + rng.range(-4, 4), h * 0.88);
      g.stroke();
    }
  }
  switch (kind) {
    case 'verity_me':
      drawVerity(g, w * 0.35, h * 0.5, h * 0.18, { wobble: 0.15, flat: true, wave: true });
      kid(w * 0.68, h * 0.85, 60, '#2980b9');
      crayon('#e74c3c', 4);
      g.beginPath();
      g.moveTo(w * 0.47, h * 0.5);
      g.quadraticCurveTo(w * 0.55, h * 0.45, w * 0.63, h * 0.62);
      g.stroke();
      text('я и верити', w * 0.5, h * 0.15);
      break;
    case 'verity_sad':
      drawVerity(g, w * 0.5, h * 0.5, h * 0.2, { wobble: 0.2, flat: true, mood: 'sad' });
      text('верити грусный', w * 0.5, h * 0.15, 32, '#2c3e50');
      break;
    case 'house':
      crayon('#8e5a2b', 5);
      g.strokeRect(w * 0.15, h * 0.45, w * 0.3, h * 0.42);
      g.beginPath();
      g.moveTo(w * 0.12, h * 0.45);
      g.lineTo(w * 0.3, h * 0.22);
      g.lineTo(w * 0.48, h * 0.45);
      g.stroke();
      drawVerity(g, w * 0.3, h * 0.66, h * 0.08, { wobble: 0.2, flat: true });
      kid(w * 0.7, h * 0.88, 50, '#8e44ad');
      text('дом верити', w * 0.65, h * 0.2, 30);
      break;
    case 'many_friends':
      for (let i = 0; i < 6; i++) kid(w * (0.12 + i * 0.15), h * 0.9, 40, ['#e74c3c', '#2980b9', '#27ae60', '#8e44ad', '#d35400', '#16a085'][i]);
      drawVerity(g, w * 0.5, h * 0.35, h * 0.13, { wobble: 0.2, flat: true, wave: true });
      text('у верити много друзей', w * 0.5, h * 0.1, 30);
      break;
    case 'clock':
      clockFace(g, w * 0.5, h * 0.48, h * 0.3, 19, 0, true);
      text('время верити!!!', w * 0.5, h * 0.12, 32);
      break;
    case 'locked':
      crayon('#2c3e50', 7);
      g.strokeRect(w * 0.2, h * 0.15, w * 0.6, h * 0.7);
      for (let x = w * 0.25; x < w * 0.8; x += w * 0.08) {
        g.beginPath();
        g.moveTo(x, h * 0.15);
        g.lineTo(x, h * 0.85);
        g.stroke();
      }
      drawVerity(g, w * 0.5, h * 0.55, h * 0.13, { wobble: 0.3, flat: true, mood: 'sad' });
      text('выпустите его', w * 0.5, h * 0.96, 30, '#2c3e50');
      break;
    case 'lie':
      drawVerity(g, w * 0.5, h * 0.5, h * 0.2, { wobble: 0.2, flat: true, mood: 'wrong' });
      text('он сказал что всё хорошо', w * 0.5, h * 0.12, 28, '#2c3e50');
      text('но это не правда', w * 0.5, h * 0.93, 28, '#c0392b');
      break;
    case 'twelve':
      drawVerity(g, w * 0.3, h * 0.5, h * 0.16, { wobble: 0.15, flat: true, wave: true });
      kid(w * 0.65, h * 0.85, 55, '#e67e22');
      text('друг №12', w * 0.65, h * 0.22, 34, '#2980b9');
      text('приходи ещё', w * 0.5, h * 0.12, 26);
      break;
    case 'eyes':
      g.fillStyle = '#111';
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 9; i++) {
        const x = rng.range(w * 0.1, w * 0.9);
        const y = rng.range(h * 0.1, h * 0.9);
        g.fillStyle = '#fff';
        g.beginPath();
        g.ellipse(x, y, 16, 20, 0, 0, Math.PI * 2);
        g.ellipse(x + 40, y, 16, 20, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#000';
        g.beginPath();
        g.arc(x + 3, y + 3, 6, 0, Math.PI * 2);
        g.arc(x + 43, y + 3, 6, 0, Math.PI * 2);
        g.fill();
      }
      text('он всегда смотрит', w * 0.5, h * 0.96, 30, '#f1c40f');
      break;
    case 'goodbye':
      drawVerity(g, w * 0.25, h * 0.55, h * 0.14, { wobble: 0.2, flat: true, wave: true });
      crayon('#2c3e50', 4);
      g.strokeRect(w * 0.55, h * 0.3, w * 0.25, h * 0.55);
      kid(w * 0.67, h * 0.82, 40, '#c0392b');
      text('пока верити', w * 0.5, h * 0.15, 32);
      text('(я вернусь)', w * 0.5, h * 0.25, 26, '#7f8c8d');
      break;
    case 'family':
      kid(w * 0.2, h * 0.88, 60, '#2c3e50');
      kid(w * 0.36, h * 0.88, 55, '#c0392b');
      kid(w * 0.52, h * 0.88, 38, '#2980b9');
      drawVerity(g, w * 0.75, h * 0.68, h * 0.12, { wobble: 0.2, flat: true, wave: true });
      text('моя семья', w * 0.5, h * 0.15, 34);
      break;
    case 'shadow':
      g.fillStyle = '#1b1b2f';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#f5e6a8';
      g.beginPath();
      g.arc(w * 0.5, h * 0.45, h * 0.3, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#1b1b2f';
      // rabbit + star shadow
      g.beginPath();
      g.ellipse(w * 0.45, h * 0.5, 38, 30, 0, 0, Math.PI * 2);
      g.ellipse(w * 0.42, h * 0.32, 8, 26, -0.2, 0, Math.PI * 2);
      g.ellipse(w * 0.48, h * 0.32, 8, 26, 0.2, 0, Math.PI * 2);
      g.fill();
      star(g, w * 0.6, h * 0.42, 26, 11, 5);
      text('театр теней', w * 0.5, h * 0.93, 30, '#f5e6a8');
      break;
  }
  return c;
}

// ---------------------------------------------------------------- photos

export function photo(kind: 'team' | 'friend12' | 'founders' | 'lumen' | 'party' | 'nadia' | 'empty', seed = 1, w = 320, h = 240): HTMLCanvasElement {
  const [c, g] = canvas(w, h);
  g.fillStyle = '#fff';
  g.fillRect(0, 0, w, h);
  const ix = 12;
  const iy = 12;
  const iw = w - 24;
  const ih = h - 44;
  const grd = g.createLinearGradient(0, iy, 0, iy + ih);
  grd.addColorStop(0, '#8a7a62');
  grd.addColorStop(1, '#4b3f30');
  g.fillStyle = grd;
  g.fillRect(ix, iy, iw, ih);
  const rng = new Rng(seed);
  const person = (x: number, y: number, s: number, shirt: string) => {
    g.fillStyle = '#e0b48f';
    g.beginPath();
    g.arc(x, y - s * 1.1, s * 0.32, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#3b2a1e';
    g.beginPath();
    g.arc(x, y - s * 1.2, s * 0.34, Math.PI, Math.PI * 2);
    g.fill();
    g.fillStyle = shirt;
    g.beginPath();
    g.moveTo(x - s * 0.5, y);
    g.lineTo(x - s * 0.42, y - s * 0.75);
    g.quadraticCurveTo(x, y - s * 0.9, x + s * 0.42, y - s * 0.75);
    g.lineTo(x + s * 0.5, y);
    g.fill();
  };
  g.save();
  g.beginPath();
  g.rect(ix, iy, iw, ih);
  g.clip();
  switch (kind) {
    case 'team':
      for (let i = 0; i < 6; i++) person(ix + iw * (0.12 + i * 0.15), iy + ih, 70 + rng.range(-8, 8), ['#ecf0f1', '#ecf0f1', '#34495e', '#ecf0f1', '#8e44ad', '#ecf0f1'][i]);
      drawVerity(g, ix + iw * 0.5, iy + ih * 0.55, 22, {});
      break;
    case 'friend12':
      person(ix + iw * 0.35, iy + ih, 55, '#e67e22');
      drawVerity(g, ix + iw * 0.65, iy + ih * 0.55, 30, { wave: true });
      break;
    case 'founders':
      person(ix + iw * 0.3, iy + ih, 85, '#2c3e50');
      person(ix + iw * 0.68, iy + ih, 80, '#7f8c8d');
      break;
    case 'lumen': {
      person(ix + iw * 0.3, iy + ih, 80, '#ecf0f1');
      // a second mascot silhouette: tall, lantern-like (sequel hook)
      g.fillStyle = '#d7e3ea';
      g.fillRect(ix + iw * 0.62, iy + ih * 0.25, iw * 0.12, ih * 0.6);
      g.beginPath();
      g.arc(ix + iw * 0.68, iy + ih * 0.25, iw * 0.08, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#fff6a8';
      g.beginPath();
      g.arc(ix + iw * 0.68, iy + ih * 0.25, iw * 0.04, 0, Math.PI * 2);
      g.fill();
      break;
    }
    case 'party':
      for (let i = 0; i < 5; i++) person(ix + iw * (0.15 + i * 0.18), iy + ih, 40, ['#e74c3c', '#3498db', '#f1c40f', '#2ecc71', '#9b59b6'][i]);
      drawVerity(g, ix + iw * 0.5, iy + ih * 0.35, 28, { wave: true });
      break;
    case 'nadia':
      person(ix + iw * 0.5, iy + ih, 90, '#1f3a5f');
      break;
    case 'empty':
      g.fillStyle = '#5a4c3b';
      g.fillRect(ix + iw * 0.4, iy + ih * 0.5, iw * 0.2, ih * 0.5);
      break;
  }
  g.restore();
  // fade, scratches
  g.fillStyle = 'rgba(255,220,160,0.18)';
  g.fillRect(ix, iy, iw, ih);
  wear(g, w, h, 0.4, seed);
  g.fillStyle = '#333';
  g.font = `400 16px ${HAND}`;
  g.textAlign = 'left';
  g.fillText({ team: 'Команда Гармонии, 1993', friend12: 'Друг №12 и В.', founders: 'А.П. и Т.Л., первый цех', lumen: 'Нортфилд. Проект «Люмен»', party: 'День рождения В., 1993', nadia: 'Н.К.', empty: '' }[kind], ix, h - 12);
  return c;
}

// ---------------------------------------------------------------- screens

export function screenCanvas(lines: string[], o: { w?: number; h?: number; color?: string; bg?: string; title?: string } = {}): HTMLCanvasElement {
  const w = o.w ?? 512;
  const h = o.h ?? 384;
  const [c, g] = canvas(w, h);
  g.fillStyle = o.bg ?? '#061008';
  g.fillRect(0, 0, w, h);
  g.fillStyle = o.color ?? '#79f2a8';
  g.font = `500 ${h * 0.055}px ${MONO}`;
  let y = h * 0.1;
  if (o.title) {
    g.fillText(o.title, w * 0.05, y);
    y += h * 0.09;
  }
  for (const l of lines) {
    g.fillText(l, w * 0.05, y);
    y += h * 0.07;
  }
  // scanlines
  g.fillStyle = 'rgba(0,0,0,0.25)';
  for (let yy = 0; yy < h; yy += 3) g.fillRect(0, yy, w, 1);
  const v = g.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, h * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.6)');
  g.fillStyle = v;
  g.fillRect(0, 0, w, h);
  return c;
}

/** Painted wall text / graffiti in crayon or marker. */
export function scrawl(text: string, o: { w?: number; h?: number; color?: string; font?: 'hand' | 'brand'; size?: number; rot?: number } = {}): HTMLCanvasElement {
  const w = o.w ?? 1024;
  const h = o.h ?? 256;
  const [c, g] = canvas(w, h);
  g.clearRect(0, 0, w, h);
  g.fillStyle = o.color ?? '#a82a2a';
  g.font = `700 ${o.size ?? h * 0.55}px ${o.font === 'brand' ? BRAND : HAND}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.save();
  g.translate(w / 2, h / 2);
  g.rotate(o.rot ?? -0.03);
  g.globalAlpha = 0.9;
  g.fillText(text, 0, 0);
  g.globalAlpha = 0.35;
  g.fillText(text, 2, 2);
  g.restore();
  return c;
}

/** Floor / wall stains with alpha. */
export function stain(kind: 'dirt' | 'water' | 'oil' | 'scuff' | 'footprints' | 'drag', seed = 1, size = 256): HTMLCanvasElement {
  const [c, g] = canvas(size, size);
  const rng = new Rng(seed);
  g.clearRect(0, 0, size, size);
  if (kind === 'footprints') {
    // small round "sneaker" prints (Verity) in a path
    for (let i = 0; i < 6; i++) {
      const x = size * 0.5 + (i % 2 ? 22 : -22);
      const y = size - (i + 0.5) * (size / 6);
      g.fillStyle = 'rgba(30,22,16,0.55)';
      g.beginPath();
      g.ellipse(x, y, 13, 22, 0, 0, Math.PI * 2);
      g.fill();
    }
    return c;
  }
  if (kind === 'drag') {
    g.strokeStyle = 'rgba(40,28,20,0.4)';
    for (let k = 0; k < 4; k++) {
      g.lineWidth = rng.range(3, 9);
      g.beginPath();
      g.moveTo(rng.range(0, size * 0.2), size * (0.3 + k * 0.1));
      g.bezierCurveTo(size * 0.4, size * (0.35 + k * 0.1), size * 0.6, size * (0.25 + k * 0.1), size, size * (0.3 + k * 0.1));
      g.stroke();
    }
    return c;
  }
  const col = kind === 'water' ? [70, 60, 40] : kind === 'oil' ? [8, 8, 8] : kind === 'scuff' ? [20, 20, 20] : [50, 38, 26];
  const n = kind === 'scuff' ? 30 : 14;
  for (let i = 0; i < n; i++) {
    const x = size / 2 + rng.range(-1, 1) * size * 0.3;
    const y = size / 2 + rng.range(-1, 1) * size * 0.3;
    const r = rng.range(size * 0.05, size * 0.25);
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, `rgba(${col[0]},${col[1]},${col[2]},${kind === 'scuff' ? 0.12 : 0.35})`);
    grd.addColorStop(1, `rgba(${col[0]},${col[1]},${col[2]},0)`);
    g.fillStyle = grd;
    g.fillRect(0, 0, size, size);
  }
  // fade to edges
  const m = g.createRadialGradient(size / 2, size / 2, size * 0.3, size / 2, size / 2, size / 2);
  m.addColorStop(0, 'rgba(0,0,0,1)');
  m.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = m;
  g.fillRect(0, 0, size, size);
  return c;
}
