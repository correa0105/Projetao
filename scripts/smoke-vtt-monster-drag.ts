import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
if (!/^\/alvorada_test_[0-9a-f]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))
  throw Error('Banco descartável obrigatório.');
const origin = 'http://localhost:3017';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db.js');
const { migrate } = await import('../server/migrate.js');
const { seed } = await import('../server/seed.js');
await migrate();
await seed();
const { createApp } = await import('../server/app.js');
const server = createApp().listen(3017, '127.0.0.1');
await new Promise<void>((resolve) => server.once('listening', resolve));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  extraHTTPHeaders: { 'X-Vtt-Schema-Version': '3' },
});
const page = await ctx.newPage();
const errors: string[] = [],
  premium: { path: string; status: number }[] = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('response', (r) => {
  if (r.url().includes('/api/vtt/premium-art/'))
    premium.push({ path: new URL(r.url()).pathname, status: r.status() });
});
await mkdir('test-results', { recursive: true });
try {
  const response = await ctx.request.post(origin + '/api/auth/sign-up/email', {
    headers: { Origin: origin },
    data: {
      name: 'Mestre de drag',
      email: randomUUID() + '@example.test',
      password: 'Test-' + randomUUID(),
    },
  });
  expect(response.ok()).toBe(true);
  const user = (await response.json()).user;
  await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [user.id]);
  const { createLegacyTestCharacter } = await import('../tests/character-fixtures.js');
  await createLegacyTestCharacter(user.id, 'Arden');
  await page.goto(origin + '/#vtt');
  await page.getByLabel('Nome da mesa', { exact: true }).fill('Drag nativo');
  await page.getByRole('button', { name: 'Criar mesa', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Mesa virtual', exact: true })).toBeVisible();
  const {
    rows: [room],
  } = await pool.query('SELECT id,document FROM vtt_rooms WHERE owner_id=$1', [user.id]);
  await page.evaluate(() => {
    const trace: any[] = [];
    (window as any).__dragTrace = trace;
    for (const type of ['dragstart', 'dragover', 'drop', 'dragend'])
      document.addEventListener(type, (event) => {
        const e = event as DragEvent;
        if (type === 'dragover' && (e.target as Element).tagName !== 'CANVAS') return;
        if (type === 'dragover' && trace.some((t) => t.type === type)) return;
        trace.push({
          type,
          target: (e.target as Element).tagName,
          types: Array.from(e.dataTransfer?.types || []),
          id: e.dataTransfer?.getData('application/x-alvorada-monster'),
          x: e.clientX,
          y: e.clientY,
        });
      });
  });
  const panel = page.locator('.vtt-panel-content'),
    board = page.getByLabel('Tabuleiro da mesa', { exact: true });
  await page.getByRole('button', { name: 'Biblioteca', exact: true }).click();
  await panel.getByRole('button', { name: 'Monstros', exact: true }).click();
  const aboleth = panel.locator('.vtt-compendium > button').filter({ hasText: /^AbolethND/ });
  await expect(aboleth).toHaveAttribute('draggable', 'true');
  await aboleth.locator('img').dragTo(board, { targetPosition: { x: 400, y: 350 } });
  console.log(
    'native trace',
    JSON.stringify(await page.evaluate(() => (window as any).__dragTrace)),
  );
  await expect(board).toHaveAttribute('data-selection-count', '1');
  await expect
    .poll(async () => {
      const {
        rows: [saved],
      } = await pool.query('SELECT document FROM vtt_rooms WHERE id=$1', [room.id]);
      return saved.document.scenes[0].tokens.filter((t: any) => t.name === 'Aboleth').length;
    })
    .toBe(1);
  expect(
    (
      await ctx.request.put(origin + '/api/vtt/premium-tokens', {
        headers: { Origin: origin },
        data: { enabled: true },
      })
    ).ok(),
  ).toBe(true);
  await page.reload();
  await page.getByRole('button', { name: 'Biblioteca', exact: true }).click();
  await panel.getByRole('button', { name: 'Monstros', exact: true }).click();
  await expect(aboleth.locator('img')).toHaveAttribute(
    'src',
    '/api/vtt/premium-art/monster-aboleth',
  );
  const assets = (await (await ctx.request.get(origin + '/api/vtt/premium')).json()).monsters;
  expect(assets.length).toBeGreaterThan(240);
  // Load the full illustrated collection through authenticated browser requests,
  // then drag; its image budget must never consume the document mutation budget.
  const fullCollection = await page.evaluate(
    async (paths: string[]) => {
      const failed: string[] = [];
      let next = 0;
      await Promise.all(
        Array.from({ length: 8 }, async () => {
          while (next < paths.length) {
            const path = paths[next++];
            await new Promise<void>((resolve) => {
              const image = new Image();
              image.onload = () => {
                if (!image.naturalWidth) failed.push(path);
                resolve();
              };
              image.onerror = () => {
                failed.push(path);
                resolve();
              };
              image.src = path;
            });
          }
        }),
      );
      return { total: paths.length, failed };
    },
    assets.map((a: any) => a.image),
  );
  expect(fullCollection.failed).toEqual([]);
  const firstSeven = panel
    .locator('.vtt-compendium > button')
    .filter({ hasText: /^(Aboleth|Adult (Black|Blue|Brass|Bronze|Copper|Gold) Dragon)ND/ });
  await expect(firstSeven).toHaveCount(7);
  await expect
    .poll(async () =>
      firstSeven
        .locator('img')
        .evaluateAll((images) =>
          images.every(
            (i) => (i as HTMLImageElement).complete && (i as HTMLImageElement).naturalWidth > 0,
          ),
        ),
    )
    .toBe(true);
  await aboleth.locator('span').dragTo(board, { targetPosition: { x: 550, y: 350 } });
  const dragon = panel
    .locator('.vtt-compendium > button')
    .filter({ hasText: /^Adult Black DragonND/ });
  await dragon.locator('img').dragTo(board, { targetPosition: { x: 250, y: 550 } });
  await expect
    .poll(async () => {
      const {
        rows: [saved],
      } = await pool.query('SELECT document FROM vtt_rooms WHERE id=$1', [room.id]);
      return saved.document.scenes[0].tokens.map((t: any) => ({ name: t.name, image: t.image }));
    })
    .toEqual(
      expect.arrayContaining([
        { name: 'Aboleth', image: '/api/vtt/premium-art/monster-aboleth' },
        { name: 'Adult Black Dragon', image: '/api/vtt/premium-art/monster-adult-black-dragon' },
      ]),
    );
  await page.screenshot({ path: 'test-results/vtt-native-monster-drag.png' });
  const premiumErrors = premium.filter((r) => r.status !== 200);
  expect(premiumErrors).toEqual([]);
  console.log(
    'Acervo premium',
    JSON.stringify({
      total: fullCollection.total,
      loadedResponses: premium.length,
      firstSevenLoaded: true,
      premiumErrors,
    }),
  );
  await page.reload();
  const ownerState = await (await ctx.request.get(origin + `/api/vtt/rooms/${room.id}`)).json();
  expect(ownerState.is_gm).toBe(true);
  expect(ownerState.document.scenes[0].tokens).toHaveLength(3);
  const playerCtx = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    extraHTTPHeaders: { 'X-Vtt-Schema-Version': '3' },
  });
  const signup = await playerCtx.request.post(origin + '/api/auth/sign-up/email', {
    headers: { Origin: origin },
    data: {
      name: 'Jogador de drag',
      email: randomUUID() + '@example.test',
      password: 'Test-' + randomUUID(),
    },
  });
  expect(signup.ok()).toBe(true);
  const playerState = await playerCtx.request.post(origin + '/api/vtt/join', {
    headers: { Origin: origin },
    data: { invite: ownerState.invite, role: 'player' },
  });
  expect(playerState.ok()).toBe(true);
  expect((await playerState.json()).is_gm).toBe(false);
  const playerPage = await playerCtx.newPage();
  playerPage.on('pageerror', (e) => errors.push(e.message));
  await playerPage.goto(origin + '/#vtt');
  await playerPage.getByRole('button', { name: 'Biblioteca', exact: true }).click();
  await playerPage
    .locator('.vtt-panel-content')
    .getByRole('button', { name: 'Monstros', exact: true })
    .click();
  const playerAboleth = playerPage
    .locator('.vtt-compendium > button')
    .filter({ hasText: /^AbolethND/ });
  await expect(playerAboleth).toHaveAttribute('draggable', 'false');
  const transfer = await playerPage.evaluateHandle(() => {
    const transfer = new DataTransfer();
    transfer.setData('application/x-alvorada-monster', 'monster-aboleth');
    return transfer;
  });
  await playerPage
    .getByLabel('Tabuleiro da mesa', { exact: true })
    .dispatchEvent('drop', { dataTransfer: transfer, clientX: 400, clientY: 400 });
  expect(
    (
      await playerCtx.request.put(origin + `/api/vtt/rooms/${room.id}`, {
        headers: { Origin: origin },
        data: { revision: ownerState.revision, document: ownerState.document },
      })
    ).status(),
  ).toBe(403);
  expect(
    (await pool.query('SELECT document FROM vtt_rooms WHERE id=$1', [room.id])).rows[0].document
      .scenes[0].tokens,
  ).toHaveLength(3);
  await playerCtx.close();
  expect(errors).toEqual([]);
  console.log(
    'VTT drag nativo: miniatura/linha → canvas cria e persiste após330 artes; reload mantém3tokens, jogador não pode inserir.',
  );
} finally {
  await browser.close();
  await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
  await pool.end();
}
