import 'dotenv/config';
import { chromium, expect, type BrowserContext } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
if (!/^\/alvorada_test_[a-f0-9]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))
  throw Error('Banco isolado obrigatório.');
const origin = 'http://localhost:3016';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db.js'),
  { migrate } = await import('../server/migrate.js'),
  { seed } = await import('../server/seed.js'),
  { createLegacyTestCharacter } = await import('../tests/character-fixtures.js');
await migrate();
await seed();
const { createApp } = await import('../server/app.js'),
  server = createApp().listen(3016, '127.0.0.1');
await new Promise<void>((resolve) => server.once('listening', resolve));
const browser = await chromium.launch({ channel: 'msedge', headless: true }),
  admin = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
  }),
  player = await browser.newContext({
    viewport: { width: 390, height: 1000 },
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
    data: { name, email: `gold-ui-${randomUUID()}@example.test`, password: `Test-${randomUUID()}` },
  });
  expect(response.ok()).toBe(true);
  await context.addInitScript(() => {
    localStorage.setItem('alvorada-music-muted', 'true');
    localStorage.setItem('alvorada-effects-muted', 'true');
  });
  return (await response.json()).user.id;
}
try {
  const adminId = await signup(admin, 'Administradora com ouro infinito'),
    playerId = await signup(player, 'Jogador com saldo vazio');
  await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [adminId]);
  const hero = await createLegacyTestCharacter(adminId, 'Aurora infinita'),
    guest = await createLegacyTestCharacter(playerId, 'Bruma sem ouro');
  await pool.query('UPDATE characters SET gold_cp=0 WHERE id=ANY($1::uuid[])', [
    [hero.id, guest.id],
  ]);
  await page.goto(origin + '/#shop');
  await expect(page.locator('.shop-search-row > span')).toHaveText('∞ PO');
  await page.getByRole('button', { name: /^Armas/ }).click();
  await page.getByLabel('Procurar item', { exact: true }).fill('Clava');
  const club = page
    .locator('.shop-product')
    .filter({ has: page.getByRole('button', { name: 'Examinar Clava', exact: true }) });
  await club.getByRole('button', { name: 'Comprar', exact: true }).click();
  await page.getByRole('button', { name: 'Abrir carrinho: 1 itens', exact: true }).click();
  const checkout = page.getByRole('dialog', { name: 'Seu carrinho', exact: true });
  await expect(checkout.getByText('Saldo: ∞ PO', { exact: true })).toBeVisible();
  await expect(checkout.getByRole('button', { name: /Finalizar compra/ })).toBeEnabled();
  await checkout.getByRole('button', { name: /Finalizar compra/ }).click();
  await expect(checkout).toHaveCount(0);
  expect(
    (await pool.query('SELECT gold_cp FROM characters WHERE id=$1', [hero.id])).rows[0].gold_cp,
  ).toBe(0);
  expect(
    (
      await pool.query("SELECT quantity FROM inventory WHERE character_id=$1 AND item_id='club'", [
        hero.id,
      ])
    ).rows[0].quantity,
  ).toBe(1);

  await page.goto(origin + '/#stable');
  await expect(page.locator('.stable-price')).toContainText('∞ PO disponíveis');
  const mountName = page.getByLabel('Como vai se chamar?', { exact: true }),
    mountBuy = page.getByRole('button', { name: 'Comprar montaria', exact: true });
  await expect(mountName).toHaveAttribute('required', '');
  await expect(mountName).toHaveValue('');
  await expect(mountBuy).toBeDisabled();
  await mountName.fill('   ');
  await expect(mountBuy).toBeDisabled();
  await mountName.fill('  Brasa do pátio  ');
  await expect(mountBuy).toBeEnabled();
  await mountBuy.click();
  const mountConfirm = page.getByRole('dialog', { name: 'Levar um novo companheiro', exact: true });
  await mountConfirm.getByRole('button', { name: 'Confirmar compra', exact: true }).click();
  await expect(mountConfirm).toHaveCount(0);
  expect(
    (await pool.query('SELECT name FROM character_mounts WHERE character_id=$1', [hero.id])).rows[0]
      .name,
  ).toBe('Brasa do pátio');
  expect(
    (await pool.query('SELECT gold_cp FROM characters WHERE id=$1', [hero.id])).rows[0].gold_cp,
  ).toBe(0);
  await page.screenshot({ path: 'test-results/unlimited-gold-stable-1440.png', fullPage: true });

  await page.goto(origin + '/#pets');
  await expect(page.locator('.pet-shop-price')).toContainText('∞ PO disponíveis');
  const petName = page.getByLabel('Como vai se chamar?', { exact: true }),
    petBuy = page.getByRole('button', { name: 'Levar este companheiro', exact: true });
  await expect(petName).toHaveAttribute('required', '');
  await expect(petName).toHaveValue('');
  await expect(petBuy).toBeDisabled();
  await petName.fill('   ');
  await expect(petBuy).toBeDisabled();
  await petName.fill('  Faísca  ');
  await expect(petBuy).toBeEnabled();
  await petBuy.click();
  await expect(page.locator('.pet-shop-notice')).toContainText('Faísca agora acompanha');
  expect(
    (await pool.query('SELECT name FROM character_pets WHERE character_id=$1', [hero.id])).rows[0]
      .name,
  ).toBe('Faísca');
  expect(
    (await pool.query('SELECT gold_cp FROM characters WHERE id=$1', [hero.id])).rows[0].gold_cp,
  ).toBe(0);
  await page.screenshot({ path: 'test-results/unlimited-gold-pets-1440.png', fullPage: true });

  await page.goto(origin + '/#shop');
  await page.getByRole('button', { name: /^Itens de House/ }).click();
  await page
    .locator('.shop-product')
    .filter({ hasText: 'Carta Selada' })
    .getByRole('button', { name: 'Comprar', exact: true })
    .click();
  const houseBuy = page.getByRole('dialog', { name: 'Carta Selada', exact: true });
  await expect(houseBuy.getByText('Saldo: ∞ PO.', { exact: true })).toBeVisible();
  await houseBuy.getByLabel('Assunto', { exact: true }).fill('Carta de ouro infinito');
  await houseBuy.getByLabel('Sua carta', { exact: true }).fill('Uma lembrança para a casa.');
  await houseBuy.getByRole('button', { name: /^Comprar por/ }).click();
  await expect(houseBuy).toHaveCount(0);
  expect(
    Number(
      (await pool.query('SELECT count(*) AS n FROM house_orders WHERE character_id=$1', [hero.id]))
        .rows[0].n,
    ),
  ).toBe(1);
  expect(
    (await pool.query('SELECT gold_cp FROM characters WHERE id=$1', [hero.id])).rows[0].gold_cp,
  ).toBe(0);

  // The collection consumes the server-provided image URL and refreshes only the matching owner.
  await page.goto(origin + '/#inventory');
  const ownedPet = page.getByRole('button', { name: 'Mostrar Faísca no acampamento', exact: true });
  await expect(ownedPet.locator('.pet-art svg')).toHaveCount(1);
  let petRefreshes = 0;
  const petEndpoint = `${origin}/api/pets/${hero.id}`;
  await page.route(petEndpoint, async (route) => {
    petRefreshes++;
    const response = await route.fetch();
    const items = await response.json();
    await route.fulfill({
      response,
      json: items.map((item: { name: string }) => ({
        ...item,
        ...(item.name === 'Faísca' ? { image_url: '/calendar/village-night-v1.webp' } : {}),
      })),
    });
  });
  await page.evaluate(
    ({ foreign, own }) => {
      window.dispatchEvent(
        new CustomEvent('companion-art-updated', { detail: { characterId: foreign } }),
      );
      window.dispatchEvent(
        new CustomEvent('companion-art-updated', { detail: { characterId: own } }),
      );
    },
    { foreign: guest.id, own: hero.id },
  );
  await expect(ownedPet.locator('.owned-pet-art img')).toHaveAttribute(
    'src',
    '/calendar/village-night-v1.webp',
  );
  await expect(ownedPet.locator('.owned-pet-art img')).toHaveJSProperty('complete', true);
  expect(petRefreshes).toBe(1);
  await page.unroute(petEndpoint);

  await visit.goto(origin + '/#shop');
  await expect(visit.locator('.shop-search-row > span')).toHaveText('0 PO');
  await visit.getByRole('button', { name: /^Armas/ }).click();
  await visit.getByLabel('Procurar item', { exact: true }).fill('Clava');
  await visit
    .locator('.shop-product')
    .filter({ has: visit.getByRole('button', { name: 'Examinar Clava', exact: true }) })
    .getByRole('button', { name: 'Comprar', exact: true })
    .click();
  await visit.getByRole('button', { name: 'Abrir carrinho: 1 itens', exact: true }).click();
  const guestCheckout = visit.getByRole('dialog', { name: 'Seu carrinho', exact: true });
  await expect(guestCheckout.getByRole('button', { name: /Finalizar compra/ })).toBeDisabled();
  await expect(
    visit.getByText('Saldo insuficiente para este carrinho.', { exact: true }),
  ).toBeVisible();
  await visit.goto(origin + '/#stable');
  await visit.getByLabel('Como vai se chamar?', { exact: true }).fill('Montaria sem saldo');
  await expect(visit.getByRole('button', { name: 'Comprar montaria', exact: true })).toBeDisabled();
  await expect(visit.locator('.stable-price')).toContainText('0 PO disponíveis');
  await visit.goto(origin + '/#pets');
  await visit.getByLabel('Como vai se chamar?', { exact: true }).fill('Mascote sem saldo');
  await expect(
    visit.getByRole('button', { name: 'Levar este companheiro', exact: true }),
  ).toBeDisabled();
  await expect(visit.locator('.pet-shop-price')).toContainText('0 PO disponíveis');
  await pool.query('UPDATE "user" SET administrador=0 WHERE id=$1', [adminId]);
  await page.goto(origin + '/#shop');
  await page.reload();
  await expect(page.locator('.shop-search-row > span')).toHaveText('0 PO');
  expect(errors).toEqual([]);
  console.log(
    'Ouro infinito na UI: adm com saldo0 compra Empório/House/montaria/mascote sem debitar, nomes obrigatórios e aparados preservados, jogador saldo0 bloqueado e permissão revogada deixa de exibir∞.',
  );
} finally {
  await browser.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.end();
}
