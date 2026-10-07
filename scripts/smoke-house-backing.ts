import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
if (!new URL(process.env.DATABASE_URL!).pathname.startsWith('/alvorada_test_'))
  throw Error('Banco isolado obrigatório.');
const origin = 'http://localhost:3014';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db.js');
const { migrate } = await import('../server/migrate.js');
const { seed } = await import('../server/seed.js');
const { createLegacyTestCharacter } = await import('../tests/character-fixtures.js');
await migrate();
await seed();
const { createApp } = await import('../server/app.js');
const server = createApp().listen(3014, '127.0.0.1');
await new Promise<void>((resolve) => server.once('listening', resolve));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const owner = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const guest = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await owner.newPage(),
  visit = await guest.newPage(),
  errors: string[] = [];
page.on('pageerror', (error) => errors.push(error.message));
visit.on('pageerror', (error) => errors.push(error.message));
async function request(context: typeof owner, path: string, data: unknown, method = 'POST') {
  const response = await context.request.fetch(origin + '/api' + path, {
    method,
    headers: { Origin: origin },
    data,
  });
  expect(response.ok(), `${method} ${path}: ${response.status()}`).toBe(true);
  return response.json();
}
async function signup(context: typeof owner, name: string) {
  return (
    await request(context, '/auth/sign-up/email', {
      name,
      email: `house-backing-${randomUUID()}@example.test`,
      password: `Test-${randomUUID()}`,
    })
  ).user.id;
}
try {
  await mkdir('test-results', { recursive: true });
  const userId = await signup(owner, 'Dona das molduras'),
    guestId = await signup(guest, 'Visita das molduras');
  const hero = await createLegacyTestCharacter(userId, 'Memórias');
  await pool.query('UPDATE characters SET gold_cp=500000 WHERE id=$1', [hero.id]);
  const home = await request(owner, '/house', { character_id: hero.id }),
    homeId = home.id || home.home?.id;
  const blank = await request(owner, '/house/purchase', {
    character_id: hero.id,
    catalog_id: 'frame',
    content: { title: 'Moldura vazada' },
    idempotency_key: randomUUID(),
  });
  const photo = await request(owner, '/house/purchase', {
    character_id: hero.id,
    catalog_id: 'frame',
    content: { title: 'Memória com imagem' },
    image: (await readFile('public/calendar/village-night-v1.webp')).toString('base64'),
    idempotency_key: randomUUID(),
  });
  const state = await owner.request
    .get(origin + '/api/house/' + homeId)
    .then((response) => response.json());
  state.rooms[0].placements = [blank, photo].map((item, i) => ({
    id: randomUUID(),
    kind: 'item',
    ref: item.item_id,
    x: i ? 0.74 : 0.28,
    y: 0.8,
    scale: 0.25,
    rotation: 0,
    facing: 0,
    layer: i,
  }));
  await request(
    owner,
    '/house/' + homeId,
    { revision: state.revision, name: state.name, rooms: state.rooms },
    'PUT',
  );
  await request(owner, `/house/${homeId}/invites`, { user_id: guestId });
  await request(guest, `/house/${homeId}/invites/${guestId}`, { status: 'accepted' }, 'PUT');
  await page.goto(origin + '/#house');
  const blankPiece = page
    .locator('.house-piece')
    .filter({ has: page.locator('img[alt="Quadro de Memórias"]') })
    .first();
  const photoPiece = page.locator('.house-piece').last();
  await expect(blankPiece).toBeVisible();
  await blankPiece.scrollIntoViewIfNeeded();
  await expect(blankPiece.locator('.house-frame-surface')).toHaveCount(0);
  await expect(photoPiece.locator('.house-picture')).toHaveCount(1);
  await blankPiece.click();
  await expect(page.getByRole('region', { name: 'Ajustes da peça' })).toBeVisible();
  await expect(page.getByLabel('Manter fundo de madeira')).not.toBeChecked();
  await page.getByLabel('Manter fundo de madeira').check();
  await expect(blankPiece.getByRole('img', { name: 'Fundo de madeira do quadro' })).toBeVisible();
  await blankPiece.screenshot({ path: 'test-results/house-backing-front.png' });
  await page.getByRole('button', { name: 'Salvar mudanças', exact: true }).click();
  await page.reload();
  await expect(blankPiece.locator('.house-frame-wood')).toHaveCount(1);
  await blankPiece.click();
  await expect(page.getByLabel('Manter fundo de madeira')).toBeChecked();
  for (const direction of [1, 7, 0, 4, 2, 6]) {
    await page.getByLabel('Direção da peça').selectOption(String(direction));
    await expect(blankPiece.locator('.house-frame-wood')).toHaveCount(
      [0, 1, 7].includes(direction) ? 1 : 0,
    );
    if ([0, 1, 7].includes(direction)) {
      const surface = await blankPiece.locator('.house-frame-surface').evaluate((element) => ({
        matrix: getComputedStyle(element).transform,
        clip: getComputedStyle(element).clipPath,
      }));
      expect(surface.matrix).toMatch(/^matrix3d\(/);
      expect(surface.clip).toBe('inset(0px)');
    }
  }
  await page.getByLabel('Direção da peça').selectOption('7');
  await blankPiece.screenshot({ path: 'test-results/house-backing-diagonal.png' });
  await photoPiece.click();
  await page.getByLabel('Manter fundo de madeira').check();
  await expect(photoPiece.locator('.house-picture')).toHaveCount(1);
  await expect(photoPiece.locator('.house-frame-wood')).toHaveCount(1);
  const compositing = await photoPiece.locator('.house-frame-art').evaluate((element) => {
    const surface = element.querySelector('.house-frame-surface')!,
      wood = surface.querySelector('.house-frame-wood')!,
      photo = surface.querySelector('.house-picture')!,
      rim = element.querySelector(':scope > img')!;
    return {
      woodBeforeImage: !!(wood.compareDocumentPosition(photo) & Node.DOCUMENT_POSITION_FOLLOWING),
      surfaceZ: getComputedStyle(surface).zIndex,
      rimZ: getComputedStyle(rim).zIndex,
      photoFit: getComputedStyle(photo).objectFit,
    };
  });
  expect(compositing).toEqual({
    woodBeforeImage: true,
    surfaceZ: '1',
    rimZ: '2',
    photoFit: 'cover',
  });
  await photoPiece.screenshot({ path: 'test-results/house-backing-custom-image.png' });
  await page.getByRole('button', { name: 'Salvar mudanças', exact: true }).click();
  await visit.goto(origin + '/#house');
  await visit.getByLabel('Escolher casa').selectOption(homeId);
  await expect(visit.locator('.house-frame-wood')).toHaveCount(2);
  await visit.locator('.house-piece').first().click();
  await expect(visit.getByRole('button', { name: 'Ajustar peça' })).toHaveCount(0);
  await expect(visit.getByRole('button', { name: 'Próxima vista da peça' })).toHaveCount(0);
  await blankPiece.click();
  await page.getByLabel('Manter fundo de madeira').uncheck();
  await page.getByRole('button', { name: 'Salvar mudanças', exact: true }).click();
  await page.reload();
  await expect(blankPiece.locator('.house-frame-surface')).toHaveCount(0);
  await expect(photoPiece.locator('.house-picture')).toHaveCount(1);
  expect(errors).toEqual([]);
  console.log(
    'House backing: quadro vazado/madeira, recorte frontal e diagonal, composição com foto, persistência e visita sem edição aprovados.',
  );
} finally {
  await browser.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.end();
}
