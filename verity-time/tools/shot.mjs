// Headless screenshot / scripted-run harness.
// Usage: node tools/shot.mjs "<url-query>" out.png [waitMs] [--eval "js"]...
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const args = process.argv.slice(2);
const query = args[0] ?? '';
const out = args[1] ?? 'shots/shot.png';
const waitMs = Number(args[2] ?? 4000);
const evals = [];
for (let i = 3; i < args.length; i++) if (args[i] === '--eval') evals.push(args[++i]);
const base = process.env.VT_URL ?? 'http://localhost:5173/';
const w = Number(process.env.VT_W ?? 1280), h = Number(process.env.VT_H ?? 720);

mkdirSync(dirname(out), { recursive: true });
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: w, height: h } });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}\n${e.stack ?? ''}`));
await page.goto(base + (query.startsWith('?') ? query : '?' + query));
try {
  await page.waitForFunction(() => window.__VT_READY === true, null, { timeout: 120000 });
} catch (e) { logs.push('[harness] timeout waiting for __VT_READY'); }
for (const js of evals) {
  try { const r = await page.evaluate(js); if (r !== undefined) logs.push('[eval] ' + JSON.stringify(r)); }
  catch (e) { logs.push('[eval-error] ' + e.message); }
}
await page.waitForTimeout(waitMs);
await page.screenshot({ path: out });
console.log(logs.join('\n'));
await browser.close();
