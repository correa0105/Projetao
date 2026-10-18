import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import catalog from '../shared/vtt-medieval-furniture-catalog.json';
import { house2Furniture } from '../shared/house-v2';
import { natureAssets } from '../shared/vtt-nature-assets';
import { createNatureToken } from '../shared/vtt-nature-placement';
import { vttProtocolVersion } from '../shared/vtt-protocol';
if (!/^\/alvorada_test_[0-9a-f]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))
  throw Error('Banco UUID descartável obrigatório');
const origin = 'http://localhost:3084';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db'),
  { migrate } = await import('../server/migrate'),
  { seed } = await import('../server/seed'),
  { createLegacyTestCharacter } = await import('../tests/character-fixtures');
await migrate();
await seed();
const { createApp } = await import('../server/app');
process.env.NODE_ENV = 'production';
const server = createApp().listen(3084, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));
const browser = await chromium.launch({ channel: 'msedge', headless: true }),
  ctx = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
    extraHTTPHeaders: { 'Accept-Encoding': 'identity' },
  }),
  page = await ctx.newPage(),
  errors: string[] = [],
  missing: string[] = [];
await ctx.addInitScript(() => {
  localStorage.setItem('alvorada-music-muted', 'true');
  localStorage.setItem('alvorada-effects-muted', 'true');
});
page.on('pageerror', (e) => errors.push(e.message));
page.on('response', (r) => {
  if (r.status() >= 400 && r.url().includes('/furniture-100-')) missing.push(r.url());
});
const headers = { Origin: origin, 'X-Vtt-Schema-Version': String(vttProtocolVersion) };
async function req(p: string, data?: unknown, method = data ? 'POST' : 'GET') {
  const r = await ctx.request.fetch(origin + '/api' + p, { method, headers, data });
  expect(r.ok(), await r.text()).toBe(true);
  return r.json();
}
const additions = catalog.filter(
  (p) => /^furniture-\d+$/.test(p.id) && Number(p.id.split('-')[1]) >= 151,
);
await mkdir('test-results/furniture-100', { recursive: true });
try {
  expect(additions).toHaveLength(100);
  expect(house2Furniture).toHaveLength(352);
  for (const p of additions) {
    const h = house2Furniture.find((h) => h.id === p.id)!,
      v = natureAssets.find((v) => v.id === p.id)!;
    expect([h.image, h.width, h.height]).toEqual([v.image, v.width, v.height]);
  }
  const { user } = await req('/auth/sign-up/email', {
      name: 'Artesão',
      email: randomUUID() + '@example.test',
      password: 'Test-' + randomUUID(),
    }),
    hero = await createLegacyTestCharacter(user.id, 'Aurora');
  await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [user.id]);
  const d = await req('/house-v2'),
    n = d.neighborhoods[0].id,
    scene = await req('/house-v2/neighborhoods/' + n),
    lot = scene.plots[0];
  await req(`/house-v2/plots/${lot.id}/purchase`, {
    character_id: hero.id,
    idempotency_key: randomUUID(),
  });
  const purchase = await req('/house-v2/furniture', {
    character_id: hero.id,
    plot_id: lot.id,
    catalog_id: additions[0].id,
    idempotency_key: randomUUID(),
  });
  const updatedLot = (await req('/house-v2/neighborhoods/' + n)).plots.find(
    (p: any) => p.id === lot.id,
  );
  await req(
    `/house-v2/plots/${lot.id}/layout`,
    {
      revision: updatedLot.revision,
      house: null,
      items: [{ id: purchase.item_id, x: lot.x + 8, y: lot.y + 8, rotation: 45, scale: 1 }],
    },
    'PUT',
  );
  await page.goto(origin + '/#house2');
  await page.locator('.h2-neighborhood-card').first().click();
  await page.locator(`[data-house2-plot="${lot.id}"] rect.h2-plot`).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'House 2.0', exact: true }).click();
  await page
    .getByRole('navigation', { name: 'Controles da vizinhança' })
    .getByRole('button', { name: 'Mobília', exact: true })
    .click();
  await expect(page.locator('.h2-catalog:not(.h2-finishes-catalog) button')).toHaveCount(352);
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.getByLabel('Pesquisar mobília', { exact: true }).fill('curul');
    await expect(page.locator('.h2-catalog:not(.h2-finishes-catalog) button')).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await page.screenshot({ path: `test-results/furniture-100/house2-${width}.png` });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(origin + '/#vtt');
  await page.getByLabel('Nome da mesa', { exact: true }).fill('Mobília nova');
  await page.getByRole('button', { name: 'Criar mesa', exact: true }).click();
  const board = page.getByLabel('Tabuleiro da mesa', { exact: true });
  await expect(board).toBeVisible();
  const {
      rows: [room],
    } = await pool.query('SELECT id FROM vtt_rooms WHERE owner_id=$1', [user.id]),
    root = '/vtt/rooms/' + room.id;
  await page.getByRole('button', { name: 'Biblioteca', exact: true }).click();
  await page.getByRole('button', { name: 'Assets', exact: true }).click();
  await page
    .locator('.vtt-asset-collections button')
    .filter({ hasText: 'Mobílias' })
    .filter({ hasNotText: 'externas' })
    .click();
  await expect(page.locator('.vtt-nature-card')).toHaveCount(250);
  for (const name of ['Cadeira curul dobrável', 'Cama redonda', 'Jardim zen de mesa']) {
    await page.getByLabel('Buscar na biblioteca', { exact: true }).fill(name);
    await expect(page.locator('.vtt-nature-card')).toHaveCount(1);
    await page.locator('.vtt-nature-card').click();
    await expect
      .poll(() =>
        page
          .locator('.vtt-nature-detail>img')
          .evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0),
      )
      .toBe(true);
    await page.getByRole('button', { name: 'Colocar no mapa', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Salvar mesa', exact: true }).click();
  await expect
    .poll(async () => {
      const r = await req(root);
      return r.document.scenes[0].tokens.filter((t: any) =>
        additions.some((p) => p.image === t.image),
      ).length;
    })
    .toBe(3);
  const r = await req(root),
    s = r.document.scenes[0];
  const tokens = additions.map((a, i) =>
    createNatureToken(
      randomUUID(),
      a.id,
      s,
      { x: 180 + (i % 10) * 220, y: 180 + Math.floor(i / 10) * 220 },
      1,
    ),
  );
  s.tokens = tokens;
  s.lighting = false;
  await req(root, { revision: r.revision, document: r.document }, 'PUT');
  expect((await req(root)).document.scenes[0].tokens).toHaveLength(100);
  await page.reload();
  await expect(board).toBeVisible();
  await page.getByRole('button', { name: 'Biblioteca', exact: true }).click();
  await page.getByRole('button', { name: 'Assets', exact: true }).click();
  await page
    .locator('.vtt-asset-collections button')
    .filter({ hasText: 'Mobílias' })
    .filter({ hasNotText: 'externas' })
    .click();
  await page.getByLabel('Buscar na biblioteca', { exact: true }).fill('curul');
  await page.locator('.vtt-nature-card').click();
  await page.screenshot({ path: 'test-results/furniture-100/vtt.png' });
  expect(errors).toEqual([]);
  expect(missing).toEqual([]);
  await writeFile(
    'test-results/furniture-100/browser.json',
    JSON.stringify(
      {
        passed: true,
        newAssets: 100,
        house2Catalog: 352,
        vttFurniture: 250,
        sameIdentities: true,
        housePurchaseAndPlacement: true,
        vttPlaceFromLibrary: true,
        all100Persisted: true,
        responsive: [1440, 768, 390],
        missing,
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    'PASS 100 móveis em ambos catálogos, compra, posição, biblioteca e persistência no VTT.',
  );
} catch (e) {
  await page.screenshot({ path: 'test-results/furniture-100/failure.png', fullPage: true });
  throw e;
} finally {
  await ctx.close();
  await browser.close();
  await new Promise<void>((r) => server.close(() => r()));
  await pool.end();
}
