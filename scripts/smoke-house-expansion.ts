import 'dotenv/config';
import assert from 'node:assert/strict';
import { chromium, expect, type BrowserContext } from '@playwright/test';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import expansion from '../data/house-expansion-20261008.json';
import {
  houseCatalog,
  houseItemImage,
  houseFacingOptions,
  houseTurnFacing,
} from '../shared/house.js';
import { houseViewWidth } from '../shared/house-perspective.js';

if (!/^\/alvorada_test_[0-9a-f]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))
  throw Error('Disposable database required.');
const origin = 'http://localhost:3050';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db.js'),
  { migrate } = await import('../server/migrate.js'),
  { seed } = await import('../server/seed.js');
const { createLegacyTestCharacter } = await import('../tests/character-fixtures.js');
await migrate();
await seed();
const { createApp } = await import('../server/app.js');
const server = createApp().listen(3050, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const owner = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: 'reduce',
});
const administrator = await browser.newContext(),
  outsider = await browser.newContext();
const page = await owner.newPage(),
  errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
async function request(
  context: BrowserContext,
  path: string,
  data?: unknown,
  method = 'POST',
  status?: number,
) {
  const response = await context.request.fetch(origin + '/api' + path, {
    method,
    headers: { Origin: origin },
    data,
  });
  if (status !== undefined) {
    expect(response.status(), path).toBe(status);
    return null;
  }
  expect(response.ok(), method + ' ' + path + ': ' + (await response.text())).toBe(true);
  return response.json();
}
async function signup(context: BrowserContext, name: string) {
  await context.addInitScript(() => {
    localStorage.setItem('alvorada-music-muted', 'true');
    localStorage.setItem('alvorada-effects-muted', 'true');
  });
  return (
    await request(context, '/auth/sign-up/email', {
      name,
      email: randomUUID() + '@example.test',
      password: 'Test-' + randomUUID(),
    })
  ).user;
}
const hash = (b: Buffer) => createHash('sha256').update(b).digest('hex');
const roomLabels: Record<string, string> = {
  sala: 'Sala',
  cozinha: 'Cozinha',
  varanda: 'Varanda',
  jardim: 'Jardim',
};
try {
  const user = await signup(owner, 'Dona da casa'),
    admin = await signup(administrator, 'Administradora'),
    other = await signup(outsider, 'Outro viajante');
  await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [admin.id]);
  const hero = await createLegacyTestCharacter(user.id, 'Helena');
  await pool.query('UPDATE characters SET gold_cp=1000000 WHERE id=$1', [hero.id]);
  const homeId = (await request(owner, '/house', { character_id: hero.id })).id;
  const index = await request(owner, '/house', undefined, 'GET');
  expect(index.catalog).toHaveLength(52);
  expect(expansion).toHaveLength(40);
  const manifest = JSON.parse(
    await readFile('public/house/items/house-expansion-20261008/art-manifest.json', 'utf8'),
  );
  expect(manifest.complete).toBe(true);
  expect(manifest.assets).toHaveLength(320);
  for (const asset of manifest.assets) {
    const response = await owner.request.get(origin + '/' + asset.path.replace(/^public\//, ''));
    expect(response.status(), asset.path).toBe(200);
    expect(hash(await response.body())).toBe(asset.sha256);
  }
  await request(owner, '/catalog/house-banquet-table/price', { price_cp: 4321 }, 'PATCH', 403);
  await request(administrator, '/catalog/house-banquet-table/price', { price_cp: 4321 }, 'PATCH');
  await pool.query('UPDATE "user" SET administrador=0 WHERE id=$1', [admin.id]);
  await request(
    administrator,
    '/catalog/house-banquet-table/price',
    { price_cp: 999 },
    'PATCH',
    403,
  );
  expect(
    (await request(owner, '/house', undefined, 'GET')).catalog.find(
      (i: any) => i.id === 'banquet-table',
    ).price_cp,
  ).toBe(4321);
  const bought = new Map<string, string>();
  let spent = 0;
  for (const item of expansion) {
    const key = randomUUID(),
      input = { character_id: hero.id, catalog_id: item.id, idempotency_key: key };
    const first = await request(owner, '/house/purchase', input),
      repeated = await request(owner, '/house/purchase', input);
    expect(repeated.item_id).toBe(first.item_id);
    bought.set(item.id, first.item_id);
    spent += item.id === 'banquet-table' ? 4321 : item.price_cp;
    const directions = houseFacingOptions(item.id);
    expect(directions.map((d) => d.value)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(houseTurnFacing(item.id, 7, 1)).toBe(0);
    expect(houseTurnFacing(item.id, 0, -1)).toBe(7);
    for (let f = 0; f < 8; f++) expect(houseViewWidth(item.id, f)).toBeGreaterThan(0);
  }
  expect(
    (await pool.query('SELECT gold_cp FROM characters WHERE id=$1', [hero.id])).rows[0].gold_cp,
  ).toBe(1000000 - spent);
  expect(
    (await pool.query('SELECT count(*)::int n FROM house_items WHERE character_id=$1', [hero.id]))
      .rows[0].n,
  ).toBe(40);
  await request(
    outsider,
    '/house/purchase',
    { character_id: hero.id, catalog_id: 'owl-statue', idempotency_key: randomUUID() },
    'POST',
    404,
  );
  await request(
    owner,
    '/house/purchase',
    { character_id: hero.id, catalog_id: 'not-real', idempotency_key: randomUUID() },
    'POST',
    404,
  );
  let state = await request(owner, `/house/${homeId}`, undefined, 'GET');
  for (const room of state.rooms) {
    room.placements = expansion
      .filter((i) => i.room === room.kind)
      .map((i, n) => ({
        id: randomUUID(),
        kind: 'item',
        ref: bought.get(i.id),
        x: 0.16 + (n % 4) * 0.21,
        y: 0.62 + Math.floor(n / 4) * 0.14,
        scale: i.default_scale,
        rotation: 0,
        facing: 1,
        layer: n,
        depth_layer: 3,
      }));
  }
  await request(
    owner,
    `/house/${homeId}`,
    { name: state.name, revision: state.revision, rooms: state.rooms },
    'PUT',
  );
  const saved = await request(owner, `/house/${homeId}`, undefined, 'GET');
  expect(saved.rooms).toEqual(state.rooms);
  await request(outsider, `/house/${homeId}`, undefined, 'GET', 404);
  await request(
    outsider,
    `/house/${homeId}`,
    { name: saved.name, revision: saved.revision, rooms: saved.rooms },
    'PUT',
    404,
  );
  await page.goto(origin + '/#shop');
  await page.getByRole('button', { name: /^Itens de House/ }).click();
  for (const item of expansion)
    await expect(
      page.locator(`.shop-product[data-item-id="house-${item.id}"] .shop-product-art img`),
    ).toHaveAttribute('src', houseItemImage(item.id));
  await page.goto(origin + '/#house');
  await expect(page.locator('.house-scene')).toBeVisible();
  await page.getByRole('button', { name: 'Mobília', exact: true }).click();
  await page.getByLabel('Procurar mobília e lembranças', { exact: true }).fill('Pergaminhos');
  await expect(page.locator('.house-catalog > button')).toHaveCount(1);
  await expect(page.locator('.house-catalog > button')).toContainText('Pergaminhos do Cartógrafo');
  await page.getByLabel('Procurar mobília e lembranças', { exact: true }).fill('armario');
  await expect(page.locator('.house-catalog > button')).toHaveCount(1);
  await expect(page.locator('.house-catalog > button')).toContainText('Armário de Vidraças');
  await page.getByRole('button', { name: 'Mobília', exact: true }).click();
  await page.getByRole('button', { name: 'Decorar', exact: true }).click();
  for (const room of state.rooms) {
    await page.getByRole('button', { name: roomLabels[room.kind], exact: true }).click();
    for (const item of expansion.filter((i) => i.room === room.kind)) {
      const p = room.placements.find((p: any) => p.ref === bought.get(item.id));
      const piece = page.locator(`[data-house-piece="${p.id}"]`);
      // These review layouts deliberately overlap forty purchased pieces.
      await piece.evaluate((element: HTMLButtonElement) => element.click());
      for (let f = 0; f < 8; f++) {
        await page.getByLabel('Direção da peça', { exact: true }).selectOption(String(f));
        await expect(piece).toHaveAttribute('data-facing', String(f));
        await expect(piece.locator('img').last()).toHaveAttribute(
          'src',
          houseItemImage(item.id, f),
        );
        await expect
          .poll(() =>
            piece
              .locator('img')
              .last()
              .evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0),
          )
          .toBe(true);
      }
      await page.getByLabel('Direção da peça', { exact: true }).selectOption('1');
    }
  }
  await page.getByRole('button', { name: 'Salvar mudanças', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Salvo', exact: true })).toBeDisabled();
  await page.reload();
  state = await request(owner, `/house/${homeId}`, undefined, 'GET');
  expect(state.rooms).toEqual(saved.rooms);
  // Composition reviews have a handful of pieces rather than filling rooms with every purchase.
  const compositions: Record<string, Record<string, [number, number, number]>> = {
    sala: {
      'banquet-table': [0.28, 0.91, 0.38],
      'herald-chair': [0.08, 0.88, 0.13],
      'fur-armchair': [0.74, 0.8, 0.17],
      'round-hearth-table': [0.53, 0.86, 0.17],
      'gothic-cabinet': [0.12, 0.61, 0.16],
    },
    cozinha: {
      'kitchen-workbench': [0.45, 0.92, 0.33],
      'kitchen-hutch': [0.78, 0.66, 0.2],
      'round-stool': [0.21, 0.9, 0.09],
      'ale-barrel': [0.1, 0.78, 0.13],
      'produce-crate': [0.87, 0.92, 0.12],
    },
    varanda: {
      'vine-bench': [0.18, 0.7, 0.25],
      'rocking-chair': [0.72, 0.83, 0.17],
      'chess-table': [0.47, 0.9, 0.18],
      'lavender-planter': [0.9, 0.73, 0.1],
      'iron-lantern': [0.3, 0.79, 0.045],
    },
    jardim: {
      'guardian-statue': [0.14, 0.67, 0.13],
      'stone-bench': [0.72, 0.73, 0.24],
      'iron-brazier': [0.52, 0.86, 0.14],
      'flower-urn': [0.88, 0.84, 0.11],
      'stone-birdbath': [0.33, 0.76, 0.12],
    },
  };
  state.rooms = state.rooms.map((room: any) => ({
    ...room,
    placements: room.placements
      .filter((p: any) => {
        const item = expansion.find((i) => bought.get(i.id) === p.ref);
        return item && compositions[room.kind][item.id];
      })
      .map((p: any, n: number) => {
        const item = expansion.find((i) => bought.get(i.id) === p.ref)!;
        const [x, y, scale] = compositions[room.kind][item.id];
        return { ...p, x, y, scale, layer: n };
      }),
  }));
  await request(
    owner,
    `/house/${homeId}`,
    { name: state.name, revision: state.revision, rooms: state.rooms },
    'PUT',
  );
  await page.reload();
  await expect(page.locator('.house-scene')).toBeVisible();
  await mkdir('test-results/house-expansion', { recursive: true });
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const room of state.rooms) {
      await page.getByRole('button', { name: roomLabels[room.kind], exact: true }).click();
      await expect
        .poll(() =>
          page
            .locator('.house-piece img')
            .evaluateAll((imgs) =>
              imgs.every(
                (img) =>
                  (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0,
              ),
            ),
        )
        .toBe(true);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await page
        .locator('.house-scene')
        .screenshot({ path: `test-results/house-expansion/${room.kind}-${width}.png` });
    }
  }
  expect(errors).toEqual([]);
  await writeFile(
    'test-results/house-expansion/report.json',
    JSON.stringify(
      {
        models: 40,
        views: 320,
        purchases: 40,
        idempotent: true,
        pricePermissions: true,
        ownership: true,
        persistence: true,
        widths: [1440, 768, 390, 320],
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    'PASS House expansion: 40 models, 320 view hashes, purchases/idempotency/prices/ownership, direction UI and persistence, 4 rooms at 4 widths.',
  );
} finally {
  await browser.close();
  await new Promise<void>((r, j) => server.close((e) => (e ? j(e) : r())));
  await pool.end();
}
