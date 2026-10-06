import 'dotenv/config';
import { chromium, expect, type BrowserContext, type Locator } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';

if (!/^\/alvorada_test_[a-f0-9]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))
  throw Error('Banco isolado obrigatório.');
const origin = 'http://localhost:3013';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db.js'),
  { migrate } = await import('../server/migrate.js'),
  { seed } = await import('../server/seed.js'),
  { createLegacyTestCharacter } = await import('../tests/character-fixtures.js');
await migrate();
await seed();
const { createApp } = await import('../server/app.js'),
  server = createApp().listen(3013, '127.0.0.1');
await new Promise<void>((resolve) => server.once('listening', resolve));
const browser = await chromium.launch({ channel: 'msedge', headless: true }),
  owner = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
  }),
  guest = await browser.newContext({
    viewport: { width: 390, height: 900 },
    reducedMotion: 'reduce',
  }),
  page = await owner.newPage(),
  visit = await guest.newPage();
const errors: string[] = [];
page.on('pageerror', (error) => errors.push(error.message));
visit.on('pageerror', (error) => errors.push(error.message));
await mkdir('test-results', { recursive: true });
async function req(context: BrowserContext, path: string, data?: unknown, method = 'POST') {
  const response = await context.request.fetch(origin + '/api' + path, {
    method,
    headers: { Origin: origin },
    data,
  });
  expect(response.ok(), `${method} ${path}`).toBe(true);
  return response.json();
}
async function signup(context: BrowserContext, name: string) {
  await context.addInitScript(() => {
    localStorage.setItem('alvorada-music-muted', 'true');
    localStorage.setItem('alvorada-effects-muted', 'true');
  });
  const result = await req(context, '/auth/sign-up/email', {
    name,
    email: `gear-${randomUUID()}@example.test`,
    password: `Test-${randomUUID()}`,
  });
  return result.user.id as string;
}
async function anchor(piece: Locator) {
  return piece.evaluate((element) => ({
    left: (element as HTMLElement).style.left,
    top: (element as HTMLElement).style.top,
  }));
}
try {
  const userId = await signup(owner, 'Decoradora da casa'),
    guestId = await signup(guest, 'Convidado da casa');
  const hero = await createLegacyTestCharacter(userId, 'Aurora dos móveis');
  await pool.query('UPDATE characters SET gold_cp=500000 WHERE id=$1', [hero.id]);
  const home = await req(owner, '/house', { character_id: hero.id });
  const homeId = home.id;
  const table = await req(owner, '/house/purchase', {
    character_id: hero.id,
    catalog_id: 'table',
    idempotency_key: randomUUID(),
  });
  const sofa = await req(owner, '/house/purchase', {
    character_id: hero.id,
    catalog_id: 'sofa',
    idempotency_key: randomUUID(),
  });
  const frame = await req(owner, '/house/purchase', {
    character_id: hero.id,
    catalog_id: 'frame',
    idempotency_key: randomUUID(),
    content: { title: 'Quadro da esquina', text: 'Uma memória guardada em casa.' },
    image: (await readFile('public/calendar/village-night-v1.webp')).toString('base64'),
  });
  const house = await req(owner, `/house/${homeId}`, undefined, 'GET');
  house.rooms[0].placements = [
    {
      id: randomUUID(),
      kind: 'item',
      ref: table.item_id,
      x: 0.5,
      y: 0.82,
      scale: 0.28,
      rotation: 0,
      facing: 0,
      layer: 2,
    },
    {
      id: randomUUID(),
      kind: 'item',
      ref: sofa.item_id,
      x: 0.92,
      y: 0.92,
      scale: 0.12,
      rotation: 0,
      facing: 0,
      layer: 3,
    },
    {
      id: randomUUID(),
      kind: 'item',
      ref: frame.item_id,
      x: 0.07,
      y: 0.26,
      scale: 0.05,
      rotation: 0,
      facing: 0,
      layer: 1,
    },
  ];
  await req(
    owner,
    `/house/${homeId}`,
    { name: house.name, revision: house.revision, rooms: house.rooms },
    'PUT',
  );
  await req(owner, `/house/${homeId}/invites`, { user_id: guestId });
  await req(guest, `/house/${homeId}/invites/${guestId}`, { status: 'accepted' }, 'PUT');
  await page.goto(origin + '/#house');
  await expect(page.locator('.house-piece')).toHaveCount(3);
  await expect(page.locator('.house-panel')).toHaveCount(0);
  const tablePiece = page.getByRole('button', { name: 'Mesa do Viajante · mover', exact: true });
  const framePiece = page.getByRole('button', { name: 'Quadro da esquina · mover', exact: true });
  const sofaPiece = page.getByRole('button', { name: 'Sofá de Carvalho · mover', exact: true });
  await tablePiece.scrollIntoViewIfNeeded();
  const before = (await tablePiece.boundingBox())!;
  const grab = { x: before.x + before.width * 0.45, y: before.y + before.height * 0.55 };
  await page.mouse.move(grab.x, grab.y);
  await page.mouse.down();
  const held = (await tablePiece.boundingBox())!;
  expect(Math.abs(held.x - before.x), 'selecionar não altera a caixa horizontal').toBeLessThan(1);
  expect(Math.abs(held.y - before.y), 'selecionar não altera a caixa vertical').toBeLessThan(1);
  await page.mouse.up();
  await expect(page.getByRole('button', { name: 'Ajustar peça', exact: true })).toBeVisible();
  const initialAnchor = await anchor(tablePiece);
  for (let facing = 1; facing <= 8; facing++) {
    await page.getByRole('button', { name: 'Próxima vista da peça', exact: true }).click();
    await expect(tablePiece).toHaveAttribute('data-facing', String(facing % 8));
    expect(await anchor(tablePiece), 'seta não move a peça').toEqual(initialAnchor);
  }
  await page.getByRole('button', { name: 'Vista anterior da peça', exact: true }).click();
  await expect(tablePiece).toHaveAttribute('data-facing', '7');
  expect(await anchor(tablePiece)).toEqual(initialAnchor);
  await page.getByRole('button', { name: 'Ajustar peça', exact: true }).click();
  const settings = page.getByRole('dialog', { name: 'Ajustes da peça', exact: true });
  await expect(settings).toBeVisible();
  await settings.getByLabel('Direção da peça', { exact: true }).selectOption('1');
  await settings.getByLabel('Tamanho da peça', { exact: true }).fill('26');
  await settings.getByLabel('Giro da peça', { exact: true }).fill('0');
  await expect(tablePiece).toHaveAttribute('data-facing', '1');
  await expect(tablePiece).toHaveAttribute('data-base-scale', '0.26');
  let releaseSave!: () => void, startedSave!: () => void;
  const saveGate = new Promise<void>((resolve) => {
    releaseSave = resolve;
  });
  const saveStarted = new Promise<void>((resolve) => {
    startedSave = resolve;
  });
  const saveEndpoint = `${origin}/api/house/${homeId}`;
  await page.route(saveEndpoint, async (route) => {
    if (route.request().method() === 'PUT') {
      startedSave();
      await saveGate;
    }
    await route.continue();
  });
  try {
    // Keyboard activation does not issue the outside pointerdown that closes the popover.
    await page
      .getByRole('button', { name: 'Salvar mudanças', exact: true })
      .evaluate((button: HTMLButtonElement) => button.click());
    await saveStarted;
    await expect(settings.getByLabel('Direção da peça', { exact: true })).toBeDisabled();
    await expect(settings.getByLabel('Tamanho da peça', { exact: true })).toBeDisabled();
    await expect(settings.getByRole('button', { name: 'Guardar', exact: true })).toBeDisabled();
    await expect(
      page.getByRole('button', { name: 'Próxima vista da peça', exact: true }),
    ).toBeDisabled();
  } finally {
    releaseSave();
  }
  await expect(page.getByRole('button', { name: 'Salvo', exact: true })).toBeDisabled();
  await page.unroute(saveEndpoint);
  if (await settings.count())
    await settings.getByRole('button', { name: 'Fechar ajustes da peça', exact: true }).click();
  await page.reload();
  await expect(tablePiece).toHaveAttribute('data-facing', '1');
  await expect(tablePiece).toHaveAttribute('data-base-scale', '0.26');
  const persisted = await req(owner, `/house/${homeId}`, undefined, 'GET');
  const persistedTable = persisted.rooms[0].placements.find(
    (piece: { ref: string }) => piece.ref === table.item_id,
  );
  expect(persistedTable.facing).toBe(1);
  expect(persistedTable.scale).toBe(0.26);

  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const [edge, piece] of [
      ['left', framePiece],
      ['right', sofaPiece],
    ] as const) {
      await piece.click();
      await page.getByRole('button', { name: 'Ajustar peça', exact: true }).click();
      await expect(settings).toBeVisible();
      const box = (await settings.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
      expect(box.y + box.height).toBeLessThanOrEqual(1001);
      expect(
        await settings.evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
      ).toBe(true);
      if (edge === 'left')
        await expect(settings.getByLabel('Manter fundo de madeira', { exact: true })).toBeVisible();
      await page.screenshot({
        path: `test-results/house-gear-${edge}-${width}.png`,
        fullPage: true,
      });
      await settings.getByRole('button', { name: 'Fechar ajustes da peça', exact: true }).click();
      if (width === 1440 || width === 320)
        await page.screenshot({
          path: `test-results/house-gear-selected-${edge}-${width}.png`,
          fullPage: true,
        });
      if (width === 320 && edge === 'right') {
        const centerIsPiece = await piece.evaluate((element) => {
          const box = element.getBoundingClientRect();
          return (
            document
              .elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)
              ?.closest('.house-piece') === element
          );
        });
        expect(centerIsPiece, 'setas preservam o centro da peça pequena para arrastar').toBe(true);
        for (const name of ['Vista anterior da peça', 'Ajustar peça', 'Próxima vista da peça']) {
          const clickable = await page
            .getByRole('button', { name, exact: true })
            .evaluate((element) => {
              const box = element.getBoundingClientRect();
              return (
                document
                  .elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)
                  ?.closest('button') === element
              );
            });
          expect(clickable, `${name} permanece livre em peça pequena na borda`).toBe(true);
        }
        const mobileAnchor = await anchor(piece);
        await page.getByRole('button', { name: 'Próxima vista da peça', exact: true }).click();
        await expect(piece).toHaveAttribute('data-facing', '1');
        await page.getByRole('button', { name: 'Vista anterior da peça', exact: true }).click();
        await expect(piece).toHaveAttribute('data-facing', '0');
        expect(await anchor(piece)).toEqual(mobileAnchor);
      }
    }
  }
  await page.setViewportSize({ width: 320, height: 568 });
  await framePiece.click();
  await page.getByRole('button', { name: 'Ajustar peça', exact: true }).click();
  const shortBox = (await settings.boundingBox())!;
  expect(shortBox.y).toBeGreaterThanOrEqual(0);
  expect(shortBox.y + shortBox.height).toBeLessThanOrEqual(568);
  expect(await settings.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(
    true,
  );
  await settings
    .getByRole('button', { name: 'Ver lembrança', exact: true })
    .scrollIntoViewIfNeeded();
  await expect(settings.getByRole('button', { name: 'Ver lembrança', exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/house-gear-short-320.png', fullPage: true });
  await page.keyboard.press('Escape');
  await expect(settings).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Ajustar peça', exact: true })).toBeFocused();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await framePiece.click();
  await page.getByRole('button', { name: 'Ajustar peça', exact: true }).click();
  await settings.getByRole('button', { name: 'Ver lembrança', exact: true }).click();
  const reader = page.getByRole('dialog', { name: 'Quadro da esquina', exact: true });
  await expect(reader).toBeVisible();
  await reader.getByRole('button', { name: 'Fechar', exact: true }).click();
  if (await settings.count())
    await settings.getByRole('button', { name: 'Fechar ajustes da peça', exact: true }).click();
  await tablePiece.click();
  await page.getByRole('button', { name: 'Ajustar peça', exact: true }).click();
  await settings.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(tablePiece).toHaveCount(0);
  await page.getByRole('button', { name: 'Salvar mudanças', exact: true }).click();
  await page.reload();
  await expect(tablePiece).toHaveCount(0);
  const inventory = await req(owner, `/house/${homeId}`, undefined, 'GET');
  expect(inventory.inventory.some((item: { id: string }) => item.id === table.item_id)).toBe(true);
  await visit.goto(origin + '/#house');
  await visit.getByLabel('Escolher casa', { exact: true }).selectOption(homeId);
  await expect(visit.locator('.house-piece')).toHaveCount(2);
  await visit.getByRole('button', { name: 'Quadro da esquina', exact: true }).click();
  await expect(visit.getByRole('button', { name: 'Ajustar peça', exact: true })).toHaveCount(0);
  await expect(
    visit.getByRole('button', { name: 'Próxima vista da peça', exact: true }),
  ).toHaveCount(0);
  expect(errors).toEqual([]);
  console.log(
    'House gear: dono seleciona sem Decoração, seleção não salta, oito vistas pelas setas sem mover, ajustes persistentes, menus nas bordas em quatro larguras, leitura/guardar e visitante sem edição aprovados.',
  );
} finally {
  await browser.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.end();
}
