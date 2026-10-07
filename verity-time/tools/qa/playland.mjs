// QA scenario: Act IV Playland — turnstile, three questions, P9 shadow theatre,
// Theo's room, P8 carousel bells, stage, chase mechanics (bolted door, dock gate), exit.
export default {
  query: 'zone=playland&spawn=start&debug',
  run: `(async () => {
    const { g, use, top, tp, adv, flags, answer, until, step, out } = QA;
    await until(() => g.state.is('playland.lights'), 40);
    step('lights', g.state.is('playland.lights'));
    tp(-0.75, 0, 4.2, 0);
    use('pl_turnstile');
    step('turnstile', g.state.is('playland.turnstile'));
    await adv(6);
    tp(0.1, 0, -5.5, 0);
    await adv(0.5);
    step('q1', await answer(0));
    await until(() => !g.verity.visible, 30);
    step('met', g.state.is('playland.met'));
    // P9: drive the puppets to the poster picture
    tp(-31.5, 0, -25, 0);
    const st = g.state.puzzle('p9', () => null);
    const target = { child: { slot: 1, flip: false }, verity: { slot: 2, flip: true }, dog: { slot: 4, flip: true } };
    for (const id of ['child', 'verity', 'dog']) {
      let guard = 0;
      while (st.p[id].slot !== target[id].slot && guard++ < 6) use('pl_puppet_' + id + '_0');
      if (st.p[id].flip !== target[id].flip) use('pl_puppet_' + id + '_1');
    }
    step('p9', g.state.solved('p9'));
    await until(() => g.state.is('playland.theoDoor'), 15);
    step('theoDoor', g.state.is('playland.theoDoor'));
    tp(-37, 0, -19, Math.PI);
    use('pickup:carousel_key');
    use('pickup:tone_module');
    step('items', g.state.has('carousel_key') && g.state.has('tone_module'));
    // P8: the bells
    tp(8.2, 0, -12.4, 0.8);
    use('pl_carousel_key');
    for (const b of ['red', 'yellow', 'green', 'purple', 'blue']) use('pl_bell_' + b);
    step('p8', g.state.solved('p8'));
    step('q2', await answer(0, 60));
    await until(() => g.state.is('playland.carousel'), 30);
    step('carousel', g.state.is('playland.carousel'));
    // the stage: the third question starts the chase
    tp(0.1, 0, -30.5, 0);
    await adv(0.5);
    step('q3', await answer(0, 40));
    await until(() => g.state.is('playland.chase'), 20);
    step('chase', g.state.is('playland.chase'));
    step('vState', g.verity.state);
    // the bolted door: wait behind it and let him break it
    g.player.god = true;
    tp(28, 0, -35, Math.PI);
    use('door:pl_d12');
    tp(28, 0, -29.5, Math.PI);
    await adv(0.3);
    use('door:pl_d12');
    use('bolt:pl_d12');
    step('bolted', g.verity.doors.find((d) => d.o && d.o.id === 'pl_d12')?.bolted ?? null);
    g.verity.lastSeen.set(28, 0, -29.5);
    const bashT = await until(() => g.state.is('door.pl_d12'), 60);
    step('bashed', g.state.is('door.pl_d12'));
    step('bashTime', bashT);
    step('vPos', [Math.round(g.verity.pos.x), Math.round(g.verity.pos.z)]);
    // power the dock gate and wait for it
    tp(38, 0, -9.5, -Math.PI / 2);
    use('lever:pl_dock_power');
    step('dockPower', g.state.is('playland.dockPower'));
    await adv(8);
    tp(30, 0, -3, Math.PI);
    await adv(0.2);
    tp(30, 0, 1, Math.PI);
    await adv(0.5);
    step('throughGate', g.player.pos.z > 0);
    tp(32.2, -1.8, 13.5, Math.PI);
    await adv(0.5);
    await until(() => g.state.is('act4.done'), 30);
    step('done', g.state.is('act4.done'));
    step('honesty', flags('honesty.truth', 'honesty.lie', 'honesty.silent'));
    return out;
  })()`,
  expect: { lights: true, turnstile: true, q1: true, met: true, p9: true, theoDoor: true, items: true, p8: true, q2: true, carousel: true, q3: true, chase: true, bolted: true, bashed: true, dockPower: true, done: true },
};
