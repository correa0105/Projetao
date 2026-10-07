import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import { houseCatalog, houseFacingOptions, houseItemImage } from '../shared/house.js';
if (!/^\/alvorada_test_[0-9a-f]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))
  throw Error('Isolated database required');
const origin = 'http://localhost:3043';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db.js');
const { migrate } = await import('../server/migrate.js');
const { seed } = await import('../server/seed.js');
const { createLegacyTestCharacter } = await import('../tests/character-fixtures.js');
await migrate();
await seed();
const { createApp } = await import('../server/app.js');
const server = createApp().listen(3043, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  reducedMotion: 'reduce',
});
const page = await context.newPage();
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
await context.addInitScript(() => {
  localStorage.setItem('alvorada-music-muted', 'true');
  localStorage.setItem('alvorada-effects-muted', 'true');
});
async function api(path: string, body?: unknown, method = body ? 'POST' : 'GET') {
  const response = await context.request.fetch(origin + '/api' + path, {
    method,
    headers: { Origin: origin },
    data: body,
  });
  expect(response.ok(), method + ' ' + path).toBe(true);
  return response.json();
}
try {
  const account = await api('/auth/sign-up/email', {
    name: 'Perspectiva',
    email: randomUUID() + '@example.test',
    password: 'Test-' + randomUUID(),
  });
  const hero = await createLegacyTestCharacter(account.user.id, 'Câmera');
  await pool.query('UPDATE characters SET gold_cp=1000000,portrait_revision=1 WHERE id=$1', [
    hero.id,
  ]);
  await pool.query('INSERT INTO character_portraits(character_id,image) VALUES($1,$2)', [
    hero.id,
    await readFile('public/character-silhouette-v2.png'),
  ]);
  const homeId = (await api('/house', { character_id: hero.id })).id;
  const refs = new Map<string, string>();
  for (const spec of houseCatalog.filter((i) => !['letter', 'frame'].includes(i.id)))
    refs.set(
      spec.id,
      (
        await api('/house/purchase', {
          character_id: hero.id,
          catalog_id: spec.id,
          idempotency_key: randomUUID(),
        })
      ).item_id,
    );
  const state = await api('/house/' + homeId);
  const config = [
    { id: 'rug', x: 0.5, y: 0.835, scale: 0.64, facing: 0, depth_layer: 6 },
    { id: 'statue', x: 0.3, y: 0.57, scale: 0.14, facing: 1, depth_layer: 5 },
    { id: 'chest', x: 0.815, y: 0.555, scale: 0.27, facing: 8, depth_layer: 4 },
    { id: 'sofa', x: 0.218, y: 0.755, scale: 0.39, facing: 14, depth_layer: 3 },
    { id: 'chair', x: 0.66, y: 0.66, scale: 0.22, facing: 8, depth_layer: 3 },
    { id: 'table', x: 0.46, y: 0.72, scale: 0.28, facing: 0, depth_layer: 2 },
    { id: 'bench', x: 0.9, y: 0.92, scale: 0.25, facing: 8, depth_layer: 2 },
    { id: 'books', x: 0.455, y: 0.605, scale: 0.055, facing: 8, depth_layer: 1 },
    { id: 'lantern', x: 0.51, y: 0.605, scale: 0.04, facing: 8, depth_layer: 1 },
    { id: 'plant', x: 0.83, y: 0.495, scale: 0.085, facing: 8, depth_layer: 1 },
  ];
  state.rooms[0].placements = config.map((p, layer) => ({
    id: randomUUID(),
    kind: 'item',
    ref: refs.get(p.id),
    x: p.x,
    y: p.y,
    scale: p.scale,
    facing: p.facing,
    depth_layer: p.depth_layer,
    rotation: 0,
    layer,
  }));
  await api(
    '/house/' + homeId,
    { name: state.name, revision: state.revision, rooms: state.rooms },
    'PUT',
  );
  await page.goto(origin + '/#house');
  await expect(page.locator('.house-piece')).toHaveCount(10);
  await page
    .locator('.house-piece img')
    .evaluateAll((imgs) => Promise.all(imgs.map((img) => (img as HTMLImageElement).decode())));
  await expect(page.locator('.house-floor-shadow')).toHaveCount(10);
  await mkdir('test-results', { recursive: true });
  await page
    .locator('.house-scene')
    .screenshot({ path: 'test-results/house-perspective-integrated.png' });
  // Every offered direction must decode as a real independent image.
  const urls = houseCatalog.flatMap((s) =>
    houseFacingOptions(s.id).map((v) => houseItemImage(s.id, v.value)),
  );
  expect(new Set(urls).size).toBe(176);
  for (const url of urls) {
    const response = await context.request.get(origin + url);
    expect(response.status(), url).toBe(200);
  }
  await page.evaluate(async (urls) => {
    for (const url of urls) {
      const img = new Image();
      img.src = url;
      await img.decode();
    }
  }, urls);
  const sofa = page.locator(`[data-house-piece="${state.rooms[0].placements[3].id}"]`);
  await sofa.click();
  const base = await sofa.getAttribute('data-base-scale');
  const paths = new Set<string>();
  for (let i = 0; i < 16; i++) {
    paths.add((await sofa.locator('img').getAttribute('src'))!);
    await page.getByRole('button', { name: 'Virar item à direita', exact: true }).click();
    await sofa.locator('img').evaluate((img) => (img as HTMLImageElement).decode());
  }
  expect(paths.size).toBe(16);
  await expect(sofa).toHaveAttribute('data-facing', '14');
  await expect(sofa).toHaveAttribute('data-base-scale', base!);
  // Cursor remains on the grabbed point while the furniture shrinks toward the hearth.
  const before = (await sofa.boundingBox())!,
    grab = { x: before.x + before.width * 0.55, y: before.y + before.height * 0.8 };
  await page.mouse.move(grab.x, grab.y);
  await page.mouse.down();
  const scene = (await page.locator('.house-scene').boundingBox())!;
  const destination = { x: grab.x + scene.width * 0.04, y: grab.y - scene.height * 0.09 };
  await page.mouse.move(destination.x, destination.y, { steps: 5 });
  const distant = (await sofa.boundingBox())!;
  expect(distant.width).toBeLessThan(before.width * 0.8);
  expect(Math.abs(distant.x + distant.width * 0.55 - destination.x)).toBeLessThan(2);
  expect(Math.abs(distant.y + distant.height * 0.8 - destination.y)).toBeLessThan(2);
  await page.mouse.move(grab.x, grab.y, { steps: 5 });
  await page.mouse.up();
  expect(Math.abs((await sofa.boundingBox())!.width - before.width)).toBeLessThan(2);
  await expect(sofa).toHaveAttribute('data-base-scale', base!);
  await api(
    '/house/' + homeId + '/presence',
    {
      character_id: hero.id,
      variant_id: null,
      room: 'sala',
      x: 0.218,
      y: 0.755,
      scale: 0.13,
      depth_layer: 4,
    },
    'PUT',
  );
  await page.reload();
  await expect(page.locator('.house-actor')).toHaveCount(1);
  const actor = page.locator('.house-actor');
  expect(await actor.evaluate((e) => +getComputedStyle(e).zIndex)).toBeLessThan(
    await sofa.evaluate((e) => +getComputedStyle(e).zIndex),
  );
  await sofa.click();
  await page.getByLabel('Camada da peça', { exact: true }).selectOption('6');
  expect(await actor.evaluate((e) => +getComputedStyle(e).zIndex)).toBeGreaterThan(
    await sofa.evaluate((e) => +getComputedStyle(e).zIndex),
  );
  await page.getByLabel('Camada do personagem', { exact: true }).selectOption('1');
  await expect(actor).toHaveAttribute('data-depth-layer', '1');
  await page.getByRole('button', { name: 'Salvar mudanças', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Salvo', exact: true })).toBeDisabled();
  await page.reload();
  await expect(sofa).toHaveAttribute('data-depth-layer', '6');
  await expect(actor).toHaveAttribute('data-depth-layer', '1');
  const saved = await api('/house/' + homeId);
  expect(saved.rooms[0].placements[3].facing).toBe(14);
  expect(saved.rooms[0].placements[3].depth_layer).toBe(6);
  expect(saved.presence[0].depth_layer).toBe(1);
  expect(errors).toEqual([]);
  console.log(
    'House: 176 images decoded, 16 real views via arrows, contact shadows, cursor/depth, six item/character layers and persistence passed.',
  );
} finally {
  await browser.close();
  await new Promise<void>((r) => server.close(() => r()));
  await pool.end();
}
