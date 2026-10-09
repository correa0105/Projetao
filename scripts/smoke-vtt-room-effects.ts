import 'dotenv/config';
import { chromium, expect, type BrowserContext, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import { newToken } from '../shared/vtt';
import { monsterActions } from '../shared/vtt-monster-actions';
import { attackOutcome } from '../shared/vtt-attack';
import { effectLibrary } from '../shared/vtt-effects';
import { effectSound } from '../shared/vtt-effect-sounds';
if (!/^\/alvorada_test_[0-9a-f]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))
  throw Error('Disposable database required');
const origin = 'http://localhost:3045';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db'),
  { migrate } = await import('../server/migrate'),
  { seed } = await import('../server/seed'),
  { createLegacyTestCharacter } = await import('../tests/character-fixtures');
await migrate();
await seed();
const { createApp } = await import('../server/app'),
  server = createApp().listen(3045, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));
const browser = await chromium.launch({ channel: 'msedge', headless: true }),
  contexts = await Promise.all(
    [0, 1, 2].map(() =>
      browser.newContext({
        viewport: { width: 1440, height: 1000 },
        extraHTTPHeaders: { 'X-Vtt-Schema-Version': '6' },
      }),
    ),
  ),
  [gm, player, spectator] = contexts;
const [page, peer] = await Promise.all([gm.newPage(), player.newPage()]),
  errors: string[] = [];
for (const p of [page, peer]) {
  p.on('pageerror', (e) => errors.push(e.message));
  await p.addInitScript(() => {
    const native = HTMLMediaElement.prototype.play;
    (window as any).__cues = [];
    HTMLMediaElement.prototype.play = function () {
      const path = new URL(this.src, location.href).pathname;
      if (
        path.includes('/vtt-attacks/') ||
        path.includes('/vtt-effects/') ||
        path.includes('sfx-knifeslice')
      ) {
        (window as any).__cues.push({ path, volume: this.volume });
        this.addEventListener(
          'error',
          () => {
            (window as any).__cues.push({ error: path });
          },
          { once: true },
        );
      }
      return native.call(this);
    };
  });
}
await mkdir('test-results', { recursive: true });
async function api(ctx: BrowserContext, path: string, method = 'GET', data?: unknown) {
  const send = () =>
    ctx.request.fetch(origin + '/api' + path, {
      method,
      headers: { Origin: origin },
      data,
    });
  let r = await send();
  if (r.status() === 429) {
    const delay = Math.min(60, Math.max(1, Number(r.headers()['retry-after']) || 60));
    console.log('Teste aguarda janela do limite de solicitações: ' + delay + ' s.');
    await new Promise((resolve) => setTimeout(resolve, delay * 1000 + 100));
    r = await send();
  }
  return { status: r.status(), data: await r.json() };
}
async function signup(ctx: BrowserContext, name: string) {
  const r = await api(ctx, '/auth/sign-up/email', 'POST', {
    name,
    email: randomUUID() + '@example.test',
    password: 'Test-' + randomUUID(),
  });
  expect(r.status).toBe(200);
  await createLegacyTestCharacter(r.data.user.id, name);
  return r.data.user;
}
try {
  const owner = await signup(gm, 'Mestre');
  await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [owner.id]);
  let room = (await api(gm, '/vtt', 'POST', { name: 'Janela e efeitos' })).data;
  const scene = room.document.scenes[0];
  scene.fog = scene.lighting = false;
  scene.width = 1400;
  scene.height = 1000;
  const token = {
    ...newToken(randomUUID(), scene),
    name: 'Teste Allosaurus',
    x: 600,
    y: 450,
    width: 140,
    height: 140,
    hp: 50,
    maxHp: 50,
    image: '/vtt/monsters/monster-allosaurus.webp',
  };
  scene.tokens = [token];
  room = (
    await api(gm, '/vtt/rooms/' + room.id, 'PUT', {
      revision: room.revision,
      document: room.document,
    })
  ).data;
  const root = '/vtt/rooms/' + room.id;
  await page.goto(origin + '/#vtt');
  const board = page.getByLabel('Tabuleiro da mesa', { exact: true });
  await expect(board).toBeVisible();
  const click = async (button: 'left' | 'right' = 'left') => {
    const b = (await board.boundingBox())!,
      x = Number(await board.getAttribute('data-camera-x')),
      y = Number(await board.getAttribute('data-camera-y')),
      z = Number(await board.getAttribute('data-camera-zoom'));
    await board.click({
      button,
      position: { x: b.width / 2 + (token.x - x) * z, y: b.height / 2 + (token.y - y) * z },
    });
  };
  await click('right');
  const popup = page.getByRole('dialog', { name: 'Ações do objeto' }),
    header = popup.getByLabel('Mover janela de ações');
  await expect(popup).toBeVisible();
  const before = (await popup.boundingBox())!,
    hb = (await header.boundingBox())!;
  await page.mouse.move(hb.x + 45, hb.y + 10);
  await page.mouse.down();
  await page.mouse.move(hb.x + 190, hb.y + 32, { steps: 8 });
  await page.mouse.up();
  const after = (await popup.boundingBox())!;
  expect(after.x - before.x).toBeGreaterThan(100);
  for (const [command, hp] of [
    ['-5', 45],
    ['+3', 48],
  ] as const) {
    await popup.getByLabel('Editar PV do token').fill(command);
    await popup.getByRole('button', { name: 'Aplicar PV', exact: true }).click();
    await expect
      .poll(async () => (await api(gm, root)).data.document.scenes[0].tokens[0].hp)
      .toBe(hp);
  }
  await popup.getByRole('button', { name: 'Ocultar dos jogadores', exact: true }).click();
  await expect
    .poll(async () => (await api(gm, root)).data.document.scenes[0].tokens[0].hidden)
    .toBe(true);
  await popup.getByRole('button', { name: 'Mostrar aos jogadores', exact: true }).click();
  await popup.getByRole('button', { name: 'Fechar ações' }).click();
  await page.getByRole('button', { name: 'Configurações e ajuda', exact: true }).click();
  await expect(page.getByLabel('Automático ao zerar PV', { exact: true })).toBeChecked();
  await page.getByLabel('Automático ao zerar PV', { exact: true }).uncheck();
  await page.getByLabel('Respingos de sangue', { exact: true }).uncheck();
  await expect.poll(async () => (await api(gm, root)).data.document.bloodEnabled).toBe(false);
  await page.reload();
  await expect(page.getByLabel('Tabuleiro da mesa', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Configurações e ajuda', exact: true }).click();
  await expect(page.getByLabel('Automático ao zerar PV', { exact: true })).not.toBeChecked();
  await expect(page.getByLabel('Respingos de sangue', { exact: true })).not.toBeChecked();
  await click();
  await page.getByRole('button', { name: 'Efeitos do mestre', exact: true }).click();
  await expect(page.getByText('Efeito de morte', { exact: true })).toHaveCount(1);
  await page.getByRole('button', { name: 'Criar efeito · Gelo', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Biblioteca de efeitos' })).toBeVisible();
  await expect(page.getByRole('form', { name: 'Editor de efeito' })).toBeVisible();
  await page.getByLabel('Tamanho do efeito').fill('1.4');
  await page.getByLabel('Cor do efeito').fill('#63a7ee');
  expect((await api(gm, root)).data.document.scenes[0].tokens[0].effects.length).toBe(0);
  await page.screenshot({ path: 'test-results/vtt-room-inline-effects.png' });
  await page.getByRole('button', { name: 'Aplicar efeito', exact: true }).click();
  await expect
    .poll(async () => (await api(gm, root)).data.document.scenes[0].tokens[0].effects.length)
    .toBe(1);
  const applied = (await api(gm, root)).data.document.scenes[0].tokens[0].effects[0];
  expect(applied.scale).toBe(1.4);
  expect(applied.color).toBe('#63a7ee');
  await page.getByRole('button', { name: 'Fechar efeitos', exact: true }).click();
  await page.getByRole('button', { name: 'Fichas', exact: true }).click();
  await page.getByRole('button', { name: 'Token selecionado', exact: true }).click();
  await expect(page.locator('.vtt-panel-heading .vtt-gold')).toHaveCount(0);
  await page.getByRole('button', { name: 'Alternar painel', exact: true }).click();
  await expect(page.locator('.vtt-panel')).toHaveCount(0);
  for (const width of [1920, 1366, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await click('right');
    await expect(popup).toBeVisible();
    const handle = (await header.boundingBox())!;
    await page.mouse.move(handle.x + 35, handle.y + 10);
    await page.mouse.down();
    await page.mouse.move(-50, -50, { steps: 4 });
    await page.mouse.up();
    const box = (await popup.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(8);
    expect(box.y).toBeGreaterThanOrEqual(8);
    expect(box.x + box.width).toBeLessThanOrEqual(width - 7);
    await expect(popup.getByRole('button', { name: 'Fechar ações' })).toBeVisible();
    await popup.getByRole('button', { name: 'Fechar ações' }).click();
  }
  expect(errors).toEqual([]);
  console.log(
    'PASS browser: damage/heal/hide save, draggable popup at 4 widths, no +Token, immediate private inline effects, apply, room defaults and persisted toggles.',
  );
} finally {
  await Promise.all(contexts.map((c) => c.close()));
  await browser.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.end();
}
