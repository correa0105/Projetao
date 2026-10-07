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
    { id: 'bench', x: 0.9, y: 0.92, scale: 0.25, facing: 9, depth_layer: 2 },
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
  // Offered directions are distinct; keep decoding retired images for saved layouts.
  const urls = houseCatalog.flatMap((s) =>
    Array.from({ length: ['letter', 'frame'].includes(s.id) ? 8 : 16 }, (_, facing) =>
      houseItemImage(s.id, facing),
    ),
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
  const legacyBench = page.locator(`[data-house-piece="${state.rooms[0].placements[6].id}"]`);
  await legacyBench.click();
  await expect(page.getByLabel('Direção da peça').locator('option:checked')).toHaveText(
    'Vista salva · escolha outra direção',
  );
  await expect(legacyBench.locator('img')).toHaveAttribute('src', houseItemImage('bench', 9));
  await sofa.click();
  const base = await sofa.getAttribute('data-base-scale');
  const paths = new Set<string>();
  await expect(page.getByLabel('Direção da peça').locator('option')).toHaveCount(12);
  for (const retired of [9, 11, 12, 15])
    await expect(
      page.getByLabel('Direção da peça').locator(`option[value="${retired}"]`),
    ).toHaveCount(0);
  for (let i = 0; i < 12; i++) {
    paths.add((await sofa.locator('img').getAttribute('src'))!);
    const mask = await sofa
      .locator('.house-floor-shadow')
      .evaluate((e) => getComputedStyle(e).maskImage);
    expect(mask).toContain((await sofa.locator('img').getAttribute('src'))!);
    await expect(sofa.locator('.house-floor-shadow')).toHaveAttribute(
      'data-shadow-facing',
      (await sofa.getAttribute('data-facing'))!,
    );
    await page.getByRole('button', { name: 'Virar item à direita', exact: true }).click();
    await sofa.locator('img').evaluate((img) => (img as HTMLImageElement).decode());
  }
  expect(paths.size).toBe(12);
  await expect(sofa).toHaveAttribute('data-facing', '14');
  await expect(sofa).toHaveAttribute('data-base-scale', base!);
  // Reproduce the reported diagonal view: contact shadow moves/rotates/scales
  // in the same coordinate system as the model, without a separate floating oval.
  await page.getByLabel('Direção da peça').selectOption('1');
  await sofa.locator('img').evaluate((img) => (img as HTMLImageElement).decode());
  const shadow = sofa.locator('.house-floor-shadow');
  const pieceBox = (await sofa.boundingBox())!;
  const contactBox = (await shadow.boundingBox())!;
  expect(Math.abs(pieceBox.width - contactBox.width)).toBeLessThan(1);
  expect(Math.abs(pieceBox.height - contactBox.height)).toBeLessThan(1);
  expect(Math.abs(pieceBox.x - contactBox.x)).toBeLessThan(1);
  expect(contactBox.y - pieceBox.y).toBeGreaterThan(0);
  expect(contactBox.y - pieceBox.y).toBeLessThan(pieceBox.width * 0.01);
  expect(await shadow.evaluate((e) => getComputedStyle(e, '::after').content)).toBe('none');
  await page.locator('.house-scene').screenshot({ path: 'test-results/house-shadow-fixed.png' });
  expect(await shadow.evaluate((e) => !!e.closest('.house-piece'))).toBe(true);
  await expect(page.getByLabel('Giro da peça')).toHaveCount(0);
  await page.getByRole('button', { name: 'Distorcer imagem', exact: true }).click();
  const handles = page.locator('.house-distortion-controls button');
  await expect(handles).toHaveCount(4);
  const topLeft = (await handles.first().boundingBox())!;
  const corner = { x: topLeft.x + topLeft.width / 2, y: topLeft.y + topLeft.height / 2 };
  await page.mouse.move(corner.x, corner.y);
  await page.mouse.down();
  await page.mouse.move(corner.x + pieceBox.width * 0.08, corner.y + pieceBox.height * 0.08, {
    steps: 5,
  });
  await page.mouse.up();
  expect(await sofa.locator('.house-warp').evaluate((e) => getComputedStyle(e).transform)).toMatch(
    /^matrix3d/,
  );
  const moved = (await handles.first().boundingBox())!;
  expect(Math.abs(moved.x - topLeft.x - pieceBox.width * 0.08)).toBeLessThan(2);
  expect(Math.abs(moved.y - topLeft.y - pieceBox.height * 0.08)).toBeLessThan(2);
  await expect(sofa.locator('img')).toHaveAttribute('src', houseItemImage('sofa', 1));
  expect(await shadow.evaluate((e) => e.parentElement!.classList.contains('house-warp'))).toBe(
    true,
  );
  await page.locator('.house-scene').screenshot({ path: 'test-results/house-distortion-tool.png' });
  // A long drag stops at the 12% limit instead of folding the image.
  const topRight = (await handles.nth(1).boundingBox())!;
  const farCorner = { x: topRight.x + topRight.width / 2, y: topRight.y + topRight.height / 2 };
  await page.mouse.move(farCorner.x, farCorner.y);
  await page.mouse.down();
  await page.mouse.move(farCorner.x - pieceBox.width * 0.5, farCorner.y + pieceBox.height * 0.5, {
    steps: 5,
  });
  await page.mouse.up();
  const limited = (await handles.nth(1).boundingBox())!;
  expect(Math.abs(limited.x - topRight.x + pieceBox.width * 0.12)).toBeLessThan(2);
  expect(Math.abs(limited.y - topRight.y - pieceBox.height * 0.12)).toBeLessThan(2);
  await page.getByRole('button', { name: 'Restaurar forma', exact: true }).click();
  expect(await sofa.locator('.house-warp').evaluate((e) => getComputedStyle(e).transform)).toBe(
    'none',
  );
  await page.getByRole('button', { name: 'Concluir distorção', exact: true }).click();
  await page.getByLabel('Direção da peça').selectOption('14');
  await sofa.locator('img').evaluate((img) => (img as HTMLImageElement).decode());
  // Cursor remains on the grabbed point while the furniture shrinks toward the hearth.
  const before = (await sofa.boundingBox())!,
    grab = { x: before.x + before.width * 0.55, y: before.y + before.height * 0.8 };
  await page.mouse.move(grab.x, grab.y);
  await page.mouse.down();
  const scene = (await page.locator('.house-scene').boundingBox())!;
  const destination = { x: grab.x + scene.width * 0.04, y: grab.y - scene.height * 0.09 };
  await page.mouse.move(destination.x, destination.y, { steps: 5 });
  const distant = (await sofa.boundingBox())!;
  expect(await page.locator('.house-scene').evaluate((e) => e.scrollLeft + e.scrollTop)).toBe(0);
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
  await page.getByRole('button', { name: 'Distorcer imagem', exact: true }).click();
  const finalCorner = (await handles.first().boundingBox())!;
  const finalBox = (await sofa.boundingBox())!;
  await page.mouse.move(
    finalCorner.x + finalCorner.width / 2,
    finalCorner.y + finalCorner.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    finalCorner.x + finalCorner.width / 2 + finalBox.width * 0.06,
    finalCorner.y + finalCorner.height / 2 + finalBox.height * 0.04,
    { steps: 5 },
  );
  await page.mouse.up();
  await page.getByRole('button', { name: 'Concluir distorção', exact: true }).click();
  await page.getByRole('button', { name: 'Salvar mudanças', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Salvo', exact: true })).toBeDisabled();
  await page.reload();
  await expect(sofa).toHaveAttribute('data-depth-layer', '6');
  await expect(actor).toHaveAttribute('data-depth-layer', '1');
  const saved = await api('/house/' + homeId);
  expect(saved.rooms[0].placements[3].facing).toBe(14);
  expect(saved.rooms[0].placements[3].depth_layer).toBe(6);
  expect(saved.rooms[0].placements[3].distortion[0].x).toBeCloseTo(0.06, 2);
  expect(saved.rooms[0].placements[3].distortion[0].y).toBeCloseTo(0.04, 2);
  expect(saved.rooms[0].placements[6].facing).toBe(9);
  expect(await sofa.locator('.house-warp').evaluate((e) => getComputedStyle(e).transform)).toMatch(
    /^matrix3d/,
  );
  expect(saved.presence[0].depth_layer).toBe(1);
  expect(errors).toEqual([]);
  console.log(
    'House: 176 compatible images, 12 distinct views, aligned shadows, four-corner distortion/limit/reset/persistence, cursor/depth and six layers passed.',
  );
} finally {
  await browser.close();
  await new Promise<void>((r) => server.close(() => r()));
  await pool.end();
}
