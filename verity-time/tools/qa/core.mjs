// QA scenario: Act VI Core — the shifting corridor (seams, loops), the Heart
// vault P12, the final conversation, the secret ending and the epilogue.
export default {
  query: 'zone=core&spawn=start&debug&items=theo_tape',
  run: `(async () => {
    const { g, use, top, tp, adv, flags, answer, until, step, out, sleep } = QA;
    g.player.god = true;
    await adv(3);
    tp(0, 0, -13.5, 0);
    await until(() => g.state.is('core.chase') && g.verity.state === 'chase', 30);
    step('chase', g.verity.state);
    // the alley stretches; the seam moves with the false wall
    await adv(4);
    step('wallMoved', Math.round(g.zone.refs.wall.z));
    tp(0, 0, g.zone.refs.wall.z - 1, 0);
    await adv(0.3);
    step('inM1', g.player.pos.x > 18 && g.player.pos.x < 30);
    // the "home" door loops back to the alley
    tp(24, 0, -42, 0);
    await adv(0.3);
    step('loopedToM0', Math.abs(g.player.pos.x) < 3);
    await adv(2.5);
    step('verityFollowed', g.verity.pos.distanceTo(g.player.pos) < 12);
    tp(0, 0, g.zone.refs.wall.z - 1, 0);
    await adv(0.3);
    tp(26.5, 0, -42, 0);
    await adv(0.3);
    step('inM2', g.player.pos.x > 39 && g.player.pos.x < 49);
    tp(44, 0, -44, 0);
    await adv(0.3);
    step('inM3', g.player.pos.x > 59 && g.player.pos.x < 64);
    g.player.crouched = true;
    tp(61.5, 0, -62, 0);
    await adv(0.3);
    g.player.crouched = false;
    step('inM4', g.player.pos.x > 79 && g.player.pos.x < 89);
    tp(86, 0, -42, 0);
    await adv(0.3);
    step('inHeart', g.player.pos.x > 100);
    await until(() => g.state.is('core.heart'), 10);
    await adv(12);
    step('chaseOver', !g.zone.refs.chase);
    // P12
    tp(110, 0, -37.8, Math.PI);
    use('core_palm');
    tp(120, 0, -37.8, Math.PI);
    use('core_dial');
    { const el = top().el; const s = el.querySelectorAll('select'); s[0].value = '7'; s[1].value = '0'; el.querySelector('.btn.primary').click(); }
    step('wrongTimeKeepsOpen', top()?.id === 'choice');
    { const el = top().el; const s = el.querySelectorAll('select'); s[0].value = '19'; s[1].value = '0'; el.querySelector('.btn.primary').click(); }
    tp(115, 0, -36.3, Math.PI);
    use('core_word');
    top().el.querySelectorAll('.dlg-option')[1].click();
    await adv(0.5);
    step('p12', g.state.solved('p12'));
    step('q', await answer(0, 40));
    await until(() => g.state.is('core.choice'), 40);
    step('choice', g.state.is('core.choice'));
    step('goodbyeOffered', g.interact.get('core_tape').prompt() !== null);
    // the secret ending
    tp(115, 0, -40.2, Math.PI);
    use('core_tape');
    step('farewell', await answer(0, 40));
    await until(() => g.state.is('act6.done'), 60);
    step('ending', g.state.get('ending.type'));
    await sleep(3500);
    await until(() => g.zone && g.zone.id === 'outside', 20);
    step('epilogueZone', g.zone && g.zone.id);
    for (let i = 0; i < 120 && g.mode !== 'play'; i++) await sleep(500);
    await adv(1);
    step('epMode', [g.mode, g.ui.stack.map((s) => s.id).join('|'), g.player.movementLocked]);
    tp(2.5, 0, 12.6, 0);
    await adv(0.5);
    step('atCar', [Math.round(g.player.pos.x * 10) / 10, Math.round(g.player.pos.z * 10) / 10, g.mode]);
    await sleep(3500);
    step('endingScreen', g.ui.stack.map((s) => s.id).join('|'));
    return out;
  })()`,
  expect: { chase: 'chase', inM1: true, loopedToM0: true, verityFollowed: true, inM2: true, inM3: true, inM4: true, inHeart: true, chaseOver: true, wrongTimeKeepsOpen: true, p12: true, q: true, choice: true, goodbyeOffered: true, farewell: true, ending: 'goodbye', epilogueZone: 'outside', endingScreen: 'ending' },
};
