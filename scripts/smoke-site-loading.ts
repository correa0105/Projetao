import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { createServer } from 'node:net';
import express from 'express';
import {resolve} from 'node:path';
import {optimizedPublicImages} from '../server/optimized-public-images';
import {staticAssetCacheControl} from '../server/static-asset-cache';
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
const app=express();
app.use(optimizedPublicImages(resolve('public')));
app.use(express.static(resolve('public'),{setHeaders(res,file){const cache=staticAssetCacheControl(resolve('public'),file);if(cache)res.setHeader('Cache-Control',cache);}}));
app.use(createApp());
const server = app.listen(port, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  reducedMotion: 'reduce',
});
const page = await context.newPage(),
  errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
await mkdir('test-results/site-loading', { recursive: true });
try {
  const signup = await context.request.post(origin + '/api/auth/sign-up/email', {
    headers: { Origin: origin },
    data: {
      name: 'Carregamento de teste',
      email: randomUUID() + '@example.test',
      password: 'Test-' + randomUUID(),
    },
  });
  expect(signup.status()).toBe(200);
  const { user } = await signup.json();
  const { createLegacyTestCharacter } = await import('../tests/character-fixtures');
  const character = await createLegacyTestCharacter(user.id, 'Viajante do carregamento');
  let release!: () => void;
  const delayed = new Promise<void>((r) => (release = r));
  let shopRequests = 0;
  let catalogueRequests = 0;
  let unrelatedBackgroundRequests=0;
  page.on('request', (r) => {
    if (r.url().includes('/shop/reference/shop-counter')) shopRequests++;
    if (r.url().endsWith('/api/catalog')) catalogueRequests++;
    if (/\/(?:home-guild-hall\.webp|cards\/host-shadow-study[^/]*)$/.test(new URL(r.url()).pathname))unrelatedBackgroundRequests++;
  });
  await page.route('**/stable/paddock-camp-v2.webp', async (route) => {
    await delayed;
    await route.continue();
  });
  await page.goto(origin + '/#stable', { waitUntil: 'domcontentloaded' });
  await expect(
    page.getByRole('heading', { name: 'Preparando a Alvorada', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.stable-page')).toHaveCount(0);
  expect(shopRequests).toBe(0);
  expect(catalogueRequests).toBe(0);
  expect(unrelatedBackgroundRequests).toBe(0);
  await expect(page.locator('.asset-loading__first-visit')).toContainText(
    'Na primeira visita, o carregamento pode demorar mais.',
  );
  await page.screenshot({ path: 'test-results/site-loading/boot-waiting.png' });
  release();
  await expect(page.locator('[data-asset-loading]')).toHaveCount(0, { timeout: 60000 });
  const stable = page.locator('.stable-page');
  await expect(stable).toBeVisible();
  await expect(page.locator('.stable-animal-base')).toBeVisible();
  expect(
    await page
      .locator('.stable-animal-base')
      .evaluate(
        (image) =>
          (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0,
      ),
  ).toBe(true);
  expect(shopRequests).toBe(0);
  await page.screenshot({ path: 'test-results/site-loading/stable-ready.png' });
  let releaseReload!:()=>void;
  const delayedReload=new Promise<void>(r=>releaseReload=r);
  await page.route('**/stable/paddock-camp-v2.webp',async route=>{await delayedReload;await route.continue();});
  await page.reload({waitUntil:'domcontentloaded'});
  await expect(page.locator('[data-loading-mode="compact"]')).toBeVisible();
  await expect(page.locator('.asset-loading__first-visit')).toHaveCount(0);
  await expect(page.locator('[data-loading-mode="compact"] h1')).toHaveCount(0);
  await page.screenshot({path:'test-results/site-loading/return-visit-bar.png'});
  releaseReload();
  await expect(page.locator('[data-asset-loading]')).toHaveCount(0,{timeout:60000});
  const cached = await context.request.get(origin + '/stable/paddock-camp-v2.webp');
  expect(cached.headers()['cache-control']).toContain('max-age=3600');
  let releaseShop!: () => void;
  const delayedShop = new Promise<void>((r) => (releaseShop = r));
  await page.route('**/shop/reference/shop-counter-v2.png', async (route) => {
    await delayedShop;
    await route.continue();
  });
  await page.getByRole('button', { name: 'Abrir navegação', exact: true }).click();
  await page
    .getByRole('navigation', { name: 'Navegação principal' })
    .getByRole('button', { name: 'Loja', exact: true })
    .click();
  await page
    .getByRole('navigation', { name: 'Navegação principal' })
    .getByRole('button', { name: 'Empório', exact: true })
    .click();
  await expect(page.locator('[data-loading-mode="compact"]')).toBeVisible();
  await expect(page.locator('.asset-loading__first-visit')).toHaveCount(0);
  await expect(page.locator('[data-loading-mode="compact"] h1')).toHaveCount(0);
  await expect(page.locator('[data-loading-mode="compact"] progress')).toBeVisible();
  await expect(page.locator('.shop-scene')).toBeHidden();
  await page.screenshot({ path: 'test-results/site-loading/shop-waiting.png' });
  releaseShop();
  await expect(page.locator('[data-asset-loading]')).toHaveCount(0, { timeout: 60000 });
  await expect(page.locator('.shop-scene')).toBeVisible();
  expect(catalogueRequests).toBeGreaterThan(0);
  await page.screenshot({ path: 'test-results/site-loading/shop-ready.png' });
  await page.goto(origin + '/#profile');
  await expect(page.locator('.sheet-rank-eyebrow')).toHaveText('Mercenário');
  await expect(page.locator('.sheet-rank-identity h3')).toContainText('Iniciante');
  const other = await createLegacyTestCharacter(user.id, 'Outro personagem da mesma conta');
  const guildId = randomUUID();
  await pool.query(
    'INSERT INTO player_guilds(id,owner_id,document,founding_cp,request_id) VALUES($1,$2,$3,0,$4)',
    [guildId, user.id, { name: 'Guardiões do Norte' }, randomUUID()],
  );
  await pool.query(
    'INSERT INTO player_guild_members(user_id,guild_id,character_id) VALUES($1,$2,$3)',
    [user.id, guildId, other.id],
  );
  const otherMembership = await context.request.get(
    origin + `/api/characters/${character.id}/sheet`,
  );
  expect((await otherMembership.json()).guild).toBeNull();
  await pool.query('UPDATE player_guild_members SET character_id=$1 WHERE guild_id=$2', [
    character.id,
    guildId,
  ]);
  await expect(page.locator('.sheet-rank-eyebrow')).toHaveText(
    'Membro da Guilda — Guardiões do Norte',
    { timeout: 15000 },
  );
  await page.screenshot({ path: 'test-results/site-loading/sheet-guild-rank.png' });
  let failOnce = true;
  await page.route('**/stable/paddock-camp-v2.webp', async (route) => {
    if (failOnce) {
      failOnce = false;
      await route.abort();
    } else await route.continue();
  });
  await page.goto(origin + '/#stable', { waitUntil: 'domcontentloaded' });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: 'Tentar novamente', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
  await expect(page.locator('[data-asset-loading]')).toHaveCount(0, { timeout: 60000 });
  await expect(page.locator('.stable-page')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('[data-asset-loading]')).toHaveCount(0, { timeout: 60000 });
  await expect(page.locator('.stable-animal-base')).toBeVisible();
  await page.screenshot({ path: 'test-results/site-loading/stable-mobile-ready.png' });
  const profile = await context.request.get(origin + '/api/me');
  expect(profile.headers()['cache-control']).toBe('no-store');
  expect(errors).toEqual([]);
  console.log(
    'PASS: entrada aguarda cenário; loja separada; Estábulo e catálogo visíveis só após imagens prontas.',
  );
} finally {
  await browser.close();
  await new Promise<void>((r) => server.close(() => r()));
  await pool.end();
}
