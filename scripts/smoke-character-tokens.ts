import 'dotenv/config';
import { chromium, expect, type BrowserContext } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { readFile, mkdir } from 'node:fs/promises';
import sharp from 'sharp';
import { completeArt } from '../server/character-art';
import { createLegacyTestCharacter, testArtImage } from '../tests/character-fixtures';
if (!/^\/alvorada_test_[0-9a-f]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))
  throw Error('Disposable database required');
const origin = 'http://localhost:3052';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db'),
  { migrate } = await import('../server/migrate'),
  { seed } = await import('../server/seed');
await migrate();
await seed();
const { createApp } = await import('../server/app'),
  server = createApp().listen(3052, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));
const browser = await chromium.launch({ channel: 'msedge', headless: true }),
  master = await browser.newContext({ viewport: { width: 1440, height: 1000 } }),
  player = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
async function api(context: BrowserContext, path: string, method = 'GET', data?: unknown) {
  const r = await context.request.fetch(origin + '/api' + path, {
    method,
    headers: { Origin: origin, 'X-Vtt-Schema-Version': '2' },
    data,
  });
  return { status: r.status(), data: await r.json() };
}
try {
  const signup = async (context: BrowserContext) =>
    (
      await api(context, '/auth/sign-up/email', 'POST', {
        name: 'Vista superior',
        email: randomUUID() + '@example.test',
        password: 'Test-' + randomUUID(),
      })
    ).data.user;
  const gm = await signup(master),
    user = await signup(player);
  await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [gm.id]);
  const character = await createLegacyTestCharacter(user.id, 'Guerreiro visto de cima'),
    portrait = await testArtImage(),
    token = await readFile('data/vtt/premium-art/monster-berserker-v1.webp');
  const jobId = randomUUID();
  await pool.query(
    "INSERT INTO character_art_jobs(id,user_id,character_id,status,idempotency_key) VALUES($1,$2,$3,'running',$4)",
    [jobId, user.id, character.id, randomUUID()],
  );
  await completeArt(jobId, { portrait, token });
  let room = (await api(master, '/vtt', 'POST', { name: 'Token completo' })).data;
  expect((await api(player, '/vtt/join', 'POST', { invite: room.invite })).status).toBe(200);
  room = (await api(master, '/vtt/rooms/' + room.id)).data;
  const scene = room.document.scenes[0];
  scene.lighting = false;
  scene.fog = false;
  const actor = scene.tokens.find((t: any) => t.characterId === character.id);
  Object.assign(actor, {
    x: scene.width / 2,
    y: scene.height / 2,
    width: 280,
    height: 280,
    rotation: 0,
  });
  expect(actor.image.endsWith('/top-down')).toBe(true);
  expect(
    (
      await api(master, '/vtt/rooms/' + room.id, 'PUT', {
        revision: room.revision,
        document: room.document,
      })
    ).status,
  ).toBe(200);
  const delivered = await player.request.get(origin + actor.image);
  expect(delivered.status()).toBe(200);
  const meta = await sharp(await delivered.body()).metadata();
  expect(meta.width).toBe(1024);
  expect(meta.height).toBe(1024);
  expect(meta.hasAlpha).toBe(true);
  const page = await player.newPage(),
    errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await mkdir('test-results', { recursive: true });
  await page.goto(origin + '/#vtt');
  const board = page.getByLabel('Tabuleiro da mesa', { exact: true });
  await expect(board).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        (src) => performance.getEntriesByType('resource').some((e) => e.name.endsWith(src)),
        actor.image,
      ),
    )
    .toBe(true);
  await page.waitForTimeout(350);
  await page.screenshot({ path: 'test-results/character-token-top-down-1440.png' });
  for (const width of [768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.waitForTimeout(120);
    await page.screenshot({ path: `test-results/character-token-top-down-${width}.png` });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(origin + '/#characters');
  await expect(
    page.locator(`img[src*="/characters/${character.id}/portrait"]`).first(),
  ).toBeVisible();
  expect(await page.locator('img[src$="/top-down"]').count()).toBe(0);
  expect(errors).toEqual([]);
  console.log(
    'PASS full transparent character token/VTT import/served image/4 viewports/profile portrait stays separate',
  );
} finally {
  await browser.close();
  await new Promise<void>((r) => server.close(() => r()));
  await pool.end();
}
