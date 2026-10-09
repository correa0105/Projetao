import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID, createHash } from 'node:crypto';
import { readFile, mkdir } from 'node:fs/promises';
import sharp from 'sharp';
import type { Item } from '../src/types';
if (!/^\/alvorada_test_[a-f0-9]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))
  throw Error('Disposable database required');
const origin = 'http://localhost:3049';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db'),
  { migrate } = await import('../server/migrate'),
  { seed } = await import('../server/seed'),
  { createLegacyTestCharacter } = await import('../tests/character-fixtures');
await migrate();
await seed();
const { createApp } = await import('../server/app'),
  server = createApp().listen(3049, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));
const browser = await chromium.launch({ channel: 'msedge', headless: true }),
  context = await browser.newContext({ reducedMotion: 'reduce' }),
  page = await context.newPage(),
  errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
const hash = (b: Buffer) => createHash('sha256').update(b).digest('hex');
try {
  const signup = await context.request.post(origin + '/api/auth/sign-up/email', {
    headers: { Origin: origin },
    data: {
      name: 'Arte do Empório',
      email: randomUUID() + '@example.test',
      password: 'Test-' + randomUUID(),
    },
  });
  expect(signup.status()).toBe(200);
  const user = (await signup.json()).user,
    hero = await createLegacyTestCharacter(user.id, 'Colecionador de arte');
  await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [user.id]);
  await pool.query('UPDATE characters SET gold_cp=200000000 WHERE id=$1', [hero.id]);
  const manifest = JSON.parse(
    await readFile('data/shop-thematic-art-20261009/published-manifest.json', 'utf8'),
  );
  expect(manifest.items).toHaveLength(122);
  const catalog: Item[] = await (await context.request.get(origin + '/api/catalog')).json(),
    seen = new Set<string>();
  for (const entry of manifest.items) {
    const item = catalog.find((i) => i.id === entry.id)!;
    expect(item, entry.id).toBeTruthy();
    expect(item.image_path).toBe(entry.image_path);
    const image = await context.request.get(origin + item.image_path);
    expect(image.status()).toBe(200);
    const bytes = await image.body(),
      meta = await sharp(bytes).metadata();
    expect(hash(bytes)).toBe(entry.sha256);
    expect(meta.hasAlpha).toBe(true);
    expect(meta.width).toBe(meta.height);
    expect((await sharp(bytes).stats()).isOpaque).toBe(false);
    seen.add(hash(bytes));
  }
  expect(seen.size).toBe(122);
  const ids = [
    'potion-of-healing',
    'potion-of-healing-greater',
    'potion-of-healing-superior',
    'potion-of-healing-supreme',
    'ring-of-elemental-command-earth',
    'potion-of-resistance-cold',
  ];
  const ammo = catalog.find(
    (i) => i.id.includes('ammunition-of-slaying-bolts') && i.id.endsWith('-fiends'),
  )!;
  ids.push(ammo.id);
  const purchased = ids.map((id) => catalog.find((i) => i.id === id)!);
  const edit = await context.request.patch(origin + '/api/catalog/potion-of-healing/price', {
    headers: { Origin: origin },
    data: { price_cp: 4321 },
  });
  expect(edit.status()).toBe(200);
  await seed();
  const current: Item[] = await (await context.request.get(origin + '/api/catalog')).json();
  for (const old of catalog) {
    const item = current.find((i) => i.id === old.id)!;
    expect(item).toEqual(old.id === 'potion-of-healing' ? { ...old, price_cp: 4321 } : old);
  }
  await pool.query('UPDATE "user" SET administrador=0 WHERE id=$1', [user.id]);
  await context.addInitScript(() => {
    localStorage.setItem('alvorada-music-muted', 'true');
    localStorage.setItem('alvorada-effects-muted', 'true');
  });
  await mkdir('test-results', { recursive: true });
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 950 });
    await page.goto(origin + '/#shop');
    for (const query of [
      'de cura',
      'Poção de resistência',
      'Poção de força de gigante',
      'Anel de comando elemental',
      'Virotes contra',
    ]) {
      await page.getByLabel('Procurar item', { exact: true }).fill(query);
      const cards = page.locator(
        query === 'de cura' ? '.shop-product[data-item-id^="potion-of-healing"]' : '.shop-product',
      );
      await expect(cards.first()).toBeVisible();
      if (query === 'de cura') await expect(cards).toHaveCount(4);
      const paths = await cards
        .locator('.shop-product-art img')
        .evaluateAll((imgs) => imgs.map((i) => (i as HTMLImageElement).getAttribute('src')));
      expect(paths.every((p) => p?.startsWith('/shop/thematic-20261009/'))).toBe(true);
      expect(new Set(paths).size).toBe(paths.length);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width + 1,
      );
      await page.screenshot({
        path: `test-results/shop-distinct-${query.replace(/[^a-z]/gi, '-')}-${width}.png`,
      });
    }
  }
  await page.setViewportSize({ width: 1440, height: 950 });
  for (const item of purchased) {
    await page.getByLabel('Procurar item', { exact: true }).fill(item.name);
    const card = page.locator('.shop-product[data-item-id="' + item.id + '"]');
    await expect(card).toBeVisible();
    await expect(card.locator('.shop-product-art img')).toHaveAttribute('src', item.image_path!);
    await card.getByRole('button', { name: 'Comprar', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Abrir carrinho: 7 itens', exact: true }).click();
  const checkout = page.getByRole('dialog', { name: 'Seu carrinho', exact: true });
  await checkout.getByRole('button', { name: /Finalizar compra/ }).click();
  await expect(checkout).toHaveCount(0);
  const ledger = (
    await pool.query(
      'SELECT item_id,quantity,total_cp FROM purchases WHERE character_id=$1 ORDER BY item_id',
      [hero.id],
    )
  ).rows;
  const expected = purchased
    .map((i) => ({
      item_id: i.id,
      quantity: 1,
      total_cp: i.id === 'potion-of-healing' ? 4321 : i.price_cp,
    }))
    .sort((a, b) => a.item_id.localeCompare(b.item_id));
  expect(ledger).toEqual(expected);
  expect(
    (await pool.query('SELECT gold_cp FROM characters WHERE id=$1', [hero.id])).rows[0].gold_cp,
  ).toBe(200000000 - expected.reduce((s, i) => s + i.total_cp!, 0));
  expect(
    (
      await pool.query(
        'SELECT item_id,quantity FROM inventory WHERE character_id=$1 ORDER BY item_id',
        [hero.id],
      )
    ).rows,
  ).toEqual(expected.map((i) => ({ item_id: i.item_id, quantity: i.quantity })));
  expect(errors).toEqual([]);
  console.log(
    'PASS all 122 native transparent images served, unique and attached to the correct IDs; repeated seed preserves prices and overrides; five families in three widths; real checkout preserves item IDs, prices, quantities and ledger.',
  );
} finally {
  await context.close();
  await browser.close();
  await new Promise<void>((r) => server.close(() => r()));
  await pool.end();
}
