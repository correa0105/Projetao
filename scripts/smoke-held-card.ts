import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import express from 'express';
import { resolve } from 'node:path';

if (!/^\/alvorada_test_[0-9a-f]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))
  throw Error('Banco descartável obrigatório.');
const origin = 'http://localhost:3026';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db.js');
const { migrate } = await import('../server/migrate.js');
const { seed } = await import('../server/seed.js');
const { createLegacyTestCharacter } = await import('../tests/character-fixtures.js');
await migrate();
await seed();
const { createApp } = await import('../server/app.js');
const client = resolve(process.env.CARDS_CLIENT_DIR || '.local/cards-held-client-20261031');
const app = express();
app.get('/', (_req, res) => res.sendFile(resolve(client, 'index.html'), { dotfiles: 'allow' }));
app.use('/assets', express.static(resolve(client, 'assets')));
app.use(express.static(resolve('public')));
app.use(createApp());
const server = app.listen(3026, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: 'no-preference',
});
await context.addInitScript('window.__name = (fn) => fn;');
await context.addInitScript(() => {
  localStorage.setItem('alvorada-music-volume', '.23');
  localStorage.setItem('alvorada-music-muted', 'false');
  localStorage.setItem('alvorada-effects-volume', '.31');
  localStorage.setItem('alvorada-effects-muted', 'false');
});
const page = await context.newPage();
const root = process.env.CARDS_QA_DIR || '.local/cards-held-eye-20261031';
const errors: string[] = [],
  missing: string[] = [],
  writes: string[] = [],
  checks: string[] = [];
await mkdir(root, { recursive: true });
page.on('pageerror', (e) => errors.push(e.message));
page.on('response', (r) => {
  if (r.status() >= 400 && /\/(cards|audio)\//.test(new URL(r.url()).pathname))
    missing.push(r.url());
});
page.on('request', (r) => {
  if (r.url().includes('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(r.method()))
    writes.push(new URL(r.url()).pathname);
});
async function talk() {
  const b = (await page.locator('.cards-room').boundingBox())!,
    mobile = b.width <= 900;
  const width = mobile ? 1024 : 1672,
    height = mobile ? 1536 : 941,
    scale = Math.max(b.width / width, b.height / height);
  await page.mouse.click(
    b.x + (b.width - width * scale) / 2 + (mobile ? 650 : 1050) * scale,
    b.y + (b.height - height * scale) / 2 + (mobile ? 395 : 230) * scale,
  );
  await expect(page.locator('.cards-host-dialogue')).toBeVisible();
}
try {
  const signup = await context.request.post(origin + '/api/auth/sign-up/email', {
    headers: { Origin: origin },
    data: {
      name: 'Carta na mão',
      email: 'held-' + randomUUID() + '@example.test',
      password: 'Test-' + randomUUID(),
    },
  });
  expect(signup.ok()).toBe(true);
  await createLegacyTestCharacter((await signup.json()).user.id, 'Bruma');
  writes.length = 0;
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto(origin + '/#cards');
    await expect(page.locator('.cards-room')).toBeVisible();
    await expect(page.locator('[data-asset-loading]')).toHaveCount(0, { timeout: 20000 });
    await talk();
    await page
      .getByRole('button', { name: 'O que você procura nessas cartas?', exact: true })
      .click();
    const held = page.locator('.cards-held-card');
    await expect(held).toHaveCount(1);
    await expect(held).toHaveAttribute('data-view', width > 900 ? 'desktop' : 'mobile');
    await expect(held.locator('.arcana-back-paper')).toHaveAttribute(
      'src',
      '/cards/arcana-emblems-20261028/back-gothic-20261028.png',
    );
    await expect(held.locator('.arcana-back-eye image')).toHaveAttribute(
      'href',
      '/cards/arcana-emblems-20261028/eye.png',
    );
    await held.evaluate(async (el) => {
      await Promise.all([...el.querySelectorAll('img')].map((i) => i.decode()));
      el.getAnimations({ subtree: true }).forEach((a) => {
        a.pause();
        a.currentTime = 0;
      });
    });
    const lid = held.locator('.arcana-eye-lid');
    const opened = await lid.evaluate((el) => getComputedStyle(el).d);
    await page.screenshot({ path: root + '/held-card-open-' + width + '.png' });
    await held
      .locator('.cards-held-card-projection')
      .screenshot({ path: root + '/held-detail-open-' + width + '.png' });
    await held.evaluate((el) =>
      el.getAnimations({ subtree: true }).forEach((a) => (a.currentTime = 6550)),
    );
    expect(await lid.evaluate((el) => getComputedStyle(el).d)).not.toBe(opened);
    await held
      .locator('.cards-held-card-projection')
      .screenshot({ path: root + '/held-detail-closed-' + width + '.png' });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(lid).toHaveCSS('animation-name', 'none');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect(page.locator('.cards-host-pose')).toHaveAttribute('data-motion', 'off');
    await expect(lid).toHaveCSS('animation-name', 'none');
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.getByRole('button', { name: 'Quem é você?', exact: true }).click();
    await expect(held).toHaveCount(0);
    await page.getByRole('button', { name: 'Encerrar conversa', exact: true }).click();
    await expect(held).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    checks.push(
      'Verso aprovado na mão, dedos em primeiro plano, piscar, movimento reduzido, visibilidade e retirada na troca/fechamento em ' +
        width +
        ' px',
    );
  }
  expect(errors).toEqual([]);
  expect(missing).toEqual([]);
  expect(writes.filter((path) => /cards|tower|events/.test(path))).toEqual([]);
  await writeFile(
    root + '/result.json',
    JSON.stringify({ passed: true, checks, errors, missing, writes }, null, 2),
  );
  console.log(JSON.stringify({ passed: true, checks }));
} catch (error) {
  await page.screenshot({ path: root + '/failure.png' });
  throw error;
} finally {
  await browser.close();
  await new Promise<void>((r) => server.close(() => r()));
  await pool.end();
}
