import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

if (!new URL(process.env.DATABASE_URL!).pathname.startsWith('/alvorada_test_'))
  throw new Error('Banco UUID isolado obrigatório.');
const origin = 'http://127.0.0.1:3002';
process.env.APP_ORIGIN = origin;
process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db.js');
const { migrate } = await import('../server/migrate.js');
const { seed } = await import('../server/seed.js');
await migrate();
await seed();
const { createApp } = await import('../server/app.js');
const { shopQaApp } = await import('./shop-qa-app.js');
const server = shopQaApp(createApp).listen(3002, '127.0.0.1');
await new Promise<void>((resolve) => server.once('listening', resolve));
const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL || 'msedge',
  headless: true,
});
const errors: string[] = [];
try {
  await mkdir('test-results', { recursive: true });
  const context = await browser.newContext({
    viewport: { width: 1898, height: 921 },
    reducedMotion: 'reduce',
    hasTouch: true,
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(origin);
  const signup = await page.request.post(origin + '/api/auth/sign-up/email', {
    headers: { Origin: origin },
    data: {
      name: 'Arquivo teste',
      email: `lore-menu-${randomUUID()}@example.test`,
      password: `Test-${randomUUID()}`,
    },
  });
  expect(signup.ok()).toBe(true);
  const user = (await signup.json()).user;
  await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [user.id]);
  const { createLegacyTestCharacter } = await import('../tests/character-fixtures.js');
  const hero = await createLegacyTestCharacter(user.id, 'Escriba');
  const { defaultChoices } = await import('../shared/character-sheet.js');
  const { vttProtocolVersion } = await import('../shared/vtt-protocol.js');
  const choices = defaultChoices('Humano', 'Guerreiro', 'Soldado');
  choices.options.humanFeat = ['Alerta'];
  choices.options.style = ['Arquearia'];
  await pool.query(
    "UPDATE characters SET race='Humano',background='Soldado',stats=$2,gold_cp=100000000 WHERE id=$1",
    [hero.id, JSON.stringify([16, 14, 13, 10, 12, 8])],
  );
  await pool.query(
    "INSERT INTO character_sheets(character_id,choices,finalized_at,rolls,assignment)VALUES($1,$2,now(),'[16,14,13,10,12,8]','[16,14,13,10,12,8]')",
    [hero.id, JSON.stringify(choices)],
  );
  const headers = { Origin: origin, 'X-Vtt-Schema-Version': String(vttProtocolVersion) };
  const withdrawn = (
    await pool.query(
      "SELECT * FROM catalog_items WHERE raw_data->>'magic_family'='Drow Weapon' ORDER BY id",
    )
  ).rows;
  assert.equal(withdrawn.length, 153);
  assert(withdrawn.every((item) => !item.active));
  const item = withdrawn.find((item) => item.id === 'drow-1-longsword');
  assert(item);
  // Simulate an existing purchase, then verify repeated seeding withdraws only the offer.
  await pool.query('UPDATE catalog_items SET active=true WHERE id=$1', [item.id]);
  const priorOrder = {
    character_id: hero.id,
    item_id: item.id,
    quantity: 1,
    idempotency_key: randomUUID(),
  };
  assert.equal(
    (await page.request.post(origin + '/api/purchases', { headers, data: priorOrder })).status(),
    201,
  );
  const inventoryBefore = (
    await pool.query(
      'SELECT to_jsonb(i) AS row FROM inventory i WHERE character_id=$1 ORDER BY item_id',
      [hero.id],
    )
  ).rows;
  const historyBefore = (
    await pool.query(
      'SELECT to_jsonb(p) AS row FROM purchases p WHERE character_id=$1 ORDER BY id',
      [hero.id],
    )
  ).rows;
  const goldBefore = (await pool.query('SELECT gold_cp FROM characters WHERE id=$1', [hero.id]))
    .rows;
  await seed();
  await seed();
  assert(
    (
      await pool.query(
        "SELECT active FROM catalog_items WHERE raw_data->>'magic_family'='Drow Weapon'",
      )
    ).rows.every((item) => !item.active),
  );
  assert.deepEqual(
    (
      await pool.query(
        'SELECT to_jsonb(i) AS row FROM inventory i WHERE character_id=$1 ORDER BY item_id',
        [hero.id],
      )
    ).rows,
    inventoryBefore,
  );
  assert.deepEqual(
    (
      await pool.query(
        'SELECT to_jsonb(p) AS row FROM purchases p WHERE character_id=$1 ORDER BY id',
        [hero.id],
      )
    ).rows,
    historyBefore,
  );
  const rejected = await page.request.post(origin + '/api/purchases', {
    headers,
    data: { ...priorOrder, idempotency_key: randomUUID() },
  });
  assert.equal(rejected.status(), 404);
  const checkout = await page.request.post(origin + '/api/shop/checkout', {
    headers,
    data: {
      character_id: hero.id,
      idempotency_key: randomUUID(),
      items: [{ item_id: item.id, quantity: 1 }],
    },
  });
  assert.equal(checkout.status(), 409);
  assert.equal(
    (await page.request.post(origin + '/api/purchases', { headers, data: priorOrder })).status(),
    200,
  );
  assert.deepEqual(
    (await pool.query('SELECT gold_cp FROM characters WHERE id=$1', [hero.id])).rows,
    goldBefore,
  );
  assert.equal(
    (
      await page.request.post(origin + '/api/inventory/equipment', {
        headers,
        data: { character_id: hero.id, item_id: item.id, slot: 'main_hand' },
      })
    ).status(),
    200,
  );
  const catalog = await (await page.request.get(origin + '/api/catalog')).json();
  assert(
    catalog.every(
      (offer: any) =>
        offer.magic_family !== 'Drow Weapon' && offer.category !== 'Itens mágicos especiais',
    ),
  );
  const key = await page.request.get(origin + '/shop/magic-completion-20261009/keycharm.webp');
  assert(key.ok());
  assert.equal(
    createHash('sha256')
      .update(await key.body())
      .digest('hex'),
    createHash('sha256')
      .update(
        await readFile(
          (process.env.SHOP_QA_PUBLIC_DIR || 'public') +
            '/shop/magic-completion-20261009/keycharm.webp',
        ),
      )
      .digest('hex'),
  );
  console.log(
    'PASS Empório: 153 ofertas drow inativas após seeds repetidos; compra/checkout bloqueados, replay/histórico/mochila/saldo e equipamento anterior preservados; chave corrigida servida.',
  );
  await page.goto(origin + '/#lore');
  await page.reload();
  const before = (await (await page.request.get(origin + '/api/lore-timeline')).json()).document;
  const timeline = page.getByRole('region', { name: 'Linha do tempo das eras' });
  await expect(timeline).toBeVisible();
  await expect(timeline.locator('.lore-era')).toHaveCount(before.eras.length);
  await expect(timeline.locator('.lore-time-gear').first()).toBeVisible();
  for (const width of [1898, 1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: width <= 390 ? 844 : 921 });
    await page.evaluate(() => scrollTo(0, 0));
    const account = page.locator('.profile-avatar');
    await expect(page.locator('.profile-menu-label')).toHaveCount(0);
    const portrait = (await account.boundingBox())!;
    assert.equal(portrait.width, 48);
    assert.equal(portrait.height, 48);
    await account.tap();
    await expect(page.locator('.profile-menu')).toHaveAttribute('data-pinned', 'true');
    await expect(page.locator('.logout-button')).toBeVisible();
    await expect(page.locator('.notifications-trigger')).toBeVisible();
    await expect(page.getByRole('listbox', { name: 'Seus personagens' })).toBeVisible();
    for (const [trigger, popup] of [
      ['.music-settings-trigger', '.music-volume-panel'],
      ['.notifications-trigger', '.notifications-panel'],
    ] as const) {
      if ((await page.locator('.profile-menu').getAttribute('data-pinned')) !== 'true')
        await account.tap();
      await page.locator(trigger).tap();
      await expect(page.locator(popup)).toBeVisible();
      const bounds = (await page.locator(popup).boundingBox())!;
      assert(bounds.x >= 0 && bounds.x + bounds.width <= width + 1, 'Painel da conta saiu da tela');
      await page.locator(trigger).tap();
    }
    await account.press('Escape');
    await expect(page.locator('.profile-menu')).toHaveAttribute('data-pinned', 'false');
    await page.locator('.lore-hero h1').tap();
    await page.mouse.move(12, 150);
    await page.screenshot({ path: `test-results/lore-menus-${width}-closed.png` });
    const menu = page.getByRole('button', { name: 'Abrir navegação', exact: true });
    const dock = (await page.locator('.journey-dock').boundingBox())!;
    assert(Math.abs(dock.x + dock.width / 2 - width / 2) < 1, 'Navegação saiu do centro');
    const scene = page.locator('.lore-scene');
    assert.equal(await scene.locator('.lore-scene-art').count(), 1);
    assert(
      (await timeline.evaluate((el) => getComputedStyle(el).backgroundColor)) ===
        'rgba(0, 0, 0, 0)',
      'Linha temporal perdeu o fundo contínuo',
    );
    await menu.tap();
    const tray = page.locator('#navigation-tray');
    await expect(tray).toBeVisible();
    await expect(tray.locator('.dock-item-label')).toHaveCount(0);
    for (const label of ['Início', 'Personagem', 'Mural', 'Loja', 'Explorar', 'Biblioteca'])
      await expect(tray.getByRole('button', { name: label, exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Biblioteca', exact: true }).tap();
    const panel = page.getByRole('region', { name: 'Opções de Biblioteca' });
    await expect(panel.getByRole('button', { name: 'Lore', exact: true })).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Regras', exact: true })).toBeVisible();
    for (const element of [page.locator('.profile-menu-controls'), tray, panel]) {
      if (await element.isVisible()) {
        const bounds = (await element.boundingBox())!;
        assert(bounds.x >= 0 && bounds.x + bounds.width <= width + 1, 'Menu saiu da tela');
      }
    }
    await page.screenshot({ path: `test-results/lore-menus-${width}-open.png` });
    await panel.getByRole('button', { name: 'Lore', exact: true }).press('Escape');
    await expect(panel).toHaveCount(0);
    await page.locator('#dock-library').press('Escape');
    await expect(menu).toBeFocused();
    await expect(tray).not.toBeVisible();
    await menu.press('ArrowUp');
    await expect(tray.locator('.dock-item').first()).toBeFocused();
    await tray.locator('.dock-item').first().press('Escape');
    await expect(menu).toBeFocused();
    await expect(tray).not.toBeVisible();
    await page.mouse.move(12, 150);
    await timeline.locator('.lore-era').last().tap();
    await expect(timeline.locator('.lore-era').last()).toHaveAttribute('aria-pressed', 'true');
    await timeline.getByRole('button', { name: 'Editar eras' }).tap();
    await expect(page.locator('.lore-era-editor')).toBeVisible();
    await page
      .locator('.lore-era-editor')
      .getByRole('button', { name: 'Cancelar', exact: true })
      .tap();
    assert(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      'Rolagem horizontal da página',
    );
  }
  const after = (await (await page.request.get(origin + '/api/lore-timeline')).json()).document;
  assert.deepEqual(after, before, 'Navegação alterou a linha temporal');
  await page.setViewportSize({ width: 1440, height: 921 });
  await page.goto(origin + '/#overview');
  await expect(page.locator('.app-shell')).toHaveAttribute('data-page', 'overview');
  await expect(page.locator('.profile-menu-label')).toHaveCount(0);
  await expect(page.locator('.dock-item-label')).toHaveCount(0);
  const avatar = (await page.locator('.profile-avatar').boundingBox())!;
  assert.equal(avatar.width, 48, 'A aparência de conta mudou em outra página');
  const dock = (await page.locator('.journey-dock').boundingBox())!;
  assert(Math.abs(dock.x + dock.width / 2 - 720) < 1, 'Menu das outras páginas perdeu a posição');
  await page.goto(origin + '/#shop');
  const shelves = page.getByRole('navigation', { name: 'Categorias da loja' });
  await expect(shelves).toBeVisible();
  await expect(shelves.getByText('Itens mágicos especiais', { exact: true })).toHaveCount(0);
  await page.getByLabel('Procurar item', { exact: true }).fill('Arma drow');
  await expect(page.locator('.shop-product')).toHaveCount(0);
  await page.getByLabel('Procurar item', { exact: true }).fill('Chave de vínculo');
  await page.screenshot({ path: 'test-results/lore-key-shop.png' });
  // Original armor pieces stay in storage; the sheet presents just the cuirass.
  const { purchaseContents } = await import('../shared/armor-bundles.js');
  for (const id of purchaseContents('plate-armor'))
    await pool.query(
      'INSERT INTO inventory(character_id,item_id,quantity)VALUES($1,$2,1)ON CONFLICT DO NOTHING',
      [hero.id, id],
    );
  let room = await (
    await page.request.post(origin + '/api/vtt', { headers, data: { name: 'Ficha organizada' } })
  ).json();
  room = await (
    await page.request.post(origin + '/api/vtt/rooms/' + room.id + '/characters/' + hero.id, {
      headers,
      data: {},
    })
  ).json();
  room.document.scenes[0].fog = false;
  room.document.scenes[0].lighting = false;
  const saved = await page.request.put(origin + '/api/vtt/rooms/' + room.id, {
    headers,
    data: { revision: room.revision, document: room.document },
  });
  assert(saved.ok());
  room = await saved.json();
  const token = room.document.scenes[0].tokens.find((t: any) => t.characterId === hero.id);
  assert(token);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(origin + '/#vtt');
  const board = page.getByLabel('Tabuleiro da mesa', { exact: true });
  await expect(board).toBeVisible();
  await expect(page.locator('.vtt-map-footer > span')).toHaveCount(0);
  const zoomBounds = (await page.locator('.vtt-map-footer > div').boundingBox())!;
  const footerBounds = (await page.locator('.vtt-map-footer').boundingBox())!;
  assert(Math.abs(zoomBounds.x + zoomBounds.width - footerBounds.x - footerBounds.width) < 1);
  const bounds = (await board.boundingBox())!;
  const camera = await board.evaluate((el) => ({
    x: Number(el.getAttribute('data-camera-x')),
    y: Number(el.getAttribute('data-camera-y')),
    zoom: Number(el.getAttribute('data-camera-zoom')),
  }));
  await board.click({
    button: 'right',
    position: {
      x: bounds.width / 2 + (token.x - camera.x) * camera.zoom,
      y: bounds.height / 2 + (token.y - camera.y) * camera.zoom,
    },
  });
  await page.getByRole('button', { name: 'Abrir ficha', exact: true }).click();
  const sheet = page.locator('.vtt-sheet-paper');
  await expect(sheet).toBeVisible();
  const weapons = sheet.locator('.vtt-sheet-weapons'),
    summary = weapons.locator('summary');
  await expect(weapons).toHaveAttribute('open', '');
  await summary.click();
  await expect(weapons).not.toHaveAttribute('open', '');
  await expect(weapons.getByLabel('Arma na mesa', { exact: true })).not.toBeVisible();
  await expect(summary).toBeVisible();
  await summary.press('Enter');
  await expect(weapons).toHaveAttribute('open', '');
  await summary.press('Space');
  await expect(weapons).not.toHaveAttribute('open', '');
  const apiSheet = await (
    await page.request.get(origin + '/api/vtt/rooms/' + room.id + '/sheets/' + token.id, {
      headers,
    })
  ).json();
  assert.equal(
    apiSheet.inventory.filter((i: any) => purchaseContents('plate-armor').includes(i.id)).length,
    6,
  );
  for (const label of ['Antecedente', 'Classe', 'Raça', 'Talentos']) {
    const group = sheet.getByRole('region', { name: label, exact: true });
    await expect(group).toBeVisible();
    assert.equal(
      await group.locator('h4').evaluate((el) => getComputedStyle(el).textAlign),
      'center',
    );
  }
  await expect(
    sheet
      .getByRole('region', { name: 'Classe', exact: true })
      .getByText('Retomar o fôlego:', { exact: false }),
  ).toBeVisible();
  await expect(
    sheet
      .getByRole('region', { name: 'Raça', exact: true })
      .getByText('Engenhosidade:', { exact: false }),
  ).toBeVisible();
  await expect(
    sheet
      .getByRole('region', { name: 'Talentos', exact: true })
      .getByText('Talento de origem: Alerta', { exact: true }),
  ).toBeVisible();
  assert.equal(
    await sheet.locator('.vtt-sheet-item').filter({ hasText: 'Armadura de placas' }).count(),
    1,
  );
  for (const name of [
    'Botas de placas',
    'Braçadeiras de placas',
    'Calça de placas',
    'Elmo de placas',
    'Ombreiras de placas',
  ])
    assert.equal(await sheet.locator('.vtt-sheet-item').filter({ hasText: name }).count(), 0);
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.screenshot({ path: 'test-results/sheet-organized-' + width + '.png' });
    assert(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      'Ficha fez rolagem horizontal',
    );
  }
  assert.deepEqual(errors, []);
  console.log(
    'PASS Lore em cinco larguras: menus originais, navegação central, conta/som/notificações, fundo contínuo, eras/editor e outras páginas; ficha real recolhe armas por clique/Enter/Espaço, agrupa características pela origem e mostra somente peitoral em quatro larguras.',
  );
  await context.close();
} catch (error) {
  for (const context of browser.contexts())
    for (const page of context.pages())
      await page.screenshot({ path: 'test-results/lore-menus-failure.png' });
  throw error;
} finally {
  await browser.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.end();
}
