// Scripted QA playthroughs. Each scenario loads a zone, drives the game
// through its puzzles via the same interactables the player uses, fast-
// forwards time with Game.advance() and reports flags / errors.
// Usage: node tools/qa.mjs [scenario ...]   (default: all)
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const base = process.env.VT_URL ?? 'http://localhost:5173/';

/** In-page helpers, injected before every scenario. */
const HELPERS = `
window.QA = (() => {
  const g = window.__VT;
  g.qa = true;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const use = (id) => {
    const i = g.interact.get(id);
    if (!i) throw new Error('no interactable ' + id);
    if (i.enabled === false) throw new Error('disabled interactable ' + id);
    i.onUse();
  };
  const prompt = (id) => g.interact.get(id)?.prompt() ?? null;
  const top = () => g.ui.stack[g.ui.stack.length - 1];
  const close = () => { while (g.ui.stack.length) g.closeScreen(); };
  const tp = (x, y, z, yaw = 0, pitch = 0) => g.player.teleport(x, y, z, yaw, pitch);
  const adv = (s) => { g.advance(s, 1 / 20); return new Promise((r) => setTimeout(r, 0)); };
  const term = (cmds) => { const t = top(); for (const c of cmds) t.prog.command(c, t.api); };
  const choose = (values) => {
    const el = top().el;
    const sels = el.querySelectorAll('select');
    values.forEach((v, i) => (sels[i].value = String(v)));
    el.querySelector('.btn.primary').click();
  };
  const flags = (...keys) => Object.fromEntries(keys.map((k) => [k, g.state.get(k) ?? null]));
  /** Advance until a dialogue question is open (or give up), then pick answer i. */
  const answer = async (i, maxSec = 40) => {
    let t = 0;
    while (top()?.id !== 'dialogue' && t < maxSec) { await adv(0.5); t += 0.5; }
    if (top()?.id !== 'dialogue') return false;
    top().el.querySelectorAll('.dlg-option')[i].click();
    await adv(0.1);
    return true;
  };
  const until = async (fn, maxSec = 60, step = 0.5) => {
    let t = 0;
    while (!fn() && t < maxSec) { await adv(step); t += step; }
    return t;
  };
  const t0 = performance.now();
  const out = {};
  const step = (k, v) => { out[k] = v; console.log('[qa] ' + k + '=' + JSON.stringify(v) + ' @' + Math.round(performance.now() - t0) + 'ms'); };
  return { g, use, prompt, top, close, tp, adv, term, choose, flags, sleep, answer, until, step, out };
})();
0;
`;

// scenarios live in tools/qa/<name>.mjs: export default { query, run, expect }
import { readdirSync } from 'node:fs';
const SCENARIOS = {};
for (const f of readdirSync(new URL('./qa/', import.meta.url)).filter((f) => f.endsWith('.mjs')).sort())
  SCENARIOS[f.replace(/\.mjs$/, '')] = (await import(new URL('./qa/' + f, import.meta.url))).default;

const want = process.argv.slice(2);
const names = want.length ? want : Object.keys(SCENARIOS);
mkdirSync('shots/qa', { recursive: true });
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});
let failed = 0;
for (const name of names) {
  const sc = SCENARIOS[name];
  if (!sc) {
    console.log(`unknown scenario ${name}`);
    failed++;
    continue;
  }
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
    else if (m.text().startsWith('[qa]')) console.log(m.text());
  });
  await page.goto(base + '?' + sc.query);
  await page.waitForFunction(() => window.__VT_READY === true, null, { timeout: 120000 });
  console.log(`[${name}] loaded`);
  await page.evaluate(HELPERS);
  console.log(`[${name}] running`);
  let res;
  try {
    res = await page.evaluate(sc.run);
  } catch (e) {
    res = { error: e.message };
  }
  await page.evaluate('(() => { window.__VT.qa = false; window.__VT.renderer.render(0); return 0; })()').catch(() => {});
  await page.screenshot({ path: `shots/qa/${name}.png` }).catch(() => {});
  const bad = Object.entries(sc.expect).filter(([k, v]) => res?.[k] !== v);
  const ok = !res?.error && bad.length === 0 && errors.length === 0;
  if (!ok) failed++;
  console.log(`\n=== ${name}: ${ok ? 'PASS' : 'FAIL'}`);
  console.log(JSON.stringify(res, null, 1));
  if (bad.length) console.log('mismatch:', bad.map(([k, v]) => `${k} expected ${v} got ${res?.[k]}`).join('; '));
  if (errors.length) console.log('errors:\n  ' + errors.slice(0, 10).join('\n  '));
  await page.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
