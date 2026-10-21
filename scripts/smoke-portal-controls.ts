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
  await page.getByRole('button', { name: 'Abrir navegação', exact: true }).click();
  await page.getByRole('button', { name: 'Mural', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Eventos Em manutenção', exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole('button', { name: 'Torre Em manutenção', exact: true }),
  ).toBeDisabled();
  await page.screenshot({ path: 'test-results/portal-controls/maintenance-menu.png' });
  for (const [route, title] of [
    ['events', 'Eventos em manutenção'],
    ['tower', 'Torre em manutenção'],
  ]) {
    await page.goto(origin + '/#' + route);
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Voltar ao mural', exact: true })).toBeVisible();
  }
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
    const regionalHeading = await page.locator('.world-atlas-heading').boundingBox();
    const pageHeading = await page.locator('.page-header').boundingBox();
    await page.screenshot({ path: `test-results/portal-controls/north-map-${width}.png` });
    expect(regionalHeading!.y - (pageHeading!.y + pageHeading!.height)).toBeGreaterThanOrEqual(width <= 900 ? 8 : 0);
    const response = await imageResponse;
    expect(
      createHash('sha256')
        .update(await response.body())
        .digest('hex'),
    ).toBe(createHash('sha256').update(mapFile).digest('hex'));
    await expect(
      page.getByRole('button', { name: 'Abrir missões do Reino do Norte', exact: true }),
    ).toBeVisible();
    await page
      .getByRole('button', { name: 'Abrir missões do Reino do Norte', exact: true })
      .click();
    await expect(page.locator('.atlas-missions-drawer')).toBeVisible();
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
