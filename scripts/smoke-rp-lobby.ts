import 'dotenv/config';
import { chromium, expect, type Route } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { guildDocumentSchema, guildRooms } from '../shared/guilds';
import { guildFacilities } from '../shared/guild-facilities';
if (!/^\/alvorada_test_[a-f0-9]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))
  throw Error('Disposable database required');
const origin = 'http://localhost:3063';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db'),
  { migrate } = await import('../server/migrate'),
  { seed } = await import('../server/seed'),
  { createLegacyTestCharacter } = await import('../tests/character-fixtures');
await migrate();
await seed();
const { createApp } = await import('../server/app');
process.env.NODE_ENV = 'production';
const server = createApp().listen(3063, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
await mkdir('test-results/rp-lobby', { recursive: true });
const errors: string[] = [];
try {
  const contexts = await Promise.all(
    [0, 1].map(() =>
      browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' }),
    ),
  );
  for (const context of contexts) {
    await context.setExtraHTTPHeaders({ 'Accept-Encoding': 'identity' });
    await context.addInitScript(() => {
      localStorage.setItem('alvorada-music-muted', 'true');
      localStorage.setItem('alvorada-effects-muted', 'true');
    });
  }
  const [page, guestPage] = await Promise.all(contexts.map((c) => c.newPage()));
  for (const p of [page, guestPage]) {
    p.setDefaultTimeout(15000);
    p.on('pageerror', (e) => errors.push(e.message));
    await p.route('**/*', async (route) => {
      const u = new URL(route.request().url());
      if (u.origin !== origin || u.pathname.startsWith('/api/')) return route.continue();
      const file = resolve('public', '.' + decodeURIComponent(u.pathname));
      if (file.startsWith(resolve('public')) && (await stat(file).catch(() => null))?.isFile())
        return route.fulfill({ path: file });
      return route.continue();
    });
  }
  const accounts = [];
  for (const [i, context] of contexts.entries()) {
    const response = await context.request.post(origin + '/api/auth/sign-up/email', {
      headers: { Origin: origin },
      data: {
        name: i ? 'Convidado RP' : 'Anfitrião RP',
        email: 'rp-' + randomUUID() + '@example.test',
        password: 'Test-' + randomUUID(),
      },
    });
    expect(response.status()).toBe(200);
    accounts.push((await response.json()).user);
  }
  const [owner, friend] = accounts,
    hero = await createLegacyTestCharacter(owner.id, 'Arden'),
    guest = await createLegacyTestCharacter(friend.id, 'Mira');
  const silhouette = await readFile('public/character-silhouette-v2.png');
  for (const c of [hero, guest])
    await pool.query(
      'INSERT INTO character_portraits(character_id,image) VALUES($1,$2) ON CONFLICT(character_id) DO UPDATE SET image=excluded.image',
      [c.id, silhouette],
    );
  const pair = [owner.id, friend.id].sort();
  await pool.query(
    "INSERT INTO social_friendships(user_a,user_b,requested_by,status) VALUES($1,$2,$1,'accepted')",
    pair,
  );
  const gid = randomUUID();
  await pool.query(
    'INSERT INTO player_guilds(id,owner_id,document,treasury_cp,prestige,founding_cp,request_id) VALUES($1,$2,$3,1000000,1000,0,$4)',
    [
      gid,
      owner.id,
      JSON.stringify(guildDocumentSchema.parse({ name: 'Companhia do Porto' })),
      randomUUID(),
    ],
  );
  await pool.query(
    'INSERT INTO player_guild_members(guild_id,user_id,character_id) VALUES($1,$2,$3),($1,$4,$5)',
    [gid, owner.id, hero.id, friend.id, guest.id],
  );
  await page.goto(origin + '/#house');
  await expect(page.locator('.rp-directory h1')).toHaveText('Lobby de RP');
  await expect(page.locator('.rp-room-card')).toHaveCount(4);
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await page.screenshot({
      path: 'test-results/rp-lobby/directory-' + width + '.png',
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'Criar sala temporária', exact: true }).click();
  const create = page.getByRole('dialog', { name: 'Criar sala temporária' });
  await create.getByLabel('Nome da sala').fill('Encontro na Praia');
  await create.getByLabel('Cenário').selectOption('beach');
  await create.getByLabel('Duração').selectOption('2');
  await create.getByRole('button', { name: 'Criar sala', exact: true }).click();
  await expect(page.locator('.rp-session')).toBeVisible();
  const rid = await page.locator('.rp-session').getAttribute('data-rp-room');
  expect(rid).toBeTruthy();
  await expect(page.locator('[data-rp-actor="' + owner.id + '"]').first()).toBeVisible();
  await page.getByRole('button', { name: 'Decorar', exact: true }).click();
  const decor = page.getByRole('complementary', { name: 'Decorar sala' });
  await decor.getByLabel('Adicionar mobília').selectOption('table');
  await expect(page.locator('[data-rp-piece]')).toHaveCount(1);
  const prop = page.locator('[data-rp-piece]');
  await prop.scrollIntoViewIfNeeded();
  const rect = (await prop.boundingBox())!;
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
  await page.mouse.down();
  await page.mouse.move(rect.x + rect.width / 2 + 75, rect.y + rect.height / 2 - 35, { steps: 8 });
  await page.mouse.up();
  await decor.getByRole('button', { name: 'Salvar decoração', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Sala salva.' })).toBeVisible();
  const stored = (await pool.query('SELECT document,revision FROM rp_rooms WHERE id=$1', [rid]))
    .rows[0];
  expect(stored.document.placements).toHaveLength(1);
  expect(stored.document.placements[0].x).toBeGreaterThan(0.5);
  const pattern = '**/api/rp-lobby/' + rid,
    fail = async (route: Route) =>
      route.request().method() === 'PUT'
        ? route.fulfill({
            status: 503,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Falha simulada ao salvar' }),
          })
        : route.continue();
  await page.route(pattern, fail);
  await decor.getByLabel('Nome da sala').fill('Rascunho protegido');
  await decor.getByRole('button', { name: 'Salvar decoração', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Falha simulada');
  await page.reload();
  await expect(
    page.getByRole('status').filter({ hasText: 'Rascunho de decoração recuperado.' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Decorar', exact: true }).click();
  await expect(
    page.getByRole('complementary', { name: 'Decorar sala' }).getByLabel('Nome da sala'),
  ).toHaveValue('Rascunho protegido');
  await page.unroute(pattern, fail);
  await page
    .getByRole('complementary', { name: 'Decorar sala' })
    .getByRole('button', { name: 'Salvar decoração', exact: true })
    .click();
  await expect(page.getByRole('status').filter({ hasText: 'Sala salva.' })).toBeVisible();
  await page.getByRole('button', { name: 'Convidados', exact: true }).click();
  const invite = page.getByRole('complementary', { name: 'Convidados da sala' });
  await invite.getByLabel('Amigo').selectOption(friend.id);
  await invite.getByRole('button', { name: 'Convidar', exact: true }).click();
  await guestPage.goto(origin + '/#house');
  await guestPage.getByRole('button', { name: 'Aceitar e entrar' }).click();
  await expect(guestPage.locator('[data-rp-actor="' + friend.id + '"]').first()).toBeVisible();
  await expect(guestPage.getByRole('button', { name: 'Decorar', exact: true })).toHaveCount(0);
  await guestPage
    .getByLabel('Sua mensagem de RP')
    .fill('Mira chega pela areia e cumprimenta Arden.');
  await guestPage.getByRole('button', { name: 'Enviar', exact: true }).click();
  await expect(page.locator('.rp-messages')).toContainText('Mira chega pela areia');
  await expect(page.locator('.rp-actor')).toHaveCount(2);
  await page.getByRole('button', { name: 'Fechar painel', exact: true }).click();
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect
      .poll(async () => {
        const r = await page.locator('[data-rp-actor="' + owner.id + '"]').boundingBox();
        return !!r && r.x + r.width / 2 > 0 && r.x + r.width / 2 < width;
      })
      .toBe(true);
    if (width === 390) await page.getByRole('button', { name: 'Recolher RP' }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await page.screenshot({
      path: 'test-results/rp-lobby/session-' + width + '.png',
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: '← Lobby de RP', exact: true }).click();
  await expect(page.locator('.rp-directory')).toBeVisible();
  for (const name of ['Mercado da Cidade', 'Praça da Fonte', 'Taverna da Lareira']) {
    await page.locator('.rp-room-card').filter({ hasText: name }).click();
    await expect(page.locator('.rp-session h1')).toHaveText(name);
    await expect(page.locator('.rp-actor')).toHaveCount(1);
    await page.screenshot({
      path:
        'test-results/rp-lobby/fixed-' +
        (name.startsWith('Mercado') ? 'market' : name.startsWith('Praça') ? 'plaza' : 'tavern') +
        '.png',
      fullPage: true,
    });
    await page.getByRole('button', { name: '← Lobby de RP', exact: true }).click();
    await expect(page.locator('.rp-directory')).toBeVisible();
  }
  await page.goto(origin + '/#guild?id=' + gid);
  await expect(page.locator('[data-guild-facility="main"]')).toBeVisible();
  for (const facility of guildFacilities) {
    if (facility.room !== 'main') {
      await page.getByRole('button', { name: 'Salas', exact: true }).click();
      await page
        .getByRole('navigation', { name: 'Salas da sede' })
        .getByRole('button', {
          name: guildRooms.find((r) => r.id === facility.room)!.name,
          exact: true,
        })
        .click();
    }
    const object = page.locator('[data-guild-facility="' + facility.room + '"]');
    await expect(object).toBeVisible();
    await expect
      .poll(() =>
        object
          .locator('img')
          .evaluate(
            (n) => (n as HTMLImageElement).complete && (n as HTMLImageElement).naturalWidth > 0,
          ),
      )
      .toBe(true);
    await page.screenshot({
      path: 'test-results/rp-lobby/guild-' + facility.room + '.png',
      fullPage: true,
    });
    await object.click();
    const dialog = page.getByRole('dialog', { name: facility.name });
    await expect(dialog).toContainText('Benefícios ainda não estão ativos.');
    await dialog.getByRole('button', { name: 'Melhorar para nível 2', exact: true }).click();
    await expect(dialog).toContainText('Nível 2 de 10');
    await dialog.getByRole('button', { name: 'Fechar', exact: true }).click();
  }
  expect(
    (
      await pool.query(
        'SELECT count(*)::int n FROM player_guild_room_facilities WHERE guild_id=$1 AND level=2',
        [gid],
      )
    ).rows[0].n,
  ).toBe(8);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  const mobileFacility = page.locator('[data-guild-facility="main"]');
  await expect(mobileFacility).toBeVisible();
  await mobileFacility.scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/rp-lobby/guild-mobile.png', fullPage: true });
  await mobileFacility.click();
  await expect(page.getByRole('dialog', { name: guildFacilities[0].name })).toContainText(
    'Nível 2 de 10',
  );
  await page.screenshot({ path: 'test-results/rp-lobby/guild-mobile-details.png', fullPage: true });
  expect(errors).toEqual([]);
  await writeFile(
    'test-results/rp-lobby/result.json',
    JSON.stringify(
      {
        passed: true,
        fixedRooms: 4,
        privateInvites: true,
        twoPlayers: true,
        editing: true,
        drag: true,
        failedSaveRecovered: true,
        rpMessages: true,
        guildFacilities: 8,
        upgrades: true,
        widths: [1440, 768, 390],
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
