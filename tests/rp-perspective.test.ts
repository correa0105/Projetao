import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rpFloorScale, rpDragPosition } from '../shared/rp-perspective.js';
import { houseFloorScale } from '../shared/house-perspective.js';
test('lobby preserva a perspectiva da House e o ponto agarrado ao mover em profundidade', () => {
  for (const scene of [
    'beach',
    'market',
    'plaza',
    'tavern',
    'hall-library',
    'porch-pines',
    'garden-moon',
  ]) {
    assert.equal(rpFloorScale(0.84, scene), 1);
    assert(rpFloorScale(0.52, scene) < 0.4);
    assert(rpFloorScale(0.94, scene) > 1);
    if (scene === 'tavern')
      assert.equal(rpFloorScale(0.7, scene), houseFloorScale(0.7, 'hall-hearth'));
    for (const bounds of [
      { width: 1777, height: 1000 },
      { width: 1440, height: 810 },
      { width: 900, height: 506 },
    ]) {
      const grab = { x: -26, y: -160 };
      for (const y of [0.42, 0.56, 0.7, 0.84, 0.94]) {
        const factor = rpFloorScale(y, scene),
          cursor = {
            x: 0.53 * bounds.width + grab.x * factor,
            y: y * bounds.height + grab.y * factor,
          };
        const actual = rpDragPosition(cursor, grab, bounds, 0.84, scene);
        assert(Math.abs(actual.x - 0.53) < 1e-9);
        assert(Math.abs(actual.y - y) < 1e-9);
      }
    }
  }
});
