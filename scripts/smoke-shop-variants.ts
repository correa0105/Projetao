import 'dotenv/config';
import { chromium, expect, type BrowserContext } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { groupShopItems } from '../src/shop-variants.js';
import { merchantComment } from '../src/shop-presentation.js';
import { money } from '../shared/rules.js';
import type { Item } from '../src/types.js';

if (!/^\/alvorada_test_[a-f0-9]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))
  throw Error('Banco isolado obrigatório.');
const origin = 'http://localhost:3015';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db.js'),
  { migrate } = await import('../server/migrate.js'),
  { seed } = await import('../server/seed.js'),
  { createLegacyTestCharacter } = await import('../tests/character-fixtures.js');
await migrate();
await seed();
const { createApp } = await import('../server/app.js'),
  server = createApp().listen(3015, '127.0.0.1');
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
const errors: string[] = [],
  audio: string[] = [];
page.on('pageerror', (error) => errors.push(error.message));
visit.on('pageerror', (error) => errors.push(error.message));
page.on('request', (request) => {
  if (request.url().includes('/audio/emporium/')) audio.push(new URL(request.url()).pathname);
});
await mkdir('test-results', { recursive: true });
async function signup(context: BrowserContext, name: string) {
  const response = await context.request.post(origin + '/api/auth/sign-up/email', {
    headers: { Origin: origin },
    data: {
      name,
      email: `variants-${randomUUID()}@example.test`,
      password: `Test-${randomUUID()}`,
    },
  });
  expect(response.ok()).toBe(true);
  await context.addInitScript(() => {
    localStorage.setItem('alvorada-music-muted', 'true');
    localStorage.setItem('alvorada-effects-muted', 'false');
  });
  return (await response.json()).user.id;
}
try {
  const adminId = await signup(admin, 'Administradora das variantes');
  await signup(player, 'Jogador das variantes');
  await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [adminId]);
  const hero = await createLegacyTestCharacter(adminId, 'Aurora do Empório');
  await pool.query('UPDATE characters SET gold_cp=200000000 WHERE id=$1', [hero.id]);
  const catalog = (await (await admin.request.get(origin + '/api/catalog')).json()) as Item[];
  const groups = groupShopItems(catalog);
  const resistance = catalog.filter((item) => item.magic_family === 'Armor of Resistance');
  expect(resistance).toHaveLength(120);
  const fire = resistance.find(
    (item) => item.base_item === 'chain-mail' && item.damage_type === 'fire',
  )!;
  const acid = resistance.find(
    (item) => item.base_item === 'chain-mail' && item.damage_type === 'acid',
  )!;
  const originalAcidPrice = acid.price_cp;
  await page.goto(origin + '/#shop');
  await expect(page.locator('.shop-product-family')).toHaveCount(
    groups.filter((group) => group.family).length,
  );
  const totalCards = groups.length + 12;
  await expect(page.getByRole('button', { name: /^Todos/ }).locator('span')).toHaveText(
    String(totalCards),
  );
  await page.getByLabel('Procurar item', { exact: true }).fill('Armadura de resistência');
  const card = page.locator('.shop-product[data-family="Armor of Resistance"]');
  await expect(card).toHaveCount(1);
  await expect(card.locator('h3')).toHaveText(
    'ARMADURA DE RESISTÊNCIA (ESCOLHER TIPO DA ARMADURA)',
  );
  await expect(card.getByRole('button', { name: 'Comprar', exact: true })).toBeDisabled();
  await expect(card.locator('.shop-product-art')).toBeDisabled();
  await expect(card.locator('.shop-price-edit')).toHaveCount(0);
  await expect(card.locator('.shop-product-art img')).toHaveAttribute(
    'src',
    '/shop/magic-armor-box.webp',
  );
  const model = card.getByLabel('Tipo de armadura de ARMADURA DE RESISTÊNCIA', { exact: true }),
    damage = card.getByLabel('Resistência de ARMADURA DE RESISTÊNCIA', { exact: true });
  await expect(model).toHaveValue('');
  await expect(model.locator('option')).toHaveCount(13);
  await expect(damage).toBeDisabled();
  await page.setViewportSize({ width: 320, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(321);
  await card.screenshot({ path: 'test-results/shop-magic-placeholder-320.png' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await model.selectOption('chain-mail');
  await expect(damage.locator('option')).toHaveCount(11);
  await expect(card.getByRole('button', { name: 'Comprar', exact: true })).toBeDisabled();
  await damage.selectOption(fire.id);
  await expect(card).toHaveAttribute('data-item-id', fire.id);
  await expect(card.getByRole('button', { name: 'Comprar', exact: true })).toBeEnabled();
  await expect(
    page.getByRole('status', { name: 'Comentário do vendedor', exact: true }),
  ).toContainText(merchantComment(fire));
  const editor = page.getByRole('dialog', { name: 'Editar preço', exact: true });
  await card.getByRole('button', { name: `Editar preço de ${fire.name}`, exact: true }).click();
  await editor.getByLabel('Preço em PO', { exact: true }).fill('12,34');
  await editor.getByRole('button', { name: 'Salvar preço', exact: true }).click();
  await expect(editor).toHaveCount(0);
  await expect(card.locator('footer strong')).toHaveText('12,34 PO');
  expect(
    (await pool.query('SELECT price_cp FROM catalog_items WHERE id=$1', [acid.id])).rows[0]
      .price_cp,
  ).toBe(originalAcidPrice);
  await card.getByRole('button', { name: 'Comprar', exact: true }).click();
  await expect(page.locator(`.shop-table-token[data-item-id="${fire.id}"] img`)).toHaveAttribute(
    'src',
    fire.image_path!,
  );
  await expect.poll(() => audio.includes(fire.audio_path!)).toBe(true);
  await damage.selectOption(acid.id);
  await expect(card.locator('footer strong')).toHaveText(`${money(originalAcidPrice!)} PO`);
  await card.getByRole('button', { name: 'Comprar', exact: true }).click();
  await expect(page.locator('.shop-table-token')).toHaveCount(2);
  await expect.poll(() => audio.includes(acid.audio_path!)).toBe(true);
  await page.getByLabel('Procurar item', { exact: true }).fill('fogo');
  await expect(card).toBeVisible();
  await expect(damage).toHaveValue(fire.id);
  await expect(damage.locator('option')).toHaveCount(11);
  // An explicit choice keeps alternatives available even while the search suggests fire.
  await damage.selectOption(acid.id);
  await expect(damage).toHaveValue(acid.id);
  await expect(card).toHaveAttribute('data-item-id', acid.id);
  await page.getByLabel('Procurar item', { exact: true }).fill('Armadura de resistência');
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await card.scrollIntoViewIfNeeded();
    await expect(card.locator('.shop-product-art img')).toHaveJSProperty('naturalWidth', 1536);
    const box = (await card.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
    expect(await card.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(
      true,
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `test-results/shop-magic-family-${width}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'Abrir carrinho: 2 itens', exact: true }).click();
  const checkout = page.getByRole('dialog', { name: 'Seu carrinho', exact: true });
  await expect(checkout.getByText(fire.name, { exact: true })).toBeVisible();
  await expect(checkout.getByText(acid.name, { exact: true })).toBeVisible();
  const lineImages = await checkout
    .locator('.shop-checkout-line img')
    .evaluateAll((images) => images.map((image) => image.getAttribute('src')));
  expect(lineImages).toEqual([fire.image_path, acid.image_path]);
  await checkout.getByRole('button', { name: /Finalizar compra/ }).click();
  await expect(checkout).toHaveCount(0);
  const history = (
    await pool.query(
      'SELECT item_id,total_cp FROM purchases WHERE character_id=$1 ORDER BY total_cp',
      [hero.id],
    )
  ).rows;
  expect(history).toEqual([
    { item_id: fire.id, total_cp: 1234 },
    { item_id: acid.id, total_cp: originalAcidPrice },
  ]);
  const inventory = (
    await pool.query(
      'SELECT item_id,quantity FROM inventory WHERE character_id=$1 AND item_id=ANY($2::text[]) ORDER BY item_id',
      [hero.id, [fire.id, acid.id]],
    )
  ).rows;
  expect(inventory).toHaveLength(2);
  expect(inventory.every((item) => item.quantity === 1)).toBe(true);

  await page.getByLabel('Procurar item', { exact: true }).fill('Língua flamejante');
  const weapon = page.locator('.shop-product[data-family="Flame Tongue"]');
  await expect(weapon).toHaveCount(1);
  await expect(weapon.locator('h3')).toHaveText('LÍNGUA FLAMEJANTE (ESCOLHER TIPO DA ARMA)');
  await expect(weapon.locator('.shop-product-art img')).toHaveAttribute(
    'src',
    '/shop/magic-weapon-box.webp',
  );
  const greatsword = catalog.find(
    (item) => item.magic_family === 'Flame Tongue' && item.base_item === 'greatsword',
  )!;
  await weapon
    .getByLabel('Tipo de arma de LÍNGUA FLAMEJANTE', { exact: true })
    .selectOption('greatsword');
  await expect(weapon).toHaveAttribute('data-item-id', greatsword.id);
  const transfer = await page.evaluateHandle(() => new DataTransfer());
  await weapon.locator('.shop-product-art').dispatchEvent('dragstart', { dataTransfer: transfer });
  expect(await transfer.evaluate((data) => data.getData('application/x-alvorada-shop'))).toBe(
    greatsword.id,
  );
  await page
    .locator('.shop-table-surface')
    .dispatchEvent('drop', { dataTransfer: transfer, clientX: 400, clientY: 850 });
  await expect(page.locator(`.shop-table-token[data-item-id="${greatsword.id}"]`)).toHaveCount(1);
  await expect.poll(() => audio.includes(greatsword.audio_path!)).toBe(true);
  await expect(
    page.getByRole('status', { name: 'Comentário do vendedor', exact: true }),
  ).toContainText(merchantComment(greatsword));
  await visit.goto(origin + '/#shop');
  await visit.getByLabel('Procurar item', { exact: true }).fill('Língua flamejante');
  const guestWeapon = visit.locator('.shop-product[data-family="Flame Tongue"]');
  await guestWeapon
    .getByLabel('Tipo de arma de LÍNGUA FLAMEJANTE', { exact: true })
    .selectOption('greatsword');
  await expect(guestWeapon.locator('.shop-price-edit')).toHaveCount(0);
  expect(errors).toEqual([]);
  console.log(
    'Famílias mágicas: caixa/título único, escolha explícita, 12×10 resistências preservadas, busca compatível sem esconder opções, preço só da variante, som/fala/drag corretos, carrinho/histórico com IDs reais e quatro larguras aprovados.',
  );
} finally {
  await browser.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.end();
}
