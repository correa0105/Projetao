import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
if (!/^\/alvorada_test_[0-9a-f]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))
  throw Error('Banco descartável obrigatório.');
const origin = 'http://localhost:3042';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db.js');
const { migrate } = await import('../server/migrate.js');
const { seed } = await import('../server/seed.js');
const { createLegacyTestCharacter } = await import('../tests/character-fixtures.js');
await migrate();
await seed();
const { createApp } = await import('../server/app.js');
const server = createApp().listen(3042, '127.0.0.1');
await new Promise<void>((resolve) => server.once('listening', resolve));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  reducedMotion: 'reduce',
});
const page = await context.newPage();
let releaseSave: (() => void) | undefined;
const errors: string[] = [];
page.on('pageerror', (error) => errors.push(error.message));
await context.addInitScript(() => {
  localStorage.setItem('alvorada-music-muted', 'true');
  localStorage.setItem('alvorada-effects-muted', 'true');
});
async function request(path: string, data?: unknown, method = 'POST') {
  const response = await context.request.fetch(origin + '/api' + path, {
    method,
    headers: { Origin: origin },
    data,
  });
  expect(response.ok(), method + ' ' + path).toBe(true);
  return response.json();
}
async function containment() {
  await expect
    .poll(() => page.locator('.house-scene').evaluate((el) => el.clientWidth > 0))
    .toBe(true);
  const scene = (await page.locator('.house-scene').boundingBox())!;
  expect(scene.x).toBeGreaterThanOrEqual(0);
  expect(scene.y).toBeGreaterThanOrEqual(0);
  const viewport = page.viewportSize()!;
  expect(scene.x + scene.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(scene.y + scene.height).toBeLessThanOrEqual(viewport.height + 1);
  expect(Math.abs(scene.width / scene.height - 16 / 9)).toBeLessThan(0.01);
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <= innerWidth &&
        document.documentElement.scrollHeight <= innerHeight + 1,
    ),
  ).toBe(true);
  await page.evaluate(() => scrollTo(50, 500));
  expect(await page.evaluate(() => ({ x: scrollX, y: scrollY }))).toEqual({ x: 0, y: 0 });
  await expect(page.locator('.journey-dock')).toBeVisible();
  await expect(page.locator('.page-header')).toBeVisible();
  const header = (await page.locator('.page-header').boundingBox())!;
  const workspace = (await page.locator('.house-workspace').boundingBox())!;
  expect(workspace.y).toBeGreaterThanOrEqual(header.y + header.height + 7);
  const mainMenu = (await page.locator('.journey-dock').boundingBox())!;
  expect(workspace.y + workspace.height).toBeLessThanOrEqual(mainMenu.y + 1);
  const nav = (await page.getByRole('navigation', { name: 'Controles da casa' }).boundingBox())!;
  expect(nav.x).toBeLessThan(scene.x);
  expect(nav.height).toBeGreaterThan(nav.width);
  return scene;
}
async function navigate(group: string, destination: string) {
  const nav = page.getByRole('navigation', { name: 'Navegação principal', exact: true });
  const opener = nav.getByRole('button', { name: 'Abrir navegação', exact: true });
  if (await opener.isVisible()) await opener.click();
  await nav.getByRole('button', { name: group, exact: true }).click();
  await nav.getByRole('button', { name: destination, exact: true }).click();
}
try {
  const account = await request('/auth/sign-up/email', {
    name: 'House imersiva',
    email: randomUUID() + '@example.test',
    password: 'Test-' + randomUUID(),
  });
  const hero = await createLegacyTestCharacter(account.user.id, 'Aurora');
  await pool.query('UPDATE characters SET gold_cp=500000,portrait_revision=1 WHERE id=$1', [
    hero.id,
  ]);
  await pool.query('INSERT INTO character_portraits(character_id,image) VALUES($1,$2)', [
    hero.id,
    await readFile('public/character-silhouette-v2.png'),
  ]);
  const homeId = (await request('/house', { character_id: hero.id })).id;
  const table = (
    await request('/house/purchase', {
      character_id: hero.id,
      catalog_id: 'table',
      idempotency_key: randomUUID(),
    })
  ).item_id;
  const letter = (
    await request('/house/purchase', {
      character_id: hero.id,
      catalog_id: 'letter',
      idempotency_key: randomUUID(),
      content: { title: 'Carta da janela', text: 'O cenário continua inteiro.' },
    })
  ).item_id;
  let state = await request('/house/' + homeId, undefined, 'GET');
  const tableId = randomUUID();
  state.rooms[0].placements = [
    {
      id: tableId,
      kind: 'item',
      ref: table,
      x: 0.3,
      y: 0.78,
      scale: 0.2,
      rotation: 0,
      facing: 0,
      layer: 8,
    },
  ];
  await request(
    '/house/' + homeId,
    { name: state.name, revision: state.revision, rooms: state.rooms },
    'PUT',
  );
  await request(
    '/house/' + homeId + '/presence',
    {
      character_id: hero.id,
      variant_id: null,
      room: 'sala',
      x: 0.7,
      y: 0.82,
      scale: 0.19,
      layer: 602,
    },
    'PUT',
  );
  await mkdir('test-results', { recursive: true });
  for (const viewport of [
    { width: 1920, height: 1080 },
    { width: 1440, height: 900 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
    { width: 320, height: 568 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto(origin + '/#house');
    await page.reload();
    await expect(page.locator('.house-piece')).toHaveCount(1);
    await expect
      .poll(() =>
        page
          .locator('.house-actor img')
          .evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0),
      )
      .toBe(true);
    await expect(page.getByRole('button', { name: 'Ajustar peça', exact: true })).toHaveCount(0);
    await expect(page.locator('.house-piece-tools')).toHaveCount(0);
    const closed = await containment();
    const actor = page.locator('.house-actor');
    const actorBox = (await actor.boundingBox())!;
    const grab = { x: actorBox.x + actorBox.width * 0.3, y: actorBox.y + actorBox.height * 0.5 };
    await page.mouse.move(grab.x, grab.y);
    await page.mouse.down();
    const down = (await actor.boundingBox())!;
    expect(Math.abs(down.x - actorBox.x)).toBeLessThan(1);
    expect(Math.abs(down.y - actorBox.y)).toBeLessThan(1);
    const target = { x: grab.x + closed.width * 0.025, y: grab.y - closed.height * 0.03 };
    await page.mouse.move(target.x, target.y);
    const held = (await actor.boundingBox())!;
    expect(Math.abs(held.x + held.width * 0.3 - target.x)).toBeLessThan(2);
    expect(Math.abs(held.y + held.height * 0.5 - target.y)).toBeLessThan(2);
    await page.mouse.up();
    await page.getByRole('button', { name: 'Decorar', exact: true }).click();
    await expect(page.locator('.house-panel')).toBeVisible();
    await containment();
    const item = page.locator('[data-house-piece="' + tableId + '"]');
    const before = (await page.locator('.house-scene').boundingBox())!;
    await item.click();
    await expect(page.getByLabel('Direção da peça', { exact: true })).toBeVisible();
    const after = (await page.locator('.house-scene').boundingBox())!;
    expect(after).toEqual(before);
    await page.getByLabel('Direção da peça', { exact: true }).selectOption('1');
    await expect(item).toHaveAttribute('data-facing', '1');
    await page.getByLabel('Giro da peça', { exact: true }).focus();
    await page.getByLabel('Giro da peça', { exact: true }).press('ArrowRight');
    await page.getByRole('button', { name: 'Endireitar', exact: true }).click();
    await expect(page.getByLabel('Giro da peça', { exact: true })).toHaveValue('0');
    await page.getByRole('button', { name: 'Enviar para trás', exact: true }).click();
    await page.getByRole('button', { name: 'Trazer à frente', exact: true }).click();
    await page.getByLabel('Camada do personagem', { exact: true }).selectOption('0');
    await expect(actor).toHaveAttribute('data-layer', '0');
    await page.getByRole('button', { name: 'À frente da mobília', exact: true }).click();
    await expect(actor).toHaveAttribute('data-layer', '602');
    await page.locator('.house-sidebar').evaluate((el) => (el.scrollTop = 0));
    await page.screenshot({
      path: 'test-results/house-viewport-selected-' + viewport.width + '.png',
    });
    if (viewport.width === 1920) {
      let reached!: () => void;
      const blocked = new Promise<void>((resolve) => (reached = resolve));
      const release = new Promise<void>((resolve) => (releaseSave = resolve));
      await page.route(
        origin + '/api/house/' + homeId,
        async (route) => {
          if (route.request().method() !== 'PUT') {
            await route.continue();
            return;
          }
          const response = await route.fetch();
          reached();
          await release;
          await route.fulfill({ response });
        },
        { times: 1 },
      );
      await page.getByRole('button', { name: 'Salvar mudanças', exact: true }).click();
      await blocked;
      await expect(page.getByLabel('Direção da peça', { exact: true })).toBeDisabled();
      await expect(page.getByLabel('Tamanho da peça', { exact: true })).toBeDisabled();
      await expect(page.getByLabel('Nome da casa', { exact: true })).toBeDisabled();
      await expect(page.getByRole('combobox', { name: 'Cenário', exact: true })).toBeDisabled();
      await expect(
        page.locator('.house-inventory-item > button').filter({ hasText: 'Carta da janela' }),
      ).toBeDisabled();
      const beforeBusy = await item.getAttribute('data-facing');
      await item.dispatchEvent('pointerdown', {
        button: 0,
        clientX: before.x + before.width * 0.3,
        clientY: before.y + before.height * 0.7,
        pointerId: 1,
      });
      await expect(item).toHaveAttribute('data-facing', beforeBusy!);
      releaseSave!();
    } else await page.getByRole('button', { name: 'Salvar mudanças', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Salvo', exact: true })).toBeDisabled();
    await page.screenshot({
      path: 'test-results/house-viewport-inspector-' + viewport.width + '.png',
    });
    await page.getByRole('button', { name: 'Fechar painel', exact: true }).click();
    await containment();
    await page.getByRole('button', { name: 'Mobília', exact: true }).click();
    await expect(page.locator('.house-catalog > button')).toHaveCount(12);
    await page.locator('.house-catalog > button').last().scrollIntoViewIfNeeded();
    await containment();
    await page.getByRole('button', { name: 'Fechar painel', exact: true }).click();
    await page.getByRole('button', { name: 'RP', exact: true }).click();
    const input = page.getByLabel('Mensagem de Aurora', { exact: true });
    await input.fill('Mensagem ' + viewport.width);
    await input.press('Enter');
    await expect(page.getByRole('log', { name: 'Conversa de RP' })).toContainText(
      'Mensagem ' + viewport.width,
    );
    await expect(input).toBeFocused();
    await containment();
    await page.getByLabel('Manter RP aberto', { exact: true }).check();
    await page.getByRole('button', { name: 'Decorar', exact: true }).click();
    await expect(input).toBeVisible();
    await containment();
    await page.getByRole('button', { name: 'RP', exact: true }).click();
    await page.getByLabel('Manter RP aberto', { exact: true }).uncheck();
    await page.getByRole('button', { name: 'RP', exact: true }).click();
    await page.screenshot({ path: 'test-results/house-viewport-scene-' + viewport.width + '.png' });
    await pool.query(
      "UPDATE house_messages SET created_at=now()-interval '2 seconds' WHERE user_id=$1",
      [account.user.id],
    );
    await navigate('Loja', 'Empório');
    await expect(page).toHaveURL(origin + '/#shop');
    await expect(page.locator('.house-workspace')).toHaveCount(0);
    expect(await page.evaluate(() => document.body.classList.contains('house-immersive'))).toBe(
      false,
    );
    await navigate('Loja', 'Estábulo');
    await expect(page).toHaveURL(origin + '/#stable');
    await navigate('Explorar', 'House');
    await expect(page).toHaveURL(origin + '/#house');
    await expect(page.locator('.house-piece')).toHaveCount(1);
    await containment();
    const nav = page.getByRole('navigation', { name: 'Navegação principal', exact: true });
    await nav.getByRole('button', { name: 'Abrir navegação', exact: true }).click();
    await nav.getByRole('button', { name: 'Loja', exact: true }).click();
    await expect(nav.getByRole('button', { name: 'Empório', exact: true })).toBeVisible();
    await page.screenshot({
      path: 'test-results/house-viewport-global-menu-' + viewport.width + '.png',
    });
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await page.mouse.move(0, 0);
  }
  state = await request('/house/' + homeId, undefined, 'GET');
  expect(state.rooms[0].placements[0].facing).toBe(1);
  expect(state.inventory.some((i: any) => i.id === letter)).toBe(true);
  await page.getByRole('link', { name: 'Sair da House', exact: true }).click();
  await expect(page.locator('.house-workspace')).toHaveCount(0);
  expect(await page.evaluate(() => document.body.classList.contains('house-immersive'))).toBe(
    false,
  );
  await expect(page.locator('.journey-dock')).toBeVisible();
  expect(errors).toEqual([]);
  console.log(
    'House viewport: five sizes, contained scene/no page scroll, site header/main navigation accessible; real Menu navigation to Empório, Estábulo and back, left House navigation/right inspector/mobile drawer, click/held cursor, eight-view controls/layers/save, RP focus/pin passed.',
  );
} finally {
  releaseSave?.();
  await browser.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.end();
}
