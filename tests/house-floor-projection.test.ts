import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  houseFloorScale,
  houseFloorDragPosition,
  housePaintLayer,
} from '../shared/house-perspective.js';
import { houseFacingOptions, houseTurnFacing, placementSchema } from '../shared/house.js';
test('hearth floor projection makes near furniture larger and distant furniture smaller without changing base size', () => {
  assert.ok(Math.abs(houseFloorScale(0.84) - 1) < 1e-12);
  assert.ok(houseFloorScale(0.96) > 1.2);
  assert.ok(houseFloorScale(0.52) < 0.4);
  for (const grab of [
    { x: 45, y: -120 },
    { x: -80, y: -210 },
    { x: 0, y: -30 },
  ]) {
    const bounds = { width: 1200, height: 675 };
    let previousY = 0.84;
    for (const y of [0.84, 0.74, 0.52, 0.42, 0.35, 0.2, 0.8, 0.96]) {
      const cursor = {
        x: 0.57 * bounds.width + grab.x * houseFloorScale(y),
        y: y * bounds.height + grab.y * houseFloorScale(y),
      };
      const p = houseFloorDragPosition(cursor, grab, bounds, previousY);
      assert.ok(Math.abs(p.x - 0.57) < 1e-9);
      assert.ok(Math.abs(p.y - y) < 1e-9);
      previousY = p.y;
    }
  }
});
test('six shared layers: layer one covers two through six for furniture and characters', () => {
  for (let front = 1; front < 6; front++)
    for (let behind = front + 1; behind <= 6; behind++)
      assert.ok(housePaintLayer(front, 0) > housePaintLayer(behind, 602));
  assert.ok(housePaintLayer(3, 40) > housePaintLayer(3, 10));
  assert.ok(housePaintLayer(undefined, 602) > housePaintLayer(undefined, 0));
  assert.equal(placementSchema.shape.depth_layer.safeParse(0).success, false);
  assert.equal(placementSchema.shape.depth_layer.safeParse(7).success, false);
});
test('arrows visit all sixteen views in angular order, wrap and preserve legacy direction IDs', () => {
  const order = [0, 8, 1, 9, 2, 10, 3, 11, 4, 12, 5, 13, 6, 14, 7, 15];
  assert.deepEqual(
    houseFacingOptions('sofa').map((o) => o.value),
    order,
  );
  assert.equal(houseFacingOptions('frame').length, 8);
  assert.equal(houseFacingOptions('letter').length, 8);
  let facing = 0;
  for (let i = 1; i <= 16; i++) {
    facing = houseTurnFacing('sofa', facing, 1);
    assert.equal(facing, order[i % 16]);
  }
  assert.equal(houseTurnFacing('sofa', 0, -1), 15);
  assert.equal(houseTurnFacing('frame', 0, -1), 7);
  assert.equal(placementSchema.shape.facing.safeParse(15).success, true);
  assert.equal(placementSchema.shape.facing.safeParse(16).success, false);
});
