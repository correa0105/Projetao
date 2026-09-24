import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import type { Server } from 'node:http';
import { createApp } from '../server/app.js';
import { pool } from '../server/db.js';
import { migrate } from '../server/migrate.js';
import { seed } from '../server/seed.js';

let server: Server;
let base: string;
const origin = (process.env.APP_ORIGIN || 'http://localhost:3000').split(',')[0];
const users: string[] = [];
type Client = { cookie: string; id: string; email: string; password: string };
async function request(
  path: string,
  client?: Client,
  body?: unknown,
  method = body ? 'POST' : 'GET',
  extra: Record<string, string> = {},
) {
  const response = await fetch(base + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Origin: origin,
      ...(client ? { Cookie: client.cookie } : {}),
      ...extra,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, data: await response.json(), headers: response.headers };
}
async function signup(): Promise<Client> {
  const email = `integration-${randomUUID()}@example.test`;
  const password = `Test-${randomUUID()}`;
  const response = await request('/api/auth/sign-up/email', undefined, {
    name: 'Aventureiro de teste',
    email,
    password,
  });
  assert.equal(response.status, 200, JSON.stringify(response.data));
  users.push(response.data.user.id);
  const cookie = response.headers
    .getSetCookie()
    .map((value) => value.split(';')[0])
    .join('; ');
  assert.ok(cookie.includes('session_token'));
  return { cookie, id: response.data.user.id, email, password };
}
async function character(client: Client, name = 'Arden') {
  const response = await request('/api/characters', client, {
    name,
    race: 'Elfo',
    class: 'Guerreiro',
    stats: [15, 14, 13, 12, 10, 8],
  });
  assert.equal(response.status, 201, JSON.stringify(response.data));
  return response.data;
}
before(async () => {
  await migrate();
  await seed();
  server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  base = `http://127.0.0.1:${address.port}`;
});
after(async () => {
  // Only remove records created by this test run, including authored posts.
  if (users.length) {
    await pool.query('DELETE FROM board_posts WHERE author_id=ANY($1::text[])', [users]);
    await pool.query('DELETE FROM "user" WHERE id=ANY($1::text[])', [users]);
  }
  if (server)
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  await pool.end();
});

async function verifyKingdomDraft(alice: Client, bob: Client) {
  const initial = await request('/api/kingdom/editor-draft', alice);
  assert.equal(initial.status, 200);
  assert.deepEqual(initial.data, { revision: 0, items: [] });
  const item = {
    id: randomUUID(),
    kind: 'pine',
    x: 125,
    y: -340,
    height: 550,
    direction: 3,
  };
  const saved = await request(
    '/api/kingdom/editor-draft',
    alice,
    { revision: 0, items: [item] },
    'PUT',
  );
  assert.equal(saved.status, 200);
  assert.equal(saved.data.revision, 1);
  assert.deepEqual(saved.data.items, [item]);
  assert.deepEqual((await request('/api/kingdom/editor-draft', bob)).data, {
    revision: 0,
    items: [],
  });
  assert.equal(
    (await request('/api/kingdom/editor-draft', alice, { revision: 0, items: [] }, 'PUT')).status,
    409,
  );
  assert.equal(
    (
      await request(
        '/api/kingdom/editor-draft',
        alice,
        { revision: 1, items: [{ ...item, kind: 'invalid' }] },
        'PUT',
      )
    ).status,
    400,
  );
  assert.deepEqual((await request('/api/kingdom/editor-draft', alice)).data.items, [item]);
  assert.equal((await request('/api/kingdom/editor-draft')).status, 401);
}

async function verifyKingdomBackground(alice: Client, bob: Client) {
  assert.deepEqual((await request('/api/kingdom/editor-background/meta', alice)).data, {
    exists: false,
    width: 3072,
    height: 3072,
    revision: 0,
  });
  const image = await sharp({
    create: {
      width: 8192,
      height: 4096,
      channels: 3,
      background: '#726b54',
    },
  })
    .png()
    .toBuffer();
  const uploaded = await fetch(base + '/api/kingdom/editor-background', {
    method: 'PUT',
    headers: { Origin: origin, Cookie: alice.cookie, 'Content-Type': 'image/png' },
    body: new Uint8Array(image),
  });
  assert.equal(uploaded.status, 200);
  assert.deepEqual(await uploaded.json(), { exists: true, width: 8192, height: 4096, revision: 1 });
  assert.deepEqual((await request('/api/kingdom/editor-background/meta', bob)).data, {
    exists: false,
    width: 3072,
    height: 3072,
    revision: 0,
  });
  assert.equal((await request('/api/kingdom/editor-background/image', bob)).status, 404);
  const fetched = await fetch(base + '/api/kingdom/editor-background/image', {
    headers: { Cookie: alice.cookie },
  });
  assert.equal(fetched.status, 200);
  assert.equal(fetched.headers.get('content-type'), 'image/png');
  assert.deepEqual(Buffer.from(await fetched.arrayBuffer()), image);
  const invalid = await fetch(base + '/api/kingdom/editor-background', {
    method: 'PUT',
    headers: { Origin: origin, Cookie: alice.cookie, 'Content-Type': 'image/png' },
    body: new Uint8Array([1, 2, 3]),
  });
  assert.equal(invalid.status, 400);
  assert.equal((await request('/api/kingdom/editor-background/meta', alice)).data.revision, 1);
  assert.equal(
    (await request('/api/kingdom/editor-background', alice, undefined, 'DELETE')).status,
    200,
  );
  assert.equal((await request('/api/kingdom/editor-background/image', alice)).status, 404);
}

async function verifyKingdomView(alice: Client, bob: Client) {
  const initial = { exists: false, x: 0, y: 0, zoom: 1, angle: 0 };
  assert.deepEqual((await request('/api/kingdom/editor-view', alice)).data, initial);
  const saved = await request(
    '/api/kingdom/editor-view',
    alice,
    { x: 300, y: -200, zoom: 0.4, angle: Math.PI / 2 },
    'PUT',
  );
  assert.equal(saved.status, 200);
  assert.equal(saved.data.zoom, 0.4);
  assert.deepEqual((await request('/api/kingdom/editor-view', bob)).data, initial);
  assert.equal(
    (await request('/api/kingdom/editor-view', alice, { x: 0, y: 0, zoom: 100, angle: 0 }, 'PUT'))
      .status,
    400,
  );
  const picture = await sharp({
    create: {
      width: 1024,
      height: 768,
      channels: 3,
      background: '#625f49',
    },
  })
    .png()
    .toBuffer();
  const uploaded = await fetch(base + '/api/kingdom/editor-background', {
    method: 'PUT',
    headers: { Origin: origin, Cookie: alice.cookie, 'Content-Type': 'image/png' },
    body: new Uint8Array(picture),
  });
  assert.equal(uploaded.status, 200);
  assert.deepEqual((await request('/api/kingdom/editor-view', alice)).data, initial);
  assert.equal(
    (
      await request(
        '/api/kingdom/editor-view',
        alice,
        { x: -800, y: 900, zoom: 2, angle: 0 },
        'PUT',
      )
    ).status,
    200,
  );
  assert.equal((await request('/api/kingdom/editor-view', alice)).data.zoom, 2);
  await request('/api/kingdom/editor-background', alice, undefined, 'DELETE');
  assert.deepEqual((await request('/api/kingdom/editor-view', alice)).data, initial);
  assert.equal((await request('/api/kingdom/editor-view', alice, undefined, 'DELETE')).status, 200);
}

test('Fluxos reais com PostgreSQL, autenticação e isolamento entre jogadores', async (t) => {
  const alice = await signup();
  const bob = await signup();
  const arden = await character(alice);
  const mira = await character(alice, 'Mira');
  const borin = await character(bob, 'Borin');
  await t.test('rascunho do editor: persistência, revisão e isolamento por usuário', async () =>
    verifyKingdomDraft(alice, bob),
  );
  await t.test('background 8K: upload, leitura privada, rejeição e restauração', async () =>
    verifyKingdomBackground(alice, bob),
  );
  await t.test('visão inicial: zoom salvo, isolamento e vínculo ao background', async () =>
    verifyKingdomView(alice, bob),
  );
  await t.test('sessão, múltiplos personagens, atributos e acesso isolado', async () => {
    assert.equal((await request('/api/characters')).status, 401);
    const response = await request('/api/characters', alice);
    assert.equal(response.data.length, 2);
    assert.equal(response.data[0].hp, 11);
    assert.equal(response.data[0].armor_class, 12);
    assert.equal((await request(`/api/characters/${arden.id}/details`, bob)).status, 404);
    assert.equal(
      (
        await request('/api/characters', alice, {
          name: 'Cheater',
          race: 'Elfo',
          class: 'Mago',
          stats: [20, 20, 20, 20, 20, 20],
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await request('/api/characters', alice, { name: 'Arden' }, 'POST', {
          Origin: 'https://evil.example',
        })
      ).status,
      403,
    );
    assert.equal(
      (await request('/api/characters', alice, { name: 'Arden' }, 'POST', { Origin: '' })).status,
      403,
    );
  });
  await t.test('compra atômica, repetição idempotente e proteção de titularidade', async () => {
    const order = {
      character_id: arden.id,
      item_id: 'longsword',
      quantity: 2,
      idempotency_key: randomUUID(),
      price_cp: 1,
    };
    const first = await request('/api/purchases', alice, order);
    assert.equal(first.status, 201);
    assert.equal(first.data.gold_cp, 12000); // Client price cannot override catalog price.
    const retry = await request('/api/purchases', alice, order);
    assert.equal(retry.status, 200);
    assert.equal(retry.data.replayed, true);
    assert.equal(retry.data.gold_cp, 12000);
    assert.equal(
      (await request('/api/purchases', bob, { ...order, idempotency_key: randomUUID() })).status,
      404,
    );
    assert.equal((await request('/api/purchases', alice, { ...order, quantity: 3 })).status, 409);
    const details = (await request(`/api/characters/${arden.id}/details`, alice)).data;
    assert.equal(details.inventory[0].quantity, 2);
    assert.equal(details.history.length, 1);
    assert.ok(
      details.achievements.some((item: { code: string }) => item.code === 'first_purchase'),
    );
  });
  await t.test('saldo insuficiente e entradas inválidas não alteram o inventário', async () => {
    for (const quantity of [0, -1, 1.5, 100])
      assert.equal(
        (
          await request('/api/purchases', alice, {
            character_id: arden.id,
            item_id: 'shortbow',
            quantity,
            idempotency_key: randomUUID(),
          })
        ).status,
        400,
      );
    assert.equal(
      (
        await request('/api/purchases', alice, {
          character_id: arden.id,
          item_id: 'shortbow',
          quantity: 99,
          idempotency_key: randomUUID(),
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await request('/api/purchases', alice, {
          character_id: arden.id,
          item_id: 'does-not-exist',
          quantity: 1,
          idempotency_key: randomUUID(),
        })
      ).status,
      404,
    );
    const details = (await request(`/api/characters/${arden.id}/details`, alice)).data;
    assert.equal(details.inventory.length, 1);
    assert.equal(details.inventory[0].quantity, 2);
    assert.equal(
      (await pool.query('SELECT gold_cp FROM characters WHERE id=$1', [arden.id])).rows[0].gold_cp,
      12000,
    );
  });
  await t.test('dez compras simultâneas respeitam o saldo e o bloqueio de linha', async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        request('/api/purchases', alice, {
          character_id: mira.id,
          item_id: 'shortbow',
          quantity: 1,
          idempotency_key: randomUUID(),
        }),
      ),
    );
    assert.equal(results.filter((result) => result.status === 201).length, 6);
    assert.equal(results.filter((result) => result.status === 409).length, 4);
    const details = (await request(`/api/characters/${mira.id}/details`, alice)).data;
    assert.equal(details.inventory[0].quantity, 6);
    assert.equal(details.history.length, 6);
    assert.equal(
      (await pool.query('SELECT gold_cp FROM characters WHERE id=$1', [mira.id])).rows[0].gold_cp,
      0,
    );
  });
  await t.test('requisições simultâneas com a mesma chave debitam apenas uma vez', async () => {
    const order = {
      character_id: arden.id,
      item_id: 'dagger',
      quantity: 1,
      idempotency_key: randomUUID(),
    };
    const responses = await Promise.all(
      Array.from({ length: 5 }, () => request('/api/purchases', alice, order)),
    );
    assert.equal(responses.filter((response) => response.status === 201).length, 1);
    assert.equal(responses.filter((response) => response.status === 200).length, 4);
    assert.equal(
      (await pool.query('SELECT gold_cp FROM characters WHERE id=$1', [arden.id])).rows[0].gold_cp,
      11800,
    );
  });
  await t.test('missão no mural: inscrição, autoria, início, conclusão e histórico', async () => {
    const created = await request('/api/board', alice, {
      title: 'Missão de integração',
      description: 'Investigar a antiga estrada e retornar para a guilda.',
      kind: 'mission',
      difficulty: 'Moderada',
      location: 'Vigília',
      reward_cp: 5000,
      starts_at: new Date(Date.now() + 3600000).toISOString(),
    });
    assert.equal(created.status, 201);
    const id = created.data.id;
    assert.equal(
      (await request(`/api/board/${id}/join`, bob, { character_id: arden.id })).status,
      404,
    );
    assert.equal(
      (await request(`/api/board/${id}/join`, alice, { character_id: arden.id })).status,
      200,
    );
    assert.equal(
      (await request(`/api/board/${id}/join`, alice, { character_id: arden.id })).status,
      200,
    );
    assert.equal(
      (await request(`/api/board/${id}`, bob, { status: 'active' }, 'PATCH')).status,
      409,
    );
    assert.equal(
      (await request(`/api/board/${id}`, alice, { status: 'completed' }, 'PATCH')).status,
      409,
    );
    assert.equal(
      (await request(`/api/board/${id}`, alice, { status: 'active' }, 'PATCH')).status,
      200,
    );
    assert.equal(
      (await request(`/api/board/${id}/join`, alice, { character_id: mira.id })).status,
      409,
    );
    const completion = {
      summary: 'Os aventureiros encontraram a expedição e voltaram ao Bastião.',
      rewards: [{ character_id: arden.id, experience: 125 }],
      hook: {
        title: 'O rastro da expedição',
        description: 'Uma nova pista foi encontrada na antiga estrada.',
      },
    };
    assert.equal((await request(`/api/board/${id}/participants`, bob)).status, 403);
    assert.equal((await request(`/api/board/${id}/complete`, bob, completion)).status, 403);
    assert.equal(
      (
        await request(`/api/board/${id}/complete`, alice, {
          ...completion,
          rewards: [{ character_id: mira.id, experience: 500 }],
        })
      ).status,
      400,
    );
    assert.equal(
      (await request(`/api/board/${id}/complete`, alice, { ...completion, rewards: [] })).status,
      400,
    );
    assert.equal(
      (
        await request(`/api/board/${id}/complete`, alice, {
          ...completion,
          rewards: [{ character_id: arden.id, experience: -1 }],
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await request(`/api/board/${id}/complete`, alice, {
          ...completion,
          rewards: [...completion.rewards, ...completion.rewards],
        })
      ).status,
      400,
    );
    assert.equal(
      (await request(`/api/board/${id}`, alice, { status: 'completed' }, 'PATCH')).status,
      409,
    );
    const results = await Promise.all(
      Array.from({ length: 3 }, () => request(`/api/board/${id}/complete`, alice, completion)),
    );
    assert.equal(results.filter((r) => r.status === 200).length, 1);
    assert.equal(results.filter((r) => r.status === 409).length, 2);
    assert.equal(
      (await pool.query('SELECT experience FROM characters WHERE id=$1', [arden.id])).rows[0]
        .experience,
      125,
    );
    assert.equal(
      (await pool.query('SELECT count(*)::int AS n FROM mission_rewards WHERE post_id=$1', [id]))
        .rows[0].n,
      1,
    );
    const hooks = await pool.query('SELECT * FROM board_posts WHERE source_mission_id=$1', [id]);
    assert.equal(hooks.rowCount, 1);
    assert.equal(hooks.rows[0].kind, 'hook');
    assert.equal(
      (await request(`/api/board/${hooks.rows[0].id}`, alice, { status: 'active' }, 'PATCH'))
        .status,
      409,
    );
    const stored = (await request('/api/board', alice)).data.find(
      (item: { id: string }) => item.id === id,
    );
    assert.equal(stored.status, 'completed');
    assert.equal(stored.participants, 1);
    assert.equal(stored.completion_summary, completion.summary);
    assert.equal(stored.rewards[0].experience, 125);
    assert.equal(
      (await pool.query('SELECT count(*)::int AS total FROM board_posts WHERE id=$1', [id])).rows[0]
        .total,
      1,
    );
    assert.equal(
      (await pool.query('SELECT gold_cp FROM characters WHERE id=$1', [arden.id])).rows[0].gold_cp,
      11800,
    ); // No fabricated reward.
  });
  await t.test(
    'agendamento obrigatório, eventos restritos à staff e ganchos somente na conclusão',
    async () => {
      const data = {
        kind: 'mission',
        title: 'Mesa com agendamento',
        description: 'Uma aventura com data e hora de início.',
        location: 'Vigília',
        difficulty: 'Moderada',
      };
      assert.equal((await request('/api/board', alice, data)).status, 400);
      for (const starts_at of ['inválido', '2020-01-01T12:00:00Z', '2027-01-01T12:00:00'])
        assert.equal((await request('/api/board', alice, { ...data, starts_at })).status, 400);
      assert.equal((await request('/api/board', alice, { ...data, kind: 'hook' })).status, 400);
      assert.equal(
        (await request('/api/board', alice, { ...data, kind: 'event', role: 'admin' })).status,
        403,
      );
      assert.equal((await request('/api/me', alice)).data.role, 'player');
      await pool.query("INSERT INTO guild_staff(user_id,role) VALUES($1,'staff')", [alice.id]);
      assert.equal((await request('/api/me', alice)).data.role, 'staff');
      const event = await request('/api/board', alice, { ...data, kind: 'event' });
      assert.equal(event.status, 201);
      await pool.query('DELETE FROM guild_staff WHERE user_id=$1', [alice.id]);
      assert.equal(
        (await request(`/api/board/${event.data.id}`, alice, { status: 'active' }, 'PATCH')).status,
        409,
      );
      const starts_at = new Date(Date.now() + 7200000).toISOString();
      const mission = await request('/api/board', alice, { ...data, starts_at });
      assert.equal(mission.status, 201);
      assert.equal(mission.data.starts_at, starts_at);
      const id = mission.data.id;
      await request(`/api/board/${id}/join`, bob, { character_id: borin.id });
      await request(`/api/board/${id}/join`, alice, { character_id: mira.id });
      await request(`/api/board/${id}`, alice, { status: 'active' }, 'PATCH');
      const completed = await request(`/api/board/${id}/complete`, alice, {
        summary: 'Dois personagens de jogadores diferentes retornaram.',
        rewards: [
          { character_id: borin.id, experience: 250 },
          { character_id: mira.id, experience: 0 },
        ],
      });
      assert.equal(completed.status, 200);
      assert.equal(
        (await pool.query('SELECT experience FROM characters WHERE id=$1', [borin.id])).rows[0]
          .experience,
        250,
      );
      const bobBoard = (await request('/api/board', bob)).data.find(
        (p: { id: string }) => p.id === id,
      );
      assert.deepEqual(bobBoard.rewards, [{ name: 'Borin', experience: 250 }]);
      assert.equal(
        (
          await pool.query(
            'SELECT count(*)::int AS n FROM board_posts WHERE source_mission_id=$1',
            [id],
          )
        ).rows[0].n,
        0,
      );
      const cancelled = await request('/api/board', alice, { ...data, starts_at });
      await request(`/api/board/${cancelled.data.id}`, alice, { status: 'closed' }, 'PATCH');
      assert.equal(
        (
          await request(`/api/board/${cancelled.data.id}/complete`, alice, {
            summary: 'Esta mesa foi cancelada.',
            rewards: [],
          })
        ).status,
        409,
      );
    },
  );
  await t.test(
    'atlas usa o mesmo mural, valida geografia e preserva autoria, agenda e ganchos',
    async () => {
      assert.equal((await request('/api/atlas')).status, 401);
      const atlas = await request('/api/atlas', alice);
      assert.equal(atlas.status, 200);
      assert.deepEqual(atlas.data.regions.map((r: { id: string }) => r.id).sort(), [
        'altos-de-boreal',
        'campos-de-vesper',
        'coroa-da-geada',
        'costa-cinzenta',
        'dunas-de-auren',
        'ermos-de-salvia',
        'escarpas-de-cinabrio',
        'falesias-de-sal',
        'fulkushima',
        'marchas-do-poente',
        'northundria',
        'olho-da-tormenta',
        'peninsula-de-lume',
        'pomar-branco',
        'portas-de-arenito',
        'reino-do-norte',
        'skelliege',
        'terras-de-ambar',
        'valdrakken',
        'vale-do-cervo',
        'vale-dos-pinheiros',
        'vigias-do-gelo',
      ]);
      assert.equal(
        atlas.data.regions.find((r: { id: string }) => r.id === 'reino-do-norte').available,
        true,
      );
      assert.equal(
        atlas.data.regions.find((r: { id: string }) => r.id === 'northundria').available,
        false,
      );
      assert.equal(
        atlas.data.regions.find((r: { id: string }) => r.id === 'pomar-branco').available,
        false,
      );
      assert.equal(atlas.data.locations.length, 6);
      assert.ok(
        atlas.data.locations.some((location: { id: string }) => location.id === 'floresta-negra'),
      );
      for (const location of atlas.data.locations) {
        assert.equal(location.region_id, 'reino-do-norte');
        assert.equal(typeof location.map_x, 'number');
        assert.equal(typeof location.map_y, 'number');
        assert.ok(location.map_x >= 0 && location.map_x <= 1);
        assert.ok(location.map_y >= 0 && location.map_y <= 1);
      }

      const payload = {
        kind: 'mission',
        title: 'Uma jornada pelo atlas',
        description: 'Investigar os arredores da cidade e compartilhar as descobertas.',
        difficulty: 'Moderada',
        location_id: 'vigilia',
        starts_at: new Date(Date.now() + 10800000).toISOString(),
        // Geography and ownership must come from the server, even with forged fields.
        region_id: 'northundria',
        author_id: bob.id,
        location: 'Local falsificado',
      };
      const created = await request('/api/board', alice, payload);
      assert.equal(created.status, 201, JSON.stringify(created.data));
      const id = created.data.id;
      assert.equal(created.data.author_id, alice.id);
      assert.equal(created.data.location, 'Vigília');
      assert.equal(created.data.location_id, 'vigilia');
      assert.equal(created.data.region_id, 'reino-do-norte');
      assert.equal(created.data.starts_at, payload.starts_at);
      const sql = (await pool.query('SELECT * FROM board_posts WHERE id=$1', [id])).rows;
      assert.equal(sql.length, 1);
      assert.equal(sql[0].location_id, 'vigilia');
      const allPosts = (await request('/api/board', bob)).data;
      assert.ok(allPosts.some((p: { id: string }) => p.id === id));
      const localPosts = (await request('/api/board?location_id=vigilia', bob)).data;
      assert.ok(localPosts.some((p: { id: string }) => p.id === id));
      assert.ok(localPosts.every((p: { location_id: string }) => p.location_id === 'vigilia'));
      const regionPosts = (await request('/api/board?region_id=reino-do-norte', alice)).data;
      assert.ok(regionPosts.some((p: { id: string }) => p.id === id));
      assert.ok(regionPosts.every((p: { region_id: string }) => p.region_id === 'reino-do-norte'));
      assert.deepEqual(
        (await request('/api/board?region_id=northundria&location_id=vigilia', alice)).data,
        [],
      );
      assert.ok(
        !(await request('/api/board?location_id=passo-da-geada', alice)).data.some(
          (p: { id: string }) => p.id === id,
        ),
      );
      assert.equal(
        (await request('/api/board?location_id=vigilia&location_id=porto-das-brumas', alice))
          .status,
        400,
      );
      assert.equal(
        (await request('/api/board', alice, { ...payload, starts_at: undefined })).status,
        400,
      );
      assert.equal(
        (await request('/api/board', alice, { ...payload, starts_at: '2020-01-01T12:00:00Z' }))
          .status,
        400,
      );
      assert.equal(
        (await request('/api/board', alice, { ...payload, location_id: 'inexistente' })).status,
        400,
      );
      assert.equal(
        (await request('/api/board', alice, { ...payload, location_id: '../vigilia' })).status,
        400,
      );
      assert.equal(
        (
          await request('/api/board', alice, {
            ...payload,
            location_id: undefined,
            location: undefined,
          })
        ).status,
        400,
      );
      await assert.rejects(
        pool.query("UPDATE board_posts SET region_id='northundria' WHERE id=$1", [id]),
        (error: unknown) => (error as { code?: string }).code === '23503',
      );

      const unavailableId = `teste-local-${randomUUID()}`;
      try {
        await pool.query(
          `INSERT INTO world_locations(id,region_id,name,description,map_x,map_y)
         VALUES($1,'northundria',$1,'Local temporário exclusivo deste teste.',0.5,0.5)`,
          [unavailableId],
        );
        assert.equal(
          (
            await request('/api/board', alice, {
              ...payload,
              location_id: unavailableId,
              region_id: 'reino-do-norte',
              available: true,
            })
          ).status,
          409,
        );
        assert.equal(
          (
            await pool.query('SELECT count(*)::int AS n FROM board_posts WHERE location_id=$1', [
              unavailableId,
            ])
          ).rows[0].n,
          0,
        );
      } finally {
        await pool.query('DELETE FROM world_locations WHERE id=$1', [unavailableId]);
      }

      const withoutText = await request('/api/board', alice, {
        ...payload,
        location: undefined,
        location_id: 'porto-das-brumas',
      });
      assert.equal(withoutText.status, 201);
      assert.equal(withoutText.data.location, 'Porto das Brumas');
      const freeform = await request('/api/board', alice, {
        ...payload,
        location_id: undefined,
        location: 'Um lugar descrito pelo mestre',
      });
      assert.equal(freeform.status, 201);
      assert.equal(freeform.data.region_id, null);
      assert.equal(freeform.data.location_id, null);
      assert.equal(freeform.data.location, 'Um lugar descrito pelo mestre');

      assert.equal(
        (await request(`/api/board/${id}`, bob, { status: 'active' }, 'PATCH')).status,
        409,
      );
      assert.equal(
        (await request(`/api/board/${id}`, alice, { status: 'active' }, 'PATCH')).status,
        200,
      );
      const completion = {
        summary: 'A expedição concluiu a exploração ao redor de Vigília.',
        rewards: [],
        hook: {
          title: 'Novas trilhas de Vigília',
          description: 'Os relatos revelaram uma trilha ainda não explorada.',
        },
      };
      assert.equal((await request(`/api/board/${id}/complete`, bob, completion)).status, 403);
      assert.equal((await request(`/api/board/${id}/complete`, alice, completion)).status, 200);
      const hook = (await pool.query('SELECT * FROM board_posts WHERE source_mission_id=$1', [id]))
        .rows[0];
      assert.equal(hook.region_id, 'reino-do-norte');
      assert.equal(hook.location_id, 'vigilia');
      assert.equal(hook.location, 'Vigília');
      const history = (await request('/api/board?location_id=vigilia', alice)).data;
      assert.equal(history.find((p: { id: string }) => p.id === id).status, 'completed');
      assert.ok(history.some((p: { id: string }) => p.id === hook.id));
    },
  );
  await t.test('login com senha e logout invalidam a sessão no servidor', async () => {
    const login = await request('/api/auth/sign-in/email', undefined, {
      email: alice.email,
      password: alice.password,
    });
    assert.equal(login.status, 200);
    const signedIn = {
      ...alice,
      cookie: login.headers
        .getSetCookie()
        .map((value) => value.split(';')[0])
        .join('; '),
    };
    assert.equal((await request('/api/me', signedIn)).status, 200);
    assert.equal((await request('/api/auth/sign-out', signedIn, {})).status, 200);
    assert.equal((await request('/api/me', signedIn)).status, 401);
    assert.equal(
      (
        await request('/api/auth/sign-in/email', undefined, {
          email: alice.email,
          password: 'wrong-password',
        })
      ).status,
      401,
    );
  });
});
