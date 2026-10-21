import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { mock } from 'node:test';
import nodemailer from 'nodemailer';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { mkdir } from 'node:fs/promises';
import { passwordRule } from '../shared/password-policy';
if (!new URL(process.env.DATABASE_URL!).pathname.startsWith('/alvorada_test_'))
  throw Error('Banco descartável obrigatório.');
const probe = createServer();
await new Promise<void>((r) => probe.listen(0, '127.0.0.1', r));
const port = (probe.address() as { port: number }).port;
await new Promise<void>((r) => probe.close(() => r()));
const origin = `http://127.0.0.1:${port}`;
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
// A local trusted proxy gives independent fixture clients distinct test IPs.
process.env.TRUST_REVERSE_PROXY = '1';
// SMTP is intercepted only inside this disposable runner. No real e-mail is sent.
const messages: { to: string; text: string }[] = [];
const transport = nodemailer.createTransport({ streamTransport: true, buffer: true });
mock.method(transport, 'verify', async () => true);
mock.method(transport, 'sendMail', async (message: { to: string; text: string }) => {
  messages.push(message);
  return { accepted: [message.to] };
});
mock.method(nodemailer, 'createTransport', () => transport);
const { pool } = await import('../server/db'),
  { migrate } = await import('../server/migrate'),
  { seed } = await import('../server/seed');
await migrate();
await seed();
const { createApp } = await import('../server/app');
const server = createApp().listen(port, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));
const browser = await chromium.launch({ channel: 'msedge', headless: true }),
  context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
    reducedMotion: 'reduce',
  }),
  page = await context.newPage();
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
await mkdir('test-results/account-access', { recursive: true });
let fixtureClient = 1;
async function api(path: string, data?: unknown, method = data ? 'POST' : 'GET', headers = {}) {
  return context.request.fetch(origin + '/api' + path, {
    method,
    data,
    headers: { Origin: origin, 'X-Forwarded-For': '192.0.2.' + fixtureClient++, ...headers },
  });
}
try {
  for (const password of ['abc123', 'ABC123', 'Abcdef', 'Abc1']) {
    const result = await api('/auth/sign-up/email', {
      name: 'Senha inválida',
      email: randomUUID() + '@example.test',
      password,
    });
    expect(result.status()).toBe(400);
    expect(await result.text()).toContain(passwordRule);
  }
  const email = 'recovery-' + randomUUID() + '@gmail.com';
  const signup = await api('/auth/sign-up/email', {
    name: 'Admin de teste',
    email,
    password: 'Abc123',
  });
  expect(signup.status()).toBe(200);
  const { user } = await signup.json();
  await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [user.id]);
  expect((await api('/admin/recovery-mail')).status()).toBe(200);
  expect(
    (
      await api('/admin/recovery-mail', undefined, 'GET', { 'X-Account-Preview': 'basic' })
    ).status(),
  ).toBe(403);
  expect((await api('/auth/request-password-reset', { email })).status()).toBe(503);
  const appPassword = 'abcdefghijklmnop';
  expect((await api('/admin/recovery-mail', { appPassword }, 'PUT')).status()).toBe(200);
  const config = await (await api('/admin/recovery-mail')).json();
  expect(config.configured).toBe(true);
  expect(config.sender).toBe(email);
  expect(JSON.stringify(config)).not.toContain(appPassword);
  const credential = (await pool.query('SELECT credential FROM recovery_mail_settings')).rows[0]
    .credential;
  expect(credential).not.toContain(appPassword);
  expect(credential).not.toContain(email);
  await page.goto(origin + '/#recovery-mail');
  {
    await expect(page.getByRole('dialog', { name: 'Recuperação por e-mail' })).toBeVisible();
    await page.screenshot({ path: 'test-results/account-access/admin-settings.png' });
    await page.getByRole('button', { name: 'Fechar', exact: true }).click();
  }
  const unknown = await api('/auth/request-password-reset', {
    email: randomUUID() + '@example.test',
  });
  expect(unknown.status()).toBe(200);
  expect(messages).toHaveLength(0);
  const request = await api('/auth/request-password-reset', {
    email,
    redirectTo: origin + '/wrong',
  });
  expect(request.status()).toBe(200);
  expect(messages).toHaveLength(1);
  expect(await request.json()).toEqual(await unknown.json());
  for (let attempt = 0; attempt < 4; attempt++)
    expect(
      (
        await api(
          '/auth/request-password-reset',
          { email: randomUUID() + '@example.test' },
          'POST',
          { 'X-Forwarded-For': '198.51.100.10' },
        )
      ).status(),
    ).toBe(attempt < 3 ? 200 : 429);
  const link = messages[0].text.match(/http[^\s]+/)![0];
  expect(messages[0].to).toBe(email);
  expect(decodeURIComponent(link)).toContain('/?recover=1');
  const publicContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: 'reduce',
    }),
    publicPage = await publicContext.newPage();
  publicPage.on('pageerror', (e) => errors.push(e.message));
  await publicPage.goto(origin + '/');
  await publicPage.getByRole('button', { name: 'Iniciar aventura', exact: true }).click();
  await publicPage.getByRole('button', { name: 'Criar uma conta', exact: true }).click();
  await expect(publicPage.getByText(passwordRule, { exact: true })).toBeVisible();
  await expect(publicPage.locator('input[name=password]')).toHaveAttribute('minlength', '6');
  await publicPage.screenshot({ path: 'test-results/account-access/signup-mobile.png' });
  await publicPage.getByRole('button', { name: 'Entrar', exact: true }).click();
  await publicPage.getByRole('button', { name: 'Esqueci minha senha', exact: true }).click();
  await expect(
    publicPage.getByRole('button', { name: 'Enviar link de recuperação' }),
  ).toBeVisible();
  await publicPage.screenshot({ path: 'test-results/account-access/request-mobile.png' });
  await publicPage.goto(link);
  await expect(publicPage.getByRole('heading', { name: 'Criar nova senha' })).toBeVisible();
  await publicPage.getByLabel('Nova senha', { exact: true }).fill('Xyz789');
  await publicPage.getByLabel('Confirme a nova senha', { exact: true }).fill('Xyz788');
  await publicPage.getByRole('button', { name: 'Salvar nova senha' }).click();
  await expect(publicPage.getByRole('alert')).toContainText('precisam ser iguais');
  await publicPage.getByLabel('Confirme a nova senha', { exact: true }).fill('Xyz789');
  await publicPage.getByRole('button', { name: 'Salvar nova senha' }).click();
  await expect(publicPage.getByRole('heading', { name: 'Senha atualizada' })).toBeVisible();
  await publicPage.screenshot({ path: 'test-results/account-access/reset-mobile.png' });
  const callback = new URL(link),
    token = callback.pathname.split('/').at(-1)!;
  expect((await api('/auth/reset-password', { token, newPassword: 'Xyz789' })).status()).toBe(400);
  expect((await api('/auth/sign-in/email', { email, password: 'Abc123' })).status()).toBe(401);
  expect((await api('/auth/sign-in/email', { email, password: 'Xyz789' })).status()).toBe(200);
  const oldSessions = (
    await pool.query('SELECT count(*)::int AS n FROM session WHERE "userId"=$1', [user.id])
  ).rows[0].n;
  expect(oldSessions).toBe(1);
  const expired = randomUUID();
  await pool.query(
    'INSERT INTO verification(id,identifier,value,"expiresAt","createdAt","updatedAt") VALUES($1,$2,$3,now()-interval \'1 minute\',now(),now())',
    [randomUUID(), 'reset-password:' + expired, user.id],
  );
  expect(
    (await api('/auth/reset-password', { token: expired, newPassword: 'Def456' })).status(),
  ).toBe(400);
  const { createLegacyTestCharacter } = await import('../tests/character-fixtures');
  // Character fixture requires an example.test identity; this account is separate from the Gmail sender.
  const account = await api('/auth/sign-up/email', {
    name: 'Perícias mobile',
    email: randomUUID() + '@example.test',
    password: 'Test-' + randomUUID(),
  });
  const member = (await account.json()).user;
  const hero = await createLegacyTestCharacter(member.id, 'Perícias');
  await pool.query("UPDATE characters SET class='Feiticeiro',race='Humano' WHERE id=$1", [hero.id]);
  const { defaultChoices } = await import('../shared/character-sheet');
  const choices = defaultChoices('Humano', 'Feiticeiro');
  choices.classSkills = ['Religião'];
  await pool.query('INSERT INTO character_sheets(character_id,choices) VALUES($1,$2)', [
    hero.id,
    choices,
  ]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(origin + '/#profile');
  const skills = page.getByRole('group', { name: /^Perícias de Feiticeiro/ });
  await expect(skills).toBeVisible({ timeout: 60000 });
  const hiddenSelection = skills.getByRole('checkbox', { name: /Religião/ });
  await expect(hiddenSelection).toBeChecked();
  await expect(hiddenSelection).toBeEnabled();
  // Removing a stale selection removes its entire row; check the resulting count.
  await hiddenSelection.click();
  await expect(skills).toContainText('0/2');
  const available = skills.getByRole('checkbox');
  await available.nth(0).check();
  await available.nth(1).check();
  await expect(skills).toContainText('2/2');
  await available.nth(0).uncheck();
  await expect(skills).toContainText('1/2');
  for (const checkbox of await skills.getByRole('checkbox').all()) {
    const box = await checkbox.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  }
  await skills.scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/account-access/skills-mobile.png' });
  await page.getByLabel('Talento de origem', { exact: true }).selectOption('Robusto');
  await expect(page.getByLabel('Talento de origem', { exact: true })).toHaveValue('Robusto');
  const remaining = skills.getByRole('checkbox').filter({ visible: true });
  await remaining.nth(0).check();
  const [saved] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/choices') && r.request().method() === 'POST'),
    page.getByRole('button', { name: 'Salvar escolhas', exact: true }).click(),
  ]);
  expect(saved.status()).toBe(200);
  const persisted = (
    await pool.query('SELECT choices FROM character_sheets WHERE character_id=$1', [hero.id])
  ).rows[0].choices;
  expect(persisted.backgroundFeat).toBe('Robusto');
  expect(errors).toEqual([]);
  console.log(
    'PASS: senha de seis caracteres, política na API/UI, recuperação por e-mail, token único/expirado, sessões revogadas, SMTP protegido e perícias mobile removíveis.',
  );
  await publicContext.close();
} finally {
  await browser.close();
  server.closeAllConnections();
  await new Promise<void>((r) => server.close(() => r()));
  await pool.end();
  mock.restoreAll();
}
