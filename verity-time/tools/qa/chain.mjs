// QA scenario: real zone hand-offs at the end of Acts IV and V, carrying
// the inventory across (bracelet, tone module, Theo's tape).
export default {
  query: 'zone=playland&spawn=kitchen&debug&flags=bracelet.owned=1,playland.q3=1,playland.chase=1,playland.dockPower=1&items=bracelet,tone_module,friend_card',
  run: `(async () => {
    const { g, tp, adv, until, step, out, sleep, use } = QA;
    await adv(1);
    tp(32.2, -1.8, 13.5, Math.PI);
    await adv(0.5);
    await until(() => g.state.is('act4.done'), 30);
    await sleep(3000);
    for (let i = 0; i < 160 && !(g.zone && g.zone.id === 'oldworks' && g.mode === 'play'); i++) { await sleep(400); if (g.mode === 'play') await adv(0.2); }
    step('oldworks', [g.zone && g.zone.id, g.mode]);
    step('carried', ['bracelet', 'tone_module', 'friend_card'].every((i) => g.state.has(i)));
    await adv(8);
    step('arrival', g.state.is('oldworks.entered'));
    // jump to the end of Act V
    g.state.set('oldworks.liftOpen');
    g.state.set('oldworks.power');
    g.state.addItem('theo_tape');
    const lg = g.zone.refs.liftGate; lg.gate.position.y = 2.6; lg.col.enabled = false;
    tp(2, 0, -67, Math.PI);
    await adv(0.3);
    use('ow_lift_down');
    await until(() => g.state.is('oldworks.done'), 40);
    await sleep(3000);
    for (let i = 0; i < 160 && !(g.zone && g.zone.id === 'core' && g.mode === 'play'); i++) { await sleep(400); if (g.mode === 'play') await adv(0.2); }
    step('core', [g.zone && g.zone.id, g.mode]);
    await adv(8);
    step('coreArrival', g.state.is('core.entered'));
    step('tape', g.state.has('theo_tape'));
    return out;
  })()`,
  expect: { carried: true, arrival: true, coreArrival: true, tape: true },
};
