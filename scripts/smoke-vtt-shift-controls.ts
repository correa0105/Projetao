import 'dotenv/config';
import { chromium, expect, type BrowserContext, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { newToken } from '../shared/vtt';
import { vttProtocolVersion } from '../shared/vtt-protocol';
if (!/^\/alvorada_test_[0-9a-f]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))
  throw Error('Disposable DB required');
const origin = 'http://localhost:3084';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db'),
  { migrate } = await import('../server/migrate'),
  { seed } = await import('../server/seed');
await migrate();
await seed();
const { createLegacyTestCharacter } = await import('../tests/character-fixtures'),
  { createApp } = await import('../server/app');
const server = createApp().listen(3084, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const options = {
  viewport: { width: 1440, height: 950 },
  extraHTTPHeaders: { 'X-Vtt-Schema-Version': String(vttProtocolVersion) },
};
const gm = await browser.newContext(options),
  player = await browser.newContext(options);
const page = await gm.newPage(),
  peer = await player.newPage(),
  errors: string[] = [];
for (const p of [page, peer]) p.on('pageerror', (e) => errors.push(e.message));
await mkdir('test-results/vtt-shift-controls', { recursive: true });
async function raw(c: BrowserContext, path: string, method = 'GET', data?: unknown) {
  return c.request.fetch(origin + '/api' + path, { method, headers: { Origin: origin }, data });
}
async function api(c: BrowserContext, path: string, method = 'GET', data?: unknown) {
  const r = await raw(c, path, method, data);
  expect(r.ok(), await r.text()).toBe(true);
  return r.json();
}
async function signup(c: BrowserContext, name: string) {
  const r = await api(c, '/auth/sign-up/email', 'POST', {
    name,
    email: randomUUID() + '@example.test',
    password: 'Test-' + randomUUID(),
  });
  await createLegacyTestCharacter(r.user.id, name);
  return r.user;
}
try {
  const master = await signup(gm, 'Mestre'),
    owner = await signup(player, 'Viajante');
  let room = await api(gm, '/vtt', 'POST', { name: 'Shift na mesa' });
  const path = '/vtt/rooms/' + room.id;
  await api(player, '/vtt/join', 'POST', { invite: room.invite, role: 'player' });
  room = await api(gm, path);
  const s = room.document.scenes[0];
  s.width = 1000;
  s.height = 700;
  s.grid.size = 50;
  s.fog = false;
  s.ambient = 1;
  s.lighting = true;
  s.walls = [
    { id: randomUUID(), a: { x: 500, y: 0 }, b: { x: 500, y: 700 }, kind: 'wall', open: false },
  ];
  const t = newToken(randomUUID(), s);
  Object.assign(t, { name: 'Viajante', controller: owner.id, x: 300, y: 300 });
  const locked = newToken(randomUUID(), s);
  Object.assign(locked, { name: 'Travado', x: 300, y: 450, locked: true });
  s.tokens = [t, locked];
  room = await api(gm, path, 'PUT', { revision: room.revision, document: room.document });
  async function enter(p: Page) {
    await p.goto(origin + '/#vtt?room=' + room.id);
    await p.getByRole('button', { name: 'Entrar no VTT', exact: true }).click();
    await expect(p.locator('.vtt-workspace')).toBeVisible({ timeout: 60000 });
  }
  await enter(page);
  await enter(peer);
  // Entering as a participant updates the room revision. Start the GM drag
  // from the settled snapshot rather than racing the first background poll.
  await page.reload();
  await page.getByRole('button', { name: 'Entrar no VTT', exact: true }).click();
  await expect(page.locator('.vtt-workspace')).toBeVisible({ timeout: 60000 });
  const current = async () => {
    const r = await api(gm, path);
    return r.document.scenes.find((scene: any) => scene.id === s.id);
  };
  async function screen(p: Page, x: number, y: number) {
    const board = p.getByLabel('Tabuleiro da mesa', { exact: true });
    const b = (await board.boundingBox())!;
    const c = await board.evaluate((e) => ({
      x: +e.dataset.cameraX!,
      y: +e.dataset.cameraY!,
      zoom: +e.dataset.cameraZoom!,
    }));
    return {
      x: b.x + b.width / 2 + (x - c.x) * c.zoom,
      y: b.y + b.height / 2 + (y - c.y) * c.zoom,
    };
  }
  async function drag(
    p: Page,
    from: { x: number; y: number },
    to: { x: number; y: number },
    shift = false,
    button: 'left' | 'right' = 'left',
  ) {
    const a = await screen(p, from.x, from.y),
      b = await screen(p, to.x, to.y);
    await p.mouse.move(a.x, a.y);
    if (shift) await p.keyboard.down('Shift');
    await p.mouse.down({ button });
    await p.mouse.move(b.x, b.y, { steps: 12 });
    await p.mouse.up({ button });
    if (shift) await p.keyboard.up('Shift');
  }
  async function save() {
    const button = page.getByRole('button', { name: 'Salvar mesa', exact: true });
    if (await button.isEnabled()) await button.click();
  }
  await drag(page, t, { x: 650, y: 300 });
  await save();
  await expect
    .poll(async () => (await current()).tokens.find((x: any) => x.id === t.id).x)
    .toBeGreaterThan(350);
  let moved = (await current()).tokens.find((x: any) => x.id === t.id);
  expect(moved.x).toBeLessThan(500);
  await drag(page, moved, { x: 650, y: 300 }, true);
  await save();
  await expect
    .poll(async () => (await current()).tokens.find((x: any) => x.id === t.id).x)
    .toBeGreaterThan(600);
  moved = (await current()).tokens.find((x: any) => x.id === t.id);
  await drag(page, moved, { x: 300, y: 300 });
  await save();
  await expect
    .poll(async () => (await current()).tokens.find((x: any) => x.id === t.id).x)
    .toBeLessThan(650);
  moved = (await current()).tokens.find((x: any) => x.id === t.id);
  expect(moved.x).toBeGreaterThan(500);
  await drag(page, moved, { x: 300, y: 300 }, true, 'right');
  await save();
  await expect
    .poll(async () => (await current()).tokens.find((x: any) => x.id === t.id).x)
    .toBeLessThan(350);
  await drag(page, locked, { x: 650, y: 450 }, true);
  await save();
  expect((await current()).tokens.find((x: any) => x.id === locked.id).x).toBe(300);
  await peer.reload();
  await peer.getByRole('button', { name: 'Entrar no VTT', exact: true }).click();
  await expect(peer.locator('.vtt-workspace')).toBeVisible({ timeout: 60000 });
  await expect
    .poll(async () => {
      const r = await api(player, path);
      return r.document.scenes[0].tokens.find((x: any) => x.id === t.id).x;
    })
    .toBeLessThan(350);
  moved = (await current()).tokens.find((x: any) => x.id === t.id);
  await drag(peer, moved, { x: 650, y: 300 }, true);
  await expect
    .poll(async () => (await current()).tokens.find((x: any) => x.id === t.id).x)
    .toBeGreaterThan(350);
  expect((await current()).tokens.find((x: any) => x.id === t.id).x).toBeLessThan(500);
  expect((await raw(player, path + '/tokens/' + t.id, 'PATCH', { x: 650, y: 300 })).status()).toBe(
    400,
  );
  expect(
    (
      await raw(player, path + '/tokens/' + t.id, 'PATCH', { x: 650, y: 300, ignoreBarriers: true })
    ).status(),
  ).toBe(400);
  const state = await api(gm, path);
  expect(
    (
      await raw(player, path, 'PUT', { revision: state.revision, document: state.document })
    ).status(),
  ).toBe(403);
  expect((await current()).walls).toEqual(s.walls);
  expect((await current()).lighting).toBe(true);
  await page.getByRole('button', { name: 'Chat', exact: true }).click();
  await peer.getByRole('button', { name: 'Chat', exact: true }).click();
  const input = page.getByLabel('Mensagem', { exact: true });
  const messages = async () =>
    (await pool.query('SELECT text FROM vtt_messages WHERE room_id=$1 ORDER BY id', [room.id]))
      .rows;
  await input.fill('Primeira frase');
  await input.press('Shift+Enter');
  await input.press('Shift+Enter');
  await input.pressSequentially('Segunda frase');
  expect(await input.inputValue()).toBe('Primeira frase\n\nSegunda frase');
  expect(await messages()).toHaveLength(0);
  await input.press('Enter');
  await expect.poll(async () => messages()).toEqual([{ text: 'Primeira frase\n\nSegunda frase' }]);
  await expect(input).toHaveValue('');
  await expect(peer.locator('.vtt-chat-log')).toContainText('Segunda frase');
  await input.press('Enter');
  expect(await messages()).toHaveLength(1);
  await input.fill('Composição');
  await input.evaluate((e) =>
    e.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Enter',
        isComposing: true,
        bubbles: true,
        cancelable: true,
      }),
    ),
  );
  expect(await messages()).toHaveLength(1);
  await expect(input).toHaveValue('Composição');
  await input.fill('Pelo botão');
  await page.getByRole('button', { name: 'Enviar à mesa', exact: true }).click();
  await expect.poll(async () => (await messages()).length).toBe(2);
  const sizes = [];
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 950 });
    if (!(await input.isVisible()))
      await page.getByRole('button', { name: 'Chat', exact: true }).click();
    await expect(input).toBeVisible();
    sizes.push(width);
    await page.screenshot({ path: 'test-results/vtt-shift-controls/chat-' + width + '.png' });
  }
  expect(errors).toEqual([]);
  await writeFile(
    'test-results/vtt-shift-controls/result.json',
    JSON.stringify(
      {
        passed: true,
        nonAdminMaster: true,
        normalCollision: true,
        masterShiftLeftAndRightDrag: true,
        lockedTokenPreserved: true,
        playerShiftBlocked: true,
        forgedBypassRejected: true,
        lightingWallsUnchanged: true,
        shiftEnterParagraphs: true,
        enterSendsOnce: true,
        emptyEnterIgnored: true,
        imeIgnored: true,
        buttonSend: true,
        sizes,
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    'PASS Shift: mestre atravessa paredes, jogador bloqueado, chat preserva parágrafos e Enter envia.',
  );
} catch (e) {
  await page.screenshot({ path: 'test-results/vtt-shift-controls/failure.png' });
  throw e;
} finally {
  await browser.close();
  server.closeAllConnections();
  await new Promise<void>((r) => server.close(() => r()));
  await pool.end();
}
