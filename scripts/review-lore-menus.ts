import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

if (!new URL(process.env.DATABASE_URL!).pathname.startsWith('/alvorada_test_'))
  throw new Error('Banco UUID isolado obrigatório.');
const origin = 'http://127.0.0.1:3002';
process.env.APP_ORIGIN = origin;
process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db.js');
const { migrate } = await import('../server/migrate.js');
const { seed } = await import('../server/seed.js');
await migrate();
await seed();
const { createApp } = await import('../server/app.js');
const server = createApp().listen(3002, '127.0.0.1');
await new Promise<void>(resolve => server.once('listening', resolve));
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
const errors: string[] = [];
try {
  await mkdir('test-results', { recursive: true });
  const context = await browser.newContext({ viewport: { width: 1898, height: 921 }, reducedMotion: 'reduce', hasTouch: true });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin);
  const signup = await page.request.post(origin + '/api/auth/sign-up/email', {
    headers: { Origin: origin },
    data: { name: 'Arquivo teste', email: `lore-menu-${randomUUID()}@example.test`, password: `Test-${randomUUID()}` },
  });
  expect(signup.ok()).toBe(true);
  const user = (await signup.json()).user;
  await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [user.id]);
  const { createLegacyTestCharacter } = await import('../tests/character-fixtures.js');
  await createLegacyTestCharacter(user.id, 'Escriba');
  await page.goto(origin + '/#lore');
  await page.reload();
  const before = (await (await page.request.get(origin + '/api/lore-timeline')).json()).document;
  const timeline = page.getByRole('region', { name: 'Linha do tempo das eras' });
  await expect(timeline).toBeVisible();
  await expect(timeline.locator('.lore-era')).toHaveCount(before.eras.length);
  await expect(timeline.locator('.lore-time-gear').first()).toBeVisible();
  for (const width of [1898, 1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 921 });
    await page.evaluate(() => scrollTo(0, 0));
    const account = page.locator('.profile-avatar');
    await expect(account.getByText('Conta', { exact: true })).toBeVisible();
    await account.tap();
    await expect(page.locator('.profile-menu')).toHaveAttribute('data-pinned', 'true');
    await expect(page.locator('.logout-button')).toBeVisible();
    await expect(page.locator('.notifications-trigger')).toBeVisible();
    await expect(page.getByRole('listbox', { name: 'Seus personagens' })).toBeVisible();
    for (const [trigger, popup] of [['.music-settings-trigger', '.music-volume-panel'], ['.notifications-trigger', '.notifications-panel']] as const) {
      await page.locator(trigger).tap();
      await expect(page.locator(popup)).toBeVisible();
      const bounds = (await page.locator(popup).boundingBox())!;
      assert(bounds.x >= 0 && bounds.x + bounds.width <= width + 1, 'Painel da conta saiu da tela');
      await page.locator(trigger).tap();
    }
    await account.press('Escape');
    await expect(page.locator('.profile-menu')).toHaveAttribute('data-pinned', 'false');
    await page.locator('.lore-hero h1').tap();
    await page.mouse.move(12, 150);
    await page.screenshot({ path: `test-results/lore-menus-${width}-closed.png` });
    const menu = page.getByRole('button', { name: 'Abrir navegação', exact: true });
    await menu.tap();
    const tray = page.locator('#navigation-tray');
    await expect(tray).toBeVisible();
    await expect(tray.locator('.dock-item-label')).toHaveCount(6);
    for (const label of ['Início', 'Personagem', 'Mural', 'Loja', 'Explorar', 'Biblioteca'])
      await expect(tray.getByText(label, { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Biblioteca', exact: true }).tap();
    const panel = page.getByRole('region', { name: 'Opções de Biblioteca' });
    await expect(panel.getByRole('button', { name: 'Lore', exact: true })).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Regras', exact: true })).toBeVisible();
    for (const element of [page.locator('.profile-menu-controls'), tray, panel]) {
      if (await element.isVisible()) {
        const bounds = (await element.boundingBox())!;
        assert(bounds.x >= 0 && bounds.x + bounds.width <= width + 1, 'Menu saiu da tela');
      }
    }
    await page.screenshot({ path: `test-results/lore-menus-${width}-open.png` });
    await panel.getByRole('button', { name: 'Lore', exact: true }).press('Escape');
    await expect(panel).toHaveCount(0);
    await page.locator('#dock-library').press('Escape');
    await expect(menu).toBeFocused();
    await expect(tray).not.toBeVisible();
    await menu.press('ArrowUp');
    await expect(tray.locator('.dock-item').first()).toBeFocused();
    await tray.locator('.dock-item').first().press('Escape');
    await expect(menu).toBeFocused();
    await expect(tray).not.toBeVisible();
    await page.mouse.move(12, 150);
    await timeline.locator('.lore-era').last().tap();
    await expect(timeline.locator('.lore-era').last()).toHaveAttribute('aria-pressed', 'true');
    await timeline.getByRole('button', { name: 'Editar eras' }).tap();
    await expect(page.locator('.lore-era-editor')).toBeVisible();
    await page.locator('.lore-era-editor').getByRole('button', { name: 'Cancelar', exact: true }).tap();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Rolagem horizontal da página');
  }
  const after = (await (await page.request.get(origin + '/api/lore-timeline')).json()).document;
  assert.deepEqual(after, before, 'Navegação alterou a linha temporal');
  await page.setViewportSize({ width: 1440, height: 921 });
  await page.goto(origin + '/#overview');
  await expect(page.locator('.app-shell')).toHaveAttribute('data-page', 'overview');
  await expect(page.locator('.profile-menu-label')).toHaveCount(0);
  await expect(page.locator('.dock-item-label')).toHaveCount(0);
  const avatar = (await page.locator('.profile-avatar').boundingBox())!;
  assert.equal(avatar.width, 48, 'A aparência de conta mudou em outra página');
  const dock = (await page.locator('.journey-dock').boundingBox())!;
  assert(Math.abs(dock.x + dock.width / 2 - 720) < 1, 'Menu das outras páginas perdeu a posição');
  assert.deepEqual(errors, []);
  console.log('PASS Lore: menus reais em 1898/1440/390 px, toque, teclado/Escape, seis destinos, conta/notificações, linha temporal/engrenagens/editor intactos e outras páginas preservadas.');
  await context.close();
} catch (error) {
  for (const context of browser.contexts())
    for (const page of context.pages()) await page.screenshot({ path: 'test-results/lore-menus-failure.png' });
  throw error;
} finally {
  await browser.close();
  await new Promise<void>(resolve => server.close(() => resolve()));
  await pool.end();
}
