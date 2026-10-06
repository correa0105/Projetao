import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pool } from '../server/db.js';
import { migrate } from '../server/migrate.js';
import { seed } from '../server/seed.js';
import { createLegacyTestCharacter } from './character-fixtures.js';
import { mounts } from '../shared/mounts.js';
import { pets } from '../shared/pets.js';

test('animais: nome pessoal obrigatório, economia e replay em PostgreSQL isolado', async (t) => {
  assert.match(new URL(process.env.DATABASE_URL!).pathname, /^\/alvorada_test_[0-9a-f]{32}$/);
  await migrate();
  await seed();
  const { createApp } = await import('../server/app.js');
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/api`;
  const origin = (process.env.APP_ORIGIN || 'http://localhost:3000').split(',')[0];
  async function req(path: string, cookie = '', method = 'GET', body?: unknown) {
    const response = await fetch(base + path, {
      method,
      headers: { Origin: origin, Cookie: cookie, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, data: await response.json(), headers: response.headers };
  }
  async function signup() {
    const response = await req('/auth/sign-up/email', '', 'POST', {
      name: 'Companheiros do caminho',
      email: `animal-names-${randomUUID()}@example.test`,
      password: `Test-${randomUUID()}`,
    });
    assert.equal(response.status, 200);
    return {
      id: response.data.user.id as string,
      cookie: response.headers
        .getSetCookie()
        .map((value) => value.split(';')[0])
        .join('; '),
    };
  }
  try {
    const owner = await signup(),
      other = await signup();
    const hero = await createLegacyTestCharacter(owner.id, 'Aurora');
    await pool.query('UPDATE characters SET gold_cp=100000 WHERE id=$1', [hero.id]);
    const targets = [
      {
        endpoint: '/stable/purchase',
        table: 'character_mounts',
        key: 'mount_id',
        species: mounts.find((item) => item.id === 'pony')!,
        result: 'mount',
        personalName: "Relâmpago d'Água",
      },
      {
        endpoint: '/pets/purchase',
        table: 'character_pets',
        key: 'pet_id',
        species: pets.find((item) => item.id === 'dog')!,
        result: 'pet',
        personalName: 'Brasa da Lua',
      },
    ];
    const gold = async () =>
      (await pool.query('SELECT gold_cp FROM characters WHERE id=$1', [hero.id])).rows[0].gold_cp;
    for (const target of targets) {
      const body = {
        character_id: hero.id,
        [target.key]: target.species.id,
        idempotency_key: randomUUID(),
      };
      const records = async () =>
        (
          await pool.query(`SELECT * FROM ${target.table} WHERE character_id=$1 ORDER BY id`, [
            hero.id,
          ])
        ).rows;
      await t.test(
        `${target.result}: nome ausente, vazio ou só espaços não cria nem debita`,
        async () => {
          const before = await gold();
          const previous = await records();
          for (const name of [undefined, '', '   ', '\t\n\r', '\u00a0\u2003', null, 123]) {
            const order = name === undefined ? body : { ...body, name };
            assert.equal((await req(target.endpoint, owner.cookie, 'POST', order)).status, 400);
            assert.equal(await gold(), before);
            assert.deepEqual(await records(), previous);
          }
        },
      );
      await t.test(
        `${target.result}: nome próprio aparado compra uma vez e respeita ownership`,
        async () => {
          const order = { ...body, name: `  ${target.personalName}  ` };
          const before = await gold();
          assert.equal((await req(target.endpoint, '', 'POST', order)).status, 401);
          assert.equal((await req(target.endpoint, other.cookie, 'POST', order)).status, 404);
          const responses = await Promise.all([
            req(target.endpoint, owner.cookie, 'POST', order),
            req(target.endpoint, owner.cookie, 'POST', order),
          ]);
          assert.deepEqual(responses.map((response) => response.status).sort(), [200, 201]);
          assert.ok(
            responses.every(
              (response) => response.data[target.result].name === target.personalName,
            ),
          );
          assert.equal(await gold(), before - target.species.price_cp);
          const purchased = await records();
          assert.equal(purchased.length, 1);
          assert.equal(purchased[0].name, target.personalName);
          assert.equal(
            (await req(target.endpoint, owner.cookie, 'POST', { ...order, name: 'Outro nome' }))
              .status,
            409,
          );
          assert.equal(
            (
              await req(target.endpoint, owner.cookie, 'POST', {
                ...order,
                name: target.personalName,
              })
            ).status,
            200,
          );
          assert.equal(await gold(), before - target.species.price_cp);
          assert.deepEqual(await records(), purchased);
        },
      );
      await t.test(
        `${target.result}: pedido histórico com nome de espécie mantém replay e registro`,
        async () => {
          const order = { ...body, idempotency_key: randomUUID(), name: target.species.name };
          const before = await gold();
          const purchase = await req(target.endpoint, owner.cookie, 'POST', order);
          assert.equal(purchase.status, 201);
          const purchased = await records();
          const replay = await req(target.endpoint, owner.cookie, 'POST', order);
          assert.equal(replay.status, 200);
          assert.equal(replay.data.replayed, true);
          assert.equal(replay.data[target.result].id, purchase.data[target.result].id);
          assert.equal(replay.data[target.result].name, target.species.name);
          assert.equal(await gold(), before - target.species.price_cp);
          assert.deepEqual(await records(), purchased);
        },
      );
    }
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await pool.end();
  }
});
