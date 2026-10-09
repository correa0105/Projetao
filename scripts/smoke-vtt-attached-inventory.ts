import 'dotenv/config';
import { chromium, expect, type BrowserContext } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { newToken, type VttScene } from '../shared/vtt';
import { vttProtocolVersion } from '../shared/vtt-protocol';
if (!/^\/alvorada_test_[0-9a-f]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))
  throw Error('Disposable database required');
const origin = 'http://localhost:3050';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db'),
  { migrate } = await import('../server/migrate'),
  { seed } = await import('../server/seed'),
  { createLegacyTestCharacter } = await import('../tests/character-fixtures');
await migrate();
await seed();
const { createApp } = await import('../server/app'),
  server = createApp().listen(3050, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));
const browser = await chromium.launch({ channel: 'msedge', headless: true }),
  contexts = await Promise.all(
    [0, 1, 2].map(() =>
      browser.newContext({
        viewport: { width: 1440, height: 1000 },
        extraHTTPHeaders: { 'X-Vtt-Schema-Version': String(vttProtocolVersion) },
      }),
    ),
  ),
  [gm, player, spectator] = contexts;
const page = await player.newPage(),
  errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
async function api(ctx: BrowserContext, path: string, method = 'GET', data?: unknown) {
  const r = await ctx.request.fetch(origin + '/api' + path, {
    method,
    headers: { Origin: origin },
    data,
  });
  return {
    status: r.status(),
    data: r.headers()['content-type']?.includes('json') ? await r.json() : null,
  };
}
async function signup(ctx: BrowserContext, name: string) {
  const r = await api(ctx, '/auth/sign-up/email', 'POST', {
    name,
    email: randomUUID() + '@example.test',
    password: 'Test-' + randomUUID(),
  });
  expect(r.status).toBe(200);
  return r.data.user;
}
await mkdir('test-results', { recursive: true });
try {
  const master = await signup(gm, 'Mestre'),
    user = await signup(player, 'Jogador'),
    watcher = await signup(spectator, 'Visitante');
  await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [master.id]);
  const character = await createLegacyTestCharacter(user.id, 'Cavaleiro'),
    foreign = await createLegacyTestCharacter(watcher.id, 'Outro');
  let room = (await api(gm, '/vtt', 'POST', { name: 'Montaria e régua' })).data;
  const root = '/vtt/rooms/' + room.id;
  expect((await api(player, '/vtt/join', 'POST', { invite: room.invite })).status).toBe(200);
  expect(
    (await api(spectator, '/vtt/join', 'POST', { invite: room.invite, role: 'spectator' })).status,
  ).toBe(200);
  room = (await api(gm, root)).data;
  let scene: VttScene = room.document.scenes[0];
  scene.width = 1400;
  scene.height = 1000;
  scene.fog = scene.lighting = false;
  scene.grid = { ...scene.grid, size: 100, scale: 5, unit: 'ft', diagonal: 'euclidean' };
  const horse = {
      ...newToken(randomUUID(), scene),
      name: 'Cavalo de guerra',
      controller: user.id,
      x: 400,
      y: 400,
      width: 200,
      height: 200,
      level: 10,
    },
    rider = {
      ...newToken(randomUUID(), scene),
      name: 'Cavaleiro',
      characterId: character.id,
      controller: user.id,
      x: 500,
      y: 500,
      width: 100,
      height: 100,
      level: -10,
      hp: 12,
      maxHp: 12,
    },
    enemy = {
      ...newToken(randomUUID(), scene),
      name: 'Inimigo',
      controller: master.id,
      x: 1100,
      y: 700,
    };
  scene.tokens = [rider, horse, enemy];
  const save = async () => {
    const r = await api(gm, root, 'PUT', { revision: room.revision, document: room.document });
    expect(r.status, JSON.stringify(r.data)).toBe(200);
    room = r.data;
    scene = room.document.scenes[0];
  };
  await save();
  const bind = (ctx: BrowserContext, child: string, parent: string | null) =>
    api(ctx, root + '/tokens/' + child + '/attachment', 'POST', { tokenId: parent });
  expect((await bind(spectator, rider.id, horse.id)).status).toBe(403);
  expect((await bind(player, rider.id, enemy.id)).status).toBe(403);
  expect((await bind(player, rider.id, horse.id)).status).toBe(200);
  room = (await api(gm, root)).data;
  scene = room.document.scenes[0];
  expect(scene.tokens.find((t) => t.id === rider.id)?.x).toBe(400);
  expect((await bind(player, horse.id, rider.id)).status).toBe(400);
  const patch = (id: string, data: unknown) => api(player, root + '/tokens/' + id, 'PATCH', data);
  expect((await patch(rider.id, { x: 600, y: 400 })).status).toBe(400);
  expect(
    (
      await patch(horse.id, {
        x: 600,
        y: 400,
        path: [
          { x: 500, y: 400 },
          { x: 600, y: 400 },
        ],
      })
    ).status,
  ).toBe(200);
  room = (await api(gm, root)).data;
  scene = room.document.scenes[0];
  expect(scene.tokens.filter((t) => [horse.id, rider.id].includes(t.id)).map((t) => t.x)).toEqual([
    600, 600,
  ]);
  expect((await patch(rider.id, { hp: 9, rotation: 45 })).status).toBe(200);
  expect((await api(player, root + '/sheets/' + rider.id)).status).toBe(200);
  const attack = await api(player, root + '/messages', 'POST', {
    formula: '1d20+4',
    attack_visual: { actor_id: rider.id, target_id: enemy.id, kind: 'sword', weapon: 'sword' },
  });
  expect(attack.status, JSON.stringify(attack.data)).toBe(201);
  room = (await api(gm, root)).data;
  scene = room.document.scenes[0];
  const linked = scene.tokens.find((t) => t.id === rider.id)!;
  expect([linked.hp, linked.rotation, linked.characterId, linked.controller]).toEqual([
    9,
    45,
    character.id,
    user.id,
  ]);
  scene.tokens.find((t) => t.id === horse.id)!.hidden = true;
  await save();
  expect(
    (await api(player, root)).data.document.scenes[0].tokens.some((t: any) =>
      [horse.id, rider.id].includes(t.id),
    ),
  ).toBe(false);
  expect((await api(player, root + '/sheets/' + rider.id)).status).toBeGreaterThanOrEqual(400);
  scene.tokens.find((t) => t.id === horse.id)!.hidden = false;
  scene.walls = [
    { id: randomUUID(), a: { x: 750, y: 0 }, b: { x: 750, y: 1000 }, kind: 'wall', open: false },
  ];
  await save();
  expect((await patch(horse.id, { x: 900, y: 400, path: [{ x: 900, y: 400 }] })).status).toBe(400);
  scene.walls = [];
  scene.tokens.find((t) => t.id === horse.id)!.locked = true;
  await save();
  expect((await patch(horse.id, { x: 700, y: 400 })).status).toBe(403);
  scene.tokens.find((t) => t.id === horse.id)!.locked = false;
  await save();
  expect((await bind(player, rider.id, null)).status).toBe(200);
  expect((await patch(horse.id, { x: 700, y: 400 })).status).toBe(200);
  room = (await api(gm, root)).data;
  expect(room.document.scenes[0].tokens.find((t: any) => t.id === rider.id).x).toBe(600);
  expect((await bind(player, rider.id, horse.id)).status).toBe(200);
  // Ordinary click opens actions; a held right drag measures and moves the base.
  await page.goto(origin + '/#vtt');
  const board = page.getByLabel('Tabuleiro da mesa', { exact: true });
  await expect(board).toBeVisible();
  async function point(x: number, y: number) {
    const b = (await board.boundingBox())!,
      cx = Number(await board.getAttribute('data-camera-x')),
      cy = Number(await board.getAttribute('data-camera-y')),
      z = Number(await board.getAttribute('data-camera-zoom'));
    return { x: b.x + b.width / 2 + (x - cx) * z, y: b.y + b.height / 2 + (y - cy) * z };
  }
  async function measuredDrag(startX: number, endX: number, label: string) {
    const a = await point(startX, 400),
      b = await point(endX, 400);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down({ button: 'right' });
    await page.mouse.move(b.x, b.y, { steps: 14 });
    await expect(page.getByLabel('Distância medida')).toHaveText(label);
    await page.screenshot({
      path: 'test-results/vtt-right-drag-' + label.replace(' ', '') + '.png',
    });
    await page.mouse.up({ button: 'right' });
    await expect(page.locator('.vtt-context-menu')).toHaveCount(0);
    await expect
      .poll(async () => {
        const r = (await api(player, root)).data;
        return r.document.scenes[0].tokens.find((t: any) => t.id === horse.id).x;
      })
      .toBe(endX);
  }
  await measuredDrag(700, 1000, '15 ft');
  let p = await point(1000, 400);
  await page.mouse.click(p.x, p.y, { button: 'right' });
  await expect(page.locator('.vtt-context-menu')).toBeVisible();
  await expect(page.getByLabel('Token de apoio')).toHaveValue(horse.id);
  await page.getByRole('button', { name: 'Abrir ficha', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Fechar ficha', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Fechar ficha', exact: true }).click();
  await page.getByRole('button', { name: 'Régua (R)', exact: true }).click();
  let a = await point(400, 700),
    b = await point(700, 700);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 10 });
  await expect(page.getByLabel('Distância medida')).toHaveText('15 ft');
  await page.mouse.up();
  await page.getByRole('button', { name: 'Selecionar (V)', exact: true }).click();
  room = (await api(gm, root)).data;
  scene = room.document.scenes[0];
  scene.grid.scale = 10;
  await save();
  await page.reload();
  await expect(board).toBeVisible();
  await measuredDrag(1000, 700, '30 ft');
  for (const width of [768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(
      page.getByRole('button', { name: 'Vincular sobre outro token', exact: true }),
    ).toBeVisible();
    await page.screenshot({ path: 'test-results/vtt-attached-' + width + '.png' });
  }
  // Individual bags use allocations, conserve stock, and never share equipped copies.
  const mountId = randomUUID(),
    petId = randomUUID(),
    otherPet = randomUUID();
  await pool.query(
    "INSERT INTO character_mounts(id,character_id,mount_id,name,price_cp,idempotency_key)VALUES($1,$2,'warhorse','Trovão',10000,$3)",
    [mountId, character.id, randomUUID()],
  );
  await pool.query(
    "INSERT INTO character_pets(id,character_id,pet_id,name,price_cp,idempotency_key)VALUES($1,$2,'dog','Nuvem',100,$3),($4,$5,'cat','Alheio',100,$6)",
    [petId, character.id, randomUUID(), otherPet, foreign.id, randomUUID()],
  );
  await pool.query(
    "INSERT INTO inventory(character_id,item_id,quantity)VALUES($1,'longsword',4),($1,'dagger',2),($1,'saddle-riding',1)",
    [character.id],
  );
  const transfer = async (
    source: string,
    destination: string,
    item_id = 'longsword',
    quantity = 1,
    key = randomUUID(),
  ) =>
    api(player, '/inventory/bags/transfers', 'POST', {
      character_id: character.id,
      item_id,
      source,
      destination,
      quantity,
      idempotency_key: key,
    });
  expect((await transfer('character', otherPet)).status).toBe(404);
  const key = randomUUID();
  expect((await transfer('character', mountId, 'longsword', 2, key)).status).toBe(200);
  expect((await transfer('character', mountId, 'longsword', 2, key)).data.replayed).toBe(true);
  expect((await transfer('character', petId, 'longsword', 1, key)).status).toBe(409);
  expect((await transfer(mountId, petId)).status).toBe(200);
  expect((await transfer(petId, 'vault')).status).toBe(200);
  expect((await transfer('vault', petId)).status).toBe(200);
  expect((await transfer('character', mountId, 'saddle-riding')).status).toBe(200);
  expect(
    (
      await api(player, '/companions/' + character.id + '/equipment', 'PUT', {
        kind: 'mount',
        companion_id: mountId,
        slot: 'saddle',
        item_id: 'saddle-riding',
      })
    ).status,
  ).toBe(200);
  expect((await transfer(mountId, 'character', 'saddle-riding')).status).toBe(409);
  expect((await transfer(mountId, 'discard', 'saddle-riding')).status).toBe(409);
  expect(
    (
      await api(player, '/inventory/transfers', 'POST', {
        character_id: character.id,
        item_id: 'saddle-riding',
        direction: 'to_vault',
        quantity: 1,
        idempotency_key: randomUUID(),
      })
    ).status,
  ).toBe(409);
  expect((await transfer(mountId, 'discard', 'longsword')).status).toBe(200);
  let storage = (await api(player, '/characters/' + character.id + '/storage')).data;
  expect(storage.inventory.find((i: any) => i.id === 'longsword').quantity).toBe(3);
  expect(storage.companion_allocated.longsword).toBe(1);
  expect(
    storage.companions
      .find((c: any) => c.id === petId)
      .inventory.find((i: any) => i.id === 'longsword').quantity,
  ).toBe(1);
  expect(
    storage.companions
      .find((c: any) => c.id === mountId)
      .inventory.find((i: any) => i.id === 'saddle-riding').equipped_quantity,
  ).toBe(1);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(origin + '/#inventory');
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Transferir entre inventários', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Montaria', exact: true }).click();
  await expect(page.getByRole('heading', { name: /^Mochila · Trovão/ })).toBeVisible();
  await expect(
    page
      .getByRole('region', { name: 'Itens da mochila', exact: true })
      .getByRole('button', { name: /Espada longa/ }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Mascote', exact: true }).click();
  await expect(page.getByRole('heading', { name: /^Mochila · Nuvem/ })).toBeVisible();
  await expect(
    page
      .getByRole('region', { name: 'Itens da mochila', exact: true })
      .getByRole('button', { name: 'Espada longa, quantidade 1', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Transferir entre inventários', exact: true }).click();
  await page.getByLabel('Inventário de origem').selectOption(petId);
  await page.getByLabel('Inventário de destino').selectOption(mountId);
  await page.getByRole('button', { name: 'Transferir itens', exact: true }).click();
  await expect(
    page.getByRole('dialog', { name: 'Transferir entre inventários', exact: true }),
  ).toHaveCount(0);
  await expect(
    page
      .getByRole('region', { name: 'Itens da mochila', exact: true })
      .getByRole('button', { name: /Espada longa/ }),
  ).toHaveCount(0);
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.screenshot({ path: 'test-results/inventory-bags-' + width + '.png' });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
  }
  expect(errors).toEqual([]);
  console.log(
    'PASS attachment ownership/cycles/visibility/walls/independent actions; right drag 5/10ft and common ruler; individual bags, stock conservation, equipped protection, replay and browser1440/768/390.',
  );
} finally {
  await Promise.all(contexts.map((c) => c.close()));
  await browser.close();
  await new Promise<void>((r) => server.close(() => r()));
  await pool.end();
}
