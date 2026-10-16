import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
if (!/^\/alvorada_test_[0-9a-f]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))
  throw Error('Disposable DB required');
const origin = 'http://localhost:3081';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db');
const { migrate } = await import('../server/migrate');
const { seed } = await import('../server/seed');
const { createLegacyTestCharacter } = await import('../tests/character-fixtures');
await migrate();
await seed();
const { auth } = await import('../server/auth');
const { createApp } = await import('../server/app');
process.env.NODE_ENV = 'production';
const server = createApp().listen(3081, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const owner = await browser.newContext({
    viewport: { width: 1440, height: 960 },
    reducedMotion: 'reduce',
  }),
  stranger = await browser.newContext();
const errors: string[] = [],
  checks: string[] = [];
const page = await owner.newPage();
page.on('pageerror', (e) => errors.push(e.message));
await owner.addInitScript(() => {
  localStorage.setItem('alvorada-music-muted', 'true');
  localStorage.setItem('alvorada-effects-muted', 'true');
});
async function signup(context: typeof owner, name: string) {
  const r = await auth.api.signUpEmail({
    body: { name, email: randomUUID() + '@example.test', password: 'Testing-' + randomUUID() },
    returnHeaders: true,
  });
  for (const cookie of r.headers.getSetCookie()) {
    const first = cookie.split(';')[0],
      at = first.indexOf('=');
    await context.addCookies([
      {
        name: first.slice(0, at),
        value: first.slice(at + 1),
        url: origin,
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);
  }
  return r.response.user;
}
async function api(context: typeof owner, path: string, method = 'GET', data?: unknown) {
  const r = await context.request.fetch(origin + '/api' + path, {
    method,
    headers: { Origin: origin },
    data,
  });
  expect(r.ok(), await r.text()).toBe(true);
  return r.json();
}
async function shot(name: string, width = 1440) {
  await page.setViewportSize({ width, height: 960 });
  await page.waitForTimeout(140);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2),
    name + ' overflow',
  ).toBe(true);
  await page.screenshot({
    path: `test-results/hall-exhibition/${name}-${width}.png`,
    fullPage: true,
  });
}
async function panel(name: string) {
  await expect(page.getByRole('complementary', { name, exact: true })).toBeVisible();
}
await mkdir('test-results/hall-exhibition', { recursive: true });

try {
  const user = await signup(owner, 'Exposição QA'),
    guest = await signup(stranger, 'Visitante QA');
  const heroes = [
    await createLegacyTestCharacter(user.id, 'Irineu'),
    await createLegacyTestCharacter(user.id, 'Cheratico'),
    await createLegacyTestCharacter(guest.id, 'Nana'),
  ];
  for (const [i, c] of heroes.entries())
    await pool.query('UPDATE characters SET level=$2 WHERE id=$1', [c.id, i + 1]);
  if (process.env.HALL_QA_PORTRAITS_DIR)
    for (const [i,c] of heroes.entries())
      await pool.query('INSERT INTO character_portraits(character_id,image) VALUES($1,$2)',
        [c.id,await readFile(process.env.HALL_QA_PORTRAITS_DIR+'/'+i+'.webp')]);
  await page.goto(origin + '/#hall');
  await expect(page.locator('.hall-champion')).toHaveCount(3);
  await page.evaluate(async()=>{
    const scene=document.querySelector('.hall-exhibition-scene')!;
    const src=getComputedStyle(scene).backgroundImage.match(/url\(["']?([^"')]+)/)![1];
    const image=new Image();image.src=src;await image.decode();
  });
  await page.locator('.hall-character-art img').evaluateAll(async imgs=>{
    await Promise.all(imgs.map(img=>(img as HTMLImageElement).decode()));
  });
  const results: {width:number;height:number;embedded:boolean;metrics:{rank:number;x:number;foot:number}[]}[] = [];
  async function alignment(width: number, height: number, embedded = false) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(100);
    const metrics = await page.locator('.hall-exhibition-scene').evaluate((el) => {
      const s = el.getBoundingClientRect();
      return [...el.querySelectorAll('.hall-champion')].map((c) => {
        const r = c.querySelector('.hall-character-art')!.getBoundingClientRect();
        return {
          rank: c.classList.contains('place-1') ? 1 : c.classList.contains('place-2') ? 2 : 3,
          x: (r.x + r.width / 2 - s.x) / s.width,
          foot: (r.bottom - s.y) / s.height,
        };
      });
    });
    for (const m of metrics) {
      expect(
        Math.abs(
          m.x - ({ 1: 0.4994, 2: 0.2362, 3: 0.7638 } as Record<number, number>)[m.rank],
        ),
      ).toBeLessThan(0.001);
      expect(Math.abs(m.foot - ({1:0.5027,2:0.5537,3:0.6036} as Record<number,number>)[m.rank])).toBeLessThan(0.001);
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2),
    ).toBe(true);
    await page.screenshot({
      path:
        'test-results/hall-exhibition/' +
        (embedded ? 'profile-' : 'hall-') +
        width +
        'x' +
        height +
        '.png',
    });
    results.push({ width, height, embedded, metrics });
  }
  for (const [w, h] of [
    [1920, 1080],
    [1440, 960],
    [1266, 659],
    [1024, 768],
    [768, 960],
    [390, 844],
    [320, 740],
  ])
    await alignment(w, h);
  await page.getByRole('button', { name: 'Exposição anterior', exact: true }).click();
  const centered = () =>
    page.locator('.hall-champion.place-2').evaluate((e) => {
      const r = e.getBoundingClientRect();
      return Math.abs(r.x + r.width / 2 - innerWidth / 2);
    });
  await expect(async () => expect(await centered()).toBeLessThan(2)).toPass();
  await page.getByRole('button', { name: 'Próxima exposição', exact: true }).click();
  await expect(async () =>
    expect(
      await page.locator('.hall-champion.place-1').evaluate((e) => {
        const r = e.getBoundingClientRect();
        return Math.abs(r.x + r.width / 2 - innerWidth / 2);
      }),
    ).toBeLessThan(2),
  ).toPass();
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto(origin + '/#profiles?user=' + user.id);
  await page.getByRole('button', { name: 'Próxima aba: Conquistas', exact: true }).click();
  await page.getByRole('button', { name: 'Próxima aba: Hall da Fama', exact: true }).click();
  await expect(page.locator('.hall-of-fame.embedded')).toBeVisible();
  await alignment(1440, 960, true);
  await alignment(390, 844, true);
  await page.getByRole('button', { name: 'Menu do Hall da Fama', exact: true }).click();
  await expect(
    page.getByRole('complementary', { name: 'Hall da Fama', exact: true }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  expect(errors).toEqual([]);
  await writeFile(
    'test-results/hall-exhibition/result.json',
    JSON.stringify({ passed: true, results, errors }),
  );
  console.log(
    'Hall laureates passed: seven viewport sizes, three physical podium heights, mobile navigation, embedded Hall and sidebar.',
  );
} finally {
  await browser.close();
  await new Promise<void>((r) => server.close(() => r()));
  await pool.end();
}
