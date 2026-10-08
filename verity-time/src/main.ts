import '@fontsource/comfortaa/400.css';
import '@fontsource/comfortaa/700.css';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-sans/700.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/ibm-plex-mono/600.css';
import '@fontsource/caveat/400.css';
import '@fontsource/caveat/700.css';
import './ui/style.css';
import { Game } from './Game';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ui = document.getElementById('ui') as HTMLElement;

async function start(): Promise<void> {
  // make sure the fonts used by canvas-painted textures are loaded first
  await Promise.all(
    ["400 20px 'Comfortaa'", "700 20px 'Comfortaa'", "400 20px 'IBM Plex Sans'", "700 20px 'IBM Plex Sans'", "500 20px 'IBM Plex Mono'", "700 20px 'Caveat'"].map((f) =>
      document.fonts.load(f, 'АБВабв').catch(() => undefined),
    ),
  );
  const qs = new URLSearchParams(location.search);
  if (__DEBUG__ && qs.has('modelview')) {
    const { modelView } = await import('./debug/ModelView');
    void modelView(qs.get('modelview') || 'verity');
    return;
  }
  if (__DEBUG__ && qs.has('texdebug')) {
    const { texView } = await import('./debug/TexView');
    texView(qs.get('texdebug') || undefined);
    return;
  }
  const game = new Game(canvas, ui);
  await game.boot();
}

start().catch((e) => {
  console.error(e);
  document.body.innerHTML = `<pre style="color:#f88;padding:20px;white-space:pre-wrap">${String(e?.stack ?? e)}</pre>`;
});
