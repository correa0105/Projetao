import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { mounts } from '../shared/mounts.js';
import { pets } from '../shared/pets.js';

if (!/^\/alvorada_test_[0-9a-f]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))
  throw Error('Banco isolado obrigatório.');
const origin = 'http://localhost:3015';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db.js');
const { migrate } = await import('../server/migrate.js');
const { seed } = await import('../server/seed.js');
const { createLegacyTestCharacter } = await import('../tests/character-fixtures.js');
await migrate();
await seed();
const { createApp } = await import('../server/app.js');
const server = createApp().listen(3015, '127.0.0.1');
await new Promise<void>((resolve) => server.once('listening', resolve));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  reducedMotion: 'reduce',
});
const page = await context.newPage();
const errors: string[] = [],
  purchases: { url: string; name: string }[] = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('request', (request) => {
  if (request.method() === 'POST' && /\/api\/(stable|pets)\/purchase$/.test(request.url()))
    purchases.push({ url: request.url(), name: request.postDataJSON().name });
});
await mkdir('test-results', { recursive: true });
try {
  await context.addInitScript(() => {
    localStorage.setItem('alvorada-music-muted', 'true');
    localStorage.setItem('alvorada-effects-muted', 'true');
  });
  const signup = await context.request.post(origin + '/api/auth/sign-up/email', {
    headers: { Origin: origin },
    data: {
      name: 'Viajante dos companheiros',
      email: `animal-browser-${randomUUID()}@example.test`,
      password: `Test-${randomUUID()}`,
    },
  });
  expect(signup.ok()).toBe(true);
  const hero = await createLegacyTestCharacter((await signup.json()).user.id, 'Aurora');
  await pool.query('UPDATE characters SET gold_cp=100000 WHERE id=$1', [hero.id]);
  const snapshot = async (table: 'character_mounts' | 'character_pets') => ({
    gold: (await pool.query('SELECT gold_cp FROM characters WHERE id=$1', [hero.id])).rows[0]
      .gold_cp as number,
    animals: (
      await pool.query(`SELECT id,name FROM ${table} WHERE character_id=$1 ORDER BY id`, [hero.id])
    ).rows,
  });
  for (const width of [1440, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const kind of ['pets', 'stable'] as const) {
      await page.goto(`${origin}/#${kind}`);
      await expect(page.locator(kind === 'pets' ? '.pet-shop' : '.stable-page')).toBeVisible();
      const field = page.getByLabel('Como vai se chamar?', { exact: true });
      const button = page.getByRole('button', {
        name: kind === 'pets' ? 'Levar este companheiro' : 'Comprar conjunto',
        exact: true,
      });
      const table = kind === 'pets' ? 'character_pets' : 'character_mounts';
      const before = await snapshot(table);
      const requestCount = purchases.length;
      await expect(field).toHaveValue('');
      await expect(field).toHaveAttribute('required', '');
      await expect(button).toBeDisabled();
      await field.fill('   ');
      await expect(button).toBeDisabled();
      await field.press('Enter');
      await expect(page.getByRole('dialog', { name: 'Levar um novo companheiro' })).toHaveCount(0);
      expect(purchases.length).toBe(requestCount);
      expect(await snapshot(table)).toEqual(before);
      await field.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `test-results/animal-name-${kind}-${width}.png` });
      const name = kind === 'pets' ? `Brasa ${width}` : `Passo Firme ${width}`;
      await field.fill(`  ${name}  `);
      await expect(button).toBeEnabled();
      if (kind === 'stable') {
        await button.click();
        const confirm = page.getByRole('dialog', { name: 'Levar um novo companheiro' });
        await expect(confirm).toContainText(name);
        const [response] = await Promise.all([
          page.waitForResponse(
            (response) =>
              response.url().endsWith('/api/stable/purchase') &&
              response.request().method() === 'POST',
          ),
          confirm.getByRole('button', { name: 'Confirmar compra', exact: true }).click(),
        ]);
        expect(response.status()).toBe(201);
        await expect(confirm).toHaveCount(0);
      } else {
        const [response] = await Promise.all([
          page.waitForResponse(
            (response) =>
              response.url().endsWith('/api/pets/purchase') &&
              response.request().method() === 'POST',
          ),
          button.click(),
        ]);
        expect(response.status()).toBe(201);
        await expect(page.locator('.pet-shop-notice')).toContainText(name);
      }
      expect(purchases).toHaveLength(requestCount + 1);
      expect(purchases.at(-1)!.name).toBe(name);
      const after = await snapshot(table);
      expect(after.animals).toHaveLength(before.animals.length + 1);
      expect(after.animals.some((animal) => animal.name === name)).toBe(true);
      const price = kind === 'pets' ? pets[0].price_cp : mounts[0].price_cp;
      expect(after.gold).toBe(before.gold - price);
      const saved = await context.request.get(`${origin}/api/${kind}/${hero.id}`);
      expect(saved.ok()).toBe(true);
      expect((await saved.json()).some((animal: { name: string }) => animal.name === name)).toBe(
        true,
      );
      await page.screenshot({ path: `test-results/animal-name-${kind}-${width}-purchased.png` });
    }
  }
  expect(errors).toEqual([]);
  console.log(
    'Nomes obrigatórios: mascotes e Estábulo bloqueiam vazio/espaços sem pedido/débito; nomes próprios compram e persistem em 1440/320.',
  );
} finally {
  await browser.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.end();
}
