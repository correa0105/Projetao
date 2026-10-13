import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID, createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { treeAssets, treeAssetMime } from '../shared/vtt-tree-assets';
if (!/^\/alvorada_test_[0-9a-f]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))
  throw Error('Disposable DB only');
const origin = 'http://localhost:3063';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db'),
  { migrate } = await import('../server/migrate'),
  { seed } = await import('../server/seed');
await migrate();
await seed();
const { createApp } = await import('../server/app');
const env = process.env.NODE_ENV;
process.env.NODE_ENV = 'production';
const server = createApp().listen(3063, '127.0.0.1');
process.env.NODE_ENV = env;
await new Promise<void>((r) => server.once('listening', r));
const browser = await chromium.launch({ channel: 'msedge', headless: true }),
  ctx = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
  }),
  page = await ctx.newPage(),
  errors: string[] = [],
  missing: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('response', (r) => {
  if (
    r.url().includes('/trees-20261013/') &&
    (r.status() >= 400 ||
      (r.status() === 200 && !r.headers()['content-type']?.includes('image/png')))
  )
    missing.push(r.status() + ' ' + r.url());
});
await ctx.addInitScript(() => {
  localStorage.setItem('alvorada-music-muted', 'true');
  localStorage.setItem('alvorada-effects-muted', 'true');
});
await mkdir('test-results/trees', { recursive: true });
try {
  expect(treeAssets.length).toBe(25);
  expect(new Set(treeAssets.map((a) => a.id)).size).toBe(25);
  const hashes: string[] = [];
  for (const asset of treeAssets) {
    const bytes = await readFile('public' + asset.image),
      meta = await sharp(bytes).metadata(),
      stats = await sharp(bytes).stats();
    expect(meta.hasAlpha).toBe(true);
    expect(Math.min(meta.width!, meta.height!)).toBeGreaterThanOrEqual(1024);
    expect(stats.channels[3].min).toBe(0);
    expect(stats.channels[3].max).toBe(255);
    hashes.push(createHash('sha256').update(bytes).digest('hex'));
    const response = await ctx.request.get(origin + asset.image);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('image/png');
    expect(
      createHash('sha256')
        .update(await response.body())
        .digest('hex'),
    ).toBe(hashes.at(-1));
  }
  expect(new Set(hashes).size).toBe(25);
  const signup = await ctx.request.post(origin + '/api/auth/sign-up/email', {
    headers: { Origin: origin },
    data: {
      name: 'Mestre do Bosque',
      email: randomUUID() + '@example.test',
      password: 'Test-' + randomUUID(),
    },
  });
  expect(signup.status()).toBe(200);
  const user = (await signup.json()).user;
  await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [user.id]);
  const { createLegacyTestCharacter } = await import('../tests/character-fixtures');
  await createLegacyTestCharacter(user.id, 'Guardião');
  await page.goto(origin + '/#vtt');
  await page.getByLabel('Nome da mesa', { exact: true }).fill('Floresta original');
  await page.getByRole('button', { name: 'Criar mesa', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Mesa virtual', exact: true })).toBeVisible();
  const r = (
    await pool.query('SELECT id,document FROM vtt_rooms WHERE owner_id=$1', [user.id])
  ).rows[0];
  r.document.scenes[0].lighting = false;
  r.document.scenes[0].fog = false;
  r.document.scenes[0].ambient = 1;
  await pool.query('UPDATE vtt_rooms SET document=$2,revision=revision+1 WHERE id=$1', [
    r.id,
    JSON.stringify(r.document),
  ]);
  await page.reload();
  await page.getByRole('button', { name: 'Biblioteca', exact: true }).click();
  const panel = page.locator('.vtt-panel-content');
  await panel.getByRole('button', { name: 'Assets', exact: true }).click();
  await expect(panel.locator('.vtt-tree-card')).toHaveCount(25);
  await expect(
    panel.getByRole('button', { name: 'Galeria de monstros', exact: true }),
  ).toHaveCount(0);
  await panel.getByRole('button', { name: 'Asset: Carvalho ancestral', exact: true }).click();
  await panel.getByLabel('Escala da árvore', { exact: true }).selectOption('1.5');
  await panel.getByRole('button', { name: 'Colocar no mapa', exact: true }).click();
  await page.getByRole('button', { name: 'Salvar mesa', exact: true }).click();
  await expect
    .poll(
      async () =>
        (await pool.query('SELECT document FROM vtt_rooms WHERE id=$1', [r.id])).rows[0]
          .document.scenes[0].tokens.length,
    )
    .toBe(1);
  const first = (await pool.query('SELECT document FROM vtt_rooms WHERE id=$1', [r.id]))
    .rows[0].document.scenes[0].tokens[0];
  expect(first).toMatchObject({
    image: treeAssets[0].image,
    layer: 'map',
    vision: 0,
    bleeds: false,
    characterId: null,
    monster: null,
  });
  expect(first.width).toBe(r.document.scenes[0].grid.size * 4 * 1.5);
  const canvas = page.getByLabel('Tabuleiro da mesa', { exact: true });
  const bounds = (await canvas.boundingBox())!;
  const transfer = await page.evaluateHandle(
    ({ mime, id }) => {
      const data = new DataTransfer();
      data.setData(mime, JSON.stringify({ id, scale: 1 }));
      return data;
    },
    { mime: treeAssetMime, id: 'birch-autumn' },
  );
  await canvas.dispatchEvent('drop', {
    dataTransfer: transfer,
    clientX: bounds.x + bounds.width * 0.3,
    clientY: bounds.y + bounds.height * 0.5,
  });
  await page.getByRole('button', { name: 'Salvar mesa', exact: true }).click();
  await expect
    .poll(
      async () =>
        (await pool.query('SELECT document FROM vtt_rooms WHERE id=$1', [r.id])).rows[0]
          .document.scenes[0].tokens.length,
    )
    .toBe(2);
  const saved = (await pool.query('SELECT document FROM vtt_rooms WHERE id=$1', [r.id]))
    .rows[0].document;
  expect(saved.scenes[0].tokens[1].image).toContain('birch-autumn.png');
  expect(saved.scenes[0].tokens[1].layer).toBe('map');
  await panel.getByRole('button', { name: 'Secas', exact: true }).click();
  await expect(panel.locator('.vtt-tree-card')).toHaveCount(2);
  await panel.getByRole('button', { name: 'Todos', exact: true }).click();
  await expect(panel.locator('.vtt-tree-card')).toHaveCount(25);
  await page.getByLabel('Buscar na biblioteca', { exact: true }).fill('betula dourada');
  await expect(panel.locator('.vtt-tree-card')).toHaveCount(1);
  await page.getByLabel('Buscar na biblioteca', { exact: true }).fill('');
  await panel.getByRole('button', { name: 'Criaturas', exact: true }).click();
  await expect(panel.locator('.vtt-premium-grid img')).toHaveCount(330);
  await panel.getByRole('button', { name: /Árvores/ }).click();
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.waitForTimeout(150);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2),
    ).toBe(true);
    await page.screenshot({
      path: 'test-results/trees/vtt-assets-' + width + '.png',
      fullPage: true,
    });
  }
  await page.reload();
  await expect(page.getByRole('region', { name: 'Mesa virtual', exact: true })).toBeVisible();
  expect(
    (await pool.query('SELECT document FROM vtt_rooms WHERE id=$1', [r.id])).rows[0].document
      .scenes[0].tokens,
  ).toEqual(saved.scenes[0].tokens);
  expect(errors).toEqual([]);
  expect(missing).toEqual([]);
  await writeFile(
    'test-results/trees/result.json',
    JSON.stringify({
      passed: true,
      assets: 25,
      uniquePNG: true,
      alpha: true,
      placedAndSaved: true,
      dragDrop: true,
      reloaded: true,
      viewports: [1440, 768, 390, 320],
      creaturesPreserved: 330,
      errors,
      missing,
    }),
  );
  console.log('25 tree assets browser QA passed.');
} finally {
  await browser.close();
  await new Promise<void>((resolve, reject) =>
    server.close((e) => (e ? reject(e) : resolve())),
  );
  await pool.end();
}
