import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
if (!new URL(process.env.DATABASE_URL!).pathname.startsWith('/alvorada_test_'))
  throw new Error('Banco isolado obrigatório.');
const origin = 'http://localhost:3002';
process.env.APP_ORIGIN = origin;
process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db.js');
const { migrate } = await import('../server/migrate.js');
const { seed } = await import('../server/seed.js');
await migrate();
await seed();
const { createApp } = await import('../server/app.js');
const server = createApp().listen(3002, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));
const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL || 'msedge',
  headless: true,
  args:
    process.env.ATLAS_BROWSER_GPU === '1'
      ? []
      : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: 'no-preference',
});
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (message) => {
  if (message.type() === 'error' && /THREE|WebGL|shader|GL_INVALID/i.test(message.text()))
    errors.push(message.text());
});
try {
  await mkdir('test-results', { recursive: true });
  await page.goto(origin);
  const signup = await page.request.post(origin + '/api/auth/sign-up/email', {
    headers: { Origin: origin },
    data: {
      name: 'Teste frota',
      email: `fleet-${randomUUID()}@example.test`,
      password: `Test-${randomUUID()}`,
    },
  });
  expect(signup.ok()).toBe(true);
  await page.goto(origin + '/#world');
  await page.reload();
  const map = page.locator('.world-map__viewport');
  await expect(map).toHaveAttribute('data-status', 'ready', { timeout: 40000 });
  await expect(map).toHaveAttribute('data-ship-count', '8');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'test-results/fleet-overview.png' });
  // Keep a view of the complete sea until the first real-time attack begins.
  await expect(map).toHaveAttribute('data-kraken-active', 'true', { timeout: 50000 });
  await page.waitForTimeout(2400);
  await page.screenshot({ path: 'test-results/fleet-kraken.png' });
  await page.waitForTimeout(1900);
  await page.screenshot({ path: 'test-results/fleet-wreckage.png' });
  await expect(map).toHaveAttribute('data-kraken-phase', 'submerging', { timeout: 6000 });
  const depth = Number(await map.getAttribute('data-kraken-depth'));
  await page.waitForTimeout(1700);
  expect(Number(await map.getAttribute('data-kraken-depth'))).toBeLessThan(depth);
  await page.screenshot({ path: 'test-results/fleet-kraken-descent.png' });
  await expect(map).toHaveAttribute('data-kraken-active', 'false', { timeout: 3000 });
  const attacks = await map.getAttribute('data-kraken-attacks');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForTimeout(1200);
  expect(await map.getAttribute('data-kraken-attacks')).toBe(attacks);
  expect(errors).toEqual([]);
  console.log(
    'Frota: oito barcos em 3D, ataque real após 30 s, afundamento, recuperação e movimento reduzido aprovados.',
  );
} catch (error) {
  await page.screenshot({ path: 'test-results/fleet-failure.png' });
  throw error;
} finally {
  await browser.close();
  await new Promise<void>((r) => server.close(() => r()));
  await pool.end();
}
