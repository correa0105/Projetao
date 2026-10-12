import 'dotenv/config';
import { chromium, expect, type BrowserContext, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { purchaseContents } from '../shared/armor-bundles.js';

if (!/^\/alvorada_test_[0-9a-f]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))
  throw Error('Banco descartável obrigatório.');
const origin = 'http://localhost:3057';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db.js');
const { migrate } = await import('../server/migrate.js');
const { seed } = await import('../server/seed.js');
const { createLegacyTestCharacter } = await import('../tests/character-fixtures.js');
await migrate(); await seed();
const { createApp } = await import('../server/app.js');
const environment = process.env.NODE_ENV; process.env.NODE_ENV = 'production';
const server = createApp().listen(3057, '127.0.0.1'); process.env.NODE_ENV = environment;
await new Promise<void>(resolve => server.once('listening', resolve));
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
const fallback = await browser.newContext({ viewport: { width: 390, height: 1000 }, reducedMotion: 'reduce' });
const page = await context.newPage(), spare = await fallback.newPage(), errors: string[] = [];
for (const current of [page, spare]) current.on('pageerror', error => errors.push(error.message));
for (const current of [context, fallback]) await current.addInitScript(() => {
  localStorage.setItem('alvorada-music-muted', 'true'); localStorage.setItem('alvorada-effects-muted', 'true');
});
await mkdir('test-results/companion-delivery', { recursive: true });
async function request(client: BrowserContext, path: string, data?: unknown, method?: string) {
  const response = await client.request.fetch(origin + '/api' + path, {
    method: method || (data ? 'POST' : 'GET'), headers: { Origin: origin }, data,
  });
  expect(response.ok(), await response.text()).toBe(true); return response.json();
}
async function hero(client: BrowserContext, name: string) {
  const account = (await request(client, '/auth/sign-up/email', { name, email: randomUUID() + '@example.test', password: 'Test-' + randomUUID() })).user;
  const result = await createLegacyTestCharacter(account.id, name);
  await pool.query('UPDATE characters SET gold_cp=9000000 WHERE id=$1', [result.id]); return result;
}
async function add(current: Page, id: string, name: string) {
  await current.getByLabel('Procurar item').fill(name);
  const product = current.locator(`[data-item-id="${id}"]`);
  await expect(product).toBeVisible(); await product.getByRole('button', { name: 'Comprar', exact: true }).click();
}
async function purchase(current: Page) {
  const [response] = await Promise.all([
    current.waitForResponse(response => new URL(response.url()).pathname === '/api/shop/checkout' && response.request().method() === 'POST'),
    current.getByRole('button', { name: /^Finalizar compra/ }).click(),
  ]);
  expect(response.status(), await response.text()).toBe(201);
  await expect(current.getByRole('dialog', { name: 'Seu carrinho' })).toHaveCount(0);
  return response.request().postDataJSON();
}
try {
  const owner = await hero(context, 'Guardião'), alone = await hero(fallback, 'Viajante');
  const pet = async (name: string) => (await request(context, '/pets/purchase', { character_id: owner.id, pet_id: 'dog', name, idempotency_key: randomUUID() })).pet;
  const mount = async (name: string) => (await request(context, '/stable/purchase', { character_id: owner.id, mount_id: 'warhorse', name, equipment: [], idempotency_key: randomUUID() })).mount;
  const dog = await pet('Pingo'), otherDog = await pet('Lua'), horse = await mount('Brasa'), otherHorse = await mount('Farol');
  await request(context, `/pets/${owner.id}/display`, { pet_id: otherDog.id }, 'PUT');
  await request(context, `/stable/${owner.id}/display`, { mount_id: otherHorse.id }, 'PUT');
  const rows = (await pool.query("SELECT id,name FROM catalog_items WHERE id=ANY($1::text[])", [['pet-armor-chain', 'saddle-riding', 'leather-armor']])).rows;
  const names = new Map<string, string>(rows.map(row => [row.id, row.name]));
  await page.goto(origin + '/#shop');
  await page.getByRole('navigation', { name: 'Categorias da loja' }).getByRole('button', { name: /^Todos/ }).click();
  for (const id of ['pet-armor-chain', 'saddle-riding', 'leather-armor']) await add(page, id, names.get(id)!);
  await page.locator('.shop-cart-toggle').click();
  const petDestination = page.getByLabel(`Destino de ${names.get('pet-armor-chain')}`), mountDestination = page.getByLabel(`Destino de ${names.get('saddle-riding')}`);
  await expect(petDestination).toHaveValue(otherDog.id); await expect(mountDestination).toHaveValue(otherHorse.id);
  await expect(page.locator('.shop-checkout-line select')).toHaveCount(2);
  await petDestination.selectOption(dog.id);
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    const bounds = await petDestination.boundingBox(); expect(bounds!.x).toBeGreaterThanOrEqual(0); expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1);
    await page.screenshot({ path: `test-results/companion-delivery/cart-${width}.png`, fullPage: true });
  }
  const sent = await purchase(page);
  expect(sent.items.find((line: any) => line.item_id === 'pet-armor-chain').companion_id).toBe(dog.id);
  const allocation = await pool.query('SELECT wardrobe_id,item_id,quantity FROM companion_inventory WHERE character_id=$1 ORDER BY item_id', [owner.id]);
  expect(allocation.rows.filter(row => row.wardrobe_id === dog.id).map(row => row.item_id).sort()).toEqual(purchaseContents('pet-armor-chain').sort());
  expect(allocation.rows.filter(row => row.wardrobe_id === otherHorse.id)).toEqual([{ wardrobe_id: otherHorse.id, item_id: 'saddle-riding', quantity: 1 }]);
  expect(allocation.rows.some(row => row.wardrobe_id === otherDog.id || row.wardrobe_id === horse.id)).toBe(false);
  await page.setViewportSize({ width: 1440, height: 1000 }); await page.goto(origin + '/#inventory');
  const bag = page.getByRole('region', { name: 'Itens da mochila', exact: true }), subjects = page.getByRole('navigation', { name: 'Configurar equipamentos de' });
  await expect(bag.locator('.loot-slot:not(.loot-slot-empty)')).toHaveCount(6);
  await expect(bag.getByText(names.get('saddle-riding')!, { exact: true })).toHaveCount(0);
  await subjects.getByRole('button', { name: 'Mascote', exact: true }).click();
  await page.locator('.companion-equipment-choice select').selectOption(dog.id);
  await expect(bag.locator('.loot-slot:not(.loot-slot-empty)')).toHaveCount(6);
  await expect(bag.locator('h2')).toContainText('Pingo');
  await expect(async () => expect(await bag.locator('img').evaluateAll(images => images.every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true)).toPass();
  await page.screenshot({ path: 'test-results/companion-delivery/pet-bag.png', fullPage: true });
  await page.locator('.companion-equipment-choice select').selectOption(otherDog.id);
  await expect(bag.locator('.loot-slot:not(.loot-slot-empty)')).toHaveCount(0);
  await subjects.getByRole('button', { name: 'Montaria', exact: true }).click();
  await page.locator('.companion-equipment-choice select').selectOption(otherHorse.id);
  await expect(bag.locator('.loot-slot-name').filter({ hasText: names.get('saddle-riding')! })).toBeVisible();
  await page.screenshot({ path: 'test-results/companion-delivery/mount-bag.png', fullPage: true });
  await page.locator('.companion-equipment-choice select').selectOption(horse.id);
  await expect(bag.locator('.loot-slot:not(.loot-slot-empty)')).toHaveCount(0);
  await spare.goto(origin + '/#shop');
  await spare.getByRole('navigation', { name: 'Categorias da loja' }).getByRole('button', { name: /^Todos/ }).click();
  for (const id of ['pet-armor-chain', 'saddle-riding']) await add(spare, id, names.get(id)!);
  await spare.locator('.shop-cart-toggle').click();
  await expect(spare.getByText('Sem mascote: ficará na mochila de Viajante.', { exact: true })).toBeVisible();
  await expect(spare.getByText('Sem montaria: ficará na mochila de Viajante.', { exact: true })).toBeVisible();
  await spare.screenshot({ path: 'test-results/companion-delivery/no-animal-cart.png', fullPage: true });
  await purchase(spare); await spare.goto(origin + '/#inventory');
  const fallbackBag = spare.getByRole('region', { name: 'Itens da mochila', exact: true });
  await expect(fallbackBag.locator('.loot-slot:not(.loot-slot-empty)')).toHaveCount(7);
  expect((await pool.query('SELECT count(*)::int n FROM companion_inventory WHERE character_id=$1', [alone.id])).rows[0].n).toBe(0);
  expect(errors).toEqual([]);
  await writeFile('test-results/companion-delivery/result.json', JSON.stringify({ passed: true, cartWidths: 3, displayedDefault: true, explicitChoice: true, separateBags: true, completeSet: true, fallbackBackpack: true, productionCsp: true, errors }));
} catch (error) {
  await page.screenshot({ path: 'test-results/companion-delivery/failure.png', fullPage: true }); throw error;
} finally { await browser.close(); await new Promise<void>(resolve => server.close(() => resolve())); await pool.end(); }
