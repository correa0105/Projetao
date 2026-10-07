import { test } from 'node:test';
import assert from 'node:assert/strict';
import { houseDistortionSchema, type HouseDistortion } from '../shared/house.js';
import {
  houseDistortionMatrix,
  houseDistortionPoints,
  houseImageCorners,
  houseMoveDistortionCorner,
  houseDistortionHandlePositions,
} from '../shared/house-distortion.js';

test('all bounded corner extremes stay convex and project precisely, including tall/wide artwork', () => {
  for (const [width, height] of [
    [500, 220],
    [140, 600],
    [40, 90],
  ]) {
    for (let bits = 0; bits < 256; bits++) {
      const distortion = houseImageCorners.map((_, i) => ({
        x: bits & (1 << (i * 2)) ? 0.12 : -0.12,
        y: bits & (1 << (i * 2 + 1)) ? 0.12 : -0.12,
      })) as HouseDistortion;
      assert.ok(houseDistortionSchema.safeParse(distortion).success);
      const target = houseDistortionPoints(distortion);
      const m = houseDistortionMatrix(distortion, width, height)
        .slice(9, -1)
        .split(',')
        .map(Number);
      assert.ok(m.every(Number.isFinite));
      target.forEach((p, i) => {
        const x = houseImageCorners[i].x * width,
          y = houseImageCorners[i].y * height;
        const w = m[3] * x + m[7] * y + m[15];
        assert.ok(w > 0.35);
        assert.ok(Math.abs((m[0] * x + m[4] * y + m[12]) / w - p.x * width) < 1e-8);
        assert.ok(Math.abs((m[1] * x + m[5] * y + m[13]) / w - p.y * height) < 1e-8);
        const q = target[(i + 1) % 4],
          r = target[(i + 2) % 4];
        assert.ok((q.x - p.x) * (r.y - q.y) - (q.y - p.y) * (r.x - q.x) > 0.5);
      });
    }
  }
});
test('limit applies to each corner; reset has no transform; handles respect historical rotation', () => {
  const distorted = houseMoveDistortionCorner(undefined, 0, 8, -8);
  assert.deepEqual(distorted, [
    { x: 0.12, y: -0.12 },
    { x: 0, y: 0 },
    { x: 0, y: 0 },
    { x: 0, y: 0 },
  ]);
  assert.equal(houseDistortionMatrix(undefined, 500, 250), 'none');
  assert.equal(houseDistortionMatrix(distorted, 0, 0), 'none');
  const handles = houseDistortionHandlePositions({ x: 500, y: 400, width: 200, height: 100 }, 90);
  assert.deepEqual(
    handles.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) })),
    [
      { x: 600, y: 300 },
      { x: 600, y: 500 },
      { x: 500, y: 500 },
      { x: 500, y: 300 },
    ],
  );
  assert.equal(
    houseDistortionSchema.safeParse([{ x: 0.13, y: 0 }, ...distorted.slice(1)]).success,
    false,
  );
  assert.equal(houseDistortionSchema.safeParse([...distorted, { x: 0, y: 0 }]).success, false);
});
