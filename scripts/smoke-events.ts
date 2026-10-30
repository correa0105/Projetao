import 'dotenv/config';
import { chromium, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import express from 'express';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { blankEvent } from '../shared/events';
import { staticAssetCacheControl } from '../server/static-asset-cache';

if (!new URL(process.env.DATABASE_URL!).pathname.startsWith('/alvorada_test_'))
  throw Error('Banco descartável obrigatório.');
const origin = 'http://localhost:3007';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db.js');
const { migrate } = await import('../server/migrate.js');
const { seed } = await import('../server/seed.js');
const { createLegacyTestCharacter } = await import('../tests/character-fixtures.js');
await migrate();
await seed();
const { createApp } = await import('../server/app.js');
const app = express();
app.use(
  express.static(resolve('public'), {
    setHeaders(res, file) {
      const cache = staticAssetCacheControl(resolve('public'), file);
      if (cache) res.setHeader('Cache-Control', cache);
    },
  }),
);
app.use(createApp());
const server = app.listen(3007, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const admin = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  timezoneId: 'America/Sao_Paulo',
  reducedMotion: 'reduce',
  extraHTTPHeaders: { Origin: origin },
});
const player = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  timezoneId: 'America/Sao_Paulo',
  reducedMotion: 'reduce',
  extraHTTPHeaders: { Origin: origin },
});
const page = await admin.newPage(),
  playerPage = await player.newPage(),
  errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
playerPage.on('pageerror', (e) => errors.push(e.message));
await mkdir('test-results', { recursive: true });
await mkdir('.local/events-venue-20261030', { recursive: true });
async function openMenu(target: Page) {
  const button = target.getByRole('button', { name: 'Abrir menu dos eventos' });
  if (!(await target.locator('#events-venue-menu').isVisible())) await button.click();
  await expect(target.getByRole('navigation', { name: 'Ambientes dos eventos' })).toBeVisible();
}
async function room(target: Page, name: string) {
  await openMenu(target);
  await target
    .getByRole('navigation', { name: 'Ambientes dos eventos' })
    .getByRole('button', { name, exact: true })
    .click();
  await expect(target.getByRole('navigation', { name: 'Ambientes dos eventos' })).not.toBeVisible();
}
async function talk(target: Page) {
  const host = target.getByRole('button', { name: 'Conversar com o anfitrião dos eventos' });
  const box = (await host.boundingBox())!;
  await target.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.22);
  await expect(
    target.getByRole('region', { name: 'Conversa com o anfitrião dos eventos' }),
  ).toBeVisible();
}
try {
  const signup = async (context: typeof admin, name: string) => {
    const r = await context.request.post(origin + '/api/auth/sign-up/email', {
      headers: { Origin: origin },
      data: {
        name,
        email: 'events-' + randomUUID() + '@example.test',
        password: 'Test-' + randomUUID(),
      },
    });
    expect(r.ok()).toBe(true);
    return (await r.json()).user.id;
  };
  const adminId = await signup(admin, 'Organizador'),
    playerId = await signup(player, 'Viajante');
  // Administração somente de Eventos, sem administrador global.
  await pool.query("INSERT INTO administrator_scopes(user_id,scope)VALUES($1,'events')", [adminId]);
  await createLegacyTestCharacter(adminId, 'Arden');
  const hero = await createLegacyTestCharacter(playerId, 'Bruma');
  await pool.query("UPDATE board_posts SET deleted_at=now() WHERE kind='event'");
  const event = {
    ...structuredClone(blankEvent),
    title: 'Vigília das Lanternas',
    description:
      'Um encontro no Bastião para compartilhar histórias.\n> Traga sua melhor lembrança.',
    starts_at: '2026-11-10T22:00:00.000Z',
    location: 'Átrio do Bastião',
    presentation: { ...blankEvent.presentation, link: '#board', featured: true },
  };
  expect((await admin.request.post(origin + '/api/events', { data: event })).ok()).toBe(true);
  expect(
    (
      await admin.request.post(origin + '/api/events', {
        data: {
          ...event,
          title: 'Crônicas da Aurora',
          status: 'completed',
          presentation: { ...event.presentation, featured: false },
        },
      })
    ).ok(),
  ).toBe(true);
  const goldBefore = (await pool.query('SELECT gold_cp FROM characters WHERE id=$1', [hero.id]))
    .rows[0].gold_cp;
  const writes: string[] = [];
  page.on('request', (r) => {
    if (/\/api\/(?:events|events-scene)/.test(r.url()) && !['GET', 'HEAD'].includes(r.method()))
      writes.push(r.method() + ' ' + new URL(r.url()).pathname);
  });
  await page.goto(origin + '/#events');
  await expect(
    page.getByRole('heading', { name: 'Átrio dos Encontros', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.asset-loading-cover')).toHaveCount(0);
  await expect(
    page.getByRole('region', { name: 'Conversa com o anfitrião dos eventos' }),
  ).toHaveCount(0);
  await expect(page.locator('.events-venue-workspace')).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Ambientes dos eventos' })).not.toBeVisible();
  await openMenu(page);
  await expect(
    page.getByRole('navigation', { name: 'Ambientes dos eventos' }).getByRole('button'),
  ).toHaveCount(3);
  await expect(page.getByRole('button', { name: 'Criar evento', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('navigation', { name: 'Ambientes dos eventos' })).not.toBeVisible();
  await openMenu(page);
  await page.getByRole('heading', { name: 'Átrio dos Encontros', exact: true }).click();
  await expect(page.getByRole('navigation', { name: 'Ambientes dos eventos' })).not.toBeVisible();
  await page.mouse.move(1400, 10);
  await page.screenshot({ path: 'test-results/events-venue-reception-1440.png', fullPage: true });
  await talk(page);
  await expect(page.locator('.events-host-light')).toHaveCSS('opacity', '1');
  await page.screenshot({
    path: 'test-results/events-venue-conversation-1440.png',
    fullPage: true,
  });
  const dialogBox = (await page.locator('.events-host-conversation').boundingBox())!;
  expect(dialogBox.width).toBeLessThanOrEqual(400);
  await expect(page.locator('.events-host-conversation')).toBeInViewport({ ratio: 0.99 });
  await page.getByRole('button', { name: 'Quais são os próximos eventos?', exact: true }).click();
  await expect(page.locator('.events-host-conversation')).toContainText('1 encontro anunciado');
  await page.getByRole('button', { name: 'Consultar a agenda', exact: true }).click();
  await expect(page.locator('.event-feature')).toContainText('Vigília das Lanternas');
  await expect(page.getByRole('link', { name: 'Participar do encontro' })).toHaveAttribute(
    'href',
    '#board',
  );
  await expect(page.locator('.event-feature')).toContainText('10 de novembro de 2026');
  await page.screenshot({ path: 'test-results/events-venue-agenda-1440.png', fullPage: true });
  await room(page, 'Memórias da guilda');
  await expect(page.locator('.event-feature')).toContainText('Crônicas da Aurora');
  await room(page, 'Recepção');
  const host = page.getByRole('button', { name: 'Conversar com o anfitrião dos eventos' });
  await host.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.events-host-conversation')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.events-host-conversation')).toHaveCount(0);
  await expect(host).toBeFocused();
  expect(writes).toEqual([]);
  expect(
    (await pool.query('SELECT gold_cp FROM characters WHERE id=$1', [hero.id])).rows[0].gold_cp,
  ).toBe(goldBefore);

  await openMenu(page);
  await page.getByRole('button', { name: 'Criar evento', exact: true }).click();
  let editor = page.getByRole('dialog', { name: 'Criar evento', exact: true });
  await editor.getByLabel('Título', { exact: true }).fill('O encontro dos cronistas');
  await editor
    .getByLabel('Descrição', { exact: true })
    .fill('Registro preparado pela equipe de Eventos.');
  await editor.getByRole('button', { name: 'Salvar evento', exact: true }).click();
  await expect(editor).not.toBeVisible();
  await expect(page.getByRole('button', { name: /O encontro dos cronistas/ })).toBeVisible();
  await page.getByRole('button', { name: /O encontro dos cronistas/ }).click();
  await page.getByRole('button', { name: 'Editar evento', exact: true }).click();
  editor = page.getByRole('dialog', { name: 'Editar evento', exact: true });
  await editor
    .getByLabel('Descrição', { exact: true })
    .fill('Registro revisado sem perder a publicação.');
  await editor.getByRole('button', { name: 'Salvar evento', exact: true }).click();
  await expect(page.locator('.event-feature')).toContainText('Registro revisado');

  await openMenu(page);
  await page.getByRole('button', { name: 'Editar cenário', exact: true }).click();
  editor = page.getByRole('dialog', { name: 'Editar cenário dos eventos', exact: true });
  await editor.getByLabel('Título da página', { exact: true }).fill('As histórias do Bastião');
  await editor
    .getByLabel('Fundo de tela inteira', { exact: true })
    .selectOption('/events/antechamber-20261030.webp');
  await editor.getByRole('button', { name: 'Salvar cenário', exact: true }).click();
  await expect(editor).not.toBeVisible();
  const savedScene = await (await admin.request.get(origin + '/api/events-scene')).json();
  expect(savedScene.document.background).toBe('/events/antechamber-20261030.webp');
  expect(savedScene.document.title).toBe('As histórias do Bastião');
  expect(
    (
      await admin.request.put(origin + '/api/events-scene', {
        data: { document: savedScene.document, revision: savedScene.revision - 1 },
      })
    ).status(),
  ).toBe(409);

  await playerPage.goto(origin + '/#events');
  await expect(
    playerPage.getByRole('heading', { name: 'Átrio dos Encontros', exact: true }),
  ).toBeVisible();
  await openMenu(playerPage);
  await expect(playerPage.getByRole('button', { name: 'Criar evento', exact: true })).toHaveCount(
    0,
  );
  await expect(playerPage.getByRole('button', { name: 'Editar cenário', exact: true })).toHaveCount(
    0,
  );
  expect((await player.request.post(origin + '/api/events', { data: event })).status()).toBe(403);
  expect(
    (
      await player.request.put(origin + '/api/events-scene', {
        data: { document: savedScene.document, revision: savedScene.revision },
      })
    ).status(),
  ).toBe(403);
  await playerPage.keyboard.press('Escape');
  for (const width of [768, 390, 320]) {
    await playerPage.setViewportSize({ width, height: 900 });
    await room(playerPage, 'Recepção');
    await talk(playerPage);
    await expect(playerPage.locator('.events-host-conversation')).toBeVisible();
    expect(
      await playerPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    const hostBox = (await playerPage.locator('.events-host').boundingBox())!;
    const dialog = (await playerPage.locator('.events-host-conversation').boundingBox())!;
    expect(dialog.y).toBeGreaterThan(hostBox.y + hostBox.height * 0.35);
    await playerPage.screenshot({
      path: 'test-results/events-venue-conversation-' + width + '.png',
      fullPage: true,
    });
    await playerPage.getByRole('button', { name: 'Fechar conversa', exact: true }).click();
    await room(playerPage, 'Agenda de eventos');
    await expect(playerPage.locator('.event-feature')).toContainText('Vigília das Lanternas');
    expect(
      await playerPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    await playerPage.screenshot({
      path: 'test-results/events-venue-agenda-' + width + '.png',
      fullPage: true,
    });
  }
  const asset = await admin.request.get(origin + '/events/host-serious-20261030.webp');
  expect(asset.headers()['cache-control']).toContain('immutable');
  expect((await sharp(await asset.body()).metadata()).hasAlpha).toBe(true);
  expect(errors).toEqual([]);
  await writeFile(
    '.local/events-venue-20261030/browser-result.json',
    JSON.stringify(
      {
        passed: true,
        reception: true,
        conversationAndHalo: true,
        keyboard: true,
        menuDismissal: true,
        navigationAndFilters: true,
        eventCreateAndEdit: true,
        sceneEditor: true,
        scopeOnlyAdministration: true,
        playerWriteDenied: true,
        noConversationWrites: true,
        widths: [1440, 768, 390, 320],
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    'Eventos: recepção, anfitrião com halo e teclado, conversa sem transações, menu compacto, agenda/memórias, edição de eventos/cenário, permissões por área e 1440/768/390/320 verificados.',
  );
} catch (error) {
  await page.screenshot({ path: 'test-results/events-venue-failure.png', fullPage: true });
  await playerPage.screenshot({
    path: 'test-results/events-venue-player-failure.png',
    fullPage: true,
  });
  throw error;
} finally {
  await browser.close();
  await new Promise<void>((r) => server.close(() => r()));
  await pool.end();
}
