import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import { guildDocumentSchema } from '../shared/guilds';
import { createServer } from 'node:net';
import { vttProtocolVersion } from '../shared/vtt-protocol';
if (!new URL(process.env.DATABASE_URL!).pathname.startsWith('/alvorada_test_'))
  throw Error('Banco descartável obrigatório.');
const probe = createServer();
await new Promise<void>((r) => probe.listen(0, '127.0.0.1', r));
const port = (probe.address() as { port: number }).port;
await new Promise<void>((r) => probe.close(() => r()));
const origin = `http://127.0.0.1:${port}`;
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db'),
  { migrate } = await import('../server/migrate'),
  { seed } = await import('../server/seed');
await migrate();
await seed();
const { createApp } = await import('../server/app');
const server = createApp().listen(port, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 960 },
  reducedMotion: 'reduce',
});
const page = await context.newPage(),
  errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
await mkdir('test-results/guild-door', { recursive: true });
const headers = { Origin: origin, 'X-Vtt-Schema-Version': String(vttProtocolVersion) };
async function api(path: string, data?: unknown, method = data ? 'POST' : 'GET') {
  const response = await context.request.fetch(origin + '/api' + path, { method, headers, data });
  expect(response.ok(), await response.text()).toBe(true);
  return response.json();
}
try {
  const account = await api('/auth/sign-up/email', {
    name: 'Fundador',
    email: randomUUID() + '@example.test',
    password: 'Test-' + randomUUID(),
  });
  const { createLegacyTestCharacter } = await import('../tests/character-fixtures');
  const character = await createLegacyTestCharacter(account.user.id, 'Guardião');
  await pool.query('INSERT INTO character_tokens(character_id,image) VALUES($1,$2)', [
    character.id,
    await readFile(process.env.GUILD_DOOR_TEST_IMAGE || 'artwork-archive/retired-public-images-20261029/shop/merchant-v2.png'),
  ]);
  const guildId = randomUUID();
  const document = {
    ...guildDocumentSchema.parse({ name: 'Companhia da porta' }),
    _estate_actors: { [character.id]: { x: 30, y: 33.7, rotation: 0, scale: 1 } },
  };
  await pool.query(
    'INSERT INTO player_guilds(id,owner_id,document,founding_cp,request_id) VALUES($1,$2,$3,0,$4)',
    [guildId, account.user.id, document, randomUUID()],
  );
  await pool.query(
    'INSERT INTO player_guild_members(user_id,guild_id,character_id) VALUES($1,$2,$3)',
    [account.user.id, guildId, character.id],
  );
  await page.goto(origin + '/#guild?id=' + guildId);
  await expect(page.locator('[data-estate-actor]')).toHaveCount(1, { timeout: 60000 });
  const node = page.locator('[data-estate-actor]');
  const point = async (x: number, y: number) =>
    page.locator('.guild-estate-map').evaluate(
      (node, p) => {
        const svg = node as SVGSVGElement,
          q = svg.createSVGPoint();
        q.x = p.x;
        q.y = p.y;
        const at = q.matrixTransform(svg.getScreenCTM()!);
        return { x: at.x, y: at.y };
      },
      { x, y },
    );

  for (const [index, y] of [30.85, 30.7, 30.65, 30.5, 32].entries()) {
    const old = await node.boundingBox();
    const target = await point(30, y);
    await page.mouse.move(old!.x + old!.width / 2, old!.y + old!.height / 2);
    await page.mouse.down();
    await page.mouse.move(target.x, target.y, { steps: 15 });
    await page.mouse.up();
    await expect(page.locator('[data-asset-loading]')).toHaveCount(0, { timeout: 60000 });
    await page.screenshot({ path: `test-results/guild-door/drag-${index}.png` });
    const image = await node.locator('image').boundingBox();
    await page.mouse.dblclick(image!.x + image!.width / 2, image!.y + image!.height / 2);
    expect(await page.evaluate(() => window.getSelection()?.toString() || '')).toBe('');
    await page.screenshot({ path: `test-results/guild-door/double-${index}.png` });
    const circles = await page
      .locator('.guild-estate-map circle')
      .evaluateAll((nodes) =>
        nodes.map((n) => ({ fill: getComputedStyle(n).fill, w: n.getBoundingClientRect().width })),
      );
    expect(circles.every((c) => c.w < 40)).toBe(true);
    expect(await node.locator('image').getAttribute('href')).toContain('/estate/actors/');
  }
  expect(errors).toEqual([]);
  console.log('PASS: personagem preservado em movimentos e duplos cliques na entrada da sede.');
} finally {
  await browser.close();
  server.closeAllConnections();
  await new Promise<void>((r) => server.close(() => r()));
  await pool.end();
}
