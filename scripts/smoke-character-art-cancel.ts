import 'dotenv/config';
import express from 'express';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
if (!/^\/alvorada_test_[0-9a-f]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))
  throw Error('Banco descartável obrigatório.');
const origin = 'http://localhost:3026';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db.js');
const { migrate } = await import('../server/migrate.js');
const { seed } = await import('../server/seed.js');
const { createLegacyTestCharacter, testArtImage, testTokenImage } =
  await import('../tests/character-fixtures.js');
await migrate();
await seed();
const { createApp } = await import('../server/app.js');
const app = express(),
  client = resolve('.local/art-cancel-client-20261102');
app.get('/', (_req, res) => res.sendFile(resolve(client, 'index.html'), { dotfiles: 'allow' }));
app.use('/assets', express.static(resolve(client, 'assets')));
app.use(express.static(resolve('public')));
app.use(createApp());
const server = app.listen(3026, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));
const browser = await chromium.launch({ channel: 'msedge', headless: true }),
  context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await context.addInitScript('window.__name = (fn) => fn;');
const page = await context.newPage(),
  root = '.local/art-cancel-20261102';
await mkdir(root, { recursive: true });
const errors: string[] = [],
  checks: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
try {
  const signup = await context.request.post(origin + '/api/auth/sign-up/email', {
    headers: { Origin: origin },
    data: {
      name: 'Cancelar vestir',
      email: randomUUID() + '@example.test',
      password: 'Test-' + randomUUID(),
    },
  });
  expect(signup.ok()).toBe(true);
  const uid = (await signup.json()).user.id,
    c = await createLegacyTestCharacter(uid, 'Teste de cancelamento');
  const portrait = await testArtImage(),
    token = await testTokenImage();
  await pool.query('INSERT INTO character_portraits(character_id,image)VALUES($1,$2)', [
    c.id,
    portrait,
  ]);
  await pool.query('INSERT INTO character_tokens(character_id,image)VALUES($1,$2)', [c.id, token]);
  // Simulate a stale camp snapshot while the jobs endpoint has the current state.
  await page.route('**/api/characters', async (route) => {
    const response = await route.fetch();
    const rows = await response.json();
    await route.fulfill({
      response,
      json: rows.map((r: any) => (r.id === c.id ? { ...r, art_pending: true } : r)),
    });
  });
  for (const width of [1440, 390]) {
    const id = (
      await pool.query(
        "INSERT INTO character_art_jobs(user_id,character_id,status,retry_count,reference,approved_portrait,idempotency_key)VALUES($1,$2,'queued',2,$3,$3,$4)RETURNING id",
        [uid, c.id, portrait, randomUUID()],
      )
    ).rows[0].id;
    await pool.query(
      'INSERT INTO character_art_worker(id,available,heartbeat_at)VALUES(true,true,now())ON CONFLICT(id)DO UPDATE SET available=true,heartbeat_at=now()',
    );
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(origin + '/#inventory');
    await expect(page.getByRole('button', { name: 'Vestindo...', exact: true })).toBeVisible();
    const cancel = page.getByRole('button', { name: 'Cancelar pedido', exact: true });
    await expect(cancel).toBeVisible();
    await cancel.scrollIntoViewIfNeeded();
    await page.screenshot({ path: root + `/pending-${width}.png` });
    await cancel.click();
    const vestir = page.getByRole('button', { name: 'Vestir', exact: true });
    await expect(vestir).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Cancelar pedido', exact: true })).toHaveCount(0);
    expect(
      (await pool.query('SELECT status,last_error_code FROM character_art_jobs WHERE id=$1', [id]))
        .rows[0],
    ).toEqual({ status: 'failed', last_error_code: 'cancelled' });
    await vestir.click();
    await expect(page.getByText('Nenhum item equipado.', { exact: false })).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Gerar sem equipamentos', exact: true }),
    ).toBeVisible();
    await page.screenshot({ path: root + `/no-equipment-${width}.png` });
    await page.getByRole('dialog').getByRole('button', { name: 'Fechar', exact: true }).click();
    checks.push(
      `Cancelar pedido e liberar Vestir mesmo com snapshot antigo; aviso de geração sem equipamento em ${width} px`,
    );
  }
  expect(errors).toEqual([]);
  await writeFile(root + '/result.json', JSON.stringify({ passed: true, checks, errors }, null, 2));
  console.log(JSON.stringify({ passed: true, checks }));
} catch (e) {
  await page.screenshot({ path: root + '/failure.png' });
  throw e;
} finally {
  await browser.close();
  await new Promise<void>((r) => server.close(() => r()));
  await pool.end();
}
