import { test } from 'node:test';
import assert from 'node:assert/strict';
import { projectOverheadEffect } from '../src/vtt-effect-projection.js';
import { effectFootprint } from '../src/vtt-effect-footprint.js';

test('altura sobe até a câmera sem deslocar o eixo do centro do token', () => {
  const plane = { rx: 70, ry: 70 };
  for (const height of [0, 0.25, 0.75, 1]) {
    const p = projectOverheadEffect(plane, 0, 2, height);
    assert.ok(p.x === 0);
    assert.ok(p.y === 0);
  }
  const low = projectOverheadEffect(plane, 1, 0.8, 0),
    high = projectOverheadEffect(plane, 1, 0.8, 1);
  assert.ok(Math.hypot(high.x, high.y) > Math.hypot(low.x, low.y));
  assert.equal(projectOverheadEffect(plane, 1, 0.8, 100).perspective, high.perspective);
});

test('círculo e espiral de chão são concêntricos e circulares no mundo, mesmo em token retangular', () => {
  for (const [width, height] of [
    [100, 100],
    [80, 150],
    [220, 90],
  ]) {
    const rx = width * 0.65,
      ry = height * 0.65,
      f = effectFootprint(width, height, rx, ry);
    const a = projectOverheadEffect(f.plane, 1, 0, 0),
      b = projectOverheadEffect(f.plane, 1, Math.PI / 2, 0);
    assert.ok(Math.abs((a.x * rx) / 100 - (b.y * ry) / 100) < 1e-8);
    const points = [0, 0.25, 0.5, 0.75].map((v) =>
      projectOverheadEffect(f.plane, 1, v * Math.PI * 2, 0.4),
    );
    assert.ok(Math.abs(points.reduce((sum, p) => sum + p.x, 0)) < 1e-8);
    assert.ok(Math.abs(points.reduce((sum, p) => sum + p.y, 0)) < 1e-8);
  }
});
