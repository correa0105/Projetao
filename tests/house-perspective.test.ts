import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  housePerspectiveScale,
  houseDragPosition,
  shiftHouseLayer,
} from '../shared/house-perspective.js';

test('ponto agarrado acompanha o cursor durante a mudança de perspectiva', () => {
  const bounds = { width: 1073, height: 556 };
  for (const grab of [
    { x: 0, y: -100 },
    { x: -50, y: -220 },
    { x: 90, y: -40 },
  ]) {
    let previousY = 0.84;
    for (const targetY of [0.84, 0.8, 0.7, 0.65, 0.6, 0.7, 0.9]) {
      const cursor = {
        x: bounds.width * 0.57 + grab.x * housePerspectiveScale(targetY),
        y: bounds.height * targetY + grab.y * housePerspectiveScale(targetY),
      };
      const result = houseDragPosition(cursor, grab, bounds, previousY);
      assert.ok(Math.abs(result.x - 0.57) < 1e-9);
      assert.ok(Math.abs(result.y - targetY) < 1e-9);
      previousY = result.y;
    }
  }
});

test('profundidade aumenta continuamente o tamanho e preserva a referência', () => {
  assert.ok(Math.abs(housePerspectiveScale(0.84) - 1) < 1e-12);
  let previous = 0;
  for (let y = 0.08; y <= 0.98; y += 0.01) {
    const scale = housePerspectiveScale(y);
    assert.ok(scale > previous);
    assert.ok(Number.isFinite(scale));
    previous = scale;
  }
  const horse = 0.535,
    pony = 0.365;
  for (const y of [0.08, 0.5, 0.84, 0.98])
    assert.ok(
      Math.abs(
        (horse * housePerspectiveScale(y)) / (pony * housePerspectiveScale(y)) - horse / pony,
      ) < 1e-12,
    );
  assert.equal(housePerspectiveScale(-1), housePerspectiveScale(0.08));
  assert.equal(housePerspectiveScale(2), housePerspectiveScale(0.98));
});

test('camadas trocam a ordem real inclusive com empates e intervalos de layouts antigos', () => {
  const original = [
    { id: 'rug', layer: 0 },
    { id: 'table', layer: 0 },
    { id: 'chair', layer: 15 },
  ];
  const back = shiftHouseLayer(original, 'table', -1);
  assert.deepEqual(
    back.map((p) => p.layer),
    [1, 0, 2],
  );
  assert.deepEqual(
    original.map((p) => p.layer),
    [0, 0, 15],
  );
  assert.deepEqual(
    shiftHouseLayer(back, 'table', 1).map((p) => p.layer),
    [0, 1, 2],
  );
  assert.equal(shiftHouseLayer(back, 'table', -1), back);
  assert.equal(shiftHouseLayer(original, 'chair', 1), original);
  assert.equal(shiftHouseLayer(original, 'missing', -1), original);
});
