import 'dotenv/config';
import { chromium, expect, type Locator } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';

if (!new URL(process.env.DATABASE_URL!).pathname.startsWith('/alvorada_test_'))
  throw new Error('Use banco isolado.');
const origin = 'http://localhost:3002';
process.env.APP_ORIGIN = origin;
process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db.js');
const { migrate } = await import('../server/migrate.js');
const { seed } = await import('../server/seed.js');
const { createLegacyTestCharacter, finishTestArt } = await import('../tests/character-fixtures.js');
await migrate();
await seed();
const { createApp } = await import('../server/app.js');
const server = createApp().listen(3002, '127.0.0.1');
await new Promise<void>((resolve) => server.once('listening', resolve));
const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL || 'msedge',
  headless: true,
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: 'reduce',
});
const errors: string[] = [];
page.on('pageerror', (error) => errors.push(error.message));
let userId = '';
async function dragEquipment(source: Locator, target: Locator) {
  await source.scrollIntoViewIfNeeded();
  await source.hover();
  const start = (await source.boundingBox())!;
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(start.x + start.width / 2 + 15, start.y + start.height / 2, { steps: 5 });
  await target.scrollIntoViewIfNeeded();
  const end = (await target.boundingBox())!;
  await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, { steps: 8 });
  await page.mouse.move(end.x + end.width / 2 + 1, end.y + end.height / 2, { steps: 2 });
  await page.mouse.up();
}
try {
  await page.goto(origin);
  const response = await page.request.post(origin + '/api/auth/sign-up/email', {
    headers: { Origin: origin },
    data: {
      name: 'Teste Equipamento',
      email: `equipment-browser-${randomUUID()}@example.test`,
      password: `Test-${randomUUID()}`,
    },
  });
  expect(response.ok()).toBe(true);
  userId = (await response.json()).user.id;
  const character = await createLegacyTestCharacter(userId, 'Arden');
  if (process.argv.includes('--unlimited')) {
    await pool.query('INSERT INTO character_art_allowances(user_id,unlimited) VALUES($1,true)', [
      userId,
    ]);
    for (let i = 0; i < 3; i++)
      await pool.query(
        "INSERT INTO character_art_jobs(user_id,character_id,idempotency_key,status) VALUES($1,$2,$3,'completed')",
        [userId, character.id, randomUUID()],
      );
  }
  for (const id of ['plate-armor', 'longsword', 'ring-of-protection', 'backpack'])
    await pool.query('INSERT INTO inventory(character_id,item_id,quantity) VALUES($1,$2,1)', [
      character.id,
      id,
    ]);
  await pool.query(
    'INSERT INTO character_art_worker(id,heartbeat_at,available) VALUES(true,now(),true) ON CONFLICT(id) DO UPDATE SET heartbeat_at=now(),available=true',
  );
  await page.goto(origin + '/#inventory');
  await page.reload();
  const equipment = page.getByRole('region', { name: 'Itens equipados', exact: true });
  await expect(equipment).toBeVisible();
  expect(await equipment.evaluate(el => Boolean(el.closest('.loot-pack-column')))).toBe(true);
  await expect(page.locator('.loot-backpack')).toHaveCount(0);
  await expect(equipment.locator('.equipment-note')).toHaveCount(0);
  const bag = page.getByRole('region', { name: 'Itens da mochila', exact: true });
  expect(await equipment.evaluate((el) => getComputedStyle(el).backgroundImage)).toContain('character-parchment-v2.png');
  expect(await equipment.evaluate((el) => getComputedStyle(el).backgroundBlendMode)).toContain('luminosity');
  await dragEquipment(
    bag.getByRole('button', { name: 'Espada longa, quantidade 1', exact: true }),
    equipment.locator('[data-equipment-slot="armor"] .equipment-art'),
  );
  const warning = page
    .getByRole('status')
    .filter({ hasText: 'não pertence à categoria Peitoral / armadura' });
  await expect(warning).toBeVisible();
  await expect(equipment.locator('#equipment-armor')).toHaveValue('');
  await expect(bag.locator('button.loot-slot')).toHaveCount(4);
  await expect(warning).not.toBeVisible({ timeout: 6500 });
  for (const [slot, id] of [
    ['armor', 'plate-armor'],
    ['main_hand', 'longsword'],
    ['ring_left', 'ring-of-protection'],
    ['back', 'backpack'],
  ]) {
    if (slot === 'armor' || slot === 'main_hand') {
      const itemName = slot === 'armor' ? 'Peitoral de placas' : 'Espada longa';
      await dragEquipment(
        bag.getByRole('button', { name: `${itemName}, quantidade 1`, exact: true }),
        equipment.locator(`[data-equipment-slot="${slot}"] .equipment-art`),
      );
    } else {
      await equipment.locator(`[data-equipment-slot="${slot}"] .equipment-slot-trigger`).click();
      await expect(equipment.locator(`#equipment-picker-${slot}`)).toBeVisible();
      await equipment.locator(`#equipment-${slot}`).selectOption(id);
      await expect(equipment.locator(`#equipment-picker-${slot}`)).toBeHidden();
    }
    await expect(equipment.locator(`#equipment-${slot}`)).toBeEnabled();
    await expect(equipment.locator(`#equipment-${slot}`)).toHaveValue(id);
  }
  await expect(equipment.locator('.equipment-art img')).toHaveCount(4);
  await expect(equipment.locator('#equipment-head')).toBeDisabled();
  await expect(
    page.getByRole('region', { name: 'Itens da mochila', exact: true }).locator('button.loot-slot'),
  ).toHaveCount(0);
  await page.reload();
  await expect(equipment.locator('#equipment-armor')).toHaveValue('plate-armor');
  await mkdir('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/equipment-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/equipment-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(equipment.getByRole('button', { name: 'Vestir', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Vestir', exact: true }).click();
  const modal = page.getByRole('dialog');
  await expect(modal.locator('.art-equipment-choice')).toHaveCount(4);
  const sword = modal.locator('.art-equipment-choice').filter({ hasText: 'Espada longa' });
  await sword.getByRole('checkbox').uncheck();
  const reference = await sharp({
    create: { width: 32, height: 48, channels: 4, background: '#778899' },
  })
    .png()
    .toBuffer();
  await modal
    .getByLabel('Imagem de referência', { exact: true })
    .setInputFiles({ name: 'reference.png', mimeType: 'image/png', buffer: reference });
  await expect(modal.getByRole('button', { name: 'Vestir', exact: true })).toBeEnabled();
  await page.screenshot({ path: 'test-results/equipment-generation.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/equipment-generation-mobile.png', fullPage: true });
  const posted = page.waitForResponse(
    (res) => res.url().endsWith('/api/character-art') && res.request().method() === 'POST',
  );
  await modal.getByRole('button', { name: 'Vestir', exact: true }).click();
  const jobResponse = await posted;
  expect(jobResponse.status()).toBe(202);
  expect(jobResponse.request().postDataJSON().equipment_slots.sort()).toEqual([
    'armor',
    'back',
    'ring_left',
  ]);
  const job = await jobResponse.json();
  const snapshots = await pool.query(
    'SELECT slot,image FROM character_art_equipment WHERE job_id=$1 ORDER BY slot',
    [job.id],
  );
  expect(snapshots.rows.map((row) => row.slot)).toEqual(['armor', 'back', 'ring_left']);
  expect(snapshots.rows.every((row) => row.image.length > 100)).toBe(true);
  await expect(equipment.getByRole('button', {name:'Vestindo...',exact:true})).toBeVisible();
  await equipment.evaluate(el => { (window as any).__stableEquipment = el; });
  await pool.query("UPDATE character_art_jobs SET status='running' WHERE id=$1", [job.id]);
  await page.waitForTimeout(4500);
  expect(await equipment.evaluate(el => el === (window as any).__stableEquipment)).toBe(true);
  await finishTestArt(job.id);
  await expect(modal).not.toBeVisible();
  await pool.query("UPDATE character_art_jobs SET status='failed',error=$2 WHERE id=$1", [
    job.id, 'Falha de geração simulada. Sua cota foi preservada.',
  ]);
  await expect(page.getByRole('alert').filter({ hasText: 'Falha de geração simulada' })).toBeVisible({ timeout: 10000 });
  const flash = page.getByRole('alert').filter({ hasText: 'Falha de geração simulada' });
  const bounds = await flash.boundingBox();
  expect(bounds!.y).toBeLessThan(80);
  expect(bounds!.x).toBeGreaterThan(0);
  await expect(flash).toBeHidden({ timeout: 6500 });
  await page.waitForTimeout(5000);
  await expect(flash).toBeHidden();
  expect(await equipment.evaluate(el => el === (window as any).__stableEquipment)).toBe(true);
  await page.reload();
  await expect(page.getByRole('alert').filter({ hasText: 'Falha de geração simulada' })).toBeVisible();
  expect(errors).toEqual([]);
  console.log(
    'Equipamento: persistência, imagens, escolha antes de gerar e desktop/mobile aprovados.',
  );
} catch (error) {
  await mkdir('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/equipment-failure.png', fullPage: true });
  throw error;
} finally {
  await browser.close();
  if (userId) await pool.query('DELETE FROM "user" WHERE id=$1', [userId]);
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.end();
}
