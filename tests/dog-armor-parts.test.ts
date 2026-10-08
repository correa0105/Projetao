import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pool } from '../server/db.js';
import { migrate } from '../server/migrate.js';
import { seed } from '../server/seed.js';
import { createLegacyTestCharacter } from './character-fixtures.js';
import { BARDING_PARTS } from '../shared/companion-equipment.js';

test('cachorro: partes escolhidas persistem na geração e filtram proteção sem alterar equipamento ou ouro', async () => {
  assert.match(new URL(process.env.DATABASE_URL!).pathname, /^\/alvorada_test_[0-9a-f]{32}$/);
  await migrate();
  await seed();
  const { createApp } = await import('../server/app.js');
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', r));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = 'http://127.0.0.1:' + address.port + '/api',
    origin = (process.env.APP_ORIGIN || 'http://localhost:3000').split(',')[0];
  async function req(path: string, cookie = '', data?: unknown, method = data ? 'POST' : 'GET') {
    const r = await fetch(base + path, {
      method,
      headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json' },
      ...(data ? { body: JSON.stringify(data) } : {}),
    });
    return { status: r.status, data: await r.json(), headers: r.headers };
  }
  async function signup() {
    const r = await req('/auth/sign-up/email', '', {
      name: 'Partes do cão',
      email: randomUUID() + '@example.test',
      password: 'Test-' + randomUUID(),
    });
    assert.equal(r.status, 200);
    return {
      id: r.data.user.id,
      cookie: r.headers
        .getSetCookie()
        .map((v) => v.split(';')[0])
        .join('; '),
    };
  }
  try {
    const owner = await signup(),
      other = await signup(),
      hero = await createLegacyTestCharacter(owner.id, 'Proteções');
    await pool.query('UPDATE characters SET gold_cp=1000000 WHERE id=$1', [hero.id]);
    const pets = [];
    for (const species of ['dog', 'dog', 'cat']) {
      const result = await req('/pets/purchase', owner.cookie, {
        character_id: hero.id,
        pet_id: species,
        name: species + randomUUID().slice(0, 4),
        idempotency_key: randomUUID(),
      });
      assert.equal(result.status, 201);
      pets.push(result.data.pet);
    }
    const [dog, second, cat] = pets;
    for (const item_id of ['pet-armor-scales', 'pet-bandana', 'pet-velvet-cape'])
      assert.equal(
        (
          await req('/purchases', owner.cookie, {
            character_id: hero.id,
            item_id,
            quantity: 1,
            idempotency_key: randomUUID(),
          })
        ).status,
        201,
      );
    const path = '/companions/' + hero.id;
    assert.equal(
      (
        await req(
          path + '/equipment-set',
          owner.cookie,
          { kind: 'pet', companion_id: dog.id, item_id: 'pet-armor-scales' },
          'PUT',
        )
      ).status,
      200,
    );
    for (const [slot, item_id] of [
      ['neck', 'pet-bandana'],
      ['cloak', 'pet-velvet-cape'],
    ])
      assert.equal(
        (
          await req(
            path + '/equipment',
            owner.cookie,
            { kind: 'pet', companion_id: dog.id, slot, item_id },
            'PUT',
          )
        ).status,
        200,
      );
    const stockBefore = (
      await pool.query('SELECT * FROM inventory WHERE character_id=$1 ORDER BY item_id', [hero.id])
    ).rows;
    const equipmentBefore = (
      await pool.query('SELECT * FROM companion_equipment WHERE wardrobe_id=$1 ORDER BY slot', [
        dog.id,
      ])
    ).rows;
    const charBefore = (await pool.query('SELECT * FROM characters WHERE id=$1', [hero.id]))
      .rows[0];
    const input = (parts?: string[]) => ({
      kind: 'pet',
      companion_id: dog.id,
      idempotency_key: randomUUID(),
      ...(parts ? { barding_parts: parts } : {}),
    });
    const refreshWorker = () =>
      pool.query(
        'INSERT INTO character_art_worker(id,heartbeat_at,available) VALUES(true,now(),true) ON CONFLICT(id) DO UPDATE SET heartbeat_at=now(),available=true',
      );
    await refreshWorker();
    assert.equal((await req(path + '/art', '', input())).status, 401);
    assert.equal((await req(path + '/art', other.cookie, input())).status, 404);
    assert.equal((await req(path + '/art', owner.cookie, input(['wing']))).status, 400);
    assert.equal((await req(path + '/art', owner.cookie, input(['head', 'head']))).status, 400);
    assert.equal(
      (await req(path + '/art', owner.cookie, { ...input(['head']), companion_id: cat.id })).status,
      400,
    );
    const full = await req(path + '/art', owner.cookie, input());
    assert.equal(full.status, 202);
    assert.deepEqual(full.data.barding_parts, [...BARDING_PARTS]);
    const refs = async (id: string) =>
      (
        await pool.query(
          'SELECT slot,item_id,image FROM companion_art_equipment WHERE job_id=$1 ORDER BY slot',
          [id],
        )
      ).rows;
    assert.equal((await refs(full.data.id)).length, 8);
    await pool.query("UPDATE companion_art_jobs SET status='failed' WHERE id=$1", [full.data.id]);
    const partial = input(['body', 'chest']);
    const selected = await req(path + '/art', owner.cookie, partial);
    assert.equal(selected.status, 202);
    assert.deepEqual(selected.data.barding_parts, ['chest', 'body']);
    assert.equal(
      (await req(path + '/art', owner.cookie, { ...partial, barding_parts: ['chest', 'body'] }))
        .data.id,
      selected.data.id,
    );
    assert.equal(
      (await req(path + '/art', owner.cookie, { ...partial, barding_parts: ['head'] })).status,
      409,
    );
    const chosen = await refs(selected.data.id);
    assert.deepEqual(
      chosen.map((r) => r.slot),
      ['armor', 'cloak', 'neck', 'shoulders'],
    );
    assert.ok(chosen.every((r) => r.image.length > 1000));
    let state = (await req(path + '/equipment', owner.cookie)).data;
    assert.deepEqual(state.companions.find((a: any) => a.id === dog.id).barding_parts, [
      'chest',
      'body',
    ]);
    assert.deepEqual(state.companions.find((a: any) => a.id === second.id).barding_parts, [
      ...BARDING_PARTS,
    ]);
    await pool.query("UPDATE companion_art_jobs SET status='failed' WHERE id=$1", [
      selected.data.id,
    ]);
    const bare = await req(path + '/art', owner.cookie, input([]));
    assert.equal(bare.status, 202);
    assert.deepEqual(bare.data.barding_parts, []);
    assert.deepEqual((await refs(bare.data.id)).map((r) => r.item_id).sort(), [
      'pet-bandana',
      'pet-velvet-cape',
    ]);
    state = (await req(path + '/equipment', owner.cookie)).data;
    assert.deepEqual(state.companions.find((a: any) => a.id === dog.id).barding_parts, []);
    assert.deepEqual(
      (
        await pool.query('SELECT * FROM inventory WHERE character_id=$1 ORDER BY item_id', [
          hero.id,
        ])
      ).rows,
      stockBefore,
    );
    assert.deepEqual(
      (
        await pool.query('SELECT * FROM companion_equipment WHERE wardrobe_id=$1 ORDER BY slot', [
          dog.id,
        ])
      ).rows,
      equipmentBefore,
    );
    assert.deepEqual(
      (await pool.query('SELECT * FROM characters WHERE id=$1', [hero.id])).rows[0],
      charBefore,
    );
  } finally {
    await new Promise<void>((r, j) => server.close((e) => (e ? j(e) : r())));
    await pool.end();
  }
});
