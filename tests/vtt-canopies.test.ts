import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { canopyAreaSchema, canopyAreaOccupied, canopyContains } from '../shared/vtt-canopies';
import { newScene, newToken, sceneSchema } from '../shared/vtt';
test('Áreas respeitam a presença, o tamanho e a visibilidade da criatura', () => {
  const area = canopyAreaSchema.parse({
    id: randomUUID(),
    name: 'Copa',
    points: [
      { x: 100, y: 100 },
      { x: 200, y: 100 },
      { x: 200, y: 200 },
      { x: 100, y: 200 },
    ],
    opacity: 0.25,
    enabled: true,
  });
  const t = {
    ...newToken(randomUUID(), newScene(randomUUID())),
    x: 150,
    y: 150,
    width: 40,
    height: 40,
  };
  assert(canopyContains(t, area.points));
  assert(canopyAreaOccupied(area, [t]));
  assert(canopyAreaOccupied(area, [{ ...t, x: 210, rotation: 45 }]));
  assert(canopyAreaOccupied({...area,points:[{x:80,y:152},{x:220,y:152},{x:220,y:154},{x:80,y:154}]},[t]));
  for (const token of [
    { ...t, x: 300 },
    { ...t, hidden: true },
    { ...t, layer: 'map' as const },
    { ...t, layer: 'gm' as const },
  ])
    assert(!canopyAreaOccupied(area, [token]));
  assert(!canopyAreaOccupied({ ...area, enabled: false }, [t]));
});
test('Documentos históricos continuam sem áreas; limites e IDs são validados', () => {
  const scene = newScene(randomUUID());
  assert.equal(scene.canopyAreas, undefined);
  assert.equal(scene.canopyOpacity, undefined);
  const area = {
    id: randomUUID(),
    name: 'Telhado',
    points: [
      { x: 20, y: 20 },
      { x: 60, y: 20 },
      { x: 60, y: 60 },
    ],
    opacity: 0.25,
    enabled: true,
  };
  assert(
    sceneSchema.safeParse({ ...scene, canopyAreas: [area], canopyOpacity: 0.35 }).success,
  );
  for (const patch of [
    { opacity: 0 },
    { opacity: 1 },
    {
      points: [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
        { x: 2, y: 2 },
      ],
    },
    {
      points: [
        { x: Infinity, y: 0 },
        { x: 2, y: 2 },
        { x: 3, y: 4 },
      ],
    },
  ])
    assert(!canopyAreaSchema.safeParse({ ...area, ...patch }).success);
  assert(!sceneSchema.safeParse({ ...scene, canopyAreas: [area, area] }).success);
});
