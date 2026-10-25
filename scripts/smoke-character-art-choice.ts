import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const url = new URL(process.env.DATABASE_URL!);
if (
  !['localhost', '127.0.0.1'].includes(url.hostname) ||
  url.port === '5437' ||
  !/^\/alvorada_test_[a-f0-9]{32}$/.test(url.pathname)
)
  throw Error('Banco local UUID descartável obrigatório.');
const probe = createServer();
await new Promise<void>((r) => probe.listen(0, '127.0.0.1', r));
const port = (probe.address() as { port: number }).port;
await new Promise<void>((r) => probe.close(() => r()));
const origin = `http://127.0.0.1:${port}`;
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
process.env.NODE_ENV = 'production';
const { pool } = await import('../server/db');
const { migrate } = await import('../server/migrate');
const { seed } = await import('../server/seed');
const { completeArt } = await import('../server/character-art');
const { createLegacyTestCharacter, testArtImage, testTokenImage, lockTestIllustrator } =
  await import('../tests/character-fixtures');
await migrate();
await seed();
const unlock = await lockTestIllustrator();
const { createApp } = await import('../server/app');
const server = createApp().listen(port, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));
const browser = await chromium.launch({ channel: 'msedge', headless: true }),
  context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
  }),
  page = await context.newPage();
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
const folder = 'test-results/character-art-choice';
await mkdir(folder, { recursive: true });
try {
  const signup = await context.request.post(origin + '/api/auth/sign-up/email', {
    headers: { Origin: origin },
    data: {
      name: 'Comparação de arte',
      email: randomUUID() + '@example.test',
      password: 'Test-' + randomUUID(),
    },
  });
  expect(signup.status()).toBe(200);
  const uid = (await signup.json()).user.id,
    hero = await createLegacyTestCharacter(uid, 'Viajante');
  const real = process.env.CHARACTER_ART_CHOICE_QA_DIRECTORY;
  const portrait = real ? await readFile(join(real, 'before.png')) : await testArtImage();
  const alternative = real
    ? await readFile(join(real, 'after.png'))
    : await readFile('public/character-silhouette-v2.png');
  const token = await testTokenImage();
  await pool.query('INSERT INTO character_portraits(character_id,image)VALUES($1,$2)', [
    hero.id,
    portrait,
  ]);
  await pool.query('INSERT INTO character_tokens(character_id,image)VALUES($1,$2)', [
    hero.id,
    token,
  ]);
  await pool.query('UPDATE characters SET portrait_revision=1 WHERE id=$1', [hero.id]);
  const queue = async () => {
    await pool.query(
      'INSERT INTO character_art_worker(id,available,heartbeat_at)VALUES(true,true,now())ON CONFLICT(id)DO UPDATE SET available=true,heartbeat_at=now()',
    );
    const r = await context.request.post(origin + '/api/character-art', {
      headers: { Origin: origin },
      data: {
        character_id: hero.id,
        reference: portrait.toString('base64'),
        idempotency_key: randomUUID(),
      },
    });
    expect(r.status(), await r.text()).toBe(202);
    const id = (await r.json()).id;
    await pool.query("UPDATE character_art_jobs SET status='running' WHERE id=$1", [id]);
    await completeArt(id, { portrait: alternative, token });
    return id;
  };
  await page.goto(origin + '/#characters');
  await expect(page.locator('.camp-figure img').first()).toBeVisible({ timeout: 60000 });
  const first = await queue(),
    dialog = page.getByRole('dialog', { name: 'Escolher imagem de Viajante' });
  await expect(dialog).toBeVisible({ timeout: 15000 });
  await expect(dialog.getByRole('button', { name: 'Usar imagem nova', exact: true })).toBeEnabled();
  for (const [width, height] of [
    [1440, 1000],
    [768, 1024],
    [390, 844],
    [320, 740],
  ]) {
    await page.setViewportSize({ width, height });
    expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await expect(
      dialog.getByRole('img', { name: 'Imagem atual de Viajante', exact: true }),
    ).toBeVisible();
    await expect(
      dialog.getByRole('img', { name: 'Imagem nova de Viajante', exact: true }),
    ).toBeVisible();
    await page.screenshot({ path: `${folder}/compare-${width}.png` });
  }
  expect(
    (await pool.query('SELECT portrait_revision FROM characters WHERE id=$1', [hero.id])).rows[0]
      .portrait_revision,
  ).toBe(1);
  await dialog.getByRole('button', { name: 'Decidir depois', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Comparar imagem de Viajante', exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(dialog).toBeVisible({ timeout: 15000 });
  await dialog.getByRole('button', { name: 'Manter imagem antiga', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(
    (await pool.query('SELECT image FROM character_portraits WHERE character_id=$1', [hero.id]))
      .rows[0].image,
  ).toEqual(portrait);
  expect(
    (await pool.query('SELECT portrait_revision FROM characters WHERE id=$1', [hero.id])).rows[0]
      .portrait_revision,
  ).toBe(1);
  expect(
    (await pool.query('SELECT art_decision FROM character_art_jobs WHERE id=$1', [first])).rows[0]
      .art_decision,
  ).toBe('kept');
  const second = await queue();
  await expect(dialog).toBeVisible({ timeout: 15000 });
  await dialog.getByRole('button', { name: 'Decidir depois', exact: true }).click();
  await page.goto(origin + '/#inventory');
  await page.getByRole('button', { name: 'Comparar imagem de Viajante', exact: true }).click();
  await expect(dialog).toBeVisible({ timeout: 15000 });
  await expect(dialog.getByRole('button', { name: 'Usar imagem nova', exact: true })).toBeEnabled();
  await dialog.getByRole('button', { name: 'Usar imagem nova', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(
    (await pool.query('SELECT art_decision FROM character_art_jobs WHERE id=$1', [second])).rows[0]
      .art_decision,
  ).toBe('accepted');
  expect(
    (await pool.query('SELECT portrait_revision FROM characters WHERE id=$1', [hero.id])).rows[0]
      .portrait_revision,
  ).toBe(2);
  await page.goto(origin + '/#characters');
  await expect(page.locator('.camp-figure img').first()).toHaveAttribute('src', /v=2$/);
  expect(
    (await pool.query('SELECT gold_cp FROM characters WHERE id=$1', [hero.id])).rows[0].gold_cp,
  ).toBe(hero.gold_cp);
  const remoteChoice = await queue();
  await expect(dialog).toBeVisible({ timeout: 15000 });
  expect(
    (
      await context.request.post(origin + '/api/character-art/' + remoteChoice + '/decision', {
        headers: { Origin: origin },
        data: { decision: 'kept' },
      })
    ).status(),
  ).toBe(200);
  await expect(dialog).toHaveCount(0, { timeout: 10000 });
  await queue();
  await expect(dialog).toBeVisible({ timeout: 15000 });
  await dialog.getByRole('button', { name: 'Manter imagem antiga', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const state = await context.request.get(origin + '/api/character-art');
  expect((await state.json()).quotas[hero.id].used).toBe(4);
  expect(errors).toEqual([]);
  console.log(
    JSON.stringify({
      passed: true,
      widths: 4,
      automaticComparison: true,
      keepOld: true,
      acceptNew: true,
      decideLaterAndReload: true,
      campAndInventory: true,
      anotherTabAndNextComparison: true,
      quotaAndGoldPreserved: true,
      realArt: Boolean(real),
    }),
  );
} finally {
  await browser.close();
  await new Promise<void>((r) => server.close(() => r()));
  await unlock();
  await pool.end();
}
