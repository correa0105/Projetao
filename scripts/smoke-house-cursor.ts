import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { houseCatalog } from '../shared/house.js';
if (!/^\/alvorada_test_[0-9a-f]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))
  throw Error('Banco isolado obrigatório.');
const origin = 'http://localhost:3010';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db.js');
const { migrate } = await import('../server/migrate.js');
const { seed } = await import('../server/seed.js');
const { createLegacyTestCharacter } = await import('../tests/character-fixtures.js');
await migrate();
await seed();
const { createApp } = await import('../server/app.js');
const server = createApp().listen(3010, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
async function request(path: string, data: unknown, method = 'POST') {
  const response = await context.request.fetch(origin + '/api' + path, {
    method,
    headers: { Origin: origin },
    data,
  });
  expect(response.ok()).toBe(true);
  return response.json();
}
try {
  const account = await request('/auth/sign-up/email', {
    name: 'Teste das camadas',
    email: `house-cursor-${randomUUID()}@example.test`,
    password: `Test-${randomUUID()}`,
  });
  const hero = await createLegacyTestCharacter(account.user.id, 'Cursor');
  await pool.query('UPDATE characters SET gold_cp=500000 WHERE id=$1', [hero.id]);
  await pool.query('INSERT INTO character_portraits(character_id,image) VALUES($1,$2)', [
    hero.id,
    await readFile('public/character-silhouette-v2.png'),
  ]);
  await pool.query('UPDATE characters SET portrait_revision=1 WHERE id=$1', [hero.id]);
  const home = await request('/house', { character_id: hero.id });
  const homeId = home.id || home.home?.id;
  expect(homeId).toBeTruthy();
  const purchased = await request('/house/purchase', {
    character_id: hero.id,
    catalog_id: 'table',
    idempotency_key: randomUUID(),
  });
  const state = await context.request.get(origin + '/api/house/' + homeId).then((r) => r.json());
  const letter = await request('/house/purchase', {
    character_id: hero.id,
    catalog_id: 'letter',
    idempotency_key: randomUUID(),
    content: { title: 'Dois cliques', text: 'Uma carta guardada junto à lareira.' },
  });
  state.rooms[0].placements = [
    {
      id: randomUUID(),
      kind: 'item',
      ref: purchased.item_id,
      x: 0.5,
      y: 0.85,
      scale: 0.42,
      rotation: 0,
      facing: 0,
      layer: 8,
      perspective_pitch: 20,
      perspective_yaw: -20,
    },
    {
      id: randomUUID(),
      kind: 'item',
      ref: letter.item_id,
      x: 0.86,
      y: 0.72,
      scale: 0.08,
      rotation: 0,
      facing: 0,
      layer: 9,
    },
  ];
  await request(
    '/house/' + homeId,
    {
      revision: state.revision,
      name: state.name,
      rooms: state.rooms,
    },
    'PUT',
  );
  const actor = page.locator('.house-actor');
  async function place(scale: number, y = 0.84, variant: string | null = null) {
    await request(
      '/house/' + homeId + '/presence',
      {
        character_id: hero.id,
        variant_id: variant,
        room: 'sala',
        x: 0.5,
        y,
        scale,
        layer: 602,
      },
      'PUT',
    );
    await page.goto(origin + '/#house');
    await page.reload();
    await expect(actor).toHaveCount(1);
    await expect
      .poll(() =>
        actor
          .locator('img')
          .evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0),
      )
      .toBe(true);
    await actor.scrollIntoViewIfNeeded();
  }
  async function checkDrag(fx: number, fy: number, dx: number, dy: number) {
    const before = (await actor.boundingBox())!;
    const cursor = { x: before.x + before.width * fx, y: before.y + before.height * fy };
    await page.mouse.move(cursor.x, cursor.y);
    await page.mouse.down();
    const down = (await actor.boundingBox())!;
    expect(Math.abs(down.x - before.x), 'pointerdown must keep horizontal anchor').toBeLessThan(1);
    expect(Math.abs(down.y - before.y), 'pointerdown must keep vertical anchor').toBeLessThan(1);
    for (let step = 1; step <= 4; step++) {
      const target = { x: cursor.x + (dx * step) / 4, y: cursor.y + (dy * step) / 4 };
      await page.mouse.move(target.x, target.y);
      const held = (await actor.boundingBox())!;
      expect(Math.abs(held.x + held.width * fx - target.x), 'held grab x').toBeLessThan(2);
      expect(Math.abs(held.y + held.height * fy - target.y), 'held grab y').toBeLessThan(2);
    }
    await page.mouse.up();
    await expect(page.getByLabel('Camada do personagem')).toBeEnabled();
    const dropped = (await actor.boundingBox())!;
    expect(Math.abs(dropped.x + dropped.width * fx - cursor.x - dx), 'drop x').toBeLessThan(2);
    expect(Math.abs(dropped.y + dropped.height * fy - cursor.y - dy), 'drop y').toBeLessThan(2);
  }
  await place(0.19);
  await checkDrag(0.3, 0.5, 75, -40);
  await place(0.19);
  await checkDrag(0.65, 0.2, -30, 30);
  await place(0.3, 0.76);
  await checkDrag(0.7, 0.15, 20, 20);
  await place(0.19);
  const scrollGrab = (await actor.boundingBox())!;
  const scrollCursor = {
    x: scrollGrab.x + scrollGrab.width * 0.4,
    y: scrollGrab.y + scrollGrab.height * 0.5,
  };
  await page.mouse.move(scrollCursor.x, scrollCursor.y);
  await page.mouse.down();
  await page.evaluate(() => scrollBy(0, 35));
  await page.mouse.move(scrollCursor.x + 1, scrollCursor.y + 1);
  const afterScroll = (await actor.boundingBox())!;
  expect(Math.abs(afterScroll.x + afterScroll.width * 0.4 - scrollCursor.x - 1)).toBeLessThan(2);
  expect(Math.abs(afterScroll.y + afterScroll.height * 0.5 - scrollCursor.y - 1)).toBeLessThan(2);
  await page.mouse.up();
  await expect(page.getByLabel('Camada do personagem')).toBeEnabled();
  await page.getByRole('button', { name: 'Decorar', exact: true }).click();
  await expect(page.getByLabel('Perspectiva dos itens', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Afinamento padrão dos itens')).toHaveCount(0);
  const table = page.locator('.house-piece').first();
  const tableArt = table.locator('.house-item-art');
  await expect(page.locator('.house-item-projection')).toHaveCount(0);
  expect(await tableArt.evaluate((el) => getComputedStyle(el).transform)).toBe('none');
  await page.getByRole('button', { name: 'Atrás da mobília', exact: true }).click();
  await expect(actor).toHaveAttribute('data-layer', '0');
  await table.click();
  await expect(page.getByLabel('Afinamento ao fundo')).toHaveCount(0);
  await expect(page.getByLabel('Recuo lateral da peça')).toHaveCount(0);
  const viewPaths = new Set<string>();
  for (let facing = 0; facing < 8; facing++) {
    await page.getByLabel('Direção da peça', { exact: true }).selectOption(String(facing));
    viewPaths.add((await tableArt.locator('img').getAttribute('src'))!);
    expect(await tableArt.evaluate((el) => getComputedStyle(el).transform)).toBe('none');
  }
  expect(viewPaths.size).toBe(8);
  await page.getByRole('button', { name: 'Salvar mudanças', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Salvo', exact: true })).toBeDisabled();
  await page.reload();
  expect(await tableArt.evaluate((el) => getComputedStyle(el).transform)).toBe('none');
  const afterRollbackSave = await context.request
    .get(origin + '/api/house/' + homeId)
    .then((r) => r.json());
  expect(afterRollbackSave.rooms[0].placements[0]).toMatchObject({
    facing: 7,
    perspective_pitch: 20,
    perspective_yaw: -20,
  });
  await mkdir('test-results', { recursive: true });
  await page
    .locator('.house-scene')
    .screenshot({ path: 'test-results/house-perspective-restored.png' });
  const variant = await request('/house/variants', {
    character_id: hero.id,
    name: 'Pose ampla',
    image: (
      await sharp({
        create: {
          width: 900,
          height: 400,
          channels: 4,
          background: { r: 130, g: 100, b: 65, alpha: 1 },
        },
      })
        .png()
        .toBuffer()
    ).toString('base64'),
  });
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await place(0.35, 0.8, variant.id || variant.variant?.id);
    await checkDrag(0.2, 0.2, width < 400 ? 10 : 35, -12);
    await expect(page.locator('.house-panel')).toHaveCount(0);
    await page.getByRole('button', { name: 'Personagem', exact: true }).click();
    await page
      .getByLabel('Camada do personagem')
      .selectOption({
        label: `Atrás de ${houseCatalog.find((item) => item.id === 'table')!.name}`,
      });
    await expect(actor).toHaveAttribute('data-layer', '17');
    expect(await actor.evaluate((el) => Number(getComputedStyle(el).zIndex))).toBeLessThan(
      await page
        .locator('.house-piece')
        .first()
        .evaluate((el) => Number(getComputedStyle(el).zIndex)),
    );
    const persisted = await context.request
      .get(origin + '/api/house/' + homeId)
      .then((r) => r.json());
    expect(persisted.presence[0].layer).toBe(17);
    await page.getByRole('button', { name: 'Atrás da mobília', exact: true }).click();
    await expect(actor).toHaveAttribute('data-layer', '0');
    await page.getByRole('button', { name: 'À frente da mobília', exact: true }).click();
    await expect(actor).toHaveAttribute('data-layer', '602');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await mkdir('test-results', { recursive: true });
    await page.screenshot({ path: `test-results/house-cursor-${width}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await place(0.19);
  const letterPiece = page.getByRole('button', { name: 'Dois cliques · mover', exact: true });
  await letterPiece.click();
  await expect(page.getByRole('dialog', { name: 'Dois cliques', exact: true })).toHaveCount(0);
  await letterPiece.dblclick();
  const reader = page.getByRole('dialog', { name: 'Dois cliques', exact: true });
  await expect(reader).toContainText('Uma carta guardada junto à lareira.');
  await reader.screenshot({ path: 'test-results/house-letter-reader.png' });
  expect(errors).toEqual([]);
  console.log(
    'House cursor: pointerdown, held drag, release, tall/wide poses, visible persisted layers, undeformed eight views with preserved legacy fields in four widths passed.',
  );
} finally {
  await browser.close();
  await new Promise<void>((r) => server.close(() => r()));
  await pool.end();
}
