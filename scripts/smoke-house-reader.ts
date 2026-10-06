import 'dotenv/config';
import { chromium, expect, type BrowserContext } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';

if (!/^\/alvorada_test_[a-f0-9]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))
  throw Error('Banco isolado obrigatório.');
const origin = 'http://localhost:3011';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db.js'),
  { migrate } = await import('../server/migrate.js'),
  { seed } = await import('../server/seed.js'),
  { createLegacyTestCharacter } = await import('../tests/character-fixtures.js');
await migrate();
await seed();
const { createApp } = await import('../server/app.js'),
  server = createApp().listen(3011, '127.0.0.1');
await new Promise<void>((resolve) => server.once('listening', resolve));
const browser = await chromium.launch({ channel: 'msedge', headless: true }),
  owner = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
  }),
  stranger = await browser.newContext(),
  page = await owner.newPage();
const errors: string[] = [];
page.on('pageerror', (error) => errors.push(error.message));
await mkdir('test-results', { recursive: true });

async function signup(context: BrowserContext, name: string) {
  const response = await context.request.post(origin + '/api/auth/sign-up/email', {
    headers: { Origin: origin },
    data: {
      name,
      email: `house-reader-${randomUUID()}@example.test`,
      password: `Test-${randomUUID()}`,
    },
  });
  expect(response.ok()).toBe(true);
  await context.addInitScript(() => {
    localStorage.setItem('alvorada-music-muted', 'true');
    localStorage.setItem('alvorada-effects-muted', 'true');
  });
  return (await response.json()).user.id;
}
async function req(path: string, data?: unknown, method = 'POST') {
  const response = await owner.request.fetch(origin + '/api' + path, {
    method,
    headers: { Origin: origin },
    data,
  });
  expect(response.ok(), `${method} ${path}`).toBe(true);
  return await response.json();
}
async function verifyBounds(width: number) {
  const dialog = page.getByRole('dialog');
  const box = await dialog.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(
    await page
      .locator('.house-item-reader')
      .evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
  ).toBe(true);
}

try {
  const ownerId = await signup(owner, 'Escriba da casa');
  await signup(stranger, 'Visitante sem convite');
  const hero = await createLegacyTestCharacter(ownerId, 'Aurora leitora');
  await pool.query('UPDATE characters SET gold_cp=500000 WHERE id=$1', [hero.id]);
  await req('/house', { character_id: hero.id });
  const index = await req('/house', undefined, 'GET');
  const homeId = index.homes[0].id;
  const letterTitle = 'Mensagem da Vigília';
  const frameTitle = 'Memória do Pátio';
  const letterText = (
    'À Aurora,\n\nAinda guardo a primeira noite da nossa jornada. <script>não execute</script>\n\n' +
    'A lareira continua acesa. Que esta lembrança acompanhe os nossos próximos caminhos.\n\n'.repeat(
      45,
    )
  )
    .slice(0, 3000)
    .trim();
  const letterOrder = await req('/house/purchase', {
    character_id: hero.id,
    catalog_id: 'letter',
    idempotency_key: randomUUID(),
    content: { title: letterTitle, text: letterText },
  });
  const frameOrder = await req('/house/purchase', {
    character_id: hero.id,
    catalog_id: 'frame',
    idempotency_key: randomUUID(),
    content: {
      title: frameTitle,
      text: 'O lugar onde começou a nossa história.\nUma recordação para a sala.',
    },
    image: (await readFile('public/calendar/village-night-v1.webp')).toString('base64'),
  });
  const sofaOrder = await req('/house/purchase', {
    character_id: hero.id,
    catalog_id: 'sofa',
    idempotency_key: randomUUID(),
  });
  const house = await req(`/house/${homeId}`, undefined, 'GET');
  house.rooms[0].placements = [
    {
      id: randomUUID(),
      kind: 'item',
      ref: letterOrder.item_id,
      x: 0.24,
      y: 0.72,
      scale: 0.14,
      rotation: 0,
      facing: 0,
      layer: 1,
    },
    {
      id: randomUUID(),
      kind: 'item',
      ref: frameOrder.item_id,
      x: 0.82,
      y: 0.44,
      scale: 0.07,
      rotation: 0,
      facing: 0,
      perspective_pitch: 12,
      perspective_yaw: -20,
      layer: 2,
    },
    {
      id: randomUUID(),
      kind: 'item',
      ref: sofaOrder.item_id,
      x: 0.82,
      y: 0.9,
      scale: 0.29,
      rotation: 0,
      facing: 0,
      perspective_pitch: 12,
      perspective_yaw: -20,
      layer: 3,
    },
  ];
  await req(
    `/house/${homeId}`,
    { name: house.name, revision: house.revision, rooms: house.rooms },
    'PUT',
  );
  await page.goto(origin + '/#house');
  await expect(page.locator('.house-piece')).toHaveCount(3);
  await expect
    .poll(() =>
      page
        .locator('.house-piece img')
        .evaluateAll((elements) =>
          elements.every(
            (element) =>
              (element as HTMLImageElement).complete &&
              (element as HTMLImageElement).naturalWidth > 0,
          ),
        ),
    )
    .toBe(true);
  await page
    .locator('.house-scene')
    .screenshot({ path: 'test-results/house-perspective-scene.png' });
  const letterPiece = page.getByRole('button', { name: `${letterTitle} · mover`, exact: true });
  const framePiece = page.getByRole('button', { name: `${frameTitle} · mover`, exact: true });
  await letterPiece.dblclick();
  let dialog = page.getByRole('dialog', { name: letterTitle, exact: true });
  await expect(dialog).toBeVisible();
  const reader = page.locator('.house-item-reader');
  await expect(reader).toHaveAttribute('data-reading-font', 'medieval');
  await expect(dialog.getByLabel('Fonte de leitura')).toHaveValue('medieval');
  await expect(dialog.getByLabel('Fonte de leitura').locator('option')).toHaveCount(4);
  await expect(page.locator('.house-reader-paper-content p')).toHaveText(letterText);
  await expect(page.locator('.house-reader-paper-content p')).toHaveCSS('color', 'rgb(57, 38, 17)');
  await expect(page.locator('.house-reader-paper-content p')).toHaveCSS('font-size', '36px');
  await expect(reader.getByRole('heading', { name: letterTitle, exact: true })).toHaveCSS(
    'color',
    'rgb(57, 38, 17)',
  );
  await expect(reader.locator('script')).toHaveCount(0);
  await expect
    .poll(() =>
      page
        .locator('.house-reader-paper-art')
        .evaluate((element) => (element as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
  const headingBox = await reader
    .getByRole('heading', { name: letterTitle, exact: true })
    .boundingBox();
  const textBox = await page.locator('.house-reader-paper-content p').boundingBox();
  expect(textBox!.y).toBeGreaterThan(headingBox!.y + headingBox!.height);
  const paper = page.locator('.house-reader-paper-content');
  expect(await paper.evaluate((element) => element.scrollHeight > element.clientHeight + 100)).toBe(
    true,
  );
  await paper.evaluate((element) => {
    element.scrollTop = 180;
  });
  expect(await paper.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await paper.evaluate((element) => {
    element.scrollTop = 0;
  });
  for (const [value, family, weight, filename] of [
    ['medieval', 'House Bilbo', '400', 'house-bilbo-regular.ttf'],
    ['calligraphy', 'House Tangerine', '700', 'house-tangerine-bold.ttf'],
    ['gothic', 'House Pirata', '400', 'house-pirata-one-regular.ttf'],
    ['classic', 'Georgia', '400', ''],
  ]) {
    await dialog.getByLabel('Fonte de leitura').selectOption(value);
    await expect(reader).toHaveAttribute('data-reading-font', value);
    await page.evaluate(
      async ({ family, weight }) => {
        await document.fonts.load(`${weight} 36px "${family}"`);
      },
      { family, weight },
    );
    expect(
      await page.evaluate(
        ({ family, weight }) => document.fonts.check(`${weight} 36px "${family}"`),
        { family, weight },
      ),
    ).toBe(true);
    if (filename) expect((await owner.request.get(`${origin}/fonts/${filename}`)).ok()).toBe(true);
  }
  await dialog.getByLabel('Fonte de leitura').selectOption('medieval');
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await verifyBounds(width);
    await page.screenshot({
      path: `test-results/house-reader-letter-${width}.png`,
      fullPage: true,
    });
  }
  await dialog.getByLabel('Fonte de leitura').selectOption('gothic');
  await dialog.getByRole('button', { name: 'Fechar', exact: true }).click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await framePiece.dblclick();
  dialog = page.getByRole('dialog', { name: frameTitle, exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('Fonte de leitura')).toHaveValue('gothic');
  const picture = page.locator('.house-reader-picture img');
  await expect(picture).toHaveAttribute('src', `/api/house/items/${frameOrder.item_id}/image`);
  await expect
    .poll(() => picture.evaluate((element) => (element as HTMLImageElement).naturalWidth))
    .toBeGreaterThan(0);
  expect(
    (await owner.request.get(`${origin}/api/house/items/${frameOrder.item_id}/image`)).status(),
  ).toBe(200);
  const denied = await stranger.request.get(
    `${origin}/api/house/items/${frameOrder.item_id}/image`,
  );
  expect([403, 404]).toContain(denied.status());
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await verifyBounds(width);
    const imageBox = await picture.boundingBox();
    expect(imageBox!.width).toBeGreaterThan(Math.min(180, width * 0.5));
    await page.screenshot({ path: `test-results/house-reader-frame-${width}.png`, fullPage: true });
  }
  await dialog.getByRole('button', { name: 'Fechar', exact: true }).click();
  await page.reload();
  await letterPiece.dblclick();
  await expect(page.getByLabel('Fonte de leitura')).toHaveValue('gothic');
  expect(errors).toEqual([]);
  console.log(
    'House leitor: dois cliques em carta/quadro, título antes do texto, quatro fontes locais, preferência persistente, texto longo com rolagem, imagem privada e quatro larguras aprovados.',
  );
} finally {
  await browser.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.end();
}
