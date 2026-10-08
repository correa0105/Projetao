import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { houseFloorScale } from '../shared/house-perspective';
import { houseDefaultFacing } from '../shared/house';
if (!/^\/alvorada_test_[0-9a-f]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))
  throw Error('Disposable database required');
const origin = 'http://localhost:3053';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db'),
  { migrate } = await import('../server/migrate'),
  { seed } = await import('../server/seed');
await migrate();
await seed();
const { createApp } = await import('../server/app'),
  { createLegacyTestCharacter } = await import('../tests/character-fixtures');
const server = createApp().listen(3053, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));
const browser = await chromium.launch({ channel: 'msedge', headless: true }),
  context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
  }),
  page = await context.newPage();
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
await context.addInitScript(() => {
  localStorage.setItem('alvorada-music-muted', 'true');
  localStorage.setItem('alvorada-effects-muted', 'true');
});
async function api(path: string, data?: unknown, method = data ? 'POST' : 'GET') {
  const r = await context.request.fetch(origin + '/api' + path, {
    method,
    headers: { Origin: origin },
    data,
  });
  expect(r.ok(), method + ' ' + path).toBe(true);
  return r.json();
}
try {
  const account = await api('/auth/sign-up/email', {
    name: 'Sobre o balcão',
    email: randomUUID() + '@example.test',
    password: 'Test-' + randomUUID(),
  });
  const hero = await createLegacyTestCharacter(account.user.id, 'Balcão');
  await pool.query('UPDATE characters SET gold_cp=1000000 WHERE id=$1', [hero.id]);
  const home = await api('/house', { character_id: hero.id }),
    homeId = home.id || home.home?.id;
  const pieces = [];
  for (const [index, id] of ['oak-sideboard', 'lantern', 'scroll-bundle'].entries()) {
    const purchase = await api('/house/purchase', {
      character_id: hero.id,
      catalog_id: id,
      idempotency_key: randomUUID(),
    });
    pieces.push({
      id: randomUUID(),
      kind: 'item',
      ref: purchase.item_id,
      x: index === 0 ? 0.23 : 0.65 + index * 0.08,
      y: index === 0 ? 0.72 : 0.84,
      scale: index === 0 ? 0.34 : 0.12,
      rotation: 0,
      facing: houseDefaultFacing(id),
      layer: index,
      depth_layer: 3,
    });
  }
  await mkdir('test-results/house-surface', { recursive: true });
  for (const width of [1440, 768, 390, 320]) {
    const state = await api('/house/' + homeId);
    state.rooms[0].placements = structuredClone(pieces);
    await api(
      '/house/' + homeId,
      { name: state.name, revision: state.revision, rooms: state.rooms },
      'PUT',
    );
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(origin + '/#house');
    await page.reload();
    await expect(page.locator('.house-scene')).toBeVisible();
    await page.getByRole('button', { name: 'Decorar', exact: true }).click();
    const scene = page.locator('.house-scene'),
      counter = page.locator(`[data-house-piece="${pieces[0].id}"]`);
    await expect
      .poll(() =>
        page
          .locator('.house-piece img')
          .evaluateAll((imgs) =>
            imgs.every(
              (img) =>
                (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0,
            ),
          ),
      )
      .toBe(true);
    for (const [index, piece] of pieces.slice(1).entries()) {
      const item = page.locator(`[data-house-piece="${piece.id}"]`),
        bounds = (await scene.boundingBox())!,
        table = (await counter.boundingBox())!,
        box = (await item.boundingBox())!;
      const start = { x: box.x + box.width * 0.5, y: box.y + box.height * 0.65 },
        factor = houseFloorScale(piece.y, 'hall-hearth');
      const grab = {
        x: (start.x - bounds.x - piece.x * bounds.width) / factor,
        y: (start.y - bounds.y - piece.y * bounds.height) / factor,
      };
      const target = {
        x: (table.x + table.width * (index === 0 ? 0.35 : 0.7) - bounds.x) / bounds.width,
        y: (table.y + table.height * 0.17 - bounds.y) / bounds.height,
      };
      expect(target.y).toBeLessThan(0.5);
      const cursor = {
        x: bounds.x + target.x * bounds.width + grab.x * 0.3,
        y: bounds.y + target.y * bounds.height + grab.y * 0.3,
      };
      await page.mouse.move(start.x, start.y);
      await page.mouse.down();
      await page.mouse.move(cursor.x, cursor.y, { steps: 18 });
      await page.mouse.up();
      await expect
        .poll(
          async () =>
            Math.abs(
              (await item.evaluate(
                (el) => Number((el as HTMLElement).style.top.replace('%', '')) / 100,
              )) - target.y,
            ) * bounds.height,
        )
        .toBeLessThan(2);
      await expect(item).toHaveAttribute('data-depth-scale', '0.3');
      await expect(item).toHaveAttribute('data-base-scale', String(piece.scale));
      const moved = (await item.boundingBox())!;
      expect(Math.abs(moved.x + moved.width * 0.5 - cursor.x)).toBeLessThan(2);
      expect(Math.abs(moved.y + moved.height * 0.65 - cursor.y)).toBeLessThan(2);
    }
    await page.getByRole('button', { name: 'Salvar mudanças', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Salvo', exact: true })).toBeDisabled();
    const saved = await api('/house/' + homeId);
    for (const p of saved.rooms[0].placements.slice(1)) {
      expect(p.y).toBeLessThan(0.5);
      expect(p.scale).toBe(0.12);
      expect(p.depth_layer).toBe(3);
    }
    await page.reload();
    await expect(scene).toBeVisible();
    for (const p of saved.rooms[0].placements.slice(1))
      await expect(page.locator(`[data-house-piece="${p.id}"]`)).toHaveAttribute(
        'data-depth-scale',
        '0.3',
      );
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await scene.screenshot({ path: `test-results/house-surface/counter-${width}.png` });
  }
  expect(errors).toEqual([]);
  console.log(
    'PASS House tabletop: old candelabrum and new scrolls cross the floor boundary onto a real sideboard, cursor stays within 2px, depth saturates, base size/layers/save/reload preserved at four widths.',
  );
} finally {
  await browser.close();
  await new Promise<void>((r, j) => server.close((e) => (e ? j(e) : r())));
  await pool.end();
}
