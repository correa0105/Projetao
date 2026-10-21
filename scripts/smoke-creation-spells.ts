import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { createServer } from 'node:net';
if (!new URL(process.env.DATABASE_URL!).pathname.startsWith('/alvorada_test_'))
  throw Error('Banco descartável obrigatório.');
const probe = createServer();
await new Promise<void>((r) => probe.listen(0, '127.0.0.1', r));
const port = (probe.address() as { port: number }).port;
await new Promise<void>((r) => probe.close(() => r()));
const origin = `http://127.0.0.1:${port}`;
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db');
const { migrate } = await import('../server/migrate');
const { seed } = await import('../server/seed');
await migrate();
await seed();
const { createApp } = await import('../server/app');
const server = createApp().listen(port, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 960 },
  reducedMotion: 'reduce',
});
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
await mkdir('test-results/creation-spells', { recursive: true });
try {
  const signup = await page.request.post(origin + '/api/auth/sign-up/email', {
    headers: { Origin: origin },
    data: {
      name: 'Magias de criação',
      email: randomUUID() + '@example.test',
      password: 'Test-' + randomUUID(),
    },
  });
  expect(signup.ok()).toBe(true);
  const { user } = await signup.json();
  const { createLegacyTestCharacter } = await import('../tests/character-fixtures');
  const hero = await createLegacyTestCharacter(user.id, 'Aprendiz');
  await pool.query("UPDATE characters SET class='Bruxo',race='Humano' WHERE id=$1", [hero.id]);
  // The UI test has no external translator. Keep that service deterministic.
  await page.route('**/api/spell-reference/*', (route) =>
    route.fulfill({
      json: {
        label: 'Referência de teste',
        level: 0,
        school: 'Evocação',
        time: '1 ação',
        range: '18 metros',
        duration: 'Instantânea',
        components: 'V, S',
        materialCost: 0,
        materialConsumed: false,
        ritual: false,
        concentration: false,
        source: 'Fixture',
        page: 1,
        description: 'Descrição controlada para verificar a consulta sem modificar as escolhas.',
        summary: false,
      },
    }),
  );
  await page.goto(origin + '/#profile');
  await expect(page.locator('.sheet-creation')).toBeVisible({ timeout: 60000 });
  const cantrips = page.getByRole('group', { name: /^Truques da classe/ });
  const before = await cantrips
    .getByRole('checkbox')
    .evaluateAll((nodes) => nodes.map((n) => (n as HTMLInputElement).checked));
  expect(before.filter(Boolean)).toHaveLength(2);
  const unselected = cantrips
    .locator('.sheet-creation-spell')
    .filter({ has: page.locator('input:disabled') })
    .first();
  await expect(unselected.getByRole('checkbox')).toBeDisabled();
  await unselected.getByRole('button', { name: /^Ver magia:/ }).click();
  const dialog = page.getByRole('dialog', { name: /^Consultar / });
  await expect(dialog.locator('.spell-reference-facts')).toBeVisible({ timeout: 20000 });
  await expect(dialog).toContainText('Alcance');
  await page.screenshot({ path: 'test-results/creation-spells/cantrip-details.png' });
  await dialog.getByRole('button', { name: 'Fechar consulta de magia', exact: true }).click();
  expect(
    await cantrips
      .getByRole('checkbox')
      .evaluateAll((nodes) => nodes.map((n) => (n as HTMLInputElement).checked)),
  ).toEqual(before);
  const single = page
    .locator('.sheet-field-group')
    .filter({ has: page.locator('.sheet-choice-reference') })
    .first();
  const selected = await single.locator('select').inputValue();
  await single.getByRole('button', { name: /^Ver magia:/ }).click();
  await expect(dialog.locator('.spell-reference-facts')).toBeVisible({ timeout: 20000 });
  await dialog.getByRole('button', { name: 'Fechar consulta de magia', exact: true }).click();
  expect(await single.locator('select').inputValue()).toBe(selected);
  await page.setViewportSize({ width: 390, height: 844 });
  await cantrips.scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/creation-spells/mobile.png' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
  console.log(
    'PASS: consulta de truques e magia do talento na criação, inclusive com limite atingido, sem alterar escolhas.',
  );
} finally {
  await browser.close();
  server.closeAllConnections();
  await new Promise<void>((r) => server.close(() => r()));
  await pool.end();
}
