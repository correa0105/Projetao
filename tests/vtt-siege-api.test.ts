import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pool } from '../server/db';
import { migrate } from '../server/migrate';
import { seed } from '../server/seed';
import { newToken, type VttState } from '../shared/vtt';
import { siegeImage, siegeDefinitions, type SiegeSnapshot } from '../shared/vtt-siege';
import { vttProtocolVersion } from '../shared/vtt-protocol';

test('cerco: mestre coloca; tripulação próxima carrega/mira/dispara; munição, ações, privacidade e repetição protegidas', async () => {
  const url = new URL(process.env.DATABASE_URL!);
  assert.match(url.pathname, /^\/alvorada_test_[0-9a-f]{32}$/);
  assert.notEqual(url.port, '5437');
  await migrate();
  await seed();
  const { createApp } = await import('../server/app'),
    server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', r));
  const a = server.address();
  assert(a && typeof a !== 'string');
  const origin = `http://127.0.0.1:${a.port}`,
    trusted = (process.env.APP_ORIGIN || 'http://localhost:3000').split(',')[0];
  type Account = { id: string; cookie: string };
  async function req(path: string, who?: Account, method = 'GET', body?: unknown) {
    const r = await fetch(origin + '/api' + path, {
      method,
      headers: {
        Origin: trusted,
        Cookie: who?.cookie || '',
        'Content-Type': 'application/json',
        'X-Vtt-Schema-Version': String(vttProtocolVersion),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: r.status, data: await r.json(), headers: r.headers };
  }
  async function signup(name: string): Promise<Account> {
    const r = await req('/auth/sign-up/email', undefined, 'POST', {
      name,
      email: randomUUID() + '@example.test',
      password: 'Test-' + randomUUID(),
    });
    assert.equal(r.status, 200);
    return {
      id: r.data.user.id,
      cookie: r.headers
        .getSetCookie()
        .map((s) => s.split(';')[0])
        .join('; '),
    };
  }
  try {
    const gm = await signup('Mestre do cerco'),
      player = await signup('Artilheiro'),
      spectator = await signup('Espectador do cerco');
    let room: VttState = (await req('/vtt', gm, 'POST', { name: 'Artilharia' })).data;
    const path = '/vtt/rooms/' + room.id,
      sid = room.document.activeScene;
    await req('/vtt/join', player, 'POST', { invite: room.invite, role: 'player' });
    await req('/vtt/join', spectator, 'POST', { invite: room.invite, role: 'spectator' });
    room = (await req(path, gm)).data;
    const s = room.document.scenes[0];
    s.width = 10000;
    s.height = 3000;
    s.grid.scale = 20;
    s.fog = s.lighting = false;
    const hero = newToken(randomUUID(), s),
      crew = newToken(randomUUID(), s),
      target = newToken(randomUUID(), s);
    Object.assign(hero, {
      name: 'Artilheiro',
      controller: player.id,
      x: 650,
      y: 700,
      hp: 100,
      maxHp: 100,
    });
    Object.assign(crew, {
      name: 'Ajudante',
      controller: gm.id,
      x: 680,
      y: 750,
      hp: 100,
      maxHp: 100,
    });
    Object.assign(target, { name: 'Alvo', x: 1000, y: 700, hp: 1000, maxHp: 1000, ac: 0 });
    s.tokens.push(hero, crew, target);
    const saved = await req(path, gm, 'PUT', { revision: room.revision, document: room.document });
    assert.equal(saved.status, 200);
    room = saved.data;
    const snap = async (who = gm) => (await req(path + '/siege', who)).data as SiegeSnapshot;
    const command = async (data: Record<string, unknown>, who = gm) => {
      const r = await req(path + '/siege', who, 'POST', {
        sceneId: sid,
        operationId: randomUUID(),
        ...data,
      });
      if (r.status === 200) room = r.data.room;
      return r;
    };
    assert.equal((await req(path + '/siege')).status, 401);
    assert.equal((await command({ kind: 'create', weaponKind: 'cannon' }, player)).status, 403);
    assert.equal((await command({ kind: 'create', weaponKind: 'cannon' }, spectator)).status, 403);
    let created = await command({
      kind: 'create',
      weaponKind: 'cannon',
      position: { x: 700, y: 700 },
    });
    assert.equal(created.status, 200, JSON.stringify(created.data));
    const cannon = created.data.weapons[0].id as string;
    created = await command({
      kind: 'create',
      weaponKind: 'harpoon',
      position: { x: 700, y: 740 },
    });
    assert.equal(created.status, 200);
    const harpoon = created.data.weapons.find((w: { id: string }) => w.id !== cannon).id as string;
    const get = async (id: string) => {
      const w = (await snap()).weapons.find((w) => w.id === id);
      assert(w);
      return w;
    };
    const operate = async (
      id: string,
      kind: 'load' | 'aim' | 'fire',
      who = player,
      actorId = hero.id,
      extra: Record<string, unknown> = {},
    ) =>
      command({ kind, weaponId: id, revision: (await get(id)).revision, actorId, ...extra }, who);
    const token = room.document.scenes[0].tokens.find((t) => t.id === cannon)!;
    assert.equal(token.ac, 19);
    assert.equal(token.hp, 75);
    assert.equal(token.bleeds, false);
    assert.equal((token.width / s.grid.size) * s.grid.scale, 10);
    assert.equal((await get(cannon)).ammo, 10);
    assert.equal((await operate(cannon, 'fire')).status, 409);
    assert.equal((await operate(cannon, 'load', player, crew.id)).status, 403);
    assert.equal(
      (await operate(cannon, 'aim', player, hero.id, { point: { x: target.x, y: target.y } }))
        .status,
      409,
    );
    const loadBody = {
      kind: 'load',
      weaponId: cannon,
      revision: (await get(cannon)).revision,
      actorId: hero.id,
      sceneId: sid,
      operationId: randomUUID(),
    };
    const load = await req(path + '/siege', player, 'POST', loadBody);
    assert.equal(load.status, 200);
    assert.equal((await get(cannon)).ammo, 9);
    assert.equal((await req(path + '/siege', player, 'POST', loadBody)).status, 200);
    assert.equal((await get(cannon)).ammo, 9);
    assert.equal(
      (await req(path + '/siege', player, 'POST', { ...loadBody, actorId: crew.id })).status,
      409,
    );
    assert.equal(
      (await operate(cannon, 'aim', player, hero.id, { point: { x: 10001, y: 700 } })).status,
      400,
    );
    assert.equal(
      (await operate(cannon, 'aim', player, hero.id, { point: { x: 9900, y: 700 } })).status,
      400,
    );
    assert.equal(
      (await operate(cannon, 'aim', player, hero.id, { point: { x: target.x, y: target.y } }))
        .status,
      200,
    );
    const fireRevision = (await get(cannon)).revision,
      fireBody = {
        kind: 'fire',
        weaponId: cannon,
        revision: fireRevision,
        actorId: hero.id,
        sceneId: sid,
        operationId: randomUUID(),
      };
    const shot = await req(path + '/siege', player, 'POST', fireBody);
    assert.equal(shot.status, 200);
    const fired = shot.data.weapons.find((w: { id: string }) => w.id === cannon);
    assert.equal(fired.stage, 'empty');
    assert.equal(fired.ammo, 9);
    assert.equal(fired.lastShot.kind, 'cannon');
    const messagesBefore = (await req(path, gm)).data.messages.length;
    assert.equal((await req(path + '/siege', player, 'POST', fireBody)).status, 200);
    assert.equal((await req(path, gm)).data.messages.length, messagesBefore);
    assert.equal((await get(cannon)).ammo, 9);
    if (fired.lastShot.hit) {
      const damage = shot.data.room.messages.findLast(
        (m: { damage?: { target_id: string } }) => m.damage?.target_id === target.id,
      );
      assert(damage);
      assert.equal(damage.roll.formula, fired.lastShot.critical ? '16d10' : '8d10');
      assert.equal(damage.roll.total, fired.lastShot.damage);
    }
    assert.equal((await operate(cannon, 'fire')).status, 409);
    // Harpoon art reflects its loading state; a full document save cannot reload it.
    assert.equal((await operate(harpoon, 'load')).status, 200);
    assert.equal(
      (await req(path, gm)).data.document.scenes[0].tokens.find(
        (t: { id: string }) => t.id === harpoon,
      ).image,
      siegeImage('harpoon', true),
    );
    assert.equal(
      (await operate(harpoon, 'aim', player, hero.id, { point: { x: 1050, y: 800 } })).status,
      200,
    );
    assert.equal((await operate(harpoon, 'fire')).status, 200);
    room = (await req(path, gm)).data;
    room.document.scenes[0].tokens.find((t) => t.id === harpoon)!.image = siegeImage(
      'harpoon',
      true,
    );
    const forgedImage = await req(path, gm, 'PUT', {
      revision: room.revision,
      document: room.document,
    });
    assert.equal(forgedImage.status, 200);
    assert.equal(
      forgedImage.data.document.scenes[0].tokens.find((t: { id: string }) => t.id === harpoon)
        .image,
      siegeImage('harpoon'),
    );
    assert.equal((await get(harpoon)).stage, 'empty');
    // Real initiative: one action per actor/turn across every gun, with cooperative crew.
    await req(path + '/combat', gm, 'POST', { kind: 'add', tokenIds: [hero.id, crew.id] });
    await req(path + '/combat', gm, 'POST', { kind: 'set', tokenId: hero.id, value: 20 });
    await req(path + '/combat', gm, 'POST', { kind: 'set', tokenId: crew.id, value: 10 });
    await req(path + '/combat', gm, 'POST', { kind: 'start' });
    assert.equal((await operate(cannon, 'load')).status, 200);
    assert.equal((await operate(harpoon, 'load')).status, 409);
    await req(path + '/combat', gm, 'POST', { kind: 'set', tokenId: hero.id, value: 21 });
    assert.equal(
      (await operate(cannon, 'aim', player, hero.id, { point: { x: 1000, y: 700 } })).status,
      409,
    );
    assert.equal((await command({ kind: 'extraAction', actorId: hero.id }, player)).status, 403);
    assert.equal((await command({ kind: 'extraAction', actorId: hero.id })).status, 200);
    assert.equal(
      (await operate(cannon, 'aim', player, hero.id, { point: { x: 1000, y: 700 } })).status,
      200,
    );
    assert.equal((await operate(cannon, 'fire')).status, 409);
    await req(path + '/combat', gm, 'POST', { kind: 'step', direction: 1 });
    assert.equal((await operate(cannon, 'fire')).status, 409);
    assert.equal(
      (await operate(cannon, 'aim', gm, crew.id, { point: { x: 1000, y: 700 } })).status,
      200,
    );
    await req(path + '/combat', gm, 'POST', { kind: 'step', direction: 1 });
    assert.equal((await operate(cannon, 'fire')).status, 200);
    await req(path + '/combat', gm, 'POST', { kind: 'end' });
    // Long range is disadvantage; an explicit advantage cancels it.
    await operate(cannon, 'load');
    await operate(cannon, 'aim', player, hero.id, { point: { x: 3500, y: 700 }, mode: 'normal' });
    let long = await operate(cannon, 'fire');
    assert.equal(long.status, 200);
    assert.equal(long.data.room.messages.at(-1).roll.formula, '2d20kl1+6');
    await operate(cannon, 'load');
    await operate(cannon, 'aim', player, hero.id, {
      point: { x: 3500, y: 700 },
      mode: 'advantage',
    });
    long = await operate(cannon, 'fire');
    assert.equal(long.data.room.messages.at(-1).roll.formula, '1d20+6');
    // Moving the weapon loses aim, without replenishing its chamber or reserves.
    await operate(cannon, 'load');
    await operate(cannon, 'aim', player, hero.id, { point: { x: 1000, y: 700 } });
    const stock = (await get(cannon)).ammo;
    room = (await req(path, gm)).data;
    room.document.scenes[0].tokens.find((t) => t.id === cannon)!.x += 10;
    const moved = await req(path, gm, 'PUT', { revision: room.revision, document: room.document });
    assert.equal(moved.status, 200);
    assert.equal((await get(cannon)).stage, 'loaded');
    assert.equal((await get(cannon)).ammo, stock);
    assert.equal((await operate(cannon, 'fire')).status, 409);
    // Hidden weapons and their shots never leak through the registry or public chat.
    room = (await req(path, gm)).data;
    room.document.scenes[0].tokens.find((t) => t.id === cannon)!.hidden = true;
    assert.equal(
      (await req(path, gm, 'PUT', { revision: room.revision, document: room.document })).status,
      200,
    );
    assert(!(await snap(player)).weapons.some((w) => w.id === cannon));
    await operate(cannon, 'aim', gm, crew.id, { point: { x: 1000, y: 700 } });
    assert.equal((await operate(cannon, 'fire', gm, crew.id)).status, 200);
    assert(
      !(await req(path, player)).data.messages.some(
        (m: { text: string }) => m.text.includes('Ajudante') && m.text.includes('Canhão'),
      ),
    );
    const w = await get(harpoon);
    assert.equal(
      (
        await command(
          { kind: 'settings', weaponId: harpoon, revision: w.revision, ammunition: 0, muted: true },
          player,
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await command({
          kind: 'settings',
          weaponId: harpoon,
          revision: w.revision,
          ammunition: 0,
          muted: true,
        })
      ).status,
      200,
    );
    assert.equal((await operate(harpoon, 'load')).status, 400);
    assert.equal(siegeDefinitions.harpoon.damage, '3d10');
    assert.equal(siegeDefinitions.cannon.longRange, 2400);
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
    await pool.end();
  }
});
