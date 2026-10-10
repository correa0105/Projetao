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
  audio: string[] = [],
  rulesRequests: string[] = [];
page.on('pageerror', (error) => errors.push(error.message));
visit.on('pageerror', (error) => errors.push(error.message));
page.on('request', (request) => {
  if (request.url().includes('/audio/emporium/')) audio.push(new URL(request.url()).pathname);
  if (/\/api\/catalog\/[^/]+\/rules$/.test(new URL(request.url()).pathname))
    rulesRequests.push(new URL(request.url()).pathname);
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
  await page.goto(origin + '/#stable');
  const mountName = page.getByLabel('Como vai se chamar?', { exact: true });
  const mountBuy = page.getByRole('button', { name: 'Comprar montaria', exact: true });
  await expect(mountBuy).toBeDisabled();
  await mountName.fill('   ');
  await expect(mountBuy).toBeDisabled();
  await mountName.fill('Pé da Estrada');
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 800 });
    await expect(page.locator('.stable-tack-shop')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Experimentar / })).toHaveCount(0);
    await expect(page.locator('.stable-feed')).toHaveCount(0);
    await expect(mountBuy).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width + 1,
    );
    const choices = (await page.locator('.stable-choices').boundingBox())!;
    const order = (await page.locator('.stable-order').boundingBox())!;
    expect(order.y).toBeGreaterThanOrEqual(choices.y + choices.height - 1);
    await page.screenshot({ path: `test-results/stable-no-selaria-${width}.png` });
  }
  await mountBuy.click();
  const [mountResponse] = await Promise.all([
    page.waitForResponse((response) => new URL(response.url()).pathname === '/api/stable/purchase'),
    page.getByRole('button', { name: 'Confirmar compra', exact: true }).click(),
  ]);
  expect(mountResponse.status()).toBe(201);
  expect(mountResponse.request().postDataJSON().equipment).toEqual([]);
  expect(
    (
      await pool.query(
        'SELECT equipment,equipment_price_cp FROM character_mounts WHERE character_id=$1 AND name=$2',
        [hero.id, 'Pé da Estrada'],
      )
    ).rows[0],
  ).toEqual({ equipment: [], equipment_price_cp: 0 });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(origin + '/#shop');
  await expect(page.locator('.shop-product-family')).toHaveCount(
    groups.filter((group) => group.family).length,
  );
  const totalCards = groups.length + 12;
  await expect(page.getByRole('button', { name: /^Todos/ }).locator('span')).toHaveText(
    String(totalCards),
  );
  await page.getByRole('button', { name: /^Equipamentos de montaria/ }).click();
  await expect(page.getByRole('button', { name: /^Equipamentos de montaria/ })).toHaveCount(1);
  await expect(page.getByRole('button', { name: /^Equipamento de montaria(?:\s|$)/ })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole('button', { name: /^Equipamentos de montaria/ }).locator('span'),
  ).toHaveText('18');
  await expect(page.locator('.shop-product')).toHaveCount(18);
  for (const id of [
    'barding-ring-mail',
    'barding-plate-armor',
    'mount-ornate-chamfron',
    'mount-ornate-bridle',
  ]) {
    const card = page.locator(`.shop-product[data-item-id="${id}"]`);
    await expect(card).toHaveCount(1);
    await expect(card.locator('small').first()).toHaveText('Equipamentos de montaria');
  }
  await expect(page.locator('.shop-product-family')).toHaveCount(0);
  await page.screenshot({ path: 'test-results/shop-unified-mount-shelf-1440.png' });
  await page.getByLabel('Procurar item', { exact: true }).fill('Sela');
  await expect(
    page.locator(
      '.shop-product[data-item-id="saddle-riding"], .shop-product[data-item-id="saddle-military"]',
    ),
  ).toHaveCount(2);
  for (const id of ['saddle-riding', 'saddle-military']) {
    const saddle = catalog.find((item) => item.id === id)!;
    const saddleCard = page.locator(`.shop-product[data-item-id="${id}"]`);
    await expect(saddleCard).toHaveCount(1);
    await expect(saddleCard.locator('h3')).toHaveText(saddle.name);
    await expect(saddleCard.locator('footer strong')).toHaveText(`${money(saddle.price_cp!)} PO`);
    await expect(saddleCard.locator('.shop-product-art .shop-family-box')).toHaveAttribute(
      'src',
      saddle.image_path!,
    );
    await expect
      .poll(() =>
        saddleCard
          .locator('img')
          .evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0),
      )
      .toBe(true);
  }
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 800 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width + 1,
    );
    await page.screenshot({ path: `test-results/shop-two-saddles-${width}.png` });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const id of ['saddle-riding', 'saddle-military'])
    await page
      .locator(`.shop-product[data-item-id="${id}"]`)
      .getByRole('button', { name: 'Comprar', exact: true })
      .click();
  await page.getByRole('button', { name: 'Abrir carrinho: 2 itens', exact: true }).click();
  const saddleCheckout = page.getByRole('dialog', { name: 'Seu carrinho', exact: true });
  await expect(saddleCheckout.locator('.shop-checkout-line')).toHaveCount(2);
  for (const id of ['saddle-riding', 'saddle-military']) {
    const saddle = catalog.find((item) => item.id === id)!;
    const line = saddleCheckout.locator('.shop-checkout-line').filter({ hasText: saddle.name });
    await expect(line).toContainText('Equipamentos de montaria');
  }
  await saddleCheckout.getByRole('button', { name: /Finalizar compra/ }).click();
  await expect(saddleCheckout).toHaveCount(0);
  expect(
    (
      await pool.query(
        'SELECT item_id,quantity FROM inventory WHERE character_id=$1 AND item_id=ANY($2::text[]) ORDER BY item_id',
        [hero.id, ['saddle-riding', 'saddle-military']],
      )
    ).rows,
  ).toEqual([
    { item_id: 'saddle-military', quantity: 1 },
    { item_id: 'saddle-riding', quantity: 1 },
  ]);
  await page.getByLabel('Procurar item', { exact: true }).fill('');
  await page.getByRole('button', { name: /^Acessórios para pet/ }).click();
  await expect(page.locator('.shop-product')).toHaveCount(8);
  const petCards = page.locator('.shop-product');
  expect(await petCards.locator('h3').allTextContents()).toEqual(
    expect.arrayContaining(['Armadura de couro para mascote', 'Lenço de aventureiro para mascote']),
  );
  await page.screenshot({ path: 'test-results/shop-pet-shelf-1440.png' });
  await page.getByRole('button', { name: /^Todos/ }).click();
  await page.getByLabel('Procurar item', { exact: true }).fill('Armadura de couro');
  const leather = page.locator('.shop-product[data-item-id="leather-armor"]');
  await expect(leather).toContainText('Conjunto completo com 6 peças');
  await expect(leather).toContainText('Peso do conjunto: 10 lb');
  await page.getByLabel('Procurar item', { exact: true }).fill('Armadura de resistência');
  const card = page.locator('.shop-product[data-family="Armor of Resistance"]');
  await expect(card).toHaveCount(1);
  await expect(card.locator('h3')).toHaveText(
    'ARMADURA DE RESISTÊNCIA (ESCOLHER TIPO DA ARMADURA)',
  );
  await expect(card.getByRole('button', { name: 'Comprar', exact: true })).toBeDisabled();
  await expect(card.locator('.shop-product-art')).toBeDisabled();
  await expect(card.locator('.shop-price-edit')).toHaveCount(0);
  await expect(card.locator('.shop-product-art .shop-family-box')).toHaveAttribute(
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
  const familyRequests = rulesRequests.length;
  await card.getByRole('button', { name: 'O que este item faz?', exact: true }).click();
  const familyHelp = page.getByRole('dialog', { name: 'ARMADURA DE RESISTÊNCIA', exact: true });
  await expect(familyHelp).toContainText('Escolha o tipo e a variante');
  expect(rulesRequests).toHaveLength(familyRequests);
  const helpBounds = (await familyHelp.boundingBox())!;
  expect(helpBounds.x).toBeGreaterThanOrEqual(0);
  expect(helpBounds.x + helpBounds.width).toBeLessThanOrEqual(321);
  await page.keyboard.press('Escape');
  await expect(familyHelp).toHaveCount(0);
  await expect(
    card.getByRole('button', { name: 'O que este item faz?', exact: true }),
  ).toBeFocused();
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
  const [fireRulesResponse] = await Promise.all([
    page.waitForResponse(
      (response) => new URL(response.url()).pathname === `/api/catalog/${fire.id}/rules`,
    ),
    card.getByRole('button', { name: 'O que este item faz?', exact: true }).click(),
  ]);
  expect(fireRulesResponse.status()).toBe(200);
  const fireRules = await fireRulesResponse.json();
  expect(fireRules.description).toMatch(/resistência a dano de fogo/i);
  expect(fireRules.description).toContain('CA: 16');
  expect(fireRules.description).toContain('Tipo de dano desta variante: fogo');
  const fireHelp = page.getByRole('dialog', { name: fire.name, exact: true });
  await expect(fireHelp.locator('.item-info-description')).toHaveText(fireRules.description);
  await expect(fireHelp.getByRole('link', { name: 'Consultar no 5etools' })).toHaveAttribute(
    'href',
    new URL(fireRules.reference_url).href,
  );
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 800 });
    const box = (await fireHelp.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
    expect(box.y + box.height).toBeLessThanOrEqual(801);
    await page.screenshot({ path: `test-results/shop-item-help-${width}.png` });
  }
  await fireHelp.getByRole('button', { name: 'Fechar explicação', exact: true }).click();
  await page.setViewportSize({ width: 1440, height: 1000 });
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
    await expect(card.locator('.shop-product-art .shop-family-box')).toHaveJSProperty(
      'naturalWidth',
      1536,
    );
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
      'SELECT item_id,total_cp FROM purchases WHERE character_id=$1 AND item_id=ANY($2::text[]) ORDER BY total_cp',
      [hero.id, [fire.id, acid.id]],
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
  await expect(weapon.locator('.shop-product-art .shop-family-box')).toHaveAttribute(
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
  for (const sample of [
    { id: 'energy-bow-shortbow', expected: ['CD 15', 'CD 20', 'Dano: 1d6 de força'] },
    { id: 'potion-of-healing', expected: ['2d4 + 2 pontos de vida', 'ação bônus'] },
    { id: 'dagger', expected: ['Maestria: Entalhar', 'propriedade Leve', 'ação Atacar'] },
  ]) {
    const item = catalog.find((candidate) => candidate.id === sample.id)!;
    const offer = groups.find((group) =>
      group.variants.some((candidate) => candidate.id === item.id),
    )!;
    await page.getByLabel('Procurar item', { exact: true }).fill(offer.name);
    const product = page.locator(`.shop-product[data-offer-id="${offer.id}"]`);
    if (offer.family)
      await product
        .getByRole('combobox', { name: /^Tipo de arma de/ })
        .selectOption(item.base_item!);
    await expect(product).toHaveAttribute('data-item-id', item.id);
    const [response] = await Promise.all([
      page.waitForResponse(
        (result) => new URL(result.url()).pathname === `/api/catalog/${item.id}/rules`,
      ),
      product.getByRole('button', { name: 'O que este item faz?', exact: true }).click(),
    ]);
    expect(response.status()).toBe(200);
    const help = page.getByRole('dialog', { name: item.name, exact: true });
    for (const expected of sample.expected) await expect(help).toContainText(expected);
    await page.screenshot({ path: `test-results/shop-rules-${sample.id}-1440.png` });
    await help.getByRole('button', { name: 'Fechar explicação', exact: true }).click();
  }
  const longItem = catalog.find((item) => item.id === 'mysterious-deck')!;
  expect(longItem).toBeTruthy();
  await page.getByLabel('Procurar item', { exact: true }).fill(longItem.name);
  const longCard = page.locator(`.shop-product[data-item-id="${longItem.id}"]`);
  const [longResponse] = await Promise.all([
    page.waitForResponse(
      (response) => new URL(response.url()).pathname === `/api/catalog/${longItem.id}/rules`,
    ),
    longCard.getByRole('button', { name: 'O que este item faz?', exact: true }).click(),
  ]);
  expect(longResponse.status()).toBe(200);
  const longRules = await longResponse.json();
  expect(longRules.description.length).toBeGreaterThan(2000);
  const longHelp = page.getByRole('dialog', { name: longItem.name, exact: true });
  await expect(longHelp.locator('.item-info-description')).toHaveText(longRules.description);
  await page.setViewportSize({ width: 320, height: 640 });
  const longBounds = (await longHelp.boundingBox())!;
  expect(longBounds.x).toBeGreaterThanOrEqual(0);
  expect(longBounds.x + longBounds.width).toBeLessThanOrEqual(321);
  expect(longBounds.y + longBounds.height).toBeLessThanOrEqual(641);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(321);
  await page.screenshot({ path: 'test-results/shop-item-help-long-top-320.png' });
  const scrolled = await longHelp.evaluate((dialog) => {
    dialog.scrollTop = dialog.scrollHeight;
    return { top: dialog.scrollTop, scroll: dialog.scrollHeight, visible: dialog.clientHeight };
  });
  expect(scrolled.scroll).toBeGreaterThan(scrolled.visible);
  expect(scrolled.top).toBeGreaterThan(0);
  await expect(longHelp.getByRole('link', { name: 'Consultar no 5etools' })).toBeInViewport();
  await page.screenshot({ path: 'test-results/shop-item-help-long-bottom-320.png' });
  await page.keyboard.press('Escape');
  await expect(longHelp).toHaveCount(0);
  await expect(
    longCard.getByRole('button', { name: 'O que este item faz?', exact: true }),
  ).toBeFocused();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: /^Todos/ }).click();
  await page.getByLabel('Procurar item', { exact: true }).fill('Carta');
  const letter = page.locator('.shop-product[data-item-id="house-letter"]');
  await letter.getByRole('button', { name: 'Comprar', exact: true }).click();
  const housePurchase = page.locator('dialog').filter({ has: page.locator('.house-buy') });
  await expect(housePurchase).toBeVisible();
  await housePurchase.getByRole('button', { name: 'O que este item faz?', exact: true }).click();
  const houseHelp = page.locator('.item-info-dialog');
  await expect(houseHelp).toContainText('Conteúdo do projeto');
  await houseHelp.getByRole('button', { name: 'Fechar explicação', exact: true }).click();
  await expect(housePurchase).toBeVisible();
  await expect(housePurchase.locator('.house-buy textarea')).toBeVisible();
  await housePurchase.getByRole('button', { name: 'Fechar', exact: true }).click();
  await page
    .getByRole('button', { name: `Remover ${greatsword.name} da mesa`, exact: true })
    .click();
  const counter = page.locator('.shop-table-surface');
  async function placeVariant(item: Item, x: number) {
    const offer = groups.find((group) => group.variants.some((variant) => variant.id === item.id))!;
    await page.getByLabel('Procurar item', { exact: true }).fill(offer.name);
    const product = page.locator(`.shop-product[data-offer-id="${offer.id}"]`);
    if (offer.family)
      await product
        .getByRole('combobox', { name: /^Tipo de arma de/ })
        .selectOption(item.base_item!);
    const data = await page.evaluateHandle(() => new DataTransfer());
    await product.locator('.shop-product-art').dispatchEvent('dragstart', { dataTransfer: data });
    const bounds = (await counter.boundingBox())!;
    await counter.dispatchEvent('drop', {
      dataTransfer: data,
      clientX: bounds.x + bounds.width * x,
      clientY: bounds.y + bounds.height * 0.6,
    });
    const token = page.locator(`.shop-table-token[data-item-id="${item.id}"]`);
    await expect(token.locator('img')).toHaveAttribute('src', item.image_path!);
    await expect
      .poll(async () =>
        token
          .locator('img')
          .evaluate(
            (image) =>
              (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0,
          ),
      )
      .toBe(true);
  }
  const comparisons = [
    ['Sword of Sharpness', 'greatsword'],
    ['Sword of Sharpness', 'scimitar'],
    ['Dancing Sword', 'greatsword'],
    ['Dancing Sword', 'scimitar'],
  ].map(([family, model]) =>
    catalog.find((item) => item.magic_family === family && item.base_item === model)!,
  );
  for (const [index, item] of comparisons.entries()) await placeVariant(item, 0.14 + index * 0.23);
  await counter.screenshot({ path: 'test-results/shop-family-skins-browser.png' });
  for (const item of comparisons) {
    const token = page.locator(`.shop-table-token[data-item-id="${item.id}"]`);
    await token.locator('button').first().focus();
    await page.keyboard.press('Delete');
  }
  const belts = catalog.filter((item) => /^belt-of-giant-strength/.test(item.id));
  expect(belts).toHaveLength(5);
  expect(new Set(belts.map((item) => item.image_path)).size).toBe(5);
  for (const [index, item] of belts.entries()) await placeVariant(item, 0.1 + index * 0.2);
  await counter.screenshot({ path: 'test-results/shop-giant-belts-browser.png' });
  expect(errors).toEqual([]);
  console.log(
    'Famílias mágicas: caixa/título único, escolha explícita, 12×10 resistências preservadas, busca compatível sem esconder opções, preço só da variante, som/fala/drag corretos, carrinho/histórico com IDs reais e quatro larguras aprovados.',
  );
} finally {
  await browser.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.end();
}
