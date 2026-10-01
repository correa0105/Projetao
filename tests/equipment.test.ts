import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { pool } from '../server/db.js';
import { migrate } from '../server/migrate.js';
import { seed } from '../server/seed.js';
import { createLegacyTestCharacter } from './character-fixtures.js';

test('equipamento: proprietário, unidades, mãos, cofre, persistência e referências da arte', async () => {
  await migrate();
  await seed();
  const { createApp } = await import('../server/app.js');
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/api`;
  const origin = (process.env.APP_ORIGIN || 'http://localhost:3000').split(',')[0];
  const users: string[] = [];
  async function req(path: string, cookie = '', body?: unknown) {
    const response = await fetch(base + path, {
      method: body ? 'POST' : 'GET',
      headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, data: await response.json(), headers: response.headers };
  }
  async function signup() {
    const result = await req('/auth/sign-up/email', '', {
      name: 'Equipamento teste',
      email: `equipment-${randomUUID()}@example.test`,
      password: `Test-${randomUUID()}`,
    });
    assert.equal(result.status, 200);
    users.push(result.data.user.id);
    return {
      id: result.data.user.id,
      cookie: result.headers
        .getSetCookie()
        .map((value) => value.split(';')[0])
        .join('; '),
    };
  }
  try {
    const alice = await signup(),
      bob = await signup();
    const character = await createLegacyTestCharacter(alice.id);
    const body = (slot: string, item_id: string | null) => ({
      character_id: character.id,
      slot,
      item_id,
    });
    const equip = (slot: string, item_id: string | null) =>
      req('/inventory/equipment', alice.cookie, body(slot, item_id));
    const state = () => req(`/characters/${character.id}/storage`, alice.cookie);
    for (const [id, quantity] of [
      ['longsword', 2],
      ['ring-of-protection', 1],
      ['plate-armor', 1],
      ['shield', 1],
      ['greatsword', 1],
      ['backpack', 1],
    ] as const)
      await pool.query('INSERT INTO inventory(character_id,item_id,quantity) VALUES($1,$2,$3)', [
        character.id,
        id,
        quantity,
      ]);
    assert.equal((await req('/inventory/equipment', '', body('armor', 'plate-armor'))).status, 401);
    assert.equal(
      (await req('/inventory/equipment', bob.cookie, body('armor', 'plate-armor'))).status,
      404,
    );
    assert.equal((await equip('head', 'longsword')).status, 400);
    assert.equal((await equip('main_hand', 'dagger')).status, 409);
    assert.equal((await equip('armor', 'plate-armor')).status, 200);
    const repeated = await Promise.all([
      equip('main_hand', 'longsword'),
      equip('main_hand', 'longsword'),
    ]);
    assert.ok(repeated.every((result) => result.status === 200));
    assert.equal(
      (await state()).data.equipped.filter((item: { slot: string }) => item.slot === 'main_hand')
        .length,
      1,
    );
    assert.equal((await equip('ring_left', 'ring-of-protection')).status, 200);
    assert.equal((await equip('ring_right', 'ring-of-protection')).status, 409);
    assert.equal((await equip('off_hand', 'shield')).status, 200);
    assert.equal((await equip('main_hand', 'greatsword')).status, 200);
    assert.ok(
      !(await state()).data.equipped.some((item: { slot: string }) => item.slot === 'off_hand'),
    );
    assert.equal((await equip('off_hand', 'shield')).status, 409);
    assert.equal((await equip('main_hand', 'longsword')).status, 200);
    const transfer = (quantity: number) =>
      req('/inventory/transfers', alice.cookie, {
        character_id: character.id,
        item_id: 'longsword',
        direction: 'to_vault',
        quantity,
        idempotency_key: randomUUID(),
      });
    assert.equal((await transfer(2)).status, 409);
    assert.equal((await transfer(1)).status, 201);
    assert.equal(
      (await state()).data.inventory.find((item: { id: string }) => item.id === 'longsword')
        .quantity,
      1,
    );
    // The accepted job keeps exact reference bytes even if equipment changes later.
    await pool.query(
      'INSERT INTO character_art_worker(id,heartbeat_at,available) VALUES(true,now(),true) ON CONFLICT(id) DO UPDATE SET heartbeat_at=now(),available=true',
    );
    const reference = (
      await sharp({ create: { width: 32, height: 48, channels: 4, background: '#778899' } })
        .png()
        .toBuffer()
    ).toString('base64');
    const art = {
      character_id: character.id,
      reference,
      equipment_slots: ['armor', 'ring_left', 'main_hand'],
      idempotency_key: randomUUID(),
    };
    assert.equal(
      (await req('/character-art', alice.cookie, { ...art, helmet_mode: 'invalid' })).status,
      400,
    );
    assert.equal(
      (await req('/character-art', alice.cookie, { ...art, helmet_mode: 'open' })).status,
      400,
    );
    assert.equal(
      (await req('/character-art', alice.cookie, { ...art, equipment_slots: ['head'] })).status,
      409,
    );
    const accepted = await req('/character-art', alice.cookie, art);
    assert.equal(accepted.status, 202);
    const { rows: snapshots } = await pool.query(
      'SELECT * FROM character_art_equipment WHERE job_id=$1 ORDER BY slot',
      [accepted.data.id],
    );
    assert.equal(snapshots.length, 3);
    assert.ok(snapshots.every((item) => Buffer.isBuffer(item.image) && item.image.length > 100));
    assert.equal((await equip('armor', null)).status, 200);
    const persisted = await pool.query(
      'SELECT count(*)::int AS count FROM character_art_equipment WHERE job_id=$1',
      [accepted.data.id],
    );
    assert.equal(persisted.rows[0].count, 3);
    assert.equal(
      (await req('/character-art', bob.cookie, { ...art, idempotency_key: randomUUID() })).status,
      404,
    );
    const { completeArt } = await import('../server/character-art.js');
    const cutout = await sharp({
      create: { width: 512, height: 768, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .composite([
        {
          input: await sharp({
            create: { width: 120, height: 400, channels: 4, background: '#556677' },
          })
            .png()
            .toBuffer(),
          left: 200,
          top: 250,
        },
      ])
      .png()
      .toBuffer();
    await pool.query("UPDATE character_art_jobs SET status='running' WHERE id=$1", [
      accepted.data.id,
    ]);
    await completeArt(accepted.data.id, cutout);
    assert.equal(
      (await pool.query('SELECT portrait_revision FROM characters WHERE id=$1', [character.id]))
        .rows[0].portrait_revision,
      1,
    );
    assert.equal((await equip('main_hand', null)).status, 200);
    assert.equal((await transfer(1)).status, 201);
    assert.ok(
      !(await state()).data.inventory.some((item: { id: string }) => item.id === 'longsword'),
    );
  } finally {
    await pool.query('DELETE FROM "user" WHERE id=ANY($1::text[])', [users]);
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.end();
  }
});
