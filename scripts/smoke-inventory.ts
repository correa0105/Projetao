import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';

if (!new URL(process.env.DATABASE_URL!).pathname.startsWith('/alvorada_test_'))
  throw new Error('Use banco isolado alvorada_test_* para testar o cofre.');
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
  viewport: { width: 1440, height: 1600 },
  reducedMotion: 'reduce',
});
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
let userId = '';
try {
  await page.goto(origin);
  const response = await page.request.post(origin + '/api/auth/sign-up/email', {
    headers: { Origin: origin },
    data: {
      name: 'Teste Cofre',
      email: `vault-browser-${randomUUID()}@example.test`,
      password: `Test-${randomUUID()}`,
    },
  });
  expect(response.ok()).toBe(true);
  userId = (await response.json()).user.id;
  const first = await createLegacyTestCharacter(userId, 'Arden');
  const second = await createLegacyTestCharacter(userId, 'Mira');
  const {
    rows: [item],
  } = await pool.query("SELECT * FROM catalog_items WHERE name='Espada longa' LIMIT 1");
  await pool.query('INSERT INTO inventory(character_id,item_id,quantity) VALUES($1,$2,3)', [
    first.id,
    item.id,
  ]);
  await page.goto(origin + '/#inventory');
  await page.reload();
  await page.getByRole('button', { name: /^Abrir menu de/ }).click();
  await page.getByRole('option', { name: 'Arden', exact: true }).click();
  const bag = page.getByRole('region', { name: 'Itens da mochila', exact: true });
  const vault = page.getByRole('region', { name: 'Itens do cofre', exact: true });
  await expect(bag.locator('.loot-quantity')).toHaveText('3');
  await expect(vault.locator('.loot-slot-empty')).toHaveCount(36);
  await expect(bag.locator('.loot-slot')).toHaveCount(42);
  const slotBox = (await bag.locator('.loot-slot-empty').first().boundingBox())!;
  expect(Math.abs(slotBox.width - slotBox.height)).toBeLessThan(1);
  await bag.locator('button.loot-slot').hover();
  await expect(page.getByRole('dialog', { name: 'Detalhes de Espada longa' })).toBeVisible();
  await page.keyboard.press('Escape');
  await bag
    .getByRole('button', { name: 'Espada longa, quantidade 3', exact: true })
    .dragTo(vault.locator('.loot-slot-empty').first());

  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(bag.locator('button.loot-slot')).toHaveCount(0);
  await expect(vault.locator('.loot-quantity')).toHaveText('3');
  // Keep a native drag active while scrolling from the lower chest back to the bag.
  await page.setViewportSize({ width: 1440, height: 1000 });
  const source = vault.locator('button.loot-slot').first();
  const target = bag.locator('.loot-slot-empty').first();
  await source.scrollIntoViewIfNeeded();
  await source.hover();
  const sourceBox = (await source.boundingBox())!;
  await page.keyboard.down('Shift');
  await page.mouse.down();
  await page.mouse.move(
    sourceBox.x + sourceBox.width / 2 + 15,
    sourceBox.y + sourceBox.height / 2,
    { steps: 5 },
  );
  await target.scrollIntoViewIfNeeded();
  const targetBox = (await target.boundingBox())!;
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, {
    steps: 8,
  });
  await page.mouse.up();
  await page.keyboard.up('Shift');
  await expect(bag.locator('.loot-quantity')).toHaveText('1');
  await expect(vault.locator('.loot-quantity')).toHaveText('2');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.reload();
  await expect(vault.locator('.loot-quantity')).toHaveText('2');
  await page.getByRole('button', { name: /^Abrir menu de/ }).click();
  await page.getByRole('option', { name: 'Mira', exact: true }).click();
  await expect(bag.locator('button.loot-slot')).toHaveCount(0);
  await expect(vault.locator('.loot-quantity')).toHaveText('2');
  await vault.locator('button.loot-slot').scrollIntoViewIfNeeded();
  await page.waitForTimeout(150);
  await vault.locator('button.loot-slot').click();
  await page
    .getByRole('button', { name: 'Levar para a mochila', exact: true })
    .click({ modifiers: ['Shift'] });
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(bag.locator('.loot-quantity')).toHaveText('1');
  await expect(vault.locator('.loot-quantity')).toHaveText('1');
  const stored = await pool.query(
    'SELECT quantity FROM inventory WHERE character_id=$1 AND item_id=$2',
    [second.id, item.id],
  );
  expect(stored.rows[0].quantity).toBe(1);
  await mkdir('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/vault-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await bag.locator('button.loot-slot').scrollIntoViewIfNeeded();
  await page.waitForTimeout(150);
  await bag.locator('button.loot-slot').click();
  await bag.getByRole('button', { name: 'Guardar no cofre', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(vault.locator('.loot-quantity')).toHaveText('2');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/vault-mobile.png', fullPage: true });
  for (const width of [1440, 768, 390, 320]) {
    await pool.query(
      'INSERT INTO inventory(character_id,item_id,quantity) VALUES($1,$2,3) ON CONFLICT(character_id,item_id) DO UPDATE SET quantity=3',
      [second.id, item.id],
    );
    await pool.query(
      'INSERT INTO account_vault(user_id,item_id,quantity) VALUES($1,$2,2) ON CONFLICT(user_id,item_id) DO UPDATE SET quantity=2',
      [userId, item.id],
    );
    await page.setViewportSize({ width, height: 1000 });
    await page.reload();
    await page.getByRole('button', { name: /^Abrir menu de/ }).click();
    await page.getByRole('option', { name: 'Mira', exact: true }).click();
    await expect(bag.locator('.loot-quantity')).toHaveText('3');
    async function openRemoval(region: typeof bag) {
      const slot = region.locator('button.loot-slot');
      await slot.scrollIntoViewIfNeeded();
      await slot.click();
      await page
        .getByRole('dialog', { name: 'Detalhes de Espada longa', exact: true })
        .getByRole('button', { name: 'Excluir item', exact: true })
        .click();
      return page.getByRole('dialog', { name: 'Excluir item', exact: true });
    }
    let dialog = await openRemoval(bag);
    await expect(dialog.getByLabel('Quantidade a excluir')).toHaveValue('1');
    await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await expect(bag.locator('.loot-quantity')).toHaveText('3');
    dialog = await openRemoval(bag);
    const quantity = dialog.getByLabel('Quantidade a excluir');
    await quantity.fill('4');
    expect(await quantity.evaluate((el) => (el as HTMLInputElement).checkValidity())).toBe(false);
    await quantity.fill('2');
    await dialog.screenshot({ path: 'test-results/inventory-delete-modal-' + width + '.png' });
    await dialog.getByRole('button', { name: 'Excluir', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(bag.locator('.loot-quantity')).toHaveText('1');
    await expect(vault.locator('.loot-quantity')).toHaveText('2');
    dialog = await openRemoval(bag);
    await dialog.getByRole('button', { name: 'Excluir', exact: true }).click();
    await expect(bag.locator('button.loot-slot')).toHaveCount(0);
    dialog = await openRemoval(vault);
    await dialog.getByRole('button', { name: 'Excluir', exact: true }).click();
    await expect(vault.locator('.loot-quantity')).toHaveText('1');
    await page.reload();
    await page.getByRole('button', { name: /^Abrir menu de/ }).click();
    await page.getByRole('option', { name: 'Mira', exact: true }).click();
    await expect(bag.locator('button.loot-slot')).toHaveCount(0);
    await expect(vault.locator('.loot-quantity')).toHaveText('1');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
  }
  expect(errors).toEqual([]);
  console.log(
    'Inventário no navegador: transferências, exclusão parcial/total de mochila e cofre, cancelar, quantidade máxima, persistência e 1440/768/390/320 OK.',
  );
} catch (error) {
  await mkdir('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/vault-failure.png', fullPage: true });
  throw error;
} finally {
  await browser.close();
  if (userId) await pool.query('DELETE FROM "user" WHERE id=$1', [userId]);
  await new Promise<void>((r) => server.close(() => r()));
  await pool.end();
}
