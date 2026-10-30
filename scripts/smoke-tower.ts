import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import express from 'express';
import { resolve } from 'node:path';
import { optimizedPublicImages } from '../server/optimized-public-images';
import { staticAssetCacheControl } from '../server/static-asset-cache';
if (!new URL(process.env.DATABASE_URL!).pathname.startsWith('/alvorada_test_'))
  throw Error('Banco isolado obrigatório.');
const origin = 'http://localhost:3006';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db.js'),
  { migrate } = await import('../server/migrate.js'),
  { seed } = await import('../server/seed.js'),
  { createLegacyTestCharacter } = await import('../tests/character-fixtures.js');
await migrate();
await seed();
const { createApp } = await import('../server/app.js');
const app = express();
app.use(optimizedPublicImages(resolve('public')));
app.use(
  express.static(resolve('public'), {
    setHeaders(res, file) {
      const cache = staticAssetCacheControl(resolve('public'), file);
      if (cache) res.setHeader('Cache-Control', cache);
    },
  }),
);
app.use(createApp());
const server = app.listen(3006, '127.0.0.1');
await new Promise<void>((resolve) => server.once('listening', resolve));
const browser = await chromium.launch({ channel: 'msedge', headless: true }),
  ctx = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
  }),
  playerContext = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    reducedMotion: 'reduce',
  }),
  page = await ctx.newPage(),
  playerPage = await playerContext.newPage(),
  errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
playerPage.on('pageerror', (e) => errors.push(e.message));
await mkdir('test-results', { recursive: true });
async function openRooms(target: typeof page) {
  const trigger = target.getByRole('button', { name: 'Abrir menu de salas', exact: true });
  if ((await trigger.getAttribute('aria-expanded')) !== 'true') await trigger.click();
  const nav = target.getByRole('navigation', { name: 'Salas da sede' });
  await expect(nav).toBeVisible();
  return nav;
}
async function chooseRoom(target: typeof page, name: string) {
  const nav = await openRooms(target);
  await nav.getByRole('button', { name, exact: true }).click();
  await expect(nav).not.toBeVisible();
  await expect(
    target.getByRole('button', { name: 'Abrir menu de salas', exact: true }),
  ).toHaveAttribute('aria-expanded', 'false');
}
async function clickClerk(target: typeof page) {
  const image = target.locator('.tower-headquarters-scene img');
  const box = (await image.boundingBox())!;
  const native = await image.evaluate((el: HTMLImageElement) => ({
    width: el.naturalWidth,
    height: el.naturalHeight,
  }));
  const room = await target.locator('.tower-headquarters').getAttribute('data-room');
  const face: Record<string, [number, number]> = {
    reception: [480, 270],
    atlas: [407, 320],
    expeditions: [480, 240],
    crystals: [480, 280],
    treasures: [480, 280],
  };
  const [x, y] = face[room!],
    point = {
      x: box.x + (x / native.width) * box.width,
      y: box.y + (y / native.height) * box.height,
    };
  expect(
    await target.evaluate(
      ({ x, y }) => document.elementFromPoint(x, y)?.classList.contains('tower-clerk-contour'),
      point,
    ),
  ).toBe(true);
  await target.mouse.move(point.x, point.y);
  await target.screenshot({
    path: 'test-results/tower-clerk-' + room + '-' + target.viewportSize()!.width + '.png',
    fullPage: true,
  });
  await target.mouse.click(point.x, point.y);
  await expect(target.getByRole('region', { name: 'Conversa com a atendente' })).toBeVisible();
}
try {
  const signup = async (context: typeof ctx, name: string) => {
    const r = await context.request.post(origin + '/api/auth/sign-up/email', {
      headers: { Origin: origin },
      data: {
        name,
        email: `tower-ui-${randomUUID()}@example.test`,
        password: `Test-${randomUUID()}`,
      },
    });
    expect(r.ok()).toBe(true);
    return (await r.json()).user.id;
  };
  const gmId = await signup(ctx, 'Mestre da torre'),
    pId = await signup(playerContext, 'Viajante da torre');
  await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [gmId]);
  const gmHero = await createLegacyTestCharacter(gmId, 'Arden da aurora'),
    pHero = await createLegacyTestCharacter(pId, 'Bruma');
  const roomRequests: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/tower/headquarters-')) roomRequests.push(new URL(r.url()).pathname);
  });
  await page.goto(origin + '/#tower');
  await expect(
    page.getByRole('heading', { name: 'Diretoria da Torre', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Salas da sede' })).not.toBeVisible();
  await expect((await openRooms(page)).getByRole('button')).toHaveCount(5);
  await page.screenshot({ path: 'test-results/tower-rooms-menu-desktop.png', fullPage: true });
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('button', { name: 'Abrir menu de salas', exact: true }),
  ).toBeFocused();
  await expect(page.getByRole('navigation', { name: 'Salas da sede' })).not.toBeVisible();
  await openRooms(page);
  await page.locator('.tower-room-heading').click();
  await expect(page.getByRole('navigation', { name: 'Salas da sede' })).not.toBeVisible();
  await expect(page.locator('.tower-headquarters-header')).toHaveCSS('border-bottom-width', '0px');
  await expect(page.locator('.tower-conversation')).toHaveCount(0);
  await expect(page.locator('.tower-headquarters-footer,.tower-clerk-hotspot')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Torre do Véu', exact: true })).toHaveCount(0);
  expect((await page.locator('.tower-room-heading').boundingBox())!.y).toBeLessThan(50);
  await clickClerk(page);
  expect((await page.locator('.tower-conversation').boundingBox())!.width).toBeLessThanOrEqual(400);
  await expect(page.locator('.tower-headquarters-scene img')).toHaveAttribute(
    'src',
    '/tower/headquarters-reception-20261030.webp',
  );
  await expect(page.locator('.tower-headquarters-scene img')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: 'test-results/tower-reception-desktop.png', fullPage: true });
  expect([...new Set(roomRequests)]).toEqual(['/tower/headquarters-reception-20261030.webp']);
  const beforeTalk = await (await ctx.request.get(origin + '/api/tower')).json();
  await page.getByRole('button', { name: 'Quero conhecer a Torre.', exact: true }).click();
  await expect(page.locator('.tower-conversation-answer')).toContainText('cem andares');
  await page.getByRole('button', { name: 'Fechar conversa', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Conversar com Lia', exact: true })).toBeFocused();
  await expect(page.locator('.tower-conversation')).not.toBeVisible();
  await page.getByRole('button', { name: 'Conversar com Lia', exact: true }).press('Enter');
  await expect(page.locator('.tower-conversation')).toBeVisible();
  // A transição espera a nova imagem sem reabrir o loading geral ou apagar a sala atual.
  await page.route('**/tower/headquarters-archive-gaze-20261030.webp', async (route) => {
    await new Promise((r) => setTimeout(r, 800));
    await route.continue();
  });
  await page.getByRole('button', { name: 'Acompanhar Lia até o arquivo', exact: true }).click();
  await expect(page.locator('.tower-room-status')).toBeVisible();
  await expect(page.locator('.tower-headquarters-scene img')).toHaveAttribute(
    'src',
    '/tower/headquarters-reception-20261030.webp',
  );
  await expect(page.locator('.asset-loading-cover')).toHaveCount(0);
  await expect(page.locator('.tower-headquarters-scene img')).toHaveAttribute(
    'src',
    '/tower/headquarters-archive-gaze-20261030.webp',
  );
  await page.unroute('**/tower/headquarters-archive-gaze-20261030.webp');
  await chooseRoom(page, 'Cristais');
  await expect(page.locator('.tower-headquarters-scene img')).toHaveAttribute(
    'src',
    '/tower/headquarters-crystals-20261030.webp',
  );
  await clickClerk(page);
  await page.getByRole('button', { name: 'Voltar aos registros', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Seu registro no Véu.', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.tower-crystal-balance strong')).toHaveText('0');
  await page
    .getByRole('button', { name: 'Como funciona o comércio de cristais?', exact: true })
    .click();
  await expect(page.locator('.tower-conversation-answer')).toContainText(
    'entreposto ainda não está aberto',
  );
  await page.getByRole('button', { name: 'Em que os cristais são usados?', exact: true }).click();
  await expect(page.locator('.tower-conversation-answer')).toContainText(
    'Ainda não existe um serviço de gasto',
  );
  await page.getByRole('button', { name: 'Voltar aos registros', exact: true }).click();
  await expect(page.locator('.tower-headquarters-scene img')).toHaveAttribute(
    'src',
    '/tower/headquarters-crystals-20261030.webp',
  );
  expect(
    (await page.locator('.tower-headquarters-service').boundingBox())!.width,
  ).toBeLessThanOrEqual(445);
  await page.screenshot({ path: 'test-results/tower-crystals-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 1896, height: 927 });
  await page.screenshot({ path: 'test-results/tower-crystals-wide.png', fullPage: true });
  expect(
    (await page.locator('.tower-headquarters-service').boundingBox())!.width,
  ).toBeLessThanOrEqual(445);
  await expect(
    page.getByRole('button', { name: 'Consultar meus tesouros', exact: true }),
  ).toBeInViewport({ ratio: 1 });
  await page.setViewportSize({ width: 1440, height: 1000 });
  const afterTalk = await (await ctx.request.get(origin + '/api/tower')).json();
  expect(afterTalk.wallets).toEqual(beforeTalk.wallets);
  expect(afterTalk.claims).toEqual(beforeTalk.claims);
  expect(afterTalk.expeditions).toEqual(beforeTalk.expeditions);
  await chooseRoom(page, 'Arquivo da Torre');
  await expect(page.getByRole('heading', { name: 'Torre do Véu', exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Escolher andar', { exact: true }).locator('option')).toHaveCount(
    100,
  );
  await expect(page.locator('.tower-loot-preview')).not.toHaveAttribute('open');
  await page.getByRole('button', { name: 'Consultar tabela d100' }).click();
  await expect(page.locator('.tower-loot-preview')).toHaveAttribute('open');
  await page.locator('.tower-loot-preview > summary').click();
  await page.getByRole('button', { name: 'Consultar tabela d100' }).click();
  await page.getByRole('button', { name: 'Editar andar', exact: true }).click();
  let editor = page.getByRole('dialog', { name: 'Editar andar da torre' });
  await expect(editor.getByLabel('Nome do andar')).toBeFocused();
  await editor.getByLabel('Nome do andar').fill('Portas sem Nome');
  await editor.getByLabel('Descrição pública').fill('A entrada sob uma torre de pedra.');
  await editor.getByLabel('Desafio', { exact: true }).fill('Encontrem a chave da porta.');
  await editor
    .getByLabel('Armadilhas', { exact: true })
    .fill('Uma placa de pressão aciona o corredor.');
  for (const [i, name] of ['Skeleton', 'Giant Spider', 'Ogre'].entries()) {
    await editor.getByRole('button', { name: 'Adicionar criatura' }).click();
    await editor.getByLabel('Nome da criatura ' + (i + 1), { exact: true }).fill(name);
    await editor.getByLabel('Arte da criatura ' + (i + 1), { exact: true }).fill(name);
  }
  await editor.getByRole('button', { name: 'Salvar andar' }).click();
  await expect(editor).toHaveCount(0);
  await expect(page.locator('.tower-creatures img')).toHaveCount(3);
  await page.getByRole('button', { name: 'Editar prêmios', exact: true }).click();
  let prizes = page.getByRole('dialog', { name: 'Editar prêmios da torre' });
  await prizes
    .locator('fieldset')
    .first()
    .getByLabel('Item do catálogo')
    .selectOption('plate-armor');
  await prizes.getByLabel('Quantidade do item').fill('2');
  await prizes.getByRole('button', { name: 'Salvar prêmios' }).click();
  await expect(prizes).toHaveCount(0);
  await page.locator('.tower-loot-preview .tower-item-link').first().click();
  const itemDialog = page.getByRole('dialog');
  await expect(itemDialog.locator('.tower-item-art')).toBeVisible();
  await expect(itemDialog.locator('.tower-item-description')).not.toBeEmpty();
  await itemDialog.getByRole('button', { name: 'Fechar informações do item' }).click();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: 'test-results/tower-atlas-desktop.png', fullPage: true });
  await page.getByLabel('Escolher andar', { exact: true }).selectOption('6');
  await expect(page.getByRole('heading', { name: 'Andar 6', exact: true })).toBeVisible();
  await page.getByLabel('Escolher andar', { exact: true }).selectOption('10');
  await page.getByRole('button', { name: 'Editar andar', exact: true }).click();
  editor = page.getByRole('dialog', { name: 'Editar andar da torre' });
  await editor.getByLabel('Nome do guardião').fill('Matriarca Prismática');
  await editor.getByRole('button', { name: 'Salvar andar' }).click();
  await expect(editor).toHaveCount(0);
  await expect(page.locator('.tower-boss')).toContainText('Matriarca Prismática');
  await expect(page.locator('.tower-treasure-tier')).toContainText('2');
  await page.screenshot({ path: 'test-results/tower-boss-desktop.png', fullPage: true });
  await chooseRoom(page, 'Expedições');
  await expect(page.locator('.tower-headquarters-scene img')).toHaveAttribute(
    'src',
    '/tower/headquarters-expeditions-paper-20261030.webp',
  );
  await clickClerk(page);
  await page.getByRole('button', { name: 'Voltar aos registros', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Reúna a expedição.', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Nova expedição', exact: true }).click();
  await page.getByLabel('Nome da expedição', { exact: true }).fill('Os que voltam com a aurora');
  await page.getByRole('button', { name: 'Abrir expedição', exact: true }).click();
  await page.getByRole('button', { name: 'Arden da aurora', exact: true }).click();
  await page.getByRole('button', { name: /^Encerradas/ }).click();
  await expect(page.locator('.tower-filter-empty')).toBeVisible();
  await expect(page.locator('.tower-run-detail')).toHaveCount(0);
  await page.getByRole('button', { name: /^Reunindo grupo/ }).click();
  await expect(page.locator('.tower-party')).toContainText('Arden da aurora');
  await playerPage.goto(origin + '/#tower');
  await chooseRoom(playerPage, 'Arquivo da Torre');
  await expect(playerPage.locator('.tower-hidden')).toBeVisible();
  await expect(playerPage.locator('.tower-creatures img')).toHaveCount(0);
  await expect(playerPage.getByRole('button', { name: 'Editar andar', exact: true })).toHaveCount(
    0,
  );
  await chooseRoom(playerPage, 'Expedições');
  await expect(playerPage.getByRole('button', { name: 'Nova expedição', exact: true })).toHaveCount(
    0,
  );
  await playerPage.getByRole('button', { name: 'Bruma', exact: true }).click();
  await page.reload();
  await chooseRoom(page, 'Expedições');
  await expect(page.locator('.tower-party')).toContainText('Bruma');
  await page.getByRole('button', { name: 'Iniciar ascensão', exact: true }).click();
  await expect(
    page.getByLabel('Filtrar expedições').getByRole('button', { name: /^Em ascensão/ }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.tower-run-detail')).toBeVisible();
  for (let floor = 1; floor <= 5; floor++) {
    await page
      .getByRole('button', {
        name: floor === 5 ? 'Confirmar derrota do guardião' : 'Concluir andar ' + floor,
        exact: true,
      })
      .click();
    const dialog = page.getByRole('dialog', { name: 'Confirmar progresso da torre', exact: true });
    await expect(dialog).toBeVisible();
    if (floor === 5) await expect(dialog).toContainText('O guardião foi derrotado?');
    await dialog.getByRole('button', { name: 'Confirmar', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page.locator('.tower-run-progress>b')).toHaveText(String(floor).padStart(2, '0'));
  }
  await expect(page.locator('.tower-run-progress')).toContainText('tesouro grau 1');
  await expect(page.getByRole('progressbar', { name: 'Andares concluídos' })).toHaveAttribute(
    'aria-valuenow',
    '5',
  );
  await page.screenshot({ path: 'test-results/tower-expedition-desktop.png', fullPage: true });
  await chooseRoom(page, 'Arquivo da Torre');
  await page.getByRole('button', { name: 'Ver próximo andar · 6', exact: true }).click();
  await expect(page.getByLabel('Escolher andar', { exact: true })).toHaveValue('6');
  await page.getByRole('button', { name: 'Abrir minha expedição', exact: true }).click();
  await expect(page.locator('.tower-run-detail')).toContainText('Os que voltam com a aurora');
  await playerPage.reload();
  await chooseRoom(playerPage, 'Arquivo da Torre');
  await expect(playerPage.locator('.tower-creatures img')).toHaveCount(3);
  await expect(playerPage.locator('.tower-traps')).toContainText('placa de pressão');
  await playerPage.getByLabel('Escolher andar', { exact: true }).selectOption('6');
  await expect(playerPage.locator('.tower-hidden')).toBeVisible();
  await page.getByRole('button', { name: 'Retornar e recompensar', exact: true }).click();
  const completion = page.getByRole('dialog', { name: 'Confirmar progresso da torre' });
  await completion
    .getByLabel('Registro da expedição')
    .fill('O Porteiro de Ferro caiu. A companhia retornou inteira.');
  await completion
    .getByRole('button', { name: 'Confirmar retorno e entregar', exact: true })
    .click();
  await expect(completion).not.toBeVisible();
  await expect(page.getByRole('button', { name: /^Encerradas/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('.tower-return')).toBeVisible();
  await playerPage.reload();
  await chooseRoom(playerPage, 'Tesouros');
  await expect(
    playerPage.getByRole('button', { name: 'Rolar d100 e revelar', exact: true }),
  ).toBeVisible();
  await playerPage.getByRole('button', { name: 'Rolar d100 e revelar', exact: true }).click();
  await expect(playerPage.locator('.tower-roll-result')).toBeVisible();
  expect(Number(await playerPage.locator('.tower-d100 b').textContent())).toBeGreaterThanOrEqual(1);
  expect(Number(await playerPage.locator('.tower-d100 b').textContent())).toBeLessThanOrEqual(100);
  await expect(
    playerPage.getByRole('button', { name: 'Rolar d100 e revelar', exact: true }),
  ).toHaveCount(0);
  await playerPage.screenshot({ path: 'test-results/tower-treasure-desktop.png', fullPage: true });
  await playerPage.reload();
  await chooseRoom(playerPage, 'Tesouros');
  await expect(playerPage.locator('.tower-roll-result')).toBeVisible();
  for (const width of [768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(origin + '/#tower');
    await chooseRoom(page, 'Recepção');
    await page.screenshot({ path: `test-results/tower-reception-${width}.png`, fullPage: true });
    await clickClerk(page);
    await page.getByRole('button', { name: 'Quero conhecer a Torre.', exact: true }).click();
    await page.getByRole('button', { name: 'Acompanhar Lia até o arquivo', exact: true }).click();
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
    await expect(page.locator('.tower-atlas')).toBeVisible();
    const heading = (await page.locator('.tower-room-heading').boundingBox())!;
    expect(heading.y).toBeGreaterThanOrEqual(72);
    expect(heading.y).toBeLessThan(110);
    await clickClerk(page);
    await page.getByRole('button', { name: 'Voltar aos registros', exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await page.screenshot({ path: `test-results/tower-atlas-${width}.png`, fullPage: true });
    await chooseRoom(page, 'Expedições');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await page.screenshot({ path: `test-results/tower-expedition-${width}.png`, fullPage: true });
    await chooseRoom(page, 'Tesouros');
    await expect(page.locator('.tower-claim')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await page.screenshot({ path: `test-results/tower-treasure-${width}.png`, fullPage: true });
  }
  // O cenário personalizado acompanha toda a viewport e só existe na visão do viajante.
  await pool.query(
    `INSERT INTO player_profiles(user_id,document) VALUES($1,$2::jsonb)
     ON CONFLICT(user_id) DO UPDATE SET document=EXCLUDED.document`,
    [
      gmId,
      JSON.stringify({
        background: '/tower/tower-veil-v2.webp',
        bio: 'A companhia prepara a próxima jornada. '.repeat(35),
      }),
    ],
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(origin + '/#profiles?user=' + gmId);
  await page.getByRole('button', { name: 'Abrir perfil de Mestre da torre', exact: true }).click();
  await expect(page.locator('.player-profile-home')).toBeVisible();
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => scrollTo(0, 0));
    const backdrop = page.locator('.player-profile-backdrop');
    await expect(backdrop).toHaveCSS('position', 'fixed');
    await expect(backdrop).toHaveCSS('background-size', 'auto, cover, auto');
    expect(await backdrop.evaluate((el) => getComputedStyle(el).backgroundImage)).toContain(
      '/tower/tower-veil-v2.webp',
    );
    expect(await backdrop.boundingBox()).toEqual({ x: 0, y: 0, width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await page.screenshot({
      path: `test-results/profile-full-background-${width}.png`,
      fullPage: false,
    });
    await page.evaluate(() => scrollTo(0, 350));
    expect(await backdrop.boundingBox()).toEqual({ x: 0, y: 0, width, height: 900 });
  }
  await page.locator('.player-character-showcase button').first().click();
  await expect(page.locator('.player-profile-backdrop')).toHaveCount(0);
  await expect(page.locator('.public-camp')).toBeVisible();
  expect(
    await page.locator('.public-camp').evaluate((el) => getComputedStyle(el).backgroundImage),
  ).toContain('character-camp-v2.png');
  const wallet = (
    await pool.query('SELECT crystals FROM tower_wallets WHERE character_id=$1', [pHero.id])
  ).rows[0];
  expect(wallet.crystals).toBeGreaterThan(18);
  expect(
    (
      await pool.query(
        'SELECT count(*)::int AS count FROM tower_claims WHERE run_id=(SELECT id FROM tower_expeditions LIMIT 1)',
      )
    ).rows[0].count,
  ).toBe(2);
  expect(errors).toEqual([]);
  console.log(
    'Torre: contorno de Lia clicável e com teclado, título da sala no topo, sem rodapé e plaquinha, menu recolhido com Escape e clique externo, conversas sem transações, salas sob demanda, visualização, navegação, filtros, 100 andares, sigilo, edição, expedição, retorno e d100 persistente. Torre e perfil com fundo de viewport em 1440/768/390/320 verificados; acampamento preservado.',
  );
} catch (e) {
  await page.screenshot({ path: 'test-results/tower-failure.png', fullPage: true });
  throw e;
} finally {
  await browser.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.end();
}
