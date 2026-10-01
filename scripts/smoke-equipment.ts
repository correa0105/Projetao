import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
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
  for (const [slot, id] of [
    ['armor', 'plate-armor'],
    ['main_hand', 'longsword'],
    ['ring_left', 'ring-of-protection'],
    ['back', 'backpack'],
  ]) {
    await equipment.locator(`#equipment-${slot}`).selectOption(id);
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
  await page.goto(origin + '/#characters');
  await page.getByRole('button', { name: 'Gerar imagem', exact: true }).click();
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
  await expect(modal.getByRole('button', { name: 'Gerar imagem', exact: true })).toBeEnabled();
  await page.screenshot({ path: 'test-results/equipment-generation.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/equipment-generation-mobile.png', fullPage: true });
  const posted = page.waitForResponse(
    (res) => res.url().endsWith('/api/character-art') && res.request().method() === 'POST',
  );
  await modal.getByRole('button', { name: 'Gerar imagem', exact: true }).click();
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
  await finishTestArt(job.id);
  await expect(modal).not.toBeVisible();
  expect(errors).toEqual([]);
  console.log(
    'Equipamento: persistência, imagens, escolha antes de gerar e desktop/mobile aprovados.',
  );
} finally {
  await browser.close();
  if (userId) await pool.query('DELETE FROM "user" WHERE id=$1', [userId]);
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.end();
}
