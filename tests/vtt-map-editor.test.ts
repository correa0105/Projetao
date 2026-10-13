import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { newScene, newToken, sceneSchema } from '../shared/vtt';
import {
  tokenResizeHandles,
  tokenResizeHandleAt,
  resizeTokenRectangle,
} from '../shared/vtt-token-resize';
import {
  bindCanopy,
  resolveCanopy,
  canopyLocal,
  canopyWorld,
  canopyAreaSchema,
} from '../shared/vtt-canopies';
import { rockAssets } from '../shared/vtt-rock-assets';
import { atmosphereSchema, weatherPresets } from '../shared/vtt-atmosphere';
import { mapWindMotion } from '../src/vtt-map-wind';
test('Giro e tamanho não deslocam o ponto fixo durante resize; sem salto ao segurar', () => {
  const scene = newScene(randomUUID());
  scene.width = scene.height = 3000;
  for (const rotation of [0, 45, 90, 165, 270]) {
    const t = {
      ...newToken(randomUUID(), scene),
      x: 1000,
      y: 1000,
      width: 200,
      height: 100,
      rotation,
    };
    for (const h of tokenResizeHandles(t, 0.8)) {
      assert.equal(tokenResizeHandleAt(t, h, 0.8), h.handle);
      assert.deepEqual(resizeTokenRectangle(t, h.handle, h, h, scene), {
        x: t.x,
        y: t.y,
        width: t.width,
        height: t.height,
      });
    }
    const h = tokenResizeHandles(t, 1).find((h) => h.handle === 'se')!,
      angle = (rotation * Math.PI) / 180;
    const p = {
      x: h.x + 100 * Math.cos(angle) - 50 * Math.sin(angle),
      y: h.y + 100 * Math.sin(angle) + 50 * Math.cos(angle),
    };
    const next = resizeTokenRectangle(t, 'se', h, p, scene);
    assert(Math.abs(next.width / next.height - 2) < 1e-8);
    assert(next.width > t.width);
    const fixed = (q: typeof next) => ({
      x: q.x - (q.width / 2) * Math.cos(angle) + (q.height / 2) * Math.sin(angle),
      y: q.y - (q.width / 2) * Math.sin(angle) - (q.height / 2) * Math.cos(angle),
    });
    assert(Math.hypot(fixed(t).x - fixed(next).x, fixed(t).y - fixed(next).y) < 1e-8);
  }
});
test('Bordas alteram apenas seu eixo; Shift libera proporção e limite impede sair do mapa', () => {
  const t = { x: 100, y: 100, width: 80, height: 40, rotation: 0 },
    scene = { width: 250, height: 250 },
    start = { x: 144, y: 100 };
  const edge = resizeTokenRectangle(t, 'e', start, { x: 164, y: 160 }, scene);
  assert.equal(edge.width, 100);
  assert.equal(edge.height, 40);
  assert.equal(edge.x, 110);
  const free = resizeTokenRectangle(t, 'se', start, { x: 174, y: 140 }, scene, true);
  assert.equal(free.width, 110);
  assert.equal(free.height, 80);
  const bounded = resizeTokenRectangle(t, 'se', start, { x: 10000, y: 10000 }, scene);
  assert(bounded.x + bounded.width / 2 <= 250.0001);
  assert(bounded.y + bounded.height / 2 <= 250.0001);
});
test('Recorte vinculado segue deslocamento, espelho, resize e rotação sem perder coordenadas', () => {
  const s = newScene(randomUUID()),
    t = {
      ...newToken(randomUUID(), s),
      layer: 'map' as const,
      x: 500,
      y: 500,
      width: 200,
      height: 100,
    };
  const local = [
    { x: 0.1, y: 0.2 },
    { x: 0.8, y: 0.2 },
    { x: 0.8, y: 0.9 },
    { x: 0.1, y: 0.9 },
  ];
  const area = bindCanopy(
    canopyAreaSchema.parse({
      id: randomUUID(),
      name: 'Rocha',
      points: local.map((p) => canopyWorld(p, t)),
      opacity: 0.25,
      enabled: true,
    }),
    t,
  );
  for (const rotation of [0, 47, 90, 180]) {
    const moved = { ...t, x: 900, y: 700, width: 370, height: 230, rotation, flipX: true };
    const resolved = resolveCanopy(area, [moved])!;
    resolved.points.forEach((p, i) => {
      const actual = canopyLocal(p, moved);
      assert(Math.hypot(actual.x - local[i].x, actual.y - local[i].y) < 1e-8);
    });
  }
  assert.equal(resolveCanopy(area, []), null);
});
test('Camadas de pintura mantêm compatibilidade e recusam referências ou IDs inválidos', () => {
  const scene = newScene(randomUUID());
  assert.equal(scene.terrain.length, 0);
  assert.equal(scene.terrainLayers[0].id, 'base');
  const layer = { id: randomUUID(), name: 'Caminho', visible: true, opacity: 0.4 };
  const stroke = {
    id: randomUUID(),
    texture: 'earth',
    points: [{ x: 50, y: 50 }],
    radius: 30,
    softness: 0.5,
    opacity: 0.7,
    textureScale: 200,
  };
  assert.equal(sceneSchema.parse({ ...scene, terrain: [stroke] }).terrain[0].shape, 'round');
  assert(
    sceneSchema.safeParse({
      ...scene,
      terrain: [{ ...stroke, layer: layer.id, shape: 'rough' }],
      terrainLayers: [...scene.terrainLayers, layer],
    }).success,
  );
  assert(!sceneSchema.safeParse({ ...scene, terrain: [{ ...stroke, layer: layer.id }] }).success);
  assert(!sceneSchema.safeParse({ ...scene, terrainLayers: [layer] }).success);
  assert(
    !sceneSchema.safeParse({
      ...scene,
      terrainLayers: [...scene.terrainLayers, ...scene.terrainLayers],
    }).success,
  );
});
test('Rochas pequenas são menores que um personagem Médio; vento forte é mais veloz e contínuo', () => {
  assert.equal(rockAssets.length, 25);
  const small = rockAssets.filter((a) => a.group === 'Pequenas');
  assert.equal(small.length, 8);
  assert(small.every((a) => a.squares < 0.5));
  for (const w of ['wind', 'gale'] as const) assert(weatherPresets.some((p) => p[0] === w));
  const wind = atmosphereSchema.parse({ weather: 'wind' }),
    gale = { ...wind, weather: 'gale' as const };
  for (const t of [0, 1, 2, 10, 25]) {
    assert(mapWindMotion(gale, t).speed > mapWindMotion(wind, t).speed * 2);
    const motion = mapWindMotion(gale, t),
      next = mapWindMotion(gale, t + 0.0001);
    assert(Math.abs((next.distance - motion.distance) / 0.0001 - motion.speed) < 0.15);
  }
});
