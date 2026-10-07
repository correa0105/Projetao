import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import type { Item } from '../src/types.js';

if (!/^\/alvorada_test_[a-f0-9]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))
  throw Error('Banco descartável obrigatório.');
const origin = 'http://localhost:3044';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db.js');
const { migrate } = await import('../server/migrate.js');
const { seed } = await import('../server/seed.js');
const { createLegacyTestCharacter } = await import('../tests/character-fixtures.js');
await migrate();
await seed();
const { createApp } = await import('../server/app.js');
const server = createApp().listen(3044, '127.0.0.1');
await new Promise<void>((resolve) => server.once('listening', resolve));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ reducedMotion: 'reduce' });
const page = await context.newPage();
const errors: string[] = [];
page.on('pageerror', (error) => errors.push(error.message));
try {
  const response = await context.request.post(origin + '/api/auth/sign-up/email', {
    headers: { Origin: origin },
    data: {
      name: 'Arte temática',
      email: randomUUID() + '@example.test',
      password: 'Test-' + randomUUID(),
    },
  });
  expect(response.ok()).toBe(true);
  const user = (await response.json()).user;
  const hero = await createLegacyTestCharacter(user.id, 'Escolhas do Empório');
  const initialGold = 200000000;
  await pool.query('UPDATE characters SET gold_cp=$2 WHERE id=$1', [hero.id, initialGold]);
  await context.addInitScript(() => {
    localStorage.setItem('alvorada-music-muted', 'true');
    localStorage.setItem('alvorada-effects-muted', 'true');
  });
  const catalog: Item[] = await (await context.request.get(origin + '/api/catalog')).json();
  const dragon = catalog.find((item) => item.id === 'dragon-slayer')!;
  const ordinary = catalog.find(
    (item) => item.magic_family === 'Dragon Slayer' && item.base_item === 'greatsword',
  )!;
  await mkdir('test-results', { recursive: true });
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(origin + '/#shop');
    await page.getByLabel('Procurar item', { exact: true }).fill('Matadora de dragões');
    const card = page.locator('.shop-product[data-family="Dragon Slayer"]');
    const select = card.getByRole('combobox', { name: /^Tipo de arma de/ });
    await expect(select.locator('option[value="longsword"]')).toHaveText(
      'Espada longa – SKIN TEMÁTICA',
    );
    await expect(select.locator('option[value="greatsword"]')).toHaveText('Espada grande');
    expect(await select.locator('option').allTextContents()).toEqual(
      expect.arrayContaining(['Machado de batalha', 'Espada longa – SKIN TEMÁTICA']),
    );
    await select.selectOption('longsword');
    await expect(card).toHaveAttribute('data-item-id', dragon.id);
    await expect(card.locator('h3')).toHaveText('MATADORA DE DRAGÕES');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width + 1,
    );
    await card.screenshot({ path: `test-results/shop-thematic-selector-${width}.png` });
    await page.getByLabel('Procurar item', { exact: true }).fill('Arco de energia');
    const energy = page.locator('.shop-product[data-family="Energy Bow"]');
    const energySelect = energy.getByRole('combobox', { name: /^Tipo de arma de/ });
    await expect(energySelect.locator('option[value="longbow"]')).toHaveText(
      'Arco longo – SKIN TEMÁTICA',
    );
    await expect(energySelect.locator('option[value="shortbow"]')).toHaveText(
      'Arco curto – SKIN TEMÁTICA',
    );
  }
  await page.getByLabel('Procurar item', { exact: true }).fill('Matadora de dragões');
  const card = page.locator('.shop-product[data-family="Dragon Slayer"]');
  const select = card.getByRole('combobox', { name: /^Tipo de arma de/ });
  for (const item of [dragon, ordinary]) {
    await select.selectOption(item.base_item!);
    await expect(card).toHaveAttribute('data-item-id', item.id);
    await card.getByRole('button', { name: 'Comprar', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Abrir carrinho: 2 itens', exact: true }).click();
  const checkout = page.getByRole('dialog', { name: 'Seu carrinho', exact: true });
  for (const item of [dragon, ordinary])
    await expect(checkout.getByText(item.name, { exact: true })).toBeVisible();
  await expect(checkout).not.toContainText('SKIN TEMÁTICA');
  await checkout.getByRole('button', { name: /Finalizar compra/ }).click();
  await expect(checkout).toHaveCount(0);
  const expected = [dragon, ordinary]
    .map((item) => ({ item_id: item.id, total_cp: item.price_cp }))
    .sort((a, b) => a.item_id.localeCompare(b.item_id));
  expect(
    (
      await pool.query(
        'SELECT item_id,total_cp FROM purchases WHERE character_id=$1 ORDER BY item_id',
        [hero.id],
      )
    ).rows,
  ).toEqual(expected);
  expect(
    (
      await pool.query(
        'SELECT item_id,quantity FROM inventory WHERE character_id=$1 ORDER BY item_id',
        [hero.id],
      )
    ).rows,
  ).toEqual(expected.map((item) => ({ item_id: item.item_id, quantity: 1 })));
  expect(
    (await pool.query('SELECT gold_cp FROM characters WHERE id=$1', [hero.id])).rows[0].gold_cp,
  ).toBe(initialGold - dragon.price_cp! - ordinary.price_cp!);
  expect(errors).toEqual([]);
  console.log(
    'Thematic selectors: dedicated Dragon Slayer longsword marked, ordinary-model finish unmarked, both energy bow designs marked; four widths and real purchase IDs/prices/names preserved.',
  );
} finally {
  await browser.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.end();
}
