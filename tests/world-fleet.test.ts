import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSeaRoutes } from '../src/world-sea-routes.js';
import { createWorldFleet } from '../src/world-fleet.js';
import { WORLD_ISLETS } from '../src/world-offshore.js';
const coast = (u: number, _v: number) => (u * 36 - 18 > 2 ? 0.3 : -0.18);
test('rotas marítimas ficam na água e terminam junto à costa', () => {
  const routes = createSeaRoutes(coast);
  for (let seed = 1; seed <= 20; seed++) {
    const route = routes.route(seed);
    assert.ok(route.length >= 2);
    const port = route.at(-1)!;
    assert.ok(
      (port.x > 1 && port.x < 2) ||
        WORLD_ISLETS.some(
          ([cx, cy, r]) => Math.hypot(port.x - cx, (port.y - cy) / 0.8) < r * 1.18 + 0.6,
        ),
    );
    for (let i = 0; i < route.length - 1; i++)
      for (let t = 0; t <= 1; t += 0.025)
        assert.ok(
          routes.safe({
            x: route[i].x + (route[i + 1].x - route[i].x) * t,
            y: route[i].y + (route[i + 1].y - route[i].y) * t,
          }),
        );
  }
});
test('oito barcos lentos, kraken a cada 30 s, afundamento e movimento reduzido', () => {
  const fleet = createWorldFleet(coast);
  try {
    assert.ok(fleet.group.getObjectByName('pirate-ship-0')!.getObjectByName('ship-woodwork'));
    fleet.update(0);
    const initial = fleet.state.positions;
    const advance = (start: number, end: number) => {
      for (let t = start; t <= end + 1e-6; t += 0.1) fleet.update(t);
    };
    advance(0.1, 29.9);
    assert.equal(fleet.state.attacks, 0);
    const traveled = Math.hypot(
      fleet.state.positions[0].x - initial[0].x,
      fleet.state.positions[0].y - initial[0].y,
    );
    assert.ok(traveled > 0.5 && traveled < 1.1);
    advance(30, 30.2);
    assert.equal(fleet.state.attacks, 1);
    assert.equal(fleet.state.attacking, true);
    assert.equal(fleet.group.getObjectByName('sea-kraken')!.visible, true);
    const boat = fleet.group.getObjectByName('pirate-ship-0')!;
    assert.equal(boat.scale.x, 0.75);
    advance(30.3, 32.3);
    assert.ok(Math.abs(boat.rotation.y) > 0.3, 'o golpe deve inclinar o casco');
    assert.ok(fleet.group.getObjectByName('ship-wreckage')!.children.some((part) => part.visible));
    assert.equal(fleet.group.getObjectByName('kraken-impact-splash')!.visible, true);
    advance(32.4, 34.3);
    assert.ok(
      Math.abs(boat.getObjectByName('breakable-mast')!.rotation.y) > 0.8,
      'o mastro deve ceder após os golpes',
    );
    advance(34.4, 36);
    assert.ok(fleet.group.getObjectByName('pirate-ship-0')!.position.z < -0.5);
    advance(36.1, 37.2);
    const kraken = fleet.group.getObjectByName('sea-kraken')!;
    const tips = Array.from({ length: 6 }, (_, i) =>
      kraken.getObjectByName(`kraken-arm-${i}-joint-12`)!,
    );
    const previousTips = tips.map((tip) => tip.position.clone());
    assert.equal(fleet.group.getObjectByName('kraken-impact-splash')!.visible, true);
    advance(37.3, 37.5);
    assert.ok(
      tips.some((tip, i) => tip.position.distanceTo(previousTips[i]) > 0.1),
      'braços devem se dobrar durante a descida, sem translação rígida',
    );
    assert.ok(
      tips.some((tip) => tip.position.z + kraken.position.z > 0.1),
      'pontas ainda se levantam acima da água',
    );
    advance(37.6, 39.3);
    assert.equal(fleet.state.attacking, false);
    assert.equal(fleet.group.getObjectByName('sea-kraken')!.visible, false);
    assert.equal(boat.getObjectByName('breakable-mast')!.rotation.y, 0);
    assert.equal(boat.getObjectByName('ship-wake')!.visible, true);
    advance(39.4, 60.3);
    assert.equal(fleet.state.attacks, 2);
    const frozen = fleet.state;
    fleet.update(100, true);
    assert.deepEqual(fleet.state, frozen);
  } finally {
    fleet.dispose();
  }
});
