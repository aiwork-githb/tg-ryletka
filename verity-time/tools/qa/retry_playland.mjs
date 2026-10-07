// QA scenario: getting caught in chase 1 and retrying from the stage checkpoint.
export default {
  query: 'zone=playland&spawn=stage&debug&flags=playland.lights=1,playland.turnstile=1,playland.met=1,playland.theoDoor=1,playland.carousel=1,solved.p8=1,solved.p9=1',
  run: `(async () => {
    const { g, tp, adv, answer, until, step, out, sleep } = QA;
    await adv(1);
    tp(0.1, 0, -30.5, 0);
    await adv(0.5);
    step('q3', await answer(2, 40));
    await until(() => g.state.is('playland.chase'), 20);
    step('chase', g.verity.state);
    // stand still and let him catch you
    await until(() => g.mode === 'dead', 40);
    step('caught', g.mode);
    await sleep(1500);
    step('caughtScreen', g.ui.stack.map((s) => s.id).join('|'));
    g.retry();
    for (let i = 0; i < 120 && g.mode !== 'play'; i++) await sleep(500);
    await adv(0.5);
    step('reloaded', g.zone && g.zone.id);
    step('flagsBack', [g.state.is('playland.q3'), g.state.is('playland.chase'), g.state.is('playland.carousel')]);
    step('askedAgain', await answer(0, 40));
    await until(() => g.state.is('playland.chase'), 20);
    step('chaseAgain', g.verity.state);
    step('deaths', g.state.data.deaths);
    return out;
  })()`,
  expect: { q3: true, chase: 'chase', caught: 'dead', caughtScreen: 'caught', reloaded: 'playland', askedAgain: true, chaseAgain: 'chase', deaths: 1 },
};
