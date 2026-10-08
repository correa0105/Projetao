import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
if (!/^\/alvorada_test_[0-9a-f]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))
  throw Error('Disposable database required');
const origin = 'http://localhost:3048';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db'),
  { migrate } = await import('../server/migrate'),
  { seed } = await import('../server/seed'),
  { createLegacyTestCharacter } = await import('../tests/character-fixtures');
await migrate();
await seed();
const { createApp } = await import('../server/app'),
  server = createApp().listen(3048, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));
const browser = await chromium.launch({ channel: 'msedge', headless: true }),
  context = await browser.newContext({ viewport: { width: 1440, height: 1000 } }),
  page = await context.newPage();
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
try {
  const response = await context.request.post(origin + '/api/auth/sign-up/email', {
    headers: { Origin: origin },
    data: {
      name: 'Viajante da Alvorada',
      email: randomUUID() + '@example.test',
      password: 'Test-' + randomUUID(),
    },
  });
  expect(response.status()).toBe(200);
  const user = (await response.json()).user;
  const character = await createLegacyTestCharacter(user.id, 'Ariane');
  await context.request.get(origin + '/api/profiles/' + encodeURIComponent(user.id));
  await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [user.id]);
  const paths = process.env.PAGE_REVIEW_ROUTE
    ? [process.env.PAGE_REVIEW_ROUTE]
    : ['character-cards', 'hall', 'profiles', 'events', 'tower', 'cards'];
  await mkdir('test-results/page-consistency', { recursive: true });
  const report = [];
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of paths) {
      await page.goto(origin + '/#' + route);
      await expect(page.locator('.app-shell')).toHaveAttribute('data-page', route);
      await expect(page.locator('.page-header h1')).toBeVisible();
      const selectors: Record<string, string> = {
        'character-cards': '.character-card-collection',
        hall: '.hall-heading',
        profiles: '.profiles-directory-heading',
        events: '.events-content',
        tower: '.tower-floor',
        cards: '.cards-catalog',
      };
      await expect(page.locator(selectors[route])).toBeVisible();
      if (route === 'hall') await expect(page.locator('.hall-table-row')).toHaveCount(1);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(200);
      const geometry = await page.evaluate(() => {
        const heading = document.querySelector('.page-header h1')!,
          style = getComputedStyle(heading),
          box = heading.getBoundingClientRect();
        return {
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
          font: style.fontFamily,
          size: style.fontSize,
          x: box.x,
          y: box.y,
          width: box.width,
        };
      });
      if (geometry.overflow) {
        const outside = await page.evaluate(() =>
          [...document.querySelectorAll<HTMLElement>('*')]
            .filter((el) => {
              const b = el.getBoundingClientRect();
              return b.width && b.right > innerWidth + 1 && b.left >= 0;
            })
            .map((el) => ({
              tag: el.tagName,
              cls: el.className,
              width: el.getBoundingClientRect().width,
              left: el.getBoundingClientRect().left,
              text: el.textContent?.slice(0, 70),
            }))
            .slice(-20),
        );
        await writeFile(
          'test-results/page-consistency/overflow-' + route + '-' + width + '.json',
          JSON.stringify(outside, null, 2),
        );
        await page.screenshot({
          path: 'test-results/page-consistency/overflow-' + route + '-' + width + '.png',
          fullPage: true,
        });
      }
      expect(geometry.overflow, route + ' ' + width).toBe(false);
      expect(geometry.font).toContain('Cinzel');
      report.push({ route, viewport: width, ...geometry });
      await page.screenshot({
        path: 'test-results/page-consistency/' + route + '-' + width + '.png',
        fullPage: width === 1440,
      });
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(
    origin + '/#profiles?user=' + encodeURIComponent(user.id) + '&character=' + character.id,
  );
  await expect(page.locator('.profiles-page.visiting')).toBeVisible();
  await page.screenshot({ path: 'test-results/page-consistency/profile-visit-1440.png' });
  expect(errors).toEqual([]);
  await writeFile('test-results/page-consistency/report.json', JSON.stringify(report, null, 2));
  console.log(
    'PASS six pages, shared Cinzel header, no overflow at 320/390/768/1440; profile visit preserved',
  );
} finally {
  await browser.close();
  await new Promise<void>((r) => server.close(() => r()));
  await pool.end();
}
