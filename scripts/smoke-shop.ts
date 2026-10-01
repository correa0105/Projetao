import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
if (!new URL(process.env.DATABASE_URL!).pathname.startsWith('/alvorada_test_'))
  throw new Error('Banco isolado obrigatório.');
const origin = 'http://localhost:3002';
process.env.APP_ORIGIN = origin;
process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db.js');
const { migrate } = await import('../server/migrate.js');
const { seed } = await import('../server/seed.js');
const { createLegacyTestCharacter } = await import('../tests/character-fixtures.js');
await migrate();
await seed();
const { createApp } = await import('../server/app.js');
const server = createApp().listen(3002, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));
const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL || 'msedge',
  headless: true,
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  reducedMotion: 'reduce',
});
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
try {
  await page.goto(origin);
  const signup = await page.request.post(origin + '/api/auth/sign-up/email', {
    headers: { Origin: origin },
    data: {
      name: 'Teste Loja',
      email: `shop-${randomUUID()}@example.test`,
      password: `Test-${randomUUID()}`,
    },
  });
  expect(signup.ok()).toBe(true);
  const userId = (await signup.json()).user.id;
  const hero = await createLegacyTestCharacter(userId, 'Arden');
  const alternate = await createLegacyTestCharacter(userId, 'Nara');
  await pool.query('UPDATE characters SET portrait_revision=1 WHERE id=$1', [alternate.id]);
  await page.route(`**/api/characters/${alternate.id}/portrait?*`, route => route.fulfill({
    path: 'public/character-silhouette-v2.png', contentType: 'image/png',
  }));
  const outsider = await browser.newContext();
  const outsiderSignup = await outsider.request.post(origin + '/api/auth/sign-up/email', {
    headers: { Origin: origin },
    data: {
      name: 'Outro jogador',
      email: 'outsider-' + randomUUID() + '@example.test',
      password: 'Test-' + randomUUID(),
    },
  });
  expect(outsiderSignup.ok()).toBe(true);
  const forbidden = await outsider.request.post(origin + '/api/shop/checkout', {
    headers: { Origin: origin },
    data: {
      character_id: hero.id,
      idempotency_key: randomUUID(),
      items: [{ item_id: 'dagger', quantity: 1 }],
    },
  });
  expect(forbidden.status()).toBe(404);
  await outsider.close();
  const endpoint = origin + '/api/shop/checkout';
  const send = (data: unknown) =>
    page.request.post(endpoint, { headers: { Origin: origin }, data });
  const base = {
    character_id: hero.id,
    idempotency_key: randomUUID(),
    items: [
      { item_id: 'dagger', quantity: 2 },
      { item_id: 'hempen-rope-50-feet', quantity: 1 },
    ],
  };
  const active = (await pool.query('SELECT id FROM catalog_items WHERE active=true')).rows;
  expect(active).toHaveLength(71);
  // Resolve the rope ID from the provided catalog rather than assuming an old identifier.
  const rope = (
    await pool.query(
      "SELECT id FROM catalog_items WHERE active=true AND original_name ILIKE '%rope%' LIMIT 1",
    )
  ).rows[0];
  base.items[1].item_id = rope.id;
  const expected = (
    await pool.query(
      'SELECT sum(price_cp * CASE WHEN id=$1 THEN 2 ELSE 1 END)::int AS total FROM catalog_items WHERE id=ANY($2::text[])',
      ['dagger', base.items.map((i) => i.item_id)],
    )
  ).rows[0].total;
  const replies = await Promise.all([send({ ...base, total_cp: 1 }), send(base)]);
  expect(replies.map((r) => r.status()).sort()).toEqual([200, 201]);
  const balance = (await pool.query('SELECT gold_cp FROM characters WHERE id=$1', [hero.id]))
    .rows[0].gold_cp;
  expect(balance).toBe(hero.gold_cp - expected);
  expect(
    (await pool.query('SELECT * FROM purchases WHERE character_id=$1', [hero.id])).rows,
  ).toHaveLength(2);
  expect((await send({ ...base, items: [{ item_id: 'dagger', quantity: 3 }] })).status()).toBe(409);
  expect((await send({ ...base, character_id: randomUUID() })).status()).toBe(404);
  expect(
    (
      await send({
        ...base,
        idempotency_key: randomUUID(),
        items: [{ item_id: 'dragon-orb', quantity: 1 }],
      })
    ).status(),
  ).toBe(409);
  expect(
    (
      await send({
        ...base,
        idempotency_key: randomUUID(),
        items: [{ item_id: 'dagger', quantity: 99 }],
      })
    ).status(),
  ).toBe(409);
  expect(
    (await pool.query('SELECT gold_cp FROM characters WHERE id=$1', [hero.id])).rows[0].gold_cp,
  ).toBe(balance);
  await page.goto(origin + '/#shop');
  await page.reload();
  await expect(page.getByRole('region', { name: 'Catálogo da loja' })).toBeVisible();
  const avatar = page.locator('.profile-avatar');
  const profileControls = page.locator('.profile-menu-controls');
  await expect(avatar).toBeVisible();
  await expect(profileControls).not.toBeVisible();
  const avatarBefore = (await avatar.boundingBox())!;
  expect(avatarBefore.width).toBeCloseTo(48, 0);
  await avatar.hover();
  await expect(profileControls).toBeVisible();
  await page.waitForTimeout(550);
  const profileBox = (await profileControls.boundingBox())!;
  expect(profileBox.x).toBeLessThan(avatarBefore.x);
  expect((await avatar.boundingBox())!.x).toBeCloseTo(avatarBefore.x, 0);
  await expect(page.locator('.character-selector-trigger > svg')).toBeHidden();
  await expect(page.locator('.player-hud-selection')).toBeHidden();
  await avatar.click();
  await expect(page.getByRole('listbox', { name: 'Seus personagens' })).toBeVisible();
  await page.screenshot({ path: 'test-results/profile-picker-desktop.png' });
  await page.getByRole('option', { name: 'Nara', exact: true }).click();
  await expect(avatar).toHaveAttribute('aria-label', 'Abrir menu de Nara');
  await expect(avatar.locator('img')).toHaveAttribute('src', `/api/characters/${alternate.id}/portrait?v=1`);
  await expect(avatar.locator('img')).toBeVisible();
  await avatar.click();
  await page.getByRole('option', { name: 'Arden', exact: true }).click();
  await expect(avatar).toHaveAttribute('aria-label', 'Abrir menu de Arden');
  await expect(avatar.locator('img')).toHaveCount(0);
  await expect(page.getByRole('listbox', { name: 'Seus personagens' })).toHaveCount(0);
  await avatar.click();
  await expect(avatar).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('button', { name: /Pendências e notificações/ }).click();
  await expect(page.locator('.notifications-panel')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.notifications-panel')).toHaveCount(0);
  await expect(page.locator('.merchant-conversation')).toHaveCount(0);
  const merchant = page.getByRole('button', { name: 'Conversar com o mercador', exact: true });
  await merchant.click();
  await expect(page.locator('.merchant-conversation')).toBeVisible();
  await merchant.click();
  await expect(page.locator('.merchant-conversation')).toHaveCount(0);
  const search = page.getByRole('textbox', { name: 'Procurar item' });
  await search.fill('Adaga');
  await page.getByRole('button', { name: 'Comprar', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Adaga na mesa, 1 unidades', exact: true }),
  ).toBeVisible();
  const comment = (await pool.query("SELECT merchant_comment FROM catalog_items WHERE id='dagger'"))
    .rows[0].merchant_comment;
  await expect(page.locator('.merchant-speech[role="status"] > span')).toHaveText(comment);
  await expect(page.locator('.merchant-speech[role="status"] > span')).toHaveCSS('color', 'rgb(241, 228, 206)');
  await expect(page.locator('.merchant-speech .npc-speaker')).toHaveText('Desconhecido');
  expect(await page.locator('.merchant-speech > span').evaluate(el => getComputedStyle(el).fontFamily)).toContain('NPC Inter');
  await expect(page.locator('.merchant-speech[role="status"]')).toBeHidden({ timeout: 16000 });
  await page.getByRole('button', { name: 'Examinar Adaga', exact: true }).click();
  await expect(page.locator('.merchant-speech[role="status"] > span')).toHaveText(comment);
  await expect(page.locator('.shop-table-toolbar')).toHaveCount(0);
  const token = page.getByRole('button', { name: 'Adaga na mesa, 1 unidades', exact: true });
  const before = (await token.boundingBox())!;
  await token.press('ArrowRight');
  await token.press('ArrowDown');
  const after = (await token.boundingBox())!;
  expect(after.x !== before.x || after.y !== before.y).toBe(true);
  await page.getByRole('button', { name: 'Remover Adaga da mesa' }).click();
  await expect(page.locator('.shop-table-token')).toHaveCount(0);
  const sourceBox = (await page.getByRole('button', { name: 'Examinar Adaga', exact: true }).boundingBox())!;
  const targetBox = (await page.locator('.shop-table-surface').boundingBox())!;
  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 12, sourceBox.y + sourceBox.height / 2 + 12, { steps: 4 });
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 15 });
  await page.mouse.up();
  await expect(page.locator('.shop-table-token')).toHaveCount(1);
  await page.getByRole('button', { name: /Abrir carrinho:/ }).click();
  await page.getByRole('spinbutton', { name: 'Quantidade de Adaga' }).fill('3');
  await page.getByRole('button', { name: /Finalizar compra/ }).click();
  await expect(page.getByRole('dialog', { name: 'Seu carrinho' })).not.toBeVisible();
  await expect(page.locator('.shop-table-token')).toHaveCount(0);
  expect(
    (
      await pool.query(
        "SELECT quantity FROM inventory WHERE character_id=$1 AND item_id='dagger'",
        [hero.id],
      )
    ).rows[0].quantity,
  ).toBe(5);
  await search.fill('');
  await mkdir('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/shop-desktop.png' });
  await page.setViewportSize({ width: 1740, height: 852 });
  await page.screenshot({ path: 'test-results/shop-reference-wide.png' });
  for (const viewport of [{width:1440,height:900}, {width:1920,height:1080}, {width:1740,height:852}, {width:2560,height:1440},
    {width:1280,height:720}, {width:1110,height:800}, {width:320,height:740}, {width:1024,height:768}, {width:768,height:1024},
    {width:390,height:844}, {width:844,height:390}]) {
    await page.setViewportSize(viewport);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(100);
    await page.getByRole('button', { name: 'Examinar Armadura de couro', exact: true }).click();
    const bubble = page.locator('.merchant-speech');
    await expect(bubble.locator('svg')).toHaveAttribute('data-tail-side', (await bubble.getAttribute('data-placement')) === 'above' ? 'bottom' : 'right');
    expect(await bubble.locator('span').first().evaluate(el => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
    const overflowingCards = await page.locator('.shop-product').evaluateAll(cards => cards.flatMap(card => {
      const box = card.getBoundingClientRect();
      return Array.from(card.querySelectorAll('h3, p, small, .shop-weight, footer, footer button, footer strong')).filter(el => {
        const r = el.getBoundingClientRect();
        return r.left < box.left - 1 || r.right > box.right + 1 || r.top < box.top - 1 || r.bottom > box.bottom + 1;
      }).map(el => el.textContent);
    }));
    expect(overflowingCards, `Card overflow at ${viewport.width}px`).toEqual([]);
    const bubbleBox = (await bubble.boundingBox())!;
    expect(bubbleBox.y).toBeGreaterThanOrEqual(0);
    expect(bubbleBox.x).toBeGreaterThanOrEqual(0);
    const npc = (await merchant.boundingBox())!;
    const desk = (await page.locator('.shop-counter').boundingBox())!;
    const catalog = (await page.locator('.shop-showcase').boundingBox())!;
    const layout = (await page.locator('.shop-layout').boundingBox())!;
    const contentEdge = viewport.width <= 900 ? 18 : Math.min(95, Math.max(24, viewport.width * .066));
    expect(layout.x).toBeCloseTo(contentEdge, 0);
    if (viewport.width > 1100) await expect(bubble).toHaveAttribute('data-placement', 'side');
    expect(catalog.x).toBeCloseTo(layout.x, 0);
    expect(catalog.x + catalog.width).toBeLessThanOrEqual(layout.x + layout.width + 1);
    expect(npc.x + npc.width).toBeCloseTo(layout.x + layout.width, 0);
    expect(bubbleBox.x).toBeGreaterThanOrEqual(layout.x - 1);
    expect(bubbleBox.x + bubbleBox.width).toBeLessThanOrEqual(layout.x + layout.width + 1);
    expect(catalog.width).toBeGreaterThan(layout.width * .49);
    expect(catalog.height).toBeGreaterThan(400);
    expect(catalog.y + catalog.height).toBeLessThan(desk.y);
    expect(npc.x).toBeGreaterThanOrEqual(0);
    expect(npc.x + npc.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(npc.y + npc.height).toBeLessThan(desk.y + npc.width * .16);
    expect(npc.x >= catalog.x + catalog.width || npc.y >= catalog.y + catalog.height - 30).toBe(true);
    expect(desk.height).toBeGreaterThanOrEqual(145);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({path: `test-results/shop-${viewport.width}x${viewport.height}.png`, fullPage:true});
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await search.fill('Adaga');
  await page.getByRole('button', { name: 'Comprar', exact: true }).click();
  await expect(page.locator('.merchant-speech[role="status"] > span')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/shop-mobile.png' });
  await avatar.click();
  await expect(profileControls).toBeVisible();
  await expect(page.getByRole('listbox', { name: 'Seus personagens' })).toBeVisible();
  const mobileOptions = (await page.getByRole('listbox', { name: 'Seus personagens' }).boundingBox())!;
  expect(mobileOptions.x).toBeGreaterThanOrEqual(0);
  expect(mobileOptions.x + mobileOptions.width).toBeLessThanOrEqual(390);
  await page.getByRole('option', { name: 'Arden', exact: true }).click();
  await page.getByRole('button', { name: /Pendências e notificações/ }).click();
  const mobileNotifications = (await page.locator('.notifications-panel').boundingBox())!;
  expect(mobileNotifications.x).toBeGreaterThanOrEqual(0);
  expect(mobileNotifications.x + mobileNotifications.width).toBeLessThanOrEqual(390);
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 1740, height: 852 });
  await page.evaluate(() => { location.hash = 'characters'; });
  await expect(page.getByRole('heading', { name: 'Seu acampamento', exact: true })).toBeVisible();
  const campHeading = (await page.locator('.page-header .page-title').boundingBox())!;
  const campHud = (await page.locator('.topbar.player-hud').boundingBox())!;
  const campTitle = (await page.locator('.page-header h1').boundingBox())!;
  expect(campHeading.x).toBeCloseTo(95, 0);
  expect(campTitle.x).toBeCloseTo(campHeading.x, 0);
  expect(campHeading.y + campHeading.height / 2).toBeCloseTo(campHud.y + campHud.height / 2, 0);
  await page.screenshot({ path: 'test-results/character-camp-header.png' });
  for (const viewport of [{ width: 1740, height: 852 }, { width: 2560, height: 1440 }, { width: 768, height: 1024 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.evaluate(() => { location.hash = 'inventory'; });
    await expect(page.getByRole('heading', { name: 'Inventário', exact: true })).toBeVisible();
    const referenceTitle = (await page.locator('.page-title h1').boundingBox())!;
    const referenceHud = (await page.locator('.topbar.player-hud').boundingBox())!;
    for (const target of ['profile', 'characters', 'shop', 'achievements', 'board', 'missions', 'hooks', 'stable', 'overview', 'world', 'lore', 'rules']) {
      await page.evaluate(target => { location.hash = target; }, target);
      await expect(page.locator('.app-shell')).toHaveAttribute('data-page', target);
      await expect(page.locator('header.page-header')).toHaveCount(1);
      await expect(page.locator('header.page-header > .page-title h1')).toBeVisible();
      await expect(page.locator('header.page-header > .topbar.player-hud')).toBeVisible();
      await expect(page.locator('.page-title h1, .camp-heading h1')).toBeVisible();
      const title = (await page.locator('.page-title h1, .camp-heading h1').boundingBox())!;
      const hud = (await page.locator('.topbar.player-hud').boundingBox())!;
      expect(title.x, `${target}: margem do título`).toBeCloseTo(referenceTitle.x, 0);
      expect(title.y, `${target}: altura do título`).toBeCloseTo(referenceTitle.y, 0);
      expect(hud.x, `${target}: margem do seletor`).toBeCloseTo(referenceHud.x, 0);
      expect(hud.y, `${target}: altura do seletor`).toBeCloseTo(referenceHud.y, 0);
      if (target === 'shop') {
        const layout = (await page.locator('.shop-layout').boundingBox())!;
        expect(layout.x).toBeCloseTo(referenceTitle.x, 0);
        expect(layout.x + layout.width).toBeCloseTo(referenceHud.x + referenceHud.width, 0);
      }
    }
  }
  expect(errors).toEqual([]);
  console.log(
    'Loja: catálogo de 71 itens, checkout atômico, repetição concorrente, preços, saldo, validação, imagens, mesa, arraste, carrinho e mobile OK.',
  );
} catch (e) {
  await mkdir('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/shop-failure.png' });
  throw e;
} finally {
  await browser.close();
  await new Promise<void>((r) => server.close(() => r()));
  await pool.end();
}
