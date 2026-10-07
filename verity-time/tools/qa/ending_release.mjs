// QA scenario: the "release" ending from the Heart console through the epilogue.
export default {
  query: 'zone=core&spawn=heart&debug&flags=core.entered=1,core.chase=1,core.heart=1,core.vault=1,core.choice=1&items=theo_tape',
  run: `(async () => {
    const { g, use, tp, adv, until, step, out, sleep } = QA;
    g.state.inc('honesty.lie');
    await adv(2);
    step('tapeRejectedOffered', g.interact.get('core_tape').prompt() !== null);
    tp(115, 0, -40.2, Math.PI);
    use('core_release');
    await until(() => g.state.is('act6.done'), 90);
    step('ending', g.state.get('ending.type'));
    await sleep(3500);
    await until(() => g.zone && g.zone.id === 'outside', 20);
    for (let i = 0; i < 120 && g.mode !== 'play'; i++) await sleep(500);
    await adv(2);
    tp(2.5, 0, 12.6, 0);
    await adv(0.5);
    await sleep(3500);
    step('endingScreen', g.ui.stack.map((s) => s.id).join('|'));
    return out;
  })()`,
  expect: { ending: 'release', endingScreen: 'ending' },
};
