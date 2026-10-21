import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { createHash, randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { mkdir, readFile } from 'node:fs/promises';
if (!new URL(process.env.DATABASE_URL!).pathname.startsWith('/alvorada_test_'))
  throw Error('Banco descartável obrigatório.');
const reserve = createServer();
await new Promise<void>((resolve) => reserve.listen(0, '127.0.0.1', resolve));
const address = reserve.address();
if (!address || typeof address === 'string') throw Error('Porta indisponível.');
await new Promise<void>((resolve) => reserve.close(() => resolve()));
const origin = `http://127.0.0.1:${address.port}`;
process.env.APP_ORIGIN = origin;
process.env.BETTER_AUTH_URL = origin;
process.env.MAINTENANCE_AREAS = 'events,tower';
const { pool } = await import('../server/db.js');
const { migrate } = await import('../server/migrate.js');
const { seed } = await import('../server/seed.js');
await migrate();
await seed();
const { createApp } = await import('../server/app.js');
const { createLegacyTestCharacter } = await import('../tests/character-fixtures.js');
const server = createApp().listen(address.port, '127.0.0.1');
await new Promise<void>((resolve) => server.once('listening', resolve));
const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL || 'msedge',
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  reducedMotion: 'reduce',
});
const errors: string[] = [];
page.on('pageerror', (error) => errors.push(error.message));
await mkdir('test-results/portal-controls', { recursive: true });
try {
  const response = await page.request.post(origin + '/api/auth/sign-up/email', {
    headers: { Origin: origin },
    data: {
      name: 'Administrador de revisão',
      email: randomUUID() + '@example.test',
      password: randomUUID(),
    },
  });
  expect(response.status()).toBe(200);
  const { user } = await response.json();
  await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [user.id]);
  await createLegacyTestCharacter(user.id, 'Viajante da revisão');
  const missionId = randomUUID();
  await pool.query(
    "INSERT INTO board_posts(id,kind,title,description,location,difficulty) VALUES($1,'mission','Missão para moderação','Missão de outro autor para revisão da interface.','Vigília','Tranquila')",
    [missionId],
  );
  await page.goto(origin + '/#board');
  await page
    .getByRole('button', { name: 'Abrir aviso: Missão para moderação', exact: true })
    .click();
  await page.getByRole('button', { name: 'Excluir missão', exact: true }).click();
  const confirmation = page.getByRole('dialog', { name: 'Excluir missão do mural', exact: true });
  await expect(confirmation).toContainText('recompensas já entregues serão mantidos');
  await page.screenshot({ path: 'test-results/portal-controls/mission-admin-delete.png' });
  await confirmation.getByRole('button', { name: 'Cancelar', exact: true }).click();
  expect(
    (await pool.query('SELECT deleted_at FROM board_posts WHERE id=$1', [missionId])).rows[0]
      .deleted_at,
  ).toBeNull();
  await page.getByRole('button', { name: 'Excluir missão', exact: true }).click();
  await confirmation.getByRole('button', { name: 'Excluir missão', exact: true }).click();
  await expect(confirmation).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Abrir aviso: Missão para moderação', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Dispensar aviso', exact: true }).click();
  const eventId = randomUUID();
  await pool.query(
    "INSERT INTO board_posts(id,kind,title,description,location,difficulty,status) VALUES($1,'event','Evento para moderação','Evento sem autor para revisão.','Bastião','Tranquila','active')",
    [eventId],
  );
  await page.reload();
  await page
    .getByRole('button', { name: 'Abrir aviso: Evento para moderação', exact: true })
    .click();
  await page.getByRole('button', { name: 'Excluir evento', exact: true }).click();
  const eventConfirmation = page.getByRole('dialog', {
    name: 'Excluir evento do mural',
    exact: true,
  });
  await eventConfirmation.getByRole('button', { name: 'Cancelar', exact: true }).click();
  expect(
    (await pool.query('SELECT deleted_at FROM board_posts WHERE id=$1', [eventId])).rows[0]
      .deleted_at,
  ).toBeNull();
  await page.getByRole('button', { name: 'Excluir evento', exact: true }).click();
  await page.screenshot({ path: 'test-results/portal-controls/event-admin-delete.png' });
  await eventConfirmation.getByRole('button', { name: 'Excluir evento', exact: true }).click();
  await expect(eventConfirmation).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Abrir aviso: Evento para moderação', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Dispensar aviso', exact: true }).click();
  await page.getByRole('button', { name: 'Abrir navegação', exact: true }).click();
  await page.getByRole('button', { name: 'Mural', exact: true }).click();
  await expect(
    page
      .getByRole('navigation', { name: 'Navegação principal' })
      .getByRole('button', { name: 'Eventos', exact: true }),
  ).toBeEnabled();
  await expect(
    page
      .getByRole('navigation', { name: 'Navegação principal' })
      .getByRole('button', { name: 'Torre', exact: true }),
  ).toBeEnabled();
  await page.screenshot({ path: 'test-results/portal-controls/maintenance-menu.png' });
  await page.goto(origin + '/#events');
  await expect(page.getByRole('button', { name: 'Editar cenário', exact: true })).toBeVisible();
  await page.goto(origin + '/#tower');
  await expect(page.locator('.tower-page')).toBeVisible();
  const playerContext = await browser.newContext();
  const signupPlayer = await playerContext.request.post(origin + '/api/auth/sign-up/email', {
    headers: { Origin: origin },
    data: {
      name: 'Jogador em manutenção',
      email: randomUUID() + '@example.test',
      password: randomUUID(),
    },
  });
  expect(signupPlayer.status()).toBe(200);
  const playerPage = await playerContext.newPage();
  for (const [route, title] of [
    ['events', 'Eventos em manutenção'],
    ['tower', 'Torre em manutenção'],
  ]) {
    await playerPage.goto(origin + '/#' + route);
    await expect(playerPage.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await expect(
      playerPage.getByRole('button', { name: 'Voltar ao mural', exact: true }),
    ).toBeVisible();
  }
  await playerContext.close();
  for (const [width, height] of [
    [1440, 900],
    [1024, 768],
    [813, 600],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto(origin + '/#cards');
    const heading = page.locator('.cards-room > .cards-room-content > header');
    const workbench = page.locator('.cards-workbench');
    await expect(
      heading.getByRole('heading', { name: 'Histórias que escolhem companhia.', exact: true }),
    ).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const headerBox = await heading.boundingBox(),
      panelBox = await workbench.boundingBox(),
      pageHeader = await page.locator('.page-header').boundingBox();
    expect(headerBox).not.toBeNull();
    expect(panelBox).not.toBeNull();
    expect(headerBox!.y - (pageHeader!.y + pageHeader!.height)).toBeGreaterThanOrEqual(12);
    expect(panelBox!.y - (headerBox!.y + headerBox!.height)).toBeGreaterThanOrEqual(12);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(panelBox!.height).toBeGreaterThan(120);
    await page.screenshot({
      path: `test-results/portal-controls/cards-${width}.png`,
      fullPage: true,
    });
  }
  const mapFile = await readFile('public/kingdom/reino-do-norte-20261021.jpg');
  expect(createHash('sha256').update(mapFile).digest('hex')).toBe(
    '49fe342adf41f87ff7f92dd12d534aba8cc4cf7b20a65ceef9199e2e57c29673',
  );
  for (const [width, height] of [
    [1440, 900],
    [813, 600],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto(origin + '/#world');
    await expect(page.locator('.world-map')).toHaveAttribute('data-status', 'ready', {
      timeout: 60000,
    });
    const imageResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith('/kingdom/reino-do-norte-20261021.jpg') &&
        response.status() === 200,
    );
    await page.getByRole('button', { name: 'Reino do Norte', exact: true }).click();
    const region = page.getByRole('region', { name: 'Mapa do Reino do Norte', exact: true });
    await expect(region).toHaveAttribute('data-status', 'ready', { timeout: 60000 });
    await expect(region).toHaveAttribute('data-image-width', '4096');
    await expect(region).toHaveAttribute('data-image-height', '2633');
    await expect(region).toHaveAttribute('data-tilt', '1');
    await expect(region).toHaveAttribute('data-zoom', '1.5000');
    await expect(region).toHaveAttribute('data-min-zoom', '1.5000');
    await expect(region).toHaveAttribute('data-max-zoom', '1.5000');
    await expect(region.locator('.kingdom-map__controls')).toHaveCount(0);
    const expectFilledViewport = async () => {
      await expect
        .poll(async () =>
          region.evaluate((element) => {
            const box = element.getBoundingClientRect();
            return [box.x, box.y, box.width, box.height];
          }),
        )
        .toEqual([0, 0, (await page.viewportSize())!.width, (await page.viewportSize())!.height]);
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          ),
      );
      const corners = await region.locator('canvas').evaluate((canvas) => {
        const image = canvas as HTMLCanvasElement;
        const context = image.getContext('2d')!;
        return [
          [2, 2],
          [image.width - 3, 2],
          [2, image.height - 3],
          [image.width - 3, image.height - 3],
        ].map(([x, y]) => [...context.getImageData(x, y, 1, 1).data].slice(0, 3).join(','));
      });
      for (const color of corners)
        expect(color, 'A imagem deve cobrir todos os cantos.').not.toBe('23,31,32');
    };
    await expectFilledViewport();
    const regionalHeading = await page.locator('.world-atlas-heading').boundingBox();
    const hud = await page.locator('.page-header .player-hud').boundingBox();
    await page.screenshot({ path: `test-results/portal-controls/north-map-${width}.png` });
    await expect(page.getByRole('heading', { name: 'Mapa Alvorada', exact: true })).toHaveCount(0);
    expect(regionalHeading!.y).toBeLessThanOrEqual(width <= 600 ? 70 : 20);
    expect(regionalHeading!.x + regionalHeading!.width <= hud!.x || regionalHeading!.y >= hud!.y + hud!.height).toBe(true);
    const response = await imageResponse;
    expect(
      createHash('sha256')
        .update(await response.body())
        .digest('hex'),
    ).toBe(createHash('sha256').update(mapFile).digest('hex'));
    await page.mouse.move(width * 0.5, height * 0.6);
    await page.mouse.wheel(0, -2400);
    await page.mouse.wheel(0, 2400);
    await region.focus();
    for (const key of ['+', '-', 'q', 'e', 'Home']) await page.keyboard.press(key);
    await expect(region).toHaveAttribute('data-zoom', '1.5000');
    await expect(region).toHaveAttribute('data-angle', '0.000000');
    const beforePan = await region.getAttribute('data-pan-x');
    await page.mouse.move(width * 0.5, height * 0.6);
    await page.mouse.down();
    await page.mouse.move(width * 0.7, height * 0.7, { steps: 8 });
    await page.mouse.up();
    await expect(region).not.toHaveAttribute('data-pan-x', beforePan!);
    await expectFilledViewport();
    if (width === 390) {
      const touch = await page.context().newCDPSession(page);
      const points = (spread: number) => [
        { x: width * (0.5 - spread), y: height * 0.6, id: 0 },
        { x: width * (0.5 + spread), y: height * 0.6, id: 1 },
      ];
      await touch.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: points(0.12),
      });
      await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points(0.3) });
      await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await touch.detach();
      await expect(region).toHaveAttribute('data-zoom', '1.5000');
      await expectFilledViewport();
    }
    await page.setViewportSize({ width: width + 25, height: height + 35 });
    await expectFilledViewport();
    await expect(region).toHaveAttribute('data-zoom', '1.5000');
    await page.setViewportSize({ width, height });
    await expectFilledViewport();
    await expect(
      page.getByRole('button', { name: 'Abrir missões do Reino do Norte', exact: true }),
    ).toBeVisible();
    await page
      .getByRole('button', { name: 'Abrir missões do Reino do Norte', exact: true })
      .click();
    await expect(page.locator('.atlas-missions-drawer')).toBeVisible();
    await page.getByRole('button', { name: 'Fechar lista de missões', exact: true }).click();
    await page.getByRole('button', { name: 'Voltar ao mundo', exact: true }).click();
    await expect(page.locator('.world-map')).toBeVisible();
  }
  expect(errors).toEqual([]);
  console.log(
    'Interface: exclusão administrativa, confirmação/cancelamento, alas em manutenção, links diretos e cartas em quatro tamanhos aprovados.',
  );
} finally {
  await browser.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.end();
}
