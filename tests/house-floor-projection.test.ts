import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  houseFloorScale,
  houseFloorPlane,
  houseFloorPlanes,
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
    for (const y of [0.84, 0.74, 0.52, 0.5, 0.8, 0.96]) {
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
test('ground stops at the back edge of each floor and the near edge of the image', () => {
  for (const template of Object.keys(houseFloorPlanes)) {
    const floor = houseFloorPlane(template),
      bounds = { width: 1200, height: 675 };
    assert.equal(houseFloorScale(-1, template), houseFloorScale(floor.back, template));
    assert.equal(houseFloorScale(2, template), houseFloorScale(floor.front, template));
    assert.ok(Math.abs(houseFloorScale(0.84, template) - 1) < 1e-12);
    const back = houseFloorDragPosition(
        { x: 600, y: -500 },
        { x: 0, y: 0 },
        bounds,
        0.84,
        template,
      ),
      near = houseFloorDragPosition({ x: 600, y: 1200 }, { x: 0, y: 0 }, bounds, 0.84, template);
    assert.equal(back.y, floor.back);
    assert.equal(near.y, floor.front);
    assert.ok(houseFloorScale(near.y, template) > houseFloorScale(back.y, template) * 4);
    for (const y of [floor.back, 0.7, 0.84, floor.front]) {
      const grab = { x: 45, y: -100 },
        scale = houseFloorScale(y, template),
        cursor = { x: 0.57 * bounds.width + grab.x * scale, y: y * bounds.height + grab.y * scale },
        position = houseFloorDragPosition(cursor, grab, bounds, 0.84, template);
      assert.ok(Math.abs(position.y - y) < 1e-9);
      assert.ok(Math.abs(position.x - 0.57) < 1e-9);
    }
  }
});
test('objects cross the floor back edge onto a tabletop without cursor drift or shrinking into the wall', () => {
  const bounds = { width: 1200, height: 675 },
    grab = { x: 37, y: -115 };
  for (const template of Object.keys(houseFloorPlanes)) {
    const floor = houseFloorPlane(template);
    let previousY = 0.84;
    for (const y of [0.8, floor.back, floor.back - 0.001, 0.35, 0.19, floor.back + 0.001, 0.8]) {
      const scale = houseFloorScale(y, template);
      const p = houseFloorDragPosition(
        { x: 0.22 * bounds.width + grab.x * scale, y: y * bounds.height + grab.y * scale },
        grab,
        bounds,
        previousY,
        template,
        0.02,
      );
      assert.ok(Math.abs(p.x - 0.22) < 1e-9);
      assert.ok(Math.abs(p.y - y) < 1e-9);
      if (y < floor.back) assert.equal(houseFloorScale(p.y, template), 0.3);
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
test('arrows skip four repeated intermediate views, wrap and preserve saved direction IDs', () => {
  const order = [0, 8, 1, 2, 10, 3, 4, 5, 13, 6, 14, 7];
  assert.deepEqual(
    houseFacingOptions('sofa').map((o) => o.value),
    order,
  );
  assert.equal(houseFacingOptions('frame').length, 8);
  assert.equal(houseFacingOptions('letter').length, 8);
  let facing = 0;
  for (let i = 1; i <= order.length; i++) {
    facing = houseTurnFacing('sofa', facing, 1);
    assert.equal(facing, order[i % order.length]);
  }
  assert.equal(houseTurnFacing('sofa', 0, -1), 7);
  for (const [retired, left, right] of [
    [9, 1, 2],
    [11, 3, 4],
    [12, 4, 5],
    [15, 7, 0],
  ]) {
    assert.equal(houseTurnFacing('sofa', retired, -1), left);
    assert.equal(houseTurnFacing('sofa', retired, 1), right);
  }
  assert.equal(houseTurnFacing('frame', 0, -1), 7);
  assert.equal(placementSchema.shape.facing.safeParse(15).success, true);
  assert.equal(placementSchema.shape.facing.safeParse(16).success, false);
});
