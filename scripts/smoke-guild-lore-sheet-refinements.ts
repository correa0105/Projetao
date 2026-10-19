import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { guildDocumentSchema, guildRooms } from '../shared/guilds';
import { defaultChoices } from '../shared/character-sheet';
import { guildFacilities } from '../shared/guild-facilities';
if (!/^\/alvorada_test_[a-f0-9]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))
  throw Error('Banco descartável obrigatório');
const origin = 'http://localhost:3068';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db'),
  { migrate } = await import('../server/migrate'),
  { seed } = await import('../server/seed'),
  { createLegacyTestCharacter } = await import('../tests/character-fixtures');
await migrate();
await seed();
const { createApp } = await import('../server/app');
process.env.NODE_ENV = 'production';
const server = createApp().listen(3068, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));
const browser = await chromium.launch({ channel: 'msedge', headless: true }),
  out = 'test-results/guild-lore-sheet-refinements';
await mkdir(out, { recursive: true });
const errors: string[] = [];
try {
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: 'reduce',
      extraHTTPHeaders: { 'Accept-Encoding': 'identity' },
    }),
    page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== origin || url.pathname.startsWith('/api/')) return route.continue();
    const file = resolve('public', '.' + decodeURIComponent(url.pathname));
    if (file.startsWith(resolve('public')) && (await stat(file).catch(() => null))?.isFile())
      return route.fulfill({ path: file });
    return route.continue();
  });
  await page.goto(origin);
  const signup = await page.request.post(origin + '/api/auth/sign-up/email', {
    headers: { Origin: origin },
    data: {
      name: 'Revisor das salas',
      email: 'guild-refit-' + randomUUID() + '@example.test',
      password: 'Test-' + randomUUID(),
    },
  });
  expect(signup.status()).toBe(200);
  const uid = (await signup.json()).user.id;
  await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [uid]);
  const hero = await createLegacyTestCharacter(uid, 'Arden');
  const gid = randomUUID();
  await pool.query(
    'INSERT INTO player_guilds(id,owner_id,document,treasury_cp,prestige,founding_cp,request_id) VALUES($1,$2,$3,1000000,1000,0,$4)',
    [
      gid,
      uid,
      JSON.stringify(guildDocumentSchema.parse({ name: 'Companhia da Perspectiva' })),
      randomUUID(),
    ],
  );
  await pool.query(
    'INSERT INTO player_guild_members(guild_id,user_id,character_id) VALUES($1,$2,$3)',
    [gid, uid, hero.id],
  );
  await page.goto(origin + '/#guild?id=' + gid);
  await page.reload();
  for (const definition of guildFacilities) {
    if (definition.room !== 'main') {
      await page.getByRole('button', { name: 'Salas', exact: true }).click();
      await page
        .getByRole('navigation', { name: 'Salas da sede' })
        .getByRole('button', {
          name: guildRooms.find((r) => r.id === definition.room)!.name,
          exact: true,
        })
        .click();
    }
    const object = page.locator('[data-guild-facility="' + definition.room + '"]');
    await object.scrollIntoViewIfNeeded();
    await expect(object).toBeVisible();
    const placementBounds=await object.boundingBox();
    expect(placementBounds!.x).toBeGreaterThanOrEqual(0);
    expect(placementBounds!.x+placementBounds!.width).toBeLessThanOrEqual(1441);
    await expect(object.locator('img')).toHaveAttribute(
      'src',
      '/guild/facilities-20261019/' + definition.room + '.webp',
    );
    await expect
      .poll(() =>
        object
          .locator('img')
          .evaluate(
            (n) => (n as HTMLImageElement).complete && (n as HTMLImageElement).naturalWidth > 0,
          ),
      )
      .toBe(true);
    await page.screenshot({ path: out + '/room-' + definition.room + '.png', fullPage: true });
    await object.click();
    const modal = page.getByRole('dialog');
    await modal.getByRole('button', { name: 'Editar objeto e textos', exact: true }).click();
    await modal
      .getByLabel('Descrição', { exact: true })
      .fill('Uma instalação preservada pelos aventureiros da guilda.');
    await modal.getByRole('button', { name: 'Salvar objeto', exact: true }).click();
    await expect(modal.getByRole('status')).toContainText('Objeto atualizado.');
    await expect(modal).toContainText('Uma instalação preservada');
    await modal.getByRole('button', { name: 'Fechar', exact: true }).click();
  }
  await page.reload();
  const last = page.locator('[data-guild-facility]');
  await expect(last).toBeVisible();
  await last.click();
  await expect(page.getByRole('dialog')).toContainText('Uma instalação preservada');
  await page.getByRole('dialog').getByRole('button', { name: 'Fechar', exact: true }).click();
  for (const width of [768, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.locator('[data-guild-facility]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: out + '/guild-mobile-' + width + '.png', fullPage: true });
  }
  await pool.query('UPDATE "user" SET administrador=0 WHERE id=$1', [uid]);
  await page.reload();
  await page.locator('[data-guild-facility]').scrollIntoViewIfNeeded();
  await page.locator('[data-guild-facility]').click();
  await expect(
    page.getByRole('button', { name: 'Editar objeto e textos', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('dialog').getByRole('button', { name: 'Fechar', exact: true }).click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(origin + '/#lore');
  await page.reload();
  const emblem = page.locator('.lore-stage-toolbar .lore-archive-emblem');
  await expect(emblem).toHaveCSS('width', '76px');
  await expect(emblem).toHaveCSS('height', '76px');
  await emblem.scrollIntoViewIfNeeded();
  await page.screenshot({ path: out + '/lore-large-emblem.png', fullPage: true });
  for (const width of [768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await emblem.scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await page.screenshot({ path: out + '/lore-' + width + '.png' });
  }
  const post = async (path: string, data: unknown) => {
    const r = await page.request.post(origin + '/api' + path, {
      headers: { Origin: origin },
      data,
    });
    expect(r.status(), await r.text()).toBe(200);
    return r.json();
  };
  await post('/characters/' + hero.id + '/sheet/choices', defaultChoices('Elfo', 'Guerreiro'));
  await post('/characters/' + hero.id + '/sheet/roll', {});
  await post('/characters/' + hero.id + '/sheet/finalize', {
    assignment: [0, 1, 2, 3, 4, 5],
    ability_boosts: [2, 1, 0, 0, 0, 0],
  });
  await page.goto(origin + '/#profile');
  await page.reload();
  await expect(page.locator('.sheet-vitals')).toBeVisible();
  await expect(page.locator('.class-level-badge')).toHaveAttribute('data-class', 'fighter');
  await expect(page.locator('.sheet-vitals .sheet-realistic-icon')).toHaveCount(4);
  await page.getByRole('tab', { name: 'Combate', exact: true }).click();
  await expect(page.locator('img[src="/sheet/icons-20261019/unarmed.webp"]')).toBeVisible();
  for (const img of await page.locator('.sheet-realistic-icon').all())
    await expect
      .poll(() =>
        img.evaluate(
          (n) => (n as HTMLImageElement).complete && (n as HTMLImageElement).naturalWidth > 0,
        ),
      )
      .toBe(true);
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await page.screenshot({ path: out + '/sheet-' + width + '.png', fullPage: true });
  }
  expect(errors).toEqual([]);
  await writeFile(
    out + '/result.json',
    JSON.stringify(
      {
        passed: true,
        guildRooms: 8,
        roomSpecificArt: true,
        adminTextEditing: true,
        reloadPersisted: true,
        revokedAdminBlocked: true,
        loreEmblem76: true,
        sheetIcons: 5,
        classLevelBadge: true,
        widths: [1440, 768, 390, 320],
        errors,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
  await new Promise<void>((r) => server.close(() => r()));
  await pool.end();
}
