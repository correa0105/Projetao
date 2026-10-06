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
  await pool.query(
    "INSERT INTO achievements(character_id,code) VALUES($1,'first_character') ON CONFLICT DO NOTHING",
    [a.id],
  );
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
  const first = await purchase(a.id, 'warhorse', 'Brasa'),
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
  await expect(page.locator('.inventory-mounts')).toHaveCount(1);
  const chosen = page.getByRole('button', {
    name: 'Mostrar Pé de Pano no acampamento',
    exact: true,
  });
  await expect(chosen).toBeVisible();
  await chosen.click();
  await expect(chosen).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.inventory-mounts')).toHaveCount(1);
  await page.screenshot({ path: 'test-results/inventory-mount-choice.png', fullPage: true });
  await page.goto(origin + '/#characters');
  await expect(page.locator('.camp-mount')).toHaveAttribute('data-mount-id', second.id);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() => page.locator('.camp-mount').evaluate((el) => Number(getComputedStyle(el).opacity)))
    .toBe(1);
  const desktopHorseHeight = await page
    .locator('.camp-mount img')
    .evaluate((el) => el.getBoundingClientRect().height);
  expect(desktopHorseHeight).toBeGreaterThan(80);
  await page.screenshot({ path: 'test-results/camp-mount-mobile.png' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(origin + '/#achievements');
  const titleState = await (await context.request.get(origin + '/api/titles/' + a.id)).json();
  const firstTitle = titleState.items.find((item: { earned: boolean }) => item.earned);
  expect(firstTitle).toBeTruthy();
  expect(
    (
      await context.request.put(origin + '/api/titles/' + a.id + '/display', {
        headers: { Origin: origin },
        data: { title_id: firstTitle.id },
      })
    ).ok(),
  ).toBe(true);
  await page.reload();
  await page.getByLabel('Posição do título', { exact: true }).selectOption('beside');
  await expect(page.getByLabel('Posição do título', { exact: true })).toBeEnabled();
  await page.locator('.cabinet-room-stage').scrollIntoViewIfNeeded();
  await expect(page.locator('.antique-portrait')).toHaveCount(4);
  await page.screenshot({ path: 'test-results/portraits-wall-desktop.png' });
  await page.goto(origin + '/#characters');
  await expect(
    page.locator('.camp-character').filter({ hasText: 'Arden' }).locator('.character-title-label'),
  ).toHaveAttribute('data-title-position', 'beside');
  await page.reload();
  await expect(page.locator('.character-title-label[data-title-position="beside"]')).toHaveCount(1);
  await page.screenshot({ path: 'test-results/camp-title-beside-desktop.png' });
  await page.goto(origin + '/#profiles?user=' + owner.id + '&character=' + a.id);
  await expect(page.locator('.public-camp-name')).toHaveAttribute('data-title-position', 'beside');
  await expect(page.locator('.public-character-title')).toHaveText(firstTitle.name);
  await page
    .locator('.profile-visit-nav')
    .getByRole('button', { name: 'Conquistas', exact: true })
    .click();
  await expect(page.locator('.public-achievements')).toHaveAttribute('aria-hidden', 'false');
  await expect(page.locator('.antique-portrait')).toHaveCount(4);
  await expect
    .poll(() =>
      page
        .locator('.profile-panels-strip')
        .evaluate((el) => el.getAnimations().every((a) => a.playState !== 'running')),
    )
    .toBe(true);
  await page.screenshot({ path: 'test-results/public-portraits-wall-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/public-portraits-wall-mobile.png' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto(origin + '/#achievements');
  await page.locator('.cabinet-room-stage').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/portraits-wall-mobile.png' });
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
  await expect
    .poll(() =>
      page.locator('.lore-era-light').evaluate((element) => element.getBoundingClientRect().width),
    )
    .toBeGreaterThan(20);
  await expect(page.locator('.lore-time-gear[data-powered="true"]').first()).toBeVisible();
  const powered = page.locator('.lore-time-gear[data-powered="true"]').first();
  const rotation = await powered.getAttribute('style');
  await expect.poll(() => powered.getAttribute('style')).not.toBe(rotation);
  await page.screenshot({ path: 'test-results/lore-era-light-travelling.png' });
  await expect(page.locator('.lore-timeline')).toHaveAttribute('data-phase', 'arriving');
  await expect(page.locator('.lore-era[data-seated="true"]')).toHaveCount(1);
  await expect(page.locator('.lore-time-gear[data-powered="true"]')).toHaveCount(0);
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
