import 'dotenv/config';
import { chromium, expect, type BrowserContext, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { newToken } from '../shared/vtt';
import { vttProtocolVersion } from '../shared/vtt-protocol';
import { arcanaEffects } from '../shared/vtt-effects-arcana';
import { conditionIcons, toggledCondition } from '../shared/vtt-condition-icons';
if (!/^\/alvorada_test_[0-9a-f]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))
  throw Error('Disposable database required');
const origin = 'http://localhost:3046';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db'),
  { migrate } = await import('../server/migrate'),
  { seed } = await import('../server/seed'),
  { createLegacyTestCharacter } = await import('../tests/character-fixtures');
await migrate();
await seed();
const { createApp } = await import('../server/app'),
  server = createApp().listen(3046, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const contexts = await Promise.all(
  [0, 1, 2].map(() =>
    browser.newContext({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: 'reduce',
      extraHTTPHeaders: { 'X-Vtt-Schema-Version': String(vttProtocolVersion) },
    }),
  ),
);
const [gm, player, spectator] = contexts;
const page = await gm.newPage(),
  peer = await player.newPage(),
  errors: string[] = [];
for (const p of [page, peer]) p.on('pageerror', (e) => errors.push(e.message));
async function api(ctx: BrowserContext, path: string, method = 'GET', data?: unknown) {
  const r = await ctx.request.fetch(origin + '/api' + path, {
    method,
    headers: { Origin: origin },
    data,
  });
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
  const owner = await signup(gm, 'Mestre dos símbolos'),
    guest = await signup(player, 'Jogador dos símbolos');
  await signup(spectator, 'Observador');
  await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [owner.id]);
  let room = (await api(gm, '/vtt', 'POST', { name: 'Símbolos e arcana' })).data,
    root = '/vtt/rooms/' + room.id;
  for (const [ctx, role] of [
    [player, 'player'],
    [spectator, 'spectator'],
  ] as const)
    expect((await api(ctx, '/vtt/join', 'POST', { invite: room.invite, role })).status).toBe(200);
  room = (await api(gm, root)).data;
  const scene = room.document.scenes[0];
  scene.fog = scene.lighting = false;
  scene.width = 1400;
  scene.height = 1000;
  const token = {
    ...newToken(randomUUID(), scene),
    name: 'Portador dos símbolos',
    controller: guest.id,
    x: 600,
    y: 450,
    width: 180,
    height: 180,
    hp: 50,
    maxHp: 50,
    image: '/vtt/monsters/monster-allosaurus.webp',
    conditions: ['Maldição antiga'],
  };
  scene.tokens = [token];
  room = (await api(gm, root, 'PUT', { revision: room.revision, document: room.document })).data;
  expect(room.id).toBeTruthy();
  const outdated = await gm.request.get(origin + '/api' + root, {
    headers: { Origin: origin, 'X-Vtt-Schema-Version': '8' },
  });
  expect(outdated.status()).toBe(409);
  expect((await outdated.json()).error).toContain('Recarregue');
  const open = async (p: Page) => {
    const board = p.getByLabel('Tabuleiro da mesa', { exact: true });
    await expect(board).toBeVisible();
    if ((p.viewportSize()?.width || 1440) < 800 && (await p.locator('.vtt-panel').count())) {
      await p.getByRole('button', { name: 'Alternar painel', exact: true }).click();
      await expect(p.locator('.vtt-panel')).toHaveCount(0);
    }
    const b = (await board.boundingBox())!,
      x = Number(await board.getAttribute('data-camera-x')),
      y = Number(await board.getAttribute('data-camera-y')),
      z = Number(await board.getAttribute('data-camera-zoom'));
    await board.click({
      button: 'right',
      position: { x: b.width / 2 + (token.x - x) * z, y: b.height / 2 + (token.y - y) * z },
    });
    const popup = p.getByRole('dialog', { name: 'Ações do objeto' });
    await expect(popup).toBeVisible();
    await popup.locator('.vtt-condition-menu>summary').click();
    return popup;
  };
  await page.goto(origin + '/#vtt');
  let popup = await open(page);
  const group = popup.getByRole('group', { name: 'Ícones de condições' });
  await expect(group.getByRole('button')).toHaveCount(30);
  await expect(
    popup.getByRole('button', { name: '◇ Maldição antiga ×', exact: true }),
  ).toBeVisible();
  expect(new Set(conditionIcons.map((x) => x.name)).size).toBe(30);
  expect(new Set(conditionIcons.map((x) => JSON.stringify(x.paths))).size).toBe(30);
  expect(toggledCondition(['Cego'], 'Cego', false)).toEqual(['Cego']);
  expect(toggledCondition(['Cego'], 'Cego', true)).toEqual([]);
  expect(toggledCondition(Array(30).fill('Outra'), 'Asas', true)).toHaveLength(30);
  for (const name of ['Cego', 'Mancando', 'Asas', 'Eletrizado', 'Envenenado']) {
    await group.getByRole('button', { name, exact: true }).click();
    await expect(group.getByRole('button', { name, exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect
      .poll(async () =>
        (await api(gm, root)).data.document.scenes[0].tokens[0].conditions.includes(name),
      )
      .toBe(true);
  }
  await group.getByRole('button', { name: 'Cego', exact: true }).click();
  await expect
    .poll(async () =>
      (await api(gm, root)).data.document.scenes[0].tokens[0].conditions.includes('Cego'),
    )
    .toBe(false);
  await popup.getByRole('button', { name: 'Fechar ações' }).click();
  await page.getByRole('button', { name: 'Efeitos do mestre', exact: true }).click();
  for (const model of arcanaEffects) {
    const create = page.getByRole('button', { name: 'Criar efeito · ' + model.name, exact: true });
    await create.scrollIntoViewIfNeeded();
    await create.click();
    await expect(
      page.getByRole('form', { name: 'Editor de efeito' }).locator('strong').first(),
    ).toHaveText(model.name);
    await expect(page.getByRole('form', { name: 'Editor de efeito' })).toBeVisible();
  }
  expect((await api(gm, root)).data.document.scenes[0].tokens[0].effects).toHaveLength(0);
  await page.getByLabel('Cor do efeito', { exact: true }).fill('#ffffff');
  await page.getByRole('button', { name: 'Aplicar efeito', exact: true }).click();
  await expect
    .poll(async () => (await api(gm, root)).data.document.scenes[0].tokens[0].effects[0]?.kind)
    .toBe(arcanaEffects.at(-1)!.kind);
  expect((await api(gm, root)).data.document.scenes[0].tokens[0].effects[0].color).toBe('#ffffff');
  await page.getByRole('button', { name: 'Fechar efeitos', exact: true }).click();
  room = (await api(gm, root)).data;
  room.document.effects = arcanaEffects.map((model) => ({
    id: randomUUID(),
    name: model.name,
    kind: model.kind,
    color: model.color,
    scale: 1,
    duration: 0,
    intensity: 0.85,
  }));
  room.document.scenes[0].tokens[0].effects = room.document.effects
    .slice(0, 10)
    .map((e: any) => ({ ...e, at: Date.now(), name: undefined }));
  for (const e of room.document.scenes[0].tokens[0].effects) delete e.name;
  room = (await api(gm, root, 'PUT', { revision: room.revision, document: room.document })).data;
  expect(room.document.effects).toHaveLength(20);
  expect(room.document.scenes[0].tokens[0].effects).toHaveLength(10);
  room.document.scenes[0].tokens[0].effects = room.document.effects.slice(10).map((e: any) => {
    const { name, ...tokenEffect } = e;
    return { ...tokenEffect, at: Date.now() };
  });
  room = (await api(gm, root, 'PUT', { revision: room.revision, document: room.document })).data;
  expect(room.document.scenes[0].tokens[0].effects).toHaveLength(10);
  room.document.scenes[0].tokens[0].effects = [];
  room.document.scenes[0].tokens[0].conditions = conditionIcons.map((x) => x.name);
  room = (await api(gm, root, 'PUT', { revision: room.revision, document: room.document })).data;
  expect(room.document.scenes[0].tokens[0].conditions).toEqual(conditionIcons.map((x) => x.name));
  await page.reload();
  popup = await open(page);
  for (const icon of conditionIcons)
    await expect(
      popup
        .getByRole('group', { name: 'Ícones de condições' })
        .getByRole('button', { name: icon.name, exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
  await mkdir('test-results', { recursive: true });
  await popup.screenshot({ path: 'test-results/vtt-conditions-menu.png' });
  await peer.goto(origin + '/#vtt');
  let pp = await open(peer);
  await expect(
    pp
      .getByRole('group', { name: 'Ícones de condições' })
      .getByRole('button', { name: 'Cego', exact: true }),
  ).toBeDisabled();
  await pp.getByRole('button', { name: 'Fechar ações' }).click();
  const endpoint = root + '/tokens/' + token.id;
  expect((await api(player, endpoint, 'PATCH', { conditions: [] })).status).toBe(403);
  expect(
    (await api(spectator, endpoint, 'PATCH', { conditions: conditionIcons.map((x) => x.name) }))
      .status,
  ).toBe(403);
  room = (await api(gm, root)).data;
  room.document.scenes[0].tokens[0].conditions = ['Cego'];
  room = (await api(gm, root, 'PUT', { revision: room.revision, document: room.document })).data;
  await peer.reload();
  pp = await open(peer);
  await pp
    .getByRole('group', { name: 'Ícones de condições' })
    .getByRole('button', { name: 'Asas', exact: true })
    .click();
  await expect
    .poll(async () => (await api(gm, root)).data.document.scenes[0].tokens[0].conditions)
    .toEqual(['Cego', 'Asas']);
  await expect(
    pp
      .getByRole('group', { name: 'Ícones de condições' })
      .getByRole('button', { name: 'Asas', exact: true }),
  ).toBeDisabled();
  await pp.getByRole('button', { name: 'Fechar ações' }).click();
  await popup.getByRole('button', { name: 'Fechar ações' }).click();
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.reload();
    const pop = await open(page),
      box = (await pop.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    await expect(
      pop.getByRole('group', { name: 'Ícones de condições' }).getByRole('button'),
    ).toHaveCount(30);
    await pop.screenshot({ path: 'test-results/vtt-conditions-' + width + '.png' });
    await pop.getByRole('button', { name: 'Fechar ações' }).click();
  }
  expect(errors).toEqual([]);
  console.log(
    'PASS real VTT: twenty models/editor/private preview/apply/presets; thirty distinct conditions, custom legacy labels, GM toggle/save/reload, player adds only, spectator denied, four responsive widths.',
  );
} finally {
  await Promise.all(contexts.map((c) => c.close()));
  await browser.close();
  await new Promise<void>((r) => server.close(() => r()));
  await pool.end();
}
