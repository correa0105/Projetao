import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { pool } from '../server/db.js';
import { migrate } from '../server/migrate.js';
import { seed } from '../server/seed.js';
import { createLegacyTestCharacter } from './character-fixtures.js';
import { purchaseContents } from '../shared/armor-bundles.js';
import type { TagReward } from '../shared/mission-tags.js';
if (!new URL(process.env.DATABASE_URL!).pathname.startsWith('/alvorada_test_'))
  throw Error('Banco descartável obrigatório.');
let server: Server, base: string;
const users: string[] = [],
  rules: string[] = [],
  tagIds: string[] = [],
  titleIds: string[] = [];
type Client = { cookie: string; id: string };
const origin = (process.env.APP_ORIGIN || 'http://localhost:3000').split(',')[0];
async function request(
  path: string,
  client: Client,
  body?: unknown,
  method = body ? 'POST' : 'GET',
) {
  const response = await fetch(base + '/api' + path, {
    method,
    headers: { 'Content-Type': 'application/json', Origin: origin, Cookie: client.cookie },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, data: await response.json() };
}
async function signup(admin = false): Promise<Client> {
  const register = () =>
    fetch(base + '/api/auth/sign-up/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: origin },
      body: JSON.stringify({
        name: 'Tags de teste',
        email: 'tags-' + randomUUID() + '@example.test',
        password: 'Test-' + randomUUID(),
      }),
    });
  let response = await register();
  for (let attempt = 0; response.status === 429 && attempt < 4; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 10500));
    response = await register();
  }
  assert.equal(response.status, 200);
  const data = await response.json();
  users.push(data.user.id);
  if (admin) await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [data.user.id]);
  return {
    id: data.user.id,
    cookie: response.headers
      .getSetCookie()
      .map((c) => c.split(';')[0])
      .join('; '),
  };
}
before(async () => {
  await migrate();
  await seed();
  const { createApp } = await import('../server/app.js');
  server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', r));
  const address = server.address();
  assert(address && typeof address !== 'string');
  base = 'http://127.0.0.1:' + address.port;
});
after(async () => {
  await pool.query('DELETE FROM tag_achievement_grants WHERE code=ANY($1::text[])', [rules]);
  await pool.query('DELETE FROM achievements WHERE code=ANY($1::text[])', [rules]);
  await pool.query('DELETE FROM tag_achievements WHERE code=ANY($1::text[])', [rules]);
  await pool.query('DELETE FROM board_posts WHERE author_id=ANY($1::text[])', [users]);
  await pool.query('DELETE FROM character_tag_credits WHERE tag_id=ANY($1::uuid[])', [tagIds]);
  await pool.query('DELETE FROM character_tag_totals WHERE tag_id=ANY($1::uuid[])', [tagIds]);
  await pool.query('DELETE FROM mission_tags WHERE id=ANY($1::uuid[])', [tagIds]);
  await pool.query('DELETE FROM character_title_log WHERE title_id=ANY($1::uuid[])', [titleIds]);
  await pool.query('DELETE FROM character_titles WHERE title_id=ANY($1::uuid[])', [titleIds]);
  await pool.query('DELETE FROM title_catalog WHERE id=ANY($1::uuid[])', [titleIds]);
  await pool.query(
    'DELETE FROM house_items WHERE character_id IN(SELECT id FROM characters WHERE user_id=ANY($1::text[]))',
    [users],
  );
  await pool.query('DELETE FROM vtt_rooms WHERE owner_id=ANY($1::text[])', [users]);
  await pool.query('DELETE FROM "user" WHERE id=ANY($1::text[])', [users]);
  await new Promise<void>((r, j) => server.close((e) => (e ? j(e) : r())));
  await pool.end();
});
async function tag(admin: Client, name: string) {
  const r = await request('/mission-tags/catalog', admin, {
    name,
    description: 'Uma tag de teste',
    active: true,
  });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  tagIds.push(r.data.id);
  return r.data;
}
async function rule(
  admin: Client,
  tag_id: string,
  target: string,
  rewards: Omit<TagReward, 'name'>[] = [],
) {
  const r = await request('/mission-tags/achievements', admin, {
    tag_id,
    target,
    title: 'Conquista ' + target,
    description: 'Uma conquista de teste',
    active: true,
    rewards,
  });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  rules.push(r.data.code);
  return r.data;
}
async function mission(
  author: Client,
  ids: string[],
  participants: { owner: Client; id: string }[],
) {
  const r = await request('/board', author, {
    kind: 'mission',
    title: 'Missão de tags',
    description: 'Uma missão para testar as tags.',
    location: 'Teste',
    difficulty: 'Moderada',
    mission_rank: 'Ferro',
    starts_at: new Date(Date.now() + 3600000).toISOString(),
    tag_ids: ids,
  });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  for (const p of participants)
    assert.equal(
      (await request('/board/' + r.data.id + '/join', p.owner, { character_id: p.id })).status,
      200,
    );
  assert.equal(
    (await request('/board/' + r.data.id, author, { status: 'active' }, 'PATCH')).status,
    200,
  );
  return r.data.id;
}
const completion = (ids: string[]) => ({
  summary: 'Todos retornaram da missão de teste.',
  rewards: ids.map((character_id) => ({ character_id })),
});
test('Missões: uma tag por participante, entrega mista atômica, repetição, concorrência e continuidade', async () => {
  const admin = await signup(true),
    player = await signup(),
    outsider = await signup();
  const c = await createLegacyTestCharacter(player.id, 'Portador'),
    other = await createLegacyTestCharacter(outsider.id, 'Companheiro'),
    idle = await createLegacyTestCharacter(player.id, 'Ausente');
  const goblin = await tag(admin, 'Goblin ' + randomUUID()),
    forest = await tag(admin, 'Floresta ' + randomUUID());
  const title = await request('/titles/catalog', admin, {
    name: 'Amigo dos Goblins',
    description: 'Reconhecimento de teste',
    symbol: 'shield',
    tone: 'silver',
    goal: { kind: 'manual', target: 1, achievement: '' },
  });
  assert.equal(title.status, 201);
  titleIds.push(title.data.id);
  const goal = await rule(admin, goblin.id, '2', [
    { kind: 'title', ref: title.data.id, quantity: 1 },
    { kind: 'item', ref: 'plate-armor', quantity: 1 },
    { kind: 'house', ref: 'chair', quantity: 1 },
  ]);
  const first = await mission(
    admin,
    [goblin.id, forest.id],
    [
      { owner: player, id: c.id },
      { owner: outsider, id: other.id },
    ],
  );
  assert.equal(
    (await request('/board/' + first + '/complete', player, completion([c.id, other.id]))).status,
    403,
  );
  assert.equal((await request('/characters/' + c.id + '/tags', outsider)).status, 404);
  assert.deepEqual((await request('/characters/' + c.id + '/tags', player)).data.totals, []);
  assert.equal(
    (await request('/board/' + first + '/complete', admin, completion([c.id, other.id]))).status,
    200,
  );
  assert.equal(
    (await request('/board/' + first + '/tags', admin, { tag_ids: [] }, 'PATCH')).status,
    409,
  );
  let state = (await request('/characters/' + c.id + '/tags', player)).data;
  assert.equal(state.totals.find((t: { tag_id: string }) => t.tag_id === goblin.id).total, '1');
  assert.equal(state.grants.length, 0);
  assert.equal((await request('/characters/' + idle.id + '/tags', player)).data.totals.length, 0);
  const second = await mission(
    admin,
    [goblin.id],
    [
      { owner: player, id: c.id },
      { owner: outsider, id: other.id },
    ],
  );
  const settled = await Promise.all([
    request('/board/' + second + '/complete', admin, completion([c.id, other.id])),
    request('/board/' + second + '/complete', admin, completion([c.id, other.id])),
  ]);
  assert.deepEqual(settled.map((r) => r.status).sort(), [200, 409]);
  state = (await request('/characters/' + c.id + '/tags', player)).data;
  assert.equal(state.totals.find((t: { tag_id: string }) => t.tag_id === goblin.id).total, '2');
  assert.equal(state.grants.length, 1);
  for (const character of [c, other]) {
    const pieces = (
      await pool.query(
        'SELECT item_id,quantity FROM inventory WHERE character_id=$1 AND item_id=ANY($2::text[])',
        [character.id, purchaseContents('plate-armor')],
      )
    ).rows;
    assert.equal(pieces.length, 6);
    assert(pieces.every((p) => p.quantity === 1));
    assert.equal(
      (
        await pool.query("SELECT 1 FROM house_items WHERE character_id=$1 AND catalog_id='chair'", [
          character.id,
        ])
      ).rowCount,
      1,
    );
    assert.equal(
      (
        await pool.query('SELECT 1 FROM character_titles WHERE character_id=$1 AND title_id=$2', [
          character.id,
          title.data.id,
        ])
      ).rowCount,
      1,
    );
  }
  await Promise.all(
    Array.from({ length: 5 }, () => request('/characters/' + c.id + '/tags', player)),
  );
  assert.equal(
    (
      await pool.query("SELECT 1 FROM house_items WHERE character_id=$1 AND catalog_id='chair'", [
        c.id,
      ])
    ).rowCount,
    1,
  );
  const earned = (await request('/characters/' + c.id + '/achievements', player)).data;
  assert(earned.unlocked.some((a: { code: string }) => a.code === goal.code));
  assert.equal(earned.progress[goal.code].exact_current, '2');
  assert.equal(
    (
      await request('/characters/' + c.id + '/achievements', player, {
        material: 'walnut',
        medal_frame: 'bronze',
        slots: [goal.code],
        positions: [40],
        rows: [1],
      })
    ).status,
    200,
  );
  const forbidden = {
    tag_id: goblin.id,
    target: '3',
    title: goal.title,
    description: goal.description,
    active: true,
    rewards: [],
    revision: goal.revision,
  };
  assert.equal(
    (await request('/mission-tags/achievements/' + goal.code, admin, forbidden, 'PUT')).status,
    409,
  );
  const third = await mission(admin, [goblin.id], [{ owner: player, id: c.id }]);
  assert.equal(
    (await request('/board/' + third + '/complete', admin, completion([c.id]))).status,
    200,
  );
  state = (await request('/characters/' + c.id + '/tags', player)).data;
  assert.equal(state.totals.find((t: { tag_id: string }) => t.tag_id === goblin.id).total, '3');
  assert.equal(state.grants.length, 1);
  await pool.query('DELETE FROM board_posts WHERE id=$1', [first]);
  assert.equal(
    (await request('/characters/' + c.id + '/tags', player)).data.totals.find(
      (t: { tag_id: string }) => t.tag_id === goblin.id,
    ).total,
    '3',
  );
});
test('Administração: permissões, catálogo confiável, tags duplicadas, edição e arquivamento', async () => {
  const admin = await signup(true),
    player = await signup(),
    t = await tag(admin, 'Dragão ' + randomUUID());
  assert.equal(
    (await request('/mission-tags/catalog', player, { name: 'Livre', active: true })).status,
    403,
  );
  assert.equal((await request('/mission-tags/reward-options', player)).status, 403);
  assert.equal(
    (
      await request('/mission-tags/catalog', admin, {
        name: t.name.normalize('NFD').replace(/[\u0300-\u036f]/g, ''),
        active: true,
      })
    ).status,
    409,
  );
  const payload = {
    tag_id: t.id,
    target: '1',
    title: 'Inválida',
    description: '',
    active: true,
    rewards: [{ kind: 'item', ref: 'does-not-exist', quantity: 1 }],
  };
  assert.equal((await request('/mission-tags/achievements', admin, payload)).status, 400);
  assert.equal(
    (await request('/mission-tags/achievements', player, { ...payload, rewards: [] })).status,
    403,
  );
  assert.equal(
    (await request('/mission-tags/achievements', admin, { ...payload, rewards: [], target: '0' }))
      .status,
    400,
  );
  assert.equal(
    (
      await request('/mission-tags/achievements', admin, {
        ...payload,
        rewards: [{ kind: 'house', ref: 'chair', quantity: 1, name: 'Spoof' }],
      })
    ).status,
    400,
  );
  const make = {
    kind: 'mission',
    title: 'Tags inválidas',
    description: 'Um teste de seleção de tags.',
    location: 'Teste',
    difficulty: 'Moderada',
    starts_at: new Date(Date.now() + 3600000).toISOString(),
  };
  assert.equal((await request('/board', player, { ...make, tag_ids: [t.id, t.id] })).status, 400);
  assert.equal((await request('/board', player, { ...make, tag_ids: [randomUUID()] })).status, 400);
  assert.equal(
    (await request('/board', admin, { ...make, kind: 'event', tag_ids: [t.id] })).status,
    400,
  );
  const m = await mission(player, [], []);
  assert.equal(
    (await request('/board/' + m + '/tags', admin, { tag_ids: [t.id] }, 'PATCH')).status,
    200,
  );
  assert.equal(
    (await request('/board/' + m + '/tags', await signup(), { tag_ids: [] }, 'PATCH')).status,
    403,
  );
  const updated = await request(
    '/mission-tags/catalog/' + t.id,
    admin,
    { name: t.name, description: '', active: false, revision: t.revision },
    'PUT',
  );
  assert.equal(updated.status, 200);
  assert.equal(
    (
      await request(
        '/mission-tags/catalog/' + t.id,
        admin,
        { name: t.name, description: '', active: true, revision: t.revision },
        'PUT',
      )
    ).status,
    409,
  );
  assert.equal((await request('/board', player, { ...make, tag_ids: [t.id] })).status, 400);
});
test('Contagem exata além do limite de inteiro seguro e novas metas retroativas sem repetição', async () => {
  const admin = await signup(true),
    player = await signup(),
    c = await createLegacyTestCharacter(player.id),
    t = await tag(admin, 'Infinita ' + randomUUID());
  await pool.query('INSERT INTO character_tag_totals(character_id,tag_id,total) VALUES($1,$2,$3)', [
    c.id,
    t.id,
    '9007199254740993',
  ]);
  const goal = await rule(admin, t.id, '9007199254740994');
  const m = await mission(admin, [t.id], [{ owner: player, id: c.id }]);
  assert.equal((await request('/board/' + m + '/complete', admin, completion([c.id]))).status, 200);
  const state = (await request('/characters/' + c.id + '/tags', player)).data;
  assert.equal(state.totals[0].total, '9007199254740994');
  assert.equal(state.grants[0].code, goal.code);
  const retro = await rule(admin, t.id, '5', [{ kind: 'house', ref: 'chair', quantity: 2 }]);
  await Promise.all([
    request('/characters/' + c.id + '/achievements', player),
    request('/characters/' + c.id + '/tags', player),
  ]);
  assert.equal(
    (
      await pool.query('SELECT 1 FROM tag_achievement_grants WHERE character_id=$1 AND code=$2', [
        c.id,
        retro.code,
      ])
    ).rowCount,
    1,
  );
  assert.equal(
    (
      await pool.query("SELECT 1 FROM house_items WHERE character_id=$1 AND catalog_id='chair'", [
        c.id,
      ])
    ).rowCount,
    2,
  );
});
test('Recompensa inválida por capacidade desfaz tags, conquista, ouro e conclusão juntos', async () => {
  const admin = await signup(true),
    player = await signup(),
    c = await createLegacyTestCharacter(player.id),
    t = await tag(admin, 'Limite ' + randomUUID());
  const goal = await rule(admin, t.id, '1', [
    { kind: 'house', ref: 'chair', quantity: 1 },
    { kind: 'item', ref: 'plate-armor', quantity: 1 },
  ]);
  await pool.query(
    'INSERT INTO inventory(character_id,item_id,quantity) VALUES($1,$2,2147483647)',
    [c.id, 'plate-armor'],
  );
  const before = (
    await pool.query('SELECT gold_cp,progression_missions FROM characters WHERE id=$1', [c.id])
  ).rows[0];
  const m = await mission(admin, [t.id], [{ owner: player, id: c.id }]);
  assert.equal((await request('/board/' + m + '/complete', admin, completion([c.id]))).status, 409);
  assert.deepEqual(
    (await pool.query('SELECT gold_cp,progression_missions FROM characters WHERE id=$1', [c.id]))
      .rows[0],
    before,
  );
  assert.equal(
    (await pool.query('SELECT status FROM board_posts WHERE id=$1', [m])).rows[0].status,
    'active',
  );
  assert.equal(
    (await pool.query('SELECT 1 FROM character_tag_totals WHERE character_id=$1', [c.id])).rowCount,
    0,
  );
  assert.equal(
    (
      await pool.query('SELECT 1 FROM tag_achievement_grants WHERE character_id=$1 AND code=$2', [
        c.id,
        goal.code,
      ])
    ).rowCount,
    0,
  );
  assert.equal(
    (await pool.query('SELECT 1 FROM house_items WHERE character_id=$1', [c.id])).rowCount,
    0,
  );
});
