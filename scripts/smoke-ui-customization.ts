import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
if (!/^\/alvorada_test_[0-9a-f]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))
  throw Error('Banco descartável obrigatório.');
const origin = 'http://localhost:3007';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db.js'),
  { migrate } = await import('../server/migrate.js'),
  { seed } = await import('../server/seed.js');
await migrate();
await seed();
const { createApp } = await import('../server/app.js');
const server = createApp().listen(3007, '127.0.0.1');
await new Promise<void>((resolve) => server.once('listening', resolve));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage(),
  errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
await mkdir('test-results', { recursive: true });
try {
  const signup = await context.request.post(origin + '/api/auth/sign-up/email', {
    headers: { Origin: origin },
    data: {
      name: 'Mestre da mesa',
      email: randomUUID() + '@example.test',
      password: 'Test-' + randomUUID(),
    },
  });
  expect(signup.status()).toBe(200);
  const user = (await signup.json()).user;
  await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [user.id]);
  const { createLegacyTestCharacter } = await import('../tests/character-fixtures.js');
  await createLegacyTestCharacter(user.id, 'Aurora');
  await page.goto(origin + '/#vtt');
  await page.getByLabel('Nome da mesa', { exact: true }).fill('Mesa de personalização');
  await page.getByRole('button', { name: 'Criar mesa', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Mesa virtual', exact: true })).toBeVisible();
  const nav = page.getByRole('navigation', { name: 'Painéis da mesa' });
  expect(
    await nav
      .getByRole('button')
      .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('aria-label'))),
  ).toEqual([
    'Chat',
    'Biblioteca de arte',
    'Fichas',
    'Biblioteca',
    'Som',
    'Combate',
    'Configurações e ajuda',
  ]);
  await nav.getByRole('button', { name: 'Combate', exact: true }).click();
  await expect(page.locator('.vtt-panel-heading h2')).toHaveText('Combate');
  await nav.getByRole('button', { name: 'Fichas', exact: true }).click();
  await page.locator('.vtt-subtabs').getByRole('button', { name: 'Diário', exact: true }).click();
  await expect(nav.getByRole('button', { name: 'Fichas', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(
    page.getByRole('button', { name: 'Anotação ou handout', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Anotação ou handout', exact: true }).click();
  await page.getByLabel('Título', { exact: true }).fill('O diário da expedição');
  await expect
    .poll(async () => {
      const row = (await pool.query('SELECT document FROM vtt_rooms WHERE owner_id=$1', [user.id]))
        .rows[0];
      return row.document.journal[0]?.title;
    })
    .toBe('O diário da expedição');
  await nav.getByRole('button', { name: 'Chat', exact: true }).click();
  await expect(page.locator('#vtt-chat-controls')).toBeVisible();
  await page.locator('.vtt-chat-collapse').click();
  await expect(page.locator('#vtt-chat-controls')).toBeHidden();
  await expect(page.locator('.vtt-panel-heading h2')).toBeHidden();
  await expect(page.locator('.vtt-chat-log')).toBeAttached();
  await page.getByLabel('Mensagem', { exact: true }).fill('O grupo chegou à taverna.');
  await page.getByRole('button', { name: 'Enviar à mesa', exact: true }).click();
  await expect(page.locator('.vtt-chat-log')).toContainText('O grupo chegou à taverna.');
  await page.locator('.vtt-panel').screenshot({ path: 'test-results/vtt-chat-collapsed.png' });
  await page.reload();
  await expect(page.locator('#vtt-chat-controls')).toBeHidden();
  await expect(page.locator('.vtt-chat-collapse')).toHaveAttribute('aria-expanded', 'false');
  await nav.getByRole('button', { name: 'Configurações e ajuda', exact: true }).click();
  await expect(page.getByLabel('Recolher controles do chat')).toBeChecked();
  await page.getByLabel('Recolher controles do chat').uncheck();
  await nav.getByRole('button', { name: 'Chat', exact: true }).click();
  await expect(page.locator('#vtt-chat-controls')).toBeVisible();
  await expect(page.getByLabel('Rolagem', { exact: true })).toBeVisible();
  await page.locator('.vtt-chat-collapse').click();
  for (const width of [768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await expect(page.getByLabel('Mensagem', { exact: true })).toBeVisible();
    await page.screenshot({
      path: 'test-results/vtt-customization-' + width + '.png',
      fullPage: true,
    });
  }
  expect(errors).toEqual([]);
  console.log(
    'VTT: Combate direto, Diário dentro de Fichas e chat recolhido com envio e preferência persistida aprovados.',
  );
} finally {
  await browser.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.end();
}
