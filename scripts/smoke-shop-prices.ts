import 'dotenv/config';
import { chromium, expect, type BrowserContext } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';

if (!/^\/alvorada_test_[a-f0-9]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))
  throw Error('Banco isolado obrigatório.');
const origin = 'http://localhost:3009';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db.js'),
  { migrate } = await import('../server/migrate.js'),
  { seed } = await import('../server/seed.js'),
  { createLegacyTestCharacter } = await import('../tests/character-fixtures.js');
await migrate();
await seed();
const { createApp } = await import('../server/app.js'),
  server = createApp().listen(3009, '127.0.0.1');
await new Promise<void>((resolve) => server.once('listening', resolve));
const browser = await chromium.launch({ channel: 'msedge', headless: true }),
  admin = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
  }),
  player = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
  }),
  page = await admin.newPage(),
  visit = await player.newPage();
const errors: string[] = [];
page.on('pageerror', (error) => errors.push(error.message));
visit.on('pageerror', (error) => errors.push(error.message));
await mkdir('test-results', { recursive: true });
async function signup(context: BrowserContext, name: string) {
  const response = await context.request.post(origin + '/api/auth/sign-up/email', {
    headers: { Origin: origin },
    data: {
      name,
      email: `prices-ui-${randomUUID()}@example.test`,
      password: `Test-${randomUUID()}`,
    },
  });
  expect(response.ok()).toBe(true);
  await context.addInitScript(() => {
    localStorage.setItem('alvorada-music-muted', 'true');
    localStorage.setItem('alvorada-effects-muted', 'true');
  });
  return (await response.json()).user.id;
}
try {
  const adminId = await signup(admin, 'Administradora da loja'),
    playerId = await signup(player, 'Visitante da loja'),
    hero = await createLegacyTestCharacter(adminId, 'Aurora'),
    guest = await createLegacyTestCharacter(playerId, 'Bruma');
  await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [adminId]);
  await pool.query('UPDATE characters SET gold_cp=500000 WHERE id=ANY($1::uuid[])', [
    [hero.id, guest.id],
  ]);
  await page.goto(origin + '/#shop');
  await expect(page.locator('.shop-scene')).toBeVisible();
  await page.getByRole('button', { name: /^Armas/ }).click();
  await page.getByLabel('Procurar item').fill('Clava');
  const club = page.locator('.shop-product').filter({
    has: page.getByRole('button', { name: 'Examinar Clava', exact: true }),
  });
  await club.getByRole('button', { name: 'Editar preço de Clava', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Editar preço', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Preço em PO', { exact: true }).fill('12,34');
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `test-results/shop-price-editor-${width}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await dialog.getByRole('button', { name: 'Salvar preço', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(club.locator('footer strong')).toHaveText('12,34 PO');
  await page.reload();
  await page.getByRole('button', { name: /^Armas/ }).click();
  await page.getByLabel('Procurar item').fill('Clava');
  await expect(club.locator('footer strong')).toHaveText('12,34 PO');
  await visit.goto(origin + '/#shop');
  await expect(visit.locator('.shop-scene')).toBeVisible();
  await expect(visit.getByRole('button', { name: /^Editar preço de / })).toHaveCount(0);
  await visit.getByRole('button', { name: /^Armas/ }).click();
  await visit.getByLabel('Procurar item').fill('Clava');
  const guestClub = visit.locator('.shop-product').filter({
    has: visit.getByRole('button', { name: 'Examinar Clava', exact: true }),
  });
  await expect(guestClub.locator('footer strong')).toHaveText('12,34 PO');
  await guestClub.getByRole('button', { name: 'Comprar', exact: true }).click();
  await visit.getByRole('button', { name: 'Abrir carrinho: 1 itens', exact: true }).click();
  const checkout = visit.getByRole('dialog', { name: 'Seu carrinho', exact: true });
  await checkout.getByRole('button', { name: /Finalizar compra/ }).click();
  await expect(checkout).toHaveCount(0);
  expect(
    (
      await pool.query("SELECT total_cp FROM purchases WHERE character_id=$1 AND item_id='club'", [
        guest.id,
      ])
    ).rows[0].total_cp,
  ).toBe(1234);

  // A subsequent price edit neither rewrites history nor lets a player impersonate an admin.
  await club.getByRole('button', { name: 'Editar preço de Clava', exact: true }).click();
  await dialog.getByLabel('Sem preço definido', { exact: true }).check();
  await dialog.getByRole('button', { name: 'Salvar preço', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(club.locator('footer strong')).toHaveText('Preço a definir');
  expect(
    (
      await pool.query("SELECT total_cp FROM purchases WHERE character_id=$1 AND item_id='club'", [
        guest.id,
      ])
    ).rows[0].total_cp,
  ).toBe(1234);
  const denied = await player.request.patch(origin + '/api/catalog/club/price', {
    headers: { Origin: origin },
    data: { price_cp: 1 },
  });
  expect(denied.status()).toBe(403);
  const forged = await player.request.patch(origin + '/api/catalog/club/price', {
    headers: { Origin: origin },
    data: { price_cp: 1, administrador: 1 },
  });
  expect(forged.status()).toBe(400);
  await page.getByLabel('Procurar item').fill('');
  await page.getByRole('button', { name: /^Itens de House/ }).click();
  const letter = page.locator('.shop-product').filter({ hasText: 'Carta Selada' });
  await letter.getByRole('button', { name: 'Editar preço de Carta Selada', exact: true }).click();
  await expect(dialog.getByLabel('Sem preço definido', { exact: true })).toHaveCount(0);
  await dialog.getByLabel('Preço em PO', { exact: true }).fill('17.25');
  await dialog.getByRole('button', { name: 'Salvar preço', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(letter.locator('footer strong')).toHaveText('17,25 PO');
  await letter.getByRole('button', { name: 'Comprar', exact: true }).click();
  const buy = page.getByRole('dialog', { name: 'Carta Selada', exact: true });
  await buy.getByLabel('Assunto', { exact: true }).fill('Preço definido pelo administrador');
  await buy.getByLabel('Sua carta', { exact: true }).fill('Uma lembrança do balcão.');
  await buy.getByRole('button', { name: 'Comprar por 17,25 PO', exact: true }).click();
  await expect(buy).toHaveCount(0);
  expect(
    Number(
      (await pool.query('SELECT total_cp FROM house_orders WHERE character_id=$1', [hero.id]))
        .rows[0].total_cp,
    ),
  ).toBe(1725);
  await page.goto(origin + '/#house');
  await page.getByRole('button', { name: 'Criar minha casa', exact: true }).click();
  await expect(page.locator('.house-scene')).toBeVisible();
  await page.getByRole('button', { name: 'Mobília', exact: true }).click();
  await page.getByRole('button', { name: /Carta Selada.*17,25 PO/ }).click();
  await expect(
    page
      .getByRole('dialog', { name: 'Carta Selada', exact: true })
      .getByRole('button', { name: 'Comprar por 17,25 PO', exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
  console.log(
    'Preços no navegador: editor administrativo em quatro larguras, vírgula/ponto, preço persistido, jogador sem editor, compras futuras em cobre, histórico intacto e House sincronizada aprovados.',
  );
} finally {
  await browser.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.end();
}
