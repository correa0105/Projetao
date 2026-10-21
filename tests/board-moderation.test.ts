import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import sharp from 'sharp';
import { pool } from '../server/db.js';
import { migrate } from '../server/migrate.js';
import { seed } from '../server/seed.js';
import { createLegacyTestCharacter, testArtImage } from './character-fixtures.js';

if (!new URL(process.env.DATABASE_URL!).pathname.startsWith('/alvorada_test_'))
  throw Error('Banco descartável obrigatório.');
let server: Server, base: string;
const origin = (process.env.APP_ORIGIN || 'http://localhost:3000').split(',')[0];
type Client = { id: string; cookie: string };
let admin: Client, author: Client, player: Client;
const users: string[] = [],
  missions: string[] = [];
async function request(
  path: string,
  client: Client,
  method = 'GET',
  body?: unknown,
  preview = false,
) {
  const response = await fetch(base + '/api' + path, {
    method,
    headers: {
      Origin: origin,
      Cookie: client.cookie,
      'Content-Type': 'application/json',
      ...(preview ? { 'X-Account-Preview': 'basic' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, data: await response.json() };
}
async function signup(administrator = false): Promise<Client> {
  const response = await fetch(base + '/api/auth/sign-up/email', {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Moderação de teste',
      email: randomUUID() + '@example.test',
      password: 'Test-' + randomUUID(),
    }),
  });
  assert.equal(response.status, 200);
  const { user } = await response.json();
  users.push(user.id);
  if (administrator) await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [user.id]);
  return {
    id: user.id,
    cookie: response.headers
      .getSetCookie()
      .map((value) => value.split(';')[0])
      .join('; '),
  };
}
before(async () => {
  await migrate();
  await seed();
  const { createApp } = await import('../server/app.js');
  server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert(address && typeof address !== 'string');
  base = `http://127.0.0.1:${address.port}`;
  admin = await signup(true);
  author = await signup();
  player = await signup();
});
after(async () => {
  await pool.query('DELETE FROM board_posts WHERE id=ANY($1::uuid[])', [missions]);
  await pool.query('DELETE FROM "user" WHERE id=ANY($1::text[])', [users]);
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.end();
});

test('administrador remove missão alheia sem desfazer recompensas; jogador e prévia básica não removem', async () => {
  const character = await createLegacyTestCharacter(player.id);
  const id = randomUUID();
  missions.push(id);
  await pool.query(
    "INSERT INTO board_posts(id,author_id,kind,title,description,location,difficulty,status,starts_at) VALUES($1,$2,'mission','Missão de outro autor','Uma missão concluída para testar moderação.','Vigília','Tranquila','completed','2030-01-03T18:00:00Z')",
    [id, author.id],
  );
  await pool.query('INSERT INTO mission_participants(post_id,character_id) VALUES($1,$2)', [
    id,
    character.id,
  ]);
  await pool.query(
    'INSERT INTO mission_rewards(post_id,character_id,experience,gold_cp,awarded_by) VALUES($1,$2,0,15000,$3)',
    [id, character.id, author.id],
  );
  const before = (
    await pool.query('SELECT gold_cp,level,progression_missions FROM characters WHERE id=$1', [
      character.id,
    ])
  ).rows[0];
  assert.equal((await request(`/board/${id}`, player, 'DELETE')).status, 403);
  assert.equal((await request(`/board/${id}`, author, 'DELETE')).status, 403);
  assert.equal((await request(`/board/${id}`, admin, 'DELETE', undefined, true)).status, 403);
  assert.equal((await request(`/board/${id}`, admin, 'DELETE')).status, 200);
  const audit = (
    await pool.query('SELECT deleted_at,deleted_by,status FROM board_posts WHERE id=$1', [id])
  ).rows[0];
  assert(audit.deleted_at);
  assert.equal(audit.deleted_by, admin.id);
  assert.equal(audit.status, 'completed');
  assert.equal((await request(`/board/${id}`, admin, 'DELETE')).status, 200);
  assert.deepEqual(
    (await pool.query('SELECT deleted_at,deleted_by,status FROM board_posts WHERE id=$1', [id]))
      .rows[0],
    audit,
  );
  assert(!(await request('/board', admin)).data.some((post: { id: string }) => post.id === id));
  assert(
    !(await request('/calendar?month=2030-01', admin)).data.entries.some(
      (entry: { id: string }) => entry.id === id,
    ),
  );
  assert.equal(
    (await pool.query('SELECT count(*)::int AS n FROM mission_rewards WHERE post_id=$1', [id]))
      .rows[0].n,
    1,
  );
  assert.deepEqual(
    (
      await pool.query('SELECT gold_cp,level,progression_missions FROM characters WHERE id=$1', [
        character.id,
      ])
    ).rows[0],
    before,
  );
  assert.equal(
    (await request(`/board/${id}/join`, player, 'POST', { character_id: character.id })).status,
    409,
  );
  assert.equal(
    (
      await request(`/board/${id}/complete`, author, 'POST', {
        summary: 'Resumo que não deve ser aplicado.',
        rewards: [],
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request(`/board/${id}/hook`, author, 'POST', {
        title: 'Gancho bloqueado',
        description: 'Este gancho não deve ser criado.',
      })
    ).status,
    403,
  );
  const seeded = (
    await pool.query(
      "INSERT INTO board_posts(kind,title,description,location,difficulty) VALUES('mission','Missão sem autor','Missão sem conta de origem.','Vigília','Tranquila') RETURNING id",
    )
  ).rows[0];
  missions.push(seeded.id);
  assert(seeded);
  assert.equal((await request(`/board/${seeded.id}`, admin, 'DELETE')).status, 200);
  assert.equal(
    (await request(`/board/${seeded.id}/join`, player, 'POST', { character_id: character.id }))
      .status,
    409,
  );
});

test('manutenção bloqueia jogadores e prévia básica, preservando acesso administrativo e mídia do calendário', async () => {
  const previous = process.env.MAINTENANCE_AREAS;
  await request('/calendar?month=2030-01', admin);
  const calendarBefore = (await pool.query('SELECT document FROM guild_calendar WHERE id=1'))
    .rows[0].document;
  const bytes = await sharp(await testArtImage())
    .webp()
    .toBuffer();
  const image = (
    await pool.query('INSERT INTO event_images(author_id,bytes)VALUES($1,$2)RETURNING id', [
      admin.id,
      bytes,
    ])
  ).rows[0];
  await pool.query(
    "UPDATE guild_calendar SET document=jsonb_set(document,'{background}',to_jsonb($1::text)) WHERE id=1",
    ['/api/event-images/' + image.id],
  );
  const before = (
    await pool.query(
      "SELECT (SELECT count(*) FROM board_posts WHERE kind='event')::int AS events,(SELECT count(*) FROM tower_expeditions)::int AS expeditions",
    )
  ).rows[0];
  process.env.MAINTENANCE_AREAS = 'events,tower';
  try {
    for (const [client, preview] of [
      [player, false],
      [admin, true],
    ] as const) {
      assert.deepEqual(
        (await request('/me', client, 'GET', undefined, preview)).data.maintenance_areas,
        ['events', 'tower'],
      );
      for (const [path, method] of [
        ['/events', 'GET'],
        ['/events-scene', 'GET'],
        ['/event-images', 'POST'],
        ['/tower', 'GET'],
        ['/tower/expeditions', 'POST'],
        ['/tower/expeditions/' + randomUUID() + '/treasure', 'POST'],
      ]) {
        const response = await request(
          path,
          client,
          method,
          method === 'POST' ? {} : undefined,
          preview,
        );
        assert.equal(response.status, 503, path);
        assert.match(response.data.error, /manutenção/);
      }
      const asset = await fetch(base + '/api/event-images/' + image.id, {
        headers: { Cookie: client.cookie, ...(preview ? { 'X-Account-Preview': 'basic' } : {}) },
      });
      assert.equal(
        asset.status,
        200,
        'A imagem compartilhada com o calendário continua disponível',
      );
      assert.deepEqual(Buffer.from(await asset.arrayBuffer()), bytes);
    }
    assert.equal(
      (
        await request('/board', player, 'POST', {
          kind: 'event',
          title: 'Evento bloqueado',
          description: 'Um evento que não deve ser criado.',
          location: 'Vigília',
          difficulty: 'Tranquila',
        })
      ).status,
      503,
    );
    const event = (await pool.query("SELECT id FROM board_posts WHERE kind='event' LIMIT 1"))
      .rows[0];
    assert.equal(
      (await request(`/board/${event.id}`, player, 'PATCH', { status: 'active' })).status,
      503,
    );
    assert.deepEqual(
      (
        await pool.query(
          "SELECT (SELECT count(*) FROM board_posts WHERE kind='event')::int AS events,(SELECT count(*) FROM tower_expeditions)::int AS expeditions",
        )
      ).rows[0],
      before,
    );
    assert.deepEqual((await request('/me', admin)).data.maintenance_areas, []);
    for (const path of ['/events', '/events-scene', '/tower'])
      assert.equal((await request(path, admin)).status, 200, path);
  } finally {
    await pool.query('UPDATE guild_calendar SET document=$1 WHERE id=1', [calendarBefore]);
    await pool.query('DELETE FROM event_images WHERE id=$1', [image.id]);
    if (previous === undefined) delete process.env.MAINTENANCE_AREAS;
    else process.env.MAINTENANCE_AREAS = previous;
  }
});

test('administrador remove evento sem autor durante manutenção e preserva missões vinculadas', async () => {
  const previous = process.env.MAINTENANCE_AREAS;
  process.env.MAINTENANCE_AREAS = 'events,tower';
  try {
    const eventId = randomUUID(),
      missionId = randomUUID();
    missions.push(eventId, missionId);
    await pool.query(
      "INSERT INTO board_posts(id,kind,title,description,location,difficulty,status,starts_at) VALUES($1,'event','Evento sem autor','Evento de demonstração para remover.','Bastião','Tranquila','active','2030-01-03T18:00:00Z')",
      [eventId],
    );
    await pool.query(
      "INSERT INTO board_posts(id,kind,title,description,location,difficulty,event_source_id) VALUES($1,'mission','Missão vinculada','Missão que deve permanecer.','Bastião','Tranquila',$2)",
      [missionId, eventId],
    );
    assert.equal((await request(`/board/${eventId}`, player, 'DELETE')).status, 503);
    assert.equal(
      (await request(`/board/${eventId}`, admin, 'DELETE', undefined, true)).status,
      503,
    );
    assert.equal((await request(`/board/${eventId}`, admin, 'DELETE')).status, 200);
    const audit = (
      await pool.query('SELECT deleted_at,deleted_by FROM board_posts WHERE id=$1', [eventId])
    ).rows[0];
    assert(audit.deleted_at);
    assert.equal(audit.deleted_by, admin.id);
    assert.equal((await request(`/board/${eventId}`, admin, 'DELETE')).status, 200);
    assert.deepEqual(
      (await pool.query('SELECT deleted_at,deleted_by FROM board_posts WHERE id=$1', [eventId]))
        .rows[0],
      audit,
    );
    assert(
      !(await request('/board', admin)).data.some((post: { id: string }) => post.id === eventId),
    );
    assert(
      !(await request('/events', admin)).data.items.some(
        (post: { id: string }) => post.id === eventId,
      ),
    );
    assert(
      !(await request('/calendar?month=2030-01', admin)).data.entries.some(
        (post: { id: string }) => post.id === eventId,
      ),
    );
    const linked = (
      await pool.query('SELECT event_source_id,deleted_at FROM board_posts WHERE id=$1', [
        missionId,
      ])
    ).rows[0];
    assert.equal(linked.event_source_id, eventId);
    assert.equal(linked.deleted_at, null);
    assert.equal(
      (await request('/events/' + eventId, admin, 'DELETE', { revision: 1 })).status,
      409,
    );
  } finally {
    if (previous === undefined) delete process.env.MAINTENANCE_AREAS;
    else process.env.MAINTENANCE_AREAS = previous;
  }
});
