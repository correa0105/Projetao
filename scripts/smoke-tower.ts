import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
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
const { createApp } = await import('../server/app.js'),
  server = createApp().listen(3006, '127.0.0.1');
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
  await page.goto(origin + '/#tower');
  await expect(page.getByRole('heading', { name: 'Torre do Véu', exact: true })).toBeVisible();
  await expect(page.locator('.tower-route .tower-zone')).toHaveCount(6);
  await expect(page.locator('.tower-creatures img')).toHaveCount(3);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: 'test-results/tower-atlas-desktop.png', fullPage: true });
  await page.getByRole('button', { name: /Andares 6–10 Cavernas Prismáticas/ }).click();
  await expect(page.getByRole('heading', { name: 'Veios de Luz', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Andar 10 · Matriarca Prismática', exact: true }).click();
  await expect(page.locator('.tower-boss')).toContainText('Matriarca Prismática');
  await expect(page.locator('.tower-treasure-tier')).toContainText('2');
  await page.screenshot({ path: 'test-results/tower-boss-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Expedições', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Reúna a expedição.', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Nova expedição', exact: true }).click();
  await page.getByLabel('Nome da expedição', { exact: true }).fill('Os que voltam com a aurora');
  await page.getByRole('button', { name: 'Abrir expedição', exact: true }).click();
  await page.getByRole('button', { name: 'Arden da aurora', exact: true }).click();
  await playerPage.goto(origin + '/#tower');
  await playerPage.getByRole('button', { name: 'Expedições', exact: true }).click();
  await expect(playerPage.getByRole('button', { name: 'Nova expedição', exact: true })).toHaveCount(
    0,
  );
  await playerPage.getByRole('button', { name: 'Bruma', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Expedições', exact: true }).click();
  await expect(page.locator('.tower-party')).toContainText('Bruma');
  await page.getByRole('button', { name: 'Iniciar ascensão', exact: true }).click();
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
  await page.screenshot({ path: 'test-results/tower-expedition-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Retornar e recompensar', exact: true }).click();
  const completion = page.getByRole('dialog', { name: 'Confirmar progresso da torre' });
  await completion
    .getByLabel('Registro da expedição')
    .fill('O Porteiro de Ferro caiu. A companhia retornou inteira.');
  await completion
    .getByRole('button', { name: 'Confirmar retorno e entregar', exact: true })
    .click();
  await expect(completion).not.toBeVisible();
  await playerPage.reload();
  await playerPage.getByRole('button', { name: /^Tesouros/ }).click();
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
  await playerPage.getByRole('button', { name: /^Tesouros/ }).click();
  await expect(playerPage.locator('.tower-roll-result')).toBeVisible();
  for (const width of [768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(origin + '/#tower');
    await page.getByRole('button', { name: 'A ascensão', exact: true }).click();
    await expect(page.locator('.tower-atlas')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await page.screenshot({ path: `test-results/tower-atlas-${width}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Expedições', exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await page.getByRole('button', { name: /^Tesouros/ }).click();
    await expect(page.locator('.tower-claim')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
  }
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
    'Torre: atlas, seis biomas/chefes, mestre/jogador, andares sequenciais, conclusão, d100 persistente e layouts 1440/768/390/320 verificados.',
  );
} catch (e) {
  await page.screenshot({ path: 'test-results/tower-failure.png', fullPage: true });
  throw e;
} finally {
  await browser.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.end();
}
