import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
if (!new URL(process.env.DATABASE_URL!).pathname.startsWith('/alvorada_test_'))
  throw Error('Banco isolado obrigatório.');
const origin = 'http://localhost:3012';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db.js');
const { migrate } = await import('../server/migrate.js');
const { seed } = await import('../server/seed.js');
const { createLegacyTestCharacter } = await import('../tests/character-fixtures.js');
await migrate();
await seed();
const { createApp } = await import('../server/app.js');
const server = createApp().listen(3012, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
let releaseDelayed: (() => void) | undefined;
async function request(path: string, data: unknown) {
  const response = await context.request.post(origin + '/api' + path, {
    headers: { Origin: origin },
    data,
  });
  expect(response.ok()).toBe(true);
  return response.json();
}
async function delayedSend() {
  let reached!: () => void;
  const blocked = new Promise<void>((r) => {
    reached = r;
  });
  const release = new Promise<void>((r) => {
    releaseDelayed = r;
  });
  await page.route(
    '**/api/house/*/messages',
    async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }
      const response = await route.fetch();
      reached();
      await release;
      await route.fulfill({ response });
    },
    { times: 1 },
  );
  return { blocked };
}
try {
  const account = await request('/auth/sign-up/email', {
    name: 'Autora de RP',
    email: `house-rp-${randomUUID()}@example.test`,
    password: `Test-${randomUUID()}`,
  });
  const hero = await createLegacyTestCharacter(account.user.id, 'Aurora');
  async function readyForNextMessage() {
    // Keep the production cooldown; age only messages in this disposable fixture.
    await pool.query(
      "UPDATE house_messages SET created_at=now()-interval '2 seconds' WHERE user_id=$1",
      [account.user.id],
    );
  }
  await request('/house', { character_id: hero.id });
  await page.goto(origin + '/#house');
  await expect(page.locator('.house-scene')).toBeVisible();
  await page.getByRole('button', { name: 'RP', exact: true }).click();
  const pin = page.getByLabel('Manter RP aberto', { exact: true });
  const input = page.getByLabel('Mensagem de Aurora', { exact: true });
  const send = page.getByRole('button', { name: 'Enviar', exact: true });
  const log = page.getByRole('log', { name: 'Conversa de RP' });
  await expect(pin).not.toBeChecked();
  await pin.check();
  await page.getByRole('button', { name: 'Decorar', exact: true }).click();
  await expect(page.locator('.house-panel')).toBeVisible();
  await expect(page.locator('.house-rp-overlay')).toBeVisible();
  await page.reload();
  await expect(pin).toBeChecked();
  await expect(page.locator('.house-rp-overlay')).toBeVisible();
  await input.fill('Aurora encontra o caminho de volta.');
  await input.press('Enter');
  await expect(log).toContainText('Aurora encontra o caminho de volta.');
  await expect(input).toBeFocused();
  await expect(input).toHaveValue('');
  await input.fill('Aurora deixa a capa junto à porta.');
  await readyForNextMessage();
  await send.click();
  await expect(log).toContainText('Aurora deixa a capa junto à porta.');
  await expect(input).toBeFocused();
  await expect(input).toHaveValue('');

  const { blocked: pendingDraft } = await delayedSend();
  await readyForNextMessage();
  await input.fill('A mensagem que já está sendo enviada.');
  await input.press('Enter');
  await pendingDraft;
  await expect(input).toBeEnabled();
  await expect(input).toBeFocused();
  await input.fill('O próximo rascunho continua inteiro.');
  releaseDelayed!();
  await expect(log).toContainText('A mensagem que já está sendo enviada.');
  await expect(send).toBeEnabled();
  await expect(input).toHaveValue('O próximo rascunho continua inteiro.');
  await expect(input).toBeFocused();
  await readyForNextMessage();
  await send.click();
  await expect(log).toContainText('O próximo rascunho continua inteiro.');
  await expect(input).toHaveValue('');
  await expect(input).toBeFocused();

  const { blocked: pendingIdentical } = await delayedSend();
  await readyForNextMessage();
  const identical = 'Um mesmo texto pode ser um novo rascunho.';
  await input.fill(identical);
  await input.press('Enter');
  await pendingIdentical;
  await input.fill('');
  await input.fill(identical);
  releaseDelayed!();
  await expect(log).toContainText(identical);
  await expect(send).toBeEnabled();
  await expect(input).toHaveValue(identical);
  await expect(input).toBeFocused();

  await page.getByRole('button', { name: 'Decorar', exact: true }).click();
  const outside = page.getByLabel('Nome da casa', { exact: true });
  const { blocked: pendingOutside } = await delayedSend();
  await readyForNextMessage();
  await input.fill('A conversa espera enquanto arrumo a casa.');
  await input.press('Enter');
  await pendingOutside;
  await outside.click();
  await expect(outside).toBeFocused();
  releaseDelayed!();
  await expect(log).toContainText('A conversa espera enquanto arrumo a casa.');
  await expect(page.locator('.house-rp-compose')).toHaveAttribute('aria-busy', 'false');
  await expect(outside).toBeFocused();
  await expect(input).not.toBeFocused();

  const { blocked: pendingTab } = await delayedSend();
  await readyForNextMessage();
  await input.fill('Também posso sair pelo teclado.');
  await input.press('Enter');
  await pendingTab;
  await input.press('Tab');
  await expect(input).not.toBeFocused();
  const focusAfterTab = await page.evaluate(() => document.activeElement?.outerHTML);
  releaseDelayed!();
  await expect(log).toContainText('Também posso sair pelo teclado.');
  await expect(page.locator('.house-rp-compose')).toHaveAttribute('aria-busy', 'false');
  await expect(input).not.toBeFocused();
  expect(await page.evaluate(() => document.activeElement?.outerHTML)).toBe(focusAfterTab);

  await page.getByRole('button', { name: 'RP', exact: true }).click();
  await pin.uncheck();
  await page.getByRole('button', { name: 'RP', exact: true }).click();
  await expect(page.locator('.house-rp-overlay')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.house-rp-overlay')).toHaveCount(0);
  await page.getByRole('button', { name: 'RP', exact: true }).click();
  await pin.check();
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(page.locator('.house-rp-overlay')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await mkdir('test-results', { recursive: true });
    await page.screenshot({ path: `test-results/house-rp-pinned-${width}.png`, fullPage: true });
  }
  expect(errors).toEqual([]);
  console.log(
    'House RP: pin across panels/reload, Enter/button focus, draft while pending, outside pointer/Tab focus and four widths passed.',
  );
} finally {
  releaseDelayed?.();
  await browser.close();
  await new Promise<void>((r) => server.close(() => r()));
  await pool.end();
}
