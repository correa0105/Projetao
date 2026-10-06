import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
if (!new URL(process.env.DATABASE_URL!).pathname.startsWith('/alvorada_test_'))
  throw Error('Banco isolado obrigatório.');
const origin = 'http://localhost:3008';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db.js'),
  { migrate } = await import('../server/migrate.js'),
  { seed } = await import('../server/seed.js'),
  { createLegacyTestCharacter } = await import('../tests/character-fixtures.js');
await migrate();
await seed();
const { createApp } = await import('../server/app.js');
const server = createApp().listen(3008, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({
  viewport: { width: 1755, height: 1000 },
  reducedMotion: 'reduce',
});
const page = await context.newPage(),
  errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
await mkdir('test-results', { recursive: true });
try {
  const signup = await context.request.post(origin + '/api/auth/sign-up/email', {
    headers: { Origin: origin },
    data: {
      name: 'Viajante do Empório',
      email: `emporium-${randomUUID()}@example.test`,
      password: `Test-${randomUUID()}`,
    },
  });
  expect(signup.ok()).toBe(true);
  const hero = await createLegacyTestCharacter((await signup.json()).user.id, 'Aurora');
  await pool.query('UPDATE characters SET gold_cp=500000 WHERE id=$1', [hero.id]);
  await page.goto(origin + '/#shop');
  await expect(page.locator('.shop-scene')).toBeVisible();
  await expect(page.locator('.house-emporium-link')).toHaveCount(0);
  await page.getByRole('button', { name: /^Itens de House/ }).click();
  await expect(page.locator('.shop-product')).toHaveCount(12);
  for (const width of [1755, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    const boxes = await page.locator('.shop-showcase > *').evaluateAll((nodes) =>
      nodes.map((n) => {
        const r = n.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, right: r.right };
      }),
    );
    expect(boxes).toHaveLength(2);
    expect(boxes[1].width).toBeGreaterThan(width > 1100 ? 400 : 200);
    if (width > 1100) expect(boxes[1].x).toBeGreaterThanOrEqual(boxes[0].right);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.locator('.shop-product img').evaluateAll(imgs => imgs.forEach(i => { (i as HTMLImageElement).loading = 'eager'; }));
    await expect
      .poll(() =>
        page
          .locator('.shop-product img')
          .evaluateAll((imgs) =>
            imgs.every(
              (i) => (i as HTMLImageElement).complete && (i as HTMLImageElement).naturalWidth > 0,
            ),
          ),
      )
      .toBe(true);
    await page.screenshot({ path: `test-results/emporium-house-${width}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 1755, height: 1000 });
  const letters = page.locator('.shop-product').filter({ hasText: 'Carta Selada' });
  await letters.getByRole('button', { name: /Comprar/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Carta Selada' });
  await dialog.getByLabel('Assunto').fill('Lembrança da estrada');
  await dialog.getByLabel('Sua carta').fill('Que sua próxima jornada encontre um porto seguro.');
  await dialog.getByRole('button', { name: 'Comprar por 10 PO' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('status').filter({ hasText: 'Compra guardada' })).toBeVisible();
  const { rows } = await pool.query(
    "SELECT content FROM house_items WHERE character_id=$1 AND catalog_id='letter'",
    [hero.id],
  );
  expect(rows).toHaveLength(1);
  expect(rows[0].content.title).toBe('Lembrança da estrada');
  expect(
    Number(
      (await pool.query('SELECT gold_cp FROM characters WHERE id=$1', [hero.id])).rows[0].gold_cp,
    ),
  ).toBe(499000);
  await page.getByRole('button', { name: /^Itens mundanos/ }).click();
  await expect(page.locator('.shop-product').first()).toBeVisible();
  expect(errors).toEqual([]);
  console.log(
    'Empório: grade em quatro larguras, 12 itens de House nas prateleiras e compra de carta auditada aprovados.',
  );
} finally {
  await browser.close();
  await new Promise<void>((r) => server.close(() => r()));
  await pool.end();
}
