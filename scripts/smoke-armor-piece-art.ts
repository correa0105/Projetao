import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { cards } from '../shared/cards';
import { armorPieceImage } from '../shared/armor-piece-art';
if (!/^\/alvorada_test_[0-9a-f]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname)) throw Error('Banco descartável obrigatório.');
const origin = 'http://localhost:3056';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db');
const { migrate } = await import('../server/migrate');
const { seed } = await import('../server/seed');
const { createLegacyTestCharacter } = await import('../tests/character-fixtures');
await migrate(); await seed();
const { createApp } = await import('../server/app');
const environment = process.env.NODE_ENV; process.env.NODE_ENV = 'production';
const server = createApp().listen(3056, '127.0.0.1'); process.env.NODE_ENV = environment;
await new Promise<void>(resolve => server.once('listening', resolve));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 1898, height: 1000 }, reducedMotion: 'reduce' });
const page = await context.newPage(), errors: string[] = [];
page.on('pageerror', error => errors.push(error.message));
await context.addInitScript(() => { localStorage.setItem('alvorada-music-muted', 'true'); localStorage.setItem('alvorada-effects-muted', 'true'); });
await mkdir('test-results/armor-pieces', { recursive: true });
async function request(path: string, data?: unknown) {
 const response = await context.request.fetch(origin + '/api' + path, { method: data ? 'POST' : 'GET', headers: { Origin: origin }, data });
 expect(response.ok(), await response.text()).toBe(true); return response.json();
}
try {
 const account = (await request('/auth/sign-up/email', { name: 'Artes de armadura', email: randomUUID() + '@example.test', password: 'Test-' + randomUUID() })).user;
 const hero = await createLegacyTestCharacter(account.id, 'Nana');
 await pool.query('UPDATE characters SET gold_cp=90000000 WHERE id=$1', [hero.id]);
 await request('/cards/purchase', { character_id: hero.id, card_id: cards[0].id, idempotency_key: randomUUID() });
 for (const width of [1898,1440,768,390,320]) {
  await page.setViewportSize({ width, height: 1000 }); await page.goto(origin + '/#cards');
  const host = page.getByRole('button', { name: 'Conversar com o Anfitrião', exact: true });
  await expect(host).toBeVisible(); expect(await host.innerText()).toBe('');
  await expect(page.locator('.cards-host-silhouette path')).toBeVisible();
  const box = await page.locator('.cards-host-silhouette').boundingBox(); expect(box).not.toBeNull();
  await page.mouse.click(box!.x + 1295 * box!.width / 1672, box!.y + 315 * box!.height / 941);
  await expect(page.getByRole('complementary', { name: 'Conversa com o Anfitrião' })).toBeVisible();
  await page.keyboard.press('Escape'); await host.focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('complementary', { name: 'Conversa com o Anfitrião' })).toBeVisible();
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: `test-results/armor-pieces/salon-${width}.png`, fullPage: width <= 650 });
 }
 await page.setViewportSize({ width: 1898, height: 1000 }); await page.goto(origin + '/#profiles');
 await page.getByLabel('Localizador de perfil').fill('Artes de armadura');
 await page.locator('.profile-directory article').filter({ hasText: 'Artes de armadura' }).getByRole('button', { name: 'Visitar perfil' }).click();
 const next = page.locator('.profile-next-arrow:not(.profile-previous-arrow)');
 await expect(next).toBeVisible(); await next.focus(); await page.keyboard.press('End');
 const panel = page.locator('#profile-panel-cards'); await expect(panel).toBeVisible();
 expect(await panel.evaluate(element => getComputedStyle(element).backgroundImage)).toContain('private-archive-20261012.webp');
 for (const width of [1898,768,390,320]) {
  await page.setViewportSize({ width, height: 1000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: `test-results/armor-pieces/profile-cards-${width}.png`, fullPage: true });
 }
 if (!process.argv.includes('--ui-only')) {
  await request('/shop/checkout', { character_id: hero.id, idempotency_key: randomUUID(), items: ['hide-armor','leather-armor','magic-armor','pet-armor-chain'].map(item_id => ({ item_id, quantity: 1 })) });
  await page.setViewportSize({ width: 1898, height: 1000 }); await page.goto(origin + '/#inventory');
  await expect(page.locator('.loot-item-art').first()).toBeVisible();
  for (const parent of ['hide-armor','leather-armor','magic-armor','pet-armor-chain']) for (const slot of ['head','bracers','legs','feet','shoulders'] as const) {
   const image = armorPieceImage(parent, slot)!;
   await expect(async () => {
    const loaded = await page.locator(`img[src="${image}"]`).evaluateAll(elements => elements.some(element => (element as HTMLImageElement).complete && (element as HTMLImageElement).naturalWidth > 0)); expect(loaded, image).toBe(true);
   }).toPass();
  }
  await page.screenshot({ path: 'test-results/armor-pieces/inventory.png', fullPage: true });
  await request('/inventory/equipment-set', { character_id: hero.id, item_id: 'hide-armor' });
  await page.reload(); await page.screenshot({ path: 'test-results/armor-pieces/equipped-hide.png', fullPage: true });
 }
 expect(errors).toEqual([]);
 await writeFile('test-results/armor-pieces/result.json', JSON.stringify({ passed: true, salonWidths: 5, profileWidths: 4, silhouetteClick: true, keyboardConversation: true, textButtonRemoved: true, inventory: !process.argv.includes('--ui-only'), errors }));
} finally { await browser.close(); await new Promise<void>(resolve => server.close(() => resolve())); await pool.end(); }
