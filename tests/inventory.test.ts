import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pool } from '../server/db.js';
import { migrate } from '../server/migrate.js';
import { seed } from '../server/seed.js';
import { createLegacyTestCharacter } from './character-fixtures.js';

test('cofre: isolamento, pilhas, idempotência, concorrência e conservação dos itens', async () => {
  await migrate();
  await seed();
  const { createApp } = await import('../server/app.js');
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', r));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/api`;
  const origin = (process.env.APP_ORIGIN || 'http://localhost:3000').split(',')[0];
  const users: string[] = [];
  async function req(path: string, cookie = '', body?: unknown, from = origin) {
    const result = await fetch(base + path, {
      method: body ? 'POST' : 'GET',
      headers: { Cookie: cookie, Origin: from, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: result.status, data: await result.json(), headers: result.headers };
  }
  async function signup() {
    const result = await req('/auth/sign-up/email', '', {
      name: 'Cofre teste',
      email: `vault-${randomUUID()}@example.test`,
      password: `Test-${randomUUID()}`,
    });
    assert.equal(result.status, 200);
    users.push(result.data.user.id);
    return {
      id: result.data.user.id,
      cookie: result.headers
        .getSetCookie()
        .map((v) => v.split(';')[0])
        .join('; '),
    };
  }
  try {
    const alice = await signup(),
      bob = await signup();
    const a = await createLegacyTestCharacter(alice.id, 'Primeiro'),
      b = await createLegacyTestCharacter(alice.id, 'Segundo'),
      other = await createLegacyTestCharacter(bob.id);
    const {
      rows: [item],
    } = await pool.query(
      'SELECT id FROM catalog_items WHERE active=true ORDER BY price_cp LIMIT 1',
    );
    await pool.query('INSERT INTO inventory(character_id,item_id,quantity) VALUES($1,$2,10)', [
      a.id,
      item.id,
    ]);
    const body = (character = a.id, quantity = 1, direction = 'to_vault', key = randomUUID()) => ({
      character_id: character,
      item_id: item.id,
      quantity,
      direction,
      idempotency_key: key,
    });
    const state = (id = a.id) => req(`/characters/${id}/storage`, alice.cookie);
    assert.equal((await req(`/characters/${a.id}/storage`)).status, 401);
    assert.equal((await req(`/characters/${a.id}/storage`, bob.cookie)).status, 404);
    assert.equal((await req('/inventory/transfers', bob.cookie, body())).status, 404);
    assert.equal(
      (await req('/inventory/transfers', alice.cookie, body(), 'https://invalid.example')).status,
      403,
    );
    for (const quantity of [0, -1, 1.5])
      assert.equal(
        (await req('/inventory/transfers', alice.cookie, body(a.id, quantity))).status,
        400,
      );
    assert.equal(
      (await req('/inventory/transfers', alice.cookie, { ...body(), user_id: bob.id })).status,
      400,
    );
    assert.equal((await req('/inventory/transfers', alice.cookie, body(a.id, 11))).status, 409);
    assert.equal((await state()).data.inventory[0].quantity, 10);
    const request = body(a.id, 6);
    const duplicate = await Promise.all([
      req('/inventory/transfers', alice.cookie, request),
      req('/inventory/transfers', alice.cookie, request),
    ]);
    assert.deepEqual(duplicate.map((r) => r.status).sort(), [200, 201]);
    assert.equal((await state()).data.inventory[0].quantity, 4);
    assert.equal((await state(b.id)).data.vault[0].quantity, 6);
    assert.equal((await req(`/characters/${other.id}/storage`, bob.cookie)).data.vault.length, 0);
    assert.equal(
      (await req('/inventory/transfers', alice.cookie, { ...request, quantity: 5 })).status,
      409,
    );
    // Two characters simultaneously try to withdraw the last pile from their shared chest.
    const race = await Promise.all([
      req('/inventory/transfers', alice.cookie, body(a.id, 6, 'to_backpack')),
      req('/inventory/transfers', alice.cookie, body(b.id, 6, 'to_backpack')),
    ]);
    assert.deepEqual(race.map((r) => r.status).sort(), [201, 409]);
    const all = await state();
    assert.equal(all.data.vault.length, 0);
    const {
      rows: [total],
    } = await pool.query(
      'SELECT sum(quantity)::int AS count FROM inventory WHERE character_id=ANY($1::uuid[])',
      [[a.id, b.id]],
    );
    assert.equal(total.count, 10);
    // Purchase and transfer use the same character lock and cannot lose increments.
    const initial = all.data.inventory[0]?.quantity ?? 0;
    if (initial === 0) await req('/inventory/transfers', alice.cookie, body(b.id, 1));
    if (initial === 0)
      await req('/inventory/transfers', alice.cookie, body(a.id, 1, 'to_backpack'));
    const outcomes = await Promise.all([
      req('/inventory/transfers', alice.cookie, body()),
      req('/purchases', alice.cookie, {
        character_id: a.id,
        item_id: item.id,
        quantity: 1,
        idempotency_key: randomUUID(),
      }),
    ]);
    assert.ok(outcomes.every((r) => r.status === 201));
    const {
      rows: [combined],
    } = await pool.query(
      `SELECT (SELECT COALESCE(sum(quantity),0) FROM inventory WHERE character_id=ANY($1::uuid[])) + (SELECT COALESCE(sum(quantity),0) FROM account_vault WHERE user_id=$2) AS count`,
      [[a.id, b.id], alice.id],
    );
    assert.equal(Number(combined.count), 11);
    const { rows: audit } = await pool.query(
      'SELECT * FROM inventory_transfers WHERE user_id=$1 AND idempotency_key=$2',
      [alice.id, request.idempotency_key],
    );
    assert.equal(audit.length, 1);
    assert.equal(audit[0].quantity, 6);
    await pool.query('UPDATE characters SET deleted_at=now() WHERE id=$1', [a.id]);
    assert.equal((await state()).status, 404);
    assert.equal((await req('/inventory/transfers', alice.cookie, body())).status, 404);
    assert.equal((await state(b.id)).status, 200);
  } finally {
    for (const id of users) await pool.query('DELETE FROM "user" WHERE id=$1', [id]);
    await new Promise<void>((r, reject) => server.close((e) => (e ? reject(e) : r())));
    await pool.end();
  }
});
