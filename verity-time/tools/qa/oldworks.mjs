// QA scenario: Act V Old Works — badge, cabinet, Forever Room trap and vent,
// boiler and the hunt, P10 steam board, cameras, P11 music box, lift.
export default {
  query: 'zone=oldworks&spawn=start&debug&flags=bracelet.owned=1&items=tone_module',
  run: `(async () => {
    const { g, use, tp, adv, flags, until, step, out } = QA;
    await adv(2);
    // the badge in the cold storage, the cabinet in Nadia's office
    tp(-12, 0, -15.2, Math.PI);
    use('pickup:nadia_badge');
    step('badge', g.state.has('nadia_badge'));
    tp(15, 0, -10.6, Math.PI);
    use('ow_cabinet');
    step('wheel', g.state.has('valve_wheel'));
    // the Forever Room shuts behind you
    tp(13.5, 0, -22, -Math.PI / 2);
    await until(() => g.state.is('oldworks.trapped'), 5);
    await adv(4);
    step('trapped', g.state.is('oldworks.trapped'));
    step('doorLocked', !!g.interact.get('door:ow_forever')?.prompt()?.includes('Заперто'));
    tp(15, 0, -25.2, 0);
    for (let i = 0; i < 3; i++) use('ow_vent');
    step('vent', g.state.is('oldworks.vent'));
    g.player.crouched = true;
    tp(15, 0, -30, 0);
    await adv(0.3);
    tp(15, 0, -36.4, 0);
    await adv(0.5);
    step('escaped', g.state.is('oldworks.escaped'));
    g.player.crouched = false;
    // the board: wheel on, light the boiler
    tp(-6, 0, -37.4, Math.PI);
    use('ow_board_wheel');
    tp(2.4, 0, -50.6, -Math.PI / 2);
    use('lever:ow_gas');
    await until(() => g.state.is('oldworks.hunt') && g.verity.visible, 40);
    step('power', g.state.is('oldworks.power'));
    step('hunt', g.state.is('oldworks.hunt'));
    step('vState', g.verity.state);
    step('rubbleGone', !g.zone.refs.rubble.col.enabled);
    g.player.god = true;
    // cut one camera
    tp(17, 0, -37.2, 0);
    use('ow_cam_cut_0');
    step('camCut', g.state.is('oldworks.cut.0'));
    // the workshop camera spots you; he should come
    tp(24, 0, -48, 0);
    const d0 = g.verity.pos.distanceTo(g.player.pos);
    await adv(25);
    const d1 = g.verity.pos.distanceTo(g.player.pos);
    step('approach', [Math.round(d0), Math.round(d1), g.verity.state]);
    // route steam: open V2 and V6, close V3 and V5
    await until(() => g.zone.refs.steam.pressure >= 1, 20);
    tp(-6, 0, -37.4, Math.PI);
    for (const v of [2, 6, 3, 5]) use('ow_valve_' + v);
    step('p10', g.state.solved('p10'));
    // the music box needs the bracelet on
    g.state.set('bracelet.on', true);
    tp(-19.5, 0, -50, Math.PI / 2);
    await adv(0.2);
    const st = g.state.puzzle('p11', () => null);
    const target = [4, 2, 1, 0];
    for (let i = 0; i < 4; i++) { let k = 0; while (st.tines[i] !== target[i] && k++ < 9) use('ow_tine_' + i); }
    use('ow_crank');
    await until(() => g.state.is('oldworks.liftOpen'), 15);
    step('p11', g.state.solved('p11'));
    step('liftOpen', g.state.is('oldworks.liftOpen'));
    await adv(2);
    use('ow_box_drawer');
    step('tape', g.state.has('theo_tape'));
    // ride down
    tp(2, 0, -67, Math.PI);
    await adv(0.3);
    use('ow_lift_down');
    await until(() => g.state.is('oldworks.done'), 40);
    step('done', g.state.is('oldworks.done'));
    step('secrets', g.state.data.secrets.length);
    return out;
  })()`,
  expect: { badge: true, wheel: true, trapped: true, doorLocked: true, vent: true, escaped: true, power: true, hunt: true, rubbleGone: true, camCut: true, p10: true, p11: true, liftOpen: true, tape: true, done: true },
};
