import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { clothingBundles } from '../shared/clothing-bundles';
if (!/^\/alvorada_test_[a-f0-9]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))
  throw Error('Banco descartável obrigatório');
const origin = 'http://localhost:3066';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db'),
  { migrate } = await import('../server/migrate'),
  { seed } = await import('../server/seed'),
  { createLegacyTestCharacter } = await import('../tests/character-fixtures');
await migrate();
await seed();
const { createApp } = await import('../server/app');
process.env.NODE_ENV = 'production';
const server = createApp().listen(3066, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const output = 'test-results/clothing-pieces-shelf';
await mkdir(output, { recursive: true });
const errors: string[] = [];
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
    extraHTTPHeaders: { 'Accept-Encoding': 'identity' },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== origin || url.pathname.startsWith('/api/')) return route.continue();
    const file = resolve('public', '.' + decodeURIComponent(url.pathname));
    if (file.startsWith(resolve('public')) && (await stat(file).catch(() => null))?.isFile())
      return route.fulfill({ path: file });
    return route.continue();
  });
  await page.goto(origin);
  const signup = await page.request.post(origin + '/api/auth/sign-up/email', {
    headers: { Origin: origin },
    data: {
      name: 'Teste roupas e estante',
      email: 'pieces-ui-' + randomUUID() + '@example.test',
      password: 'Test-' + randomUUID(),
    },
  });
  expect(signup.status()).toBe(200);
  const uid = (await signup.json()).user.id;
  const character = await createLegacyTestCharacter(uid, 'Arden');
  await pool.query("INSERT INTO achievements(character_id,code) VALUES($1,'first_character')", [character.id]);
  await pool.query('UPDATE characters SET gold_cp=10000 WHERE id=$1', [character.id]);
  const post = async (path: string, data: unknown) => {
    const r = await page.request.post(origin + '/api' + path, {
      headers: { Origin: origin },
      data,
    });
    expect([200, 201]).toContain(r.status());
    return r.json();
  };
  const bundle = clothingBundles().find((x) => x.id === 'cosmetic-outfit-traveler')!;
  await post('/purchases', {
    character_id: character.id,
    item_id: bundle.id,
    quantity: 1,
    idempotency_key: randomUUID(),
  });
  await page.goto(origin + '/#inventory');
  await page.reload();
  const backpack = page.getByRole('region', { name: 'Itens da mochila' });
  await expect(backpack.locator('button.loot-slot')).toHaveCount(4);
  for (const piece of bundle.pieces) {
    const slot = backpack.getByRole('button', { name: piece.name + ', quantidade 1', exact: true });
    await expect(slot.locator('img')).toHaveAttribute('src', piece.image_path);
    await expect
      .poll(() =>
        slot
          .locator('img')
          .evaluate(
            (n) => (n as HTMLImageElement).complete && (n as HTMLImageElement).naturalWidth > 0,
          ),
      )
      .toBe(true);
  }
  expect(
    await backpack
      .locator('img')
      .evaluateAll((nodes) =>
        nodes.every((n) => !n.getAttribute('src')?.includes('cosmetic-outfit-traveler')),
      ),
  ).toBe(true);
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await page.screenshot({ path: `${output}/inventory-${width}.png`, fullPage: true });
  }
  for (const piece of bundle.pieces)
    await post('/inventory/equipment', {
      character_id: character.id,
      item_id: piece.id,
      slot: piece.slot,
    });
  await page.reload();
  for (const piece of bundle.pieces) {
    await expect(page.locator('.equipment-art img[src="' + piece.image_path + '"]')).toHaveCount(1);
  }
  await page.goto(origin + '/#shop');
  await page.reload();
  await page.getByRole('button', { name: /^Cosméticos/ }).click();
  await page.getByLabel('Procurar item').fill('Traje de viajante');
  const offer = page.locator('.shop-product');
  await expect(offer).toHaveCount(1);
  await offer.locator('select').selectOption(bundle.id);
  await expect(offer).toContainText('Entrega 4 peças separadas');
  await expect(offer.locator('.shop-product-art img')).toHaveAttribute(
    'src',
    '/shop/clothing-20261018/cosmetic-outfit-traveler.webp',
  );

  const path = `/characters/${character.id}/achievements`;
  const shelf = {
    material: 'walnut',
    medal_frame: 'bronze',
    slots: ['first_character', 'first_purchase'],
    positions: [16, 18],
    rows: [0, 0],
  };
  await post(path, shelf);
  await page.goto(origin + '/#achievements');
  await page.reload();
  await page.setViewportSize({ width: 1440, height: 1000 });
  const pieces = page.locator('.cabinet-slot.occupied'),
    selector = page.getByRole('combobox', { name: 'Peça na estante' });
  await expect(pieces).toHaveCount(2);
  await expect(page.locator('.cabinet-personalization')).not.toHaveAttribute('open', '');
  await selector.selectOption('0');
  await page.getByRole('button', { name: 'Trazer para frente', exact: true }).click();
  await expect(pieces.nth(1)).toHaveAttribute('aria-label', 'Posição 2: O primeiro capítulo');
  await expect(pieces.nth(1)).toHaveCSS('z-index', '31');
  await page.getByRole('button', { name: 'Salvar estante', exact: true }).first().click();
  await expect(page.getByText('Estante salva.', { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(pieces.nth(1)).toHaveAttribute('aria-label', 'Posição 2: O primeiro capítulo');
  await selector.selectOption('1');
  await page.getByRole('button', { name: 'Enviar para trás', exact: true }).click();
  await expect(pieces.nth(0)).toHaveAttribute('aria-label', 'Posição 1: O primeiro capítulo');
  await expect(pieces.nth(0)).toHaveCSS('z-index', '30');
  // Selecting a covered item must not lift it above the saved front item.
  await expect(pieces.nth(1)).toHaveCSS('z-index', '31');
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.locator('.cabinet-piece-controls').scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await page.screenshot({ path: `${output}/shelf-${width}.png`, fullPage: true });
  }
  await selector.selectOption('1');
  await page.getByRole('button', { name: 'Remover da prateleira', exact: true }).click();
  await expect(pieces).toHaveCount(1);
  await page.route(
    '**/api/characters/*/achievements',
    async (route) =>
      route.request().method() === 'POST' ? route.abort('failed') : route.continue(),
    { times: 1 },
  );
  await page.getByRole('button', { name: 'Salvar estante', exact: true }).first().click();
  await expect(page.locator('.flash-message--error')).toBeVisible();
  await expect(pieces).toHaveCount(1);
  await page.getByRole('button', { name: 'Salvar estante', exact: true }).first().click();
  await expect(page.getByText('Estante salva.', { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(pieces).toHaveCount(1);
  const state = await page.request.get(origin + '/api' + path).then((r) => r.json());
  expect(state.shelf.slots).toEqual(['first_character']);
  expect(state.unlocked.some((x: any) => x.code === 'first_purchase')).toBe(true);
  await selector.selectOption('0');
  await page.getByRole('button', { name: 'Remover da prateleira', exact: true }).click();
  await expect(pieces).toHaveCount(0);
  await page.getByRole('button', { name: 'Salvar estante', exact: true }).first().click();
  await expect(page.getByText('Estante salva.', { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(pieces).toHaveCount(0);
  const final = await page.request.get(origin + '/api' + path).then((r) => r.json());
  expect(final.shelf.slots).toEqual([]);
  expect(final.unlocked.length).toBeGreaterThanOrEqual(2);
  expect(errors).toEqual([]);
  await writeFile(
    output + '/result.json',
    JSON.stringify(
      {
        passed: true,
        piecesPerOutfit: 4,
        colorVariants: 5,
        individualIcons: true,
        equipment: true,
        completeShopPreview: true,
        shelfRemove: true,
        shelfLayering: true,
        reloadPersisted: true,
        failedSaveRetained: true,
        unlocksPreserved: true,
        widths: [1440, 768, 390],
        errors,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
  await new Promise<void>((r) => server.close(() => r()));
  await pool.end();
}
