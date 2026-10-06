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
  await expect(page.getByLabel('Escolher andar', { exact: true }).locator('option')).toHaveCount(
    100,
  );
  await expect(page.locator('.tower-hero')).not.toContainText('Trinta andares');
  await expect(page.getByRole('button', { name: 'Preparar a ascensão' })).toHaveCount(0);
  await expect(page.locator('.tower-hero-metrics')).toHaveCount(0);
  await expect(page.locator('.tower-hero-art')).toHaveAttribute('src', '/tower/tower-veil-v2.webp');
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
  await page.getByRole('button', { name: 'Expedições', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Reúna a expedição.', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Nova expedição', exact: true }).click();
  await page.getByLabel('Nome da expedição', { exact: true }).fill('Os que voltam com a aurora');
  await page.getByRole('button', { name: 'Abrir expedição', exact: true }).click();
  await page.getByRole('button', { name: 'Arden da aurora', exact: true }).click();
  await playerPage.goto(origin + '/#tower');
  await expect(playerPage.locator('.tower-hidden')).toBeVisible();
  await expect(playerPage.locator('.tower-creatures img')).toHaveCount(0);
  await expect(playerPage.getByRole('button', { name: 'Editar andar', exact: true })).toHaveCount(
    0,
  );
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
  await playerPage.reload();
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
    'Torre: 100 andares, edição administrativa, criaturas/armadilhas ocultas, prêmios/itens clicáveis, mestre/jogador, andares sequenciais, conclusão, d100 persistente e layouts 1440/768/390/320 verificados.',
  );
} catch (e) {
  await page.screenshot({ path: 'test-results/tower-failure.png', fullPage: true });
  throw e;
} finally {
  await browser.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.end();
}
