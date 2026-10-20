import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { vttProtocolVersion } from '../shared/vtt-protocol';
if (!/^\/alvorada_test_[0-9a-f]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))
  throw Error('Disposable database required');
const origin = 'http://localhost:3096';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db');
const { migrate } = await import('../server/migrate');
const { seed } = await import('../server/seed');
const { createLegacyTestCharacter } = await import('../tests/character-fixtures');
await migrate(); await seed();
process.env.NODE_ENV = 'production';
let closeServer: () => Promise<void>;
if (process.env.PERFORMANCE_APP_ENTRY) {
  const child = spawn(process.execPath, [resolve(process.env.PERFORMANCE_APP_ENTRY)], {
    env: { ...process.env, PORT: '3096' }, stdio: 'inherit', windowsHide: true,
  });
  await expect.poll(async () => fetch(origin + '/api/health').then(r => r.ok).catch(() => false), { timeout: 30000 }).toBe(true);
  closeServer = () => new Promise<void>(r => { child.once('exit', () => r()); child.kill(); });
} else {
  const { createApp } = await import('../server/app');
  const server = createApp().listen(3096, '127.0.0.1');
  await new Promise<void>(r => server.once('listening', r));
  closeServer = () => new Promise<void>(r => server.close(() => r()));
}
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, reducedMotion: 'reduce' });
await context.addInitScript(() => {
  localStorage.setItem('alvorada-music-muted', 'true');
  localStorage.setItem('alvorada-effects-muted', 'true');
});
const page = await context.newPage(), errors: string[] = [], results: unknown[] = [];
const out = 'test-results/performance'; await mkdir(out, { recursive: true });
page.on('pageerror', e => errors.push(e.message));
let catalogRequests = 0;
page.on('request', r => { if (new URL(r.url()).pathname === '/api/catalog') catalogRequests++; });
try {
  const signup = await context.request.post(origin + '/api/auth/sign-up/email', {
    headers: { Origin: origin }, data: { name: 'Performance', email: randomUUID() + '@example.test', password: 'Test-' + randomUUID() },
  });
  expect(signup.ok(), await signup.text()).toBe(true);
  const { user } = await signup.json();
  await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [user.id]);
  const character = await createLegacyTestCharacter(user.id, 'Aurora');
  await pool.query('INSERT INTO character_portraits(character_id,image) VALUES($1,$2)', [character.id, await readFile('public/character-silhouette-v2.png')]);
  await page.goto(origin + '/#overview');
  await expect(page.locator('.home-journal')).toBeVisible({ timeout: 30000 });
  expect(catalogRequests, 'journal must not download the shop catalogue').toBe(0);
  const initialResources = await page.evaluate(() => performance.getEntriesByType('resource').map(r => ({ name: new URL(r.name).pathname, bytes: (r as PerformanceResourceTiming).encodedBodySize })));
  expect(initialResources.some(r => /\/(Shop|Vtt|LoreLibrary|CharacterSheet)-.*\.js$/.test(r.name))).toBe(false);
  results.push({ initialResources });
  const bundle = initialResources.find(r => /\/assets\/index-.*\.js$/.test(r.name))!;
  for (const encoding of ['br', 'gzip', 'identity']) {
    const r = await context.request.get(origin + bundle.name, { headers: { 'Accept-Encoding': encoding } });
    expect(r.ok()).toBe(true);
    expect(r.headers()['content-encoding']).toBe(encoding === 'identity' ? undefined : encoding);
    expect(await r.body()).toEqual(await readFile('dist/client' + bundle.name));
    expect(r.headers()['cache-control']).toContain('immutable');
  }
  const routes = ['characters','profile','inventory','achievements','missions','board','hooks','events','cards','character-cards','stable','pets','tower','shop','hall','profiles','house','house2','guild','world','lore','rules','vtt'];
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 960 });
    for (const route of routes) {
      const before = Date.now();
      await page.evaluate(hash => { location.hash = hash; }, route === 'profiles' ? 'profiles?user=' + encodeURIComponent(user.id) : route);
      await expect(page.locator('.app-shell')).toHaveAttribute('data-page', route);
      await expect(page.locator('#main-content .loading-content:visible')).toHaveCount(0, { timeout: 30000 });
      await expect.poll(() => page.locator('#main-content').innerText(), { timeout: 30000 }).not.toBe('');
      await expect(page.getByRole('heading', { name: 'Não foi possível abrir esta página.' })).toHaveCount(0);
      await expect(page.locator('#main-content')).not.toContainText('Não foi possível carregar o Empório.');
      const metrics = await page.evaluate(() => ({ nodes: document.querySelectorAll('*').length, overflow: document.documentElement.scrollWidth > innerWidth + 1 }));
      results.push({ route, width, readyMs: Date.now() - before, ...metrics });
      if (['shop', 'profile', 'vtt', 'lore'].includes(route)) await page.screenshot({ path: `${out}/${route}-${width}.png` });
    }
  }
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.getByLabel('Nome da mesa', { exact: true }).fill('Validação de desempenho');
  await page.getByRole('button', { name: 'Criar mesa', exact: true }).click();
  await expect(page.getByLabel('Tabuleiro da mesa', { exact: true })).toBeVisible();
  const room = (await pool.query('SELECT id FROM vtt_rooms WHERE owner_id=$1', [user.id])).rows[0];
  const response = await context.request.get(origin + `/api/vtt/rooms/${room.id}`, { headers: { 'X-Vtt-Schema-Version': String(vttProtocolVersion), 'Accept-Encoding': 'gzip' } });
  expect(response.ok()).toBe(true);
  expect(response.headers()['cache-control']).toContain('no-store');
  const roomState = await response.json();
  const plainRoom = await context.request.get(origin + `/api/vtt/rooms/${room.id}`, { headers: { 'X-Vtt-Schema-Version': String(vttProtocolVersion), 'Accept-Encoding': 'identity' } });
  expect(await plainRoom.json()).toEqual(roomState);
  const terrainRequests = await page.evaluate(() => performance.getEntriesByType('resource').filter(r => /\/vtt\/terrain-/.test(r.name)).map(r => r.name));
  expect(terrainRequests.length, 'empty room must not preload the terrain library').toBeLessThan(5);
  await page.screenshot({ path: `${out}/vtt-room.png` });
  await page.getByRole('button', { name: 'Brush do mapa', exact: true }).click();
  await page.getByRole('button', { name: 'Textura: Terra', exact: true }).click();
  await page.getByLabel('Suavidade do pincel', { exact: true }).focus(); await page.keyboard.press('Home');
  const board = page.getByLabel('Tabuleiro da mesa', { exact: true });
  const box = (await board.boundingBox())!, point = { x: box.width / 2 + 9, y: box.height / 2 + 11 };
  const pixel = () => board.evaluate((canvas: HTMLCanvasElement, point) => {
    const box = canvas.getBoundingClientRect();
    return [...canvas.getContext('2d')!.getImageData(Math.round(point.x * canvas.width / box.width), Math.round(point.y * canvas.height / box.height), 1, 1).data];
  }, point);
  const beforePaint = await pixel();
  await page.mouse.move(box.x + point.x - 30, box.y + point.y); await page.mouse.down();
  await page.mouse.move(box.x + point.x + 30, box.y + point.y, { steps: 8 }); await page.mouse.up();
  await page.mouse.move(5, 5);
  await expect.poll(pixel).not.toEqual(beforePaint);
  const painted = await pixel();
  await page.getByRole('button', { name: 'Salvar mesa', exact: true }).click();
  await expect.poll(async () => (await pool.query('SELECT document FROM vtt_rooms WHERE id=$1', [room.id])).rows[0].document.scenes[0].terrain.length).toBe(1);
  await page.getByRole('button', { name: 'Borracha', exact: true }).click();
  await page.mouse.click(box.x + point.x, box.y + point.y); await page.mouse.move(5, 5);
  await expect.poll(pixel).toEqual(beforePaint);
  await page.getByRole('button', { name: 'Desfazer', exact: true }).click();
  await expect.poll(pixel).toEqual(painted);
  await page.getByRole('button', { name: 'Salvar mesa', exact: true }).click();
  await page.reload(); await expect(board).toBeVisible();
  await expect.poll(() => page.evaluate(() => performance.getEntriesByType('resource').some(r => r.name.includes('/terrain-v3-20261013/earth.webp')))).toBe(true);
  await page.screenshot({ path: `${out}/vtt-painted-reload.png` });
  await page.evaluate(() => { location.hash = 'overview'; });
  await expect(page.locator('.home-journal')).toBeVisible();
  const beforeIdle = catalogRequests;
  await page.waitForTimeout(61000);
  expect(catalogRequests, 'minute refresh must not download the catalogue again').toBe(beforeIdle);
  expect(errors).toEqual([]);
  await writeFile(out + '/result.json', JSON.stringify({ passed: true, catalogRequests, terrainRequests, errors, results }, null, 2));
  console.log('PASS all 24 pages, desktop/mobile, deferred catalogue, idle refresh and VTT room.');
} catch (error) {
  await page.screenshot({ path: out + '/failure.png' }).catch(() => {});
  await writeFile(out + '/result.json', JSON.stringify({ passed: false, error: String(error), errors, results }, null, 2));
  throw error;
} finally {
  await browser.close(); await closeServer(); await pool.end();
}
