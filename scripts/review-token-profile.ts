import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { chromium, expect, type BrowserContext, type Page } from '@playwright/test';
import { newToken } from '../shared/vtt';
import { vttProtocolVersion } from '../shared/vtt-protocol';
import { soundCatalog } from '../shared/vtt-sounds';
import { withdrawnWeaponModels } from '../shared/shop-availability';
if (!/^\/alvorada_test_[a-f0-9]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))
  throw Error('Banco UUID descartável obrigatório.');
const origin = 'http://127.0.0.1:3048';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db');
const { migrate } = await import('../server/migrate');
const { seed } = await import('../server/seed');
const { createLegacyTestCharacter } = await import('../tests/character-fixtures');
await migrate();
await seed();
const { createApp } = await import('../server/app');
const { shopQaApp } = await import('./shop-qa-app');
const server = shopQaApp(createApp).listen(3048, '127.0.0.1');
await new Promise<void>((resolve) => server.once('listening', resolve));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const contexts = await Promise.all(
  [0, 1, 2].map(() =>
    browser.newContext({
      viewport: { width: 1898, height: 921 },
      reducedMotion: 'reduce',
      extraHTTPHeaders: { 'X-Vtt-Schema-Version': String(vttProtocolVersion) },
    }),
  ),
);
const [gm, visitor, observer] = contexts;
const page = await visitor.newPage(),
  ownerPage = await gm.newPage(),
  peer = await observer.newPage();
const errors: string[] = [];
for (const p of [page, ownerPage, peer]) p.on('pageerror', (e) => errors.push(e.message));
async function api(ctx: BrowserContext, path: string, method = 'GET', data?: unknown) {
  const r = await ctx.request.fetch(origin + '/api' + path, {
    method,
    headers: { Origin: origin },
    data,
  });
  return { status: r.status(), data: await r.json() };
}
async function signup(ctx: BrowserContext, name: string) {
  const r = await api(ctx, '/auth/sign-up/email', 'POST', {
    name,
    email: randomUUID() + '@example.test',
    password: 'Test-' + randomUUID(),
  });
  assert.equal(r.status, 200);
  return r.data.user;
}
async function settle(p: Page) {
  await p.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((image) => image.decode().catch(() => {})));
  });
}
async function selectToken(
  p: Page,
  id: string,
  button: 'left' | 'right' = 'left',
  clickCount: 1 | 2 = 1,
) {
  const board = p.getByLabel('Tabuleiro da mesa', { exact: true });
  await expect(board).toBeVisible();
  if ((p.viewportSize()?.width || 1440) < 800 && (await p.locator('.vtt-panel').count()))
    await p.getByRole('button', { name: 'Alternar painel', exact: true }).click();
  const box = (await board.boundingBox())!;
  const camera = await board.evaluate((el) => ({
    x: Number(el.getAttribute('data-camera-x')),
    y: Number(el.getAttribute('data-camera-y')),
    zoom: Number(el.getAttribute('data-camera-zoom')),
  }));
  const saved = (await api(gm, root)).data.document.scenes[0].tokens.find((t: any) => t.id === id);
  await board.click({
    button,
    clickCount,
    position: {
      x: box.width / 2 + (saved.x - camera.x) * camera.zoom,
      y: box.height / 2 + (saved.y - camera.y) * camera.zoom,
    },
  });
  if (clickCount === 1)
    await expect(p.locator('.vtt-token-hud')).toHaveAttribute('data-token-id', id);
  return p.locator('.vtt-token-hud');
}
let root = '';
try {
  await mkdir('test-results', { recursive: true });
  const owner = await signup(gm, 'Pai do Cris'),
    guest = await signup(visitor, 'Visitante anônimo');
  await signup(observer, 'Observador');
  await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [owner.id]);
  const a = await createLegacyTestCharacter(owner.id, 'Nana'),
    b = await createLegacyTestCharacter(owner.id, 'Irineu');
  await createLegacyTestCharacter(guest.id, 'Visitante');
  const png = await sharp(await readFile('public/shop/merchant-v2.png'))
    .resize({ height: 900 })
    .png()
    .toBuffer();
  for (const c of [a, b]) {
    await pool.query('INSERT INTO character_portraits(character_id,image) VALUES($1,$2)', [
      c.id,
      png,
    ]);
    await pool.query('UPDATE characters SET portrait_revision=1,biography=$2 WHERE id=$1', [
      c.id,
      'História de ' + c.name,
    ]);
  }
  const withdrawn = (
    await pool.query(
      "SELECT id,active,raw_data->>'base_item' AS model FROM catalog_items WHERE raw_data->>'base_item'=ANY($1::text[])",
      [withdrawnWeaponModels],
    )
  ).rows;
  assert.equal(withdrawn.length, 168);
  assert(withdrawn.every((item) => !item.active));
  assert.deepEqual(
    [...new Set(withdrawn.map((item) => item.model))].sort(),
    [...withdrawnWeaponModels].sort(),
  );
  await pool.query('UPDATE characters SET gold_cp=100000000 WHERE id=$1', [a.id]);
  const historical = 'laser-pistol-plus-1';
  await pool.query('UPDATE catalog_items SET active=true WHERE id=$1', [historical]);
  const oldOrder = {
    character_id: a.id,
    item_id: historical,
    quantity: 1,
    idempotency_key: randomUUID(),
  };
  assert.equal((await api(gm, '/purchases', 'POST', oldOrder)).status, 201);
  const purchasesBefore = (
    await pool.query('SELECT to_jsonb(p) AS row FROM purchases p ORDER BY id')
  ).rows;
  const inventoryBefore = (
    await pool.query('SELECT to_jsonb(i) AS row FROM inventory i ORDER BY character_id,item_id')
  ).rows;
  const goldBefore = (await pool.query('SELECT id,gold_cp FROM characters ORDER BY id')).rows;
  await seed();
  await seed();
  assert.equal((await api(gm, '/purchases', 'POST', oldOrder)).status, 200);
  const catalog = (await api(gm, '/catalog')).data;
  assert(
    catalog.every(
      (item: any) =>
        !withdrawnWeaponModels.some((model) => model === item.id || model === item.base_item),
    ),
  );
  for (const model of withdrawnWeaponModels) {
    const id = withdrawn.find((item) => item.model === model && item.id.endsWith('-plus-1'))!.id;
    assert.equal(
      (
        await api(gm, '/purchases', 'POST', {
          ...oldOrder,
          item_id: id,
          idempotency_key: randomUUID(),
        })
      ).status,
      404,
    );
    assert.equal(
      (
        await api(gm, '/shop/checkout', 'POST', {
          character_id: a.id,
          idempotency_key: randomUUID(),
          items: [{ item_id: id, quantity: 1 }],
        })
      ).status,
      409,
    );
  }
  assert.deepEqual(
    (await pool.query('SELECT to_jsonb(p) AS row FROM purchases p ORDER BY id')).rows,
    purchasesBefore,
  );
  assert.deepEqual(
    (await pool.query('SELECT to_jsonb(i) AS row FROM inventory i ORDER BY character_id,item_id'))
      .rows,
    inventoryBefore,
  );
  assert.deepEqual(
    (await pool.query('SELECT id,gold_cp FROM characters ORDER BY id')).rows,
    goldBefore,
  );
  assert.equal(
    (
      await api(gm, '/inventory/equipment', 'POST', {
        character_id: a.id,
        item_id: historical,
        slot: 'main_hand',
      })
    ).status,
    200,
  );
  await ownerPage.goto(origin + '/#shop');
  const modelSelect = ownerPage.getByLabel('Tipo de arma de ARMA MÁGICA', { exact: true });
  await expect(modelSelect).toBeVisible();
  for (const model of withdrawnWeaponModels)
    assert(!(await modelSelect.locator('option[value="' + model + '"]').count()));
  assert.equal(await modelSelect.locator('option[value="hunting-rifle"]').count(), 1);
  assert.equal(
    (
      await api(gm, '/stable/purchase', 'POST', {
        character_id: a.id,
        mount_id: 'warhorse',
        coat: 'original',
        name: 'Brasa',
        equipment: [],
        idempotency_key: randomUUID(),
      })
    ).status,
    201,
  );
  const dog = await api(gm, '/pets/purchase', 'POST', {
    character_id: a.id,
    pet_id: 'dog',
    appearance: 'original',
    name: 'Cão do acampamento',
    idempotency_key: randomUUID(),
  });
  assert(dog.status < 300, 'Dog fixture purchase failed');
  await page.goto(origin + '/#profiles');
  await expect(page.locator('.profiles-directory-heading .social-eyebrow')).toHaveText(
    'Conheça os aventureiros de Alvorada',
  );
  await expect(page.locator('.profiles-top')).toHaveCount(0);
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 921 });
    await settle(page);
    await expect(page.getByLabel('Localizador de perfil')).toBeVisible();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.screenshot({ path: 'test-results/profile-directory-clean-' + width + '.png' });
  }
  await page.setViewportSize({ width: 1898, height: 921 });
  await page.goto(origin + '/#profiles?user=' + owner.id + '&character=' + a.id);
  await expect(page.locator('.visiting')).toBeVisible();
  await expect(page.locator('.profile-rating-callout')).toHaveText('Avalie');
  await expect(page.getByText('Sem votos', { exact: true })).toHaveCount(0);
  const profileDog = page.locator('.public-camp-pet');
  await expect(profileDog).toBeVisible();
  await expect(profileDog.locator('> span:not(.pet-art)')).not.toBeVisible();
  await profileDog.hover();
  await expect(profileDog.locator('> span:not(.pet-art)')).toBeVisible();
  assert((await profileDog.evaluate((el) => parseFloat(getComputedStyle(el).right))) > 140);
  const profileMount = page.getByRole('button', { name: 'Brasa', exact: true });
  await expect(profileMount).toBeVisible();
  await expect(profileMount.locator('.camp-mount-name')).not.toBeVisible();
  await profileMount.hover();
  await expect(profileMount.locator('.camp-mount-name')).toBeVisible();
  await page.screenshot({ path: 'test-results/profile-mount-hover-1898.png' });
  await profileMount.click();
  await page.mouse.move(950, 18);
  await expect(profileMount.locator('.camp-mount-name')).toBeVisible();
  await profileMount.click();
  await page.mouse.move(950, 18);
  await expect(profileMount.locator('.camp-mount-name')).not.toBeVisible();
  await expect(page.locator('.public-camp-heading h2')).toHaveText('Acampamento');
  await expect(page.locator('.profile-visit-selector strong')).toHaveText('Pai do Cris');
  await expect(page.locator('.profile-selected-character')).toHaveText('Nana');
  await expect(page.getByLabel('Personagem do perfil visitado')).toHaveCount(0);
  await expect(page.locator('.profile-character-avatar img')).toHaveAttribute(
    'src',
    new RegExp(a.id),
  );
  await page.getByRole('button', { name: 'Selecionar Irineu no perfil', exact: true }).click();
  await expect(page.locator('.profile-selected-character')).toHaveText('Irineu');
  await expect(page.locator('.profile-character-avatar img')).toHaveAttribute(
    'src',
    new RegExp(b.id),
  );
  await page.getByRole('button', { name: 'Selecionar Nana no perfil', exact: true }).click();
  await expect(page.locator('.profile-selected-character')).toHaveText('Nana');
  await page.getByRole('button', { name: 'Selecionar Nana no perfil', exact: true }).click();
  const next = page.locator('.profile-next-arrow:not(.profile-previous-arrow)');
  for (const width of [1898, 1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 921 });
    await settle(page);
    const identity = page.locator('.profile-visit-selector');
    const identityBox = (await identity.boundingBox())!;
    assert(identityBox.x >= 0 && identityBox.x + identityBox.width <= width + 1);
    await expect(identity).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(identity).toHaveCSS('border-top-width', '0px');
    await expect(page.locator('.profile-selected-character')).toHaveText('Nana');
    assert.equal(await page.locator('.public-profile-panel').count(), 4);
    for (const selector of [
      '.profile-visit-nav',
      '.profile-reviews',
      '.visited-profile-heading',
      '.visiting .profiles-top',
    ])
      assert.equal(await page.locator(selector).count(), 0, selector);
    const arrow = (await next.boundingBox())!;
    assert(arrow.width === 44 && arrow.height === 64);
    await expect(page.locator('.profile-previous-arrow')).toHaveCount(0);
    await expect(page.locator('.public-camp-heading')).toHaveText('Acampamento');
    await expect(page.locator('.public-character-info').first()).not.toBeVisible();
    assert(Math.abs(arrow.y + arrow.height / 2 - 460.5) < 1);
    assert(arrow.x + arrow.width <= width);
    await page.screenshot({ path: 'test-results/profile-arrow-camp-' + width + '.png' });
    await next.click();
    await expect(page.locator('#profile-panel-achievements')).toHaveAttribute(
      'aria-hidden',
      'false',
    );
    await settle(page);
    await expect(page.getByRole('button', { name: 'Aba anterior: Acampamento' })).toBeVisible();
    const cabinet = (await page.locator('.public-cabinet-stage .fantasy-cabinet').boundingBox())!;
    assert(cabinet.width >= width * 0.47);
    const room = (await page.locator('.public-cabinet-stage').boundingBox())!;
    assert(Math.abs(room.width - width) < 2);
    assert(Math.abs(room.height - 921) < 2);
    assert(Math.abs(room.x) < 2);
    assert(Math.abs(room.y) < 2);
    assert(
      (
        await page
          .locator('.public-cabinet-stage')
          .evaluate((el) => getComputedStyle(el).backgroundSize)
      ).includes('cover'),
    );
    await page.screenshot({ path: 'test-results/profile-arrow-room-' + width + '.png' });
    await page.getByRole('button', { name: 'Aba anterior: Acampamento' }).click();
    await expect(page.locator('#profile-panel-characters')).toHaveAttribute('aria-hidden', 'false');
    await next.click();
    await next.press('End');
    await expect(page.locator('#profile-panel-cards')).toHaveAttribute('aria-hidden', 'false');
    await next.press('Enter');
    await expect(page.locator('#profile-panel-characters')).toHaveAttribute('aria-hidden', 'false');
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  }
  await page.setViewportSize({ width: 1440, height: 921 });
  await page.getByRole('button', { name: 'Selecionar Irineu no perfil', exact: true }).hover();
  await expect(
    page.locator('.public-camp-character').nth(1).locator('.profile-figure-name'),
  ).toHaveCSS('opacity', '1');
  await expect(page.locator('.public-character-info').nth(1)).not.toBeVisible();
  await page.getByRole('button', { name: 'Selecionar Irineu no perfil', exact: true }).click();
  await expect(page.locator('.profile-selected-character')).toHaveText('Irineu');
  await expect(page.locator('.public-character-info').nth(1)).toBeVisible();
  await page.getByRole('button', { name: 'Ver ficha', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'Ficha de Irineu' });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText('História de Irineu', { exact: true })).toBeVisible();
  await expect(page.locator('.profile-character-avatar img')).toHaveAttribute(
    'src',
    new RegExp(b.id),
  );
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 921 });
    await page.screenshot({ path: 'test-results/profile-sheet-modal-' + width + '.png' });
    const box = (await sheet.boundingBox())!;
    assert(box.x >= 0 && box.x + box.width <= width + 1);
  }
  await sheet.press('Escape');
  await expect(sheet).toHaveCount(0);
  await expect(page.locator('#profile-panel-characters')).toHaveAttribute('aria-hidden', 'false');
  await page.setViewportSize({ width: 1440, height: 921 });
  const stars = page.getByRole('radiogroup', { name: 'Sua avaliação do perfil' });
  await expect(stars.getByRole('radio')).toHaveCount(5);
  await stars.getByRole('radio', { name: 'Avaliar com 2 estrelas', exact: true }).click();
  const reason = page.getByRole('form', { name: 'Justificar avaliação' });
  await expect(reason).toBeVisible();
  await expect(reason.getByRole('button', { name: 'Salvar avaliação' })).toBeDisabled();
  await reason
    .getByRole('textbox', { name: 'Justificativa' })
    .fill('Organize melhor as informações do perfil.');
  await reason.getByRole('button', { name: 'Salvar avaliação' }).click();
  await expect(reason).toHaveCount(0);
  await expect
    .poll(async () => (await api(visitor, '/profiles/' + owner.id)).data.own_review?.score)
    .toBe(2);
  let publicView = (await api(observer, '/profiles/' + owner.id)).data;
  assert.equal(publicView.reviews, undefined);
  assert.equal(publicView.own_review, null);
  assert.equal(publicView.rating.count, 1);
  assert.equal(publicView.rating.average, 2);
  assert(!JSON.stringify(publicView).includes('Organize melhor'));
  await stars.getByRole('radio', { name: 'Avaliar com 5 estrelas' }).click();
  await expect
    .poll(async () => (await api(visitor, '/profiles/' + owner.id)).data.own_review?.score)
    .toBe(5);
  assert.equal((await api(visitor, '/profiles/' + owner.id)).data.rating.count, 1);
  await next.click();
  await next.click();
  await expect(page.locator('#profile-panel-hall')).toHaveAttribute('aria-hidden', 'false');
  await page.getByRole('button', { name: 'Melhores perfis', exact: true }).click();
  await expect(page.locator('.hall-table-row')).toHaveCount(1);
  await expect(page.locator('.hall-champion h2')).toHaveText('Pai do Cris');
  await page.screenshot({ path: 'test-results/profile-best-profiles.png' });
  await next.press('Home');
  await pool.query('UPDATE characters SET biography=$2,portrait_revision=2 WHERE id=$1', [
    b.id,
    'História atualizada sem editar a visita',
  ]);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.locator('.profile-character-avatar img')).toHaveAttribute('src', /v=2/);
  await page.getByRole('button', { name: 'Ver ficha', exact: true }).click();
  await expect(
    page
      .getByRole('dialog', { name: 'Ficha de Irineu' })
      .getByText('História atualizada sem editar a visita', { exact: true }),
  ).toBeVisible();
  await page.getByRole('dialog').press('Escape');
  await ownerPage.goto(origin + '/#profiles?user=' + owner.id + '&character=' + a.id);
  await expect(ownerPage.locator('.profile-rating-corner')).toHaveCount(0);
  await ownerPage.goto(origin + '/#characters');
  const ownDog = ownerPage.locator('.camp-pet[data-pet-species="dog"]');
  await expect(ownDog).toBeVisible();
  assert((await ownDog.evaluate((el) => parseFloat(getComputedStyle(el).right))) > 140);
  await expect(ownDog.locator('> span:not(.pet-art)')).toBeVisible();
  await ownerPage.goto(origin + '/#hall');
  await expect(ownerPage.locator('.hall-champion')).toHaveCount(3);
  await expect(ownerPage.locator('.hall-champion .hall-portrait')).toHaveCount(0);
  for (const width of [1440, 768, 390, 320]) {
    await ownerPage.setViewportSize({ width, height: 921 });
    await settle(ownerPage);
    const figures = ownerPage.locator('.hall-character-art img');
    await expect(figures).toHaveCount(3);
    await expect
      .poll(() =>
        figures.evaluateAll((images) =>
          images.every(
            (img) =>
              (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0,
          ),
        ),
      )
      .toBe(true);
    await expect(figures.first()).toHaveCSS('object-fit', 'contain');
    await expect(ownerPage.locator('.hall-character-art').first()).toHaveCSS(
      'border-radius',
      '0px',
    );
    assert(
      await figures.evaluateAll((images) =>
        images.every((img) => !(img as HTMLImageElement).src.includes('thumb=1')),
      ),
    );
    assert(await ownerPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await ownerPage.screenshot({ path: 'test-results/hall-full-characters-' + width + '.png' });
  }
  await ownerPage
    .locator('.hall-champion')
    .filter({ has: ownerPage.getByRole('heading', { name: 'Irineu', exact: true }) })
    .click();
  await expect(ownerPage.locator('.profile-selected-character')).toHaveText('Irineu');
  await ownerPage.goto(origin + '/#pets');
  const picker = ownerPage.getByLabel('Mascote à venda', { exact: true });
  await expect(picker).toBeVisible();
  await expect(picker.locator('option')).toHaveCount(10);
  await expect(ownerPage.locator('.pet-shop-catalog')).toHaveCount(0);
  for (const width of [1440, 768, 390, 320]) {
    await ownerPage.setViewportSize({ width, height: 921 });
    await picker.selectOption('rabbit');
    await expect(ownerPage.locator('.pet-shop-details > h3')).toHaveText('Coelho');
    await ownerPage.getByLabel('Como vai se chamar?', { exact: true }).fill('Companheiro');
    await expect(
      ownerPage.getByRole('button', { name: 'Levar este companheiro', exact: true }),
    ).toBeEnabled();
    await picker.selectOption('dog');
    await expect(ownerPage.getByLabel('Como vai se chamar?', { exact: true })).toHaveValue('');
    const menu = (await ownerPage.locator('.pet-shop-purchase').boundingBox())!;
    assert(menu.x >= 0 && menu.x + menu.width <= width + 1);
    assert(await ownerPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await ownerPage.screenshot({ path: 'test-results/pet-sidebar-' + width + '.png' });
  }
  await ownerPage.goto(origin + '/#inventory');
  await expect(ownerPage.locator('.loot-inventory')).toBeVisible();
  await expect(
    ownerPage.getByRole('button', { name: 'Transferir entre inventários', exact: true }),
  ).toHaveCount(0);
  let room = (await api(gm, '/vtt', 'POST', { name: 'Menu radial' })).data;
  assert(room.id);
  root = '/vtt/rooms/' + room.id;
  assert.equal(
    (await api(visitor, '/vtt/join', 'POST', { invite: room.invite, role: 'player' })).status,
    200,
  );
  assert.equal(
    (await api(observer, '/vtt/join', 'POST', { invite: room.invite, role: 'spectator' })).status,
    200,
  );
  room = (await api(gm, root)).data;
  const scene = room.document.scenes[0];
  scene.fog = scene.lighting = false;
  scene.width = 1400;
  scene.height = 1000;
  const token = {
    ...newToken(randomUUID(), scene),
    name: 'Portador dos símbolos',
    controller: guest.id,
    x: 600,
    y: 450,
    width: 180,
    height: 90,
    hp: 50,
    maxHp: 50,
    image: '/vtt/monsters/monster-allosaurus.webp',
    sheet: {
      source: 'Teste de ficha',
      race: '',
      class: '',
      level: 1,
      stats: [10, 10, 10, 10, 10, 10],
      speed: 30,
      biography: 'Anotações preservadas',
      details: '',
    },
  };
  const other = {
    ...newToken(randomUUID(), scene),
    name: 'Token do mestre',
    x: 1000,
    y: 700,
    locked: true,
  };
  scene.tokens = [token, other];
  room = (await api(gm, root, 'PUT', { revision: room.revision, document: room.document })).data;
  assert(room.id);
  const imported = await api(gm, root + '/characters/' + a.id, 'POST', {
    position: { x: 850, y: 400 },
  });
  assert.equal(imported.status, 201);
  const characterToken = imported.data.document.scenes[0].tokens.find(
    (t: any) => t.characterId === a.id,
  );
  assert(characterToken);
  const hotbarState = (await api(gm, root + '/hotbar')).data;
  hotbarState.document.pages[0].slots[0] = {
    kind: 'sound',
    sourceId: soundCatalog.find((sound) => sound.kind === 'effect')!.id,
    label: 'Som da mesa',
  };
  assert.equal(
    (
      await api(gm, root + '/hotbar', 'PUT', {
        revision: hotbarState.revision,
        document: hotbarState.document,
      })
    ).status,
    200,
  );
  await ownerPage.setViewportSize({ width: 1440, height: 921 });
  await ownerPage.goto(origin + '/#vtt');
  let hud = await selectToken(ownerPage, token.id);
  await expect(hud.locator('.vtt-token-bubble')).toHaveCount(3);
  await expect(
    hud.getByRole('button', { name: 'Configurações do token', exact: true }),
  ).toBeVisible();
  await hud.getByRole('button', { name: 'Pontos de vida: 50/50', exact: true }).click();
  let panel = hud.getByRole('dialog', { name: 'Pontos de vida', exact: true });
  await panel.getByLabel('Editar PV do token', { exact: true }).fill('-5');
  await panel.getByRole('button', { name: 'Aplicar PV', exact: true }).click();
  await expect
    .poll(async () => (await api(gm, root)).data.document.scenes[0].tokens[0].hp)
    .toBe(45);
  await hud.getByRole('button', { name: 'Fechar painel do token', exact: true }).click();
  await hud.getByRole('button', { name: 'Configurações do token', exact: true }).click();
  panel = hud.getByRole('dialog', { name: 'Configurações do token', exact: true });
  await expect(panel.getByRole('slider', { name: 'Tamanho do token', exact: true })).toBeVisible();
  await expect(panel.getByLabel('Esta criatura sangra', { exact: true })).toBeVisible();
  await panel.getByLabel('Esta criatura sangra', { exact: true }).uncheck();
  await expect
    .poll(async () => (await api(gm, root)).data.document.scenes[0].tokens[0].bleeds)
    .toBe(false);
  await panel.locator('.vtt-context-options > summary').click();
  for (const name of [
    'Combate',
    'Camada e profundidade',
    'Movimento vinculado',
    'Orientação',
    'Visibilidade e organização',
  ])
    await expect(panel.locator('summary').filter({ hasText: name })).toBeVisible();
  await hud.getByRole('button', { name: 'Condições do token', exact: true }).click();
  panel = hud.getByRole('dialog', { name: 'Condições', exact: true });
  await expect(
    panel.getByRole('group', { name: 'Ícones de condições' }).getByRole('button'),
  ).toHaveCount(30);
  await panel.getByRole('button', { name: 'Cego', exact: true }).click();
  await expect
    .poll(async () => (await api(gm, root)).data.document.scenes[0].tokens[0].conditions)
    .toContain('Cego');
  await expect(
    hud.getByRole('button', { name: 'Minimizar menu do token', exact: true }),
  ).toHaveCount(0);
  await expect(hud.locator('.vtt-token-actions > button')).toHaveCount(4);
  for (const width of [1440, 768, 390, 320]) {
    await ownerPage.setViewportSize({ width, height: 921 });
    await selectToken(ownerPage, token.id, 'right');
    await hud.getByRole('button', { name: 'Condições do token', exact: true }).click();
    const bounds = (await hud.locator('.vtt-token-popover').boundingBox())!;
    assert(
      bounds.x >= 0 &&
        bounds.x + bounds.width <= width + 1 &&
        bounds.y >= 0 &&
        bounds.y + bounds.height <= 922,
    );
    await ownerPage.screenshot({ path: 'test-results/token-radial-conditions-' + width + '.png' });
    await hud.getByRole('button', { name: 'Fechar painel do token', exact: true }).click();
  }
  await ownerPage.setViewportSize({ width: 1440, height: 921 });
  await selectToken(ownerPage, token.id);
  await hud.getByRole('button', { name: 'Configurações do token', exact: true }).click();
  await ownerPage.screenshot({ path: 'test-results/token-radial-settings.png' });
  await ownerPage.getByRole('dialog', { name: 'Configurações do token' }).press('Escape');
  await expect(hud.locator('.vtt-token-popover')).toHaveCount(0);
  await selectToken(ownerPage, token.id, 'left', 2);
  const monsterSheet = ownerPage.getByRole('dialog', {
    name: 'Ficha · Portador dos símbolos',
    exact: true,
  });
  await expect(monsterSheet).toBeVisible();
  await expect(ownerPage.locator('.vtt-token-hud')).toHaveCount(0);
  await monsterSheet.getByRole('button', { name: 'Minimizar ficha', exact: true }).click();
  await expect(monsterSheet.locator('.vtt-sheet-window-body')).not.toBeVisible();
  await monsterSheet.getByRole('button', { name: 'Restaurar ficha', exact: true }).click();
  await expect(monsterSheet.locator('.vtt-sheet-window-body')).toBeVisible();
  await monsterSheet.press('Escape');
  await expect(ownerPage.locator('.vtt-token-hud')).toHaveCount(0);
  await selectToken(ownerPage, token.id);
  await hud.getByRole('button', { name: 'Abrir ficha', exact: true }).click();
  await expect(monsterSheet).toBeVisible();
  await expect(ownerPage.locator('.vtt-token-hud')).toHaveCount(0);
  await monsterSheet.press('Escape');
  await selectToken(ownerPage, characterToken.id, 'left', 2);
  const characterSheet = ownerPage.getByRole('dialog', { name: 'Ficha · Nana', exact: true });
  await expect(characterSheet.locator('.vtt-sheet-banner')).toBeVisible();
  await expect(ownerPage.locator('.vtt-token-hud')).toHaveCount(0);
  await expect(
    characterSheet.getByText('ALVORADA CINZENTA · FICHA DE MESA', { exact: true }),
  ).toHaveCount(0);
  const portrait = characterSheet.getByRole('img', { name: 'Retrato de Nana', exact: true });
  await expect(portrait).toBeVisible();
  await expect
    .poll(() => portrait.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0))
    .toBe(true);
  await expect(portrait).toHaveCSS('border-top-width', '0px');
  const nameBox = (await characterSheet.locator('.vtt-sheet-identity h2').boundingBox())!;
  const portraitBox = (await portrait.boundingBox())!;
  assert(portraitBox.x + portraitBox.width < nameBox.x);
  await characterSheet.getByRole('button', { name: 'Biografia', exact: true }).click();
  await characterSheet.getByRole('button', { name: 'Minimizar ficha', exact: true }).click();
  await expect(characterSheet.locator('.vtt-sheet-window-body')).not.toBeVisible();
  await ownerPage.screenshot({ path: 'test-results/vtt-sheet-minimized.png' });
  await characterSheet.getByRole('button', { name: 'Restaurar ficha', exact: true }).click();
  await expect(
    characterSheet.getByRole('button', { name: 'Biografia', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await characterSheet.getByRole('button', { name: 'Essencial', exact: true }).click();
  await ownerPage.locator('.vtt-hotbar-slot').first().click();
  await expect(ownerPage.locator('.vtt-hotbar-action')).toBeVisible();
  await expect
    .poll(async () => {
      const box = (await characterSheet.boundingBox())!;
      const bar = (await ownerPage.locator('.vtt-hotbar').boundingBox())!;
      return box.y + box.height <= bar.y - 8;
    })
    .toBe(true);
  await ownerPage.screenshot({ path: 'test-results/vtt-sheet-quick-action.png' });
  await ownerPage.getByRole('button', { name: 'Fechar atalho', exact: true }).click();
  for (const width of [1440, 768, 390, 320]) {
    await ownerPage.setViewportSize({ width, height: 921 });
    const box = (await characterSheet.boundingBox())!;
    const bar = (await ownerPage.locator('.vtt-hotbar').boundingBox())!;
    assert(box.y < 24 && box.y + box.height <= bar.y - 8, 'Sheet overlaps quick actions');
    assert(box.x >= 0 && box.x + box.width <= width);
    await ownerPage.screenshot({ path: 'test-results/vtt-sheet-window-' + width + '.png' });
  }
  await ownerPage.setViewportSize({ width: 1440, height: 921 });
  const handle = characterSheet.getByLabel('Mover janela da ficha', { exact: true });
  const initial = (await characterSheet.boundingBox())!;
  const handleBox = (await handle.boundingBox())!;
  await ownerPage.mouse.move(handleBox.x + 200, handleBox.y + 20);
  await ownerPage.mouse.down();
  await ownerPage.mouse.move(handleBox.x + 230, handleBox.y + 20);
  await ownerPage.mouse.up();
  assert((await characterSheet.boundingBox())!.x >= initial.x + 20);
  await handle.focus();
  await handle.press('ArrowLeft');
  await characterSheet.press('Escape');
  await expect(ownerPage.locator('.vtt-token-hud')).toHaveCount(0);
  await page.goto(origin + '/#vtt');
  const playerHud = await selectToken(page, token.id);
  await playerHud.getByRole('button', { name: 'Pontos de vida: 45/50', exact: true }).click();
  await expect(playerHud.getByLabel('Editar PV do token', { exact: true })).toHaveCount(0);
  await playerHud.getByRole('button', { name: 'Condições do token', exact: true }).click();
  await expect(playerHud.getByRole('button', { name: 'Cego', exact: true })).toBeDisabled();
  await playerHud.getByRole('button', { name: 'Agarrado', exact: true }).click();
  await expect
    .poll(async () => (await api(gm, root)).data.document.scenes[0].tokens[0].conditions)
    .toContain('Agarrado');
  await peer.goto(origin + '/#vtt');
  await expect(peer.getByLabel('Tabuleiro da mesa', { exact: true })).toBeVisible();
  await peer.getByLabel('Tabuleiro da mesa', { exact: true }).click();
  await expect(peer.locator('.vtt-token-hud')).toHaveCount(0);
  assert.deepEqual(errors, []);
  console.log(
    'PASS real Edge: clean profile directory and concrete heading; transparent traveler identity and character name/portrait switch; mount hover/click names and dog further left on both pages; profile navigation/room/rating, pet sidebar and movable sheets preserved across mobile/desktop widths and permissions.',
  );
} catch (error) {
  for (const ctx of contexts)
    for (const tab of ctx.pages())
      await tab
        .screenshot({
          path:
            'test-results/token-profile-error-' +
            contexts.indexOf(ctx) +
            '-' +
            ctx.pages().indexOf(tab) +
            '.png',
        })
        .catch(() => {});
  throw error;
} finally {
  await browser.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.end();
}
