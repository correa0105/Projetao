import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pool } from '../server/db.js';
import { migrate } from '../server/migrate.js';
import { seed } from '../server/seed.js';
import { createLegacyTestCharacter } from './character-fixtures.js';
import { purchase } from '../server/services.js';
import { PLATE_PIECES, purchaseContents, shopWeight } from '../shared/armor-bundles.js';
import { compatibleSlots } from '../shared/equipment.js';

test('conjunto de placas: entrega atômica, replay, peças antigas, peso e categorias', async () => {
  await migrate();
  await seed();
  const { createApp } = await import('../server/app.js');
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', r));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const origin = (process.env.APP_ORIGIN || 'http://localhost:3000').split(',')[0];
  const base = `http://127.0.0.1:${address.port}/api`;
  let userId = '';
  let cookie = '';
  async function req(path: string, body?: unknown) {
    const response = await fetch(base + path, {
      method: body ? 'POST' : 'GET',
      headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, data: await response.json(), headers: response.headers };
  }
  try {
    const signup = await req('/auth/sign-up/email', {
      name: 'Teste peças',
      email: `armor-${randomUUID()}@example.test`,
      password: `Test-${randomUUID()}`,
    });
    assert.equal(signup.status, 200);
    userId = signup.data.user.id;
    cookie = signup.headers
      .getSetCookie()
      .map((v) => v.split(';')[0])
      .join('; ');
    const character = await createLegacyTestCharacter(userId);
    await pool.query('UPDATE characters SET gold_cp=1000000 WHERE id=$1', [character.id]);
    const body = {
      character_id: character.id,
      idempotency_key: randomUUID(),
      items: [{ item_id: 'plate-armor', quantity: 2 }],
    };
    const replies = await Promise.all([req('/shop/checkout', body), req('/shop/checkout', body)]);
    assert.deepEqual(replies.map((r) => r.status).sort(), [200, 201]);
    assert.equal(replies[0].data.total_cp, 300000);
    const inventory = async () =>
      (
        await pool.query(
          'SELECT i.item_id,i.quantity,c.weight_lb FROM inventory i JOIN catalog_items c ON c.id=i.item_id WHERE character_id=$1 ORDER BY item_id',
          [character.id],
        )
      ).rows;
    let rows = await inventory();
    assert.equal(rows.length, 6);
    assert.ok(rows.every((r) => r.quantity === 2));
    assert.equal(
      rows.reduce((sum, r) => sum + Number(r.weight_lb) * r.quantity, 0),
      130,
    );
    assert.equal(shopWeight({ id: 'plate-armor', weight_lb: 27 }), 65);
    assert.equal(
      (await pool.query('SELECT gold_cp FROM characters WHERE id=$1', [character.id])).rows[0]
        .gold_cp,
      700000,
    );
    assert.equal(
      (
        await pool.query(
          'SELECT g.* FROM purchase_item_grants g JOIN purchases p ON p.id=g.purchase_id WHERE p.character_id=$1',
          [character.id],
        )
      ).rows.length,
      6,
    );
    assert.equal(
      (
        await req('/shop/checkout', {
          ...body,
          character_id: randomUUID(),
          idempotency_key: randomUUID(),
        })
      ).status,
      404,
    );
    assert.equal(
      (
        await req('/shop/checkout', {
          ...body,
          idempotency_key: randomUUID(),
          items: [{ item_id: 'plate-helmet', quantity: 1 }],
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await req('/shop/checkout', {
          ...body,
          idempotency_key: randomUUID(),
          items: [{ item_id: 'plate-armor', quantity: 99 }],
        })
      ).status,
      409,
    );
    assert.deepEqual(await inventory(), rows);
    const legacyKey = randomUUID();
    await purchase(userId, character.id, 'plate-armor', 1, legacyKey);
    await purchase(userId, character.id, 'plate-armor', 1, legacyKey);
    assert.ok((await inventory()).every((r) => r.quantity === 3));
    await purchase(userId, character.id, 'leather-armor', 1, randomUUID());
    await purchase(userId, character.id, 'chain-mail', 1, randomUUID());
    assert.equal((await inventory()).length, 8);
    assert.deepEqual(purchaseContents('half-plate'), ['half-plate']);
    assert.deepEqual(
      compatibleSlots({ id: 'ring-mail', name: 'Cota de anéis', category: 'Armaduras' }),
      ['armor'],
    );
    // Existing owned suits are captured by migration 038; seed applies each snapshot once.
    await pool.query('INSERT INTO armor_piece_backfills(character_id,quantity) VALUES($1,2)', [
      character.id,
    ]);
    await pool.query(
      "INSERT INTO account_vault(user_id,item_id,quantity) VALUES($1,'plate-armor',1)",
      [userId],
    );
    await pool.query('INSERT INTO armor_piece_backfills(user_id,quantity) VALUES($1,1)', [userId]);
    await seed();
    await seed();
    rows = await inventory();
    assert.ok(rows.filter((r) => PLATE_PIECES.includes(r.item_id)).every((r) => r.quantity === 5));
    assert.equal(
      (await pool.query('SELECT * FROM account_vault WHERE user_id=$1', [userId])).rows.length,
      6,
    );
    await purchase(userId, character.id, 'plate-armor', 1, randomUUID());
    await seed();
    assert.ok(
      (await inventory())
        .filter((r) => PLATE_PIECES.includes(r.item_id))
        .every((r) => r.quantity === 6),
    );
    for (const id of [
      'cosmetic-gloves',
      'torch',
      'hooded-lantern',
      'hempen-rope-50-feet',
      'grappling-hook',
      'cigar',
      'greatsword',
    ])
      await purchase(userId, character.id, id, 1, randomUUID());
    const equip = (slot: string, item_id: string | null) =>
      req('/inventory/equipment', { character_id: character.id, slot, item_id });
    for (const [slot, id] of [
      ['head', 'plate-helmet'],
      ['shoulders', 'plate-pauldrons'],
      ['bracers', 'plate-bracers'],
      ['legs', 'plate-leggings'],
      ['feet', 'plate-boots'],
    ])
      assert.equal((await equip(slot, id)).status, 200);
    assert.equal((await equip('armor', 'plate-helmet')).status, 400);
    assert.equal((await equip('hands', 'cosmetic-gloves')).status, 409);
    await equip('bracers', null);
    assert.equal((await equip('hands', 'cosmetic-gloves')).status, 200);
    assert.equal((await equip('bracers', 'plate-bracers')).status, 200);
    const storage = (await req(`/characters/${character.id}/storage`)).data;
    assert.ok(!storage.equipped.some((i: { slot: string }) => i.slot === 'hands'));
    assert.equal(
      storage.inventory.find((i: { id: string }) => i.id === 'cosmetic-gloves').quantity,
      1,
    );
    for (const id of [
      'torch',
      'hooded-lantern',
      'hempen-rope-50-feet',
      'grappling-hook',
      'cigar',
    ]) {
      assert.equal((await equip('off_hand', id)).status, 200);
      assert.equal((await equip('main_hand', id)).status, 409); // One physical unit cannot fill both hands.
      await equip('off_hand', null);
      assert.equal((await equip('main_hand', id)).status, 200);
      await equip('main_hand', null);
    }
    await equip('main_hand', 'greatsword');
    assert.equal((await equip('off_hand', 'torch')).status, 409);
  } catch (error) {
    console.error(error);
    throw error;
  } finally {
    if (userId) {
      await pool.query(
        'DELETE FROM purchases WHERE character_id IN (SELECT id FROM characters WHERE user_id=$1)',
        [userId],
      );
      await pool.query(
        'DELETE FROM shop_checkouts WHERE character_id IN (SELECT id FROM characters WHERE user_id=$1)',
        [userId],
      );
      await pool.query('DELETE FROM "user" WHERE id=$1', [userId]);
    }
    await new Promise<void>((r) => server.close(() => r()));
    await pool.end();
  }
});
