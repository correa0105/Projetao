import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pool } from '../server/db';
import { migrate } from '../server/migrate';
import { seed } from '../server/seed';
import { createLegacyTestCharacter } from './character-fixtures';
import { newToken } from '../shared/vtt';

test('blood follows authoritative damage, healing and movement; persists without hidden-position leaks', async () => {
  assert.match(new URL(process.env.DATABASE_URL!).pathname, /^\/alvorada_test_[0-9a-f]{32}$/);
  await migrate();
  await seed();
  const { createApp } = await import('../server/app');
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', r));
  const addr = server.address();
  assert.ok(addr && typeof addr !== 'string');
  const base = `http://127.0.0.1:${addr.port}/api`,
    origin = (process.env.APP_ORIGIN || 'http://localhost:3000').split(',')[0];
  type Account = { id: string; cookie: string };
  const request = async (path: string, who?: Account, method = 'GET', body?: unknown) => {
    const r = await fetch(base + path, {
      method,
      headers: {
        Origin: origin,
        Cookie: who?.cookie || '',
        'Content-Type': 'application/json',
        'X-Vtt-Schema-Version': '6',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: r.status, data: await r.json(), headers: r.headers };
  };
  const signup = async (name: string) => {
    const r = await request('/auth/sign-up/email', undefined, 'POST', {
      name,
      email: randomUUID() + '@example.test',
      password: 'Test-' + randomUUID(),
    });
    assert.equal(r.status, 200);
    return {
      id: r.data.user.id,
      cookie: r.headers
        .getSetCookie()
        .map((c) => c.split(';')[0])
        .join('; '),
    };
  };
  try {
    const gm = await signup('Mestre'),
      player = await signup('Jogador'),
      spectator = await signup('Observador');
    await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [gm.id]);
    const character = await createLegacyTestCharacter(player.id, 'Heroi');
    let room = (await request('/vtt', gm, 'POST', { name: 'Sangue' })).data;
    await request('/vtt/join', player, 'POST', { invite: room.invite });
    await request('/vtt/join', spectator, 'POST', { invite: room.invite, role: 'spectator' });
    const path = `/vtt/rooms/${room.id}`;
    room = (await request(path, gm)).data;
    const scene = room.document.scenes[0];
    scene.lighting = scene.fog = false;
    const hero = scene.tokens.find((t: any) => t.characterId === character.id);
    assert.ok(hero);
    Object.assign(hero, { hp: 100, maxHp: 100, x: 200, y: 200 });
    const monster = newToken(randomUUID(), scene);
    Object.assign(monster, { hp: 100, maxHp: 100, x: 600, y: 300 });
    scene.tokens.push(monster);
    let r = await request(path, gm, 'PUT', { revision: room.revision, document: room.document });
    assert.equal(r.status, 200);
    room = r.data;
    const getToken = (id: string) => room.document.scenes[0].tokens.find((t: any) => t.id === id);
    // Rolled damage applied twice is idempotent, including its blood decal.
    const rolled = await request(path + '/messages', gm, 'POST', {
      formula: '1d1+24',
      text: 'Dano',
    });
    assert.equal(rolled.status, 201);
    const messages = [rolled.data.createdMessageId];
    r = await request(path + '/damage', gm, 'POST', {
      token_id: monster.id,
      message_ids: messages,
    });
    assert.equal(r.status, 200);
    room = r.data;
    assert.equal(getToken(monster.id).hp, 75);
    assert.equal(room.document.scenes[0].blood.length, 1);
    const marks = structuredClone(room.document.scenes[0].blood);
    r = await request(path + '/damage', gm, 'POST', {
      token_id: monster.id,
      message_ids: messages,
    });
    assert.equal(r.status, 200);
    room = r.data;
    assert.deepEqual(room.document.scenes[0].blood, marks);
    // All monster HP changes through the normal document editor also reconcile blood.
    getToken(monster.id).hp = 50;
    getToken(monster.id).x = 850;
    r = await request(path, gm, 'PUT', { revision: room.revision, document: room.document });
    assert.equal(r.status, 200);
    room = r.data;
    assert.ok(room.document.scenes[0].blood.every((d: any) => d.kind === 'splash'));
    // The imported character's sheet and player's accepted path use the same authority.
    r = await request(path + `/sheets/${hero.id}/damage`, player, 'POST', { amount: 50 });
    assert.equal(r.status, 200);
    r = await request(path + `/tokens/${hero.id}`, player, 'PATCH', {
      x: 410,
      y: 400,
      path: [
        { x: 200, y: 400 },
        { x: 410, y: 400 },
      ],
    });
    assert.equal(r.status, 200);
    room = r.data;
    assert.equal(
      room.document.scenes[0].blood.filter((d: any) => d.source === hero.id && d.kind === 'splash')
        .length,
      1,
    );
    const wounded = structuredClone(getToken(hero.id).blood.wounds);
    r = await request(path + `/sheets/${hero.id}/heal`, gm, 'POST', { amount: 25 });
    assert.equal(r.status, 200);
    room = (await request(path, gm)).data;
    assert.ok(
      getToken(hero.id).blood.wounds.every((w: any, i: number) => w.strength < wounded[i].strength),
    );
    assert.equal(
      (await request(path + `/sheets/${hero.id}/heal`, player, 'POST', { amount: 10 })).status,
      403,
    );
    const beforeHeal = room.document.scenes[0].blood.length;
    r = await request(path + `/sheets/${hero.id}/restore`, gm, 'POST', { kind: 'hp' });
    assert.equal(r.status, 200);
    room = (await request(path, gm)).data;
    assert.deepEqual(getToken(hero.id).blood.wounds, []);
    assert.equal(room.document.scenes[0].blood.length, beforeHeal);
    assert.equal((await request(path + '/blood/clear', player, 'POST', {})).status, 403);
    assert.equal((await request(path + '/blood/clear', spectator, 'POST', {})).status, 403);
    // Hidden creature trails are not sent to players, even when the floor is otherwise visible.
    getToken(monster.id).hidden = true;
    getToken(monster.id).hp = 25;
    getToken(monster.id).x = 1000;
    r = await request(path, gm, 'PUT', { revision: room.revision, document: room.document });
    assert.equal(r.status, 200);
    room = r.data;
    const publicState = (await request(path, player)).data;
    assert.ok(publicState.document.scenes[0].blood.every((d: any) => d.source !== monster.id));
    // Fog also hides marks from one's own token: the mark has no ownership sight privilege.
    const s = room.document.scenes[0];
    s.fog = true;
    s.fogMode = 'manual';
    s.reveals = [];
    r = await request(path, gm, 'PUT', { revision: room.revision, document: room.document });
    assert.equal(r.status, 200);
    assert.equal((await request(path, player)).data.document.scenes[0].blood.length, 0);
    // A failed move/forged field never adds blood.
    assert.equal(
      (await request(path + `/tokens/${hero.id}`, player, 'PATCH', { x: 17000, y: 200 })).status,
      400,
    );
    assert.equal(
      (
        await request(path + `/tokens/${hero.id}`, player, 'PATCH', {
          blood: { serial: 1, distance: 0, wounds: [] },
        })
      ).status,
      400,
    );
    room = (await request(path, gm)).data;
    assert.equal(room.document.automaticDeath, true);
    room.document.bloodEnabled = false;
    room.document.automaticDeath = false;
    assert.equal(
      (await request(path, player, 'PUT', { revision: room.revision, document: room.document }))
        .status,
      403,
    );
    r = await request(path, gm, 'PUT', { revision: room.revision, document: room.document });
    assert.equal(r.status, 200);
    room = r.data;
    const markCount = room.document.scenes[0].blood.length;
    getToken(monster.id).hp = 0;
    r = await request(path, gm, 'PUT', { revision: room.revision, document: room.document });
    assert.equal(r.status, 200);
    room = r.data;
    assert.equal(room.document.scenes[0].blood.length, markCount);
    assert.equal(getToken(monster.id).deathAt, null);
    const rejoined = (await request(path, gm)).data.document;
    assert.equal(rejoined.bloodEnabled, false);
    assert.equal(rejoined.automaticDeath, false);
    delete room.document.bloodEnabled;
    delete room.document.automaticDeath;
    r = await request(path, gm, 'PUT', { revision: room.revision, document: room.document });
    assert.equal(r.status, 200);
    assert.equal(
      r.data.document.bloodEnabled,
      false,
      'omitted settings never reset a saved choice',
    );
    assert.equal(r.data.document.automaticDeath, false);
    const stale = await fetch(base + path, {
      method: 'PUT',
      headers: {
        Origin: origin,
        Cookie: gm.cookie,
        'Content-Type': 'application/json',
        'X-Vtt-Schema-Version': '2',
      },
      body: JSON.stringify({ revision: r.data.revision, document: r.data.document }),
    });
    assert.equal(stale.status, 409);
    assert.match((await stale.json()).error, /Recarregue/);
    r = await request(path + '/blood/clear', gm, 'POST', {});
    assert.equal(r.status, 200);
    assert.equal(r.data.document.scenes[0].blood.length, 0);
    assert.equal((await request(path, gm)).data.document.scenes[0].blood.length, 0);
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
    await pool.end();
  }
});
