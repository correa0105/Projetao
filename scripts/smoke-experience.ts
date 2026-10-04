import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
if (!new URL(process.env.DATABASE_URL!).pathname.startsWith('/alvorada_test_'))
  throw new Error('Banco descartável obrigatório.');
const origin = 'http://localhost:3002';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db.js');
const { migrate } = await import('../server/migrate.js');
const { seed } = await import('../server/seed.js');
const { createLegacyTestCharacter } = await import('../tests/character-fixtures.js');
await migrate();
await seed();
const { createApp } = await import('../server/app.js');
const server = createApp().listen(3002, '127.0.0.1');
await new Promise<void>((resolve) => server.once('listening', resolve));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage(),
  errors: string[] = [];
page.on('pageerror', (error) => errors.push(error.message));
try {
  const signup = await context.request.post(origin + '/api/auth/sign-up/email', {
    headers: { Origin: origin },
    data: {
      name: 'Administrador',
      email: `experience-${randomUUID()}@example.test`,
      password: `Test-${randomUUID()}`,
    },
  });
  expect(signup.ok()).toBe(true);
  const owner = (await signup.json()).user;
  await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [owner.id]);
  const a = await createLegacyTestCharacter(owner.id, 'Arden'),
    b = await createLegacyTestCharacter(owner.id, 'Mira');
  await pool.query('UPDATE characters SET gold_cp=100000 WHERE id=ANY($1::uuid[])', [[a.id, b.id]]);
  async function purchase(characterId: string, mount: string, name: string) {
    const response = await context.request.post(origin + '/api/stable/purchase', {
      headers: { Origin: origin },
      data: {
        character_id: characterId,
        mount_id: mount,
        coat: 'original',
        name,
        equipment: [],
        idempotency_key: randomUUID(),
      },
    });
    expect(response.status()).toBe(201);
    return (await response.json()).mount;
  }
  const first = await purchase(a.id, 'riding-horse', 'Brasa'),
    second = await purchase(a.id, 'pony', 'Pé de Pano'),
    third = await purchase(b.id, 'mule', 'Cinza');
  await page.goto(origin + '/#characters');
  await page.getByRole('button', { name: 'Selecionar Arden', exact: true }).click();
  await expect(page.locator('.camp-mount')).toHaveAttribute('data-mount-id', first.id);
  await expect
    .poll(() =>
      page
        .locator('.camp-mount img')
        .evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0),
    )
    .toBe(true);
  await expect
    .poll(() =>
      page.locator('.camp-mount').evaluate((element) => Number(getComputedStyle(element).opacity)),
    )
    .toBe(1);
  await mkdir('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/camp-mount-desktop.png' });
  await page.getByRole('button', { name: 'Selecionar Mira', exact: true }).click();
  await expect(page.locator('.camp-mount')).toHaveAttribute('data-mount-id', third.id);
  await page.getByRole('button', { name: 'Selecionar Arden', exact: true }).click();
  await expect(page.locator('.camp-mount')).toHaveAttribute('data-mount-id', first.id);
  await page.goto(origin + '/#inventory');
  const chosen = page.getByRole('button', {
    name: 'Mostrar Pé de Pano no acampamento',
    exact: true,
  });
  await expect(chosen).toBeVisible();
  await chosen.click();
  await expect(chosen).toHaveAttribute('aria-pressed', 'true');
  await page.screenshot({ path: 'test-results/inventory-mount-choice.png', fullPage: true });
  await page.goto(origin + '/#characters');
  await expect(page.locator('.camp-mount')).toHaveAttribute('data-mount-id', second.id);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/camp-mount-mobile.png' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(origin + '/#lore');
  await expect(page.locator('.lore-era')).toHaveCount(6);
  await expect(page.locator('.lore-era[data-revealed="true"]')).toHaveCount(1);
  await expect(page.locator('.page-header h1')).toHaveCount(0);
  expect((await page.locator('.lore-hero').boundingBox())!.y).toBe(0);
  await page.locator('.lore-timeline').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/lore-eras-default.png' });
  await page.getByRole('button', { name: 'Editar eras', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Editar linha do tempo', exact: true });
  await editor.getByRole('button', { name: '1. Indefinido', exact: true }).click();
  await editor.getByLabel('Título da era', { exact: true }).fill('Era dos segredos');
  await editor
    .locator('.lore-era-folder-options label')
    .filter({ hasText: 'Reino do Norte · História' })
    .locator('input')
    .check();
  await editor.getByRole('button', { name: 'Salvar eras', exact: true }).click();
  await expect(editor).not.toBeVisible();
  await page.locator('[data-folder-choice]').filter({ hasText: 'História' }).click();
  await expect(page.locator('.lore-timeline')).toHaveAttribute('data-phase', 'travelling');
  await expect(page.locator('.lore-timeline')).toHaveAttribute('data-phase', 'arriving');
  await expect(page.locator('.lore-era').first()).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.lore-timeline')).toHaveAttribute('data-phase', 'idle');
  await page.locator('.lore-era').first().click();
  await expect(page.locator('.lore-timeline')).toHaveAttribute('data-phase', 'arriving');
  await expect(page.locator('.lore-timeline')).toHaveAttribute('data-phase', 'idle');
  await page.screenshot({ path: 'test-results/lore-era-linked-folder.png' });
  await page
    .locator('.lore-scroll-symbol')
    .first()
    .screenshot({ path: 'test-results/lore-scroll-refined.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('.lore-timeline').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/lore-eras-mobile.png' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await pool.query('UPDATE "user" SET administrador=0 WHERE id=$1', [owner.id]);
  await page.reload();
  await expect(page.locator('.lore-era')).toHaveCount(6);
  await expect(page.getByRole('button', { name: 'Editar eras', exact: true })).toHaveCount(0);
  await expect(page.locator('.lore-page-edit')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Nova crônica', exact: true })).toHaveCount(0);
  await page.goto(origin + '/#overview');
  await expect(page.getByRole('heading', { name: 'O Diário da Alvorada' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Nova publicação', exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
  console.log(
    'Eras vinculadas, finalização sem retrocesso, administrador, montaria por personagem e inventário verificados em desktop e celular.',
  );
} catch (error) {
  await page.screenshot({ path: 'test-results/experience-failure.png', fullPage: true });
  throw error;
} finally {
  await browser.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.end();
}
