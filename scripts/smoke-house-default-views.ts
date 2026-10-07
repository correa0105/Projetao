import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import { houseCatalog } from '../shared/house.js';
import refitCatalog from '../data/house-refit-catalog.json';
if (!/^\/alvorada_test_[0-9a-f]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))
  throw Error('Banco descartável obrigatório.');
const origin = 'http://localhost:3041';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db.js');
const { migrate } = await import('../server/migrate.js');
const { seed } = await import('../server/seed.js');
const { createLegacyTestCharacter } = await import('../tests/character-fixtures.js');
await migrate();
await seed();
const { createApp } = await import('../server/app.js');
const server = createApp().listen(3041, '127.0.0.1');
await new Promise<void>((resolve) => server.once('listening', resolve));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: 'reduce',
});
const page = await context.newPage();
const errors: string[] = [];
page.on('pageerror', (error) => errors.push(error.message));
await context.addInitScript(() => {
  localStorage.setItem('alvorada-music-muted', 'true');
  localStorage.setItem('alvorada-effects-muted', 'true');
});
async function request(path: string, data?: unknown, method = 'POST') {
  const response = await context.request.fetch(origin + '/api' + path, {
    method,
    headers: { Origin: origin },
    data,
  });
  expect(response.ok(), `${method} ${path}`).toBe(true);
  return response.json();
}
const expectedViews: Record<string, number> = {
  sofa: 7,
  chair: 1,
  table: 0,
  rug: 2,
  bench: 1,
  chest: 1,
  books: 1,
  frame: 0,
  letter: 1,
  lantern: 0,
  plant: 0,
  statue: 0,
};
const refitActive = houseCatalog.some((spec) => spec.image.includes('/house-refit-20261007/'));
if (refitActive) for (const spec of refitCatalog) expectedViews[spec.id] = spec.default_facing;
const expectedPath = (id: string, facing: number) =>
  `/house/items/${refitActive && !['letter', 'frame'].includes(id) ? 'house-refit-20261007' : 'views'}/${id}/${facing}.webp`;
try {
  const user = (
    await request('/auth/sign-up/email', {
      name: 'Perspectiva da sala',
      email: randomUUID() + '@example.test',
      password: 'Test-' + randomUUID(),
    })
  ).user;
  const hero = await createLegacyTestCharacter(user.id, 'Mobília da sala');
  await pool.query('UPDATE characters SET gold_cp=1000000 WHERE id=$1', [hero.id]);
  const homeId = (await request('/house', { character_id: hero.id })).id;
  const index = await request('/house', undefined, 'GET');
  expect(index.catalog).toHaveLength(12);
  for (const spec of index.catalog) {
    expect(spec.default_facing).toBe(expectedViews[spec.id]);
    expect(spec.image).toBe(expectedPath(spec.id, expectedViews[spec.id]));
    if (refitActive) {
      const expected = refitCatalog.find((item) => item.id === spec.id);
      if (expected) {
        expect(spec.name).toBe(expected.name);
        expect(spec.price_cp).toBe(expected.price_cp);
        expect(spec.default_scale).toBe(expected.default_scale);
      }
    }
  }
  if (refitActive) {
    const manifest = JSON.parse(
      await readFile('public/house/items/house-refit-20261007/art-manifest.json', 'utf8'),
    );
    expect(manifest.complete).toBe(true);
    expect(manifest.calibrated).toBe(true);
    expect(manifest.assets).toHaveLength(80);
    expect(new Set(manifest.assets.map((asset: any) => asset.sha256)).size).toBe(80);
    for (const [file, hash] of Object.entries(manifest.protected_assets.files)) {
      expect(
        createHash('sha256')
          .update(await readFile(file))
          .digest('hex'),
        file,
      ).toBe(hash);
    }
    expect(Object.keys(manifest.protected_assets.files)).toHaveLength(20);
    const widths = JSON.parse(await readFile('shared/house-view-sizes.json', 'utf8'));
    for (const id of ['letter', 'frame'])
      expect(widths[id]).toEqual(manifest.protected_assets.widths[id]);
    for (const asset of manifest.assets) {
      const response = await context.request.get(origin + expectedPath(asset.id, asset.facing));
      expect(response.status(), asset.path).toBe(200);
      expect(
        createHash('sha256')
          .update(await response.body())
          .digest('hex'),
      ).toBe(asset.sha256);
    }
  }
  const purchased = new Map<string, string>();
  for (const spec of houseCatalog) {
    const order = await request('/house/purchase', {
      character_id: hero.id,
      catalog_id: spec.id,
      idempotency_key: randomUUID(),
      ...(['frame', 'letter'].includes(spec.id)
        ? { content: { title: spec.name, text: 'Uma lembrança da sala.' } }
        : {}),
    });
    purchased.set(spec.id, order.item_id);
  }
  const legacySofa = await request('/house/purchase', {
    character_id: hero.id,
    catalog_id: 'sofa',
    idempotency_key: randomUUID(),
  });
  const legacyBench = await request('/house/purchase', {
    character_id: hero.id,
    catalog_id: 'bench',
    idempotency_key: randomUUID(),
  });
  const initial = await request(`/house/${homeId}`, undefined, 'GET');
  const explicit = {
    id: randomUUID(),
    kind: 'item',
    ref: legacySofa.item_id,
    x: 0.85,
    y: 0.6,
    scale: 0.08,
    rotation: 0,
    facing: 3,
    layer: 0,
  };
  const historical = {
    id: randomUUID(),
    kind: 'item',
    ref: legacyBench.item_id,
    x: 0.15,
    y: 0.6,
    scale: 0.08,
    rotation: 0,
    layer: 1,
  };
  initial.rooms[0].placements = [explicit, historical];
  await request(
    `/house/${homeId}`,
    { name: initial.name, revision: initial.revision, rooms: initial.rooms },
    'PUT',
  );
  await page.goto(origin + '/#shop');
  await page.getByRole('button', { name: /^Itens de House/ }).click();
  for (const spec of houseCatalog)
    await expect(
      page.locator(`.shop-product[data-item-id="house-${spec.id}"] .shop-product-art img`),
    ).toHaveAttribute('src', spec.image);
  await page.goto(origin + '/#house');
  await expect(page.locator(`[data-house-piece="${explicit.id}"]`)).toHaveAttribute(
    'data-facing',
    '3',
  );
  await expect(page.locator(`[data-house-piece="${historical.id}"]`)).toHaveAttribute(
    'data-facing',
    '0',
  );
  await page.getByRole('button', { name: 'Decorar', exact: true }).click();
  const placed = new Map<string, string>();
  for (const spec of houseCatalog) {
    const inventory = page
      .locator('.house-inventory-item > button:not(:disabled)')
      .filter({ hasText: spec.name });
    await expect(inventory.locator('img').first()).toHaveAttribute('src', spec.image);
    await inventory.click();
    const piece = page.locator('.house-piece').last();
    await expect(piece).toHaveAttribute('data-facing', String(expectedViews[spec.id]));
    await expect(piece.locator('img').last()).toHaveAttribute('src', spec.image);
    if (refitActive) {
      const defaultScale = refitCatalog.find((item) => item.id === spec.id)?.default_scale ?? 0.17;
      await expect(piece).toHaveAttribute('data-base-scale', String(defaultScale));
      await expect(page.getByLabel('Tamanho da peça', { exact: true })).toHaveValue(
        String(Number((defaultScale * 100).toFixed(1))),
      );
      for (let facing = 0; facing < 8; facing++) {
        await page.getByLabel('Direção da peça', { exact: true }).selectOption(String(facing));
        await expect(piece).toHaveAttribute('data-facing', String(facing));
        await expect(piece.locator('img').last()).toHaveAttribute(
          'src',
          expectedPath(spec.id, facing),
        );
        await expect
          .poll(() =>
            piece
              .locator('img')
              .last()
              .evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0),
          )
          .toBe(true);
      }
      await page
        .getByLabel('Direção da peça', { exact: true })
        .selectOption(String(expectedViews[spec.id]));
    }
    placed.set(spec.id, (await piece.getAttribute('data-house-piece'))!);
    if (spec.id === 'sofa') {
      await page.getByLabel('Direção da peça', { exact: true }).selectOption('4');
      await expect(piece).toHaveAttribute('data-facing', '4');
    }
  }
  const sofa = page.locator(`[data-house-piece="${placed.get('sofa')}"]`);
  await page.getByRole('button', { name: 'Salvar mudanças', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Salvo', exact: true })).toBeDisabled();
  await page.reload();
  await expect(sofa).toHaveAttribute('data-facing', '4');
  const persisted = await request(`/house/${homeId}`, undefined, 'GET');
  expect(persisted.rooms[0].placements.find((p: any) => p.id === explicit.id)).toEqual(explicit);
  expect(persisted.rooms[0].placements.find((p: any) => p.id === historical.id)).toEqual(
    historical,
  );
  for (const [catalogId, ref] of purchased)
    expect(persisted.rooms[0].placements.find((p: any) => p.ref === ref).facing).toBe(
      catalogId === 'sofa' ? 4 : expectedViews[catalogId],
    );
  // This review composition is confined to the disposable account/database.
  // Product defaults change no saved coordinates or user room arrangements.
  const review: Record<string, { x: number; y: number; scale: number; layer: number }> = {
    rug: { x: 0.5, y: 0.92, scale: 0.55, layer: 0 },
    sofa: { x: 0.22, y: 0.73, scale: 0.34, layer: 3 },
    table: { x: 0.5, y: 0.87, scale: 0.3, layer: 4 },
    chair: { x: 0.76, y: 0.75, scale: 0.16, layer: 2 },
    bench: { x: 0.84, y: 0.89, scale: 0.23, layer: 5 },
    chest: { x: 0.86, y: 0.58, scale: 0.19, layer: 1 },
    plant: { x: 0.86, y: 0.48, scale: 0.085, layer: 7 },
    lantern: { x: 0.55, y: 0.727, scale: 0.036, layer: 8 },
    books: { x: 0.47, y: 0.725, scale: 0.052, layer: 8 },
    letter: { x: 0.56, y: 0.63, scale: 0.035, layer: 9 },
    frame: { x: 0.6, y: 0.35, scale: 0.07, layer: 1 },
    statue: { x: 0.07, y: 0.61, scale: 0.16, layer: 1 },
  };
  persisted.rooms[0].placements = houseCatalog.map((spec) => ({
    id: placed.get(spec.id),
    kind: 'item',
    ref: purchased.get(spec.id),
    ...review[spec.id],
    rotation: 0,
    facing: expectedViews[spec.id],
  }));
  await request(
    `/house/${homeId}`,
    { name: persisted.name, revision: persisted.revision, rooms: persisted.rooms },
    'PUT',
  );
  await page.reload();
  await expect(page.locator('.house-piece')).toHaveCount(12);
  await expect
    .poll(() =>
      page
        .locator('.house-piece img')
        .evaluateAll((images) =>
          images.every(
            (image) =>
              (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0,
          ),
        ),
    )
    .toBe(true);
  await mkdir('test-results', { recursive: true });
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(page.locator('.house-item-projection')).toHaveCount(0);
    await page
      .locator('.house-scene')
      .screenshot({ path: `test-results/house-default-views-review-${width}.png` });
  }
  expect(errors).toEqual([]);
  console.log(
    'House defaults: twelve catalog/Shop/inventory thumbnails and new placements match directions; explicit/absent legacy views and coordinates preserved, manual changes persist; review room at four widths.',
  );
} finally {
  await browser.close();
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  await pool.end();
}
