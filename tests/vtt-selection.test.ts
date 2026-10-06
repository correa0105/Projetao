import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { newScene, newToken, drawingSchema, lightSchema, wallSchema } from '../shared/vtt.js';
import { lassoSelection } from '../shared/vtt-selection.js';

const box = [
  { x: 10, y: 10 },
  { x: 90, y: 10 },
  { x: 90, y: 90 },
  { x: 10, y: 90 },
];
function fixture() {
  const scene = newScene(randomUUID());
  const token = newToken(randomUUID(), scene);
  Object.assign(token, { x: 50, y: 50, width: 20, height: 20 });
  scene.tokens = [token];
  return { scene, token };
}
test('seleção livre segue contorno côncavo, camada e não altera objetos', () => {
  const { scene, token } = fixture();
  const hiddenLayer = { ...token, id: randomUUID(), layer: 'gm' as const };
  const outside = { ...token, id: randomUUID(), x: 150, y: 150 };
  scene.tokens.push(hiddenLayer, outside);
  const before = structuredClone(scene);
  const concave = [
    { x: 0, y: 0 },
    { x: 200, y: 0 },
    { x: 200, y: 80 },
    { x: 80, y: 80 },
    { x: 80, y: 200 },
    { x: 0, y: 200 },
  ];
  assert.deepEqual(lassoSelection(scene, 'tokens', concave), [token.id]);
  assert.deepEqual(lassoSelection(scene, 'gm', concave), [hiddenLayer.id]);
  assert.deepEqual(scene, before);
});
test('seleciona objetos cruzados pela borda e token girado sem exigir o centro', () => {
  const { scene, token } = fixture();
  Object.assign(token, { x: 100, y: 50, width: 100, height: 10, rotation: 90 });
  assert.deepEqual(lassoSelection(scene, 'tokens', box), []);
  token.x = 92;
  assert.deepEqual(lassoSelection(scene, 'tokens', box), [token.id]);
  Object.assign(token, { x: 50, y: 50, width: 500, height: 500 });
  assert.deepEqual(lassoSelection(scene, 'tokens', box), [token.id]);
});
test('linha que atravessa o contorno é selecionada; retângulo de limites não basta', () => {
  const { scene } = fixture();
  scene.tokens = [];
  const line = drawingSchema.parse({
    id: randomUUID(),
    kind: 'line',
    points: [
      { x: -50, y: 50 },
      { x: 150, y: 50 },
    ],
    width: 2,
    color: '#ffffff',
    fill: false,
  });
  const misses = {
    ...line,
    id: randomUUID(),
    points: [
      { x: 0, y: 70 },
      { x: 70, y: 140 },
    ],
  };
  scene.drawings = [line, misses];
  const small = [
    { x: 10, y: 40 },
    { x: 30, y: 40 },
    { x: 30, y: 60 },
    { x: 10, y: 60 },
  ];
  assert.deepEqual(lassoSelection(scene, 'tokens', small), [line.id]);
});
test('áreas circulares, cones e texto usam a região de cada forma', () => {
  const { scene } = fixture();
  scene.tokens = [];
  const circle = drawingSchema.parse({
    id: randomUUID(),
    kind: 'circle',
    points: [
      { x: 50, y: 50 },
      { x: 70, y: 50 },
    ],
    width: 2,
    color: '#ffffff',
    fill: true,
  });
  const cone = {
    ...circle,
    id: randomUUID(),
    kind: 'cone' as const,
    points: [
      { x: 120, y: 50 },
      { x: 160, y: 50 },
    ],
  };
  const text = {
    ...circle,
    id: randomUUID(),
    kind: 'text' as const,
    text: 'Vida',
    points: [{ x: 30, y: 40 }],
  };
  scene.drawings = [circle, cone, text];
  assert.deepEqual(lassoSelection(scene, 'tokens', box), [circle.id, text.id]);
  const corner = [
    { x: 65, y: 65 },
    { x: 69, y: 65 },
    { x: 69, y: 69 },
    { x: 65, y: 69 },
  ];
  assert.deepEqual(lassoSelection(scene, 'tokens', corner), []);
});
test('camada de iluminação seleciona barreiras cruzadas e fontes dentro da área', () => {
  const { scene, token } = fixture();
  const wall = wallSchema.parse({
    id: randomUUID(),
    kind: 'wall',
    a: { x: -10, y: 50 },
    b: { x: 100, y: 50 },
  });
  const light = lightSchema.parse({ id: randomUUID(), x: 50, y: 50 });
  scene.walls = [wall];
  scene.lights = [light, { ...light, id: randomUUID(), x: 110 }];
  assert.deepEqual(lassoSelection(scene, 'lighting', box), [wall.id, light.id]);
  assert.deepEqual(lassoSelection(scene, 'tokens', box), [token.id]);
});
test('clique, linha ou pontos inválidos não criam seleção; início repetido é aceito', () => {
  const { scene, token } = fixture();
  for (const points of [
    [],
    box.slice(0, 2),
    [
      { x: 0, y: 0 },
      { x: 50, y: 50 },
      { x: 100, y: 100 },
    ],
    [...box, { x: NaN, y: 5 }],
  ])
    assert.deepEqual(lassoSelection(scene, 'tokens', points), []);
  assert.deepEqual(lassoSelection(scene, 'tokens', [box[0], ...box]), [token.id]);
});
