import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
if (!new URL(process.env.DATABASE_URL!).pathname.startsWith('/alvorada_test_'))
  throw Error('Banco isolado obrigatório.');
const origin = 'http://localhost:3008';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db.js'),
  { migrate } = await import('../server/migrate.js'),
  { seed } = await import('../server/seed.js'),
  { createLegacyTestCharacter } = await import('../tests/character-fixtures.js');
await migrate();
await seed();
const { createApp } = await import('../server/app.js'),
  server = createApp().listen(3008, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));
const browser = await chromium.launch({ channel: 'msedge', headless: true }),
  ctx = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
  }),
  guest = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    reducedMotion: 'reduce',
  }),
  page = await ctx.newPage(),
  visit = await guest.newPage();
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
visit.on('pageerror', (e) => errors.push(e.message));
await mkdir('test-results', { recursive: true });
async function signup(context: typeof ctx, name: string) {
  const r = await context.request.post(origin + '/api/auth/sign-up/email', {
    headers: { Origin: origin },
    data: {
      name,
      email: `house-ui-${randomUUID()}@example.test`,
      password: `Test-${randomUUID()}`,
    },
  });
  expect(r.ok()).toBe(true);
  return (await r.json()).user.id;
}
async function req(context: typeof ctx, path: string, data: unknown, method = 'POST') {
  const r = await context.request.fetch(origin + '/api' + path, {
    method,
    headers: { Origin: origin },
    data,
  });
  expect(r.ok()).toBe(true);
  return await r.json();
}
try {
  const owner = await signup(ctx, 'Dona da casa'),
    guestId = await signup(guest, 'Viajante convidado'),
    hero = await createLegacyTestCharacter(owner, 'Aurora'),
    visitor = await createLegacyTestCharacter(guestId, 'Bruma');
  await pool.query('UPDATE characters SET gold_cp=500000 WHERE id=ANY($1::uuid[])', [
    [hero.id, visitor.id],
  ]);
  await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [owner]);
  const portrait = await readFile('public/character-silhouette-v2.png');
  for (const id of [hero.id, visitor.id])
    await pool.query('INSERT INTO character_portraits(character_id,image)VALUES($1,$2)', [
      id,
      portrait,
    ]);
  await pool.query('UPDATE characters SET portrait_revision=1 WHERE id=ANY($1::uuid[])', [
    [hero.id, visitor.id],
  ]);
  await page.goto(origin + '/#house');
  await page.getByRole('button', { name: 'Criar minha casa' }).click();
  await expect(page.locator('.house-scene')).toBeVisible();
  const home = (await ctx.request.get(origin + '/api/house').then((r) => r.json())).homes[0];
  await page.getByRole('button', { name: 'Mobília', exact: true }).click();
  await page.getByRole('button', { name: /Tapete da Vigília/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Tapete da Vigília' });
  await dialog.getByRole('button', { name: 'Comprar por 25 PO' }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole('button', { name: 'Decorar', exact: true }).click();
  await page
    .locator('.house-inventory-item')
    .filter({ hasText: 'Tapete da Vigília' })
    .getByRole('button', { name: /Colocar/ })
    .click();
  await expect(page.locator('.house-piece')).toHaveCount(1);
  const piece = page.locator('.house-piece').first(),
    box = await piece.boundingBox();
  expect(box).toBeTruthy();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width / 2 + 100, box!.y + box!.height / 2 + 20, { steps: 8 });
  await page.mouse.up();
  await page.getByLabel('Giro da peça').fill('12');
  await page.getByLabel('Tamanho da peça').fill('28');
  await page.getByRole('button', { name: 'Salvar mudanças' }).click();
  await expect(page.getByRole('button', { name: 'Salvo', exact: true })).toBeDisabled();
  await page.reload();
  await expect(page.locator('.house-piece')).toHaveCount(1);
  await expect(page.locator('.house-piece')).toHaveCSS('width', /\d+px/);
  const mount = await req(ctx, '/stable/purchase', {
    character_id: hero.id,
    mount_id: 'riding-horse',
    coat: 'original',
    name: 'Brasa',
    equipment: [],
    idempotency_key: randomUUID(),
  });
  const pet = await req(ctx, '/pets/purchase', {
    character_id: hero.id,
    pet_id: 'dog',
    appearance: 'original',
    name: 'Farol',
    idempotency_key: randomUUID(),
  });
  for (const catalog_id of ['sofa', 'plant', 'books', 'frame'])
    await req(ctx, '/house/purchase', {
      character_id: hero.id,
      catalog_id,
      idempotency_key: randomUUID(),
    });
  await page.reload();
  await page.getByRole('button', { name: 'Decorar', exact: true }).click();
  for (const name of [
    'Sofá de Carvalho',
    'Vaso de Alecrim',
    'Livros do Caminho',
    'Quadro de Memórias',
  ])
    await page
      .locator('.house-inventory-item')
      .filter({ hasText: name })
      .getByRole('button', { name: /Colocar/ })
      .click();
  await page.getByRole('button', { name: /Brasa.*Colocar companheiro/ }).click();
  await page.getByRole('button', { name: /Farol.*Colocar companheiro/ }).click();
  const draft = await ctx.request.get(origin + `/api/house/${home.id}`).then((r) => r.json());
  const ownItems = draft.inventory;
  draft.rooms[0].placements = [
    {
      id: randomUUID(),
      kind: 'item',
      ref: ownItems.find((i: any) => i.catalog_id === 'rug').id,
      x: 0.48,
      y: 0.89,
      scale: 0.28,
      rotation: 0,
      layer: 0,
    },
    {
      id: randomUUID(),
      kind: 'item',
      ref: ownItems.find((i: any) => i.catalog_id === 'sofa').id,
      x: 0.77,
      y: 0.79,
      scale: 0.27,
      rotation: 0,
      layer: 2,
    },
    {
      id: randomUUID(),
      kind: 'item',
      ref: ownItems.find((i: any) => i.catalog_id === 'plant').id,
      x: 0.88,
      y: 0.78,
      scale: 0.085,
      rotation: 0,
      layer: 3,
    },
    {
      id: randomUUID(),
      kind: 'item',
      ref: ownItems.find((i: any) => i.catalog_id === 'books').id,
      x: 0.24,
      y: 0.78,
      scale: 0.1,
      rotation: 0,
      layer: 4,
    },
    {
      id: randomUUID(),
      kind: 'item',
      ref: ownItems.find((i: any) => i.catalog_id === 'frame').id,
      x: 0.77,
      y: 0.42,
      scale: 0.07,
      rotation: 0,
      layer: 1,
    },
    {
      id: randomUUID(),
      kind: 'mount',
      ref: mount.mount.id,
      x: 0.17,
      y: 0.93,
      scale: 0.21,
      rotation: 0,
      layer: 5,
    },
    {
      id: randomUUID(),
      kind: 'pet',
      ref: pet.id || pet.pet.id,
      x: 0.78,
      y: 0.91,
      scale: 0.07,
      rotation: 0,
      layer: 6,
    },
  ];
  await req(
    ctx,
    `/house/${home.id}`,
    { revision: draft.revision, name: draft.name, rooms: draft.rooms },
    'PUT',
  );
  await page.reload();
  await expect(page.locator('.house-piece')).toHaveCount(7);
  await page.getByRole('button', { name: 'Personagem', exact: true }).click();
  await page.getByRole('button', { name: 'Entrar na cena', exact: true }).click();
  await expect(page.locator('.house-actor')).toHaveCount(1);
  await page.getByRole('button', { name: 'Fechar painel' }).click();
  await page.getByRole('button', { name: 'Convidados', exact: true }).click();
  await page.getByLabel('Buscar jogador').fill('Viajante convidado');
  await page.getByRole('button', { name: 'Convidar Viajante convidado' }).click();
  await expect(page.locator('.house-guest-list')).toContainText('Pendente');
  await visit.goto(origin + '/#house');
  await visit.getByRole('button', { name: 'Aceitar', exact: true }).click();
  await expect(visit.locator('.house-scene')).toBeVisible();
  await expect(visit.getByRole('button', { name: 'Decorar', exact: true })).toHaveCount(0);
  await visit.getByRole('button', { name: 'Personagem', exact: true }).click();
  await visit.getByRole('button', { name: 'Entrar na cena', exact: true }).click();
  await expect(visit.locator('.house-actor')).toHaveCount(2);
  await visit.getByRole('button', { name: 'RP', exact: true }).click();
  await visit.getByLabel('Mensagem de Bruma').fill('Bruma senta perto da lareira e abre o mapa.');
  await visit.getByRole('button', { name: 'Enviar', exact: true }).click();
  await expect(visit.getByRole('log')).toContainText('Bruma senta perto da lareira');
  await page.reload();
  await page.getByRole('button', { name: 'RP', exact: true }).click();
  await expect(page.getByRole('log')).toContainText('Bruma senta perto da lareira');
  await page.getByRole('button', { name: 'Fechar painel' }).click();
  await expect
    .poll(() =>
      page
        .locator('.house-piece img,.house-actor img')
        .evaluateAll((imgs) =>
          imgs.every(
            (i) => (i as HTMLImageElement).complete && (i as HTMLImageElement).naturalWidth > 0,
          ),
        ),
    )
    .toBe(true);
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: 'test-results/house-desktop.png', fullPage: true });
  for (const width of [768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.getByRole('button', { name: 'Decorar', exact: true }).click();
    await expect(page.locator('.house-scene')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `test-results/house-${width}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Fechar painel' }).click();
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'Convidados', exact: true }).click();
  await page.getByRole('button', { name: 'Revogar', exact: true }).click();
  await expect(page.locator('.house-guest-list')).toContainText('Revogado');
  const denied = await guest.request.get(origin + `/api/house/${home.id}`);
  expect(denied.status()).toBe(404);
  expect(errors).toEqual([]);
  console.log(
    'House browser: compra, arraste, giro/tamanho, persistência, companheiros, convite/visita/RP e 4 larguras aprovados.',
  );
} finally {
  await browser.close();
  await new Promise<void>((r) => server.close(() => r()));
  await pool.end();
}
