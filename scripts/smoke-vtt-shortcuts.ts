import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { createServer } from 'node:net';
import { newToken } from '../shared/vtt';
import { monsterActions } from '../shared/vtt-monster-actions';
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
const browser = await chromium.launch({ channel: 'msedge', headless: true }),
  context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
    reducedMotion: 'reduce',
  }),
  page = await context.newPage();
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
await mkdir('test-results/vtt-shortcuts', { recursive: true });
const headers = { Origin: origin, 'X-Vtt-Schema-Version': String(vttProtocolVersion) };
async function request(path: string, data?: unknown, method = data ? 'POST' : 'GET') {
  return context.request.fetch(origin + '/api' + path, { method, data, headers });
}
async function api(path: string, data?: unknown, method = data ? 'POST' : 'GET') {
  const response = await request(path, data, method);
  expect(response.ok(), await response.text()).toBe(true);
  return response.json();
}
try {
  const account = await api('/auth/sign-up/email', {
    name: 'Mestre sem admin',
    email: randomUUID() + '@example.test',
    password: 'Test-' + randomUUID(),
  });
  let room = await api('/vtt', { name: 'Atalhos da minha mesa' });
  const root = '/vtt/rooms/' + room.id,
    scene = room.document.scenes[0];
  scene.fog = false;
  scene.lighting = false;
  const monster = newToken(randomUUID(), scene);
  monster.name = 'Dragão de teste';
  monster.sheet = {
    source: 'Fixture',
    race: '',
    class: '',
    level: 0,
    stats: [10, 10, 10, 10, 10, 10],
    speed: 30,
    biography: '',
    details: 'Rend\nAtaque m 11, reach 10 ft. Acerto: 13 (2d6 + 6) Slashing damage.',
  };
  scene.tokens.push(monster);
  room = await api(root, { revision: room.revision, document: room.document }, 'PUT');
  const bar = await api(root + '/hotbar'),
    slots = bar.document.pages[0].slots;
  slots[0] = {
    kind: 'attack',
    characterId: randomUUID(),
    sourceId: 'removed-weapon',
    label: 'Personagem removido',
  };
  slots[1] = {
    kind: 'monster',
    tokenId: monster.id,
    sourceId: monsterActions(monster.sheet.details)[0].id,
    label: 'Ataque do dragão',
  };
  // Simulate an old saved shortcut whose character is no longer imported.
  await pool.query('UPDATE vtt_hotbars SET document=$3 WHERE room_id=$1 AND user_id=$2', [
    room.id,
    account.user.id,
    bar.document,
  ]);
  await page.goto(origin + '/#vtt?room=' + room.id);
  await page.getByRole('button', { name: 'Entrar no VTT', exact: true }).click();
  await expect(page.locator('.vtt-workspace')).toBeVisible({ timeout: 60000 });
  await page.getByRole('button', { name: 'Atalho 2 · Ataque do dragão', exact: true }).click();
  const [removed] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/hotbar') && r.request().method() === 'PUT'),
    page.getByRole('button', { name: 'Remover atalho', exact: true }).click(),
  ]);
  expect(removed.status()).toBe(200);
  await expect(page.getByRole('button', { name: 'Atalho 2 · vazio', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog', { name: /^Atalho/ })).toHaveCount(0);
  expect((await api(root + '/hotbar')).document.pages[0].slots[0]).not.toBeNull();
  await page.getByRole('button', { name: 'Atalho 1 · Personagem removido', exact: true }).click();
  await page.getByRole('button', { name: 'Remover atalho', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Atalho 1 · vazio', exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Entrar no VTT', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Atalho 1 · vazio', exact: true })).toBeVisible({
    timeout: 60000,
  });
  await expect(page.getByRole('button', { name: 'Atalho 2 · vazio', exact: true })).toBeVisible();
  const stale = await api(root + '/hotbar');
  stale.document.pages[0].slots[0] = slots[0];
  expect(
    (
      await request(root + '/hotbar', { revision: stale.revision, document: stale.document }, 'PUT')
    ).status(),
  ).toBe(403);
  const valid = await api(root + '/hotbar');
  valid.document.pages[0].slots[1] = slots[1];
  const pinned = await api(
    root + '/hotbar',
    { revision: valid.revision, document: valid.document },
    'PUT',
  );
  pinned.document.pages[0].locked = true;
  const locked = await api(
    root + '/hotbar',
    { revision: pinned.revision, document: pinned.document },
    'PUT',
  );
  locked.document.pages[0].slots[1] = null;
  expect(
    (
      await request(
        root + '/hotbar',
        { revision: locked.revision, document: locked.document },
        'PUT',
      )
    ).status(),
  ).toBe(403);
  await page.screenshot({ path: 'test-results/vtt-shortcuts/removed-and-persisted.png' });
  expect(errors).toEqual([]);
  console.log(
    'PASS: mestre sem admin remove atalho de monstro e referência antiga; reload conserva remoção; referências novas inválidas e abas trancadas continuam bloqueadas.',
  );
} finally {
  await browser.close();
  server.closeAllConnections();
  await new Promise<void>((r) => server.close(() => r()));
  await pool.end();
}
