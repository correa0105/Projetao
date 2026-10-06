import { test } from 'node:test';
import assert from 'node:assert/strict';
import { housePerspectiveScale, houseDragPosition } from '../shared/house-perspective.js';

test('arrastar perto da cabeça mantém o ponto clicado sem saltar de profundidade', () => {
  const bounds = { width: 1338, height: 752 };
  for (const baseScale of [0.19, 0.3]) {
    const grab = { x: bounds.width * baseScale * 0.15, y: -bounds.width * baseScale * 1.5 * 0.8 };
    const start = { x: bounds.width * 0.5 + grab.x, y: bounds.height * 0.84 + grab.y };
    let previousY = 0.84;
    for (const delta of [-40, -20, 0, 10, 20]) {
      const cursor = { x: start.x + 20, y: start.y + delta };
      const position = houseDragPosition(cursor, grab, bounds, previousY, 0.1);
      assert.ok(
        Math.abs(
          position.x * bounds.width + grab.x * housePerspectiveScale(position.y) - cursor.x,
        ) < 1e-9,
      );
      assert.ok(
        Math.abs(
          position.y * bounds.height + grab.y * housePerspectiveScale(position.y) - cursor.y,
        ) < 1e-9,
      );
      assert.ok(
        delta < 0
          ? position.y < 0.84
          : delta > 0
            ? position.y > 0.84
            : Math.abs(position.y - 0.84) < 1e-12,
      );
      previousY = position.y;
    }
  }
});

test('limites e poses maiores que o cenário mantêm um movimento contínuo', () => {
  const bounds = { width: 1338, height: 752 },
    grab = { x: 200, y: -850 };
  const previousY = 0.84;
  const cursor = { x: bounds.width * 0.5 + grab.x, y: bounds.height * previousY + grab.y };
  const result = houseDragPosition({ x: cursor.x, y: cursor.y + 4 }, grab, bounds, previousY, 0.1);
  assert.ok(Math.abs(result.y - previousY) < 0.01);
  assert.ok(Number.isFinite(result.x));
  for (const outside of [
    { x: -99999, y: -99999 },
    { x: 99999, y: 99999 },
  ]) {
    const position = houseDragPosition(outside, { x: 0, y: -100 }, bounds, previousY, 0.1);
    assert.ok(position.x >= 0.02 && position.x <= 0.98);
    assert.ok(position.y >= 0.1 && position.y <= 0.98);
  }
});
