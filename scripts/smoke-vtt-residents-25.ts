import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { natureAssets } from '../shared/vtt-nature-assets';
import { createNatureToken } from '../shared/vtt-nature-placement';
import { residentAsset } from '../shared/vtt-village-assets';
import { vttProtocolVersion } from '../shared/vtt-protocol';
if (!/^\/alvorada_test_[0-9a-f]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))
  throw Error('Banco UUID descartável obrigatório.');
const origin = 'http://localhost:3093';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db'),
  { migrate } = await import('../server/migrate'),
  { seed } = await import('../server/seed');
await migrate();
await seed();
const { createApp } = await import('../server/app');
process.env.NODE_ENV = 'production';
const server = createApp().listen(3093, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));
const browser = await chromium.launch({ channel: 'msedge', headless: true }),
  context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
    extraHTTPHeaders: { 'Accept-Encoding': 'identity' },
  }),
  page = await context.newPage(),
  errors: string[] = [],
  missing: string[] = [],
  out = 'test-results/vtt-residents-25';
await mkdir(out, { recursive: true });
await writeFile(out + '/result.json', JSON.stringify({ passed: false }));
await context.addInitScript(() => {
  localStorage.setItem('alvorada-music-muted', 'true');
  localStorage.setItem('alvorada-effects-muted', 'true');
});
page.on('pageerror', (e) => errors.push(e.message));
page.on('response', (r) => {
  if (r.status() >= 400 && /\/(resident-|residents-25)/.test(r.url())) missing.push(r.url());
});
const failedThumbs = new Set<string>();
await page.route(
  /\/vtt\/overhead-thumbs-20261015\/resident-02[345]\.webp(?:\?.*)?$/,
  async (route) => {
    failedThumbs.add(
      route
        .request()
        .url()
        .match(/resident-\d+/)![0],
    );
    await route.abort('failed');
  },
);
let previewFailures = 0;
await page.route(
  /\/vtt\/residents-25-20261018\/resident-026-topdown-v3\.webp(?:\?.*)?$/,
  async (route) => {
    if (previewFailures < 2) {
      previewFailures++;
      await route.abort('failed');
    } else await route.continue();
  },
);
const headers = { Origin: origin, 'X-Vtt-Schema-Version': String(vttProtocolVersion) };
async function req(path: string, data?: unknown, method = data ? 'POST' : 'GET') {
  const r = await context.request.fetch(origin + '/api' + path, { method, headers, data });
  expect(r.ok(), await r.text()).toBe(true);
  return r.json();
}
async function decoded(locator: ReturnType<typeof page.locator>) {
  await expect
    .poll(() => locator.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0))
    .toBe(true);
}
async function library() {
  await page.getByRole('button', { name: 'Biblioteca', exact: true }).click();
  await page.getByRole('button', { name: 'Assets', exact: true }).click();
  await page.locator('.vtt-asset-collections button').filter({ hasText: 'Moradores' }).click();
}
const residents = natureAssets.filter((a) => a.category === 'Moradores'),
  additions = residents.filter((a) => Number(a.id.slice(-3)) >= 26);
try {
  expect(residents).toHaveLength(50);
  expect(additions).toHaveLength(25);
  expect(new Set(residents.map((a) => a.id)).size).toBe(50);
  const { user } = await req('/auth/sign-up/email', {
    name: 'Moradores',
    email: randomUUID() + '@example.test',
    password: 'Test-' + randomUUID(),
  });
  await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [user.id]);
  await page.goto(origin + '/#vtt');
  await page.getByLabel('Nome da mesa', { exact: true }).fill('Vila com cinquenta moradores');
  await page.getByRole('button', { name: 'Criar mesa', exact: true }).click();
  const board = page.getByLabel('Tabuleiro da mesa', { exact: true });
  await expect(board).toBeVisible();
  const roomId = (await pool.query('SELECT id FROM vtt_rooms WHERE owner_id=$1', [user.id])).rows[0]
      .id,
    root = '/vtt/rooms/' + roomId;
  await library();
  await expect(page.locator('.vtt-nature-card')).toHaveCount(50);
  for (const a of residents) {
    const card = page.locator('.vtt-nature-card').filter({ hasText: a.name });
    await card.scrollIntoViewIfNeeded();
    await decoded(card.locator('img'));
    if (['resident-023', 'resident-024', 'resident-025'].includes(a.id)) {
      await expect(card.locator('img')).toHaveAttribute(
        'src',
        /\/overhead-20261015\/resident-\d+\.webp\?image_retry=1/,
      );
    }
  }
  expect([...failedThumbs].sort()).toEqual(['resident-023', 'resident-024', 'resident-025']);
  for (const [i, a] of additions.entries()) {
    const card = page.locator('.vtt-nature-card').filter({ hasText: a.name });
    await card.click();
    const preview = page.locator('.vtt-nature-detail > img');
    await decoded(preview);
    expect(await preview.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBe(768);
    if (i < 3) await page.getByRole('button', { name: 'Colocar no mapa', exact: true }).click();
  }
  expect(previewFailures).toBe(2);
  await page.getByRole('button', { name: 'Salvar mesa', exact: true }).click();
  await expect
    .poll(
      async () =>
        (await req(root)).document.scenes[0].tokens.filter((t: any) =>
          additions.some((a) => a.image === t.image),
        ).length,
    )
    .toBe(3);
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.getByLabel('Buscar na biblioteca', { exact: true }).fill('Abrão');
    await expect(page.locator('.vtt-nature-card')).toHaveCount(1);
    await page.locator('.vtt-nature-card').click();
    await decoded(page.locator('.vtt-nature-detail > img'));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await page.screenshot({ path: `${out}/library-${width}.png` });
  }
  const r = await req(root),
    scene = r.document.scenes[0];
  scene.tokens = residents.map((a, i) => {
    const token = createNatureToken(
      randomUUID(),
      a.id,
      scene,
      { x: 120 + (i % 8) * 140, y: 120 + Math.floor(i / 8) * 140 },
      1,
    )!;
    expect(token).toBeTruthy();
    expect(residentAsset(token)?.id).toBe(a.id);
    return { ...token, rotation: (i % 4) * 90 };
  });
  scene.lighting = false;
  await req(root, { revision: r.revision, document: r.document }, 'PUT');
  const saved = (await req(root)).document.scenes[0].tokens;
  expect(saved).toHaveLength(50);
  for (const [i, a] of residents.entries()) {
    expect(saved[i].image).toBe(a.image);
    expect(saved[i].rotation).toBe((i % 4) * 90);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.reload();
  await expect(board).toBeVisible();
  await library();
  await page.getByLabel('Buscar na biblioteca', { exact: true }).fill('Rosana');
  await page.locator('.vtt-nature-card').click();
  await decoded(page.locator('.vtt-nature-detail > img'));
  await page.screenshot({ path: out + '/all50-map.png' });
  expect(errors).toEqual([]);
  expect(missing).toEqual([]);
  await writeFile(
    out + '/result.json',
    JSON.stringify(
      {
        passed: true,
        residents: 50,
        newResidents: 25,
        allThumbnailsDecoded: true,
        failedLegacyThumbnailsRecovered: [...failedThumbs].sort(),
        previewRetries: previewFailures,
        all25Previews: true,
        libraryPlacement: true,
        all50Persisted: true,
        rotations: [0, 90, 180, 270],
        responsive: [1440, 768, 390, 320],
        errors,
        missing,
      },
      null,
      2,
    ),
  );
  console.log(
    'PASS 50 moradores: 25 novos, imagens/prévias, recuperação de falhas, colocação, giro, persistência e quatro larguras.',
  );
} catch (e) {
  await page.screenshot({ path: out + '/failure.png', fullPage: true });
  throw e;
} finally {
  await context.close();
  await browser.close();
  await new Promise<void>((r) => server.close(() => r()));
  await pool.end();
}
