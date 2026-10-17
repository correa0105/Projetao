import { test } from 'node:test';
import assert from 'node:assert/strict';
import { house2Within, house2LayoutSchema } from '../shared/house-v2';
import {
  house2BorderHandles,
  house2ResizeFromBorder,
  house2RotateFromBorder,
  type House2BorderHandle,
} from '../src/house2-item-transform';

const plot = { x: 5, y: 10, width: 16, height: 12 };
const item = {
  id: '65e2dc4d-b2ad-4ce9-818c-c432b7978861',
  x: 13,
  y: 16,
  rotation: 0,
  scale: 1,
};
const size = { width: 4, height: 2 };

test('corner resize preserves proportions and the opposite corner, including rotated items', () => {
  for (const rotation of [0, 13, 37.25, 90, 127.25, 180, 270, 359.9]) {
    const radians = (rotation * Math.PI) / 180;
    const delta = {
      x: 2 * Math.cos(radians) - Math.sin(radians),
      y: 2 * Math.sin(radians) + Math.cos(radians),
    };
    const initial = { ...item, rotation };
    const next = house2ResizeFromBorder(plot, initial, size, 'se', delta);
    assert(Math.abs(next.scale! - 1.5) < 1e-10);
    const corner = (p: typeof item) => ({
      x: p.x - 2 * p.scale * Math.cos(radians) + p.scale * Math.sin(radians),
      y: p.y - 2 * p.scale * Math.sin(radians) - p.scale * Math.cos(radians),
    });
    assert(Math.abs(corner(next as typeof item).x - corner(initial).x) < 1e-7);
    assert(Math.abs(corner(next as typeof item).y - corner(initial).y) < 1e-7);
  }
});

test('all eight borders stop at the lot limits and at the minimum size in every orientation', () => {
  for (const rotation of [0, 13, 37.25, 90, 127.25, 180, 270, 359.9])
    for (const handle of Object.keys(house2BorderHandles) as House2BorderHandle[]) {
      for (const delta of [
        { x: 500, y: 800 },
        { x: -500, y: -800 },
        { x: 500, y: -800 },
        { x: -500, y: 800 },
      ]) {
        const next = house2ResizeFromBorder(plot, { ...item, rotation }, size, handle, delta);
        assert(next.scale! >= 0.25 && next.scale! <= 3);
        assert(house2Within(plot, next, size.width * next.scale!, size.height * next.scale!));
        house2LayoutSchema.parse({ revision: 0, house: null, items: [next] });
      }
    }
});

test('rotation handle is continuous, optionally snaps and keeps the rotated sprite inside', () => {
  const start = { x: item.x, y: item.y - 3 };
  const next = house2RotateFromBorder(plot, item, size, start, { x: item.x + 3, y: item.y });
  assert.equal(next.rotation, 90);
  const angle = (37.25 * Math.PI) / 180;
  const point = { x: item.x + 3 * Math.sin(angle), y: item.y - 3 * Math.cos(angle) };
  assert.equal(house2RotateFromBorder(plot, item, size, start, point).rotation, 37.25);
  assert.equal(house2RotateFromBorder(plot, item, size, start, point, true).rotation, 30);
  assert.equal(
    house2RotateFromBorder(plot, { ...item, rotation: 350 }, size, start, point).rotation,
    27.25,
  );
  assert.equal(
    house2RotateFromBorder(plot, { ...item, rotation: 270 }, size, start, {
      x: item.x + 3,
      y: item.y,
    }).rotation,
    0,
  );
  const smallLot = { x: 0, y: 0, width: 6, height: 3 };
  const big = house2RotateFromBorder(
    smallLot,
    { ...item, x: 3, y: 1.5 },
    size,
    { x: 3, y: 0 },
    { x: 4.5, y: 1.5 },
  );
  assert.equal(big.rotation, 90);
  assert(house2Within(smallLot, big, size.width * big.scale!, size.height * big.scale!));
});
