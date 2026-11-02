import 'dotenv/config';
import express from 'express';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
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
const app = express(),
  client = resolve('.local/basic-armor-client-20261102');
app.get('/', (_req, res) => res.sendFile(resolve(client, 'index.html'), { dotfiles: 'allow' }));
app.use('/assets', express.static(resolve(client, 'assets')));
app.use(express.static(resolve('public')));
app.use(createApp());
const server = app.listen(3026, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));
const browser = await chromium.launch({ channel: 'msedge', headless: true }),
  context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await context.addInitScript('window.__name = (fn) => fn;');
const page = await context.newPage(),
  root = '.local/basic-armor-20261102';
await mkdir(root, { recursive: true });
const errors: string[] = [],
  checks: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
try {
  const signup = await context.request.post(origin + '/api/auth/sign-up/email', {
    headers: { Origin: origin },
    data: {
      name: 'Armaduras e chave',
      email: 'armor-ui-' + randomUUID() + '@example.test',
      password: 'Test-' + randomUUID(),
    },
  });
  expect(signup.ok()).toBe(true);
  await createLegacyTestCharacter((await signup.json()).user.id, 'Arden');
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(origin + '/#shop');
    const search = page.getByRole('textbox', { name: 'Procurar item' });
    await expect(search).toBeVisible();
    await page
      .getByRole('navigation', { name: 'Categorias da loja' })
      .getByRole('button', { name: /^Armaduras\b/ })
      .click();
    for (const [id, name, po, weight, partial] of [
      ['breastplate', 'Peitoral', '700', '20', true],
      ['half-plate-armor', 'Meia armadura de placas', '1.100', '40', true],
      ['splint-armor', 'Armadura de talas', '1.200', '60', false],
      ['plate-armor', 'Armadura de placas', '1.500', '65', false],
    ] as const) {
      await search.fill(name);
      const card = page.locator(`.shop-product[data-item-id="${id}"]`);
      await expect(card).toBeVisible();
      await card.scrollIntoViewIfNeeded();
      await expect(card.locator('.shop-price')).toContainText(po + ' PO');
      await expect(card).toContainText(weight + ' lb');
      if (partial) {
        await expect(card).toContainText('Peça única de armadura');
        await expect(card).not.toContainText('Conjunto completo');
        await expect(card).not.toContainText('Peso do conjunto');
      } else await expect(card).toContainText('Conjunto completo com 6 peças');
      await card
        .locator('img')
        .first()
        .evaluate(async (el) => {
          await (el as HTMLImageElement).decode();
        });
      await card.screenshot({ path: root + `/${id}-${width}.png` });
    }
    await page
      .getByRole('navigation', { name: 'Categorias da loja' })
      .getByRole('button', { name: /^Todos\b/ })
      .click();
    await search.fill('Chave de vínculo');
    const key = page.locator('.shop-product[data-item-id="keycharm"]');
    await expect(key).toBeVisible();
    await key.scrollIntoViewIfNeeded();
    const img = key.locator('img').first();
    await expect(img).toHaveAttribute(
      'src',
      '/shop/magic-completion-20261009/keycharm-straight-20261102.webp',
    );
    const size = await img.evaluate(async (el) => {
      const image = el as HTMLImageElement;
      await image.decode();
      return { width: image.naturalWidth, height: image.naturalHeight };
    });
    expect(size).toEqual({ width: 512, height: 768 });
    await key.screenshot({ path: root + `/keycharm-${width}.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    checks.push(
      `Preços, duas peças parciais, talas/placas completas e chave reta com transparência em ${width} px`,
    );
  }
  expect(errors).toEqual([]);
  await writeFile(root + '/result.json', JSON.stringify({ passed: true, checks, errors }, null, 2));
  console.log(JSON.stringify({ passed: true, checks }));
} catch (e) {
  await page.screenshot({ path: root + '/failure.png' });
  throw e;
} finally {
  await browser.close();
  await new Promise<void>((r) => server.close(() => r()));
  await pool.end();
}
