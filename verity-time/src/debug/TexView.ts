import { MAT_DEFS } from '../assets/Materials';
import { RECIPES } from '../assets/recipes';
import { Surface } from '../assets/Surface';

/** ?texdebug — renders every material's albedo / roughness / height side by side. */
export function texView(filter?: string): void {
  document.body.style.overflow = 'auto';
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;padding:6px;background:#222;position:absolute;inset:0;overflow:auto;z-index:100';
  document.body.append(wrap);
  const ids = Object.keys(MAT_DEFS).filter((k) => !filter || k.includes(filter));
  for (const id of ids) {
    const def = MAT_DEFS[id];
    const s = new Surface(256, 7919 + id.length);
    RECIPES[def.recipe](s, def.params ?? {});
    s.clampAll();
    for (const [ch, label] of [
      ['albedo', id],
      ['rough', 'R'],
      ['height', 'H'],
    ] as const) {
      const c = document.createElement('canvas');
      c.width = c.height = 256;
      const g = c.getContext('2d')!;
      const im = g.createImageData(256, 256);
      for (let i = 0; i < s.n; i++) {
        if (ch === 'albedo') {
          im.data[i * 4] = s.r[i] * 255;
          im.data[i * 4 + 1] = s.g[i] * 255;
          im.data[i * 4 + 2] = s.b[i] * 255;
        } else {
          const v = (ch === 'rough' ? s.rough[i] : s.height[i]) * 255;
          im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v;
        }
        im.data[i * 4 + 3] = 255;
      }
      g.putImageData(im, 0, 0);
      g.fillStyle = '#000a';
      g.fillRect(0, 0, 256, 16);
      g.fillStyle = '#fff';
      g.font = '12px monospace';
      g.fillText(label, 4, 12);
      c.style.width = ch === 'albedo' ? '256px' : '96px';
      c.style.height = ch === 'albedo' ? '256px' : '96px';
      wrap.append(c);
    }
  }
  (window as any).__VT_READY = true;
}
