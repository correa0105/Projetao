import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { adminScopes } from '../shared/admin-scopes';
if (!/^\/alvorada_test_[0-9a-f]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))
  throw Error('Banco descartável obrigatório.');
const origin = 'http://localhost:3092';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db'),
  { migrate } = await import('../server/migrate'),
  { seed } = await import('../server/seed');
await migrate();
await seed();
const { createApp } = await import('../server/app'),
  server = createApp().listen(3092, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const ctx = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
  }),
  page = await ctx.newPage(),
  errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
await mkdir('test-results/admin-scopes', { recursive: true });
try {
  const sign = await ctx.request.post(origin + '/api/auth/sign-up/email', {
    headers: { Origin: origin },
    data: {
      name: 'Administrador de conteúdo',
      email: randomUUID() + '@example.test',
      password: 'Test-' + randomUUID(),
    },
  });
  expect(sign.ok()).toBe(true);
  const user = (await sign.json()).user;
  await pool.query('INSERT INTO administrator_scopes(user_id,scope) SELECT $1,unnest($2::text[])', [
    user.id,
    adminScopes,
  ]);
  for (const width of [1440, 1024, 760, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(origin + '/#overview');
    await expect(page.getByRole('button', { name: 'Nova publicação', exact: true })).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Menu de visualização da conta', exact: true }),
    ).toHaveCount(0);
    await page.getByRole('button', { name: 'Nova publicação', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Fechar editor', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Fechar editor', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Editar calendário', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Novo compromisso', exact: true })).toHaveCount(
      0,
    );
    await page.screenshot({ path: `test-results/admin-scopes/home-${width}.png` });
    await page.goto(origin + '/#lore');
    await expect(page.locator('.lore-page-edit').first()).toBeVisible();
    await page.goto(origin + '/#rules');
    await expect(page.getByRole('button', { name: 'Editar conteúdo', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Editar conteúdo', exact: true }).click();
    await expect(
      page.getByRole('textbox', { name: 'Título do códice', exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `test-results/admin-scopes/rules-${width}.png` });
  }
  const api = await (await ctx.request.get(origin + '/api/me')).json();
  expect(api.administrador).toBe(0);
  expect(api.admin_scopes.sort()).toEqual([...adminScopes].sort());
  expect((await (await ctx.request.get(origin + '/api/atlas')).json()).can_manage_pins).toBe(true);
  expect(
    (
      await ctx.request.post(origin + '/api/events', { headers: { Origin: origin }, data: {} })
    ).status(),
  ).toBe(403);
  await pool.query('DELETE FROM administrator_scopes WHERE user_id=$1', [user.id]);
  await page.goto(origin + '/#overview');
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'O Diário da Alvorada', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Nova publicação', exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
  await writeFile(
    'test-results/admin-scopes/result.json',
    JSON.stringify(
      {
        passed: true,
        widths: [1440, 1024, 760, 390],
        scopes: adminScopes,
        globalAdministrator: false,
        revocation: true,
        errors,
      },
      null,
      2,
    ),
  );
  console.log('Scoped administration browser checks passed in four widths.');
} finally {
  await browser.close();
  await new Promise<void>((r) => server.close(() => r()));
  await pool.end();
}
