import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pool } from '../server/db.js';
import { migrate } from '../server/migrate.js';
import { seed } from '../server/seed.js';
import { createLegacyTestCharacter } from './character-fixtures.js';

test('excluir: propriedade, unidades livres, pilhas, cofre, concorrência, idempotência e histórico', async () => {
  assert.match(new URL(process.env.DATABASE_URL!).pathname, /^\/alvorada_test_[0-9a-f]{32}$/);
  await migrate();
  await seed();
  const { createApp } = await import('../server/app.js');
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', r));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = 'http://127.0.0.1:' + address.port + '/api';
  const origin = (process.env.APP_ORIGIN || 'http://localhost:3000').split(',')[0];
  const users: string[] = [];
  async function req(
    path: string,
    cookie = '',
    body?: unknown,
    from = origin,
    method = body ? 'POST' : 'GET',
  ) {
    const r = await fetch(base + path, {
      method,
      headers: { Cookie: cookie, Origin: from, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: r.status, data: await r.json(), headers: r.headers };
  }
  async function signup() {
    const r = await req('/auth/sign-up/email', '', {
      name: 'Excluir teste',
      email: randomUUID() + '@example.test',
      password: 'Test-' + randomUUID(),
    });
    assert.equal(r.status, 200);
    users.push(r.data.user.id);
    return {
      id: r.data.user.id,
      cookie: r.headers
        .getSetCookie()
        .map((v) => v.split(';')[0])
        .join('; '),
    };
  }
  try {
    const alice = await signup(),
      bob = await signup();
    const hero = await createLegacyTestCharacter(alice.id, 'Mochila'),
      second = await createLegacyTestCharacter(alice.id, 'Cofre');
    const foreign = await createLegacyTestCharacter(bob.id, 'Outro dono');
    await pool.query('UPDATE characters SET gold_cp=1000000 WHERE id=ANY($1::uuid[])', [
      [hero.id, second.id],
    ]);
    const item = (
      await pool.query(
        "SELECT id FROM catalog_items WHERE name='Espada longa' AND active=true LIMIT 1",
      )
    ).rows[0];
    assert.ok(item);
    assert.equal(
      (
        await req('/purchases', alice.cookie, {
          character_id: hero.id,
          item_id: item.id,
          quantity: 7,
          idempotency_key: randomUUID(),
        })
      ).status,
      201,
    );
    const originalChar = (await pool.query('SELECT * FROM characters WHERE id=$1', [hero.id]))
      .rows[0];
    const originalOrders = (
      await pool.query('SELECT * FROM purchases WHERE character_id=$1 ORDER BY id', [hero.id])
    ).rows;
    const originalGrants = (
      await pool.query(
        'SELECT g.* FROM purchase_item_grants g JOIN purchases p ON p.id=g.purchase_id WHERE p.character_id=$1 ORDER BY g.item_id',
        [hero.id],
      )
    ).rows;
    const body = (
      quantity = 1,
      source = 'backpack',
      character_id = hero.id,
      item_id = item.id,
    ) => ({ character_id, item_id, quantity, source, idempotency_key: randomUUID() });
    const discard = (data: unknown) => req('/inventory/discards', alice.cookie, data);
    const storage = async (id = hero.id) =>
      (await req('/characters/' + id + '/storage', alice.cookie)).data;
    assert.equal((await req('/inventory/discards', '', body())).status, 401);
    assert.equal((await req('/inventory/discards', bob.cookie, body())).status, 404);
    assert.equal((await discard(body(1, 'backpack', foreign.id))).status, 404);
    assert.equal(
      (await req('/inventory/discards', alice.cookie, body(), 'https://invalid.example')).status,
      403,
    );
    for (const quantity of [0, -1, 1.5, 2147483648])
      assert.equal((await discard(body(quantity))).status, 400);
    assert.equal((await discard({ ...body(), user_id: bob.id })).status, 400);
    assert.equal((await discard(body(1, 'inventory;DROP TABLE inventory'))).status, 400);
    assert.equal((await discard(body(8))).status, 409);
    assert.equal((await discard(body(1, 'backpack', hero.id, 'missing-item'))).status, 409);
    assert.equal(
      (
        await req('/inventory/equipment', alice.cookie, {
          character_id: hero.id,
          slot: 'main_hand',
          item_id: item.id,
        })
      ).status,
      200,
    );
    assert.equal((await discard(body(7))).status, 409);
    const order = body(3);
    const duplicates = await Promise.all([discard(order), discard(order)]);
    assert.deepEqual(duplicates.map((r) => r.status).sort(), [200, 201]);
    assert.equal((await storage()).inventory.find((i: any) => i.id === item.id).quantity, 4);
    assert.equal((await discard({ ...order, quantity: 2 })).status, 409);
    assert.equal((await discard({ ...order, source: 'vault' })).status, 409);
    assert.equal((await discard({ ...order, character_id: second.id })).status, 409);
    assert.equal((await discard(body(3))).status, 201);
    assert.equal((await discard(body(1))).status, 409);
    assert.equal((await storage()).equipped[0].id, item.id);
    assert.equal(
      (
        await req('/inventory/equipment', alice.cookie, {
          character_id: hero.id,
          slot: 'main_hand',
          item_id: null,
        })
      ).status,
      200,
    );
    const last = body();
    assert.equal((await discard(last)).status, 201);
    assert.equal((await discard(last)).status, 200);
    assert.equal(
      (await storage()).inventory.some((i: any) => i.id === item.id),
      false,
    );
    assert.deepEqual(
      (await pool.query('SELECT * FROM characters WHERE id=$1', [hero.id])).rows[0],
      originalChar,
    );
    assert.deepEqual(
      (await pool.query('SELECT * FROM purchases WHERE character_id=$1 ORDER BY id', [hero.id]))
        .rows,
      originalOrders,
    );
    assert.deepEqual(
      (
        await pool.query(
          'SELECT g.* FROM purchase_item_grants g JOIN purchases p ON p.id=g.purchase_id WHERE p.character_id=$1 ORDER BY g.item_id',
          [hero.id],
        )
      ).rows,
      originalGrants,
    );
    assert.equal(
      (
        await pool.query(
          'SELECT count(*)::int AS n FROM inventory_discards WHERE user_id=$1 AND idempotency_key=$2',
          [alice.id, order.idempotency_key],
        )
      ).rows[0].n,
      1,
    );

    await pool.query('INSERT INTO account_vault(user_id,item_id,quantity) VALUES($1,$2,5)', [
      alice.id,
      item.id,
    ]);
    const vaultOrder = body(2, 'vault');
    assert.equal((await discard(vaultOrder)).status, 201);
    assert.equal((await discard(vaultOrder)).status, 200);
    assert.equal((await storage(second.id)).vault[0].quantity, 3);
    const race = await Promise.all([
      discard(body(3, 'vault')),
      discard(body(3, 'vault', second.id)),
    ]);
    assert.deepEqual(race.map((r) => r.status).sort(), [201, 409]);
    assert.equal((await storage()).vault.length, 0);
    assert.equal((await storage(second.id)).inventory.length, 0);

    const mount = (
      await req('/stable/purchase', alice.cookie, {
        character_id: hero.id,
        mount_id: 'pony',
        name: 'Reservado',
        idempotency_key: randomUUID(),
      })
    ).data.mount;
    assert.ok(mount);
    await pool.query(
      "INSERT INTO inventory(character_id,item_id,quantity) VALUES($1,'barding-leather-armor',2)",
      [hero.id],
    );
    assert.equal(
      (
        await req(
          '/companions/' + hero.id + '/equipment',
          alice.cookie,
          {
            kind: 'mount',
            companion_id: mount.id,
            slot: 'armor',
            item_id: 'barding-leather-armor',
          },
          origin,
          'PUT',
        )
      ).status,
      200,
    );
    const reserved = body(1, 'backpack', hero.id, 'barding-leather-armor');
    assert.equal((await discard({ ...reserved, quantity: 2 })).status, 409);
    assert.equal((await discard(reserved)).status, 201);
    assert.equal((await discard({ ...reserved, idempotency_key: randomUUID() })).status, 409);
    assert.equal((await storage()).companion_allocated['barding-leather-armor'], 1);
    assert.equal(
      (await storage()).inventory.find((i: any) => i.id === 'barding-leather-armor').quantity,
      1,
    );
    await pool.query('UPDATE characters SET deleted_at=now() WHERE id=$1', [hero.id]);
    assert.equal((await discard(body())).status, 404);
  } finally {
    try {
      for (const id of users) {
        await pool.query(
          'DELETE FROM character_mounts WHERE character_id IN(SELECT id FROM characters WHERE user_id=$1)',
          [id],
        );
        await pool.query('DELETE FROM "user" WHERE id=$1', [id]);
      }
    } finally {
      await new Promise<void>((r, j) => server.close((e) => (e ? j(e) : r())));
      await pool.end();
    }
  }
});
