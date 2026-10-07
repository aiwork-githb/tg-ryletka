// Several screenshots from one page load.
// Usage: node tools/multishot.mjs "<url-query>" outDir name:x,y,z,yaw[,pitch[,js]] ...
//   e.g. node tools/multishot.mjs "zone=research&debug" shots/r a:0,0,3,0 b:-9,0,-10,1.2,-0.1
// Each view teleports the player, optionally runs JS, waits VT_WAIT ms and saves <outDir>/<name>.png.
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const [query = '', outDir = 'shots/multi', ...views] = process.argv.slice(2);
const base = process.env.VT_URL ?? 'http://localhost:5173/';
const wait = Number(process.env.VT_WAIT ?? 1500);
const w = Number(process.env.VT_W ?? 1280), h = Number(process.env.VT_H ?? 720);
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: w, height: h } });
const logs = [];
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text()}`);
});
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}\n${e.stack ?? ''}`));
await page.goto(base + (query.startsWith('?') ? query : '?' + query));
try {
  await page.waitForFunction(() => window.__VT_READY === true, null, { timeout: 120000 });
} catch {
  logs.push('[harness] timeout waiting for __VT_READY');
}
for (const v of views) {
  const [name, spec] = v.split(/:(.*)/s);
  const parts = spec.split(',');
  const [x, y, z, yaw, pitch] = parts.slice(0, 5).map(Number);
  const js = parts.slice(5).join(',');
  try {
    const r = await page.evaluate(
      ([x, y, z, yaw, pitch, js]) => {
        const g = window.__VT;
        g.player.teleport(x, y, z, yaw, Number.isFinite(pitch) ? pitch : 0);
        if (js) return eval(js);
      },
      [x, y, z, yaw, pitch, js],
    );
    if (r !== undefined) logs.push(`[${name}] ${JSON.stringify(r)}`);
  } catch (e) {
    logs.push(`[${name}] eval error ${e.message}`);
  }
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `${outDir}/${name}.png` });
}
console.log(logs.join('\n'));
await browser.close();
