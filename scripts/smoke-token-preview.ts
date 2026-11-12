import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID, createHash } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { createServer } from 'node:net';
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
await migrate();
await seed();
const { createApp } = await import('../server/app');
const server = createApp().listen(port, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));
const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL || 'msedge',
  headless: true,
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 960 },
  reducedMotion: 'reduce',
});
const page = await context.newPage();
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
const hash = (b: Buffer) => createHash('sha256').update(b).digest('hex');
await mkdir('test-results/token-preview', { recursive: true });
try {
  const signup = await context.request.post(origin + '/api/auth/sign-up/email', {
    headers: { Origin: origin },
    data: {
      name: 'Prévia do token',
      email: randomUUID() + '@example.test',
      password: 'Test-' + randomUUID(),
    },
  });
  expect(signup.status()).toBe(200);
  const uid = (await signup.json()).user.id;
  const { createLegacyTestCharacter, testArtImage, testTokenImage } =
    await import('../tests/character-fixtures');
  const first = await createLegacyTestCharacter(uid, 'Aurora'),
    second = await createLegacyTestCharacter(uid, 'Bruma');
  const portrait = await testArtImage(),
    token = await testTokenImage();
  for (const c of [first, second]) {
    await pool.query('INSERT INTO character_portraits(character_id,image)VALUES($1,$2)', [
      c.id,
      portrait,
    ]);
    await pool.query('UPDATE characters SET portrait_revision=1 WHERE id=$1', [c.id]);
  }
  await pool.query('INSERT INTO character_tokens(character_id,image)VALUES($1,$2)', [
    first.id,
    token,
  ]);
  const privateImage = await context.request.get(
    origin + `/api/characters/${first.id}/token?preview=1&v=1`,
  );
  expect(privateImage.status()).toBe(200);
  expect(hash(await privateImage.body())).toBe(hash(token));
  expect(
    (await context.request.get(origin + `/api/characters/${second.id}/token?preview=1`)).status(),
  ).toBe(404);
  expect((await context.request.get(origin + `/api/characters/${second.id}/token`)).status()).toBe(
    200,
  );
  const outsider = await browser.newContext();
  expect(
    (await outsider.request.get(origin + `/api/characters/${first.id}/token?preview=1`)).status(),
  ).toBe(401);
  await outsider.request.post(origin + '/api/auth/sign-up/email', {
    headers: { Origin: origin },
    data: {
      name: 'Outra conta',
      email: randomUUID() + '@example.test',
      password: 'Test-' + randomUUID(),
    },
  });
  expect(
    (await outsider.request.get(origin + `/api/characters/${first.id}/token?preview=1`)).status(),
  ).toBe(404);
  await outsider.close();
  await context.request.put(origin + '/api/tutorials/characters', { data: { dismissed: true } });
  await context.request.put(origin + '/api/tutorials/inventory', { data: { dismissed: true } });
  await page.goto(origin + '/#characters');
  await expect(page.locator('.character-token-preview-trigger')).toHaveCount(0);
  await page.getByRole('button', { name: 'Selecionar Aurora', exact: true }).click();
  let preview = page.getByRole('dialog', { name: 'Token de Aurora', exact: true });
  await expect(preview.getByRole('img')).toBeVisible();
  expect(
    await preview
      .getByRole('img')
      .evaluate((img: HTMLImageElement) => [img.naturalWidth, img.naturalHeight]),
  ).toEqual([512, 512]);
  await page.screenshot({ path: 'test-results/token-preview/desktop.png' });
  await page.keyboard.press('Escape');
  await expect(preview).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Selecionar Aurora', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Selecionar Bruma', exact: true }).click();
  preview = page.getByRole('dialog', { name: 'Token de Bruma', exact: true });
  await expect(preview).toContainText('quando a arte estiver pronta');
  await expect(preview.getByRole('img')).toHaveCount(0);
  await preview.getByRole('button', { name: 'Fechar', exact: true }).click();
  await pool.query('INSERT INTO character_tokens(character_id,image)VALUES($1,$2)', [
    second.id,
    token,
  ]);
  await pool.query('UPDATE characters SET portrait_revision=2 WHERE id=$1', [second.id]);
  await page.reload();
  await page.getByRole('button', { name: 'Selecionar Bruma', exact: true }).click();
  await expect(preview.getByRole('img')).toHaveAttribute('src', /v=2$/);
  await preview.getByRole('button', { name: 'Fechar', exact: true }).click();
  await page.goto(origin + '/#inventory');
  await expect(page.locator('.character-token-preview-trigger')).toHaveCount(0);
  await page.getByRole('button', { name: 'Ver token de Bruma no VTT', exact: true }).click();
  await expect(preview.getByRole('img')).toBeVisible();
  await preview.getByRole('button', { name: 'Fechar', exact: true }).click();
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    reducedMotion: 'reduce',
    storageState: await context.storageState(),
  });
  const touch = await mobile.newPage();
  touch.on('pageerror', (e) => errors.push(e.message));
  await touch.goto(origin + '/#characters');
  await touch.getByRole('button', { name: 'Selecionar Aurora', exact: true }).tap();
  const touchPreview = touch.getByRole('dialog', { name: 'Token de Aurora', exact: true });
  await expect(touchPreview.getByRole('img')).toBeVisible();
  for (const width of [390, 320]) {
    await touch.setViewportSize({ width, height: 844 });
    const box = await touchPreview.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    expect(await touch.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  await touch.screenshot({ path: 'test-results/token-preview/mobile-320.png' });
  await touchPreview.getByRole('button', { name: 'Fechar', exact: true }).tap();
  await expect(touchPreview).toHaveCount(0);
  await mobile.close();
  expect(errors).toEqual([]);
  console.log(
    'PASS: token real e privado ao clicar no personagem, sem botão flutuante, Escape/foco/toque, troca de personagem/revisão e celular 390/320.',
  );
} finally {
  await browser.close();
  server.closeAllConnections();
  await new Promise<void>((r) => server.close(() => r()));
  await pool.end();
}
