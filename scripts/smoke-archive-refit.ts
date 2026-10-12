import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID, createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { houseItemImage, houseFacingOptions, houseTurnFacing } from '../shared/house';
import { houseViewWidth } from '../shared/house-perspective';
import { houseViewRepair } from '../shared/house-view-repairs';
if (!/^\/alvorada_test_[0-9a-f]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))
  throw Error('Disposable UUID database required');
const origin = 'http://localhost:3053';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db');
const { migrate } = await import('../server/migrate');
const { seed } = await import('../server/seed');
await migrate();
await seed();
const { createLegacyTestCharacter } = await import('../tests/character-fixtures');
const { createApp } = await import('../server/app');
const server = createApp().listen(3053, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: 'reduce',
});
const page = await context.newPage();
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
await context.addInitScript(() => {
  localStorage.setItem('alvorada-music-muted', 'true');
  localStorage.setItem('alvorada-effects-muted', 'true');
});
async function req(path: string, data?: unknown, method = data ? 'POST' : 'GET') {
  const r = await context.request.fetch(origin + '/api' + path, {
    method,
    headers: { Origin: origin },
    data,
  });
  expect(r.ok(), await r.text()).toBe(true);
  return r.json();
}
async function bounds() {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
}
try {
  const u = (
    await req('/auth/sign-up/email', {
      name: 'Arquivo',
      email: randomUUID() + '@example.test',
      password: 'Test-' + randomUUID(),
    })
  ).user;
  await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [u.id]);
  const hero = await createLegacyTestCharacter(u.id, 'Helena');
  await pool.query('UPDATE characters SET gold_cp=1000000 WHERE id=$1', [hero.id]);
  await mkdir('test-results/archive-refit', { recursive: true });
  await page.goto(origin + '/#cards');
  await expect(page.locator('.cards-catalog>button')).toHaveCount(8);
  await page.getByRole('button', { name: 'Conversar com o Anfitrião', exact: true }).click();
  await page.getByRole('button', { name: 'Quem é você?', exact: true }).click();
  await expect(page.locator('.cards-host-dialogue')).toContainText('Chamam-me de Anfitrião');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Comprar carta', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Equipar no espaço 1', exact: true }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Equipar no espaço 1', exact: true }).click();
  await expect(page.locator('.cards-equipped')).toContainText('A Vigília');
  await page.getByRole('button', { name: 'Minha coleção', exact: true }).click();
  await expect(page.locator('.cards-catalog>button')).toHaveCount(1);
  await page.getByRole('button', { name: 'À venda', exact: true }).click();
  await expect(page.locator('.cards-catalog>button')).toHaveCount(4);
  await page.getByRole('button', { name: 'Todas', exact: true }).click();
  await page.locator('.cards-catalog>button').filter({ hasText: 'O Corvo' }).click();
  await page.getByRole('button', { name: 'Comprar carta', exact: true }).click();
  await page.keyboard.press('Escape');
  const owned = await req('/cards/' + hero.id);
  expect(owned).toHaveLength(2);
  await page.goto(origin + '/#character-cards');
  await expect(page.locator('.card-folio-choice')).toHaveCount(2);
  await page.getByLabel('Buscar na coleção').fill('corvo');
  await expect(page.locator('.card-folio-choice')).toHaveCount(1);
  await page.getByRole('button', { name: 'Ver O Corvo', exact: true }).click();
  await expect(page.locator('.card-folio-record')).toContainText('Uma mensagem sem remetente');
  await page.getByLabel('Buscar na coleção').fill('');
  await page.getByRole('button', { name: 'Equipar no espaço 2', exact: true }).click();
  await expect(page.locator('.character-card-slot[data-slot="2"]')).toContainText('O Corvo');
  await page.reload();
  await expect(page.locator('.character-card-slot[data-slot="2"]')).toContainText('O Corvo');
  await page.getByRole('button', { name: 'Retirar O Corvo do espaço 2', exact: true }).click();
  await expect(page.locator('.character-card-slot[data-slot="2"]')).toHaveAttribute(
    'data-empty',
    'true',
  );
  for (const width of [1898, 1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of ['character-cards', 'cards', 'lore', 'profile']) {
      await page.goto(origin + '/#' + route);
      await expect(page.locator('.app-shell')).toHaveAttribute('data-page', route);
      await page.evaluate(() => document.fonts.ready);
      if (route === 'character-cards')
        await expect(page.locator('.card-folio-choice')).toHaveCount(2);
      if (route === 'cards') await expect(page.locator('.cards-catalog>button')).toHaveCount(8);
      if (route === 'lore') {
        await expect(page.locator('.lore-era').last()).toBeVisible();
        const top = await page
          .locator('.lore-timeline')
          .evaluate((e) => e.getBoundingClientRect().top);
        expect(top).toBeLessThan(300);
      }
      await bounds();
      await page.screenshot({
        path: `test-results/archive-refit/${route}-${width}.png`,
        fullPage: route !== 'profile',
      });
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  const homeId = (await req('/house', { character_id: hero.id })).id;
  const home = await req('/house/' + homeId);
  const names: Record<string, string> = {
    statue: 'Estante de Livros',
    'round-stool': 'Banqueta da Cozinha',
    'ale-barrel': 'Barril da Adega',
    'open-codex': 'Códice Aberto',
  };
  for (const [i, id] of Object.keys(names).entries()) {
    const p = await req('/house/purchase', {
      character_id: hero.id,
      catalog_id: id,
      idempotency_key: randomUUID(),
    });
    home.rooms[0].placements.push({
      id: randomUUID(),
      kind: 'item',
      ref: p.item_id,
      x: [0.25, 0.48, 0.67, 0.86][i],
      y: 0.84,
      scale: [0.19, 0.1, 0.15, 0.13][i],
      rotation: 0,
      facing: 1,
      layer: i,
    });
  }
  await req(
    '/house/' + homeId,
    { name: home.name, revision: home.revision, rooms: home.rooms },
    'PUT',
  );
  await page.goto(origin + '/#house');
  await expect(page.locator('.house-piece')).toHaveCount(4);
  await page.getByRole('button', { name: 'Decorar', exact: true }).click();
  for (const [i, id] of Object.keys(names).entries()) {
    const piece = page.locator('.house-piece').nth(i);
    await piece.click();
    for (const { value } of houseFacingOptions(id)) {
      await page.getByLabel('Direção da peça', { exact: true }).selectOption(String(value));
      await expect(piece).toHaveAttribute('data-facing', String(value));
      await expect(piece.locator('img').last()).toHaveAttribute('src', houseItemImage(id, value));
      await expect
        .poll(() =>
          piece
            .locator('img')
            .last()
            .evaluate((img: HTMLImageElement) => img.naturalWidth),
        )
        .toBeGreaterThan(0);
      const repair = houseViewRepair(id, value);
      if (repair) {
        expect(houseViewWidth(id, value)).toBe(repair.width);
        const r = await context.request.get(origin + repair.image);
        expect(r.ok()).toBe(true);
        expect(
          createHash('sha256')
            .update(await r.body())
            .digest('hex'),
        ).toBe(
          createHash('sha256')
            .update(await readFile('public' + repair.image))
            .digest('hex'),
        );
      }
    }
    let turn = 1;
    for (let j = 0; j < houseFacingOptions(id).length; j++) turn = houseTurnFacing(id, turn, 1);
    expect(turn).toBe(1);
    await page.getByLabel('Direção da peça', { exact: true }).selectOption('1');
  }
  await page.getByRole('button', { name: 'Salvar mudanças', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Salvo', exact: true })).toBeDisabled();
  await page.reload();
  await expect(page.locator('.house-piece')).toHaveCount(4);
  await page.screenshot({ path: 'test-results/archive-refit/house-four-objects.png' });
  expect(errors).toEqual([]);
  await writeFile(
    'test-results/archive-refit/result.json',
    JSON.stringify({
      passed: true,
      viewports: 5,
      uiPages: 4,
      houseViews: 36,
      cardPurchaseEquipReload: true,
    }),
  );
  console.log(
    'PASS Archive refit: purchases, collection/search, equip/remove/reload, dialogue, 20 responsive page layouts, 36 house views and media hashes.',
  );
} finally {
  await browser.close();
  await new Promise<void>((r) => server.close(() => r()));
  await pool.end();
}
