import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';
if (!new URL(process.env.DATABASE_URL!).pathname.startsWith('/alvorada_test_'))
  throw new Error('Banco isolado obrigatório.');
const origin = 'http://localhost:3002';
process.env.APP_ORIGIN = origin;
process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db.js');
const { migrate } = await import('../server/migrate.js');
const { seed } = await import('../server/seed.js');
const { createLegacyTestCharacter } = await import('../tests/character-fixtures.js');
await migrate();
await seed();
const { createApp } = await import('../server/app.js');
const server = createApp().listen(3002, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));
const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL || 'msedge',
  headless: true,
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: 'reduce',
});
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
try {
  await mkdir('test-results', { recursive: true });
  await page.goto(origin);
  const signup = await page.request.post(origin + '/api/auth/sign-up/email', {
    headers: { Origin: origin },
    data: {
      name: 'Teste placas',
      email: `plate-${randomUUID()}@example.test`,
      password: `Test-${randomUUID()}`,
    },
  });
  expect(signup.ok()).toBe(true);
  const hero = await createLegacyTestCharacter((await signup.json()).user.id, 'Arden');
  await pool.query('UPDATE characters SET gold_cp=1000000 WHERE id=$1', [hero.id]);
  await page.goto(origin + '/#shop');
  await page.reload();
  await page.getByRole('button', { name: /^Cosméticos/ }).click();
  await expect(page.locator('.shop-product')).toHaveCount(5);
  await expect(page.locator('.shop-product img')).toHaveCount(5);
  await expect
    .poll(() =>
      page
        .locator('.shop-product img')
        .evaluateAll((images) =>
          images.every(
            (image) =>
              (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0,
          ),
        ),
    )
    .toBe(true);
  for (const name of [
    'Capa de viajante',
    'Colar com gema azul',
    'Tiara com gema azul',
    'Luvas de couro',
    'Botas de viagem',
  ])
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  await page
    .locator('.shop-product')
    .filter({ has: page.getByRole('heading', { name: 'Luvas de couro', exact: true }) })
    .getByRole('button', { name: 'Comprar', exact: true })
    .click();
  await page.getByRole('button', { name: /^Armaduras/ }).click();
  const armor = page
    .locator('.shop-product')
    .filter({ has: page.getByRole('heading', { name: 'Armadura de placas', exact: true }) });
  await expect(armor).toContainText('65 lb');
  await expect(armor).toContainText('capacete');
  await armor.getByRole('button', { name: 'Comprar', exact: true }).click();
  await page.getByRole('button', { name: /Abrir carrinho/ }).click();
  const checkout = page.waitForResponse(
    (r) => r.url().endsWith('/api/shop/checkout') && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: /Finalizar compra/ }).click();
  expect((await checkout).status()).toBe(201);
  const extra = await page.request.post(origin + '/api/shop/checkout', {
    headers: { Origin: origin },
    data: {
      character_id: hero.id,
      idempotency_key: randomUUID(),
      items: [
        { item_id: 'torch', quantity: 1 },
        { item_id: 'cigar', quantity: 1 },
      ],
    },
  });
  expect(extra.status()).toBe(201);
  await page.goto(origin + '/#inventory');
  const equipment = page.getByRole('region', { name: 'Itens equipados', exact: true });
  await expect(equipment.locator('.equipment-slot')).toHaveCount(15);
  const legsBox = (await equipment.locator('[data-equipment-slot="legs"]').boundingBox())!;
  const bootsBox = (await equipment.locator('[data-equipment-slot="feet"]').boundingBox())!;
  expect(bootsBox.y).toBeCloseTo(legsBox.y, 0);
  expect(bootsBox.x).toBeGreaterThan(legsBox.x);
  expect(bootsBox.x - legsBox.x).toBeLessThan(legsBox.width + 20);
  for (const [slot, id] of [
    ['armor', 'plate-armor'],
    ['head', 'plate-helmet'],
    ['shoulders', 'plate-pauldrons'],
    ['legs', 'plate-leggings'],
    ['feet', 'plate-boots'],
    ['hands', 'cosmetic-gloves'],
    ['bracers', 'plate-bracers'],
    ['main_hand', 'torch'],
    ['off_hand', 'cigar'],
  ]) {
    const selector = equipment.locator('#equipment-' + slot);
    await expect(selector).toBeEnabled();
    await selector.selectOption(id);
    await expect(selector).toHaveValue(id);
  }
  await expect(equipment.locator('#equipment-hands')).toBeDisabled();
  await expect(equipment.getByText('Inclui as luvas de placas', { exact: true })).toBeVisible();
  await expect(equipment.locator('.equipment-art img')).toHaveCount(8);
  await expect
    .poll(() =>
      equipment
        .locator('.equipment-art img')
        .evaluateAll((imgs) =>
          imgs.every(
            (img) =>
              (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0,
          ),
        ),
    )
    .toBe(true);
  await page.reload();
  await expect(equipment.locator('#equipment-shoulders')).toHaveValue('plate-pauldrons');
  await page.screenshot({ path: 'test-results/plate-equipment-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/plate-equipment-mobile.png', fullPage: true });
  await pool.query(
    'INSERT INTO character_art_worker(id,heartbeat_at,available) VALUES(true,now(),true) ON CONFLICT(id) DO UPDATE SET heartbeat_at=now(),available=true',
  );
  await page.goto(origin + '/#characters');
  await page.getByRole('button', { name: 'Gerar imagem', exact: true }).click();
  const modal = page.getByRole('dialog');
  await expect(modal.locator('.art-equipment-choice')).toHaveCount(8);
  await expect(modal.getByRole('combobox', { name: 'Como usar o capacete' })).toHaveValue('closed');
  await modal.getByRole('combobox', { name: 'Como usar o capacete' }).selectOption('open');
  const reference = await sharp({
    create: { width: 32, height: 48, channels: 4, background: '#778899' },
  })
    .png()
    .toBuffer();
  await modal
    .getByLabel('Imagem de referência', { exact: true })
    .setInputFiles({ name: 'reference.png', mimeType: 'image/png', buffer: reference });
  const posted = page.waitForResponse(
    (r) => r.url().endsWith('/api/character-art') && r.request().method() === 'POST',
  );
  await modal.getByRole('button', { name: 'Gerar imagem', exact: true }).click();
  const jobResponse = await posted;
  expect(jobResponse.status()).toBe(202);
  const job = await jobResponse.json();
  expect(jobResponse.request().postDataJSON().helmet_mode).toBe('open');
  expect(
    (await pool.query('SELECT helmet_mode FROM character_art_jobs WHERE id=$1', [job.id])).rows[0]
      .helmet_mode,
  ).toBe('open');
  const snapshots = await pool.query(
    'SELECT slot,image FROM character_art_equipment WHERE job_id=$1 ORDER BY slot',
    [job.id],
  );
  expect(snapshots.rows.map((r) => r.slot)).toEqual([
    'armor',
    'bracers',
    'feet',
    'head',
    'legs',
    'main_hand',
    'off_hand',
    'shoulders',
  ]);
  expect(snapshots.rows.every((r) => r.image.length > 100)).toBe(true);
  expect(errors).toEqual([]);
  console.log(
    'Placas e cosméticos: compra real, seis peças, 15 espaços, luvas, objetos nas mãos, referências e mobile aprovados.',
  );
} catch (error) {
  await page.screenshot({ path: 'test-results/plate-equipment-failure.png', fullPage: true });
  throw error;
} finally {
  await browser.close();
  await new Promise<void>((r) => server.close(() => r()));
  await pool.end();
}
