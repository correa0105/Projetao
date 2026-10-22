import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import express from 'express';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { mkdir } from 'node:fs/promises';
if (!/^\/alvorada_test_[0-9a-f]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))
  throw Error('Banco descartável obrigatório.');
const probe = createServer();
await new Promise<void>((r) => probe.listen(0, '127.0.0.1', r));
const port = (probe.address() as { port: number }).port;
await new Promise<void>((r) => probe.close(() => r()));
const origin = `http://127.0.0.1:${port}`;
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db');
const { migrate } = await import('../server/migrate');
const { seed } = await import('../server/seed');
const { createLegacyTestCharacter, testArtImage, testTokenImage } =
  await import('../tests/character-fixtures');
await migrate();
await seed();
const { createApp } = await import('../server/app');
let hold = true,
  hits = 0;
const pending: Array<() => void> = [];
const app = express();
// Delay actual server responses. Playwright route interception would disable HTTP cache.
app.use((req, _res, next) => {
  if (/^\/api\/companions\/[^/]+\/(mount|pet)\/[^/]+\/image$/.test(req.path)) {
    hits++;
    if (hold) {
      pending.push(next);
      return;
    }
  }
  next();
});
app.use(createApp());
const server = app.listen(port, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));
const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL || 'msedge',
  headless: true,
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: 'reduce',
});
const page = await context.newPage();
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
const release = () => {
  hold = false;
  pending.splice(0).forEach((next) => next());
};
try {
  const signup = await context.request.post(origin + '/api/auth/sign-up/email', {
    headers: { Origin: origin },
    data: {
      name: 'Cache do acampamento',
      email: randomUUID() + '@example.test',
      password: 'Test-' + randomUUID(),
    },
  });
  expect(signup.status()).toBe(200);
  const uid = (await signup.json()).user.id;
  const hero = await createLegacyTestCharacter(uid, 'Nana');
  await pool.query('UPDATE characters SET gold_cp=1000000 WHERE id=$1', [hero.id]);
  const mountResponse = await context.request.post(origin + '/api/stable/purchase', {
    headers: { Origin: origin },
    data: {
      character_id: hero.id,
      mount_id: 'warhorse',
      coat: 'original',
      name: 'Cavalo',
      equipment: [],
      idempotency_key: randomUUID(),
    },
  });
  expect(mountResponse.status()).toBe(201);
  const mount = (await mountResponse.json()).mount;
  const petResponse = await context.request.post(origin + '/api/pets/purchase', {
    headers: { Origin: origin },
    data: { character_id: hero.id, pet_id: 'dog', name: 'Cachorro', idempotency_key: randomUUID() },
  });
  expect(petResponse.status()).toBe(201);
  const pet = (await petResponse.json()).pet;
  for (const [path, data] of [
    ['/stable/' + hero.id + '/display', { mount_id: mount.id }],
    ['/pets/' + hero.id + '/display', { pet_id: pet.id }],
  ] as const) {
    expect(
      (
        await context.request.put(origin + '/api' + path, { headers: { Origin: origin }, data })
      ).status(),
    ).toBe(200);
  }
  const portrait = await testArtImage(),
    token = await testTokenImage();
  const equipment = await context.request.get(origin + '/api/companions/' + hero.id + '/equipment');
  expect(equipment.status()).toBe(200);
  for (const id of [mount.id, pet.id]) {
    await pool.query(
      'INSERT INTO companion_artworks(wardrobe_id,equipment_revision,image,token_image)SELECT id,revision,$2,$3 FROM companion_wardrobes WHERE id=$1',
      [id, portrait, token],
    );
    await pool.query('UPDATE companion_wardrobes SET image_revision=1 WHERE id=$1', [id]);
  }
  await page.goto(origin + '/#characters');
  await expect.poll(() => hits).toBe(2);
  await expect(page.locator('[data-asset-loading=true]')).toBeVisible();
  await expect(page.locator('.camp-mount img,.camp-pet img')).toHaveCount(0);
  release();
  const mountImage = page.locator('.camp-mount img'),
    petImage = page.locator('.camp-pet img');
  await expect(mountImage).toBeVisible({ timeout: 60000 });
  await expect(petImage).toBeVisible();
  for (const img of [mountImage, petImage])
    expect(await img.evaluate((e: HTMLImageElement) => e.complete && e.naturalWidth > 0)).toBe(
      true,
    );
  await expect(page.locator('[data-asset-loading=true]')).toHaveCount(0);
  const firstHits = hits;
  for (let i = 0; i < 3; i++) {
    await page.goto(origin + '/#inventory');
    await expect(page.getByRole('region', { name: 'Itens equipados', exact: true })).toBeVisible({
      timeout: 60000,
    });
    await page.goto(origin + '/#characters');
    await expect(mountImage).toBeVisible({ timeout: 60000 });
    await expect(petImage).toBeVisible();
  }
  expect(hits, 'Navegar novamente não deve baixar de novo as artes da mesma revisão').toBe(
    firstHits,
  );
  await page.reload();
  await expect(mountImage).toBeVisible({ timeout: 60000 });
  await expect(petImage).toBeVisible();
  expect(hits, 'Recarregar a página reutiliza o cache HTTP privado').toBe(firstHits);
  // A real new revision must be fetched and decoded, while the old decoded art stays visible.
  hold = true;
  await pool.query('UPDATE companion_wardrobes SET image_revision=2 WHERE id=ANY($1::uuid[])', [
    [mount.id, pet.id],
  ]);
  await page.evaluate(
    (characterId) =>
      window.dispatchEvent(new CustomEvent('companion-art-updated', { detail: { characterId } })),
    hero.id,
  );
  await expect.poll(() => hits).toBe(firstHits + 2);
  await expect(mountImage).toHaveAttribute('src', /v=1$/);
  await expect(petImage).toHaveAttribute('src', /v=1$/);
  await expect(page.locator('[data-asset-loading=true]')).toHaveCount(0);
  release();
  await expect(mountImage).toHaveAttribute('src', /v=2$/);
  await expect(petImage).toHaveAttribute('src', /v=2$/);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await mkdir('test-results/camp-cache', { recursive: true });
  await page.screenshot({ path: 'test-results/camp-cache/mobile.png' });
  expect(errors).toEqual([]);
  console.log(
    'PASS: primeira abertura aguarda animais completos; navegação e reload reutilizam cache privado, revisão nova substitui após decode sem loading global; celular e privacidade preservados.',
  );
} finally {
  release();
  await browser.close();
  server.closeAllConnections();
  await new Promise<void>((r) => server.close(() => r()));
  await pool.end();
}
