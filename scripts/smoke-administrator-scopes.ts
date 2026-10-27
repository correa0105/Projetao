import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { adminScopes } from '../shared/admin-scopes';
import { newToken } from '../shared/vtt';
import { vttProtocolVersion } from '../shared/vtt-protocol';
const initialScopes = adminScopes.slice(0, 4);
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
    initialScopes,
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
  expect(api.admin_scopes.sort()).toEqual([...initialScopes].sort());
  expect((await (await ctx.request.get(origin + '/api/atlas')).json()).can_manage_pins).toBe(true);
  expect(
    (
      await ctx.request.post(origin + '/api/events', { headers: { Origin: origin }, data: {} })
    ).status(),
  ).toBe(403);
  await pool.query(
    'INSERT INTO administrator_scopes(user_id,scope) SELECT $1,unnest($2::text[]) ON CONFLICT DO NOTHING',
    [user.id, adminScopes],
  );
  await page.goto(origin + '/#events');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Criar evento', exact: true })).toBeVisible();
  await page.goto(origin + '/#tower');
  await page.getByRole('button', { name: 'Expedições', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Nova expedição', exact: true })).toBeVisible();
  const ownerContext = await browser.newContext({
    extraHTTPHeaders: { 'X-Vtt-Schema-Version': String(vttProtocolVersion) },
  });
  const ownerSignup = await ownerContext.request.post(origin + '/api/auth/sign-up/email', {
    headers: { Origin: origin },
    data: {
      name: 'Mestre original',
      email: randomUUID() + '@example.test',
      password: 'Test-' + randomUUID(),
    },
  });
  expect(ownerSignup.ok()).toBe(true);
  const owner = (await ownerSignup.json()).user;
  const made = await ownerContext.request.post(origin + '/api/vtt', {
    headers: { Origin: origin },
    data: { name: 'Mesa de outro mestre' },
  });
  expect(made.ok()).toBe(true);
  const room = await made.json(),
    scene = room.document.scenes[0],
    hero = newToken(randomUUID(), scene);
  Object.assign(hero, {
    name: 'Personagem do mestre',
    controller: owner.id,
    x: scene.width / 2,
    y: scene.height / 2,
  });
  scene.tokens.push(hero);
  scene.fog = true;
  scene.fogMode = 'vision';
  scene.lighting = false;
  scene.ambient = 1;
  const saved = await ownerContext.request.put(origin + '/api/vtt/rooms/' + room.id, {
    headers: { Origin: origin },
    data: { revision: room.revision, document: room.document },
  });
  expect(saved.ok(), await saved.text()).toBe(true);
  await ctx.setExtraHTTPHeaders({ 'X-Vtt-Schema-Version': String(vttProtocolVersion) });
  await page.goto(origin + '/#vtt?room=' + room.id);
  await page.getByRole('button', { name: 'Entrar no VTT', exact: true }).click();
  await expect(page.getByText('Administrando esta mesa', { exact: true })).toBeVisible();
  expect((await (await ctx.request.get(origin + '/api/vtt/rooms/' + room.id)).json()).is_gm).toBe(
    true,
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: 'test-results/admin-scopes/vtt-other-master.png' });
  const viewerContext = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      extraHTTPHeaders: { 'X-Vtt-Schema-Version': String(vttProtocolVersion) },
    }),
    viewer = await viewerContext.newPage();
  viewer.on('pageerror', (e) => errors.push(e.message));
  const signedViewer = await viewerContext.request.post(origin + '/api/auth/sign-up/email', {
    headers: { Origin: origin },
    data: {
      name: 'Espectador',
      email: randomUUID() + '@example.test',
      password: 'Test-' + randomUUID(),
    },
  });
  expect(signedViewer.ok()).toBe(true);
  const joinedViewer = await viewerContext.request.post(origin + '/api/vtt/join', {
    headers: { Origin: origin },
    data: { invite: room.invite, role: 'spectator' },
  });
  expect(joinedViewer.ok()).toBe(true);
  await viewer.goto(origin + '/#vtt?room=' + room.id);
  await viewer.getByRole('button', { name: 'Entrar no VTT', exact: true }).click();
  await expect(
    viewer.getByRole('combobox', { name: 'Ver pela visão de', exact: true }),
  ).toHaveValue(owner.id);
  await expect(viewer.locator('.vtt-spectator-help')).toHaveCount(0);
  const spectatorState = await (
    await viewerContext.request.get(origin + '/api/vtt/rooms/' + room.id)
  ).json();
  expect(spectatorState.viewingUser).toBe(owner.id);
  expect(spectatorState.is_gm).toBe(false);
  expect(
    spectatorState.document.scenes[0].tokens.some((t: { id: string }) => t.id === hero.id),
  ).toBe(true);
  await viewer.screenshot({ path: 'test-results/admin-scopes/spectator-owner-character.png' });
  await viewerContext.close();
  await ownerContext.close();
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
