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
  return { g, use, prompt, top, close, tp, adv, term, choose, flags, sleep };
})();
0;
`;

const SCENARIOS = {
  research: {
    query: 'zone=research&spawn=lobby&debug',
    run: `(async () => {
      const { g, use, prompt, top, close, tp, adv, term, choose, flags, sleep } = QA;
      const out = {};
      const t0 = performance.now();
      const step = (k, v) => { out[k] = v; console.log('[qa] ' + k + '=' + JSON.stringify(v) + ' @' + Math.round(performance.now() - t0) + 'ms'); };
      // P6: terminal without memory → he leaves the module at the door
      tp(4.5, 0, -24.6, -Math.PI / 2);
      use('harmony_terminal');
      step('memSeen', g.state.is('research.memSeen'));
      tp(0, 0, 3, 0); await adv(0.5);
      step('memPlaced', g.state.is('research.memPlaced'));
      tp(0.3, 0, -20.5, 0);
      use('pickup:memory');
      step('hasMem', g.state.has('memory'));
      tp(4.5, 0, -24.6, -Math.PI / 2);
      use('harmony_terminal');
      step('memIn', g.state.is('research.memIn'));
      use('harmony_terminal');
      term(['hello', 'hale', 'wrong', 'КР-07', 'list', 'read утро', 'diag', 'restore 0C9D-77', 'restore 7F3A-12']);
      close();
      step('login', g.state.is('research.login'));
      step('p6', g.state.solved('p6'));
      // Hale's door opens once you know the password belongs to him
      tp(-3, 0, -20, Math.PI / 2); await adv(3);
      step('haleOpen', g.state.is('research.haleOpen'));
      // safe 0815 → Lumen photo
      tp(-14.5, 0, -28.5, Math.PI / 2);
      use('hale_safe');
      const kp = top(); step('safeCheck', kp.o.check('0815')); kp.o.onSuccess(); close();
      use('hale_photo');
      step('secSafe', g.state.data.secrets.includes('sec_safe'));
      // mirror writing in the flashlight
      tp(-5, 0, -8, -Math.PI / 2, 0.1); g.flashlight.on = true; await adv(2);
      use('mirror');
      step('secMirror', g.state.data.secrets.includes('sec_mirror'));
      // P7: archive rack 94 / April / 12
      tp(8.4, 0, -31.75, -Math.PI / 2);
      use('rack93'); choose([4, 12]); const m1 = top()?.el?.innerText?.slice(-80); close();
      step('wrongYearMsg', !!m1);
      use('rack94'); choose([4, 12]);
      step('p7', g.state.solved('p7'));
      step('hasReel', g.state.has('reel'));
      close();
      // hide-and-seek: hide in a locker in the lounge and wait it out
      tp(-9.6, 0, -35.2, 0);
      await adv(4);
      use('hide:lounge_locker0');
      await sleep(400);
      await adv(0.5);
      step('hidden', !!g.player.hidden);
      let seekT = 0;
      while (!g.state.is('research.seek') && seekT < 160) {
        await adv(2); seekT += 2;
        if (seekT % 20 === 0) console.log('[qa] seek t=' + seekT + ' mode=' + g.mode + ' ui=' + g.ui.stack.map((s) => s.id).join('|') + ' co=' + JSON.stringify(g.co.list.map((h) => [h.tag, +h.waitTime.toFixed(1), !!h.waitFn])) + ' v=' + g.verity.state + ' obj=' + g.state.data.objective);
      }
      step('seekDone', g.state.is('research.seek'));
      step('seekCaught', g.state.is('research.seekCaught'));
      step('seekTime', seekT);
      if (g.player.hidden) { g.player.exitHide(); }
      // film
      tp(2.6, 0, -37, Math.PI / 2);
      use('projector');
      let ft = 0;
      while (!g.state.is('research.bridgeOpen') && ft < 120) { await adv(2); ft += 2; }
      await adv(4);
      step('film', g.state.is('research.film'));
      step('bridgeOpen', g.state.is('research.bridgeOpen'));
      step('filmTime', ft);
      step('verityHidden', !g.verity.visible);
      step('canSave', g.canSave);
      step('objective', g.state.data.objective);
      // walk through the bridge door into the next zone
      tp(-18, 0, -46, 0); await adv(0.5);
      tp(-18, 0, -53, 0); await adv(0.5);
      step('done', g.state.is('research.done'));
      return out;
    })()`,
    expect: { memSeen: true, memPlaced: true, hasMem: true, memIn: true, login: true, p6: true, haleOpen: true, safeCheck: true, secSafe: true, secMirror: true, p7: true, hasReel: true, seekDone: true, film: true, bridgeOpen: true, canSave: true, done: true },
  },
};

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
  await page.screenshot({ path: `shots/qa/${name}.png` });
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
