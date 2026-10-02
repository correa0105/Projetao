import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createWorldFleet } from '../src/world-fleet';

test('kraken continua batendo braços independentes enquanto submerge após o barco sumir', () => {
  const fleet = createWorldFleet(() => 0);
  let time = 0;
  const advance = (seconds: number) => {
    const end = time + seconds;
    while (time < end - 0.0001) {
      time += 0.05;
      fleet.update(time);
    }
  };
  try {
    fleet.update(0);
    advance(30.1);
    assert.equal(fleet.state.attacking, true);
    advance(7.5);
    assert.equal(fleet.state.attackPhase, 'submerging');
    const kraken = fleet.group.getObjectByName('sea-kraken')!;
    const ship = fleet.group.getObjectByName('pirate-ship-0')!;
    assert.equal(ship.visible, false);
    const depth = fleet.state.krakenDepth;
    const tips = () =>
      Array.from({ length: 6 }, (_, i) => {
        const arm = kraken.getObjectByName(`kraken-tentacle-${i}`) as THREE.Mesh;
        const vertices = arm.geometry.getAttribute('position');
        return vertices.getZ(vertices.count - 1);
      });
    const before = tips();
    advance(0.3);
    const deltas = tips().map((tip, i) => tip - before[i]);
    assert.ok(
      deltas.some((d) => d > 0.01),
      'um braço se ergue',
    );
    assert.ok(
      deltas.some((d) => d < -0.01),
      'outro bate na água simultaneamente',
    );
    assert.ok(fleet.state.krakenDepth < depth, 'corpo afunda progressivamente');
    advance(5.3);
    assert.equal(fleet.state.attacking, false);
    assert.equal(kraken.visible, false);
  } finally {
    fleet.dispose();
  }
});
