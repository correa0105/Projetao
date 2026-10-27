import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { vttProtocolVersion } from '../shared/vtt-protocol';
if (!/^\/alvorada_test_[0-9a-f]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))
  throw Error('Banco descartável obrigatório.');
const origin = 'http://localhost:3093';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db'),
  { migrate } = await import('../server/migrate'),
  { seed } = await import('../server/seed');
await migrate();
await seed();
const { createApp } = await import('../server/app'),
  server = createApp().listen(3093, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));
const browser = await chromium.launch({ channel: 'msedge', headless: true }),
  ctx = await browser.newContext({
    viewport: { width: 1916, height: 988 },
    reducedMotion: 'no-preference',
    extraHTTPHeaders: { 'X-Vtt-Schema-Version': String(vttProtocolVersion) },
  }),
  page = await ctx.newPage(),
  errors: string[] = [];
await page.addInitScript('window.__name = fn => fn;');
page.on('pageerror', (e) => errors.push(e.message));
await mkdir('test-results/vtt-screen-overflow', { recursive: true });
const baseline = process.argv.includes('--baseline'),
  results: unknown[] = [];
try {
  const sign = await ctx.request.post(origin + '/api/auth/sign-up/email', {
    headers: { Origin: origin },
    data: {
      name: 'Mestre do tremor',
      email: randomUUID() + '@example.test',
      password: 'Test-' + randomUUID(),
    },
  });
  expect(sign.ok()).toBe(true);
  const made = await ctx.request.post(origin + '/api/vtt', {
    headers: { Origin: origin },
    data: { name: 'Tremor sem barras' },
  });
  expect(made.ok()).toBe(true);
  const room = await made.json(),
    path = origin + '/api/vtt/rooms/' + room.id + '/sounds';
  const command = async (data: unknown) => {
    const r = await ctx.request.post(path, { headers: { Origin: origin }, data });
    expect(r.ok(), await r.text()).toBe(true);
  };
  await page.goto(origin + '/#vtt?room=' + room.id);
  await page.getByRole('button', { name: 'Entrar no VTT', exact: true }).click();
  await expect(page.locator('.vtt-workspace')).toBeVisible({ timeout: 60000 });
  for (const width of baseline ? [1916] : [1916, 1440, 760, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 640 : 988 });
    await command({
      kind: 'screenPlay',
      settings: {
        preset: 'cave-in',
        sceneId: room.document.activeScene,
        duration: 10,
        intensity: 1,
        volume: 0,
        muted: true,
      },
    });
    await expect
      .poll(() => page.locator('.vtt-workspace').evaluate((e) => e.style.translate))
      .not.toBe('');
    const measurements = await page.evaluate(
      () =>
        new Promise<{
          rootX: number;
          rootY: number;
          toolsX: number;
          movingFrames: number;
          positions: number;
        }>((resolve) => {
          let n = 0,
            rootX = 0,
            rootY = 0,
            toolsX = 0,
            movingFrames = 0;
          const positions = new Set<string>(),
            tools = document.querySelector<HTMLElement>('.vtt-tools')!,
            work = document.querySelector<HTMLElement>('.vtt-workspace')!;
          const sample = () => {
            rootX = Math.max(rootX, document.documentElement.scrollWidth - innerWidth);
            rootY = Math.max(rootY, document.documentElement.scrollHeight - innerHeight);
            toolsX = Math.max(toolsX, tools.scrollWidth - tools.clientWidth);
            if (work.style.translate) {
              movingFrames++;
              positions.add(work.style.translate);
            }
            if (++n < 100) requestAnimationFrame(sample);
            else resolve({ rootX, rootY, toolsX, movingFrames, positions: positions.size });
          };
          sample();
        }),
    );
    results.push({ width, ...measurements });
    await page.screenshot({
      path: `test-results/vtt-screen-overflow/${baseline ? 'before' : 'after'}-${width}.png`,
    });
    await command({ kind: 'screenStop' });
    await expect
      .poll(() => page.locator('.vtt-workspace').evaluate((e) => e.style.translate))
      .toBe('');
    if (!baseline) {
      expect(measurements.rootX).toBeLessThanOrEqual(0);
      expect(measurements.rootY).toBeLessThanOrEqual(0);
      expect(measurements.toolsX).toBeLessThanOrEqual(1);
      expect(await page.locator('.vtt-tools').evaluate((e) => getComputedStyle(e).overflowX)).toBe(
        'hidden',
      );
      expect(measurements.positions).toBeGreaterThan(10);
    }
  }
  if (!baseline) {
    const tools = page.locator('.vtt-tools');
    const scroll = await tools.evaluate((e) => {
      e.scrollTop = 80;
      return { top: e.scrollTop, needed: e.scrollHeight > e.clientHeight };
    });
    expect(scroll.needed).toBe(true);
    expect(scroll.top).toBeGreaterThan(0);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await command({
      kind: 'screenPlay',
      settings: {
        preset: 'cave-in',
        sceneId: room.document.activeScene,
        duration: 5,
        intensity: 1,
        volume: 0,
        muted: true,
      },
    });
    await expect(page.locator('[data-screen-effect="cave-in"]')).toBeAttached();
    await page.waitForTimeout(400);
    expect(await page.locator('.vtt-workspace').evaluate((e) => e.style.translate)).toBe('');
    await command({ kind: 'screenStop' });
    await page.goto(origin + '/#overview');
    await expect(page.getByRole('heading', { name: 'O Diário da Alvorada' })).toBeVisible();
    expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe('hidden');
  }
  expect(errors).toEqual([]);
  await writeFile(
    `test-results/vtt-screen-overflow/${baseline ? 'baseline' : 'result'}.json`,
    JSON.stringify({ passed: !baseline, results, errors }, null, 2),
  );
  console.log(JSON.stringify({ baseline, results }));
} finally {
  await browser.close();
  await new Promise<void>((r) => server.close(() => r()));
  await pool.end();
}
