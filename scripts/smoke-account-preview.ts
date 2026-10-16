import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
if (!/^\/alvorada_test_[0-9a-f]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))
  throw Error('Disposable database required');
const origin = 'http://localhost:3087';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db'),
  { migrate } = await import('../server/migrate'),
  { seed } = await import('../server/seed'),
  { createLegacyTestCharacter } = await import('../tests/character-fixtures');
await migrate();
await seed();
const { createApp } = await import('../server/app');
process.env.NODE_ENV = 'production';
const server = createApp().listen(3087, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 960 },
  reducedMotion: 'reduce',
});
await context.addInitScript(() => {
  localStorage.setItem('alvorada-music-muted', 'true');
  localStorage.setItem('alvorada-effects-muted', 'true');
});
const page = await context.newPage(),
  errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
await mkdir('test-results/account-preview', { recursive: true });
await writeFile('test-results/account-preview/result.json', JSON.stringify({ passed: false }));
try {
  const response = await context.request.post(origin + '/api/auth/sign-up/email', {
    headers: { Origin: origin },
    data: {
      name: 'Administrador',
      email: randomUUID() + '@example.test',
      password: 'Test-' + randomUUID(),
    },
  });
  expect(response.ok()).toBe(true);
  const user = (await response.json()).user;
  await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [user.id]);
  await createLegacyTestCharacter(user.id, 'Aurora');
  await page.goto(origin + '/#house2');
  const trigger = page.getByRole('button', { name: 'Menu de visualização da conta', exact: true });
  await expect(page.getByRole('button', { name: 'Nova vizinhança', exact: true })).toBeVisible();
  await trigger.click();
  await page.getByRole('button', { name: 'Ver como conta básica', exact: true }).click();
  await expect(page.locator('.account-preview')).toHaveAttribute('data-preview', 'true');
  await expect(page.getByRole('button', { name: 'Nova vizinhança', exact: true })).toHaveCount(0);
  const pages = [
    'overview',
    'characters',
    'profile',
    'inventory',
    'achievements',
    'board',
    'shop',
    'stable',
    'pets',
    'events',
    'tower',
    'cards',
    'character-cards',
    'vtt',
    'hall',
    'profiles',
    'house',
    'house2',
    'guild',
    'world',
    'lore',
    'rules',
  ];
  for (const name of pages) {
    await page.evaluate((name) => {
      location.hash = name;
    }, name);
    await expect(page.locator('.app-shell')).toHaveAttribute('data-page', name);
    await expect(trigger).toBeVisible();
    await expect(page.locator('.account-preview')).toHaveAttribute('data-preview', 'true');
    if (['lore', 'rules', 'events', 'house2'].includes(name)) {
      await page.waitForTimeout(400);
      await page.screenshot({ path: `test-results/account-preview/basic-${name}.png` });
    }
  }
  await trigger.click();
  await expect(
    page.getByRole('complementary', { name: 'Visualização da conta', exact: true }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await page.reload();
  await expect(page.locator('.account-preview')).toHaveAttribute('data-preview', 'true');
  await page.evaluate(() => {
    location.hash = 'rules';
  });
  await expect(page.getByRole('button', { name: 'Editar conteúdo', exact: true })).toHaveCount(0);
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await trigger.click();
    const box = (await page.locator('#scene-panel-account-preview').boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
    await page.screenshot({ path: `test-results/account-preview/menu-${width}.png` });
    await page.keyboard.press('Escape');
  }
  await trigger.click();
  await page.getByRole('button', { name: 'Voltar à visão de administrador', exact: true }).click();
  await expect(page.locator('.account-preview')).not.toHaveAttribute('data-preview', 'true');
  await page.evaluate(() => {
    location.hash = 'house2';
  });
  await expect(page.getByRole('button', { name: 'Nova vizinhança', exact: true })).toBeVisible();
  expect(
    (await pool.query('SELECT administrador FROM "user" WHERE id=$1', [user.id])).rows[0]
      .administrador,
  ).toBe(1);
  expect(errors).toEqual([]);
  await writeFile(
    'test-results/account-preview/result.json',
    JSON.stringify(
      { passed: true, pages, mobile: [390, 320], errors, accountUnchanged: true },
      null,
      2,
    ),
  );
  console.log(
    'PASS global account preview: 22 pages, persistent mode, mobile drawer, keyboard, return to administrator and permissions preserved',
  );
} finally {
  await context.close();
  await browser.close();
  await new Promise<void>((r) => server.close(() => r()));
  await pool.end();
}
