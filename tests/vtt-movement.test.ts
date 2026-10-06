import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { newScene, wallSchema } from '../shared/vtt.js';
import { movementBlocked } from '../shared/vtt-movement.js';

test('paredes e aberturas fechadas bloqueiam mesmo sem iluminação ou opção legada', () => {
  const scene = newScene(randomUUID());
  Object.assign(scene, { lighting: false, restrictMovement: false });
  const wall = wallSchema.parse({
    id: randomUUID(),
    kind: 'wall',
    a: { x: 150, y: 0 },
    b: { x: 150, y: 200 },
  });
  scene.walls = [wall];
  for (const kind of ['wall', 'door', 'window'] as const) {
    wall.kind = kind;
    wall.open = false;
    assert.equal(movementBlocked(scene, { x: 100, y: 100 }, { x: 200, y: 100 }), true);
    wall.open = true;
    assert.equal(movementBlocked(scene, { x: 100, y: 100 }, { x: 200, y: 100 }), kind === 'wall');
  }
});
test('permite espaços livres, contorno da parede e sair de posicionamento sobre a parede', () => {
  const scene = newScene(randomUUID());
  scene.walls = [
    wallSchema.parse({
      id: randomUUID(),
      kind: 'wall',
      a: { x: 150, y: 0 },
      b: { x: 150, y: 200 },
    }),
  ];
  assert.equal(movementBlocked(scene, { x: 100, y: 250 }, { x: 200, y: 250 }), false);
  assert.equal(movementBlocked(scene, { x: 100, y: 100 }, { x: 120, y: 100 }), false);
  assert.equal(movementBlocked(scene, { x: 100, y: 100 }, { x: 150, y: 100 }), true);
  assert.equal(movementBlocked(scene, { x: 150, y: 100 }, { x: 100, y: 100 }), false);
  assert.equal(movementBlocked(scene, { x: 150, y: 100 }, { x: 150, y: 100 }), false);
});
test('colinearidade e encontro exato com a extremidade não permitem atravessar', () => {
  const scene = newScene(randomUUID());
  scene.walls = [
    wallSchema.parse({
      id: randomUUID(),
      kind: 'wall',
      a: { x: 150, y: 0 },
      b: { x: 150, y: 200 },
    }),
  ];
  assert.equal(movementBlocked(scene, { x: 150, y: 250 }, { x: 150, y: -50 }), true);
  assert.equal(movementBlocked(scene, { x: 100, y: 250 }, { x: 200, y: 150 }), true);
  assert.equal(movementBlocked(scene, { x: 150, y: 100 }, { x: 150, y: 150 }), true);
});
